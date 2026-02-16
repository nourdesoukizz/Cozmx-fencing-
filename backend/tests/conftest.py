"""Shared pytest fixtures — environment stubs, app patching, and TestClient."""

import os

# Set required env vars BEFORE any app imports
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_BOT_USERNAME"] = ""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


@pytest.fixture(scope="session")
def client():
    """Session-scoped TestClient that starts the FastAPI lifespan once."""
    with patch("telegram_bot.start_polling", lambda: None), \
         patch("telegram_bot.stop_polling", lambda: None), \
         patch("main._validate_api_key", lambda: None), \
         patch("agent.TournamentAgent.start_background", lambda self: None), \
         patch("agent.TournamentAgent.stop_background", AsyncMock()):

        from starlette.testclient import TestClient
        from main import app
        with TestClient(app) as c:
            yield c
