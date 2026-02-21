"""
Tournament Agent — AI-powered autonomous background task using Claude Opus 4.6 with tool use.

The agent uses Claude's tool-use capability to reason about tournament state and take actions:
  1. Inspect pending submissions and their OCR confidence/anomalies
  2. Approve clean pools or flag suspicious ones for committee review
  3. Ping laggard referees via Telegram
  4. Generate PA announcements and narrator commentary
  5. Auto-stop events when all pools are approved
"""

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path

from config import DATA_DIR, BASE_URL, ANTHROPIC_API_KEY, OPUS_MODEL

STATE_PATH = DATA_DIR / "agent_state.json"
MAX_LOG_ENTRIES = 500

DEFAULT_CONFIG = {
    "confidence_threshold": 0.90,
    "ping_interval_minutes": 15,
    "max_pings": 3,
    "tick_interval_seconds": 30,
}

# ── Tool Definitions for Claude Opus 4.6 ─────────────────────────────

AGENT_TOOLS = [
    {
        "name": "get_pending_submissions",
        "description": "Get all pools currently awaiting review. Returns pool_id, event, pool_number, OCR confidence, anomaly counts, and submission time for each pending pool.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_pool_anomalies",
        "description": "Get the detailed anomaly report for a specific pool, including each anomaly's level (error/warning/info) and message. Use this to investigate pools before deciding to approve or flag them.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pool_id": {"type": "integer", "description": "The pool ID to inspect"},
            },
            "required": ["pool_id"],
        },
    },
    {
        "name": "approve_pool",
        "description": "Approve a pool's scores after validation. Only approve pools with high confidence and zero error-level anomalies. This computes final results, saves them, and triggers announcements.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pool_id": {"type": "integer", "description": "The pool ID to approve"},
            },
            "required": ["pool_id"],
        },
    },
    {
        "name": "flag_pool",
        "description": "Flag a pool for manual committee review due to low confidence or anomalies. Provide a reason explaining why.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pool_id": {"type": "integer", "description": "The pool ID to flag"},
                "reason": {"type": "string", "description": "Why the pool needs manual review"},
            },
            "required": ["pool_id", "reason"],
        },
    },
    {
        "name": "check_tournament_pace",
        "description": "Get tournament progress stats — pools done vs total, time elapsed, events running, and referee submission status.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "ping_referee",
        "description": "Send a Telegram reminder to a specific referee who hasn't uploaded their pool sheet. Include the referee_id and a friendly reminder message.",
        "input_schema": {
            "type": "object",
            "properties": {
                "referee_id": {"type": "integer", "description": "The referee's ID"},
                "message": {"type": "string", "description": "A friendly reminder message to send"},
            },
            "required": ["referee_id", "message"],
        },
    },
    {
        "name": "generate_announcement",
        "description": "Create a PA announcement for the tournament venue speakers. Use for important updates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "The announcement text to broadcast"},
            },
            "required": ["text"],
        },
    },
    {
        "name": "stop_event",
        "description": "Stop/complete an event when ALL of its pools have been approved. Do not call this unless every pool is approved.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event": {"type": "string", "description": "The event name to stop"},
            },
            "required": ["event"],
        },
    },
    {
        "name": "create_de_bracket",
        "description": "Create DE bracket for an event after all pools are approved and event is stopped.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event": {"type": "string", "description": "Event name"},
            },
            "required": ["event"],
        },
    },
    {
        "name": "assign_de_referees",
        "description": "Assign referees to all pending first-round DE bouts and notify them via Telegram.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event": {"type": "string", "description": "Event name"},
            },
            "required": ["event"],
        },
    },
]

AGENT_SYSTEM_PROMPT = """\
You are an autonomous AI tournament director assistant for FenceFlow, a fencing tournament management system. You are powered by Claude Opus 4.6.

Your job is to monitor the tournament and take actions to keep it running smoothly. You run every {tick_interval} seconds and should be efficient — only take actions when needed.

## Your Decision Framework

1. **Check pending submissions** — look at pools awaiting review
2. **Approve clean pools** — if OCR confidence >= {confidence_threshold:.0%} AND zero error anomalies, approve them
3. **Flag suspicious pools** — if confidence is low or there are error anomalies, flag for committee review
4. **Ping laggard referees** — if referees haven't uploaded their sheets, send reminders (max {max_pings} pings, at least {ping_interval} min apart)
5. **Stop completed events** — when ALL pools for an event are approved, stop it
6. **Create DE bracket** — when an event is stopped and all pools approved, create the DE bracket using `create_de_bracket`
7. **Assign DE referees** — after creating the DE bracket, assign referees to first-round bouts using `assign_de_referees`
8. **Generate announcements** — for important milestones (all pools done, events stopping, DE bracket created)

## Rules
- ALWAYS check pending submissions first to see if there's work to do
- NEVER approve a pool that has error-level anomalies — flag it instead
- Be conservative: when in doubt, flag for review rather than auto-approving
- Don't ping a referee if they've already been pinged recently (check pace info)
- Keep your actions focused and efficient — don't take unnecessary actions
- If there's nothing to do, simply stop (don't call any tools)

## Current State
{current_state}
"""


