"""Tests for backend/de_bracket.py — bracket helper methods."""

import math
from de_bracket import DEBracketService


def _svc():
    """Create a service instance (won't load any bracket file in tests)."""
    svc = DEBracketService.__new__(DEBracketService)
    svc.brackets = {}
    return svc


# --- _generate_bracket_positions ---

def test_bracket_positions_2():
    svc = _svc()
    positions = svc._generate_bracket_positions(2)
    assert positions == [(1, 2)]


def test_bracket_positions_4():
    svc = _svc()
    positions = svc._generate_bracket_positions(4)
    assert len(positions) == 2
    # Seeds 1 and 4 should meet; seeds 2 and 3 should meet
    seeds = {frozenset(p) for p in positions}
    assert frozenset({1, 4}) in seeds
    assert frozenset({2, 3}) in seeds


def test_bracket_positions_8():
    svc = _svc()
    positions = svc._generate_bracket_positions(8)
    assert len(positions) == 4
    # Top seed (1) should face bottom seed (8)
    all_pairs = {frozenset(p) for p in positions}
    assert frozenset({1, 8}) in all_pairs


# --- _round_name ---

def test_round_name_final():
    svc = _svc()
    # bracket_size=4, round_number where remaining=2 → "Final"
    # remaining = 4 >> round_number
    # 4 >> 1 = 2 → Final
    assert svc._round_name(4, 1) == "Final"


def test_round_name_semifinal():
    svc = _svc()
    # 8 >> 1 = 4 → Semifinal
    assert svc._round_name(8, 1) == "Semifinal"


def test_round_name_table_of_8():
    svc = _svc()
    # 8 >> 0 = 8 → Table of 8
    assert svc._round_name(8, 0) == "Table of 8"


# --- _total_rounds ---

def test_total_rounds_8():
    svc = _svc()
    assert svc._total_rounds(8) == 3


def test_total_rounds_16():
    svc = _svc()
    assert svc._total_rounds(16) == 4


# --- _advance_winner ---

def test_advance_winner_places_in_next():
    svc = _svc()
    rounds = [
        {"round_name": "Semi", "bouts": [
            {"bout_id": "R0-B0", "next_bout_id": "R1-B0", "next_slot": "top",
             "top_fencer": None, "bottom_fencer": None},
        ]},
        {"round_name": "Final", "bouts": [
            {"bout_id": "R1-B0", "top_fencer": None, "bottom_fencer": None},
        ]},
    ]
    winner = {"fencer_id": 1, "first_name": "A", "last_name": "B", "seed": 1}
    svc._advance_winner(rounds, rounds[0]["bouts"][0], winner)
    assert rounds[1]["bouts"][0]["top_fencer"]["fencer_id"] == 1


# --- _find_bout ---

def test_find_bout_found():
    svc = _svc()
    bracket = {
        "rounds": [
            {"bouts": [{"bout_id": "X-R0-B0"}, {"bout_id": "X-R0-B1"}]},
            {"bouts": [{"bout_id": "X-R1-B0"}]},
        ]
    }
    assert svc._find_bout(bracket, "X-R0-B1")["bout_id"] == "X-R0-B1"


def test_find_bout_missing():
    svc = _svc()
    bracket = {"rounds": [{"bouts": [{"bout_id": "A"}]}]}
    assert svc._find_bout(bracket, "MISSING") is None
