"""PostHog Insights / Cohorts / Dashboards — provisioning idempotent via API.

Lit la config dans ``posthog_insights_config.py`` et provisionne tout dans le
projet PostHog cible (Cloud EU par défaut). Idempotent : matche par ``name`` et
upserte (PATCH si existe, POST si absent).

Usage
-----

    # Voir la config sans rien envoyer
    python scripts/setup_posthog_insights.py --show-config

    # Dry-run : list + diff sans modification
    POSTHOG_API_KEY=... POSTHOG_PROJECT_ID=... \\
        python scripts/setup_posthog_insights.py --dry-run

    # Apply : upsert tout
    POSTHOG_API_KEY=... POSTHOG_PROJECT_ID=... \\
        python scripts/setup_posthog_insights.py --apply

Environment
-----------

- ``POSTHOG_API_KEY`` (REQUIRED en --dry-run/--apply) : Personal API key avec
  scopes ``insight:write``, ``cohort:write``, ``dashboard:write``. À générer
  dans Settings → Personal API Keys (PAS la project key publique côté frontend).
- ``POSTHOG_HOST`` (default: ``https://eu.posthog.com``) : EU pour DeepSight.
- ``POSTHOG_PROJECT_ID`` (REQUIRED) : ID numérique du projet PostHog
  (Settings → Project ID, ou dans l'URL ``/project/<id>/...``).

Comportement
------------

- Per-resource try/except : un fail sur un insight n'arrête pas les autres.
- Dashboard add/remove tile via endpoints dédiés.
- Pas de delete : si un insight est retiré de ``build_config()``, il reste dans
  PostHog (à supprimer manuellement). C'est volontaire — éviter la perte
  accidentelle d'historique.

Réf API : https://posthog.com/docs/api/insights et /cohorts et /dashboards.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Any

import httpx

# Force UTF-8 stdout/stderr (Windows cp1252 console fix). No-op on Linux/macOS.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except (AttributeError, ValueError):
    pass

# Imports relatifs — tolère exécution directe ou via -m
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from posthog_insights_config import (  # noqa: E402
    CohortDefinition,
    DashboardSpec,
    FullConfig,
    FunnelInsight,
    RetentionInsight,
    TrendInsight,
    build_config,
)


DEFAULT_HOST = "https://eu.posthog.com"


# ─────────────────────────────────────────────────────────────────────────────
#  Outcome reporting
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class ResourceOutcome:
    kind: str  # 'funnel' | 'retention' | 'trend' | 'cohort' | 'dashboard'
    name: str
    action: str  # 'created' | 'updated' | 'unchanged' | 'failed' | 'would-create' | 'would-update'
    posthog_id: int | str | None = None
    error: str | None = None

    @property
    def status_emoji(self) -> str:
        return {
            "created": "[+]",
            "updated": "[~]",
            "unchanged": "[=]",
            "failed": "[x]",
            "would-create": "[?+]",
            "would-update": "[?~]",
        }.get(self.action, "[?]")


# ─────────────────────────────────────────────────────────────────────────────
#  Client PostHog (httpx wrapper minimal)
# ─────────────────────────────────────────────────────────────────────────────


class PostHogClient:
    def __init__(self, host: str, api_key: str, project_id: str, timeout: float = 30.0):
        self.host = host.rstrip("/")
        self.api_key = api_key
        self.project_id = project_id
        self._client = httpx.Client(
            base_url=self.host,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    def __enter__(self) -> "PostHogClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self._client.close()

    # ── Insights ────────────────────────────────────────────────────────────

    def list_insights(self, limit: int = 200) -> list[dict[str, Any]]:
        """Liste tous les insights du projet (paginé)."""
        results: list[dict[str, Any]] = []
        url: str | None = (
            f"/api/projects/{self.project_id}/insights/?limit={limit}&saved=true"
        )
        while url:
            resp = self._client.get(url)
            resp.raise_for_status()
            data = resp.json()
            results.extend(data.get("results", []))
            url = data.get("next")
            if url and url.startswith(self.host):
                url = url[len(self.host):]
        return results

    def create_insight(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.post(
            f"/api/projects/{self.project_id}/insights/",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def update_insight(self, insight_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.patch(
            f"/api/projects/{self.project_id}/insights/{insight_id}/",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Cohorts ─────────────────────────────────────────────────────────────

    def list_cohorts(self, limit: int = 200) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        url: str | None = f"/api/projects/{self.project_id}/cohorts/?limit={limit}"
        while url:
            resp = self._client.get(url)
            resp.raise_for_status()
            data = resp.json()
            results.extend(data.get("results", []))
            url = data.get("next")
            if url and url.startswith(self.host):
                url = url[len(self.host):]
        return results

    def create_cohort(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.post(
            f"/api/projects/{self.project_id}/cohorts/",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def update_cohort(self, cohort_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.patch(
            f"/api/projects/{self.project_id}/cohorts/{cohort_id}/",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Dashboards ──────────────────────────────────────────────────────────

    def list_dashboards(self, limit: int = 100) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        url: str | None = f"/api/projects/{self.project_id}/dashboards/?limit={limit}"
        while url:
            resp = self._client.get(url)
            resp.raise_for_status()
            data = resp.json()
            results.extend(data.get("results", []))
            url = data.get("next")
            if url and url.startswith(self.host):
                url = url[len(self.host):]
        return results

    def create_dashboard(self, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.post(
            f"/api/projects/{self.project_id}/dashboards/",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def update_dashboard(self, dashboard_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        resp = self._client.patch(
            f"/api/projects/{self.project_id}/dashboards/{dashboard_id}/",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def add_insight_to_dashboard(self, insight_id: int, dashboard_id: int) -> None:
        """Attache un insight à un dashboard via PATCH /insights/{id}/ avec
        ``dashboards: [...]``. PostHog gère l'union côté serveur.
        """
        resp = self._client.patch(
            f"/api/projects/{self.project_id}/insights/{insight_id}/",
            json={"dashboards": [dashboard_id]},
        )
        resp.raise_for_status()


# ─────────────────────────────────────────────────────────────────────────────
#  Reconciliation core
# ─────────────────────────────────────────────────────────────────────────────


def _index_by_name(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Indexe une liste d'objets PostHog par leur attribut ``name``.

    Si plusieurs items ont le même name (anomalie), on garde le 1er (id le plus bas
    statistiquement, l'ordre PostHog étant -created_at par défaut → on prend le plus récent).
    """
    out: dict[str, dict[str, Any]] = {}
    for item in items:
        name = item.get("name") or ""
        if not name:
            continue
        if name not in out:
            out[name] = item
    return out


