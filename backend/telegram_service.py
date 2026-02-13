import json
import httpx
from config import TELEGRAM_BOT_TOKEN


def send_telegram(chat_id: int, message: str) -> dict:
    """Send a message via Telegram Bot API. Falls back to console logging if not configured."""
    if not TELEGRAM_BOT_TOKEN:
        print(f"[TELEGRAM LOG] chat_id: {chat_id} | Message: {message}")
        return {"status": "logged", "chat_id": chat_id}

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}

    try:
        resp = httpx.post(url, json=payload, timeout=10)
        data = resp.json()
        if data.get("ok"):
            return {"status": "sent", "chat_id": chat_id, "message_id": data["result"]["message_id"]}
        else:
            print(f"[TELEGRAM ERROR] chat_id: {chat_id} | Error: {data.get('description', 'Unknown')}")
            return {"status": "failed", "error": data.get("description", "Unknown"), "chat_id": chat_id}
    except Exception as exc:
        print(f"[TELEGRAM ERROR] chat_id: {chat_id} | Error: {exc}")
        return {"status": "failed", "error": str(exc), "chat_id": chat_id}
