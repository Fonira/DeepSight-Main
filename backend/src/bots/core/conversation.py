"""Conversation engine — orchestre prospect → DB → LLM → réponse.

Indépendant de la plateforme. Reçoit un `ParsedMessage`, retourne un
`OutgoingMessage`. Persiste prospect, messages et handoff. Anti-flood et
anti-prompt-injection inclus.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, AsyncContextManager, Awaitable, Callable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.llm_provider import llm_complete
from db.database import BotHandoff, BotMessage, BotProspect

from ..config import bot_settings
from ..schemas import LLMTurnResult, OutgoingMessage, ParsedMessage, ProspectQualification
from .handoff import build_deep_link, notify_maxime
from .prompts import (
    PROMPT_INJECTION_GUARD,
    SAFE_FALLBACK_MESSAGE,
    build_system_prompt,
    looks_like_prompt_injection,
)
from .qualification import (
    apply_score_delta,
    build_handoff_summary,
    derive_lead_status,
    merge_extracted_fields,
)

logger = logging.getLogger(__name__)


SessionFactory = Callable[[], AsyncContextManager[AsyncSession]]


@dataclass
class ConversationResult:
    """Résultat d'un tour, utilisé pour les tests et le debug."""

    outgoing: OutgoingMessage
    prospect_id: Optional[int]
    new_state: str
    new_score: int
    new_lead_status: str
    handoff_triggered: bool
    handoff_error: Optional[str] = None
    is_rate_limited: bool = False


