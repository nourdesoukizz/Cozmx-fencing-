"""Tests for health and tournament API endpoints via TestClient."""


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_tournament_status(client):
    resp = client.get("/api/tournament/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "name" in data
    assert "date" in data
    assert "events" in data
    assert "totals" in data


def test_tournament_events(client):
    resp = client.get("/api/tournament/events")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_tournament_totals_match(client):
    resp = client.get("/api/tournament/status")
    totals = resp.json()["totals"]
    assert totals["fencers"] == 121
    assert totals["pools"] == 18
