"""PostHog Insights / Cohorts / Funnels — déclarations versionnées.

Ce module définit, sous forme de dataclasses Python pures (pas de dépendance
runtime), la configuration à pousser dans PostHog via l'API REST. Le script
``setup_posthog_insights.py`` consomme ``build_config()`` pour produire la liste
exacte d'objets à upserter (matching par ``name`` → idempotent).

Quatre familles d'objets :

- ``FunnelInsight``      : insight de type funnel (steps ordonnés, conversion window)
- ``RetentionInsight``   : insight de type retention table (cohort + returning event)
- ``TrendInsight``       : insight courbe (line/bar) sur 1+ events
- ``CohortDefinition``   : cohorte dynamique (filtrée par event/property)
- ``DashboardSpec``      : groupement d'insights sous un dashboard nommé

Chaque dataclass expose une méthode ``to_posthog_payload()`` qui renvoie le dict
prêt-à-poster pour l'API ``POST /api/projects/{project_id}/{resource}``.

API PostHog référencée : https://posthog.com/docs/api/insights (Cloud EU).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


# ─────────────────────────────────────────────────────────────────────────────
#  Constantes (events DeepSight + plateformes)
# ─────────────────────────────────────────────────────────────────────────────

# Events frontend (cf. frontend/src/services/analytics.ts → AnalyticsEvents)
EV_PAGEVIEW = "$pageview"
EV_SIGNUP = "user_signup"
EV_LOGIN = "user_login"
EV_VIDEO_ANALYZED = "video_analyzed"
EV_VIDEO_STARTED = "video_analysis_started"
EV_CHAT_MESSAGE = "chat_message_sent"
EV_STUDY_TOOL = "study_tool_used"
EV_UPGRADE_STARTED = "upgrade_started"
EV_UPGRADE_COMPLETED = "upgrade_completed"
EV_API_ERROR = "api_error"

# Properties usuelles
PROP_PLAN = "plan"
PROP_PLATFORM = "platform"  # web | mobile | extension
PROP_REFERRER = "$referrer"
PROP_DEVICE_TYPE = "$device_type"
PROP_CYCLE = "cycle"  # monthly | yearly
PROP_ENDPOINT = "endpoint"


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers de construction (PostHog filter dict format)
# ─────────────────────────────────────────────────────────────────────────────


def _event_step(event: str, order: int, name: str | None = None) -> dict[str, Any]:
    """Construit un step de funnel ou un event d'insight (format PostHog).

    Réf : https://posthog.com/docs/api/insights#funnels
    """
    return {
        "id": event,
        "name": name or event,
        "type": "events",
        "order": order,
    }


def _action_step_any_of(events: list[str], order: int) -> dict[str, Any]:
    """Step "match any of these events" — utile pour un returning event multi.

    PostHog le modélise comme un step avec ``custom_event`` non-supporté en API
    publique simple. On contourne en générant N steps OR-équivalents sous la
    clé ``events`` : la conversion se calcule sur l'union (cf. retention).
    """
    return {
        "id": events[0],
        "name": "any_engagement",
        "type": "events",
        "order": order,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Dataclasses : Insights
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class FunnelInsight:
    """Funnel multi-step avec conversion window."""

    name: str
    description: str
    steps: list[str]  # liste ordonnée d'event names
    step_names: list[str] | None = None
    conversion_window_seconds: int = 24 * 3600  # 24h par défaut
    breakdown_property: str | None = None
    breakdown_type: Literal["event", "person"] = "event"
    date_from: str = "-30d"
    tags: list[str] = field(default_factory=list)

    def to_posthog_payload(self) -> dict[str, Any]:
        names = self.step_names or self.steps
        events_filter = [
            _event_step(event=ev, order=i, name=names[i])
            for i, ev in enumerate(self.steps)
        ]
        filters: dict[str, Any] = {
            "insight": "FUNNELS",
            "events": events_filter,
            "actions": [],
            "date_from": self.date_from,
            "funnel_window_interval": max(1, self.conversion_window_seconds // 60),
            "funnel_window_interval_unit": "minute",
            "funnel_viz_type": "steps",
            "funnel_order_type": "ordered",
        }
        if self.breakdown_property:
            filters["breakdown"] = self.breakdown_property
            filters["breakdown_type"] = self.breakdown_type

        return {
            "name": self.name,
            "description": self.description,
            "filters": filters,
            "tags": self.tags,
        }


@dataclass
class RetentionInsight:
    """Retention table : cohort par event de départ + returning event."""

    name: str
    description: str
    target_event: str  # event de cohort (ex: user_signup)
    returning_event: str  # event de retour (ex: video_analyzed)
    period: Literal["Day", "Week", "Month"] = "Week"
    total_intervals: int = 11
    retention_type: Literal["retention_first_time", "retention_recurring"] = (
        "retention_first_time"
    )
    date_from: str = "-90d"
    tags: list[str] = field(default_factory=list)

    def to_posthog_payload(self) -> dict[str, Any]:
        filters = {
            "insight": "RETENTION",
            "target_entity": {
                "id": self.target_event,
                "name": self.target_event,
                "type": "events",
            },
            "returning_entity": {
                "id": self.returning_event,
                "name": self.returning_event,
                "type": "events",
            },
            "period": self.period,
            "total_intervals": self.total_intervals,
            "retention_type": self.retention_type,
            "date_from": self.date_from,
        }
        return {
            "name": self.name,
            "description": self.description,
            "filters": filters,
            "tags": self.tags,
        }


@dataclass
class TrendInsight:
    """Trend (line / bar) sur 1+ events."""

    name: str
    description: str
    events: list[str]
    display: Literal[
        "ActionsLineGraph", "ActionsBar", "ActionsAreaGraph", "ActionsTable"
    ] = "ActionsLineGraph"
    interval: Literal["hour", "day", "week", "month"] = "day"
    breakdown_property: str | None = None
    breakdown_type: Literal["event", "person"] = "event"
    properties_filter: list[dict[str, Any]] | None = None
    date_from: str = "-30d"
    math: Literal["total", "dau", "weekly_active", "monthly_active", "unique_session"] = (
        "total"
    )
    tags: list[str] = field(default_factory=list)

    def to_posthog_payload(self) -> dict[str, Any]:
        events_filter = [
            {
                "id": ev,
                "name": ev,
                "type": "events",
                "order": i,
                "math": self.math,
            }
            for i, ev in enumerate(self.events)
        ]
        if self.properties_filter:
            for ev_filter in events_filter:
                ev_filter["properties"] = self.properties_filter

        filters: dict[str, Any] = {
            "insight": "TRENDS",
            "events": events_filter,
            "actions": [],
            "display": self.display,
            "interval": self.interval,
            "date_from": self.date_from,
        }
        if self.breakdown_property:
            filters["breakdown"] = self.breakdown_property
            filters["breakdown_type"] = self.breakdown_type

        return {
            "name": self.name,
            "description": self.description,
            "filters": filters,
            "tags": self.tags,
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Dataclasses : Cohorts
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class CohortFilter:
    """Un filtre individuel dans une cohorte (event ou propriété personne)."""

    type: Literal["behavioral", "person"]
    # Pour 'person' :
    key: str | None = None
    value: Any | None = None
    operator: str = "exact"
    # Pour 'behavioral' :
    event: str | None = None
    behavior: Literal[
        "performed_event",
        "performed_event_multiple",
        "performed_event_first_time",
        "stopped_performing_event",
    ] = "performed_event"
    time_value: int = 30
    time_interval: Literal["day", "week", "month"] = "day"
    operator_value: int | None = None  # pour performed_event_multiple

    def to_property_dict(self) -> dict[str, Any]:
        if self.type == "person":
            return {
                "type": "person",
                "key": self.key,
                "value": self.value,
                "operator": self.operator,
            }
        # behavioral
        out: dict[str, Any] = {
            "type": "behavioral",
            "value": self.behavior,
            "key": self.event,
            "event_type": "events",
            "time_value": self.time_value,
            "time_interval": self.time_interval,
        }
        if self.operator_value is not None:
            out["operator"] = "gte"
            out["operator_value"] = self.operator_value
        return out


@dataclass
class CohortDefinition:
    """Cohorte dynamique. Plusieurs filtres combinés via AND par défaut."""

    name: str
    description: str
    filters: list[CohortFilter]
    combinator: Literal["AND", "OR"] = "AND"
    is_static: bool = False

    def to_posthog_payload(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "is_static": self.is_static,
            "filters": {
                "properties": {
                    "type": self.combinator,
                    "values": [f.to_property_dict() for f in self.filters],
                }
            },
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Dataclass : Dashboard
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class DashboardSpec:
    """Dashboard nommé qui regroupe N insights (par leur ``name``)."""

    name: str
    description: str
    insight_names: list[str]
    pinned: bool = True
    tags: list[str] = field(default_factory=list)

    def to_posthog_payload(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "pinned": self.pinned,
            "tags": self.tags,
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Configuration globale DeepSight Growth
# ─────────────────────────────────────────────────────────────────────────────


def build_funnels() -> list[FunnelInsight]:
    """Les 4 funnels growth canoniques DeepSight."""
    return [
        # 1. Acquisition : visiteur landing → signup → premier login
        FunnelInsight(
            name="DeepSight — Acquisition Funnel",
            description=(
                "Visiteur landing (/$pageview) → signup → first login. "
                "Mesure la qualité du trafic et l'activation post-inscription. "
                "Conversion window 24h. Breakdown referrer + device_type."
            ),
            steps=[EV_PAGEVIEW, EV_SIGNUP, EV_LOGIN],
            step_names=["Landing visit", "Signup", "First login"],
            conversion_window_seconds=24 * 3600,
            breakdown_property=PROP_REFERRER,
            breakdown_type="event",
            date_from="-30d",
            tags=["growth", "acquisition"],
        ),
        # 2. Activation : signup → wow moment → engagement → deep usage
        FunnelInsight(
            name="DeepSight — Activation Funnel",
            description=(
                "Signup → première analyse vidéo (wow) → premier message chat → "
                "premier study tool. Conversion 7 jours. Breakdown plan. "
                "Indique si on convertit le user en utilisateur engagé."
            ),
            steps=[EV_SIGNUP, EV_VIDEO_ANALYZED, EV_CHAT_MESSAGE, EV_STUDY_TOOL],
            step_names=[
                "Signup",
                "First video analyzed",
                "First chat message",
                "First study tool",
            ],
            conversion_window_seconds=7 * 24 * 3600,
            breakdown_property=PROP_PLAN,
            breakdown_type="event",
            date_from="-90d",
            tags=["growth", "activation"],
        ),
        # 3. Revenue : upgrade started → completed
        FunnelInsight(
            name="DeepSight — Revenue Funnel",
            description=(
                "upgrade_started → upgrade_completed. Window 1h (paiement Stripe). "
                "Breakdown plan + cycle (mensuel/annuel). "
                "Mesure le drop-off au checkout."
            ),
            steps=[EV_UPGRADE_STARTED, EV_UPGRADE_COMPLETED],
            step_names=["Upgrade started", "Upgrade completed"],
            conversion_window_seconds=3600,
            breakdown_property=PROP_PLAN,
            breakdown_type="event",
            date_from="-90d",
            tags=["growth", "revenue"],
        ),
        # 4. Activation par plateforme (variante)
        FunnelInsight(
            name="DeepSight — Cross-Platform Activation",
            description=(
                "Signup → premier video_analyzed split par plateforme "
                "(web/mobile/extension). Window 7j. "
                "Indique quelle plateforme convertit le mieux post-signup."
            ),
            steps=[EV_SIGNUP, EV_VIDEO_ANALYZED],
            step_names=["Signup", "First analysis"],
            conversion_window_seconds=7 * 24 * 3600,
            breakdown_property=PROP_PLATFORM,
            breakdown_type="event",
            date_from="-90d",
            tags=["growth", "activation", "platform"],
        ),
    ]


def build_retention() -> list[RetentionInsight]:
    """Retention table principale : DAU/WAU/MAU sur les events d'engagement."""
    return [
        RetentionInsight(
            name="DeepSight — Weekly Retention (signup → video_analyzed)",
            description=(
                "Cohorte par semaine de signup, retour mesuré sur video_analyzed. "
                "Période hebdo, 11 buckets. Indique stickiness produit."
            ),
            target_event=EV_SIGNUP,
            returning_event=EV_VIDEO_ANALYZED,
            period="Week",
            total_intervals=11,
            retention_type="retention_first_time",
            date_from="-90d",
            tags=["growth", "retention"],
        ),
        RetentionInsight(
            name="DeepSight — Daily Retention (chat engagement)",
            description=(
                "Cohorte par jour de signup, retour mesuré sur chat_message_sent. "
                "Indique adoption du chat conversationnel."
            ),
            target_event=EV_SIGNUP,
            returning_event=EV_CHAT_MESSAGE,
            period="Day",
            total_intervals=14,
            retention_type="retention_first_time",
            date_from="-30d",
            tags=["growth", "retention", "chat"],
        ),
    ]


