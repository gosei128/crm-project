from datetime import timedelta, time, datetime, date
from sqlalchemy.orm import Session

from app.models.availability import Availability
from app.models.booking import Booking
from app.models.service import Service

def get_available_slots(service_id, db: Session, target_date: date) -> list[datetime]:
    day_of_week = target_date.weekday()

    rule = db.query(Availability).filter(Availability.service == service_id, Availability.day_of_week == day_of_week).first()

    if rule is None:
        return []

    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None or not service.is_active:
        return []

    slot_length = timedelta(minutes=service.duration_minutes)

    all_slots = []
    current = datetime.combine(target_date, rule.start_time)
    end = datetime.combine(target_date, rule.end_time)

    while current + slot_length <= end:
        all_slots.append(current)
        current += slot_length

    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    existing_bookings = db.query(Booking).filter(
        Booking.service_id == service_id,
        Booking.slot_start >= day_start,
        Booking.slot_end <= day_end,
        Booking.status == "confirmed"
    ).all()

    booked_times = {b.slot_start for b in existing_bookings}

    return [slot for slot in all_slots if slot not in booked_times]

def create_booking(db : Session, service_id, customer_id, slot_start : datetime)->Booking:
    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None or not service.is_active:
        raise ValueError("Service not found or Inactive")

    slot_end = slot_start + timedelta(minutes=service.duration_minutes)

    available_slots = get_available_slots(service_id, db, slot_start.date())
    if slot_start not in available_slots:
        raise ValueError("This slot is no longer available")

    new_booking = Booking(
        service_id = service_id,
        customer_id = customer_id,
        slot_start = slot_start,
        slot_end = slot_end,
        status = "confirmed"
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return new_booking




