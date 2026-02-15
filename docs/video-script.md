# FenceFlow — 3-Minute Demo Video Script

> **Format:** Screen-capture with voiceover narration
> **Total runtime:** 3:00 (180 seconds)
> **Recording tip:** Read each section aloud with a timer — aim for 2:55–3:05 total

---

## 0:00–0:25 — Cold Open: The Problem (25 s)

**SCREEN:** Show a photo of a real paper fencing score sheet — messy handwriting, crossed-out numbers, coffee stain. Then cut to a volunteer squinting at a laptop, manually typing scores into a spreadsheet.

> **NARRATION:**
> Every weekend, thousands of youth fencers compete in tournaments across the country. And every weekend, the same thing happens — referees scribble scores on paper sheets, volunteers spend hours squinting at handwriting, manually entering numbers into spreadsheets, and parents refresh a results page that never updates. One wrong digit can knock a kid out of the bracket. It's slow, it's error-prone, and it burns out every volunteer in the building.

**VISUAL CALLOUT:** *Highlight the messy handwriting on the paper sheet*

---

## 0:25–0:35 — Solution Intro (10 s)

**SCREEN:** Open FenceFlow landing page. Click "Bout Committee" role, enter code `1234`. Dashboard loads with venue map, pool progress bars, and live stats.

> **NARRATION:**
> This is FenceFlow — an AI-powered tournament management system built entirely on Claude Opus 4.6. Let me show you what it can do.

**VISUAL CALLOUT:** *Highlight the four role buttons on the landing page*

---

## 0:35–1:05 — Feature 1: Vision OCR + Extended Thinking (30 s)

**SCREEN:** Navigate to a referee view. Upload a pool score sheet photo. Show the OCR extraction loading, then the results table appearing with per-cell confidence badges. Point out a low-confidence cell. Click to show the Opus extended thinking correction with reasoning.

> **NARRATION:**
> A referee snaps a photo of their score sheet and uploads it. Claude Sonnet does a first-pass vision OCR, extracting every cell from the scoring grid and assigning a confidence score to each one. See this cell flagged at sixty-two percent? When any cell drops below eighty percent, Opus 4.6 kicks in with extended thinking. It reasons through the ambiguity — "the digit could be a three or a five, but the column total only works if it's a five" — and corrects the score. This two-pass pipeline boosts accuracy from around sixty-eight percent to over ninety-two percent.

**VISUAL CALLOUT:** *Circle the low-confidence cell, then highlight the extended thinking reasoning panel*

---

## 1:05–1:30 — Feature 2: Autonomous Agent with Tool Use (25 s)

**SCREEN:** Go to the Agent panel on the committee dashboard. Click "Run Agent Cycle." Watch the agent log populate in real time — tool calls appearing one by one. Expand one reasoning block to show the AI's decision-making.

> **NARRATION:**
> Now for the autonomous agent. With one click, the tournament director launches an agentic loop. Opus 4.6 has eight tools at its disposal — it can fetch pending submissions, detect scoring anomalies, approve or flag pools, check tournament pace, ping referees via Telegram, generate announcements, and close out events. It runs up to ten iterations per cycle, deciding on its own which tool to call next. Every decision is logged with full reasoning you can expand and audit.

**VISUAL CALLOUT:** *Highlight the 8 tool names in the agent log and the expandable reasoning block*

---

## 1:30–1:50 — Feature 3: Streaming Narrator (20 s)

**SCREEN:** Show the live commentary panel. Trigger an event (approve a pool or complete a bout). Watch the narrator text stream in token by token with a typing animation.

> **NARRATION:**
> Every major event triggers the streaming narrator. When a pool is approved or a bout finishes, Opus generates live commentary that streams token by token over WebSocket — you can see each word appearing in real time, just like watching someone type. It keeps spectators and officials in the loop without anyone lifting a finger.

**VISUAL CALLOUT:** *Highlight the typing animation as tokens stream in*

