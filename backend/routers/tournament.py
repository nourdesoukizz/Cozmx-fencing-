from fastapi import APIRouter, HTTPException
from data_loader import (
    get_tournament, get_events, get_event_status, set_event_status, get_referees,
)
from telegram_service import send_telegram
from telegram_bot import get_chat_id
from config import BASE_URL

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
