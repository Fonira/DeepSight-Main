"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧠 FSRS v5 — Free Spaced Repetition Scheduler                                   ║
║  Algorithme pur Python, zéro dépendance DB                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Implémentation fidèle de FSRS v5 (open-spaced-repetition/fsrs4anki).
Calcule la prochaine date de révision selon le rating utilisateur,
exactement comme Anki/FSRS.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import IntEnum
from typing import Optional, Tuple


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 ENUMS
# ═══════════════════════════════════════════════════════════════════════════════


class Rating(IntEnum):
    Again = 1
    Hard = 2
    Good = 3
    Easy = 4


class State(IntEnum):
    New = 0
    Learning = 1
    Review = 2
    Relearning = 3


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 DATACLASSES
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class FSRSCard:
    """État FSRS d'une carte mémoire"""

    stability: float = 0.0  # Stabilité mémoire (jours)
    difficulty: float = 0.0  # Difficulté 0-1
    elapsed_days: int = 0  # Jours depuis dernière review
    scheduled_days: int = 0  # Jours planifiés jusqu'à prochaine review
    reps: int = 0  # Nombre de répétitions
    lapses: int = 0  # Nombre d'oublis
    state: State = State.New  # État courant
    due: Optional[datetime] = None  # Prochaine date de révision
    last_review: Optional[datetime] = None


