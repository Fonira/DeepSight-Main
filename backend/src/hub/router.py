"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧩 HUB ROUTER — Endpoints REST Hub Miro Workspace                                 ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Préfixe : /api/hub                                                                ║
║  Spec    : docs/superpowers/specs/2026-05-05-hub-miro-workspace-mvp.md             ║
║                                                                                    ║
║  Endpoints :                                                                       ║
║    POST   /workspaces        — Crée un workspace (Expert only, async Miro)         ║
║    GET    /workspaces        — Liste les workspaces du user (paginé)               ║
║    GET    /workspaces/{id}   — Détail d'un workspace                               ║
║    DELETE /workspaces/{id}   — Supprime un workspace (best-effort Miro delete)     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.database import User, get_session

from .schemas import (
    HubWorkspaceCreate,
    HubWorkspaceListResponse,
    HubWorkspaceResponse,
)
from .service import (
    _create_miro_board_async,
    create_workspace,
    delete_workspace,
    get_workspace,
    list_workspaces,
)


logger = logging.getLogger(__name__)


router = APIRouter(tags=["Hub"])


# ─── POST /workspaces ────────────────────────────────────────────────────────


@router.post(
    "/workspaces",
    response_model=HubWorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_hub_workspace(
    payload: HubWorkspaceCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> HubWorkspaceResponse:
    """Crée un Hub Workspace (Expert only).

    Réponse immédiate avec status=``pending`` ; le board Miro est créé en
    background. Poller GET /workspaces/{id} pour observer status='ready'.
    """
    workspace = await create_workspace(db, current_user, payload)

    # Schedule background Miro board creation
    background_tasks.add_task(_create_miro_board_async, workspace.id)

    return HubWorkspaceResponse.model_validate(workspace)


# ─── GET /workspaces ─────────────────────────────────────────────────────────


@router.get(
    "/workspaces",
    response_model=HubWorkspaceListResponse,
)
async def list_hub_workspaces(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> HubWorkspaceListResponse:
    """Retourne la liste des workspaces du user, ordre desc created_at."""
    items, total = await list_workspaces(db, current_user, limit=limit, offset=offset)
    return HubWorkspaceListResponse(
        items=[HubWorkspaceResponse.model_validate(ws) for ws in items],
        total=total,
    )


# ─── GET /workspaces/{id} ────────────────────────────────────────────────────


@router.get(
    "/workspaces/{workspace_id}",
    response_model=HubWorkspaceResponse,
)
async def get_hub_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> HubWorkspaceResponse:
    """Détail d'un workspace. 404 si inconnu OU pas du user."""
    workspace = await get_workspace(db, current_user, workspace_id)
    return HubWorkspaceResponse.model_validate(workspace)


# ─── DELETE /workspaces/{id} ─────────────────────────────────────────────────


@router.delete(
    "/workspaces/{workspace_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_hub_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Supprime un workspace. Best-effort delete sur le board Miro associé.

    404 si workspace inconnu ou pas du user. 204 sinon.
    """
    await delete_workspace(db, current_user, workspace_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