def _payloads_differ(local: dict[str, Any], remote: dict[str, Any]) -> bool:
    """Comparaison superficielle des payloads pour décider d'un PATCH.

    On compare ``filters``, ``description`` et ``tags``. Les autres champs
    (created_at, etc.) sont ignorés. Si remote n'a pas de filters comparables, on
    PATCH par défaut pour s'assurer qu'on est sync.
    """
    keys = ("filters", "description", "tags")
    for k in keys:
        if local.get(k) != remote.get(k):
            return True
    return False


def reconcile_insights(
    client: PostHogClient,
    insights: list[FunnelInsight | RetentionInsight | TrendInsight],
    apply: bool,
    kind_label: str,
) -> tuple[list[ResourceOutcome], dict[str, int]]:
    """Reconcile une liste d'insights. Retourne (outcomes, name → posthog_id)."""
    outcomes: list[ResourceOutcome] = []
    name_to_id: dict[str, int] = {}
    try:
        existing_raw = client.list_insights()
    except httpx.HTTPError as e:
        for insight in insights:
            outcomes.append(
                ResourceOutcome(
                    kind=kind_label,
                    name=insight.name,
                    action="failed",
                    error=f"list_insights HTTP error: {e}",
                )
            )
        return outcomes, name_to_id

    by_name = _index_by_name(existing_raw)
    for insight in insights:
        payload = insight.to_posthog_payload()
        existing = by_name.get(insight.name)
        try:
            if existing is None:
                if apply:
                    created = client.create_insight(payload)
                    name_to_id[insight.name] = created["id"]
                    outcomes.append(
                        ResourceOutcome(
                            kind=kind_label,
                            name=insight.name,
                            action="created",
                            posthog_id=created["id"],
                        )
                    )
                else:
                    outcomes.append(
                        ResourceOutcome(
                            kind=kind_label, name=insight.name, action="would-create"
                        )
                    )
            else:
                insight_id = existing["id"]
                name_to_id[insight.name] = insight_id
                if _payloads_differ(payload, existing):
                    if apply:
                        client.update_insight(insight_id, payload)
                        outcomes.append(
                            ResourceOutcome(
                                kind=kind_label,
                                name=insight.name,
                                action="updated",
                                posthog_id=insight_id,
                            )
                        )
                    else:
                        outcomes.append(
                            ResourceOutcome(
                                kind=kind_label,
                                name=insight.name,
                                action="would-update",
                                posthog_id=insight_id,
                            )
                        )
                else:
                    outcomes.append(
                        ResourceOutcome(
                            kind=kind_label,
                            name=insight.name,
                            action="unchanged",
                            posthog_id=insight_id,
                        )
                    )
        except httpx.HTTPError as e:
            body = ""
            if isinstance(e, httpx.HTTPStatusError):
                body = f" — {e.response.text[:300]}"
            outcomes.append(
                ResourceOutcome(
                    kind=kind_label,
                    name=insight.name,
                    action="failed",
                    error=f"{type(e).__name__}: {e}{body}",
                )
            )

    return outcomes, name_to_id


