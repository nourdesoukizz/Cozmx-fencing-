# TICKET-008: Bout Committee Dashboard — Frontend Implementation

## Metadata
| Field | Value |
|-------|-------|
| **ID** | TICKET-008 |
| **Title** | Bout Committee Dashboard Frontend |
| **Status** | COMPLETED |
| **Priority** | High |
| **Phase** | 2 — Frontend |
| **Depends On** | TICKET-001 (Backend API) |
| **Created** | 2025-02-10 |
| **Completed** | 2025-02-10 |
| **Last Updated** | 2026-02-10 |

## Summary
Built a React 18 single-page dashboard that connects to the FastAPI backend (port 3001) and displays tournament data with a premium "Steel & Silver" dark-themed operations UI.

## What Was Implemented

### Project Setup (3 files)
- `frontend/package.json` — React 18, react-router-dom, Vite 6
- `frontend/vite.config.js` — React plugin, dev server port 3000, proxy `/api` → localhost:3001
- `frontend/index.html` — Standard Vite entry with `#root` div, Inter font via Google Fonts

### Core App (4 files)
- `frontend/src/main.jsx` — ReactDOM.createRoot entry point
- `frontend/src/App.jsx` — BrowserRouter with routes (`/` landing, `/dashboard/*` protected, `/public`, `/coach`, `/referee`, catch-all redirect)
- `frontend/src/App.css` — "Steel & Silver" theme: metallic silver accent, deeper blacks, glass effects, venue map + pool matrix styles, responsive
- `frontend/src/api/client.js` — Fetch wrapper with all 7 backend endpoint methods

### Landing Page (1 new file)
- `frontend/src/components/landing/LandingPage.jsx` — Full-viewport landing with 4 role cards (Bout Committee, Public, Coach, Referee), 4-digit code auth, sessionStorage persistence, shake animation on invalid code

### Notification System (2 files)
- `frontend/src/context/NotificationContext.jsx` — React context with `addNotification(type, title, msg)`, auto-dismiss 5s
- `frontend/src/components/shared/Toast.jsx` — Fixed bottom-right toast stack with type colors + progress bar

### Shared Components (2 files)
- `frontend/src/components/shared/StatusBadge.jsx` — Color-coded status pill component
- `frontend/src/utils/formatters.js` — `formatRefereeName`, `formatEventShort`, `formatFencerName`, etc.

### Dashboard Components (5 files)
- `frontend/src/components/dashboard/DashboardPage.jsx` — Main page: `Promise.all` data fetch, tournament header, tab bar (Venue Map, Pool Progress, Referees), refresh button, back-to-home link
- `frontend/src/components/dashboard/StripBoard.jsx` — Thin wrapper rendering VenueMap
- `frontend/src/components/dashboard/VenueMap.jsx` — CSS grid venue floor plan with 3 areas (F/D/C), 18 strips, color-coded tiles, click-to-open detail panel with fencer list
- `frontend/src/components/dashboard/PoolProgress.jsx` — Grid of PoolTable matrices grouped by event, progress bars, search filter
- `frontend/src/components/dashboard/PoolTable.jsx` — NxN round-robin matrix per pool: fencer last names as row headers, diagonal blacked out, bout cells dashed
- `frontend/src/components/dashboard/RefereePanel.jsx` — Sortable referee table, expandable assignment details, summary stats

### Placeholder Pages (3 files)
- `frontend/src/components/public/PublicPage.jsx` — "Coming soon" with back-to-home link (open access)
- `frontend/src/components/coach/CoachPage.jsx` — "Coming soon" with protected route (code: 5678)
- `frontend/src/components/referee/RefereePortal.jsx` — "Coming soon" with protected route (code: 9012)

## Key Design Decisions
- **Role-based landing page** with 4-digit codes stored in sessionStorage
- **Visual venue floor plan** replacing generic card grid (F-area: 8 strips, D-area: 6 strips, C-area: 4 strips)
- **Round-robin matrix tables** replacing flat pool lists
- **"Steel & Silver" theme** — metallic silver accent (#c0c0c0), deeper blacks, glass backdrop-filter, Inter font
- **No WebSockets** — fetch on load + manual refresh button
- **Vanilla CSS** with CSS variables (no Tailwind)
- **Toast notifications** for frontend feedback
- **Proxy config** routes `/api` to backend port 3001
- **Access codes**: Bout Committee=1234, Coach=5678, Referee=9012, Public=open

## Routing
```
/              → LandingPage (role selection)
/dashboard/*   → DashboardPage (requires bout committee code)
/public        → PublicPage (open access placeholder)
/coach         → CoachPage (requires code, placeholder)
/referee       → RefereePortal (requires code, placeholder)
*              → redirect to /
```

## Data Flow
```
DashboardPage (fetches all data on mount via Promise.all)
  ├── api.getTournamentStatus() → tournament header
  ├── api.getPools()            → VenueMap (StripBoard), PoolProgress
  └── api.getReferees()         → RefereePanel
```

## Verification Steps
1. Backend: `cd backend && python main.py` (port 3001)
2. Frontend: `cd frontend && npm run dev` (port 3000)
3. Open `http://localhost:3000` → landing page with 4 role cards
4. Enter bout committee code (1234) → navigates to `/dashboard`
5. Venue Map tab: 3 areas (F/D/C), 18 strips, click a strip shows detail panel
6. Pool Progress tab: round-robin matrices grouped by event with progress bars
7. Referees tab: sortable table, expandable assignments
8. Public/Coach/Referee cards navigate to placeholder pages
9. Toast notifications on data load, auto-dismiss after 5s
10. `vite build` succeeds with no errors

## Files NOT Modified (kept as stubs for future tickets)
- `PoolReview.jsx`, `AnomalyFeed.jsx` — TICKET-005 (OCR phase)
- `ConflictReport.jsx` — removed concept (Fencing Time handles it)
- `TournamentContext.jsx`, `useSocket.js` — future WebSocket phase
