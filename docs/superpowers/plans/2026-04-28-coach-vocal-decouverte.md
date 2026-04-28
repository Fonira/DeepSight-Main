# Coach Vocal de Découverte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner du contexte à l'agent vocal `COMPANION` (onglet « Appel Vocal » sidebar) pour qu'il devienne un coach de découverte personnalisé qui pousse 3 recos vidéos basées sur l'historique user, avec capacité à lancer une analyse pendant l'appel.

**Architecture:** Endpoint `/api/voice/companion-context` build profil compact (~600 tok) + 3 recos pré-fetch (Histo+sim, Trending, Tournesol) avec cache Redis 1h. Top 3 thèmes via Mistral small avec fallback `Summary.category` count. Tools webhook ConvAI `get_more_recos(topic)` (chaîne fallback 4 sources) et `start_analysis(url)` (background). System prompt COMPANION enrichi avec template runtime. Frontend = nouvelle page `VoiceCallPage` + item sidebar.

**Tech Stack:** Backend FastAPI + SQLAlchemy + Redis (cache) + Mistral small (extraction thèmes) + httpx (Tournesol/YouTube) + ElevenLabs ConvAI tools. Frontend React 18 + TypeScript strict + Tailwind + lucide-react + `@elevenlabs/react`.

**Spec source:** `docs/superpowers/specs/2026-04-28-coach-vocal-decouverte-design.md`

---

## File Structure

### Backend — création

- `backend/src/voice/companion_context.py` — orchestrateur principal (profil + thèmes + cache)
- `backend/src/voice/companion_themes.py` — extraction top 3 thèmes (Mistral small + fallback category)
- `backend/src/voice/companion_recos.py` — orchestration 4 sources de recos avec fallback chain
- `backend/src/voice/companion_prompt.py` — template system prompt COMPANION enrichi
- `backend/tests/voice/test_companion_themes.py`
- `backend/tests/voice/test_companion_recos.py`
- `backend/tests/voice/test_companion_context.py`
- `backend/tests/voice/test_companion_prompt.py`
- `backend/tests/voice/test_companion_tools.py`

### Backend — modification

- `backend/src/voice/schemas.py` — schemas Pydantic Companion\*
- `backend/src/voice/router.py` — endpoint `/companion-context` + tools `/tools/companion-recos` et `/tools/start-analysis` + injection prompt
- `backend/src/voice/agent_types.py` — COMPANION system prompt = template

### Frontend — création

- `frontend/src/pages/VoiceCallPage.tsx`
- `frontend/src/pages/__tests__/VoiceCallPage.test.tsx`

### Frontend — modification

- `frontend/src/services/api.ts` — `getCompanionContext()` + types
- `frontend/src/components/sidebar/SidebarNav.tsx` — item « Appel Vocal »
- `frontend/src/App.tsx` — route lazy `/voice-call`

---

## Task 1: Pydantic schemas Companion

**Files:**

- Modify: `backend/src/voice/schemas.py`
- Test: `backend/tests/voice/test_companion_schemas.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_schemas.py
import pytest
from pydantic import ValidationError
from src.voice.schemas import (
    RecoItem,
    ProfileBlock,
    CompanionContextResponse,
    StartAnalysisRequest,
    GetMoreRecosRequest,
)


def test_reco_item_minimal():
    item = RecoItem(
        video_id="dQw4w9WgXcQ",
        title="Test",
        channel="Chan",
        duration_seconds=120,
        source="tournesol",
        why="parce que",
    )
    assert item.video_id == "dQw4w9WgXcQ"


def test_reco_item_invalid_source():
    with pytest.raises(ValidationError):
        RecoItem(
            video_id="x",
            title="t",
            channel="c",
            duration_seconds=10,
            source="invalid_source",
            why="w",
        )


def test_companion_context_response_shape():
    resp = CompanionContextResponse(
        profile=ProfileBlock(
            prenom="Maxime",
            plan="pro",
            langue="fr",
            total_analyses=42,
            recent_titles=[],
            themes=["IA", "philo", "physique"],
            streak_days=5,
            flashcards_due_today=3,
        ),
        initial_recos=[],
        cache_hit=False,
    )
    assert resp.profile.prenom == "Maxime"


def test_start_analysis_request_youtube_url():
    req = StartAnalysisRequest(video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert "youtube" in req.video_url


def test_get_more_recos_request_default_source():
    req = GetMoreRecosRequest(topic="géopolitique")
    assert req.source is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/voice/test_companion_schemas.py -v
```

Expected: FAIL with `ImportError` on companion schemas.

- [ ] **Step 3: Add schemas to `backend/src/voice/schemas.py`**

```python
# Append to existing schemas.py
from typing import Literal, Optional
from pydantic import BaseModel, Field


RecoSource = Literal["history_similarity", "trending", "tournesol", "youtube"]


class RecoItem(BaseModel):
    video_id: str
    title: str
    channel: str
    duration_seconds: int
    source: RecoSource
    why: str = Field(..., description="Accroche personnalisée 1 phrase")
    thumbnail_url: Optional[str] = None


class ProfileBlock(BaseModel):
    prenom: str
    plan: str
    langue: str
    total_analyses: int
    recent_titles: list[str] = Field(default_factory=list, description="5 derniers titres")
    themes: list[str] = Field(default_factory=list, description="Top 3 thèmes")
    streak_days: int = 0
    flashcards_due_today: int = 0


class CompanionContextResponse(BaseModel):
    profile: ProfileBlock
    initial_recos: list[RecoItem]
    cache_hit: bool = False


class GetMoreRecosRequest(BaseModel):
    topic: str
    source: Optional[RecoSource] = None
    exclude_video_ids: list[str] = Field(default_factory=list)


class GetMoreRecosResponse(BaseModel):
    recos: list[RecoItem]


class StartAnalysisRequest(BaseModel):
    video_url: str


class StartAnalysisResponse(BaseModel):
    summary_id: int
    status: Literal["started", "duplicate", "rejected"]
    eta_seconds: int = 120
    message: Optional[str] = None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_schemas.py -v
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/schemas.py backend/tests/voice/test_companion_schemas.py
git commit -m "feat(voice): add Companion schemas (profile, reco, tools)"
```

---

## Task 2: Top 3 thèmes — fallback `Summary.category`

**Files:**

- Create: `backend/src/voice/companion_themes.py`
- Test: `backend/tests/voice/test_companion_themes.py`

- [ ] **Step 1: Write the failing test (fallback path)**

```python
# backend/tests/voice/test_companion_themes.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from src.voice.companion_themes import extract_top3_themes


@pytest.mark.asyncio
async def test_themes_fallback_category_majority():
    """Si > 70% des Summary ont category populé → fallback no-LLM."""
    summaries = [
        MagicMock(title=f"v{i}", category="philosophie") for i in range(8)
    ] + [
        MagicMock(title=f"v{i+8}", category="géopolitique") for i in range(7)
    ] + [
        MagicMock(title=f"v{i+15}", category="ia") for i in range(5)
    ] + [
        MagicMock(title="x", category=None) for _ in range(2)  # 22 with cat / 24 = 91%
    ]
    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = summaries

    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=None)

    assert themes == ["philosophie", "géopolitique", "ia"]
    db_mock.fetch_recent_summaries.assert_called_once_with(user_id=1, limit=30)


@pytest.mark.asyncio
async def test_themes_empty_returns_default():
    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = []
    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=None)
    assert themes == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_themes.py -v
```

Expected: FAIL `ImportError` on `companion_themes`.

- [ ] **Step 3: Create `backend/src/voice/companion_themes.py` (fallback only)**

```python
"""Extraction top 3 thèmes user pour COMPANION agent."""
from collections import Counter
from typing import Optional, Protocol


class _DBProto(Protocol):
    async def fetch_recent_summaries(self, user_id: int, limit: int): ...


async def extract_top3_themes(
    user_id: int,
    db: _DBProto,
    llm_client: Optional[object] = None,
) -> list[str]:
    """Top 3 centres d'intérêt user via Summary.category fallback ou Mistral small."""
    summaries = await db.fetch_recent_summaries(user_id=user_id, limit=30)
    if not summaries:
        return []

    cats = [s.category for s in summaries if s.category]
    coverage = len(cats) / len(summaries)

    # Fallback no-LLM si couverture catégories >= 70%
    if coverage >= 0.7:
        top = Counter(cats).most_common(3)
        return [c for c, _ in top]

    # LLM path implémenté Task 3
    if llm_client is None:
        return []
    return await _extract_via_llm(summaries, llm_client)


async def _extract_via_llm(summaries, llm_client) -> list[str]:
    raise NotImplementedError("Implemented in Task 3")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_themes.py -v
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_themes.py backend/tests/voice/test_companion_themes.py
git commit -m "feat(voice): companion themes — Summary.category fallback path"
```

---

## Task 3: Top 3 thèmes — Mistral small LLM path

**Files:**

- Modify: `backend/src/voice/companion_themes.py`
- Modify: `backend/tests/voice/test_companion_themes.py`

- [ ] **Step 1: Write the failing test (LLM path)**

