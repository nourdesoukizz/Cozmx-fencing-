"""Tests for backend/bt_engine.py — BT math engine with synthetic data."""

import pytest
from pathlib import Path
from bt_engine import BTEngine


@pytest.fixture
def engine(tmp_path):
    """Create a fresh BTEngine with a temp data dir (no CSV files)."""
    return BTEngine(tmp_path)


# --- _rating_to_strength ---

def test_rating_a():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("A24") == 32.0


def test_rating_b():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("B22") == 16.0


def test_rating_c():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("C20") == 8.0


def test_rating_d():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("D18") == 4.0


def test_rating_e():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("E16") == 2.0


def test_rating_u():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("U") == 1.0


def test_rating_uu():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("U/U") == 1.0


def test_rating_empty():
    e = BTEngine(Path("."))
    assert e._rating_to_strength("") == 1.0


# --- _decompose_pool ---

def test_decompose_pool_3x3(engine):
    fencers = [
        {"first_name": "Alice", "last_name": "A"},
        {"first_name": "Bob", "last_name": "B"},
        {"first_name": "Carol", "last_name": "C"},
    ]
    matrix = [
        [None, 5, 3],
        [2, None, 5],
        [5, 1, None],
    ]
    engine._decompose_pool(1, 1, fencers, matrix)
    assert len(engine.bouts) == 3


def test_decompose_pool_names(engine):
    fencers = [
        {"first_name": "Alice", "last_name": "A"},
        {"first_name": "Bob", "last_name": "B"},
    ]
    matrix = [
        [None, 5],
        [3, None],
    ]
    engine._decompose_pool(1, 1, fencers, matrix)
    bout = engine.bouts[0]
    assert bout["fencer_a"] == "Alice A"
    assert bout["fencer_b"] == "Bob B"
    assert bout["score_a"] == 5
    assert bout["score_b"] == 3


def test_decompose_pool_skips_none(engine):
    fencers = [
        {"first_name": "A", "last_name": "X"},
        {"first_name": "B", "last_name": "Y"},
    ]
    matrix = [[None, None], [None, None]]
    engine._decompose_pool(1, 1, fencers, matrix)
    assert len(engine.bouts) == 0


# --- refit ---

def test_refit_no_bouts(engine):
    """With no bouts, refit is a no-op; strengths stay at priors."""
    engine.priors["Alice"] = 8.0
    engine.strengths["Alice"] = 8.0
    engine.refit()
    assert engine.strengths["Alice"] == 8.0


def test_refit_winner_gets_stronger(engine):
    engine.priors["Winner"] = 1.0
    engine.strengths["Winner"] = 1.0
    engine.priors["Loser"] = 1.0
    engine.strengths["Loser"] = 1.0
    engine.fencer_meta["Winner"] = {"id": None}
    engine.fencer_meta["Loser"] = {"id": None}

    # Winner dominates
    for _ in range(5):
        engine.bouts.append({
            "bout_index": len(engine.bouts) + 1,
            "fencer_a": "Winner",
            "fencer_b": "Loser",
            "score_a": 5,
            "score_b": 1,
            "source": "test",
            "pool_id": None,
            "timestamp": None,
        })

    engine.refit()
    assert engine.strengths["Winner"] > engine.strengths["Loser"]


# --- add_bout ---

def test_add_bout_returns_dict(engine):
    engine.priors["A"] = 1.0
    engine.strengths["A"] = 1.0
    engine.fencer_meta["A"] = {"id": None, "first_name": "A", "last_name": "",
                                "club": "", "rating": "U", "event": ""}
    engine.priors["B"] = 1.0
    engine.strengths["B"] = 1.0
    engine.fencer_meta["B"] = {"id": None, "first_name": "B", "last_name": "",
                                "club": "", "rating": "U", "event": ""}

    result = engine.add_bout("A", "B", 5, 3)
    assert "bout" in result
    assert "fencer_a_strength" in result
    assert "fencer_b_strength" in result


def test_add_bout_registers_unknown(engine):
    result = engine.add_bout("NewFencer1", "NewFencer2", 5, 2)
    assert "NewFencer1" in engine.strengths
    assert "NewFencer2" in engine.strengths
    assert "NewFencer1" in engine.fencer_meta


# --- get_pairwise ---

def test_pairwise_equal_strength(engine):
    engine.priors["X"] = 1.0
    engine.strengths["X"] = 1.0
    engine.priors["Y"] = 1.0
    engine.strengths["Y"] = 1.0
    engine.fencer_meta["X"] = {"id": None}
    engine.fencer_meta["Y"] = {"id": None}

    pw = engine.get_pairwise("X", "Y")
    assert abs(pw["prob_a"] - 0.5) < 0.01


def test_pairwise_stronger_fencer(engine):
    engine.priors["Strong"] = 10.0
    engine.strengths["Strong"] = 10.0
    engine.priors["Weak"] = 1.0
    engine.strengths["Weak"] = 1.0
    engine.fencer_meta["Strong"] = {"id": None}
    engine.fencer_meta["Weak"] = {"id": None}

    pw = engine.get_pairwise("Strong", "Weak")
    assert pw["prob_a"] > 0.5


