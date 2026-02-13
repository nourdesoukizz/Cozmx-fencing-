from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from data_loader import get_referees, get_referee_by_id
from telegram_service import send_telegram
from telegram_bot import get_chat_id, is_registered
from config import BASE_URL, TELEGRAM_BOT_USERNAME

router = APIRouter(prefix="/api/referees", tags=["referees"])


class PingRequest(BaseModel):
    message_type: str  # "report_to_captain" | "pool_sheet_reminder" | "custom"
    custom_message: str = ""


class BatchPingRequest(BaseModel):
    referee_ids: list[int]
    message_type: str  # "report_to_captain" | "pool_sheet_reminder" | "custom"
    custom_message: str = ""


@router.get("")
def list_referees(event: str | None = Query(default=None)):
    refs = get_referees(event=event)
    # Attach Telegram registration status to each referee
    for ref in refs:
        ref["telegram_registered"] = is_registered(ref["id"])
    return refs


@router.post("/batch-ping")
def batch_ping_referees(body: BatchPingRequest):
    if not body.referee_ids:
        raise HTTPException(status_code=400, detail="No referee IDs provided")

    if body.message_type == "custom" and not body.custom_message.strip():
        raise HTTPException(status_code=400, detail="Custom message cannot be empty")

    if body.message_type not in ("report_to_captain", "pool_sheet_reminder", "custom"):
        raise HTTPException(status_code=400, detail=f"Unknown message_type: {body.message_type}")

    sent_count = 0
    failed_count = 0
    skipped_count = 0
    details = []

    for rid in body.referee_ids:
        referee = get_referee_by_id(rid)
        if not referee:
            skipped_count += 1
            details.append({"referee_id": rid, "status": "skipped", "reason": "not found"})
            continue

        name = referee.get("first_name", "")
        token = referee.get("token", "")
        chat_id = get_chat_id(rid)

        if not chat_id:
            skipped_count += 1
            details.append({"referee_id": rid, "status": "skipped", "reason": "not registered"})
            continue

        if body.message_type == "report_to_captain":
            msg = f"[FenceFlow] {name}, please report to the Bout Captain immediately."
        elif body.message_type == "pool_sheet_reminder":
            msg = f"[FenceFlow] {name}, please upload your pool score sheet(s). Link: {BASE_URL}/referee/{token}"
        else:
            msg = f"[FenceFlow] {body.custom_message}"

        result = send_telegram(chat_id, msg)
        if result.get("status") == "failed":
            failed_count += 1
            details.append({"referee_id": rid, "status": "failed", "reason": result.get("error", "unknown")})
        else:
            sent_count += 1
            details.append({"referee_id": rid, "status": "sent"})

    return {
        "sent_count": sent_count,
        "failed_count": failed_count,
        "skipped_count": skipped_count,
        "details": details,
    }


@router.get("/{referee_id}")
def referee_detail(referee_id: int):
    referee = get_referee_by_id(referee_id)
    if not referee:
        raise HTTPException(status_code=404, detail="Referee not found")
    referee["telegram_registered"] = is_registered(referee["id"])
    return referee


@router.get("/{referee_id}/telegram-link")
def get_telegram_link(referee_id: int):
    referee = get_referee_by_id(referee_id)
    if not referee:
        raise HTTPException(status_code=404, detail="Referee not found")

    token = referee.get("token", "")
    registered = is_registered(referee_id)
    link = f"https://t.me/{TELEGRAM_BOT_USERNAME}?start={token}" if TELEGRAM_BOT_USERNAME else ""

    return {
        "referee_id": referee_id,
        "telegram_link": link,
        "registered": registered,
    }


@router.post("/{referee_id}/ping")
def ping_referee(referee_id: int, body: PingRequest):
    referee = get_referee_by_id(referee_id)
    if not referee:
        raise HTTPException(status_code=404, detail="Referee not found")

    name = referee.get("first_name", "")
    token = referee.get("token", "")

    chat_id = get_chat_id(referee_id)
    if not chat_id:
        raise HTTPException(
            status_code=400,
            detail=f"{name} has not registered with the Telegram bot yet. Share their registration link first.",
        )

    if body.message_type == "report_to_captain":
        msg = f"[FenceFlow] {name}, please report to the Bout Captain immediately."
    elif body.message_type == "pool_sheet_reminder":
        msg = f"[FenceFlow] {name}, please upload your pool score sheet(s). Link: {BASE_URL}/referee/{token}"
    elif body.message_type == "custom":
        if not body.custom_message.strip():
            raise HTTPException(status_code=400, detail="Custom message cannot be empty")
        msg = f"[FenceFlow] {body.custom_message}"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown message_type: {body.message_type}")

    result = send_telegram(chat_id, msg)
    return {"status": "ok", "telegram_result": result}
