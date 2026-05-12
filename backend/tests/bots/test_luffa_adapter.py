"""Tests pour `bots.luffa.adapter.envelope_to_messages`."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

BACKEND_SRC = Path(__file__).resolve().parents[2] / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from bots.luffa.adapter import envelope_to_messages  # noqa: E402


@dataclass
class FakeMsg:
    text: str
    msgId: str
    urlLink: Optional[str] = None
    uid: Optional[str] = None


@dataclass
class FakeEnv:
    uid: str
    type: int
    messages: list
    count: int = 0


def test_envelope_to_messages_dm():
    env = FakeEnv(uid="user123", type=0, messages=[FakeMsg(text="Salut", msgId="m1")])
    parsed = envelope_to_messages(env)
    assert len(parsed) == 1
    p = parsed[0]
    assert p.platform == "luffa"
    assert p.platform_user_id == "user123"
    assert p.text == "Salut"
    assert p.is_group is False
    assert p.platform_msg_id == "m1"


def test_envelope_to_messages_group_uses_sender_uid_if_present():
    env = FakeEnv(
        uid="group_abc",
        type=1,
        messages=[FakeMsg(text="Hello", msgId="m2", uid="sender_xyz")],
    )
    parsed = envelope_to_messages(env)
    assert len(parsed) == 1
    assert parsed[0].platform_user_id == "sender_xyz"
    assert parsed[0].is_group is True


def test_envelope_to_messages_falls_back_to_url():
    env = FakeEnv(
        uid="user42",
        type=0,
        messages=[FakeMsg(text="", msgId="m3", urlLink="https://example.com")],
    )
    parsed = envelope_to_messages(env)
    assert len(parsed) == 1
    assert parsed[0].text == "https://example.com"


def test_envelope_to_messages_skips_empty():
    env = FakeEnv(
        uid="user42",
        type=0,
        messages=[FakeMsg(text="", msgId="m4"), FakeMsg(text="ok", msgId="m5")],
    )
    parsed = envelope_to_messages(env)
    assert len(parsed) == 1
    assert parsed[0].text == "ok"


def test_envelope_to_messages_no_uid_returns_empty():
    env = FakeEnv(uid="", type=0, messages=[FakeMsg(text="ignored", msgId="m6")])
    assert envelope_to_messages(env) == []