def test_pairwise_h2h_tracking(engine):
    engine.priors["P"] = 1.0
    engine.strengths["P"] = 1.0
    engine.priors["Q"] = 1.0
    engine.strengths["Q"] = 1.0
    engine.fencer_meta["P"] = {"id": None}
    engine.fencer_meta["Q"] = {"id": None}

    engine.bouts.append({
        "bout_index": 1, "fencer_a": "P", "fencer_b": "Q",
        "score_a": 5, "score_b": 3, "source": "test",
        "pool_id": None, "timestamp": None,
    })

    pw = engine.get_pairwise("P", "Q")
    assert pw["h2h_a_wins"] == 1
    assert pw["h2h_b_wins"] == 0


# --- get_state ---

def test_get_state_structure(engine):
    engine.priors["F1"] = 2.0
    engine.strengths["F1"] = 2.0
    engine.fencer_meta["F1"] = {"id": 1, "first_name": "F", "last_name": "1",
                                 "club": "C", "rating": "E", "event": "E"}

    state = engine.get_state()
    assert "fencers" in state
    assert "total" in state
    assert "bout_count" in state
    assert state["total"] == 1


def test_get_state_sorted_by_strength(engine):
    engine.priors["Hi"] = 10.0
    engine.strengths["Hi"] = 10.0
    engine.fencer_meta["Hi"] = {"id": 1, "first_name": "Hi", "last_name": "",
                                 "club": "", "rating": "", "event": ""}
    engine.priors["Lo"] = 1.0
    engine.strengths["Lo"] = 1.0
    engine.fencer_meta["Lo"] = {"id": 2, "first_name": "Lo", "last_name": "",
                                 "club": "", "rating": "", "event": ""}

    state = engine.get_state()
    fencers = state["fencers"]
    assert fencers[0]["name"] == "Hi"
    assert fencers[0]["rank"] == 1
    assert fencers[1]["rank"] == 2


# --- get_trajectory ---

def test_get_trajectory_empty(engine):
    assert engine.get_trajectory() == []


def test_get_trajectory_after_refit(engine):
    engine.priors["T1"] = 1.0
    engine.strengths["T1"] = 1.0
    engine.priors["T2"] = 1.0
    engine.strengths["T2"] = 1.0
    engine.fencer_meta["T1"] = {"id": None}
    engine.fencer_meta["T2"] = {"id": None}

    engine.bouts.append({
        "bout_index": 1, "fencer_a": "T1", "fencer_b": "T2",
        "score_a": 5, "score_b": 2, "source": "test",
        "pool_id": None, "timestamp": None,
    })
    engine.refit()
    engine._snapshot("Test")

    traj = engine.get_trajectory()
    assert len(traj) == 1


def test_get_trajectory_filter_by_fencer(engine):
    engine.priors["FA"] = 1.0
    engine.strengths["FA"] = 1.0
    engine.priors["FB"] = 1.0
    engine.strengths["FB"] = 1.0
    engine.fencer_meta["FA"] = {"id": None}
    engine.fencer_meta["FB"] = {"id": None}

    engine.bouts.append({
        "bout_index": 1, "fencer_a": "FA", "fencer_b": "FB",
        "score_a": 5, "score_b": 2, "source": "test",
        "pool_id": None, "timestamp": None,
    })
    engine.refit()
    engine._snapshot("Test")

    traj_fa = engine.get_trajectory(fencer="FA")
    assert len(traj_fa) >= 1
    assert "strength" in traj_fa[0]

    traj_missing = engine.get_trajectory(fencer="Nonexistent")
    assert traj_missing == []


# --- find_fencer ---

def test_find_fencer_exact(engine):
    engine.fencer_meta["John Smith"] = {"id": 1}
    assert engine.find_fencer("John Smith") == "John Smith"


def test_find_fencer_partial(engine):
    engine.fencer_meta["John Smith"] = {"id": 1}
    found = engine.find_fencer("john")
    assert found is not None
    assert "John" in found


def test_find_fencer_not_found(engine):
    assert engine.find_fencer("ZZZZ_NONEXISTENT") is None


# --- get_fencer_names ---

def test_get_fencer_names_sorted(engine):
    engine.fencer_meta["Charlie"] = {"id": 3}
    engine.fencer_meta["Alice"] = {"id": 1}
    engine.fencer_meta["Bob"] = {"id": 2}
    names = engine.get_fencer_names()
    assert names == sorted(names)


# --- get_all_bouts ---

def test_get_all_bouts_reverse_order(engine):
    engine.bouts = [
        {"bout_index": 1, "fencer_a": "A", "fencer_b": "B", "score_a": 5, "score_b": 3},
        {"bout_index": 2, "fencer_a": "C", "fencer_b": "D", "score_a": 5, "score_b": 2},
    ]
    result = engine.get_all_bouts()
    assert result[0]["bout_index"] == 2
    assert result[1]["bout_index"] == 1


# --- simulate_de ---

def test_simulate_de_no_bracket(engine):
    result = engine.simulate_de()
    assert "error" in result


def test_simulate_de_with_bracket(engine):
    engine.priors["S1"] = 10.0
    engine.strengths["S1"] = 10.0
    engine.priors["S2"] = 5.0
    engine.strengths["S2"] = 5.0
    engine.fencer_meta["S1"] = {"id": 1}
    engine.fencer_meta["S2"] = {"id": 2}
    engine.set_bracket(["S1", "S2"])

    result = engine.simulate_de(n_sims=1000)
    assert "error" not in result
    assert "results" in result
    assert len(result["results"]) == 2

    # Champion percentages should sum to ~100
    champ_sum = sum(r["Champion"] for r in result["results"])
    assert abs(champ_sum - 100) < 5  # allow rounding tolerance
