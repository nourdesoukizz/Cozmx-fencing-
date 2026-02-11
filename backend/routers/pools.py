from fastapi import APIRouter, HTTPException, Query
from data_loader import get_pools, get_pool_by_id

router = APIRouter(prefix="/api/pools", tags=["pools"])


@router.get("")
def list_pools(event: str | None = Query(default=None)):
    return get_pools(event=event)


@router.get("/{pool_id}")
def pool_detail(pool_id: int):
    pool = get_pool_by_id(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    return pool
