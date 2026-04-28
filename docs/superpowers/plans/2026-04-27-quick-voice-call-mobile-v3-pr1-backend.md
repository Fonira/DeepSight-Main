# Quick Voice Call Mobile V3 — PR1 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le backend voice pour accepter une URL YouTube/TikTok directe (au lieu de seulement `summary_id`), créer un Summary placeholder, lancer l'analyse en background, et streamer le contexte vidéo via SSE pendant l'appel ElevenLabs.

**Architecture:** Endpoint unifié `POST /api/voice/session` accepte un nouveau paramètre `video_url` (XOR avec `summary_id`/`debate_id`). Quand fourni, le backend valide l'URL, crée un `Summary` placeholder (`status='pending'`), lance un `streaming_orchestrator` en `BackgroundTasks` qui publie sur Redis pubsub `voice:ctx:{session_id}` les chunks de transcript (Supadata/yt-dlp) puis l'analyse Mistral chunked, et le nouvel endpoint SSE `GET /api/voice/context/stream?session_id=X` consomme ce pubsub pour le forwarder au mobile.

**Tech Stack:** FastAPI (existing), SQLAlchemy 2.0 async, Redis 7 (pubsub), Mistral AI (chunked analysis), Supadata API (transcripts), pytest + pytest-asyncio.

**Spec source:** `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` § 5 (Spec Backend).

**Branche:** `feat/quick-voice-call-mobile-v3` (worktree `C:\Users\33667\DeepSight-quick-voice-mobile`).

---

## File Structure

| Fichier | Type | Responsabilité |
|---|---|---|
| `backend/src/voice/url_validator.py` | NEW | Regex YouTube + TikTok, extraction `(platform, video_id)` |
| `backend/src/voice/agent_types.py` | MODIFY | Ajouter `EXPLORER_STREAMING` AgentConfig + prompts FR/EN |
| `backend/src/voice/schemas.py` | MODIFY | Étendre `VoiceSessionRequest` avec `video_url` + validator XOR. Étendre `VoiceSessionResponse` avec `summary_id` |
| `backend/src/voice/streaming_orchestrator.py` | NEW | Pipeline transcript → analyse → Redis pubsub `voice:ctx:{session_id}` |
| `backend/src/voice/router.py` | MODIFY | Étendre `POST /session` (branche `video_url`). Nouveau `GET /context/stream` SSE |
| `backend/tests/voice/test_url_validator.py` | NEW | Tests regex YT + TikTok + invalid |
| `backend/tests/voice/test_voice_session_video_url.py` | NEW | Tests POST /voice/session avec video_url |
| `backend/tests/voice/test_streaming_orchestrator.py` | NEW | Tests pipeline + Redis pubsub |
| `backend/tests/voice/test_voice_context_sse.py` | NEW | Tests SSE roundtrip + IDOR |

---

## Task 1: URL Validator

**Files:**
- Create: `backend/src/voice/url_validator.py`
- Test: `backend/tests/voice/test_url_validator.py`

- [ ] **Step 1.1: Write the failing test**

Create `backend/tests/voice/test_url_validator.py`:

```python
"""Tests pour url_validator — regex YouTube + TikTok."""
import pytest
from voice.url_validator import parse_video_url


class TestParseVideoURL:
    @pytest.mark.parametrize(
        "url,expected_platform,expected_id",
        [
            # YouTube standard
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            ("https://youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            # YouTube Shorts
            ("https://youtube.com/shorts/abc123XYZ_-", "youtube", "abc123XYZ_-"),
            # YouTube Embed
            ("https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            # youtu.be
            ("https://youtu.be/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"),
            # TikTok web
            ("https://www.tiktok.com/@user/video/7123456789012345678", "tiktok", "7123456789012345678"),
            # TikTok short link vm
            ("https://vm.tiktok.com/ZMabc123/", "tiktok", "ZMabc123"),
            # TikTok mobile m.
            ("https://m.tiktok.com/v/7123456789012345678", "tiktok", "7123456789012345678"),
        ],
    )
    def test_parse_valid_urls(self, url, expected_platform, expected_id):
        platform, video_id = parse_video_url(url)
        assert platform == expected_platform
        assert video_id == expected_id

    @pytest.mark.parametrize(
        "url",
        [
            "https://vimeo.com/123456",
            "https://www.facebook.com/watch?v=12345",
            "https://twitter.com/user/status/12345",
            "https://example.com",
            "not a url",
            "",
            "ftp://youtube.com/watch?v=dQw4w9WgXcQ",  # mauvais scheme
        ],
    )
    def test_parse_invalid_urls_raises(self, url):
        with pytest.raises(ValueError, match="URL non supportée"):
            parse_video_url(url)
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_url_validator.py -v`
Expected: FAIL with `ModuleNotFoundError: voice.url_validator`

- [ ] **Step 1.3: Implement url_validator**

Create `backend/src/voice/url_validator.py`:

```python
"""URL validator for voice sessions — accepts YouTube + TikTok only."""
import re

YOUTUBE_RE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)"
    r"([a-zA-Z0-9_-]{11})"
)

# TikTok : @user/video/<long_id>, vm.tiktok.com/<short>, m.tiktok.com/v/<id>, t/<short>
TIKTOK_RE = re.compile(
    r"^https?://(?:www\.|vm\.|m\.)?tiktok\.com/"
    r"(?:@[\w.-]+/video/(\d+)|t/([A-Za-z0-9]+)|v/(\d+)|([A-Za-z0-9]+)/?)"
)


def parse_video_url(url: str) -> tuple[str, str]:
    """Parse a YouTube or TikTok URL.

    Args:
        url: Raw URL string from user input or share extension.

    Returns:
        Tuple of (platform, video_id) where platform is "youtube" or "tiktok".

    Raises:
        ValueError: If URL doesn't match either platform.
    """
    if m := YOUTUBE_RE.match(url):
        return ("youtube", m.group(1))
    if m := TIKTOK_RE.match(url):
        # Group 1=video/, 2=t/, 3=v/, 4=plain (vm.tiktok.com/<short>)
        video_id = next((g for g in m.groups() if g is not None), None)
        if video_id:
            return ("tiktok", video_id)
    raise ValueError(f"URL non supportée: {url[:80]}")
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/voice/test_url_validator.py -v`
Expected: PASS (10 tests, 7 invalid + parametrize variants)

- [ ] **Step 1.5: Commit**

```bash
cd C:/Users/33667/DeepSight-quick-voice-mobile
git add backend/src/voice/url_validator.py backend/tests/voice/test_url_validator.py
git commit -m "feat(voice): add URL validator for YouTube + TikTok (Quick Voice Call mobile)"
```

