"""
Tests unitaires — Screenshot Detection endpoints (POST /detect, GET /supported).

Tous les appels externes (Mistral OCR, Vision, Brave, yt-dlp) sont mockés.
"""

import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

FAKE_B64 = base64.b64encode(b"\x89PNG\r\n\x1a\nfake-image-data").decode("ascii")


@pytest.fixture
def plus_user() -> MagicMock:
    """User with 'plus' plan — allowed to use /detect."""
    user = MagicMock()
    user.id = 10
    user.email = "plus@test.fr"
    user.plan = "plus"
    user.credits = 50
    user.email_verified = True
    user.is_admin = False
    user.is_active = True
    user.default_lang = "fr"
    return user


@pytest.fixture
def free_user() -> MagicMock:
    """User with 'free' plan — should be blocked (403)."""
    user = MagicMock()
    user.id = 20
    user.email = "free@test.fr"
    user.plan = "free"
    user.credits = 5
    user.email_verified = True
    user.is_admin = False
    user.is_active = True
    user.default_lang = "fr"
    return user


@pytest.fixture
def ocr_result_youtube() -> dict:
    """Résultat OCR réussi pour une vidéo YouTube."""
    return {
        "platform": "youtube",
        "search_query": "Quantum Computing Explained IBM Research",
        "video_title": "Quantum Computing Explained",
        "channel": "@IBMResearch",
        "video_url": "https://www.youtube.com/watch?v=abc123def45",
    }


@pytest.fixture
def ocr_result_no_url() -> dict:
    """Résultat OCR sans URL directe (nécessite recherche)."""
    return {
        "platform": "youtube",
        "search_query": "Machine Learning Stanford",
        "video_title": "Machine Learning Course",
        "channel": "@Stanford",
        "video_url": None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /supported
# ═══════════════════════════════════════════════════════════════════════════════


class TestScreenshotSupported:
    """Tests pour GET /api/images/supported."""

    @pytest.mark.asyncio
    async def test_supported_returns_platforms(self) -> None:
        """GET /supported retourne youtube + tiktok avec le bon format."""
        from images.router import screenshot_supported

        resp = await screenshot_supported()

        assert len(resp.platforms) == 2
        names = [p.name for p in resp.platforms]
        assert "youtube" in names
        assert "tiktok" in names

    @pytest.mark.asyncio
    async def test_supported_returns_capabilities(self) -> None:
        """GET /supported liste les capabilities attendues."""
        from images.router import screenshot_supported

        resp = await screenshot_supported()

        assert resp.max_image_size_mb == 10
        assert "image/png" in resp.supported_formats
        assert "image/jpeg" in resp.supported_formats
        assert "ocr_text_extraction" in resp.capabilities
        assert "vision_fallback" in resp.capabilities
        assert "video_search" in resp.capabilities

    @pytest.mark.asyncio
    async def test_supported_format_stability(self) -> None:
        """Le format de réponse est sérialisable en JSON."""
        from images.router import screenshot_supported

        resp = await screenshot_supported()
        data = resp.model_dump()

        assert isinstance(data["platforms"], list)
        assert isinstance(data["capabilities"], list)
        assert isinstance(data["max_image_size_mb"], int)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /detect — succès OCR base64
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectBase64:
    """Tests pour POST /detect avec image_base64."""

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="sk-test-key")
    async def test_detect_ocr_success(
        self, _mock_key: MagicMock, plus_user: MagicMock, ocr_result_youtube: dict,
    ) -> None:
        """OCR détecte une vidéo YouTube avec URL directe → confidence high."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest(image_base64=FAKE_B64)

        with patch(
            "images.screenshot_detection.detect_video_screenshot",
            new_callable=AsyncMock,
            return_value=ocr_result_youtube,
        ), patch(
            "images.screenshot_detection.is_garbage_query",
            return_value=False,
        ):
            resp = await detect_screenshot(body=body, user=plus_user)

        assert resp.detected is True
        assert resp.method == "ocr"
        assert resp.video is not None
        assert resp.video.platform == "youtube"
        assert resp.video.video_url == "https://www.youtube.com/watch?v=abc123def45"
        assert resp.video.confidence == "high"

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="sk-test-key")
    async def test_detect_ocr_no_url_triggers_search(
        self, _mock_key: MagicMock, plus_user: MagicMock, ocr_result_no_url: dict,
    ) -> None:
        """OCR sans URL → search_video_from_screenshot est appelé."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest(image_base64=FAKE_B64)

        with patch(
            "images.screenshot_detection.detect_video_screenshot",
            new_callable=AsyncMock,
            return_value=ocr_result_no_url,
        ), patch(
            "images.screenshot_detection.is_garbage_query",
            return_value=False,
        ), patch(
            "images.screenshot_detection.search_video_from_screenshot",
            new_callable=AsyncMock,
            return_value="https://www.youtube.com/watch?v=searched123",
        ) as mock_search:
            resp = await detect_screenshot(body=body, user=plus_user)

        mock_search.assert_awaited_once_with("Machine Learning Stanford", "youtube")
        assert resp.detected is True
        assert resp.searched_url == "https://www.youtube.com/watch?v=searched123"
        assert resp.video.confidence == "medium"  # title + channel, no url

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="sk-test-key")
    async def test_detect_ocr_not_a_screenshot(
        self, _mock_key: MagicMock, plus_user: MagicMock,
    ) -> None:
        """OCR ne détecte rien → detected=False."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest(image_base64=FAKE_B64)

        with patch(
            "images.screenshot_detection.detect_video_screenshot",
            new_callable=AsyncMock,
            return_value=None,
        ), patch(
            "images.screenshot_detection.detect_video_screenshot_vision",
            new_callable=AsyncMock,
            return_value=None,
        ):
            resp = await detect_screenshot(body=body, user=plus_user)

        assert resp.detected is False
        assert resp.method == "none"
        assert resp.video is None


# ═══════════════════════════════════════════════════════════════════════════════
# POST /detect — succès via URL
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectURL:
    """Tests pour POST /detect avec image_url."""

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="sk-test-key")
    async def test_detect_url_downloads_and_detects(
        self, _mock_key: MagicMock, plus_user: MagicMock, ocr_result_youtube: dict,
    ) -> None:
        """image_url → téléchargement + OCR → vidéo détectée."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest(image_url="https://example.com/screenshot.png")

        fake_resp = MagicMock()
        fake_resp.status_code = 200
        fake_resp.headers = {"content-type": "image/png"}
        fake_resp.content = b"\x89PNGfake"
        fake_resp.raise_for_status = MagicMock()

        with patch("images.router._download_image", new_callable=AsyncMock) as mock_dl, \
             patch(
                 "images.screenshot_detection.detect_video_screenshot",
                 new_callable=AsyncMock,
                 return_value=ocr_result_youtube,
             ), patch(
                 "images.screenshot_detection.is_garbage_query",
                 return_value=False,
             ):
            mock_dl.return_value = (FAKE_B64, "image/png")
            resp = await detect_screenshot(body=body, user=plus_user)

        mock_dl.assert_awaited_once_with("https://example.com/screenshot.png")
        assert resp.detected is True
        assert resp.video.platform == "youtube"


