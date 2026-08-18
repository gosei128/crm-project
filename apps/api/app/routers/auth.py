from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.schemas.user import UserRead, UserCreate
from app.database import get_db
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def sign_up(data:UserCreate, db: Session = Depends(get_db)):
    try:
        new_user = auth_service.create_user(db, email = data.email, password = data.password, role = data.role, name = data.name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return new_user

@router.post("/login")
def login(form_data : OAuth2PasswordRequestForm = Depends(), db : Session = Depends(get_db)):
    try:
        token = auth_service.login_user(db, email = form_data.username, password = form_data.password)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(e))
    return {"access_token" :token, "token_type": "bearer"}