"""Owner-uploaded hero image on shop settings."""
from io import BytesIO
from pathlib import Path

from PIL import Image


def _make_png() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (8, 8), (40, 90, 200)).save(buf, format="PNG")
    return buf.getvalue()


PNG = _make_png()


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _owner_token(client):
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": "hero-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code == 201, r.text
    return _login(client, "hero-owner@x.local", "pw123456")


def _customer_token(client, email):
    r = client.post(
        "/auth/signup", json={"email": email, "password": "password123", "name": "C"}
    )
    assert r.status_code == 201, r.text
    return _login(client, email, "password123")


def test_hero_upload_replace_reset_flow(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner = _owner_token(client)
    auth = {"Authorization": f"Bearer {owner}"}

    # public status exposes null hero by default
    r = client.get("/shop/status")
    assert r.status_code == 200, r.text
    assert r.json()["hero_image_url"] is None

    # upload
    r = client.post(
        "/shop/hero-image",
        files={"file": ("hero.png", PNG, "image/png")},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    first_url = r.json()["hero_image_url"]
    assert "/uploads/hero/" in first_url
    first_file = tmp_path / "hero" / Path(first_url).name
    assert first_file.exists()

    # public status now carries it
    r = client.get("/shop/status")
    assert r.json()["hero_image_url"] == first_url

    # replace deletes the old file
    r = client.post(
        "/shop/hero-image",
        files={"file": ("hero2.png", PNG, "image/png")},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    assert r.json()["hero_image_url"] != first_url
    assert not first_file.exists()

    # reset to bundled default
    r = client.delete("/shop/hero-image", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["hero_image_url"] is None
    r = client.get("/shop/status")
    assert r.json()["hero_image_url"] is None


def test_hero_auth_and_validation(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner = _owner_token(client)
    cust = _customer_token(client, "hero-cust@x.local")
    auth = {"Authorization": f"Bearer {owner}"}

    # anonymous + customer blocked on upload and reset
    r = client.post("/shop/hero-image", files={"file": ("h.png", PNG, "image/png")})
    assert r.status_code in (401, 403), r.text
    r = client.delete("/shop/hero-image")
    assert r.status_code in (401, 403), r.text
    cust_auth = {"Authorization": f"Bearer {cust}"}
    r = client.post(
        "/shop/hero-image", files={"file": ("h.png", PNG, "image/png")}, headers=cust_auth
    )
    assert r.status_code == 403, r.text
    r = client.delete("/shop/hero-image", headers=cust_auth)
    assert r.status_code == 403, r.text

    # non-image / oversize / empty rejected
    r = client.post(
        "/shop/hero-image",
        files={"file": ("evil.txt", b"hello", "text/plain")},
        headers=auth,
    )
    assert r.status_code == 400, r.text
    big = b"\xff\xd8" + b"0" * (6 * 1024 * 1024)
    r = client.post(
        "/shop/hero-image",
        files={"file": ("big.jpg", big, "image/jpeg")},
        headers=auth,
    )
    assert r.status_code == 413, r.text
    r = client.post(
        "/shop/hero-image",
        files={"file": ("empty.png", b"", "image/png")},
        headers=auth,
    )
    assert r.status_code == 400, r.text
