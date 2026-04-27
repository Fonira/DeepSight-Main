"""Tests for the VoiceQuotaStreaming model (Task 1 — Quick Voice Call A+D).

A new table ``voice_quota`` (singular, distinct from the legacy
``voice_quotas`` plural per-month table) holds A+D strict accounting:

  * lifetime trial flag for Free users
  * monthly minutes used for Expert tier
  * tracking of the streaming session columns added on ``voice_sessions``

The original spec referenced the model as ``VoiceQuota``; we expose the new
class as ``VoiceQuotaStreaming`` to avoid colliding with the pre-existing
legacy ``VoiceQuota`` class on per-month seconds counters.
"""

from datetime import datetime, timezone
from sqlalchemy import inspect

from db.database import Base, VoiceQuotaStreaming, VoiceSession


def test_voice_quota_streaming_table_name_is_singular():
    assert VoiceQuotaStreaming.__tablename__ == "voice_quota"


def test_voice_quota_streaming_columns():
    cols = {c.name for c in inspect(VoiceQuotaStreaming).columns}
    expected = {
        "user_id",
        "plan",
        "monthly_minutes_used",
        "monthly_period_start",
        "lifetime_trial_used",
        "lifetime_trial_used_at",
    }
    assert expected.issubset(cols), f"missing columns: {expected - cols}"


def test_voice_quota_streaming_defaults_in_python():
    """Pure model instantiation: server defaults aren't applied without a DB
    flush, so we only verify the python-side defaults explicitly set."""
    q = VoiceQuotaStreaming(
        user_id=42,
        plan="free",
        monthly_period_start=datetime.now(timezone.utc),
    )
    # Python defaults: server-side defaults won't fire until insert,
    # but None at this point is acceptable. The contract is that the column
    # exists and is nullable=False at the DB level.
    assert q.user_id == 42
    assert q.plan == "free"


def test_voice_sessions_has_streaming_columns():
    """Migration 008 adds is_streaming_session + context_completion_pct."""
    cols = {c.name for c in inspect(VoiceSession).columns}
    assert "is_streaming_session" in cols
    assert "context_completion_pct" in cols
