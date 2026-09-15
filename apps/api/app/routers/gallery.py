from fastapi import (
    HTTPException,
    status,
    APIRouter,
    Depends,
    File,
    Form,
    Request,
    UploadFile,
)
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
import uuid

from app.config import settings
from app.database import get_db
from app.core.dependency import require_owner
from app.models.gallery_image import GalleryImage
from app.models.user import User
from app.schemas.gallery import GalleryImageRead, GalleryImageUpdate

router = APIRouter(prefix="/gallery", tags=["gallery"])

# Same allow-list as payment proofs: JPG / PNG / WEBP only.
_ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _upload_root() -> Path:
    d = Path(settings.upload_dir)
    if not d.is_absolute():
        d = Path.cwd() / d
    return d


def _gallery_dir() -> Path:
    d = _upload_root() / "gallery"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _delete_local_gallery_file(image_url: str | None) -> None:
    """Remove a previously uploaded gallery file (ignores external URLs)."""
    if not image_url or "/uploads/gallery/" not in image_url:
        return
    try:
        rel = (
            image_url.rsplit("/uploads/", 1)[1]
            .split("?", 1)[0]
            .split("#", 1)[0]
        )
        # Must stay inside gallery/ — guard against path traversal in the DB.
        if not rel.startswith("gallery/") or ".." in rel or "\\" in rel:
            return
        if "/" in rel[len("gallery/"):]:
            return
        (_upload_root() / rel).unlink(missing_ok=True)
    except Exception:
        pass


@router.get("", response_model=list[GalleryImageRead])
def list_gallery(db: Session = Depends(get_db)):
    """Public work showcase, display order."""
    return (
        db.query(GalleryImage)
        .order_by(GalleryImage.sort_order, GalleryImage.created_at)
        .all()
    )


@router.post("", response_model=GalleryImageRead, status_code=status.HTTP_201_CREATED)
async def upload_gallery_image(
    request: Request,
    file: UploadFile = File(...),
    alt: str = Form(default=""),
    caption: str | None = Form(default=None),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner adds a showcase photo (JPG/PNG/WEBP, 5 MB max). Appended last."""
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

    from app.core.upload_security import verify_image_contents

    problem = verify_image_contents(contents, ext)
    if problem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=problem,
        )

    gallery_dir = _gallery_dir()
    filename = f"gallery-{uuid.uuid4().hex}{ext}"
    try:
        (gallery_dir / filename).write_bytes(contents)
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the uploaded image. Please try again.",
        )
    finally:
        await file.close()

    max_order = db.query(func.max(GalleryImage.sort_order)).scalar()
    base = str(request.base_url).rstrip("/")
    photo = GalleryImage(
        image_url=f"{base}/uploads/gallery/{filename}",
        alt=alt.strip(),
        caption=caption.strip() if caption and caption.strip() else None,
        sort_order=(max_order + 1) if max_order is not None else 0,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.patch("/{photo_id}", response_model=GalleryImageRead)
def update_gallery_image(
    photo_id: str,
    data: GalleryImageUpdate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner edits alt text, caption, or manual ordering."""
    photo = db.query(GalleryImage).filter(GalleryImage.id == photo_id).first()
    if photo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Photo not found")
    patch = data.model_dump(exclude_unset=True)
    if "alt" in patch and patch["alt"] is not None:
        patch["alt"] = patch["alt"].strip()
    if "caption" in patch:
        patch["caption"] = (
            patch["caption"].strip()
            if patch["caption"] and patch["caption"].strip()
            else None
        )
    for key, value in patch.items():
        setattr(photo, key, value)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gallery_image(
    photo_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Owner removes a showcase photo (local file deleted too)."""
    photo = db.query(GalleryImage).filter(GalleryImage.id == photo_id).first()
    if photo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Photo not found")
    _delete_local_gallery_file(photo.image_url)
    db.delete(photo)
    db.commit()
    return None
