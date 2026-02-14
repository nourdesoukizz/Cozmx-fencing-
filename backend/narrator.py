"""
Narrator Service — AI-generated casual tournament commentary.

Generates engaging, parent-friendly commentary when tournament events occur
(pool approved, event started/stopped, all pools complete) using Claude LLM.
Separate from the PA announcer — different tone (casual vs formal).
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from config import DATA_DIR, ANTHROPIC_API_KEY

NARRATOR_PATH = DATA_DIR / "narrator_feed.json"
MAX_ENTRIES = 200

FALLBACK_TEMPLATES = {
    "event_started": "And we're off! The {event_name} event is underway — let's see some great fencing!",
    "event_stopped": "That's a wrap for {event_name}! What a competition.",
    "pool_approved": "Pool {pool_number} results are in for {event_name}!",
    "all_pools_complete": "All {pool_count} pools for {event_name} are done — every bout counted!",
    "de_bout_completed": "{winner_name} (#{winner_seed}) takes down {loser_name} (#{loser_seed}) {score} in the {round_name} of {event_name}!",
    "de_event_completed": "{champion_name} wins the {event_name}! What a performance!",
}


class NarratorService:

    def __init__(self):
        self.entries: list[dict] = []
        self._load()

    def _load(self):
        if NARRATOR_PATH.exists():
            try:
                with open(NARRATOR_PATH, "r", encoding="utf-8") as f:
                    self.entries = json.load(f)
            except Exception as exc:
                print(f"[NARRATOR] Failed to load: {exc}")
                self.entries = []

    def _save(self):
        if len(self.entries) > MAX_ENTRIES:
            self.entries = self.entries[-MAX_ENTRIES:]
        try:
            with open(NARRATOR_PATH, "w", encoding="utf-8") as f:
                json.dump(self.entries, f, indent=2)
        except Exception as exc:
            print(f"[NARRATOR] Failed to save: {exc}")

    async def _generate_text(self, trigger: str, context: dict) -> str:
        """Call Claude Haiku to generate casual commentary."""
        # Build a rich prompt based on trigger type
        if trigger == "pool_approved":
            results = context.get("results", [])
            fencers = context.get("fencers", [])
            event_name = context.get("event_name", "")
            pool_number = context.get("pool_number", "")

            # Find the winner (place 1)
            winner_name = ""
            top_results = []
            for r in sorted(results, key=lambda x: x.get("place", 99)):
                name = r.get("name", "")
                v = r.get("V", 0)
                ts = r.get("TS", 0)
                tr = r.get("TR", 0)
                top_results.append(f"{name}: {v}V, {ts}-{tr}")
                if r.get("place") == 1:
                    winner_name = name

            results_text = "; ".join(top_results[:5])
            prompt = (
                f"Pool {pool_number} of {event_name} just finished. "
                f"Results: {results_text}. "
                f"Winner: {winner_name}. "
                f"Write 1-2 sentences of casual, engaging commentary."
            )
        elif trigger == "event_started":
            prompt = f"The {context.get('event_name', '')} event just started at a fencing tournament. Write 1-2 exciting sentences."
        elif trigger == "event_stopped":
            prompt = f"The {context.get('event_name', '')} event just concluded. Write 1-2 wrap-up sentences."
        elif trigger == "all_pools_complete":
            prompt = (
                f"All {context.get('pool_count', '')} pools for {context.get('event_name', '')} "
                f"are complete. Write 1-2 celebratory sentences."
            )
        elif trigger == "de_bout_completed":
            winner_seed = context.get("winner_seed", "")
            loser_seed = context.get("loser_seed", "")
            upset = ""
            if winner_seed and loser_seed:
                try:
                    if int(winner_seed) > int(loser_seed):
                        upset = " This is an upset!"
                except (ValueError, TypeError):
                    pass
            prompt = (
                f"DE {context.get('round_name', '')} result in {context.get('event_name', '')}: "
                f"#{winner_seed} {context.get('winner_name', '')} beat "
                f"#{loser_seed} {context.get('loser_name', '')} {context.get('score', '')}.{upset} "
                f"Write 1-2 sentences of exciting commentary."
            )
        elif trigger == "de_event_completed":
            prompt = (
                f"{context.get('champion_name', '')} (seed #{context.get('champion_seed', '')}) "
                f"has won the {context.get('event_name', '')} DE, defeating "
                f"{context.get('runner_up_name', '')} (seed #{context.get('runner_up_seed', '')}) "
                f"{context.get('score', '')} in the final. Write 1-2 celebratory sentences."
            )
        else:
            prompt = f"Tournament update: {trigger}. Write 1-2 casual sentences."

        if not ANTHROPIC_API_KEY:
            template = FALLBACK_TEMPLATES.get(trigger, "Tournament update!")
            try:
                return template.format(**context)
            except KeyError:
                return template

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
                        "model": "claude-haiku-4-5-20251001",
                        "max_tokens": 120,
                        "system": (
                            "You are an enthusiastic fencing tournament commentator writing a live feed. "
                            "Write 1-2 short, casual, parent-friendly sentences. Be engaging and fun. "
                            "Mention fencer names when available. Note any upsets or dominant performances. "
                            "Keep it brief — this is a scrolling feed, not a news article. "
                            "Return only the commentary text, no quotes or prefixes."
                        ),
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    timeout=15.0,
                )

            if resp.status_code == 200:
                data = resp.json()
                text = data.get("content", [{}])[0].get("text", "")
                if text:
                    return text
            print(f"[NARRATOR] LLM returned status {resp.status_code}")
        except Exception as exc:
            print(f"[NARRATOR] LLM generation failed: {exc}")

        # Fallback to template
        template = FALLBACK_TEMPLATES.get(trigger, "Tournament update!")
        try:
            return template.format(**context)
        except KeyError:
            return template

    async def generate(self, trigger: str, context: dict) -> dict:
        """Generate a narrator entry from a trigger event."""
        text = await self._generate_text(trigger, context)

        entry = {
            "id": str(uuid.uuid4()),
            "trigger": trigger,
            "text": text,
            "created_at": datetime.now().isoformat(),
        }

        self.entries.append(entry)
        self._save()

        # Broadcast via WebSocket
        try:
            from main import manager
            await manager.broadcast({
                "type": "narrator_update",
                "entry": entry,
            })
        except Exception as exc:
            print(f"[NARRATOR] Broadcast failed: {exc}")

        return entry

    def get_feed(self, limit: int = 50, offset: int = 0) -> dict:
        """Return paginated narrator feed (newest first)."""
        reversed_list = list(reversed(self.entries))
        total = len(reversed_list)
        items = reversed_list[offset:offset + limit]
        return {"entries": items, "total": total}


# Module-level singleton
narrator = NarratorService()