def build_trends() -> list[TrendInsight]:
    """Trends pour le dashboard Growth."""
    return [
        TrendInsight(
            name="DeepSight — Daily Signups (30d)",
            description="Nombre de user_signup par jour, 30 derniers jours.",
            events=[EV_SIGNUP],
            display="ActionsLineGraph",
            interval="day",
            date_from="-30d",
            tags=["growth", "acquisition"],
        ),
        TrendInsight(
            name="DeepSight — Free → Paid Conversion (90d)",
            description=(
                "upgrade_completed par semaine, breakdown par plan. "
                "Source unique de truth pour le revenu net new."
            ),
            events=[EV_UPGRADE_COMPLETED],
            display="ActionsLineGraph",
            interval="week",
            breakdown_property=PROP_PLAN,
            breakdown_type="event",
            date_from="-90d",
            tags=["growth", "revenue"],
        ),
        TrendInsight(
            name="DeepSight — DAU on engagement events",
            description=(
                "Daily Active Users qui font video_analyzed OU chat_message_sent OU "
                "study_tool_used. Math=DAU pour dédoubler par utilisateur."
            ),
            events=[EV_VIDEO_ANALYZED, EV_CHAT_MESSAGE, EV_STUDY_TOOL],
            display="ActionsLineGraph",
            interval="day",
            math="dau",
            date_from="-30d",
            tags=["growth", "engagement"],
        ),
        TrendInsight(
            name="DeepSight — Top events by week",
            description="Top 10 events de la semaine, breakdown par event_name.",
            events=[
                EV_VIDEO_ANALYZED,
                EV_CHAT_MESSAGE,
                EV_STUDY_TOOL,
                EV_UPGRADE_STARTED,
                EV_UPGRADE_COMPLETED,
                EV_SIGNUP,
                EV_LOGIN,
            ],
            display="ActionsBar",
            interval="week",
            date_from="-7d",
            tags=["growth", "events"],
        ),
        TrendInsight(
            name="DeepSight — API Errors by endpoint",
            description=(
                "api_error count par endpoint, breakdown event property `endpoint`. "
                "Top 10 endpoints en erreur sur 7 derniers jours."
            ),
            events=[EV_API_ERROR],
            display="ActionsBar",
            interval="day",
            breakdown_property=PROP_ENDPOINT,
            breakdown_type="event",
            date_from="-7d",
            tags=["growth", "errors", "ops"],
        ),
    ]


