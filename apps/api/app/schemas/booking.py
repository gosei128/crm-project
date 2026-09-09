from pydantic import BaseModel, field_validator
from typing import Optional
import uuid
from datetime import datetime


VALID_STATUSES = {
    "pending",
    "booked",
    "complete",
    "expired",
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
        return v.strip()

    @field_validator("pax")
    @classmethod
    def validate_pax(cls, v: int) -> int:
        if v < 1:
            raise ValueError("pax must be >= 1")
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


class BookingRead(BookingBase):
    id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    status: str
    slot_end: datetime
    created_at: datetime

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
