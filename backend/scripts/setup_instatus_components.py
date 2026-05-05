"""Idempotent Instatus components setup script.

Usage::

    # Dry-run : montre ce qui serait fait sans toucher à Instatus
    python backend/scripts/setup_instatus_components.py --dry-run

    # Apply : crée/met à jour les 5 composants sur Instatus
    INSTATUS_API_KEY=ist_... INSTATUS_PAGE_ID=abc123 \\
        python backend/scripts/setup_instatus_components.py --apply

    # Show config : dump la config locale sans appel réseau
    python backend/scripts/setup_instatus_components.py --show-config

Idempotence : les composants sont matchés par ``name`` (clé unique).
- Match → PATCH (update si différence détectée)
- Pas de match → POST (création)
- Skipped si aucune diff

Free tier Instatus = 5 components max → garde-fou intégré.

Documentation API Instatus : https://instatus.com/help/api
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict
from typing import Any, Optional

import httpx

# Permet d'exécuter le script depuis le repo root sans modifier PYTHONPATH
sys.path.insert(0, os.path.dirname(__file__))

from instatus_components_config import (  # noqa: E402
    COMPONENTS,
    DEFAULT_METADATA,
    InstatusComponent,
)

INSTATUS_API_BASE = "https://api.instatus.com"
HTTP_TIMEOUT = 30.0
MAX_FREE_TIER_COMPONENTS = 5


# ───────────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────────


def _payload_from_component(component: InstatusComponent) -> dict[str, Any]:
    """Construit le payload JSON pour POST/PATCH /v1/{page-id}/components.

    Le schéma Instatus accepte (champs principaux) :
    name, description, status, order, showcase, group, internalName, monitorId.
    On envoie le minimum nécessaire — Instatus garde la valeur précédente
    pour les champs absents.
    """
    payload: dict[str, Any] = {
        "name": component.name,
        "description": component.description,
        "order": component.order,
        "showcase": component.showcase,
        "status": "OPERATIONAL",
    }
    if component.group:
        payload["group"] = component.group
    return payload


def _components_differ(local: InstatusComponent, remote: dict[str, Any]) -> bool:
    """Détecte si un composant Instatus existant doit être mis à jour."""
    if remote.get("description") != local.description:
        return True
    if int(remote.get("order") or 0) != local.order:
        return True
    if bool(remote.get("showcase")) != local.showcase:
        return True
    remote_group = remote.get("group")
    # Instatus renvoie soit None, soit un objet {id, name, ...}, soit un string
    remote_group_name = (
        remote_group.get("name")
        if isinstance(remote_group, dict)
        else remote_group
    )
    if (remote_group_name or None) != (local.group or None):
        return True
    return False


# ───────────────────────────────────────────────────────────────────────────
# Instatus API client (minimal, async — utilisable depuis CI)
# ───────────────────────────────────────────────────────────────────────────


class InstatusClient:
    """Wrapper httpx synchrone — pas besoin d'asyncio pour ce script CLI."""

    def __init__(self, api_key: str, page_id: str) -> None:
        self._api_key = api_key
        self._page_id = page_id
        self._client = httpx.Client(
            base_url=f"{INSTATUS_API_BASE}/v1/{page_id}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=HTTP_TIMEOUT,
        )

    def list_components(self) -> list[dict[str, Any]]:
        resp = self._client.get("/components")
        resp.raise_for_status()
        data = resp.json()
        # L'API renvoie soit une liste directe, soit {data: [...]}
        if isinstance(data, list):
            return data
        return list(data.get("data", []))

    def create_component(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.post("/components", json=payload)
        resp.raise_for_status()
        return resp.json()

    def update_component(
        self, component_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        resp = self._client.put(f"/components/{component_id}", json=payload)
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        self._client.close()


# ───────────────────────────────────────────────────────────────────────────
# Actions
# ───────────────────────────────────────────────────────────────────────────


class ComponentResult:
    """Statut d'une action sur un composant — utilisé pour l'output table."""

    __slots__ = ("name", "action", "detail")

    def __init__(self, name: str, action: str, detail: str = "") -> None:
        self.name = name
        self.action = action  # "created" | "updated" | "skipped" | "error" | "dryrun"
        self.detail = detail


def _print_table(results: list[ComponentResult]) -> None:
    """Affichage tabulaire ASCII compatible PowerShell + bash + CI logs."""
    if not results:
        print("(aucun composant traité)")
        return

    name_w = max(len(r.name) for r in results) + 2
    action_w = max(len(r.action) for r in results) + 2

    sep = "+" + "-" * (name_w + 2) + "+" + "-" * (action_w + 2) + "+" + "-" * 50 + "+"
    print(sep)
    print(
        f"| {'Component'.ljust(name_w)} | "
        f"{'Action'.ljust(action_w)} | "
        f"{'Detail'.ljust(48)} |"
    )
    print(sep)
    for r in results:
        print(
            f"| {r.name.ljust(name_w)} | "
            f"{r.action.ljust(action_w)} | "
            f"{r.detail[:48].ljust(48)} |"
        )
    print(sep)


def upsert_component(
    client: InstatusClient,
    component: InstatusComponent,
    remote_index: dict[str, dict[str, Any]],
    dry_run: bool,
) -> ComponentResult:
    """Crée ou met à jour un composant Instatus de façon idempotente.

    Args:
        client: Instance InstatusClient (None si dry_run).
        component: Config locale du composant.
        remote_index: Map name -> dict component existant côté Instatus.
        dry_run: Si True, n'effectue aucun appel mutant.
    """
    payload = _payload_from_component(component)
    existing = remote_index.get(component.name)

    if existing:
        if not _components_differ(component, existing):
            return ComponentResult(component.name, "skipped", "no diff")
        if dry_run:
            return ComponentResult(component.name, "dryrun", "would PUT (diff)")
        try:
            client.update_component(existing["id"], payload)
            return ComponentResult(
                component.name, "updated", f"id={existing.get('id', '?')}"
            )
        except httpx.HTTPError as exc:
            return ComponentResult(component.name, "error", f"PUT failed: {exc}")
    else:
        if dry_run:
            return ComponentResult(component.name, "dryrun", "would POST (new)")
        try:
            created = client.create_component(payload)
            return ComponentResult(
                component.name, "created", f"id={created.get('id', '?')}"
            )
        except httpx.HTTPError as exc:
            return ComponentResult(component.name, "error", f"POST failed: {exc}")


# ───────────────────────────────────────────────────────────────────────────
# CLI
# ───────────────────────────────────────────────────────────────────────────


def show_config() -> int:
    """Dump la config locale sans appeler l'API."""
    print(f"Components configured ({len(COMPONENTS)}/{MAX_FREE_TIER_COMPONENTS}):\n")
    for c in COMPONENTS:
        as_dict = asdict(c)
        print(f"  - {c.name}")
        for key, value in as_dict.items():
            if key == "name":
                continue
            print(f"      {key}: {value}")
    print(f"\nDefault metadata: {json.dumps(DEFAULT_METADATA)}")
    return 0


def run_setup(dry_run: bool) -> int:
    """Exécute le setup. Retourne un code de sortie."""
    if len(COMPONENTS) > MAX_FREE_TIER_COMPONENTS:
        print(
            f"ERROR: {len(COMPONENTS)} composants définis > "
            f"{MAX_FREE_TIER_COMPONENTS} (free tier max). Réduire la liste "
            f"ou upgrader Instatus.",
            file=sys.stderr,
        )
        return 2

    api_key: Optional[str] = os.environ.get("INSTATUS_API_KEY")
    page_id: Optional[str] = os.environ.get("INSTATUS_PAGE_ID")

    if not dry_run:
        if not api_key:
            print(
                "ERROR: INSTATUS_API_KEY env var manquante "
                "(Settings → API Tokens dans Instatus admin).",
                file=sys.stderr,
            )
            return 1
        if not page_id:
            print(
                "ERROR: INSTATUS_PAGE_ID env var manquante "
                "(URL admin → segment après /pages/).",
                file=sys.stderr,
            )
            return 1

    if dry_run:
        print(f"DRY-RUN — {len(COMPONENTS)} composants seraient inspectés.\n")
        # Sans credentials on ne peut pas lister le remote → on simule
        # tout en "would POST (new)" pour donner un aperçu utile.
        if not api_key or not page_id:
            results = [
                ComponentResult(c.name, "dryrun", "would POST (no remote check)")
                for c in COMPONENTS
            ]
            _print_table(results)
            return 0

    client = InstatusClient(api_key=api_key or "", page_id=page_id or "")
    try:
        try:
            remote_components = client.list_components()
        except httpx.HTTPError as exc:
            print(f"ERROR: GET /components failed: {exc}", file=sys.stderr)
            return 3

        remote_index: dict[str, dict[str, Any]] = {
            (c.get("name") or ""): c for c in remote_components if c.get("name")
        }
        print(
            f"Found {len(remote_index)} existing remote components on page "
            f"{page_id}.\n"
        )

        results: list[ComponentResult] = []
        for component in COMPONENTS:
            results.append(
                upsert_component(client, component, remote_index, dry_run)
            )
        _print_table(results)

        # Status code = 4 si au moins un error
        if any(r.action == "error" for r in results):
            return 4
        return 0
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Idempotent Instatus components setup for DeepSight status page.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--dry-run",
        action="store_true",
        help="Affiche ce qui serait fait sans muter Instatus.",
    )
    group.add_argument(
        "--apply",
        action="store_true",
        help="Applique les changements via l'API Instatus.",
    )
    group.add_argument(
        "--show-config",
        action="store_true",
        help="Dump la config locale (aucun appel réseau).",
    )

    args = parser.parse_args()

    if args.show_config:
        return show_config()

    return run_setup(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
