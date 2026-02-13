import time
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from config import UPLOADS_DIR
from data_loader import (
    get_pool_by_id, save_submission, get_submission,
    write_scores_csv, get_event_status,
)

router = APIRouter(prefix="/api/pools", tags=["scores"])


class ApproveRequest(BaseModel):
    scores: list[list[int | None]]
    reviewed_by: str = "Bout Committee"


@router.post("/{pool_id}/upload")
async def upload_pool_photo(pool_id: int, file: UploadFile = File(...)):
    pool = get_pool_by_id(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")

    # Gate uploads on event status
    event_status = get_event_status(pool["event"])
    if event_status != "started":
        raise HTTPException(
            status_code=400,
            detail=f"Event '{pool['event']}' has not been started yet.",
        )

    # Save uploaded image
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = int(time.time())
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"pool_{pool_id}_{timestamp}.{ext}"
    filepath = UPLOADS_DIR / filename
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    photo_path = f"uploads/{filename}"

    # Run OCR extraction — fallback to empty matrix if OCR fails
    from ocr_service import extract_scores, validate_scores
    fencers = pool.get("fencers", [])
    n = len(fencers)
    ocr_status = "pending_review"

    try:
        ocr_result = extract_scores(str(filepath), pool)
        scores = ocr_result.get("scores", [])
        confidence = ocr_result.get("confidence", 0)
        anomalies = validate_scores(scores, fencers)
    except Exception as exc:
        scores = [[None] * n for _ in range(n)]
        confidence = 0
        anomalies = [{"level": "warning", "message": f"OCR failed: {exc}"}]
        ocr_status = "ocr_failed"

    submission = {
        "pool_id": pool_id,
        "status": ocr_status,
        "scores": scores,
        "anomalies": anomalies,
        "confidence": confidence,
        "photo_path": photo_path,
        "submitted_at": datetime.now().isoformat(),
        "reviewed_at": "",
        "reviewed_by": "",
    }
    save_submission(pool_id, submission)

    # Broadcast via WebSocket
    from main import manager
    await manager.broadcast({
        "type": "submission_received",
        "pool_id": pool_id,
        "status": ocr_status,
    })

    return {"status": "ok", "pool_id": pool_id, "submission": submission}


@router.get("/{pool_id}/submission")
async def get_pool_submission(pool_id: int):
    pool = get_pool_by_id(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")
    submission = get_submission(pool_id)
    if not submission:
        raise HTTPException(status_code=404, detail="No submission for this pool")
    return submission


@router.post("/{pool_id}/approve")
async def approve_pool_scores(pool_id: int, body: ApproveRequest):
    pool = get_pool_by_id(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")

    existing = get_submission(pool_id)
    if not existing:
        raise HTTPException(status_code=400, detail="No submission to approve")

    # Re-validate the edited scores
    from ocr_service import validate_scores, compute_results
    fencers = pool.get("fencers", [])
    anomalies = validate_scores(body.scores, fencers)
    errors = [a for a in anomalies if a.get("level") == "error"]
    if errors:
        raise HTTPException(status_code=400, detail={
            "message": "Scores have validation errors",
            "anomalies": errors,
        })

    # Compute results and attach to pool
    results = compute_results(body.scores, fencers)

    existing["scores"] = body.scores
    existing["anomalies"] = anomalies
    existing["status"] = "approved"
    existing["reviewed_at"] = datetime.now().isoformat()
    existing["reviewed_by"] = body.reviewed_by
    existing["results"] = results

    save_submission(pool_id, existing)
    write_scores_csv()

    # Broadcast via WebSocket
    from main import manager
    await manager.broadcast({
        "type": "scores_approved",
        "pool_id": pool_id,
        "status": "approved",
    })

    # Trigger PA announcement
    from announcer import announcer
    await announcer.generate("pool_approved", {"event_name": pool["event"], "pool_number": pool["pool_number"]})

    return {"status": "ok", "pool_id": pool_id, "results": results}
