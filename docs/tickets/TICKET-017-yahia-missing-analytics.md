# TICKET-017: Yahia Elsayed Missing Analytics on Coach Dashboard

## Metadata
- **Status:** Fixed
- **Priority:** High
- **Type:** Bug Fix
- **Reported:** 2026-02-20
- **Fixed:** 2026-02-20
- **Affected Component:** Agent auto-approval → BT Engine ingestion
- **Root Cause:** Agent `_tool_approve_pool()` missing `ingest_pool()` call

---

## Problem

Yahia Elsayed's analytics show dashes (no data) on the Coach Dashboard even after Pool 4 results are submitted and approved by the agent.

## Root Cause

**Code bug in `agent.py:_tool_approve_pool()`** — when the agent auto-approves a pool, it computes results and saves the submission but **never calls `ingest_pool()` on the BT engine**. Without this call, the fencer's bouts are never fed into the Bradley-Terry model, so `has_bouts` stays `false` and analytics show dashes.

### Comparison

| Step | Agent Approval (`agent.py:384-441`) | Manual Approval (`scores.py:112-173`) |
|------|-------------------------------------|---------------------------------------|
| Validate scores | Yes | Yes |
| Compute results | Yes | Yes |
| Save submission | Yes | Yes |
| Write CSV | Yes | Yes |
| **Call `ingest_pool()`** | **NO (BUG)** | **Yes (line 146-150)** |
| Analytics appear | No | Yes |

## Fix

Added the missing `ingest_pool()` call to `agent.py:_tool_approve_pool()` after `write_scores_csv()`:

```python
# Feed approved pool into BT engine so coach analytics update
from routers.coach import _engine as coach_engine
if coach_engine:
    coach_engine.ingest_pool(pool_id, pool.get("pool_number", 0),
                             pool.get("fencers", []), scores)
```

This matches the implementation in `scores.py:146-150`.

## Verification

After this fix:
1. Agent auto-approves a pool
2. `ingest_pool()` feeds bouts into BT engine
3. `get_state()` returns `has_bouts=true` for all fencers in that pool
4. Coach dashboard shows analytics for Yahia (and all other fencers in agent-approved pools)
