"""
Bayesian skill estimation model for fencer performance analysis.
Uses conjugate normal-normal updates on fencer ratings based on pool bout results.
"""

import math


def parse_rating(rating_str: str) -> tuple[float, float]:
    """Convert a USFA rating string to (prior_mean, prior_variance).

    Rating base: A=5.0, B=4.0, C=3.0, D=2.0, E=1.0, U=0.5
    Year bonus: 25/26=+0.3, 24=+0.2, 23=+0.1, older=0
    Variance: rated=0.5, unrated=2.0, stale(3+ yr)=1.0
    """
    if not rating_str or not rating_str.strip():
        return (0.5, 2.0)

    rating_str = rating_str.strip().upper()

    if rating_str == "U" or rating_str == "U/U":
        return (0.5, 2.0)

    letter_map = {"A": 5.0, "B": 4.0, "C": 3.0, "D": 2.0, "E": 1.0}

    letter = rating_str[0] if rating_str else ""
    year_str = rating_str[1:] if len(rating_str) > 1 else ""

    base = letter_map.get(letter, 0.5)
    if base == 0.5:
        return (0.5, 2.0)

    year_bonus = 0.0
    variance = 0.5
    if year_str:
        try:
            year = int(year_str)
            if year >= 25:
                year_bonus = 0.3
            elif year == 24:
                year_bonus = 0.2
            elif year == 23:
                year_bonus = 0.1
            else:
                year_bonus = 0.0
                variance = 1.0  # stale rating
        except ValueError:
            pass

    return (base + year_bonus, variance)


def compute_posterior(prior_mean: float, prior_var: float,
                      observations: list[float], obs_var: float = 1.0) -> tuple[float, float]:
    """Conjugate normal-normal Bayesian update.

    Given a prior N(prior_mean, prior_var) and observations each with
    variance obs_var, compute the posterior mean and variance.
    """
    if not observations:
        return (prior_mean, prior_var)

    n = len(observations)
    obs_mean = sum(observations) / n

    post_var = 1.0 / (1.0 / prior_var + n / obs_var)
    post_mean = post_var * (prior_mean / prior_var + n * obs_mean / obs_var)

    return (post_mean, post_var)


def credible_interval(mean: float, var: float) -> tuple[float, float]:
    """80% credible interval: mean +/- 1.28 * sqrt(var)."""
    spread = 1.28 * math.sqrt(var)
    return (mean - spread, mean + spread)


def performance_label(posterior_mean: float) -> str:
    """Map posterior mean to a human-readable performance level."""
    if posterior_mean >= 4.5:
        return "A-level"
    elif posterior_mean >= 3.5:
        return "B-level"
    elif posterior_mean >= 2.5:
        return "C-level"
    elif posterior_mean >= 1.5:
        return "D-level"
    elif posterior_mean >= 0.8:
        return "E-level"
    else:
        return "Below rated"


def delta_label(prior_mean: float, posterior_mean: float) -> str:
    """Compare prior to posterior with a 0.5 threshold."""
    diff = posterior_mean - prior_mean
    if diff > 0.5:
        return "Above rating"
    elif diff < -0.5:
        return "Below rating"
    else:
        return "At expected level"


def win_probability(mu_a: float, var_a: float,
                    mu_b: float, var_b: float) -> float:
    """P(A > B) via normal CDF of the difference distribution."""
    diff_mean = mu_a - mu_b
    diff_var = var_a + var_b
    if diff_var <= 0:
        return 1.0 if diff_mean > 0 else 0.0
    z = diff_mean / math.sqrt(diff_var)
    return _normal_cdf(z)