def reconcile_cohorts(
    client: PostHogClient,
    cohorts: list[CohortDefinition],
    apply: bool,
) -> list[ResourceOutcome]:
    outcomes: list[ResourceOutcome] = []
    try:
        existing_raw = client.list_cohorts()
    except httpx.HTTPError as e:
        for c in cohorts:
            outcomes.append(
                ResourceOutcome(
                    kind="cohort",
                    name=c.name,
                    action="failed",
                    error=f"list_cohorts HTTP error: {e}",
                )
            )
        return outcomes

    by_name = _index_by_name(existing_raw)
    for cohort in cohorts:
        payload = cohort.to_posthog_payload()
        existing = by_name.get(cohort.name)
        try:
            if existing is None:
                if apply:
                    created = client.create_cohort(payload)
                    outcomes.append(
                        ResourceOutcome(
                            kind="cohort",
                            name=cohort.name,
                            action="created",
                            posthog_id=created["id"],
                        )
                    )
                else:
                    outcomes.append(
                        ResourceOutcome(
                            kind="cohort", name=cohort.name, action="would-create"
                        )
                    )
            else:
                cohort_id = existing["id"]
                # Comparaison cohort superficielle (description + filters json string)
                differs = (
                    json.dumps(existing.get("filters") or {}, sort_keys=True)
                    != json.dumps(payload.get("filters") or {}, sort_keys=True)
                ) or (existing.get("description") != cohort.description)
                if differs:
                    if apply:
                        client.update_cohort(cohort_id, payload)
                        outcomes.append(
                            ResourceOutcome(
                                kind="cohort",
                                name=cohort.name,
                                action="updated",
                                posthog_id=cohort_id,
                            )
                        )
                    else:
                        outcomes.append(
                            ResourceOutcome(
                                kind="cohort",
                                name=cohort.name,
                                action="would-update",
                                posthog_id=cohort_id,
                            )
                        )
                else:
                    outcomes.append(
                        ResourceOutcome(
                            kind="cohort",
                            name=cohort.name,
                            action="unchanged",
                            posthog_id=cohort_id,
                        )
                    )
        except httpx.HTTPError as e:
            body = ""
            if isinstance(e, httpx.HTTPStatusError):
                body = f" — {e.response.text[:300]}"
            outcomes.append(
                ResourceOutcome(
                    kind="cohort",
                    name=cohort.name,
                    action="failed",
                    error=f"{type(e).__name__}: {e}{body}",
                )
            )

    return outcomes


