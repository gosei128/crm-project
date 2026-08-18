from pydantic import BaseModel
import uuid
from datetime import datetime 

class BookingBase(BaseModel):
    service_id : uuid.UUID
    slot_start : datetime
    slot_end : datetime

class BookingCreate(BookingBase):
    pass

class BookingRead(BookingBase):
    id : uuid.UUID
    customer_id : uuid.UUID
    status : str
    created_at : datetime

    class Config:
        from_attributes = True