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


class ShopSettingsRead(ShopSettingsBase):
    id: uuid.UUID
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)