import enum

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import uuid
from datetime import datetime


class UserRole(str, enum.Enum):
    """Extensible role enum — add future roles (e.g. STAFF) here."""

    OWNER = "owner"
    CUSTOMER = "customer"


ALLOWED_ROLES = frozenset(r.value for r in UserRole)


class User(Base):
    __tablename__ ="users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('owner', 'customer')",
            name="ck_users_role",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email : Mapped[str] = mapped_column(String, unique=True)
    # Nullable: users created via Facebook OAuth have no password.
    password_hash : Mapped[str | None] = mapped_column(String, nullable=True)
    name : Mapped[str] = mapped_column(String)
    role : Mapped[str] = mapped_column(String)
    # Facebook user ID for OAuth logins. Nullable + unique: at most one
    # local account per Facebook profile; NULLs never collide.
    facebook_id : Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    services : Mapped[list["Service"]] = relationship(back_populates="owner")
    bookings : Mapped[list["Booking"]] = relationship(back_populates="customer")