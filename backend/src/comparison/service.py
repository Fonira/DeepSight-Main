"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🆚 VIDEO COMPARISON SERVICE — Compare two analyzed videos via Mistral      ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json
import logging
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, VideoComparison
from videos.study_tools import call_mistral_json, safe_json_parse
from core.credits import deduct_credits, check_credits

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# PROMPT SYSTÈME
# ═══════════════════════════════════════════════════════════════════════════════

COMPARISON_SYSTEM_PROMPT = {
    "fr": """Tu es un analyste expert qui compare rigoureusement deux vidéos analysées.

Tu utilises les marqueurs épistémiques DeepSight :
✅ SOLIDE — Concordance entre les deux sources, fait établi
⚖️ NUANCÉ — Approches différentes mais compatibles
❌ CONTRADICTOIRE — Affirmations opposées, incompatibles
⚠️ À VÉRIFIER — Affirmation d'une seule source, non corroborée

Réponds UNIQUEMENT en JSON valide.""",
    "en": """You are an expert analyst rigorously comparing two analyzed videos.

You use DeepSight epistemic markers:
✅ SOLID — Agreement between both sources, established fact
⚖️ NUANCED — Different but compatible approaches
❌ CONTRADICTORY — Opposite, incompatible claims
⚠️ TO VERIFY — Claim from only one source, uncorroborated

Respond ONLY in valid JSON.""",
}

COMPARISON_USER_PROMPT = {
    "fr": """Compare ces deux vidéos en profondeur.

═══ VIDÉO A ═══
Titre: {title_a}
Chaîne: {channel_a}
Résumé: {summary_a}
{digest_a}
{entities_a}
{tags_a}

═══ VIDÉO B ═══
Titre: {title_b}
Chaîne: {channel_b}
Résumé: {summary_b}
{digest_b}
{entities_b}
{tags_b}

Retourne EXACTEMENT ce format JSON:
{{
  "similarities": [
    {{"theme": "Thème commun", "description": "Ce que les deux vidéos partagent", "evidence_a": "Citation/argument de A", "evidence_b": "Citation/argument de B", "strength": "forte|modérée|faible"}}
  ],
  "differences": [
    {{"topic": "Sujet", "position_a": "Position de la vidéo A", "position_b": "Position de la vidéo B", "significance": "majeure|mineure|contextuelle"}}
  ],
  "contradictions": [
    {{"topic": "Sujet", "claim_a": "Affirmation de A", "claim_b": "Affirmation de B", "severity": "directe|nuancée|contextuelle", "context": "Explication du contexte"}}
  ],
  "reliability": {{
    "score_a": 7.5,
    "score_b": 8.0,
    "reasoning": "Explication de la fiabilité comparée"
  }},
  "verdict": "Synthèse globale en 3-5 phrases avec marqueurs épistémiques. Utilise ✅ ⚖️ ❌ ⚠️ pour qualifier les conclusions."
}}""",
    "en": """Compare these two videos in depth.

═══ VIDEO A ═══
Title: {title_a}
Channel: {channel_a}
Summary: {summary_a}
{digest_a}
{entities_a}
{tags_a}

═══ VIDEO B ═══
Title: {title_b}
Channel: {channel_b}
Summary: {summary_b}
{digest_b}
{entities_b}
{tags_b}

Return EXACTLY this JSON format:
{{
  "similarities": [
    {{"theme": "Common theme", "description": "What both videos share", "evidence_a": "Quote/argument from A", "evidence_b": "Quote/argument from B", "strength": "strong|moderate|weak"}}
  ],
  "differences": [
    {{"topic": "Topic", "position_a": "Video A's position", "position_b": "Video B's position", "significance": "major|minor|contextual"}}
  ],
  "contradictions": [
    {{"topic": "Topic", "claim_a": "Claim from A", "claim_b": "Claim from B", "severity": "direct|nuanced|contextual", "context": "Context explanation"}}
  ],
  "reliability": {{
    "score_a": 7.5,
    "score_b": 8.0,
    "reasoning": "Comparative reliability explanation"
  }},
  "verdict": "Overall synthesis in 3-5 sentences with epistemic markers. Use ✅ ⚖️ ❌ ⚠️ to qualify conclusions."
}}""",
}


