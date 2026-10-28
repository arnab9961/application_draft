"""
Drafts API — edit, rewrite, approve, and send.
This is the most security-critical module.
NEVER sends email without explicit, version-bound approval.
"""
import hashlib
import uuid
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_authorized_user
from app.core.database import get_supabase
from app.models.schemas import DraftUpdate, ApprovalRequest, SendRequest
from app.services.groq_service import rewrite_draft
from app.services.gmail_service import send_approved_email

router = APIRouter()


def _compute_hash(recipient: str, subject: str, body: str, cv_id: str) -> str:
    payload = f"{recipient}|{subject}|{body}|{cv_id}"
    return hashlib.sha256(payload.encode()).hexdigest()


def _get_owned_draft(draft_id: str, user_id: str, db):
    """Return draft only if the application belongs to the user."""
    draft = db.table("application_drafts").select("*").eq("id", draft_id).execute()
    if not draft.data:
        raise HTTPException(status_code=404, detail="Draft not found.")
    d = draft.data[0]
    # Verify ownership via application
    app = (
        db.table("job_applications")
        .select("id,user_id")
        .eq("id", d["application_id"])
        .execute()
    )
    if not app.data or app.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return d


@router.put("/{draft_id}")
async def update_draft(
    draft_id: str,
    payload: DraftUpdate,
    user: dict = Depends(require_authorized_user),
):
    db = get_supabase()
    d = _get_owned_draft(draft_id, user["id"], db)

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    # Recompute content hash on any field change
    new_recipient = updates.get("recipient_email", d.get("recipient_email", ""))
    new_subject = updates.get("subject", d.get("subject", ""))
    new_body = updates.get("body", d.get("body", ""))
    new_cv_id = updates.get("cv_document_id", d.get("cv_document_id", ""))
    new_hash = _compute_hash(
        str(new_recipient), str(new_subject), str(new_body), str(new_cv_id)
    )

    # Bump version
    updates["draft_version"] = d["draft_version"] + 1
    updates["content_hash"] = new_hash

    result = db.table("application_drafts").update(updates).eq("id", draft_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update draft.")
    return result.data[0]


@router.post("/{draft_id}/rewrite")
async def rewrite_draft_endpoint(
    draft_id: str,
    payload: dict,
    user: dict = Depends(require_authorized_user),
):
    instruction = payload.get("instruction", "")
    if not instruction:
        raise HTTPException(status_code=400, detail="Rewrite instruction required.")

    db = get_supabase()
    d = _get_owned_draft(draft_id, user["id"], db)

    # Get job context
    app_result = (
        db.table("job_applications")
        .select("extracted_info")
        .eq("id", d["application_id"])
        .execute()
    )
    job_context = ""
    if app_result.data:
        info = app_result.data[0].get("extracted_info", "{}")
        if isinstance(info, str):
            info = json.loads(info)
        job_context = json.dumps(info)

    try:
        new_body = rewrite_draft(d["body"] or "", instruction, job_context)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    new_hash = _compute_hash(
        str(d.get("recipient_email", "")),
        str(d.get("subject", "")),
        new_body,
        str(d.get("cv_document_id", "")),
    )

    result = db.table("application_drafts").update(
        {
            "body": new_body,
            "draft_version": d["draft_version"] + 1,
            "content_hash": new_hash,
        }
    ).eq("id", draft_id).execute()
    return result.data[0] if result.data else {"body": new_body}


@router.post("/approve")
async def approve_draft(
    payload: ApprovalRequest,
    user: dict = Depends(require_authorized_user),
):
    """
    Record approval for a specific draft version + content hash.
    The approval is bound to the exact content at time of approval.
    Any subsequent edit invalidates it.
    """
    db = get_supabase()
    d = _get_owned_draft(payload.draft_id, user["id"], db)

    # Verify version and hash match exactly
    if d["draft_version"] != payload.draft_version:
        raise HTTPException(
            status_code=409,
            detail="Draft has been modified since approval was initiated. Please review again.",
        )
    if d["content_hash"] != payload.content_hash:
        raise HTTPException(
            status_code=409,
            detail="Draft content has changed. Approval is invalid. Please review again.",
        )

    # Check for existing valid approval
    existing_approval = (
        db.table("application_approvals")
        .select("id")
        .eq("draft_id", payload.draft_id)
        .eq("draft_version", payload.draft_version)
        .eq("content_hash", payload.content_hash)
        .execute()
    )
    if existing_approval.data:
        return {"approval_id": existing_approval.data[0]["id"], "already_approved": True}

    result = db.table("application_approvals").insert(
        {
            "draft_id": payload.draft_id,
            "application_id": d["application_id"],
            "draft_version": payload.draft_version,
            "content_hash": payload.content_hash,
            "approved_by": user["id"],
            "approved_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to record approval.")

    # Update application status
    db.table("job_applications").update(
        {"status": "approved"}
    ).eq("id", d["application_id"]).execute()

    return {"approval_id": result.data[0]["id"]}


@router.post("/send")
async def send_email(
    payload: SendRequest,
    user: dict = Depends(require_authorized_user),
):
    """
    Send an approved application.
    Verifies:
    1. Approval exists and belongs to user
    2. Draft content matches the approved version exactly
    3. No previous successful send has occurred
    4. Recipient email is valid
    """
    db = get_supabase()

    # Get approval record
    approval = (
        db.table("application_approvals")
        .select("*")
        .eq("id", payload.approval_id)
        .execute()
    )
    if not approval.data:
        raise HTTPException(status_code=404, detail="Approval not found.")
    approval_data = approval.data[0]

    # Verify approval belongs to user (via draft -> application -> user)
    d = _get_owned_draft(approval_data["draft_id"], user["id"], db)

    # Verify draft version and hash still match approval
    if d["draft_version"] != approval_data["draft_version"]:
        raise HTTPException(
            status_code=409,
            detail="Draft was modified after approval. Re-approval required.",
        )
    if d["content_hash"] != approval_data["content_hash"]:
        raise HTTPException(
            status_code=409,
            detail="Draft content changed after approval. Re-approval required.",
        )

    # Validate required fields
    if not d.get("recipient_email"):
        raise HTTPException(status_code=400, detail="Recipient email is required before sending.")
    if not d.get("subject"):
        raise HTTPException(status_code=400, detail="Email subject is required.")
    if not d.get("body"):
        raise HTTPException(status_code=400, detail="Email body is required.")

    # Prevent duplicate successful sends
    existing_send = (
        db.table("email_send_operations")
        .select("id,status,gmail_message_id")
        .eq("approval_id", payload.approval_id)
        .execute()
    )
    if existing_send.data:
        op = existing_send.data[0]
        if op["status"] == "sent":
            return {
                "operation_id": op["id"],
                "status": "sent",
                "gmail_message_id": op["gmail_message_id"],
                "message": "Already sent (idempotent).",
            }

    # Create send operation record
    operation_id = str(uuid.uuid4())
    db.table("email_send_operations").insert(
        {
            "id": operation_id,
            "approval_id": payload.approval_id,
            "draft_id": d["id"],
            "application_id": d["application_id"],
            "idempotency_key": payload.idempotency_key,
            "status": "pending",
            "recipient_email": d["recipient_email"],
        }
    ).execute()

    # Update application status
    db.table("job_applications").update(
        {"status": "sending"}
    ).eq("id", d["application_id"]).execute()

    # Fetch CV attachment
    attachments = []
    if d.get("cv_document_id"):
        cv = (
            db.table("cv_documents")
            .select("filename,file_path")
            .eq("id", d["cv_document_id"])
            .execute()
        )
        if cv.data:
            try:
                file_bytes = db.storage.from_("private-documents").download(cv.data[0]["file_path"])
                attachments.append({"filename": cv.data[0]["filename"], "content": file_bytes})
            except Exception as exc:
                raise HTTPException(
                    status_code=500, detail=f"Failed to retrieve CV attachment: {exc}"
                )

    # Send via Gmail
    try:
        gmail_msg_id = send_approved_email(
            user_id=user["id"],
            operation_id=operation_id,
            recipient=d["recipient_email"],
            subject=d["subject"],
            body=d["body"],
            cc=d.get("cc_email"),
            attachments=attachments if attachments else None,
        )

        # Update application status to sent
        db.table("job_applications").update(
            {"status": "sent"}
        ).eq("id", d["application_id"]).execute()

        return {
            "operation_id": operation_id,
            "status": "sent",
            "gmail_message_id": gmail_msg_id,
        }

    except RuntimeError as exc:
        db.table("job_applications").update(
            {"status": "failed"}
        ).eq("id", d["application_id"]).execute()
        raise HTTPException(status_code=502, detail=str(exc))