def reconcile_dashboards(
    client: PostHogClient,
    dashboards: list[DashboardSpec],
    insight_name_to_id: dict[str, int],
    apply: bool,
) -> list[ResourceOutcome]:
    outcomes: list[ResourceOutcome] = []
    try:
        existing_raw = client.list_dashboards()
    except httpx.HTTPError as e:
        for d in dashboards:
            outcomes.append(
                ResourceOutcome(
                    kind="dashboard",
                    name=d.name,
                    action="failed",
                    error=f"list_dashboards HTTP error: {e}",
                )
            )
        return outcomes

    by_name = _index_by_name(existing_raw)
    for dashboard in dashboards:
        payload = dashboard.to_posthog_payload()
        existing = by_name.get(dashboard.name)
        try:
            if existing is None:
                if apply:
                    created = client.create_dashboard(payload)
                    dashboard_id = created["id"]
                    # Attacher tous les insights par PATCH
                    attached = 0
                    for insight_name in dashboard.insight_names:
                        insight_id = insight_name_to_id.get(insight_name)
                        if insight_id is None:
                            continue
                        try:
                            client.add_insight_to_dashboard(insight_id, dashboard_id)
                            attached += 1
                        except httpx.HTTPError:
                            pass
                    outcomes.append(
                        ResourceOutcome(
                            kind="dashboard",
                            name=dashboard.name,
                            action="created",
                            posthog_id=dashboard_id,
                            error=None
                            if attached == len(dashboard.insight_names)
                            else f"only {attached}/{len(dashboard.insight_names)} insights attached",
                        )
                    )
                else:
                    outcomes.append(
                        ResourceOutcome(
                            kind="dashboard", name=dashboard.name, action="would-create"
                        )
                    )
            else:
                dashboard_id = existing["id"]
                if (
                    existing.get("description") != dashboard.description
                    or existing.get("pinned") != dashboard.pinned
                ):
                    if apply:
                        client.update_dashboard(dashboard_id, payload)
                        outcomes.append(
                            ResourceOutcome(
                                kind="dashboard",
                                name=dashboard.name,
                                action="updated",
                                posthog_id=dashboard_id,
                            )
                        )
                    else:
                        outcomes.append(
                            ResourceOutcome(
                                kind="dashboard",
                                name=dashboard.name,
                                action="would-update",
                                posthog_id=dashboard_id,
                            )
                        )
                else:
                    outcomes.append(
                        ResourceOutcome(
                            kind="dashboard",
                            name=dashboard.name,
                            action="unchanged",
                            posthog_id=dashboard_id,
                        )
                    )

                # Attache les insights manquants (idempotent côté PostHog)
                if apply:
                    for insight_name in dashboard.insight_names:
                        insight_id = insight_name_to_id.get(insight_name)
                        if insight_id is None:
                            continue
                        try:
                            client.add_insight_to_dashboard(insight_id, dashboard_id)
                        except httpx.HTTPError:
                            # silencieux : déjà attaché → 200/400 selon plan
                            pass
        except httpx.HTTPError as e:
            body = ""
            if isinstance(e, httpx.HTTPStatusError):
                body = f" — {e.response.text[:300]}"
            outcomes.append(
                ResourceOutcome(
                    kind="dashboard",
                    name=dashboard.name,
                    action="failed",
                    error=f"{type(e).__name__}: {e}{body}",
                )
            )

    return outcomes


# ─────────────────────────────────────────────────────────────────────────────
#  Pretty print
# ─────────────────────────────────────────────────────────────────────────────


def print_summary(outcomes: list[ResourceOutcome]) -> None:
    if not outcomes:
        print("(no outcomes)")
        return
    width_kind = max(8, max(len(o.kind) for o in outcomes))
    width_name = max(20, max(len(o.name) for o in outcomes))
    print(
        f"\n{'STATE':<6} {'KIND':<{width_kind}}  "
        f"{'NAME':<{width_name}}  ID"
    )
    print("-" * (6 + width_kind + width_name + 12))
    for o in outcomes:
        id_str = str(o.posthog_id) if o.posthog_id is not None else "-"
        line = (
            f"{o.status_emoji:<6} {o.kind:<{width_kind}}  "
            f"{o.name:<{width_name}}  {id_str}"
        )
        print(line)
        if o.error:
            print(f"        ↳ {o.error}")
    counts: dict[str, int] = {}
    for o in outcomes:
        counts[o.action] = counts.get(o.action, 0) + 1
    print(
        "\nCounts: "
        + ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
    )


