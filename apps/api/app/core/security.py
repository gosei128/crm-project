from bcrypt import hashpw, gensalt, checkpw
from jose import jwt, JWTError
from datetime import datetime, timedelta
import uuid

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
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def hash_password(plain_password : str) -> str:
    return hashpw(plain_password.encode(), gensalt()).decode()

def verify_pw(plain_password : str, hashed_password:str ) -> bool:
    return checkpw(plain_password.encode(), hashed_password.encode())

def create_access_token(user_id:uuid.UUID) -> str:
    payload = {"sub" : str(user_id), "exp" : datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)

def decode_access_token(token : str) -> uuid.UUID:
    
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        print("DECODED PAYLOAD:", payload)  
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise JWTError("Token is missing")
        return uuid.UUID(user_id_str)
    except JWTError as e:
        print("JWT DECODE FAILED:", e) 
        raise ValueError("Invalid or expired token")