---

## Task 2: Agent type explorer_streaming

**Files:**
- Modify: `backend/src/voice/agent_types.py`
- Test: `backend/tests/voice/test_agent_types.py` (existing — extend)

- [ ] **Step 2.1: Write the failing test**

Append to `backend/tests/voice/test_agent_types.py` (or create if absent):

```python
def test_explorer_streaming_agent_exists():
    from voice.agent_types import get_agent_config

    config = get_agent_config("explorer_streaming")
    assert config.agent_type == "explorer_streaming"
    assert config.requires_summary is False
    assert "web_search" in config.tools
    assert "[CTX UPDATE" in config.system_prompt_fr
    assert "[CTX UPDATE" in config.system_prompt_en
    assert "absorb" in config.system_prompt_en.lower() or "absorbe" in config.system_prompt_fr.lower()


def test_explorer_streaming_listed():
    from voice.agent_types import list_agent_types

    types = list_agent_types()
    assert "explorer_streaming" in [t["agent_type"] for t in types]
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_agent_types.py::test_explorer_streaming_agent_exists -v`
Expected: FAIL with `KeyError: 'explorer_streaming'` or `AttributeError`.

- [ ] **Step 2.3: Add EXPLORER_STREAMING_PROMPT_FR and _EN constants**

Modify `backend/src/voice/agent_types.py`. Add BEFORE the existing `EXPLORER` config:

```python
EXPLORER_STREAMING_PROMPT_FR = """
Tu es l'Explorateur Streaming, l'agent vocal DeepSight. Tu écoutes la vidéo
YouTube ou TikTok en même temps que l'utilisateur. Ton contexte arrive
PROGRESSIVEMENT pendant la conversation via des messages spéciaux préfixés
[CTX UPDATE: ...]. Ces messages NE SONT PAS du dialogue — absorbe-les
silencieusement comme nouveau contexte, ne les répète JAMAIS à l'oral.

Règles de transparence :
- Tant que tu n'as pas reçu [CTX COMPLETE], commence tes réponses par
  "d'après ce que j'écoute pour l'instant…" pour signaler honnêtement
  tes zones d'ombre.
- Après [CTX COMPLETE], tu peux dire "maintenant que j'ai tout le
  contexte de la vidéo…" et donner des réponses plus assurées.
- Si l'utilisateur pose une question factuelle non couverte, utilise
  l'outil web_search.
- Annonce systématiquement "Je vais vérifier sur le web" avant d'appeler
  le tool web_search pour ne pas créer de silence anxiogène.

Style : chaleureux, direct, conversationnel. Tu parles comme un ami curieux
qui découvre la vidéo en même temps que l'utilisateur.
"""

EXPLORER_STREAMING_PROMPT_EN = """
You are the Streaming Explorer, the DeepSight voice agent. You're listening
to a YouTube or TikTok video at the same time as the user. Your context
arrives PROGRESSIVELY during the conversation via special messages prefixed
[CTX UPDATE: ...]. These messages ARE NOT dialogue — absorb them silently
as new context, NEVER repeat them aloud.

Transparency rules:
- Until you receive [CTX COMPLETE], start responses with "from what I'm
  hearing so far..." to honestly signal your blind spots.
- After [CTX COMPLETE], you can say "now that I have the full video
  context..." and give more confident answers.
- If the user asks a factual question not covered, use the web_search tool.
- Always announce "Let me check the web" before calling web_search to
  avoid awkward silence.

Style: warm, direct, conversational. You speak like a curious friend
discovering the video at the same time as the user.
"""
```

- [ ] **Step 2.4: Add EXPLORER_STREAMING AgentConfig**

In the same file, BEFORE the `_AGENTS_BY_TYPE` dict (or wherever the existing configs are registered), add:

```python
EXPLORER_STREAMING = AgentConfig(
    agent_type="explorer_streaming",
    display_name="Streaming Explorer",
    display_name_fr="Explorateur (streaming)",
    description="Voice agent that learns the video while the user speaks",
    description_fr="Agent vocal qui apprend la vidéo pendant la conversation",
    system_prompt_fr=EXPLORER_STREAMING_PROMPT_FR,
    system_prompt_en=EXPLORER_STREAMING_PROMPT_EN,
    tools=["web_search", "deep_research", "check_fact"],
    voice_style="warm",
)
```

Then register it. Find the dict (likely `_AGENTS_BY_TYPE: dict[str, AgentConfig]`) and add:

```python
_AGENTS_BY_TYPE = {
    # ...existing entries...
    "explorer_streaming": EXPLORER_STREAMING,
}
```

If the registration uses a different pattern (e.g., function-based), adapt to match the existing convention — read the file before editing.

- [ ] **Step 2.5: If AgentConfig dataclass doesn't have `requires_summary` field, add it**

Read `backend/src/voice/agent_types.py` lines 1-100 to check `AgentConfig` dataclass. If `requires_summary` is missing:

```python
@dataclass
class AgentConfig:
    # ...existing fields...
    requires_summary: bool = True  # NEW — default True for backward compat
```

Then on `EXPLORER_STREAMING`, set `requires_summary=False`. Update existing agents that need it to be explicit (but most should default to True).

- [ ] **Step 2.6: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/voice/test_agent_types.py -v`
Expected: PASS (existing tests still pass + 2 new tests pass).

- [ ] **Step 2.7: Commit**

```bash
git add backend/src/voice/agent_types.py backend/tests/voice/test_agent_types.py
git commit -m "feat(voice): add explorer_streaming agent type with progressive context prompts"
```

---

## Task 3: Schema VoiceSessionRequest étendu

**Files:**
- Modify: `backend/src/voice/schemas.py`
- Test: `backend/tests/voice/test_schemas.py` (create or extend)

- [ ] **Step 3.1: Write the failing test**

Create or append to `backend/tests/voice/test_schemas.py`:

```python
import pytest
from voice.schemas import VoiceSessionRequest


