from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.core.security import hash_password, verify_pw, create_access_token


def create_user(db : Session, email : str, password: str, name : str, role : str = UserRole.CUSTOMER.value) -> User:
    # Enforce single-shop: public signup always creates customer. Caller must not pass owner.
    # The only way to create an owner is via create_owner().
    role = UserRole.CUSTOMER.value
    is_existing = db.query(User).filter(User.email == email).first()
    if is_existing is not None:
        raise ValueError("Email already existed")

    new_user = User(email = email, password_hash = hash_password(password), name = name, role = role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def create_owner(db: Session, email: str, password: str, name: str) -> User:
    """Create an owner user (only callable via guarded endpoint / seed)."""
    is_existing = db.query(User).filter(User.email == email).first()
    if is_existing is not None:
        raise ValueError("Email already existed")
    new_user = User(email=email, password_hash=hash_password(password), name=name, role=UserRole.OWNER.value)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def authenticate_user(db:Session, email:str, password:str) -> User:
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise ValueError("User doesnt exist")

    # OAuth-created users have no password — same message as a wrong one.
    if not user.password_hash or not verify_pw(password, user.password_hash):
        raise ValueError("Invalid email or password")

    return user

def login_user(db : Session, email: str, password:str) -> tuple:
    user = authenticate_user(db, email, password)
    token = create_access_token(user.id)
    return token, user


