"""Profile API router."""
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_authorized_user
from app.core.database import get_supabase
from app.models.schemas import ProfileUpdate

router = APIRouter()


@router.get("/")
async def get_profile(user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    result = db.table("profiles").select("*").eq("user_id", user["id"]).execute()
    if not result.data:
        return {}
    return result.data[0]


@router.put("/")
async def update_profile(
    payload: ProfileUpdate, user: dict = Depends(require_authorized_user)
):
    db = get_supabase()
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    data["user_id"] = user["id"]

    existing = db.table("profiles").select("id").eq("user_id", user["id"]).execute()
    if existing.data:
        result = (
            db.table("profiles").update(data).eq("user_id", user["id"]).execute()
        )
    else:
        result = db.table("profiles").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save profile")
    return result.data[0]