---

## 1:50–2:25 — Feature 4: Coach Analytics + Chat (35 s)

**SCREEN:** Switch to the Coach role. Open the analytics dashboard. Show the Bradley-Terry strength chart, then the trajectory graph over time, then click into a pairwise matchup prediction. Finally, open the chat panel and type a question like "How should my fencer approach their next DE opponent?" Show the multi-turn response.

> **NARRATION:**
> Coaches get a full AI analytics suite. Under the hood is a Bradley-Terry model — a minorization-maximization algorithm that calculates each fencer's strength from touch-level bout data. Every time a pool is approved, all strengths are refitted from scratch. Coaches can see a ranked strength chart, a trajectory graph showing how their fencer's rating evolves, and pairwise matchup predictions — "your fencer has a sixty-three percent chance of scoring on this opponent." There's also a ten-thousand-run Monte Carlo simulation predicting bracket outcomes. And if a coach wants tactical advice, they can chat directly with Opus — it has full context on the fencer's stats and gives multi-turn analysis across a twenty-message conversation.

**VISUAL CALLOUT:** *Highlight the Bradley-Terry chart, the matchup probability, and the Monte Carlo win percentage*

---

## 2:25–2:40 — Feature 5: PA Announcements + Telegram (15 s)

**SCREEN:** Show the announcements panel. Click to generate an announcement from a trigger like "pool approved." Show the polished text appear. Click the speaker icon for TTS playback. Show the Telegram delivery confirmation.

> **NARRATION:**
> Six trigger types — from event start to champion crowned — can fire a PA announcement. Opus polishes raw event data into professional venue-ready copy. One click plays it through browser text-to-speech, and another sends it straight to a Telegram channel for everyone in the building.

**VISUAL CALLOUT:** *Highlight the TTS speaker icon and Telegram send confirmation*

---

## 2:40–2:50 — Feature 6: Public Spectator View (10 s)

**SCREEN:** Open a new browser tab (or incognito). Go to the public view — no login required. Scroll through the live leaderboard, bracket view, and live event feed.

> **NARRATION:**
> Parents and spectators get a public view — no login needed. Live leaderboards, brackets, and an event feed, all updating in real time as the tournament runs.

**VISUAL CALLOUT:** *Highlight "No login required" and the live-updating feed*

---

## 2:50–3:00 — Close (10 s)

**SCREEN:** Return to the committee dashboard. Show the summary stats: 120 fencers, 18 pools, 18 referees, 2 weapon events. Fade to a closing card with the team name and hackathon logo.

> **NARRATION:**
> One hundred twenty fencers, eighteen pools, two weapon events — all managed by Claude Opus 4.6 with vision, extended thinking, tool use, streaming, prompt caching, and multi-turn chat. This is FenceFlow, by team CozMx.

**VISUAL CALLOUT:** *Closing card: "FenceFlow by CozMx — Anthropic Hackathon 4.6 Opus"*

---

## Production Notes

### Opus 4.6 Features Covered
- [x] **Vision** — OCR extraction from score sheet photos
- [x] **Extended Thinking** — Second-pass correction with reasoning
- [x] **Tool Use** — 8-tool autonomous agent loop
- [x] **Streaming** — Token-by-token narrator over WebSocket
- [x] **Prompt Caching** — `cache_control: ephemeral` on all system prompts
- [x] **Multi-turn Chat** — 20-message coach conversation with full BT context

### Recording Checklist
- [ ] Practice reading the full script aloud — target 2:55 to 3:05
- [ ] Pre-load all four role views in separate browser tabs
- [ ] Have a pool sheet photo ready for the OCR demo
- [ ] Ensure the backend is running (`python run_server.py`)
- [ ] Ensure the frontend is running (`npm run dev`)
- [ ] Clear browser cache for a clean demo
- [ ] Record at 1920x1080 resolution

### Estimated Word Count
~580 words of narration at ~195 wpm = ~3:00
