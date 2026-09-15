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
    hero_image_url: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    facebook_url: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    tiktok_url: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    gcash_number: Mapped[str | None] = mapped_column(String, nullable=True, default="09550996494")
    gcash_account_name: Mapped[str | None] = mapped_column(String, nullable=True, default="MA**N D.")
    gcash_qr_url: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
