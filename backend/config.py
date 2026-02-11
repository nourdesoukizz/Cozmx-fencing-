import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", 3001))

DATA_DIR = Path(__file__).parent / "data"
UPLOADS_DIR = Path(__file__).parent / "uploads"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

TOURNAMENT_NAME = "Cozmx Fall RYC/RJCC"
TOURNAMENT_DATE = "November 22-23, 2025"
