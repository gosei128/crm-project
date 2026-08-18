from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password, verify_pw, create_access_token


def create_user(db : Session, email : str, password: str, name : str, role : str) -> User:
    is_existing = db.query(User).filter(User.email == email).first()
    if is_existing is not None:
        raise ValueError("Email already existed")

    new_user = User(email = email, password_hash = hash_password(password), name = name, role = role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def authenticate_user(db:Session, email:str, password:str) -> User:
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise ValueError("User doesnt exist")

    if not verify_pw(password, user.password_hash):
        raise ValueError("Invalid email or password")

    return user

def login_user(db : Session, email: str, password:str) -> str:
    user = authenticate_user(db, email, password)
    return create_access_token(user.id)


