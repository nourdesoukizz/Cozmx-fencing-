# FenceFlow

## AI-Powered Fencing Tournament Operations Platform

**Design Document v2.0**
**Anthropic Hackathon Submission**
**February 2026**

*Problem Statement One: Build a Tool That Should Exist — Eliminate busywork. Make hard things effortless.*

---

## 1. Executive Summary

FenceFlow is an AI-powered operations layer designed to eliminate paper-based workflows and manual data entry from fencing tournament day operations. It serves as a companion tool to current fencing software (such as Fencing Time), by handling the physical logistics that current software does not address: referee communication, score sheet digitization, live result reporting, real-time tournament monitoring, and AI-driven performance analytics for coaches.

**The Problem:** Running a fencing tournament today requires an army of volunteers performing low-value manual tasks. Referees receive verbal strip assignments and walk paper score sheets to the bout committee table. Bout committee members hand-enter scores from often-illegible handwriting. Results lag behind the actual competition by 15-30 minutes. Errors in transcription affect fencer seeding and can invalidate legitimate results. Coaches have zero data-driven insight into how their fencers are performing relative to the field — they rely on gut feel and memory. A single local tournament with 60 fencers requires 8-12 volunteers doing work that software should handle.

**The Solution:** FenceFlow digitizes the operational layer of tournament day. Referees receive automated SMS notifications with strip assignments and web-based links for score reporting. Pool score sheets are photographed and processed by Claude Vision AI, which extracts structured data and flags anomalies for bout committee review. DE bout results are reported digitally with real-time bracket updates. Coaches get a dedicated analytics view with Bayesian performance modeling that updates live as the tournament progresses — answering the question "how is my fencer really performing today?" with statistical rigor. The bout committee monitors everything from a live dashboard. No paper walks. No manual data entry. No transcription errors.

**Hackathon Scope:** For this hackathon, FenceFlow operates on simulated tournament data from a real tournament the developer has hosted. It demonstrates the full operational workflow from pool round through DE finals, with AI-powered score extraction, smart referee assignment, Bayesian performance analytics, and live tournament monitoring.

---

## 2. System Overview

### 2.1 What FenceFlow IS

- An operations companion to current fencing software that handles tournament day logistics
- A communication system between the bout committee, referees, coaches, and spectators
- An AI-powered score digitization and validation tool
- A Bayesian performance analytics platform for coaches
- A real-time tournament monitoring dashboard

### 2.2 What FenceFlow is NOT

- Not a replacement for current fencing software (no registration, no pool generation algorithm, no USA Fencing integration)
- Not a scoring machine interface (does not connect to electronic scoring devices)
- Not an official results submission system (does not submit to USA Fencing)

### 2.3 System Architecture

FenceFlow is a web application with four interfaces serving four user types:

| Interface | User | Access Method | Primary Function |
|-----------|------|---------------|------------------|
| Bout Committee Dashboard | Tournament organizer / bout committee | Laptop browser (authenticated) | Monitor and manage entire tournament |
| Referee Portal | Assigned referees | Phone/iPad via SMS link (token-authenticated) | Receive assignments, report scores |
| Coach View | Coaches | Phone/iPad/Laptop via URL + 4-digit access code | Performance analytics, win probability, Bayesian skill updates |
| Public View | Parents, fencers, spectators | Phone browser via QR code (public, read-only) | View live results and brackets (no analytics) |

### 2.4 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend | React (single-page application) | Works on laptops and iPads, single codebase, real-time updates |
| Backend | Python with FastAPI | Fast development, auto-generated API docs, async support, great WebSocket support |
| Data Storage | CSV files loaded into memory | Zero-config, no database setup, CSV files from real tournament data |
| Real-time Updates | WebSockets (Socket.io) | Live dashboard, live bracket, live coach analytics, live spectator view |
| SMS Notifications | Twilio API | Industry standard, free trial credit, simple API |
| AI / OCR | Claude API (Vision + Text) | Pool sheet extraction, anomaly detection, performance insights |
| Bayesian Model | Custom implementation (Python) | Posterior skill estimation with live updating |
| Hosting | Local machine for demo (deployable to any Python host) | Simplicity for hackathon demo |

---

## 3. Data Model

FenceFlow operates on tournament data that would normally come from a current fencing software export. For the hackathon, this data is simulated from a real tournament the developer has hosted. All entities below are stored in csv files under backend/data.

### 3.1 Core Entities

#### Tournament

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique tournament identifier |
| name | TEXT | Tournament name (e.g., 'Rochester Open 2025') |
| date | DATE | Tournament date |
| venue | TEXT | Venue name and address |
| status | ENUM | setup, pools_active, pools_complete, de_active, de_complete, finished |
| weapon | TEXT | Foil, Epee, or Sabre |
| coach_access_code | TEXT | 4-digit code for coach view authentication |
| created_at | TIMESTAMP | Record creation time |

#### Fencer

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique fencer identifier |
| first_name | TEXT | Fencer first name |
| last_name | TEXT | Fencer last name |
| club | TEXT | Club affiliation |
| rating | TEXT | USFA rating (e.g., A24, B23, C25, U) |
| seed | INTEGER | Initial tournament seeding based on rating |
| status | ENUM | active, withdrawn_medical, withdrawn_other, scratched |
| phone | TEXT (nullable) | Phone number for notifications (optional for fencers) |

#### Referee

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique referee identifier |
| first_name | TEXT | Referee first name |
| last_name | TEXT | Referee last name |
| rating | TEXT | Referee rating (N1, N2, R1, R2, D1, D2, P1, P2) |
| club | TEXT | Club affiliation (used for conflict detection) |
| weapon_certified | TEXT | Weapons certified to referee |
| phone | TEXT | Phone number for SMS notifications (required) |
| bouts_assigned | INTEGER | Running count of bouts assigned this tournament |
| status | ENUM | available, assigned, on_break, unavailable |

#### Pool

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique pool identifier |
| pool_number | INTEGER | Pool number (1, 2, 3, etc.) |
| strip_number | INTEGER | Assigned strip number |
| referee_id | FK (Referee) | Assigned referee |
| status | ENUM | pending, in_progress, photo_uploaded, ai_extracted, committee_reviewed, complete |
| photo_url | TEXT (nullable) | URL to uploaded pool score sheet photo |
| ai_extraction_raw | JSON (nullable) | Raw AI extraction output before committee review |
| ai_confidence | FLOAT (nullable) | Overall AI confidence score for extraction |
| anomalies | JSON (nullable) | Flagged anomalies from AI validation |
| reviewed_by | TEXT (nullable) | Name of bout committee member who reviewed |
| reviewed_at | TIMESTAMP (nullable) | When the review was completed |