```python
# Append to test_companion_themes.py
@pytest.mark.asyncio
async def test_themes_llm_path_low_category_coverage():
    """Si < 70% des Summary ont category → appel Mistral small."""
    summaries = [MagicMock(title=f"Vidéo sur IA {i}", category=None) for i in range(20)]
    summaries += [MagicMock(title="Politique", category="politique") for _ in range(5)]

    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = summaries

    llm_mock = AsyncMock()
    llm_mock.complete_json.return_value = {"themes": ["intelligence artificielle", "tech", "politique"]}

    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=llm_mock)

    assert themes == ["intelligence artificielle", "tech", "politique"]
    llm_mock.complete_json.assert_called_once()
    # Le prompt doit contenir les 25 titres
    prompt_call = llm_mock.complete_json.call_args
    assert "Vidéo sur IA 0" in str(prompt_call)


@pytest.mark.asyncio
async def test_themes_llm_returns_invalid_json_fallback_empty():
    summaries = [MagicMock(title="t", category=None) for _ in range(10)]
    db_mock = AsyncMock()
    db_mock.fetch_recent_summaries.return_value = summaries
    llm_mock = AsyncMock()
    llm_mock.complete_json.side_effect = ValueError("invalid json")

    themes = await extract_top3_themes(user_id=1, db=db_mock, llm_client=llm_mock)
    assert themes == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_themes.py -v
```

Expected: 2 new tests FAIL (NotImplementedError).

- [ ] **Step 3: Implement LLM path**

```python
# Replace _extract_via_llm in companion_themes.py
import logging

logger = logging.getLogger(__name__)

THEMES_PROMPT_TEMPLATE = """Voici les {count} derniers titres de vidéos analysées par cet utilisateur :

{titles}

Identifie ses 3 centres d'intérêt principaux. Réponds UNIQUEMENT en JSON valide :
{{"themes": ["theme1", "theme2", "theme3"]}}

Les thèmes doivent être courts (1-3 mots), en français, sans articles."""


async def _extract_via_llm(summaries, llm_client) -> list[str]:
    titles = "\n".join(f"- {s.title}" for s in summaries[:30])
    prompt = THEMES_PROMPT_TEMPLATE.format(count=len(summaries), titles=titles)
    try:
        result = await llm_client.complete_json(prompt=prompt, model="mistral-small-2603")
        themes = result.get("themes", [])
        return themes[:3] if isinstance(themes, list) else []
    except (ValueError, KeyError, Exception) as exc:
        logger.warning("companion_themes LLM failed: %s", exc)
        return []
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_themes.py -v
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_themes.py backend/tests/voice/test_companion_themes.py
git commit -m "feat(voice): companion themes — Mistral small LLM extraction"
```

---

## Task 4: Reco source 1 — Historique + similarité

**Files:**

- Create: `backend/src/voice/companion_recos.py`
- Test: `backend/tests/voice/test_companion_recos.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_recos.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from src.voice.companion_recos import fetch_history_similarity_reco


@pytest.mark.asyncio
async def test_history_similarity_returns_top_match():
    """Renvoie video similaire à analyses passées, exclut déjà analysées."""
    db_mock = AsyncMock()
    embed_mock = AsyncMock()
    embed_mock.find_similar_videos.return_value = [
        {"video_id": "abc123", "title": "Sim Match", "channel": "Chan",
         "duration": 600, "score": 0.91, "thumbnail": "https://t/abc.jpg"},
    ]
    db_mock.embedding_service = embed_mock
    db_mock.fetch_user_analyzed_video_ids.return_value = {"existing1"}

    reco = await fetch_history_similarity_reco(
        user_id=1,
        db=db_mock,
        recent_summary_titles=["Vidéo X", "Vidéo Y"],
    )

    assert reco is not None
    assert reco.video_id == "abc123"
    assert reco.source == "history_similarity"
    assert "similaire" in reco.why.lower()


@pytest.mark.asyncio
async def test_history_similarity_excludes_already_analyzed():
    db_mock = AsyncMock()
    embed_mock = AsyncMock()
    embed_mock.find_similar_videos.return_value = [
        {"video_id": "existing1", "title": "Already", "channel": "C",
         "duration": 100, "score": 0.95, "thumbnail": None},
        {"video_id": "new1", "title": "New", "channel": "C",
         "duration": 200, "score": 0.85, "thumbnail": None},
    ]
    db_mock.embedding_service = embed_mock
    db_mock.fetch_user_analyzed_video_ids.return_value = {"existing1"}

    reco = await fetch_history_similarity_reco(
        user_id=1,
        db=db_mock,
        recent_summary_titles=["t"],
    )
    assert reco.video_id == "new1"


@pytest.mark.asyncio
async def test_history_similarity_no_match_returns_none():
    db_mock = AsyncMock()
    embed_mock = AsyncMock()
    embed_mock.find_similar_videos.return_value = []
    db_mock.embedding_service = embed_mock
    db_mock.fetch_user_analyzed_video_ids.return_value = set()

    reco = await fetch_history_similarity_reco(user_id=1, db=db_mock, recent_summary_titles=[])
    assert reco is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_recos.py -v
```

Expected: FAIL `ImportError` on `companion_recos`.

- [ ] **Step 3: Create `backend/src/voice/companion_recos.py`**

```python
"""Orchestration des 4 sources de recos pour COMPANION agent."""
import asyncio
import logging
from typing import Optional, Protocol
from src.voice.schemas import RecoItem

logger = logging.getLogger(__name__)


class _DBProto(Protocol):
    embedding_service: object
    async def fetch_user_analyzed_video_ids(self, user_id: int) -> set[str]: ...


async def fetch_history_similarity_reco(
    user_id: int,
    db: _DBProto,
    recent_summary_titles: list[str],
) -> Optional[RecoItem]:
    """Reco basée sur similarité embeddings avec analyses passées."""
    if not hasattr(db, "embedding_service"):
        return None

    try:
        candidates = await db.embedding_service.find_similar_videos(
            user_id=user_id,
            seed_titles=recent_summary_titles,
            limit=5,
        )
    except Exception as exc:
        logger.warning("history_similarity fetch failed: %s", exc)
        return None

    if not candidates:
        return None

    excluded = await db.fetch_user_analyzed_video_ids(user_id=user_id)
    for c in candidates:
        if c["video_id"] not in excluded:
            ref_title = recent_summary_titles[0] if recent_summary_titles else "ton historique"
            return RecoItem(
                video_id=c["video_id"],
                title=c["title"],
                channel=c["channel"],
                duration_seconds=c.get("duration", 0),
                source="history_similarity",
                why=f"Similaire à ton analyse « {ref_title} »",
                thumbnail_url=c.get("thumbnail"),
            )
    return None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_recos.py::test_history_similarity_returns_top_match tests/voice/test_companion_recos.py::test_history_similarity_excludes_already_analyzed tests/voice/test_companion_recos.py::test_history_similarity_no_match_returns_none -v
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_recos.py backend/tests/voice/test_companion_recos.py
git commit -m "feat(voice): companion recos — history+similarity source"
```

---

## Task 5: Reco source 2 — Trending DeepSight

**Files:**

- Modify: `backend/src/voice/companion_recos.py`
- Modify: `backend/tests/voice/test_companion_recos.py`

- [ ] **Step 1: Write the failing test**

```python
# Append to test_companion_recos.py
@pytest.mark.asyncio
async def test_trending_returns_first_match_for_theme():
    trending_mock = AsyncMock()
    trending_mock.get_trending.return_value = [
        {"video_id": "tr1", "title": "Top Trend", "channel": "Channel",
         "duration": 300, "thumbnail": "https://t/tr1.jpg"},
        {"video_id": "tr2", "title": "Other", "channel": "C2",
         "duration": 400, "thumbnail": None},
    ]

    from src.voice.companion_recos import fetch_trending_reco
    reco = await fetch_trending_reco(
        theme="géopolitique",
        trending_service=trending_mock,
        excluded_video_ids=set(),
    )

    assert reco.video_id == "tr1"
    assert reco.source == "trending"
    assert "cartonne" in reco.why.lower() or "tendance" in reco.why.lower()
    trending_mock.get_trending.assert_called_once_with(theme="géopolitique", limit=5)


@pytest.mark.asyncio
async def test_trending_skips_excluded():
    from src.voice.companion_recos import fetch_trending_reco
    trending_mock = AsyncMock()
    trending_mock.get_trending.return_value = [
        {"video_id": "ex", "title": "X", "channel": "C", "duration": 1, "thumbnail": None},
        {"video_id": "ok", "title": "OK", "channel": "C", "duration": 1, "thumbnail": None},
    ]
    reco = await fetch_trending_reco(
        theme="t", trending_service=trending_mock, excluded_video_ids={"ex"}
    )
    assert reco.video_id == "ok"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_recos.py::test_trending_returns_first_match_for_theme -v
```

Expected: FAIL `ImportError` on `fetch_trending_reco`.

- [ ] **Step 3: Add `fetch_trending_reco` to `companion_recos.py`**

```python
async def fetch_trending_reco(
    theme: str,
    trending_service,
    excluded_video_ids: set[str],
) -> Optional[RecoItem]:
    """Reco issue du trending pre-cache Redis sur thème user."""
    try:
        items = await trending_service.get_trending(theme=theme, limit=5)
    except Exception as exc:
        logger.warning("trending fetch failed (theme=%s): %s", theme, exc)
        return None

    for item in items or []:
        if item["video_id"] not in excluded_video_ids:
            return RecoItem(
                video_id=item["video_id"],
                title=item["title"],
                channel=item["channel"],
                duration_seconds=item.get("duration", 0),
                source="trending",
                why="En ce moment ça cartonne sur DeepSight",
                thumbnail_url=item.get("thumbnail"),
            )
    return None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_recos.py -v
```

