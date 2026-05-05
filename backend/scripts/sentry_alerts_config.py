"""Sentry alert rules configuration for DeepSight.

Source-of-truth for the 6 production alert rules managed by
``setup_sentry_alerts.py``. Edit this file to adjust thresholds,
add new rules, or change criticality, then re-run the setup script.

Each rule targets a specific Sentry project (backend / frontend / mobile)
and is matched idempotently by ``name`` + ``project`` on each run.

References:
- https://docs.sentry.io/api/alerts/create-an-issue-alert-rule-for-a-project/
- https://docs.sentry.io/api/alerts/create-a-metric-alert-rule-for-an-organization/
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Criticality = Literal["low", "medium", "high"]
Project = Literal["backend", "frontend", "mobile"]
RuleKind = Literal["issue", "metric"]


@dataclass(frozen=True)
class IssueAlertRule:
    """Issue alert rule (filters/conditions on raw events).

    Maps to ``POST /api/0/projects/{org}/{project}/rules/`` in the Sentry API.
    """

    name: str
    project: Project
    criticality: Criticality
    description: str
    # Sentry payload fields (see API ref).
    conditions: list[dict[str, Any]]
    filters: list[dict[str, Any]] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    action_match: Literal["all", "any", "none"] = "all"
    filter_match: Literal["all", "any", "none"] = "all"
    frequency: int = 30  # min minutes between repeated alerts for the same issue
    environment: str | None = "production"
    kind: RuleKind = "issue"


@dataclass(frozen=True)
class MetricAlertRule:
    """Metric alert rule (aggregations on transactions / sessions).

    Maps to ``POST /api/0/organizations/{org}/alert-rules/`` in the Sentry API.
    """

    name: str
    project: Project
    criticality: Criticality
    description: str
    # Sentry payload fields (see API ref).
    dataset: Literal["events", "transactions", "metrics", "sessions"]
    query: str
    aggregate: str  # ex: "p95(transaction.duration)" or "count()"
    time_window: int  # minutes
    threshold_type: int  # 0 = above, 1 = below
    resolve_threshold: float | None
    triggers: list[dict[str, Any]]
    environment: str | None = "production"
    kind: RuleKind = "metric"


# ---------------------------------------------------------------------------
# Telegram action helper
# ---------------------------------------------------------------------------

def telegram_action(installation_id: str | None, room: str = "") -> list[dict[str, Any]]:
    """Build the Sentry "send notification to Telegram" action.

    If ``installation_id`` is None, falls back to the default project mail
    action so the rule still fires (without Telegram). The Telegram
    integration must be installed manually first (see RUNBOOK §17).
    """
    if not installation_id:
        # Fallback: send to all members on the project's mail plugin.
        return [
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetType": "IssueOwners",
                "targetIdentifier": "",
                "fallthroughType": "ActiveMembers",
            }
        ]
    return [
        {
            "id": "sentry.integrations.telegram.notify_action.TelegramNotifyServiceAction",
            "integration": installation_id,
            "room": room,
            "tags": "level,environment",
        }
    ]


# ---------------------------------------------------------------------------
# Rule definitions — 6 alerts (3 backend, 2 frontend, 1 mobile)
# ---------------------------------------------------------------------------

def build_rules(telegram_installation_id: str | None) -> list[IssueAlertRule | MetricAlertRule]:
    """Return the canonical list of 6 production alert rules."""
    tg = telegram_action(telegram_installation_id)

    return [
        # -------------------------------------------------------------------
        # 1. BACKEND — HTTP 500 spike (>10 events/hour at level:error)
        # -------------------------------------------------------------------
        IssueAlertRule(
            name="[backend] HTTP 500 spike (>10/h)",
            project="backend",
            criticality="high",
            description=(
                "Triggers when more than 10 ERROR-level events are seen in a "
                "rolling 1-hour window. Catches sudden 5xx surges from the "
                "FastAPI app (Mistral failures, DB outages, panic in worker)."
            ),
            conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "value": 10,
                    "interval": "1h",
                    "comparisonType": "count",
                }
            ],
            filters=[
                {
                    "id": "sentry.rules.filters.level.LevelFilter",
                    "match": "gte",
                    "level": "40",  # ERROR
                }
            ],
            actions=tg,
            action_match="all",
            filter_match="all",
            frequency=30,
        ),

        # -------------------------------------------------------------------
        # 2. BACKEND — Latency p95 > 5s on transactions (rolling 5 min)
        # -------------------------------------------------------------------
        MetricAlertRule(
            name="[backend] Latency p95 > 5s",
            project="backend",
            criticality="high",
            description=(
                "Triggers when the p95 of transaction.duration exceeds 5000 ms "
                "over the last 5 minutes. Production p95 should stay <2s for "
                "REST handlers and <8s for /api/videos/analyze (excluded via "
                "the dataset query)."
            ),
            dataset="transactions",
            query='event.type:transaction !transaction:"/api/videos/analyze"',
            aggregate="p95(transaction.duration)",
            time_window=5,
            threshold_type=0,  # above threshold
            resolve_threshold=3000.0,
            triggers=[
                {
                    "label": "critical",
                    "alertThreshold": 5000.0,
                    "actions": tg,
                }
            ],
        ),

        # -------------------------------------------------------------------
        # 3. BACKEND — Sentry quota approaching (>80% of monthly events ingested)
        # -------------------------------------------------------------------
        # NOTE: Sentry does not expose a clean "quota %" metric in alert rules,
        # so we approximate it with a high-volume event-frequency rule that
        # matches when raw event count crosses an org-tuned threshold over 24h.
        # Adjust ``value`` to match your monthly quota / 30 / 0.8.
        IssueAlertRule(
            name="[backend] Sentry quota approaching (80%)",
            project="backend",
            criticality="low",
            description=(
                "Daily proxy for Sentry monthly quota. Triggers when raw event "
                "count over 24h exceeds 80%% of the daily allotment "
                "(monthly_quota / 30). Adjust the ``value`` field in code "
                "when the Sentry plan changes."
            ),
            conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "value": 800,  # ~80% of 1k daily events; tune for your plan
                    "interval": "24h",
                    "comparisonType": "count",
                }
            ],
            filters=[],
            actions=tg,
            action_match="all",
            filter_match="all",
            frequency=1440,  # at most once per day
        ),

        # -------------------------------------------------------------------
        # 4. FRONTEND — New issue affecting >5 unique users in 1h
        # -------------------------------------------------------------------
        IssueAlertRule(
            name="[frontend] Issue affecting >5 users (1h)",
            project="frontend",
            criticality="high",
            description=(
                "Triggers when a single issue impacts more than 5 unique users "
                "in a 1-hour window. Catches widespread regressions on web."
            ),
            conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
                    "value": 5,
                    "interval": "1h",
                    "comparisonType": "count",
                }
            ],
            filters=[],
            actions=tg,
            action_match="all",
            filter_match="all",
            frequency=60,
        ),

        # -------------------------------------------------------------------
        # 5. FRONTEND — Browser error rate (>100 events/h with exception)
        # -------------------------------------------------------------------
        IssueAlertRule(
            name="[frontend] Browser error rate (>100/h)",
            project="frontend",
            criticality="medium",
            description=(
                "Triggers when more than 100 events with an exception payload "
                "are ingested in 1 hour. Watches general browser-side error "
                "volume independently of unique-user impact."
            ),
            conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "value": 100,
                    "interval": "1h",
                    "comparisonType": "count",
                }
            ],
            filters=[
                {
                    "id": "sentry.rules.filters.event_attribute.EventAttributeFilter",
                    "attribute": "exception",
                    "match": "is",
                    "value": "",
                }
            ],
            actions=tg,
            action_match="all",
            filter_match="any",
            frequency=60,
        ),

        # -------------------------------------------------------------------
        # 6. MOBILE — Crash rate > 1% over 24h (sessions dataset)
        # -------------------------------------------------------------------
        MetricAlertRule(
            name="[mobile] Crash rate > 1% (24h)",
            project="mobile",
            criticality="high",
            description=(
                "Triggers when the ratio of crashed sessions to total sessions "
                "exceeds 1%% over a rolling 24-hour window. Standard "
                "crash-free-rate KPI for the Expo app."
            ),
            dataset="sessions",
            query="",
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alias",
            time_window=1440,
            threshold_type=0,  # above
            resolve_threshold=0.5,
            triggers=[
                {
                    "label": "critical",
                    "alertThreshold": 1.0,
                    "actions": tg,
                }
            ],
        ),
    ]
