"""Owner cancel of a pending hold (e.g. proof is not a real payment)."""
from datetime import date, datetime, time, timedelta


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _owner_token(client):
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": "cancel-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code == 201, r.text
    return _login(client, "cancel-owner@x.local", "pw123456")


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
    monday = tomorrow - timedelta(days=tomorrow.weekday())
    return monday.isoformat(), datetime.combine(tomorrow, time(10, 0)).isoformat()


def _slot_status(client, monday, slot):
    r = client.get(f"/bookings/weekly-schedule?start_date={monday}")
    assert r.status_code == 200, r.text
    for day in r.json()["days"]:
        for s in day["slots"]:
            if s["time"] == slot:
                return s["status"]
    raise AssertionError(f"slot {slot} not in schedule")


def test_owner_cancels_pending_hold_and_frees_slot(client):
    owner = _owner_token(client)
    monday, slot = _setup(client, owner)
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "G", "customer_phone": "09170000031"},
    )
    assert r.status_code == 201, r.text
    bid = r.json()["id"]
    assert _slot_status(client, monday, slot) == "held"

    r = client.patch(
        f"/bookings/{bid}/cancel", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"
    assert _slot_status(client, monday, slot) == "available"

    # filterable by the new status
    r = client.get(
        "/bookings/all?status=cancelled",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    assert any(b["id"] == bid for b in r.json())


def test_cancel_rejected_for_non_pending_missing_and_non_owner(client):
    owner = _owner_token(client)
    monday, slot = _setup(client, owner)
    slot2 = (datetime.fromisoformat(slot) + timedelta(minutes=30)).isoformat()

    # booked (owner-confirmed) cannot be cancelled this way
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "G", "customer_phone": "09170000032"},
    )
    bid = r.json()["id"]
    r = client.patch(
        f"/bookings/{bid}/confirm-payment",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    r = client.patch(
        f"/bookings/{bid}/cancel", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 400, r.text

    # missing booking
    r = client.patch(
        "/bookings/00000000-0000-0000-0000-000000000000/cancel",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 404, r.text

    # pending hold exists for auth checks
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot2, "customer_name": "H", "customer_phone": "09170000033"},
    )
    bid2 = r.json()["id"]

    # unauthenticated
    assert (
        client.patch(f"/bookings/{bid2}/cancel").status_code == 401
    )
    # customer (non-owner) forbidden
    cust = _customer_token(client, "cancel-cust@x.local")
    assert (
        client.patch(
            f"/bookings/{bid2}/cancel",
            headers={"Authorization": f"Bearer {cust}"},
        ).status_code
        == 403
    )
    assert _slot_status(client, monday, slot2) == "held"
