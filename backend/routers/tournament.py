from fastapi import APIRouter
from data_loader import get_tournament, get_events

router = APIRouter(prefix="/api/tournament", tags=["tournament"])


@router.get("/status")
def tournament_status():
    return get_tournament()


@router.get("/events")
def tournament_events():
    return get_events()
