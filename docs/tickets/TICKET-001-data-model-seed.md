# TICKET-001: Backend Server + Data API (Phase 1)

## Metadata
| Field | Value |
|-------|-------|
| **Ticket ID** | TICKET-001 |
| **Title** | Backend Server + Data API — Python/FastAPI |
| **Status** | In Progress |
| **Priority** | P0 — Critical (blocks all other work) |
| **Type** | Feature / Infrastructure |
| **Created** | 2026-02-10 |
| **Tournament** | Cozmx Fall RYC/RJCC — November 22-23, 2025 |
| **Stack** | Python 3.11+, FastAPI, Uvicorn |
| **Data Source** | CSV files (121 fencers, 18 pools, 2 events) |
| **Endpoints** | 7 REST API endpoints |

## Summary
Replace 1-line JS stubs with a working Python/FastAPI backend that loads tournament CSV data into memory and serves it via REST API. No database — CSVs loaded at startup. This unblocks all future frontend, analytics, and OCR work.

## Key Decisions
- **Python/FastAPI** instead of Node.js/Express
- **No database** — CSV files loaded into memory at startup
- **Existing .js stubs left untouched** (cleanup later)
- **Port 3001** (avoids frontend dev server on 3000)

## Files Created (7 new Python files)
| # | File | Purpose |
|---|------|---------|
| 1 | `backend/requirements.txt` | Python dependencies (fastapi, uvicorn, python-dotenv) |
| 2 | `backend/config.py` | PORT, DATA_DIR, tournament metadata |
| 3 | `backend/data_loader.py` | CSV parsing, in-memory store, query functions |
| 4 | `backend/main.py` | FastAPI app, startup event, route mounting |
| 5 | `backend/routers/__init__.py` | Python package marker |
| 6 | `backend/routers/tournament.py` | Tournament status + events endpoints |
| 7 | `backend/routers/pools.py` | Pool listing + detail endpoints |
| 8 | `backend/routers/referees.py` | Referee listing + detail endpoints |

## API Endpoints (7 total)
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/health` | Health check | — |
| GET | `/api/tournament/status` | Tournament overview with events | — |
| GET | `/api/tournament/events` | Events list only | — |
| GET | `/api/pools` | All pools (or filtered) | `?event=...` |
| GET | `/api/pools/{pool_id}` | Single pool detail | — |
| GET | `/api/referees` | All referees (or filtered) | `?event=...` |
| GET | `/api/referees/{referee_id}` | Single referee detail | — |

## Data Pitfalls Handled
- Trailing whitespace in CSV headers and values — strip all fields on load
- Referee name inconsistencies (e.g., `"Dylan "` vs `"Dylan"`) — normalized via stripping
- Case mismatch between CSVs (fencers.csv: `CHAN`, pools.csv: `Chan`) — case-insensitive matching
- bout_count computed as `n*(n-1)/2`

## Verification
```bash
cd backend && pip install -r requirements.txt && python main.py
# Swagger docs: http://localhost:3001/docs
curl http://localhost:3001/api/health
curl http://localhost:3001/api/tournament/status
curl http://localhost:3001/api/pools
curl "http://localhost:3001/api/pools?event=Cadet+Men+Saber"
curl http://localhost:3001/api/pools/1
curl http://localhost:3001/api/referees
curl http://localhost:3001/api/referees/1
```

## Future Phases (out of scope)
- Authentication middleware
- WebSocket real-time updates
- DE bracket generation
- Coach analytics + Bayesian model
- Pool OCR with Claude Vision
- Public spectator view
