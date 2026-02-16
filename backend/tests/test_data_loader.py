"""Tests for backend/data_loader.py — query functions against real CSV data."""

import pytest
from data_loader import (
    _strip_row, load_data, get_fencers, get_fencer_by_id,
    get_pools, get_pool_by_id, get_referees, get_referee_by_id,
    get_referee_by_token, get_tournament, get_events,
    get_event_status, get_pool_leaderboard,
)


@pytest.fixture(scope="module", autouse=True)
def _load_once():
    """Ensure CSV data is loaded once for the module."""
    if not get_fencers():
        load_data()


# --- _strip_row ---

def test_strip_row_whitespace():
    row = {"  key  ": "  value  ", "a": "b"}
    out = _strip_row(row)
    assert out == {"key": "value", "a": "b"}


def test_strip_row_empty():
    assert _strip_row({}) == {}


# --- load_data counts ---

def test_fencer_count():
    fencers = get_fencers()
    assert len(fencers) == 121


def test_pool_count():
    pools = get_pools()
    assert len(pools) == 18


def test_referee_count():
    referees = get_referees()
    assert len(referees) == 18


def test_event_count():
    events = get_events()
    assert len(events) == 2


# --- get_fencers ---

def test_get_fencers_filter_event():
    cms = get_fencers(event="Cadet Men Saber")
    assert len(cms) > 0
    assert all(f["event"] == "Cadet Men Saber" for f in cms)


def test_get_fencers_case_insensitive():
    cms = get_fencers(event="cadet men saber")
    assert len(cms) > 0


# --- get_fencer_by_id ---

def test_get_fencer_by_id_valid():
    fencer = get_fencer_by_id(1)
    assert fencer is not None
    assert fencer["id"] == 1
    assert "first_name" in fencer


def test_get_fencer_by_id_invalid():
    assert get_fencer_by_id(99999) is None


# --- get_pools ---

def test_get_pools_filter_event():
    cms_pools = get_pools(event="Cadet Men Saber")
    assert len(cms_pools) > 0
    assert all(p["event"] == "Cadet Men Saber" for p in cms_pools)


# --- get_pool_by_id ---

def test_get_pool_by_id_valid():
    pool = get_pool_by_id(1)
    assert pool is not None
    assert pool["id"] == 1
    assert "fencers" in pool
    assert "referee" in pool


def test_get_pool_by_id_invalid():
    assert get_pool_by_id(99999) is None


# --- pool structure ---

def test_pool_bout_count_formula():
    """bout_count == fencer_count * (fencer_count - 1) // 2"""
    pools = get_pools()
    for pool in pools:
        n = pool["fencer_count"]
        expected = n * (n - 1) // 2
        assert pool["bout_count"] == expected, (
            f"Pool {pool['id']}: expected {expected}, got {pool['bout_count']}"
        )


# --- get_referees ---

def test_get_referees_all():
    refs = get_referees()
    assert len(refs) > 0
    assert "first_name" in refs[0]


def test_get_referee_by_id_valid():
    ref = get_referee_by_id(1)
    assert ref is not None
    assert ref["id"] == 1


def test_get_referee_by_id_invalid():
    assert get_referee_by_id(99999) is None


def test_get_referee_by_token_valid():
    refs = get_referees()
    token = refs[0].get("token", "")
    if token:
        ref = get_referee_by_token(token)
        assert ref is not None


def test_get_referee_by_token_invalid():
    assert get_referee_by_token("nonexistent-token") is None


# --- get_tournament ---

def test_tournament_structure():
    t = get_tournament()
    assert "name" in t
    assert "date" in t
    assert "events" in t
    assert "totals" in t


def test_tournament_totals():
    t = get_tournament()
    totals = t["totals"]
    assert totals["fencers"] == 121
    assert totals["pools"] == 18
    assert totals["events"] == 2


# --- get_events ---

def test_events_returns_list():
    events = get_events()
    assert isinstance(events, list)
    assert len(events) == 2


# --- get_event_status ---

def test_event_status_returns_valid_string():
    events = get_events()
    status = get_event_status(events[0]["name"])
    assert isinstance(status, str)


# --- get_pool_leaderboard ---

def test_pool_leaderboard_sort_order():
    """Leaderboard should have sequential ranks starting at 1."""
    events = get_events()
    lb = get_pool_leaderboard(events[0]["name"])
    # May be empty if no approved submissions — just check structure
    if lb:
        assert lb[0]["rank"] == 1
        for i, entry in enumerate(lb):
            assert entry["rank"] == i + 1
