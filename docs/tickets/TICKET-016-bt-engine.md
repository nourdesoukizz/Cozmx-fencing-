# TICKET-016: Bradley-Terry Live Probability Engine

## Status: Complete

## Summary
Replaced the conjugate normal-normal Bayesian model with a Bradley-Terry (BT) touch-level model that estimates all fencer strengths globally using the MM algorithm.

## Changes

### Backend
- **Created `backend/bt_engine.py`**: BTEngine class with MM algorithm (Hunter 2004), pool decomposition, trajectory tracking, pairwise comparison, Monte Carlo DE bracket simulation
- **Created `backend/data/manual_bouts.csv`**: Persistence for manually entered bouts
- **Modified `backend/main.py`**: Initialize BTEngine in lifespan, pass to coach router
- **Modified `backend/routers/coach.py`**: Replaced Bayesian calls with BT engine, added endpoints:
  - `POST /api/coach/bout` — add bout, refit, return state
  - `GET /api/coach/state` — full engine state with strengths/ranks/win probs
  - `GET /api/coach/trajectory` — probability history for charts
  - `GET /api/coach/pairwise?a=NAME&b=NAME` — pairwise comparison
  - `POST /api/coach/bracket` — set DE bracket seedings
  - `GET /api/coach/simulate` — Monte Carlo DE simulation
  - `GET /api/coach/bouts` — all bouts reverse chronological
  - `GET /api/coach/fencer-names` — autocomplete names
- **Deleted `backend/bayesian_model.py`**: Replaced by bt_engine.py

### Frontend
- **Modified `frontend/src/api/client.js`**: Added `authPostJson` helper and 8 new API methods
- **Modified `frontend/src/components/coach/CoachPage.jsx`**: Tabbed layout (Dashboard, Bouts, Input, Matchup, Bracket)
- **Modified `frontend/src/components/coach/FencerList.jsx`**: BT columns (Rank, Strength, Win%, Record, TD)
- **Modified `frontend/src/components/coach/FencerDetailCard.jsx`**: BT fields, mini trajectory chart, upset badges
- **Created `frontend/src/components/coach/TrajectoryChart.jsx`**: Recharts line chart with fencer toggle
- **Created `frontend/src/components/coach/BoutFeed.jsx`**: Scrollable reverse-chronological bout list
- **Created `frontend/src/components/coach/BoutInput.jsx`**: Bout entry form with autocomplete
- **Created `frontend/src/components/coach/MatchupLookup.jsx`**: Pairwise comparison tool
- **Created `frontend/src/components/coach/DEBracket.jsx`**: Bracket entry + Monte Carlo simulation table
- **Modified `frontend/src/App.css`**: Tab bar, trajectory chart, bout feed/input, matchup, bracket styles
- **Modified `frontend/package.json`**: Added recharts dependency
- **Deleted `frontend/src/components/coach/MatchupCard.jsx`**: Replaced by MatchupLookup.jsx

## Model Details
- **Bradley-Terry**: P(i scores on j) = s_i / (s_i + s_j)
- **MM Algorithm**: Iterative strength estimation with prior_weight=0.3 regularization
- **Rating mapping**: A=32, B=16, C=8, D=4, E=2, U=1
- **Trajectory**: Strength snapshots after each refit for time-series visualization
- **Monte Carlo**: 10,000 simulations for DE bracket win probabilities

## Metadata
- **Priority**: High
- **Type**: Feature (replacement)
- **Module**: Coach Analytics
- **Files created**: 7
- **Files modified**: 8
- **Files deleted**: 2
