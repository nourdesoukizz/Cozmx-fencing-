import base64
import json
import re
from pathlib import Path

from config import ANTHROPIC_API_KEY, SONNET_MODEL, OPUS_MODEL


def extract_scores(photo_path: str, pool: dict) -> dict:
    """Send pool sheet photo to Claude Vision and extract NxN score matrix."""
    import anthropic

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in backend/.env")

    fencers = pool.get("fencers", [])
    n = len(fencers)
    fencer_names = [f"{f.get('last_name', '')}, {f.get('first_name', '')}" for f in fencers]

    # Read and encode image
    image_data = Path(photo_path).read_bytes()
    base64_image = base64.b64encode(image_data).decode("utf-8")

    # Detect media type
    ext = Path(photo_path).suffix.lower()
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    media_type = media_types.get(ext, "image/jpeg")

    prompt = f"""You are analyzing a USFA fencing pool score sheet photograph.

This pool has {n} fencers in this order:
{chr(10).join(f"  {i+1}. {name}" for i, name in enumerate(fencer_names))}

Extract the {n}x{n} score matrix from the sheet. The matrix is a round-robin grid where:
- Each row represents a fencer (in the order listed above)
- Each column represents the opponent (same order)
- Diagonal cells are empty (fencer vs themselves)
- Each cell contains the score that the ROW fencer scored AGAINST the COLUMN fencer
- Scores are typically 0-5 for pool bouts to 5 touches

Return ONLY a JSON object with this exact format:
{{
  "scores": [[null, 5, 3, ...], [2, null, 5, ...], ...],
  "confidence": 0.95,
  "cell_confidence": [[null, 0.95, 0.3, ...], [0.9, null, 0.88, ...], ...]
}}

Where:
- "scores" is a {n}x{n} array. Use null for diagonal cells.
- "confidence" is your overall confidence level (0.0-1.0) in the accuracy of the extraction.
- "cell_confidence" is a {n}x{n} array mirroring the scores matrix. Use null for diagonal cells. For each score cell, provide your confidence (0.0-1.0) in that specific cell's accuracy. Use lower confidence for smudged, unclear, or ambiguous digits.

Important:
- Each inner array must have exactly {n} elements.
- There must be exactly {n} inner arrays.
- Only return the JSON object, no other text."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model=SONNET_MODEL,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64_image,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    # Parse response
    response_text = message.content[0].text.strip()
    # Extract JSON from response (handle markdown code blocks)
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if json_match:
        result = json.loads(json_match.group())
    else:
        raise ValueError(f"Could not parse OCR response: {response_text}")

    scores = result.get("scores", [])
    confidence = result.get("confidence", 0.0)

    # Validate dimensions
    if len(scores) != n:
        raise ValueError(f"Expected {n} rows, got {len(scores)}")
    for i, row in enumerate(scores):
        if len(row) != n:
            raise ValueError(f"Row {i} has {len(row)} columns, expected {n}")

    # Extract and validate cell_confidence matrix
    cell_confidence = result.get("cell_confidence", None)
    if cell_confidence is not None:
        if (not isinstance(cell_confidence, list)
                or len(cell_confidence) != n
                or any(not isinstance(r, list) or len(r) != n for r in cell_confidence)):
            cell_confidence = None

    first_pass = {"scores": scores, "confidence": confidence, "cell_confidence": cell_confidence}

    # ── Extended Thinking Second Pass (Opus 4.6) ─────────────────
    # If confidence is low, use extended thinking to reason through ambiguous cells
    if confidence < 0.8:
        try:
            second_pass = _extended_thinking_ocr(
                client, base64_image, media_type, fencer_names, n, first_pass
            )
            if second_pass:
                return second_pass
        except Exception as exc:
            print(f"[OCR] Extended thinking second pass failed: {exc}")

    return first_pass


def _extended_thinking_ocr(
    client, base64_image: str, media_type: str,
    fencer_names: list[str], n: int, first_pass: dict
) -> dict | None:
    """Second-pass OCR using Opus 4.6 with extended thinking for ambiguous sheets."""
    print(f"[OCR] Confidence {first_pass['confidence']:.0%} < 80% — invoking Opus 4.6 extended thinking")

    # Build a description of ambiguous cells from first pass
    ambiguous_cells = []
    cell_conf = first_pass.get("cell_confidence")
    scores = first_pass.get("scores", [])
    if cell_conf:
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                conf = cell_conf[i][j]
                if conf is not None and conf < 0.7:
                    ambiguous_cells.append(
                        f"  Row {i+1} ({fencer_names[i]}) vs Col {j+1} ({fencer_names[j]}): "
                        f"read as {scores[i][j]}, confidence {conf:.0%}"
                    )

    ambiguous_text = "\n".join(ambiguous_cells) if ambiguous_cells else "  (no specific cells flagged)"

    prompt = f"""You are re-analyzing a USFA fencing pool score sheet that had low OCR confidence on the first pass.

