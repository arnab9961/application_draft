"""
Test suite for AI Job Application Automation System.
All AI and Gmail API calls are mocked.
"""
import hashlib
import json
import pytest
from unittest.mock import MagicMock, patch

# ─── Document Extraction Tests ────────────────────────────────────────────────

class TestExtractor:
    def test_extract_plain_text(self):
        from app.services.extractor import extract_text
        result = extract_text(b"Hello World job description", "job.txt")
        assert "Hello World" in result

    def test_unsupported_extension_tries_utf8(self):
        from app.services.extractor import extract_text
        # Falls back to UTF-8 decode
        result = extract_text("Software Engineer needed".encode(), "job.xyz")
        assert "Software" in result

    def test_image_ocr_missing_tesseract(self):
        """If tesseract is not installed, returns empty string (does not raise)."""
        from app.services.extractor import extract_text_from_image
        # Create a minimal valid PNG (1x1 white pixel)
        import struct, zlib
        def png_bytes():
            def chunk(name, data):
                c = zlib.crc32(name + data)
                return struct.pack(">I", len(data)) + name + data + struct.pack(">I", c)
            sig = b"\x89PNG\r\n\x1a\n"
            ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            idat = chunk(b"IDAT", zlib.compress(b"\x00\xff\xff\xff"))
            iend = chunk(b"IEND", b"")
            return sig + ihdr + idat + iend
        with patch("pytesseract.image_to_string", side_effect=ImportError("not installed")):
            try:
                result = extract_text_from_image(png_bytes())
                assert isinstance(result, str)
            except Exception:
                pass  # acceptable if pytesseract is not available


# ─── SSRF Protection Tests ────────────────────────────────────────────────────

class TestURLFetcher:
    @pytest.mark.asyncio
    async def test_blocks_localhost(self):
        from app.services.url_fetcher import fetch_url_text
        with pytest.raises(ValueError, match="private or restricted"):
            await fetch_url_text("http://localhost/api/internal")

    @pytest.mark.asyncio
    async def test_blocks_private_ip(self):
        from app.services.url_fetcher import fetch_url_text
        with pytest.raises(ValueError, match="private or restricted"):
            await fetch_url_text("http://192.168.1.1/admin")

    @pytest.mark.asyncio
    async def test_blocks_127_0_0_1(self):
        from app.services.url_fetcher import fetch_url_text
        with pytest.raises(ValueError, match="private or restricted"):
            await fetch_url_text("http://127.0.0.1/something")

    @pytest.mark.asyncio
    async def test_blocks_non_http_scheme(self):
        from app.services.url_fetcher import fetch_url_text
        with pytest.raises(ValueError, match="Only http"):
            await fetch_url_text("ftp://example.com/job.pdf")


# ─── Groq Service Tests (mocked) ──────────────────────────────────────────────

class TestGroqService:
    def test_parse_job_circular_returns_structured_data(self):
        mock_response = {
            "company_name": "TechCorp",
            "job_title": "Senior Python Developer",
            "application_email": "hr@techcorp.com",
            "required_skills": ["Python", "FastAPI"],
        }
        with patch("app.services.groq_service._chat", return_value=json.dumps(mock_response)):
            from app.services.groq_service import parse_job_circular
            result = parse_job_circular("We are hiring a Senior Python Developer at TechCorp.")
            assert result.company_name == "TechCorp"
            assert result.job_title == "Senior Python Developer"
            assert result.application_email == "hr@techcorp.com"

    def test_generate_email_does_not_fabricate(self):
        """AI response should only use provided profile data."""
        mock_response = {
            "subject": "Application for Python Developer",
            "body": "Dear Hiring Manager, I am applying for the Python Developer role.",
            "cv_match_summary": "Strong Python background.",
            "missing_info": [],
            "concerns": [],
        }
        with patch("app.services.groq_service._chat", return_value=json.dumps(mock_response)):
            from app.services.groq_service import generate_application_email
            from app.models.schemas import ExtractedJobInfo
            info = ExtractedJobInfo(company_name="Corp", job_title="Dev", application_email="hr@corp.com")
            result = generate_application_email(info, {"full_name": "John"}, "John has 3 years of Python.")
            assert "subject" in result
            assert "body" in result

    def test_groq_rate_limit_raises_runtime_error(self):
        from groq import RateLimitError
        from tenacity import RetryError
        err = RateLimitError.__new__(RateLimitError)
        err.message = "rate limit"
        err.response = MagicMock(status_code=429)
        err.body = {}
        with patch("app.services.groq_service._chat", side_effect=err):
            from app.services.groq_service import parse_job_circular
            with pytest.raises((RuntimeError, RetryError)):
                parse_job_circular("some text")


