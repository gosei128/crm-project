from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.schemas.service import ServiceRead, ServiceCreate
from app.database import get_db
from app.core.dependency import require_owner
from app.models.user import User
from app.models.service import Service

router = APIRouter(prefix="/services", tags=["services"])

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
        owner_id=current_user.id
    )
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service