#### PoolBout

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique bout identifier |
| pool_id | FK (Pool) | Parent pool |
| bout_order | INTEGER | Standard USFA bout order position |
| fencer_left_id | FK (Fencer) | Left fencer |
| fencer_right_id | FK (Fencer) | Right fencer |
| score_left | INTEGER (nullable) | Left fencer score (0-5) |
| score_right | INTEGER (nullable) | Right fencer score (0-5) |
| winner_id | FK (Fencer, nullable) | Winner of bout |
| status | ENUM | pending, complete |

#### PoolResult (computed after pool completion)

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique result identifier |
| pool_id | FK (Pool) | Parent pool |
| fencer_id | FK (Fencer) | Fencer |
| victories | INTEGER | Number of victories in pool |
| bouts_fenced | INTEGER | Total bouts fenced |
| touches_scored | INTEGER | Total touches scored (TS) |
| touches_received | INTEGER | Total touches received (TR) |
| indicator | INTEGER | TS minus TR |
| pool_place | INTEGER | Place within pool |

#### DEBout

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique DE bout identifier |
| round | TEXT | Round name (T64, T32, T16, T8, Semi, Final) |
| bout_number | INTEGER | Position in bracket |
| strip_number | INTEGER (nullable) | Assigned strip |
| referee_id | FK (Referee, nullable) | Assigned referee |
| fencer_top_id | FK (Fencer, nullable) | Top seed fencer |
| fencer_bottom_id | FK (Fencer, nullable) | Bottom seed fencer |
| score_top | INTEGER (nullable) | Top fencer score (0-15) |
| score_bottom | INTEGER (nullable) | Bottom fencer score (0-15) |
| winner_id | FK (Fencer, nullable) | Winner of bout |
| status | ENUM | pending, assigned, in_progress, complete |
| signature_winner | TEXT (nullable) | Base64-encoded digital signature from winner |
| signature_loser | TEXT (nullable) | Base64-encoded digital signature from loser |
| reported_at | TIMESTAMP (nullable) | When result was reported |

#### FencerSkillEstimate (Bayesian model output)

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique estimate identifier |
| fencer_id | FK (Fencer) | Fencer being estimated |
| prior_mean | FLOAT | Prior skill estimate based on USFA rating |
| prior_variance | FLOAT | Prior uncertainty (higher for unrated fencers) |
| posterior_mean | FLOAT | Updated skill estimate after observed bouts |
| posterior_variance | FLOAT | Updated uncertainty (shrinks with more evidence) |
| confidence_low | FLOAT | Lower bound of 80% credible interval |
| confidence_high | FLOAT | Upper bound of 80% credible interval |
| performance_label | TEXT | Plain-English label (e.g., 'Performing at B-level') |
| bouts_observed | INTEGER | Number of bouts used in update |
| last_updated_at | TIMESTAMP | When this estimate was last recalculated |
| update_phase | TEXT | Phase when last updated: 'pools', 'de_T32', 'de_T16', etc. |

#### WinProbability (Coach View only)

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique record identifier |
| de_bout_id | FK (DEBout) | The DE bout this probability applies to |
| fencer_top_probability | FLOAT | Win probability for top fencer (0.0 - 1.0) |
| fencer_bottom_probability | FLOAT | Win probability for bottom fencer (0.0 - 1.0) |
| insight | TEXT | Claude-generated one-line tactical insight |
| calculated_at | TIMESTAMP | When this was calculated |

#### Strip

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Unique strip identifier |
| strip_number | INTEGER | Physical strip number in venue |
| status | ENUM | available, pool_active, de_active, issue, maintenance |
| current_pool_id | FK (Pool, nullable) | Currently running pool |
| current_de_bout_id | FK (DEBout, nullable) | Currently running DE bout |

#### NarratorEvent

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER (PK) | Event identifier |
| event_type | TEXT | pool_complete, upset, de_result, milestone, pace_update |
| raw_data | JSON | Structured event data that triggered the narration |
| narration | TEXT | AI-generated natural language narration |
| created_at | TIMESTAMP | When event was generated |

---

## 4. Core Features

These features constitute the minimum viable demo. They must all work end-to-end before any extra features are attempted. Phases correspond to build days.

### Phase 1: Data Foundation and Smart Referee Assignment (Day 1-2)

#### 4.1 Tournament Data Import

**What it does:** Loads simulated tournament data into FenceFlow. This data mirrors what current fencing software would export: fencer list with ratings, pool assignments with fencer placements, strip numbers, and referee roster.

**Data Source:** A JSON seed file created by the developer based on a real tournament they hosted. This file contains all fencers (with names, clubs, ratings), all referees (with names, ratings, club affiliations, phone numbers), pool assignments (which fencers are in which pool), and strip assignments.

**Why JSON and not CSV:** JSON preserves structure and nested relationships. The seed file is a single source of truth that can be loaded in one operation. In a production version, this would be replaced by a database connector or CSV import from current fencing software.

The seed file structure:

- tournament: name, date, venue, weapon, coach_access_code
- fencers[]: id, first_name, last_name, club, rating, seed
- referees[]: id, first_name, last_name, rating, club, weapon_certified, phone
- pools[]: pool_number, fencer_ids[] (as assigned by current fencing software)
- strips[]: strip_number (total available strips in venue)

**Implementation Notes for Claude Code:** Create a seed.json file with realistic data from the developer's actual tournament (names changed for privacy). Write a database initialization script that reads seed.json and populates all SQLite tables. Include a reset function to re-initialize the database for demo purposes. Validate that all foreign key relationships are intact after seeding. Generate a random 4-digit coach_access_code and display it on the bout committee dashboard.

#### 4.2 Smart Referee Assignment

**What it does:** Automatically assigns referees to pools and DE bouts based on their rating, weapon certification, club conflicts, and workload balance. This replaces the manual process where the bout committee looks at a list of referees and assigns them by hand while trying to remember who has conflicts with whom.

The assignment algorithm follows these rules in priority order:

