"""Background scheduled jobs for the booking system.

Jobs run via APScheduler (in-process) and handle:
- Expiring pending bookings after 15 minutes
- Auto-cancelling no-shows (booked appointments where client never arrived)
- Auto-cancelling late arrivals (booked appointments where client arrived >15 min late)
"""

from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.service import Service
from app.business_rules import PENDING_TTL_MINUTES, LATE_THRESHOLD_MINUTES

# Job intervals
PENDING_EXPIRY_INTERVAL_MINUTES = 1  # check every minute
NO_SHOW_CHECK_INTERVAL_MINUTES = 5
LATE_CHECK_INTERVAL_MINUTES = 5

# Business rule constants live in app.business_rules (single source of truth,
# importable without APScheduler).


scheduler: AsyncIOScheduler | None = None


def _get_db() -> Session:
    """Create a new DB session for a background job."""
    return SessionLocal()


def expire_pending_bookings() -> None:
    """Move PENDING → EXPIRED if created >15 min ago and no downpayment confirmed."""
    db = _get_db()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=PENDING_TTL_MINUTES)
        expired = (
            db.query(Booking)
            .filter(
                Booking.status == BookingStatus.PENDING.value,
                Booking.created_at < cutoff,
                Booking.downpayment_status
                != "confirmed",  # DownpaymentStatus.CONFIRMED.value
            )
            .all()
        )
        count = 0
        for b in expired:
            b.status = BookingStatus.EXPIRED.value
            count += 1
        if count:
            db.commit()
            print(f"[scheduler] Expired {count} pending bookings")
    except Exception as e:
        db.rollback()
        print(f"[scheduler] Error expiring pending bookings: {e}")
    finally:
        db.close()


def cancel_no_shows() -> None:
    """Move BOOKED → CANCELLED_NO_SHOW if past appointment window and not marked arrived."""
    db = _get_db()
    try:
        # Appointment window ends at slot_end. If slot_end has passed and
        # arrival_time is null, it's a no-show.
        now = datetime.utcnow()
        no_shows = (
            db.query(Booking)
            .filter(
                Booking.status == BookingStatus.BOOKED.value,
                Booking.slot_end < now,
                Booking.arrival_time.is_(None),
            )
            .all()
        )
        count = 0
        for b in no_shows:
            b.status = BookingStatus.CANCELLED_NO_SHOW.value
            count += 1
        if count:
            db.commit()
            print(f"[scheduler] Cancelled {count} no-show bookings")
    except Exception as e:
        db.rollback()
        print(f"[scheduler] Error cancelling no-shows: {e}")
    finally:
        db.close()


def cancel_late_arrivals() -> None:
    """Move BOOKED → CANCELLED_LATE if marked arrived >15 min after slot_start.

    This job catches any edge cases where mark_arrived wasn't called with
    an explicit late arrival_time (e.g. owner forgot to mark arrival).
    Late without an arrival_time is handled by cancel_no_shows, so we only
    check bookings that have an arrival_time recorded.
    """
    db = _get_db()
    try:
        now = datetime.utcnow()
        late_threshold = timedelta(minutes=LATE_THRESHOLD_MINUTES)
        late_bookings = (
            db.query(Booking)
            .filter(
                Booking.status == BookingStatus.BOOKED.value,
                Booking.arrival_time.is_not(None),
            )
            .all()
        )
        count = 0
        for b in late_bookings:
            if b.arrival_time and b.arrival_time > b.slot_start + late_threshold:
                # Only cancel if slot_start + 15min already passed
                if b.slot_start + late_threshold < now:
                    if b.status != BookingStatus.CANCELLED_LATE.value:
                        b.status = BookingStatus.CANCELLED_LATE.value
                        count += 1
        if count:
            db.commit()
            print(f"[scheduler] Cancelled {count} late-arrival bookings")
    except Exception as e:
        db.rollback()
        print(f"[scheduler] Error cancelling late arrivals: {e}")
    finally:
        db.close()


def start_scheduler() -> AsyncIOScheduler:
    """Create and start the APScheduler instance with all jobs."""
    global scheduler
    scheduler = AsyncIOScheduler()

    scheduler.add_job(
        expire_pending_bookings,
        trigger=IntervalTrigger(minutes=PENDING_EXPIRY_INTERVAL_MINUTES),
        id="expire_pending_bookings",
        name="Expire pending bookings (15 min TTL)",
        replace_existing=True,
    )

    scheduler.add_job(
        cancel_no_shows,
        trigger=IntervalTrigger(minutes=NO_SHOW_CHECK_INTERVAL_MINUTES),
        id="cancel_no_shows",
        name="Auto-cancel no-show bookings",
        replace_existing=True,
    )

    scheduler.add_job(
        cancel_late_arrivals,
        trigger=IntervalTrigger(minutes=LATE_CHECK_INTERVAL_MINUTES),
        id="cancel_late_arrivals",
        name="Auto-cancel late-arrival bookings",
        replace_existing=True,
    )

    scheduler.start()
    print("[scheduler] Started background jobs")
    return scheduler


def shutdown_scheduler() -> None:
    """Shutdown the scheduler gracefully."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        print("[scheduler] Stopped background jobs")