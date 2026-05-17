"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎲 COMMENTS SAMPLER — Top + Random échantillonnage déterministe                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Stratégie : Top N par like_count + Random M dans le reste.                        ║
║  Seed déterministe via hash(video_id) → mêmes 2 appels = même échantillon.        ║
║  → Cache reproductible (l'analyse Mistral est invariant entre runs).              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import hashlib
import random as _random
from typing import Iterable

from .schemas import Comment


def sample_top_and_random(
    raw: list[Comment],
    *,
    top_n: int = 100,
    random_n: int = 50,
    video_id: str | None = None,
) -> list[Comment]:
    """Sélectionne Top N par like_count + Random M déterministes parmi le reste.

    Args:
        raw: Liste brute de commentaires scrappés (déjà parsés).
        top_n: Nombre de commentaires top likes (défaut 100).
        random_n: Nombre de commentaires aléatoires en bonus (défaut 50).
        video_id: Identifiant vidéo pour seeder l'aléa (déterminisme cross-run).
                  Si None, lit raw[0].video_id si dispo, sinon utilise un fallback.

    Returns:
        Liste de commentaires (taille <= top_n + random_n), Top en premier.

    Cas limites :
      - Si len(raw) <= top_n + random_n → on retourne tout (pas de sampling utile).
      - Si raw vide → liste vide.
    """
    if not raw:
        return []

    total = top_n + random_n
    if len(raw) <= total:
        # Trop peu de commentaires pour échantillonner : on retourne tout.
        return list(raw)

    sorted_by_likes = sorted(raw, key=lambda c: c.like_count, reverse=True)
    top = sorted_by_likes[:top_n]
    remainder = sorted_by_likes[top_n:]

    # Détermine le seed.
    seed_source = video_id or (raw[0].video_id if raw and raw[0].video_id else "default")
    seed = int(hashlib.md5(seed_source.encode("utf-8")).hexdigest(), 16) & 0xFFFFFFFF

    rng = _random.Random(seed)
    sample = rng.sample(remainder, min(random_n, len(remainder)))

    return list(top) + list(sample)


def dedupe_comments(raw: Iterable[Comment]) -> list[Comment]:
    """Déduplique les commentaires sur la base de comment_id.

    Utile quand un scraper retourne des doublons à cause de la pagination.
    Conserve l'ordre d'apparition (premier vu = gagne).
    """
    seen: set[str] = set()
    out: list[Comment] = []
    for c in raw:
        if c.comment_id in seen:
            continue
        seen.add(c.comment_id)
        out.append(c)
    return out


__all__ = ["sample_top_and_random", "dedupe_comments"]
