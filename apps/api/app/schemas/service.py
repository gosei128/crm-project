from pydantic import BaseModel
import datetime
import uuid

class ServiceBase(BaseModel):
    name : str
    duration_minutes : int
    description : str

class ServiceCreate(ServiceBase):
    pass

class ServiceRead(ServiceBase):
    id : uuid.UUID
    owner_id: uuid.UUID
    is_active : bool

    class Config: 
        from_attributes = True