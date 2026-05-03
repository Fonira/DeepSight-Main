"""
Tests d'injection du contexte chaîne dans le pipeline d'analyse Mistral.

Couvre :
- _format_channel_context_block() — formatage défensif (FR/EN, troncatures, valeurs manquantes)
- build_analysis_prompt() — injection système + user (FR/EN), absence si None
- Helpers d'extraction channel_id depuis metadata vidéo (YouTube + TikTok)
- Pipeline fail-safe : channel_context=None ne casse pas generate_summary

Note : ces tests sont focalisés sur la nouvelle feature et n'instrumentent
pas le pipeline complet `_analyze_video_background_v6` (trop fragile à mocker).
La couverture pipeline se limite aux helpers d'extraction + à un test ciblé
de fail-safe.
"""

import os
import sys
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock, patch

import pytest

# Ensure src/ is on the path
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


def _make_channel_context(
    *,
    n_videos: int = 50,
    long_desc: bool = False,
    long_video_descs: bool = False,
    platform: str = "youtube",
    missing_fields: bool = False,
) -> Dict[str, Any]:
    """Construit un dict channel_context au shape unifié pour tests."""
    description = "A " * 600 if long_desc else "Chaîne YouTube spécialisée vulgarisation scientifique."
    last_videos = []
    for i in range(n_videos):
        v_desc = ("Description " + ("très longue " * 30)) if long_video_descs else f"Description courte vidéo {i}"
        last_videos.append(
            {
                "title": f"Vidéo {i} — Sujet captivant",
                "description": v_desc,
                "tags": [f"tag{i}", "science", "vulgarisation"],
                "view_count": 12345 + i * 100,
                "upload_date": f"2026010{(i % 9) + 1}",
            }
        )

    if missing_fields:
        return {
            "channel_id": "UCabc123",
            "platform": platform,
            "name": "ChaîneTest",
            "description": "",  # vide
            "subscriber_count": None,  # missing
            "video_count": None,
            "tags": [],
            "categories": [],
            "last_videos": [],
        }

    return {
        "channel_id": "UCabc123" if platform == "youtube" else "charlidamelio",
        "platform": platform,
        "name": "Chaîne Vulgarisation",
        "description": description,
        "subscriber_count": 1_500_000,
        "video_count": 234,
        "tags": ["science", "vulgarisation", "physique"],
        "categories": ["Education", "Science & Technology"],
        "last_videos": last_videos,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests : build_analysis_prompt — directive système + bloc user
# ═══════════════════════════════════════════════════════════════════════════════


class TestBuildPromptWithChannelContext:
    """Tests de l'injection channel_context dans build_analysis_prompt()."""

    def test_build_prompt_with_channel_context_fr(self):
        """FR : avec channel_context, system_prompt contient directive + user_prompt contient bloc."""
        from videos.analysis import build_analysis_prompt

        ctx = _make_channel_context(n_videos=50, platform="youtube")

        sys_prompt, user_prompt = build_analysis_prompt(
            title="Test vidéo",
            transcript="Lorem ipsum " * 100,
            category="general",
            lang="fr",
            mode="standard",
            duration=600,
            channel="ChaîneTest",
            description="Description vidéo",
            platform="youtube",
            upload_date="20260301",
            view_count=10_000,
            channel_context=ctx,
        )

        # System prompt : directive contexte chaîne présente
        assert "## Contexte chaîne" in sys_prompt or "Contexte chaîne" in sys_prompt
        assert "Classifie la chaîne" in sys_prompt
        assert "divertissement" in sys_prompt
        assert "éducative" in sys_prompt
        assert "poubelle" in sys_prompt
        assert "dangereuse" in sys_prompt
        assert "représentative" in sys_prompt

        # User prompt : bloc contexte chaîne après le bloc transcript
        assert "### Contexte chaîne (référence)" in user_prompt
        assert "Plateforme : youtube" in user_prompt
        assert "Nom : Chaîne Vulgarisation" in user_prompt
        assert "Abonnés :" in user_prompt
        assert "Catégories :" in user_prompt

        # Les 50 vidéos doivent être listées (par numéro)
        assert "1. " in user_prompt
        assert "50. " in user_prompt or "50." in user_prompt
        # Avant-dernière vidéo aussi
        assert "25." in user_prompt
        # Mention du compte
        assert "50 dernières vidéos" in user_prompt

    def test_build_prompt_with_channel_context_truncates_video_descriptions(self):
        """Descriptions vidéos > 200ch dans les last_videos doivent être tronquées."""
        from videos.analysis import build_analysis_prompt

        ctx = _make_channel_context(n_videos=3, long_video_descs=True)
        _, user_prompt = build_analysis_prompt(
            title="X",
            transcript="t",
            category="general",
            lang="fr",
            mode="standard",
            channel_context=ctx,
        )

        # Le marqueur de troncature doit être présent
        assert "..." in user_prompt
        # Aucun morceau de "très longue " répété 30 fois ne doit subsister
        # (200 chars < répétition complète 30 * 12 chars = 360)
        assert ("très longue " * 30) not in user_prompt

    def test_build_prompt_without_channel_context(self):
        """Sans channel_context : directive système présente, bloc user ABSENT."""
        from videos.analysis import build_analysis_prompt

        sys_prompt, user_prompt = build_analysis_prompt(
            title="Test",
            transcript="t",
            category="general",
            lang="fr",
            mode="standard",
            channel_context=None,
        )

        # Directive toujours présente côté système (politique conditionnelle)
        assert "Contexte chaîne" in sys_prompt
        assert "Si aucun contexte chaîne n'est fourni" in sys_prompt or "Si aucun contexte" in sys_prompt

        # Bloc user_prompt ABSENT
        assert "### Contexte chaîne (référence)" not in user_prompt
        assert "Channel Context (reference)" not in user_prompt

    def test_build_prompt_with_empty_channel_context_dict(self):
        """ctx == {} : doit être traité comme None côté user_prompt (pas de bloc)."""
        from videos.analysis import build_analysis_prompt

        _, user_prompt = build_analysis_prompt(
            title="Test",
            transcript="t",
            category="general",
            lang="fr",
            mode="standard",
            channel_context={},
        )

        # Bloc user_prompt ABSENT (dict vide → pas de header)
        assert "### Contexte chaîne (référence)" not in user_prompt

    def test_build_prompt_with_channel_context_en(self):
        """EN : système + user en anglais avec libellés appropriés."""
        from videos.analysis import build_analysis_prompt

        ctx = _make_channel_context(n_videos=10, platform="youtube")

        sys_prompt, user_prompt = build_analysis_prompt(
            title="Test video",
            transcript="content " * 100,
            category="general",
            lang="en",
            mode="standard",
            duration=600,
            channel="TestChannel",
            description="Video description",
            platform="youtube",
            channel_context=ctx,
        )

        # System prompt : directive en anglais
        assert "Channel Context" in sys_prompt or "## Channel Context" in sys_prompt
        assert "entertainment" in sys_prompt
        assert "educational" in sys_prompt
        assert "low-quality" in sys_prompt
        assert "dangerous" in sys_prompt
        assert "representative" in sys_prompt

        # User prompt : bloc anglais
        assert "### Channel Context (reference)" in user_prompt
        assert "Platform: youtube" in user_prompt
        assert "Subscribers:" in user_prompt
        assert "Categories:" in user_prompt
        assert "10 latest videos" in user_prompt


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests : helper _format_channel_context_block (défensif)
# ═══════════════════════════════════════════════════════════════════════════════


class TestFormatChannelContextBlock:
    """Tests du helper _format_channel_context_block()."""

    def test_format_handles_missing_fields(self):
        """subscriber_count=None, tags=[], etc. → pas de crash, libellés 'n/a'."""
        from videos.analysis import _format_channel_context_block

        ctx = _make_channel_context(missing_fields=True)
        block = _format_channel_context_block(ctx, language="fr")

        assert block  # non vide
        assert "n/a" in block  # remplace les valeurs manquantes
        assert "Abonnés : n/a" in block
        assert "Total vidéos : n/a" in block
        assert "Tags chaîne : n/a" in block
        assert "Catégories : n/a" in block

    def test_format_truncates_long_channel_description(self):
        """Description chaîne > 500 chars → tronquée."""
        from videos.analysis import _format_channel_context_block

        ctx = _make_channel_context(long_desc=True)
        block = _format_channel_context_block(ctx, language="fr")

        # Une longue description doit avoir le marqueur de troncature
        assert "..." in block

    def test_format_returns_empty_for_none(self):
        """ctx=None → str vide."""
        from videos.analysis import _format_channel_context_block

        assert _format_channel_context_block(None, language="fr") == ""
        assert _format_channel_context_block({}, language="fr") == ""

    def test_format_handles_invalid_video_entries(self):
        """last_videos contient des entrées non-dict → ignorées sans crash."""
        from videos.analysis import _format_channel_context_block

        ctx = {
            "channel_id": "UCxx",
            "platform": "youtube",
            "name": "Test",
            "description": "desc",
            "subscriber_count": 100,
            "video_count": 5,
            "tags": ["a"],
            "categories": ["b"],
            "last_videos": [
                {"title": "V1", "description": "d", "tags": [], "view_count": 1, "upload_date": "20260101"},
                "not-a-dict",
                None,
                {"title": "V2", "description": "d", "tags": [], "view_count": None, "upload_date": None},
            ],
        }
        block = _format_channel_context_block(ctx, language="fr")
        assert "V1" in block
        assert "V2" in block

    def test_format_en_uses_english_labels(self):
        """language='en' → labels anglais."""
        from videos.analysis import _format_channel_context_block

        ctx = _make_channel_context(n_videos=2)
        block = _format_channel_context_block(ctx, language="en")

        assert "### Channel Context (reference)" in block
        assert "Platform:" in block
        assert "Subscribers:" in block
        assert "Categories:" in block
        assert "latest videos" in block


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests : helpers d'extraction channel_id depuis metadata vidéo
# ═══════════════════════════════════════════════════════════════════════════════


class TestExtractChannelIdHelpers:
    """Tests d'extraction d'ID chaîne (utilisés en étape 1 du pipeline)."""

    def test_pipeline_extracts_channel_id_from_youtube_metadata(self):
        """YouTube metadata avec `channel_id` direct → extrait correctement."""
        from transcripts.youtube_channel import extract_channel_id_from_video_metadata

        metadata = {
            "channel_id": "UCxxYouTube123456789",
            "channel_url": "https://www.youtube.com/channel/UCxxYouTube123456789",
            "uploader_id": "@somehandle",
        }
        chan_id = extract_channel_id_from_video_metadata(metadata)
        assert chan_id == "UCxxYouTube123456789"

    def test_youtube_channel_id_via_url_parse(self):
        """Pas de `channel_id` direct → parse depuis `channel_url`."""
        from transcripts.youtube_channel import extract_channel_id_from_video_metadata

        metadata = {
            "channel_url": "https://www.youtube.com/channel/UCabcDEF12345678901234",
        }
        chan_id = extract_channel_id_from_video_metadata(metadata)
        assert chan_id == "UCabcDEF12345678901234"

    def test_youtube_channel_id_returns_none_for_invalid_metadata(self):
        """Metadata vide / None → None."""
        from transcripts.youtube_channel import extract_channel_id_from_video_metadata

        assert extract_channel_id_from_video_metadata({}) is None
        assert extract_channel_id_from_video_metadata(None) is None  # type: ignore[arg-type]

    def test_pipeline_extracts_username_from_tiktok_metadata(self):
        """TikTok metadata avec uploader_id → username extrait."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {
            "uploader_id": "charlidamelio",
            "webpage_url": "https://www.tiktok.com/@charlidamelio/video/12345",
        }
        username = extract_tiktok_username_from_video_metadata(metadata)
        assert username == "charlidamelio"

    def test_tiktok_username_via_webpage_url(self):
        """Pas de uploader_id, parse depuis URL."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {
            "webpage_url": "https://www.tiktok.com/@some_user/video/9999",
        }
        username = extract_tiktok_username_from_video_metadata(metadata)
        assert username == "some_user"

    def test_tiktok_username_returns_none_for_empty(self):
        """Metadata vide → None."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        assert extract_tiktok_username_from_video_metadata({}) is None
        assert extract_tiktok_username_from_video_metadata(None) is None  # type: ignore[arg-type]


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Tests : pipeline fail-safe (generate_summary continue si channel_context None)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_pipeline_continues_if_channel_context_fetch_fails():
    """generate_summary doit fonctionner avec channel_context=None (fail-safe).

    Mock l'appel LLM pour ne pas dépendre du réseau. On vérifie que
    generate_summary appelle bien build_analysis_prompt avec channel_context=None
    et que le résultat reste exploitable.
    """
    from videos import analysis as analysis_mod

    # Mock llm_complete : retourne un résumé bidon
    fake_result = type(
        "FakeLLMResult",
        (),
        {
            "content": "## Résumé\n\nContenu factice.",
            "tokens_total": 100,
            "fallback_used": False,
            "provider": "mistral",
            "model_used": "mistral-small-2603",
        },
    )()

    with patch.object(
        analysis_mod, "llm_complete", new=AsyncMock(return_value=fake_result)
    ), patch.object(analysis_mod, "get_mistral_key", return_value="fake-key"):

        # Désactiver le cache pour éviter side-effects
        analysis_mod.CACHE_AVAILABLE = False

        result = await analysis_mod.generate_summary(
            title="Test",
            transcript="content " * 50,
            category="general",
            lang="fr",
            mode="standard",
            duration=300,
            channel="TestChan",
            description="desc",
            channel_context=None,  # explicite : aucun contexte
        )

        assert result is not None
        assert "Résumé" in result or "Contenu" in result

        # Vérifier que llm_complete a bien été appelé
        analysis_mod.llm_complete.assert_called_once()
        call_kwargs = analysis_mod.llm_complete.call_args.kwargs
        # Le user_prompt ne doit PAS contenir le bloc contexte chaîne
        messages = call_kwargs.get("messages", [])
        user_msg = next((m for m in messages if m.get("role") == "user"), {})
        assert "### Contexte chaîne (référence)" not in user_msg.get("content", "")


@pytest.mark.asyncio
async def test_pipeline_passes_channel_context_to_prompt():
    """Si on passe channel_context à generate_summary, le bloc DOIT apparaître."""
    from videos import analysis as analysis_mod

    fake_result = type(
        "FakeLLMResult",
        (),
        {
            "content": "## Résumé\n\nOK.",
            "tokens_total": 50,
            "fallback_used": False,
            "provider": "mistral",
            "model_used": "mistral-small-2603",
        },
    )()

    ctx = _make_channel_context(n_videos=5, platform="youtube")

    with patch.object(
        analysis_mod, "llm_complete", new=AsyncMock(return_value=fake_result)
    ), patch.object(analysis_mod, "get_mistral_key", return_value="fake-key"):
        analysis_mod.CACHE_AVAILABLE = False

        await analysis_mod.generate_summary(
            title="Test",
            transcript="content " * 50,
            category="general",
            lang="fr",
            mode="standard",
            channel_context=ctx,
        )

        analysis_mod.llm_complete.assert_called_once()
        call_kwargs = analysis_mod.llm_complete.call_args.kwargs
        messages = call_kwargs.get("messages", [])
        user_msg = next((m for m in messages if m.get("role") == "user"), {})
        sys_msg = next((m for m in messages if m.get("role") == "system"), {})

        assert "### Contexte chaîne (référence)" in user_msg.get("content", "")
        assert "Chaîne Vulgarisation" in user_msg.get("content", "")
        assert "Contexte chaîne" in sys_msg.get("content", "")