# ═══════════════════════════════════════════════════════════════════════════════
# COÛT
# ═══════════════════════════════════════════════════════════════════════════════

COMPARISON_CREDIT_COST = {
    "mistral-small-2603": 75,
    "mistral-medium-2508": 150,
    "mistral-large-2512": 375,
}


def get_comparison_cost(model: str) -> int:
    """Retourne le coût en crédits pour une comparaison."""
    return COMPARISON_CREDIT_COST.get(model, 75)


# ═══════════════════════════════════════════════════════════════════════════════
# SERVICE PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════


async def generate_comparison(
    session: AsyncSession,
    user_id: int,
    summary_a_id: int,
    summary_b_id: int,
    lang: str = "fr",
    model: str = "mistral-small-2603",
) -> dict:
    """
    Compare deux vidéos analysées via Mistral JSON mode.

    1. Charger les 2 Summary (vérifier ownership)
    2. Construire le prompt
    3. Vérifier et déduire les crédits
    4. Appeler Mistral JSON mode
    5. Sauvegarder en DB
    6. Retourner le résultat structuré
    """

    # 1. Charger les summaries
    result_a = await session.execute(select(Summary).where(Summary.id == summary_a_id, Summary.user_id == user_id))
    summary_a = result_a.scalar_one_or_none()
    if not summary_a:
        raise ValueError(f"Résumé A introuvable (id={summary_a_id})")

    result_b = await session.execute(select(Summary).where(Summary.id == summary_b_id, Summary.user_id == user_id))
    summary_b = result_b.scalar_one_or_none()
    if not summary_b:
        raise ValueError(f"Résumé B introuvable (id={summary_b_id})")

    # 2. Vérifier les crédits
    cost = get_comparison_cost(model)
    has_enough, current, msg = await check_credits(session, user_id, cost)
    if not has_enough:
        raise ValueError(f"Crédits insuffisants: {current} disponibles, {cost} requis")

    # 3. Construire le prompt
    prompt_lang = lang if lang in COMPARISON_USER_PROMPT else "fr"
    system_prompt = COMPARISON_SYSTEM_PROMPT[prompt_lang]

    user_prompt = COMPARISON_USER_PROMPT[prompt_lang].format(
        title_a=summary_a.video_title or "Sans titre",
        channel_a=summary_a.video_channel or "Inconnu",
        summary_a=summary_a.summary_content or "",
        digest_a=f"Digest détaillé: {summary_a.full_digest}" if summary_a.full_digest else "",
        entities_a=f"Entités: {summary_a.entities_extracted}" if summary_a.entities_extracted else "",
        tags_a=f"Tags: {summary_a.tags}" if summary_a.tags else "",
        title_b=summary_b.video_title or "Sans titre",
        channel_b=summary_b.video_channel or "Inconnu",
        summary_b=summary_b.summary_content or "",
        digest_b=f"Digest détaillé: {summary_b.full_digest}" if summary_b.full_digest else "",
        entities_b=f"Entités: {summary_b.entities_extracted}" if summary_b.entities_extracted else "",
        tags_b=f"Tags: {summary_b.tags}" if summary_b.tags else "",
    )

    # 4. Appeler Mistral JSON mode
    raw_content = await call_mistral_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        max_tokens=4000,
        temperature=0.2,
    )

    # 5. Parser le JSON
    comparison_data = safe_json_parse(raw_content, context="Comparison")

    # 6. Déduire les crédits
    success, new_balance = await deduct_credits(
        session=session,
        user_id=user_id,
        amount=cost,
        action_type="comparison",
        description=f"Comparaison: {summary_a.video_title} vs {summary_b.video_title}",
    )

    # 7. Sauvegarder en DB
    comparison = VideoComparison(
        user_id=user_id,
        summary_a_id=summary_a_id,
        summary_b_id=summary_b_id,
        comparison_json=json.dumps(comparison_data, ensure_ascii=False),
        lang=lang,
        model_used=model,
        credits_used=cost,
    )
    session.add(comparison)
    await session.commit()
    await session.refresh(comparison)

    logger.info(
        f"Comparison #{comparison.id} created: "
        f"{summary_a.video_title} vs {summary_b.video_title} "
        f"(user={user_id}, cost={cost})"
    )

    # 8. Retourner le résultat formaté
    return {
        "id": comparison.id,
        "video_a": {
            "id": summary_a.id,
            "title": summary_a.video_title,
            "channel": summary_a.video_channel,
            "thumbnail_url": summary_a.thumbnail_url,
        },
        "video_b": {
            "id": summary_b.id,
            "title": summary_b.video_title,
            "channel": summary_b.video_channel,
            "thumbnail_url": summary_b.thumbnail_url,
        },
        "result": comparison_data,
        "model_used": model,
        "credits_used": cost,
        "lang": lang,
        "created_at": comparison.created_at.isoformat() if comparison.created_at else None,
    }