Expected: 5 PASS (3 history + 2 trending).

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_recos.py backend/tests/voice/test_companion_recos.py
git commit -m "feat(voice): companion recos — trending source"
```

---

## Task 6: Reco source 3 — Tournesol

**Files:**

- Modify: `backend/src/voice/companion_recos.py`
- Modify: `backend/tests/voice/test_companion_recos.py`

- [ ] **Step 1: Write the failing test**

```python
# Append
@pytest.mark.asyncio
async def test_tournesol_returns_top_score():
    tournesol_mock = AsyncMock()
    tournesol_mock.recommend.return_value = [
        {"video_id": "to1", "title": "Top Tournesol", "channel": "C",
         "duration": 600, "score": 89.4, "thumbnail": "https://t.jpg"},
    ]
    from src.voice.companion_recos import fetch_tournesol_reco
    reco = await fetch_tournesol_reco(
        theme="philosophie",
        tournesol_service=tournesol_mock,
        excluded_video_ids=set(),
    )
    assert reco.video_id == "to1"
    assert reco.source == "tournesol"
    assert "tournesol" in reco.why.lower() or "top" in reco.why.lower()


@pytest.mark.asyncio
async def test_tournesol_api_error_returns_none():
    from src.voice.companion_recos import fetch_tournesol_reco
    tournesol_mock = AsyncMock()
    tournesol_mock.recommend.side_effect = Exception("API down")
    reco = await fetch_tournesol_reco(
        theme="t", tournesol_service=tournesol_mock, excluded_video_ids=set()
    )
    assert reco is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_recos.py::test_tournesol_returns_top_score -v
```

Expected: FAIL `ImportError`.

- [ ] **Step 3: Add `fetch_tournesol_reco`**

```python
async def fetch_tournesol_reco(
    theme: str,
    tournesol_service,
    excluded_video_ids: set[str],
) -> Optional[RecoItem]:
    """Reco issue de l'API Tournesol sur thème user."""
    try:
        items = await tournesol_service.recommend(theme=theme, limit=5)
    except Exception as exc:
        logger.warning("tournesol fetch failed (theme=%s): %s", theme, exc)
        return None

    for item in items or []:
        if item["video_id"] not in excluded_video_ids:
            return RecoItem(
                video_id=item["video_id"],
                title=item["title"],
                channel=item["channel"],
                duration_seconds=item.get("duration", 0),
                source="tournesol",
                why=f"Top score Tournesol sur {theme}",
                thumbnail_url=item.get("thumbnail"),
            )
    return None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_recos.py -v
```

Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_recos.py backend/tests/voice/test_companion_recos.py
git commit -m "feat(voice): companion recos — tournesol source"
```

---

## Task 7: Reco source 4 — YouTube Search (fallback uniquement)

**Files:**

- Modify: `backend/src/voice/companion_recos.py`
- Modify: `backend/tests/voice/test_companion_recos.py`

- [ ] **Step 1: Write the failing test**

```python
# Append
@pytest.mark.asyncio
async def test_youtube_search_returns_first_relevant():
    yt_mock = AsyncMock()
    yt_mock.search.return_value = [
        {"video_id": "yt1", "title": "Hit", "channel": "C", "duration": 200, "thumbnail": "u"},
    ]
    from src.voice.companion_recos import fetch_youtube_search_reco
    reco = await fetch_youtube_search_reco(
        topic="quantum",
        youtube_service=yt_mock,
        excluded_video_ids=set(),
    )
    assert reco.video_id == "yt1"
    assert reco.source == "youtube"


@pytest.mark.asyncio
async def test_youtube_search_no_results():
    from src.voice.companion_recos import fetch_youtube_search_reco
    yt_mock = AsyncMock()
    yt_mock.search.return_value = []
    reco = await fetch_youtube_search_reco(
        topic="x", youtube_service=yt_mock, excluded_video_ids=set()
    )
    assert reco is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_recos.py::test_youtube_search_returns_first_relevant -v
```

- [ ] **Step 3: Add `fetch_youtube_search_reco`**

```python
async def fetch_youtube_search_reco(
    topic: str,
    youtube_service,
    excluded_video_ids: set[str],
) -> Optional[RecoItem]:
    """Reco YouTube Search API — fallback du tool, pas pré-fetch."""
    try:
        items = await youtube_service.search(query=topic, limit=5)
    except Exception as exc:
        logger.warning("youtube search failed (topic=%s): %s", topic, exc)
        return None

    for item in items or []:
        if item["video_id"] not in excluded_video_ids:
            return RecoItem(
                video_id=item["video_id"],
                title=item["title"],
                channel=item["channel"],
                duration_seconds=item.get("duration", 0),
                source="youtube",
                why=f"Trouvé sur YouTube pour « {topic} »",
                thumbnail_url=item.get("thumbnail"),
            )
    return None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_recos.py -v
```

Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_recos.py backend/tests/voice/test_companion_recos.py
git commit -m "feat(voice): companion recos — youtube search fallback source"
```

---

## Task 8: Orchestrateur initial 3 recos (parallèle, gather)

**Files:**

- Modify: `backend/src/voice/companion_recos.py`
- Modify: `backend/tests/voice/test_companion_recos.py`

- [ ] **Step 1: Write the failing test**

```python
# Append
@pytest.mark.asyncio
async def test_build_initial_recos_three_sources_parallel():
    """3 recos = 1 history_similarity + 1 trending + 1 tournesol."""
    services = MagicMock()
    services.history = AsyncMock(return_value=RecoItem(
        video_id="h1", title="H", channel="HC", duration_seconds=1,
        source="history_similarity", why="w",
    ))
    services.trending = AsyncMock(return_value=RecoItem(
        video_id="t1", title="T", channel="TC", duration_seconds=1,
        source="trending", why="w",
    ))
    services.tournesol = AsyncMock(return_value=RecoItem(
        video_id="o1", title="O", channel="OC", duration_seconds=1,
        source="tournesol", why="w",
    ))

    from src.voice.companion_recos import build_initial_recos
    recos = await build_initial_recos(
        primary_theme="ia",
        history_fn=services.history,
        trending_fn=services.trending,
        tournesol_fn=services.tournesol,
    )

    assert len(recos) == 3
    assert {r.source for r in recos} == {"history_similarity", "trending", "tournesol"}


@pytest.mark.asyncio
async def test_build_initial_recos_skips_failed_sources():
    """Si une source retourne None, le résultat ne contient que les autres."""
    from src.voice.companion_recos import build_initial_recos
    history_fn = AsyncMock(return_value=None)
    trending_fn = AsyncMock(return_value=RecoItem(
        video_id="t1", title="T", channel="TC", duration_seconds=1,
        source="trending", why="w",
    ))
    tournesol_fn = AsyncMock(return_value=None)

    recos = await build_initial_recos(
        primary_theme="x",
        history_fn=history_fn, trending_fn=trending_fn, tournesol_fn=tournesol_fn,
    )
    assert len(recos) == 1
    assert recos[0].source == "trending"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_recos.py::test_build_initial_recos_three_sources_parallel -v
```

- [ ] **Step 3: Implement `build_initial_recos`**

```python
async def build_initial_recos(
    primary_theme: str,
    history_fn,
    trending_fn,
    tournesol_fn,
    timeout_seconds: float = 2.0,
) -> list[RecoItem]:
    """Run les 3 sources en parallèle avec timeout, drop les None."""
    async def _safe(fn):
        try:
            return await asyncio.wait_for(fn(), timeout=timeout_seconds)
        except (asyncio.TimeoutError, Exception) as exc:
            logger.warning("initial reco source timeout/error: %s", exc)
            return None

    results = await asyncio.gather(
        _safe(history_fn), _safe(trending_fn), _safe(tournesol_fn),
        return_exceptions=False,
    )
    return [r for r in results if r is not None]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_recos.py -v
```

Expected: 11 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_recos.py backend/tests/voice/test_companion_recos.py
git commit -m "feat(voice): companion recos — initial 3-recos parallel orchestrator"
```

---

## Task 9: Tool fallback chain `get_more_recos`

**Files:**

- Modify: `backend/src/voice/companion_recos.py`
- Modify: `backend/tests/voice/test_companion_recos.py`

- [ ] **Step 1: Write the failing test**

