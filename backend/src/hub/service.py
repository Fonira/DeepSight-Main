"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧩 HUB SERVICE — Logique métier Hub Miro Workspace                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Spec : docs/superpowers/specs/2026-05-05-hub-miro-workspace-mvp.md                ║
║  Gating : Expert only (vérifié strict côté plan + via is_feature_available SSOT). ║
║  Cap : 5 workspaces actifs / user / 30 jours.                                      ║
║  Sync : one-way push DeepSight → Miro (board admin token, view-only sharing).      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from billing.plan_config import is_feature_available, normalize_plan_id
from db.database import HubWorkspace, Summary, User, async_session_maker

from .schemas import (
    ACTIVE_WORKSPACE_WINDOW_DAYS,
    MAX_ACTIVE_WORKSPACES_PER_USER,
    MAX_SUMMARIES_PER_WORKSPACE,
    MIN_SUMMARIES_PER_WORKSPACE,
    HubWorkspaceCreate,
)


logger = logging.getLogger(__name__)


ACTIVE_STATUSES: tuple[str, ...] = ("pending", "creating", "ready")


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


async def _user_owns_summaries(db: AsyncSession, user_id: int, summary_ids: list[int]) -> bool:
    """Retourne True si tous les ``summary_ids`` appartiennent à ``user_id``.

    Vérifie aussi que tous existent — un ID inconnu fait retourner False.
    """
    if not summary_ids:
        return False
    result = await db.execute(
        select(func.count(Summary.id)).where(
            Summary.id.in_(summary_ids),
            Summary.user_id == user_id,
        )
    )
    count = int(result.scalar() or 0)
    return count == len(set(summary_ids))


async def _count_active_workspaces(db: AsyncSession, user_id: int) -> int:
    """Compte les workspaces actifs (status pending/creating/ready) sur la
    fenêtre des ``ACTIVE_WORKSPACE_WINDOW_DAYS`` derniers jours.
    """
    cutoff = datetime.utcnow() - timedelta(days=ACTIVE_WORKSPACE_WINDOW_DAYS)
    result = await db.execute(
        select(func.count(HubWorkspace.id)).where(
            HubWorkspace.user_id == user_id,
            HubWorkspace.status.in_(ACTIVE_STATUSES),
            HubWorkspace.created_at >= cutoff,
        )
    )
    return int(result.scalar() or 0)


