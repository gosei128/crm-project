from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, ConfigDict


class ShopSettingsBase(BaseModel):
    is_open: bool = True
    shop_name: str = "Kabarbers"


class ShopSettingsCreate(ShopSettingsBase):
    pass


class ShopSettingsUpdate(BaseModel):
    is_open: bool


class ShopSocialsUpdate(BaseModel):
    """Owner sets/clears social links. Blank strings clear to null."""

    facebook_url: Optional[str] = None
    tiktok_url: Optional[str] = None


class ShopPaymentUpdate(BaseModel):
    """Owner sets the GCash number + account name shown at checkout."""

    gcash_number: Optional[str] = None
    gcash_account_name: Optional[str] = None


class ShopSettingsRead(ShopSettingsBase):
    id: uuid.UUID
    hero_image_url: Optional[str] = None
    facebook_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    gcash_number: Optional[str] = None
    gcash_account_name: Optional[str] = None
    gcash_qr_url: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)