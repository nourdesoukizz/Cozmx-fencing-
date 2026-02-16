"""Tests for backend/ocr_service.py — validate_scores and compute_results (no API)."""

import pytest
from ocr_service import validate_scores, compute_results


# ── validate_scores ──────────────────────────────────────────

def test_validate_empty_matrix():
    result = validate_scores([], [])
    assert any(a["level"] == "error" and "Empty" in a["message"] for a in result)


def test_validate_valid_3x3():
    matrix = [
        [None, 5, 5],
        [3, None, 5],
        [2, 1, None],
    ]
    fencers = [{"last_name": "A"}, {"last_name": "B"}, {"last_name": "C"}]
    anomalies = validate_scores(matrix, fencers)
    errors = [a for a in anomalies if a["level"] == "error"]
    assert len(errors) == 0


def test_validate_indicator_sum_always_zero():
    """For any NxN matrix, sum(TS) == sum(TR) by construction, so indicator sum is always 0."""
    matrix = [
        [None, 4, 5],
        [3, None, 5],
        [2, 1, None],
    ]
    fencers = [{"last_name": "A"}, {"last_name": "B"}, {"last_name": "C"}]
    anomalies = validate_scores(matrix, fencers)
    indicator_errors = [a for a in anomalies if "Indicator" in a["message"]]
    assert len(indicator_errors) == 0


def test_validate_out_of_range():
    matrix = [
        [None, 7],
        [3, None],
    ]
    fencers = [{"last_name": "A"}, {"last_name": "B"}]
    anomalies = validate_scores(matrix, fencers)
    range_errors = [a for a in anomalies if "out of 0-5 range" in a["message"]]
    assert len(range_errors) > 0


def test_validate_tied_bout():
    matrix = [
        [None, 3],
        [3, None],
    ]
    fencers = [{"last_name": "A"}, {"last_name": "B"}]
    anomalies = validate_scores(matrix, fencers)
    tied_errors = [a for a in anomalies if "tied" in a["message"]]
    assert len(tied_errors) > 0


def test_validate_neither_scored_5():
    matrix = [
        [None, 4],
        [3, None],
    ]
    fencers = [{"last_name": "A"}, {"last_name": "B"}]
    anomalies = validate_scores(matrix, fencers)
    warnings = [a for a in anomalies if a["level"] == "warning" and "neither scored 5" in a["message"]]
    assert len(warnings) > 0


# ── compute_results ──────────────────────────────────────────

def test_compute_results_3x3():
    matrix = [
        [None, 5, 5],
        [3, None, 5],
        [2, 1, None],
    ]
    fencers = [
        {"id": 1, "first_name": "Al", "last_name": "A"},
        {"id": 2, "first_name": "Bo", "last_name": "B"},
        {"id": 3, "first_name": "Ca", "last_name": "C"},
    ]
    results = compute_results(matrix, fencers)
    assert len(results) == 3

    # Find fencer A (victories: 2, TS=10, TR=5)
    a_result = next(r for r in results if r["last_name"] == "A")
    assert a_result["V"] == 2
    assert a_result["TS"] == 10
    assert a_result["TR"] == 5
    assert a_result["indicator"] == 5


def test_compute_results_sequential_places():
    matrix = [
        [None, 5, 5],
        [3, None, 5],
        [2, 1, None],
    ]
    fencers = [
        {"id": 1, "first_name": "A", "last_name": "A"},
        {"id": 2, "first_name": "B", "last_name": "B"},
        {"id": 3, "first_name": "C", "last_name": "C"},
    ]
    results = compute_results(matrix, fencers)
    places = [r["place"] for r in results]
    assert places == [1, 2, 3]


def test_compute_results_null_scores():
    matrix = [
        [None, None],
        [None, None],
    ]
    fencers = [
        {"id": 1, "first_name": "A", "last_name": "A"},
        {"id": 2, "first_name": "B", "last_name": "B"},
    ]
    results = compute_results(matrix, fencers)
    assert len(results) == 2
    assert all(r["V"] == 0 for r in results)
    assert all(r["TS"] == 0 for r in results)
