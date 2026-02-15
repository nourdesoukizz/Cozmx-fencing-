# FenceFlow — AI-Powered Tournament Operations

**Built with Anthropic Opus 4.6** | by CozMx

> *Build a Tool That Should Exist — Eliminate busywork. Make hard things effortless.*

## The Problem

Running a fencing tournament is a logistical nightmare. Score sheets are handwritten, results must be manually entered from photos, referees need constant coordination, and spectators have no visibility into live results. A single tournament with 120+ fencers generates hundreds of score sheets, announcements, and bracket updates — all managed by a small volunteer committee under time pressure.

FenceFlow replaces this manual chaos with an AI-powered operations platform that automates scoring, coordinates referees, and delivers real-time results to every stakeholder.

## 5 AI Features

### 1. Vision OCR with Extended Thinking
Referees photograph handwritten score sheets. A first-pass Sonnet model reads the scores via OCR. When confidence drops below 80%, Opus 4.6 activates **extended thinking** — a second-pass analysis that re-examines ambiguous cells, applies fencing rule constraints (V0-V5 range, diagonal symmetry), and produces a transparent reasoning chain. The committee sees exactly which cells were corrected and why.

### 2. Autonomous Tournament Agent
An agentic loop powered by Opus 4.6 with **tool use** monitors the tournament in real time. It auto-approves high-confidence score sheets, flags anomalies for human review, detects when all pools in an event are complete, and can stop events automatically. Each decision is logged with full reasoning.

### 3. Streaming Narrator Commentary
After each pool is approved, Opus 4.6 generates color commentary about upsets, dominant performances, and emerging storylines — streamed token-by-token over WebSocket. The live typing animation appears on both the public view and the committee dashboard.

### 4. Interactive Coach Chat
Coaches access a multi-turn chat assistant powered by Opus 4.6 with full Bradley-Terry engine context — fencer strength ratings, win probability trajectories, pairwise head-to-head records, and Monte Carlo DE simulation results (10,000 runs). The system combines touch-level statistical modeling with AI-generated performance insights, helping coaches understand matchup dynamics and make data-driven tactical decisions.

### 5. PA Announcement System
The system generates polished PA announcements for key tournament moments — event starts, pool completions, DE results. Announcements are refined by Opus 4.6 and delivered via browser text-to-speech and Telegram integration.

## Architecture

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.11) |
| **Frontend** | React 18 + Vite |
| **AI** | Anthropic Opus 4.6 (vision, tool use, extended thinking, streaming, prompt caching) |
| **Real-time** | WebSocket (native) |
| **Messaging** | Telegram Bot API |
| **Data** | CSV-based (no database required) |

## User Roles

| Role | Access | Capabilities |
|------|--------|-------------|
| **Committee** | Dashboard (code-protected) | Start/stop events, review scores, manage referees, monitor agent, broadcast announcements |
| **Referee** | Portal (code-protected) | View pool assignments, photograph and upload score sheets, edit scores |
| **Coach** | Chat interface (code-protected) | Query tournament state, ask about fencers, get strategic insights |
| **Public** | Open access | Live leaderboards, pool results, DE brackets, streaming commentary, announcements |

## Quick Start

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
# API runs on http://localhost:3001
# Docs at http://localhost:3001/docs
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

## Screenshots

> **OCR with Confidence Highlighting** — Handwritten score sheet processed by Claude Vision. Cells below 80% confidence trigger extended thinking for re-analysis.

> **Agent Log with AI Reasoning** — The autonomous tournament agent shows its full decision chain: which pools it auto-approved, what anomalies it flagged, and why.

> **Streaming Narrator Commentary** — Token-by-token commentary streamed over WebSocket with live typing animation on the public view.

## Tech Stack

Python 3.11 · FastAPI · React 18 · Vite · Anthropic SDK · WebSocket · Telegram Bot API · CSV data storage

## Data

Tournament data from an actual fencing competition: **121 real fencers**, **18 pools**, **10 referees**, across 3 weapon events. All data is loaded from CSV files — no database required.

---

For detailed system design, see [`docs/design-doc.md`](docs/design-doc.md).
