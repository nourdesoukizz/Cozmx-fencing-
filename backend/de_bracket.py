"""
DE Bracket Service — Single-elimination bracket management.

Creates brackets seeded from pool results, manages bout reporting,
auto-advances winners, and tracks final standings.
Persists to data/de_brackets.json.
"""

import json
import math
from datetime import datetime

from config import DATA_DIR

BRACKETS_PATH = DATA_DIR / "de_brackets.json"


class DEBracketService:

    def __init__(self):
        self.brackets: dict[str, dict] = {}  # event_name -> bracket
        self._load()

    def _load(self):
        if BRACKETS_PATH.exists():
            try:
                with open(BRACKETS_PATH, "r", encoding="utf-8") as f:
                    self.brackets = json.load(f)
            except Exception as exc:
                print(f"[DE] Failed to load: {exc}")
                self.brackets = {}

    def _save(self):
        try:
            with open(BRACKETS_PATH, "w", encoding="utf-8") as f:
                json.dump(self.brackets, f, indent=2)
        except Exception as exc:
            print(f"[DE] Failed to save: {exc}")

    def compute_seedings(self, event_name: str) -> list[dict]:
        """Get ranked fencer list from pool results."""
        from data_loader import get_pool_leaderboard
        return get_pool_leaderboard(event_name)

    def _generate_bracket_positions(self, size: int) -> list[tuple[int, int]]:
        """Standard USFA recursive fold algorithm.

        For bracket of 16: (1,16), (8,9), (5,12), (4,13), (3,14), (6,11), (7,10), (2,15)
        This ensures top seeds are maximally separated.
        """
        if size == 2:
            return [(1, 2)]

        half = size // 2
        top_half = self._generate_bracket_positions(half)

        # Map: each pair (a, b) in top half becomes two pairs in full bracket
        # (a, size+1-a) and (size+1-b, b) — interleaved
        result = []
        for a, b in top_half:
            result.append((a, size + 1 - a))
            result.append((b, size + 1 - b))

        return result

    def _round_name(self, bracket_size: int, round_number: int) -> str:
        """Generate round name from bracket size and round number."""
        remaining = bracket_size >> round_number  # number of fencers in this round
        if remaining == 2:
            return "Final"
        if remaining == 4:
            return "Semifinal"
        return f"Table of {remaining}"

    def _total_rounds(self, bracket_size: int) -> int:
        return int(math.log2(bracket_size))

    def create_bracket(self, event_name: str) -> dict:
        """Create a DE bracket for an event from pool results."""
        from data_loader import get_pools, get_submission

        # Check all pools are approved
        event_pools = get_pools(event=event_name)
        if not event_pools:
            raise ValueError(f"No pools found for event '{event_name}'")

        for pool in event_pools:
            sub = get_submission(pool["id"])
            if not sub or sub.get("status") != "approved":
                raise ValueError(
                    f"Pool {pool['pool_number']} for '{event_name}' is not approved. "
                    "All pools must be approved before creating DE bracket."
                )

        # Compute seedings
        seedings = self.compute_seedings(event_name)
        if len(seedings) < 2:
            raise ValueError(f"Need at least 2 fencers for DE bracket, got {len(seedings)}")

        fencer_count = len(seedings)
        bracket_size = 1
        while bracket_size < fencer_count:
            bracket_size *= 2

        total_rounds = self._total_rounds(bracket_size)
        bye_count = bracket_size - fencer_count

        # Build seedings list with seed numbers
        seedings_list = []
        for i, f in enumerate(seedings):
            seedings_list.append({
                "seed": i + 1,
                "fencer_id": f["fencer_id"],
                "first_name": f["first_name"],
                "last_name": f["last_name"],
                "club": f["club"],
                "rating": f["rating"],
                "pool_stats": {
                    "V": f["V"], "TS": f["TS"], "TR": f["TR"],
                    "indicator": f["indicator"],
                },
            })

        # Build seeding lookup by seed number
        seed_lookup = {s["seed"]: s for s in seedings_list}

        # Generate first-round matchups
        positions = self._generate_bracket_positions(bracket_size)

        # Build event prefix for bout IDs
        evt_prefix = event_name.replace(" ", "").replace("'", "")[:8].upper()

        # Build all rounds
        rounds = []
        for r in range(total_rounds):
            round_bout_count = bracket_size >> (r + 1)
            round_name = self._round_name(bracket_size, r)
            bouts = []
            for b in range(round_bout_count):
                next_bout_id = None
                next_slot = None
                if r < total_rounds - 1:
                    next_bout_id = f"{evt_prefix}-R{r+1}-B{b // 2}"
                    next_slot = "top" if b % 2 == 0 else "bottom"

                bout = {
                    "bout_id": f"{evt_prefix}-R{r}-B{b}",
                    "bout_index": b,
                    "top_fencer": None,
                    "bottom_fencer": None,
                    "top_score": None,
                    "bottom_score": None,
                    "winner_side": None,
                    "status": "pending",
                    "referee_id": None,
                    "referee_name": None,
                    "strip_number": None,
                    "signatures": {"referee": None, "winner": None},
                    "reported_at": None,
                    "next_bout_id": next_bout_id,
                    "next_slot": next_slot,
                }
                bouts.append(bout)

            rounds.append({
                "round_name": round_name,
                "round_number": r,
                "bouts": bouts,
            })

        # Populate first round from seedings
        first_round_bouts = rounds[0]["bouts"]
        for i, (seed_a, seed_b) in enumerate(positions):
            bout = first_round_bouts[i]

            fencer_a = seed_lookup.get(seed_a)
            fencer_b = seed_lookup.get(seed_b)

            if fencer_a:
                bout["top_fencer"] = {
                    "fencer_id": fencer_a["fencer_id"],
                    "first_name": fencer_a["first_name"],
                    "last_name": fencer_a["last_name"],
                    "seed": fencer_a["seed"],
                }

            # If seed_b > fencer_count, it's a bye
            if seed_b <= fencer_count and fencer_b:
                bout["bottom_fencer"] = {
                    "fencer_id": fencer_b["fencer_id"],
                    "first_name": fencer_b["first_name"],
                    "last_name": fencer_b["last_name"],
                    "seed": fencer_b["seed"],
                }
            else:
                bout["bottom_fencer"] = None

        # Auto-resolve byes
        for bout in first_round_bouts:
            if bout["top_fencer"] and not bout["bottom_fencer"]:
                bout["status"] = "bye"
                bout["winner_side"] = "top"
                self._advance_winner(rounds, bout, bout["top_fencer"])
            elif bout["bottom_fencer"] and not bout["top_fencer"]:
                bout["status"] = "bye"
                bout["winner_side"] = "bottom"
                self._advance_winner(rounds, bout, bout["bottom_fencer"])

        bracket = {
            "event": event_name,
            "status": "in_progress",
            "bracket_size": bracket_size,
            "fencer_count": fencer_count,
            "created_at": datetime.now().isoformat(),
            "seedings": seedings_list,
            "rounds": rounds,
            "final_standings": [],
        }

        self.brackets[event_name] = bracket
        self._save()
        return bracket

    def _advance_winner(self, rounds: list, bout: dict, winner_fencer: dict):
        """Place winner into the next bout's correct slot."""
        next_id = bout.get("next_bout_id")
        next_slot = bout.get("next_slot")
        if not next_id or not next_slot:
            return

        for rnd in rounds:
            for b in rnd["bouts"]:
                if b["bout_id"] == next_id:
                    b[f"{next_slot}_fencer"] = winner_fencer.copy()
                    return

    def assign_referee(self, event_name: str, bout_id: str,
                       referee_id: int, strip_number: str | None = None) -> dict:
        """Assign a referee to a pending bout."""
        bracket = self.brackets.get(event_name)
        if not bracket:
            raise ValueError(f"No bracket for event '{event_name}'")

        from data_loader import get_referee_by_id
        referee = get_referee_by_id(referee_id)
        if not referee:
            raise ValueError(f"Referee {referee_id} not found")

        bout = self._find_bout(bracket, bout_id)
        if not bout:
            raise ValueError(f"Bout {bout_id} not found")

        if bout["status"] not in ("pending",):
            raise ValueError(f"Cannot assign referee to bout with status '{bout['status']}'")

        bout["referee_id"] = referee_id
        bout["referee_name"] = f"{referee['first_name']} {referee['last_name']}"
        if strip_number:
            bout["strip_number"] = strip_number

        self._save()
        return bout

    def report_bout(self, event_name: str, bout_id: str,
                    top_score: int, bottom_score: int,
                    referee_sig: str | None = None,
                    winner_sig: str | None = None) -> dict:
        """Report the result of a DE bout."""
        bracket = self.brackets.get(event_name)
        if not bracket:
            raise ValueError(f"No bracket for event '{event_name}'")

        bout = self._find_bout(bracket, bout_id)
        if not bout:
            raise ValueError(f"Bout {bout_id} not found")

        if bout["status"] != "pending":
            raise ValueError(f"Bout {bout_id} is not pending (status: {bout['status']})")

        if not bout["top_fencer"] or not bout["bottom_fencer"]:
            raise ValueError(f"Bout {bout_id} does not have both fencers assigned")

        # Validate scores: one must be 15, other 0-14, not equal
        if top_score == bottom_score:
            raise ValueError("Scores cannot be equal in DE")

        if not ((top_score == 15 and 0 <= bottom_score <= 14) or
                (bottom_score == 15 and 0 <= top_score <= 14)):
            raise ValueError("One score must be 15 and the other between 0-14")

        # Determine winner
        winner_side = "top" if top_score > bottom_score else "bottom"
        winner_fencer = bout["top_fencer"] if winner_side == "top" else bout["bottom_fencer"]
        loser_fencer = bout["bottom_fencer"] if winner_side == "top" else bout["top_fencer"]

        bout["top_score"] = top_score
        bout["bottom_score"] = bottom_score
        bout["winner_side"] = winner_side
        bout["status"] = "completed"
        bout["reported_at"] = datetime.now().isoformat()
        bout["signatures"]["referee"] = referee_sig
        bout["signatures"]["winner"] = winner_sig

        # Advance winner to next round
        self._advance_winner(bracket["rounds"], bout, winner_fencer)

        # Check if this was the final bout
        total_rounds = self._total_rounds(bracket["bracket_size"])
        last_round = bracket["rounds"][-1]
        is_final = (last_round["bouts"][0]["bout_id"] == bout_id)

        if is_final:
            bracket["status"] = "completed"
            bracket["final_standings"] = self._compute_standings(bracket)

        self._save()

        # Find round name for this bout
        round_name = ""
        for rnd in bracket["rounds"]:
            for b in rnd["bouts"]:
                if b["bout_id"] == bout_id:
                    round_name = rnd["round_name"]
                    break

        return {
            "bout": bout,
            "winner": winner_fencer,
            "loser": loser_fencer,
            "round_name": round_name,
            "is_final": is_final,
            "bracket_completed": bracket["status"] == "completed",
        }

    def _compute_standings(self, bracket: dict) -> list[dict]:
        """Compute final standings from completed bracket. No 3rd place bout."""
        standings = []
        rounds = bracket["rounds"]
        total_rounds = len(rounds)

        for r_idx in range(total_rounds - 1, -1, -1):
            rnd = rounds[r_idx]
            for bout in rnd["bouts"]:
                if bout["status"] == "bye":
                    continue
                if bout["status"] != "completed":
                    continue

                winner_side = bout["winner_side"]
                loser = bout["bottom_fencer"] if winner_side == "top" else bout["top_fencer"]
                winner = bout["top_fencer"] if winner_side == "top" else bout["bottom_fencer"]

                if loser and loser not in [s.get("_fencer") for s in standings]:
                    # Place is determined by the round they lost in
                    if r_idx == total_rounds - 1:
                        # Final: loser gets 2nd
                        standings.append({
                            "place": 2,
                            "fencer_id": loser["fencer_id"],
                            "first_name": loser["first_name"],
                            "last_name": loser["last_name"],
                            "seed": loser.get("seed"),
                            "_fencer": loser,
                        })
                        # Winner gets 1st
                        standings.append({
                            "place": 1,
                            "fencer_id": winner["fencer_id"],
                            "first_name": winner["first_name"],
                            "last_name": winner["last_name"],
                            "seed": winner.get("seed"),
                            "_fencer": winner,
                        })
                    else:
                        # Lost in earlier round: place = remaining fencers after that round + 1
                        # Semi losers: T3, Quarter losers: T5, etc.
                        remaining = bracket["bracket_size"] >> (r_idx + 1)
                        place = remaining + 1
                        standings.append({
                            "place": place,
                            "fencer_id": loser["fencer_id"],
                            "first_name": loser["first_name"],
                            "last_name": loser["last_name"],
                            "seed": loser.get("seed"),
                            "_fencer": loser,
                        })

        # Sort by place, remove internal _fencer field
        standings.sort(key=lambda s: (s["place"], s.get("seed", 999)))
        for s in standings:
            s.pop("_fencer", None)

        return standings

    def _find_bout(self, bracket: dict, bout_id: str) -> dict | None:
        """Find a bout by ID within a bracket."""
        for rnd in bracket["rounds"]:
            for bout in rnd["bouts"]:
                if bout["bout_id"] == bout_id:
                    return bout
        return None

    def get_bracket(self, event_name: str) -> dict | None:
        return self.brackets.get(event_name)

    def get_all_brackets(self) -> list[dict]:
        return list(self.brackets.values())

    def get_referee_bouts(self, referee_id: int) -> list[dict]:
        """Return all bouts assigned to a referee across all events."""
        result = []
        for event_name, bracket in self.brackets.items():
            for rnd in bracket["rounds"]:
                for bout in rnd["bouts"]:
                    if bout.get("referee_id") == referee_id:
                        result.append({
                            **bout,
                            "event": event_name,
                            "round_name": rnd["round_name"],
                        })
        return result

    def delete_bracket(self, event_name: str) -> bool:
        """Delete a bracket if no completed bouts exist."""
        bracket = self.brackets.get(event_name)
        if not bracket:
            raise ValueError(f"No bracket for event '{event_name}'")

        # Check for completed bouts (byes don't count)
        for rnd in bracket["rounds"]:
            for bout in rnd["bouts"]:
                if bout["status"] == "completed":
                    raise ValueError(
                        "Cannot delete bracket with completed bouts. "
                        "Only brackets with no reported results can be deleted."
                    )

        del self.brackets[event_name]
        self._save()
        return True


# Module-level singleton
de_service = DEBracketService()
