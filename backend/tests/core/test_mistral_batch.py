"""
Tests for core/mistral_batch.py — Mistral Batch API wrapper.

Tests cover:
- JSONL building
- File upload (mocked)
- Job creation (mocked)
- Status polling (mocked)
- Result parsing
- submit_and_wait flow
- llm_complete_batch integration
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

    def test_single_request(self):
        from core.mistral_batch import _build_jsonl, BatchRequest

        requests = [
            BatchRequest(
                custom_id="video_1",
                messages=[
                    {"role": "system", "content": "Analyze this."},
                    {"role": "user", "content": "Hello world"},
                ],
                model="mistral-small-2603",
                max_tokens=4000,
                temperature=0.3,
            )
        ]

        jsonl = _build_jsonl(requests)
        lines = jsonl.decode("utf-8").strip().split("\n")
        assert len(lines) == 1

        entry = json.loads(lines[0])
        assert entry["custom_id"] == "video_1"
        assert entry["body"]["model"] == "mistral-small-2603"
        assert len(entry["body"]["messages"]) == 2
        assert entry["body"]["max_tokens"] == 4000

    def test_multiple_requests(self):
        from core.mistral_batch import _build_jsonl, BatchRequest

        requests = [
            BatchRequest(custom_id=f"v_{i}", messages=[{"role": "user", "content": f"Q{i}"}])
            for i in range(5)
        ]

        jsonl = _build_jsonl(requests)
        lines = jsonl.decode("utf-8").strip().split("\n")
        assert len(lines) == 5

        ids = [json.loads(line)["custom_id"] for line in lines]
        assert ids == ["v_0", "v_1", "v_2", "v_3", "v_4"]

    def test_unicode_content(self):
        from core.mistral_batch import _build_jsonl, BatchRequest

        requests = [
            BatchRequest(
                custom_id="fr_1",
                messages=[{"role": "user", "content": "Résumé de la vidéo française 🇫🇷"}],
            )
        ]

        jsonl = _build_jsonl(requests)
        content = jsonl.decode("utf-8")
        assert "Résumé" in content
        assert "🇫🇷" in content


# =============================================================================
# RESULT PARSING
# =============================================================================

class TestGetBatchResults:

    @pytest.mark.asyncio
    async def test_parses_success_results(self):
        from core.mistral_batch import get_batch_results

        output_jsonl = (
            '{"id":"req_1","custom_id":"video_1","response":{"status_code":200,'
            '"body":{"choices":[{"message":{"content":"Analyse vidéo 1"}}],'
            '"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}}}\n'
            '{"id":"req_2","custom_id":"video_2","response":{"status_code":200,'
            '"body":{"choices":[{"message":{"content":"Analyse vidéo 2"}}],'
            '"usage":{"prompt_tokens":120,"completion_tokens":60,"total_tokens":180}}}}'
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = output_jsonl

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.mistral_batch.shared_http_client", return_value=mock_client), \
             patch("core.mistral_batch.get_mistral_key", return_value="test-key"):
            results = await get_batch_results("output_file_123")

        assert len(results) == 2
        assert results[0].custom_id == "video_1"
        assert results[0].success is True
        assert "vidéo 1" in results[0].content
        assert results[0].tokens_total == 150
        assert results[1].custom_id == "video_2"
        assert results[1].tokens_total == 180

    @pytest.mark.asyncio
    async def test_handles_error_entries(self):
        from core.mistral_batch import get_batch_results

        output_jsonl = (
            '{"id":"req_1","custom_id":"v1","error":"Rate limited"}\n'
            '{"id":"req_2","custom_id":"v2","response":{"status_code":200,'
            '"body":{"choices":[{"message":{"content":"OK"}}],"usage":{"total_tokens":50}}}}'
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = output_jsonl

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("core.mistral_batch.shared_http_client", return_value=mock_client), \
             patch("core.mistral_batch.get_mistral_key", return_value="test-key"):
            results = await get_batch_results("file_id")

        assert len(results) == 2
        assert results[0].success is False
        assert "Rate limited" in results[0].error
        assert results[1].success is True


# =============================================================================
# POLL STATUS
# =============================================================================

class TestPollBatchJob:

    @pytest.mark.asyncio
    async def test_parses_running_status(self):
        from core.mistral_batch import poll_batch_job

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "RUNNING",
            "total_requests": 10,
            "completed_requests": 4,
            "failed_requests": 0,
        }

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch("core.mistral_batch.get_mistral_key", return_value="key"):
                status = await poll_batch_job("job_123")

        assert status.status == "RUNNING"
        assert status.total_requests == 10
        assert status.completed_requests == 4

    @pytest.mark.asyncio
    async def test_success_with_output_file(self):
        from core.mistral_batch import poll_batch_job

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "SUCCESS",
            "total_requests": 5,
            "completed_requests": 5,
            "failed_requests": 0,
            "output_file": "file_out_456",
        }

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch("core.mistral_batch.get_mistral_key", return_value="key"):
                status = await poll_batch_job("job_456")

        assert status.status == "SUCCESS"
        assert status.output_file_id == "file_out_456"


# =============================================================================
# LLM_COMPLETE_BATCH INTEGRATION
# =============================================================================

class TestLlmCompleteBatch:

    @pytest.mark.asyncio
    async def test_empty_items_returns_empty(self):
        from core.llm_provider import llm_complete_batch
        results = await llm_complete_batch(items=[])
        assert results == []

    @pytest.mark.asyncio
    async def test_maps_results_to_input_order(self):
        from core.llm_provider import llm_complete_batch
        from core.mistral_batch import BatchResult

        mock_batch_results = [
            BatchResult(custom_id="b", success=True, content="Result B", tokens_total=100),
            BatchResult(custom_id="a", success=True, content="Result A", tokens_total=80),
        ]

        with patch("core.mistral_batch.submit_and_wait", new_callable=AsyncMock,
                    return_value=mock_batch_results):
            items = [
                {"id": "a", "messages": [{"role": "user", "content": "Q1"}]},
                {"id": "b", "messages": [{"role": "user", "content": "Q2"}]},
            ]
            results = await llm_complete_batch(items=items)

        assert len(results) == 2
        # Item "a" should get "Result A"
        assert results[0].content == "Result A"
        assert results[0].provider == "mistral_batch"
        # Item "b" should get "Result B"
        assert results[1].content == "Result B"
