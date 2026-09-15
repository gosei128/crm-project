"""Owner-managed work showcase: upload, list, edit, delete."""
from io import BytesIO
from pathlib import Path

from PIL import Image


def _make_png() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (8, 8), (200, 40, 40)).save(buf, format="PNG")
    return buf.getvalue()


PNG = _make_png()


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _owner_token(client):
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": "gallery-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code == 201, r.text
    return _login(client, "gallery-owner@x.local", "pw123456")


def _customer_token(client, email):
    r = client.post(
        "/auth/signup", json={"email": email, "password": "password123", "name": "C"}
    )
    assert r.status_code == 201, r.text
    return _login(client, email, "password123")


def _upload(client, token, filename="cut.png", content=PNG, ctype="image/png",
            alt="Fresh fade", caption="Walk-in special"):
    return client.post(
        "/gallery",
        files={"file": (filename, content, ctype)},
        data={"alt": alt, "caption": caption},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_gallery_crud_flow(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner = _owner_token(client)

    # public list starts empty (fresh test DB, no seed rows)
    r = client.get("/gallery")
    assert r.status_code == 200, r.text
    assert r.json() == []

    # upload two photos
    r = _upload(client, owner, alt="Cut one", caption="First")
    assert r.status_code == 201, r.text
    first = r.json()
    assert first["image_url"].endswith(".png")
    assert "/uploads/gallery/" in first["image_url"]
    assert first["alt"] == "Cut one"
    assert first["caption"] == "First"
    assert first["sort_order"] == 0

    r = _upload(client, owner, filename="cut2.png", alt="Cut two", caption="")
    assert r.status_code == 201, r.text
    second = r.json()
    assert second["sort_order"] == 1
    assert second["caption"] is None

    # files on disk
    assert (tmp_path / "gallery").is_dir()
    assert len(list((tmp_path / "gallery").iterdir())) == 2

    # public ordering
    r = client.get("/gallery")
    ids = [p["id"] for p in r.json()]
    assert ids == [first["id"], second["id"]]

    # edit alt/caption/order (swap)
    r = client.patch(
        f"/gallery/{second['id']}",
        json={"caption": "Updated", "sort_order": -1},
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["caption"] == "Updated"
    r = client.get("/gallery")
    assert [p["id"] for p in r.json()] == [second["id"], first["id"]]

    # patch missing
    r = client.patch(
        "/gallery/00000000-0000-0000-0000-000000000000",
        json={"alt": "x"},
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 404, r.text

    # delete removes row + file
    doomed_url = first["image_url"]
    doomed_file = tmp_path / "gallery" / Path(doomed_url).name
    assert doomed_file.exists()
    r = client.delete(
        f"/gallery/{first['id']}", headers={"Authorization": f"Bearer {owner}"}
    )
    assert r.status_code == 204, r.text
    assert not doomed_file.exists()
    r = client.get("/gallery")
    assert [p["id"] for p in r.json()] == [second["id"]]

    # delete missing
    r = client.delete(
        "/gallery/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 404, r.text


def test_gallery_auth_and_validation(client, tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    owner = _owner_token(client)
    cust = _customer_token(client, "gallery-cust@x.local")

    # anonymous + customer cannot upload
    r = client.post("/gallery", files={"file": ("c.png", PNG, "image/png")})
    assert r.status_code in (401, 403), r.text
    r = client.post(
        "/gallery",
        files={"file": ("c.png", PNG, "image/png")},
        headers={"Authorization": f"Bearer {cust}"},
    )
    assert r.status_code == 403, r.text

    # non-image rejected
    r = client.post(
        "/gallery",
        files={"file": ("evil.txt", b"hello", "text/plain")},
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 400, r.text

    # oversize rejected
    big = b"\xff\xd8" + b"0" * (6 * 1024 * 1024)
    r = client.post(
        "/gallery",
        files={"file": ("big.jpg", big, "image/jpeg")},
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 413, r.text

    # empty rejected
    r = client.post(
        "/gallery",
        files={"file": ("empty.png", b"", "image/png")},
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 400, r.text

    # customer cannot edit/delete
    r = _upload(client, owner)
    pid = r.json()["id"]
    r = client.patch(
        f"/gallery/{pid}",
        json={"alt": "x"},
        headers={"Authorization": f"Bearer {cust}"},
    )
    assert r.status_code == 403, r.text
    r = client.delete(
        f"/gallery/{pid}", headers={"Authorization": f"Bearer {cust}"}
    )
    assert r.status_code == 403, r.text
