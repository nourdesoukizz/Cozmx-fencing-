from fastapi import APIRouter, HTTPException
from data_loader import (
    get_tournament, get_events, get_event_status, set_event_status, get_referees,
    clear_submission, write_scores_csv, get_pools, get_all_fencers, get_all_pools,
    get_all_submissions_dict,
)
from telegram_service import send_telegram
from telegram_bot import get_chat_id
from config import BASE_URL, DATA_DIR

router = APIRouter(prefix="/api/tournament", tags=["tournament"])


@router.get("/status")
def tournament_status():
    return get_tournament()


@router.get("/events")
def tournament_events():
    return get_events()


@router.post("/events/{event_name}/start")
async def start_event(event_name: str):
    # Validate event exists
    events = get_events()
    event_names = [ev["name"] for ev in events]
    if event_name not in event_names:
        raise HTTPException(status_code=404, detail=f"Event '{event_name}' not found")

    # Check not already started
    current_status = get_event_status(event_name)
    if current_status == "started":
        raise HTTPException(status_code=400, detail=f"Event '{event_name}' is already started")

    set_event_status(event_name, "started")

    # Broadcast via WebSocket
    from main import manager
    await manager.broadcast({
        "type": "event_started",
        "event": event_name,
    })

    # Trigger PA announcement
    from announcer import announcer
    await announcer.generate("event_started", {"event_name": event_name})

    # Trigger narrator commentary
    from narrator import narrator
    await narrator.generate("event_started", {"event_name": event_name})

    return {"status": "ok", "event": event_name, "event_status": "started"}


@router.post("/events/{event_name}/stop")
async def stop_event(event_name: str):
    # Validate event exists
    events = get_events()
    event_names = [ev["name"] for ev in events]
    if event_name not in event_names:
        raise HTTPException(status_code=404, detail=f"Event '{event_name}' not found")

    # Check event is currently started
    current_status = get_event_status(event_name)
    if current_status != "started":
        raise HTTPException(status_code=400, detail=f"Event '{event_name}' is not currently started")

    set_event_status(event_name, "stopped")

    # Broadcast via WebSocket
    from main import manager
    await manager.broadcast({
        "type": "event_stopped",
        "event": event_name,
    })

    # Trigger PA announcement
    from announcer import announcer
    await announcer.generate("event_stopped", {"event_name": event_name})

    # Trigger narrator commentary
    from narrator import narrator
    await narrator.generate("event_stopped", {"event_name": event_name})

    return {"status": "ok", "event": event_name, "event_status": "stopped"}


@router.post("/events/{event_name}/ping-referees")
async def ping_referees(event_name: str):
    # Validate event exists
    events = get_events()
    event_names = [ev["name"] for ev in events]
    if event_name not in event_names:
        raise HTTPException(status_code=404, detail=f"Event '{event_name}' not found")

    # Validate event is started
    current_status = get_event_status(event_name)
    if current_status != "started":
        raise HTTPException(
            status_code=400,
            detail=f"Event '{event_name}' has not been started yet. Start the event first.",
        )

    # Get referees for this event
    referees = get_referees(event=event_name)

    details = []
    sent_count = 0
    failed_count = 0
    skipped_count = 0

    for ref in referees:
        first_name = ref.get("first_name", "")
        token = ref.get("token", "")
        referee_name = f"{first_name} {ref.get('last_name', '')}"

        chat_id = get_chat_id(ref["id"])
        if not chat_id:
            details.append({
                "referee": referee_name,
                "status": "skipped_not_registered",
            })
            skipped_count += 1
            continue

        body = (
            f"[FenceFlow] {first_name}, your pools for {event_name} are ready. "
            f"View & upload: {BASE_URL}/referee/{token}"
        )
        result = send_telegram(chat_id, body)
        details.append({
            "referee": referee_name,
            **result,
        })
        if result["status"] in ("sent", "logged"):
            sent_count += 1
        else:
            failed_count += 1

    return {
        "status": "ok",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "skipped_count": skipped_count,
        "details": details,
    }


@router.post("/demo/reset")
async def demo_reset():
    """Reset demo state: clear Pool 4 submission, delete DE bracket, reset analytics."""
    from de_bracket import de_service
    from bt_engine import BTEngine
    from agent import agent as tournament_agent
    from routers import coach

    event_name = "Cadet Men Saber"
    demo_pool_number = 4

    # 1. Find and clear Pool 4 submission
    event_pools = get_pools(event=event_name)
    pool_4 = None
    for p in event_pools:
        if p["pool_number"] == demo_pool_number:
            pool_4 = p
            break

    if pool_4:
        clear_submission(pool_4["id"])
        write_scores_csv()

    # 2. Delete DE bracket if it exists
    if event_name in de_service.brackets:
        del de_service.brackets[event_name]
        de_service._save()

    # 3. Reset event status to "started"
    set_event_status(event_name, "started")

    # 4. Reinitialize Bradley-Terry engine
    manual_bouts_path = DATA_DIR / "manual_bouts.csv"
    if manual_bouts_path.exists():
        manual_bouts_path.write_text("fencer_a,fencer_b,score_a,score_b,source,timestamp\n")

    engine = BTEngine(DATA_DIR)
    engine.initialize(get_all_fencers(), get_all_pools(), get_all_submissions_dict())
    coach._engine = engine
    coach._insight_cache.clear()
    coach._chat_history.clear()

    # 5. Reset agent tracked state for this event
    if event_name in tournament_agent.tracked_events:
        tracked = tournament_agent.tracked_events[event_name]
        tracked["flagged_pool_ids"] = [
            pid for pid in tracked.get("flagged_pool_ids", [])
            if pool_4 and pid != pool_4["id"]
        ]
        # Reset referee ping tracking for pool 4's referee
        if pool_4:
            ref_name = f"{pool_4['referee']['first_name'].lower()} {pool_4['referee']['last_name'].lower()}"
            referees = get_referees(event=event_name)
            for ref in referees:
                if f"{ref['first_name'].lower()} {ref['last_name'].lower()}" == ref_name:
                    ref_id_str = str(ref["id"])
                    if ref_id_str in tracked.get("referee_pings", {}):
                        tracked["referee_pings"][ref_id_str] = {
                            "ping_count": 0,
                            "last_ping_at": None,
                        }
                    break
    tournament_agent._save_state()

    # 6. Broadcast reset
    from main import manager
    await manager.broadcast({"type": "demo_reset", "event": event_name})

    return {
        "success": True,
        "message": "Demo reset complete. Pool 4 cleared, DE bracket deleted, analytics reinitialized.",
    }
