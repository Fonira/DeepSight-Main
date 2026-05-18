"""Tests pour le pipeline doodle Tuteur (sprint 2026-05-18).

Couvre :
- `_term_hash(style=)` : discrimination + backward-compat photo
- `_build_doodle_prompt` : avec et sans définition
- `_post_process_doodle` : préservation RGBA, dimensions 200x200, WebP lossless
- `_stage2_gemini_doodle` : mock httpx + extraction inlineData base64
- `_stage2_generate_doodle` : fallback DALL-E 3 si Gemini absent

Tests d'intégration DB (`generate_doodle_image`, `get_doodle_url`,
`batch_get_doodle_urls`, `_upload_and_save_doodle`) → couverts en PR #2 via
le test E2E du router `/api/tutor/concepts/*`.
"""

import base64
import io
import hashlib
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

# Make backend/src importable when pytest runs from repo root
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from images.keyword_images import (  # noqa: E402
    IMAGE_MODEL_GEMINI_DOODLE,
    TUTOR_DOODLE_STYLE_SUFFIX,
    _build_doodle_prompt,
    _post_process_doodle,
    _stage2_gemini_doodle,
    _stage2_generate_doodle,
    _term_hash,
)


# ─── _term_hash ───────────────────────────────────────────────────────────────


class TestTermHash:
    def test_photo_style_default_is_backward_compatible(self):
        """style='photo' must produce the same hash as the legacy `_term_hash(term)`
        signature so existing keyword_images rows stay valid."""
        legacy_hash = hashlib.sha256(
            "biais de confirmation".lower().strip().encode("utf-8")
        ).hexdigest()
        assert _term_hash("Biais de confirmation") == legacy_hash
        assert _term_hash("Biais de confirmation", style="photo") == legacy_hash

    def test_tutor_doodle_style_produces_different_hash(self):
        """Same term, different style → different hash. Permet à un concept
        d'avoir photo ET doodle cohabiter dans `keyword_images.term_hash`
        UNIQUE."""
        photo_hash = _term_hash("Biais de confirmation", style="photo")
        doodle_hash = _term_hash("Biais de confirmation", style="tutor_doodle")
        assert photo_hash != doodle_hash

    def test_normalize_lowercase_and_strip(self):
        """Hash normalizes by lowercasing and trimming whitespace."""
        h1 = _term_hash("  Biais De Confirmation  ", style="tutor_doodle")
        h2 = _term_hash("biais de confirmation", style="tutor_doodle")
        assert h1 == h2

    def test_doodle_hash_is_64_hex_chars(self):
        h = _term_hash("X", style="tutor_doodle")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)


# ─── _build_doodle_prompt ─────────────────────────────────────────────────────


class TestBuildDoodlePrompt:
    def test_with_definition_includes_short_meaning(self):
        prompt = _build_doodle_prompt(
            "Rasoir d'Occam",
            "Principe : entre deux explications, préférer la plus simple",
        )
        assert "Rasoir d'Occam" in prompt
        assert "préférer la plus simple" in prompt
        assert "ONE simple visual metaphor" in prompt
        assert "not the literal word" in prompt

    def test_without_definition_omits_brief_meaning(self):
        prompt = _build_doodle_prompt("Sérendipité", None)
        assert "Sérendipité" in prompt
        assert "Brief meaning:" not in prompt

    def test_empty_definition_treated_as_none(self):
        prompt = _build_doodle_prompt("X", "")
        assert "Brief meaning:" not in prompt

    def test_long_definition_truncated_to_160_chars(self):
        long_def = "x" * 500
        prompt = _build_doodle_prompt("Y", long_def)
        # 160 'x' must appear, but 200 'x' must not
        assert "x" * 160 in prompt
        assert "x" * 200 not in prompt


# ─── _post_process_doodle ─────────────────────────────────────────────────────


class TestPostProcessDoodle:
    @staticmethod
    def _make_png_bytes(mode: str, size=(1024, 1024), color=(200, 100, 255, 128)) -> bytes:
        """Helper: create a fake PNG in the requested PIL mode."""
        if mode == "RGBA":
            img = Image.new(mode, size, color)
        elif mode == "RGB":
            img = Image.new(mode, size, color[:3])
        else:
            img = Image.new(mode, size, color[:3])
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def test_resizes_to_200x200(self):
        src = self._make_png_bytes("RGBA", size=(1024, 1024))
        out = _post_process_doodle(src)
        img = Image.open(io.BytesIO(out))
        assert img.size == (200, 200)

    def test_preserves_rgba_mode(self):
        """Input RGBA → output WebP must keep alpha channel (no compositing on
        dark background like the photo path does)."""
        src = self._make_png_bytes("RGBA", color=(255, 0, 255, 0))  # fully transparent
        out = _post_process_doodle(src)
        img = Image.open(io.BytesIO(out))
        # WebP lossless preserves mode
        assert img.mode in ("RGBA", "RGBa")

    def test_rgb_input_handled_without_crash(self):
        """If input is RGB (e.g. DALL-E 3 fallback without transparency), the
        function must not crash and output must remain a valid 200x200 WebP.

        Note : PIL/WebP peut décoder un WebP sauvegardé en RGBA avec alpha=255
        partout en mode RGB pour économiser la mémoire — le mode du re-decode
        n'est donc pas un assertable fiable. On vérifie le contrat fonctionnel
        (pas de crash + dimensions + format).
        """
        src = self._make_png_bytes("RGB", color=(255, 100, 200))
        out = _post_process_doodle(src)
        img = Image.open(io.BytesIO(out))
        assert img.size == (200, 200)
        assert out[:4] == b"RIFF"
        assert b"WEBP" in out[:16]

    def test_output_is_valid_webp(self):
        src = self._make_png_bytes("RGBA")
        out = _post_process_doodle(src)
        # Magic bytes for WebP: starts with "RIFF" and contains "WEBP"
        assert out[:4] == b"RIFF"
        assert b"WEBP" in out[:16]


