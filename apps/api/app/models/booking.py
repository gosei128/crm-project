import enum

from sqlalchemy import ForeignKey, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import uuid
from datetime import datetime as dt


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    BOOKED = "booked"
    COMPLETE = "complete"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    CANCELLED_NO_SHOW = "cancelled_no_show"
    CANCELLED_LATE = "cancelled_late"


class DownpaymentStatus(str, enum.Enum):
    NONE = "none"
    PENDING_VERIFICATION = "pending_verification"
    CONFIRMED = "confirmed"


# Statuses that occupy a time slot (block it from being re-booked).
BLOCKING_STATUSES = {BookingStatus.PENDING.value, BookingStatus.BOOKED.value}


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index(
            "ix_active_booking_per_slot",
            "service_id",
            "slot_start",
            unique=True,
            postgresql_where="status IN ('pending', 'booked')",
        ),
        Index("ix_bookings_slot_start", "slot_start"),
        Index("ix_bookings_status", "status"),
        Index("ix_bookings_customer", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("services.id"))
    # Short customer-facing reference (e.g. "KX7Q2M9A") for guest lookup.
    # Nullable only so the backfill migration can add the column; every
    # booking created through the service layer always gets one.
    reference_code: Mapped[str | None] = mapped_column(String(8), unique=True, nullable=True)
    # nullable — client booking flow doesn't require login
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    slot_start: Mapped[dt]
    slot_end: Mapped[dt]
    status: Mapped[str] = mapped_column(default=BookingStatus.PENDING.value)

    # Client info (for no-login bookings)
    customer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String, nullable=True)

    # Booking details
    pax: Mapped[int] = mapped_column(default=1)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    # Payment tracking
    downpayment_status: Mapped[str] = mapped_column(
        default=DownpaymentStatus.NONE.value
    )
    payment_proof_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Arrival tracking (for late/no-show detection)
    arrival_time: Mapped[dt | None] = mapped_column(nullable=True)

    # When the owner marked the haircut done (BOOKED → COMPLETE). Drives
    # guest-lookup expiry: tickets stop resolving N days after this.
    completed_at: Mapped[dt | None] = mapped_column(nullable=True)

    created_at: Mapped[dt] = mapped_column(default=dt.utcnow)

    service: Mapped["Service"] = relationship(back_populates="bookings")
    customer: Mapped["User"] = relationship(back_populates="bookings")