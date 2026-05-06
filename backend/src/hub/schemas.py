"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📘 HUB SCHEMAS — Pydantic v2 schemas for Hub Miro Workspace endpoints             ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Spec : docs/superpowers/specs/2026-05-05-hub-miro-workspace-mvp.md
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ═══════════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════════

MIN_SUMMARIES_PER_WORKSPACE = 2
MAX_SUMMARIES_PER_WORKSPACE = 20
MAX_WORKSPACE_NAME_LENGTH = 200
MAX_ACTIVE_WORKSPACES_PER_USER = 5  # cap mensuel (rolling 30 jours)
ACTIVE_WORKSPACE_WINDOW_DAYS = 30


# ═══════════════════════════════════════════════════════════════════════════════
# Request schemas
# ═══════════════════════════════════════════════════════════════════════════════


class HubWorkspaceCreate(BaseModel):
    """Body de POST /api/hub/workspaces."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=MAX_WORKSPACE_NAME_LENGTH,
        description="Nom donné par l'utilisateur au workspace",
    )
    summary_ids: list[int] = Field(
        ...,
        min_length=MIN_SUMMARIES_PER_WORKSPACE,
        max_length=MAX_SUMMARIES_PER_WORKSPACE,
        description=(
            f"IDs des analyses Summary à inclure "
            f"(min {MIN_SUMMARIES_PER_WORKSPACE}, max {MAX_SUMMARIES_PER_WORKSPACE})"
        ),
    )

    @field_validator("summary_ids")
    @classmethod
    def _ensure_unique_positive_ids(cls, v: list[int]) -> list[int]:
        if any(sid <= 0 for sid in v):
            raise ValueError("summary_ids must be positive integers")
        # Dédupliquer en conservant l'ordre
        seen: set[int] = set()
        deduped: list[int] = []
        for sid in v:
            if sid in seen:
                continue
            seen.add(sid)
            deduped.append(sid)
        if len(deduped) < MIN_SUMMARIES_PER_WORKSPACE:
            raise ValueError(
                f"summary_ids must contain at least {MIN_SUMMARIES_PER_WORKSPACE} unique IDs"
            )
        return deduped


# ═══════════════════════════════════════════════════════════════════════════════
# Response schemas
# ═══════════════════════════════════════════════════════════════════════════════


class CanvasPerspective(BaseModel):
    """Une perspective dans une thématique du canvas natif (Hub Workspace).

    `key_quote` (v2, 2026-05-06) : citation littérale optionnelle extraite du
    contenu de l'analyse pour illustrer puissamment le propos.
    """

    summary_id: int
    excerpt: str
    key_quote: Optional[str] = None


class CanvasTheme(BaseModel):
    """Une thématique du canvas natif, regroupant N perspectives par analyse.

    `description` (v2, 2026-05-06) : 1-2 phrases optionnelles posant l'enjeu du
    thème avant de lister les perspectives par analyse.
    """

    theme: str
    description: Optional[str] = None
    perspectives: list[CanvasPerspective]


class WorkspaceCanvasData(BaseModel):
    """Canvas natif Hub Workspace (pivot 2026-05-06, v2 enrichi).

    Forme stockée dans `hub_workspaces.canvas_data` (JSON nullable).
    NULL = workspace pré-pivot ou Mistral fail → frontend fallback MiroBoardEmbed.

    v2 (2026-05-06) : ajout `synthesis` (overview transversal optionnel).
    """

    shared_concepts: list[str]
    themes: list[CanvasTheme]
    synthesis: Optional[str] = None


class HubWorkspaceResponse(BaseModel):
    """Représentation d'un workspace renvoyée par l'API.

    `canvas_data` (pivot 2026-05-06) est populé en background après création
    du board Miro pour les nouveaux workspaces. NULL pour workspaces
    pré-pivot → frontend bascule sur MiroBoardEmbed.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    summary_ids: list[int]
    miro_board_id: Optional[str] = None
    miro_board_url: Optional[str] = None
    status: str  # pending | creating | ready | failed
    error_message: Optional[str] = None
    canvas_data: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class HubWorkspaceListResponse(BaseModel):
    """Réponse paginée pour GET /api/hub/workspaces."""

    items: list[HubWorkspaceResponse]
    total: int
