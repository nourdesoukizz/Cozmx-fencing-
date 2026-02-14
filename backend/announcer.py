"""
Announcer Service — PA announcement system with LLM polish.

Generates polished announcements when key tournament events occur
(pool approved, event started/stopped, all pools complete) using Claude LLM.
Also polishes committee-typed custom announcements.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from config import DATA_DIR, ANTHROPIC_API_KEY

ANNOUNCEMENTS_PATH = DATA_DIR / "announcements.json"
MAX_ENTRIES = 200

RAW_TEMPLATES = {
    "event_started": "The {event_name} event has started. Referees should report to their strips.",
    "event_stopped": "The {event_name} event has concluded.",
    "pool_approved": "Pool {pool_number} results for {event_name} have been approved.",
    "all_pools_complete": "All {pool_count} pools for {event_name} are complete.",
    "de_bout_completed": "{winner_name} defeats {loser_name} {score} in the {round_name} of {event_name}.",
    "de_event_completed": "The {event_name} Direct Elimination is complete. Champion: {champion_name}.",
}


class AnnouncerService:

    def __init__(self):
        self.announcements: list[dict] = []
        self._load()

    def _load(self):
        if ANNOUNCEMENTS_PATH.exists():
            try:
                with open(ANNOUNCEMENTS_PATH, "r", encoding="utf-8") as f:
                    self.announcements = json.load(f)
            except Exception as exc:
                print(f"[ANNOUNCER] Failed to load: {exc}")
                self.announcements = []

    def _save(self):
        # Cap at MAX_ENTRIES (keep newest)
        if len(self.announcements) > MAX_ENTRIES:
            self.announcements = self.announcements[-MAX_ENTRIES:]
        try:
            with open(ANNOUNCEMENTS_PATH, "w", encoding="utf-8") as f:
                json.dump(self.announcements, f, indent=2)
        except Exception as exc:
            print(f"[ANNOUNCER] Failed to save: {exc}")

    async def _polish_text(self, raw_text: str) -> str:
        """Call Claude Haiku to polish raw text into a professional PA announcement."""
        if not ANTHROPIC_API_KEY:
            return raw_text

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-opus-4-6-20250219",
                        "max_tokens": 150,
                        "system": [
                            {
                                "type": "text",
                                "text": (
                                    "You are a professional PA tournament announcer for a fencing competition. "
                                    "Polish the given text into 1-2 clear, professional sentences suitable for "
                                    "a public address announcement. Keep it concise and authoritative. "
                                    "Do not add any prefixes like 'Attention' unless appropriate. "
                                    "Return only the polished announcement text."
                                ),
                                "cache_control": {"type": "ephemeral"},
                            }
                        ],
                        "messages": [{"role": "user", "content": raw_text}],
                    },
                    timeout=15.0,
                )

            if resp.status_code == 200:
                data = resp.json()
                polished = data.get("content", [{}])[0].get("text", "")
                if polished:
                    return polished
            print(f"[ANNOUNCER] LLM returned status {resp.status_code}")
        except Exception as exc:
            print(f"[ANNOUNCER] LLM polish failed: {exc}")

        return raw_text

    async def generate(self, trigger: str, context: dict) -> dict:
        """Generate an announcement from a trigger event."""
        template = RAW_TEMPLATES.get(trigger, "")
        if not template:
            return {}

        raw_text = template.format(**context)
        polished_text = await self._polish_text(raw_text)

        entry = {
            "id": str(uuid.uuid4()),
            "type": "auto",
            "trigger": trigger,
            "raw_text": raw_text,
            "polished_text": polished_text,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "announced_at": None,
        }

        self.announcements.append(entry)
        self._save()

        # Broadcast via WebSocket
        try:
            from main import manager
            await manager.broadcast({
                "type": "announcement_suggestion",
                "announcement": entry,
            })
        except Exception as exc:
            print(f"[ANNOUNCER] Broadcast failed: {exc}")

        return entry

    async def polish_custom(self, raw_text: str) -> dict:
        """Polish a custom committee-typed announcement."""
        polished_text = await self._polish_text(raw_text)

        entry = {
            "id": str(uuid.uuid4()),
            "type": "custom",
            "trigger": "custom",
            "raw_text": raw_text,
            "polished_text": polished_text,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "announced_at": None,
        }

        self.announcements.append(entry)
        self._save()

        # Broadcast via WebSocket
        try:
            from main import manager
            await manager.broadcast({
                "type": "announcement_suggestion",
                "announcement": entry,
            })
        except Exception as exc:
            print(f"[ANNOUNCER] Broadcast failed: {exc}")

        return entry

    def get_list(self, limit: int = 50, offset: int = 0) -> dict:
        """Return paginated announcements (newest first)."""
        reversed_list = list(reversed(self.announcements))
        total = len(reversed_list)
        items = reversed_list[offset:offset + limit]
        return {"announcements": items, "total": total}

    def mark_announced(self, announcement_id: str) -> bool:
        """Mark an announcement as announced."""
        for entry in self.announcements:
            if entry["id"] == announcement_id:
                entry["status"] = "announced"
                entry["announced_at"] = datetime.now().isoformat()
                self._save()
                return True
        return False

    def dismiss(self, announcement_id: str) -> bool:
        """Dismiss an announcement."""
        for entry in self.announcements:
            if entry["id"] == announcement_id:
                entry["status"] = "dismissed"
                self._save()
                return True
        return False


# Module-level singleton
announcer = AnnouncerService()
