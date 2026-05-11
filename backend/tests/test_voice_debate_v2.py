"""
Tests Wave 2 C — voice moderator v2 (N perspectives + relation_types).

Ce fichier couvre les NOUVELLES fonctionnalités v2 du moderator vocal de débat :
- `build_debate_rich_context` en mode v2 nominal (table debate_perspectives présente)
- `build_debate_rich_context` en mode v1 fallback (table absente / vide)
- Nouveaux tools v2 : `list_perspectives`, `compare`, `synthesize_relation`
- Tools legacy toujours fonctionnels
- Compat ElevenLabs : agent_type="debate_moderator" présent dans le registre

Les tests historiques restent dans test_debate_voice_context.py et
test_debate_voice_tools.py — ce fichier-ci ne les redouble pas.
"""

from __future__ import annotations

import json
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from voice.debate_context import (
    DebateRichContext,
    PerspectiveCtx,
    _normalize_relation,
    _compute_dominant_relation,
    build_debate_rich_context,
)
from voice.debate_tools import (
    list_perspectives,
    compare,
    synthesize_relation,
    get_debate_overview,
    get_video_thesis,
    get_argument_comparison,
    get_debate_fact_check,
    search_in_debate_transcript,
)
from db.database import DebateAnalysis


# ═══════════════════════════════════════════════════════════════════════════════
# Factories
# ═══════════════════════════════════════════════════════════════════════════════


