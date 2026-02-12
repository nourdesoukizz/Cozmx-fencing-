import csv
import json
import uuid
from datetime import datetime
from config import DATA_DIR, TOURNAMENT_NAME, TOURNAMENT_DATE

# In-memory data stores
_fencers: list[dict] = []
_pools: list[dict] = []
_referees: list[dict] = []
_tournament: dict = {}

_fencer_by_id: dict[int, dict] = {}
_pool_by_id: dict[int, dict] = {}
_referee_by_id: dict[int, dict] = {}

# Submissions store: pool_id -> submission dict
_submissions: dict[int, dict] = {}

# Event status: event_name -> "not_started" | "started"
_event_status: dict[str, str] = {}

# Referee tokens: referee_id -> uuid token, and reverse lookup
_referee_tokens: dict[int, str] = {}
_token_to_referee: dict[str, int] = {}


def _strip_row(row: dict) -> dict:
    """Strip whitespace from all keys and values in a CSV row."""
    return {k.strip(): v.strip() for k, v in row.items()}


def _match_fencer(first_name: str, last_name: str, event: str) -> dict | None:
    """Find a fencer by name (case-insensitive) and event."""
    fn = first_name.lower()
    ln = last_name.lower()
    ev = event.lower()
    for f in _fencers:
        if (f["first_name"].lower() == fn
                and f["last_name"].lower() == ln
                and f["event"].lower() == ev):
            return f
    return None


