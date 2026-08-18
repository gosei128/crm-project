def test_signup_create_user(client):
    response = client.post('/auth/signup', json={
        "email": "ryzasore@gmail.com",
        "password" : "password123",
        "name" : "Ryza",
        "role" : "customer",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "ryzasore@gmail.com"
    assert "password_hash" not in data

def test_login_user(client):
    client.post("/auth/signup", json={
        "email": "ryzasore@gmail.com",
        "password" : "password123",
        "name" : "Ryza",
        "role" : "customer",
    })

    response = client.post("/auth/login", data={
        "username": "ryzasore@gmail.com",
        "password" : "password123"
    })

    assert response.status_code == 200
    assert "access_token" in response.json()

def test_duplicate_email(client):
    client.post("/auth/signup", json={
        "email": "ryzasore@gmail.com",
        "password" : "password123",
        "name" : "Ryza",
        "role" : "customer",
    })

    response =  client.post("/auth/signup", json={
        "email": "ryzasore@gmail.com",
        "password" : "password123",
        "name" : "chay",
        "role" : "owner"
    })

    assert response.status_code == 400

def test_wrong_password(client):
    client.post("/auth/signup", json={
        "email": "ryzasore@gmail.com",
        "password" : "password123",
        "name" : "Ryza",
        "role" : "customer"
    })

    response = client.post("/auth/login", data={
        "username": "ryzasore@gmail.com",
        "password" : "ronipanget"
    })
    assert response.status_code == 400
