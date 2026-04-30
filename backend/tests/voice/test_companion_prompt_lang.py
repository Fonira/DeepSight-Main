"""Tests for ``voice.companion_prompt.render_companion_prompt`` — language enforcement.

The companion prompt now appends the per-language enforcement block
(``LANGUAGE_ENFORCEMENT_FR`` / ``LANGUAGE_ENFORCEMENT_EN`` from
``voice.agent_types``) to the rendered template, so the agent never
slips out of the user's chosen tongue.

The default ``language="fr"`` keeps backward compatibility with the
six other agents.
"""

from __future__ import annotations

from voice.companion_prompt import render_companion_prompt
from voice.schemas import CompanionContextResponse, ProfileBlock, RecoItem


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _ctx() -> CompanionContextResponse:
    """Minimal but valid Companion context for prompt rendering."""
    return CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Maxime",
            plan="pro",
            langue="fr",
            total_analyses=3,
            recent_titles=["A", "B"],
            themes=["IA"],
            streak_days=2,
            flashcards_due_today=1,
        ),
        initial_recos=[
            RecoItem(
                video_id="r1",
                title="Reco 1",
                channel="Channel 1",
                duration_seconds=300,
                source="trending",
                why="Pertinent pour ton historique",
            ),
        ],
        cache_hit=False,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Language enforcement — FR
# ─────────────────────────────────────────────────────────────────────────────


def test_render_companion_prompt_fr_appends_language_enforcement():
    """``language='fr'`` appends the FR enforcement block at the end."""
    prompt = render_companion_prompt(_ctx(), language="fr")
    assert "Tu DOIS parler UNIQUEMENT en français" in prompt


# ─────────────────────────────────────────────────────────────────────────────
# Language enforcement — EN
# ─────────────────────────────────────────────────────────────────────────────


def test_render_companion_prompt_en_appends_language_enforcement():
    """``language='en'`` appends the EN enforcement block at the end."""
    prompt = render_companion_prompt(_ctx(), language="en")
    assert "You MUST speak ONLY in English" in prompt


# ─────────────────────────────────────────────────────────────────────────────
# Default language is FR
# ─────────────────────────────────────────────────────────────────────────────


def test_render_companion_prompt_default_lang_is_fr():
    """No ``language`` argument → behaves identically to ``language='fr'``."""
    prompt_default = render_companion_prompt(_ctx())
    prompt_explicit_fr = render_companion_prompt(_ctx(), language="fr")
    assert prompt_default == prompt_explicit_fr
    # And the FR enforcement block is present.
    assert "Tu DOIS parler UNIQUEMENT en français" in prompt_default