1. **Weapon Match:** Referee must be certified in the weapon being fenced.
2. **Conflict of Interest:** Referee must NOT share a club affiliation with any fencer in the assigned pool or DE bout. This is a USA Fencing rule and a real source of errors in manual assignment.
3. **Rating Match:** Higher-rated referees (N1, N2) are assigned to higher-stakes bouts (later DE rounds, pools with top-seeded fencers). Lower-rated referees handle earlier rounds.
4. **Workload Balance:** The system distributes bouts evenly across available referees. No referee should be assigned 3 pools while another has 1, unless rating requirements demand it.
5. **No Repeat Assignment:** In DE rounds, avoid assigning the same referee to the same fencer in consecutive rounds (when possible).

**Output:** Each pool and DE bout gets a referee_id. The system generates a conflict report showing how many conflicts were automatically prevented. This report is shown to the bout committee and is a key demo talking point.

**Implementation Notes for Claude Code:** Build this as a standalone assignment function that takes the list of pools (with fencer club data) and the list of available referees as input, and returns assignments. Use a greedy algorithm: sort pools/bouts by priority (top-seeded first), then for each, filter eligible referees (weapon match, no conflicts), then pick the one with the lowest workload. Log every conflict detected. Store assignments in the Pool and DEBout tables.

### Phase 2: Referee Communication and Pool Score Workflow (Day 2-3)

#### 4.3 SMS Notification System

**What it does:** Sends text messages to referees with their strip assignments and a unique link to their scoring portal. Each referee receives a personalized message at two points: when pools are ready and when their DE bout is assigned.

SMS message format for pools:

> *[FenceFlow] You are assigned to Pool 3 on Strip 7. Tap the link below to begin: https://fenceflow.app/ref/{unique_token}*

SMS message format for DE:

> *[FenceFlow] DE Round of 32 - Strip 4. Smith vs. Jones. Tap to report: https://fenceflow.app/ref/{unique_token}*

**Authentication:** Each SMS link contains a unique, single-use token tied to the referee and the specific assignment. No login required. The token expires after the assignment is complete. This is critical because referees are busy and will not create accounts or type passwords.

**Twilio Setup:** Use Twilio free trial. Pre-verify all demo phone numbers in the Twilio console before the demo. For the demo, have 2-3 real phone numbers verified so live SMS can be shown. For all other referees in the simulation, log the SMS to the console without sending.

**Implementation Notes for Claude Code:** Create a notification service that wraps the Twilio API. The service should have two methods: sendPoolAssignment(referee, pool) and sendDEAssignment(referee, deBout). Generate unique tokens using crypto.randomUUID(). Store tokens in a tokens table with referee_id, assignment_type, assignment_id, and expiry. The referee portal authenticates solely by token validation.

#### 4.4 Pool Score Sheet OCR Pipeline

**What it does:** Referees fill out the standard USFA paper pool score sheet by hand (as they do today), then photograph it using the link they received via SMS. The photo is uploaded to the system. Claude Vision API extracts the structured score data from the photograph. The system validates the extraction and flags anomalies. The bout committee reviews and approves the extracted data.

The pipeline has five steps:

1. **Photo Upload:** The referee taps the link from SMS, which opens a mobile-friendly web page. The page shows a camera button. The referee takes a photo of the completed, signed pool score sheet. The photo is uploaded to the server and stored. Pool status changes to `photo_uploaded`.

2. **AI Extraction:** The server sends the photo to the Claude Vision API with a carefully crafted prompt. The prompt includes the exact pool structure (number of fencers, their names in order) so Claude knows what to extract. Claude returns a structured JSON object with all bout scores, victories, touches scored, touches received, and indicators for each fencer.

3. **Anomaly Detection (Core Feature):** Simultaneously with extraction, the system validates the extracted data against fencing rules. See section 4.5 for the full list of anomaly checks. Any anomalies are flagged and stored in the pool record.

4. **Bout Committee Review:** The bout committee dashboard shows the extracted data alongside the original photo. Anomalies are highlighted in yellow/red. The committee member can edit any value, then click 'Approve' to finalize. Pool status changes to `committee_reviewed`.

5. **Pool Completion:** Once approved, the system calculates final pool results (V, TS, TR, Indicator, Place) and stores them. Pool status changes to `complete`. These results feed into DE seeding and trigger the first Bayesian skill update for all fencers in the pool.

**Claude Vision API Prompt Strategy:** The prompt must be extremely specific to get reliable extraction. It should include:

- The exact number of fencers in the pool (e.g., 'This is a pool of 6 fencers')
- The fencer names in order as they appear on the sheet (e.g., 'Fencer 1: Smith, Fencer 2: Jones, ...')
- A description of the USFA pool sheet format: 'The score sheet is a grid where rows and columns represent fencers. Cell (i,j) contains the score that fencer i scored against fencer j. The diagonal is blacked out. V/D indicators may appear next to scores.'
- An explicit request for structured JSON output with a defined schema
- A request to include a confidence score (0-1) for each cell extraction

**Fallback:** If OCR extraction fails or confidence is below 0.5, the system presents an empty digital form for the bout committee to fill in manually. The photo is still stored as the official record.

**Implementation Notes for Claude Code:** Create an OCR service that takes the photo file path and pool metadata as input. Use the Anthropic SDK to call Claude Vision with a base64-encoded image. Parse the JSON response. Store raw extraction in pool.ai_extraction_raw and confidence in pool.ai_confidence. Build the review UI as a side-by-side layout: photo on the left, editable data grid on the right, anomalies listed below. Use WebSockets to push new photo uploads to the bout committee dashboard in real-time.

#### 4.5 Anomaly Detection on Pool Sheets

**What it does:** When Claude extracts scores from a pool sheet photo, the system runs a battery of validation checks against the extracted data. Anomalies are flagged for bout committee attention. This is built INTO the OCR pipeline, not as a separate feature.

Validation checks performed:

1. **Indicator Sum Check:** The sum of all indicators in a pool must equal zero. If it does not, there is a math or transcription error somewhere. Flag: *'Indicators do not sum to zero. Difference: +3. Check bout scores for Fencer 2 and Fencer 5.'*

2. **Score Range Check:** Pool bout scores must be between 0 and 5. No score can exceed 5. Flag: *'Fencer 3 vs Fencer 4: score of 7 detected. Maximum is 5.'*

3. **Winner Must Have 5:** In a pool bout, the winner must have exactly 5 touches (unless time expired, in which case the higher score wins). If both scores are below 5, time may have expired. Flag: *'Bout 3: Neither fencer reached 5 touches (3-2). Verify if time expired.'*