def print_show_config(config: FullConfig) -> None:
    print("=" * 78)
    print("DeepSight — PostHog Growth Config (versionnée)")
    print("=" * 78)
    print(f"\n[Funnels] ({len(config.funnels)})")
    for f in config.funnels:
        print(f"  - {f.name}")
        print(f"      steps: {' -> '.join(f.steps)}")
        print(
            f"      window: {f.conversion_window_seconds // 60} min, "
            f"breakdown: {f.breakdown_property or '-'}"
        )
    print(f"\n[Retention] ({len(config.retention)})")
    for r in config.retention:
        print(f"  - {r.name}")
        print(f"      cohort: {r.target_event} -> returns on: {r.returning_event}")
        print(f"      period: {r.period} x {r.total_intervals}")
    print(f"\n[Trends] ({len(config.trends)})")
    for t in config.trends:
        print(f"  - {t.name}")
        print(
            f"      events: {', '.join(t.events)} | display: {t.display} | "
            f"interval: {t.interval} | math: {t.math}"
        )
    print(f"\n[Cohorts] ({len(config.cohorts)})")
    for c in config.cohorts:
        print(f"  - {c.name}  ({len(c.filters)} filter(s), {c.combinator})")
    print(f"\n[Dashboards] ({len(config.dashboards)})")
    for d in config.dashboards:
        print(f"  - {d.name}  ({len(d.insight_names)} insights)")
    print()


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Provision PostHog insights, cohorts and dashboards (idempotent)."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--show-config",
        action="store_true",
        help="Print la config locale et exit (no API call).",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="List les actions à faire sans modifier PostHog.",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Apply les changements sur PostHog (upsert).",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("POSTHOG_HOST", DEFAULT_HOST),
        help=f"PostHog host (default {DEFAULT_HOST}).",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("POSTHOG_API_KEY"),
        help="PostHog Personal API key (env POSTHOG_API_KEY).",
    )
    parser.add_argument(
        "--project-id",
        default=os.environ.get("POSTHOG_PROJECT_ID"),
        help="PostHog Project ID (env POSTHOG_PROJECT_ID).",
    )
    args = parser.parse_args()

    config = build_config()

    if args.show_config or (
        not args.dry_run and not args.apply and not args.show_config
    ):
        # Default = show-config si rien passé
        print_show_config(config)
        if not args.show_config:
            print(
                "(No mode specified — printed config only. "
                "Use --dry-run or --apply to interact with PostHog.)"
            )
        return 0

    # Mode --dry-run ou --apply : besoin des creds
    missing = []
    if not args.api_key:
        missing.append("POSTHOG_API_KEY (Personal API key, scopes insight/cohort/dashboard:write)")
    if not args.project_id:
        missing.append("POSTHOG_PROJECT_ID")
    if missing:
        print(f"ERROR: missing config: {', '.join(missing)}", file=sys.stderr)
        return 2

    apply = args.apply
    mode_label = "APPLY" if apply else "DRY-RUN"
    print(
        f"\nDeepSight PostHog setup -- mode={mode_label} -- host={args.host} "
        f"-- project={args.project_id}"
    )

    all_outcomes: list[ResourceOutcome] = []
    insight_name_to_id: dict[str, int] = {}

    with PostHogClient(args.host, args.api_key, args.project_id) as client:
        # 1. Funnels (FunnelInsight)
        print("\n[1/4] Funnels...")
        outcomes, ids = reconcile_insights(client, config.funnels, apply, "funnel")
        all_outcomes.extend(outcomes)
        insight_name_to_id.update(ids)

        # 2. Retention
        print("[2/4] Retention insights...")
        outcomes, ids = reconcile_insights(
            client, config.retention, apply, "retention"
        )
        all_outcomes.extend(outcomes)
        insight_name_to_id.update(ids)

        # 3. Trends
        print("[3/4] Trend insights...")
        outcomes, ids = reconcile_insights(client, config.trends, apply, "trend")
        all_outcomes.extend(outcomes)
        insight_name_to_id.update(ids)

        # 4. Cohorts (indépendantes)
        print("[4/4] Cohorts...")
        cohort_outcomes = reconcile_cohorts(client, config.cohorts, apply)
        all_outcomes.extend(cohort_outcomes)

        # 5. Dashboards (groupent les insights par name)
        print("[+]  Dashboards...")
        dashboard_outcomes = reconcile_dashboards(
            client, config.dashboards, insight_name_to_id, apply
        )
        all_outcomes.extend(dashboard_outcomes)

    print_summary(all_outcomes)

    failed = [o for o in all_outcomes if o.action == "failed"]
    if failed:
        print(f"\n[!] {len(failed)} resource(s) failed (see above).")
        return 1

    if not apply:
        print(
            "\n[i] Dry-run completed — re-run with --apply to push changes to PostHog."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
