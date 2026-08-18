from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import uuid

class Service(Base):
    __tablename__ = "services"

    id : Mapped[uuid.UUID] =  mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id : Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name : Mapped[str] = mapped_column(String)
    duration_minutes : Mapped[int]
    description : Mapped[str | None] = mapped_column(String, default=None)
    is_active : Mapped[bool] = mapped_column(default=False)

    owner : Mapped["User"] = relationship(back_populates="services")
    availability : Mapped[list["Availability"]] = relationship(back_populates="service")
    bookings : Mapped[list["Booking"]] = relationship(back_populates="service")
