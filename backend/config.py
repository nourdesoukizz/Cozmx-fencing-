import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", 3001))

DATA_DIR = Path(__file__).parent / "data"
UPLOADS_DIR = Path(__file__).parent / "uploads"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "")
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")

COACH_ACCESS_CODE = os.getenv("COACH_ACCESS_CODE", "5678")

TOURNAMENT_NAME = "Cozmx Fall RYC/RJCC"
TOURNAMENT_DATE = "November 22-23, 2025"
