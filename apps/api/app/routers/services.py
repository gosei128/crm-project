from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from datetime import datetime as dt
from app.schemas.service import ServiceRead, ServiceCreate
from app.schemas.availability import AvailabilityRead, AvailabilityCreate

from app.database import get_db
from app.core.dependency import require_owner
from app.models.user import User
from app.models.service import Service
from app.models.availability import Availability

router = APIRouter(prefix="/services", tags=["services"])


@router.post('/{service_id}/availability', response_model=AvailabilityRead, status_code=status.HTTP_201_CREATED)
def create_availability(data : AvailabilityCreate, service_id: str, current_user: User = Depends(require_owner), db : Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    if service.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your service")

    
    # 2. convert "09:00" string -> a real time object
    try:
        start = dt.strptime(data.start_time, "%H:%M").time()
        end = dt.strptime(data.end_time, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time must be in HH:MM format")

    if start >= end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_time must be before end_time")

    # 3. create and save
    new_availability = Availability(
        service_id=service.id,
        day_of_week=data.day_of_week,
        start_time=start,
        end_time=end
    )
    db.add(new_availability)
    db.commit()
    db.refresh(new_availability)
    return new_availability


@router.get("/{service_id}/availability", response_model=list[AvailabilityRead])
def list_availability(service_id: str, db: Session = Depends(get_db)):
    return db.query(Availability).filter(Availability.service_id == service_id).all()


@router.get('/', response_model=list[ServiceRead])
def list_services(db: Session = Depends(get_db)):
    return db.query(Service).filter(Service.is_active == True).all()

@router.post('/', response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    data: ServiceCreate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    new_service = Service(
        name=data.name,
        duration_minutes=data.duration_minutes,
        description=data.description,
        owner_id=current_user.id,
        is_active=True
    )
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service