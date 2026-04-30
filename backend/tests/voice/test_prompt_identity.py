"""Tests for ``voice.prompt_identity`` — DeepSight shared identity header.

Validates the brand-identity block injected at the top of every voice
agent's system_prompt (FR + EN). The block must :
  * carry the canonical brand keywords (DeepSight, Mistral AI, tagline,
    European positioning, anti-bullshit voice principle);
  * stay under a strict size budget so the 12 KB system_prompt window
    keeps room for agent role + session block + video context;
  * NOT contain any behavioral rules ("be concise", "max 3 sentences",
    "use tools") — those belong to the per-agent prompts.

All tests are synchronous; no DB / network / fixtures involved.
"""

from __future__ import annotations

from voice.prompt_identity import (
    DEEPSIGHT_VOICE_IDENTITY_EN,
    DEEPSIGHT_VOICE_IDENTITY_FR,
    get_identity_block,
)


# ─────────────────────────────────────────────────────────────────────────────
# Brand keywords — FR
# ─────────────────────────────────────────────────────────────────────────────


def test_identity_fr_contains_brand_keywords():
    """FR identity must mention DeepSight, Mistral AI, the tagline, EU and anti-bullshit."""
    block = DEEPSIGHT_VOICE_IDENTITY_FR
    assert "DeepSight" in block
    assert "Mistral AI" in block
    assert "Ne subissez plus" in block
    assert "européen" in block.lower()
    assert "anti-bullshit" in block.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Brand keywords — EN
# ─────────────────────────────────────────────────────────────────────────────


def test_identity_en_contains_brand_keywords():
    """EN identity must mention DeepSight, Mistral AI, tagline, European, anti-bullshit."""
    block = DEEPSIGHT_VOICE_IDENTITY_EN
    assert "DeepSight" in block
    assert "Mistral AI" in block
    assert "Interrogate them" in block
    assert "European" in block
    assert "anti-bullshit" in block.lower()


# ─────────────────────────────────────────────────────────────────────────────
# get_identity_block() resolver
# ─────────────────────────────────────────────────────────────────────────────


def test_get_identity_block_fr_default():
    """Default call (no argument) returns the FR identity block verbatim."""
    assert get_identity_block() == DEEPSIGHT_VOICE_IDENTITY_FR


def test_get_identity_block_en():
    """Explicit ``en`` argument returns the EN identity block verbatim."""
    assert get_identity_block("en") == DEEPSIGHT_VOICE_IDENTITY_EN


def test_get_identity_block_unknown_falls_to_fr():
    """Unknown language code falls back to FR (DeepSight's primary market)."""
    # ``zh`` is not handled by the resolver — must default to FR.
    assert get_identity_block("zh") == DEEPSIGHT_VOICE_IDENTITY_FR  # type: ignore[arg-type]


# ─────────────────────────────────────────────────────────────────────────────
# Size budget
# ─────────────────────────────────────────────────────────────────────────────


def test_identity_blocks_under_size_budget():
    """Identity blocks stay under 1500 chars to fit the 12 KB system_prompt."""
    assert len(DEEPSIGHT_VOICE_IDENTITY_FR) < 1500, (
        f"FR identity is {len(DEEPSIGHT_VOICE_IDENTITY_FR)} chars — too large"
    )
    assert len(DEEPSIGHT_VOICE_IDENTITY_EN) < 1500, (
        f"EN identity is {len(DEEPSIGHT_VOICE_IDENTITY_EN)} chars — too large"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Identity vs behavior — strict separation of concerns
# ─────────────────────────────────────────────────────────────────────────────


def test_identity_blocks_no_behavioral_rules():
    """Identity must NOT carry behavior rules — those belong in per-agent prompts."""
    forbidden = ["be concise", "max 3 sentences", "use tools"]
    for block_name, block in (
        ("FR", DEEPSIGHT_VOICE_IDENTITY_FR),
        ("EN", DEEPSIGHT_VOICE_IDENTITY_EN),
    ):
        lower = block.lower()
        for phrase in forbidden:
            assert phrase not in lower, (
                f"{block_name} identity leaks behavioral rule {phrase!r} — "
                "this belongs in the per-agent prompt, not the identity block."
            )