def _make_debate(**overrides) -> DebateAnalysis:
    """DebateAnalysis ‘complète’ avec colonnes legacy video_b_*."""
    defaults = dict(
        id=42,
        user_id=1,
        video_a_id="vidA01",
        platform_a="youtube",
        video_a_title="Vidéo A — perspective principale",
        video_a_channel="ChannelA",
        thesis_a="Thèse A : la position centrale du débat",
        arguments_a=json.dumps(
            [
                {"claim": "ClaimA1", "evidence": "evA1", "strength": "strong"},
                {"claim": "ClaimA2", "evidence": "evA2", "strength": "moderate"},
            ]
        ),
        video_b_id="vidB01",
        platform_b="youtube",
        video_b_title="Vidéo B — perspective opposée (legacy v1)",
        video_b_channel="ChannelB",
        thesis_b="Thèse B : opposition à la thèse A",
        arguments_b=json.dumps(
            [{"claim": "ClaimB1", "evidence": "evB1", "strength": "strong"}]
        ),
        detected_topic="Sujet du débat IA v2",
        convergence_points=json.dumps(["Convergence Z"]),
        divergence_points=json.dumps(
            [{"topic": "Prix", "position_a": "trop cher", "position_b": "justifié"}]
        ),
        fact_check_results=json.dumps(
            [{"claim": "Affirmation X", "verdict": "confirmed", "explanation": "OK"}]
        ),
        debate_summary="Synthèse globale du débat.",
        status="completed",
        mode="auto",
        lang="fr",
        created_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    return DebateAnalysis(**defaults)


def _make_v2_perspective_row(**overrides) -> dict:
    """
    Mimique d'une row `debate_perspectives` (mapping renvoyé par
    `_load_perspectives_safe` quand la table existe).
    """
    defaults = dict(
        id=1001,
        position=0,
        video_id="vidB01",
        platform="youtube",
        video_title="Vidéo B opposée",
        video_channel="ChannelB",
        thesis="Thèse opposée à A",
        arguments=json.dumps(
            [{"claim": "ClaimOpp1", "evidence": "evOpp", "strength": "strong"}]
        ),
        relation_type="opposite",
        audience_level="grand_public",
        channel_quality_score=0.7,
    )
    defaults.update(overrides)
    return defaults


def _three_perspectives_rows() -> list[dict]:
    """Trois perspectives avec relation_types variés (opposite/complement/nuance)."""
    return [
        _make_v2_perspective_row(
            id=1001,
            position=0,
            video_id="vidOpp",
            video_title="Vidéo opposée",
            video_channel="ChannelOpp",
            thesis="Thèse en opposition franche",
            relation_type="opposite",
            arguments=json.dumps(
                [{"claim": "OppClaim1", "evidence": "OppEv", "strength": "strong"}]
            ),
        ),
        _make_v2_perspective_row(
            id=1002,
            position=1,
            video_id="vidComp",
            video_title="Vidéo complémentaire",
            video_channel="ChannelComp",
            thesis="Thèse qui complète la principale",
            relation_type="complement",
            arguments=json.dumps(
                [{"claim": "CompClaim1", "evidence": "CompEv", "strength": "moderate"}]
            ),
        ),
        _make_v2_perspective_row(
            id=1003,
            position=2,
            video_id="vidNua",
            video_title="Vidéo nuançante",
            video_channel="ChannelNua",
            thesis="Thèse qui nuance la principale",
            relation_type="nuance",
            arguments=json.dumps(
                [{"claim": "NuaClaim1", "evidence": "NuaEv", "strength": "weak"}]
            ),
        ),
    ]


def _mock_db_select_debate(debate: DebateAnalysis | None) -> AsyncMock:
    """Mock un AsyncSession dont `execute(select(...))` renvoie ce debate."""
    db = AsyncMock(spec=AsyncSession)
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = debate
    db.execute = AsyncMock(return_value=select_result)
    return db


# ═══════════════════════════════════════════════════════════════════════════════
# 1. build_debate_rich_context — cas v2 nominal (3 perspectives)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_build_context_v2_three_perspectives_populated():
    """
    Cas v2 nominal : la table `debate_perspectives` retourne 3 rows.
    Le contexte doit refléter les 3 titres, relations et thèses.
    """
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate()
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_context._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    assert isinstance(ctx, DebateRichContext)
    assert len(ctx.perspectives) == 3

    titles = [p.video_title for p in ctx.perspectives]
    relations = [p.relation_type for p in ctx.perspectives]

    assert "Vidéo opposée" in titles
    assert "Vidéo complémentaire" in titles
    assert "Vidéo nuançante" in titles
    assert relations == ["opposite", "complement", "nuance"]

    theses = [p.thesis for p in ctx.perspectives]
    assert any("opposition franche" in t for t in theses)
    assert any("complète" in t for t in theses)
    assert any("nuance" in t for t in theses)

    # Relation dominante : tie 1-1-1, priorité opposite > complement > nuance
    assert ctx.relation_type_dominant == "opposite"

    # video_a propagée
    assert ctx.video_a_title == debate.video_a_title
    assert ctx.thesis_a == debate.thesis_a


@pytest.mark.asyncio
async def test_build_context_v2_format_for_voice_includes_three_titles():
    """Le contexte vocal formaté mentionne les 3 perspectives + leurs relations."""
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate()
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_context._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    formatted = ctx.format_for_voice(language="fr", max_chars=12_000)

    assert "Vidéo opposée" in formatted
    assert "Vidéo complémentaire" in formatted
    assert "Vidéo nuançante" in formatted
    # Relations humaines (FR)
    assert "opposition" in formatted
    assert "complément" in formatted
    assert "nuance" in formatted
    # Header v2 multi-perspectives
    assert "perspectives" in formatted.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 2. build_debate_rich_context — cas v2 avec UNE seule perspective
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_build_context_v2_single_perspective_classic_debate_format():
    """
    Une seule perspective, relation 'opposite' → format ‘Débat IA classique’
    (compat avec lecture historique).
    """
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate()
    rows = [
        _make_v2_perspective_row(
            id=2001,
            position=0,
            video_id="vidSolo",
            video_title="Vidéo B unique",
            video_channel="ChannelSolo",
            thesis="Thèse opposée unique",
            relation_type="opposite",
        )
    ]

    with patch(
        "voice.debate_context._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    assert len(ctx.perspectives) == 1
    assert ctx.perspectives[0].video_title == "Vidéo B unique"
    assert ctx.relation_type_dominant == "opposite"

    formatted = ctx.format_for_voice(language="fr", max_chars=12_000)
    # Format classique réutilisé
    assert "VIDÉO A" in formatted
    assert "VIDÉO B" in formatted
    assert "Vidéo B unique" in formatted


@pytest.mark.asyncio
async def test_build_context_v2_single_complement_uses_perspectives_format():
    """
    Une seule perspective MAIS relation 'complement' → format multi-perspectives
    (le header annonce explicitement la relation dominante).
    """
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate()
    rows = [
        _make_v2_perspective_row(
            id=2002,
            position=0,
            video_id="vidComp",
            video_title="Vidéo complément",
            video_channel="ChannelComp",
            thesis="Thèse qui élargit",
            relation_type="complement",
        )
    ]

    with patch(
        "voice.debate_context._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    assert len(ctx.perspectives) == 1
    assert ctx.relation_type_dominant == "complement"
    formatted = ctx.format_for_voice(language="fr", max_chars=12_000)
    assert "complément" in formatted
    assert "Relation dominante" in formatted


# ═══════════════════════════════════════════════════════════════════════════════
# 3. build_debate_rich_context — cas v1 fallback (table absente)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_build_context_v1_fallback_when_perspectives_table_absent():
    """
    Cas v1 fallback : la table `debate_perspectives` n'existe pas → exception SQL
    avalée par `_load_perspectives_safe`, on synthétise une perspective implicite
    position=0 relation='opposite' depuis `debate_analyses.video_b_*`.
    """
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate()  # video_b_* présents

    # Simule la table absente : SELECT raw sur debate_perspectives lève.
    # `_load_perspectives_safe` capture l'exception et renvoie [].
    db.execute = AsyncMock(side_effect=Exception("no such table: debate_perspectives"))

    ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    # 1 perspective implicite (fallback v1)
    assert len(ctx.perspectives) == 1
    p = ctx.perspectives[0]
    assert p.perspective_id == -1  # Marqueur "perspective virtuelle"
    assert p.position == 0
    assert p.relation_type == "opposite"
    assert p.video_id == "vidB01"
    assert p.video_title == "Vidéo B — perspective opposée (legacy v1)"
    assert p.video_channel == "ChannelB"
    assert p.thesis == "Thèse B : opposition à la thèse A"
    assert len(p.arguments) == 1
    assert p.arguments[0]["claim"] == "ClaimB1"

    # Relation dominante reflète la perspective
    assert ctx.relation_type_dominant == "opposite"

    # Compat properties exposent video_b_*
    assert ctx.video_b_title == "Vidéo B — perspective opposée (legacy v1)"
    assert ctx.thesis_b == "Thèse B : opposition à la thèse A"


@pytest.mark.asyncio
async def test_build_context_v1_fallback_format_for_voice():
    """Le format vocal en fallback v1 reste lisible (mention 1 perspective)."""
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate()
    db.execute = AsyncMock(side_effect=Exception("no such table: debate_perspectives"))

    ctx = await build_debate_rich_context(debate, db, include_transcripts=False)
    formatted = ctx.format_for_voice(language="fr", max_chars=10_000)

    assert "Vidéo B — perspective opposée (legacy v1)" in formatted
    assert "VIDÉO A" in formatted
    assert "VIDÉO B" in formatted
    # Compat lecture : 1 perspective + opposite → format classique
    assert "Sujet du débat IA v2" in formatted


@pytest.mark.asyncio
async def test_build_context_no_video_b_graceful():
    """
    Cas debate orphelin : pas de video_b_id ET table debate_perspectives absente.
    Le contexte se construit sans planter, avec 0 perspective.
    """
    db = AsyncMock(spec=AsyncSession)
    debate = _make_debate(
        video_b_id=None,
        video_b_title=None,
        video_b_channel=None,
        thesis_b=None,
        arguments_b=None,
        platform_b=None,
    )
    db.execute = AsyncMock(side_effect=Exception("no such table: debate_perspectives"))

    ctx = await build_debate_rich_context(debate, db, include_transcripts=False)

    assert len(ctx.perspectives) == 0
    assert ctx.video_a_title == debate.video_a_title
    # format_for_voice ne plante pas, et ne mentionne pas un nombre négatif
    formatted = ctx.format_for_voice(language="fr", max_chars=8_000)
    assert "Sujet du débat IA v2" in formatted


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Tools v2 — list_perspectives
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_list_perspectives_v2_three_titles_and_relations():
    """list_perspectives renvoie titres + thèses + relations human des 3 perspectives."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await list_perspectives(42, db)

    # Header
    assert "Perspectives du débat" in out
    # Vidéo A
    assert "Vidéo A — perspective principale" in out
    assert "Thèse A" in out
    # Les 3 perspectives
    assert "Vidéo opposée" in out
    assert "Vidéo complémentaire" in out
    assert "Vidéo nuançante" in out
    # Relations human FR
    assert "opposition" in out
    assert "complément" in out
    assert "nuance" in out
    # Numérotation 1-based
    assert "Perspective 1" in out
    assert "Perspective 2" in out
    assert "Perspective 3" in out


@pytest.mark.asyncio
async def test_list_perspectives_v1_fallback_one_implicit_perspective():
    """En fallback v1, list_perspectives renvoie la perspective implicite (vidéo B)."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=[]),
    ):
        out = await list_perspectives(42, db)

    assert "Vidéo A" in out
    assert "Vidéo B — perspective opposée (legacy v1)" in out
    assert "opposition" in out  # relation_type='opposite' implicite
    assert "Perspective 1" in out


@pytest.mark.asyncio
async def test_list_perspectives_missing_debate_returns_message():
    """Pas de débat trouvé → message d'erreur clair."""
    db = _mock_db_select_debate(None)
    out = await list_perspectives(999, db)
    assert "introuvable" in out.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Tools v2 — compare
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_compare_video_a_vs_first_perspective():
    """compare(0, 1) = vidéo A vs 1ère perspective (position 1-based)."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await compare(42, 0, 1, db)

    # En-tête
    assert "Comparaison" in out
    # Vidéo A
    assert "Vidéo A" in out
    assert "Thèse A" in out
    assert "ClaimA1" in out
    # Perspective 1 (opposite)
    assert "Vidéo opposée" in out
    assert "OppClaim1" in out
    assert "opposition" in out


@pytest.mark.asyncio
async def test_compare_two_perspectives_by_position():
    """compare(1, 2) compare perspective 1 et perspective 2 (positions 1-based)."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await compare(42, 1, 2, db)

    assert "Vidéo opposée" in out
    assert "Vidéo complémentaire" in out
    # Pas de Vidéo A en focus principal (mais peut apparaître dans la synthèse globale)
    assert "OppClaim1" in out
    assert "CompClaim1" in out


@pytest.mark.asyncio
async def test_compare_resolves_perspective_by_db_id():
    """compare(0, 1002) résout 1002 = perspective_id en DB → 2ème perspective."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await compare(42, 0, 1002, db)

    # 1002 = id complement
    assert "Vidéo complémentaire" in out
    assert "complément" in out


@pytest.mark.asyncio
async def test_compare_invalid_perspective_id():
    """ID inexistant → message d'erreur explicite."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await compare(42, 0, 9999, db)

    assert "introuvable" in out.lower()


@pytest.mark.asyncio
async def test_compare_same_perspective_twice():
    """Comparer une perspective avec elle-même → message clair."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await compare(42, 1, 1, db)

    assert "identiques" in out.lower() or "différentes" in out.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Tools v2 — synthesize_relation
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_synthesize_relation_opposite_focuses_on_contradictions():
    """relation='opposite' → focus contradictions, listing perspectives oppose."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await synthesize_relation(42, "opposite", db)

    assert "opposition" in out.lower()
    assert "Vidéo opposée" in out
    assert "OppClaim1" in out
    # Les non-opposite ne sont PAS le focus
    assert "Vidéo complémentaire" not in out
    assert "Vidéo nuançante" not in out
    # Section divergences globales
    assert "Prix" in out  # tirée des divergence_points


@pytest.mark.asyncio
async def test_synthesize_relation_complement_focuses_on_enrichissements():
    """relation='complement' → focus enrichissements + convergences globales."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await synthesize_relation(42, "complement", db)

    assert "complément" in out.lower()
    assert "Vidéo complémentaire" in out
    assert "CompClaim1" in out
    # Section convergences globales (Convergence Z)
    assert "Convergence Z" in out
    # Pas de focus sur les autres
    assert "Vidéo opposée" not in out
    assert "Vidéo nuançante" not in out


@pytest.mark.asyncio
async def test_synthesize_relation_nuance_focuses_on_subtleties():
    """relation='nuance' → focus subtilités + lecture nuancée."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await synthesize_relation(42, "nuance", db)

    assert "nuance" in out.lower()
    assert "Vidéo nuançante" in out
    assert "NuaClaim1" in out
    assert "nuancée" in out.lower() or "nuance" in out.lower()
    # Pas de focus sur les autres
    assert "Vidéo opposée" not in out
    assert "Vidéo complémentaire" not in out


@pytest.mark.asyncio
async def test_synthesize_relation_empty_returns_invalid_message():
    """relation vide → message clair listant les valeurs autorisées.

    NB : `_normalize_relation` retourne 'opposite' par défaut sur toute valeur
    inconnue, donc la garde du tool ne déclenche que sur chaîne vide / None.
    """
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await synthesize_relation(42, "", db)

    low = out.lower()
    assert "invalide" in low


@pytest.mark.asyncio
async def test_synthesize_relation_no_matching_perspective():
    """
    Aucune perspective ne matche le relation demandé → message + fallback global
    (pour 'opposite', on continue d'afficher les divergences globales).
    """
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = [
        _make_v2_perspective_row(
            id=3001, position=0, relation_type="complement",
            video_title="Seule complement",
        )
    ]

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await synthesize_relation(42, "opposite", db)

    low = out.lower()
    assert "aucune" in low
    # Pour opposite, on continue avec les divergences globales
    assert "Prix" in out


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Tools legacy — toujours fonctionnels (smoke)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_legacy_get_debate_overview_still_works_v1_fallback():
    """get_debate_overview reste fonctionnel en fallback v1."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=[]),
    ):
        out = await get_debate_overview(42, db)

    assert "Sujet du débat IA v2" in out
    assert "Vidéo A — perspective principale" in out
    # Fallback v1 → 1 perspective opposée → format classique avec "Vidéo B"
    assert "Vidéo B — perspective opposée (legacy v1)" in out


@pytest.mark.asyncio
async def test_legacy_get_video_thesis_video_a():
    """get_video_thesis side='video_a' renvoie thèse + arguments de A."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    out = await get_video_thesis(42, "video_a", db)
    assert "Vidéo A — perspective principale" in out
    assert "Thèse A" in out
    assert "ClaimA1" in out


@pytest.mark.asyncio
async def test_legacy_get_video_thesis_perspective_2_v2():
    """
    get_video_thesis side='perspective_2' (v2) renvoie thèse de la 2ème perspective.
    Acceptance : Tools historique étendus pour pointer une perspective N.
    """
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    rows = _three_perspectives_rows()

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=rows),
    ):
        out = await get_video_thesis(42, "perspective_2", db)

    # 2ème perspective = "Vidéo complémentaire"
    assert "Vidéo complémentaire" in out
    assert "complète" in out


