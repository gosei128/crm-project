from datetime import timedelta, time, datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError

from app.models.availability import Availability
from app.models.booking import Booking, BookingStatus, DownpaymentStatus
from app.models.service import Service

# Lunch break window — slots that overlap this are excluded
LUNCH_START = time(12, 30)
LUNCH_END = time(13, 30)

# Only these statuses count as "blocking" a slot
BLOCKING_STATUSES = {BookingStatus.PENDING.value, BookingStatus.BOOKED.value}


def _slots_overlap_lunch(slot_start: datetime, slot_end: datetime) -> bool:
    """Check whether a slot overlaps the lunch break (12:30–13:30)."""
    lunch_start_dt = slot_start.replace(
        hour=LUNCH_START.hour, minute=LUNCH_START.minute, second=0, microsecond=0
    )
    lunch_end_dt = slot_start.replace(
        hour=LUNCH_END.hour, minute=LUNCH_END.minute, second=0, microsecond=0
    )
    return slot_start < lunch_end_dt and slot_end > lunch_start_dt


def get_singleton_service(db: Session) -> Service | None:
    svc = db.query(Service).filter(Service.is_active == True).first()
    if svc is None:
        svc = db.query(Service).first()
    return svc


def resolve_service_id(db: Session, service_id: str | None) -> str | None:
    if service_id:
        return service_id
    svc = get_singleton_service(db)
    return str(svc.id) if svc else None


def get_available_slots(
    service_id: str | None, db: Session, target_date: date
) -> list[datetime]:
    """Return every open slot for a given service on a given date.

    Iterates **all** Availability rules for the service on that day-of-week,
    generates discrete slots, and removes those that are blocked by existing
    bookings (status IN pending/booked) or that overlap the lunch window.
    """
    day_of_week = target_date.weekday()

    # Resolve singleton if no service_id provided
    if service_id is None:
        service_id = resolve_service_id(db, None)
        if service_id is None:
            return []

    # Fetch ALL availability windows for this service on this day
    rules = (
        db.query(Availability)
        .filter(
            Availability.service_id == service_id,
            Availability.day_of_week == day_of_week,
        )
        .all()
    )
    if not rules:
        return []

    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None or not service.is_active:
        return []

    slot_length = timedelta(minutes=service.duration_minutes)

    # --- generate candidate slots from every rule ---
    all_slots: list[datetime] = []
    for rule in rules:
        current = datetime.combine(target_date, rule.start_time)
        end = datetime.combine(target_date, rule.end_time)
        while current + slot_length <= end:
            slot_end = current + slot_length
            # skip slots that overlap the lunch break
            if not _slots_overlap_lunch(current, slot_end):
                all_slots.append(current)
            current += slot_length

    # --- remove slots blocked by existing active bookings ---
    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    existing_bookings = (
        db.query(Booking.slot_start)
        .filter(
            Booking.service_id == service_id,
            Booking.slot_start >= day_start,
            Booking.slot_end <= day_end,
            Booking.status.in_(BLOCKING_STATUSES),
        )
        .all()
    )
    booked_times = {row[0] for row in existing_bookings}

    return [slot for slot in all_slots if slot not in booked_times]


def create_booking(
    db: Session,
    service_id: str | None,
    slot_start: datetime,
    *,
    customer_id: str | None = None,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    pax: int = 1,
    notes: str | None = None,
) -> Booking:
    """Create a new booking in PENDING status.

    Uses the partial unique index on (service_id, slot_start) WHERE
    status IN ('pending','booked') for concurrency safety: if a second
    request tries to claim the same slot, the DB rejects the insert and
    we surface a clean business error.
    """
    if service_id is None:
        service_id = resolve_service_id(db, None)
    if service_id is None:
        raise ValueError("No service configured")
    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None or not service.is_active:
        raise ValueError("Service not found or inactive")

    slot_end = slot_start + timedelta(minutes=service.duration_minutes)

    # Verify the slot is currently available (quick application-level check)
    available_slots = get_available_slots(service_id, db, slot_start.date())
    if slot_start not in available_slots:
        raise ValueError("This slot is no longer available")

    new_booking = Booking(
        service_id=service_id,
        customer_id=customer_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        slot_start=slot_start,
        slot_end=slot_end,
        status=BookingStatus.PENDING.value,
        pax=pax,
        notes=notes,
        downpayment_status=DownpaymentStatus.NONE.value,
    )
    db.add(new_booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError(
            "This slot was just taken by another customer. "
            "Please choose a different time."
        )
    db.refresh(new_booking)
    return new_booking


def confirm_downpayment(db: Session, booking: Booking) -> Booking:
    """Owner marks payment received → PENDING → BOOKED.

    Also expires any other PENDING bookings on the same slot (race rule).
    """
    if booking.status != BookingStatus.PENDING.value:
        raise ValueError(
            f"Cannot confirm payment for a booking in '{booking.status}' status"
        )

    booking.status = BookingStatus.BOOKED.value
    booking.downpayment_status = DownpaymentStatus.CONFIRMED.value

    # Race rule: expire competing pending holds on the same slot
    competing = (
        db.query(Booking)
        .filter(
            Booking.service_id == booking.service_id,
            Booking.slot_start == booking.slot_start,
            Booking.id != booking.id,
            Booking.status == BookingStatus.PENDING.value,
        )
        .all()
    )
    for other in competing:
        other.status = BookingStatus.EXPIRED.value

    db.commit()
    db.refresh(booking)
    return booking


def mark_arrived(db: Session, booking: Booking, arrival_time: datetime | None = None) -> Booking:
    """Owner marks client as arrived.

    If arrival_time is more than 15 minutes past slot_start the booking
    is auto-cancelled as 'cancelled_late'.
    """
    if booking.status != BookingStatus.BOOKED.value:
        raise ValueError(
            f"Cannot mark arrival for a booking in '{booking.status}' status"
        )

    now = arrival_time or datetime.utcnow()
    booking.arrival_time = now

    late_threshold = booking.slot_start + timedelta(minutes=15)
    if now > late_threshold:
        booking.status = BookingStatus.CANCELLED_LATE.value
    # If on time, stay in 'booked' — owner will later mark 'complete'

    db.commit()
    db.refresh(booking)
    return booking


def mark_complete(db: Session, booking: Booking) -> Booking:
    """Owner marks appointment as fulfilled → BOOKED → COMPLETE."""
    if booking.status != BookingStatus.BOOKED.value:
        raise ValueError(
            f"Cannot complete a booking in '{booking.status}' status"
        )
    booking.status = BookingStatus.COMPLETE.value
    db.commit()
    db.refresh(booking)
    return booking