```python
# Append
@pytest.mark.asyncio
async def test_get_more_recos_fallback_chain_uses_first_non_empty():
    """Order: history → tournesol → youtube → trending."""
    history = AsyncMock(return_value=None)
    tournesol = AsyncMock(return_value=RecoItem(
        video_id="t1", title="T", channel="C", duration_seconds=1,
        source="tournesol", why="w",
    ))
    youtube = AsyncMock(return_value=None)
    trending = AsyncMock(return_value=None)

    from src.voice.companion_recos import get_more_recos_chain
    recos = await get_more_recos_chain(
        topic="x",
        excluded={"a"},
        history_fn=history, tournesol_fn=tournesol,
        youtube_fn=youtube, trending_fn=trending,
        max_count=3,
    )
    assert len(recos) == 1
    assert recos[0].source == "tournesol"
    history.assert_awaited_once()
    tournesol.assert_awaited_once()
    youtube.assert_not_awaited()  # short circuit
    trending.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_more_recos_returns_max_count():
    """Si plusieurs sources retournent, accumule jusqu'à max_count."""
    history = AsyncMock(return_value=RecoItem(video_id="h", title="H", channel="C",
        duration_seconds=1, source="history_similarity", why="w"))
    tournesol = AsyncMock(return_value=RecoItem(video_id="t", title="T", channel="C",
        duration_seconds=1, source="tournesol", why="w"))
    youtube = AsyncMock(return_value=RecoItem(video_id="y", title="Y", channel="C",
        duration_seconds=1, source="youtube", why="w"))
    trending = AsyncMock(return_value=None)

    from src.voice.companion_recos import get_more_recos_chain
    recos = await get_more_recos_chain(
        topic="x", excluded=set(),
        history_fn=history, tournesol_fn=tournesol,
        youtube_fn=youtube, trending_fn=trending,
        max_count=3,
    )
    assert len(recos) == 3
    assert [r.source for r in recos] == ["history_similarity", "tournesol", "youtube"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_recos.py::test_get_more_recos_fallback_chain_uses_first_non_empty -v
```

- [ ] **Step 3: Implement `get_more_recos_chain`**

```python
async def get_more_recos_chain(
    topic: str,
    excluded: set[str],
    history_fn,
    tournesol_fn,
    youtube_fn,
    trending_fn,
    max_count: int = 3,
) -> list[RecoItem]:
    """Chaîne fallback : history → tournesol → youtube → trending. Stop quand max_count atteint."""
    accumulator: list[RecoItem] = []
    for fn in (history_fn, tournesol_fn, youtube_fn, trending_fn):
        if len(accumulator) >= max_count:
            break
        try:
            result = await fn()
        except Exception as exc:
            logger.warning("get_more_recos source failed: %s", exc)
            continue
        if result is not None and result.video_id not in excluded:
            accumulator.append(result)
            excluded = excluded | {result.video_id}
    return accumulator[:max_count]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_recos.py -v
```

Expected: 13 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_recos.py backend/tests/voice/test_companion_recos.py
git commit -m "feat(voice): companion recos — get_more_recos fallback chain"
```

---

## Task 10: Builder `companion_context` (profil + cache Redis)

**Files:**

- Create: `backend/src/voice/companion_context.py`
- Test: `backend/tests/voice/test_companion_context.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_context.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json

from src.voice.companion_context import build_companion_context
from src.voice.schemas import CompanionContextResponse


@pytest.mark.asyncio
async def test_build_companion_context_cache_miss_full_pipeline():
    user = MagicMock(id=1, prenom="Maxime", first_name="Maxime",
                     plan="pro", language="fr", created_at="2024-01-01")
    db = AsyncMock()
    db.fetch_user_summary_count.return_value = 42
    db.fetch_recent_summaries.return_value = [
        MagicMock(title=f"Vidéo {i}", category="ia") for i in range(8)
    ]
    db.fetch_user_study_stats.return_value = MagicMock(
        current_streak_days=5, flashcards_due_today=3,
    )

    redis = AsyncMock()
    redis.get.return_value = None  # cache miss

    services = MagicMock()
    services.themes_fn = AsyncMock(return_value=["ia", "philo", "tech"])
    services.initial_recos_fn = AsyncMock(return_value=[])

    resp = await build_companion_context(
        user=user, db=db, redis=redis, services=services,
    )

    assert isinstance(resp, CompanionContextResponse)
    assert resp.profile.prenom == "Maxime"
    assert resp.profile.themes == ["ia", "philo", "tech"]
    assert resp.cache_hit is False
    redis.set.assert_called_once()  # write through


@pytest.mark.asyncio
async def test_build_companion_context_cache_hit_skips_pipeline():
    user = MagicMock(id=1, prenom="X", first_name="X", plan="pro", language="fr")
    db = AsyncMock()
    redis = AsyncMock()
    cached = {
        "profile": {
            "prenom": "Cached", "plan": "pro", "langue": "fr",
            "total_analyses": 1, "recent_titles": [],
            "themes": ["a", "b", "c"],
            "streak_days": 0, "flashcards_due_today": 0,
        },
        "initial_recos": [],
        "cache_hit": False,
    }
    redis.get.return_value = json.dumps(cached)

    services = MagicMock()
    services.themes_fn = AsyncMock()
    services.initial_recos_fn = AsyncMock()

    resp = await build_companion_context(user=user, db=db, redis=redis, services=services)
    assert resp.profile.prenom == "Cached"
    assert resp.cache_hit is True
    services.themes_fn.assert_not_called()
    services.initial_recos_fn.assert_not_called()


@pytest.mark.asyncio
async def test_build_companion_context_force_refresh():
    user = MagicMock(id=1, prenom="X", first_name="X", plan="pro", language="fr",
                     created_at="2024-01-01")
    db = AsyncMock()
    db.fetch_user_summary_count.return_value = 0
    db.fetch_recent_summaries.return_value = []
    db.fetch_user_study_stats.return_value = MagicMock(
        current_streak_days=0, flashcards_due_today=0,
    )

    redis = AsyncMock()
    redis.get.return_value = json.dumps({"any": "thing"})  # ignored

    services = MagicMock()
    services.themes_fn = AsyncMock(return_value=[])
    services.initial_recos_fn = AsyncMock(return_value=[])

    resp = await build_companion_context(
        user=user, db=db, redis=redis, services=services, force_refresh=True,
    )
    assert resp.cache_hit is False
    redis.get.assert_not_called()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_context.py -v
```

Expected: FAIL `ImportError`.

- [ ] **Step 3: Implement `companion_context.py`**

```python
"""Builder principal du contexte COMPANION agent — profil + recos + cache."""
import json
import logging
from typing import Optional, Protocol
from src.voice.schemas import CompanionContextResponse, ProfileBlock, RecoItem

logger = logging.getLogger(__name__)

CACHE_KEY_TEMPLATE = "companion_context:{user_id}"
CACHE_TTL_SECONDS = 3600  # 1h


async def build_companion_context(
    user,
    db,
    redis,
    services,
    force_refresh: bool = False,
) -> CompanionContextResponse:
    cache_key = CACHE_KEY_TEMPLATE.format(user_id=user.id)

    if not force_refresh:
        cached = await redis.get(cache_key)
        if cached:
            try:
                data = json.loads(cached)
                resp = CompanionContextResponse(**data)
                resp.cache_hit = True
                return resp
            except (json.JSONDecodeError, ValueError) as exc:
                logger.warning("companion_context cache decode failed: %s", exc)

    # Cache miss → full pipeline
    total = await db.fetch_user_summary_count(user_id=user.id)
    recents = await db.fetch_recent_summaries(user_id=user.id, limit=5)
    stats = await db.fetch_user_study_stats(user_id=user.id)
    themes = await services.themes_fn(user_id=user.id, db=db)

    primary_theme = themes[0] if themes else "découverte"
    initial_recos = await services.initial_recos_fn(primary_theme=primary_theme)

    profile = ProfileBlock(
        prenom=user.first_name or user.prenom or "ami",
        plan=user.plan,
        langue=getattr(user, "language", "fr") or "fr",
        total_analyses=total,
        recent_titles=[r.title for r in recents],
        themes=themes,
        streak_days=getattr(stats, "current_streak_days", 0) or 0,
        flashcards_due_today=getattr(stats, "flashcards_due_today", 0) or 0,
    )

    resp = CompanionContextResponse(
        profile=profile, initial_recos=initial_recos, cache_hit=False,
    )

    # Write-through cache
    try:
        await redis.set(cache_key, resp.model_dump_json(), ex=CACHE_TTL_SECONDS)
    except Exception as exc:
        logger.warning("companion_context cache write failed: %s", exc)

    return resp


async def invalidate_companion_context_cache(redis, user_id: int) -> None:
    """Hook appelé depuis /videos/analyze pour invalider le cache."""
    try:
        await redis.delete(CACHE_KEY_TEMPLATE.format(user_id=user_id))
    except Exception as exc:
        logger.warning("companion_context cache invalidate failed: %s", exc)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_context.py -v
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_context.py backend/tests/voice/test_companion_context.py
git commit -m "feat(voice): companion_context builder with Redis cache"
```

---

## Task 11: Endpoint `GET /api/voice/companion-context`

**Files:**

- Modify: `backend/src/voice/router.py`
- Test: `backend/tests/voice/test_companion_endpoint.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_endpoint.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_companion_context_endpoint_pro_user_200(authed_pro_client: AsyncClient):
    with patch("src.voice.router.build_companion_context", new_callable=AsyncMock) as mock_build:
        mock_build.return_value.model_dump.return_value = {
            "profile": {
                "prenom": "Test", "plan": "pro", "langue": "fr",
                "total_analyses": 0, "recent_titles": [],
                "themes": [], "streak_days": 0, "flashcards_due_today": 0,
            },
            "initial_recos": [],
            "cache_hit": False,
        }
        resp = await authed_pro_client.get("/api/voice/companion-context")
        assert resp.status_code == 200
        assert resp.json()["profile"]["plan"] == "pro"


