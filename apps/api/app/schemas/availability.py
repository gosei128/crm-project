from pydantic import BaseModel, Field, field_serializer, field_validator, ConfigDict
import datetime
import uuid


def _parse_time_input(v):
    """Accept both 24h (HH:MM) from <input type=time> and 12h (hh:mm AM/PM) for manual API calls."""
    if isinstance(v, datetime.time):
        return v
    if isinstance(v, str):
        s = v.strip()
        # try common formats (upper-case for AM/PM)
        for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I:%M:%S %p", "%I %p", "%I:%M"):
            try:
                return datetime.datetime.strptime(s.upper().replace(".", ""), fmt).time()
            except ValueError:
                continue
    return v


class AvailabilityBase(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Mon ... 6=Sun")
    start_time: datetime.time
    end_time: datetime.time

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def _validate_time(cls, v):
        parsed = _parse_time_input(v)
        if isinstance(parsed, datetime.time):
            return parsed
        return v

class AvailabilityCreate(AvailabilityBase):
    pass

class AvailabilityRead(AvailabilityBase):
    id: uuid.UUID
    service_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('start_time', 'end_time')
    def serialize_time(self, v: datetime.time) -> str:
        # 12-hour format, no leading zero, e.g. 10:00 AM, 1:30 PM, 5:00 PM
        return v.strftime("%I:%M %p").lstrip("0").replace(" 0", " ")
