import uuid
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from config import COACH_ACCESS_CODE, ANTHROPIC_API_KEY, OPUS_MODEL
from data_loader import get_fencer_by_id, get_all_fencers
from bt_engine import BTEngine

router = APIRouter(prefix="/api/coach", tags=["coach"])

# In-memory session tokens
_coach_tokens: set[str] = set()

# Cache for AI insights: fencer_id -> insight string
_insight_cache: dict[int, str] = {}

# In-memory chat history: fencer_id -> list of messages
_chat_history: dict[int, list[dict]] = {}

# BT engine reference (set by main.py lifespan)
_engine: BTEngine | None = None


class CoachAuthRequest(BaseModel):
    code: str


class BoutRequest(BaseModel):
    fencer_a: str
    fencer_b: str
    score_a: int
    score_b: int


class BracketRequest(BaseModel):
    seedings: list[str]


class ChatRequest(BaseModel):
    message: str


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
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    state = _engine.get_state()
    results = state["fencers"]

    # Apply filters
    if event:
        results = [r for r in results if r["event"].lower() == event.lower()]
    if club:
        results = [r for r in results if r["club"].lower() == club.lower()]

    return {"fencers": results, "total": len(results)}


@router.get("/state")
def get_coach_state(_token: str = Depends(verify_coach_token)):
    """Full engine state: all fencers + strengths + ranks + win_probs + bout count."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    return _engine.get_state()


@router.get("/trajectory")
def get_coach_trajectory(fencer: str = None,
                         _token: str = Depends(verify_coach_token)):
    """Probability trajectory history for chart rendering."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    return {"trajectory": _engine.get_trajectory(fencer)}


@router.get("/pairwise")
def get_coach_pairwise(a: str, b: str,
                       _token: str = Depends(verify_coach_token)):
    """Pairwise win probability + head-to-head record."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    # Try to find fencers by partial match
    name_a = _engine.find_fencer(a)
    name_b = _engine.find_fencer(b)

    if not name_a:
        raise HTTPException(status_code=404, detail=f"Fencer not found: {a}")
    if not name_b:
        raise HTTPException(status_code=404, detail=f"Fencer not found: {b}")

    return _engine.get_pairwise(name_a, name_b)


@router.post("/bout")
def add_coach_bout(req: BoutRequest,
                   _token: str = Depends(verify_coach_token)):
    """Add a new bout, refit all strengths, return updated state."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    # Validate fencer names
    name_a = _engine.find_fencer(req.fencer_a)
    name_b = _engine.find_fencer(req.fencer_b)

    if not name_a:
        name_a = req.fencer_a
    if not name_b:
        name_b = req.fencer_b

    if name_a == name_b:
        raise HTTPException(status_code=400, detail="Cannot have a bout with the same fencer")

    if req.score_a < 0 or req.score_b < 0:
        raise HTTPException(status_code=400, detail="Scores must be non-negative")

    result = _engine.add_bout(name_a, name_b, req.score_a, req.score_b)
    return result


@router.post("/bracket")
def set_coach_bracket(req: BracketRequest,
                      _token: str = Depends(verify_coach_token)):
    """Set DE bracket seedings."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    _engine.set_bracket(req.seedings)
    return {"status": "ok", "bracket_size": len(req.seedings)}


@router.get("/simulate")
def get_coach_simulate(n_sims: int = 10000,
                       _token: str = Depends(verify_coach_token)):
    """Monte Carlo DE simulation results."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    return _engine.simulate_de(n_sims)


@router.get("/bouts")
def get_coach_bouts(_token: str = Depends(verify_coach_token)):
    """All bouts in reverse chronological order."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    return {"bouts": _engine.get_all_bouts()}


@router.get("/fencer-names")
def get_fencer_names(_token: str = Depends(verify_coach_token)):
    """All fencer names for autocomplete."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    return {"names": _engine.get_fencer_names()}


@router.get("/fencers/{fencer_id}")
def get_coach_fencer(fencer_id: int,
                     _token: str = Depends(verify_coach_token)):
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    fencer = get_fencer_by_id(fencer_id)
    if not fencer:
        raise HTTPException(status_code=404, detail="Fencer not found")

    name = f"{fencer.get('first_name', '')} {fencer.get('last_name', '')}".strip()
    detail = _engine.get_fencer_detail(name)
    if not detail:
        raise HTTPException(status_code=404, detail="Fencer not found in engine")

    return detail