@pytest.mark.asyncio
async def test_companion_context_endpoint_free_user_402(authed_free_client: AsyncClient):
    resp = await authed_free_client.get("/api/voice/companion-context")
    assert resp.status_code == 402
    assert "upgrade" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_companion_context_endpoint_unauth_401(client: AsyncClient):
    resp = await client.get("/api/voice/companion-context")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_companion_context_force_refresh_query_param(authed_pro_client: AsyncClient):
    with patch("src.voice.router.build_companion_context", new_callable=AsyncMock) as mock_build:
        mock_build.return_value.model_dump.return_value = {"profile": {
            "prenom": "T", "plan": "pro", "langue": "fr", "total_analyses": 0,
            "recent_titles": [], "themes": [], "streak_days": 0, "flashcards_due_today": 0,
        }, "initial_recos": [], "cache_hit": False}
        await authed_pro_client.get("/api/voice/companion-context?refresh=true")
        kwargs = mock_build.call_args.kwargs
        assert kwargs["force_refresh"] is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_endpoint.py -v
```

Expected: FAIL — endpoint not registered.

- [ ] **Step 3: Add endpoint to `router.py`**

```python
# backend/src/voice/router.py — append in voice router
from fastapi import HTTPException
from src.voice.companion_context import build_companion_context
from src.voice.companion_themes import extract_top3_themes
from src.voice.companion_recos import (
    fetch_history_similarity_reco,
    fetch_trending_reco,
    fetch_tournesol_reco,
    build_initial_recos,
)


