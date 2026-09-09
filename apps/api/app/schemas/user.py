from pydantic import BaseModel
from datetime import datetime
import uuid

class UserBase(BaseModel):
    email: str
    name : str
    role : str 

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