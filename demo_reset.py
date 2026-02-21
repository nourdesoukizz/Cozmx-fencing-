"""
Demo Reset Script — sets FenceFlow to perfect demo starting state.

Run before the 3-minute demo to ensure:
  1. Cadet Men Saber is "started" (enables live OCR upload)
  2. Agent is enabled
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "backend" / "data"


def reset_event_status():
    """Set Cadet Men Saber to 'started' so live OCR works during demo."""
    path = DATA_DIR / "event_status.json"
    status = json.loads(path.read_text())
    status["Cadet Men Saber"] = "started"
    path.write_text(json.dumps(status, indent=2) + "\n")
    print(f"[DEMO RESET] event_status.json — Cadet Men Saber → started")


def ensure_agent_enabled():
    """Make sure the tournament agent is enabled."""
    path = DATA_DIR / "agent_state.json"
    state = json.loads(path.read_text())
    state["enabled"] = True
    path.write_text(json.dumps(state, indent=2) + "\n")
    print(f"[DEMO RESET] agent_state.json — enabled → true")


if __name__ == "__main__":
    print("=" * 50)
    print("  FenceFlow Demo Reset")
    print("=" * 50)
    reset_event_status()
    ensure_agent_enabled()
    print()
    print("Ready for demo! Start the server:")
    print("  cd backend && python main.py")
    print()
