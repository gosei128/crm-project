from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.core.rate_limit import limiter
from app.schemas.user import UserRead, UserCreate
from app.database import get_db
from app.services import auth_service
from app.core.dependency import get_current_user, require_owner

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.signup_rate_limit)
def sign_up(request: Request, data:UserCreate, db: Session = Depends(get_db)):
    # Single-shop: public signup always creates a customer
    try:
        new_user = auth_service.create_user(db, email=data.email, password=data.password, name=data.name, role="customer")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_user


@router.post("/create-owner", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_owner_endpoint(data: UserCreate, db: Session = Depends(get_db), current_user=Depends(require_owner)):
    """Owner-only: create another owner (for bootstrapping, seed covers initial owner)."""
    try:
        new_user = auth_service.create_owner(db, email=data.email, password=data.password, name=data.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_user


@router.post("/bootstrap-owner", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def bootstrap_owner(data: UserCreate, db: Session = Depends(get_db)):
    """Allow first owner creation without auth when no owner exists yet (seed fallback)."""
    from app.models.user import User

    if db.query(User).filter(User.role == "owner").count() > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner already exists. Use /auth/create-owner with owner token.")
    try:
        new_user = auth_service.create_owner(db, email=data.email, password=data.password, name=data.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_user

@router.post("/login")
@limiter.limit(settings.login_rate_limit)
def login(request: Request, form_data : OAuth2PasswordRequestForm = Depends(), db : Session = Depends(get_db)):
    try:
        token, user = auth_service.login_user(db, email = form_data.username, password = form_data.password)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(e))
    return {"access_token" :token, "token_type": "bearer", "user": UserRead.model_validate(user)}

@router.get("/me", response_model=UserRead)
def get_current_user_info(current_user = Depends(get_current_user)):
    """Return the currently authenticated user's info."""
    return current_user