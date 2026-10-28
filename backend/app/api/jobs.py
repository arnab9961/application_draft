"""
Jobs API router.
Handles job circular submission (file upload, text, URL),
automatic extraction, AI analysis, and draft generation.
"""
import hashlib
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status, BackgroundTasks

from app.core.security import require_authorized_user
from app.core.database import get_supabase
from app.models.schemas import ApplicationStatus
from app.services.extractor import extract_text
from app.services.url_fetcher import fetch_url_text
from app.services.groq_service import parse_job_circular, generate_application_email

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
}


async def _process_job(application_id: str, user_id: str, raw_text: str, instructions: Optional[str]):
    """Background processing: extract, parse, generate draft."""
    db = get_supabase()
    try:
        # Update status
        db.table("job_applications").update(
            {"status": ApplicationStatus.PROCESSING, "raw_text": raw_text}
        ).eq("id", application_id).execute()

        # Parse job info with AI
        job_info = parse_job_circular(raw_text)

        db.table("job_applications").update(
            {
                "status": ApplicationStatus.DRAFT_READY,
                "extracted_info": json.dumps(job_info.model_dump()),
            }
        ).eq("id", application_id).execute()

        # Get user profile and default CV
        profile_result = db.table("job_profiles").select("*").eq("user_id", user_id).execute()
        profile = profile_result.data[0] if profile_result.data else {}

        cv_result = (
            db.table("cv_documents")
            .select("id,filename,extracted_text")
            .eq("user_id", user_id)
            .eq("is_default", True)
            .execute()
        )
        cv = cv_result.data[0] if cv_result.data else None
        cv_text = cv["extracted_text"] if cv else ""
        cv_id = cv["id"] if cv else None

        # Generate email
        email_result = generate_application_email(
            job_info=job_info,
            profile=profile,
            cv_text=cv_text,
            instructions=instructions,
        )

        body = email_result.get("body", "")
        subject = email_result.get("subject", "")
        content_hash = hashlib.sha256(
            f"{job_info.application_email}{subject}{body}".encode()
        ).hexdigest()

        # Save draft
        db.table("application_drafts").insert(
            {
                "application_id": application_id,
                "recipient_email": job_info.application_email,
                "subject": subject,
                "body": body,
                "cv_document_id": cv_id,
                "cv_match_summary": email_result.get("cv_match_summary"),
                "missing_info": email_result.get("missing_info", []),
                "concerns": email_result.get("concerns", []),
                "draft_version": 1,
                "content_hash": content_hash,
                "ai_model_used": "groq",
            }
        ).execute()

        db.table("job_applications").update(
            {"status": ApplicationStatus.AWAITING_APPROVAL}
        ).eq("id", application_id).execute()

    except Exception as exc:
        db.table("job_applications").update(
            {
                "status": ApplicationStatus.FAILED,
                "error_message": str(exc)[:500],
            }
        ).eq("id", application_id).execute()


@router.post("/submit")
async def submit_job(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    instructions: Optional[str] = Form(None),
    user: dict = Depends(require_authorized_user),
):
    raw_text = ""
    source_type = "text"

    if file and file.filename:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail=f"File type not supported: {file.content_type}")
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large (max 50MB).")
        try:
            raw_text = extract_text(content, file.filename)
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        source_type = "file"
    elif url:
        try:
            raw_text = await fetch_url_text(url)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except RuntimeError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        source_type = "url"
    elif text:
        raw_text = text.strip()
        source_type = "text"
    else:
        raise HTTPException(status_code=400, detail="Provide a file, URL, or text.")

    if not raw_text:
        raise HTTPException(status_code=400, detail="No text could be extracted from the input.")

    # Create application record
    db = get_supabase()
    app_result = db.table("job_applications").insert(
        {
            "user_id": user["id"],
            "status": ApplicationStatus.PROCESSING,
            "source_type": source_type,
            "source_url": url,
        }
    ).execute()

    if not app_result.data:
        raise HTTPException(status_code=500, detail="Failed to create application record.")

    application_id = app_result.data[0]["id"]

    # Process in background
    background_tasks.add_task(_process_job, application_id, user["id"], raw_text, instructions)

    return {"application_id": application_id, "status": ApplicationStatus.PROCESSING}


@router.get("/{application_id}")
async def get_application(application_id: str, user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    result = (
        db.table("job_applications")
        .select("*")
        .eq("id", application_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found.")
    app = result.data[0]
    if app.get("extracted_info") and isinstance(app["extracted_info"], str):
        app["extracted_info"] = json.loads(app["extracted_info"])
    return app


@router.get("/{application_id}/draft")
async def get_draft(application_id: str, user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    # Verify ownership
    app = (
        db.table("job_applications")
        .select("id")
        .eq("id", application_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not app.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    draft = (
        db.table("application_drafts")
        .select("*")
        .eq("application_id", application_id)
        .order("draft_version", desc=True)
        .limit(1)
        .execute()
    )
    if not draft.data:
        raise HTTPException(status_code=404, detail="No draft found.")

    d = draft.data[0]
    # Enrich with CV filename
    if d.get("cv_document_id"):
        cv = db.table("cv_documents").select("filename").eq("id", d["cv_document_id"]).execute()
        d["cv_filename"] = cv.data[0]["filename"] if cv.data else None
    return d
