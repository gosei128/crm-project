
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import uuid
from datetime import datetime as dt

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("service_id", "slot_start", name="no_double_booking"),)

    id : Mapped[uuid.UUID] = mapped_column(primary_key=True,default=uuid.uuid4)
    service_id : Mapped[uuid.UUID] = mapped_column(ForeignKey("services.id"))
    customer_id : Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    slot_start : Mapped[dt]
    slot_end : Mapped[dt]
    status : Mapped[str] = mapped_column(default="confirmed")
    created_at : Mapped[dt] = mapped_column(default=dt.utcnow)

    service : Mapped["Service"] = relationship(back_populates="bookings")
    customer : Mapped["User"] = relationship(back_populates="bookings")