def load_data():
    """Parse CSVs and build all in-memory data structures."""
    global _fencers, _pools, _referees, _tournament
    global _fencer_by_id, _pool_by_id, _referee_by_id

    # --- Parse fencers.csv ---
    fencers_path = DATA_DIR / "fencers.csv"
    with open(fencers_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, raw_row in enumerate(reader, start=1):
            row = _strip_row(raw_row)
            fencer = {
                "id": i,
                "first_name": row.get("first_name", ""),
                "last_name": row.get("last_name", ""),
                "club": row.get("Club", ""),
                "division": row.get("Division", ""),
                "country": row.get("Country", ""),
                "rating": row.get("Rating", ""),
                "event": row.get("Event", ""),
            }
            _fencers.append(fencer)
            _fencer_by_id[fencer["id"]] = fencer

    # --- Parse pools.csv and build pools + referees ---
    pools_path = DATA_DIR / "pools.csv"
    pool_groups: dict[tuple[str, int], dict] = {}  # (event, pool_number) -> pool
    referee_map: dict[str, dict] = {}  # "first last" (lowered) -> referee

    with open(pools_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            row = _strip_row(raw_row)
            event = row.get("Event", "")
            pool_number = int(row.get("pool_number", 0))
            strip_number = row.get("strip_number", "")
            ref_first = row.get("referee_first_name", "")
            ref_last = row.get("referee_last_name", "")
            fencer_first = row.get("fencer_first_name", "")
            fencer_last = row.get("fencer_last_name", "")

            pool_key = (event, pool_number)

            if pool_key not in pool_groups:
                pool_groups[pool_key] = {
                    "event": event,
                    "pool_number": pool_number,
                    "strip_number": strip_number,
                    "referee_first_name": ref_first,
                    "referee_last_name": ref_last,
                    "fencer_names": [],
                }

            pool_groups[pool_key]["fencer_names"].append(
                (fencer_first, fencer_last)
            )

            # Track referees
            ref_key = f"{ref_first.lower()} {ref_last.lower()}"
            if ref_key not in referee_map:
                referee_map[ref_key] = {
                    "first_name": ref_first,
                    "last_name": ref_last,
                    "assignments": [],
                }

    # --- Build pools list with IDs ---
    pool_id = 0
    for (event, pool_number) in sorted(pool_groups.keys(), key=lambda k: (k[0], k[1])):
        pool_id += 1
        group = pool_groups[(event, pool_number)]
        fencer_names = group["fencer_names"]
        fencer_count = len(fencer_names)

        # Resolve fencers from fencers.csv
        fencers_in_pool = []
        for fn, ln in fencer_names:
            matched = _match_fencer(fn, ln, event)
            if matched:
                fencers_in_pool.append(matched)
            else:
                fencers_in_pool.append({
                    "first_name": fn,
                    "last_name": ln,
                    "event": event,
                })

        pool = {
            "id": pool_id,
            "event": event,
            "pool_number": pool_number,
            "strip_number": group["strip_number"],
            "status": "not_reported",
            "referee": {
                "first_name": group["referee_first_name"],
                "last_name": group["referee_last_name"],
            },
            "fencers": fencers_in_pool,
            "fencer_count": fencer_count,
            "bout_count": fencer_count * (fencer_count - 1) // 2,
        }
        _pools.append(pool)
        _pool_by_id[pool_id] = pool

        # Add assignment to referee
        ref_key = f"{group['referee_first_name'].lower()} {group['referee_last_name'].lower()}"
        if ref_key in referee_map:
            referee_map[ref_key]["assignments"].append({
                "pool_id": pool_id,
                "event": event,
                "pool_number": pool_number,
                "strip_number": group["strip_number"],
            })

    # --- Build referees list with IDs ---
    ref_id = 0
    for ref_key in sorted(referee_map.keys()):
        ref_id += 1
        ref = referee_map[ref_key]
        referee = {
            "id": ref_id,
            "first_name": ref["first_name"],
            "last_name": ref["last_name"],
            "status": "active",
            "assignment_count": len(ref["assignments"]),
            "assignments": ref["assignments"],
        }
        _referees.append(referee)
        _referee_by_id[ref_id] = referee

    # --- Build tournament summary ---
    events_summary = {}
    for fencer in _fencers:
        ev = fencer["event"]
        if ev not in events_summary:
            events_summary[ev] = {"name": ev, "fencer_count": 0, "pool_count": 0}
        events_summary[ev]["fencer_count"] += 1

    for pool in _pools:
        ev = pool["event"]
        if ev in events_summary:
            events_summary[ev]["pool_count"] += 1

    _tournament = {
        "name": TOURNAMENT_NAME,
        "date": TOURNAMENT_DATE,
        "status": "completed",
        "events": list(events_summary.values()),
        "totals": {
            "fencers": len(_fencers),
            "pools": len(_pools),
            "referees": len(_referees),
            "events": len(events_summary),
        },
    }

    # --- Merge phone numbers from referees.csv ---
    referees_csv_path = DATA_DIR / "referees.csv"
    if referees_csv_path.exists():
        phone_map: dict[str, str] = {}
        with open(referees_csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for raw_row in reader:
                row = _strip_row(raw_row)
                key = f"{row.get('first_name', '').lower()} {row.get('last_name', '').lower()}"
                phone_map[key] = row.get("phone", "")
        for ref in _referees:
            ref_key = f"{ref['first_name'].lower()} {ref['last_name'].lower()}"
            ref["phone"] = phone_map.get(ref_key, "")

    # --- Load or initialize event status ---
    global _event_status
    event_status_path = DATA_DIR / "event_status.json"
    if event_status_path.exists():
        with open(event_status_path, "r", encoding="utf-8") as f:
            _event_status = json.load(f)
    else:
        _event_status = {ev: "not_started" for ev in events_summary}
        with open(event_status_path, "w", encoding="utf-8") as f:
            json.dump(_event_status, f, indent=2)
        print(f"Created event_status.json — all events set to not_started")

    # Ensure any new events get a status
    for ev in events_summary:
        if ev not in _event_status:
            _event_status[ev] = "not_started"

    # Attach status to each event in tournament summary
    for ev_dict in _tournament["events"]:
        ev_dict["status"] = _event_status.get(ev_dict["name"], "not_started")

    # --- Load or initialize referee tokens ---
    global _referee_tokens, _token_to_referee
    tokens_path = DATA_DIR / "referee_tokens.json"
    if tokens_path.exists():
        with open(tokens_path, "r", encoding="utf-8") as f:
            saved_tokens = json.load(f)
        _referee_tokens = {int(k): v for k, v in saved_tokens.items()}
    else:
        _referee_tokens = {ref["id"]: str(uuid.uuid4()) for ref in _referees}
        with open(tokens_path, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in _referee_tokens.items()}, f, indent=2)
        print(f"Created referee_tokens.json — {len(_referee_tokens)} tokens generated")

    # Ensure any new referees get tokens
    for ref in _referees:
        if ref["id"] not in _referee_tokens:
            _referee_tokens[ref["id"]] = str(uuid.uuid4())

    # Build reverse lookup and attach token to each referee
    _token_to_referee = {token: rid for rid, token in _referee_tokens.items()}
    for ref in _referees:
        ref["token"] = _referee_tokens.get(ref["id"], "")

    # --- Load previously saved scores ---
    load_scores()

    print(f"CSV data loaded: {len(_fencers)} fencers, {len(_pools)} pools, {len(_referees)} referees, {len(events_summary)} events")


# --- Query functions ---

def get_tournament() -> dict:
    return _tournament


def get_events() -> list[dict]:
    return _tournament.get("events", [])


def get_fencers(event: str | None = None) -> list[dict]:
    if event:
        return [f for f in _fencers if f["event"].lower() == event.lower()]
    return _fencers


def get_fencer_by_id(fencer_id: int) -> dict | None:
    return _fencer_by_id.get(fencer_id)


def get_pools(event: str | None = None) -> list[dict]:
    if event:
        return [p for p in _pools if p["event"].lower() == event.lower()]
    return _pools


def get_pool_by_id(pool_id: int) -> dict | None:
    return _pool_by_id.get(pool_id)


def get_referees(event: str | None = None) -> list[dict]:
    if event:
        return [r for r in _referees if any(
            a["event"].lower() == event.lower() for a in r["assignments"]
        )]
    return _referees


def get_referee_by_id(referee_id: int) -> dict | None:
    return _referee_by_id.get(referee_id)


# --- Score / Submission functions ---

def load_scores():
    """Load previously approved scores from pool_scores.csv on startup."""
    scores_path = DATA_DIR / "pool_scores.csv"
    if not scores_path.exists():
        return
    with open(scores_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pool_id = int(row["pool_id"])
            submission = {
                "pool_id": pool_id,
                "status": row.get("status", "approved"),
                "scores": json.loads(row.get("scores_json", "[]")),
                "anomalies": json.loads(row.get("anomalies_json", "[]")),
                "confidence": float(row.get("confidence", 0)),
                "photo_path": row.get("photo_path", ""),
                "submitted_at": row.get("submitted_at", ""),
                "reviewed_at": row.get("reviewed_at", ""),
                "reviewed_by": row.get("reviewed_by", ""),
            }
            _submissions[pool_id] = submission
            # Update pool status
            pool = _pool_by_id.get(pool_id)
            if pool:
                pool["status"] = "approved"
                pool["submission"] = submission


def save_submission(pool_id: int, data: dict):
    """Store a submission in memory and attach to pool."""
    _submissions[pool_id] = data
    pool = _pool_by_id.get(pool_id)
    if pool:
        pool["status"] = data.get("status", "pending_review")
        pool["submission"] = data


def write_scores_csv():
    """Persist all approved submissions to pool_scores.csv."""
    scores_path = DATA_DIR / "pool_scores.csv"
    fieldnames = [
        "pool_id", "status", "scores_json", "anomalies_json",
        "confidence", "photo_path", "submitted_at", "reviewed_at", "reviewed_by",
    ]
    approved = {pid: sub for pid, sub in _submissions.items() if sub.get("status") == "approved"}
    with open(scores_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for pid in sorted(approved.keys()):
            sub = approved[pid]
            writer.writerow({
                "pool_id": pid,
                "status": sub["status"],
                "scores_json": json.dumps(sub.get("scores", [])),
                "anomalies_json": json.dumps(sub.get("anomalies", [])),
                "confidence": sub.get("confidence", 0),
                "photo_path": sub.get("photo_path", ""),
                "submitted_at": sub.get("submitted_at", ""),
                "reviewed_at": sub.get("reviewed_at", ""),
                "reviewed_by": sub.get("reviewed_by", ""),
            })


def get_all_submissions() -> list[dict]:
    return list(_submissions.values())


def get_submission(pool_id: int) -> dict | None:
    return _submissions.get(pool_id)


# --- Event status functions ---

def get_event_status(event_name: str) -> str:
    return _event_status.get(event_name, "not_started")


def set_event_status(event_name: str, status: str):
    _event_status[event_name] = status
    # Update the tournament events list in memory
    for ev_dict in _tournament.get("events", []):
        if ev_dict["name"] == event_name:
            ev_dict["status"] = status
            break
    # Persist to disk
    event_status_path = DATA_DIR / "event_status.json"
    with open(event_status_path, "w", encoding="utf-8") as f:
        json.dump(_event_status, f, indent=2)


# --- Referee token functions ---

def get_referee_by_token(token: str) -> dict | None:
    referee_id = _token_to_referee.get(token)
    if referee_id is None:
        return None
    return _referee_by_id.get(referee_id)


def get_all_fencers() -> list[dict]:
    return _fencers


def get_all_pools() -> list[dict]:
    return _pools


def get_all_submissions_dict() -> dict[int, dict]:
    return _submissions


def get_pool_bouts_for_fencer(fencer_id: int) -> list[dict]:
    """Find all approved pools containing fencer_id and return bout data."""
    fencer = _fencer_by_id.get(fencer_id)
    if not fencer:
        return []

    results = []
    for pool in _pools:
        pool_id = pool["id"]
        sub = _submissions.get(pool_id)
        if not sub or sub.get("status") != "approved":
            continue

        fencer_idx = None
        for idx, pf in enumerate(pool.get("fencers", [])):
            if pf.get("id") == fencer_id:
                fencer_idx = idx
                break

        if fencer_idx is None:
            continue

        scores = sub.get("scores", [])
        fencer_count = len(scores)
        pool_fencers = pool.get("fencers", [])

        bouts = []
        for j in range(fencer_count):
            if j == fencer_idx:
                continue
            my_score = scores[fencer_idx][j]
            opp_score = scores[j][fencer_idx]
            if my_score is None or opp_score is None:
                continue
            opp = pool_fencers[j] if j < len(pool_fencers) else {}
            bouts.append({
                "opponent_name": f"{opp.get('first_name', '')} {opp.get('last_name', '')}".strip(),
                "opponent_rating": opp.get("rating", "U"),
                "my_score": my_score,
                "opp_score": opp_score,
                "victory": my_score > opp_score,
            })

        results.append({
            "pool_id": pool_id,
            "pool_number": pool.get("pool_number", 0),
            "event": pool.get("event", ""),
            "bouts": bouts,
        })

    return results


def get_pools_for_referee(referee_id: int) -> list[dict]:
    referee = _referee_by_id.get(referee_id)
    if not referee:
        return []
    pool_ids = {a["pool_id"] for a in referee.get("assignments", [])}
    pools = [_pool_by_id[pid] for pid in pool_ids if pid in _pool_by_id]
    # Attach event status to each pool
    for pool in pools:
        pool["event_status"] = get_event_status(pool["event"])
    return pools
