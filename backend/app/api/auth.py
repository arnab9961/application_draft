"""Auth router — provides current user info for the frontend."""
from fastapi import APIRouter, Depends
from app.core.security import require_authorized_user

router = APIRouter()


@router.get("/me")
async def get_me(user: dict = Depends(require_authorized_user)):
    return user