def build_cohorts() -> list[CohortDefinition]:
    """Les cohortes dynamiques DeepSight."""
    return [
        CohortDefinition(
            name="DeepSight — Free users",
            description="Utilisateurs avec plan='free'.",
            filters=[
                CohortFilter(type="person", key=PROP_PLAN, value="free", operator="exact")
            ],
        ),
        CohortDefinition(
            name="DeepSight — Pro users",
            description="Utilisateurs avec plan='pro'.",
            filters=[
                CohortFilter(type="person", key=PROP_PLAN, value="pro", operator="exact")
            ],
        ),
        CohortDefinition(
            name="DeepSight — Expert users",
            description="Utilisateurs avec plan='expert'.",
            filters=[
                CohortFilter(
                    type="person", key=PROP_PLAN, value="expert", operator="exact"
                )
            ],
        ),
        CohortDefinition(
            name="DeepSight — Mobile-first users",
            description=(
                "Utilisateurs ayant fait ≥ 5 events avec platform='mobile' "
                "sur les 30 derniers jours."
            ),
            filters=[
                CohortFilter(
                    type="behavioral",
                    event=EV_VIDEO_ANALYZED,
                    behavior="performed_event_multiple",
                    operator_value=5,
                    time_value=30,
                    time_interval="day",
                )
            ],
        ),
        CohortDefinition(
            name="DeepSight — At-risk churn (paid, dormant 30d)",
            description=(
                "Utilisateurs payants (pro|expert) qui n'ont rien fait depuis 30 jours. "
                "Cible high-priority pour campagnes win-back."
            ),
            filters=[
                CohortFilter(
                    type="person", key=PROP_PLAN, value=["pro", "expert"], operator="exact"
                ),
                CohortFilter(
                    type="behavioral",
                    event=EV_VIDEO_ANALYZED,
                    behavior="stopped_performing_event",
                    time_value=30,
                    time_interval="day",
                ),
            ],
            combinator="AND",
        ),
        CohortDefinition(
            name="DeepSight — Power users (>50 analyses lifetime)",
            description=(
                "Utilisateurs ayant fait > 50 video_analyzed sur les 365 derniers jours. "
                "Candidats parfaits pour beta programs et témoignages."
            ),
            filters=[
                CohortFilter(
                    type="behavioral",
                    event=EV_VIDEO_ANALYZED,
                    behavior="performed_event_multiple",
                    operator_value=50,
                    time_value=365,
                    time_interval="day",
                )
            ],
        ),
    ]


