# TICKET-015: Bout Committee Dashboard Enhancements

## Metadata
| Field | Value |
|-------|-------|
| **ID** | TICKET-015 |
| **Title** | Dashboard Enhancements: Stop Event, Individual Pings, Pool Status Fix, Post-Approval Editing |
| **Status** | COMPLETED |
| **Priority** | High |
| **Phase** | 2 — Frontend + Backend |
| **Depends On** | TICKET-008 (Dashboard), TICKET-003 (SMS) |
| **Created** | 2026-02-11 |
| **Completed** | 2026-02-11 |
| **Last Updated** | 2026-02-11 |

## Summary
Five enhancements to the bout committee dashboard addressing UX gaps: incorrect pool default status, missing stop-event capability, mass-only referee pinging, non-editable approved pools, and missing notification passthrough.

## What Was Implemented

### 1. Pool Status Fix — "Completed" → "Not Reported"
- **Backend** `data_loader.py:138`: Default pool status changed from `"completed"` to `"not_reported"`
- **Frontend** `App.css`: Added `.status-badge.not_reported` style (orange)
- StatusBadge `capitalize()` converts `not_reported` → "Not reported" automatically

### 2. Stop Event (Backend + Frontend)
- **Backend** `routers/tournament.py`: Added `POST /api/tournament/events/{event_name}/stop`
  - Validates event exists and is currently `"started"`
  - Sets status to `"stopped"` and broadcasts WebSocket `event_stopped`
  - Stopped events block uploads (status != "started")
  - Stopped events can be restarted via existing `/start` endpoint
- **Frontend** `DashboardPage.jsx`: Added `handleStopEvent()`, WebSocket handler for `event_stopped`
- **Frontend** event cards: Three-state UI (not_started → started → stopped)
  - Started: shows "Stop Event" (red) + "Ping Referees" (blue)
  - Stopped: shows "Restart Event" (green) + orange status tag
- **Frontend** `App.css`: Added `.event-status-tag.stopped`, `.stop-event-btn` styles

### 3. Individual Referee Pinging with Message Types
- **Backend** `routers/referees.py`: Added `POST /api/referees/{referee_id}/ping`
  - Request body: `{"message_type": "report_to_captain"|"pool_sheet_reminder"|"custom", "custom_message": ""}`
  - Three message templates with SMS via existing `send_sms()`
- **Frontend** `api/client.js`: Added `pingReferee()` method
- **Frontend** `RefereePanel.jsx`: Per-referee "Ping" button with dropdown menu
  - Three options: "Report to Captain", "Pool Sheet Reminder", "Custom Message"
  - Custom message shows inline text input with Enter-to-send
- **Frontend** `App.css`: Added `.ping-ref-btn`, `.ping-menu`, `.ping-menu-item`, `.ping-custom-input` styles

### 4. Edit Approved Pools (Post-Approval Editing)
- **Backend**: Already supports re-approval (no changes needed)
- **Frontend** `PoolProgress.jsx`: `handlePoolClick` now accepts `approved` status
- **Frontend** `PoolTable.jsx`: Approved pools with onClick show green "Edit" indicator
- **Frontend** `PoolReview.jsx`: Button text changes to "Save Changes" for already-approved pools
- **Frontend** `App.css`: Added `.approved-editable`, `.edit-indicator` styles

### 5. Notification Passthrough
- **Frontend** `DashboardPage.jsx`: Passes `addNotification` prop to `RefereePanel`

## Files Changed
| File | Changes |
|------|---------|
| `backend/data_loader.py` | Pool default status → `"not_reported"` |
| `backend/routers/tournament.py` | Added `POST /events/{name}/stop` endpoint |
| `backend/routers/referees.py` | Added `POST /{id}/ping` endpoint with message types |
| `frontend/src/api/client.js` | Added `stopEvent`, `pingReferee` methods |
| `frontend/src/components/dashboard/DashboardPage.jsx` | Stop event handler, WebSocket, notification prop |
| `frontend/src/components/dashboard/PoolProgress.jsx` | Allow clicking approved pools |
| `frontend/src/components/dashboard/PoolTable.jsx` | Edit indicator for approved pools |
| `frontend/src/components/dashboard/PoolReview.jsx` | "Save Changes" label for re-edits |
| `frontend/src/components/dashboard/RefereePanel.jsx` | Per-referee ping with message type menu |
| `frontend/src/App.css` | Stopped tag, not_reported badge, ping menu, edit indicator styles |

## Verification
1. Restart backend → all pools without submissions show "Not Reported" (orange badge)
2. Start event → "Stop Event" button appears → click → status "Stopped" (orange), uploads blocked
3. Click "Restart Event" on stopped event → returns to "Started"
4. Referees tab → "Ping" button on each row → dropdown with 3 message types → notification confirms
5. Pool Progress → click approved pool → review modal with "Save Changes" → editable scores
