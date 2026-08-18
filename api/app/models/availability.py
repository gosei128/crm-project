from sqlalchemy import Time, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import uuid
import datetime

class Availability(Base):
    __tablename__ = "availability"

    id : Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id : Mapped[uuid.UUID] = mapped_column(ForeignKey("services.id"))
    day_of_week: Mapped[int]
    start_time : Mapped[datetime.time] = mapped_column(Time)
    end_time : Mapped[datetime.time] = mapped_column(Time)

    service : Mapped["Service"] = relationship(back_populates="availability")
    