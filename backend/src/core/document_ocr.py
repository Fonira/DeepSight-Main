"""
MISTRAL DOCUMENT OCR — PDF/Image Analysis Pipeline
v1.0 — Extract text, tables, and structure from documents via Mistral OCR

Architecture:
    1. Accept document (PDF URL, base64, or uploaded file bytes)
    2. Call Mistral OCR API (mistral-ocr-latest)
    3. Return structured pages with markdown content
    4. Optionally: pass OCR text to LLM for analysis/summary

API: POST https://api.mistral.ai/v1/ocr
Model: mistral-ocr-latest
Supports: PDF, DOCX, PPTX, PNG, JPEG, AVIF
"""

import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from core.config import get_mistral_key

logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTS
# =============================================================================

MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"
MISTRAL_OCR_MODEL = "mistral-ocr-latest"

# Max document size (base64 = ~33% overhead → ~75MB raw)
MAX_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024  # 100MB encoded
OCR_TIMEOUT = 300  # 5 minutes max for large documents

# Supported MIME types
SUPPORTED_DOCUMENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

SUPPORTED_IMAGE_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/jpg": "jpg",
    "image/avif": "avif",
    "image/webp": "webp",
}

ALL_SUPPORTED_TYPES = {**SUPPORTED_DOCUMENT_TYPES, **SUPPORTED_IMAGE_TYPES}


# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class OCRPage:
    """A single page extracted by OCR."""

    index: int
    markdown: str
    header: Optional[str] = None
    footer: Optional[str] = None
    confidence_score: Optional[float] = None
    tables: List[str] = field(default_factory=list)
    images: List[str] = field(default_factory=list)


@dataclass
class OCRResult:
    """Complete OCR result for a document."""

    pages: List[OCRPage]
    model: str = MISTRAL_OCR_MODEL
    total_pages: int = 0
    total_chars: int = 0
    processing_time: float = 0.0
    full_text: str = ""  # All pages concatenated

    @property
    def is_empty(self) -> bool:
        return self.total_chars == 0 or not self.pages


# =============================================================================
# OCR API — Process Document
# =============================================================================


async def process_document_url(
    document_url: str,
    table_format: Optional[str] = "markdown",
    extract_headers: bool = False,
    extract_footers: bool = False,
    include_images: bool = False,
) -> OCRResult:
    """
    Process a document from a public URL via Mistral OCR.

    Args:
        document_url: Public URL to a PDF, DOCX, PPTX, or image
        table_format: "markdown", "html", or None
        extract_headers: Extract page headers separately
        extract_footers: Extract page footers separately
        include_images: Include base64 images in response

    Returns:
        OCRResult with extracted pages
    """
    document = {
        "type": "document_url",
        "document_url": document_url,
    }

    return await _call_ocr_api(
        document=document,
        table_format=table_format,
        extract_headers=extract_headers,
        extract_footers=extract_footers,
        include_images=include_images,
    )


async def process_document_base64(
    data: bytes,
    filename: str = "document.pdf",
    table_format: Optional[str] = "markdown",
    extract_headers: bool = False,
    extract_footers: bool = False,
    include_images: bool = False,
) -> OCRResult:
    """
    Process an uploaded document (bytes) via Mistral OCR.

    Args:
        data: Raw file bytes
        filename: Original filename (for type detection)
        table_format: "markdown", "html", or None
        extract_headers: Extract page headers separately
        extract_footers: Extract page footers separately
        include_images: Include base64 images in response

    Returns:
        OCRResult with extracted pages
    """
    if len(data) > MAX_DOCUMENT_SIZE_BYTES:
        raise ValueError(
            f"Document too large: {len(data) / 1024 / 1024:.1f}MB (max: {MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024:.0f}MB)"
        )

    # Encode to base64
    encoded = base64.b64encode(data).decode("utf-8")

    # Determine document type from filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"

    if ext in ("png", "jpg", "jpeg", "avif", "webp"):
        mime = f"image/{ext}" if ext != "jpg" else "image/jpeg"
        document = {
            "type": "image_url",
            "image_url": f"data:{mime};base64,{encoded}",
        }
    else:
        document = {
            "type": "document_url",
            "document_url": f"data:application/pdf;base64,{encoded}",
        }

    return await _call_ocr_api(
        document=document,
        table_format=table_format,
        extract_headers=extract_headers,
        extract_footers=extract_footers,
        include_images=include_images,
    )


# =============================================================================
# INTERNAL — API Call
# =============================================================================


