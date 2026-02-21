import json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from config import PORT, UPLOADS_DIR, DATA_DIR, ANTHROPIC_API_KEY, SONNET_MODEL, OPUS_MODEL
from data_loader import load_data, get_referee_by_token, get_pools_for_referee, get_event_status
from data_loader import get_all_fencers, get_all_pools, get_all_submissions_dict
from bt_engine import BTEngine
from telegram_bot import start_polling as start_telegram_bot, stop_polling as stop_telegram_bot
from routers import tournament, pools, referees, scores, coach, agent as agent_router, announcer as announcer_router, narrator as narrator_router, de as de_router


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


def _validate_api_key():
    """Validate Anthropic API key and model IDs at startup."""
    if not ANTHROPIC_API_KEY:
        print("[STARTUP] WARNING: ANTHROPIC_API_KEY is not set — all AI features will be disabled")
        return
    try:
        import httpx
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": OPUS_MODEL,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}],
                },
            )
            if resp.status_code == 200:
                print(f"[STARTUP] API key valid — models: {SONNET_MODEL}, {OPUS_MODEL}")
            elif resp.status_code == 401:
                print("[STARTUP] WARNING: ANTHROPIC_API_KEY is invalid (401 Unauthorized)")
            elif resp.status_code == 404:
                print(f"[STARTUP] WARNING: Model '{OPUS_MODEL}' not found (404) — check config.py")
            else:
                print(f"[STARTUP] WARNING: API validation returned status {resp.status_code}")
    except Exception as exc:
        print(f"[STARTUP] WARNING: Could not validate API key: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_data()
    _validate_api_key()
    # Initialize Bradley-Terry engine
    engine = BTEngine(DATA_DIR)
    engine.initialize(get_all_fencers(), get_all_pools(), get_all_submissions_dict())
    coach._engine = engine
    # Start Telegram bot polling in background thread
    start_telegram_bot()
    # Start tournament agent background task
    from agent import agent as tournament_agent
    tournament_agent.start_background()
    yield
    await tournament_agent.stop_background()
    stop_telegram_bot()


app = FastAPI(title="FenceFlow API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tournament.router)
app.include_router(pools.router)
app.include_router(referees.router)
app.include_router(scores.router)
app.include_router(coach.router)
app.include_router(agent_router.router)
app.include_router(announcer_router.router)
app.include_router(narrator_router.router)
app.include_router(de_router.router)

# Mount uploads directory for serving score sheet photos
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/referee/{token}")
def get_referee_by_token_route(token: str):
    referee = get_referee_by_token(token)
    if not referee:
        raise HTTPException(status_code=404, detail="Invalid referee link")
    pools = get_pools_for_referee(referee["id"])
    return {"referee": referee, "pools": pools}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; we only broadcast from server
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Serve frontend build (production) ──
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file() and ".." not in full_path:
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
