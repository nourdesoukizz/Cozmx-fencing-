# FenceFlow — 3-Minute Demo Walkthrough

## Setup (Before Demo)

```bash
# Terminal 1: Backend
cd backend && python main.py
# Verify: "API key valid" prints on startup

# Terminal 2: Frontend
cd frontend && npm run dev
# Open http://localhost:3000
```

Ensure tournament data is loaded (121 fencers, 18 pools, 10 referees).

---

## Demo Script

### 0. Opening (15 seconds)

> "FenceFlow eliminates the paper-based chaos of running a fencing tournament. Every local tournament today runs on handwritten score sheets, verbal referee assignments, and manual data entry. FenceFlow replaces all of that with AI."

### 1. OCR + Extended Thinking (45 seconds)

1. Open the **Dashboard** (committee view)
2. Navigate to a pool with status **photo_uploaded**
3. Click into the pool review screen — show the **side-by-side**: original handwritten photo on the left, AI-extracted grid on the right
4. Point out **confidence highlighting**: green cells (high confidence), yellow/red cells (low confidence)
5. Show an ambiguous cell where **extended thinking** activated — click the cell to show the correction log with transparent reasoning: *"Opus re-examined this cell: the handwritten '3' was initially read as '5', but fencing rules require V0-V5 range and diagonal symmetry rules out 5 here."*
6. Approve the pool

### 2. Autonomous Agent (30 seconds)

1. Go to the **Agent** tab on the dashboard
2. **Enable the agent** if not already running
3. Scroll through the **agent log** — show entries with purple "AI Reasoning" badges
4. **Click an AI Reasoning entry to expand it** — show the full reasoning chain: which tools the agent used, what data it inspected, and why it made its decision
5. Point out auto-approved pools vs. flagged-for-review pools

### 3. Streaming Narrator (30 seconds)

1. After approving a pool (Step 1), switch to the **Public View**
2. Show the **live commentary feed** — narrator text appears token-by-token with a typing animation
3. Highlight that this is **streamed over WebSocket** directly from Opus 4.6
4. Show the commentary content: upsets, dominant performances, tournament storylines

### 4. Coach Analytics + Chat (45 seconds)

1. Open the **Coach View** (enter code: 5678)
2. Show the **fencer list** with Bradley-Terry strength ratings and performance labels
3. Click a fencer who performed above their rating — show the **trajectory chart** with prior vs. posterior skill estimates
4. Show the **AI Performance Insight**: a natural language summary of the fencer's tournament so far
5. Open the **chat** — ask a question like *"How is this fencer doing compared to the field?"*
6. Show the multi-turn response with full tournament context

### 5. PA Announcements (15 seconds)

1. Go to the **Announcer** panel on the dashboard
2. Show a generated announcement — polished by Opus 4.6
3. Click **Speak** to trigger browser TTS
4. Show Telegram delivery for remote announcements

---

## Key Talking Points

- **6 Opus 4.6 features**: Vision, Extended Thinking, Tool Use, Streaming, Prompt Caching, Multi-turn Chat
- **Real data**: 121 fencers, 18 pools, 10 referees from an actual tournament
- **Bradley-Terry model**: Touch-level statistical modeling, not just an LLM wrapper
- **Monte Carlo simulation**: 10,000-run DE outcome predictions
- **Graceful degradation**: Everything works without an API key (AI features disabled, manual workflow still functional)

---

## Fallback Plan

If something breaks during live demo:
- OCR fails → show a pre-extracted pool already in "committee_reviewed" state
- Agent not responding → show the existing log entries (they persist)
- WebSocket disconnects → refresh the page (auto-reconnects)
- API key issue → the system prints validation status on startup; check terminal
