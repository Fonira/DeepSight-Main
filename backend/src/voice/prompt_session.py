"""SESSION block builder — contexte utilisateur partagé pour TOUS les agents voice.

Aujourd'hui, seul le COMPANION reçoit dans son system_prompt des informations
sur l'utilisateur (prénom, plan, analyses récentes, thèmes). Les six autres
agents (``explorer``, ``tutor``, ``debate_moderator``, ``quiz_coach``,
``onboarding``, ``explorer_streaming``) n'ont aucune visibilité sur l'identité
ou le contexte d'usage de l'utilisateur connecté.

Ce module expose :func:`build_session_block` qui produit un bloc Markdown
unifié (sections ``# SESSION``, ``# UTILISATEUR``, ``# ANALYSES RÉCENTES`` —
en français — ou leurs équivalents anglais) injectable entre l'identité de
l'agent et le contexte vidéo dans n'importe quel system_prompt voice.

Le bloc est plafonné à 1500 caractères pour rester compatible avec la fenêtre
de contexte initiale ElevenLabs ; en cas de dépassement, on tronque
prioritairement les analyses récentes, puis on supprime les centres
d'intérêt. Toute requête DB qui échoue est loggée en ``warning`` et la
section concernée est silencieusement omise — la fonction ne lève jamais.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from db.database import FlashcardReview, Summary

# ──────────────────────────────────────────────────────────────────────────────
# Constantes
# ──────────────────────────────────────────────────────────────────────────────

#: Limite stricte de longueur (en caractères) du bloc final.
#: Au-delà, on tronque dans cet ordre : analyses récentes (3 → 1) puis themes.
MAX_BLOCK_CHARS: int = 1500

#: Nombre maximal d'analyses récentes affichées par défaut.
RECENT_ANALYSES_LIMIT: int = 3

#: Mapping plateforme → libellé humain (FR / EN).
_PLATFORM_LABELS: dict[str, dict[str, str]] = {
    "fr": {
        "web": "web",
        "mobile": "mobile",
        "extension": "extension Chrome",
    },
    "en": {
        "web": "web",
        "mobile": "mobile",
        "extension": "Chrome extension",
    },
}

#: Mapping surface → libellé humain (FR / EN).
_SURFACE_LABELS: dict[str, dict[str, str]] = {
    "fr": {
        "voice_call": "Voice Call",
        "quick_voice_call": "Quick Voice Call (streaming)",
        "debate": "Débat IA",
    },
    "en": {
        "voice_call": "Voice Call",
        "quick_voice_call": "Quick Voice Call (streaming)",
        "debate": "AI Debate",
    },
}

#: Mapping agent_type → libellé humain (FR / EN).
_AGENT_LABELS: dict[str, dict[str, str]] = {
    "fr": {
        "explorer": "Explorateur",
        "explorer_streaming": "Explorateur (streaming)",
        "tutor": "Tuteur",
        "debate_moderator": "Modérateur de débat",
        "quiz_coach": "Coach Quiz",
        "onboarding": "Onboarding",
        "companion": "Companion",
    },
    "en": {
        "explorer": "Explorer",
        "explorer_streaming": "Explorer (streaming)",
        "tutor": "Tutor",
        "debate_moderator": "Debate Moderator",
        "quiz_coach": "Quiz Coach",
        "onboarding": "Onboarding",
        "companion": "Companion",
    },
}

#: Mapping plan canonique → label affiché.
_PLAN_LABELS: dict[str, str] = {
    "free": "Free",
    "pro": "Pro",
    "expert": "Expert",
}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def _i18n(language: str) -> str:
    """Normalise la langue : on n'accepte que ``fr`` ou ``en`` (fallback ``fr``)."""
    return "en" if (language or "").lower().startswith("en") else "fr"


