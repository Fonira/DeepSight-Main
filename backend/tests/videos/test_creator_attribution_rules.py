"""
Règle anti-attribution : l'analyse ne doit pas nommer le vidéaste ou le
fondateur d'une chaîne de mémoire.

Bug constaté le 2026-11-27 : l'analyse d'une vidéo Science4All affirmait que la
chaîne avait été fondée par Léo Grasset (DirtyBiology) alors qu'elle est tenue
par Lê Nguyên Hoang. Ni la transcription ni les métadonnées ne donnent ce nom :
le modèle le tirait de ses connaissances générales.

Ces tests vérifient que la règle figure dans chaque prompt qui reçoit le nom
de la chaîne : prompt système d'analyse, directive « Contexte chaîne » et
prompt de recherche web pré-analyse (FR + EN).
"""

import os
import sys

import pytest

# Ensure src/ is on the path
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


ANALYSIS_RULE = {
    "fr": "N'identifie jamais le vidéaste, le fondateur de la chaîne ou un intervenant",
    "en": "Never identify the creator, the channel's founder or a speaker",
}
CHANNEL_DIRECTIVE_RULE = {
    "fr": "Ne nomme ni le vidéaste ni le fondateur de la chaîne",
    "en": "Does not name the creator or the channel's founder",
}
WEB_RULE = {
    "fr": "Ne donne aucune information sur l'identité du vidéaste ou du fondateur de la chaîne",
    "en": "Do not give any information about the identity of the creator or the channel's founder",
}


def _channel_context() -> dict:
    return {
        "channel_id": "UC_test",
        "platform": "youtube",
        "name": "Science4All",
        "description": "Vulgarisation des mathématiques et de l'informatique.",
        "subscriber_count": 300000,
        "video_count": 400,
        "tags": ["mathématiques", "bayésianisme"],
        "categories": ["Education"],
        "last_videos": [
            {"title": "La formule du savoir", "description": "Bayes", "tags": ["bayes"]},
        ],
    }


def _build_analysis_prompts(lang: str, channel_context: dict | None = None) -> tuple[str, str]:
    from videos.analysis import build_analysis_prompt

    return build_analysis_prompt(
        title="Les réseaux de neurones",
        transcript="Bonjour à tous, aujourd'hui on parle de réseaux de neurones. " * 40,
        category="general",
        lang=lang,
        mode="standard",
        duration=900,
        channel="Science4All",
        description="Une vidéo de vulgarisation.",
        channel_context=channel_context,
    )


@pytest.mark.parametrize("lang", ["fr", "en"])
def test_analysis_system_prompt_forbids_naming_people_from_memory(lang: str) -> None:
    system_prompt, _ = _build_analysis_prompts(lang)
    assert ANALYSIS_RULE[lang] in system_prompt


@pytest.mark.parametrize("lang", ["fr", "en"])
def test_channel_context_directive_forbids_naming_the_creator(lang: str) -> None:
    system_prompt, user_prompt = _build_analysis_prompts(lang, channel_context=_channel_context())
    assert CHANNEL_DIRECTIVE_RULE[lang] in system_prompt
    # The channel data itself stays in the user prompt.
    assert "Science4All" in user_prompt


@pytest.mark.parametrize("level_name", ["FULL", "DEEP"])
@pytest.mark.parametrize("lang", ["fr", "en"])
def test_pre_analysis_web_prompt_forbids_creator_identity(level_name: str, lang: str) -> None:
    from videos.web_enrichment import EnrichmentLevel, build_pre_analysis_prompt

    prompt = build_pre_analysis_prompt(
        level=getattr(EnrichmentLevel, level_name),
        video_title="Les réseaux de neurones",
        video_channel="Science4All",
        category="science",
        transcript_excerpt="Bonjour à tous, aujourd'hui on parle de réseaux de neurones.",
        lang=lang,
    )
    assert WEB_RULE[lang] in prompt
