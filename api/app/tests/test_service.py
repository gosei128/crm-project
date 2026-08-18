def test_create_service(client):
    client.post("/auth/signup", json={
        "email": "ryzasore@gmail.com",
        "password" : "password123",
        "name" : "Ryza",
        "role" : "customer"
        })
    
    response = client.post("/auth/login", data={
        "username": "ryzasore@gmail.com",
        "password" : "password123"
    })
    token = response.json()["access_token"]

    response = client.post("/services/", json={
        "name" : "Uragon",
        "duration_minutes" : 40,
        "description" : "Premium Haircut"
    }, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 403