"""Cloudflare WAF + Rate Limit + Cache + Page rules config (declarative).

Source de vérité de la configuration que ``setup_cloudflare_waf.py`` applique
de manière idempotente sur la zone Cloudflare de DeepSight.

Ce module est volontairement séparé du script main pour rester lisible et
facilement reviewable — un dev qui veut comprendre ce qui sera appliqué peut
ouvrir UNIQUEMENT ce fichier.

Conventions :
- Le champ ``description`` de chaque rule est la **clé d'idempotence**.
  Le script list les rules existantes, match par description, puis upsert.
  ⚠️ Ne JAMAIS dupliquer une description ou changer une description existante
     sans réfléchir : ça créera une rule dupliquée plutôt qu'un update.
- Toutes les rules sont taggées ``managed_by=setup_cloudflare_waf`` via leur
  description (suffixe ``[managed]``) → un humain qui édite à la main dans le
  dashboard Cloudflare voit immédiatement que la rule est gérée par le script.

Référence Cloudflare Rules language :
https://developers.cloudflare.com/ruleset-engine/rules-language/
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

DEFAULT_HOSTNAME = "api.deepsightsynthesis.com"
MANAGED_TAG = "[managed]"  # Suffixe ajouté à chaque description pour traçabilité

# Stripe webhook source IPs (publiées par Stripe, mises à jour rarement).
# Source : https://stripe.com/files/ips/ips_webhooks.txt
# ⚠️ À re-vérifier 1×/an — Stripe peut ajouter des ranges.
STRIPE_WEBHOOK_IPS: tuple[str, ...] = (
    "3.18.12.63",
    "3.130.192.231",
    "13.235.14.237",
    "13.235.122.149",
    "18.211.135.69",
    "35.154.171.200",
    "52.15.183.38",
    "54.88.130.119",
    "54.88.130.237",
    "54.187.174.169",
    "54.187.205.235",
    "54.187.216.72",
)


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CustomRule:
    """A Cloudflare WAF custom rule (Ruleset Engine, phase=http_request_firewall_custom).

    Attributes
    ----------
    description :
        Human-readable description. **Clé d'idempotence** — doit être unique
        à travers toutes les rules custom de la zone.
    expression :
        Cloudflare Rules language expression. Évaluée pour CHAQUE requête entrante.
    action :
        Action à appliquer si l'expression matche.
        - ``block``     : reject 403
        - ``challenge`` : Managed Challenge (CAPTCHA-like)
        - ``js_challenge`` : JavaScript challenge (silent for legitimate browsers)
        - ``log``       : laisse passer mais log dans Cloudflare Analytics
        - ``skip``      : skip d'autres rules (avancé, pas utilisé ici)
    enabled :
        Pour disable une rule sans la supprimer (debug).
    """

    description: str
    expression: str
    action: Literal["block", "challenge", "js_challenge", "log", "managed_challenge"]
    enabled: bool = True

    def cf_description(self) -> str:
        """Description avec suffixe managed (utilisé pour idempotence)."""
        return f"{self.description} {MANAGED_TAG}"


@dataclass(frozen=True)
class RateLimitRule:
    """A Cloudflare rate-limiting rule (Ruleset Engine, phase=http_ratelimit).

    Attributes
    ----------
    description :
        Clé d'idempotence (idem CustomRule).
    expression :
        Quelles requêtes compter (ex: ``http.request.uri.path eq "/api/auth/login"``).
    requests_per_period :
        Nombre maximal de requêtes autorisées par période.
    period_seconds :
        Fenêtre glissante (10, 60, 600, 3600 supportés par Cloudflare).
    action :
        Action quand le seuil est atteint.
    mitigation_timeout_seconds :
        Pour combien de temps l'IP est blockée/challengée après dépassement.
        Ex: 3600 = 1h.
    characteristics :
        Critères de groupement (par défaut IP). Voir
        https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/#counting-characteristics
    """

    description: str
    expression: str
    requests_per_period: int
    period_seconds: int
    action: Literal["block", "challenge", "managed_challenge", "log"]
    mitigation_timeout_seconds: int = 3600
    characteristics: tuple[str, ...] = ("ip.src", "cf.colo.id")

    def cf_description(self) -> str:
        return f"{self.description} {MANAGED_TAG}"


@dataclass(frozen=True)
class CacheRule:
    """A Cloudflare cache rule (Ruleset Engine, phase=http_request_cache_settings)."""

    description: str
    expression: str
    edge_ttl_seconds: int
    cache: bool = True  # True = force cache, False = bypass cache

    def cf_description(self) -> str:
        return f"{self.description} {MANAGED_TAG}"


@dataclass(frozen=True)
class CloudflareConfig:
    """Top-level configuration container."""

    hostname: str = DEFAULT_HOSTNAME
    custom_rules: tuple[CustomRule, ...] = field(default_factory=tuple)
    rate_limit_rules: tuple[RateLimitRule, ...] = field(default_factory=tuple)
    cache_rules: tuple[CacheRule, ...] = field(default_factory=tuple)


# ---------------------------------------------------------------------------
# Helpers d'expressions (lisibilité)
# ---------------------------------------------------------------------------


def _stripe_ips_expression() -> str:
    """Expression Cloudflare matchant les IPs Stripe webhooks (whitelist)."""
    ips = " ".join(f'"{ip}"' for ip in STRIPE_WEBHOOK_IPS)
    return f"(ip.src in {{{ips}}})"


def _path_eq(path: str) -> str:
    return f'(http.request.uri.path eq "{path}")'


def _path_starts(prefix: str) -> str:
    return f'(starts_with(http.request.uri.path, "{prefix}"))'


def _hostname_match(hostname: str) -> str:
    """Limite la rule à notre hostname API (évite de spammer d'autres zones)."""
    return f'(http.host eq "{hostname}")'


# ---------------------------------------------------------------------------
# Configuration cible
# ---------------------------------------------------------------------------


def build_config(hostname: str = DEFAULT_HOSTNAME) -> CloudflareConfig:
    """Construit la configuration complète à appliquer sur la zone."""

    host = _hostname_match(hostname)

    # ------------------------------ WAF custom rules ----------------------
    custom_rules: tuple[CustomRule, ...] = (
        # 1. Block requests with empty User-Agent or known scrapers
        # ⚠️ User-Agents légitimes attendus :
        #   - Stripe (whitelist handled separately)
        #   - Browsers, mobile app httpx, Chrome extension fetch
        # Bots scrapers communs : python-requests, curl/, scrapy, nikto, sqlmap
        CustomRule(
            description="Block empty UA or known scrapers",
            expression=(
                f"{host} and ("
                '(http.user_agent eq "")'
                ' or (lower(http.user_agent) contains "sqlmap")'
                ' or (lower(http.user_agent) contains "nikto")'
                ' or (lower(http.user_agent) contains "scrapy")'
                ' or (lower(http.user_agent) contains "curl/7.")'
                ' or (lower(http.user_agent) contains "python-requests/")'
                ")"
            ),
            action="block",
        ),
        # 2. Challenge requests sur /api/billing/webhook qui ne viennent pas de Stripe
        # ⚠️ Stripe webhooks nécessitent latence faible & 200 OK rapide → pas de
        # block. On challenge juste les imposters. Page rule (séparée) désactive
        # bot-fight pour cette URL côté Stripe légitime.
        CustomRule(
            description="Challenge non-Stripe IPs on billing webhook",
            expression=(
                f"{host} and "
                f'{_path_eq("/api/billing/webhook")} '
                f"and not {_stripe_ips_expression()}"
            ),
            action="managed_challenge",
        ),
        # 3. Block large body (>10MB) sauf sur /api/exports
        # Un POST à 10MB sur /api/auth/login = clairement abusif
        CustomRule(
            description="Block oversize body except on exports",
            expression=(
                f"{host} and "
                "(http.request.body.size gt 10485760) "
                f"and not {_path_starts('/api/exports')}"
            ),
            action="block",
        ),
        # 4. Challenge auth POST sur ratelimit failover (defence-in-depth)
        # Le rate limit ci-dessous gère le throttling normal. Cette rule
        # filtre des patterns explicitement mauvais (POST sans CT JSON).
        CustomRule(
            description="Challenge non-JSON POST on auth endpoints",
            expression=(
                f"{host} and "
                f'(http.request.method eq "POST") '
                f'and {_path_starts("/api/auth/")} '
                'and not (http.request.headers["content-type"][0] contains "application/json")'
            ),
            action="managed_challenge",
        ),
    )

    # ------------------------------ Rate limit rules ----------------------
    rate_limit_rules: tuple[RateLimitRule, ...] = (
        # /api/auth/login : 5 req/min → block 1h
        # Protection brute-force credential stuffing
        RateLimitRule(
            description="Rate limit /api/auth/login 5/min",
            expression=(
                f'{host} and {_path_eq("/api/auth/login")} '
                'and (http.request.method eq "POST")'
            ),
            requests_per_period=5,
            period_seconds=60,
            action="block",
            mitigation_timeout_seconds=3600,
        ),
        # /api/auth/register : 3 req/min → block 1h
        # Anti-spam création de comptes
        RateLimitRule(
            description="Rate limit /api/auth/register 3/min",
            expression=(
                f'{host} and {_path_eq("/api/auth/register")} '
                'and (http.request.method eq "POST")'
            ),
            requests_per_period=3,
            period_seconds=60,
            action="block",
            mitigation_timeout_seconds=3600,
        ),
        # /api/videos/analyze : 10 req/min — défence-en-profondeur
        # (le backend FastAPI a déjà un middleware Redis-backed, mais si backend
        #  down → cette rule continue de protéger l'infra)
        RateLimitRule(
            description="Rate limit /api/videos/analyze 10/min",
            expression=(
                f'{host} and {_path_eq("/api/videos/analyze")} '
                'and (http.request.method eq "POST")'
            ),
            requests_per_period=10,
            period_seconds=60,
            action="challenge",
            mitigation_timeout_seconds=600,
        ),
        # Wildcard /api/* : 100 req/min → challenge
        # Filet de sécurité global. Un user normal (frontend + mobile) reste sous
        # 100/min largement. Un script abusif sera challenged.
        RateLimitRule(
            description="Rate limit /api/* wildcard 100/min",
            expression=f'{host} and {_path_starts("/api/")}',
            requests_per_period=100,
            period_seconds=60,
            action="managed_challenge",
            mitigation_timeout_seconds=300,
        ),
    )

    # ------------------------------ Cache rules ---------------------------
    cache_rules: tuple[CacheRule, ...] = (
        # /api/health : edge cache 30s
        # → réduit drastiquement charge backend (UptimeRobot ping toutes les 60s,
        #   plus extension health checks, plus mobile, etc.)
        CacheRule(
            description="Edge cache /api/health 30s",
            expression=f'{host} and {_path_eq("/api/health")}',
            edge_ttl_seconds=30,
            cache=True,
        ),
        # /api/tournesol/* : edge cache 5min
        # Données Tournesol évoluent lentement (refresh hourly côté upstream).
        # Cache edge évite N requêtes simultanées au backend qui proxie ensuite
        # vers tournesol.app.
        CacheRule(
            description="Edge cache /api/tournesol/* 5min",
            expression=f'{host} and {_path_starts("/api/tournesol/")} '
            'and (http.request.method eq "GET")',
            edge_ttl_seconds=300,
            cache=True,
        ),
    )

    return CloudflareConfig(
        hostname=hostname,
        custom_rules=custom_rules,
        rate_limit_rules=rate_limit_rules,
        cache_rules=cache_rules,
    )


# ---------------------------------------------------------------------------
# Note Page Rules
# ---------------------------------------------------------------------------
# Les Page Rules legacy (Cloudflare Free tier limité à 3 par zone) ne sont
# **pas** créées par ce script — l'utilisateur les configure manuellement
# dans le dashboard, étape documentée dans docs/RUNBOOK.md §18.
#
# Page rule à créer manuellement :
#   URL pattern : api.deepsightsynthesis.com/api/billing/webhook
#   Settings    :
#     - Browser Integrity Check : Off
#     - Security Level         : Essentially Off
#     - Cache Level            : Bypass
#   Raison : Stripe envoie des webhooks signés HMAC ; toute interception CF
#   peut casser la signature. Bot-fight mode déjà bypass via custom rule #2,
#   mais belt-and-suspenders.
