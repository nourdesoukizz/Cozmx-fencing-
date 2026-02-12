from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from data_loader import get_referees, get_referee_by_id
from sms_service import send_sms
from config import BASE_URL

router = APIRouter(prefix="/api/referees", tags=["referees"])


class PingRequest(BaseModel):
    message_type: str  # "report_to_captain" | "pool_sheet_reminder" | "custom"
    custom_message: str = ""


@router.get("")
def list_referees(event: str | None = Query(default=None)):
    return get_referees(event=event)


@router.get("/{referee_id}")
def referee_detail(referee_id: int):
    referee = get_referee_by_id(referee_id)
    if not referee:
        raise HTTPException(status_code=404, detail="Referee not found")
    return referee


@router.post("/{referee_id}/ping")
def ping_referee(referee_id: int, body: PingRequest):
    referee = get_referee_by_id(referee_id)
    if not referee:
        raise HTTPException(status_code=404, detail="Referee not found")

    name = referee.get("first_name", "")
    phone = referee.get("phone", "").strip()
    token = referee.get("token", "")

    if not phone:
        raise HTTPException(status_code=400, detail=f"No phone number on file for {name}")

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

    result = send_sms(phone, msg)
    return {"status": "ok", "sms_result": result}
