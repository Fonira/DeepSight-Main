"""
Tests for core/finetuning.py — Mistral Fine-tuning Pipeline.

Tests cover:
- JSONL building
- File upload
- Job creation and monitoring
- Pipeline orchestration
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


# =============================================================================
# JSONL BUILDING
# =============================================================================

class TestBuildJsonl:

    def test_builds_valid_jsonl(self):
        from core.finetuning import build_jsonl

        samples = [
            {
                "messages": [
                    {"role": "system", "content": "Analyse cette vidéo."},
                    {"role": "user", "content": "Transcript here."},
                    {"role": "assistant", "content": "## Synthèse\nBla bla."},
                ]
            },
            {
                "messages": [
                    {"role": "system", "content": "System 2."},
                    {"role": "user", "content": "User 2."},
                    {"role": "assistant", "content": "Response 2."},
                ]
            },
        ]

        result = build_jsonl(samples)
        lines = result.decode("utf-8").strip().split("\n")

        assert len(lines) == 2
        parsed = json.loads(lines[0])
        assert "messages" in parsed
        assert len(parsed["messages"]) == 3
        assert parsed["messages"][0]["role"] == "system"

    def test_handles_unicode(self):
        from core.finetuning import build_jsonl

        samples = [
            {
                "messages": [
                    {"role": "user", "content": "Vidéo française avec accents: é, à, ü, ñ"},
                    {"role": "assistant", "content": "Réponse avec des émojis 🇫🇷"},
                ]
            },
        ]

        result = build_jsonl(samples)
        decoded = result.decode("utf-8")
        assert "é" in decoded
        assert "🇫🇷" in decoded

    def test_empty_samples(self):
        from core.finetuning import build_jsonl

        result = build_jsonl([])
        assert result == b""


# =============================================================================
# FILE UPLOAD
# =============================================================================

class TestUploadTrainingFile:

    @pytest.mark.asyncio
    async def test_successful_upload(self):
        from core.finetuning import upload_training_file

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "file-abc123", "bytes": 1024}

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.finetuning.httpx.AsyncClient", return_value=mock_client), \
             patch("core.finetuning.get_mistral_key", return_value="test-key"):
            file_id = await upload_training_file(b"jsonl-data", "train.jsonl")

        assert file_id == "file-abc123"

    @pytest.mark.asyncio
    async def test_upload_failure_raises(self):
        from core.finetuning import upload_training_file

        mock_response = MagicMock()
        mock_response.status_code = 413
        mock_response.text = "Request Entity Too Large"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.finetuning.httpx.AsyncClient", return_value=mock_client), \
             patch("core.finetuning.get_mistral_key", return_value="test-key"):
            with pytest.raises(RuntimeError, match="upload failed"):
                await upload_training_file(b"data")


# =============================================================================
# JOB CREATION
# =============================================================================

class TestCreateFinetuneJob:

    @pytest.mark.asyncio
    async def test_successful_creation(self):
        from core.finetuning import create_finetune_job

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "ft-job-xyz",
            "status": "QUEUED",
            "fine_tuned_model": None,
            "created_at": "2026-04-09T12:00:00Z",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.finetuning.httpx.AsyncClient", return_value=mock_client), \
             patch("core.finetuning.get_mistral_key", return_value="test-key"):
            status = await create_finetune_job(
                training_file_id="file-abc",
                validation_file_id="file-val",
                base_model="mistral-small-latest",
            )

        assert status.job_id == "ft-job-xyz"
        assert status.status == "QUEUED"

    @pytest.mark.asyncio
    async def test_includes_validation_file(self):
        from core.finetuning import create_finetune_job

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "ft-123", "status": "QUEUED"}

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.finetuning.httpx.AsyncClient", return_value=mock_client), \
             patch("core.finetuning.get_mistral_key", return_value="test-key"):
            await create_finetune_job(
                training_file_id="file-train",
                validation_file_id="file-val",
            )

        # Verify payload includes validation_files
        call_args = mock_client.post.call_args
        payload = call_args.kwargs.get("json", {})
        assert "validation_files" in payload
        assert payload["validation_files"] == ["file-val"]


# =============================================================================
# JOB STATUS
# =============================================================================

class TestGetJobStatus:

    @pytest.mark.asyncio
    async def test_successful_status(self):
        from core.finetuning import get_job_status

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "ft-job-xyz",
            "status": "SUCCEEDED",
            "fine_tuned_model": "ft:mistral-small:deepsight:abc123",
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.finetuning.httpx.AsyncClient", return_value=mock_client), \
             patch("core.finetuning.get_mistral_key", return_value="test-key"):
            status = await get_job_status("ft-job-xyz")

        assert status.status == "SUCCEEDED"
        assert status.fine_tuned_model == "ft:mistral-small:deepsight:abc123"


# =============================================================================
# EXPORT RESULT
# =============================================================================

class TestExportResult:

    def test_dataclass_defaults(self):
        from core.finetuning import ExportResult

        result = ExportResult()
        assert result.total_exported == 0
        assert result.training_samples == []
        assert result.validation_samples == []
        assert result.categories == {}


# =============================================================================
# CONSTANTS
# =============================================================================

class TestConstants:

    def test_minimum_training_samples(self):
        from core.finetuning import MIN_TRAINING_SAMPLES
        assert MIN_TRAINING_SAMPLES >= 50

    def test_validation_split_reasonable(self):
        from core.finetuning import VALIDATION_SPLIT
        assert 0 < VALIDATION_SPLIT < 0.3
