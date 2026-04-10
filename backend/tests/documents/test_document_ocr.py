"""
Tests for core/document_ocr.py — Mistral OCR Document Analysis Pipeline.

Tests cover:
- OCRPage and OCRResult dataclasses
- Response parsing from Mistral OCR API
- LLM analysis prompt building
- Document processing (URL and base64)
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


# =============================================================================
# DATACLASS TESTS
# =============================================================================

class TestOCRPage:

    def test_defaults(self):
        from core.document_ocr import OCRPage

        page = OCRPage(index=0, markdown="Hello world")
        assert page.index == 0
        assert page.markdown == "Hello world"
        assert page.header is None
        assert page.footer is None
        assert page.confidence_score is None
        assert page.tables == []
        assert page.images == []

    def test_with_all_fields(self):
        from core.document_ocr import OCRPage

        page = OCRPage(
            index=1,
            markdown="# Title\nContent",
            header="Page 1",
            footer="© 2026",
            confidence_score=0.95,
            tables=["| col1 | col2 |"],
            images=["img_001"],
        )
        assert page.header == "Page 1"
        assert page.confidence_score == 0.95
        assert len(page.tables) == 1
        assert len(page.images) == 1


class TestOCRResult:

    def test_defaults(self):
        from core.document_ocr import OCRResult

        result = OCRResult(pages=[])
        assert result.pages == []
        assert result.total_pages == 0
        assert result.total_chars == 0
        assert result.full_text == ""

    def test_is_empty_no_pages(self):
        from core.document_ocr import OCRResult

        result = OCRResult(pages=[], total_chars=0)
        assert result.is_empty is True

    def test_is_empty_no_chars(self):
        from core.document_ocr import OCRResult, OCRPage

        result = OCRResult(
            pages=[OCRPage(index=0, markdown="")],
            total_chars=0,
        )
        assert result.is_empty is True

    def test_not_empty(self):
        from core.document_ocr import OCRResult, OCRPage

        result = OCRResult(
            pages=[OCRPage(index=0, markdown="Content here")],
            total_chars=12,
        )
        assert result.is_empty is False


# =============================================================================
# RESPONSE PARSING
# =============================================================================

class TestCallOCRAPI:

    @pytest.mark.asyncio
    async def test_successful_ocr(self):
        from core.document_ocr import _call_ocr_api

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "model": "mistral-ocr-latest",
            "pages": [
                {
                    "index": 0,
                    "markdown": "# Document Title\n\nParagraph content here.",
                    "tables": [],
                    "images": [],
                },
                {
                    "index": 1,
                    "markdown": "## Section 2\n\nMore text.",
                    "tables": [{"content": "| A | B |\n|---|---|\n| 1 | 2 |"}],
                    "images": [{"id": "img_001"}],
                },
            ],
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            result = await _call_ocr_api(
                document={"type": "document_url", "document_url": "https://example.com/doc.pdf"},
            )

        assert result.total_pages == 2
        assert result.total_chars > 0
        assert "Document Title" in result.full_text
        assert "Section 2" in result.full_text
        # Check tables and images parsed
        assert len(result.pages[1].tables) == 1
        assert len(result.pages[1].images) == 1

    @pytest.mark.asyncio
    async def test_ocr_no_api_key(self):
        from core.document_ocr import _call_ocr_api

        with patch("core.document_ocr.get_mistral_key", return_value=None):
            with pytest.raises(RuntimeError, match="Mistral API key not configured"):
                await _call_ocr_api(
                    document={"type": "document_url", "document_url": "https://example.com/doc.pdf"},
                )

    @pytest.mark.asyncio
    async def test_ocr_api_error(self):
        from core.document_ocr import _call_ocr_api

        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request: unsupported document type"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            with pytest.raises(RuntimeError, match="Mistral OCR error 400"):
                await _call_ocr_api(
                    document={"type": "document_url", "document_url": "https://example.com/bad"},
                )

    @pytest.mark.asyncio
    async def test_ocr_timeout(self):
        import httpx as real_httpx
        from core.document_ocr import _call_ocr_api

        mock_client = AsyncMock()
        mock_client.post.side_effect = real_httpx.TimeoutException("timeout")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            with pytest.raises(RuntimeError, match="timed out"):
                await _call_ocr_api(
                    document={"type": "document_url", "document_url": "https://example.com/doc.pdf"},
                )

    @pytest.mark.asyncio
    async def test_parses_confidence_scores(self):
        from core.document_ocr import _call_ocr_api

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "model": "mistral-ocr-latest",
            "pages": [
                {
                    "index": 0,
                    "markdown": "Text",
                    "confidence_scores": {
                        "average_page_confidence_score": 0.92,
                    },
                },
            ],
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            result = await _call_ocr_api(
                document={"type": "document_url", "document_url": "https://example.com/doc.pdf"},
            )

        assert result.pages[0].confidence_score == 0.92

    @pytest.mark.asyncio
    async def test_parses_headers_footers(self):
        from core.document_ocr import _call_ocr_api

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "model": "mistral-ocr-latest",
            "pages": [
                {
                    "index": 0,
                    "markdown": "Content",
                    "header": "Report Title",
                    "footer": "Page 1 of 5",
                },
            ],
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            result = await _call_ocr_api(
                document={"type": "document_url", "document_url": "https://example.com/doc.pdf"},
                extract_headers=True,
                extract_footers=True,
            )

        assert result.pages[0].header == "Report Title"
        assert result.pages[0].footer == "Page 1 of 5"


# =============================================================================
# DOCUMENT PROCESSING
# =============================================================================

class TestProcessDocumentBase64:

    @pytest.mark.asyncio
    async def test_rejects_oversized_document(self):
        from core.document_ocr import process_document_base64, MAX_DOCUMENT_SIZE_BYTES

        huge_data = b"x" * (MAX_DOCUMENT_SIZE_BYTES + 1)
        with pytest.raises(ValueError, match="too large"):
            await process_document_base64(data=huge_data, filename="big.pdf")

    @pytest.mark.asyncio
    async def test_image_type_detection(self):
        from core.document_ocr import process_document_base64

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "model": "mistral-ocr-latest",
            "pages": [{"index": 0, "markdown": "OCR from image"}],
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            result = await process_document_base64(
                data=b"fake-png-data",
                filename="scan.png",
            )

        # Verify image_url type was used
        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json", {})
        assert payload["document"]["type"] == "image_url"
        assert "image/png" in payload["document"]["image_url"]

    @pytest.mark.asyncio
    async def test_pdf_type_detection(self):
        from core.document_ocr import process_document_base64

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "model": "mistral-ocr-latest",
            "pages": [{"index": 0, "markdown": "PDF content"}],
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            result = await process_document_base64(
                data=b"fake-pdf-data",
                filename="report.pdf",
            )

        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json", {})
        assert payload["document"]["type"] == "document_url"
        assert "application/pdf" in payload["document"]["document_url"]


# =============================================================================
# LLM ANALYSIS
# =============================================================================

class TestAnalyzeDocument:

    @pytest.mark.asyncio
    async def test_summary_mode(self):
        from core.document_ocr import analyze_document, OCRResult, OCRPage

        ocr_result = OCRResult(
            pages=[OCRPage(index=0, markdown="Document text content")],
            total_pages=1,
            total_chars=22,
            full_text="Document text content",
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "## Résumé\nCeci est un résumé."}}]
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            analysis = await analyze_document(ocr_result, lang="fr")

        assert "Résumé" in analysis

    @pytest.mark.asyncio
    async def test_qa_mode(self):
        from core.document_ocr import analyze_document, OCRResult, OCRPage

        ocr_result = OCRResult(
            pages=[OCRPage(index=0, markdown="Revenue: $5M in 2025")],
            total_pages=1,
            total_chars=22,
            full_text="Revenue: $5M in 2025",
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Le chiffre d'affaires est de $5M."}}]
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            analysis = await analyze_document(
                ocr_result, question="Quel est le CA ?", lang="fr",
            )

        assert "$5M" in analysis

    @pytest.mark.asyncio
    async def test_empty_document_raises(self):
        from core.document_ocr import analyze_document, OCRResult

        empty_result = OCRResult(pages=[], total_chars=0)
        with pytest.raises(ValueError, match="empty"):
            await analyze_document(empty_result)

    @pytest.mark.asyncio
    async def test_llm_failure(self):
        from core.document_ocr import analyze_document, OCRResult, OCRPage

        ocr_result = OCRResult(
            pages=[OCRPage(index=0, markdown="Some text")],
            total_pages=1,
            total_chars=9,
            full_text="Some text",
        )

        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.document_ocr.httpx.AsyncClient", return_value=mock_client), \
             patch("core.document_ocr.get_mistral_key", return_value="test-key"):
            with pytest.raises(RuntimeError, match="LLM analysis failed"):
                await analyze_document(ocr_result)


# =============================================================================
# PROMPT BUILDERS
# =============================================================================

class TestPromptBuilders:

    def test_summary_prompt_fr(self):
        from core.document_ocr import _build_summary_system_prompt
        prompt = _build_summary_system_prompt("fr")
        assert "Résumé" in prompt
        assert "Points clés" in prompt

    def test_summary_prompt_en(self):
        from core.document_ocr import _build_summary_system_prompt
        prompt = _build_summary_system_prompt("en")
        assert "Summary" in prompt
        assert "Key Points" in prompt

    def test_qa_prompt_fr(self):
        from core.document_ocr import _build_qa_system_prompt
        prompt = _build_qa_system_prompt("fr")
        assert "UNIQUEMENT" in prompt
        assert "français" in prompt

    def test_qa_prompt_en(self):
        from core.document_ocr import _build_qa_system_prompt
        prompt = _build_qa_system_prompt("en")
        assert "ONLY" in prompt
        assert "English" in prompt


# =============================================================================
# CONSTANTS
# =============================================================================

class TestConstants:

    def test_ocr_model(self):
        from core.document_ocr import MISTRAL_OCR_MODEL
        assert MISTRAL_OCR_MODEL == "mistral-ocr-latest"

    def test_supported_types_complete(self):
        from core.document_ocr import ALL_SUPPORTED_TYPES
        assert "application/pdf" in ALL_SUPPORTED_TYPES
        assert "image/png" in ALL_SUPPORTED_TYPES
        assert "image/jpeg" in ALL_SUPPORTED_TYPES

    def test_timeout_reasonable(self):
        from core.document_ocr import OCR_TIMEOUT
        assert OCR_TIMEOUT >= 60  # At least 1 minute
        assert OCR_TIMEOUT <= 600  # At most 10 minutes
