"""P0 production guards: past-date rejection, input caps, image verification."""
from datetime import date, datetime, time, timedelta
from io import BytesIO

from PIL import Image


def _make_png(color=(40, 160, 80)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (8, 8), color).save(buf, format="PNG")
    return buf.getvalue()


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _future_slot(client) -> str:
    """Create a service + tomorrow availability, return a real future slot."""
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": "p0-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code in (201, 403), r.text
    owner = _login(client, "p0-owner@x.local", "pw123456")
    h = {"Authorization": f"Bearer {owner}"}
    r = client.post(
        "/services/",
        json={"name": "Haircut", "duration_minutes": 30, "description": "cut"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    service_id = r.json()["id"]
    tomorrow = date.today() + timedelta(days=1)
    r = client.post(
        f"/services/{service_id}/availability",
        json={"day_of_week": tomorrow.weekday(), "start_time": "10:00", "end_time": "12:00"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    return datetime.combine(tomorrow, time(10, 0)).isoformat()


def test_past_slot_rejected(client):
    past = (datetime.now() - timedelta(days=1)).replace(microsecond=0).isoformat()
    r = client.post(
        "/bookings/public",
        json={"slot_start": past, "customer_name": "Past", "customer_phone": "09170000001"},
    )
    assert r.status_code in (400, 422), r.text


def test_pax_cap_enforced(client):
    slot = _future_slot(client)
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "Crowd", "customer_phone": "09170000002", "pax": 99},
    )
    assert r.status_code in (400, 422), r.text


def test_phone_format_enforced(client):
    slot = _future_slot(client)
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "Nope", "customer_phone": "abc"},
    )
    assert r.status_code in (400, 422), r.text


def test_available_slots_past_returns_empty(client):
    from datetime import date

    past = (date.today() - timedelta(days=3)).isoformat()
    r = client.get("/bookings/available_slots", params={"target_date": past})
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_weekly_schedule_window_clamped(client):
    from datetime import date

    far_past = (date.today() - timedelta(days=60)).isoformat()
    assert client.get("/bookings/weekly-schedule", params={"start_date": far_past}).status_code == 400
    far_future = (date.today() + timedelta(days=120)).isoformat()
    assert client.get("/bookings/weekly-schedule", params={"start_date": far_future}).status_code == 400


def test_spoofed_image_rejected(client):
    slot = _future_slot(client)
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "Spoof", "customer_phone": "09170000003"},
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]
    # Valid PNG header, garbage body, spoofed content-type.
    r = client.post(
        f"/bookings/{booking_id}/payment-proof-file",
        files={"file": ("receipt.png", b"\x89PNG\r\n\x1a\n" + b"0" * 100, "image/png")},
    )
    assert r.status_code == 400, r.text
    assert "real JPG" in r.json()["detail"]


def test_valid_image_accepted(client):
    slot = _future_slot(client)
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": "Real", "customer_phone": "09170000004"},
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]
    r = client.post(
        f"/bookings/{booking_id}/payment-proof-file",
        files={"file": ("receipt.png", _make_png(), "image/png")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["downpayment_status"] == "pending_verification"
    assert r.json()["payment_proof_url"].endswith(f"/bookings/{booking_id}/proof-file")
