from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session
from pathlib import Path
import uuid

from app.config import settings
from app.database import get_db
from app.models.shop_settings import ShopSettings
from app.schemas.shop_settings import (
    ShopSettingsRead,
    ShopSettingsUpdate,
    ShopSocialsUpdate,
)
from app.core.dependency import require_owner

router = APIRouter(prefix="/shop", tags=["shop"])

# Same allow-list as gallery/proof uploads: JPG / PNG / WEBP only.
_ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _hero_dir() -> Path:
    d = Path(settings.upload_dir)
    if not d.is_absolute():
        d = Path.cwd() / d
    d = d / "hero"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _delete_local_hero_file(hero_image_url: str | None) -> None:
    """Remove a previously uploaded hero file (ignores bundled default)."""
    if not hero_image_url or "/uploads/hero/" not in hero_image_url:
        return
    try:
        rel = (
            hero_image_url.rsplit("/uploads/", 1)[1]
            .split("?", 1)[0]
            .split("#", 1)[0]
        )
        if not rel.startswith("hero/") or ".." in rel or "\\" in rel:
            return
        if "/" in rel[len("hero/"):]:
            return
        root = Path(settings.upload_dir)
        if not root.is_absolute():
            root = Path.cwd() / root
        (root / rel).unlink(missing_ok=True)
    except Exception:
        pass


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


@router.post("/hero-image", response_model=ShopSettingsRead)
async def upload_hero_image(
    request: Request,
    file: UploadFile = File(...),
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner uploads the homepage hero photo (JPG/PNG/WEBP, 5 MB max).

    Replaces any previous upload. Reset to the bundled default with
    DELETE /shop/hero-image.
    """
    ext = _ALLOWED_IMAGE_TYPES.get((file.content_type or "").lower())
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, PNG, or WEBP images are allowed.",
        )

    contents = await file.read()
    max_bytes = settings.max_proof_mb * 1024 * 1024
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image must be {settings.max_proof_mb} MB or smaller.",
        )

    hero_dir = _hero_dir()
    filename = f"hero-{uuid.uuid4().hex[:8]}{ext}"
    try:
        (hero_dir / filename).write_bytes(contents)
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the uploaded image. Please try again.",
        )
    finally:
        await file.close()

    setting = _get_or_create_settings(db)
    _delete_local_hero_file(setting.hero_image_url)
    base = str(request.base_url).rstrip("/")
    setting.hero_image_url = f"{base}/uploads/hero/{filename}"
    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/hero-image", response_model=ShopSettingsRead)
def reset_hero_image(
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner resets the hero photo to the bundled default."""
    setting = _get_or_create_settings(db)
    _delete_local_hero_file(setting.hero_image_url)
    setting.hero_image_url = None
    db.commit()
    db.refresh(setting)
    return setting


def _clean_social_url(raw: str | None, field: str) -> str | None:
    """Trim; blank clears to null; non-empty must be an http(s) URL."""
    if raw is None:
        return None
    url = raw.strip()
    if not url:
        return None
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be a full http(s) URL, e.g. https://facebook.com/kabarbers.",
        )
    return url


@router.patch("/socials", response_model=ShopSettingsRead)
def update_shop_socials(
    data: ShopSocialsUpdate,
    current_user=Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner sets/clears the TikTok + Facebook links (blank clears)."""
    setting = _get_or_create_settings(db)
    patch = data.model_dump(exclude_unset=True)
    if "facebook_url" in patch:
        setting.facebook_url = _clean_social_url(patch["facebook_url"], "facebook_url")
    if "tiktok_url" in patch:
        setting.tiktok_url = _clean_social_url(patch["tiktok_url"], "tiktok_url")
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