def _normal_cdf(x: float) -> float:
    """Approximate the standard normal CDF using the error function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def extract_bout_observations(fencer_index: int, scores_matrix: list[list],
                               pool_fencers_priors: list[tuple[float, float]]) -> list[float]:
    """Extract observation values for one fencer from a score matrix.

    For each bout: opponent_prior_mean + (my_score - opp_score) / 5.0
    """
    observations = []
    n = len(scores_matrix)
    for j in range(n):
        if j == fencer_index:
            continue
        my_score = scores_matrix[fencer_index][j]
        opp_score = scores_matrix[j][fencer_index]
        if my_score is None or opp_score is None:
            continue
        opp_prior_mean = pool_fencers_priors[j][0]
        obs = opp_prior_mean + (my_score - opp_score) / 5.0
        observations.append(obs)
    return observations


def _compute_pool_summary(fencer_index: int, scores_matrix: list[list],
                           fencer_count: int) -> dict:
    """Compute V, TS, TR, Indicator, Place for a fencer in a pool."""
    victories = 0
    ts = 0  # touches scored
    tr = 0  # touches received
    n = fencer_count

    for j in range(n):
        if j == fencer_index:
            continue
        my_score = scores_matrix[fencer_index][j]
        opp_score = scores_matrix[j][fencer_index]
        if my_score is None or opp_score is None:
            continue
        ts += my_score
        tr += opp_score
        if my_score > opp_score:
            victories += 1

    indicator = ts - tr

    return {
        "victories": victories,
        "bouts": n - 1,
        "ts": ts,
        "tr": tr,
        "indicator": indicator,
    }


def _rank_pool(scores_matrix: list[list], fencer_count: int) -> list[int]:
    """Rank fencers in a pool by V then indicator then TS. Returns list of places (1-indexed)."""
    summaries = []
    for i in range(fencer_count):
        s = _compute_pool_summary(i, scores_matrix, fencer_count)
        summaries.append((i, s["victories"], s["indicator"], s["ts"]))

    # Sort: more victories first, then higher indicator, then higher TS
    summaries.sort(key=lambda x: (-x[1], -x[2], -x[3]))

    places = [0] * fencer_count
    for rank, (idx, _, _, _) in enumerate(summaries, start=1):
        places[idx] = rank

    return places


def compute_all_estimates(fencers: list[dict], pools: list[dict],
                           submissions: dict) -> dict:
    """Compute Bayesian estimates for all fencers.

    Returns dict[fencer_id -> analysis dict].
    """
    results = {}

    # Build lookup: fencer_id -> list of (pool, fencer_index_in_pool)
    fencer_pools: dict[int, list[tuple[dict, int]]] = {}
    for pool in pools:
        pool_id = pool["id"]
        if pool_id not in submissions:
            continue
        sub = submissions[pool_id]
        if sub.get("status") != "approved":
            continue
        for idx, pf in enumerate(pool.get("fencers", [])):
            fid = pf.get("id")
            if fid:
                fencer_pools.setdefault(fid, []).append((pool, idx))

    for fencer in fencers:
        fid = fencer["id"]
        rating = fencer.get("rating", "")
        prior_mean, prior_var = parse_rating(rating)

        analysis = {
            "fencer_id": fid,
            "prior_mean": round(prior_mean, 3),
            "prior_var": round(prior_var, 3),
            "posterior_mean": round(prior_mean, 3),
            "posterior_var": round(prior_var, 3),
            "has_pool_data": False,
            "pool_summaries": [],
            "bout_details": [],
            "credible_interval": list(credible_interval(prior_mean, prior_var)),
            "performance_label": performance_label(prior_mean),
            "delta_label": "No data",
            "delta_value": 0.0,
        }

        if fid not in fencer_pools:
            results[fid] = analysis
            continue

        # Collect all observations across pools
        all_observations = []
        pool_summaries = []
        bout_details = []

        for pool, fencer_idx in fencer_pools[fid]:
            pool_id = pool["id"]
            sub = submissions[pool_id]
            scores = sub.get("scores", [])
            fencer_count = len(scores)

            if fencer_count == 0:
                continue

            # Build priors for all fencers in this pool
            pool_fencers = pool.get("fencers", [])
            priors = []
            for pf in pool_fencers:
                r = pf.get("rating", "")
                priors.append(parse_rating(r))

            # Extract observations
            obs = extract_bout_observations(fencer_idx, scores, priors)
            all_observations.extend(obs)

            # Pool summary
            summary = _compute_pool_summary(fencer_idx, scores, fencer_count)
            places = _rank_pool(scores, fencer_count)
            summary["place"] = places[fencer_idx]
            summary["pool_id"] = pool_id
            summary["pool_number"] = pool.get("pool_number", 0)
            summary["event"] = pool.get("event", "")
            pool_summaries.append(summary)

            # Bout details
            for j in range(fencer_count):
                if j == fencer_idx:
                    continue
                my_score = scores[fencer_idx][j]
                opp_score = scores[j][fencer_idx]
                if my_score is None or opp_score is None:
                    continue
                opp = pool_fencers[j] if j < len(pool_fencers) else {}
                bout_details.append({
                    "pool_id": pool_id,
                    "opponent_name": f"{opp.get('first_name', '')} {opp.get('last_name', '')}".strip(),
                    "opponent_rating": opp.get("rating", "U"),
                    "opponent_club": opp.get("club", ""),
                    "my_score": my_score,
                    "opp_score": opp_score,
                    "victory": my_score > opp_score,
                })

        # Compute posterior
        post_mean, post_var = compute_posterior(prior_mean, prior_var, all_observations)
        ci = credible_interval(post_mean, post_var)
        delta_val = post_mean - prior_mean

        analysis.update({
            "posterior_mean": round(post_mean, 3),
            "posterior_var": round(post_var, 3),
            "has_pool_data": True,
            "pool_summaries": pool_summaries,
            "bout_details": bout_details,
            "credible_interval": [round(ci[0], 3), round(ci[1], 3)],
            "performance_label": performance_label(post_mean),
            "delta_label": delta_label(prior_mean, post_mean),
            "delta_value": round(delta_val, 3),
        })

        results[fid] = analysis

    return results
