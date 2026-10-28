"""
Document extraction service.
Supports: PDF (PyMuPDF), DOCX (python-docx), Images (Pillow + pytesseract), plain text.
"""
import io
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        pages = []
        for page in doc:
            pages.append(page.get_text())
        return "\n".join(pages).strip()
    except Exception as exc:
        logger.error("PDF extraction failed: %s", exc)
        raise RuntimeError(f"Failed to extract PDF text: {exc}") from exc


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs).strip()
    except Exception as exc:
        logger.error("DOCX extraction failed: %s", exc)
        raise RuntimeError(f"Failed to extract DOCX text: {exc}") from exc


def extract_text_from_image(content: bytes) -> str:
    """
    Extract text from image using pytesseract OCR.
    Falls back to returning an empty string with a warning if Tesseract is not installed.
    """
    try:
        import pytesseract
        from PIL import Image
        image = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(image)
        return text.strip()
    except ImportError:
        logger.warning("pytesseract not available — OCR skipped")
        return ""
    except Exception as exc:
        logger.error("Image OCR failed: %s", exc)
        raise RuntimeError(f"Failed to OCR image: {exc}") from exc


def extract_text(content: bytes, filename: str) -> str:
    """Dispatch to correct extractor based on file extension."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(content)
    elif ext in (".docx",):
        return extract_text_from_docx(content)
    elif ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"):
        return extract_text_from_image(content)
    elif ext in (".txt", ".md"):
        return content.decode("utf-8", errors="replace").strip()
    else:
        # Try as plain text
        try:
            return content.decode("utf-8", errors="replace").strip()
        except Exception:
            raise RuntimeError(f"Unsupported file type: {ext}")
