"""Idempotent Sentry alert rules provisioning for DeepSight.

Reads the rule definitions from :mod:`sentry_alerts_config` and upserts
them into the configured Sentry organization via the public REST API.

Idempotence
-----------
A rule is matched on ``(name, project)``. On every run the script:

1. Lists existing rules for each target project.
2. Looks for a rule with the exact same ``name``.
3. If found → updates it in place (no duplicate).
4. Otherwise → creates a new rule.

So running the script twice does NOT create duplicate rules.

Environment variables
---------------------
Required:
- ``SENTRY_AUTH_TOKEN``           -- bearer token, scope ``alerts:write`` + ``project:read``
- ``SENTRY_ORG_SLUG``             -- e.g. ``deepsight``
- ``SENTRY_PROJECT_SLUG_BACKEND`` -- e.g. ``deepsight-backend``
- ``SENTRY_PROJECT_SLUG_FRONTEND`` -- e.g. ``deepsight-frontend``
- ``SENTRY_PROJECT_SLUG_MOBILE``  -- e.g. ``deepsight-mobile``

Optional:
- ``TELEGRAM_INTEGRATION_INSTALLATION_ID`` -- Sentry integration installation id
  (Settings → Integrations → Telegram → ⓘ → Installation ID).
  If absent, alerts fall back to the default email action so they still fire.

Usage
-----
::

    cd backend
    python scripts/setup_sentry_alerts.py --dry-run --project all
    python scripts/setup_sentry_alerts.py --project backend
    python scripts/setup_sentry_alerts.py --project all
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict
from typing import Any

import httpx

# Local import (script is run from backend/, so add scripts/ to sys.path)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sentry_alerts_config import (  # noqa: E402
    IssueAlertRule,
    MetricAlertRule,
    build_rules,
)

SENTRY_API_BASE = "https://sentry.io/api/0"


# ---------------------------------------------------------------------------
# Env loading
# ---------------------------------------------------------------------------

class EnvError(RuntimeError):
    """Raised when a required env var is missing."""


def _require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise EnvError(f"missing required env var: {key}")
    return value


def load_env() -> dict[str, str | None]:
    return {
        "auth_token": _require_env("SENTRY_AUTH_TOKEN"),
        "org_slug": _require_env("SENTRY_ORG_SLUG"),
        "project_backend": _require_env("SENTRY_PROJECT_SLUG_BACKEND"),
        "project_frontend": _require_env("SENTRY_PROJECT_SLUG_FRONTEND"),
        "project_mobile": _require_env("SENTRY_PROJECT_SLUG_MOBILE"),
        "telegram_installation_id": os.environ.get("TELEGRAM_INTEGRATION_INSTALLATION_ID"),
    }


def project_slug(env: dict[str, str | None], project_name: str) -> str:
    mapping = {
        "backend": env["project_backend"],
        "frontend": env["project_frontend"],
        "mobile": env["project_mobile"],
    }
    slug = mapping.get(project_name)
    if not slug:
        raise ValueError(f"unknown project: {project_name}")
    return slug  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Sentry HTTP client
# ---------------------------------------------------------------------------

class SentryClient:
    """Tiny HTTP wrapper using stdlib types via httpx."""

    def __init__(self, auth_token: str, org_slug: str, dry_run: bool = False) -> None:
        self.org = org_slug
        self.dry_run = dry_run
        self._client = httpx.Client(
            base_url=SENTRY_API_BASE,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    def close(self) -> None:
        self._client.close()

    # ----- Issue alert rules (per-project) -----

    def list_issue_rules(self, project_slug: str) -> list[dict[str, Any]]:
        resp = self._client.get(f"/projects/{self.org}/{project_slug}/rules/")
        resp.raise_for_status()
        return resp.json()

    def create_issue_rule(self, project_slug: str, payload: dict[str, Any]) -> dict[str, Any]:
        if self.dry_run:
            return {"id": "DRY-RUN", "name": payload.get("name")}
        resp = self._client.post(
            f"/projects/{self.org}/{project_slug}/rules/",
            content=json.dumps(payload),
        )
        resp.raise_for_status()
        return resp.json()

    def update_issue_rule(
        self, project_slug: str, rule_id: int | str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        if self.dry_run:
            return {"id": rule_id, "name": payload.get("name")}
        resp = self._client.put(
            f"/projects/{self.org}/{project_slug}/rules/{rule_id}/",
            content=json.dumps(payload),
        )
        resp.raise_for_status()
        return resp.json()

    # ----- Metric alert rules (org-wide, scoped via projects[]) -----

    def list_metric_rules(self) -> list[dict[str, Any]]:
        resp = self._client.get(f"/organizations/{self.org}/alert-rules/")
        resp.raise_for_status()
        return resp.json()

    def create_metric_rule(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self.dry_run:
            return {"id": "DRY-RUN", "name": payload.get("name")}
        resp = self._client.post(
            f"/organizations/{self.org}/alert-rules/",
            content=json.dumps(payload),
        )
        resp.raise_for_status()
        return resp.json()

    def update_metric_rule(self, rule_id: int | str, payload: dict[str, Any]) -> dict[str, Any]:
        if self.dry_run:
            return {"id": rule_id, "name": payload.get("name")}
        resp = self._client.put(
            f"/organizations/{self.org}/alert-rules/{rule_id}/",
            content=json.dumps(payload),
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------

def issue_rule_payload(rule: IssueAlertRule) -> dict[str, Any]:
    """Convert IssueAlertRule into the Sentry API payload."""
    return {
        "name": rule.name,
        "actionMatch": rule.action_match,
        "filterMatch": rule.filter_match,
        "conditions": list(rule.conditions),
        "filters": list(rule.filters),
        "actions": list(rule.actions),
        "frequency": rule.frequency,
        "environment": rule.environment,
    }


def metric_rule_payload(rule: MetricAlertRule, project_slug_value: str) -> dict[str, Any]:
    """Convert MetricAlertRule into the Sentry org-level alert-rules payload."""
    return {
        "name": rule.name,
        "dataset": rule.dataset,
        "query": rule.query,
        "aggregate": rule.aggregate,
        "timeWindow": rule.time_window,
        "thresholdType": rule.threshold_type,
        "resolveThreshold": rule.resolve_threshold,
        "triggers": list(rule.triggers),
        "projects": [project_slug_value],
        "environment": rule.environment,
        "owner": None,
    }


# ---------------------------------------------------------------------------
# Upsert logic
# ---------------------------------------------------------------------------

def upsert_issue_rule(
    client: SentryClient,
    rule: IssueAlertRule,
    project_slug_value: str,
) -> tuple[str, str | int]:
    """Create or update an issue alert rule. Returns (action, rule_id)."""
    existing = client.list_issue_rules(project_slug_value)
    payload = issue_rule_payload(rule)
    for er in existing:
        if er.get("name") == rule.name:
            updated = client.update_issue_rule(project_slug_value, er["id"], payload)
            return ("updated", updated.get("id", er["id"]))
    created = client.create_issue_rule(project_slug_value, payload)
    return ("created", created.get("id", "?"))


def upsert_metric_rule(
    client: SentryClient,
    rule: MetricAlertRule,
    project_slug_value: str,
) -> tuple[str, str | int]:
    """Create or update a metric alert rule. Returns (action, rule_id)."""
    existing = client.list_metric_rules()
    payload = metric_rule_payload(rule, project_slug_value)
    for er in existing:
        if er.get("name") == rule.name:
            updated = client.update_metric_rule(er["id"], payload)
            return ("updated", updated.get("id", er["id"]))
    created = client.create_metric_rule(payload)
    return ("created", created.get("id", "?"))


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run(scope: str, dry_run: bool) -> int:
    try:
        env = load_env()
    except EnvError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if dry_run:
        print(">>> DRY RUN — no API writes will be performed.")
    print(f"Org slug: {env['org_slug']}")
    print(f"Telegram installation id: {env.get('telegram_installation_id') or '(none — falling back to email action)'}")
    print()

    rules = build_rules(env.get("telegram_installation_id"))

    if scope != "all":
        rules = [r for r in rules if r.project == scope]
    if not rules:
        print(f"No rules to apply for scope={scope}", file=sys.stderr)
        return 1

    client = SentryClient(
        auth_token=env["auth_token"],  # type: ignore[arg-type]
        org_slug=env["org_slug"],  # type: ignore[arg-type]
        dry_run=dry_run,
    )

    # Pretty table output.
    header = f"{'PROJECT':<10} {'KIND':<7} {'CRIT':<7} {'NAME':<46} {'ACTION':<10} ID"
    print(header)
    print("-" * len(header))

    successes = 0
    failures: list[tuple[str, str]] = []

    try:
        for rule in rules:
            slug = project_slug(env, rule.project)
            try:
                if isinstance(rule, IssueAlertRule):
                    action, rule_id = upsert_issue_rule(client, rule, slug)
                elif isinstance(rule, MetricAlertRule):
                    action, rule_id = upsert_metric_rule(client, rule, slug)
                else:  # pragma: no cover -- unreachable
                    raise TypeError(f"unknown rule type: {type(rule)!r}")
                successes += 1
                print(
                    f"{rule.project:<10} {rule.kind:<7} {rule.criticality:<7} "
                    f"{rule.name[:46]:<46} {action:<10} {rule_id}"
                )
            except httpx.HTTPStatusError as exc:
                detail = ""
                try:
                    detail = exc.response.text[:300]
                except Exception:
                    pass
                failures.append((rule.name, f"HTTP {exc.response.status_code}: {detail}"))
                print(
                    f"{rule.project:<10} {rule.kind:<7} {rule.criticality:<7} "
                    f"{rule.name[:46]:<46} {'FAILED':<10} -"
                )
            except Exception as exc:  # noqa: BLE001
                failures.append((rule.name, str(exc)))
                print(
                    f"{rule.project:<10} {rule.kind:<7} {rule.criticality:<7} "
                    f"{rule.name[:46]:<46} {'ERROR':<10} -"
                )
    finally:
        client.close()

    print()
    print(f"Summary: {successes} ok / {len(failures)} failed / {len(rules)} total")
    if failures:
        print("\nFailures:")
        for name, reason in failures:
            print(f"  - {name}: {reason}")
        return 1

    if dry_run:
        print("\n(dry-run) preview only -- re-run without --dry-run to apply.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Provision DeepSight Sentry alert rules idempotently.",
    )
    parser.add_argument(
        "--project",
        choices=["backend", "frontend", "mobile", "all"],
        default="all",
        help="scope: which Sentry project to touch (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the plan without performing any API writes",
    )
    parser.add_argument(
        "--show-config",
        action="store_true",
        help="dump the resolved rule definitions as JSON and exit",
    )
    args = parser.parse_args(argv)

    if args.show_config:
        rules = build_rules(os.environ.get("TELEGRAM_INTEGRATION_INSTALLATION_ID"))
        # ``asdict`` works on frozen dataclasses too.
        print(json.dumps([asdict(r) for r in rules], indent=2, default=str))
        return 0

    return run(scope=args.project, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
