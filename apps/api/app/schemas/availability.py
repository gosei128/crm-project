from pydantic import BaseModel
import uuid

class AvailabilityBase(BaseModel):
    day_of_week : int
    start_time : str
    end_time : str

class AvailabilityCreate(AvailabilityBase):
    pass
class AvailabilityRead(AvailabilityBase):
    id : uuid.UUID
    service_id : uuid.UUID

    class Config:
        from_attributes : True
