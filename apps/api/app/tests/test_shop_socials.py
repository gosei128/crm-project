"""Owner-managed TikTok + Facebook links on shop settings."""


def _login(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _owner_token(client):
    r = client.post(
        "/auth/bootstrap-owner",
        json={"email": "social-owner@x.local", "password": "pw123456", "name": "Owner"},
    )
    assert r.status_code == 201, r.text
    return _login(client, "social-owner@x.local", "pw123456")


def _customer_token(client, email):
    r = client.post(
        "/auth/signup", json={"email": email, "password": "password123", "name": "C"}
    )
    assert r.status_code == 201, r.text
    return _login(client, email, "password123")


def test_socials_round_trip_and_clear(client):
    owner = _owner_token(client)
    auth = {"Authorization": f"Bearer {owner}"}

    r = client.get("/shop/status")
    assert r.status_code == 200, r.text
    assert r.json()["facebook_url"] is None
    assert r.json()["tiktok_url"] is None

    r = client.patch(
        "/shop/socials",
        json={
            "facebook_url": "https://facebook.com/kabarbers  ",
            "tiktok_url": "https://tiktok.com/@kabarbers",
        },
        headers=auth,
    )
    assert r.status_code == 200, r.text
    assert r.json()["facebook_url"] == "https://facebook.com/kabarbers"
    assert r.json()["tiktok_url"] == "https://tiktok.com/@kabarbers"

    r = client.get("/shop/status")
    assert r.json()["facebook_url"] == "https://facebook.com/kabarbers"

    # blank clears one field, untouched field survives (exclude_unset)
    r = client.patch(
        "/shop/socials", json={"facebook_url": "   "}, headers=auth
    )
    assert r.status_code == 200, r.text
    assert r.json()["facebook_url"] is None
    assert r.json()["tiktok_url"] == "https://tiktok.com/@kabarbers"


def test_socials_validation_and_auth(client):
    owner = _owner_token(client)
    cust = _customer_token(client, "social-cust@x.local")
    auth = {"Authorization": f"Bearer {owner}"}

    r = client.patch(
        "/shop/socials", json={"tiktok_url": "tiktok.com/@x"}, headers=auth
    )
    assert r.status_code == 400, r.text

    r = client.patch("/shop/socials", json={"facebook_url": "https://x.com/y"})
    assert r.status_code in (401, 403), r.text
    r = client.patch(
        "/shop/socials",
        json={"facebook_url": "https://x.com/y"},
        headers={"Authorization": f"Bearer {cust}"},
    )
    assert r.status_code == 403, r.text
