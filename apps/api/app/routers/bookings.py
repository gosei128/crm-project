from fastapi import HTTPException, status, APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, time
from typing import Optional
import uuid

from app.models.booking import Booking, BookingStatus, BLOCKING_STATUSES
from app.models.service import Service
from app.models.availability import Availability
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingCreatePublic,
    BookingRead,
    BookingStatusPatch,
    BookingPaymentProof,
)
from app.services import booking_service
from app.core.dependency import get_current_user, require_owner
from app.database import get_db
from app.routers.shop import is_shop_open

router = APIRouter(prefix="/bookings", tags=["bookings"])


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
def create_public_booking(data: BookingCreatePublic, db: Session = Depends(get_db)):
    """Create a booking without requiring login (client-facing). Single-haircut defaults."""
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
def create_authenticated_booking(data: BookingCreatePublic, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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

        # Get existing bookings for this day
        day_start = datetime.combine(target_date, time.min)
        day_end = datetime.combine(target_date, time.max)
        existing_bookings = (
            db.query(Booking.slot_start)
            .filter(
                Booking.slot_start >= day_start,
                Booking.slot_end <= day_end,
                Booking.status.in_(BLOCKING_STATUSES),
            )
            .all()
        )
        booked_times = {row[0] for row in existing_bookings}

        # Build slot list with status
        day_slots = []
        for slot_start, slot_end, service_id in all_slots:
            status = "booked" if slot_start in booked_times else "available"
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
    "/{booking_id}/payment-proof",
    response_model=BookingRead,
)
def upload_payment_proof(
    booking_id: str,
    data: BookingPaymentProof,
    db: Session = Depends(get_db),
):
    """Client uploads GCash payment proof URL (no auth required)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )
    if booking.status != BookingStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking is '{booking.status}', not pending — cannot upload proof",
        )

    from app.models.booking import DownpaymentStatus

    booking.payment_proof_url = data.payment_proof_url
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated flow (owner or logged-in customer creates a booking)."""
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
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
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
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Booking not found")
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
