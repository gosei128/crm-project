from fastapi import HTTPException, status, APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, datetime 

from app.models.booking import Booking
from app.schemas.booking import BookingCreate, BookingRead
from app.services import booking_service
from app.core.dependency import get_current_user
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/bookings", tags=["bookings"])

@router.get('/available_slots', response_model=list[datetime])
def get_available_slot(service_id :str,  target_date : date, db: Session = Depends(get_db) ):
    return booking_service.get_available_slots(service_id, db, target_date)

@router.post('/', response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_bookings(data: BookingCreate, current_user :User = Depends(get_current_user), db: Session = Depends(get_db) ):
    try:
        new_booking = booking_service.create_booking(db, service_id=data.service_id, customer_id=current_user.id, slot_start = data.slot_start)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_booking

@router.get('/me', response_model=list[BookingRead])
def my_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Booking).filter(Booking.customer_id == current_user.id).all()