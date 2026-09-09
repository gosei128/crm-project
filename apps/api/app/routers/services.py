from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from app.schemas.service import ServiceRead, ServiceCreate
from app.schemas.availability import AvailabilityRead, AvailabilityCreate

from app.database import get_db
from app.core.dependency import require_owner
from app.models.user import User
from app.models.service import Service
from app.models.availability import Availability

router = APIRouter(prefix="/services", tags=["services"])


def _get_singleton_service(db: Session) -> Service | None:
    """Return the active singleton haircut service."""
    svc = db.query(Service).filter(Service.is_active == True).first()
    if svc is None:
        svc = db.query(Service).first()
    return svc


@router.get('/singleton', response_model=ServiceRead)
def get_singleton_service(db: Session = Depends(get_db)):
    svc = _get_singleton_service(db)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No service configured")
    return svc


@router.patch('/singleton', response_model=ServiceRead)
def update_singleton_service(data: ServiceCreate, current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    svc = _get_singleton_service(db)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No service configured")
    svc.name = data.name
    svc.duration_minutes = data.duration_minutes
    svc.description = data.description
    svc.is_active = True
    db.commit()
    db.refresh(svc)
    return svc


@router.post('/{service_id}/availability', response_model=AvailabilityRead, status_code=status.HTTP_201_CREATED)
def create_availability(data : AvailabilityCreate, service_id: str, current_user: User = Depends(require_owner), db : Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    # Single-shop: any owner can manage any service (no per-owner check)

    start = data.start_time
    end = data.end_time

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
    # Single-haircut invariant: keep only one active service
    existing = _get_singleton_service(db)
    if existing and existing.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Single haircut service already exists. Use PATCH /services/singleton to update.")
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


@router.delete('/{service_id}/availability/{availability_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(service_id: str, availability_id: str, current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    avail = db.query(Availability).filter(Availability.id == availability_id, Availability.service_id == service_id).first()
    if not avail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability not found")
    db.delete(avail)
    db.commit()
    return None


@router.put('/{service_id}/availability/{availability_id}', response_model=AvailabilityRead)
def update_availability(service_id: str, availability_id: str, data: AvailabilityCreate, current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    avail = db.query(Availability).filter(Availability.id == availability_id, Availability.service_id == service_id).first()
    if not avail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability not found")
    start = data.start_time
    end = data.end_time
    if start >= end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_time must be before end_time")
    avail.day_of_week = data.day_of_week
    avail.start_time = start
    avail.end_time = end
    db.commit()
    db.refresh(avail)
    return avail
