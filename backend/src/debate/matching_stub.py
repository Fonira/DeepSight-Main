"""STUB matching pour Sub-agent B (PR adaptive 1-N + Magistral).

⚠️  TEMPORAIRE — À SUPPRIMER après merge de la PR Sub-agent A
   (`feat/debate-matching-multicriteria`) qui livre le vrai
   `backend/src/debate/matching.py`.

Ce stub permet à la PR Sub-agent B de compiler et de passer ses tests
unitaires sans dépendre du merge de Sub-agent A. En production, ces
fonctions ne sont JAMAIS appelées tant que Sub-agent A n'est pas mergé,
car le router.py route conditionnellement sur l'import disponible.

Voir docstring `_run_add_perspective_pipeline` dans router.py pour le
flag `_HAS_REAL_MATCHING` qui guide le routing.
"""

from dataclasses import dataclass
from typing import Literal, Optional, Set

from sqlalchemy.ext.asyncio import AsyncSession


RelationType = Literal["opposite", "complement", "nuance"]


@dataclass
class PerspectiveCandidate:
    """Candidat retourné par _search_perspective_video.

    Schema mirror de celui de Sub-agent A (cf. spec §3.1).
    """

    video_id: str
    platform: str
    title: str
    channel: str
    thumbnail: str
    duration_seconds: int = 0
    published_at: Optional[str] = None
    audience_level: Literal["vulgarisation", "expert", "unknown"] = "unknown"
    channel_quality_score: float = 0.5
    raw_query: str = ""
    score: float = 0.5


async def _search_perspective_video(
    topic: str,
    thesis_a: str,
    relation_type: RelationType,
    video_a_id: str,
    video_a_title: str,
    video_a_channel: str,
    video_a_duration: int,
    lang: str,
    excluded_video_ids: Set[str],
    user_plan: str,
    db: AsyncSession,
) -> Optional[PerspectiveCandidate]:
    """STUB — Lève NotImplementedError tant que Sub-agent A n'est pas mergé.

    Une fois mergé, l'import passera à `from debate.matching import ...` et ce
    stub ne sera plus jamais appelé (puis supprimé).
    """
    raise NotImplementedError(
        "Stub matching — depends on Sub-agent A PR feat/debate-matching-multicriteria. "
        "Cannot search perspective video until matching.py is merged."
    )
