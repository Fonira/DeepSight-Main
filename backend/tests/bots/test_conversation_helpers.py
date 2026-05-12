"""Tests pour les helpers module-level de `bots.core.conversation`."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_SRC = Path(__file__).resolve().parents[2] / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from bots.core.conversation import (  # noqa: E402
    _format_history,
    _normalize_turn_payload,
    _strip_code_fence,
)
from bots.schemas import LLMTurnResult  # noqa: E402


def test_strip_code_fence_json():
    raw = '```json\n{"text": "ok"}\n```'
    assert _strip_code_fence(raw) == '{"text": "ok"}'


def test_strip_code_fence_no_fence():
    assert _strip_code_fence('{"text": "ok"}') == '{"text": "ok"}'


def test_strip_code_fence_with_whitespace():
    raw = '  ```\n{"x":1}\n```  '
    assert _strip_code_fence(raw) == '{"x":1}'


def test_normalize_turn_payload_supplies_defaults():
    data = _normalize_turn_payload({"text": "hi"})
    assert data["next_state"] == "hello"
    assert data["score_delta"] == 0
    assert data["ready_for_handoff"] is False
    assert data["cold_close"] is False
    assert data["extracted"]["interest_signals"] == []
    turn = LLMTurnResult.model_validate(data)
    assert turn.text == "hi"


def test_normalize_turn_payload_button_aliases():
    data = _normalize_turn_payload(
        {
            "text": "ok",
            "buttons": [
                {"name": "Voir démo", "selector": "demo"},        # Luffa-style
                {"label": "Booker", "callback_data": "book"},     # Telegram-style
                {"text": "ignored", "foo": "bar"},                 # invalid
            ],
        }
    )
    assert len(data["buttons"]) == 2
    assert data["buttons"][0]["label"] == "Voir démo"
    assert data["buttons"][0]["payload"] == "demo"
    assert data["buttons"][1]["label"] == "Booker"


def test_normalize_turn_payload_caps_buttons_at_three():
    data = _normalize_turn_payload(
        {
            "text": "ok",
            "buttons": [{"label": str(i), "payload": str(i)} for i in range(10)],
        }
    )
    assert len(data["buttons"]) == 3


def test_normalize_turn_payload_handles_non_dict():
    assert _normalize_turn_payload("not a dict") == {}


def test_format_history_empty():
    assert _format_history([]) == ""
