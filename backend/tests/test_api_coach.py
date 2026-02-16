"""Tests for coach API endpoints via TestClient."""

import pytest


def _get_coach_token(client):
    """Helper: authenticate and return Bearer token."""
    resp = client.post("/api/coach/auth", json={"code": "5678"})
    assert resp.status_code == 200
    return resp.json()["token"]


def test_coach_auth_success(client):
    resp = client.post("/api/coach/auth", json={"code": "5678"})
    assert resp.status_code == 200
    assert "token" in resp.json()


def test_coach_auth_wrong_code(client):
    resp = client.post("/api/coach/auth", json={"code": "wrong"})
    assert resp.status_code == 401


def test_coach_state_no_auth(client):
    resp = client.get("/api/coach/state")
    assert resp.status_code == 401


def test_coach_state_with_auth(client):
    token = _get_coach_token(client)
    resp = client.get("/api/coach/state",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "fencers" in data


def test_coach_fencer_names(client):
    token = _get_coach_token(client)
    resp = client.get("/api/coach/fencer-names",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "names" in data
    assert isinstance(data["names"], list)


def test_coach_trajectory(client):
    token = _get_coach_token(client)
    resp = client.get("/api/coach/trajectory",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "trajectory" in data
