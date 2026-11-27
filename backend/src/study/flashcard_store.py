"""Flashcards persistées : source de vérité pour l'étude et la révision espacée.

Avant : `POST /api/study/flashcards/{id}` et `GET /api/study/review/due/{id}`
lisaient chacun le cache « studio » (Redis 2 j, L2 Postgres absent) puis
régénéraient via Mistral en cas d'absence. Résultat : deux générations en
parallèle à l'ouverture de /study, et après expiration du cache un nouveau jeu
de cartes, alors que l'historique FSRS est indexé par position (`card_index`)
→ la progression se retrouvait attachée à d'autres questions.

Désormais les deux endpoints lisent d'abord la table `flashcards`, et la
génération est sérialisée par résumé : une seule génération, un seul jeu de
cartes stable.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Flashcard

_generation_locks: dict[int, asyncio.Lock] = {}


def flashcard_generation_lock(summary_id: int) -> asyncio.Lock:
    """Verrou par résumé (process-local) autour de la lecture/génération."""
    lock = _generation_locks.get(summary_id)
    if lock is None:
        lock = asyncio.Lock()
        _generation_locks[summary_id] = lock
    return lock


async def load_persisted_flashcards(session: AsyncSession, summary_id: int) -> list[dict[str, Any]]:
    """Cartes déjà enregistrées pour ce résumé, dans l'ordre (vide si aucune)."""
    result = await session.execute(
        select(Flashcard).where(Flashcard.summary_id == summary_id).order_by(Flashcard.position)
    )
    return [
        {"front": row.front, "back": row.back, "category": row.category or "General"} for row in result.scalars().all()
    ]


def _field(card: Any, name: str) -> Any:
    if isinstance(card, dict):
        return card.get(name)
    return getattr(card, name, None)


async def persist_flashcards(
    session: AsyncSession,
    summary_id: int,
    user_id: int,
    cards: Iterable[Any],
) -> None:
    """Remplace les cartes du résumé (delete-then-insert) et commit.

    Accepte des dicts ou des objets (FlashcardItem) exposant front/back/category.
    """
    await session.execute(delete(Flashcard).where(Flashcard.summary_id == summary_id))
    for position, card in enumerate(cards):
        session.add(
            Flashcard(
                summary_id=summary_id,
                user_id=user_id,
                position=position,
                front=_field(card, "front") or "",
                back=_field(card, "back") or "",
                category=_field(card, "category"),
            )
        )
    await session.commit()