This pool has {n} fencers:
{chr(10).join(f"  {i+1}. {name}" for i, name in enumerate(fencer_names))}

First pass results (confidence: {first_pass['confidence']:.0%}):
Scores: {json.dumps(first_pass['scores'])}

Ambiguous cells from first pass:
{ambiguous_text}

Please carefully re-examine every cell in the score sheet. Think through each ambiguous digit:
- Cross-reference: if fencer A scored 5 against B, then A won that bout, so B's score should be < 5
- In fencing pool bouts to 5 touches, exactly one fencer scores 5 (the winner)
- Look at handwriting patterns: how does this writer form 3 vs 5? 1 vs 7?
- Check indicator sums: total touches scored across all fencers should equal total touches received

Return ONLY a JSON object:
{{
  "scores": [[null, 5, 3, ...], [2, null, 5, ...], ...],
  "confidence": 0.95,
  "cell_confidence": [[null, 0.95, 0.3, ...], [0.9, null, 0.88, ...], ...],
  "corrections": ["Changed R1C3 from 3 to 5 because...", ...]
}}"""

    message = client.messages.create(
        model=OPUS_MODEL,
        max_tokens=16000,
        thinking={
            "type": "enabled",
            "budget_tokens": 4096,
        },
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64_image,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    # Extract thinking and response
    thinking_text = ""
    response_text = ""
    for block in message.content:
        if block.type == "thinking":
            thinking_text = block.thinking
        elif block.type == "text":
            response_text = block.text.strip()

    if not response_text:
        return None

    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if not json_match:
        return None

    result = json.loads(json_match.group())
    new_scores = result.get("scores", [])
    new_confidence = result.get("confidence", 0.0)
    corrections = result.get("corrections", [])

    # Validate dimensions
    if len(new_scores) != n:
        return None
    for row in new_scores:
        if len(row) != n:
            return None

    new_cell_confidence = result.get("cell_confidence", None)
    if new_cell_confidence is not None:
        if (not isinstance(new_cell_confidence, list)
                or len(new_cell_confidence) != n
                or any(not isinstance(r, list) or len(r) != n for r in new_cell_confidence)):
            new_cell_confidence = None

    print(f"[OCR] Extended thinking complete: confidence {first_pass['confidence']:.0%} → {new_confidence:.0%}")
    if corrections:
        for c in corrections:
            print(f"[OCR]   Correction: {c}")

    return {
        "scores": new_scores,
        "confidence": new_confidence,
        "cell_confidence": new_cell_confidence,
        "extended_thinking": True,
        "thinking": thinking_text,
        "corrections": corrections,
        "first_pass_confidence": first_pass["confidence"],
    }


def validate_scores(matrix: list[list[int | None]], fencers: list[dict]) -> list[dict]:
    """Run validation checks on the score matrix. Returns list of anomaly dicts."""
    anomalies = []
    n = len(matrix) if matrix else 0

    if n == 0:
        return [{"level": "error", "message": "Empty score matrix"}]

    # Check 1: Indicator sum should be 0
    ts_list = []
    tr_list = []
    for i in range(n):
        ts = sum(matrix[i][j] for j in range(n) if i != j and matrix[i][j] is not None)
        tr = sum(matrix[j][i] for j in range(n) if i != j and matrix[j][i] is not None)
        ts_list.append(ts)
        tr_list.append(tr)

    indicator_sum = sum(ts_list[i] - tr_list[i] for i in range(n))
    if indicator_sum != 0:
        anomalies.append({
            "level": "error",
            "message": f"Indicator sum is {indicator_sum}, should be 0",
        })

    # Check 2: Scores in 0-5 range
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            val = matrix[i][j]
            if val is not None and (val < 0 or val > 5):
                fencer_name = fencers[i].get("last_name", f"Fencer {i+1}") if i < len(fencers) else f"Fencer {i+1}"
                anomalies.append({
                    "level": "error",
                    "message": f"{fencer_name} vs opponent {j+1}: score {val} out of 0-5 range",
                })

    # Check 3: In each bout, one fencer should have exactly 5 (winner)
    for i in range(n):
        for j in range(i + 1, n):
            score_a = matrix[i][j]
            score_b = matrix[j][i]
            if score_a is not None and score_b is not None:
                if score_a != 5 and score_b != 5:
                    fa = fencers[i].get("last_name", f"Fencer {i+1}") if i < len(fencers) else f"Fencer {i+1}"
                    fb = fencers[j].get("last_name", f"Fencer {j+1}") if j < len(fencers) else f"Fencer {j+1}"
                    anomalies.append({
                        "level": "warning",
                        "message": f"{fa} ({score_a}) vs {fb} ({score_b}): neither scored 5",
                    })

    # Check 4: No tied bouts
    for i in range(n):
        for j in range(i + 1, n):
            score_a = matrix[i][j]
            score_b = matrix[j][i]
            if score_a is not None and score_b is not None and score_a == score_b:
                fa = fencers[i].get("last_name", f"Fencer {i+1}") if i < len(fencers) else f"Fencer {i+1}"
                fb = fencers[j].get("last_name", f"Fencer {j+1}") if j < len(fencers) else f"Fencer {j+1}"
                anomalies.append({
                    "level": "error",
                    "message": f"{fa} vs {fb}: tied at {score_a}-{score_b}",
                })

    # Check 5: Rating upset alerts
    for i in range(n):
        for j in range(i + 1, n):
            score_a = matrix[i][j]
            score_b = matrix[j][i]
            if score_a is None or score_b is None:
                continue
            rating_a = fencers[i].get("rating", "") if i < len(fencers) else ""
            rating_b = fencers[j].get("rating", "") if j < len(fencers) else ""
            if not rating_a or not rating_b:
                continue
            rating_order = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "U": 5}
            rank_a = rating_order.get(rating_a[0].upper(), 5)
            rank_b = rating_order.get(rating_b[0].upper(), 5)
            if rank_a < rank_b and score_a < score_b:
                fa = fencers[i].get("last_name", f"Fencer {i+1}") if i < len(fencers) else f"Fencer {i+1}"
                fb = fencers[j].get("last_name", f"Fencer {j+1}") if j < len(fencers) else f"Fencer {j+1}"
                anomalies.append({
                    "level": "info",
                    "message": f"Upset: {fa} ({rating_a}) lost to {fb} ({rating_b})",
                })
            elif rank_b < rank_a and score_b < score_a:
                fa = fencers[i].get("last_name", f"Fencer {i+1}") if i < len(fencers) else f"Fencer {i+1}"
                fb = fencers[j].get("last_name", f"Fencer {j+1}") if j < len(fencers) else f"Fencer {j+1}"
                anomalies.append({
                    "level": "info",
                    "message": f"Upset: {fb} ({rating_b}) lost to {fa} ({rating_a})",
                })

    return anomalies


def compute_results(matrix: list[list[int | None]], fencers: list[dict]) -> list[dict]:
    """Compute V (victories), TS (touches scored), TR (touches received), Indicator, Place."""
    n = len(matrix) if matrix else 0
    results = []

    for i in range(n):
        victories = 0
        ts = 0
        tr = 0
        bouts = 0
        for j in range(n):
            if i == j:
                continue
            score_for = matrix[i][j]
            score_against = matrix[j][i]
            if score_for is not None:
                ts += score_for
            if score_against is not None:
                tr += score_against
            if score_for is not None and score_against is not None:
                bouts += 1
                if score_for > score_against:
                    victories += 1

        indicator = ts - tr
        fencer = fencers[i] if i < len(fencers) else {"last_name": f"Fencer {i+1}", "first_name": ""}
        results.append({
            "fencer_id": fencer.get("id"),
            "last_name": fencer.get("last_name", ""),
            "first_name": fencer.get("first_name", ""),
            "V": victories,
            "TS": ts,
            "TR": tr,
            "indicator": indicator,
            "place": 0,
        })

    results.sort(key=lambda r: (-r["V"], -r["indicator"], -r["TS"]))
    for place, r in enumerate(results, start=1):
        r["place"] = place

    return results
