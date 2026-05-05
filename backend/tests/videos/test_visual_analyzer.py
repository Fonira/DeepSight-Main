"""
Tests pour videos/visual_analyzer.py — wrapper Mistral Vision.

Couvre :
- Helpers purs : _format_timestamp, _downsample, _encode_frame
- analyze_frames avec mock mistral_vision_request (no réseau)
- Edge cases : pas de clé, frames mismatchés, JSON malformé, brace recovery
"""

import asyncio
import base64
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ Helpers purs
# ═══════════════════════════════════════════════════════════════════════════════


class TestFormatTimestamp:
    def test_seconds_only(self):
        from videos.visual_analyzer import _format_timestamp

        assert _format_timestamp(3.5) == "00:03"

    def test_minutes(self):
        from videos.visual_analyzer import _format_timestamp

        assert _format_timestamp(75.2) == "01:15"

    def test_hours(self):
        from videos.visual_analyzer import _format_timestamp

        assert _format_timestamp(3700) == "01:01:40"

    def test_negative_clamped_to_zero(self):
        from videos.visual_analyzer import _format_timestamp

        assert _format_timestamp(-5) == "00:00"


class TestDownsample:
    def test_no_op_when_under_target(self):
        from videos.visual_analyzer import _downsample

        items = [1, 2, 3]
        assert _downsample(items, 10) == [1, 2, 3]

    def test_downsample_uniform(self):
        from videos.visual_analyzer import _downsample

        items = list(range(100))
        result = _downsample(items, 10)
        assert len(result) == 10
        # Vérifie monotonicité (uniformité)
        assert result == sorted(result)
        assert result[0] == 0  # Premier élément toujours conservé

    def test_downsample_target_zero(self):
        from videos.visual_analyzer import _downsample

        assert _downsample([1, 2, 3], 0) == [1, 2, 3]


class TestEncodeFrame:
    def test_encode_real_jpeg(self, tmp_path):
        """Crée un faux JPEG de 1 byte et vérifie le b64."""
        from videos.visual_analyzer import _encode_frame

        path = tmp_path / "frame.jpg"
        path.write_bytes(b"\xff\xd8\xff\xd9")  # JPEG SOI/EOI markers

        b64 = _encode_frame(str(path))
        assert b64 is not None
        decoded = base64.b64decode(b64)
        assert decoded == b"\xff\xd8\xff\xd9"

    def test_encode_missing_file(self):
        from videos.visual_analyzer import _encode_frame

        result = _encode_frame("/path/that/does/not/exist.jpg")
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 analyze_frames — avec mock mistral_vision_request
# ═══════════════════════════════════════════════════════════════════════════════


def _make_fake_jpeg(path: Path) -> None:
    path.write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9")


VALID_RESPONSE = json.dumps(
    {
        "visual_hook": "Plan large lumineux sur un visage souriant.",
        "visual_structure": "talking_head",
        "key_moments": [
            {"timestamp_s": 1.0, "description": "Entrée à l'écran", "type": "hook"}
        ],
        "visible_text": "DeepSight",
        "visual_seo_indicators": {
            "hook_brightness": "high",
            "face_visible_in_hook": True,
            "burned_in_subtitles": False,
            "high_motion_intro": False,
            "thumbnail_quality_proxy": "high",
        },
        "summary_visual": "Vidéo posée, plan unique sur un présentateur.",
    }
)