# ═══════════════════════════════════════════════════════════════════════════════
# POST /detect — vision fallback
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectVisionFallback:
    """Tests du fallback Vision quand OCR retourne du garbage."""

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="sk-test-key")
    async def test_garbage_ocr_triggers_vision(
        self, _mock_key: MagicMock, plus_user: MagicMock,
    ) -> None:
        """OCR garbage → Vision fallback → résultat."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest(image_base64=FAKE_B64)

        garbage_result = {
            "platform": "youtube",
            "search_query": "0 0 0 0",
            "video_title": None,
            "channel": None,
            "video_url": None,
        }
        vision_result = {
            "platform": "youtube",
            "search_query": "Deep Learning Explained @3Blue1Brown",
            "video_title": "Deep Learning Explained",
            "channel": "@3Blue1Brown",
            "video_url": None,
        }

        with patch(
            "images.screenshot_detection.detect_video_screenshot",
            new_callable=AsyncMock,
            return_value=garbage_result,
        ), patch(
            "images.screenshot_detection.is_garbage_query",
            return_value=True,
        ), patch(
            "images.screenshot_detection.detect_video_screenshot_vision",
            new_callable=AsyncMock,
            return_value=vision_result,
        ), patch(
            "images.screenshot_detection.search_video_from_screenshot",
            new_callable=AsyncMock,
            return_value="https://www.youtube.com/watch?v=vis123",
        ):
            resp = await detect_screenshot(body=body, user=plus_user)

        assert resp.detected is True
        assert resp.method == "vision"
        assert resp.video.video_title == "Deep Learning Explained"
        assert resp.searched_url == "https://www.youtube.com/watch?v=vis123"


# ═══════════════════════════════════════════════════════════════════════════════
# POST /detect — erreurs de validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectValidation:
    """Tests de validation des inputs."""

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="sk-test-key")
    async def test_no_image_returns_422(
        self, _mock_key: MagicMock, plus_user: MagicMock,
    ) -> None:
        """Ni base64 ni URL → HTTPException 422."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest()

        with pytest.raises(Exception) as exc_info:
            await detect_screenshot(body=body, user=plus_user)

        assert exc_info.value.status_code == 422  # type: ignore[union-attr]

    def test_invalid_url_rejected(self) -> None:
        """URL sans http/https → ValidationError Pydantic."""
        from images.router import ScreenshotDetectRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ScreenshotDetectRequest(image_url="ftp://bad-protocol.com/img.png")

    @pytest.mark.asyncio
    @patch("images.router.get_mistral_key", return_value="")
    async def test_no_api_key_returns_503(
        self, _mock_key: MagicMock, plus_user: MagicMock,
    ) -> None:
        """Pas de clé Mistral configurée → 503."""
        from images.router import detect_screenshot, ScreenshotDetectRequest

        body = ScreenshotDetectRequest(image_base64=FAKE_B64)

        with pytest.raises(Exception) as exc_info:
            await detect_screenshot(body=body, user=plus_user)

        assert exc_info.value.status_code == 503  # type: ignore[union-attr]


