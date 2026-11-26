"""
Tests RGPD — sous-traitants déclarés vs bloqués.

Garantit que :
- la liste backend (core/subprocessors.py) == la page publique /legal/sub-processors,
- les clés des fournisseurs non déclarés sont neutralisées (env + settings),
- la chaîne LLM reste 100 % Mistral.
"""

from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from core.subprocessors import (
    BLOCKED_PROVIDER_ENV_KEYS,
    DECLARED_SUBPROCESSORS,
    blocked_env_keys,
    enforce_on_environ,
    enforce_on_settings,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
LEGAL_PAGE = REPO_ROOT / "frontend" / "src" / "pages" / "LegalSubProcessors.tsx"


def _page_names() -> set[str]:
    source = LEGAL_PAGE.read_text(encoding="utf-8")
    block = source.split("const SUB_PROCESSORS", 1)[1].split("];", 1)[0]
    return set(re.findall(r'name:\s*"([^"]+)"', block))


@pytest.mark.skipif(not LEGAL_PAGE.exists(), reason="frontend absent du checkout")
def test_declared_list_matches_public_page() -> None:
    assert _page_names() == set(DECLARED_SUBPROCESSORS)


def test_declared_and_blocked_are_disjoint() -> None:
    assert not set(DECLARED_SUBPROCESSORS) & set(BLOCKED_PROVIDER_ENV_KEYS)


def test_enforce_on_environ_removes_only_blocked_keys() -> None:
    env: dict[str, str] = {key: "secret" for key in blocked_env_keys()}
    env["MISTRAL_API_KEY"] = "keep-me"
    env["ELEVENLABS_API_KEY"] = "keep-me-too"

    removed = enforce_on_environ(env)

    assert set(removed) == set(blocked_env_keys())
    assert not any(key in env for key in blocked_env_keys())
    assert env["MISTRAL_API_KEY"] == "keep-me"
    assert env["ELEVENLABS_API_KEY"] == "keep-me-too"


def test_enforce_on_environ_is_noop_when_clean() -> None:
    env = {"MISTRAL_API_KEY": "x"}
    assert enforce_on_environ(env) == []
    assert env == {"MISTRAL_API_KEY": "x"}


def test_enforce_on_settings_clears_values_read_from_dotenv() -> None:
    settings = SimpleNamespace(GROQ_API_KEY="from-dotenv", DEEPSEEK_API_KEY="", MISTRAL_API_KEY="ok")

    cleared = enforce_on_settings(settings)

    assert cleared == ["GROQ_API_KEY"]
    assert settings.GROQ_API_KEY == ""
    assert settings.MISTRAL_API_KEY == "ok"


def test_deepseek_is_blocked_and_not_in_llm_chain() -> None:
    assert "DEEPSEEK_API_KEY" in blocked_env_keys()

    llm_provider = pytest.importorskip("core.llm_provider")
    chain = llm_provider._build_fallback_chain("mistral-small-2603")
    assert chain, "la chaîne LLM ne doit pas être vide"
    assert {entry["provider"] for entry in chain} == {"mistral"}
    assert all("mistral.ai" in entry["url"] for entry in chain)
