# TICKET-017: Yahia Elsayed Missing Analytics on Coach Dashboard (Railway)

## Metadata
- **Status:** Resolved
- **Priority:** High
- **Type:** Investigation / Operational Fix
- **Reported:** 2026-02-20
- **Resolved:** 2026-02-20
- **Affected Component:** Coach Dashboard, BT Engine, Agent Telegram Links
- **Root Cause:** Broken Telegram links after Demo Reset (operational, not code)

---

## Problem

Yahia Elsayed's analytics show dashes (no data) on the Coach Dashboard when running on Railway. He is registered in `fencers.csv` and assigned to Pool 4, but the BT engine reports `has_bouts = false`.

## Investigation Summary

### Root Cause

**This is NOT a code bug — it's an expected consequence of the Demo Reset + broken Telegram links.**

Chain of events:
1. **Demo Reset was triggered on Railway** — `tournament.py:170-172` clears Pool 4's submission and re-initializes the BT engine WITHOUT Pool 4 data
2. **Agent sends pings** with Telegram links — but links used `BASE_URL` which was `http://192.168.0.179:3000` (local IP, not accessible externally)
3. **Referee (Suzanne) can't access the link** on her phone — Pool 4 photo never re-uploaded on Railway
4. **Pool 4 stays in limbo** — no submission, no approval, no analytics
5. **BT engine has Yahia registered** (from `fencers.csv`) but `has_bouts = false` because Pool 4's bouts were never ingested — Coach Dashboard shows dashes

### Data Flow Verification (All Correct)

| Check | File/Line | Status |
|-------|-----------|--------|
| Fencer registered | `fencers.csv:34` | Yahia present |
| Pool assignment | `pools.csv:97` | Yahia in Pool 4 |
| Fencer matching | `data_loader.py:33-43` | Case-insensitive, whitespace-stripped |
| Result computation | `ocr_service.py:346-390` | Generates correct `name: "Yahia ELSAYED"` |
| BT ingestion | `bt_engine.py:146-152` | Feeds bouts after approval |
| State reporting | `bt_engine.py:368-427` | Returns `has_bouts: true` only with bouts |

### Analytics Pipeline (Working as Designed)

```
Upload → pending_review → Agent/Committee APPROVES → compute_results → save_submission → ingest_pool → BT engine updated → has_bouts = true → analytics appear
```

Pool 4 is stuck **before "Upload"** because the Telegram link was broken (local IP).

## Resolution

**Operational fix only — no code changes required.**

1. Set `BASE_URL` in Railway dashboard environment variables to `https://cozmx-fencing-production.up.railway.app`
2. Redeploy on Railway (picks up latest git changes)
3. Demo Reset — agent will send pings with correct Railway URL
4. Referee uploads Pool 4 via the working Telegram link
5. Agent auto-approves (100% confidence) → `ingest_pool` feeds BT engine → Yahia's analytics appear

### Verification

The local `.env` already has the correct value:
```
BASE_URL=https://cozmx-fencing-production.up.railway.app
```

The code reads this via `config.py:20`:
```python
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
```

A startup warning exists at `main.py:90-92` to catch local-only URLs:
```python
if "localhost" in BASE_URL or "192.168" in BASE_URL:
    print(f"[WARNING] BASE_URL is '{BASE_URL}' — set BASE_URL env var...")
```

The Railway environment variable must be set separately in the Railway dashboard (it does not read the local `.env` file).
