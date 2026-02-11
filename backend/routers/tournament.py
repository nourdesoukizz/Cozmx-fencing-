from fastapi import APIRouter, HTTPException
from data_loader import (
    get_tournament, get_events, get_event_status, set_event_status, get_referees,
)
from sms_service import send_sms
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

    return {"status": "ok", "event": event_name, "event_status": "started"}


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

    for ref in referees:
        phone = ref.get("phone", "").strip()
        token = ref.get("token", "")
        first_name = ref.get("first_name", "")

        if not phone:
            details.append({
                "referee": f"{first_name} {ref.get('last_name', '')}",
                "status": "skipped_no_phone",
            })
            continue

        body = (
            f"[FenceFlow] {first_name}, your pools for {event_name} are ready. "
            f"View & upload: {BASE_URL}/referee/{token}"
        )
        result = send_sms(phone, body)
        details.append({
            "referee": f"{first_name} {ref.get('last_name', '')}",
            **result,
        })
        if result["status"] == "sent" or result["status"] == "logged":
            sent_count += 1
        else:
            failed_count += 1

    return {
        "status": "ok",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "details": details,
    }