@router.get("/companion-context", response_model=CompanionContextResponse)
async def companion_context_endpoint(
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    if current_user.plan != "pro":
        raise HTTPException(
            status_code=402,
            detail="Upgrade vers Pro requis pour Appel Vocal — https://www.deepsightsynthesis.com/upgrade",
        )

    services = _build_companion_services(db, redis, current_user)
    return await build_companion_context(
        user=current_user, db=db, redis=redis, services=services, force_refresh=refresh,
    )


def _build_companion_services(db, redis, user):
    """Wire les fonctions de récupération avec les services existants du backend."""
    from src.core.llm_provider import get_llm_client
    from src.tournesol.service import TournesolService
    from src.trending.service import TrendingService

    llm = get_llm_client(model="mistral-small-2603")

    async def themes_fn(user_id, db):
        return await extract_top3_themes(user_id=user_id, db=db, llm_client=llm)

    async def initial_recos_fn(primary_theme: str):
        excluded = await db.fetch_user_analyzed_video_ids(user_id=user.id)
        recent_titles = [s.title for s in await db.fetch_recent_summaries(user.id, limit=5)]

        async def history():
            return await fetch_history_similarity_reco(
                user_id=user.id, db=db, recent_summary_titles=recent_titles,
            )

        async def trending():
            return await fetch_trending_reco(
                theme=primary_theme,
                trending_service=TrendingService(redis),
                excluded_video_ids=excluded,
            )

        async def tournesol():
            return await fetch_tournesol_reco(
                theme=primary_theme,
                tournesol_service=TournesolService(),
                excluded_video_ids=excluded,
            )

        return await build_initial_recos(
            primary_theme=primary_theme,
            history_fn=history, trending_fn=trending, tournesol_fn=tournesol,
        )

    services = type("S", (), {})()
    services.themes_fn = themes_fn
    services.initial_recos_fn = initial_recos_fn
    return services
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_endpoint.py -v
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_companion_endpoint.py
git commit -m "feat(voice): GET /api/voice/companion-context endpoint"
```

---

## Task 12: Cache invalidation hook on `/videos/analyze`

**Files:**

- Modify: `backend/src/videos/router.py`
- Test: `backend/tests/voice/test_companion_context.py`

- [ ] **Step 1: Write the failing test**

```python
# Append to test_companion_context.py
@pytest.mark.asyncio
async def test_invalidate_companion_context_cache():
    from src.voice.companion_context import invalidate_companion_context_cache
    redis = AsyncMock()
    await invalidate_companion_context_cache(redis=redis, user_id=42)
    redis.delete.assert_called_once_with("companion_context:42")
```

- [ ] **Step 2: Run test to verify it passes (already implemented in Task 10)**

```bash
python -m pytest tests/voice/test_companion_context.py::test_invalidate_companion_context_cache -v
```

Expected: PASS (delete fn déjà ajoutée Task 10).

- [ ] **Step 3: Wire l'invalidation dans `videos/router.py`**

Find the `POST /api/videos/analyze` handler. After the analysis is successfully created (just before `return response`), add:

```python
# backend/src/videos/router.py — dans le handler POST /analyze, après création Summary
from src.voice.companion_context import invalidate_companion_context_cache
# ... existing analyse code ...
try:
    await invalidate_companion_context_cache(redis=redis, user_id=current_user.id)
except Exception as exc:
    logger.warning("companion cache invalidation skipped: %s", exc)
```

- [ ] **Step 4: Smoke test the wiring**

```bash
python -m pytest tests/videos/ -k "analyze" -v
```

Expected: existing analyze tests still PASS (no regression).

- [ ] **Step 5: Commit**

```bash
git add backend/src/videos/router.py backend/tests/voice/test_companion_context.py
git commit -m "feat(voice): invalidate companion_context cache on new analyze"
```

---

## Task 13: COMPANION system prompt — template + injection

**Files:**

- Create: `backend/src/voice/companion_prompt.py`
- Modify: `backend/src/voice/agent_types.py`
- Test: `backend/tests/voice/test_companion_prompt.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_prompt.py
import pytest
from src.voice.companion_prompt import render_companion_prompt
from src.voice.schemas import CompanionContextResponse, ProfileBlock, RecoItem


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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_prompt.py -v
```

- [ ] **Step 3: Create `companion_prompt.py`**

```python
"""Template system prompt enrichi pour COMPANION agent."""
from src.voice.schemas import CompanionContextResponse


COMPANION_TEMPLATE = """Tu es DeepSight Companion, un coach de découverte vocal qui connaît {prenom} et l'aide à explorer YouTube.

PROFIL UTILISATEUR
==================
Prénom : {prenom}
Plan : {plan}  · Langue : {langue}
Total analyses sur DeepSight : {total_analyses}
Streak étude : {streak_days} jours · Flashcards en review aujourd'hui : {flashcards_due_today}

DERNIÈRES ANALYSES
==================
{recent_titles_block}

CENTRES D'INTÉRÊT (top 3)
=========================
{themes_block}

RECOMMANDATIONS PRÉ-PRÉPARÉES
=============================
{initial_recos_block}

INSTRUCTIONS
============
1. Salue {prenom} par prénom dès le bonjour, mentionne brièvement une analyse récente pour montrer que tu connais ses sujets.
2. Si {prenom} demande directement un sujet précis dès l'ouverture → saute les recos pré-préparées, appelle directement get_more_recos(topic=...).
3. Sinon → présente les 3 recos pré-préparées avec leurs accroches personnalisées.
4. Pour chaque reco proposée :
   - Si oui → propose start_analysis(video_url) puis demande s'il veut continuer à discuter pendant l'analyse ou raccrocher.
   - Si non → demande pourquoi (plus court / plus dense / autre angle) et appelle get_more_recos.
5. Reste cool, jamais pushy. Source brièvement chaque reco.
6. N'invente JAMAIS de vidéos. Utilise UNIQUEMENT les recos pré-préparées ci-dessus ou retournées par get_more_recos.
7. Tu peux appeler start_analysis(video_url) pour lancer une analyse en background pendant l'appel.
"""


def render_companion_prompt(ctx: CompanionContextResponse) -> str:
    p = ctx.profile

    if p.recent_titles:
        recent_block = "\n".join(f"- {t}" for t in p.recent_titles)
    else:
        recent_block = "(aucune analyse récente)"

    if p.themes:
        themes_block = ", ".join(p.themes)
    else:
        themes_block = "(non identifié — historique trop léger)"

    if ctx.initial_recos:
        recos_lines = []
        for i, r in enumerate(ctx.initial_recos, 1):
            recos_lines.append(
                f"{i}. [{r.source}] {r.title} — {r.channel}"
                f" ({r.duration_seconds // 60} min) — video_id: {r.video_id}\n"
                f"   Pourquoi : {r.why}"
            )
        recos_block = "\n".join(recos_lines)
    else:
        recos_block = "Aucune reco pré-préparée — utilise get_more_recos dès le début."

    return COMPANION_TEMPLATE.format(
        prenom=p.prenom,
        plan=p.plan,
        langue=p.langue,
        total_analyses=p.total_analyses,
        streak_days=p.streak_days,
        flashcards_due_today=p.flashcards_due_today,
        recent_titles_block=recent_block,
        themes_block=themes_block,
        initial_recos_block=recos_block,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_prompt.py -v
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/companion_prompt.py backend/tests/voice/test_companion_prompt.py
git commit -m "feat(voice): companion prompt template render"
```

---

## Task 14: Inject COMPANION prompt at session creation

**Files:**

- Modify: `backend/src/voice/router.py`
- Modify: `backend/src/voice/agent_types.py`
- Test: `backend/tests/voice/test_companion_prompt.py`

- [ ] **Step 1: Write the failing test**

```python
# Append
@pytest.mark.asyncio
async def test_voice_session_companion_injects_enriched_prompt(
    authed_pro_client, monkeypatch
):
    captured_prompt = {}

    async def fake_create_session(*, agent_type, system_prompt, **kw):
        captured_prompt["value"] = system_prompt
        return {"signed_url": "wss://x", "conversation_token": "t", "session_id": 1}

    from src.voice import router as voice_router
    monkeypatch.setattr(voice_router, "_create_voice_session", fake_create_session)

    resp = await authed_pro_client.post(
        "/api/voice/session",
        json={"agent_type": "companion", "summary_id": None},
    )
    assert resp.status_code == 200
    assert "DeepSight Companion" in captured_prompt["value"]
    assert "get_more_recos" in captured_prompt["value"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_prompt.py::test_voice_session_companion_injects_enriched_prompt -v
```

- [ ] **Step 3: Wire injection in `/voice/session` handler**

Find the existing handler in `backend/src/voice/router.py` and add a branch when `agent_type == "companion"`:

```python
# In the POST /voice/session handler, before _create_voice_session call
from src.voice.companion_prompt import render_companion_prompt
from src.voice.companion_context import build_companion_context

if request.agent_type == "companion":
    services = _build_companion_services(db, redis, current_user)
    ctx = await build_companion_context(
        user=current_user, db=db, redis=redis, services=services,
    )
    enriched_system_prompt = render_companion_prompt(ctx)
else:
    enriched_system_prompt = _build_existing_system_prompt(...)  # existing path

session = await _create_voice_session(
    agent_type=request.agent_type,
    system_prompt=enriched_system_prompt,
    user=current_user,
    summary_id=request.summary_id,
)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_prompt.py -v
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py
git commit -m "feat(voice): inject enriched companion prompt at /session"
```

---

## Task 15: Tool `POST /api/voice/tools/companion-recos`

**Files:**

- Modify: `backend/src/voice/router.py`
- Test: `backend/tests/voice/test_companion_tools.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_tools.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_companion_recos_tool_valid_token(authed_webhook_client: AsyncClient):
    with patch("src.voice.router.get_more_recos_chain", new_callable=AsyncMock) as mock_chain:
        mock_chain.return_value = [
            {"video_id": "v1", "title": "T", "channel": "C",
             "duration_seconds": 100, "source": "tournesol", "why": "w"},
        ]
        resp = await authed_webhook_client.post(
            "/api/voice/tools/companion-recos",
            json={"topic": "ia"},
            headers={"X-Conversation-Token": "valid-token"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "recos" in body


@pytest.mark.asyncio
async def test_companion_recos_tool_invalid_token_403(client: AsyncClient):
    resp = await client.post(
        "/api/voice/tools/companion-recos",
        json={"topic": "x"},
        headers={"X-Conversation-Token": "bogus"},
    )
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_tools.py -v
```

- [ ] **Step 3: Add tool endpoint**

```python
# backend/src/voice/router.py — append in tools section
from src.voice.companion_recos import get_more_recos_chain
from src.voice.schemas import GetMoreRecosRequest, GetMoreRecosResponse


@router.post("/tools/companion-recos", response_model=GetMoreRecosResponse)
async def companion_recos_tool(
    body: GetMoreRecosRequest,
    session: VoiceSession = Depends(verify_conversation_token),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    user = session.user
    excluded = (await db.fetch_user_analyzed_video_ids(user_id=user.id)) | set(
        body.exclude_video_ids
    )

    services = _build_companion_services(db, redis, user)

    async def history():
        recents = await db.fetch_recent_summaries(user_id=user.id, limit=5)
        return await fetch_history_similarity_reco(
            user_id=user.id, db=db,
            recent_summary_titles=[s.title for s in recents],
        )

    async def tournesol():
        from src.tournesol.service import TournesolService
        return await fetch_tournesol_reco(
            theme=body.topic, tournesol_service=TournesolService(),
            excluded_video_ids=excluded,
        )

    async def youtube():
        from src.transcripts.youtube_search import YouTubeSearchService
        return await fetch_youtube_search_reco(
            topic=body.topic, youtube_service=YouTubeSearchService(),
            excluded_video_ids=excluded,
        )

    async def trending():
        from src.trending.service import TrendingService
        return await fetch_trending_reco(
            theme=body.topic, trending_service=TrendingService(redis),
            excluded_video_ids=excluded,
        )

    recos = await get_more_recos_chain(
        topic=body.topic, excluded=excluded,
        history_fn=history, tournesol_fn=tournesol,
        youtube_fn=youtube, trending_fn=trending,
        max_count=3,
    )
    return GetMoreRecosResponse(recos=recos)
```

The `verify_conversation_token` dependency must be imported from existing voice helpers (already used by `/tools/search-transcript` etc.).

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_tools.py::test_companion_recos_tool_valid_token tests/voice/test_companion_tools.py::test_companion_recos_tool_invalid_token_403 -v
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_companion_tools.py
git commit -m "feat(voice): tool POST /tools/companion-recos with fallback chain"
```

---

## Task 16: Tool `POST /api/voice/tools/start-analysis`

**Files:**

- Modify: `backend/src/voice/router.py`
- Modify: `backend/tests/voice/test_companion_tools.py`

- [ ] **Step 1: Write the failing test**

```python
# Append
@pytest.mark.asyncio
async def test_start_analysis_tool_valid_url_kicks_analysis(
    authed_webhook_client: AsyncClient
):
    with patch("src.voice.router.start_video_analysis", new_callable=AsyncMock) as mock:
        mock.return_value = {"summary_id": 99, "status": "started"}
        resp = await authed_webhook_client.post(
            "/api/voice/tools/start-analysis",
            json={"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers={"X-Conversation-Token": "valid-token"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["summary_id"] == 99
        assert body["status"] == "started"
        assert body["eta_seconds"] > 0


@pytest.mark.asyncio
async def test_start_analysis_tool_invalid_url_400(authed_webhook_client: AsyncClient):
    resp = await authed_webhook_client.post(
        "/api/voice/tools/start-analysis",
        json={"video_url": "https://twitter.com/x"},
        headers={"X-Conversation-Token": "valid-token"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_analysis_tool_quota_exceeded_402(authed_webhook_client: AsyncClient):
    with patch("src.voice.router.check_analysis_quota", new_callable=AsyncMock) as mock:
        mock.side_effect = HTTPException(status_code=402, detail="quota")
        resp = await authed_webhook_client.post(
            "/api/voice/tools/start-analysis",
            json={"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers={"X-Conversation-Token": "valid-token"},
        )
        assert resp.status_code == 402


@pytest.mark.asyncio
async def test_start_analysis_rate_limit_3_per_call(authed_webhook_client: AsyncClient):
    """Max 3 analyses lancées par session vocale."""
    with patch("src.voice.router.start_video_analysis", new_callable=AsyncMock) as mock:
        mock.return_value = {"summary_id": 1, "status": "started"}
        for _ in range(3):
            r = await authed_webhook_client.post(
                "/api/voice/tools/start-analysis",
                json={"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                headers={"X-Conversation-Token": "valid-token"},
            )
            assert r.status_code == 200
        # 4ᵉ tentative
        r4 = await authed_webhook_client.post(
            "/api/voice/tools/start-analysis",
            json={"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers={"X-Conversation-Token": "valid-token"},
        )
        assert r4.status_code == 429
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest tests/voice/test_companion_tools.py::test_start_analysis_tool_valid_url_kicks_analysis -v
```

- [ ] **Step 3: Add `start_analysis` tool endpoint**

```python
# backend/src/voice/router.py
import re
from fastapi import HTTPException
from src.voice.schemas import StartAnalysisRequest, StartAnalysisResponse

YOUTUBE_URL_RE = re.compile(
    r"^https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})"
)
START_ANALYSIS_RATE_LIMIT_PER_SESSION = 3


@router.post("/tools/start-analysis", response_model=StartAnalysisResponse)
async def start_analysis_tool(
    body: StartAnalysisRequest,
    session: VoiceSession = Depends(verify_conversation_token),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    match = YOUTUBE_URL_RE.match(body.video_url)
    if not match:
        raise HTTPException(status_code=400, detail="URL YouTube invalide")
    video_id = match.group(1)

    # Rate limit per session (max 3 analyses)
    rl_key = f"start_analysis_rl:{session.id}"
    current = int(await redis.get(rl_key) or 0)
    if current >= START_ANALYSIS_RATE_LIMIT_PER_SESSION:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum {START_ANALYSIS_RATE_LIMIT_PER_SESSION} analyses par appel",
        )

    user = session.user
    await check_analysis_quota(user=user, db=db)
    result = await start_video_analysis(
        user=user, video_id=video_id, db=db, mode="quick",
    )

    await redis.incr(rl_key)
    await redis.expire(rl_key, 3600)

    return StartAnalysisResponse(
        summary_id=result["summary_id"],
        status=result["status"],
        eta_seconds=120,
        message=f"Analyse de {video_id} lancée — ETA 2 min",
    )
```

`check_analysis_quota` and `start_video_analysis` must be imported from existing video module helpers.

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest tests/voice/test_companion_tools.py -v
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_companion_tools.py
git commit -m "feat(voice): tool POST /tools/start-analysis with quota + rate limit"
```

---

## Task 17: Frontend — `services/api.ts` `getCompanionContext`

**Files:**

- Modify: `frontend/src/services/api.ts`
- Test: `frontend/src/services/__tests__/api-companion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/services/__tests__/api-companion.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";

describe("api.getCompanionContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /api/voice/companion-context with auth header", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          prenom: "T",
          plan: "pro",
          langue: "fr",
          total_analyses: 0,
          recent_titles: [],
          themes: [],
          streak_days: 0,
          flashcards_due_today: 0,
        },
        initial_recos: [],
        cache_hit: false,
      }),
    } as Response);

    const result = await api.getCompanionContext({ authToken: "tok" });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/voice/companion-context"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );
    expect(result.profile.plan).toBe("pro");
  });

  it("supports refresh query param", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          prenom: "X",
          plan: "pro",
          langue: "fr",
          total_analyses: 0,
          recent_titles: [],
          themes: [],
          streak_days: 0,
          flashcards_due_today: 0,
        },
        initial_recos: [],
        cache_hit: false,
      }),
    } as Response);
    await api.getCompanionContext({ authToken: "tok", refresh: true });
    expect(fetchSpy.mock.calls[0][0]).toContain("refresh=true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npx vitest run src/services/__tests__/api-companion.test.ts
```

Expected: FAIL — `api.getCompanionContext is not a function`.

- [ ] **Step 3: Add to `frontend/src/services/api.ts`**

```typescript
// Append to api.ts
export interface RecoItem {
  video_id: string;
  title: string;
  channel: string;
  duration_seconds: number;
  source: "history_similarity" | "trending" | "tournesol" | "youtube";
  why: string;
  thumbnail_url?: string;
}

export interface ProfileBlock {
  prenom: string;
  plan: string;
  langue: string;
  total_analyses: number;
  recent_titles: string[];
  themes: string[];
  streak_days: number;
  flashcards_due_today: number;
}

export interface CompanionContextResponse {
  profile: ProfileBlock;
  initial_recos: RecoItem[];
  cache_hit: boolean;
}

// Add to the `api` object
async getCompanionContext(opts: {
  authToken: string;
  refresh?: boolean;
}): Promise<CompanionContextResponse> {
  const url = new URL(`${API_BASE_URL}/api/voice/companion-context`);
  if (opts.refresh) url.searchParams.set("refresh", "true");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${opts.authToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `companion_context failed: ${res.status}`);
  }
  return res.json();
},
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/__tests__/api-companion.test.ts
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/services/__tests__/api-companion.test.ts
git commit -m "feat(frontend): api.getCompanionContext + types"
```

---

## Task 18: `VoiceCallPage.tsx` — skeleton + loading + Free/Plus gating

**Files:**

- Create: `frontend/src/pages/VoiceCallPage.tsx`
- Test: `frontend/src/pages/__tests__/VoiceCallPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/__tests__/VoiceCallPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VoiceCallPage from "../VoiceCallPage";

