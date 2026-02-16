"""Tests for backend/config.py — default values and paths."""

from config import (
    PORT, COACH_ACCESS_CODE, SONNET_MODEL, OPUS_MODEL, DATA_DIR,
    TOURNAMENT_NAME, TOURNAMENT_DATE,
)


def test_default_port():
    assert PORT == 3001


def test_default_coach_access_code():
    assert COACH_ACCESS_CODE == "5678"


def test_sonnet_model_id():
    assert "sonnet" in SONNET_MODEL.lower()


def test_opus_model_id():
    assert "opus" in OPUS_MODEL.lower()


def test_data_dir_exists():
    assert DATA_DIR.exists()


def test_tournament_name_set():
    assert isinstance(TOURNAMENT_NAME, str)
    assert len(TOURNAMENT_NAME) > 0