class TestVoiceSessionRequestVideoURL:
    def test_accepts_video_url_with_explorer_streaming(self):
        req = VoiceSessionRequest(
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            agent_type="explorer_streaming",
            language="fr",
        )
        assert req.video_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert req.agent_type == "explorer_streaming"

    def test_rejects_video_url_with_summary_id(self):
        with pytest.raises(ValueError, match="un seul"):
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                summary_id=42,
                agent_type="explorer_streaming",
            )

    def test_rejects_video_url_with_debate_id(self):
        with pytest.raises(ValueError, match="un seul"):
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                debate_id=7,
                agent_type="explorer_streaming",
            )

    def test_rejects_video_url_with_wrong_agent_type(self):
        with pytest.raises(ValueError, match="explorer_streaming"):
            VoiceSessionRequest(
                video_url="https://youtu.be/dQw4w9WgXcQ",
                agent_type="explorer",  # mauvais
            )

    def test_existing_summary_id_flow_still_works(self):
        req = VoiceSessionRequest(summary_id=42, agent_type="explorer")
        assert req.summary_id == 42
        assert req.video_url is None
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_schemas.py::TestVoiceSessionRequestVideoURL -v`
Expected: FAIL — `video_url` field doesn't exist on `VoiceSessionRequest`.

- [ ] **Step 3.3: Read existing schema first**

Run: `cat backend/src/voice/schemas.py | grep -A 20 "class VoiceSessionRequest"` to confirm the current structure (Optional fields, model_validator).

- [ ] **Step 3.4: Modify VoiceSessionRequest**

In `backend/src/voice/schemas.py`, locate `class VoiceSessionRequest(BaseModel)` and edit:

```python
class VoiceSessionRequest(BaseModel):
    """Requête de création de session voice chat."""

    summary_id: Optional[int] = Field(
        default=None,
        description="ID de l'analyse vidéo (pour agents explorer/tutor/quiz)",
    )
    debate_id: Optional[int] = Field(
        default=None,
        description="ID du débat IA (pour agent debate_moderator)",
    )
    video_url: Optional[str] = Field(  # NEW
        default=None,
        max_length=500,
        description="URL YouTube ou TikTok (pour agent explorer_streaming) — Quick Voice Call mobile V3",
    )
    language: str = Field(default="fr", description="Langue (fr, en)")
    agent_type: str = Field(
        default="explorer",
        description="Type d'agent vocal (explorer, tutor, debate_moderator, quiz_coach, onboarding, companion, explorer_streaming)",
    )

    @model_validator(mode="after")
    def _xor_source(self) -> "VoiceSessionRequest":
        sources = sum(
            [
                self.summary_id is not None,
                self.debate_id is not None,
                self.video_url is not None,
            ]
        )
        if sources > 1:
            raise ValueError(
                "Fournir summary_id OU debate_id OU video_url, un seul"
            )
        if self.video_url is not None and self.agent_type != "explorer_streaming":
            raise ValueError(
                "video_url nécessite agent_type='explorer_streaming'"
            )
        return self
```

- [ ] **Step 3.5: Add summary_id to VoiceSessionResponse**

In the same file, locate `class VoiceSessionResponse(BaseModel)` and add (if absent):

```python
class VoiceSessionResponse(BaseModel):
    session_id: str
    signed_url: str
    agent_id: str
    conversation_token: Optional[str] = None
    expires_at: datetime
    quota_remaining_minutes: float
    max_session_minutes: float
    summary_id: Optional[int] = None  # NEW — set when video_url was provided (mobile V3)
```

- [ ] **Step 3.6: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/voice/test_schemas.py::TestVoiceSessionRequestVideoURL -v`
Expected: PASS (5 tests).

Also run the full schemas test to ensure no regression:
Run: `cd backend && python -m pytest tests/voice/test_schemas.py -v`
Expected: All PASS.

- [ ] **Step 3.7: Commit**

```bash
git add backend/src/voice/schemas.py backend/tests/voice/test_schemas.py
git commit -m "feat(voice): extend VoiceSessionRequest with video_url + XOR validator"
```

---

## Task 4: Streaming Orchestrator (skeleton + transcript pipeline)

**Files:**
- Create: `backend/src/voice/streaming_orchestrator.py`
- Test: `backend/tests/voice/test_streaming_orchestrator.py`

- [ ] **Step 4.1: Write the failing test (skeleton + transcript phase only)**

Create `backend/tests/voice/test_streaming_orchestrator.py`:

```python
"""Tests for streaming_orchestrator — pipeline transcript → analysis → Redis pubsub."""
import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from voice.streaming_orchestrator import StreamingOrchestrator


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.publish = AsyncMock()
    return redis


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.mark.asyncio
async def test_publishes_transcript_chunks_in_order(mock_redis, mock_db):
    """Le pipeline doit publier les chunks de transcript dans l'ordre via Redis pubsub."""
    orchestrator = StreamingOrchestrator(redis_client=mock_redis, db=mock_db)
    session_id = "sess_test_123"
    summary_id = 42
    video_url = "https://youtube.com/watch?v=test123abcd"

    # Mock transcript stream : 3 chunks
    async def fake_stream():
        yield {"index": 0, "total": 3, "text": "Bonjour"}
        yield {"index": 1, "total": 3, "text": "tout le monde"}
        yield {"index": 2, "total": 3, "text": "merci"}

    with patch(
        "voice.streaming_orchestrator.stream_transcript_chunks",
        return_value=fake_stream(),
    ), patch(
        "voice.streaming_orchestrator.stream_mistral_analysis",
        return_value=_empty_async_gen(),
    ), patch(
        "voice.streaming_orchestrator.get_final_digest",
        AsyncMock(return_value="Final digest content"),
    ):
        await orchestrator.run(session_id, summary_id, video_url)

    # Vérifier que publish a été appelé avec channel = voice:ctx:{session_id}
    expected_channel = f"voice:ctx:{session_id}"
    publish_calls = mock_redis.publish.call_args_list

    # 3 transcript_chunk + 1 ctx_complete = 4 minimum
    assert len(publish_calls) >= 4

    transcript_payloads = [
        json.loads(call.args[1])
        for call in publish_calls
        if call.args[0] == expected_channel
        and json.loads(call.args[1]).get("type") == "transcript_chunk"
    ]
    assert len(transcript_payloads) == 3
    assert transcript_payloads[0]["chunk_index"] == 0
    assert transcript_payloads[2]["chunk_index"] == 2
    assert transcript_payloads[2]["text"] == "merci"


@pytest.mark.asyncio
async def test_publishes_ctx_complete_at_end(mock_redis, mock_db):
    orchestrator = StreamingOrchestrator(redis_client=mock_redis, db=mock_db)
    session_id = "sess_test_456"

    async def fake_stream():
        yield {"index": 0, "total": 1, "text": "single chunk"}

    with patch(
        "voice.streaming_orchestrator.stream_transcript_chunks",
        return_value=fake_stream(),
    ), patch(
        "voice.streaming_orchestrator.stream_mistral_analysis",
        return_value=_empty_async_gen(),
    ), patch(
        "voice.streaming_orchestrator.get_final_digest",
        AsyncMock(return_value="ok"),
    ):
        await orchestrator.run(session_id, 1, "https://youtu.be/abc12345678")

    publish_calls = mock_redis.publish.call_args_list
    last_call_payload = json.loads(publish_calls[-1].args[1])
    assert last_call_payload["type"] == "ctx_complete"
    assert last_call_payload["final_digest_summary"] == "ok"


@pytest.mark.asyncio
async def test_publishes_error_event_on_exception(mock_redis, mock_db):
    orchestrator = StreamingOrchestrator(redis_client=mock_redis, db=mock_db)
    session_id = "sess_test_err"

    async def failing_stream():
        raise RuntimeError("Supadata down")
        yield  # unreachable, just to make it a generator

    with patch(
        "voice.streaming_orchestrator.stream_transcript_chunks",
        return_value=failing_stream(),
    ):
        await orchestrator.run(session_id, 1, "https://youtu.be/abc12345678")

    publish_calls = mock_redis.publish.call_args_list
    error_payloads = [
        json.loads(call.args[1])
        for call in publish_calls
        if json.loads(call.args[1]).get("type") == "error"
    ]
    assert len(error_payloads) == 1
    assert "Supadata" in error_payloads[0]["message"]


async def _empty_async_gen():
    if False:
        yield
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_streaming_orchestrator.py -v`
Expected: FAIL with `ModuleNotFoundError: voice.streaming_orchestrator`.