@dataclass
class FSRSReviewLog:
    """Log d'une review"""

    rating: Rating
    elapsed_days: int
    scheduled_days: int
    state: State
    review_date: datetime = field(default_factory=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ PARAMÈTRES FSRS v5 (optimisés)
# ═══════════════════════════════════════════════════════════════════════════════

# 19 paramètres w0..w18 — valeurs par défaut FSRS v5
DEFAULT_WEIGHTS: list[float] = [
    0.4072,  # w0  — initial stability for Again
    1.1829,  # w1  — initial stability for Hard
    3.1262,  # w2  — initial stability for Good
    15.4722,  # w3  — initial stability for Easy
    7.2102,  # w4  — difficulty weight
    0.5316,  # w5  — difficulty base
    1.0651,  # w6  — difficulty multiplier
    0.0046,  # w7  — difficulty penalty
    1.5418,  # w8  — stability factor (success)
    0.1466,  # w9  — stability revert (success)
    1.0014,  # w10 — stability factor (fail)
    1.9395,  # w11 — stability revert (fail)
    0.1118,  # w12 — stability recovery
    0.3050,  # w13 — stability recovery ease
    2.1730,  # w14 — stability post-lapse
    0.2272,  # w15 — stability post-lapse min
    2.8755,  # w16 — difficulty damping
    0.2975,  # w17 — difficulty delta
    0.5567,  # w18 — short-term stability modifier
]

# Rétention cible (90% par défaut, comme Anki)
DESIRED_RETENTION: float = 0.9

# XP par rating
XP_MAP: dict[Rating, int] = {
    Rating.Again: 3,
    Rating.Hard: 5,
    Rating.Good: 10,
    Rating.Easy: 12,
}

# Intervalle max en jours (environ 3 ans)
MAX_INTERVAL: int = 36500
# Intervalle min pour les cartes en learning
MIN_SHORT_INTERVAL: int = 1


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 FORMULES FSRS v5
# ═══════════════════════════════════════════════════════════════════════════════


def _clamp(value: float, low: float, high: float) -> float:
    """Contraindre une valeur entre low et high."""
    return max(low, min(high, value))


def retrievability(elapsed_days: int, stability: float) -> float:
    """
    Probabilité de rappel R(t, S) = (1 + t / (9 * S))^(-1)
    Formule FSRS v5 power-law decay.
    """
    if stability <= 0:
        return 0.0
    return (1.0 + elapsed_days / (9.0 * stability)) ** (-1.0)


def init_difficulty(rating: Rating, w: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Difficulté initiale D0(G) pour une première review.
    D0 = w5 - exp(w6 * (G - 1)) + 1
    """
    d = w[5] - math.exp(w[6] * (rating.value - 1)) + 1.0
    return _clamp(d, 0.01, 1.0)


def init_stability(rating: Rating, w: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Stabilité initiale S0(G) pour une première review.
    S0(G) = w[G-1]  (w0 pour Again, w1 pour Hard, etc.)
    """
    return max(w[rating.value - 1], 0.01)


def next_difficulty(d: float, rating: Rating, w: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Prochaine difficulté D'(D, G).
    D' = w7 * D0(4) + (1 - w7) * (D + w17 * (G - 3))
    Puis mean reversion : D'' = w7 * D0(4) + (1 - w7) * D'
    """
    d0_easy = init_difficulty(Rating.Easy, w)
    delta = w[17] * (rating.value - 3)
    d_new = d + delta
    # Mean reversion vers D0(4)
    d_new = w[7] * d0_easy + (1.0 - w[7]) * d_new
    return _clamp(d_new, 0.01, 1.0)


def next_stability_success(d: float, s: float, r: float, rating: Rating, w: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Prochaine stabilité après un rappel réussi (Good/Hard/Easy).
    S'_r = S * (e^(w8) * (11 - D) * S^(-w9) * (e^(w10 * (1-R)) - 1) * f(G))
    f(Hard) = w15, f(Good) = 1, f(Easy) = w16
    """
    hard_factor = w[15] if rating == Rating.Hard else 1.0
    easy_factor = w[16] if rating == Rating.Easy else 1.0

    s_new = s * (
        math.exp(w[8]) * (11.0 - d) * (s ** (-w[9])) * (math.exp(w[10] * (1.0 - r)) - 1.0) * hard_factor * easy_factor
    )
    return max(s_new, 0.01)


def next_stability_fail(d: float, s: float, r: float, w: list[float] = DEFAULT_WEIGHTS) -> float:
    """
    Prochaine stabilité après un oubli (Again).
    S'_f = w11 * D^(-w12) * ((S+1)^w13 - 1) * e^(w14 * (1-R))
    """
    s_new = w[11] * (d ** (-w[12])) * ((s + 1.0) ** w[13] - 1.0) * math.exp(w[14] * (1.0 - r))
    return _clamp(s_new, 0.01, s)  # Ne peut pas dépasser l'ancienne stabilité


def next_interval(stability: float, desired_retention: float = DESIRED_RETENTION) -> int:
    """
    Prochain intervalle en jours.
    I = S * 9 * (1/R - 1)
    """
    if stability <= 0 or desired_retention <= 0 or desired_retention >= 1:
        return MIN_SHORT_INTERVAL
    interval = stability * 9.0 * (1.0 / desired_retention - 1.0)
    return _clamp(round(interval), MIN_SHORT_INTERVAL, MAX_INTERVAL)


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 SCHEDULER PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════


def schedule_card(
    card: FSRSCard,
    rating: Rating,
    now: Optional[datetime] = None,
    w: list[float] = DEFAULT_WEIGHTS,
    desired_retention: float = DESIRED_RETENTION,
) -> Tuple[FSRSCard, FSRSReviewLog]:
    """
    Planifie la prochaine review d'une carte selon le rating.

    Args:
        card: État FSRS actuel de la carte
        rating: Rating donné par l'utilisateur (Again/Hard/Good/Easy)
        now: Date/heure courante (défaut: utcnow)
        w: Poids FSRS (défaut: v5 optimisés)
        desired_retention: Rétention cible (défaut: 0.9)

    Returns:
        Tuple (new_card, review_log) avec la carte mise à jour et le log
    """
    if now is None:
        now = datetime.utcnow()

    # Calculer les jours écoulés depuis la dernière review
    if card.last_review is not None:
        elapsed = max((now - card.last_review).days, 0)
    else:
        elapsed = 0

    # Créer le log AVANT modification
    review_log = FSRSReviewLog(
        rating=rating,
        elapsed_days=elapsed,
        scheduled_days=card.scheduled_days,
        state=card.state,
        review_date=now,
    )

    # Nouvelle carte basée sur l'actuelle
    new_card = FSRSCard(
        stability=card.stability,
        difficulty=card.difficulty,
        elapsed_days=elapsed,
        scheduled_days=card.scheduled_days,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        due=card.due,
        last_review=now,
    )

    # ─── CAS 1 : Carte nouvelle (premier contact) ───
    if card.state == State.New:
        new_card.difficulty = init_difficulty(rating, w)
        new_card.stability = init_stability(rating, w)
        new_card.reps = 1

        if rating == Rating.Again:
            new_card.state = State.Learning
            new_card.lapses = 1
            # Revoir dans 1 minute (on arrondit à 1 jour pour FSRS simplifié)
            new_card.scheduled_days = MIN_SHORT_INTERVAL
        elif rating == Rating.Hard:
            new_card.state = State.Learning
            new_card.scheduled_days = MIN_SHORT_INTERVAL
        elif rating == Rating.Good:
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = interval
        else:  # Easy
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = interval

    # ─── CAS 2 : Learning / Relearning ───
    elif card.state in (State.Learning, State.Relearning):
        new_card.difficulty = next_difficulty(card.difficulty, rating, w)
        new_card.reps = card.reps + 1

        if rating == Rating.Again:
            new_card.stability = init_stability(Rating.Again, w)
            new_card.state = State.Learning if card.state == State.Learning else State.Relearning
            new_card.lapses = card.lapses + 1
            new_card.scheduled_days = MIN_SHORT_INTERVAL
        elif rating == Rating.Hard:
            new_card.stability = init_stability(Rating.Hard, w)
            new_card.state = card.state  # Reste en learning/relearning
            new_card.scheduled_days = MIN_SHORT_INTERVAL
        elif rating == Rating.Good:
            r = retrievability(elapsed, card.stability) if card.stability > 0 else 0.0
            new_card.stability = next_stability_success(
                new_card.difficulty,
                card.stability if card.stability > 0 else init_stability(Rating.Good, w),
                r,
                rating,
                w,
            )
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = interval
        else:  # Easy
            r = retrievability(elapsed, card.stability) if card.stability > 0 else 0.0
            new_card.stability = next_stability_success(
                new_card.difficulty,
                card.stability if card.stability > 0 else init_stability(Rating.Easy, w),
                r,
                rating,
                w,
            )
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = interval

    # ─── CAS 3 : Review (carte mature) ───
    elif card.state == State.Review:
        r = retrievability(elapsed, card.stability)
        new_card.difficulty = next_difficulty(card.difficulty, rating, w)
        new_card.reps = card.reps + 1

        if rating == Rating.Again:
            new_card.stability = next_stability_fail(card.difficulty, card.stability, r, w)
            new_card.state = State.Relearning
            new_card.lapses = card.lapses + 1
            new_card.scheduled_days = MIN_SHORT_INTERVAL
        elif rating == Rating.Hard:
            new_card.stability = next_stability_success(card.difficulty, card.stability, r, rating, w)
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = max(interval, elapsed + 1)
        elif rating == Rating.Good:
            new_card.stability = next_stability_success(card.difficulty, card.stability, r, rating, w)
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = max(interval, elapsed + 1)
        else:  # Easy
            new_card.stability = next_stability_success(card.difficulty, card.stability, r, rating, w)
            new_card.state = State.Review
            interval = next_interval(new_card.stability, desired_retention)
            new_card.scheduled_days = max(interval, elapsed + 1)

    # Calculer la due date
    new_card.due = now + timedelta(days=new_card.scheduled_days)

    return new_card, review_log


# ═══════════════════════════════════════════════════════════════════════════════
# 🏆 XP & LEVEL
# ═══════════════════════════════════════════════════════════════════════════════


def calculate_xp(rating: Rating) -> int:
    """XP gagné pour un rating donné."""
    return XP_MAP.get(rating, 0)


def xp_for_level(level: int) -> int:
    """
    XP total requis pour atteindre un niveau donné.
    Formule : 100 * level^1.5 (progression non-linéaire)
    Level 1 = 0 XP, Level 2 = 100 XP, Level 5 = ~1118 XP, Level 10 = ~3162 XP
    """
    if level <= 1:
        return 0
    return round(100 * (level**1.5))


def level_from_xp(total_xp: int) -> int:
    """Calcule le niveau actuel à partir de l'XP total."""
    level = 1
    while xp_for_level(level + 1) <= total_xp:
        level += 1
    return level


def xp_progress_in_level(total_xp: int) -> Tuple[int, int]:
    """
    Retourne (xp_dans_niveau_courant, xp_requis_pour_prochain_niveau).
    Utile pour la barre de progression.
    """
    level = level_from_xp(total_xp)
    current_threshold = xp_for_level(level)
    next_threshold = xp_for_level(level + 1)
    return total_xp - current_threshold, next_threshold - current_threshold


# ═══════════════════════════════════════════════════════════════════════════════
# 🔥 STREAK
# ═══════════════════════════════════════════════════════════════════════════════


def check_streak(
    last_study_date: Optional[datetime],
    current_streak: int,
    now: Optional[datetime] = None,
) -> Tuple[int, bool]:
    """
    Vérifie et met à jour le streak.

    Returns:
        Tuple (new_streak, was_updated)
        - Si l'utilisateur a étudié aujourd'hui → streak inchangé, was_updated=False
        - Si hier → streak + 1, was_updated=True
        - Si plus ancien → streak reset à 1, was_updated=True
    """
    if now is None:
        now = datetime.utcnow()

    today = now.date()

    if last_study_date is None:
        return 1, True

    last_date = last_study_date.date() if isinstance(last_study_date, datetime) else last_study_date
    delta = (today - last_date).days

    if delta == 0:
        # Déjà étudié aujourd'hui
        return current_streak, False
    elif delta == 1:
        # Jour consécutif
        return current_streak + 1, True
    else:
        # Streak cassé
        return 1, True