# ═══════════════════════════════════════════════════════════════════════════════
# Plan gating — free user bloqué
# ═══════════════════════════════════════════════════════════════════════════════


class TestPlanGating:
    """Vérifie que require_plan('plus') bloque les users free."""

    @pytest.mark.asyncio
    async def test_free_user_blocked(self, free_user: MagicMock) -> None:
        """Un user free obtient 403 via require_plan('plus')."""
        from auth.dependencies import require_plan
        from fastapi import HTTPException

        check_plan = require_plan("plus")

        # require_plan wraps get_verified_user → on simule le user directement
        with patch(
            "auth.dependencies.get_verified_user",
            return_value=free_user,
        ), patch(
            "billing.plan_config.normalize_plan_id",
            side_effect=lambda p: p,
        ), patch(
            "billing.plan_config.get_plan_index",
            side_effect=lambda p: {"free": 0, "plus": 1, "pro": 2}.get(p, 0),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await check_plan(current_user=free_user)

            assert exc_info.value.status_code == 403
            assert exc_info.value.detail["code"] == "plan_required"

    @pytest.mark.asyncio
    async def test_plus_user_allowed(self, plus_user: MagicMock) -> None:
        """Un user plus passe require_plan('plus') sans erreur."""
        from auth.dependencies import require_plan

        check_plan = require_plan("plus")

        with patch(
            "billing.plan_config.normalize_plan_id",
            side_effect=lambda p: p,
        ), patch(
            "billing.plan_config.get_plan_index",
            side_effect=lambda p: {"free": 0, "plus": 1, "pro": 2}.get(p, 0),
        ):
            result = await check_plan(current_user=plus_user)

        assert result.id == plus_user.id


# ═══════════════════════════════════════════════════════════════════════════════
# Confidence computation
# ═══════════════════════════════════════════════════════════════════════════════


class TestConfidence:
    """Tests de la logique de calcul de confiance."""

    def test_high_confidence_with_url(self) -> None:
        from images.router import _compute_confidence

        assert _compute_confidence({"video_url": "https://yt.com/watch?v=x"}) == "high"

    def test_medium_confidence_title_and_channel(self) -> None:
        from images.router import _compute_confidence

        result = {"video_title": "Some Title", "channel": "@chan"}
        assert _compute_confidence(result) == "medium"

    def test_low_confidence_title_only(self) -> None:
        from images.router import _compute_confidence

        assert _compute_confidence({"video_title": "Title"}) == "low"

    def test_low_confidence_empty(self) -> None:
        from images.router import _compute_confidence

        assert _compute_confidence({}) == "low"


# ═══════════════════════════════════════════════════════════════════════════════
# _download_image
# ═══════════════════════════════════════════════════════════════════════════════


class TestDownloadImage:
    """Tests de _download_image."""

    @pytest.mark.asyncio
    async def test_download_success(self) -> None:
        """Téléchargement réussi → retourne (base64, content-type)."""
        from images.router import _download_image

        fake_content = b"\x89PNGfake-image"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/png"}
        mock_resp.content = fake_content
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("images.router.httpx.AsyncClient", return_value=mock_client):
            b64, mime = await _download_image("https://example.com/img.png")

        expected_b64 = base64.b64encode(fake_content).decode("ascii")
        assert b64 == expected_b64
        assert mime == "image/png"

    @pytest.mark.asyncio
    async def test_download_unsupported_type(self) -> None:
        """Content-type non supporté → HTTPException 400."""
        from images.router import _download_image
        from fastapi import HTTPException

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "application/pdf"}
        mock_resp.content = b"fakepdf"
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("images.router.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc_info:
                await _download_image("https://example.com/doc.pdf")

        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_download_too_large(self) -> None:
        """Image > 10MB → HTTPException 400."""
        from images.router import _download_image
        from fastapi import HTTPException

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"content-type": "image/png"}
        mock_resp.content = b"x" * (11 * 1024 * 1024)  # 11 MB
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("images.router.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc_info:
                await _download_image("https://example.com/huge.png")

        assert exc_info.value.status_code == 400