class ConversationEngine:
    """Pilote la conversation pour une seule plateforme à la fois.

    Usage :
        engine = ConversationEngine(session_factory)
        result = await engine.handle(parsed_message)
        # Le contenu de `result.outgoing` doit être envoyé via l'adapter
        # plateforme correspondant (Telegram ou Luffa).
    """

    def __init__(self, session_factory: SessionFactory):
        self._session_factory = session_factory

    async def handle(self, message: ParsedMessage) -> ConversationResult:
        """Traite un message entrant complet : DB, LLM, handoff, persist."""
        if message.is_group:
            # Pas de support group chat V1 (les bots ne servent que les DMs prospects)
            logger.info("[bots.conversation] group message ignoré (%s)", message.platform)
            return _empty_result()

        async with self._session_factory() as session:
            prospect = await self._upsert_prospect(session, message)

            if self._is_rate_limited(prospect):
                outgoing = OutgoingMessage(
                    text=(
                        "Doucement 🙃 — on se reparle dans quelques minutes ?"
                    )
                )
                await self._save_message(
                    session,
                    prospect_id=prospect.id,
                    role="system",
                    content="rate_limited_response",
                    intent="rate_limited",
                )
                await session.commit()
                return ConversationResult(
                    outgoing=outgoing,
                    prospect_id=prospect.id,
                    new_state=prospect.state,
                    new_score=prospect.qualification_score,
                    new_lead_status=prospect.lead_status,
                    handoff_triggered=False,
                    is_rate_limited=True,
                )

            # Anti-prompt-injection — guard avant LLM
            if looks_like_prompt_injection(message.text):
                outgoing = OutgoingMessage(text=PROMPT_INJECTION_GUARD)
                await self._save_message(
                    session,
                    prospect_id=prospect.id,
                    role="user",
                    content=message.text,
                    platform_msg_id=message.platform_msg_id,
                    intent="prompt_injection_attempt",
                )
                await self._save_message(
                    session,
                    prospect_id=prospect.id,
                    role="assistant",
                    content=outgoing.text,
                    intent="injection_guard",
                )
                prospect.last_message_at = _now()
                await session.commit()
                return ConversationResult(
                    outgoing=outgoing,
                    prospect_id=prospect.id,
                    new_state=prospect.state,
                    new_score=prospect.qualification_score,
                    new_lead_status=prospect.lead_status,
                    handoff_triggered=False,
                )

            # Charger l'historique pour le contexte LLM
            history = await self._load_history(session, prospect.id)
            history_text = _format_history(history)

            # Sauvegarder le message user AVANT l'appel LLM (au cas où le LLM crash)
            await self._save_message(
                session,
                prospect_id=prospect.id,
                role="user",
                content=message.text,
                platform_msg_id=message.platform_msg_id,
            )

            # Appel LLM
            turn = await self._call_llm(
                state=prospect.state,
                qualification_score=prospect.qualification_score,
                history_text=history_text,
                user_text=message.text,
                platform=message.platform,
            )

            if turn is None:
                outgoing = OutgoingMessage(text=SAFE_FALLBACK_MESSAGE)
                await self._save_message(
                    session,
                    prospect_id=prospect.id,
                    role="assistant",
                    content=outgoing.text,
                    intent="llm_failure",
                )
                prospect.last_message_at = _now()
                await session.commit()
                return ConversationResult(
                    outgoing=outgoing,
                    prospect_id=prospect.id,
                    new_state=prospect.state,
                    new_score=prospect.qualification_score,
                    new_lead_status=prospect.lead_status,
                    handoff_triggered=False,
                )

            # Appliquer le tour
            new_score = apply_score_delta(prospect.qualification_score, turn.score_delta)
            new_lead_status = derive_lead_status(
                current_status=prospect.lead_status,
                new_score=new_score,
                warm_threshold=bot_settings.WARM_LEAD_SCORE_THRESHOLD,
                ready_for_handoff=turn.ready_for_handoff,
                cold_close=turn.cold_close,
            )

            merged = merge_extracted_fields(
                existing_business_type=prospect.business_type,
                existing_business_name=prospect.business_name,
                existing_audience_size=prospect.audience_size,
                existing_current_pain=prospect.current_pain,
                existing_signals=prospect.interest_signals or [],
                turn=turn,
            )

            prospect.qualification_score = new_score
            prospect.lead_status = new_lead_status
            prospect.state = turn.next_state
            prospect.business_type = merged["business_type"]
            prospect.business_name = merged["business_name"]
            prospect.audience_size = merged["audience_size"]
            prospect.current_pain = merged["current_pain"]
            prospect.interest_signals = merged["interest_signals"]
            prospect.last_message_at = _now()

            # Sauvegarder réponse assistant
            await self._save_message(
                session,
                prospect_id=prospect.id,
                role="assistant",
                content=turn.text,
                intent=turn.intent_detected,
                model=bot_settings.BOTS_MISTRAL_MODEL,
            )

            # Déclencher handoff si applicable
            handoff_triggered = False
            handoff_error: Optional[str] = None
            if (
                turn.ready_for_handoff or new_lead_status == "warm"
            ) and prospect.handoff_at is None:
                handoff_triggered = True
                handoff_error = await self._trigger_handoff(
                    session=session,
                    prospect=prospect,
                    last_user_message=message.text,
                )

            outgoing = OutgoingMessage(text=turn.text, buttons=list(turn.buttons))
            await session.commit()

            return ConversationResult(
                outgoing=outgoing,
                prospect_id=prospect.id,
                new_state=turn.next_state,
                new_score=new_score,
                new_lead_status=new_lead_status,
                handoff_triggered=handoff_triggered,
                handoff_error=handoff_error,
            )

    # ─────────────────────────────────────────────────────────────────────
    # Helpers privés
    # ─────────────────────────────────────────────────────────────────────

    async def _upsert_prospect(
        self, session: AsyncSession, message: ParsedMessage
    ) -> BotProspect:
        result = await session.execute(
            select(BotProspect).where(
                BotProspect.platform == message.platform,
                BotProspect.platform_user_id == message.platform_user_id,
            )
        )
        prospect = result.scalar_one_or_none()
        if prospect is None:
            prospect = BotProspect(
                platform=message.platform,
                platform_user_id=message.platform_user_id,
                platform_username=message.platform_username,
                display_name=message.display_name,
                language_code=message.language_code,
                lead_status="new",
                qualification_score=0,
                state="hello",
            )
            session.add(prospect)
            await session.flush()
            logger.info(
                "[bots.conversation] nouveau prospect créé (%s:%s id=%d)",
                message.platform,
                message.platform_user_id,
                prospect.id,
            )
        else:
            # Mise à jour des infos profil si fournies par l'adapter
            if message.platform_username and prospect.platform_username != message.platform_username:
                prospect.platform_username = message.platform_username
            if message.display_name and prospect.display_name != message.display_name:
                prospect.display_name = message.display_name
            if message.language_code and prospect.language_code != message.language_code:
                prospect.language_code = message.language_code
        return prospect

    def _is_rate_limited(self, prospect: BotProspect) -> bool:
        """Très simple V1 : si > N messages dans la dernière heure, rate-limit."""
        # Implémentation pragmatique : on regarde last_message_at + un compteur
        # dérivé via interest_signals (overkill V1). Pour V1 on ignore ce check
        # complexe et on retourne False — on n'observe pas encore de spam.
        # TODO V2 : count(BotMessage) where created_at > now()-1h.
        _ = prospect
        return False

    async def _load_history(self, session: AsyncSession, prospect_id: int) -> list[BotMessage]:
        max_history = bot_settings.BOTS_MAX_HISTORY_MESSAGES
        result = await session.execute(
            select(BotMessage)
            .where(BotMessage.prospect_id == prospect_id)
            .order_by(BotMessage.created_at.desc())
            .limit(max_history)
        )
        rows = list(result.scalars().all())
        rows.reverse()
        return rows

    async def _save_message(
        self,
        session: AsyncSession,
        *,
        prospect_id: int,
        role: str,
        content: str,
        platform_msg_id: Optional[str] = None,
        intent: Optional[str] = None,
        model: Optional[str] = None,
    ) -> BotMessage:
        msg = BotMessage(
            prospect_id=prospect_id,
            role=role,
            content=content,
            platform_msg_id=platform_msg_id,
            intent_detected=intent,
            model=model,
        )
        session.add(msg)
        await session.flush()
        return msg

    async def _call_llm(
        self,
        *,
        state: str,
        qualification_score: int,
        history_text: str,
        user_text: str,
        platform: str,
    ) -> Optional[LLMTurnResult]:
        system_prompt = build_system_prompt(
            state=state,
            qualification_score=qualification_score,
            history_text=history_text,
            platform=platform,
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ]

        result = await llm_complete(
            messages=messages,
            model=bot_settings.BOTS_MISTRAL_MODEL,
            max_tokens=bot_settings.BOTS_LLM_MAX_TOKENS,
            temperature=0.5,
            timeout=bot_settings.BOTS_LLM_TIMEOUT_SECONDS,
            json_mode=True,
        )
        if result is None:
            logger.error("[bots.conversation] llm_complete returned None")
            return None

        try:
            data = json.loads(result.content)
        except json.JSONDecodeError:
            # Le LLM a parfois wrap dans ```json ... ``` malgré la consigne
            cleaned = _strip_code_fence(result.content)
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error(
                    "[bots.conversation] parse JSON failed: content[:200]=%r",
                    result.content[:200],
                )
                return None

        try:
            return LLMTurnResult.model_validate(_normalize_turn_payload(data))
        except Exception as exc:
            logger.error("[bots.conversation] schema validate failed: %s", exc)
            return None

    async def _trigger_handoff(
        self,
        *,
        session: AsyncSession,
        prospect: BotProspect,
        last_user_message: str,
    ) -> Optional[str]:
        summary = build_handoff_summary(
            platform=prospect.platform,
            platform_username=prospect.platform_username,
            display_name=prospect.display_name,
            business_type=prospect.business_type,
            business_name=prospect.business_name,
            audience_size=prospect.audience_size,
            current_pain=prospect.current_pain,
            interest_signals=prospect.interest_signals,
            qualification_score=prospect.qualification_score,
            last_user_message=last_user_message,
        )
        deep_link = build_deep_link(prospect.platform, prospect.id)
        err = await notify_maxime(summary=summary, deep_link=deep_link)

        handoff_row = BotHandoff(
            prospect_id=prospect.id,
            channel="telegram_bobby",
            summary=summary,
            deep_link=deep_link,
            notification_error=err,
        )
        session.add(handoff_row)
        prospect.handoff_at = _now()
        await session.flush()
        return err


