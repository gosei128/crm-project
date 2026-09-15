"""RBAC matrix: roles, ownership, claim flow, strict separation."""
from datetime import date, datetime, time, timedelta
from io import BytesIO

from PIL import Image

OWNER_EMAIL = "owner@kabarbers.local"
OWNER_PW = "ownerpass123"


def _make_png(color=(40, 160, 80)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (8, 8), color).save(buf, format="PNG")
    return buf.getvalue()


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _owner_token(client):
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": OWNER_EMAIL, "password": OWNER_PW, "name": "Owner"},
    )
    assert r.status_code == 201, r.text
    return _login(client, OWNER_EMAIL, OWNER_PW)


def _customer_token(client, email, name="Customer"):
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "name": name},
    )
    assert r.status_code == 201, r.text
    return _login(client, email, "password123")


def _setup_service(client, owner_token):
    r = client.post(
        "/services/",
        json={"name": "Haircut", "duration_minutes": 30, "description": "cut"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert r.status_code == 201, r.text
    service_id = r.json()["id"]
    tomorrow = date.today() + timedelta(days=1)
    r = client.post(
        f"/services/{service_id}/availability",
        json={
            "day_of_week": tomorrow.weekday(),
            "start_time": "10:00",
            "end_time": "12:00",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert r.status_code == 201, r.text
    slot = datetime.combine(tomorrow, time(10, 0)).isoformat()
    return service_id, slot


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


# ---------- role enforcement ----------


def test_public_signup_always_customer_even_if_owner_requested(client):
    r = client.post(
        "/auth/signup",
        json={
            "email": "sneaky@example.com",
            "password": "password123",
            "name": "Sneaky",
            "role": "owner",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "customer"


def test_customer_forbidden_from_owner_routes(client):
    owner = _owner_token(client)
    _setup_service(client, owner)
    customer = _customer_token(client, "cust@example.com")
    h = _auth_header(customer)

    assert client.get("/bookings/all", headers=h).status_code == 403
    assert (
        client.patch("/shop/status", json={"is_open": False}, headers=h).status_code
        == 403
    )
    assert (
        client.post(
            "/services/",
            json={"name": "X", "duration_minutes": 30, "description": "x"},
            headers=h,
        ).status_code
        == 403
    )


def test_owner_forbidden_from_customer_routes(client):
    owner = _owner_token(client)
    _setup_service(client, owner)
    h = _auth_header(owner)

    assert client.get("/bookings/me", headers=h).status_code == 403
    assert (
        client.post(
            "/bookings/authenticated",
            json={
                "slot_start": "2030-01-01T10:00:00",
                "customer_name": "O",
                "customer_phone": "09170000000",
            },
            headers=h,
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/bookings/",
            json={"slot_start": "2030-01-01T10:00:00"},
            headers=h,
        ).status_code
        == 403
    )


def test_owner_blocked_from_public_booking_flow(client):
    owner = _owner_token(client)
    _setup_service(client, owner)
    tomorrow = date.today() + timedelta(days=2)
    # availability only exists for tomorrow(+1); use public flow rejection before slot checks:
    # owner is rejected by role guard regardless of slot validity.
    r = client.post(
        "/bookings/public",
        json={
            "slot_start": datetime.combine(tomorrow, time(10, 0)).isoformat(),
            "customer_name": "Owner",
            "customer_phone": "09170000000",
        },
        headers=_auth_header(owner),
    )
    assert r.status_code == 403


def test_unauthenticated_cannot_reach_protected_routes(client):
    assert client.get("/bookings/me").status_code == 401
    assert client.get("/bookings/all").status_code == 401


# ---------- ownership ----------


def test_booking_detail_ownership(client):
    owner = _owner_token(client)
    _, slot = _setup_service(client, owner)
    cust_a = _customer_token(client, "a@example.com", "A")
    cust_b = _customer_token(client, "b@example.com", "B")

    r = client.post(
        "/bookings/authenticated",
        json={
            "slot_start": slot,
            "customer_name": "A",
            "customer_phone": "09170000001",
        },
        headers=_auth_header(cust_a),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    # owner sees all
    assert (
        client.get(f"/bookings/{booking_id}", headers=_auth_header(owner)).status_code
        == 200
    )
    # owning customer sees own
    assert (
        client.get(f"/bookings/{booking_id}", headers=_auth_header(cust_a)).status_code
        == 200
    )
    # other customer forbidden
    assert (
        client.get(f"/bookings/{booking_id}", headers=_auth_header(cust_b)).status_code
        == 403
    )
    # anonymous unauthenticated
    assert client.get(f"/bookings/{booking_id}").status_code == 401


def test_guest_proof_upload_allowed_then_claim_flow(client):
    """Guest holder-of-the-UUID can upload proof; linked bookings still need the owner."""
    owner = _owner_token(client)
    _, slot = _setup_service(client, owner)

    # anonymous public booking
    r = client.post(
        "/bookings/public",
        json={
            "slot_start": slot,
            "customer_name": "Guest",
            "customer_phone": "09170000002",
        },
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]
    assert r.json()["customer_id"] is None

    # guest (no login) uploads proof to own unlinked pending booking -> 200
    r = client.post(
        f"/bookings/{booking_id}/payment-proof",
        json={"payment_proof_url": "https://x/y.png"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_proof_url"] == "https://x/y.png"

    # second booking for the claim flow (first slot is taken)
    tomorrow = date.today() + timedelta(days=1)
    slot2 = datetime.combine(tomorrow, time(10, 30)).isoformat()
    r = client.post(
        "/bookings/public",
        json={
            "slot_start": slot2,
            "customer_name": "Guest2",
            "customer_phone": "09170000003",
        },
    )
    assert r.status_code == 201, r.text
    booking2_id = r.json()["id"]

    cust_b = _customer_token(client, "b2@example.com", "B")
    # wrong account (unrelated customer) -> 403
    assert (
        client.post(
            f"/bookings/{booking2_id}/payment-proof",
            json={"payment_proof_url": "https://x/y.png"},
            headers=_auth_header(cust_b),
        ).status_code
        == 403
    )

    # claim with wrong phone -> 403
    assert (
        client.post(
            f"/bookings/{booking2_id}/claim",
            json={"customer_phone": "09998887777"},
            headers=_auth_header(cust_b),
        ).status_code
        == 403
    )

    # claim with correct phone -> 200 and linked
    r = client.post(
        f"/bookings/{booking2_id}/claim",
        json={"customer_phone": "09170000003"},
        headers=_auth_header(cust_b),
    )
    assert r.status_code == 200, r.text
    assert r.json()["customer_id"] is not None

    # now proof upload works for the owning customer
    r = client.post(
        f"/bookings/{booking2_id}/payment-proof",
        json={"payment_proof_url": "https://x/y.png"},
        headers=_auth_header(cust_b),
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_proof_url"] == "https://x/y.png"

    # guest (no login) can no longer touch the linked booking -> 403
    assert (
        client.post(
            f"/bookings/{booking2_id}/payment-proof",
            json={"payment_proof_url": "https://x/evil.png"},
        ).status_code
        == 403
    )


def test_guest_proof_file_upload_unlinked_pending_then_locked_once_booked(
    client, tmp_path, monkeypatch
):
    """Multipart guest upload works fresh, and is rejected once booked."""
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner = _owner_token(client)
    _, slot = _setup_service(client, owner)

    r = client.post(
        "/bookings/public",
        json={
            "slot_start": slot,
            "customer_name": "Guest",
            "customer_phone": "09170000004",
        },
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    r = client.post(
        f"/bookings/{booking_id}/payment-proof-file",
        files={"file": ("receipt.png", _make_png(), "image/png")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_proof_url"].endswith(f"/bookings/{booking_id}/proof-file")
    assert r.json()["downpayment_status"] == "pending_verification"

    # owner confirms -> booked; guest re-upload is rejected
    r = client.patch(
        f"/bookings/{booking_id}/confirm-payment",
        headers=_auth_header(owner),
    )
    assert r.status_code == 200, r.text
    assert (
        client.post(
            f"/bookings/{booking_id}/payment-proof-file",
            files={
                "file": ("again.png", _make_png((180, 60, 60)), "image/png")
            },
        ).status_code
        == 400
    )


def test_guest_proof_rejected_after_payment_window(client, db_session):
    """A stale-but-unswept pending booking refuses guest proof."""
    from app.models.booking import Booking as BookingModel

    owner = _owner_token(client)
    _, slot = _setup_service(client, owner)

    r = client.post(
        "/bookings/public",
        json={
            "slot_start": slot,
            "customer_name": "Guest",
            "customer_phone": "09170000005",
        },
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    booking = next(
        b for b in db_session.query(BookingModel).all() if str(b.id) == booking_id
    )
    booking.created_at = datetime.utcnow() - timedelta(minutes=16)
    db_session.commit()

    r = client.post(
        f"/bookings/{booking_id}/payment-proof",
        json={"payment_proof_url": "https://x/late.png"},
    )
    assert r.status_code == 400, r.text


def test_claim_phone_normalization_plus63_vs_09(client):
    owner = _owner_token(client)
    _setup_service(client, owner)
    # second slot at 10:30 for this booking
    tomorrow = date.today() + timedelta(days=1)
    slot2 = datetime.combine(tomorrow, time(10, 30)).isoformat()

    r = client.post(
        "/bookings/public",
        json={
            "slot_start": slot2,
            "customer_name": "Guest",
            "customer_phone": "+639171234567",
        },
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    cust = _customer_token(client, "c3@example.com", "C")
    r = client.post(
        f"/bookings/{booking_id}/claim",
        json={"customer_phone": "09171234567"},
        headers=_auth_header(cust),
    )
    assert r.status_code == 200, r.text


def test_require_role_rejects_unknown_roles():
    from app.core.dependency import require_role

    try:
        require_role("superadmin")
    except ValueError as e:
        assert "Unknown role" in str(e)
    else:  # pragma: no cover
        raise AssertionError("require_role should reject unknown roles")
