from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/de", tags=["de"])


class AssignRequest(BaseModel):
    bout_id: str
    referee_id: int
    strip_number: str | None = None


class ReportRequest(BaseModel):
    bout_id: str
    top_score: int
    bottom_score: int
    referee_signature: str | None = None
    winner_signature: str | None = None


@router.get("/seedings/{event_name}")
def get_seedings(event_name: str):
    from de_bracket import de_service
    seedings = de_service.compute_seedings(event_name)
    if not seedings:
        raise HTTPException(status_code=404, detail="No approved pool results for this event")
    return {"event": event_name, "seedings": seedings}


@router.post("/bracket/{event_name}/create")
async def create_bracket(event_name: str):
    from de_bracket import de_service
    try:
        bracket = de_service.create_bracket(event_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Broadcast
    from main import manager
    await manager.broadcast({
        "type": "de_bracket_created",
        "event": event_name,
    })

    return {"status": "ok", "bracket": bracket}


@router.get("/bracket/{event_name}")
def get_bracket(event_name: str):
    from de_bracket import de_service
    bracket = de_service.get_bracket(event_name)
    if not bracket:
        raise HTTPException(status_code=404, detail="No bracket for this event")
    return bracket


@router.get("/brackets")
def get_all_brackets():
    from de_bracket import de_service
    return {"brackets": de_service.get_all_brackets()}


@router.delete("/bracket/{event_name}")
async def delete_bracket(event_name: str):
    from de_bracket import de_service
    try:
        de_service.delete_bracket(event_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "ok"}


@router.post("/bracket/{event_name}/assign")
async def assign_referee(event_name: str, body: AssignRequest):
    from de_bracket import de_service
    try:
        bout = de_service.assign_referee(
            event_name, body.bout_id, body.referee_id, body.strip_number,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Broadcast
    from main import manager
    await manager.broadcast({
        "type": "de_referee_assigned",
        "event": event_name,
        "bout_id": body.bout_id,
        "referee_id": body.referee_id,
    })

    return {"status": "ok", "bout": bout}


@router.post("/bracket/{event_name}/report")
async def report_bout(event_name: str, body: ReportRequest):
    from de_bracket import de_service
    try:
        result = de_service.report_bout(
            event_name, body.bout_id,
            body.top_score, body.bottom_score,
            body.referee_signature, body.winner_signature,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    bout = result["bout"]
    winner = result["winner"]
    loser = result["loser"]
    round_name = result["round_name"]
    winner_name = f"{winner['first_name']} {winner['last_name']}"
    loser_name = f"{loser['first_name']} {loser['last_name']}"
    score = f"{bout['top_score']}-{bout['bottom_score']}"

    # Broadcast bout completed
    from main import manager
    await manager.broadcast({
        "type": "de_bout_completed",
        "event": event_name,
        "bout_id": body.bout_id,
        "round_name": round_name,
        "winner": winner_name,
        "loser": loser_name,
        "score": score,
    })

    # Trigger announcer + narrator
    from announcer import announcer
    from narrator import narrator

    if result["is_final"]:
        bracket = de_service.get_bracket(event_name)
        standings = bracket.get("final_standings", []) if bracket else []

        await announcer.generate("de_event_completed", {
            "event_name": event_name,
            "champion_name": winner_name,
        })
        await narrator.generate("de_event_completed", {
            "event_name": event_name,
            "champion_name": winner_name,
            "champion_seed": winner.get("seed", ""),
            "runner_up_name": loser_name,
            "runner_up_seed": loser.get("seed", ""),
            "score": score,
        })

        # Broadcast bracket completed
        await manager.broadcast({
            "type": "de_bracket_completed",
            "event": event_name,
            "champion": winner_name,
            "final_standings": standings,
        })
    else:
        await announcer.generate("de_bout_completed", {
            "event_name": event_name,
            "winner_name": winner_name,
            "loser_name": loser_name,
            "score": score,
            "round_name": round_name,
        })
        await narrator.generate("de_bout_completed", {
            "event_name": event_name,
            "winner_name": winner_name,
            "winner_seed": winner.get("seed", ""),
            "loser_name": loser_name,
            "loser_seed": loser.get("seed", ""),
            "score": score,
            "round_name": round_name,
        })

    return {"status": "ok", "result": result}


@router.get("/referee-bouts/{referee_id}")
def get_referee_bouts(referee_id: int):
    from de_bracket import de_service
    bouts = de_service.get_referee_bouts(referee_id)
    return {"bouts": bouts}