vi.mock("../../services/api", () => ({
  api: {
    getCompanionContext: vi.fn(),
  },
}));

import { api } from "../../services/api";
import { AuthContext } from "../../contexts/AuthContext";

function renderWithUser(user: any) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={
          { user, accessToken: "t", login: vi.fn(), logout: vi.fn() } as any
        }
      >
        <VoiceCallPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("VoiceCallPage", () => {
  it("shows upgrade CTA for Free plan", () => {
    renderWithUser({ plan: "free", first_name: "X" });
    expect(screen.getByText(/Upgrade Pro/i)).toBeInTheDocument();
    expect(api.getCompanionContext).not.toHaveBeenCalled();
  });

  it("shows upgrade CTA for Plus plan", () => {
    renderWithUser({ plan: "plus", first_name: "X" });
    expect(screen.getByText(/Upgrade Pro/i)).toBeInTheDocument();
  });

  it("loads companion context for Pro user", async () => {
    (api.getCompanionContext as any).mockResolvedValue({
      profile: {
        prenom: "Maxime",
        plan: "pro",
        langue: "fr",
        total_analyses: 5,
        recent_titles: ["A"],
        themes: ["IA"],
        streak_days: 1,
        flashcards_due_today: 0,
      },
      initial_recos: [],
      cache_hit: false,
    });
    renderWithUser({ plan: "pro", first_name: "Maxime" });
    await waitFor(() => {
      expect(screen.getByText(/Maxime/)).toBeInTheDocument();
    });
    expect(api.getCompanionContext).toHaveBeenCalledWith({ authToken: "t" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/pages/__tests__/VoiceCallPage.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `VoiceCallPage.tsx`**

```tsx
// frontend/src/pages/VoiceCallPage.tsx
import React, { useContext, useEffect, useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { api, CompanionContextResponse } from "../services/api";

const VoiceCallPage: React.FC = () => {
  const { user, accessToken } = useContext(AuthContext);
  const [ctx, setCtx] = useState<CompanionContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPro = user?.plan === "pro";

  useEffect(() => {
    if (!isPro || !accessToken) return;
    setLoading(true);
    api
      .getCompanionContext({ authToken: accessToken })
      .then(setCtx)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isPro, accessToken]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <Phone className="w-16 h-16 text-violet-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Appel Vocal</h1>
        <p className="text-gray-400 mb-6 max-w-md">
          Coach de découverte vocal réservé au plan Pro. Recommandations
          personnalisées en temps réel basées sur ton historique.
        </p>
        <Link
          to="/upgrade"
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium"
        >
          Upgrade Pro
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-400">Erreur : {error}</div>;
  }

  if (!ctx) return null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Salut {ctx.profile.prenom}</h1>
      <p className="text-gray-400 mb-6">
        {ctx.profile.themes.length > 0
          ? `On parle ${ctx.profile.themes.join(", ")} ?`
          : "Prêt pour une session découverte ?"}
      </p>
      {/* Voice call UI — wired Task 19 */}
    </div>
  );
};

export default VoiceCallPage;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/pages/__tests__/VoiceCallPage.test.tsx
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/VoiceCallPage.tsx frontend/src/pages/__tests__/VoiceCallPage.test.tsx
git commit -m "feat(frontend): VoiceCallPage skeleton + Pro gating"
```

---

## Task 19: `VoiceCallPage` — wire `useVoiceChat` + tool toast

**Files:**

- Modify: `frontend/src/pages/VoiceCallPage.tsx`
- Modify: `frontend/src/pages/__tests__/VoiceCallPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// Append
it("renders voice call button when context loaded", async () => {
  (api.getCompanionContext as any).mockResolvedValue({
    profile: {
      prenom: "M",
      plan: "pro",
      langue: "fr",
      total_analyses: 0,
      recent_titles: [],
      themes: [],
      streak_days: 0,
      flashcards_due_today: 0,
    },
    initial_recos: [],
    cache_hit: false,
  });
  renderWithUser({ plan: "pro", first_name: "M" });
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /Appeler/i }),
    ).toBeInTheDocument();
  });
});

it("shows toast when start_analysis tool fires", async () => {
  // Simulate tool callback firing
  (api.getCompanionContext as any).mockResolvedValue({
    profile: {
      prenom: "M",
      plan: "pro",
      langue: "fr",
      total_analyses: 0,
      recent_titles: [],
      themes: [],
      streak_days: 0,
      flashcards_due_today: 0,
    },
    initial_recos: [],
    cache_hit: false,
  });
  const { container } = renderWithUser({ plan: "pro", first_name: "M" });
  // Test: dispatchEvent custom 'voice:start_analysis' → toast appears
  await waitFor(() => {
    window.dispatchEvent(
      new CustomEvent("voice:start_analysis", {
        detail: { summary_id: 99 },
      }),
    );
    expect(screen.getByText(/Analyse en cours/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/pages/__tests__/VoiceCallPage.test.tsx
```

- [ ] **Step 3: Wire `useVoiceChat` + toast**

```tsx
// Replace VoiceCallPage body section after `if (!ctx) return null;`
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { toast } from "../components/ui/Toast"; // existing toast util — adapt path
import { Phone, PhoneOff, Loader2 } from "lucide-react";

// inside component, after ctx loaded:
const voice = useVoiceChat({
  agentType: "companion",
  summaryId: null,
  onToolCall: (toolName, payload) => {
    if (toolName === "start_analysis" && payload?.summary_id) {
      toast.success(`Analyse en cours... (id #${payload.summary_id})`, {
        action: { label: "Voir", to: "/history" },
      });
      window.dispatchEvent(
        new CustomEvent("voice:start_analysis", { detail: payload }),
      );
    }
  },
});

return (
  <div className="max-w-3xl mx-auto p-6">
    <h1 className="text-3xl font-bold mb-2">Salut {ctx.profile.prenom}</h1>
    <p className="text-gray-400 mb-6">
      {ctx.profile.themes.length > 0
        ? `On parle ${ctx.profile.themes.join(", ")} ?`
        : "Prêt pour une session découverte ?"}
    </p>

    <button
      type="button"
      onClick={voice.isActive ? voice.stop : voice.start}
      className="w-full py-4 bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center justify-center gap-3 font-medium text-lg"
      aria-label={voice.isActive ? "Raccrocher" : "Appeler"}
    >
      {voice.isActive ? <PhoneOff /> : <Phone />}
      {voice.isActive ? "Raccrocher" : "Appeler"}
    </button>

    {voice.transcript.length > 0 && (
      <div className="mt-6 space-y-2">
        {voice.transcript.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "text-blue-300" : "text-gray-200"}
          >
            <strong>{m.role === "user" ? "Toi" : "Companion"} :</strong>{" "}
            {m.text}
          </div>
        ))}
      </div>
    )}
  </div>
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/pages/__tests__/VoiceCallPage.test.tsx
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/VoiceCallPage.tsx frontend/src/pages/__tests__/VoiceCallPage.test.tsx
git commit -m "feat(frontend): wire useVoiceChat + start_analysis toast"
```

---

## Task 20: Sidebar — ajout item « Appel Vocal »

**Files:**

- Modify: `frontend/src/components/sidebar/SidebarNav.tsx`
- Test: `frontend/src/components/sidebar/__tests__/SidebarNav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/sidebar/__tests__/SidebarNav.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarNav } from "../SidebarNav";

