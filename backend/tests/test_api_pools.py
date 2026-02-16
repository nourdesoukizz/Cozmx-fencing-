"""Tests for pools API endpoints via TestClient."""


def test_list_pools(client):
    resp = client.get("/api/pools")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 18


def test_list_pools_filter_event(client):
    resp = client.get("/api/pools?event=Cadet Men Saber")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all(p["event"] == "Cadet Men Saber" for p in data)


def test_pool_detail(client):
    resp = client.get("/api/pools/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert "fencers" in data
    assert "referee" in data
    assert "bout_count" in data


def test_pool_not_found(client):
    resp = client.get("/api/pools/99999")
    assert resp.status_code == 404