class TestAnalyzeFrames:
    @pytest.mark.asyncio
    async def test_empty_frames_returns_none(self):
        from videos.visual_analyzer import analyze_frames

        result = await analyze_frames([], [])
        assert result is None

    @pytest.mark.asyncio
    async def test_length_mismatch_returns_none(self, tmp_path):
        from videos.visual_analyzer import analyze_frames

        f = tmp_path / "f.jpg"
        _make_fake_jpeg(f)
        result = await analyze_frames([str(f)], [1.0, 2.0])  # mismatch
        assert result is None

    @pytest.mark.asyncio
    async def test_no_mistral_key_returns_none(self, tmp_path, monkeypatch):
        from videos.visual_analyzer import analyze_frames

        f = tmp_path / "f.jpg"
        _make_fake_jpeg(f)

        monkeypatch.setattr("videos.visual_analyzer.get_mistral_key", lambda: "")

        result = await analyze_frames([str(f)], [1.0])
        assert result is None

    @pytest.mark.asyncio
    async def test_happy_path(self, tmp_path, monkeypatch):
        from videos.visual_analyzer import analyze_frames

        f = tmp_path / "f.jpg"
        _make_fake_jpeg(f)

        monkeypatch.setattr("videos.visual_analyzer.get_mistral_key", lambda: "fake-key")

        async def fake_vision(**kwargs):
            return VALID_RESPONSE

        monkeypatch.setattr("videos.visual_analyzer.mistral_vision_request", fake_vision)

        result = await analyze_frames([str(f)], [1.0], transcript_excerpt="Bonjour")
        assert result is not None
        assert result.visual_structure == "talking_head"
        assert result.frames_analyzed == 1
        assert result.frames_downsampled is False
        assert "DeepSight" in result.visible_text
        assert len(result.key_moments) == 1

    @pytest.mark.asyncio
    async def test_json_brace_recovery(self, tmp_path, monkeypatch):
        """Si Mistral wrappe le JSON dans du markdown, on récupère via braces."""
        from videos.visual_analyzer import analyze_frames

        f = tmp_path / "f.jpg"
        _make_fake_jpeg(f)

        monkeypatch.setattr("videos.visual_analyzer.get_mistral_key", lambda: "fake-key")

        async def fake_vision_wrapped(**kwargs):
            return f"```json\n{VALID_RESPONSE}\n```"

        monkeypatch.setattr("videos.visual_analyzer.mistral_vision_request", fake_vision_wrapped)

        result = await analyze_frames([str(f)], [0.0])
        assert result is not None
        assert result.visual_structure == "talking_head"

    @pytest.mark.asyncio
    async def test_invalid_json_returns_none(self, tmp_path, monkeypatch):
        from videos.visual_analyzer import analyze_frames

        f = tmp_path / "f.jpg"
        _make_fake_jpeg(f)

        monkeypatch.setattr("videos.visual_analyzer.get_mistral_key", lambda: "fake-key")

        async def fake_vision_garbage(**kwargs):
            return "not json at all just text"

        monkeypatch.setattr(
            "videos.visual_analyzer.mistral_vision_request", fake_vision_garbage
        )

        result = await analyze_frames([str(f)], [0.0])
        assert result is None

    @pytest.mark.asyncio
    async def test_downsample_above_threshold(self, tmp_path, monkeypatch):
        """>MAX_FRAMES_PER_CALL → frames_downsampled True."""
        from videos import visual_analyzer

        # Crée 80 fake frames
        paths = []
        timestamps = []
        for i in range(80):
            p = tmp_path / f"f{i:03d}.jpg"
            _make_fake_jpeg(p)
            paths.append(str(p))
            timestamps.append(float(i))

        monkeypatch.setattr(visual_analyzer, "get_mistral_key", lambda: "fake-key")
        monkeypatch.setattr(visual_analyzer, "MAX_FRAMES_PER_CALL", 30)

        captured: dict = {}

        async def fake_vision(**kwargs):
            captured["messages"] = kwargs.get("messages")
            return VALID_RESPONSE

        monkeypatch.setattr(visual_analyzer, "mistral_vision_request", fake_vision)

        result = await visual_analyzer.analyze_frames(paths, timestamps)

        assert result is not None
        assert result.frames_downsampled is True
        assert result.frames_analyzed == 30
        # Vérifie que le payload contient au plus 30 image_url
        image_blocks = [
            p
            for p in captured["messages"][1]["content"]
            if p.get("type") == "image_url"
        ]
        assert len(image_blocks) == 30
