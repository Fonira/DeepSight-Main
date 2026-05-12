"""Logique de qualification — application des deltas et règles métier.

Le LLM propose un `score_delta`, on l'applique avec clamping + détection
d'overflow malicieux. Détermine aussi la transition lead_status.
"""

from __future__ import annotations

from typing import Optional

from ..schemas import LLMTurnResult


SCORE_MIN = 0
SCORE_MAX = 100
DELTA_MIN = -25  # tolère 1 unité de plus que la consigne LLM
DELTA_MAX = 30


def apply_score_delta(current: int, delta: int) -> int:
    """Clamp le delta puis le nouveau score dans [0, 100]."""
    clamped_delta = max(DELTA_MIN, min(DELTA_MAX, delta))
    return max(SCORE_MIN, min(SCORE_MAX, current + clamped_delta))


def derive_lead_status(
    current_status: str,
    new_score: int,
    warm_threshold: int,
    *,
    ready_for_handoff: bool,
    cold_close: bool,
) -> str:
    """Détermine la transition de lead_status selon le tour.

    Règles :
    - `cold_close=true` ou status déjà `cold`/`blocked` → conserve/transitionne
      vers `cold`.
    - `ready_for_handoff` ou `new_score >= warm_threshold` → `warm` (sauf si déjà
      `converted`).
    - Si le score augmente sans atteindre le seuil → `qualifying`.
    - Si le bot a montré la démo (state `demo`+) → `demo_shown` minimum.
    """
    if current_status in ("converted", "blocked"):
        return current_status

    if cold_close:
        return "cold"

    if ready_for_handoff or new_score >= warm_threshold:
        return "warm"

    if new_score >= warm_threshold // 2:
        return "qualifying"

    if current_status == "new" and new_score > 0:
        return "qualifying"

    return current_status


def merge_extracted_fields(
    existing_business_type: Optional[str],
    existing_business_name: Optional[str],
    existing_audience_size: Optional[str],
    existing_current_pain: Optional[str],
    existing_signals: Optional[list[str]],
    turn: LLMTurnResult,
) -> dict[str, object]:
    """Merge les champs extraits du tour avec ceux déjà connus.

    Stratégie : nouvelle valeur écrase l'ancienne SEULEMENT si non vide.
    Signaux : union ordonnée préservée, dédupliquée, capée à 30.
    """
    extracted = turn.extracted

    def pick(new: Optional[str], old: Optional[str]) -> Optional[str]:
        if new and new.strip():
            return new.strip()
        return old

    signals = list(existing_signals or [])
    seen = set(signals)
    for signal in extracted.interest_signals or []:
        signal_clean = signal.strip().lower()
        if signal_clean and signal_clean not in seen:
            signals.append(signal_clean)
            seen.add(signal_clean)
    signals = signals[-30:]

    return {
        "business_type": pick(extracted.business_type, existing_business_type),
        "business_name": pick(extracted.business_name, existing_business_name),
        "audience_size": pick(extracted.audience_size, existing_audience_size),
        "current_pain": pick(extracted.current_pain, existing_current_pain),
        "interest_signals": signals,
    }


def build_handoff_summary(
    *,
    platform: str,
    platform_username: Optional[str],
    display_name: Optional[str],
    business_type: Optional[str],
    business_name: Optional[str],
    audience_size: Optional[str],
    current_pain: Optional[str],
    interest_signals: Optional[list[str]],
    qualification_score: int,
    last_user_message: Optional[str],
) -> str:
    """Construit le message texte envoyé à Maxime via Bobby."""
    lines = [
        "🔥 *Lead chaud DeepSight*",
        "",
        f"• Plateforme : {platform}",
    ]
    who = platform_username or display_name or "(anonyme)"
    lines.append(f"• Contact : {who}")
    if business_name:
        lines.append(f"• Mini-app : {business_name}")
    if business_type:
        lines.append(f"• Type : {business_type}")
    if audience_size:
        lines.append(f"• Audience : {audience_size}")
    if current_pain:
        lines.append(f"• Pain : {current_pain}")
    if interest_signals:
        signals_str = ", ".join(interest_signals[:6])
        lines.append(f"• Signaux : {signals_str}")
    lines.append(f"• Score : {qualification_score}/100")
    if last_user_message:
        truncated = last_user_message[:280]
        if len(last_user_message) > 280:
            truncated += "…"
        lines.append("")
        lines.append(f"💬 Dernier message : « {truncated} »")
    return "\n".join(lines)