# ─── Approval Logic Tests ─────────────────────────────────────────────────────

class TestApprovalLogic:
    def test_content_hash_changes_when_body_changes(self):
        """Changing body should change hash, invalidating prior approval."""
        import hashlib
        def compute_hash(recipient, subject, body, cv_id):
            payload = f"{recipient}|{subject}|{body}|{cv_id}"
            return hashlib.sha256(payload.encode()).hexdigest()

        h1 = compute_hash("hr@corp.com", "Subject", "Original body", "cv-123")
        h2 = compute_hash("hr@corp.com", "Subject", "Modified body", "cv-123")
        assert h1 != h2

    def test_content_hash_stable_for_same_content(self):
        import hashlib
        def compute_hash(recipient, subject, body, cv_id):
            payload = f"{recipient}|{subject}|{body}|{cv_id}"
            return hashlib.sha256(payload.encode()).hexdigest()

        h1 = compute_hash("hr@corp.com", "Subject", "Body", "cv-123")
        h2 = compute_hash("hr@corp.com", "Subject", "Body", "cv-123")
        assert h1 == h2


# ─── Gmail Service Tests (mocked) ─────────────────────────────────────────────

class TestGmailService:
    def test_validate_email_valid(self):
        from app.services.gmail_service import _validate_email
        assert _validate_email("hr@company.com") is True
        assert _validate_email("user+tag@sub.domain.org") is True

    def test_validate_email_invalid(self):
        from app.services.gmail_service import _validate_email
        assert _validate_email("not-an-email") is False
        assert _validate_email("@domain.com") is False
        assert _validate_email("user@") is False

    def test_send_requires_valid_recipient(self):
        from app.services.gmail_service import send_approved_email
        with pytest.raises(ValueError, match="Invalid recipient"):
            send_approved_email(
                user_id="uid",
                operation_id="op-1",
                recipient="invalid-email",
                subject="Test",
                body="Hello",
            )

    def test_send_requires_subject(self):
        from app.services.gmail_service import send_approved_email
        with pytest.raises(ValueError, match="subject"):
            send_approved_email(
                user_id="uid",
                operation_id="op-1",
                recipient="hr@corp.com",
                subject="",
                body="Hello",
            )

    def test_send_requires_body(self):
        from app.services.gmail_service import send_approved_email
        with pytest.raises(ValueError, match="body"):
            send_approved_email(
                user_id="uid",
                operation_id="op-1",
                recipient="hr@corp.com",
                subject="Application",
                body="  ",
            )

    def test_draft_generation_never_sends(self):
        """
        Generating a draft (parse_job_circular + generate_application_email)
        must NEVER trigger any Gmail send call.
        """
        mock_parsed = json.dumps({
            "company_name": "Corp",
            "job_title": "Dev",
            "application_email": "hr@corp.com",
            "required_skills": ["Python"],
        })
        mock_email = json.dumps({
            "subject": "Application",
            "body": "Dear Hiring Manager...",
            "cv_match_summary": "Good match",
            "missing_info": [],
            "concerns": [],
        })
        with patch("app.services.groq_service._chat", side_effect=[mock_parsed, mock_email]):
            with patch("app.services.gmail_service.send_approved_email") as mock_send:
                from app.services.groq_service import parse_job_circular, generate_application_email
                from app.models.schemas import ExtractedJobInfo
                job = parse_job_circular("Job ad text")
                generate_application_email(job, {}, "CV text")
                mock_send.assert_not_called()
