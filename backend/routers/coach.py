import uuid
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from config import COACH_ACCESS_CODE, ANTHROPIC_API_KEY
from data_loader import (
    get_all_fencers, get_all_pools, get_all_submissions_dict,
    get_fencer_by_id, get_pool_bouts_for_fencer,
)
from bayesian_model import compute_all_estimates

router = APIRouter(prefix="/api/coach", tags=["coach"])

# In-memory session tokens
_coach_tokens: set[str] = set()

# Cache for AI insights: fencer_id -> insight string
_insight_cache: dict[int, str] = {}


class CoachAuthRequest(BaseModel):
    code: str


def verify_coach_token(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization[7:]
    if token not in _coach_tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return token


@router.post("/auth")
def coach_auth(req: CoachAuthRequest):
    if req.code != COACH_ACCESS_CODE:
        raise HTTPException(status_code=401, detail="Invalid access code")
    token = str(uuid.uuid4())
    _coach_tokens.add(token)
    return {"token": token}


@router.get("/fencers")
def get_coach_fencers(event: str = None, club: str = None,
                      _token: str = Depends(verify_coach_token)):
    fencers = get_all_fencers()
    pools = get_all_pools()
    submissions = get_all_submissions_dict()

    estimates = compute_all_estimates(fencers, pools, submissions)

    results = []
    for f in fencers:
        fid = f["id"]
        analysis = estimates.get(fid, {})

        entry = {
            "id": fid,
            "first_name": f.get("first_name", ""),
            "last_name": f.get("last_name", ""),
            "club": f.get("club", ""),
            "rating": f.get("rating", ""),
            "event": f.get("event", ""),
            **analysis,
        }
        results.append(entry)

    # Apply filters
    if event:
        results = [r for r in results if r["event"].lower() == event.lower()]
    if club:
        results = [r for r in results if r["club"].lower() == club.lower()]

    return {"fencers": results, "total": len(results)}


@router.get("/fencers/{fencer_id}")
def get_coach_fencer(fencer_id: int,
                     _token: str = Depends(verify_coach_token)):
    fencer = get_fencer_by_id(fencer_id)
    if not fencer:
        raise HTTPException(status_code=404, detail="Fencer not found")

    fencers = get_all_fencers()
    pools = get_all_pools()
    submissions = get_all_submissions_dict()

    estimates = compute_all_estimates(fencers, pools, submissions)
    analysis = estimates.get(fencer_id, {})

    return {
        "id": fencer_id,
        "first_name": fencer.get("first_name", ""),
        "last_name": fencer.get("last_name", ""),
        "club": fencer.get("club", ""),
        "rating": fencer.get("rating", ""),
        "event": fencer.get("event", ""),
        **analysis,
    }


@router.get("/fencers/{fencer_id}/insight")
async def get_coach_fencer_insight(fencer_id: int,
                                   _token: str = Depends(verify_coach_token)):
    if fencer_id in _insight_cache:
        return {"insight": _insight_cache[fencer_id]}

    fencer = get_fencer_by_id(fencer_id)
    if not fencer:
        raise HTTPException(status_code=404, detail="Fencer not found")

    fencers = get_all_fencers()
    pools = get_all_pools()
    submissions = get_all_submissions_dict()
    estimates = compute_all_estimates(fencers, pools, submissions)
    analysis = estimates.get(fencer_id, {})

    if not analysis.get("has_pool_data"):
        return {"insight": "No pool data available yet for this fencer."}

    if not ANTHROPIC_API_KEY:
        return {"insight": "AI insights unavailable (no API key configured)."}

    # Build context for AI
    name = f"{fencer.get('first_name', '')} {fencer.get('last_name', '')}".strip()
    rating = fencer.get("rating", "U")
    prior = analysis.get("prior_mean", 0)
    posterior = analysis.get("posterior_mean", 0)
    delta = analysis.get("delta_label", "")
    perf = analysis.get("performance_label", "")
    bouts = analysis.get("bout_details", [])

    bout_lines = []
    for b in bouts:
        result = "W" if b["victory"] else "L"
        bout_lines.append(
            f"  vs {b['opponent_name']} ({b['opponent_rating']}): {b['my_score']}-{b['opp_score']} [{result}]"
        )
    bout_text = "\n".join(bout_lines) if bout_lines else "  No bouts"

    pool_lines = []
    for ps in analysis.get("pool_summaries", []):
        pool_lines.append(
            f"  Pool {ps['pool_number']}: {ps['victories']}V/{ps['bouts']}B, "
            f"TS={ps['ts']} TR={ps['tr']} Ind={ps['indicator']} Place={ps['place']}"
        )
    pool_text = "\n".join(pool_lines) if pool_lines else "  No pool data"

    prompt = (
        f"You are a fencing coach's analytics assistant. Give a 2-3 sentence performance insight "
        f"for this fencer based on their pool results. Be specific about strengths and areas to watch.\n\n"
        f"Fencer: {name}\nRating: {rating}\n"
        f"Prior skill: {prior:.2f} | Posterior: {posterior:.2f} | Delta: {delta} | Level: {perf}\n"
        f"Pool results:\n{pool_text}\n"
        f"Bout details:\n{bout_text}"
    )

    try:
        import httpx

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 200,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=15.0,
            )

        if resp.status_code == 200:
            data = resp.json()
            insight = data.get("content", [{}])[0].get("text", "Unable to generate insight.")
        else:
            insight = f"AI service returned status {resp.status_code}."
    except Exception as e:
        insight = f"Unable to generate AI insight: {str(e)}"

    _insight_cache[fencer_id] = insight
    return {"insight": insight}
