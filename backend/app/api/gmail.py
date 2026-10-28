"""Gmail OAuth connection router."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from app.core.security import require_authorized_user
from app.core.config import settings
from app.services.gmail_service import (
    get_authorization_url,
    exchange_code_and_store,
    get_gmail_status,
    disconnect_gmail,
)

router = APIRouter()


@router.get("/connect")
async def connect_gmail(user: dict = Depends(require_authorized_user)):
    auth_url = get_authorization_url(user["id"])
    return {"auth_url": auth_url}


@router.get("/callback")
async def gmail_callback(request: Request, code: str, state: str):
    """OAuth2 callback — exchanges code for tokens and stores them."""
    # state contains the user_id set during authorization
    user_id = state
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")
    try:
        email = exchange_code_and_store(code=code, user_id=user_id)
    except Exception as exc:
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/gmail?error=oauth_failed"
        )
    return RedirectResponse(
        url=f"{settings.frontend_url}/settings/gmail?connected=true&email={email}"
    )


@router.get("/status")
async def gmail_status(user: dict = Depends(require_authorized_user)):
    return get_gmail_status(user["id"])


@router.delete("/disconnect")
async def gmail_disconnect(user: dict = Depends(require_authorized_user)):
    disconnect_gmail(user["id"])
    return {"success": True}
