"""CV documents API router — upload, list, set default, delete."""
import hashlib
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from app.core.security import require_authorized_user
from app.core.database import get_supabase
from app.core.config import settings
from app.services.extractor import extract_text

router = APIRouter()

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


@router.get("/")
async def list_cvs(user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    result = (
        db.table("cv_documents")
        .select("id,filename,is_default,created_at,extracted_text")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    user: dict = Depends(require_authorized_user),
):
    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only PDF and DOCX files are allowed. Received: {file.content_type}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 20MB limit.",
        )

    # Extract text
    try:
        extracted_text = extract_text(content, file.filename or "cv.pdf")
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Upload to Supabase Storage
    db = get_supabase()
    ext = ALLOWED_TYPES[file.content_type]
    storage_path = f"{user['id']}/cv/{uuid.uuid4()}{ext}"

    try:
        db.storage.from_("private-documents").upload(
            path=storage_path,
            file=content,
            file_options={"content-type": file.content_type},
        )
    except Exception:
        try:
            db.storage.create_bucket("private-documents", {"public": False})
            db.storage.from_("private-documents").upload(
                path=storage_path,
                file=content,
                file_options={"content-type": file.content_type},
            )
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Storage bucket 'private-documents' not found. Please create a bucket named 'private-documents' in Supabase -> Storage.",
            )

    # Check if this is the first CV (auto-set as default)
    existing = db.table("cv_documents").select("id").eq("user_id", user["id"]).execute()
    is_default = len(existing.data or []) == 0

    result = db.table("cv_documents").insert(
        {
            "user_id": user["id"],
            "filename": file.filename,
            "file_path": storage_path,
            "extracted_text": extracted_text,
            "is_default": is_default,
        }
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save CV record.")
    return result.data[0]


@router.patch("/{cv_id}/set-default")
async def set_default_cv(cv_id: str, user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    # Ensure CV belongs to user
    existing = (
        db.table("cv_documents")
        .select("id")
        .eq("id", cv_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="CV not found.")

    # Unset all defaults
    db.table("cv_documents").update({"is_default": False}).eq("user_id", user["id"]).execute()
    # Set this one
    db.table("cv_documents").update({"is_default": True}).eq("id", cv_id).execute()
    return {"success": True}


@router.delete("/{cv_id}")
async def delete_cv(cv_id: str, user: dict = Depends(require_authorized_user)):
    db = get_supabase()
    existing = (
        db.table("cv_documents")
        .select("id,file_path,is_default")
        .eq("id", cv_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="CV not found.")

    cv = existing.data[0]
    # Delete from storage
    try:
        db.storage.from_("private-documents").remove([cv["file_path"]])
    except Exception:
        pass  # Storage deletion failure is non-fatal

    db.table("cv_documents").delete().eq("id", cv_id).execute()

    # If deleted the default, auto-promote the most recent
    if cv["is_default"]:
        remaining = (
            db.table("cv_documents")
            .select("id")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if remaining.data:
            db.table("cv_documents").update({"is_default": True}).eq(
                "id", remaining.data[0]["id"]
            ).execute()

    return {"success": True}
