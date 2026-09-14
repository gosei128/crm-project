from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import uuid
from datetime import datetime as dt


class GalleryImage(Base):
    """Owner work-showcase photo. Ordered by sort_order, then created_at."""

    __tablename__ = "gallery_images"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    alt: Mapped[str] = mapped_column(String, default="")
    caption: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[dt] = mapped_column(default=dt.utcnow)