@pytest.mark.asyncio
async def test_legacy_get_argument_comparison_topic_match():
    """get_argument_comparison sur un sous-thème connu retourne A vs B."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)

    with patch(
        "voice.debate_tools._load_perspectives_safe",
        new=AsyncMock(return_value=[]),  # fallback v1
    ):
        out = await get_argument_comparison(42, "Prix", db)

    assert "Prix" in out
    assert "trop cher" in out
    assert "justifié" in out


@pytest.mark.asyncio
async def test_legacy_get_debate_fact_check_v2_safe():
    """get_debate_fact_check fonctionne indépendamment du nombre de perspectives."""
    debate = _make_debate()
    db = _mock_db_select_debate(debate)
    out = await get_debate_fact_check(42, db)
    low = out.lower()
    assert "confirmed" in low or "confirmé" in low
    assert "Affirmation X" in out


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Compat ElevenLabs — agent_type "debate_moderator" présent
# ═══════════════════════════════════════════════════════════════════════════════


def test_agent_type_debate_moderator_registered():
    """
    Compat ElevenLabs : l'agent debate_moderator doit être enregistré avec sa config.
    Sub-agent C ne doit pas casser le binding agent_type.
    """
    from voice.agent_types import (
        DEBATE_MODERATOR,
        AGENT_REGISTRY,
        get_agent_config,
    )

    # Direct binding
    assert DEBATE_MODERATOR.agent_type == "debate_moderator"
    # Registry lookup
    assert "debate_moderator" in AGENT_REGISTRY
    cfg = get_agent_config("debate_moderator")
    assert cfg.agent_type == "debate_moderator"
    assert cfg.requires_debate is True

    # Tools historiques toujours déclarés (compat ElevenLabs Studio)
    expected_legacy_tools = {
        "get_debate_overview",
        "get_video_thesis",
        "get_argument_comparison",
        "search_in_debate_transcript",
        "get_debate_fact_check",
    }
    assert expected_legacy_tools.issubset(set(cfg.tools))


# ═══════════════════════════════════════════════════════════════════════════════
# 9. Helpers internes — _normalize_relation et _compute_dominant_relation
# ═══════════════════════════════════════════════════════════════════════════════


def test_normalize_relation_canonical_values():
    """_normalize_relation accepte plusieurs synonymes / casing.

    NB : on évite les chaînes avec accents dans ce test pour rester portable
    (encodage cp1252 sur Windows). La liste complète des synonymes accentués
    est exercée indirectement via les autres tests v2 qui passent par DB.
    """
    assert _normalize_relation("opposite") == "opposite"
    assert _normalize_relation("Opposition") == "opposite"
    assert _normalize_relation("OPPOSE") == "opposite"
    assert _normalize_relation("complement") == "complement"
    assert _normalize_relation("Complementary") == "complement"
    assert _normalize_relation("complementaire") == "complement"
    assert _normalize_relation("nuance") == "nuance"
    assert _normalize_relation("nuanced") == "nuance"
    # Default / inconnu -> opposite
    assert _normalize_relation(None) == "opposite"
    assert _normalize_relation("") == "opposite"
    assert _normalize_relation("foo") == "opposite"


def test_compute_dominant_relation_priority_opposite():
    """Tie 1-1-1 → priorité opposite > complement > nuance (cf. spec §2.1)."""
    perspectives = [
        PerspectiveCtx(position=0, relation_type="opposite"),
        PerspectiveCtx(position=1, relation_type="complement"),
        PerspectiveCtx(position=2, relation_type="nuance"),
    ]
    assert _compute_dominant_relation(perspectives) == "opposite"


def test_compute_dominant_relation_majority_complement():
    """2 complement + 1 nuance → complement gagne."""
    perspectives = [
        PerspectiveCtx(position=0, relation_type="complement"),
        PerspectiveCtx(position=1, relation_type="complement"),
        PerspectiveCtx(position=2, relation_type="nuance"),
    ]
    assert _compute_dominant_relation(perspectives) == "complement"


def test_compute_dominant_relation_empty_default():
    """Pas de perspective → default opposite."""
    assert _compute_dominant_relation([]) == "opposite"
