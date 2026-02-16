"""
Bradley-Terry touch-level probability engine for fencer performance analysis.

Uses the MM algorithm (Hunter 2004) to estimate fencer strengths globally
from touch-level bout data. Models each touch as a Bernoulli trial:
    P(i scores on j) = s_i / (s_i + s_j)

Refits ALL strengths from scratch after every bout.
Tracks full probability trajectory over time.
Supports Monte Carlo DE bracket simulation.
"""

import csv
import math
import random
from datetime import datetime
from pathlib import Path


class BTEngine:
    """Bradley-Terry engine with MM fitting, trajectory tracking, and Monte Carlo DE simulation."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        # Fencer name -> strength parameter
        self.strengths: dict[str, float] = {}
        # Fencer name -> prior strength (from rating)
        self.priors: dict[str, float] = {}
        # Fencer name -> fencer metadata dict
        self.fencer_meta: dict[str, dict] = {}
        # List of all recorded bouts
        self.bouts: list[dict] = []
        # Trajectory snapshots after each refit
        self.trajectory: list[dict] = []
        # DE bracket seedings (ordered list of fencer names)
        self.bracket: list[str] = []
        # Prior weight for regularization
        self.prior_weight = 0.3
        # Bout counter
        self.bout_index = 0

    def initialize(self, fencers: list[dict], pools: list[dict], submissions: dict):
        """Parse ratings, decompose approved pool matrices into bouts, fit initial strengths."""
        # Register all fencers and set priors
        for f in fencers:
            name = f"{f.get('first_name', '')} {f.get('last_name', '')}".strip()
            if not name:
                continue
            rating = f.get("rating", "U")
            prior = self._rating_to_strength(rating)
            self.priors[name] = prior
            self.strengths[name] = prior
            self.fencer_meta[name] = {
                "id": f.get("id"),
                "first_name": f.get("first_name", ""),
                "last_name": f.get("last_name", ""),
                "club": f.get("club", ""),
                "rating": rating,
                "event": f.get("event", ""),
            }

        # Build pool_id -> pool lookup
        pool_by_id = {p["id"]: p for p in pools}

        # Decompose approved pool matrices into bouts, refit after each pool
        # so the trajectory builds incrementally
        for pool_id, sub in submissions.items():
            if sub.get("status") != "approved":
                continue
            pool = pool_by_id.get(pool_id)
            if not pool:
                continue
            pool_fencers = pool.get("fencers", [])
            scores = sub.get("scores", [])
            if not scores or not pool_fencers:
                continue
            pool_number = pool.get("pool_number", 0)
            self._decompose_pool(pool_id, pool_number,
                                 pool_fencers, scores)
            self.refit()
            self._snapshot(f"Pool {pool_number}")

        # Load manual bouts from CSV
        self._load_manual_bouts()

        # Refit after manual bouts if any were loaded
        if self.bouts and not self.trajectory:
            self.refit()
            self._snapshot("Initial fit")

        print(f"BTEngine initialized: {len(self.fencer_meta)} fencers, "
              f"{len(self.bouts)} bouts from {len([s for s in submissions.values() if s.get('status') == 'approved'])} pools")

    def _rating_to_strength(self, rating_str: str) -> float:
        """Convert USFA rating to BT strength parameter.

        A=32, B=16, C=8, D=4, E=2, U=1
        """
        if not rating_str or not rating_str.strip():
            return 1.0

        rating_str = rating_str.strip().upper()
        if rating_str in ("U", "U/U"):
            return 1.0

        letter_map = {"A": 32.0, "B": 16.0, "C": 8.0, "D": 4.0, "E": 2.0}
        letter = rating_str[0]
        return letter_map.get(letter, 1.0)

    def _decompose_pool(self, pool_id: int, pool_number: int,
                        pool_fencers: list[dict], matrix: list[list]):
        """Convert NxN score matrix to individual bout records.

        For each upper-triangle pair (i,j) where i < j:
            score_a = M[i][j], score_b = M[j][i]
        """
        n = len(matrix)
        for i in range(n):
            for j in range(i + 1, n):
                score_a = matrix[i][j]
                score_b = matrix[j][i]
                if score_a is None or score_b is None:
                    continue

                fa = pool_fencers[i] if i < len(pool_fencers) else {}
                fb = pool_fencers[j] if j < len(pool_fencers) else {}
                name_a = f"{fa.get('first_name', '')} {fa.get('last_name', '')}".strip()
                name_b = f"{fb.get('first_name', '')} {fb.get('last_name', '')}".strip()

                if not name_a or not name_b:
                    continue

                self.bout_index += 1
                bout = {
                    "bout_index": self.bout_index,
                    "fencer_a": name_a,
                    "fencer_b": name_b,
                    "score_a": int(score_a),
                    "score_b": int(score_b),
                    "source": f"Pool {pool_number}",
                    "pool_id": pool_id,
                    "timestamp": None,
                }
                self.bouts.append(bout)

    def ingest_pool(self, pool_id: int, pool_number: int,
                    pool_fencers: list[dict], scores: list[list]):
        """Ingest a newly approved pool at runtime: decompose, refit, snapshot."""
        self._decompose_pool(pool_id, pool_number, pool_fencers, scores)
        if self.bouts:
            self.refit()
            self._snapshot(f"Pool {pool_number} approved")

    def _load_manual_bouts(self):
        """Load manually entered bouts from CSV."""
        csv_path = self.data_dir / "manual_bouts.csv"
        if not csv_path.exists():
            return

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                fencer_a = row.get("fencer_a", "").strip()
                fencer_b = row.get("fencer_b", "").strip()
                if not fencer_a or not fencer_b:
                    continue

                self.bout_index += 1
                bout = {
                    "bout_index": self.bout_index,
                    "fencer_a": fencer_a,
                    "fencer_b": fencer_b,
                    "score_a": int(row.get("score_a", 0)),
                    "score_b": int(row.get("score_b", 0)),
                    "source": "Manual",
                    "pool_id": None,
                    "timestamp": row.get("timestamp", ""),
                }
                self.bouts.append(bout)

                # Register unknown fencers with default strength
                for name in (fencer_a, fencer_b):
                    if name not in self.strengths:
                        self.priors[name] = 1.0
                        self.strengths[name] = 1.0
                        self.fencer_meta[name] = {
                            "id": None,
                            "first_name": name.split()[0] if name else "",
                            "last_name": " ".join(name.split()[1:]) if name else "",
                            "club": "",
                            "rating": "U",
                            "event": "",
                        }

    def add_bout(self, fencer_a: str, fencer_b: str, score_a: int, score_b: int) -> dict:
        """Add a new bout, refit all strengths, take a snapshot, persist to CSV.

        Returns the updated engine state for the two fencers.
        """
        # Register unknown fencers
        for name in (fencer_a, fencer_b):
            if name not in self.strengths:
                self.priors[name] = 1.0
                self.strengths[name] = 1.0
                self.fencer_meta[name] = {
                    "id": None,
                    "first_name": name.split()[0] if name else "",
                    "last_name": " ".join(name.split()[1:]) if name else "",
                    "club": "",
                    "rating": "U",
                    "event": "",
                }

        self.bout_index += 1
        timestamp = datetime.now().isoformat()
        bout = {
            "bout_index": self.bout_index,
            "fencer_a": fencer_a,
            "fencer_b": fencer_b,
            "score_a": score_a,
            "score_b": score_b,
            "source": "Manual",
            "pool_id": None,
            "timestamp": timestamp,
        }
        self.bouts.append(bout)

        # Refit all strengths
        self.refit()

        # Take trajectory snapshot
        label = f"{fencer_a} vs {fencer_b}: {score_a}-{score_b}"
        self._snapshot(label)

        # Persist to CSV
        self._append_manual_bout(fencer_a, fencer_b, score_a, score_b,
                                 timestamp, self.bout_index)

        # Return state for the two fencers
        win_probs = self._compute_win_probs()
        return {
            "bout": bout,
            "fencer_a_strength": self.strengths.get(fencer_a, 1.0),
            "fencer_b_strength": self.strengths.get(fencer_b, 1.0),
            "fencer_a_win_prob": win_probs.get(fencer_a, 0),
            "fencer_b_win_prob": win_probs.get(fencer_b, 0),
        }

    def refit(self):
        """MM algorithm (Hunter 2004) with prior regularization.

        For each fencer i:
            W_i = total touches scored (across all bouts)
            s_i_new = (W_i + prior_weight * prior_strength_i) /
                      (sum_over_opponents_j(n_ij / (s_i + s_j)) + prior_weight)

        Iterate until max |log(s_new) - log(s_old)| < 1e-6
        """
        if not self.bouts:
            return

        # Collect all fencers who appear in bouts
        active_fencers = set()
        for b in self.bouts:
            active_fencers.add(b["fencer_a"])
            active_fencers.add(b["fencer_b"])

        # Initialize strengths for active fencers
        s = {name: self.strengths.get(name, self.priors.get(name, 1.0))
             for name in active_fencers}

        # Precompute bout data: for each pair (i,j), total touches scored by i vs j,
        # and total touches between i and j
        # W[i] = total touches scored by i
        W: dict[str, float] = {name: 0.0 for name in active_fencers}
        # pairs[(i,j)] = total touches between i and j (both directions)
        pairs: dict[tuple[str, str], float] = {}

        for b in self.bouts:
            a, b_name = b["fencer_a"], b["fencer_b"]
            sa, sb = b["score_a"], b["score_b"]
            W[a] += sa
            W[b_name] += sb
            key = tuple(sorted([a, b_name]))
            pairs[key] = pairs.get(key, 0) + sa + sb

        # MM iterations
        max_iter = 200
        for iteration in range(max_iter):
            s_new = {}
            for name in active_fencers:
                numerator = W[name] + self.prior_weight * self.priors.get(name, 1.0)
                denominator = self.prior_weight
                for (a, b_name), n_ij in pairs.items():
                    if a == name:
                        other = b_name
                    elif b_name == name:
                        other = a
                    else:
                        continue
                    denominator += n_ij / (s[name] + s[other])
                if denominator > 0:
                    s_new[name] = numerator / denominator
                else:
                    s_new[name] = s[name]

            # Check convergence
            max_change = 0.0
            for name in active_fencers:
                if s[name] > 0 and s_new[name] > 0:
                    change = abs(math.log(s_new[name]) - math.log(s[name]))
                    max_change = max(max_change, change)

            s = s_new
            if max_change < 1e-6:
                break

        # Update strengths
        for name in active_fencers:
            self.strengths[name] = s[name]

        # Fencers with no bout data keep their prior
        for name in self.fencer_meta:
            if name not in active_fencers:
                self.strengths[name] = self.priors.get(name, 1.0)

    def _compute_win_probs(self) -> dict[str, float]:
        """Compute tournament win probability for each fencer.

        Simple approximation: fencer's strength / sum of all strengths with bout data.
        """
        active = {name: s for name, s in self.strengths.items()
                  if any(b["fencer_a"] == name or b["fencer_b"] == name for b in self.bouts)}
        if not active:
            return {}
        total = sum(active.values())
        if total == 0:
            return {name: 0 for name in active}
        return {name: (s / total) * 100 for name, s in active.items()}

    def _snapshot(self, label: str):
        """Take a trajectory snapshot after a refit."""
        win_probs = self._compute_win_probs()
        snapshot = {
            "bout_index": self.bout_index,
            "bout_label": label,
            "strengths": {name: round(s, 4) for name, s in self.strengths.items()
                          if any(b["fencer_a"] == name or b["fencer_b"] == name
                                 for b in self.bouts)},
            "win_probs": {name: round(p, 2) for name, p in win_probs.items()},
        }
        self.trajectory.append(snapshot)

    def _append_manual_bout(self, fencer_a: str, fencer_b: str,
                            score_a: int, score_b: int,
                            timestamp: str, bout_index: int):
        """Append a manual bout to the CSV file."""
        csv_path = self.data_dir / "manual_bouts.csv"
        file_exists = csv_path.exists()
        with open(csv_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["fencer_a", "fencer_b", "score_a", "score_b",
                                 "timestamp", "bout_index"])
            writer.writerow([fencer_a, fencer_b, score_a, score_b,
                             timestamp, bout_index])

    def get_state(self) -> dict:
        """Full engine state: all fencers with strengths, ranks, win probs, records."""
        win_probs = self._compute_win_probs()

        # Compute bout records for each fencer
        records: dict[str, dict] = {}
        for name in self.fencer_meta:
            records[name] = {"wins": 0, "losses": 0, "ts": 0, "tr": 0}

        for b in self.bouts:
            a, b_name = b["fencer_a"], b["fencer_b"]
            sa, sb = b["score_a"], b["score_b"]
            if a in records:
                records[a]["ts"] += sa
                records[a]["tr"] += sb
                if sa > sb:
                    records[a]["wins"] += 1
                else:
                    records[a]["losses"] += 1
            if b_name in records:
                records[b_name]["ts"] += sb
                records[b_name]["tr"] += sa
                if sb > sa:
                    records[b_name]["wins"] += 1
                else:
                    records[b_name]["losses"] += 1

        # Build fencer list sorted by strength descending
        fencer_list = []
        for name, meta in self.fencer_meta.items():
            strength = self.strengths.get(name, self.priors.get(name, 1.0))
            rec = records.get(name, {"wins": 0, "losses": 0, "ts": 0, "tr": 0})
            has_bouts = any(b["fencer_a"] == name or b["fencer_b"] == name
                           for b in self.bouts)
            fencer_list.append({
                "name": name,
                "id": meta.get("id"),
                "first_name": meta.get("first_name", ""),
                "last_name": meta.get("last_name", ""),
                "club": meta.get("club", ""),
                "rating": meta.get("rating", "U"),
                "event": meta.get("event", ""),
                "strength": round(strength, 4),
                "win_prob": round(win_probs.get(name, 0), 2),
                "wins": rec["wins"],
                "losses": rec["losses"],
                "ts": rec["ts"],
                "tr": rec["tr"],
                "td": rec["ts"] - rec["tr"],
                "has_bouts": has_bouts,
            })

        # Sort by strength descending, assign ranks
        fencer_list.sort(key=lambda x: -x["strength"])
        for i, f in enumerate(fencer_list):
            f["rank"] = i + 1

        return {
            "fencers": fencer_list,
            "total": len(fencer_list),
            "bout_count": len(self.bouts),
        }

    def get_fencer_detail(self, fencer_name: str) -> dict | None:
        """Get detailed state for a single fencer including bout history."""
        meta = self.fencer_meta.get(fencer_name)
        if not meta:
            return None

        strength = self.strengths.get(fencer_name, self.priors.get(fencer_name, 1.0))
        win_probs = self._compute_win_probs()

        # Get all bouts for this fencer
        bout_details = []
        for b in self.bouts:
            if b["fencer_a"] == fencer_name:
                opp_name = b["fencer_b"]
                my_score = b["score_a"]
                opp_score = b["score_b"]
            elif b["fencer_b"] == fencer_name:
                opp_name = b["fencer_a"]
                my_score = b["score_b"]
                opp_score = b["score_a"]
            else:
                continue

            opp_meta = self.fencer_meta.get(opp_name, {})
            opp_strength = self.strengths.get(opp_name, 1.0)
            victory = my_score > opp_score

            # Determine if this was an upset
            is_upset = False
            if victory and opp_strength > strength * 1.5:
                is_upset = True
            elif not victory and strength > opp_strength * 1.5:
                is_upset = True

            bout_details.append({
                "bout_index": b["bout_index"],
                "opponent_name": opp_name,
                "opponent_rating": opp_meta.get("rating", "U"),
                "opponent_club": opp_meta.get("club", ""),
                "opponent_strength": round(opp_strength, 4),
                "my_score": my_score,
                "opp_score": opp_score,
                "victory": victory,
                "is_upset": is_upset,
                "source": b.get("source", ""),
            })

        # Compute record
        wins = sum(1 for b in bout_details if b["victory"])
        losses = sum(1 for b in bout_details if not b["victory"])
        ts = sum(b["my_score"] for b in bout_details)
        tr = sum(b["opp_score"] for b in bout_details)

        # Compute rank
        sorted_strengths = sorted(self.strengths.items(), key=lambda x: -x[1])
        rank = next((i + 1 for i, (n, _) in enumerate(sorted_strengths) if n == fencer_name),
                    len(sorted_strengths))

        # Pool summaries (group bouts by source)
        pool_summaries = {}
        for b in bout_details:
            source = b["source"]
            if source not in pool_summaries:
                pool_summaries[source] = {
                    "source": source,
                    "victories": 0,
                    "bouts": 0,
                    "ts": 0,
                    "tr": 0,
                }
            ps = pool_summaries[source]
            ps["bouts"] += 1
            ps["ts"] += b["my_score"]
            ps["tr"] += b["opp_score"]
            if b["victory"]:
                ps["victories"] += 1

        for ps in pool_summaries.values():
            ps["indicator"] = ps["ts"] - ps["tr"]

        return {
            "name": fencer_name,
            "id": meta.get("id"),
            "first_name": meta.get("first_name", ""),
            "last_name": meta.get("last_name", ""),
            "club": meta.get("club", ""),
            "rating": meta.get("rating", "U"),
            "event": meta.get("event", ""),
            "strength": round(strength, 4),
            "prior_strength": round(self.priors.get(fencer_name, 1.0), 4),
            "win_prob": round(win_probs.get(fencer_name, 0), 2),
            "rank": rank,
            "wins": wins,
            "losses": losses,
            "ts": ts,
            "tr": tr,
            "td": ts - tr,
            "has_bouts": len(bout_details) > 0,
            "bout_details": bout_details,
            "pool_summaries": list(pool_summaries.values()),
        }

    def get_trajectory(self, fencer: str | None = None) -> list[dict]:
        """Array of snapshots (strength + win_prob for all fencers after each bout).

        If fencer is specified, filter to just that fencer's data.
        """
        if not fencer:
            return self.trajectory

        result = []
        for snap in self.trajectory:
            if fencer in snap["strengths"]:
                result.append({
                    "bout_index": snap["bout_index"],
                    "bout_label": snap["bout_label"],
                    "strength": snap["strengths"].get(fencer, 0),
                    "win_prob": snap["win_probs"].get(fencer, 0),
                })
        return result

    def get_pairwise(self, name_a: str, name_b: str) -> dict:
        """Pairwise win probability and head-to-head record.

        P(A beats B) = s_a / (s_a + s_b)
        """
        s_a = self.strengths.get(name_a, self.priors.get(name_a, 1.0))
        s_b = self.strengths.get(name_b, self.priors.get(name_b, 1.0))

        if s_a + s_b == 0:
            prob_a = 0.5
        else:
            prob_a = s_a / (s_a + s_b)

        # Head-to-head record
        h2h_a_wins = 0
        h2h_b_wins = 0
        h2h_a_touches = 0
        h2h_b_touches = 0
        h2h_bouts = []

        for b in self.bouts:
            if b["fencer_a"] == name_a and b["fencer_b"] == name_b:
                h2h_a_touches += b["score_a"]
                h2h_b_touches += b["score_b"]
                if b["score_a"] > b["score_b"]:
                    h2h_a_wins += 1
                else:
                    h2h_b_wins += 1
                h2h_bouts.append(b)
            elif b["fencer_a"] == name_b and b["fencer_b"] == name_a:
                h2h_a_touches += b["score_b"]
                h2h_b_touches += b["score_a"]
                if b["score_b"] > b["score_a"]:
                    h2h_a_wins += 1
                else:
                    h2h_b_wins += 1
                h2h_bouts.append(b)

        # Expected score in a 5-touch bout
        expected_a_5 = round(5 * prob_a, 1)
        expected_b_5 = round(5 * (1 - prob_a), 1)
        # Expected score in a 15-touch bout
        expected_a_15 = round(15 * prob_a, 1)
        expected_b_15 = round(15 * (1 - prob_a), 1)

        return {
            "fencer_a": name_a,
            "fencer_b": name_b,
            "strength_a": round(s_a, 4),
            "strength_b": round(s_b, 4),
            "prob_a": round(prob_a, 4),
            "prob_b": round(1 - prob_a, 4),
            "h2h_a_wins": h2h_a_wins,
            "h2h_b_wins": h2h_b_wins,
            "h2h_a_touches": h2h_a_touches,
            "h2h_b_touches": h2h_b_touches,
            "h2h_bouts": h2h_bouts,
            "expected_score_5": f"{expected_a_5}-{expected_b_5}",
            "expected_score_15": f"{expected_a_15}-{expected_b_15}",
            "meta_a": self.fencer_meta.get(name_a, {}),
            "meta_b": self.fencer_meta.get(name_b, {}),
        }

    def set_bracket(self, seedings: list[str]):
        """Set DE bracket seedings (ordered list of fencer names, seed 1 first)."""
        self.bracket = seedings

    def simulate_de(self, n_sims: int = 10000) -> dict:
        """Monte Carlo simulation of DE bracket outcomes.

        For each simulation, simulate the entire bracket using BT probabilities.
        Returns win counts and percentages for each round.
        """
        if not self.bracket:
            return {"error": "No bracket set. Call set_bracket first."}

        n = len(self.bracket)
        # Pad to next power of 2
        bracket_size = 1
        while bracket_size < n:
            bracket_size *= 2

        padded = list(self.bracket) + [None] * (bracket_size - n)

        # Standard bracket seeding order
        def seed_order(size):
            if size == 1:
                return [0]
            half = seed_order(size // 2)
            return [x * 2 for x in half] + [size - 1 - x * 2 for x in half]

        order = seed_order(bracket_size)
        seeded_bracket = [padded[i] if i < len(padded) else None for i in order]

        # Track results
        round_names = []
        r = bracket_size
        while r > 1:
            if r == 2:
                round_names.append("Final")
            elif r == 4:
                round_names.append("Semi")
            else:
                round_names.append(f"T{r}")
            r //= 2

        # Count wins per round per fencer
        results: dict[str, dict[str, int]] = {}
        champion_count: dict[str, int] = {}

        for name in self.bracket:
            results[name] = {rn: 0 for rn in round_names}
            results[name]["Champion"] = 0
            champion_count[name] = 0

        for _ in range(n_sims):
            current = list(seeded_bracket)
            round_idx = 0

            while len(current) > 1:
                next_round = []
                for i in range(0, len(current), 2):
                    a = current[i]
                    b = current[i + 1] if i + 1 < len(current) else None

                    if a is None and b is None:
                        next_round.append(None)
                    elif a is None:
                        next_round.append(b)
                    elif b is None:
                        next_round.append(a)
                    else:
                        # Simulate bout using BT probability
                        s_a = self.strengths.get(a, 1.0)
                        s_b = self.strengths.get(b, 1.0)
                        prob_a = s_a / (s_a + s_b) if (s_a + s_b) > 0 else 0.5

                        if random.random() < prob_a:
                            winner = a
                        else:
                            winner = b

                        # Record that winner advanced past this round
                        if round_idx < len(round_names) and winner in results:
                            results[winner][round_names[round_idx]] += 1
                        next_round.append(winner)

                current = next_round
                round_idx += 1

            # Record champion
            if current and current[0] and current[0] in champion_count:
                champion_count[current[0]] += 1
                results[current[0]]["Champion"] += 1

        # Convert to percentages
        pct_results = {}
        for name in self.bracket:
            pct_results[name] = {
                "strength": round(self.strengths.get(name, 1.0), 4),
            }
            for rn in round_names + ["Champion"]:
                pct_results[name][rn] = round(
                    results[name][rn] / n_sims * 100, 1
                )

        # Sort by champion %
        sorted_results = sorted(pct_results.items(),
                                key=lambda x: -x[1].get("Champion", 0))

        return {
            "n_sims": n_sims,
            "bracket_size": bracket_size,
            "rounds": round_names + ["Champion"],
            "results": [{"name": name, **data} for name, data in sorted_results],
        }

    def find_fencer(self, query: str) -> str | None:
        """Find a fencer by partial name match (case-insensitive)."""
        q = query.strip().lower()
        # Exact match first
        for name in self.fencer_meta:
            if name.lower() == q:
                return name
        # Partial match
        matches = [name for name in self.fencer_meta if q in name.lower()]
        if len(matches) == 1:
            return matches[0]
        return matches[0] if matches else None

    def get_all_bouts(self) -> list[dict]:
        """Return all bouts in reverse chronological order."""
        return list(reversed(self.bouts))

    def get_fencer_names(self) -> list[str]:
        """Return all fencer names for autocomplete."""
        return sorted(self.fencer_meta.keys())
