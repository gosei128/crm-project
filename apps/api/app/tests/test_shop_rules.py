"""Shop rules: official Kabarbers policy served to all clients."""


def test_shop_rules_returns_official_rules_with_titles(client):
    r = client.get("/shop-rules")
    assert r.status_code == 200, r.text
    rules = r.json()["rules"]

    # Official 4 + operational lines, ordered
    titles = [rule["title"] for rule in rules]
    assert titles == [
        "BOOKING",
        "DOWNPAYMENT",
        "LATE ARRIVAL",
        "WAITING TIME",
        "NO SHOW",
        "CONFIRMATION",
        "LUNCH BREAK",
    ]

    for rule in rules:
        assert rule["id"]
        assert rule["text"]
        assert rule["order"] > 0

    by_title = {rule["title"]: rule["text"] for rule in rules}
    assert "15 minutes late" in by_title["LATE ARRIVAL"]
    assert "hold your spot" in by_title["WAITING TIME"]
    assert "forfeited" in by_title["NO SHOW"]
    assert "check-in" in by_title["CONFIRMATION"]
