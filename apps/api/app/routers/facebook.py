"""Login with Facebook (OAuth2 Authorization Code flow).

Browser flow, so failures redirect to the frontend with an `error` code
instead of raising JSON errors (the user is mid-redirect, not calling an
API). Our own JWT is issued on success — the Facebook token never leaves
the server.
"""
import hmac
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import create_access_token
from app.database import get_db
from app.services import facebook_service

router = APIRouter(prefix="/auth/facebook", tags=["auth"])

STATE_COOKIE = "fb_oauth_state"
STATE_MAX_AGE_SECONDS = 300


def _frontend_error(code: str) -> RedirectResponse:
    """Send the user back to login with a machine-readable error code."""
    resp = RedirectResponse(
        url=f"{settings.frontend_url}/?error={code}", status_code=302
    )
    resp.delete_cookie(STATE_COOKIE, path="/")
    return resp


def _frontend_success(token: str, role: str) -> RedirectResponse:
    resp = RedirectResponse(
        url=f"{settings.frontend_url}/auth/facebook/finish?token={token}&role={role}",
        status_code=302,
    )
    resp.delete_cookie(STATE_COOKIE, path="/")
    return resp


@router.get("/login")
def facebook_login():
    """Start OAuth: stash CSRF `state` in a short-lived cookie, redirect."""
    try:
        state = secrets.token_urlsafe(32)
        dialog_url = facebook_service.build_dialog_url(state)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    resp = RedirectResponse(url=dialog_url, status_code=302)
    resp.set_cookie(
        STATE_COOKIE,
        state,
        max_age=STATE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        # Localhost callback is http; flip to True behind https in production.
        secure=False,
        path="/",
    )
    return resp


@router.get("/callback")
async def facebook_callback(
    request: Request,
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Handle Facebook's redirect: verify state, exchange code, issue JWT."""
    stored_state = request.cookies.get(STATE_COOKIE)
    if (
        not state
        or not stored_state
        or not hmac.compare_digest(state, stored_state)
    ):
        return _frontend_error("facebook_state")

    if not code:
        # User denied the permissions dialog (or Facebook omitted the code).
        return _frontend_error("facebook_denied")

    try:
        fb_token = await facebook_service.exchange_code_for_token(code)
        profile = await facebook_service.fetch_facebook_profile(fb_token)
        user = facebook_service.find_or_create_user(
            db, profile["fb_id"], profile["name"], profile["email"]
        )
    except ValueError:
        # Deliberately vague in the URL — details stay server-side.
        return _frontend_error("facebook_failed")

    return _frontend_success(create_access_token(user.id), user.role)
