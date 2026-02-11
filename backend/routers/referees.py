from fastapi import APIRouter, HTTPException, Query
from data_loader import get_referees, get_referee_by_id

router = APIRouter(prefix="/api/referees", tags=["referees"])


@router.get("")
def list_referees(event: str | None = Query(default=None)):
    return get_referees(event=event)


@router.get("/{referee_id}")
def referee_detail(referee_id: int):
    referee = get_referee_by_id(referee_id)
    if not referee:
        raise HTTPException(status_code=404, detail="Referee not found")
    return referee
