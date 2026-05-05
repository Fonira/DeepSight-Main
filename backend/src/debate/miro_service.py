"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎨 MIRO SERVICE — Génération de boards Miro pour les débats v2                    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Auth : MIRO_API_TOKEN admin DeepSight (env var, account-level).                   ║
║  Boards créés sur le compte org DeepSight, partagés en read-only via viewLink.     ║
║                                                                                    ║
║  Cf. docs/superpowers/specs/2026-05-04-debate-ia-v2.md §7.4.                       ║
║                                                                                    ║
║  Layout :                                                                          ║
║    • 1 frame "Débat IA — {topic}" central                                          ║
║    • Card vidéo A en haut (titre + thèse)                                          ║
║    • Cards perspectives B/B'/B'' en bas, en arc                                    ║
║    • Sticky notes Convergences (vert) à gauche                                     ║
║    • Sticky notes Divergences (rouge) à droite                                     ║
║                                                                                    ║
║  Limitation v2 : token admin → tous les boards sur le compte org DeepSight,        ║
║  partagés en read-only. Évolution v2.1 : OAuth user-level via users.miro_*.        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from core.config import _settings
from db.database import DebateAnalysis, DebatePerspective

logger = logging.getLogger(__name__)

MIRO_API_BASE = "https://api.miro.com/v2"
DEFAULT_TIMEOUT = 30.0


# Couleurs sticky notes Miro v2 (palette officielle).
# Cf. https://developers.miro.com/reference/sticky-note-style-fill-color
COLOR_CONVERGENCE = "light_green"
COLOR_DIVERGENCE = "light_pink"
COLOR_PERSPECTIVE_OPPOSITE = "yellow"
COLOR_PERSPECTIVE_COMPLEMENT = "light_blue"
COLOR_PERSPECTIVE_NUANCE = "light_yellow"
COLOR_VIDEO_A = "violet"


class MiroServiceError(Exception):
    """Raised when Miro REST API call fails or token absent."""


def _get_miro_token() -> Optional[str]:
    """Read MIRO_API_TOKEN from settings (env). None if absent.

    The setting itself is optional — the endpoint guards this and returns 503
    when absent, but the service raises MiroServiceError to keep callers
    explicit.
    """
    return getattr(_settings, "MIRO_API_TOKEN", None) or None


def _color_for_perspective(relation_type: str) -> str:
    if relation_type == "complement":
        return COLOR_PERSPECTIVE_COMPLEMENT
    if relation_type == "nuance":
        return COLOR_PERSPECTIVE_NUANCE
    return COLOR_PERSPECTIVE_OPPOSITE


