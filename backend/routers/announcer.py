from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from announcer import announcer

router = APIRouter(prefix="/api/announcer", tags=["announcer"])


class PolishRequest(BaseModel):
    text: str


class AnnouncementIdRequest(BaseModel):
    id: str


@router.get("/list")
def list_announcements(limit: int = 50, offset: int = 0):
    return announcer.get_list(limit=limit, offset=offset)


@router.post("/polish")
async def polish_announcement(body: PolishRequest):
    entry = await announcer.polish_custom(body.text)
    return {"announcement": entry}


@router.post("/mark-announced")
def mark_announced(body: AnnouncementIdRequest):
    ok = announcer.mark_announced(body.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"status": "ok"}


@router.post("/dismiss")
def dismiss_announcement(body: AnnouncementIdRequest):
    ok = announcer.dismiss(body.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"status": "ok"}
