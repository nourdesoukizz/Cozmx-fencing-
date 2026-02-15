"""
Narrator Service — AI-generated casual tournament commentary with streaming.

Generates engaging, parent-friendly commentary when tournament events occur
using Claude Opus 4.6 with streaming. Tokens are broadcast via WebSocket
in real-time for a typing-animation effect on the public view.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from config import DATA_DIR, ANTHROPIC_API_KEY, OPUS_MODEL

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

NARRATOR_SYSTEM_PROMPT = (
    "You are an enthusiastic fencing tournament commentator writing a live feed. "
    "Write 1-2 short, casual, parent-friendly sentences. Be engaging and fun. "
    "Mention fencer names when available. Note any upsets or dominant performances. "
    "Keep it brief — this is a scrolling feed, not a news article. "
    "Return only the commentary text, no quotes or prefixes."
)


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

    def _build_prompt(self, trigger: str, context: dict) -> str:
        """Build a rich prompt based on trigger type."""
        if trigger == "pool_approved":
            results = context.get("results", [])
            fencers = context.get("fencers", [])
            event_name = context.get("event_name", "")
            pool_number = context.get("pool_number", "")

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
            return (
                f"Pool {pool_number} of {event_name} just finished. "
                f"Results: {results_text}. "
                f"Winner: {winner_name}. "
                f"Write 1-2 sentences of casual, engaging commentary."
            )
        elif trigger == "event_started":
            return f"The {context.get('event_name', '')} event just started at a fencing tournament. Write 1-2 exciting sentences."
        elif trigger == "event_stopped":
            return f"The {context.get('event_name', '')} event just concluded. Write 1-2 wrap-up sentences."
        elif trigger == "all_pools_complete":
            return (
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
            return (
                f"DE {context.get('round_name', '')} result in {context.get('event_name', '')}: "
                f"#{winner_seed} {context.get('winner_name', '')} beat "
                f"#{loser_seed} {context.get('loser_name', '')} {context.get('score', '')}.{upset} "
                f"Write 1-2 sentences of exciting commentary."
            )
        elif trigger == "de_event_completed":
            return (
                f"{context.get('champion_name', '')} (seed #{context.get('champion_seed', '')}) "
                f"has won the {context.get('event_name', '')} DE, defeating "
                f"{context.get('runner_up_name', '')} (seed #{context.get('runner_up_seed', '')}) "
                f"{context.get('score', '')} in the final. Write 1-2 celebratory sentences."
            )
        else:
            return f"Tournament update: {trigger}. Write 1-2 casual sentences."

    async def _generate_streaming(self, trigger: str, context: dict, entry_id: str) -> str:
        """Generate commentary using Opus 4.6 streaming API, broadcasting tokens via WebSocket."""
        prompt = self._build_prompt(trigger, context)

        if not ANTHROPIC_API_KEY:
            template = FALLBACK_TEMPLATES.get(trigger, "Tournament update!")
            try:
                return template.format(**context)
            except KeyError:
                return template

        try:
            import httpx

            # Broadcast stream start
            try:
                from main import manager
                await manager.broadcast({
                    "type": "narrator_stream_start",
                    "entry_id": entry_id,
                })
            except Exception:
                pass

            full_text = ""

            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": OPUS_MODEL,
                        "max_tokens": 150,
                        "stream": True,
                        "system": [
                            {
                                "type": "text",
                                "text": NARRATOR_SYSTEM_PROMPT,
                                "cache_control": {"type": "ephemeral"},
                            }
                        ],
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    timeout=30.0,
                ) as response:
                    if response.status_code != 200:
                        print(f"[NARRATOR] Streaming returned status {response.status_code}")
                        raise Exception(f"Status {response.status_code}")

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break

                        try:
                            event_data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        event_type = event_data.get("type", "")

                        if event_type == "content_block_delta":
                            delta = event_data.get("delta", {})
                            if delta.get("type") == "text_delta":
                                token = delta.get("text", "")
                                if token:
                                    full_text += token
                                    # Broadcast each token for typing animation
                                    try:
                                        from main import manager
                                        await manager.broadcast({
                                            "type": "narrator_stream_token",
                                            "entry_id": entry_id,
                                            "token": token,
                                        })
                                    except Exception:
                                        pass

            # Broadcast stream end
            try:
                from main import manager
                await manager.broadcast({
                    "type": "narrator_stream_end",
                    "entry_id": entry_id,
                })
            except Exception:
                pass

            if full_text:
                return full_text

        except Exception as exc:
            print(f"[NARRATOR] Streaming generation failed: {exc}")

        # Fallback to template
        template = FALLBACK_TEMPLATES.get(trigger, "Tournament update!")
        try:
            return template.format(**context)
        except KeyError:
            return template

    async def generate(self, trigger: str, context: dict) -> dict:
        """Generate a narrator entry from a trigger event with streaming."""
        entry_id = str(uuid.uuid4())
        text = await self._generate_streaming(trigger, context, entry_id)

        entry = {
            "id": entry_id,
            "trigger": trigger,
            "text": text,
            "created_at": datetime.now().isoformat(),
        }

        self.entries.append(entry)
        self._save()

        # Broadcast final complete entry via WebSocket
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
