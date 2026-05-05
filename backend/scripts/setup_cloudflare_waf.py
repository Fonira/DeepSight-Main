"""Idempotent Cloudflare WAF + Rate Limit + Cache setup for DeepSight API.

Usage
-----
    # Affiche la config qui sera appliquée (read-only, aucun appel API)
    python backend/scripts/setup_cloudflare_waf.py --show-config

    # Liste les rules existantes côté Cloudflare et affiche un diff (no-write)
    CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... \
        python backend/scripts/setup_cloudflare_waf.py --dry-run

    # Applique réellement (upsert) les rules sur la zone
    CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... \
        python backend/scripts/setup_cloudflare_waf.py --apply

Comportement
------------
- Idempotent : matche les rules existantes par leur ``description`` (suffixée
  ``[managed]``). Si une rule existante porte la même description que celle
  définie en config → UPDATE. Sinon → CREATE.
- Robust : erreur sur une rule n'arrête pas le script ; reporting final
  table-formatted (created / updated / skipped / failed).
- Pas de delete : si on retire une rule de la config Python, le script ne la
  supprime pas automatiquement (safety). Suppression manuelle dans le
  dashboard, ou via flag `--prune` (NON IMPLÉMENTÉ V1, voir TODO).

Pré-requis
----------
1. Domaine ``deepsightsynthesis.com`` géré par Cloudflare (déjà le cas en prod).
2. ``api.deepsightsynthesis.com`` en mode proxied (orange cloud).
3. SSL/TLS de la zone configuré en **Full (strict)**.
4. ``CLOUDFLARE_API_TOKEN`` créé avec scopes ``Zone:Read`` + ``Zone WAF:Edit``.
5. ``CLOUDFLARE_ZONE_ID`` récupéré dans l'overview de la zone.

Voir docs/RUNBOOK.md §18 pour la procédure complète.

Limitations connues
-------------------
- Page rules (legacy) NON gérées par ce script — config manuelle UI.
- Suppression de rules orphelines : NON IMPLÉMENTÉ (TODO --prune).
- Cloudflare Free Plan limite : 5 custom WAF rules + Pro tier requis pour rate
  limiting avancé (>= 10K req/mo). Vérifier votre plan avant d'apply.
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Any

import httpx

# Permettre d'exécuter le script depuis backend/ ou root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cloudflare_rules_config import (  # noqa: E402
    DEFAULT_HOSTNAME,
    CacheRule,
    CloudflareConfig,
    CustomRule,
    RateLimitRule,
    build_config,
)


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
HTTP_TIMEOUT = 30.0


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------


@dataclass
class RuleResult:
    """Result of upserting a single rule."""

    description: str
    kind: str  # "custom" | "rate_limit" | "cache"
    status: str  # "created" | "updated" | "skipped" | "failed" | "would-create" | "would-update"
    detail: str = ""

    def emoji(self) -> str:
        return {
            "created": "[+]",
            "updated": "[~]",
            "skipped": "[=]",
            "failed": "[!]",
            "would-create": "[?+]",
            "would-update": "[?~]",
        }.get(self.status, "[ ]")


# ---------------------------------------------------------------------------
# Cloudflare API client
# ---------------------------------------------------------------------------


class CloudflareClient:
    """Minimal Cloudflare v4 API client used by this script.

    Uses ``httpx`` (already in deps). No SDK because we only need a handful of
    endpoints and want zero magic.
    """

    def __init__(self, api_token: str, zone_id: str) -> None:
        if not api_token:
            raise ValueError("CLOUDFLARE_API_TOKEN env var is required")
        if not zone_id:
            raise ValueError("CLOUDFLARE_ZONE_ID env var is required")
        self.zone_id = zone_id
        self._client = httpx.Client(
            base_url=CLOUDFLARE_API_BASE,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            timeout=HTTP_TIMEOUT,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "CloudflareClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # --- low-level helpers ------------------------------------------------

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        resp = self._client.request(method, path, **kwargs)
        if resp.status_code >= 400:
            try:
                payload = resp.json()
            except Exception:  # noqa: BLE001
                payload = {"raw": resp.text}
            raise CloudflareApiError(
                status=resp.status_code,
                method=method,
                path=path,
                payload=payload,
            )
        data = resp.json()
        if not data.get("success", True):
            raise CloudflareApiError(
                status=resp.status_code,
                method=method,
                path=path,
                payload=data,
            )
        return data

    # --- entrypoints used by the script ----------------------------------

    def verify_token(self) -> None:
        """Vérifie que le token est valide."""
        self._request("GET", "/user/tokens/verify")

    def get_zone(self) -> dict[str, Any]:
        """Récupère les infos de la zone (sanity check + nom)."""
        return self._request("GET", f"/zones/{self.zone_id}")["result"]

    # --- Rulesets (Engine V2) --------------------------------------------
    # Cloudflare has migrated WAF custom + rate limiting + cache settings
    # to the unified "Ruleset Engine". Each phase has its own entrypoint
    # ruleset per zone.

    def get_or_create_entrypoint_ruleset(self, phase: str) -> dict[str, Any]:
        """Get the zone-level entrypoint ruleset for ``phase``, creating if needed.

        Phases used by this script :
        - ``http_request_firewall_custom``      : WAF custom rules
        - ``http_ratelimit``                    : rate limit rules
        - ``http_request_cache_settings``       : cache rules
        """
        try:
            return self._request(
                "GET",
                f"/zones/{self.zone_id}/rulesets/phases/{phase}/entrypoint",
            )["result"]
        except CloudflareApiError as exc:
            # Cloudflare returns 404 when the entrypoint doesn't exist yet
            if exc.status == 404:
                created = self._request(
                    "POST",
                    f"/zones/{self.zone_id}/rulesets",
                    json={
                        "name": f"DeepSight managed — {phase}",
                        "description": "Auto-created by setup_cloudflare_waf.py",
                        "kind": "zone",
                        "phase": phase,
                        "rules": [],
                    },
                )["result"]
                return created
            raise

    def add_rule(self, ruleset_id: str, rule: dict[str, Any]) -> dict[str, Any]:
        """Append a rule to a ruleset (server-side append)."""
        return self._request(
            "POST",
            f"/zones/{self.zone_id}/rulesets/{ruleset_id}/rules",
            json=rule,
        )["result"]

    def update_rule(
        self, ruleset_id: str, rule_id: str, rule: dict[str, Any]
    ) -> dict[str, Any]:
        """Update a single rule by ID."""
        return self._request(
            "PATCH",
            f"/zones/{self.zone_id}/rulesets/{ruleset_id}/rules/{rule_id}",
            json=rule,
        )["result"]


class CloudflareApiError(Exception):
    """Raised when Cloudflare API returns a non-success response."""

    def __init__(
        self,
        *,
        status: int,
        method: str,
        path: str,
        payload: dict[str, Any],
    ) -> None:
        self.status = status
        self.method = method
        self.path = path
        self.payload = payload
        errors = payload.get("errors") if isinstance(payload, dict) else None
        msg = (
            f"Cloudflare API {method} {path} -> HTTP {status} : "
            f"{errors or payload}"
        )
        super().__init__(msg)


# ---------------------------------------------------------------------------
# Rule serialization (dataclass → Cloudflare API JSON)
# ---------------------------------------------------------------------------


def _serialize_custom_rule(rule: CustomRule) -> dict[str, Any]:
    return {
        "description": rule.cf_description(),
        "expression": rule.expression,
        "action": rule.action,
        "enabled": rule.enabled,
    }


def _serialize_rate_limit_rule(rule: RateLimitRule) -> dict[str, Any]:
    return {
        "description": rule.cf_description(),
        "expression": rule.expression,
        "action": rule.action,
        "ratelimit": {
            "characteristics": list(rule.characteristics),
            "period": rule.period_seconds,
            "requests_per_period": rule.requests_per_period,
            "mitigation_timeout": rule.mitigation_timeout_seconds,
        },
        "enabled": True,
    }


def _serialize_cache_rule(rule: CacheRule) -> dict[str, Any]:
    """Cache rules use ``set_cache_settings`` action with parameters."""
    return {
        "description": rule.cf_description(),
        "expression": rule.expression,
        "action": "set_cache_settings",
        "action_parameters": {
            "cache": rule.cache,
            "edge_ttl": {
                "mode": "override_origin",
                "default": rule.edge_ttl_seconds,
            },
        },
        "enabled": True,
    }


# ---------------------------------------------------------------------------
# Upsert logic (idempotent)
# ---------------------------------------------------------------------------


def _find_existing(rules: list[dict[str, Any]], description: str) -> dict[str, Any] | None:
    """Trouve une rule existante par description exacte."""
    for r in rules:
        if r.get("description") == description:
            return r
    return None


def _rules_differ(existing: dict[str, Any], desired: dict[str, Any]) -> bool:
    """Détermine s'il y a un vrai diff entre rule existante et desired.

    On compare uniquement les champs qu'on contrôle (expression, action,
    enabled, ratelimit, action_parameters). Cloudflare ajoute des champs
    serveur (id, ref, version, last_updated) qu'on ignore.
    """
    keys = ("expression", "action", "enabled", "ratelimit", "action_parameters")
    for k in keys:
        if existing.get(k) != desired.get(k):
            return True
    return False


def _upsert_rules(
    cf: CloudflareClient,
    *,
    phase: str,
    kind: str,
    serialized: list[dict[str, Any]],
    apply: bool,
    results: list[RuleResult],
) -> None:
    """Upsert a list of serialized rules in a single phase ruleset."""
    try:
        ruleset = cf.get_or_create_entrypoint_ruleset(phase)
    except CloudflareApiError as exc:
        for r in serialized:
            results.append(
                RuleResult(
                    description=r["description"],
                    kind=kind,
                    status="failed",
                    detail=f"ruleset fetch: {exc}",
                )
            )
        return

    existing_rules = ruleset.get("rules") or []
    ruleset_id = ruleset["id"]

    for desired in serialized:
        desc = desired["description"]
        try:
            match = _find_existing(existing_rules, desc)
            if match is None:
                if not apply:
                    results.append(
                        RuleResult(desc, kind, "would-create", "no existing match")
                    )
                    continue
                cf.add_rule(ruleset_id, desired)
                results.append(RuleResult(desc, kind, "created"))
            else:
                if not _rules_differ(match, desired):
                    results.append(RuleResult(desc, kind, "skipped", "in sync"))
                    continue
                if not apply:
                    results.append(
                        RuleResult(desc, kind, "would-update", "diff detected")
                    )
                    continue
                cf.update_rule(ruleset_id, match["id"], desired)
                results.append(RuleResult(desc, kind, "updated"))
        except CloudflareApiError as exc:
            results.append(RuleResult(desc, kind, "failed", str(exc)))
        except Exception as exc:  # noqa: BLE001
            results.append(RuleResult(desc, kind, "failed", repr(exc)))


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------


def _print_config(cfg: CloudflareConfig) -> None:
    print(f"Hostname target : {cfg.hostname}")
    print()
    print(f"=== {len(cfg.custom_rules)} WAF custom rules ===")
    for r in cfg.custom_rules:
        print(f"  - {r.cf_description()}")
        print(f"    action     : {r.action}")
        print(f"    expression : {r.expression[:120]}{'...' if len(r.expression) > 120 else ''}")
    print()
    print(f"=== {len(cfg.rate_limit_rules)} rate limit rules ===")
    for r in cfg.rate_limit_rules:
        print(f"  - {r.cf_description()}")
        print(
            f"    {r.requests_per_period}/{r.period_seconds}s -> {r.action} "
            f"(timeout {r.mitigation_timeout_seconds}s)"
        )
        print(f"    expression : {r.expression[:120]}{'...' if len(r.expression) > 120 else ''}")
    print()
    print(f"=== {len(cfg.cache_rules)} cache rules ===")
    for r in cfg.cache_rules:
        print(
            f"  - {r.cf_description()} "
            f"(edge_ttl={r.edge_ttl_seconds}s, cache={r.cache})"
        )
    print()
    print("Page Rules : configurer manuellement (voir docs/RUNBOOK.md §18)")
    print("  - api.deepsightsynthesis.com/api/billing/webhook -> Security: Off")


def _print_results_table(results: list[RuleResult]) -> None:
    if not results:
        print("(no rules processed)")
        return

    by_status: dict[str, int] = {}
    for r in results:
        by_status[r.status] = by_status.get(r.status, 0) + 1

    print()
    print("=" * 80)
    print(f"{'STATUS':<14} {'KIND':<12} DESCRIPTION")
    print("-" * 80)
    for r in results:
        desc = r.description if len(r.description) <= 50 else r.description[:47] + "..."
        line = f"{r.emoji()} {r.status:<10} {r.kind:<12} {desc}"
        if r.detail and r.status in ("failed", "would-update"):
            line += f"\n              {r.detail[:200]}"
        print(line)
    print("=" * 80)

    summary_parts = [f"{count} {status}" for status, count in sorted(by_status.items())]
    print(f"Summary : {', '.join(summary_parts)}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


_HELP_EPILOG = """\
Examples:
  # Print desired config (no API call)
  python backend/scripts/setup_cloudflare_waf.py --show-config

  # Diff against Cloudflare without writing
  CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... \\
      python backend/scripts/setup_cloudflare_waf.py --dry-run

  # Apply (create/update) rules on Cloudflare
  CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... \\
      python backend/scripts/setup_cloudflare_waf.py --apply