4. **Symmetry Check:** If fencer A scored X against fencer B, then fencer B's 'against' score from fencer A should also be X. The grid should be internally consistent. Flag: *'Score mismatch: Fencer 1 vs Fencer 3 shows 5-2, but Fencer 3 vs Fencer 1 shows 5-3. Verify.'*

5. **Victory Count Check:** The number of V's for a fencer should match the count of bouts where their score was higher. Flag: *'Fencer 2 has 4 victories marked but only won 3 bouts by score.'*

6. **Rating Upset Alert:** If an unrated or low-rated fencer (E or U) defeats a much higher-rated fencer (A or B) 5-0, this is unusual (though legitimate). Flag as informational: *'Potential upset: Unrated fencer Chen defeated B24-rated fencer Williams 5-0. Please verify scores.'*

**Severity Levels:** Errors (red) are mathematical impossibilities that must be corrected before approval. Warnings (yellow) are unusual results that should be verified but may be legitimate. Informational (blue) are notable results for the bout committee's awareness.

**Implementation Notes for Claude Code:** Build a validatePoolExtraction(extractedData, poolMetadata) function. This function takes the AI-extracted JSON and the known pool metadata (fencer count, fencer ratings) and returns an array of anomaly objects, each with type, severity, message, and affected cells. Run this function immediately after Claude extraction, before presenting to the bout committee. Display anomalies in the review UI with color coding. Errors must be resolved before the 'Approve' button is enabled.

### Phase 3: DE Round and Live Tournament State (Day 3-4)

#### 4.6 DE Bracket Generation

**What it does:** Once all pools are complete and approved, the system generates the DE bracket (tableau) based on pool results. Fencers are seeded by: victories (descending), then indicator (descending), then touches scored (descending).

Seeding follows standard USFA rules:

- All fencers are ranked by pool performance across all pools
- The DE tableau size is the next power of 2 equal to or greater than the number of promoted fencers (if 24 fencers promoted, tableau of 32 with 8 byes)
- Seed 1 faces the last seed, seed 2 faces the second-to-last, etc.
- Byes go to the highest seeds

**Implementation Notes for Claude Code:** Build a generateDEBracket(poolResults, promotionCount) function. Take all pool results, rank them, determine tableau size, and create DEBout records with fencer_top_id and fencer_bottom_id populated. Byes should create DEBout records where fencer_bottom_id is NULL and status is immediately 'complete' with the bye fencer as winner. Populate the next round's bouts when both feeder bouts are complete. This is a recursive bracket structure — each bout knows its 'feeds into' bout.

#### 4.7 DE Score Reporting

**What it does:** When a DE bout is assigned, the referee receives an SMS with a link. The link opens a mobile-friendly page showing the two fencer names, their seeds, and their ratings. The referee reports the winner and the final score. Both fencers digitally sign on the screen. The result is submitted and the bracket updates live.

The referee DE portal shows:

- Fencer names, seeds, and ratings
- Two input fields: score for fencer A and score for fencer B
- Validation: one score must be exactly 15 (or both below 15 if time expired, with one higher than the other)
- Two signature canvas areas (one per fencer)
- Submit button (disabled until both scores and both signatures are entered)

**Note:** Win probability is NOT shown on the referee portal. It is exclusively available on the Coach View to prevent fencers from seeing discouraging probability numbers.

**Digital Signatures:** Use an HTML5 canvas element for signature capture. The fencer signs with their finger on the iPad/phone screen. The signature is stored as a base64-encoded PNG. This replaces the paper DE score sheet signature. The signed pool sheet photo serves as the signature record for pool rounds.

**After Submission:** The bout status changes to 'complete.' The bracket advances the winner to the next round. If the next round's bout now has both fencers populated, that bout becomes 'pending' (ready for referee assignment). WebSocket events push the updated bracket to all connected dashboards, coach views, and public views. The Bayesian skill model is re-run for both fencers with the new DE bout as additional evidence.

**Implementation Notes for Claude Code:** Build the referee DE portal as a React component. Use a canvas library (e.g., react-signature-canvas or a simple HTML5 canvas implementation) for signatures. On submit, POST the result to the API. The API validates scores, updates the DEBout record, advances the bracket, triggers Bayesian model update for both fencers, calculates win probability for the next round's bouts, and emits WebSocket events. Build the bracket visualization as a React component that renders a standard tournament bracket using flexbox or CSS grid. The bracket should update in real-time via WebSocket.

#### 4.8 Bout Committee Dashboard

**What it does:** The central command center for the tournament organizer. Shows the state of every pool, every DE bout, every strip, and every referee in real-time. This is the primary interface the bout committee uses to run the tournament.

Dashboard sections:

1. **Strip Status Board:** A grid showing every strip in the venue. Each strip shows its current status (available/pool active/DE active/issue), the pool or bout currently on it, the assigned referee, and time elapsed. Color-coded: green (active), yellow (needs attention), red (issue), grey (available).

2. **Pool Progress:** List of all pools with status indicators. Pools transition through: pending → in_progress → photo_uploaded → ai_extracted → committee_reviewed → complete. The bout committee can click any pool to view the OCR review screen.

3. **DE Bracket:** Live bracket showing all completed and pending bouts. The bout committee can assign referees to upcoming bouts, reassign strips, and manage withdrawals.

4. **Referee Status:** List of all referees with their current assignment, bouts completed today, and availability status. The bout committee can mark referees as on break or unavailable.

5. **Anomaly Feed:** A live feed showing all anomalies detected by the AI, sorted by severity. Unresolved errors appear at the top. This is the bout committee's action queue.

6. **Conflict Report:** Summary of how many conflict-of-interest assignments were prevented and which referees were reassigned. Shown once after initial assignment.

7. **Coach Access Code Display:** Shows the current 4-digit coach access code so the bout committee can share it at the coaches' meeting.

**Implementation Notes for Claude Code:** Build the dashboard as a React single-page application with tabbed or panel-based layout. Use WebSockets (Socket.io) to push all state changes in real-time. The dashboard should never need to be refreshed. State updates include: pool status changes, DE bout results, referee status changes, new anomaly detections, and new narrator events. Use a REST API for initial data load and WebSockets for live updates.

### Phase 4: Coach View with Bayesian Performance Analytics (Day 4-5)

This is a priority feature because it provides genuine, lasting value to coaches beyond the hackathon. Coaches currently have zero data-driven tools during a tournament.