async def get_comparison(
    session: AsyncSession,
    user_id: int,
    comparison_id: int,
) -> Optional[dict]:
    """Récupérer une comparaison existante par ID."""
    result = await session.execute(
        select(VideoComparison).where(
            VideoComparison.id == comparison_id,
            VideoComparison.user_id == user_id,
        )
    )
    comp = result.scalar_one_or_none()
    if not comp:
        return None

    # Charger les infos vidéo
    res_a = await session.execute(select(Summary).where(Summary.id == comp.summary_a_id))
    res_b = await session.execute(select(Summary).where(Summary.id == comp.summary_b_id))
    summary_a = res_a.scalar_one_or_none()
    summary_b = res_b.scalar_one_or_none()

    return {
        "id": comp.id,
        "video_a": {
            "id": summary_a.id if summary_a else comp.summary_a_id,
            "title": summary_a.video_title if summary_a else "Supprimé",
            "channel": summary_a.video_channel if summary_a else None,
            "thumbnail_url": summary_a.thumbnail_url if summary_a else None,
        },
        "video_b": {
            "id": summary_b.id if summary_b else comp.summary_b_id,
            "title": summary_b.video_title if summary_b else "Supprimé",
            "channel": summary_b.video_channel if summary_b else None,
            "thumbnail_url": summary_b.thumbnail_url if summary_b else None,
        },
        "result": json.loads(comp.comparison_json) if comp.comparison_json else {},
        "model_used": comp.model_used,
        "credits_used": comp.credits_used,
        "lang": comp.lang,
        "created_at": comp.created_at.isoformat() if comp.created_at else None,
    }


async def get_comparison_history(
    session: AsyncSession,
    user_id: int,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Historique paginé des comparaisons d'un utilisateur."""
    offset = (page - 1) * per_page

    # Count total
    count_result = await session.execute(
        select(func.count(VideoComparison.id)).where(VideoComparison.user_id == user_id)
    )
    total = count_result.scalar() or 0

    # Fetch page
    result = await session.execute(
        select(VideoComparison)
        .where(VideoComparison.user_id == user_id)
        .order_by(VideoComparison.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    comparisons = result.scalars().all()

    # Collect all summary IDs for batch loading
    summary_ids = set()
    for c in comparisons:
        summary_ids.add(c.summary_a_id)
        summary_ids.add(c.summary_b_id)

    summaries_result = await session.execute(
        select(Summary.id, Summary.video_title, Summary.thumbnail_url).where(Summary.id.in_(summary_ids))
    )
    summaries_map = {row.id: row for row in summaries_result.all()}

    items = []
    for c in comparisons:
        sa = summaries_map.get(c.summary_a_id)
        sb = summaries_map.get(c.summary_b_id)
        items.append(
            {
                "id": c.id,
                "video_a_title": sa.video_title if sa else "Supprimé",
                "video_b_title": sb.video_title if sb else "Supprimé",
                "video_a_thumbnail": sa.thumbnail_url if sa else None,
                "video_b_thumbnail": sb.thumbnail_url if sb else None,
                "model_used": c.model_used,
                "credits_used": c.credits_used,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
    }
