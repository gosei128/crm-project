from fastapi import HTTPException, status, APIRouter, Depends, Query, File, UploadFile, Request
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, time
from typing import Optional
from pathlib import Path
import re
import uuid

from app.config import settings

from app.models.booking import Booking, BookingStatus, BLOCKING_STATUSES
from app.models.service import Service
from app.models.availability import Availability
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingCreatePublic,
    BookingClaim,
    BookingRead,
    BookingStatusPatch,
    BookingPaymentProof,
)
from app.services import booking_service
from app.business_rules import PENDING_TTL_MINUTES
from app.core.dependency import (
    get_current_user,
    get_optional_user,
    require_customer,
    require_owner,
)
from app.database import get_db
from app.routers.shop import is_shop_open

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _normalize_phone(phone: str | None) -> str:
    """Normalize PH phone numbers so +63... and 09... compare equal."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 12 and digits.startswith("63"):
        digits = "0" + digits[2:]
    return digits


def _can_access_booking(booking: Booking, user: User) -> bool:
    """Owners see all; customers see only bookings linked to their account."""
    if user.role == "owner":
        return True
    return booking.customer_id is not None and booking.customer_id == user.id


# ---------- Public / client-facing ----------


@router.get("/available_slots", response_model=list[datetime])
def get_available_slot(
    target_date: date,
    service_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if not is_shop_open(db):
        return []
    # Single-haircut: service_id optional, defaults to singleton
    return booking_service.get_available_slots(service_id, db, target_date)


@router.post(
    "/public", response_model=BookingRead, status_code=status.HTTP_201_CREATED
)
def create_public_booking(
    data: BookingCreatePublic,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Create a booking without requiring login (client-facing). Single-haircut defaults."""
    if current_user is not None and current_user.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owners cannot use the public booking flow. Manage bookings from the dashboard.",
        )
    if not is_shop_open(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shop is currently closed. Bookings are not being accepted.",
        )
    try:
        # If service_id not provided, use singleton haircut
        svc_id = data.service_id or booking_service.resolve_service_id(db, None)
        if not svc_id:
            raise ValueError("No service configured")
        new_booking = booking_service.create_booking(
            db,
            service_id=svc_id,
            slot_start=data.slot_start,
            customer_id=current_user.id
            if current_user is not None and current_user.role == "customer"
            else None,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            pax=data.pax,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_booking


@router.post(
    "/authenticated", response_model=BookingRead, status_code=status.HTTP_201_CREATED
)
def create_authenticated_booking(data: BookingCreatePublic, current_user: User = Depends(require_customer), db: Session = Depends(get_db)):
    """Authenticated customer booking — links booking to account."""
    if not is_shop_open(db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shop is currently closed. Bookings are not being accepted.")
    try:
        svc_id = data.service_id or booking_service.resolve_service_id(db, None)
        if not svc_id:
            raise ValueError("No service configured")
        new_booking = booking_service.create_booking(
            db,
            service_id=svc_id,
            slot_start=data.slot_start,
            customer_id=current_user.id,
            customer_name=data.customer_name or current_user.name,
            customer_phone=data.customer_phone,
            pax=data.pax,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_booking


@router.get("/weekly-schedule")
def get_weekly_schedule(
    start_date: date,
    db: Session = Depends(get_db),
):
    """Return available + booked slots for each day in a 7-day window starting from start_date (Monday)."""
    from app.models.shop_settings import ShopSettings

    shop = db.query(ShopSettings).first()
    is_open = shop.is_open if shop else True

    # Single-haircut: use singleton service only
    service = db.query(Service).filter(Service.is_active == True).first()
    if not service:
        service = db.query(Service).first()
    if not service:
        return {"is_open": is_open, "days": []}

    result_days = []
    for day_offset in range(7):
        target_date = start_date + timedelta(days=day_offset)
        day_of_week = target_date.weekday()

        # Collect slots for singleton service on this day
        all_slots = []
        rules = (
            db.query(Availability)
            .filter(
                Availability.service_id == service.id,
                Availability.day_of_week == day_of_week,
            )
            .all()
        )
        if rules:
            if not service.duration_minutes or service.duration_minutes <= 0:
                slot_length = timedelta(minutes=30)
            else:
                slot_length = timedelta(minutes=service.duration_minutes)
            for rule in rules:
                current = datetime.combine(target_date, rule.start_time)
                end = datetime.combine(target_date, rule.end_time)
                # guard against zero/negative slot length to prevent infinite loop
                if slot_length.total_seconds() <= 0:
                    break
                iterations = 0
                while current + slot_length <= end:
                    if iterations > 1000:  # safety break — should never hit for valid data
                        break
                    iterations += 1
                    slot_end = current + slot_length
                    # Skip lunch break (12:30-13:30)
                    lunch_start = current.replace(hour=12, minute=30, second=0, microsecond=0)
                    lunch_end = current.replace(hour=13, minute=30, second=0, microsecond=0)
                    if not (current < lunch_end and slot_end > lunch_start):
                        all_slots.append((current, slot_end, service.id))
                    current += slot_length

        # Get existing bookings for this day (status matters: pending holds
        # show as "held", owner-confirmed ones as "booked")
        day_start = datetime.combine(target_date, time.min)
        day_end = datetime.combine(target_date, time.max)
        existing_bookings = (
            db.query(Booking.slot_start, Booking.status)
            .filter(
                Booking.slot_start >= day_start,
                Booking.slot_end <= day_end,
                Booking.status.in_(BLOCKING_STATUSES),
            )
            .all()
        )
        statuses_by_slot: dict[datetime, set[str]] = {}
        for slot_start, slot_status in existing_bookings:
            statuses_by_slot.setdefault(slot_start, set()).add(slot_status)

        # Build slot list with status
        day_slots = []
        for slot_start, slot_end, service_id in all_slots:
            states = statuses_by_slot.get(slot_start, set())
            if BookingStatus.BOOKED.value in states:
                status = "booked"
            elif BookingStatus.PENDING.value in states:
                status = "held"
            else:
                status = "available"
            day_slots.append({
                "time": slot_start.isoformat(),
                "status": status,
            })

        # Sort by time
        day_slots.sort(key=lambda x: x["time"])

        result_days.append({
            "date": target_date.isoformat(),
            "day_name": target_date.strftime("%A"),
            "slots": day_slots,
        })

    return {"is_open": is_open, "days": result_days}


@router.post(
    "/{booking_id}/claim",
    response_model=BookingRead,
)
def claim_booking(
    booking_id: str,
    data: BookingClaim,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    """Link an anonymous (no-login) booking to the caller's account via phone match."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )
    if booking.customer_id is not None:
        if booking.customer_id == current_user.id:
            return booking
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This booking already belongs to another account.",
        )
    if _normalize_phone(booking.customer_phone) != _normalize_phone(data.customer_phone):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone number does not match this booking.",
        )
    booking.customer_id = current_user.id
    db.commit()
    db.refresh(booking)
    return booking


@router.post(
    "/{booking_id}/payment-proof",
    response_model=BookingRead,
)
def upload_payment_proof(
    booking_id: str,
    data: BookingPaymentProof,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Upload GCash payment proof URL (guests: unlinked pending bookings only; otherwise owner/owning customer)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )
    _check_proof_access(booking, current_user)

    from app.models.booking import DownpaymentStatus

    booking.payment_proof_url = data.payment_proof_url
    booking.downpayment_status = DownpaymentStatus.PENDING_VERIFICATION.value
    db.commit()
    db.refresh(booking)
    return booking


# ---------- Payment proof image upload (multipart file) ----------

# JPG / PNG / WEBP only (per product decision — no GIF/BMP).
_ALLOWED_PROOF_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _upload_dir() -> Path:
    d = Path(settings.upload_dir)
    if not d.is_absolute():
        d = Path.cwd() / d
    d.mkdir(parents=True, exist_ok=True)
    return d


def _check_proof_access(booking: Booking, current_user: User | None) -> None:
    """Shared auth + status guard for both proof endpoints (URL and file).

    Guests (no login) may upload only to an unlinked booking that is still
    pending inside the payment window — the unguessable booking UUID is the
    credential. Anything linked to an account still needs its owner.
    """
    if current_user is None:
        if booking.customer_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This booking is linked to an account. Log in as its owner to manage it.",
            )
        if booking.status != BookingStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Booking is '{booking.status}', not pending — cannot upload proof",
            )
        if _guest_upload_window_expired(booking):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The {PENDING_TTL_MINUTES}-minute payment window has passed — please book again.",
            )
        return
    if not _can_access_booking(booking, current_user):
        if booking.customer_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This booking is not linked to an account yet. Log in and claim it first.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own bookings.",
        )
    if booking.status != BookingStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking is '{booking.status}', not pending — cannot upload proof",
        )


def _guest_upload_window_expired(booking: Booking) -> bool:
    """True if a guest booking aged past the pending payment window.

    Backstop for the scheduler job that flips stale pendings to EXPIRED —
    enforced here too so a not-yet-swept booking can't accept proof.
    """
    created = booking.created_at
    if created is None:
        return False
    if created.tzinfo is not None:
        created = created.replace(tzinfo=None)
    return datetime.utcnow() - created > timedelta(minutes=PENDING_TTL_MINUTES)


def _delete_local_proof_file(old_url: str | None, upload_dir: Path) -> None:
    """Remove a previously uploaded local file (ignores external URLs)."""
    if not old_url or "/uploads/" not in old_url:
        return
    try:
        filename = old_url.rsplit("/uploads/", 1)[1].split("?", 1)[0].split("#", 1)[0]
        # Guard against path traversal stored in the DB.
        if not filename or "/" in filename or "\\" in filename or ".." in filename:
            return
        (upload_dir / filename).unlink(missing_ok=True)
    except Exception:
        pass


@router.post(
    "/{booking_id}/payment-proof-file",
    response_model=BookingRead,
)
async def upload_payment_proof_file(
    booking_id: str,
    request: Request,
    file: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Upload a GCash proof image file (JPG/PNG/WEBP).

    Guests may upload to their own unlinked booking while it is still pending
    inside the payment window; otherwise the owner or owning customer.

    Stores the file on local disk under ``settings.upload_dir`` and saves
    its absolute URL in ``booking.payment_proof_url`` so existing owner
    views render it directly. Replaces any previous local upload file.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )
    _check_proof_access(booking, current_user)

    ext = _ALLOWED_PROOF_TYPES.get((file.content_type or "").lower())
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, PNG, or WEBP images are allowed.",
        )

    contents = await file.read()
    max_bytes = settings.max_proof_mb * 1024 * 1024
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image must be {settings.max_proof_mb} MB or smaller.",
        )

    upload_dir = _upload_dir()
    filename = f"{booking_id}-{uuid.uuid4().hex[:8]}{ext}"
    try:
        (upload_dir / filename).write_bytes(contents)
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the uploaded image. Please try again.",
        )
    finally:
        await file.close()

    from app.models.booking import DownpaymentStatus

    _delete_local_proof_file(booking.payment_proof_url, upload_dir)
    base = str(request.base_url).rstrip("/")
    booking.payment_proof_url = f"{base}/uploads/{filename}"
    booking.downpayment_status = DownpaymentStatus.PENDING_VERIFICATION.value
    db.commit()
    db.refresh(booking)
    return booking


# ---------- Authenticated customer ----------


@router.post(
    "/", response_model=BookingRead, status_code=status.HTTP_201_CREATED
)
def create_bookings(
    data: BookingCreate,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    """Authenticated customer flow — links the booking to the caller's account."""
    try:
        svc_id = data.service_id or booking_service.resolve_service_id(db, None)
        if not svc_id:
            raise ValueError("No service configured")
        new_booking = booking_service.create_booking(
            db,
            service_id=svc_id,
            slot_start=data.slot_start,
            customer_id=current_user.id,
            customer_name=data.customer_name or current_user.name,
            customer_phone=data.customer_phone,
            pax=data.pax,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_booking


@router.get("/me", response_model=list[BookingRead])
def my_bookings(
    current_user: User = Depends(require_customer), db: Session = Depends(get_db)
):
    return db.query(Booking).filter(Booking.customer_id == current_user.id).all()


# ---------- Owner dashboard / status transitions ----------


@router.get("/all", response_model=list[BookingRead])
def owner_list_bookings(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_filter: Optional[date] = Query(default=None, alias="date"),
    service_id: Optional[str] = Query(default=None),
):
    """Owner: list all bookings, filterable by status / date / service."""
    q = db.query(Booking)
    if status_filter:
        allowed = {
            BookingStatus.PENDING.value,
            BookingStatus.BOOKED.value,
            BookingStatus.COMPLETE.value,
            BookingStatus.EXPIRED.value,
            BookingStatus.CANCELLED.value,
            BookingStatus.CANCELLED_NO_SHOW.value,
            BookingStatus.CANCELLED_LATE.value,
        }
        if status_filter not in allowed:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{status_filter}'. Allowed: {sorted(allowed)}",
            )
        q = q.filter(Booking.status == status_filter)
    if date_filter:
        day_start = datetime.combine(date_filter, datetime.min.time())
        day_end = datetime.combine(date_filter, datetime.max.time())
        q = q.filter(Booking.slot_start >= day_start, Booking.slot_start <= day_end)
    if service_id:
        q = q.filter(Booking.service_id == service_id)
    return q.order_by(Booking.slot_start).all()


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Booking detail — owners see all, customers only their own (claim first if anonymous)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if not _can_access_booking(booking, current_user):
        if booking.customer_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This booking is not linked to an account yet. Log in and claim it first.",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own bookings.",
        )
    return booking


@router.patch("/{booking_id}/confirm-payment", response_model=BookingRead)
def confirm_payment(
    booking_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner confirms downpayment → pending → booked (+ race-rule expiry)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    try:
        return booking_service.confirm_downpayment(db, booking)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{booking_id}/mark-arrived", response_model=BookingRead)
def mark_arrived(
    booking_id: str,
    data: BookingStatusPatch | None = None,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner marks client as arrived (may auto-cancel as late if >15 min past slot)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")

    arrival_time = None
    if data and data.arrival_time:
        arrival_time = data.arrival_time

    try:
        return booking_service.mark_arrived(db, booking, arrival_time)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{booking_id}/mark-complete", response_model=BookingRead)
def mark_complete(
    booking_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner marks appointment fulfilled → booked → complete."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    try:
        return booking_service.mark_complete(db, booking)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{booking_id}/mark-no-show", response_model=BookingRead)
def mark_no_show(
    booking_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner cancels as no-show → booked → cancelled_no_show."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status != BookingStatus.BOOKED.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark no-show for a booking in '{booking.status}' status",
        )
    booking.status = BookingStatus.CANCELLED_NO_SHOW.value
    db.commit()
    db.refresh(booking)
    return booking


@router.patch("/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner cancels a pending hold — e.g. the proof is not a real payment.

    PENDING → CANCELLED. The slot is freed immediately (cancelled is not a
    blocking status). Only pending bookings can be cancelled this way.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status != BookingStatus.PENDING.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a booking in '{booking.status}' status — only pending holds can be cancelled",
        )
    booking.status = BookingStatus.CANCELLED.value
    db.commit()
    db.refresh(booking)
    return booking


# Statuses whose records the owner may hard-delete (trash). Active holds
# and confirmed bookings are never deletable — cancel them first.
TERMINAL_STATUSES = {
    BookingStatus.COMPLETE.value,
    BookingStatus.EXPIRED.value,
    BookingStatus.CANCELLED.value,
    BookingStatus.CANCELLED_NO_SHOW.value,
    BookingStatus.CANCELLED_LATE.value,
}


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner permanently deletes a terminal booking record + its proof file.

    Only complete / expired / cancelled bookings can be trashed. Pending
    holds and confirmed bookings are protected (cancel first).
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status not in TERMINAL_STATUSES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete a booking in '{booking.status}' status — only terminal (complete/expired/cancelled) records can be deleted",
        )
    _delete_local_proof_file(booking.payment_proof_url, _upload_dir())
    db.delete(booking)
    db.commit()
    return None