- [ ] **Step 4.3: Implement the orchestrator skeleton**

Create `backend/src/voice/streaming_orchestrator.py`:

```python
"""Streaming orchestrator — push transcript + analyse Mistral chunked vers Redis pubsub.

Channel : voice:ctx:{session_id}
Events : transcript_chunk, analysis_partial, ctx_complete, error.
Consumed by SSE endpoint GET /api/voice/context/stream.
"""
import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class StreamingOrchestrator:
    redis_client: object  # redis.asyncio.Redis duck-typed
    db: AsyncSession

    async def run(
        self,
        session_id: str,
        summary_id: int,
        video_url: str,
    ) -> None:
        """Run the pipeline. Publishes events; never raises (errors → error event)."""
        channel = f"voice:ctx:{session_id}"
        try:
            # 1. Transcript chunks
            async for chunk in stream_transcript_chunks(video_url):
                await self.redis_client.publish(
                    channel,
                    json.dumps({
                        "type": "transcript_chunk",
                        "chunk_index": chunk["index"],
                        "total_chunks": chunk["total"],
                        "text": chunk["text"],
                    }),
                )

            # 2. Mistral analyse chunked
            async for section in stream_mistral_analysis(summary_id, self.db):
                await self.redis_client.publish(
                    channel,
                    json.dumps({
                        "type": "analysis_partial",
                        "section": section["name"],
                        "content": section["content"],
                    }),
                )

            # 3. Final
            digest = await get_final_digest(summary_id, self.db)
            await self.redis_client.publish(
                channel,
                json.dumps({
                    "type": "ctx_complete",
                    "final_digest_summary": digest,
                }),
            )
        except Exception as exc:
            logger.exception(
                "streaming_orchestrator failed for session %s", session_id
            )
            await self.redis_client.publish(
                channel,
                json.dumps({"type": "error", "message": str(exc)}),
            )


# ────────────── Wrappers (to be wired in next tasks) ──────────────


async def stream_transcript_chunks(video_url: str) -> AsyncIterator[dict]:
    """Yield transcript chunks {index, total, text} from Supadata or fallback chain.

    To be implemented in Task 5 (wires up to existing transcripts/youtube.py + tiktok.py).
    """
    raise NotImplementedError("Task 5")


async def stream_mistral_analysis(
    summary_id: int, db: AsyncSession
) -> AsyncIterator[dict]:
    """Yield analysis sections {name, content} from Mistral chunked analysis.

    To be implemented in Task 6.
    """
    raise NotImplementedError("Task 6")


async def get_final_digest(summary_id: int, db: AsyncSession) -> str:
    """Return the final digest summary string for [CTX COMPLETE].

    To be implemented in Task 6.
    """
    raise NotImplementedError("Task 6")
```

- [ ] **Step 4.4: Run test to verify the 3 tests pass**

