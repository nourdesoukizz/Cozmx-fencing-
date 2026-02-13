from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/agent", tags=["agent"])


class AgentConfigUpdate(BaseModel):
    confidence_threshold: float | None = None
    ping_interval_minutes: int | None = None
    max_pings: int | None = None
    tick_interval_seconds: int | None = None


@router.get("/status")
def agent_status():
    from agent import agent
    return agent.get_status()


@router.get("/log")
def agent_log(limit: int = Query(default=50, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    from agent import agent
    return agent.get_log(limit=limit, offset=offset)


@router.get("/pending")
def agent_pending():
    from agent import agent
    return agent.get_pending_queue()


@router.post("/enable")
async def agent_enable():
    from agent import agent
    await agent.enable()
    return {"status": "ok", "enabled": True}


@router.post("/disable")
async def agent_disable():
    from agent import agent
    await agent.disable()
    return {"status": "ok", "enabled": False}


@router.post("/config")
async def agent_config(body: AgentConfigUpdate):
    from agent import agent
    updates = {}
    if body.confidence_threshold is not None:
        updates["confidence_threshold"] = max(0.0, min(1.0, body.confidence_threshold))
    if body.ping_interval_minutes is not None:
        updates["ping_interval_minutes"] = max(1, body.ping_interval_minutes)
    if body.max_pings is not None:
        updates["max_pings"] = max(1, body.max_pings)
    if body.tick_interval_seconds is not None:
        updates["tick_interval_seconds"] = max(5, body.tick_interval_seconds)
    await agent.update_config(updates)
    return {"status": "ok", "config": agent.config}