async def _call_ocr_api(
    document: Dict[str, Any],
    table_format: Optional[str] = "markdown",
    extract_headers: bool = False,
    extract_footers: bool = False,
    include_images: bool = False,
) -> OCRResult:
    """
    Internal: Call Mistral OCR API.

    POST https://api.mistral.ai/v1/ocr
    """
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured for OCR")

    payload: Dict[str, Any] = {
        "model": MISTRAL_OCR_MODEL,
        "document": document,
    }

    if table_format:
        payload["table_format"] = table_format
    if extract_headers:
        payload["extract_header"] = True
    if extract_footers:
        payload["extract_footer"] = True
    if include_images:
        payload["include_image_base64"] = True

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    start_time = time.time()

    async with httpx.AsyncClient(timeout=OCR_TIMEOUT) as client:
        try:
            response = await client.post(
                MISTRAL_OCR_URL,
                headers=headers,
                json=payload,
            )
        except httpx.TimeoutException:
            logger.error("Mistral OCR timeout (%ds)", OCR_TIMEOUT)
            raise RuntimeError(f"OCR processing timed out ({OCR_TIMEOUT}s)")

        elapsed = time.time() - start_time

        if response.status_code != 200:
            error_body = response.text[:300]
            logger.error("Mistral OCR error %d: %s", response.status_code, error_body)
            raise RuntimeError(f"Mistral OCR error {response.status_code}: {error_body}")

        data = response.json()

    # ── Parse response ───────────────────────────────────────────────────
    pages_data = data.get("pages", [])
    pages: List[OCRPage] = []
    all_text_parts: List[str] = []

    for page_data in pages_data:
        markdown = page_data.get("markdown", "")

        # Extract tables
        tables = []
        for table in page_data.get("tables", []):
            if isinstance(table, str):
                tables.append(table)
            elif isinstance(table, dict):
                tables.append(table.get("content", ""))

        # Extract image references
        images = []
        for img in page_data.get("images", []):
            if isinstance(img, str):
                images.append(img)
            elif isinstance(img, dict):
                images.append(img.get("id", ""))

        # Confidence scores
        confidence = None
        scores = page_data.get("confidence_scores", {})
        if scores:
            confidence = scores.get("average_page_confidence_score")

        page = OCRPage(
            index=page_data.get("index", len(pages)),
            markdown=markdown,
            header=page_data.get("header"),
            footer=page_data.get("footer"),
            confidence_score=confidence,
            tables=tables,
            images=images,
        )
        pages.append(page)
        all_text_parts.append(markdown)

    full_text = "\n\n---\n\n".join(all_text_parts)
    total_chars = sum(len(p.markdown) for p in pages)

    result = OCRResult(
        pages=pages,
        model=data.get("model", MISTRAL_OCR_MODEL),
        total_pages=len(pages),
        total_chars=total_chars,
        processing_time=elapsed,
        full_text=full_text,
    )

    logger.info(
        "OCR completed: %d pages, %d chars, %.1fs",
        result.total_pages,
        result.total_chars,
        result.processing_time,
    )

    return result


# =============================================================================
# ANALYZE DOCUMENT — OCR + LLM Analysis
# =============================================================================


async def analyze_document(
    ocr_result: OCRResult,
    question: Optional[str] = None,
    lang: str = "fr",
    model: str = "mistral-small-2603",
) -> str:
    """
    Analyze OCR-extracted text using Mistral LLM.

    If question is provided → answer the question based on document content.
    If no question → generate a structured summary.

    Args:
        ocr_result: Result from process_document_url or process_document_base64
        question: Optional specific question about the document
        lang: Response language
        model: LLM model to use

    Returns:
        Analysis text (markdown)
    """
    if ocr_result.is_empty:
        raise ValueError("Document is empty — no text extracted by OCR")

    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("Mistral API key not configured")

    # Truncate for token budget (keep first ~100K chars)
    document_text = ocr_result.full_text[:100000]

    if question:
        system_prompt = _build_qa_system_prompt(lang)
        user_prompt = (
            f"Document ({ocr_result.total_pages} pages, "
            f"{ocr_result.total_chars} caractères extraits):\n\n"
            f"{document_text}\n\n"
            f"---\n\n"
            f"Question: {question}"
        )
    else:
        system_prompt = _build_summary_system_prompt(lang)
        user_prompt = (
            f"Document ({ocr_result.total_pages} pages, "
            f"{ocr_result.total_chars} caractères extraits):\n\n"
            f"{document_text}"
        )

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 8000,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"LLM analysis failed: {response.status_code}")

        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


# =============================================================================
# PROMPT BUILDERS
# =============================================================================


def _build_summary_system_prompt(lang: str) -> str:
    if lang == "fr":
        return (
            "Tu es un analyste documentaire expert. Analyse le document fourni "
            "et produis une synthèse structurée en markdown.\n\n"
            "Structure obligatoire :\n"
            "## Résumé\nSynthèse en 2-3 phrases.\n"
            "## Points clés\nLes informations les plus importantes.\n"
            "## Données et chiffres\nTous les chiffres, dates, et données factuelles mentionnés.\n"
            "## Analyse critique\nLimites, biais éventuels, éléments manquants.\n"
            "## Conclusion\nCe qu'il faut retenir.\n\n"
            "Sois factuel et précis. Cite les données du document."
        )
    return (
        "You are an expert document analyst. Analyze the provided document "
        "and produce a structured markdown summary.\n\n"
        "Required structure:\n"
        "## Summary\n2-3 sentence overview.\n"
        "## Key Points\nMost important information.\n"
        "## Data & Figures\nAll numbers, dates, and factual data mentioned.\n"
        "## Critical Analysis\nLimitations, potential biases, missing elements.\n"
        "## Conclusion\nKey takeaways.\n\n"
        "Be factual and precise. Cite data from the document."
    )


def _build_qa_system_prompt(lang: str) -> str:
    if lang == "fr":
        return (
            "Tu es un assistant documentaire. Réponds à la question de l'utilisateur "
            "en te basant UNIQUEMENT sur le contenu du document fourni.\n\n"
            "Règles :\n"
            "- Cite les passages pertinents du document\n"
            "- Si l'information n'est pas dans le document, dis-le clairement\n"
            "- Sois précis et factuel\n"
            "- Réponds en français"
        )
    return (
        "You are a document assistant. Answer the user's question "
        "based ONLY on the provided document content.\n\n"
        "Rules:\n"
        "- Cite relevant passages from the document\n"
        "- If the information is not in the document, say so clearly\n"
        "- Be precise and factual\n"
        "- Respond in English"
    )
