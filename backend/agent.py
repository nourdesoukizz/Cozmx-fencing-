"""
Tournament Agent — autonomous background task that handles:
  1. Initial pings to referees when events start
  2. Auto-approving high-confidence, clean submissions
  3. Re-pinging laggard referees on a schedule
  4. Auto-stopping events when all pools are approved
"""

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path

from config import DATA_DIR, BASE_URL

STATE_PATH = DATA_DIR / "agent_state.json"
MAX_LOG_ENTRIES = 500

DEFAULT_CONFIG = {
    "confidence_threshold": 0.90,
    "ping_interval_minutes": 15,
    "max_pings": 3,
    "tick_interval_seconds": 30,
}


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
        # Cap at MAX_LOG_ENTRIES
        if len(self.action_log) > MAX_LOG_ENTRIES:
            self.action_log = self.action_log[-MAX_LOG_ENTRIES:]
        self._save_state()
        print(f"[AGENT] {action}: {details}")
        return entry

    async def _broadcast_action(self, entry: dict):
        from main import manager
        await manager.broadcast({"type": "agent_action", "entry": entry})

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
        # Newest first
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

    # ── Core Tick Logic ──────────────────────────────────────────

    async def _tick(self):
        from data_loader import get_events, get_event_status, get_pools, get_submission, get_referees

        events = get_events()
        for ev in events:
            event_name = ev["name"]
            status = get_event_status(event_name)
            if status != "started":
                continue

            # Ensure tracking entry exists
            if event_name not in self.tracked_events:
                self.tracked_events[event_name] = {
                    "initial_ping_sent": False,
                    "initial_ping_at": None,
                    "flagged_pool_ids": [],
                    "referee_pings": {},
                }

            tracked = self.tracked_events[event_name]

            # Step 1: Initial ping
            if not tracked["initial_ping_sent"]:
                await self._do_initial_ping(event_name)
                tracked["initial_ping_sent"] = True
                tracked["initial_ping_at"] = datetime.now().isoformat()
                self._save_state()

            # Step 2: Auto-approve submissions
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
                    await self._try_auto_approve(pool, sub, tracked)
                else:
                    reason = []
                    if confidence < self.config["confidence_threshold"]:
                        reason.append(f"confidence {confidence:.0%} < {self.config['confidence_threshold']:.0%}")
                    if error_anomalies:
                        reason.append(f"{len(error_anomalies)} error anomalies")
                    tracked["flagged_pool_ids"].append(pool["id"])
                    entry = self._log_action("flag_for_review", {
                        "pool_id": pool["id"],
                        "event": event_name,
                        "pool_number": pool["pool_number"],
                        "reason": ", ".join(reason),
                    })
                    await self._broadcast_action(entry)
                    self._save_state()

            # Step 3: Re-ping referees with unsubmitted pools
            await self._reping_referees(event_name, event_pools, tracked)

            # Step 4: Event completion check
            all_approved = True
            for pool in event_pools:
                sub = get_submission(pool["id"])
                if not sub or sub.get("status") != "approved":
                    all_approved = False
                    break

            if all_approved and len(event_pools) > 0:
                from data_loader import set_event_status
                set_event_status(event_name, "stopped")
                entry = self._log_action("auto_stop", {
                    "event": event_name,
                    "message": f"All {len(event_pools)} pools approved — event auto-stopped",
                })
                from main import manager
                await manager.broadcast({"type": "event_stopped", "event": event_name})
                await self._broadcast_action(entry)
                self._save_state()

                # Trigger PA announcement
                from announcer import announcer as ann
                await ann.generate("all_pools_complete", {"event_name": event_name, "pool_count": len(event_pools)})

    async def _do_initial_ping(self, event_name: str):
        from data_loader import get_referees
        from telegram_service import send_telegram
        from telegram_bot import get_chat_id

        referees = get_referees(event=event_name)
        sent = 0
        skipped = 0

        for ref in referees:
            chat_id = get_chat_id(ref["id"])
            if not chat_id:
                skipped += 1
                continue
            first_name = ref.get("first_name", "")
            token = ref.get("token", "")
            body = (
                f"[FenceFlow] {first_name}, your pools for {event_name} are ready. "
                f"View & upload: {BASE_URL}/referee/{token}"
            )
            send_telegram(chat_id, body)
            sent += 1

        entry = self._log_action("initial_ping", {
            "event": event_name,
            "sent": sent,
            "skipped": skipped,
            "message": f"Pinged {sent} referees for {event_name} ({skipped} not registered)",
        })
        await self._broadcast_action(entry)

    async def _try_auto_approve(self, pool: dict, sub: dict, tracked: dict):
        from data_loader import get_submission, save_submission, write_scores_csv
        from ocr_service import validate_scores, compute_results

        pool_id = pool["id"]

        # Re-fetch to handle race condition
        fresh_sub = get_submission(pool_id)
        if not fresh_sub or fresh_sub.get("status") != "pending_review":
            return

        scores = fresh_sub.get("scores", [])
        fencers = pool.get("fencers", [])

        # Re-validate as safety check
        anomalies = validate_scores(scores, fencers)
        errors = [a for a in anomalies if a.get("level") == "error"]

        if errors:
            tracked["flagged_pool_ids"].append(pool_id)
            entry = self._log_action("flag_for_review", {
                "pool_id": pool_id,
                "event": pool["event"],
                "pool_number": pool["pool_number"],
                "reason": f"Re-validation found {len(errors)} errors",
            })
            await self._broadcast_action(entry)
            self._save_state()
            return

        # Compute results and approve
        results = compute_results(scores, fencers)

        fresh_sub["anomalies"] = anomalies
        fresh_sub["status"] = "approved"
        fresh_sub["reviewed_at"] = datetime.now().isoformat()
        fresh_sub["reviewed_by"] = "Tournament Agent"
        fresh_sub["results"] = results

        save_submission(pool_id, fresh_sub)
        write_scores_csv()

        entry = self._log_action("auto_approve", {
            "pool_id": pool_id,
            "event": pool["event"],
            "pool_number": pool["pool_number"],
            "confidence": fresh_sub.get("confidence", 0),
            "message": f"Pool {pool['pool_number']} ({pool['event']}) auto-approved at {fresh_sub.get('confidence', 0):.0%} confidence",
        })

        from main import manager
        await manager.broadcast({
            "type": "scores_approved",
            "pool_id": pool_id,
            "status": "approved",
        })
        await self._broadcast_action(entry)
        self._save_state()

        # Trigger PA announcement
        from announcer import announcer as ann
        await ann.generate("pool_approved", {"event_name": pool["event"], "pool_number": pool["pool_number"]})

    async def _reping_referees(self, event_name: str, event_pools: list[dict], tracked: dict):
        from data_loader import get_referees, get_submission
        from telegram_service import send_telegram
        from telegram_bot import get_chat_id

        now = datetime.now()
        interval = timedelta(minutes=self.config["ping_interval_minutes"])
        max_pings = self.config["max_pings"]

        # Build a map of referee_name -> list of unsubmitted pool_ids
        referees = get_referees(event=event_name)
        referee_unsubmitted: dict[int, list[dict]] = {}

        for pool in event_pools:
            sub = get_submission(pool["id"])
            if sub and sub.get("status") in ("approved", "pending_review"):
                continue
            # Pool has no submission or ocr_failed — find its referee
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

            # Find referee details
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

            # Update tracking
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


# Module-level singleton
agent = TournamentAgent()
