"""
Gmail OAuth 2.0 and send service.
- Manages OAuth flow and token storage in Supabase
- Sends emails only after explicit, version-bound approval
- Uses idempotency key to prevent duplicate sends
"""
import base64
import json
import logging
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def _validate_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email.strip()))


def get_oauth_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uris": [settings.google_redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


def get_authorization_url(user_id: str) -> str:
    flow = get_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=user_id,
    )
    return auth_url


def exchange_code_and_store(code: str, user_id: str) -> str:
    """Exchange OAuth code for tokens and persist refresh token in Supabase."""
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Get user email from Gmail API
    service = build("gmail", "v1", credentials=credentials)
    profile = service.users().getProfile(userId="me").execute()
    gmail_email = profile.get("emailAddress", "")

    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes or []),
    }

    db = get_supabase()
    # Upsert token for this user
    db.table("gmail_tokens").upsert(
        {
            "user_id": user_id,
            "email": gmail_email,
            "token_data": json.dumps(token_data),
        },
        on_conflict="user_id",
    ).execute()

    return gmail_email


def get_gmail_status(user_id: str) -> dict:
    db = get_supabase()
    result = db.table("gmail_tokens").select("email").eq("user_id", user_id).execute()
    if result.data:
        return {"connected": True, "email": result.data[0]["email"]}
    return {"connected": False, "email": None}


def disconnect_gmail(user_id: str):
    db = get_supabase()
    db.table("gmail_tokens").delete().eq("user_id", user_id).execute()


def _get_credentials(user_id: str) -> Credentials:
    db = get_supabase()
    result = db.table("gmail_tokens").select("token_data").eq("user_id", user_id).execute()
    if not result.data:
        raise RuntimeError("Gmail not connected. Please connect your Gmail account first.")
    token_data = json.loads(result.data[0]["token_data"])
    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
        scopes=token_data.get("scopes", SCOPES),
    )
    return creds


def _build_message(
    to: str,
    subject: str,
    body: str,
    cc: Optional[str] = None,
    attachments: Optional[list] = None,
) -> dict:
    if attachments:
        msg = MIMEMultipart()
        msg.attach(MIMEText(body, "plain"))
        for att in attachments:
            part = MIMEApplication(att["content"], Name=att["filename"])
            part["Content-Disposition"] = f'attachment; filename="{att["filename"]}"'
            msg.attach(part)
    else:
        msg = MIMEText(body, "plain")

    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return {"raw": raw}


def send_approved_email(
    user_id: str,
    operation_id: str,
    recipient: str,
    subject: str,
    body: str,
    cc: Optional[str] = None,
    attachments: Optional[list] = None,
) -> str:
    """
    Send an approved email. Returns the Gmail message ID.
    Validates recipient, subject, and body before sending.
    Uses idempotency via operation_id in DB.
    """
    if not _validate_email(recipient):
        raise ValueError(f"Invalid recipient email: {recipient}")
    if not subject or not subject.strip():
        raise ValueError("Email subject is required.")
    if not body or not body.strip():
        raise ValueError("Email body is required.")

    db = get_supabase()

    # Check if this operation was already completed (idempotency)
    existing = (
        db.table("email_send_operations")
        .select("status,gmail_message_id")
        .eq("id", operation_id)
        .execute()
    )
    if existing.data:
        op = existing.data[0]
        if op["status"] == "sent":
            logger.info("Operation %s already completed — skipping duplicate send.", operation_id)
            return op["gmail_message_id"]
        if op["status"] == "sending":
            raise RuntimeError("Send operation already in progress.")

    # Mark as sending
    db.table("email_send_operations").update({"status": "sending"}).eq("id", operation_id).execute()

    try:
        creds = _get_credentials(user_id)
        service = build("gmail", "v1", credentials=creds)
        message = _build_message(recipient, subject, body, cc=cc, attachments=attachments)
        result = service.users().messages().send(userId="me", body=message).execute()
        gmail_msg_id = result.get("id")

        # Mark as sent with Gmail message ID
        import datetime
        db.table("email_send_operations").update(
            {
                "status": "sent",
                "gmail_message_id": gmail_msg_id,
                "sent_at": datetime.datetime.utcnow().isoformat(),
            }
        ).eq("id", operation_id).execute()

        logger.info("Email sent successfully. Gmail message ID: %s", gmail_msg_id)
        return gmail_msg_id

    except HttpError as exc:
        logger.error("Gmail API error during send: %s", exc)
        db.table("email_send_operations").update(
            {"status": "failed", "error_detail": str(exc)}
        ).eq("id", operation_id).execute()
        raise RuntimeError(f"Gmail send failed: {exc}") from exc
    except Exception as exc:
        logger.error("Unexpected error during send: %s", exc)
        db.table("email_send_operations").update(
            {"status": "failed", "error_detail": str(exc)}
        ).eq("id", operation_id).execute()
        raise
