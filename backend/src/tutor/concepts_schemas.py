"""Pydantic v2 schemas for the Tutor concepts carrousel API (sprint 2026-05-18).

Endpoints exposes:
- GET  /api/tutor/concepts           → TutorConceptsResponse
- POST /api/tutor/concepts/generate  → GenerateConceptResponse
- POST /api/tutor/concepts/refresh   → {refreshed: true}

Reserved to Expert plan (admin bypass) via `_check_expert_gating` in the router.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


# Status d'un concept dans le carrousel:
# - "ready"     : image_url disponible (doodle généré + uploadé R2)
# - "pending"   : row keyword_images en cours de génération
# - "failed"    : la génération précédente a échoué (rétry possible)
# - "throttled" : cap quotidien atteint (300/jour global), à retenter demain
# - "missing"   : aucune row keyword_images, génération pas encore lancée
ConceptStatus = Literal["ready", "pending", "failed", "throttled", "missing"]


class TutorConceptItem(BaseModel):
    """Un concept du carrousel Tuteur."""

    term: str
    # SHA256(payload) avec style="tutor_doodle" — cf images.keyword_images._term_hash
    term_hash: str
    category: Optional[str] = None
    # None tant que le doodle n'est pas généré (status != "ready")
    image_url: Optional[str] = None
    status: ConceptStatus


class TutorConceptsResponse(BaseModel):
    """Réponse de GET /api/tutor/concepts."""

    concepts: list[TutorConceptItem]
    total: int
    ready_count: int
    pending_count: int


class GenerateConceptRequest(BaseModel):
    """Body de POST /api/tutor/concepts/generate."""

    term: str = Field(min_length=1, max_length=200)
    # Définition courte (optionnelle) injectée dans le prompt de génération.
    definition: str = Field(default="", max_length=600)
    category: Optional[str] = Field(default=None, max_length=50)


class GenerateConceptResponse(BaseModel):
    """Réponse de POST /api/tutor/concepts/generate.

    Cas:
    - status="ready"     : doodle existait déjà, image_url retournée (idempotent)
    - status="pending"   : génération asynchrone enqueue, frontend doit poll GET /concepts
    - status="throttled" : cap quotidien atteint, image_url=None, cap_remaining=0
    """

    term: str
    term_hash: str
    status: ConceptStatus
    image_url: Optional[str] = None
    # Cap quotidien Tutor doodle restant (sur 300/jour global).
    cap_remaining: int
