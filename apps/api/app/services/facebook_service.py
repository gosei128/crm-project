"""Login with Facebook (OAuth2 Authorization Code) — server-side helpers.

Pure functions + DB access only (no FastAPI imports), matching the existing
services/ convention. The router owns cookies, redirects and HTTP errors.
Secrets are read from settings at call time and never logged.
"""
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, UserRole

FACEBOOK_GRAPH_VERSION_DEFAULT = "v25.0"
FACEBOOK_SCOPES = "email,public_profile"
HTTP_TIMEOUT_SECONDS = 10.0


def graph_api_version() -> str:
    """Single source for the Meta Graph API version (env-overridable).

    v18.0‐style pins rot silently when Meta sunsets a version — every
    Facebook URL below derives from this one value.
    """
    return settings.facebook_graph_version or FACEBOOK_GRAPH_VERSION_DEFAULT


def dialog_url_base() -> str:
    return f"https://www.facebook.com/{graph_api_version()}/dialog/oauth"


def token_url() -> str:
    return f"https://graph.facebook.com/{graph_api_version()}/oauth/access_token"


def profile_url() -> str:
    return f"https://graph.facebook.com/{graph_api_version()}/me"


def require_facebook_config() -> tuple[str, str, str]:
    """Return (app_id, app_secret, redirect_uri) or raise for a 500."""
    if not settings.facebook_app_id or not settings.facebook_app_secret:
        raise ValueError(
            "Facebook login is not configured. "
            "Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET."
        )
    return (
        settings.facebook_app_id,
        settings.facebook_app_secret,
        settings.facebook_redirect_uri,
    )


def build_dialog_url(state: str) -> str:
    """Authorization URL for the user's browser (GET /auth/facebook/login)."""
    app_id, _, redirect_uri = require_facebook_config()
    return (
        f"{dialog_url_base()}?"
        + urlencode(
            {
                "client_id": app_id,
                "redirect_uri": redirect_uri,
                "scope": FACEBOOK_SCOPES,
                "response_type": "code",
                "state": state,
            }
        )
    )


async def exchange_code_for_token(code: str) -> str:
    """Trade the callback `code` for a short-lived user access token."""
    app_id, app_secret, redirect_uri = require_facebook_config()
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.get(
                token_url(),
                params={
                    "client_id": app_id,
                    "redirect_uri": redirect_uri,
                    "client_secret": app_secret,
                    "code": code,
                },
            )
        except httpx.HTTPError as e:
            raise ValueError(f"Facebook token exchange failed: {e}") from e
    data = resp.json()
    if resp.status_code != 200 or "access_token" not in data:
        detail = data.get("error", {}).get("message", "unknown error")
        raise ValueError(f"Facebook token exchange failed: {detail}")
    return data["access_token"]


async def fetch_facebook_profile(access_token: str) -> dict:
    """Return {fb_id, name, email | None} for a user access token."""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.get(
                profile_url(),
                params={"fields": "id,name,email", "access_token": access_token},
            )
        except httpx.HTTPError as e:
            raise ValueError(f"Facebook profile fetch failed: {e}") from e
    if resp.status_code != 200:
        raise ValueError("Facebook profile fetch failed")
    data = resp.json()
    if "id" not in data:
        raise ValueError("Facebook profile fetch failed: missing user id")
    return {
        "fb_id": data["id"],
        "name": data.get("name") or "Facebook user",
        "email": data.get("email"),
    }


def placeholder_email(fb_id: str) -> str:
    """Stable stand-in when Facebook withholds the email address."""
    return f"fb_{fb_id}@facebook.local"


def find_or_create_user(db: Session, fb_id: str, name: str, email: str | None) -> User:
    """Find by Facebook ID, link a matching email, else create a customer."""
    user = db.query(User).filter(User.facebook_id == fb_id).first()
    if user is not None:
        return user

    if email:
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            # Same person, new login method — link instead of duplicating.
            user.facebook_id = fb_id
            db.commit()
            db.refresh(user)
            return user

    new_user = User(
        email=email or placeholder_email(fb_id),
        password_hash=None,
        name=name,
        role=UserRole.CUSTOMER.value,
        facebook_id=fb_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
