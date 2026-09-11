from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import ALLOWED_ROLES, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def _load_user_from_token(token: str | None, db: Session) -> User | None:
    """Return the user for a bearer token, or None if absent/invalid."""
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
    except ValueError:
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Best-effort auth — returns None instead of raising (for mixed routes)."""
    return _load_user_from_token(token, db)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    user = _load_user_from_token(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


def require_role(*allowed_roles: str):
    """Generic role gate — extensible for future roles (e.g. staff).

    Usage: `current_user: User = Depends(require_role("owner"))`.
    """
    allowed = set(allowed_roles)
    unknown = allowed - set(ALLOWED_ROLES)
    if unknown:
        raise ValueError(f"Unknown role(s) in require_role: {sorted(unknown)}")

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action.",
            )
        return current_user

    return _checker


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can perform this action.",
        )
    return current_user


def require_customer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can perform this action.",
        )
    return current_user
