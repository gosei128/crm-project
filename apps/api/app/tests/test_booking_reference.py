"""Reference codes, guest lookup, ticket expiry, and private proof serving."""
import re
from datetime import date, datetime, time, timedelta
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.models.booking import Booking

REF_RE = re.compile(r"^[A-Z2-9]{8}$")


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
        json={"email": "ref-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code in (201, 403), r.text
    return _login(client, "ref-owner@x.local", "pw123456")


def _make_booking(client, phone="09170000111", name="Ref Guest"):
    """Service + availability + public booking; returns (owner, booking)."""
    owner = _owner_token(client)
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
    slot = datetime.combine(tomorrow, time(10, 0)).isoformat()
    r = client.post(
        "/bookings/public",
        json={"slot_start": slot, "customer_name": name, "customer_phone": phone},
    )
    assert r.status_code == 201, r.text
    return owner, r.json()


def _upload_proof(client, booking_id) -> None:
    r = client.post(
        f"/bookings/{booking_id}/payment-proof-file",
        files={"file": ("receipt.png", _make_png(), "image/png")},
    )
    assert r.status_code == 200, r.text


def test_reference_code_issued_and_unique(client):
    _, first = _make_booking(client, phone="09170000111")
    assert REF_RE.match(first["reference_code"] or ""), first
    # Second booking needs a different slot (same slot is held).
    r = client.post(
        "/bookings/public",
        json={
            "slot_start": (
                datetime.fromisoformat(first["slot_start"]) + timedelta(minutes=30)
            ).isoformat(),
            "customer_name": "Second",
            "customer_phone": "09170000222",
        },
    )
    assert r.status_code == 201, r.text
    assert REF_RE.match(r.json()["reference_code"] or "")
    assert r.json()["reference_code"] != first["reference_code"]


def test_lookup_success_variants(client):
    _, booking = _make_booking(client, phone="0917 000 0111")
    code = booking["reference_code"]
    # Exact.
    r = client.get("/bookings/lookup", params={"code": code, "phone": "09170000111"})
    assert r.status_code == 200, r.text
    assert r.json()["id"] == booking["id"]
    # Lowercase + dash + spaces tolerated.
    pretty = f"{code[:4].lower()}-{code[4:].lower()}"
    r = client.get("/bookings/lookup", params={"code": pretty, "phone": "0917 000 0111"})
    assert r.status_code == 200, r.text
    # +63 phone variant matches 09.. booking.
    r = client.get("/bookings/lookup", params={"code": code, "phone": "+639170000111"})
    assert r.status_code == 200, r.text


def test_lookup_wrong_phone_or_code_404(client):
    _, booking = _make_booking(client, phone="09170000111")
    code = booking["reference_code"]
    assert (
        client.get("/bookings/lookup", params={"code": code, "phone": "09179999999"}).status_code
        == 404
    )
    assert (
        client.get(
            "/bookings/lookup", params={"code": "ZZZZZZZZ", "phone": "09170000111"}
        ).status_code
        == 404
    )


def test_proof_file_owner_and_guest_access(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner, booking = _make_booking(client, phone="09170000111")
    booking_id = booking["id"]
    _upload_proof(client, booking_id)

    # Owner downloads bytes.
    r = client.get(
        f"/bookings/{booking_id}/proof-file",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "image/png"
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"

    # Guest (no login) can fetch while pending inside the window.
    r = client.get(f"/bookings/{booking_id}/proof-file")
    assert r.status_code == 200, r.text

    # Another customer cannot.
    r = client.post(
        "/auth/signup", json={"email": "other@x.local", "password": "password123", "name": "O"}
    )
    assert r.status_code == 201, r.text
    other = _login(client, "other@x.local", "password123")
    r = client.get(
        f"/bookings/{booking_id}/proof-file",
        headers={"Authorization": f"Bearer {other}"},
    )
    assert r.status_code == 403, r.text


def test_proof_file_guest_locked_after_confirm(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner, booking = _make_booking(client, phone="09170000111")
    booking_id = booking["id"]
    _upload_proof(client, booking_id)
    r = client.patch(
        f"/bookings/{booking_id}/confirm-payment",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    # Guest loses byte access after confirm; owner keeps it.
    assert client.get(f"/bookings/{booking_id}/proof-file").status_code in (400, 403)
    r = client.get(
        f"/bookings/{booking_id}/proof-file",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text


def test_legacy_public_proof_url_now_404s(client, tmp_path, monkeypatch):
    """Proof bytes must not be reachable without auth anymore."""
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    _, booking = _make_booking(client, phone="09170000111")
    _upload_proof(client, booking["id"])
    names = [p.name for p in (tmp_path / "proofs").glob("*")]
    assert names, "expected a stored proof file"
    # Direct static access to the private dir is not mounted.
    assert client.get(f"/uploads/proofs/{names[0]}").status_code == 404
    # …and nothing leaks at the old root shape either.
    assert client.get(f"/uploads/{names[0]}").status_code == 404


def test_proof_file_missing_returns_404(client):
    _, booking = _make_booking(client, phone="09170000111")
    r = client.get(
        f"/bookings/{booking['id']}/proof-file",
        headers={"Authorization": f"Bearer {_owner_token(client)}"},
    )
    assert r.status_code == 404, r.text
    assert client.get("/bookings/00000000-0000-0000-0000-000000000000/proof-file").status_code == 404


def test_reupload_replaces_file(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    _, booking = _make_booking(client, phone="09170000111")
    booking_id = booking["id"]
    _upload_proof(client, booking_id)
    first = sorted((tmp_path / "proofs").glob(f"{booking_id}.*"))
    assert len(first) == 1
    _upload_proof(client, booking_id)
    second = sorted((tmp_path / "proofs").glob(f"{booking_id}.*"))
    assert len(second) == 1  # no orphans, deterministic name
    assert second[0].name == first[0].name


def _complete_booking(client, owner, booking_id) -> None:
    r = client.post(
        f"/bookings/{booking_id}/payment-proof-file",
        files={"file": ("receipt.png", _make_png(), "image/png")},
    )
    assert r.status_code == 200, r.text
    r = client.patch(
        f"/bookings/{booking_id}/confirm-payment",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    r = client.patch(
        f"/bookings/{booking_id}/mark-complete",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["completed_at"] is not None


def test_completed_ticket_resolves_within_grace(client, db_session):
    owner, booking = _make_booking(client, phone="09170000111")
    _complete_booking(client, owner, booking["id"])
    r = client.get(
        "/bookings/lookup",
        params={"code": booking["reference_code"], "phone": "09170000111"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "complete"


def test_completed_ticket_expires_after_grace(client, db_session):
    owner, booking = _make_booking(client, phone="09170000111")
    _complete_booking(client, owner, booking["id"])
    row = db_session.query(Booking).filter(Booking.id == booking["id"]).first()
    assert row is not None
    row.completed_at = datetime.utcnow() - timedelta(days=8)
    db_session.commit()
    r = client.get(
        "/bookings/lookup",
        params={"code": booking["reference_code"], "phone": "09170000111"},
    )
    assert r.status_code == 404, r.text


def test_completed_ticket_missing_timestamp_fails_closed(client, db_session):
    owner, booking = _make_booking(client, phone="09170000111")
    _complete_booking(client, owner, booking["id"])
    row = db_session.query(Booking).filter(Booking.id == booking["id"]).first()
    row.completed_at = None
    db_session.commit()
    r = client.get(
        "/bookings/lookup",
        params={"code": booking["reference_code"], "phone": "09170000111"},
    )
    assert r.status_code == 404, r.text


def test_non_complete_statuses_unaffected_by_expiry(client, db_session):
    _, booking = _make_booking(client, phone="09170000111")
    r = client.get(
        "/bookings/lookup",
        params={"code": booking["reference_code"], "phone": "09170000111"},
    )
    assert r.status_code == 200, r.text
