from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ ="users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email : Mapped[str] = mapped_column(String, unique=True)
    password_hash : Mapped[str] = mapped_column(String)
    name : Mapped[str] = mapped_column(String)
    role : Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    services : Mapped[list["Service"]] = relationship(back_populates="owner")
    bookings : Mapped[list["Booking"]] = relationship(back_populates="customer")