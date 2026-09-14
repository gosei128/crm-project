"""Owner trash: hard-delete terminal booking records only."""
from datetime import date, datetime, time, timedelta


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _owner_token(client):
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": "trash-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code == 201, r.text
    return _login(client, "trash-owner@x.local", "pw123456")


def _customer_token(client, email):
    r = client.post(
        "/auth/signup", json={"email": email, "password": "password123", "name": "C"}
    )
    assert r.status_code == 201, r.text
    return _login(client, email, "password123")


def _setup(client, owner):
    r = client.post(
        "/services/",
        json={"name": "Haircut", "duration_minutes": 30, "description": "cut"},
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 201, r.text
    tomorrow = date.today() + timedelta(days=1)
    r = client.post(
        f"/services/{(r.json()['id'])}/availability",
        json={
            "day_of_week": tomorrow.weekday(),
            "start_time": "10:00",
            "end_time": "12:00",
        },
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 201, r.text
    return datetime.combine(tomorrow, time(10, 0)).isoformat()


def _make(client, slot, phone):
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "G", "customer_phone": phone},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_owner_trashes_cancelled_record(client):
    owner = _owner_token(client)
    slot = _setup(client, owner)
    slot2 = (datetime.fromisoformat(slot) + timedelta(minutes=30)).isoformat()
    bid = _make(client, slot2, "09170000041")

    r = client.patch(
        f"/bookings/{bid}/cancel", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 200, r.text

    r = client.delete(
        f"/bookings/{bid}", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 204, r.text

    # gone from detail + list
    r = client.get(
        f"/bookings/{bid}", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 404, r.text
    r = client.get(
        "/bookings/all?status=cancelled",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    assert all(b["id"] != bid for b in r.json())


def test_trash_rejected_for_active_missing_and_non_owner(client):
    owner = _owner_token(client)
    slot = _setup(client, owner)
    bid = _make(client, slot, "09170000042")

    # pending hold is protected
    r = client.delete(
        f"/bookings/{bid}", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 400, r.text

    # booked is protected too
    r = client.patch(
        f"/bookings/{bid}/confirm-payment",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    r = client.delete(
        f"/bookings/{bid}", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 400, r.text

    # missing
    r = client.delete(
        "/bookings/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 404, r.text

    # unauthenticated / customer forbidden
    assert client.delete(f"/bookings/{bid}").status_code == 401
    cust = _customer_token(client, "trash-cust@x.local")
    assert (
        client.delete(
            f"/bookings/{bid}", headers={"Authorization": f"Bearer {cust}"}
        ).status_code
        == 403
    )
