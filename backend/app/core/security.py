"""
Security utilities: JWT verification via Supabase, authorized user check.
"""
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client
from app.core.config import settings

_bearer = HTTPBearer()


def _get_supabase_auth_client():
    key = settings.effective_anon_key or settings.supabase_service_role_key
    return create_client(settings.effective_supabase_url, key)


async def require_authorized_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> dict:
    """
    Validate the Bearer token issued by Supabase Auth and confirm
    the caller is the single authorized user.
    """
    token = credentials.credentials
    try:
        client = _get_supabase_auth_client()
        response = client.auth.get_user(token)
        user = response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Enforce single-user authorization
    user_email = (user.email or "").lower().strip()
    authorized_email = settings.authorized_user_email.lower().strip()
    if user_email != authorized_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return {"id": user.id, "email": user.email}
