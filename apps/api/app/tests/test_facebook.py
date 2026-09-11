"""Login with Facebook — router + service tests.

HTTP calls to Facebook are mocked at the service boundary (no respx
dependency); DB work runs against the test database via conftest.
"""
from unittest.mock import AsyncMock, patch

from app.config import settings


def _configure_facebook(monkeypatch):
    monkeypatch.setattr(settings, "facebook_app_id", "2072154290149240")
    monkeypatch.setattr(settings, "facebook_app_secret", "test-secret")
    monkeypatch.setattr(
        settings, "facebook_redirect_uri", "http://localhost:8000/auth/facebook/callback"
    )
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")


def test_facebook_login_redirects_with_state_cookie(client, monkeypatch):
    _configure_facebook(monkeypatch)
    response = client.get("/auth/facebook/login", follow_redirects=False)

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("https://www.facebook.com/v25.0/dialog/oauth")
    assert "client_id=2072154290149240" in location
    assert "scope=email" in location
    assert "state=" in location
    assert "fb_oauth_state" in response.cookies
    assert response.headers.get("set-cookie") is not None


def test_facebook_login_unconfigured(client, monkeypatch):
    monkeypatch.setattr(settings, "facebook_app_id", None)
    monkeypatch.setattr(settings, "facebook_app_secret", None)
    response = client.get("/auth/facebook/login", follow_redirects=False)

    assert response.status_code == 500


def test_facebook_callback_rejects_bad_state(client):
    response = client.get(
        "/auth/facebook/callback?code=abc&state=wrong",
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"].endswith("/?error=facebook_state")


def test_facebook_callback_creates_customer(client, monkeypatch, db_session):
    from app.models.user import User

    _configure_facebook(monkeypatch)
    client.cookies.set("fb_oauth_state", "good-state")

    with (
        patch(
            "app.services.facebook_service.exchange_code_for_token",
            new=AsyncMock(return_value="fb-token"),
        ),
        patch(
            "app.services.facebook_service.fetch_facebook_profile",
            new=AsyncMock(
                return_value={
                    "fb_id": "12345",
                    "name": "Test User",
                    "email": "fbuser@example.com",
                }
            ),
        ),
    ):
        response = client.get(
            "/auth/facebook/callback?code=code123&state=good-state",
            follow_redirects=False,
        )

    assert response.status_code == 302
    location = response.headers["location"]
    assert "/auth/facebook/finish?token=" in location
    assert "role=customer" in location

    user = db_session.query(User).filter(User.facebook_id == "12345").first()
    assert user is not None
    assert user.email == "fbuser@example.com"
    assert user.role == "customer"
    assert user.password_hash is None


def test_facebook_callback_links_existing_email(client, monkeypatch, db_session):
    from app.models.user import User

    _configure_facebook(monkeypatch)
    client.post(
        "/auth/signup",
        json={"email": "ryzasore@gmail.com", "password": "password123", "name": "Ryza"},
    )
    client.cookies.set("fb_oauth_state", "good-state")

    with (
        patch(
            "app.services.facebook_service.exchange_code_for_token",
            new=AsyncMock(return_value="fb-token"),
        ),
        patch(
            "app.services.facebook_service.fetch_facebook_profile",
            new=AsyncMock(
                return_value={
                    "fb_id": "999",
                    "name": "Ryza",
                    "email": "ryzasore@gmail.com",
                }
            ),
        ),
    ):
        response = client.get(
            "/auth/facebook/callback?code=code123&state=good-state",
            follow_redirects=False,
        )

    assert response.status_code == 302
    users = db_session.query(User).filter(User.email == "ryzasore@gmail.com").all()
    assert len(users) == 1
    assert users[0].facebook_id == "999"


def test_facebook_callback_missing_email_uses_placeholder(
    client, monkeypatch, db_session
):
    from app.models.user import User

    _configure_facebook(monkeypatch)
    client.cookies.set("fb_oauth_state", "good-state")

    with (
        patch(
            "app.services.facebook_service.exchange_code_for_token",
            new=AsyncMock(return_value="fb-token"),
        ),
        patch(
            "app.services.facebook_service.fetch_facebook_profile",
            new=AsyncMock(
                return_value={"fb_id": "777", "name": "No Email", "email": None}
            ),
        ),
    ):
        response = client.get(
            "/auth/facebook/callback?code=code123&state=good-state",
            follow_redirects=False,
        )

    assert response.status_code == 302
    user = db_session.query(User).filter(User.facebook_id == "777").first()
    assert user is not None
    assert user.email == "fb_777@facebook.local"


def test_password_login_rejected_for_oauth_user(client, monkeypatch):
    _configure_facebook(monkeypatch)
    client.cookies.set("fb_oauth_state", "good-state")

    with (
        patch(
            "app.services.facebook_service.exchange_code_for_token",
            new=AsyncMock(return_value="fb-token"),
        ),
        patch(
            "app.services.facebook_service.fetch_facebook_profile",
            new=AsyncMock(
                return_value={
                    "fb_id": "555",
                    "name": "Oauth Only",
                    "email": "oauthonly@example.com",
                }
            ),
        ),
    ):
        client.get(
            "/auth/facebook/callback?code=code123&state=good-state",
            follow_redirects=False,
        )

    response = client.post(
        "/auth/login",
        data={"username": "oauthonly@example.com", "password": "whatever"},
    )
    assert response.status_code == 401


def test_build_dialog_url_params(monkeypatch):
    from app.services import facebook_service

    _configure_facebook(monkeypatch)
    url = facebook_service.build_dialog_url("state-123")

    assert "client_id=2072154290149240" in url
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000" in url
    assert "state=state-123" in url
    assert "response_type=code" in url


def test_facebook_urls_share_one_version(monkeypatch):
    from app.services import facebook_service

    _configure_facebook(monkeypatch)
    assert facebook_service.graph_api_version() == "v25.0"

    dialog = facebook_service.build_dialog_url("s")
    assert dialog.startswith("https://www.facebook.com/v25.0/dialog/oauth?")
    assert facebook_service.token_url() == (
        "https://graph.facebook.com/v25.0/oauth/access_token"
    )
    assert facebook_service.profile_url() == "https://graph.facebook.com/v25.0/me"


def test_facebook_version_env_override(monkeypatch):
    from app.services import facebook_service

    _configure_facebook(monkeypatch)
    monkeypatch.setattr(settings, "facebook_graph_version", "v99.0")

    assert facebook_service.graph_api_version() == "v99.0"
    assert "v99.0/dialog/oauth" in facebook_service.build_dialog_url("s")
