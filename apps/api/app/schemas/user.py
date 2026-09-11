from pydantic import BaseModel, field_validator
from datetime import datetime
import uuid

from app.models.user import ALLOWED_ROLES

class UserBase(BaseModel):
    email: str
    name : str
    role : str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ALLOWED_ROLES:
            raise ValueError(f"Invalid role '{v}'. Allowed: {sorted(ALLOWED_ROLES)}")
        return v 

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    # role is ignored for public signup (always customer); kept optional for backwards compat
    role: str | None = None

class UserRead(UserBase):
    id : uuid.UUID
    created_at : datetime

    class Config:
        from_attributes = True 