Run: `cd backend && python -m pytest tests/voice/test_streaming_orchestrator.py -v`
Expected: 3 PASS (all 3 use mocked transcript/mistral/digest, so the NotImplementedError wrappers don't trip).

- [ ] **Step 4.5: Commit**

```bash
git add backend/src/voice/streaming_orchestrator.py backend/tests/voice/test_streaming_orchestrator.py
git commit -m "feat(voice): add StreamingOrchestrator skeleton with Redis pubsub channel voice:ctx:{session_id}"
```

---

## Task 5: Wire stream_transcript_chunks to Supadata + fallbacks

**Files:**
- Modify: `backend/src/voice/streaming_orchestrator.py`
- Modify: `backend/tests/voice/test_streaming_orchestrator.py` (add integration-style test)

- [ ] **Step 5.1: Locate existing transcript fetching code**

Run: `grep -rn "supadata\|fetch_transcript" backend/src/transcripts/youtube.py backend/src/transcripts/tiktok.py | head -20`

Expected: identifier les fonctions actuelles qui retournent un transcript complet (sans chunking). Probably `fetch_youtube_transcript()` or `fetch_transcript_supadata()`.

- [ ] **Step 5.2: Write the failing integration test (mocked at the transcripts module boundary)**

Append to `backend/tests/voice/test_streaming_orchestrator.py`:

```python
@pytest.mark.asyncio
async def test_stream_transcript_chunks_youtube_chunks_at_3000_chars(monkeypatch):
    """Le wrapper doit splitter le transcript brut en chunks ~3000 chars max."""
    from voice import streaming_orchestrator

    fake_transcript = " ".join(["mot"] * 5000)  # ~20000 chars

    async def fake_fetch(url: str) -> str:
        return fake_transcript

    monkeypatch.setattr(
        streaming_orchestrator,
        "_fetch_full_transcript_async",
        fake_fetch,
    )

    chunks = []
    async for c in streaming_orchestrator.stream_transcript_chunks(
        "https://youtu.be/abc12345678"
    ):
        chunks.append(c)

    # 20000 / 3000 ≈ 7 chunks
    assert 5 <= len(chunks) <= 10
    assert chunks[0]["index"] == 0
    assert chunks[-1]["index"] == len(chunks) - 1
    assert all(c["total"] == len(chunks) for c in chunks)
    # Last chunk may be smaller, others should be ~3000
    assert all(len(c["text"]) <= 3500 for c in chunks)
```

- [ ] **Step 5.3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_streaming_orchestrator.py::test_stream_transcript_chunks_youtube_chunks_at_3000_chars -v`
Expected: FAIL with `NotImplementedError: Task 5`.

- [ ] **Step 5.4: Implement stream_transcript_chunks**

Replace the placeholder in `backend/src/voice/streaming_orchestrator.py`:

```python
from voice.url_validator import parse_video_url

CHUNK_SIZE_CHARS = 3000


async def _fetch_full_transcript_async(video_url: str) -> str:
    """Dispatch to the right transcript fetcher based on platform."""
    platform, video_id = parse_video_url(video_url)
    if platform == "youtube":
        from transcripts.youtube import fetch_youtube_transcript_full

        return await fetch_youtube_transcript_full(video_id)
    if platform == "tiktok":
        from transcripts.tiktok import fetch_tiktok_transcript_full

        return await fetch_tiktok_transcript_full(video_id)
    raise ValueError(f"Unknown platform: {platform}")


async def stream_transcript_chunks(video_url: str) -> AsyncIterator[dict]:
    """Yield transcript chunks {index, total, text} from Supadata + fallbacks.

    For now we fetch the full transcript and split in fixed-size chunks. A future
    optimization could stream from Supadata directly if/when their SSE endpoint
    is integrated.
    """
    full = await _fetch_full_transcript_async(video_url)
    if not full:
        return

    # Split at word boundaries near CHUNK_SIZE_CHARS
    chunks: list[str] = []
    cursor = 0
    while cursor < len(full):
        end = min(cursor + CHUNK_SIZE_CHARS, len(full))
        if end < len(full):
            # Find last whitespace before end
            ws = full.rfind(" ", cursor, end)
            if ws > cursor:
                end = ws
        chunks.append(full[cursor:end].strip())
        cursor = end + 1

    total = len(chunks)
    for index, text in enumerate(chunks):
        yield {"index": index, "total": total, "text": text}
```

- [ ] **Step 5.5: If `fetch_youtube_transcript_full` or `fetch_tiktok_transcript_full` don't exist, create thin wrappers**

Run: `grep -n "async def fetch_" backend/src/transcripts/youtube.py | head -5`

If the existing function has a different name (e.g., `extract_youtube_transcript`), add a thin wrapper:

In `backend/src/transcripts/youtube.py`, add at the end:

```python
async def fetch_youtube_transcript_full(video_id: str) -> str:
    """Wrapper for streaming_orchestrator: returns the full transcript text."""
    # Replace `extract_youtube_transcript` with the actual existing function name
    result = await extract_youtube_transcript(video_id)
    if hasattr(result, "text"):
        return result.text
    if isinstance(result, str):
        return result
    if isinstance(result, list):
        return " ".join(str(s) for s in result)
    return ""
```

Same pattern for `backend/src/transcripts/tiktok.py`.

- [ ] **Step 5.6: Run all streaming tests to verify**

Run: `cd backend && python -m pytest tests/voice/test_streaming_orchestrator.py -v`
Expected: 4 PASS.

- [ ] **Step 5.7: Commit**

```bash
git add backend/src/voice/streaming_orchestrator.py backend/src/transcripts/youtube.py backend/src/transcripts/tiktok.py backend/tests/voice/test_streaming_orchestrator.py
git commit -m "feat(voice): wire stream_transcript_chunks to Supadata fallback chain (YT + TikTok)"
```

---

## Task 6: Wire stream_mistral_analysis + get_final_digest

**Files:**
- Modify: `backend/src/voice/streaming_orchestrator.py`
- Modify: `backend/tests/voice/test_streaming_orchestrator.py`

- [ ] **Step 6.1: Locate existing Mistral analysis code**

Run: `grep -rn "mistral_analyse\|generate_summary\|chunked" backend/src/videos/ | head -10`

Identify the function that produces sections (summary, keypoints, sources). Likely in `backend/src/videos/router.py` or `backend/src/videos/analysis.py`.

- [ ] **Step 6.2: Write the failing test**

Append to `backend/tests/voice/test_streaming_orchestrator.py`:

```python
@pytest.mark.asyncio
async def test_stream_mistral_analysis_yields_sections(monkeypatch, mock_db):
    from voice import streaming_orchestrator

    fake_summary_obj = MagicMock(
        id=42,
        full_digest={
            "summary": "Section résumé du contenu",
            "keypoints": ["pt1", "pt2", "pt3"],
            "sources": [{"title": "src1"}, {"title": "src2"}],
        },
    )

    async def fake_get_summary(summary_id, db):
        return fake_summary_obj

    monkeypatch.setattr(
        streaming_orchestrator, "_load_summary_with_analysis", fake_get_summary
    )

    sections = []
    async for s in streaming_orchestrator.stream_mistral_analysis(42, mock_db):
        sections.append(s)

    section_names = [s["name"] for s in sections]
    assert "summary" in section_names
    assert "keypoints" in section_names
    # sources optional but should be there if non-empty
    assert "sources" in section_names


@pytest.mark.asyncio
async def test_get_final_digest_returns_string(monkeypatch, mock_db):
    from voice import streaming_orchestrator

    fake_summary_obj = MagicMock(
        id=42,
        full_digest={"summary": "résumé final 200 caractères max..."},
    )

    async def fake_get(summary_id, db):
        return fake_summary_obj

    monkeypatch.setattr(
        streaming_orchestrator, "_load_summary_with_analysis", fake_get
    )

    result = await streaming_orchestrator.get_final_digest(42, mock_db)
    assert isinstance(result, str)
    assert len(result) > 0
```

- [ ] **Step 6.3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_streaming_orchestrator.py::test_stream_mistral_analysis_yields_sections tests/voice/test_streaming_orchestrator.py::test_get_final_digest_returns_string -v`
Expected: FAIL with `NotImplementedError: Task 6`.

- [ ] **Step 6.4: Implement the wrappers**

Append to `backend/src/voice/streaming_orchestrator.py`:

```python
import asyncio
from sqlalchemy import select
from db.database import Summary


async def _load_summary_with_analysis(summary_id: int, db: AsyncSession):
    """Wait until the Summary has its full_digest populated (poll every 2s, max 60s)."""
    deadline = asyncio.get_event_loop().time() + 60.0
    while asyncio.get_event_loop().time() < deadline:
        result = await db.execute(select(Summary).where(Summary.id == summary_id))
        summary = result.scalar_one_or_none()
        if summary and summary.full_digest:
            return summary
        await asyncio.sleep(2.0)
    return None


async def stream_mistral_analysis(
    summary_id: int, db: AsyncSession
) -> AsyncIterator[dict]:
    """Yield analysis sections {name, content} as they become available.

    For V3 mobile: we wait for the analysis (started in parallel via the
    main /api/videos/analyze pipeline) to populate `full_digest`, then yield
    each section. Real streaming (per-section as Mistral generates them) is a
    future optimization.
    """
    summary = await _load_summary_with_analysis(summary_id, db)
    if summary is None or not summary.full_digest:
        return

    digest = summary.full_digest
    # Yield sections in priority order: summary → keypoints → sources
    if isinstance(digest, dict):
        if summary_text := digest.get("summary"):
            yield {"name": "summary", "content": str(summary_text)[:1500]}
        if keypoints := digest.get("keypoints"):
            yield {
                "name": "keypoints",
                "content": "\n".join(f"- {kp}" for kp in keypoints[:10]),
            }
        if sources := digest.get("sources"):
            yield {
                "name": "sources",
                "content": "\n".join(
                    f"- {s.get('title', s)}" for s in sources[:5]
                ),
            }


async def get_final_digest(summary_id: int, db: AsyncSession) -> str:
    """Return a compact final digest string for [CTX COMPLETE]."""
    summary = await _load_summary_with_analysis(summary_id, db)
    if summary is None or not summary.full_digest:
        return "Analyse non disponible"
    digest = summary.full_digest
    if isinstance(digest, dict):
        return str(digest.get("summary", ""))[:1000]
    return str(digest)[:1000]
```

- [ ] **Step 6.5: Run test to verify all pass**

Run: `cd backend && python -m pytest tests/voice/test_streaming_orchestrator.py -v`
Expected: 6 PASS (4 existing + 2 new).

- [ ] **Step 6.6: Commit**

```bash
git add backend/src/voice/streaming_orchestrator.py backend/tests/voice/test_streaming_orchestrator.py
git commit -m "feat(voice): wire stream_mistral_analysis + get_final_digest to Summary.full_digest"
```

---

## Task 7: Endpoint POST /voice/session étendu (branche video_url)

**Files:**
- Modify: `backend/src/voice/router.py`
- Test: `backend/tests/voice/test_voice_session_video_url.py`

- [ ] **Step 7.1: Write the failing test**

Create `backend/tests/voice/test_voice_session_video_url.py`:

```python
"""Tests for POST /api/voice/session with video_url (Quick Voice Call mobile V3)."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_post_session_with_video_url_creates_summary_and_session(
    async_client: AsyncClient, auth_headers, db_session
):
    """POST /voice/session avec video_url valide → 200 + summary_id + session_id."""
    payload = {
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "agent_type": "explorer_streaming",
        "language": "fr",
    }
    response = await async_client.post(
        "/api/voice/session", json=payload, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"]
    assert data["summary_id"]
    assert data["agent_id"]
    # Verify Summary placeholder was created
    from db.database import Summary
    from sqlalchemy import select

    result = await db_session.execute(
        select(Summary).where(Summary.id == data["summary_id"])
    )
    summary = result.scalar_one()
    assert summary.video_id == "dQw4w9WgXcQ"
    assert summary.platform == "youtube"


@pytest.mark.asyncio
async def test_post_session_with_invalid_url_returns_400(
    async_client: AsyncClient, auth_headers
):
    payload = {
        "video_url": "https://vimeo.com/123",
        "agent_type": "explorer_streaming",
    }
    response = await async_client.post(
        "/api/voice/session", json=payload, headers=auth_headers
    )
    assert response.status_code == 400
    assert "non supportée" in response.json()["detail"].lower() or "url" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_post_session_with_video_url_and_summary_id_returns_422(
    async_client: AsyncClient, auth_headers
):
    """XOR validator: pas les deux."""
    payload = {
        "video_url": "https://youtu.be/dQw4w9WgXcQ",
        "summary_id": 1,
        "agent_type": "explorer_streaming",
    }
    response = await async_client.post(
        "/api/voice/session", json=payload, headers=auth_headers
    )
    assert response.status_code == 422  # Pydantic validation


@pytest.mark.asyncio
async def test_post_session_quota_exceeded_returns_403(
    async_client: AsyncClient, auth_headers_free_quota_exceeded
):
    payload = {
        "video_url": "https://youtu.be/dQw4w9WgXcQ",
        "agent_type": "explorer_streaming",
    }
    response = await async_client.post(
        "/api/voice/session",
        json=payload,
        headers=auth_headers_free_quota_exceeded,
    )
    assert response.status_code in (402, 403, 429)
```

- [ ] **Step 7.2: Read existing /voice/session handler**

Run: `grep -n "@router.post.*session\|async def.*session" backend/src/voice/router.py | head -5`

Then read 80 lines around the handler to understand:
- The current request shape (`VoiceSessionRequest`)
- Quota check (`check_voice_quota`)
- Agent ephemeral creation (ElevenLabs)
- Response building

- [ ] **Step 7.3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_voice_session_video_url.py -v`
Expected: FAIL — no branch for `video_url`, the request goes to existing summary_id handler which 400s.

- [ ] **Step 7.4: Add the video_url branch in /voice/session handler**

In `backend/src/voice/router.py`, locate the existing `POST /session` handler. Before the existing summary_id branch, insert:

```python
from fastapi import BackgroundTasks
from voice.url_validator import parse_video_url
from voice.streaming_orchestrator import StreamingOrchestrator
from core.redis_client import get_redis_client  # adapt to actual existing import

# ... inside the handler signature, ADD background_tasks: BackgroundTasks parameter

# ... at the start of the handler body, add the video_url branch:
if request.video_url is not None:
    # Quick Voice Call mobile V3 — explorer_streaming mode
    try:
        platform, video_id = parse_video_url(request.video_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check quota (existing)
    quota_check = await check_voice_quota(user, db)
    if not quota_check.allowed:
        raise HTTPException(
            status_code=403 if quota_check.reason == "pro_no_voice" else 429,
            detail=quota_check.reason,
        )

    # Create Summary placeholder
    summary = Summary(
        user_id=user.id,
        video_id=video_id,
        platform=platform,
        url=request.video_url,
        title=f"[En cours] {platform.upper()} {video_id}",
        status="pending",
    )
    db.add(summary)
    await db.commit()
    await db.refresh(summary)

    # Trigger main analysis pipeline in background (existing /videos/analyze logic)
    background_tasks.add_task(
        _run_main_analysis, summary.id, request.video_url, user.id
    )

    # Create ElevenLabs ephemeral agent for explorer_streaming
    agent_config = get_agent_config("explorer_streaming")
    eleven_client = get_elevenlabs_client()
    agent_id, signed_url, conversation_token, expires_at = (
        await eleven_client.create_ephemeral_agent(
            agent_config, language=request.language, summary=None
        )
    )

    # Create VoiceSession DB row
    voice_session = VoiceSession(
        user_id=user.id,
        summary_id=summary.id,
        agent_id=agent_id,
        agent_type="explorer_streaming",
        is_streaming_session=True,
    )
    db.add(voice_session)
    await db.commit()
    await db.refresh(voice_session)

    # Trigger streaming orchestrator in background
    redis_client = get_redis_client()
    orchestrator = StreamingOrchestrator(redis_client=redis_client, db=db)
    background_tasks.add_task(
        orchestrator.run, voice_session.session_id, summary.id, request.video_url
    )

    return VoiceSessionResponse(
        session_id=voice_session.session_id,
        signed_url=signed_url,
        agent_id=agent_id,
        conversation_token=conversation_token,
        expires_at=expires_at,
        quota_remaining_minutes=quota_check.max_minutes,
        max_session_minutes=min(quota_check.max_minutes, 30),
        summary_id=summary.id,
    )

# ... existing summary_id / debate_id branches continue below unchanged
```

Add helper at the bottom of the file:

```python
async def _run_main_analysis(summary_id: int, video_url: str, user_id: int) -> None:
    """Trigger the main /videos/analyze pipeline for the placeholder Summary."""
    from videos.router import run_analysis_pipeline  # adapt to actual function

    try:
        await run_analysis_pipeline(summary_id, video_url, user_id)
    except Exception:
        logger.exception("Main analysis pipeline failed for summary %s", summary_id)
```

⚠️ Adapt `run_analysis_pipeline` to the actual existing entrypoint in `videos/router.py`. If it's gated behind an HTTP request (not a callable function), refactor to extract the core logic into a callable. Document the refactor in the commit message.

- [ ] **Step 7.5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/voice/test_voice_session_video_url.py -v`
Expected: 4 PASS (or skip the quota_exceeded test if the fixture isn't ready — mark as `@pytest.mark.skip` with note "depends on fixture auth_headers_free_quota_exceeded").

- [ ] **Step 7.6: Commit**

```bash
git add backend/src/voice/router.py backend/src/videos/router.py backend/tests/voice/test_voice_session_video_url.py
git commit -m "feat(voice): POST /voice/session accepts video_url + creates Summary placeholder + triggers streaming orchestrator"
```

---

## Task 8: Endpoint SSE GET /voice/context/stream

**Files:**
- Modify: `backend/src/voice/router.py`
- Test: `backend/tests/voice/test_voice_context_sse.py`

- [ ] **Step 8.1: Write the failing test**

Create `backend/tests/voice/test_voice_context_sse.py`:

```python
"""Tests for GET /api/voice/context/stream — SSE consumer of voice:ctx:{session_id}."""
import asyncio
import json
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sse_forwards_redis_pubsub_events(
    async_client: AsyncClient, auth_headers, redis_client, voice_session_factory
):
    """Le SSE doit recevoir les events publiés sur voice:ctx:{session_id}."""
    session = await voice_session_factory(user_id_match=True)
    channel = f"voice:ctx:{session.session_id}"

    # Start consuming in background
    received: list[dict] = []

    async def consume():
        async with async_client.stream(
            "GET",
            f"/api/voice/context/stream?session_id={session.session_id}",
            headers=auth_headers,
            timeout=5.0,
        ) as response:
            assert response.status_code == 200
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    received.append(json.loads(line[6:]))
                if len(received) >= 2:
                    break

    consumer = asyncio.create_task(consume())
    await asyncio.sleep(0.1)  # let consumer subscribe

    # Publish 2 events
    await redis_client.publish(
        channel,
        json.dumps({"type": "transcript_chunk", "chunk_index": 0, "total_chunks": 1, "text": "test"}),
    )
    await redis_client.publish(
        channel,
        json.dumps({"type": "ctx_complete", "final_digest_summary": "ok"}),
    )

    await asyncio.wait_for(consumer, timeout=3.0)
    assert len(received) == 2
    assert received[0]["type"] == "transcript_chunk"
    assert received[1]["type"] == "ctx_complete"


@pytest.mark.asyncio
async def test_sse_idor_other_user_session_returns_403(
    async_client: AsyncClient, auth_headers, voice_session_factory
):
    """User A ne doit pas pouvoir s'abonner à la session de User B."""
    session_b = await voice_session_factory(user_id_match=False)
    response = await async_client.get(
        f"/api/voice/context/stream?session_id={session_b.session_id}",
        headers=auth_headers,
    )
    assert response.status_code in (403, 404)


@pytest.mark.asyncio
async def test_sse_unknown_session_returns_404(
    async_client: AsyncClient, auth_headers
):
    response = await async_client.get(
        "/api/voice/context/stream?session_id=sess_does_not_exist",
        headers=auth_headers,
    )
    assert response.status_code == 404
```

- [ ] **Step 8.2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/voice/test_voice_context_sse.py -v`
Expected: FAIL with 404 (endpoint doesn't exist yet).

- [ ] **Step 8.3: Add the SSE endpoint**

In `backend/src/voice/router.py`, add at the end:

```python
from fastapi.responses import StreamingResponse


@router.get("/context/stream")
async def stream_video_context(
    session_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE stream of voice:ctx:{session_id} for the Quick Voice Call mobile flow.

    Forwards Redis pubsub events (transcript_chunk, analysis_partial, ctx_complete, error)
    to the mobile client which then injects them into the ElevenLabs conversation
    via sendUserMessage("[CTX UPDATE: ...]").
    """
    # IDOR check
    result = await db.execute(
        select(VoiceSession).where(VoiceSession.session_id == session_id)
    )
    voice_session = result.scalar_one_or_none()
    if voice_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if voice_session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    return StreamingResponse(
        _redis_pubsub_to_sse(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )


async def _redis_pubsub_to_sse(session_id: str):
    """Subscribe to voice:ctx:{session_id} and yield SSE-formatted events."""
    redis_client = get_redis_client()
    pubsub = redis_client.pubsub()
    channel = f"voice:ctx:{session_id}"
    await pubsub.subscribe(channel)
    try:
        # Initial event to confirm connection
        yield f"event: connected\ndata: {{\"session_id\": \"{session_id}\"}}\n\n"

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode()
            payload = json.loads(data)
            event_type = payload.get("type", "message")
            yield f"event: {event_type}\ndata: {data}\n\n"

            # Auto-close after ctx_complete (timeout 60s server-side)
            if event_type == "ctx_complete":
                await asyncio.sleep(1.0)
                break
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
```

- [ ] **Step 8.4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/voice/test_voice_context_sse.py -v`
Expected: 3 PASS.

If `voice_session_factory` fixture doesn't exist, create it in `backend/tests/voice/conftest.py`:

```python
import pytest_asyncio
from db.database import VoiceSession


@pytest_asyncio.fixture
async def voice_session_factory(db_session, current_user, other_user):
    async def _factory(user_id_match: bool = True):
        owner = current_user if user_id_match else other_user
        sess = VoiceSession(
            session_id=f"sess_test_{owner.id}_{int(asyncio.get_event_loop().time() * 1000)}",
            user_id=owner.id,
            agent_id="agent_test",
            agent_type="explorer_streaming",
        )
        db_session.add(sess)
        await db_session.commit()
        return sess

    return _factory
```

(Adapt `current_user` / `other_user` fixtures to match the existing test infrastructure naming.)

- [ ] **Step 8.5: Commit**

```bash
git add backend/src/voice/router.py backend/tests/voice/test_voice_context_sse.py backend/tests/voice/conftest.py
git commit -m "feat(voice): add SSE endpoint GET /voice/context/stream + IDOR check + auto-close on ctx_complete"
```

---

## Task 9: Caddy SSE timeout config (production)

**Files:**
- Modify: `deploy/hetzner/caddy/Caddyfile`

- [ ] **Step 9.1: Verify current SSE config**

Run: `grep -A 5 "context/stream\|sse\|flush_interval" deploy/hetzner/caddy/Caddyfile`

If `flush_interval -1` (or equivalent) is already set globally, skip this task. Otherwise:

- [ ] **Step 9.2: Add flush_interval and timeout for /api/voice/context/stream**

In `deploy/hetzner/caddy/Caddyfile`, locate the `reverse_proxy backend:8080` block and ensure these directives are present:

```caddy
@sse path /api/voice/context/stream /api/notifications/sse/*
handle @sse {
    reverse_proxy backend:8080 {
        flush_interval -1
        transport http {
            response_header_timeout 0s
            read_buffer 4KB
        }
    }
}

# ... existing reverse_proxy for other paths
```

⚠️ Adapt to the actual Caddyfile structure. If existing SSE handling already covers `/api/notifications/sse/*`, add `/api/voice/context/stream` to the same matcher.

- [ ] **Step 9.3: Validate Caddyfile syntax**

If Docker is available locally:
```bash
docker run --rm -v $(pwd)/deploy/hetzner/caddy:/etc/caddy caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```
Expected: `Valid configuration`.

- [ ] **Step 9.4: Commit**

```bash
git add deploy/hetzner/caddy/Caddyfile
git commit -m "ops(caddy): add SSE flush_interval for /api/voice/context/stream (Quick Voice Call mobile)"
```

---

## Task 10: Smoke test the full PR1 stack manually

**Files:** None (manual verification before opening the PR)

- [ ] **Step 10.1: Start the backend locally**

```bash
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cd src && uvicorn main:app --reload --port 8000
```

In another terminal, start Redis:
```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

- [ ] **Step 10.2: Get a valid auth token**

Use the existing `/api/auth/login` endpoint with a dev user.

- [ ] **Step 10.3: POST to /api/voice/session with video_url**

```bash
curl -X POST http://localhost:8000/api/voice/session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "agent_type": "explorer_streaming", "language": "fr"}'
```

Expected: 200 + JSON with `session_id`, `summary_id`, `signed_url`, `conversation_token`.

- [ ] **Step 10.4: Subscribe to SSE in another terminal**

```bash
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/voice/context/stream?session_id=SESSION_ID_FROM_STEP_3"
```

Expected: a stream of `event: transcript_chunk\ndata: {...}` followed by `event: ctx_complete\ndata: {...}`.

- [ ] **Step 10.5: Run the full backend test suite**

```bash
cd backend && python -m pytest -v --tb=short
```
Expected: all existing tests still pass + new tests pass. Note any pre-existing failures (not introduced by PR1).

- [ ] **Step 10.6: Open the PR**

```bash
cd C:/Users/33667/DeepSight-quick-voice-mobile
gh pr create --title "feat(voice): Quick Voice Call mobile V3 — PR1 backend (explorer_streaming + video_url + SSE context stream)" --body "$(cat <<'EOF'
## Summary

PR1 du Quick Voice Call mobile V3 : prépare le backend pour accepter une URL YouTube/TikTok en entrée et streamer le contexte vidéo pendant l'appel.

- New: agent_type `explorer_streaming` avec prompts FR/EN transparents
- New: `POST /api/voice/session` accepte `video_url` (XOR avec summary_id/debate_id)
- New: `GET /api/voice/context/stream` SSE pour forward Redis pubsub
- New: `streaming_orchestrator` background task (transcript chunks + Mistral analysis)
- New: `url_validator` (regex YouTube + TikTok)

Spec: `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` § 5
Plan: `docs/superpowers/plans/2026-04-27-quick-voice-call-mobile-v3-pr1-backend.md`

## Test plan

- [ ] All new pytest tests pass (test_url_validator, test_schemas, test_streaming_orchestrator, test_voice_session_video_url, test_voice_context_sse)
- [ ] Existing voice tests still pass (no regression)
- [ ] Manual curl smoke (step 10.3 + 10.4)
- [ ] Caddy SSE config validated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (run before merging PR1)

- [ ] All Task 1-10 steps completed and committed
- [ ] `pytest backend/tests/voice/ -v` is green
- [ ] No `NotImplementedError` raised in production code paths
- [ ] No `TODO` / `FIXME` / `XXX` introduced
- [ ] `agent_type='explorer_streaming'` is registered in `_AGENTS_BY_TYPE`
- [ ] `VoiceSessionResponse.summary_id` is populated in the video_url branch
- [ ] Redis pubsub channel name is exactly `voice:ctx:{session_id}` (no prefix typo)
- [ ] SSE endpoint returns 403 on cross-user session_id (IDOR check)
- [ ] Caddyfile has `flush_interval -1` for `/api/voice/context/stream`

---

## Dependencies for PR2

PR2 (Mobile UI) requires this PR1 to be merged + deployed to Hetzner. Verify post-deploy:

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker exec repo-backend-1 curl -s -X POST http://localhost:8080/api/voice/session -H 'Content-Type: application/json' -d '{\"video_url\":\"https://youtu.be/test\",\"agent_type\":\"explorer_streaming\"}'"
```

Expected: 401 (unauthorized — endpoint exists but auth required). If 404, deploy didn't pick up the new routes — restart the backend container.