#### 4.9 Coach View Authentication

**What it does:** Provides a simple gate to keep the analytics view restricted to coaches. Not bulletproof security — just enough to prevent casual spectators from seeing win probability data.

**How it works:** The bout committee generates a 4-digit access code at tournament initialization. This code is shared verbally at the coaches' meeting (standard practice at every tournament). Coaches navigate to the coach view URL and enter the 4-digit code. The code is validated against the tournament record. Once entered, it persists in the browser session — no re-entry needed.

**Why not per-coach login:** Coaches are at a tournament, not at a desk. They will not create accounts. A shared access code is frictionless and matches the existing social contract (coaches already receive privileged information at coaches' meetings).

**Implementation Notes for Claude Code:** Build a simple React page at /coach that prompts for a 4-digit code. On submit, POST to /api/coach/auth with the code. If it matches tournament.coach_access_code, return a session token stored in localStorage. All subsequent coach API calls include this token. The API middleware checks the token before returning analytics data.

#### 4.10 Bayesian Performance Model

**What it does:** For every fencer in the tournament, the system maintains a running estimate of their "true skill level" using Bayesian updating. The prior comes from their USFA rating. The evidence comes from every bout they fence. The posterior updates live as the tournament progresses.

**The Math:**

**Prior:**
- Convert USFA rating to a numeric skill estimate (the prior mean):
  - A = 5.0, B = 4.0, C = 3.0, D = 2.0, E = 1.0, U = 0.5
  - Year recency bonus: current year = +0.3, one year old = +0.2, two years = +0.1, three+ years = 0
  - Example: B24 → 4.0 + 0.2 = 4.2, C22 → 3.0 + 0.0 = 3.0
- Prior variance reflects confidence in the rating:
  - Rated fencers (A-E): variance = 0.5 (moderate certainty)
  - Unrated fencers (U): variance = 2.0 (high uncertainty — we know very little)
  - Stale ratings (3+ years old): variance = 1.0 (the rating may no longer be accurate)

**Evidence (Likelihood):**
- Each bout produces an observation: the score differential against an opponent of known (estimated) skill
- In pools: a bout score of 5-1 against a B-rated fencer is stronger evidence than 5-4 against the same fencer
- In DE: a score of 15-8 is stronger evidence than 15-14
- The likelihood function models the probability of observing the score differential given the fencer's true skill versus the opponent's estimated skill
- Score differential is normalized: pool bouts divide by 5 (max pool score), DE bouts divide by 15 (max DE score)

**Posterior Update:**
- After each pool is completed, update the posterior for every fencer in that pool using all their bout results
- After each DE bout, update the posterior for both fencers using the new result
- The posterior mean shifts toward the evidence. Strong evidence (big upset or dominant win) shifts it more. Weak evidence (close score against similarly rated opponent) shifts it less.
- The posterior variance decreases with each bout (we become more certain)
- Use conjugate normal-normal updating for computational simplicity:
  - posterior_mean = (prior_mean / prior_variance + sum(observations) / observation_variance) / (1/prior_variance + n/observation_variance)
  - posterior_variance = 1 / (1/prior_variance + n/observation_variance)

**Credible Interval:**
- 80% credible interval: posterior_mean ± 1.28 × sqrt(posterior_variance)
- This gives the range within which the fencer's true skill likely falls

**Performance Label:**
- Map the posterior mean back to a letter rating for human readability:
  - 4.5+ = "Performing at A-level"
  - 3.5-4.5 = "Performing at B-level"
  - 2.5-3.5 = "Performing at C-level"
  - 1.5-2.5 = "Performing at D-level"
  - 0.5-1.5 = "Performing at E-level"
  - Below 0.5 = "Below rated performance"
- Compare posterior to prior for a delta label:
  - If posterior_mean > prior_mean + 0.5: "Fencing above their rating"
  - If posterior_mean < prior_mean - 0.5: "Fencing below their rating"
  - Otherwise: "Fencing at expected level"

**Implementation Notes for Claude Code:** Build a BayesianSkillModel class with the following methods:

- `initializePrior(fencer)`: Takes a fencer record, returns {mean, variance} based on rating conversion
- `updateWithPoolResults(fencerId, poolBouts)`: Takes all bouts from a completed pool for this fencer, computes observations (score differentials weighted by opponent skill), updates posterior
- `updateWithDEResult(fencerId, deBout)`: Takes a completed DE bout, computes observation, updates posterior
- `getEstimate(fencerId)`: Returns {prior_mean, posterior_mean, posterior_variance, confidence_low, confidence_high, performance_label, bouts_observed}
- `calculateWinProbability(fencerAId, fencerBId)`: Uses both fencers' posterior distributions to compute probability that fencer A beats fencer B. Uses the difference of two normals: P(A > B) = Φ((μA - μB) / sqrt(σA² + σB²)) where Φ is the standard normal CDF

Store all estimates in the FencerSkillEstimate table. Recalculate on every pool approval and every DE bout completion. Emit WebSocket events to push updated estimates to connected coach views.

#### 4.11 Coach View Interface

**What it does:** The coach's analytics dashboard. Shows all fencers in the tournament with their performance data. The coach can search/filter to find their fencers and drill into detailed analytics.

**The coach sees:**

**Fencer List View:**
- All fencers listed with: Name, Club, Rating, Seed, Status (active/eliminated), Posterior Skill Estimate, Performance Label
- Filterable by club (so a coach can quickly find their fencers)
- Sortable by any column
- Color-coded performance labels: green (above rating), grey (at rating), red (below rating)

**Fencer Detail Card (tap any fencer to expand):**
- **Header:** Name, Club, Rating, Seed
- **Prior vs Posterior:** Visual comparison showing where they started (rating) vs where they are now (posterior). Example: "Prior: 3.0 (C24) → Posterior: 3.8 (performing near B-level)"
- **Confidence Interval:** "Estimated skill range: 3.4 – 4.2" shown as a visual range bar
- **Pool Performance Summary:** V, TS, TR, Indicator, Pool Place
- **Bout-by-Bout Breakdown:** Each bout with opponent name, opponent rating, score, and how that bout shifted the posterior
- **DE Progress:** Each DE bout with opponent, score, and posterior update
- **AI Performance Insight:** A 2-3 sentence Claude-generated analysis. Example: *"Sarah is fencing well above her C24 rating today. Her 5-0 pool performance against a field that included two B-rated fencers is strong evidence of B-level ability. Her average touch margin of +3.2 suggests tactical dominance rather than narrow wins. Against her next opponent (Williams, B23), the posterior model gives her a 38% chance — closer than the raw rating gap suggests because of her dominant pool performance."*
- **Next Matchup (if in DE):** Opponent name, opponent rating, opponent posterior, win probability, and the Claude-generated insight

**Live Updates:** The coach view updates in real-time via WebSocket. When a pool is approved or a DE bout completes, the affected fencer cards update their posterior, performance label, and next matchup data without page refresh.

**Implementation Notes for Claude Code:** Build the coach view as a React route at /coach. After code authentication, load all fencer data with current estimates via GET /api/coach/fencers. Build the fencer list as a filterable/sortable table component. Build the detail card as an expandable panel. For the AI insight, call Claude text API with the fencer's full tournament data and ask for a 2-3 sentence coaching-oriented analysis. Cache insights per fencer per update phase to avoid redundant API calls. Listen on WebSocket for skill_estimate:updated events and refresh the affected fencer cards.

### Phase 5: Public View, Polish, and Extra Features (Day 5-6)

#### 4.12 Public View (Spectator)

**What it does:** A public, read-only web page accessible via QR code posted at the venue. Parents and fencers can see live results without approaching the bout committee table.

The public view shows:

- Pool results as they are approved (fencer name, V, TS, TR, Indicator, Place)
- Live DE bracket with completed results highlighted
- A search/filter to find a specific fencer and see their status

**What the public view does NOT show:**

- Win probability (coach-only)
- Bayesian skill estimates (coach-only)
- AI performance insights (coach-only)
- Referee assignments or anomaly data (bout committee-only)

**No Authentication:** This page is completely public. It loads via a URL or QR code. It receives real-time updates via the same WebSocket channel as the dashboard (but with a read-only, results-only event subset).

**Implementation Notes for Claude Code:** Build this as a separate React route (/public). Reuse the bracket component from the dashboard. Add a fencer search bar that filters the results. Use the same WebSocket connection but only listen for result events (not referee assignments, anomaly data, or skill estimates). Keep the UI mobile-first since most spectators will use phones. Include a large QR code generator on the bout committee dashboard so the bout committee can print/display it at the venue.

---

## 5. Extra Features (Post-Core, Priority Order)

These features are built ONLY after the core flow (Phases 1-5) works end-to-end. They are ordered by build priority. Cut from the bottom up as time requires.

### 5.1 Tournament Pace Predictor (Day 5-6)

**What it does:** Estimates when each upcoming round will complete based on the actual pace of the tournament so far. Updates continuously as bouts finish.

How it works:

- Track the timestamp of every pool completion and DE bout completion
- Calculate average time per pool and average time per DE bout
- For pool rounds: estimate completion as (remaining pools / active strips) × average pool time
- For DE rounds: estimate completion as (remaining bouts in round / active strips) × average bout time, plus buffer for setup
- Project forward to estimate when semifinals and finals will occur

**Display:** Show on the bout committee dashboard as 'Estimated Completion Times,' on the coach view as part of the tournament status header, and on the public view as 'Schedule.' Example: *'DE Round of 16: ~2:30 PM. Semifinals: ~3:15 PM. Finals: ~4:00 PM.'*

**Implementation Notes for Claude Code:** Build a PaceTracker class that records timestamps for each completed bout. Expose a getEstimates() method that returns projected times for each remaining round. Update estimates on every bout completion. Push updated estimates via WebSocket. Display as a simple timeline component.

### 5.2 AI Tournament Narrator (Day 6)

**What it does:** Generates natural language commentary about tournament events in real-time. These narrations appear on the public view and the dashboard as a live feed of tournament highlights.

Events that trigger narration:

- **Pool completion:** *'Pool 3 is complete. Highlight: unseeded Alex Chen went 5-0 with a dominant +17 indicator, the strongest pool performance of the tournament so far.'*
- **Major upset in DE:** *'Upset alert: 22nd seed Rivera defeats 11th seed Park 15-9 in the Round of 32. Rivera came in rated D24 but has been on fire since pools.'*
- **Milestone:** *'We are down to the final 8. Quarterfinals begin on Strips 1-4.'*
- **Pace update:** *'The tournament is running 15 minutes ahead of schedule. Finals projected for 3:45 PM.'*
- **Tournament complete:** *'Tournament complete! Gold: Smith. Silver: Jones. Bronze: Williams and Davis. 47 fencers competed across 8 pools and 5 DE rounds.'*

**Note:** Narration does NOT include win probability or skill estimates. That data is coach-only.

**Implementation Notes for Claude Code:** Build a NarratorService that listens for specific events (pool_complete, de_result, etc.). On each trigger, construct a prompt with the event data and call Claude text API with a system prompt: 'You are a fencing tournament commentator. Generate a 1-2 sentence narration for the following event. Be concise, informative, and occasionally witty. Use fencing terminology naturally. Do not include win probabilities or skill estimates.' Store the narration and emit via WebSocket. Rate-limit narration generation to avoid excessive API calls (max 1 per 30 seconds). Batch non-urgent events.

---

## 6. Detailed User Flows

### 6.1 Referee Flow — Pool Round

1. Referee receives SMS: *'[FenceFlow] You are assigned to Pool 3 on Strip 7. Tap to begin: [link]'*
2. Referee walks to assigned strip and calls roll of fencers
3. Referee conducts all pool bouts, recording scores on the standard USFA paper pool score sheet by hand (this does not change from current practice)
4. At the end of all pool bouts, each fencer reviews the score sheet and signs it physically
5. Referee taps the link from the SMS on their phone/iPad
6. The link opens a mobile page with a single button: 'Upload Pool Sheet Photo'
7. Referee photographs the completed, signed pool score sheet
8. Photo uploads to the server. Referee sees a confirmation: 'Photo uploaded. The bout committee will review shortly.'
9. Referee's pool assignment is complete. They are now available for reassignment.

### 6.2 Bout Committee Flow — Pool Review

1. Dashboard shows a notification: 'Pool 3 — Photo uploaded. Ready for review.'
2. Bout committee member clicks Pool 3 to open the review screen
3. Review screen shows: original photo on the left, AI-extracted data grid on the right
4. Anomalies are highlighted: errors in red (must fix), warnings in yellow (verify), info in blue
5. Committee member compares photo to extracted data. Edits any incorrect values by clicking the cell.
6. All errors must be resolved before the 'Approve' button is enabled
7. Committee member clicks 'Approve.' Pool status changes to 'complete.'
8. Pool results are calculated, seeding updates automatically, and Bayesian model updates for all fencers in the pool

### 6.3 Referee Flow — DE Round

1. Referee receives SMS: *'[FenceFlow] DE T32 — Strip 4. Smith (3) vs. Jones (14). Tap to report: [link]'*
2. Referee walks to assigned strip and conducts the bout (standard 15-touch or 3 periods)
3. After the bout ends, referee taps the link from SMS
4. The link opens a mobile page showing: Fencer A name/seed, Fencer B name/seed (no win probability — that is coach-only)
5. Referee enters both scores (e.g., 15-12)
6. System validates: one score must be 15, or if time expired both must be below 15 with one higher
7. Winner fencer signs on the canvas area on the screen
8. Loser fencer signs on the canvas area on the screen
9. Referee taps 'Submit Result'
10. Bracket updates live. Bayesian model updates for both fencers. Win probability recalculates for next round's bouts. Next round bout is populated if both feeder bouts are complete.

### 6.4 Coach Flow

1. Coach receives the 4-digit access code at the coaches' meeting
2. Coach navigates to the coach view URL on their phone/iPad/laptop
3. Coach enters the 4-digit code
4. Coach sees the full fencer list with performance labels and posterior estimates
5. Coach filters by club to find their fencers
6. Coach taps a fencer to see the detailed analytics card: prior vs posterior, confidence interval, bout-by-bout breakdown, AI-generated performance insight
7. When a fencer has a DE bout coming up, the card shows the opponent's data and win probability
8. All data updates live as pools are approved and DE bouts are reported
9. Coach uses insights to make tactical decisions: which actions worked, whether to adjust strategy for the next bout based on opponent's observed performance

### 6.5 Spectator Flow

1. Spectator scans QR code posted at the venue entrance or bout committee table
2. Their phone opens the public view web page (no app download, no login)
3. Spectator can view: current pool results, live DE bracket, search for a specific fencer
4. Results update in real-time as bouts are reported and approved
5. No analytics, no probability, no skill estimates — just results and brackets
6. AI narrator commentary appears as a live feed of tournament highlights (if narrator feature is built)

---

## 7. API Endpoints

All endpoints return JSON. Authentication is via session cookie (dashboard), token parameter (referee portal), or access code session (coach view). Public view endpoints require no authentication.

### 7.1 Tournament Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/tournament/init | Initialize tournament from seed data, run referee assignment | Dashboard |
| GET | /api/tournament/status | Get current tournament state (phase, progress) | Public |
| POST | /api/tournament/advance | Move to next phase (pools to DE) | Dashboard |

### 7.2 Pool Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/pools | List all pools with status | Dashboard |
| GET | /api/pools/:id | Get pool details with fencers and bouts | Dashboard/Referee |
| POST | /api/pools/:id/photo | Upload pool sheet photo (multipart form) | Referee (token) |
| POST | /api/pools/:id/extract | Trigger AI extraction on uploaded photo | Dashboard |
| PUT | /api/pools/:id/scores | Update extracted scores (committee edit) | Dashboard |
| POST | /api/pools/:id/approve | Approve pool results after review | Dashboard |

### 7.3 DE Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/de/bracket | Get full DE bracket with all bouts | Public |
| GET | /api/de/bouts/:id | Get specific bout details | Dashboard/Referee |
| POST | /api/de/bouts/:id/result | Submit bout result with scores and signatures | Referee (token) |
| POST | /api/de/bouts/:id/assign | Assign referee and strip to bout | Dashboard |

### 7.4 Referee Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/referees | List all referees with status and workload | Dashboard |
| PUT | /api/referees/:id/status | Update referee availability | Dashboard |
| POST | /api/referees/notify | Send SMS notifications to assigned referees | Dashboard |

### 7.5 Coach View

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/coach/auth | Validate 4-digit access code, return session token | None (code in body) |
| GET | /api/coach/fencers | Get all fencers with current skill estimates | Coach (session) |
| GET | /api/coach/fencers/:id | Get detailed fencer analytics with bout breakdown | Coach (session) |
| GET | /api/coach/fencers/:id/insight | Get Claude-generated performance insight | Coach (session) |
| GET | /api/coach/matchup/:boutId | Get win probability and matchup analysis for a DE bout | Coach (session) |

### 7.6 Public View

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/results/pools | Get all completed pool results | Public |
| GET | /api/results/de | Get current DE bracket and results (no probability) | Public |
| GET | /api/results/fencer/:id | Get specific fencer's results (no analytics) | Public |
| GET | /api/narrator/feed | Get recent narrator events | Public |
| GET | /api/pace | Get estimated completion times | Public |

### 7.7 WebSocket Events

| Event Name | Direction | Payload | Visible To |
|------------|-----------|---------|------------|
| pool:status_changed | Server → Client | {poolId, newStatus} | Dashboard |
| pool:photo_uploaded | Server → Client | {poolId} | Dashboard |
| pool:extraction_ready | Server → Client | {poolId, anomalyCount} | Dashboard |
| pool:approved | Server → Client | {poolId, results[]} | All |
| de:result | Server → Client | {boutId, winnerId, scores} | All |
| de:bracket_updated | Server → Client | {bracket} | All |
| referee:status_changed | Server → Client | {refereeId, status} | Dashboard |
| skill_estimate:updated | Server → Client | {fencerId, estimate} | Coach only |
| win_probability:updated | Server → Client | {boutId, probabilities} | Coach only |
| narrator:new_event | Server → Client | {event} | Dashboard, Public |
| pace:updated | Server → Client | {estimates} | All |
| strip:status_changed | Server → Client | {stripId, status} | Dashboard |

---

## 8. Build Timeline

Six days, solo developer, using Claude Code as the primary development tool. Each day has a clear deliverable and a definition of done.

| Day | Focus | Deliverable | Definition of Done |
|-----|-------|-------------|-------------------|
| Day 1 | Data model + referee assignment | SQLite schema, seed data, assignment algorithm with conflict detection | Can load tournament, assign referees, view conflict report in terminal |
| Day 2 | SMS + Pool OCR pipeline | Twilio integration, photo upload, Claude Vision extraction, anomaly detection | SMS sends to verified number. Photo upload works. Claude extracts scores. Anomalies are flagged. |
| Day 3 | Bout committee review UI + DE bracket | Review screen with photo/data/anomalies, bracket generation, DE score reporting | Bout committee can review, edit, approve pools. DE bracket generates. Referee can report DE result with signatures. |
| Day 4 | Coach View + Bayesian model | Access code auth, skill model, fencer list, detail cards, win probability | Coach can authenticate, view fencer list, see prior/posterior, see win probability for DE matchups. Model updates live. |
| Day 5 | Public view + live updates + polish | Spectator page, WebSocket integration across all four frontends, QR code, pace predictor | All four frontends work. Real-time updates flow. Spectator can view via QR. Pace estimates display. |
| Day 6 | AI narrator + demo prep + polish | Narrator feed, Claude performance insights, demo script, bug fixes | Full end-to-end demo works. AI insights appear on coach view. Video recorded or live demo rehearsed. |

---

## 9. Demo Strategy

### 9.1 The Narrative

The demo tells a story in two acts:

**Act 1 — The Problem (30 seconds):** Show or describe the current state. A tournament venue with paper everywhere. Referees walking pool sheets to a folding table. A volunteer squinting at handwriting and typing scores into current fencing software. A parent asking 'when does my kid fence next?' and nobody knowing. A coach trying to assess their fencer's real performance level with nothing but gut feel. A bout committee member discovering a transcription error that changed a fencer's seeding. This is every local fencing tournament in America.

**Act 2 — The Solution (2-3 minutes):** Live walkthrough of a simulated tournament:

1. Show the dashboard with the tournament loaded. Point out the smart referee assignment and conflict report: *'The system automatically prevented 3 conflict-of-interest assignments.'*
2. Show a referee's phone receiving an SMS. Click the link. Show the pool upload interface.
3. Upload a real pool sheet photo. Watch Claude extract the scores in real-time. Point out the anomaly detection: *'The system flagged that indicators don't sum to zero — there's a transcription error in bout 4.'*
4. Approve the corrected pool on the dashboard.
5. Switch to the Coach View. Show the Bayesian model updating: *'This C-rated fencer just went 5-0 against a pool with two B-rated fencers. The model has updated her estimated skill to B-level.'*
6. Show the DE bracket generate automatically. On the Coach View, show win probability for an upcoming matchup.
7. Show a DE result being reported with digital signatures. Watch the coach view update live — posterior shifts, win probability recalculates for the next round.
8. Show the public view — clean results and brackets, no analytics, accessible via QR code.
9. End with: *'Zero paper. Zero data entry. Zero transcription errors. Real-time analytics for coaches. One person can run what used to take twelve.'*

### 9.2 Demo Risk Mitigation

- Pre-load the tournament data so the demo starts with pools ready
- Have a pre-photographed pool sheet ready for the OCR demo (do not rely on taking a new photo live)
- Pre-verify Twilio phone numbers so SMS works live
- Have the Bayesian model pre-seeded with pool results so the coach view demo is immediately impressive
- Have a fallback video recording of the full demo in case of technical issues
- Test the full flow at least 3 times before the demo

---

## 10. Key Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Claude Vision misreads pool sheet | Core feature fails in demo | Medium | Pre-test with multiple pool sheet photos. Build manual entry fallback. Have a pre-extracted result ready as backup. |
| Bayesian model produces unreasonable estimates | Coach view shows nonsensical data | Medium | Test with real tournament data. Add sanity bounds (posterior cannot go below 0 or above 6). Validate against known results. |
| Twilio free trial limitations | SMS does not send during demo | Low | Pre-verify all demo phone numbers. Have console log fallback showing what would have been sent. |
| WebSocket connection drops | Live updates stop during demo | Low | Implement auto-reconnect. Add manual refresh button as fallback. Test on demo network beforehand. |
| Scope creep on extra features | Core flow incomplete | High | Strict phase gates: do not start Phase N+1 until Phase N is 100% done. Extra features are cut first. |
| Solo developer burnout | Quality degrades in final days | Medium | Day 6 is explicitly for polish and demo prep, not new features. Stop coding new features by end of Day 5. |
| Coach view data leaks to public | Fencers see discouraging probability | Low | Access code gate on coach view. WebSocket events filtered by client type. Public API endpoints never return probability or skill estimates. |

---

## 11. Success Criteria

The project is a success if the following can be demonstrated live:

1. A tournament is loaded with fencers, pools, and referees
2. Referees are auto-assigned with conflict detection and a conflict report is generated
3. An SMS is sent to a real phone with a strip assignment and link
4. A pool sheet photo is uploaded and scores are extracted by AI
5. Anomalies are detected and flagged on the review screen
6. The bout committee reviews, edits, and approves the pool results
7. A DE bracket is generated from pool results
8. A DE bout result is reported digitally with signatures
9. The Coach View shows Bayesian skill estimates that update live after pool approval and DE results
10. Win probability is displayed on the Coach View for DE matchups
11. The DE bracket updates live on the dashboard, coach view, and public view
12. A spectator can access the public view via URL/QR code with no analytics visible
13. The Coach View is gated behind a 4-digit access code

Bonus success criteria (extra features):

1. Tournament pace estimates are shown
2. AI narrator generates commentary on tournament events
3. Claude generates per-fencer performance insights on the coach view

---

## 12. Post-Hackathon Vision

If FenceFlow succeeds at the hackathon, the path to a real product includes:

- Direct integration with current fencing software via database connector or API (requires licensing discussion)
- Real fencer/referee data import from USA Fencing CSV exports
- Multi-event support (multiple weapons/age categories running simultaneously)
- Team event support (relay scoring, substitution management)
- Historical data accumulation across tournaments for improved Bayesian priors (a fencer's posterior from one tournament becomes their prior for the next)
- USA Fencing results submission integration
- Mobile app for referees (PWA or native) with offline support
- Integration with electronic scoring machines via current fencing software device managers
- Collaboration with USA Fencing AI Innovation Think Tank (active initiative as of January 2025)
- Coach accounts with persistent fencer tracking across tournaments
- Training recommendation engine based on performance patterns

The fencing community is actively seeking technology innovation. USA Fencing launched dedicated Growth and AI Innovation Think Tanks in January 2025, specifically looking for solutions that improve tournament operations. FenceFlow addresses exactly this need — and the Coach View with Bayesian analytics goes beyond operations into genuine competitive value that no existing tool provides.