See docs/RUNBOOK.md section 18 for the full procedure.
"""


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Idempotent Cloudflare WAF + Rate Limit + Cache setup for DeepSight API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_HELP_EPILOG,
    )
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--show-config",
        action="store_true",
        help="Print the desired configuration (no API calls).",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute diff against current Cloudflare state but DON'T apply.",
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Actually create/update rules on Cloudflare.",
    )
    p.add_argument(
        "--hostname",
        default=os.environ.get("CLOUDFLARE_HOSTNAME", DEFAULT_HOSTNAME),
        help="Hostname filter for rules (default: api.deepsightsynthesis.com)",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    cfg = build_config(hostname=args.hostname)

    if args.show_config:
        _print_config(cfg)
        return 0

    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    zone_id = os.environ.get("CLOUDFLARE_ZONE_ID", "")
    if not api_token or not zone_id:
        print(
            "ERROR : CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID env vars are required.",
            file=sys.stderr,
        )
        print(
            "Create token at https://dash.cloudflare.com/profile/api-tokens",
            file=sys.stderr,
        )
        print("Find zone ID in dashboard -> Overview -> API panel.", file=sys.stderr)
        return 2

    apply = args.apply

    print(f"Mode : {'APPLY' if apply else 'DRY-RUN'}")
    print(f"Hostname : {args.hostname}")
    print(f"Zone ID : {zone_id[:8]}***{zone_id[-4:]}")

    try:
        with CloudflareClient(api_token=api_token, zone_id=zone_id) as cf:
            cf.verify_token()
            zone = cf.get_zone()
            print(f"Zone name : {zone.get('name')} (status={zone.get('status')})")
            print()

            results: list[RuleResult] = []

            _upsert_rules(
                cf,
                phase="http_request_firewall_custom",
                kind="custom",
                serialized=[_serialize_custom_rule(r) for r in cfg.custom_rules],
                apply=apply,
                results=results,
            )
            _upsert_rules(
                cf,
                phase="http_ratelimit",
                kind="rate_limit",
                serialized=[_serialize_rate_limit_rule(r) for r in cfg.rate_limit_rules],
                apply=apply,
                results=results,
            )
            _upsert_rules(
                cf,
                phase="http_request_cache_settings",
                kind="cache",
                serialized=[_serialize_cache_rule(r) for r in cfg.cache_rules],
                apply=apply,
                results=results,
            )

            _print_results_table(results)

            failures = [r for r in results if r.status == "failed"]
            if failures:
                print(
                    f"\n{len(failures)} rule(s) failed — see detail above.",
                    file=sys.stderr,
                )
                return 1

            if not apply:
                print(
                    "\nDry-run complete. Re-run with --apply to actually create/update rules."
                )
            else:
                print("\nApply complete. Verify in Cloudflare dashboard -> Security -> WAF.")
            return 0

    except CloudflareApiError as exc:
        print(f"FATAL : {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FATAL : {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
