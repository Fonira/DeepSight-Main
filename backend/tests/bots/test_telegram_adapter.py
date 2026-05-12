"""Tests pour `bots.telegram.adapter.parse_update`."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_SRC = Path(__file__).resolve().parents[2] / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from bots.telegram.adapter import parse_update  # noqa: E402


def _build_message_update(text: str = "Salut", chat_id: int = 12345, username: str = "max") -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 7,
            "from": {
                "id": chat_id,
                "first_name": "Max",
                "username": username,
                "language_code": "fr",
            },
            "chat": {"id": chat_id, "type": "private"},
            "date": 1700000000,
            "text": text,
        },
    }


def test_parse_simple_text_message():
    parsed = parse_update(_build_message_update(text="Hello"))
    assert parsed is not None
    assert parsed.platform == "telegram"
    assert parsed.platform_user_id == "12345"
    assert parsed.text == "Hello"
    assert parsed.platform_username == "max"
    assert parsed.is_group is False


def test_parse_start_command_strips_payload():
    parsed = parse_update(_build_message_update(text="/start"))
    assert parsed is not None
    assert parsed.text == "Salut"


def test_parse_start_with_payload():
    parsed = parse_update(_build_message_update(text="/start resume_42"))
    assert parsed is not None
    assert parsed.text == "resume_42"


def test_parse_other_command_keeps_text():
    parsed = parse_update(_build_message_update(text="/help"))
    assert parsed is not None
    assert parsed.text == "/help"


def test_parse_group_message_marks_is_group():
    payload = _build_message_update(text="yo", chat_id=-100)
    payload["message"]["chat"]["type"] = "group"
    parsed = parse_update(payload)
    assert parsed is not None
    assert parsed.is_group is True


def test_parse_edited_message_returns_none():
    payload = _build_message_update(text="edited")
    payload["edited_message"] = payload.pop("message")
    parsed = parse_update(payload)
    assert parsed is None


def test_parse_sticker_only_returns_none():
    payload = _build_message_update(text="placeholder")
    payload["message"]["text"] = ""
    payload["message"]["caption"] = ""
    parsed = parse_update(payload)
    assert parsed is None


def test_parse_callback_query():
    payload = {
        "update_id": 2,
        "callback_query": {
            "id": "cb1",
            "from": {"id": 12345, "first_name": "Max", "username": "max"},
            "message": {
                "message_id": 8,
                "chat": {"id": 12345, "type": "private"},
            },
            "data": "demo_show",
        },
    }
    parsed = parse_update(payload)
    assert parsed is not None
    assert parsed.callback_data == "demo_show"
    assert parsed.text == "demo_show"
    assert parsed.platform_user_id == "12345"


def test_parse_unknown_update_type_returns_none():
    parsed = parse_update({"update_id": 999, "channel_post": {"text": "x"}})
    assert parsed is None