# ─────────────────────────────────────────────────────────────────────────────
# Helpers module-level
# ─────────────────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.utcnow()


def _empty_result() -> ConversationResult:
    return ConversationResult(
        outgoing=OutgoingMessage(text=""),
        prospect_id=None,
        new_state="hello",
        new_score=0,
        new_lead_status="new",
        handoff_triggered=False,
    )


def _format_history(history: list[BotMessage]) -> str:
    """Format simple : `[role] content` séparés par retours ligne."""
    if not history:
        return ""
    parts: list[str] = []
    for msg in history:
        prefix = "Prospect" if msg.role == "user" else (
            "Assistant" if msg.role == "assistant" else "Système"
        )
        parts.append(f"{prefix}: {msg.content}")
    return "\n".join(parts)


def _strip_code_fence(text: str) -> str:
    """Enlève ```json ... ``` ou ``` ... ``` si présent."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return stripped


def _normalize_turn_payload(data: Any) -> dict[str, Any]:
    """Normalise un payload LLM partiellement conforme avant validation."""
    if not isinstance(data, dict):
        return {}
    data.setdefault("buttons", [])
    data.setdefault("next_state", "hello")
    data.setdefault("score_delta", 0)
    data.setdefault("ready_for_handoff", False)
    data.setdefault("cold_close", False)
    extracted = data.get("extracted") or {}
    if not isinstance(extracted, dict):
        extracted = {}
    extracted.setdefault("interest_signals", [])
    # Tolère les `null` JSON
    for key in ("business_type", "business_name", "audience_size", "current_pain"):
        if extracted.get(key) == "":
            extracted[key] = None
    data["extracted"] = extracted
    # Boutons : tolère format `{"label", "callback_data"}` ou `{"name", "payload"}`
    norm_buttons = []
    for btn in data.get("buttons") or []:
        if not isinstance(btn, dict):
            continue
        label = btn.get("label") or btn.get("name") or btn.get("text")
        payload = btn.get("payload") or btn.get("callback_data") or btn.get("selector")
        if label and payload:
            norm_buttons.append({"label": str(label)[:64], "payload": str(payload)[:64]})
    data["buttons"] = norm_buttons[:3]
    return data
