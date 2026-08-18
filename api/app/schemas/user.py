from pydantic import BaseModel
from datetime import datetime
import uuid

class UserBase(BaseModel):
    email: str
    name : str
    role : str 

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id : uuid.UUID
    created_at : datetime

    class Config:
        from_attributes = True 