class TournamentAgent:

    def __init__(self):
        self.enabled: bool = False
        self.config: dict = dict(DEFAULT_CONFIG)
        self.tracked_events: dict = {}
        self.action_log: list[dict] = []
        self._task: asyncio.Task | None = None
        self._load_state()

    # ── Persistence ──────────────────────────────────────────────

    def _load_state(self):
        if STATE_PATH.exists():
            try:
                with open(STATE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.enabled = data.get("enabled", False)
                self.config = {**DEFAULT_CONFIG, **data.get("config", {})}
                self.tracked_events = data.get("tracked_events", {})
                self.action_log = data.get("action_log", [])
            except Exception as exc:
                print(f"[AGENT] Failed to load state: {exc}")

    def _save_state(self):
        data = {
            "enabled": self.enabled,
            "config": self.config,
            "tracked_events": self.tracked_events,
            "action_log": self.action_log[-MAX_LOG_ENTRIES:],
        }
        try:
            with open(STATE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as exc:
            print(f"[AGENT] Failed to save state: {exc}")

    # ── Logging & Broadcasting ───────────────────────────────────

    def _log_action(self, action: str, details: dict) -> dict:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            **details,
        }
        self.action_log.append(entry)
        if len(self.action_log) > MAX_LOG_ENTRIES:
            self.action_log = self.action_log[-MAX_LOG_ENTRIES:]
        self._save_state()
        print(f"[AGENT] {action}: {details}")
        return entry

    async def _broadcast_action(self, entry: dict):
        from main import manager
        await manager.broadcast({"type": "agent_action", "entry": entry})

    # ── Reset ────────────────────────────────────────────────────

    def reset(self):
        """Reset all agent state for a fresh demo run."""
        self.tracked_events = {}
        self.action_log = []
        self._save_state()

    # ── Public API ───────────────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "enabled": self.enabled,
            "config": self.config,
            "tracked_events": self.tracked_events,
            "log_count": len(self.action_log),
            "running": self._task is not None and not self._task.done(),
        }

    def get_log(self, limit: int = 50, offset: int = 0) -> dict:
        reversed_log = list(reversed(self.action_log))
        total = len(reversed_log)
        entries = reversed_log[offset:offset + limit]
        return {"entries": entries, "total": total}

    def get_pending_queue(self) -> list[dict]:
        from data_loader import get_pools, get_submission
        pending = []
        for pool in get_pools():
            sub = get_submission(pool["id"])
            if not sub:
                continue
            status = sub.get("status", "")
            if status not in ("pending_review", "ocr_failed"):
                continue
            error_anomalies = [a for a in sub.get("anomalies", []) if a.get("level") == "error"]
            pending.append({
                "pool_id": pool["id"],
                "event": pool["event"],
                "pool_number": pool["pool_number"],
                "status": status,
                "confidence": sub.get("confidence", 0),
                "anomaly_count": len(sub.get("anomalies", [])),
                "error_anomalies": len(error_anomalies),
                "submitted_at": sub.get("submitted_at", ""),
            })
        return pending

    async def enable(self):
        self.enabled = True
        entry = self._log_action("agent_resumed", {"message": "Agent enabled by committee"})
        self._save_state()
        await self._broadcast_action(entry)

    async def disable(self):
        self.enabled = False
        entry = self._log_action("agent_paused", {"message": "Agent paused by committee"})
        self._save_state()
        await self._broadcast_action(entry)

    async def update_config(self, new_config: dict):
        changed = {}
        for key, value in new_config.items():
            if key in self.config and value is not None:
                self.config[key] = value
                changed[key] = value
        if changed:
            entry = self._log_action("config_changed", {"changes": changed})
            self._save_state()
            await self._broadcast_action(entry)
            # Trigger an immediate tick so the agent re-evaluates with new config
            if self.enabled:
                asyncio.create_task(self._tick())

    # ── Background Task ──────────────────────────────────────────

    def start_background(self):
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._tick_loop())
        print("[AGENT] Background task started")

    async def stop_background(self):
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        print("[AGENT] Background task stopped")

    async def _tick_loop(self):
        while True:
            try:
                if self.enabled:
                    await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                entry = self._log_action("tick_error", {"error": str(exc)})
                try:
                    await self._broadcast_action(entry)
                except Exception:
                    pass
            await asyncio.sleep(self.config.get("tick_interval_seconds", 30))

    # ── Tool Execution Handlers ──────────────────────────────────

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """Execute a tool call and return the result as a string."""
        try:
            if tool_name == "get_pending_submissions":
                return json.dumps(self._tool_get_pending())
            elif tool_name == "get_pool_anomalies":
                return json.dumps(self._tool_get_anomalies(tool_input["pool_id"]))
            elif tool_name == "approve_pool":
                return json.dumps(await self._tool_approve_pool(tool_input["pool_id"]))
            elif tool_name == "flag_pool":
                return json.dumps(await self._tool_flag_pool(tool_input["pool_id"], tool_input["reason"]))
            elif tool_name == "check_tournament_pace":
                return json.dumps(self._tool_check_pace())
            elif tool_name == "ping_referee":
                return json.dumps(await self._tool_ping_referee(tool_input["referee_id"], tool_input["message"]))
            elif tool_name == "generate_announcement":
                return json.dumps(await self._tool_generate_announcement(tool_input["text"]))
            elif tool_name == "stop_event":
                return json.dumps(await self._tool_stop_event(tool_input["event"]))
            elif tool_name == "create_de_bracket":
                return json.dumps(await self._tool_create_de_bracket(tool_input["event"]))
            elif tool_name == "assign_de_referees":
                return json.dumps(await self._tool_assign_de_referees(tool_input["event"]))
            else:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def _tool_get_pending(self) -> list[dict]:
        return self.get_pending_queue()

    def _tool_get_anomalies(self, pool_id: int) -> dict:
        from data_loader import get_submission, get_pool_by_id
        pool = get_pool_by_id(pool_id)
        if not pool:
            return {"error": f"Pool {pool_id} not found"}
        sub = get_submission(pool_id)
        if not sub:
            return {"error": f"No submission for pool {pool_id}"}
        return {
            "pool_id": pool_id,
            "event": pool["event"],
            "pool_number": pool["pool_number"],
            "confidence": sub.get("confidence", 0),
            "anomalies": sub.get("anomalies", []),
            "status": sub.get("status", ""),
        }

    async def _tool_approve_pool(self, pool_id: int) -> dict:
        from data_loader import get_submission, get_pool_by_id, save_submission, write_scores_csv
        from ocr_service import validate_scores, compute_results

        pool = get_pool_by_id(pool_id)
        if not pool:
            return {"error": f"Pool {pool_id} not found"}

        sub = get_submission(pool_id)
        if not sub or sub.get("status") != "pending_review":
            return {"error": f"Pool {pool_id} is not pending review (status: {sub.get('status', 'none')})"}

        scores = sub.get("scores", [])
        fencers = pool.get("fencers", [])

        # Re-validate
        anomalies = validate_scores(scores, fencers)
        errors = [a for a in anomalies if a.get("level") == "error"]
        if errors:
            return {"error": f"Cannot approve: {len(errors)} error anomalies found", "anomalies": errors}

        # Compute results and approve
        results = compute_results(scores, fencers)
        sub["anomalies"] = anomalies
        sub["status"] = "approved"
        sub["reviewed_at"] = datetime.now().isoformat()
        sub["reviewed_by"] = "AI Tournament Agent (Opus 4.6)"
        sub["results"] = results

        save_submission(pool_id, sub)
        write_scores_csv()

        entry = self._log_action("auto_approve", {
            "pool_id": pool_id,
            "event": pool["event"],
            "pool_number": pool["pool_number"],
            "confidence": sub.get("confidence", 0),
            "message": f"Pool {pool['pool_number']} ({pool['event']}) auto-approved at {sub.get('confidence', 0):.0%} confidence",
        })

        from main import manager
        await manager.broadcast({
            "type": "scores_approved",
            "pool_id": pool_id,
            "status": "approved",
        })
        await self._broadcast_action(entry)

        # Trigger narrator commentary
        from narrator import narrator as narr
        await narr.generate("pool_approved", {
            "event_name": pool["event"],
            "pool_number": pool["pool_number"],
            "results": results,
            "fencers": pool.get("fencers", []),
        })

        return {"success": True, "pool_id": pool_id, "message": f"Pool {pool['pool_number']} approved"}

    async def _tool_flag_pool(self, pool_id: int, reason: str) -> dict:
        from data_loader import get_pool_by_id

        pool = get_pool_by_id(pool_id)
        if not pool:
            return {"error": f"Pool {pool_id} not found"}

        # Track the flag
        event_name = pool["event"]
        if event_name not in self.tracked_events:
            self.tracked_events[event_name] = {
                "initial_ping_sent": False,
                "initial_ping_at": None,
                "flagged_pool_ids": [],
                "referee_pings": {},
            }
        if pool_id not in self.tracked_events[event_name]["flagged_pool_ids"]:
            self.tracked_events[event_name]["flagged_pool_ids"].append(pool_id)

        entry = self._log_action("flag_for_review", {
            "pool_id": pool_id,
            "event": event_name,
            "pool_number": pool["pool_number"],
            "reason": reason,
        })
        await self._broadcast_action(entry)
        self._save_state()
        return {"success": True, "pool_id": pool_id, "message": f"Pool {pool['pool_number']} flagged: {reason}"}

    def _tool_check_pace(self) -> dict:
        from data_loader import get_events, get_event_status, get_pools, get_submission, get_referees

        events = get_events()
        pace = {"events": [], "overall": {}}
        total_pools = 0
        total_approved = 0
        total_pending = 0

        for ev in events:
            event_name = ev["name"]
            status = get_event_status(event_name)
            event_pools = get_pools(event=event_name)
            approved = sum(1 for p in event_pools if (s := get_submission(p["id"])) and s.get("status") == "approved")
            pending = sum(1 for p in event_pools if (s := get_submission(p["id"])) and s.get("status") == "pending_review")
            no_submission = sum(1 for p in event_pools if not get_submission(p["id"]))

            total_pools += len(event_pools)
            total_approved += approved
            total_pending += pending

            # Check referee status
            referees = get_referees(event=event_name)
            ref_status = []
            for ref in referees:
                ref_pools = [p for p in event_pools if
                             f"{p['referee']['first_name'].lower()} {p['referee']['last_name'].lower()}" ==
                             f"{ref['first_name'].lower()} {ref['last_name'].lower()}"]
                submitted = sum(1 for p in ref_pools if get_submission(p["id"]))
                if ref_pools and submitted < len(ref_pools):
                    tracked = self.tracked_events.get(event_name, {})
                    ping_info = tracked.get("referee_pings", {}).get(str(ref["id"]), {})
                    ref_status.append({
                        "referee_id": ref["id"],
                        "name": f"{ref['first_name']} {ref['last_name']}",
                        "pools_assigned": len(ref_pools),
                        "pools_submitted": submitted,
                        "ping_count": ping_info.get("ping_count", 0),
                        "last_ping": ping_info.get("last_ping_at"),
                    })

            pace["events"].append({
                "event": event_name,
                "status": status,
                "total_pools": len(event_pools),
                "approved": approved,
                "pending_review": pending,
                "no_submission": no_submission,
                "laggard_referees": ref_status,
            })

        pace["overall"] = {
            "total_pools": total_pools,
            "approved": total_approved,
            "pending_review": total_pending,
            "timestamp": datetime.now().isoformat(),
        }
        return pace

    async def _tool_ping_referee(self, referee_id: int, message: str) -> dict:
        from data_loader import get_referees
        from telegram_service import send_telegram
        from telegram_bot import get_chat_id

        chat_id = get_chat_id(referee_id)
        if not chat_id:
            return {"error": f"Referee {referee_id} has no Telegram chat ID registered"}

        # Check ping limits
        for event_name, tracked in self.tracked_events.items():
            ping_info = tracked.get("referee_pings", {}).get(str(referee_id), {})
            if ping_info.get("ping_count", 0) >= self.config["max_pings"]:
                return {"error": f"Referee {referee_id} already pinged {self.config['max_pings']} times (max reached)"}
            last_ping = ping_info.get("last_ping_at")
            if last_ping:
                last_ping_dt = datetime.fromisoformat(last_ping)
                interval = timedelta(minutes=self.config["ping_interval_minutes"])
                if datetime.now() - last_ping_dt < interval:
                    mins_left = int((interval - (datetime.now() - last_ping_dt)).total_seconds() / 60)
                    return {"error": f"Too soon to ping again. Wait {mins_left} more minutes."}

        send_telegram(chat_id, f"[FenceFlow] {message}")

        # Update tracking
        for event_name, tracked in self.tracked_events.items():
            if "referee_pings" not in tracked:
                tracked["referee_pings"] = {}
            ref_id_str = str(referee_id)
            ping_info = tracked.get("referee_pings", {}).get(ref_id_str, {"ping_count": 0})
            tracked["referee_pings"][ref_id_str] = {
                "ping_count": ping_info.get("ping_count", 0) + 1,
                "last_ping_at": datetime.now().isoformat(),
            }

        # Find referee name for logging
        ref_name = f"Referee #{referee_id}"
        for event_name in self.tracked_events:
            refs = get_referees(event=event_name)
            for ref in refs:
                if ref["id"] == referee_id:
                    ref_name = f"{ref['first_name']} {ref['last_name']}"
                    break

        entry = self._log_action("ping_referee", {
            "referee_id": referee_id,
            "referee_name": ref_name,
            "message": f"AI pinged {ref_name}: {message}",
        })
        await self._broadcast_action(entry)
        self._save_state()
        return {"success": True, "message": f"Pinged {ref_name}"}

    async def _tool_generate_announcement(self, text: str) -> dict:
        from announcer import announcer as ann
        entry = await ann.polish_custom(text)
        log_entry = self._log_action("generate_announcement", {
            "message": f"AI generated announcement: {text[:80]}",
        })
        await self._broadcast_action(log_entry)
        return {"success": True, "announcement_id": entry.get("id", "")}

    async def _tool_stop_event(self, event_name: str) -> dict:
        from data_loader import get_event_status, set_event_status, get_pools, get_submission

        status = get_event_status(event_name)
        if status != "started":
            return {"error": f"Event '{event_name}' is not running (status: {status})"}

        # Verify all pools are approved
        event_pools = get_pools(event=event_name)
        for pool in event_pools:
            sub = get_submission(pool["id"])
            if not sub or sub.get("status") != "approved":
                return {"error": f"Cannot stop: Pool {pool['pool_number']} is not approved yet"}

        set_event_status(event_name, "stopped")
        entry = self._log_action("auto_stop", {
            "event": event_name,
            "message": f"All {len(event_pools)} pools approved — event auto-stopped by AI",
        })
        from main import manager
        await manager.broadcast({"type": "event_stopped", "event": event_name})
        await self._broadcast_action(entry)
        self._save_state()

        # Trigger announcements
        from announcer import announcer as ann
        await ann.generate("all_pools_complete", {"event_name": event_name, "pool_count": len(event_pools)})

        from narrator import narrator as narr
        await narr.generate("all_pools_complete", {"event_name": event_name, "pool_count": len(event_pools)})

        return {"success": True, "message": f"Event '{event_name}' stopped"}

    async def _tool_create_de_bracket(self, event_name: str) -> dict:
        from de_bracket import de_service
        from data_loader import get_event_status

        status = get_event_status(event_name)
        if status != "stopped":
            return {"error": f"Event '{event_name}' is not stopped (status: {status}). Stop event first."}

        if event_name in de_service.brackets:
            return {"error": f"DE bracket already exists for '{event_name}'"}

        try:
            bracket = de_service.create_bracket(event_name)
        except ValueError as exc:
            return {"error": str(exc)}

        entry = self._log_action("create_de_bracket", {
            "event": event_name,
            "fencer_count": bracket["fencer_count"],
            "bracket_size": bracket["bracket_size"],
            "round_count": len(bracket["rounds"]),
            "message": f"DE bracket created for {event_name} — {bracket['fencer_count']} fencers, Table of {bracket['bracket_size']}",
        })

        from main import manager
        await manager.broadcast({"type": "de_bracket_created", "event": event_name})
        await self._broadcast_action(entry)

        # Trigger announcement
        from announcer import announcer as ann
        await ann.polish_custom(
            f"Direct elimination bracket created for {event_name}. "
            f"{bracket['fencer_count']} fencers seeded into a Table of {bracket['bracket_size']}. "
            f"First-round bouts will begin shortly."
        )

        return {
            "success": True,
            "fencer_count": bracket["fencer_count"],
            "bracket_size": bracket["bracket_size"],
            "round_count": len(bracket["rounds"]),
            "message": f"DE bracket created for {event_name}",
        }

    async def _tool_assign_de_referees(self, event_name: str) -> dict:
        from de_bracket import de_service
        from data_loader import get_referees, get_referee_by_id
        from telegram_service import send_telegram
        from telegram_bot import get_chat_id

        bracket = de_service.brackets.get(event_name)
        if not bracket:
            return {"error": f"No DE bracket for '{event_name}'"}

        if not bracket.get("rounds"):
            return {"error": "Bracket has no rounds"}

        # Get first-round pending bouts (skip byes)
        first_round = bracket["rounds"][0]
        pending_bouts = [b for b in first_round["bouts"]
                         if b["status"] == "pending" and b["top_fencer"] and b["bottom_fencer"]]

        if not pending_bouts:
            return {"error": "No pending first-round bouts to assign"}

        # Get available referees for this event
        referees = get_referees(event=event_name)
        if not referees:
            return {"error": f"No referees found for event '{event_name}'"}

        # Round-robin assign referees
        assigned_count = 0
        referees_pinged = set()
        strips = [f"S{i+1}" for i in range(len(pending_bouts))]

        for i, bout in enumerate(pending_bouts):
            ref = referees[i % len(referees)]
            ref_id = ref["id"]
            strip = strips[i] if i < len(strips) else None

            try:
                de_service.assign_referee(event_name, bout["bout_id"], ref_id, strip)
                assigned_count += 1
            except ValueError:
                continue

            # Ping referee via Telegram
            chat_id = get_chat_id(ref_id)
            if chat_id:
                top = bout["top_fencer"]
                bottom = bout["bottom_fencer"]
                token = ref.get("token", "")
                link_line = f"Report result: {BASE_URL}/referee/{token}" if token else "Please report to your strip."
                msg = (
                    f"[FenceFlow] DE Assignment: {event_name}\n"
                    f"Bout: {top['first_name']} {top['last_name']} (#{top.get('seed','')}) "
                    f"vs {bottom['first_name']} {bottom['last_name']} (#{bottom.get('seed','')})\n"
                    f"Strip: {strip or 'TBD'}\n"
                    f"{link_line}"
                )
                send_telegram(chat_id, msg)
                referees_pinged.add(ref_id)

        entry = self._log_action("assign_de_referees", {
            "event": event_name,
            "assigned": assigned_count,
            "referees_pinged": len(referees_pinged),
            "message": f"Assigned {assigned_count} DE bouts to referees, pinged {len(referees_pinged)} referees",
        })

        from main import manager
        await manager.broadcast({"type": "de_referees_assigned", "event": event_name})
        await self._broadcast_action(entry)

        return {
            "success": True,
            "assigned": assigned_count,
            "referees_pinged": len(referees_pinged),
            "message": f"Assigned {assigned_count} first-round bouts, pinged {len(referees_pinged)} referees",
        }

    # ── Core AI Tick (Opus 4.6 with Tool Use) ────────────────────

    async def _tick(self):
        from data_loader import get_events, get_event_status, get_pools, get_referees

        # Check if any events are running
        events = get_events()
        running_events = [ev for ev in events if get_event_status(ev["name"]) == "started"]
        if not running_events:
            return

        # Ensure tracking entries exist and handle initial pings
        sent_initial_pings = False
        for ev in running_events:
            event_name = ev["name"]
            if event_name not in self.tracked_events:
                self.tracked_events[event_name] = {
                    "initial_ping_sent": False,
                    "initial_ping_at": None,
                    "flagged_pool_ids": [],
                    "referee_pings": {},
                }

            tracked = self.tracked_events[event_name]
            if not tracked["initial_ping_sent"]:
                await self._do_initial_ping(event_name)
                tracked["initial_ping_sent"] = True
                tracked["initial_ping_at"] = datetime.now().isoformat()
                self._save_state()
                sent_initial_pings = True

        # Don't process in the same tick as initial pings —
        # gives referees time to see the upload interface before
        # the agent can approve/stop/create DE in this cycle.
        if sent_initial_pings:
            return

        # Build current state summary for the AI
        current_state = self._build_state_summary(running_events)

        # If no API key, fall back to deterministic logic
        if not ANTHROPIC_API_KEY:
            await self._tick_deterministic()
            return

        # Call Opus 4.6 with tools
        try:
            await self._ai_tick(current_state)
        except Exception as exc:
            print(f"[AGENT] AI tick failed, falling back to deterministic: {exc}")
            await self._tick_deterministic()

    def _build_state_summary(self, running_events: list) -> str:
        from data_loader import get_pools, get_submission

        lines = [f"Time: {datetime.now().strftime('%H:%M:%S')}"]
        lines.append(f"Running events: {', '.join(ev['name'] for ev in running_events)}")

        pending_count = 0
        for ev in running_events:
            event_pools = get_pools(event=ev["name"])
            approved = sum(1 for p in event_pools if (s := get_submission(p["id"])) and s.get("status") == "approved")
            pending = sum(1 for p in event_pools if (s := get_submission(p["id"])) and s.get("status") == "pending_review")
            no_sub = len(event_pools) - approved - pending
            pending_count += pending
            lines.append(f"  {ev['name']}: {approved}/{len(event_pools)} approved, {pending} pending review, {no_sub} awaiting upload")

        # Recent actions (last 5)
        recent = self.action_log[-5:] if self.action_log else []
        if recent:
            lines.append("\nRecent actions:")
            for a in recent:
                lines.append(f"  [{a.get('action')}] {a.get('message', '')}")

        if pending_count == 0:
            lines.append("\nNo pools pending review — check if events can be stopped.")

        return "\n".join(lines)

    async def _ai_tick(self, current_state: str):
        """Run Claude Opus 4.6 with tool use in an agentic loop."""
        import httpx

        system_prompt = AGENT_SYSTEM_PROMPT.format(
            tick_interval=self.config["tick_interval_seconds"],
            confidence_threshold=self.config["confidence_threshold"],
            max_pings=self.config["max_pings"],
            ping_interval=self.config["ping_interval_minutes"],
            current_state=current_state,
        )

        messages = [
            {
                "role": "user",
                "content": "Check the tournament state and take any needed actions. If there's nothing to do, just say so briefly.",
            }
        ]

        max_iterations = 10  # Safety limit for tool use loop
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": OPUS_MODEL,
                        "max_tokens": 1024,
                        "system": [
                            {
                                "type": "text",
                                "text": system_prompt,
                                "cache_control": {"type": "ephemeral"},
                            }
                        ],
                        "tools": AGENT_TOOLS,
                        "messages": messages,
                    },
                    timeout=60.0,
                )

            if resp.status_code != 200:
                print(f"[AGENT] Opus 4.6 returned status {resp.status_code}: {resp.text[:200]}")
                return

            data = resp.json()
            stop_reason = data.get("stop_reason", "")
            content = data.get("content", [])

            # Log any text reasoning from Claude
            for block in content:
                if block.get("type") == "text" and block.get("text", "").strip():
                    reasoning = block["text"].strip()
                    entry = self._log_action("ai_reasoning", {
                        "message": reasoning[:200],
                        "reasoning": reasoning,
                    })
                    await self._broadcast_action(entry)

            # If no tool use, we're done
            if stop_reason != "tool_use":
                break

            # Execute tool calls
            tool_results = []
            for block in content:
                if block.get("type") == "tool_use":
                    tool_name = block["name"]
                    tool_input = block.get("input", {})
                    tool_id = block["id"]

                    print(f"[AGENT] Executing tool: {tool_name}({json.dumps(tool_input)[:100]})")
                    result = await self._execute_tool(tool_name, tool_input)

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result,
                    })

            # Add assistant response and tool results to conversation
            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": tool_results})

        if iteration >= max_iterations:
            print(f"[AGENT] Hit max iterations ({max_iterations})")

    # ── Fallback Deterministic Logic ─────────────────────────────

    async def _tick_deterministic(self):
        """Original deterministic tick logic as fallback when AI is unavailable."""
        from data_loader import get_events, get_event_status, get_pools, get_submission

        events = get_events()
        for ev in events:
            event_name = ev["name"]
            status = get_event_status(event_name)
            if status != "started":
                continue

            if event_name not in self.tracked_events:
                self.tracked_events[event_name] = {
                    "initial_ping_sent": False,
                    "initial_ping_at": None,
                    "flagged_pool_ids": [],
                    "referee_pings": {},
                }

            tracked = self.tracked_events[event_name]

            # Auto-approve submissions
            event_pools = get_pools(event=event_name)
            for pool in event_pools:
                sub = get_submission(pool["id"])
                if not sub or sub.get("status") != "pending_review":
                    continue
                if pool["id"] in tracked["flagged_pool_ids"]:
                    continue

                confidence = sub.get("confidence", 0)
                anomalies = sub.get("anomalies", [])
                error_anomalies = [a for a in anomalies if a.get("level") == "error"]

                if confidence >= self.config["confidence_threshold"] and len(error_anomalies) == 0:
                    await self._tool_approve_pool(pool["id"])
                else:
                    reason = []
                    if confidence < self.config["confidence_threshold"]:
                        reason.append(f"confidence {confidence:.0%} < {self.config['confidence_threshold']:.0%}")
                    if error_anomalies:
                        reason.append(f"{len(error_anomalies)} error anomalies")
                    await self._tool_flag_pool(pool["id"], ", ".join(reason))

            # Re-ping referees
            await self._reping_referees_deterministic(event_name, event_pools, tracked)

            # Event completion check
            all_approved = all(
                (s := get_submission(p["id"])) and s.get("status") == "approved"
                for p in event_pools
            ) if event_pools else False

            if all_approved and len(event_pools) > 0:
                await self._tool_stop_event(event_name)

    async def _reping_referees_deterministic(self, event_name: str, event_pools: list, tracked: dict):
        from data_loader import get_referees, get_submission
        from telegram_service import send_telegram
        from telegram_bot import get_chat_id

        now = datetime.now()
        interval = timedelta(minutes=self.config["ping_interval_minutes"])
        max_pings = self.config["max_pings"]

        referees = get_referees(event=event_name)
        referee_unsubmitted: dict[int, list[dict]] = {}

        for pool in event_pools:
            sub = get_submission(pool["id"])
            if sub and sub.get("status") in ("approved", "pending_review"):
                continue
            ref_name_key = f"{pool['referee']['first_name'].lower()} {pool['referee']['last_name'].lower()}"
            for ref in referees:
                ref_key = f"{ref['first_name'].lower()} {ref['last_name'].lower()}"
                if ref_key == ref_name_key:
                    if ref["id"] not in referee_unsubmitted:
                        referee_unsubmitted[ref["id"]] = []
                    referee_unsubmitted[ref["id"]].append(pool)
                    break

        for ref_id, pools in referee_unsubmitted.items():
            ref_id_str = str(ref_id)
            ping_info = tracked.get("referee_pings", {}).get(ref_id_str, {
                "ping_count": 0,
                "last_ping_at": None,
            })

            if ping_info["ping_count"] >= max_pings:
                continue

            last_ping = ping_info.get("last_ping_at")
            if last_ping:
                last_ping_dt = datetime.fromisoformat(last_ping)
                if now - last_ping_dt < interval:
                    continue

            chat_id = get_chat_id(ref_id)
            if not chat_id:
                continue

            ref = None
            for r in referees:
                if r["id"] == ref_id:
                    ref = r
                    break
            if not ref:
                continue

            first_name = ref.get("first_name", "")
            token = ref.get("token", "")
            pool_nums = ", ".join(str(p["pool_number"]) for p in pools)
            msg = (
                f"[FenceFlow] Reminder: {first_name}, please upload your pool sheet(s) "
                f"for pool(s) {pool_nums} ({event_name}). "
                f"Link: {BASE_URL}/referee/{token}"
            )
            send_telegram(chat_id, msg)

            if "referee_pings" not in tracked:
                tracked["referee_pings"] = {}
            tracked["referee_pings"][ref_id_str] = {
                "ping_count": ping_info["ping_count"] + 1,
                "last_ping_at": now.isoformat(),
            }

            entry = self._log_action("ping_referee", {
                "event": event_name,
                "referee_id": ref_id,
                "referee_name": f"{ref.get('first_name', '')} {ref.get('last_name', '')}",
                "ping_count": ping_info["ping_count"] + 1,
                "pools": pool_nums,
                "message": f"Re-pinged {first_name} (ping #{ping_info['ping_count'] + 1}) for pool(s) {pool_nums}",
            })
            await self._broadcast_action(entry)
            self._save_state()

    async def _do_initial_ping(self, event_name: str):
        from data_loader import get_referees, get_pools, get_submission
        from telegram_service import send_telegram
        from telegram_bot import get_chat_id

        referees = get_referees(event=event_name)
        event_pools = get_pools(event=event_name)

        # Build map: referee_id → list of unsubmitted pools (same pattern as _reping_referees_deterministic)
        referee_unsubmitted: dict[int, list[dict]] = {}
        for pool in event_pools:
            sub = get_submission(pool["id"])
            if sub and sub.get("status") in ("approved", "pending_review"):
                continue
            ref_name_key = f"{pool['referee']['first_name'].lower()} {pool['referee']['last_name'].lower()}"
            for ref in referees:
                ref_key = f"{ref['first_name'].lower()} {ref['last_name'].lower()}"
                if ref_key == ref_name_key:
                    if ref["id"] not in referee_unsubmitted:
                        referee_unsubmitted[ref["id"]] = []
                    referee_unsubmitted[ref["id"]].append(pool)
                    break

        sent = 0
        skipped = 0

        for ref in referees:
            if ref["id"] not in referee_unsubmitted:
                continue
            chat_id = get_chat_id(ref["id"])
            if not chat_id:
                skipped += 1
                continue
            first_name = ref.get("first_name", "")
            token = ref.get("token", "")
            pool_nums = ", ".join(str(p["pool_number"]) for p in referee_unsubmitted[ref["id"]])
            body = (
                f"[FenceFlow] {first_name}, your pool(s) {pool_nums} for {event_name} are ready. "
                f"View & upload: {BASE_URL}/referee/{token}"
            )
            send_telegram(chat_id, body)
            sent += 1

        entry = self._log_action("initial_ping", {
            "event": event_name,
            "sent": sent,
            "skipped": skipped,
            "message": f"Pinged {sent} referees with unsubmitted pools for {event_name} ({skipped} not registered)",
        })
        await self._broadcast_action(entry)


# Module-level singleton
agent = TournamentAgent()
