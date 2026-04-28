import pytest
from voice.companion_prompt import render_companion_prompt
from voice.schemas import CompanionContextResponse, ProfileBlock, RecoItem


def test_render_companion_prompt_substitutes_all_fields():
    ctx = CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Maxime", plan="pro", langue="fr", total_analyses=42,
            recent_titles=["IA et conscience", "Géopolitique 2026"],
            themes=["IA", "philo", "géopolitique"],
            streak_days=12, flashcards_due_today=8,
        ),
        initial_recos=[
            RecoItem(video_id="r1", title="Reco 1", channel="C1",
                     duration_seconds=600, source="history_similarity",
                     why="Similaire à ton analyse"),
            RecoItem(video_id="r2", title="Reco 2", channel="C2",
                     duration_seconds=400, source="trending",
                     why="Cartonne en ce moment"),
        ],
        cache_hit=False,
    )
    prompt = render_companion_prompt(ctx)
    assert "Maxime" in prompt
    assert "IA et conscience" in prompt
    assert "Reco 1" in prompt
    assert "Reco 2" in prompt
    assert "12" in prompt  # streak
    assert "get_more_recos" in prompt
    assert "start_analysis" in prompt


def test_render_companion_prompt_handles_empty_recos():
    ctx = CompanionContextResponse(
        profile=ProfileBlock(prenom="X", plan="pro", langue="fr",
                              total_analyses=0, recent_titles=[],
                              themes=[], streak_days=0, flashcards_due_today=0),
        initial_recos=[],
    )
    prompt = render_companion_prompt(ctx)
    assert "X" in prompt
    assert "Aucune reco pré-préparée" in prompt or "aucune reco" in prompt.lower()
