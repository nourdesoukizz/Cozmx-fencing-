# FenceFlow — AI-Powered Tournament Operations

**Built with Anthropic Opus 4.6** | by CozMx

> *Build a Tool That Should Exist — Eliminate busywork. Make hard things effortless.*

![FenceFlow Landing Page](docs/Demo/0215-Cover.jpg)

## Demo

[Watch the demo video](docs/Demo/0215.mov)

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

### Landing Page — Role Selection
![Landing Page with role selection for Committee, Public, Coach, and Referee](docs/Demo/0215-Cover.jpg)

### Committee Dashboard — Referees & Agent Panel
![Committee Dashboard showing referees tab and autonomous agent panel with Telegram integration](docs/Demo/Screenshot%202026-02-16%20at%203.38.39%E2%80%AFAM.png)

### Pool Progress — Score Matrices
![Pool Progress view showing 7 completed pools with color-coded score matrices](docs/Demo/Screenshot%202026-02-16%20at%203.37.47%E2%80%AFAM.png)

### DE Bracket — Direct Elimination
![Full direct elimination bracket from Table of 16 through Final](docs/Demo/Screenshot%202026-02-16%20at%203.38.09%E2%80%AFAM.png)

### Coach View — Fencer Detail & Bradley-Terry Stats
![Coach fencer detail with Bradley-Terry strength ratings and trajectory chart](docs/Demo/Screenshot%202026-02-16%20at%203.37.13%E2%80%AFAM.png)

### Autonomous Agent — AI Reasoning Log
![Agent reasoning log showing AI decisions, announcements, and event auto-stop](docs/Demo/Screenshot%202026-02-16%20at%203.36.34%E2%80%AFAM.png)

## Tech Stack

Python 3.11 · FastAPI · React 18 · Vite · Anthropic SDK · WebSocket · Telegram Bot API · CSV data storage

## Data

Current fencing software does not offer public APIs. Connecting FenceFlow to live tournament systems requires federation approval. For this reason, the demo was simulated using real tournament data from 1 out of 30 tournament events hosted in November 2025, featuring 121 fencers, 18 pools, 10 referees, across 3 weapon events. Built solo in 6 days using Claude Code.

---

For detailed system design, see [`docs/design-doc.md`](docs/design-doc.md).
