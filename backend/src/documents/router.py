"""
DOCUMENTS ROUTER — PDF/Document Analysis via Mistral OCR
v1.0 — Upload or URL → OCR extraction → LLM analysis

Endpoints:
    POST /api/documents/analyze-url     — Analyze a document from public URL
    POST /api/documents/analyze-upload  — Analyze an uploaded document
    POST /api/documents/ocr-only        — OCR extraction only (no LLM analysis)
    POST /api/documents/ask             — Ask a question about a document
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Optional

from db.database import User
from auth.dependencies import get_current_user
from billing.permissions import require_feature

logger = logging.getLogger(__name__)

router = APIRouter()

# Max upload size: 50MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024

SUPPORTED_EXTENSIONS = {
    "pdf", "docx", "pptx", "png", "jpg", "jpeg", "avif", "webp",
}


# =============================================================================
# SCHEMAS
# =============================================================================

class AnalyzeUrlRequest(BaseModel):
    """Analyze a document from a public URL."""
    document_url: str
    lang: str = "fr"
    table_format: str = "markdown"
    extract_headers: bool = False
    extract_footers: bool = False
    question: Optional[str] = None  # If set, answer this question


class AskDocumentRequest(BaseModel):
    """Ask a question about a previously OCR'd document."""
    document_url: str
    question: str
    lang: str = "fr"


# =============================================================================
# POST /api/documents/analyze-url — Analyze document from URL
# =============================================================================

