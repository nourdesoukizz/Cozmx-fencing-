import os
from pathlib import Path

PORT = int(os.getenv("PORT", 3001))

DATA_DIR = Path(__file__).parent / "data"

TOURNAMENT_NAME = "Cozmx Fall RYC/RJCC"
TOURNAMENT_DATE = "November 22-23, 2025"
