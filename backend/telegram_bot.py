"""
Lightweight Telegram bot that polls for /start commands to register referees.

When a referee clicks their deep link (https://t.me/BOT?start=TOKEN), Telegram
sends a /start message with the referee's portal token. This module maps the
referee's Telegram chat_id to their referee record so we can message them later.
"""

import json
import threading
import time
import httpx
from pathlib import Path

from config import TELEGRAM_BOT_TOKEN, DATA_DIR


CHAT_IDS_PATH = DATA_DIR / "telegram_chat_ids.json"

# In-memory mapping: referee_id (str) -> chat_id (int)
_chat_ids: dict[str, int] = {}
_lock = threading.Lock()
_running = False


def load_chat_ids():
    """Load saved chat_id mappings from disk."""
    global _chat_ids
    if CHAT_IDS_PATH.exists():
        with open(CHAT_IDS_PATH, "r", encoding="utf-8") as f:
            _chat_ids = json.load(f)


def save_chat_ids():
    """Persist chat_id mappings to disk."""
    with open(CHAT_IDS_PATH, "w", encoding="utf-8") as f:
        json.dump(_chat_ids, f, indent=2)


def get_chat_id(referee_id: int) -> int | None:
    """Look up a referee's Telegram chat_id. Returns None if not registered."""
    return _chat_ids.get(str(referee_id))


def is_registered(referee_id: int) -> bool:
    """Check if a referee has registered with the Telegram bot."""
    return str(referee_id) in _chat_ids


def _reply(chat_id: int, text: str):
    """Send a reply to a Telegram user."""
    if not TELEGRAM_BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        httpx.post(url, json={"chat_id": chat_id, "text": text}, timeout=10)
    except Exception as exc:
        print(f"[TELEGRAM BOT] Reply failed: {exc}")


def _poll_loop():
    """Long-poll Telegram getUpdates and handle /start commands."""
    global _running
    offset = 0
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"

    # Import here to avoid circular imports at module level
    from data_loader import get_referee_by_token

    print("[TELEGRAM BOT] Polling started")

    while _running:
        try:
            resp = httpx.get(url, params={"offset": offset, "timeout": 30}, timeout=40)
            data = resp.json()
            if not data.get("ok"):
                time.sleep(5)
                continue

            for update in data.get("result", []):
                offset = update["update_id"] + 1
                message = update.get("message", {})
                text = message.get("text", "")
                chat_id = message.get("chat", {}).get("id")

                if not chat_id or not text.startswith("/start"):
                    continue

                parts = text.split(maxsplit=1)
                if len(parts) < 2:
                    _reply(chat_id, "Welcome! Please use the registration link provided by tournament staff.")
                    continue

                token = parts[1].strip()
                referee = get_referee_by_token(token)

                if not referee:
                    _reply(chat_id, "Invalid registration link. Please contact tournament staff.")
                    continue

                referee_id = str(referee["id"])
                name = f"{referee.get('first_name', '')} {referee.get('last_name', '')}".strip()

                with _lock:
                    _chat_ids[referee_id] = chat_id
                    save_chat_ids()

                _reply(chat_id, f"Hi {name}! You're registered for FenceFlow notifications. You'll receive messages here when tournament staff needs to reach you.")
                print(f"[TELEGRAM BOT] Registered referee {name} (id={referee_id}, chat_id={chat_id})")

        except httpx.TimeoutException:
            continue
        except Exception as exc:
            print(f"[TELEGRAM BOT] Poll error: {exc}")
            time.sleep(5)


def start_polling():
    """Start the Telegram bot polling in a background daemon thread."""
    global _running
    if not TELEGRAM_BOT_TOKEN:
        print("[TELEGRAM BOT] No TELEGRAM_BOT_TOKEN set, bot disabled")
        return

    load_chat_ids()
    _running = True
    thread = threading.Thread(target=_poll_loop, daemon=True)
    thread.start()


def stop_polling():
    """Signal the polling loop to stop."""
    global _running
    _running = False