def _truncate(text: Optional[str], max_len: int = 280) -> str:
    """Sticky note content cap (Miro recommends <= ~6 lines)."""
    if not text:
        return ""
    text = str(text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


async def _miro_post(
    client: httpx.AsyncClient,
    path: str,
    token: str,
    json_body: dict,
) -> dict:
    """POST helper with consistent error handling."""
    url = f"{MIRO_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        resp = await client.post(url, json=json_body, headers=headers)
    except httpx.HTTPError as exc:
        raise MiroServiceError(f"Miro API network error: {exc!s}") from exc

    if resp.status_code >= 400:
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": resp.text[:500]}
        raise MiroServiceError(
            f"Miro API error {resp.status_code} on POST {path}: {payload}"
        )

    return resp.json()


async def _miro_get(
    client: httpx.AsyncClient,
    path: str,
    token: str,
) -> dict:
    """GET helper with consistent error handling."""
    url = f"{MIRO_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    try:
        resp = await client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        raise MiroServiceError(f"Miro API network error: {exc!s}") from exc

    if resp.status_code >= 400:
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": resp.text[:500]}
        raise MiroServiceError(
            f"Miro API error {resp.status_code} on GET {path}: {payload}"
        )

    return resp.json()


def _parse_json_field(value: Any) -> list:
    """DebateAnalysis stocke certains champs en JSON string. Decode safe."""
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    return []


async def generate_debate_board(
    debate: DebateAnalysis,
    perspectives: list[DebatePerspective],
    convergence_points: list,
    divergence_points: list,
) -> dict:
    """Generate a Miro board for a debate.

    Returns
    -------
    dict
        {"board_id": str, "view_link": str}

    Raises
    ------
    MiroServiceError
        If MIRO_API_TOKEN missing, or Miro API call fails.
    """
    token = _get_miro_token()
    if not token:
        raise MiroServiceError("MIRO_API_TOKEN not configured")

    topic = (debate.detected_topic or "Débat IA").strip()[:120]
    board_name = f"Débat IA — {topic}"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        # ─── 1. Create board ─────────────────────────────────────────────
        # `sharingPolicy.access: "view"` makes the board readable via its
        # viewLink (required for the embed iframe). Other policy options
        # (`permissionsPolicy.sharingAccess`, `organizationAccess`,
        # `teamAccess`) require Miro Team plan and produce 403 4.0602 on
        # Personal Starter — keep them out so default policy applies.
        # Cf. https://developers.miro.com/reference/create-board
        board_body = {
            "name": board_name,
            "description": (
                f"Débat IA généré par DeepSight — {topic}. "
                f"Comparaison automatique entre {len(perspectives) + 1} vidéos."
            )[:500],
            "policy": {
                "sharingPolicy": {"access": "view"},
            },
        }
        board = await _miro_post(client, "/boards", token, board_body)
        board_id: str = str(board.get("id") or "")
        if not board_id:
            raise MiroServiceError(
                f"Miro create board returned no id: {board!r}"
            )

        # ─── 2. Card vidéo A ─────────────────────────────────────────────
        thesis_a = _truncate(debate.thesis_a, 320)
        video_a_title = _truncate(debate.video_a_title, 100)
        await _miro_post(
            client,
            f"/boards/{board_id}/sticky_notes",
            token,
            {
                "data": {
                    "content": (
                        f"<p><strong>Vidéo A</strong></p>"
                        f"<p>{video_a_title}</p>"
                        f"<p><em>{thesis_a}</em></p>"
                    ),
                    "shape": "square",
                },
                "style": {"fillColor": COLOR_VIDEO_A},
                "position": {"x": 0, "y": -300},
                "geometry": {"width": 220},
            },
        )

        # ─── 3. Cards perspectives (en arc en bas) ───────────────────────
        # Espacement horizontal ~ 280 par perspective ; max 3 → -280, 0, 280.
        n_persp = len(perspectives)
        if n_persp > 0:
            spacing = 320
            start_x = -(spacing * (n_persp - 1) // 2)
            for idx, persp in enumerate(perspectives):
                x = start_x + idx * spacing
                y = 200
                relation = (persp.relation_type or "opposite").lower()
                color = _color_for_perspective(relation)
                thesis = _truncate(persp.thesis, 320)
                title = _truncate(persp.video_title, 100)
                label = {
                    "opposite": "Vidéo B (opposée)",
                    "complement": "Perspective complémentaire",
                    "nuance": "Perspective nuancée",
                }.get(relation, "Perspective")
                await _miro_post(
                    client,
                    f"/boards/{board_id}/sticky_notes",
                    token,
                    {
                        "data": {
                            "content": (
                                f"<p><strong>{label}</strong></p>"
                                f"<p>{title}</p>"
                                f"<p><em>{thesis}</em></p>"
                            ),
                            "shape": "square",
                        },
                        "style": {"fillColor": color},
                        "position": {"x": x, "y": y},
                        "geometry": {"width": 220},
                    },
                )

        # ─── 4. Sticky notes Convergences (vert, à gauche) ───────────────
        # Limite : on en pose 5 max pour éviter le rate limit.
        for i, conv in enumerate(convergence_points[:5]):
            content = (
                conv.get("description") or conv.get("topic") or str(conv)
                if isinstance(conv, dict)
                else str(conv)
            )
            await _miro_post(
                client,
                f"/boards/{board_id}/sticky_notes",
                token,
                {
                    "data": {
                        "content": (
                            f"<p><strong>Convergence</strong></p>"
                            f"<p>{_truncate(content, 200)}</p>"
                        ),
                        "shape": "square",
                    },
                    "style": {"fillColor": COLOR_CONVERGENCE},
                    "position": {"x": -700, "y": -200 + i * 180},
                    "geometry": {"width": 200},
                },
            )

        # ─── 5. Sticky notes Divergences (rouge, à droite) ───────────────
        for i, div in enumerate(divergence_points[:5]):
            if isinstance(div, dict):
                content = div.get("topic") or div.get("description") or ""
                pos_a = div.get("position_a", "")
                pos_b = div.get("position_b", "")
                full = f"{content} — A: {pos_a} | B: {pos_b}".strip(" —")
            else:
                full = str(div)
            await _miro_post(
                client,
                f"/boards/{board_id}/sticky_notes",
                token,
                {
                    "data": {
                        "content": (
                            f"<p><strong>Divergence</strong></p>"
                            f"<p>{_truncate(full, 220)}</p>"
                        ),
                        "shape": "square",
                    },
                    "style": {"fillColor": COLOR_DIVERGENCE},
                    "position": {"x": 700, "y": -200 + i * 180},
                    "geometry": {"width": 200},
                },
            )

        # ─── 6. Get board details (viewLink) ─────────────────────────────
        board_detail = await _miro_get(client, f"/boards/{board_id}", token)
        view_link = (
            board_detail.get("viewLink")
            or board_detail.get("view_link")
            or board.get("viewLink")
            or board.get("view_link")
            or f"https://miro.com/app/board/{board_id}/"
        )

    logger.info(
        "[MIRO] Board generated: id=%s, perspectives=%d, conv=%d, div=%d",
        board_id,
        n_persp,
        len(convergence_points[:5]),
        len(divergence_points[:5]),
    )
    return {"board_id": board_id, "view_link": view_link}


# ═════════════════════════════════════════════════════════════════════════════
# 🧩 HUB MIRO WORKSPACE — Sprint Hub Miro MVP (2026-05-05)
# Spec : docs/superpowers/specs/2026-05-05-hub-miro-workspace-mvp.md
# Helper distinct de generate_debate_board pour ne pas casser la signature
# Débat IA déjà en prod.
# ═════════════════════════════════════════════════════════════════════════════


HUB_CARD_WIDTH = 300
HUB_CARD_HEIGHT = 200
HUB_CARD_GAP_X = 50
HUB_CARD_GAP_Y = 60
HUB_GRID_COLUMNS = 4  # 4 cards/row → grille équilibrée jusqu'à 20 cards (5 rows)


async def create_hub_workspace_board(
    name: str,
    summaries: list,
) -> dict:
    """Crée un board Miro pour un Hub Workspace DeepSight.

    Layout :
      - Grille (HUB_GRID_COLUMNS colonnes) de cards Miro, une par Summary.
      - Card width=300, height=200, gap horizontal=50, vertical=60.
      - Chaque card affiche : titre vidéo, channel, lien.

    Parameters
    ----------
    name : str
        Nom donné par l'utilisateur (max 200 chars).
    summaries : list
        Liste d'objets Summary (SQLAlchemy) — doit exposer ``video_title``,
        ``video_channel``, ``video_url``, ``video_id``, ``platform``.

    Returns
    -------
    dict
        ``{"board_id": str, "view_link": str}``

    Raises
    ------
    MiroServiceError
        Si MIRO_API_TOKEN absent ou Miro API call échoue.
    """
    token = _get_miro_token()
    if not token:
        raise MiroServiceError("MIRO_API_TOKEN not configured")

    safe_name = (name or "Workspace").strip()[:200] or "Workspace"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        # ─── 1. Create board ──────────────────────────────────────────────
        # Policy options omitted: `permissionsPolicy.sharingAccess` and
        # `sharingPolicy.organizationAccess`/`teamAccess` require Miro Team
        # plan and produce 403 4.0602 on Personal Starter accounts. Adding
        # `sharingPolicy.access: "view"` is necessary so the embed iframe
        # can load the board (defaults to "private" otherwise).
        board_body = {
            "name": safe_name,
            "description": (
                f"DeepSight Hub Workspace — {len(summaries)} analyses"
            )[:500],
            "policy": {
                "sharingPolicy": {"access": "view"},
            },
        }
        board = await _miro_post(client, "/boards", token, board_body)
        board_id: str = str(board.get("id") or "")
        if not board_id:
            raise MiroServiceError(
                f"Miro create board returned no id: {board!r}"
            )

        # ─── 2. Cards (grille) ────────────────────────────────────────────
        # Position grille : colonne = idx % cols, row = idx // cols.
        # Centrée autour de (0,0) horizontalement.
        cols = HUB_GRID_COLUMNS
        col_step = HUB_CARD_WIDTH + HUB_CARD_GAP_X
        row_step = HUB_CARD_HEIGHT + HUB_CARD_GAP_Y
        total = len(summaries)
        n_cols_actual = min(cols, max(1, total))
        # x_start = position de la 1ère colonne (centré)
        x_start = -((n_cols_actual - 1) * col_step) / 2

        for idx, summary in enumerate(summaries):
            col = idx % cols
            row = idx // cols
            x = x_start + col * col_step
            y = row * row_step

            video_title = _truncate(getattr(summary, "video_title", None), 100) or "Sans titre"
            video_channel = _truncate(getattr(summary, "video_channel", None), 80) or ""
            video_url = getattr(summary, "video_url", None) or ""
            platform_name = (getattr(summary, "platform", None) or "youtube").lower()

            # Body HTML formatté (Miro card supporte HTML basique).
            description_parts = [f"<p><strong>{video_title}</strong></p>"]
            if video_channel:
                description_parts.append(f"<p>{video_channel}</p>")
            if video_url:
                description_parts.append(
                    f'<p><a href="{video_url}">Ouvrir la vidéo ({platform_name})</a></p>'
                )
            description_html = "".join(description_parts)

            await _miro_post(
                client,
                f"/boards/{board_id}/cards",
                token,
                {
                    "data": {
                        "title": video_title,
                        "description": description_html,
                    },
                    "position": {"x": x, "y": y},
                    "geometry": {
                        "width": HUB_CARD_WIDTH,
                        "height": HUB_CARD_HEIGHT,
                    },
                },
            )

        # ─── 3. Get board details (viewLink) ──────────────────────────────
        board_detail = await _miro_get(client, f"/boards/{board_id}", token)
        view_link = (
            board_detail.get("viewLink")
            or board_detail.get("view_link")
            or board.get("viewLink")
            or board.get("view_link")
            or f"https://miro.com/app/board/{board_id}/"
        )

    logger.info(
        "[MIRO] Hub workspace board generated: id=%s, summaries=%d",
        board_id,
        total,
    )
    return {"board_id": board_id, "view_link": view_link}


async def delete_hub_workspace_board(board_id: str) -> bool:
    """Best-effort delete d'un board Miro. Logue mais ne raise pas.

    Returns
    -------
    bool
        True si delete OK, False si échec (token absent ou API fail).
    """
    token = _get_miro_token()
    if not token or not board_id:
        return False

    url = f"{MIRO_API_BASE}/boards/{board_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.delete(url, headers=headers)
            if resp.status_code in (200, 204):
                return True
            logger.warning(
                "[MIRO] Hub workspace board delete non-2xx: status=%s board=%s",
                resp.status_code,
                board_id,
            )
            return False
    except httpx.HTTPError as exc:
        logger.warning(
            "[MIRO] Hub workspace board delete network error: %s (board=%s)",
            exc,
            board_id,
        )
        return False