describe("SidebarNav", () => {
  it("includes Appel Vocal item between Débat IA and Historique", () => {
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    const items = screen.getAllByRole("link").map((a) => a.textContent);
    const idxDebate = items.findIndex((t) => t?.includes("Débat IA"));
    const idxVoice = items.findIndex((t) => t?.includes("Appel Vocal"));
    const idxHistory = items.findIndex((t) => t?.includes("Historique"));
    expect(idxVoice).toBeGreaterThan(idxDebate);
    expect(idxVoice).toBeLessThan(idxHistory);
  });

  it("Appel Vocal links to /voice-call", () => {
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Appel Vocal/i });
    expect(link).toHaveAttribute("href", "/voice-call");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/sidebar/__tests__/SidebarNav.test.tsx
```

Expected: FAIL — no "Appel Vocal" item.

- [ ] **Step 3: Modify `SidebarNav.tsx`**

```tsx
// frontend/src/components/sidebar/SidebarNav.tsx
import React from "react";
import {
  Video,
  Swords,
  Phone,
  History,
  Gem,
  Settings,
  Crown,
} from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarNavProps {
  isAdmin?: boolean;
  onNavigate?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isAdmin = false,
  onNavigate,
}) => {
  const navItems = [
    { path: "/dashboard", icon: Video, label: "Vidéo" },
    { path: "/debate", icon: Swords, label: "Débat IA" },
    { path: "/voice-call", icon: Phone, label: "Appel Vocal" },
    { path: "/history", icon: History, label: "Historique" },
    { path: "/upgrade", icon: Gem, label: "Upgrade" },
    { path: "/settings", icon: Settings, label: "Paramètres" },
  ];

  if (isAdmin) {
    navItems.push({ path: "/admin", icon: Crown, label: "Admin" });
  }

  return (
    <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.path}
          to={item.path}
          icon={item.icon}
          onClick={onNavigate}
        >
          {item.label}
        </SidebarNavItem>
      ))}
    </nav>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/sidebar/__tests__/SidebarNav.test.tsx
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/sidebar/SidebarNav.tsx frontend/src/components/sidebar/__tests__/SidebarNav.test.tsx
git commit -m "feat(frontend): sidebar item 'Appel Vocal' → /voice-call"
```

---

## Task 21: Route lazy `/voice-call` dans `App.tsx`

**Files:**

- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/__tests__/routing.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/__tests__/routing.test.tsx (or extend existing)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Suspense } from "react";

describe("Routing", () => {
  it("renders VoiceCallPage on /voice-call", async () => {
    const { default: App } = await import("../App");
    render(
      <MemoryRouter initialEntries={["/voice-call"]}>
        <Suspense fallback={<div>loading</div>}>
          <App />
        </Suspense>
      </MemoryRouter>,
    );
    // Wait for lazy import
    expect(
      await screen.findByRole("heading", {
        name: /Appel Vocal|Salut|Upgrade/i,
      }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/routing.test.tsx
```

- [ ] **Step 3: Add route to `App.tsx`**

```tsx
// frontend/src/App.tsx — locate the Routes block and add:
const VoiceCallPage = React.lazy(() => import("./pages/VoiceCallPage"));

// In the <Routes>:
<Route path="/voice-call" element={<VoiceCallPage />} />;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/routing.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/__tests__/routing.test.tsx
git commit -m "feat(frontend): route /voice-call lazy → VoiceCallPage"
```

---

## Task 22: E2E Playwright — voice-call.spec.ts

**Files:**

- Create: `frontend/e2e/voice-call.spec.ts`

- [ ] **Step 1: Write the E2E test**

```typescript
// frontend/e2e/voice-call.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Voice Call Page", () => {
  test("Pro user lands on /voice-call and sees personalized greeting", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.E2E_PRO_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_PRO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");

    await page.click('a[href="/voice-call"]');
    await expect(page.locator("h1")).toContainText(/Salut/i);
    await expect(page.getByRole("button", { name: /Appeler/i })).toBeVisible();
  });

  test("Free user sees upgrade CTA on /voice-call", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.E2E_FREE_EMAIL!);
    await page.fill('input[name="password"]', process.env.E2E_FREE_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");

    await page.goto("/voice-call");
    await expect(page.getByText(/Upgrade Pro/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npx playwright test e2e/voice-call.spec.ts
```

Expected: 2 PASS (en local avec serveur dev + comptes de test).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/voice-call.spec.ts
git commit -m "test(frontend): E2E voice-call page Pro + Free flows"
```

---

## Task 23: Smoke test full pipeline (intégration)

**Files:**

- Create: `backend/tests/voice/test_companion_integration.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/voice/test_companion_integration.py
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_pipeline_pro_user_get_context_then_session(
    authed_pro_client: AsyncClient
):
    """End-to-end: GET context → POST session → vérifier system prompt enrichi."""
    ctx_resp = await authed_pro_client.get("/api/voice/companion-context")
    assert ctx_resp.status_code == 200
    ctx = ctx_resp.json()
    assert ctx["profile"]["plan"] == "pro"

    sess_resp = await authed_pro_client.post(
        "/api/voice/session",
        json={"agent_type": "companion", "summary_id": None},
    )
    assert sess_resp.status_code == 200
    body = sess_resp.json()
    assert "signed_url" in body
    assert "conversation_token" in body or "livekit_jwt" in body
```

- [ ] **Step 2: Run test**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/voice/test_companion_integration.py -v
```

Expected: PASS si toutes les pièces précédentes sont mergées.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/voice/test_companion_integration.py
git commit -m "test(voice): companion full pipeline integration smoke"
```

---

## Self-Review

**Spec coverage** :

- Endpoint `/companion-context` ✅ Task 11
- Top 3 thèmes Mistral + fallback category ✅ Task 2-3
- 4 sources recos ✅ Tasks 4-7
- Build initial recos parallèle ✅ Task 8
- Tool `get_more_recos` chaîne fallback ✅ Tasks 9 + 15
- Tool `start_analysis` quota + rate limit ✅ Task 16
- System prompt enrichi ✅ Tasks 13-14
- Cache Redis + invalidation ✅ Tasks 10 + 12
- Frontend page + sidebar + route ✅ Tasks 18-21
- Feature gating Free/Plus → CTA ✅ Task 18
- E2E ✅ Task 22
- Intégration ✅ Task 23

**Placeholder scan** : aucun « TBD », « TODO », « implement later ». Code complet partout. Les imports `_create_voice_session`, `start_video_analysis`, `check_analysis_quota`, `verify_conversation_token` sont des helpers existants côté `backend/src/voice/router.py` (à valider au moment du wiring de Task 14-16 — voir notes ci-dessous).

**Type consistency** : `RecoItem`, `ProfileBlock`, `CompanionContextResponse` cohérents partout (Task 1 → Tasks 4-23). `RecoSource` literal cohérent avec `frontend/api.ts` Task 17.

**Notes pour l'implémenteur** :

- Tasks 14, 15, 16 supposent que `verify_conversation_token`, `_create_voice_session`, `start_video_analysis`, `check_analysis_quota` existent déjà dans `voice/router.py`. À vérifier au moment d'écrire — si absents, il faut soit identifier l'équivalent existant, soit ajouter une Task préalable.
- `db.fetch_recent_summaries`, `db.fetch_user_summary_count`, `db.fetch_user_analyzed_video_ids`, `db.fetch_user_study_stats`, `db.embedding_service` sont des helpers SQLAlchemy à wirer — adapter aux query patterns existants si l'API helper n'existe pas (les remplacer par des `select()` directs).
- `TournesolService`, `TrendingService`, `YouTubeSearchService` peuvent nécessiter un wrapper léger autour des routers existants (`backend/src/tournesol/router.py`, `backend/src/trending/`).
- Le `useVoiceChat` hook frontend doit supporter `onToolCall` callback — vérifier sa signature existante. Si absent, ajouter en Task préalable avant Task 19.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-coach-vocal-decouverte.md`.

**Two execution options** :

1. **Subagent-Driven (recommended)** — Je dispatch un sous-agent Opus 4.7 frais par tâche, review entre les tâches, itération rapide. Bon match pour ce plan (23 tâches, dépendances claires).

2. **Inline Execution** — J'exécute les tâches dans cette session avec checkpoints batch.

Quelle approche ?
