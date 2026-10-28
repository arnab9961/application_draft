"""Application history router."""
from fastapi import APIRouter, Depends, Query
from app.core.security import require_authorized_user
from app.core.database import get_supabase
import json

router = APIRouter()


@router.get("/")
async def get_history(
    user: dict = Depends(require_authorized_user),
    status: str = Query(None),
    search: str = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
):
    db = get_supabase()
    query = (
        db.table("job_applications")
        .select("id,status,source_type,created_at,extracted_info,error_message")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
    )
    if status:
        query = query.eq("status", status)

    result = query.execute()
    items = []
    for row in result.data or []:
        info = row.get("extracted_info") or "{}"
        if isinstance(info, str):
            try:
                info = json.loads(info)
            except Exception:
                info = {}
        items.append(
            {
                "id": row["id"],
                "company_name": info.get("company_name"),
                "job_title": info.get("job_title"),
                "status": row["status"],
                "source_type": row["source_type"],
                "created_at": row["created_at"],
                "error_message": row.get("error_message"),
            }
        )

    # Apply search filter
    if search:
        s = search.lower()
        items = [
            i for i in items
            if s in (i.get("company_name") or "").lower()
            or s in (i.get("job_title") or "").lower()
        ]

    return {"items": items, "total": len(items)}


@router.get("/stats")
async def get_stats(user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    result = (
        db.table("job_applications")
        .select("status")
        .eq("user_id", user["id"])
        .execute()
    )
    counts = {
        "total": 0,
        "processing": 0,
        "draft_ready": 0,
        "awaiting_approval": 0,
        "sent": 0,
        "failed": 0,
    }
    for row in result.data or []:
        counts["total"] += 1
        s = row.get("status", "")
        if s in counts:
            counts[s] += 1
        if s in ("draft_ready", "awaiting_approval"):
            counts["draft_ready"] = counts.get("draft_ready", 0) + (1 if s == "draft_ready" else 0)
    return counts
