"""Pydantic models for all API request/response schemas."""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ─── Application Status ───────────────────────────────────────────────────────

class ApplicationStatus(str, Enum):
    PROCESSING = "processing"
    DRAFT_READY = "draft_ready"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    education: Optional[List[dict]] = None
    employment: Optional[List[dict]] = None
    skills: Optional[List[str]] = None
    projects: Optional[List[dict]] = None
    publications: Optional[List[dict]] = None
    achievements: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    preferred_titles: Optional[List[str]] = None
    preferred_arrangements: Optional[List[str]] = None


class ProfileResponse(ProfileUpdate):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


# ─── CV Documents ─────────────────────────────────────────────────────────────

class CVDocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    file_path: str
    extracted_text: Optional[str] = None
    is_default: bool
    created_at: datetime


# ─── Job Application ──────────────────────────────────────────────────────────

class JobApplicationCreate(BaseModel):
    source_url: Optional[str] = None
    raw_text: Optional[str] = None
    instructions: Optional[str] = None


class ExtractedJobInfo(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    required_qualifications: Optional[List[str]] = None
    preferred_qualifications: Optional[List[str]] = None
    required_skills: Optional[List[str]] = None
    application_email: Optional[str] = None
    email_subject: Optional[str] = None
    required_documents: Optional[List[str]] = None
    deadline: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    salary: Optional[str] = None
    application_instructions: Optional[str] = None
    source_url: Optional[str] = None


class JobApplicationResponse(BaseModel):
    id: str
    user_id: str
    status: ApplicationStatus
    extracted_info: Optional[ExtractedJobInfo] = None
    source_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ─── Application Draft ────────────────────────────────────────────────────────

class DraftUpdate(BaseModel):
    recipient_email: Optional[str] = None
    cc_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    cv_document_id: Optional[str] = None
    cover_letter: Optional[str] = None


class DraftResponse(BaseModel):
    id: str
    application_id: str
    recipient_email: Optional[str] = None
    cc_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    cv_document_id: Optional[str] = None
    cv_filename: Optional[str] = None
    cover_letter: Optional[str] = None
    draft_version: int
    content_hash: str
    ai_model_used: Optional[str] = None
    cv_match_summary: Optional[str] = None
    missing_info: Optional[List[str]] = None
    concerns: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime


# ─── Approval ─────────────────────────────────────────────────────────────────

class ApprovalRequest(BaseModel):
    draft_id: str
    draft_version: int
    content_hash: str


class ApprovalResponse(BaseModel):
    approval_id: str
    application_id: str
    draft_version: int
    approved_at: datetime


# ─── Send Operation ───────────────────────────────────────────────────────────

class SendRequest(BaseModel):
    approval_id: str
    idempotency_key: str


class SendResponse(BaseModel):
    operation_id: str
    status: str
    gmail_message_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


# ─── AI Rewrite ───────────────────────────────────────────────────────────────

class RewriteRequest(BaseModel):
    draft_id: str
    instruction: str  # e.g. "make it shorter", "more formal"


# ─── Gmail ────────────────────────────────────────────────────────────────────

class GmailStatusResponse(BaseModel):
    connected: bool
    email: Optional[str] = None


# ─── History ──────────────────────────────────────────────────────────────────

class HistoryItem(BaseModel):
    id: str
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    status: ApplicationStatus
    recipient_email: Optional[str] = None
    subject: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None