# ─── _stage2_gemini_doodle ────────────────────────────────────────────────────


class TestStage2GeminiDoodle:
    @pytest.mark.asyncio
    async def test_raises_when_api_key_missing(self):
        with patch("images.keyword_images.get_gemini_key", return_value=None):
            with pytest.raises(RuntimeError, match="GEMINI_API_KEY not configured"):
                await _stage2_gemini_doodle("test prompt")

    @pytest.mark.asyncio
    async def test_decodes_inline_data_and_returns_bytes_plus_model(self):
        """Verify the function extracts `inlineData.data` (base64) from the
        Gemini response and decodes it back to raw bytes."""
        fake_png = TestPostProcessDoodle._make_png_bytes("RGBA")
        fake_b64 = base64.b64encode(fake_png).decode("ascii")

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(
            return_value={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"inlineData": {"mimeType": "image/png", "data": fake_b64}}
                            ]
                        }
                    }
                ]
            }
        )

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("images.keyword_images.get_gemini_key", return_value="fake-key"):
            with patch("images.keyword_images.httpx.AsyncClient", return_value=mock_client):
                raw_bytes, model = await _stage2_gemini_doodle("test prompt")

        assert raw_bytes == fake_png
        assert model == IMAGE_MODEL_GEMINI_DOODLE

    @pytest.mark.asyncio
    async def test_handles_snake_case_inline_data(self):
        """The Gemini REST API can return either `inlineData` or `inline_data`
        depending on serializer — the implementation must handle both."""
        fake_png = TestPostProcessDoodle._make_png_bytes("RGBA")
        fake_b64 = base64.b64encode(fake_png).decode("ascii")

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(
            return_value={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"inline_data": {"mime_type": "image/png", "data": fake_b64}}
                            ]
                        }
                    }
                ]
            }
        )

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("images.keyword_images.get_gemini_key", return_value="fake-key"):
            with patch("images.keyword_images.httpx.AsyncClient", return_value=mock_client):
                raw_bytes, _ = await _stage2_gemini_doodle("test prompt")

        assert raw_bytes == fake_png

    @pytest.mark.asyncio
    async def test_raises_on_empty_candidates(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={"candidates": []})

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("images.keyword_images.get_gemini_key", return_value="fake-key"):
            with patch("images.keyword_images.httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(RuntimeError, match="no candidates"):
                    await _stage2_gemini_doodle("test prompt")


# ─── _stage2_generate_doodle (fallback chain) ─────────────────────────────────


class TestStage2GenerateDoodle:
    @pytest.mark.asyncio
    async def test_falls_back_to_dalle3_when_gemini_fails(self):
        """If Gemini throws, the chain must try DALL-E 3 next (skipping FLUX
        Schnell which doesn't honor transparent bg)."""
        fake_png = TestPostProcessDoodle._make_png_bytes("RGB")

        with patch(
            "images.keyword_images._stage2_gemini_doodle",
            side_effect=RuntimeError("Gemini quota exceeded"),
        ):
            with patch("images.keyword_images.get_gemini_key", return_value="fake"):
                with patch("images.keyword_images.get_openai_key", return_value="fake-openai"):
                    with patch(
                        "images.keyword_images._stage2_dalle3",
                        return_value=(fake_png, "dall-e-3"),
                    ) as mock_dalle:
                        raw, model = await _stage2_generate_doodle("test")

        assert raw == fake_png
        assert model == "dall-e-3"
        mock_dalle.assert_called_once()
        # The DALL-E 3 call must include the doodle style suffix to honor
        # transparent background as best as it can.
        call_prompt = mock_dalle.call_args[0][0]
        assert TUTOR_DOODLE_STYLE_SUFFIX in call_prompt

    @pytest.mark.asyncio
    async def test_raises_when_no_backend_available(self):
        with patch("images.keyword_images.get_gemini_key", return_value=None):
            with patch("images.keyword_images.get_openai_key", return_value=None):
                with pytest.raises(RuntimeError, match="No doodle backend available"):
                    await _stage2_generate_doodle("test")
