from bcrypt import hashpw, gensalt, checkpw
from jose import jwt, JWTError
from datetime import datetime, timedelta
import logging
import uuid

logger = logging.getLogger(__name__)

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()
from app.database import get_db
from sqlalchemy.orm import Session 
from app.models.user import User

from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
oauth2scheme = OAuth2PasswordBearer(tokenUrl="users/login")

SECRET = settings.jwt_secret
ALGORITHM = "HS256"


def _token_lifetime() -> timedelta:
    # Env-configurable via JWT_EXPIRE_MINUTES (was hardcoded to 30).
    try:
        minutes = int(settings.jwt_expire_minutes)
    except (TypeError, ValueError):
        minutes = 30
    return timedelta(minutes=max(5, minutes))


def hash_password(plain_password : str) -> str:
    return hashpw(plain_password.encode(), gensalt()).decode()

def verify_pw(plain_password : str, hashed_password:str ) -> bool:
    return checkpw(plain_password.encode(), hashed_password.encode())

def create_access_token(user_id:uuid.UUID) -> str:
    payload = {"sub" : str(user_id), "exp" : datetime.utcnow() + _token_lifetime()}
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)

def decode_access_token(token : str) -> uuid.UUID:

    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise JWTError("Token is missing")
        return uuid.UUID(user_id_str)
    except JWTError as e:
        # Never log token contents — debug-level failure reason only.
        logger.debug("JWT decode failed: %s", type(e).__name__)
        raise ValueError("Invalid or expired token")
