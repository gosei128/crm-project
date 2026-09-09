import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShopSettings(Base):
    """Singleton row for shop-level configuration."""

    __tablename__ = "shop_settings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    shop_name: Mapped[str] = mapped_column(String, default="Kabarbers")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
