from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.shop_settings import ShopSettings
from app.schemas.shop_settings import ShopSettingsRead, ShopSettingsUpdate
from app.core.dependency import require_owner

router = APIRouter(prefix="/shop", tags=["shop"])


def _get_or_create_settings(db: Session) -> ShopSettings:
    """Get the singleton shop settings row, creating it if it doesn't exist."""
    setting = db.query(ShopSettings).first()
    if not setting:
        setting = ShopSettings(is_open=True, shop_name="Kabarbers")
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("/status", response_model=ShopSettingsRead)
def get_shop_status(db: Session = Depends(get_db)):
    """Public endpoint — returns current shop open/closed status."""
    return _get_or_create_settings(db)


@router.patch("/status", response_model=ShopSettingsRead)
def update_shop_status(
    data: ShopSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_owner),
):
    """Owner-only endpoint — toggle shop open/closed."""
    setting = _get_or_create_settings(db)
    setting.is_open = data.is_open
    from datetime import datetime
    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)
    return setting


def check_shop_is_open(db: Session) -> None:
    """Raise 400 if shop is currently closed. Used by other routers."""
    setting = db.query(ShopSettings).first()
    if setting and not setting.is_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shop is currently closed. Bookings are not being accepted.",
        )


def is_shop_open(db: Session) -> bool:
    """Return True if shop is open (or no settings row exists)."""
    setting = db.query(ShopSettings).first()
    return setting.is_open if setting else True