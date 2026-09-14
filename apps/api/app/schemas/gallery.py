from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class GalleryImageRead(BaseModel):
    id: uuid.UUID
    image_url: str
    alt: str
    caption: Optional[str] = None
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class GalleryImageUpdate(BaseModel):
    """Owner edits alt text, caption, or manual ordering."""

    alt: Optional[str] = None
    caption: Optional[str] = None
    sort_order: Optional[int] = None
