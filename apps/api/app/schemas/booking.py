from pydantic import BaseModel, field_validator
from typing import Optional
import uuid
from datetime import datetime


VALID_STATUSES = {
    "pending",
    "booked",
    "complete",
    "expired",
    "cancelled",
    "cancelled_no_show",
    "cancelled_late",
}

VALID_DOWNPAYMENT_STATUSES = {"none", "pending_verification", "confirmed"}


class BookingBase(BaseModel):
    service_id: uuid.UUID
    slot_start: datetime
    # slot_end is computed server-side from service.duration_minutes


class BookingCreatePublic(BaseModel):
    """Client-facing booking request. service_id optional — defaults to singleton haircut."""

    service_id: Optional[uuid.UUID] = None
    slot_start: datetime
    customer_name: str
    customer_phone: str
    pax: int = 1
    notes: Optional[str] = None

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("customer_name is required")
        return v.strip()

    @field_validator("customer_phone")
    @classmethod
    def validate_customer_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("customer_phone is required")
        digits = "".join(c for c in v.strip() if c.isdigit())
        if len(digits) < 10 or len(digits) > 13:
            raise ValueError("customer_phone must be 10-13 digits")
        return v.strip()

    @field_validator("pax")
    @classmethod
    def validate_pax(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("pax must be between 1 and 10")
        return v

    @field_validator("slot_start")
    @classmethod
    def validate_slot_start(cls, v: datetime) -> datetime:
        # Timezone-aware input is normalized to naive UTC for comparison.
        check = v.replace(tzinfo=None) if v.tzinfo is not None else v
        from datetime import datetime as _dt, timedelta as _td

        if check < _dt.utcnow() - _td(minutes=1):
            raise ValueError("Cannot book a past time slot")
        return v


class BookingCreate(BaseModel):
    """Owner/authenticated booking (kept for compatibility). Service_id optional for singleton."""

    service_id: Optional[uuid.UUID] = None
    slot_start: datetime
    slot_end: Optional[datetime] = None
    pax: int = 1
    notes: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None

    @field_validator("pax")
    @classmethod
    def validate_pax(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("pax must be between 1 and 10")
        return v


class BookingRead(BookingBase):
    id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    status: str
    slot_end: datetime
    created_at: datetime
    # Short customer-facing reference for guest status lookup.
    reference_code: Optional[str] = None

    # Client info
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None

    # Booking details
    pax: int
    notes: Optional[str] = None

    # Payment
    downpayment_status: str
    payment_proof_url: Optional[str] = None

    # Arrival
    arrival_time: Optional[datetime] = None

    # When the haircut was marked done (None until then).
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BookingStatusPatch(BaseModel):
    """For owner action endpoints (arrival_time optionally supplied)."""

    arrival_time: Optional[datetime] = None


class BookingPaymentProof(BaseModel):
    """Client uploads GCash proof URL."""

    payment_proof_url: str

    @field_validator("payment_proof_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("payment_proof_url is required")
        return v.strip()


class BookingClaim(BaseModel):
    """Customer claims an anonymous booking by proving the booking phone number."""

    customer_phone: str

    @field_validator("customer_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("customer_phone is required")
        return v.strip()


# ---------- Scheduling UI contracts ----------
# Server-derived slot status for the booking calendar. The frontend
# renders these verbatim — it never derives status from raw bookings.


class DaySlotAvailability(BaseModel):
    time: datetime
    status: str  # available | pending | booked
    expires_at: Optional[datetime] = None


class DayAvailabilityResponse(BaseModel):
    date: str
    is_open: bool
    slots: list[DaySlotAvailability]


class MonthDaySummary(BaseModel):
    date: str
    has_busy: bool
    has_pending: bool
    is_closed: bool


class MonthAvailabilityResponse(BaseModel):
    month: str
    days: list[MonthDaySummary]
