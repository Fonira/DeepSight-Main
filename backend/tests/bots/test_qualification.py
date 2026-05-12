"""Tests pour `bots.core.qualification`."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_SRC = Path(__file__).resolve().parents[2] / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from bots.core.qualification import (  # noqa: E402
    apply_score_delta,
    build_handoff_summary,
    derive_lead_status,
    merge_extracted_fields,
)
from bots.schemas import LLMTurnResult, ProspectQualification  # noqa: E402


def test_apply_score_delta_clamps_lower_bound():
    assert apply_score_delta(5, -50) == 0


def test_apply_score_delta_clamps_upper_bound():
    assert apply_score_delta(95, 50) == 100


def test_apply_score_delta_clamps_delta_too_large():
    assert apply_score_delta(10, 100) == 40  # 10 + clamp(100, 30) = 40


def test_apply_score_delta_normal():
    assert apply_score_delta(20, 15) == 35


def test_derive_lead_status_warm_via_threshold():
    assert (
        derive_lead_status(
            current_status="qualifying",
            new_score=65,
            warm_threshold=60,
            ready_for_handoff=False,
            cold_close=False,
        )
        == "warm"
    )


def test_derive_lead_status_warm_via_explicit_handoff():
    assert (
        derive_lead_status(
            current_status="new",
            new_score=10,
            warm_threshold=60,
            ready_for_handoff=True,
            cold_close=False,
        )
        == "warm"
    )


def test_derive_lead_status_cold():
    assert (
        derive_lead_status(
            current_status="qualifying",
            new_score=20,
            warm_threshold=60,
            ready_for_handoff=False,
            cold_close=True,
        )
        == "cold"
    )


def test_derive_lead_status_qualifying_progression():
    assert (
        derive_lead_status(
            current_status="new",
            new_score=15,
            warm_threshold=60,
            ready_for_handoff=False,
            cold_close=False,
        )
        == "qualifying"
    )


def test_derive_lead_status_keeps_converted():
    assert (
        derive_lead_status(
            current_status="converted",
            new_score=10,
            warm_threshold=60,
            ready_for_handoff=False,
            cold_close=True,
        )
        == "converted"
    )


def test_merge_extracted_fields_keeps_non_empty_only():
    turn = LLMTurnResult(
        text="ok",
        extracted=ProspectQualification(
            business_type="ecommerce_telegram",
            audience_size=None,
            interest_signals=["prix", "demo"],
        ),
    )
    merged = merge_extracted_fields(
        existing_business_type=None,
        existing_business_name="ACME",
        existing_audience_size="1k-10k",  # garde la valeur existante car nouvelle None
        existing_current_pain=None,
        existing_signals=["concurrence"],
        turn=turn,
    )
    assert merged["business_type"] == "ecommerce_telegram"
    assert merged["business_name"] == "ACME"  # non écrasé
    assert merged["audience_size"] == "1k-10k"  # conservé
    assert merged["interest_signals"] == ["concurrence", "prix", "demo"]


def test_merge_extracted_fields_dedupes_signals():
    turn = LLMTurnResult(
        text="ok",
        extracted=ProspectQualification(interest_signals=["prix", "PRIX", "demo"]),
    )
    merged = merge_extracted_fields(
        existing_business_type=None,
        existing_business_name=None,
        existing_audience_size=None,
        existing_current_pain=None,
        existing_signals=["prix"],
        turn=turn,
    )
    assert merged["interest_signals"] == ["prix", "demo"]


def test_build_handoff_summary_includes_essentials():
    summary = build_handoff_summary(
        platform="telegram",
        platform_username="prospect42",
        display_name="Alice Wonderland",
        business_type="ecommerce_telegram",
        business_name="Boutique X",
        audience_size="1k-10k",
        current_pain="ne sait pas comment analyser ses concurrents",
        interest_signals=["prix", "demo"],
        qualification_score=75,
        last_user_message="oui je veux voir ça",
    )
    assert "Lead chaud" in summary
    assert "telegram" in summary
    assert "prospect42" in summary
    assert "Boutique X" in summary
    assert "75/100" in summary
    assert "oui je veux voir ça" in summary