def _ensure_expert_plan(user: User) -> None:
    """Raise HTTPException 403 si l'utilisateur n'a pas accès à la feature
    ``hub_workspace`` sur la plateforme web (Expert only).

    Admin bypass : ``user.is_admin = True`` court-circuite le gate.
    """
    if getattr(user, "is_admin", False):
        return

    raw_plan = user.plan or "free"
    plan = normalize_plan_id(raw_plan)

    # Vérification stricte Expert (matrice SSOT) — sur web.
    if not is_feature_available(plan, "hub_workspace", "web"):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "hub_workspace_expert_only",
                "message": "Hub Workspaces are Expert only",
                "current_plan": plan,
                "required_plan": "expert",
            },
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def create_workspace(
    db: AsyncSession,
    user: User,
    payload: HubWorkspaceCreate,
) -> HubWorkspace:
    """Crée un Hub Workspace avec status ``pending`` puis renvoie la row.

    Contrôles :
      * Plan == ``expert`` (sauf admin bypass).
      * <= ``MAX_ACTIVE_WORKSPACES_PER_USER`` actifs sur 30 jours glissants.
      * ``summary_ids`` length ∈ [2, 20] et tous appartiennent au user.

    L'orchestration du board Miro (background task) est lancée par le
    router via ``BackgroundTasks.add_task(_create_miro_board_async, ...)``.
    """
    # 1. Gating plan (Expert only)
    _ensure_expert_plan(user)

    # 2. Cap mensuel (rolling 30j)
    active_count = await _count_active_workspaces(db, user.id)
    if active_count >= MAX_ACTIVE_WORKSPACES_PER_USER:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "hub_workspace_quota_exceeded",
                "message": (
                    f"Limite {MAX_ACTIVE_WORKSPACES_PER_USER} workspaces / "
                    f"{ACTIVE_WORKSPACE_WINDOW_DAYS} jours atteinte"
                ),
                "active_count": active_count,
                "limit": MAX_ACTIVE_WORKSPACES_PER_USER,
                "window_days": ACTIVE_WORKSPACE_WINDOW_DAYS,
            },
        )

    # 3. Validation summary_ids — length déjà checkée par Pydantic, on
    # double-check ici par sécurité (au cas où le service est appelé hors HTTP)
    summary_ids = list(payload.summary_ids)
    if not (MIN_SUMMARIES_PER_WORKSPACE <= len(summary_ids) <= MAX_SUMMARIES_PER_WORKSPACE):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "hub_workspace_invalid_summary_count",
                "message": (
                    f"summary_ids must contain {MIN_SUMMARIES_PER_WORKSPACE} to {MAX_SUMMARIES_PER_WORKSPACE} items"
                ),
                "received": len(summary_ids),
            },
        )

    # 4. Ownership des summaries
    if not await _user_owns_summaries(db, user.id, summary_ids):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "hub_workspace_invalid_summary_ids",
                "message": ("Some summary_ids are unknown or not owned by this user"),
            },
        )

    # 5. Insert
    workspace = HubWorkspace(
        user_id=user.id,
        name=payload.name.strip(),
        summary_ids=summary_ids,
        status="pending",
    )
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)

    logger.info(
        "[HUB] Workspace created id=%s user=%s summaries=%d",
        workspace.id,
        user.id,
        len(summary_ids),
    )
    return workspace