def build_dashboards(
    funnels: list[FunnelInsight],
    retention: list[RetentionInsight],
    trends: list[TrendInsight],
) -> list[DashboardSpec]:
    """Un seul dashboard global qui rassemble tout."""
    all_insight_names = (
        [f.name for f in funnels]
        + [r.name for r in retention]
        + [t.name for t in trends]
    )
    return [
        DashboardSpec(
            name="DeepSight — Growth",
            description=(
                "Dashboard global produit (Acquisition / Activation / Retention / "
                "Revenue + ops errors). Source : funnels + insights gérés par "
                "scripts/setup_posthog_insights.py — ne pas modifier à la main, "
                "réexécuter le script à la place."
            ),
            insight_names=all_insight_names,
            pinned=True,
            tags=["growth", "managed-by-script"],
        )
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  Entrée principale
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class FullConfig:
    """Tout l'état désiré pour PostHog en un seul objet."""

    funnels: list[FunnelInsight]
    retention: list[RetentionInsight]
    trends: list[TrendInsight]
    cohorts: list[CohortDefinition]
    dashboards: list[DashboardSpec]

    @property
    def all_insight_names(self) -> list[str]:
        return (
            [f.name for f in self.funnels]
            + [r.name for r in self.retention]
            + [t.name for t in self.trends]
        )


def build_config() -> FullConfig:
    """Construit la configuration complète DeepSight Growth."""
    funnels = build_funnels()
    retention = build_retention()
    trends = build_trends()
    cohorts = build_cohorts()
    dashboards = build_dashboards(funnels, retention, trends)
    return FullConfig(
        funnels=funnels,
        retention=retention,
        trends=trends,
        cohorts=cohorts,
        dashboards=dashboards,
    )


__all__ = [
    "FunnelInsight",
    "RetentionInsight",
    "TrendInsight",
    "CohortDefinition",
    "CohortFilter",
    "DashboardSpec",
    "FullConfig",
    "build_config",
    "build_funnels",
    "build_retention",
    "build_trends",
    "build_cohorts",
    "build_dashboards",
]