@router.post("/analyze-url")
async def analyze_document_url(
    body: AnalyzeUrlRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Analyze a document from a public URL.

    Flow: URL → Mistral OCR → extract text → LLM analysis
    Returns: { pages, full_text, analysis, stats }
    """
    from core.document_ocr import process_document_url, analyze_document

    # Plan gating — Pro+ only
    user_plan = current_user.plan or "free"
    platform = request.query_params.get("platform", "web")
    require_feature(user_plan, "document_analysis", platform, label="Analyse de documents")

    # Validate URL
    if not body.document_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL invalide")

    # ── OCR extraction ───────────────────────────────────────────────────
    try:
        ocr_result = await process_document_url(
            document_url=body.document_url,
            table_format=body.table_format,
            extract_headers=body.extract_headers,
            extract_footers=body.extract_footers,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error("OCR URL failed: %s", e)
        raise HTTPException(status_code=502, detail=f"OCR processing failed: {e}")

    if ocr_result.is_empty:
        raise HTTPException(
            status_code=422,
            detail="Aucun texte n'a pu être extrait du document.",
        )

    # ── LLM analysis (if no specific question) ──────────────────────────
    analysis = None
    if body.question:
        try:
            analysis = await analyze_document(
                ocr_result, question=body.question, lang=body.lang,
            )
        except Exception as e:
            logger.warning("Document QA failed: %s", e)
    else:
        try:
            analysis = await analyze_document(ocr_result, lang=body.lang)
        except Exception as e:
            logger.warning("Document analysis failed: %s", e)

    logger.info("Document analyzed from URL", extra={
        "user_id": current_user.id,
        "pages": ocr_result.total_pages,
        "chars": ocr_result.total_chars,
    })

    return _build_response(ocr_result, analysis)


# =============================================================================
# POST /api/documents/analyze-upload — Analyze uploaded document
# =============================================================================

@router.post("/analyze-upload")
async def analyze_document_upload(
    request: Request,
    file: UploadFile = File(...),
    lang: str = Form("fr"),
    table_format: str = Form("markdown"),
    question: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    Analyze an uploaded document (PDF, DOCX, PPTX, or image).

    Multipart form: file + lang + table_format + question (optional)
    Returns: { pages, full_text, analysis, stats }
    """
    from core.document_ocr import process_document_base64, analyze_document

    # Plan gating
    user_plan = current_user.plan or "free"
    platform = request.query_params.get("platform", "web")
    require_feature(user_plan, "document_analysis", platform, label="Analyse de documents")

    # ── Validate file ────────────────────────────────────────────────────
    filename = file.filename or "document.pdf"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté: .{ext}. "
                   f"Formats acceptés: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    # Read file bytes
    file_bytes = await file.read()

    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux: {len(file_bytes)/1024/1024:.1f}MB "
                   f"(max: {MAX_UPLOAD_SIZE/1024/1024:.0f}MB)",
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")

    # ── OCR extraction ───────────────────────────────────────────────────
    try:
        ocr_result = await process_document_base64(
            data=file_bytes,
            filename=filename,
            table_format=table_format,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error("OCR upload failed: %s", e)
        raise HTTPException(status_code=502, detail=f"OCR processing failed: {e}")

    if ocr_result.is_empty:
        raise HTTPException(
            status_code=422,
            detail="Aucun texte n'a pu être extrait du document.",
        )

    # ── LLM analysis ────────────────────────────────────────────────────
    analysis = None
    if question:
        try:
            analysis = await analyze_document(
                ocr_result, question=question, lang=lang,
            )
        except Exception as e:
            logger.warning("Document QA on upload failed: %s", e)
    else:
        try:
            analysis = await analyze_document(ocr_result, lang=lang)
        except Exception as e:
            logger.warning("Document analysis on upload failed: %s", e)

    logger.info("Document analyzed from upload", extra={
        "user_id": current_user.id,
        "filename": filename,
        "pages": ocr_result.total_pages,
        "chars": ocr_result.total_chars,
    })

    return _build_response(ocr_result, analysis, filename=filename)


# =============================================================================
# POST /api/documents/ocr-only — Extract text only (no LLM)
# =============================================================================

@router.post("/ocr-only")
async def ocr_only(
    request: Request,
    file: UploadFile = File(...),
    table_format: str = Form("markdown"),
    current_user: User = Depends(get_current_user),
):
    """
    OCR extraction only — no LLM analysis.
    Useful for extracting text from scanned documents.
    """
    from core.document_ocr import process_document_base64

    # Plan gating — at least Starter
    user_plan = current_user.plan or "free"
    platform = request.query_params.get("platform", "web")
    require_feature(user_plan, "document_analysis", platform, label="OCR Documents")

    filename = file.filename or "document.pdf"
    file_bytes = await file.read()

    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")

    try:
        ocr_result = await process_document_base64(
            data=file_bytes,
            filename=filename,
            table_format=table_format,
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "pages": [
            {
                "index": p.index,
                "markdown": p.markdown,
                "header": p.header,
                "footer": p.footer,
                "confidence": p.confidence_score,
            }
            for p in ocr_result.pages
        ],
        "full_text": ocr_result.full_text,
        "total_pages": ocr_result.total_pages,
        "total_chars": ocr_result.total_chars,
        "processing_time": round(ocr_result.processing_time, 2),
    }


# =============================================================================
# GET /api/documents/formats — List supported formats
# =============================================================================

@router.get("/formats")
async def list_supported_formats():
    """Return supported document formats for OCR."""
    return {
        "documents": ["pdf", "docx", "pptx"],
        "images": ["png", "jpg", "jpeg", "avif", "webp"],
        "max_upload_mb": MAX_UPLOAD_SIZE / 1024 / 1024,
        "features": {
            "ocr_extraction": "Extract text, tables, headers/footers from documents",
            "document_analysis": "AI-powered summary and key points extraction",
            "document_qa": "Ask questions about document content",
            "table_formats": ["markdown", "html"],
        },
    }


# =============================================================================
# HELPER — Build response
# =============================================================================

def _build_response(
    ocr_result,
    analysis: Optional[str] = None,
    filename: Optional[str] = None,
) -> dict:
    """Build standardized API response from OCR result."""
    response = {
        "pages": [
            {
                "index": p.index,
                "markdown": p.markdown,
                "header": p.header,
                "footer": p.footer,
                "confidence": p.confidence_score,
                "tables_count": len(p.tables),
                "images_count": len(p.images),
            }
            for p in ocr_result.pages
        ],
        "full_text": ocr_result.full_text,
        "analysis": analysis,
        "stats": {
            "total_pages": ocr_result.total_pages,
            "total_chars": ocr_result.total_chars,
            "processing_time": round(ocr_result.processing_time, 2),
            "model": ocr_result.model,
        },
    }

    if filename:
        response["filename"] = filename

    return response