@router.get("/fencers/{fencer_id}/insight")
async def get_coach_fencer_insight(fencer_id: int,
                                   _token: str = Depends(verify_coach_token)):
    if fencer_id in _insight_cache:
        return {"insight": _insight_cache[fencer_id]}

    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    fencer = get_fencer_by_id(fencer_id)
    if not fencer:
        raise HTTPException(status_code=404, detail="Fencer not found")

    name = f"{fencer.get('first_name', '')} {fencer.get('last_name', '')}".strip()
    detail = _engine.get_fencer_detail(name)

    if not detail or not detail.get("has_bouts"):
        return {"insight": "No bout data available yet for this fencer."}

    if not ANTHROPIC_API_KEY:
        return {"insight": "AI insights unavailable (no API key configured)."}

    # Build context for AI
    rating = detail.get("rating", "U")
    strength = detail.get("strength", 1.0)
    prior = detail.get("prior_strength", 1.0)
    rank = detail.get("rank", 0)
    win_prob = detail.get("win_prob", 0)
    wins = detail.get("wins", 0)
    losses = detail.get("losses", 0)
    bouts = detail.get("bout_details", [])

    bout_lines = []
    for b in bouts:
        result = "W" if b["victory"] else "L"
        upset = " [UPSET]" if b.get("is_upset") else ""
        bout_lines.append(
            f"  vs {b['opponent_name']} ({b['opponent_rating']}, "
            f"strength={b['opponent_strength']:.1f}): "
            f"{b['my_score']}-{b['opp_score']} [{result}]{upset}"
        )
    bout_text = "\n".join(bout_lines) if bout_lines else "  No bouts"

    prompt = (
        f"Fencer: {name}\nRating: {rating}\n"
        f"BT Strength: {strength:.2f} (prior: {prior:.2f}) | "
        f"Rank: {rank} | Win Prob: {win_prob:.1f}% | "
        f"Record: {wins}W-{losses}L\n"
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
                    "model": OPUS_MODEL,
                    "max_tokens": 200,
                    "system": [
                        {
                            "type": "text",
                            "text": (
                                "You are a fencing coach's analytics assistant using a Bradley-Terry model. "
                                "Give a 2-3 sentence performance insight for the fencer. "
                                "Be specific about strengths, notable wins/upsets, and tactical patterns."
                            ),
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
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


@router.post("/fencers/{fencer_id}/chat")
async def coach_fencer_chat(fencer_id: int, body: ChatRequest,
                            _token: str = Depends(verify_coach_token)):
    """Multi-turn interactive coach chat about a specific fencer using Opus 4.6."""
    if not _engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")

    fencer = get_fencer_by_id(fencer_id)
    if not fencer:
        raise HTTPException(status_code=404, detail="Fencer not found")

    name = f"{fencer.get('first_name', '')} {fencer.get('last_name', '')}".strip()
    detail = _engine.get_fencer_detail(name)

    if not ANTHROPIC_API_KEY:
        return {"reply": "AI chat unavailable (no API key configured)."}

    # Build system prompt with fencer context
    rating = detail.get("rating", "U") if detail else "U"
    strength = detail.get("strength", 1.0) if detail else 1.0
    prior = detail.get("prior_strength", 1.0) if detail else 1.0
    rank = detail.get("rank", 0) if detail else 0
    win_prob = detail.get("win_prob", 0) if detail else 0
    wins = detail.get("wins", 0) if detail else 0
    losses = detail.get("losses", 0) if detail else 0
    bouts = detail.get("bout_details", []) if detail else []

    bout_lines = []
    for b in bouts:
        result = "W" if b["victory"] else "L"
        upset = " [UPSET]" if b.get("is_upset") else ""
        bout_lines.append(
            f"  vs {b['opponent_name']} ({b['opponent_rating']}, "
            f"strength={b['opponent_strength']:.1f}): "
            f"{b['my_score']}-{b['opp_score']} [{result}]{upset}"
        )
    bout_text = "\n".join(bout_lines) if bout_lines else "  No bouts recorded"

    # Get simulation data if bracket exists
    sim_context = ""
    try:
        sim = _engine.simulate_de(5000)
        if sim and sim.get("results"):
            fencer_sim = [s for s in sim["results"] if name.lower() in s.get("name", "").lower()]
            if fencer_sim:
                fs = fencer_sim[0]
                sim_context = (
                    f"\nDE Simulation (5000 runs): "
                    f"Win tournament: {fs.get('win_pct', 0):.1f}%, "
                    f"Make final: {fs.get('final_pct', 0):.1f}%, "
                    f"Make semis: {fs.get('semi_pct', 0):.1f}%"
                )
    except Exception:
        pass

    system_prompt = (
        f"You are an expert fencing coach's analytics assistant powered by Claude Opus 4.6. "
        f"You have deep knowledge of fencing tactics, USFA ratings, and statistical analysis via the Bradley-Terry model. "
        f"You are analyzing data for a specific fencer and answering the coach's questions.\n\n"
        f"Fencer: {name}\nRating: {rating}\n"
        f"BT Strength: {strength:.2f} (prior: {prior:.2f}) | "
        f"Rank: {rank} | Win Probability: {win_prob:.1f}% | "
        f"Record: {wins}W-{losses}L\n"
        f"Bout details:\n{bout_text}{sim_context}\n\n"
        f"Give specific, actionable advice. Reference the data. Keep responses concise (2-4 sentences)."
    )

    # Get or initialize chat history for this fencer
    if fencer_id not in _chat_history:
        _chat_history[fencer_id] = []

    # Add user message
    _chat_history[fencer_id].append({"role": "user", "content": body.message})

    # Keep last 20 messages to prevent context overflow
    if len(_chat_history[fencer_id]) > 20:
        _chat_history[fencer_id] = _chat_history[fencer_id][-20:]

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
                    "model": OPUS_MODEL,
                    "max_tokens": 300,
                    "system": [
                        {
                            "type": "text",
                            "text": system_prompt,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    "messages": _chat_history[fencer_id],
                },
                timeout=30.0,
            )

        if resp.status_code == 200:
            data = resp.json()
            reply = data.get("content", [{}])[0].get("text", "Unable to generate response.")
        else:
            reply = f"AI service returned status {resp.status_code}."
    except Exception as e:
        reply = f"Unable to generate response: {str(e)}"

    # Add assistant reply to history
    _chat_history[fencer_id].append({"role": "assistant", "content": reply})

    return {
        "reply": reply,
        "history": _chat_history[fencer_id],
    }


@router.get("/fencers/{fencer_id}/chat-history")
async def get_chat_history(fencer_id: int,
                           _token: str = Depends(verify_coach_token)):
    """Get chat history for a fencer."""
    return {"history": _chat_history.get(fencer_id, [])}
