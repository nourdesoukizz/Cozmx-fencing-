from fastapi import APIRouter

from narrator import narrator

router = APIRouter(prefix="/api/narrator", tags=["narrator"])


@router.get("/feed")
def get_narrator_feed(limit: int = 50, offset: int = 0):
    return narrator.get_feed(limit=limit, offset=offset)