async def list_workspaces(
    db: AsyncSession,
    user: User,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[HubWorkspace], int]:
    """Retourne ``(items, total)`` — workspaces du user, ordre desc created_at."""
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    total_result = await db.execute(select(func.count(HubWorkspace.id)).where(HubWorkspace.user_id == user.id))
    total = int(total_result.scalar() or 0)

    result = await db.execute(
        select(HubWorkspace)
        .where(HubWorkspace.user_id == user.id)
        .order_by(HubWorkspace.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list(result.scalars().all())
    return items, total


async def get_workspace(db: AsyncSession, user: User, workspace_id: int) -> HubWorkspace:
    """Retourne le workspace ou raise 404 si pas trouvé OU pas du user.

    On répond 404 (pas 403) pour ne pas révéler l'existence à un attaquant.
    """
    result = await db.execute(select(HubWorkspace).where(HubWorkspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if workspace is None or workspace.user_id != user.id:
        if not getattr(user, "is_admin", False) or workspace is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "hub_workspace_not_found"},
            )
    return workspace


async def delete_workspace(db: AsyncSession, user: User, workspace_id: int) -> None:
    """Supprime un workspace + best-effort delete board Miro côté API.

    404 si workspace inconnu ou pas du user.
    """
    workspace = await get_workspace(db, user, workspace_id)

    # Best effort : delete board Miro si existant.
    miro_board_id = workspace.miro_board_id
    if miro_board_id:
        try:
            from debate.miro_service import delete_hub_workspace_board

            ok = await delete_hub_workspace_board(miro_board_id)
            if not ok:
                logger.warning(
                    "[HUB] Miro board delete failed (non-blocking) ws=%s board=%s",
                    workspace_id,
                    miro_board_id,
                )
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning(
                "[HUB] Miro delete raised (non-blocking) ws=%s err=%s",
                workspace_id,
                exc,
            )

    await db.delete(workspace)
    await db.commit()
    logger.info("[HUB] Workspace deleted id=%s user=%s", workspace_id, user.id)


# ═══════════════════════════════════════════════════════════════════════════════
# Background task — Miro board async creation
# ═══════════════════════════════════════════════════════════════════════════════


async def _create_miro_board_async(workspace_id: int) -> None:
    """Background task : crée le board Miro pour le workspace.

    Ouvre sa propre AsyncSession (indépendante de la requête HTTP).
    Update status : pending → creating → ready (ou failed).
    """
    async with async_session_maker() as session:
        try:
            # 1. Charger le workspace
            result = await session.execute(select(HubWorkspace).where(HubWorkspace.id == workspace_id))
            workspace = result.scalar_one_or_none()
            if workspace is None:
                logger.warning(
                    "[HUB] _create_miro_board_async: workspace %s not found",
                    workspace_id,
                )
                return

            # 2. status='creating'
            workspace.status = "creating"
            await session.commit()

            # 3. Charger les summaries du workspace
            summary_ids = list(workspace.summary_ids or [])
            summaries_res = await session.execute(select(Summary).where(Summary.id.in_(summary_ids)))
            summaries = list(summaries_res.scalars().all())

            # Préserver l'ordre demandé par l'utilisateur
            ordered: list[Summary] = []
            by_id = {s.id: s for s in summaries}
            for sid in summary_ids:
                if sid in by_id:
                    ordered.append(by_id[sid])

            if not ordered:
                raise RuntimeError("No summaries found for workspace")

            # 4. Créer le board (helper miro_service)
            from debate.miro_service import (
                MiroServiceError,
                create_hub_workspace_board,
            )

            try:
                board = await create_hub_workspace_board(
                    name=workspace.name,
                    summaries=ordered,
                )
            except MiroServiceError as exc:
                workspace.status = "failed"
                workspace.error_message = str(exc)[:500]
                await session.commit()
                logger.error(
                    "[HUB] Miro board creation failed ws=%s err=%s",
                    workspace_id,
                    exc,
                )
                return

            # 5. Persiste les infos Miro mais on garde status='creating'
            # tant que le canvas natif n'est pas tenté → le polling frontend
            # continue jusqu'à voir status='ready' avec canvas_data populé
            # (ou null sur fail Mistral).
            workspace.miro_board_id = board.get("board_id")
            workspace.miro_board_url = board.get("view_link")
            workspace.error_message = None
            await session.commit()

            # 6. Pivot 2026-05-06 : génération du canvas natif Mistral.
            # Best-effort — si Mistral échoue, canvas_data reste null et le
            # frontend bascule sur MiroBoardEmbed (rétro-compat).
            try:
                from .canvas_service import generate_workspace_canvas

                canvas_data = await generate_workspace_canvas(
                    summaries=ordered,
                    workspace_name=workspace.name,
                )
                if canvas_data is not None:
                    workspace.canvas_data = canvas_data
                    logger.info(
                        "[HUB] Canvas natif généré ws=%s themes=%d shared=%d",
                        workspace_id,
                        len(canvas_data.get("themes", [])),
                        len(canvas_data.get("shared_concepts", [])),
                    )
                else:
                    logger.warning(
                        "[HUB] Canvas natif None ws=%s — fallback Miro côté front",
                        workspace_id,
                    )
            except Exception:  # pragma: no cover — defensive
                logger.exception(
                    "[HUB] Canvas natif failed ws=%s — fallback Miro côté front",
                    workspace_id,
                )

            # 7. status='ready' (canvas_data populé ou null) → polling stop.
            workspace.status = "ready"
            await session.commit()
            logger.info(
                "[HUB] Workspace ready id=%s board=%s canvas=%s",
                workspace_id,
                workspace.miro_board_id,
                "yes" if workspace.canvas_data else "no",
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.exception(
                "[HUB] _create_miro_board_async failed ws=%s",
                workspace_id,
            )
            try:
                # Best-effort : marquer comme failed dans une nouvelle session.
                async with async_session_maker() as recover:
                    res = await recover.execute(select(HubWorkspace).where(HubWorkspace.id == workspace_id))
                    ws = res.scalar_one_or_none()
                    if ws is not None:
                        ws.status = "failed"
                        ws.error_message = str(exc)[:500]
                        await recover.commit()
            except Exception:
                logger.exception(
                    "[HUB] could not mark workspace %s as failed",
                    workspace_id,
                )