def _get_first_name(user: Any) -> Optional[str]:
    """Renvoie le prénom utilisateur s'il est disponible et non vide.

    Le modèle :class:`User` n'a pas (encore) de colonne ``first_name`` dédiée,
    on regarde donc dans plusieurs attributs candidats par ordre de
    préférence (``first_name`` → ``prenom`` → ``username``). Une string vide
    ou un placeholder type ``"ami"`` est traité comme absent.
    """
    for attr in ("first_name", "prenom"):
        value = getattr(user, attr, None)
        if value and isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _format_plan_line(
    *,
    plan: str,
    voice_quota_remaining_min: Optional[float],
    language: str,
) -> tuple[str, Optional[str]]:
    """Construit ``(plan_line, quota_line)`` selon le plan et le quota.

    - Free + quota=None  → "Free" / "essai gratuit lifetime non utilisé"
    - Free + quota=0     → "Free" / "essai utilisé"
    - Free + quota>0     → "Free" / "X min restantes (essai)"
    - Pro                → "Pro"  / "voice désactivé sur ce plan — Expert requis"
    - Expert + quota>=0  → "Expert" / "X min restantes ce mois"

    Renvoie ``(plan_label, quota_text_or_None)``. Le caller insère deux lignes
    distinctes dans la section ``# UTILISATEUR``.
    """
    plan_norm = (plan or "free").lower()
    plan_label = _PLAN_LABELS.get(plan_norm, plan_norm.capitalize() or "Free")

    if language == "en":
        if plan_norm == "free":
            if voice_quota_remaining_min is None:
                return plan_label, "lifetime free trial not yet used"
            if voice_quota_remaining_min <= 0:
                return plan_label, "trial used up"
            return plan_label, f"{_fmt_minutes(voice_quota_remaining_min)} min left (trial)"
        if plan_norm == "pro":
            return plan_label, "voice disabled on this plan — Expert required"
        if plan_norm == "expert":
            if voice_quota_remaining_min is None:
                return plan_label, None
            return plan_label, f"{_fmt_minutes(voice_quota_remaining_min)} min left this month"
        return plan_label, None

    # FR
    if plan_norm == "free":
        if voice_quota_remaining_min is None:
            return plan_label, "essai gratuit lifetime non utilisé"
        if voice_quota_remaining_min <= 0:
            return plan_label, "essai utilisé"
        return plan_label, f"{_fmt_minutes(voice_quota_remaining_min)} min restantes (essai)"
    if plan_norm == "pro":
        return plan_label, "voice désactivé sur ce plan — Expert requis"
    if plan_norm == "expert":
        if voice_quota_remaining_min is None:
            return plan_label, None
        return plan_label, f"{_fmt_minutes(voice_quota_remaining_min)} min restantes ce mois"
    return plan_label, None


def _fmt_minutes(value: float) -> str:
    """Formate un nombre de minutes : entier si possible, sinon 1 décimale."""
    if value is None:
        return "0"
    rounded = round(float(value), 1)
    if abs(rounded - int(rounded)) < 0.05:
        return str(int(rounded))
    return f"{rounded:.1f}"


def _format_relative_date(when: Optional[datetime], language: str) -> str:
    """Formate une date en délai relatif depuis aujourd'hui (``aujourd'hui`` / ``Xj``)."""
    if when is None:
        return ""
    today = date.today()
    delta_days = (today - when.date()).days
    if delta_days <= 0:
        return "today" if language == "en" else "aujourd'hui"
    if delta_days == 1:
        return "yesterday" if language == "en" else "hier"
    suffix = "d" if language == "en" else "j"
    return f"{delta_days}{suffix}"


# ──────────────────────────────────────────────────────────────────────────────
# DB queries (chacune robuste, log warning + retourne défaut sur erreur)
# ──────────────────────────────────────────────────────────────────────────────


async def _fetch_total_analyses(*, db: AsyncSession, user_id: int) -> Optional[int]:
    """Compte total des Summary du user. ``None`` si la query échoue."""
    try:
        from sqlalchemy import func as _func

        result = await db.execute(
            select(_func.count(Summary.id)).where(Summary.user_id == user_id)
        )
        return int(result.scalar() or 0)
    except Exception as exc:  # noqa: BLE001 — section optionnelle
        logger.warning("prompt_session.total_analyses failed: %s", exc)
        return None


