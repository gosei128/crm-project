"""Shared upload-image verification.

Content-Type headers are client-controlled and trivially spoofed, so every
image upload (payment proofs, GCash QR, hero) must pass this check: magic
bytes first, then a real decode via Pillow when available.
"""
from __future__ import annotations

from io import BytesIO

# ext -> (expected PIL formats, magic-byte predicate)
_FORMATS = ("JPEG", "PNG", "WEBP")


def _magic_ok(contents: bytes, ext: str) -> bool:
    if ext == ".jpg":
        return contents[:3] == b"\xff\xd8\xff"
    if ext == ".png":
        return contents[:8] == b"\x89PNG\r\n\x1a\n"
    if ext == ".webp":
        return (
            len(contents) >= 12
            and contents[:4] == b"RIFF"
            and contents[8:12] == b"WEBP"
        )
    return False


def verify_image_contents(contents: bytes, ext: str) -> str | None:
    """Return None if valid, else a human-readable rejection reason."""
    if not contents:
        return "Uploaded file is empty."
    if not _magic_ok(contents, ext):
        return "File contents do not match its image type. Upload a real JPG, PNG, or WEBP photo."
    try:
        from PIL import Image

        with Image.open(BytesIO(contents)) as img:
            img.load()  # full decode — catches truncated/polyglot files
            if img.format not in _FORMATS:
                return "File contents do not match its image type. Upload a real JPG, PNG, or WEBP photo."
            width, height = img.size
            if width <= 0 or height <= 0 or max(width, height) > 12000:
                return "Image dimensions look invalid."
    except ImportError:
        pass  # Pillow not installed — magic-byte check above still applies
    except Exception:
        return "File is not a readable image. Upload a real JPG, PNG, or WEBP photo."
    return None