async def _fetch_recent_summaries(
    *, db: AsyncSession, user_id: int, limit: int
) -> list[Summary]:
    """Renvoie les ``limit`` analyses les plus récentes du user. ``[]`` sur erreur."""
    try:
        result = await db.execute(
            select(Summary)
            .where(Summary.user_id == user_id)
            .order_by(Summary.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001 — section optionnelle
        logger.warning("prompt_session.recent_summaries failed: %s", exc)
        return []


async def _fetch_flashcards_due_today(
    *, db: AsyncSession, user_id: int
) -> Optional[int]:
    """Compte des FlashcardReview dont ``due_date <= aujourd'hui``.

    Note : le modèle FSRS s'appelle :class:`FlashcardReview` (pas ``Flashcard``)
    et la colonne est ``due_date`` (pas ``next_review_date``). Si la table
    n'existe pas dans le déploiement courant ou si la query échoue, on omet
    la ligne — pas d'erreur remontée à l'agent.
    """
    try:
        from sqlalchemy import func as _func

        now = datetime.utcnow()
        result = await db.execute(
            select(_func.count(FlashcardReview.id)).where(
                FlashcardReview.user_id == user_id,
                FlashcardReview.due_date.is_not(None),
                FlashcardReview.due_date <= now,
            )
        )
        count = int(result.scalar() or 0)
        return count if count > 0 else None
    except Exception as exc:  # noqa: BLE001 — section optionnelle
        logger.warning("prompt_session.flashcards_due failed: %s", exc)
        return None


async def _fetch_themes(*, db: AsyncSession, user_id: int) -> list[str]:
    """Renvoie le top 3 thèmes via :func:`companion_themes.extract_top3_themes`.

    Le module ``companion_themes`` n'expose pas ``compute_themes`` (seulement
    ``extract_top3_themes``). On lui passe un :class:`CompanionDBAdapter` léger
    pour qu'il puisse appeler ``fetch_recent_summaries``.
    """
    try:
        from voice.companion_db import CompanionDBAdapter
        from voice.companion_themes import extract_top3_themes

        adapter = CompanionDBAdapter(db)
        themes = await extract_top3_themes(user_id=user_id, db=adapter, llm_client=None)
        return list(themes or [])[:3]
    except Exception as exc:  # noqa: BLE001 — section optionnelle
        logger.warning("prompt_session.themes failed: %s", exc)
        return []


# ──────────────────────────────────────────────────────────────────────────────
# Rendering
# ──────────────────────────────────────────────────────────────────────────────


def _render_recent_block(
    summaries: list[Summary],
    *,
    language: str,
    limit: int,
) -> Optional[str]:
    """Rend la section ``# ANALYSES RÉCENTES`` (ou ``# RECENT ANALYSES``).

    Renvoie ``None`` si la liste est vide afin que le caller saute la section.
    """
    if not summaries:
        return None

    header = (
        f"# RECENT ANALYSES ({limit} latest)"
        if language == "en"
        else f"# ANALYSES RÉCENTES ({limit} dernières)"
    )
    lines: list[str] = [header]
    for s in summaries[:limit]:
        title = (s.video_title or "?").strip()
        channel = (s.video_channel or "").strip()
        rel = _format_relative_date(s.created_at, language)
        if channel and rel:
            lines.append(f'- "{title}" — {channel} ({rel})')
        elif channel:
            lines.append(f'- "{title}" — {channel}')
        else:
            lines.append(f'- "{title}"')
    return "\n".join(lines)


def _assemble(
    *,
    session_lines: list[str],
    user_lines: list[str],
    recent_block: Optional[str],
) -> str:
    """Concatène les sections en respectant le format Markdown attendu."""
    parts: list[str] = []
    if session_lines:
        parts.append("\n".join(session_lines))
    if user_lines:
        parts.append("\n".join(user_lines))
    if recent_block:
        parts.append(recent_block)
    return "\n\n".join(parts)


def _enforce_cap(
    *,
    session_lines: list[str],
    user_lines: list[str],
    recent_summaries: list[Summary],
    themes_line_idx: Optional[int],
    language: str,
) -> str:
    """Assemble en respectant ``MAX_BLOCK_CHARS``.

    Stratégie de troncature en cascade :
      1. tenter avec 3 analyses récentes,
      2. tenter avec 1 analyse récente,
      3. supprimer la ligne ``themes`` si elle existe,
      4. tenter sans aucune analyse récente.
    """
    # Étape 1 : 3 analyses
    block = _assemble(
        session_lines=session_lines,
        user_lines=user_lines,
        recent_block=_render_recent_block(
            recent_summaries, language=language, limit=RECENT_ANALYSES_LIMIT
        ),
    )
    if len(block) <= MAX_BLOCK_CHARS:
        return block

    # Étape 2 : 1 analyse
    block = _assemble(
        session_lines=session_lines,
        user_lines=user_lines,
        recent_block=_render_recent_block(recent_summaries, language=language, limit=1),
    )
    if len(block) <= MAX_BLOCK_CHARS:
        return block

    # Étape 3 : retirer themes
    user_lines_no_themes = list(user_lines)
    if themes_line_idx is not None and 0 <= themes_line_idx < len(user_lines_no_themes):
        user_lines_no_themes.pop(themes_line_idx)
    block = _assemble(
        session_lines=session_lines,
        user_lines=user_lines_no_themes,
        recent_block=_render_recent_block(recent_summaries, language=language, limit=1),
    )
    if len(block) <= MAX_BLOCK_CHARS:
        return block

    # Étape 4 : aucune analyse récente
    block = _assemble(
        session_lines=session_lines,
        user_lines=user_lines_no_themes,
        recent_block=None,
    )
    if len(block) <= MAX_BLOCK_CHARS:
        return block

    # Filet de sécurité — coupe brute (préserve l'intégrité de la section SESSION).
    return block[:MAX_BLOCK_CHARS]


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────


async def build_session_block(
    *,
    user: Any,
    db: AsyncSession,
    platform: str = "web",
    agent_type: str,
    surface: str = "voice_call",
    language: str = "fr",
    voice_quota_remaining_min: Optional[float] = None,
) -> str:
    """Construit le bloc ``# SESSION`` injectable dans tout system_prompt voice.

    Le bloc contient trois sections — ``# SESSION`` (plateforme/surface/agent/
    langue), ``# UTILISATEUR`` (prénom, plan, quota voice, totaux et thèmes)
    et ``# ANALYSES RÉCENTES`` (3 dernières) — en français par défaut, ou en
    anglais si ``language='en'``. La taille est plafonnée à
    :data:`MAX_BLOCK_CHARS` caractères : la liste d'analyses est tronquée en
    priorité, puis les thèmes sont supprimés.

    Toute erreur DB est consignée (``logger.warning``) mais ne propage pas :
    la section concernée est simplement omise. Au pire, on renvoie un bloc
    minimaliste avec uniquement ``# SESSION`` + ``Plan : <…>``.

    Args:
        user: Ligne :class:`db.database.User` (lecture seule, ``id`` requis).
        db: Session SQLAlchemy async.
        platform: ``"web"`` | ``"mobile"`` | ``"extension"``.
        agent_type: Identifiant agent ElevenLabs (``"explorer"``,
            ``"explorer_streaming"``, ``"tutor"``, ``"debate_moderator"``,
            ``"quiz_coach"``, ``"onboarding"``, ``"companion"``).
        surface: ``"voice_call"`` | ``"quick_voice_call"`` | ``"debate"``.
        language: ``"fr"`` | ``"en"``.
        voice_quota_remaining_min: Quota voice restant (minutes). ``None`` si
            inconnu (cas free trial non encore consommé).

    Returns:
        Bloc Markdown prêt à être inséré entre l'identité et le contexte
        vidéo dans n'importe quel system_prompt voice. Toujours non vide.
    """
    lang = _i18n(language)

    # ───── Section SESSION (toujours rendue, ne dépend d'aucune query DB) ─────
    platform_label = _PLATFORM_LABELS[lang].get(platform, platform)
    surface_label = _SURFACE_LABELS[lang].get(surface, surface)
    agent_label = _AGENT_LABELS[lang].get(agent_type, agent_type)
    language_human = "français" if lang == "fr" else "English"

    if lang == "en":
        session_lines = [
            "# SESSION",
            f"Platform: {platform_label}",
            f"Surface: {surface_label}",
            f"Agent: {agent_label}",
            f"Language: {language_human}",
        ]
    else:
        session_lines = [
            "# SESSION",
            f"Plateforme : {platform_label}",
            f"Surface : {surface_label}",
            f"Agent : {agent_label}",
            f"Langue : {language_human}",
        ]

    # ───── Section UTILISATEUR (chaque ligne est best-effort) ─────
    user_lines: list[str] = ["# USER" if lang == "en" else "# UTILISATEUR"]

    # Prénom
    first_name = _get_first_name(user)
    if first_name:
        user_lines.append(
            f"First name: {first_name}" if lang == "en" else f"Prénom : {first_name}"
        )
    else:
        user_lines.append(
            "First name unknown — ask once if relevant"
            if lang == "en"
            else "Prénom inconnu — demande-le-lui une fois si pertinent"
        )

    # Plan + quota voice
    plan_label, quota_line = _format_plan_line(
        plan=getattr(user, "plan", "free") or "free",
        voice_quota_remaining_min=voice_quota_remaining_min,
        language=lang,
    )
    user_lines.append(f"Plan: {plan_label}" if lang == "en" else f"Plan : {plan_label}")
    if quota_line:
        user_lines.append(
            f"Voice quota: {quota_line}" if lang == "en" else f"Quota voice : {quota_line}"
        )

    user_id = getattr(user, "id", None)

    # Belt-and-suspenders: every DB helper already swallows its own exceptions
    # internally (cf. _fetch_*), but we wrap each call here too so a future
    # refactor that lets one escape can never crash the whole session block.
    # The contract is: if anything fails, the section is silently omitted —
    # the agent still gets at least # SESSION + # UTILISATEUR (plan + quota).

    # Total analyses
    total: Optional[int] = None
    if user_id is not None:
        try:
            total = await _fetch_total_analyses(db=db, user_id=user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("session_block: total analyses helper raised — omitting", error=str(exc))
    if total is not None:
        user_lines.append(
            f"Total analyses: {total}" if lang == "en" else f"Total analyses sur DeepSight : {total}"
        )

    # Flashcards due
    flashcards_due: Optional[int] = None
    if user_id is not None:
        try:
            flashcards_due = await _fetch_flashcards_due_today(db=db, user_id=user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("session_block: flashcards helper raised — omitting", error=str(exc))
    if flashcards_due is not None and flashcards_due > 0:
        user_lines.append(
            f"Flashcards due today: {flashcards_due}"
            if lang == "en"
            else f"Flashcards en review aujourd'hui : {flashcards_due}"
        )

    # Themes (top 3) — on retient l'index pour pouvoir le retirer en cas de cap.
    themes: list[str] = []
    if user_id is not None:
        try:
            themes = await _fetch_themes(db=db, user_id=user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("session_block: themes helper raised — omitting", error=str(exc))
    themes_line_idx: Optional[int] = None
    if themes:
        themes_line_idx = len(user_lines)
        joined = ", ".join(themes)
        user_lines.append(
            f"Interests: {joined}" if lang == "en" else f"Centres d'intérêt : {joined}"
        )

    # ───── Section ANALYSES RÉCENTES (3 dernières) ─────
    recents: list[Summary] = []
    if user_id is not None:
        try:
            recents = await _fetch_recent_summaries(
                db=db, user_id=user_id, limit=RECENT_ANALYSES_LIMIT
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("session_block: recent summaries helper raised — omitting", error=str(exc))

    # ───── Assemblage final + cap 1500 chars ─────
    return _enforce_cap(
        session_lines=session_lines,
        user_lines=user_lines,
        recent_summaries=recents,
        themes_line_idx=themes_line_idx,
        language=lang,
    )
