# Le Tuteur V1.1 Voice TTS — Plan d'implémentation

> **Sub-agents Opus 4.7 obligatoire**. 3 tasks bite-sized, TDD strict.

**Goal:** Ajouter le TTS ElevenLabs sur la réponse IA du Tuteur quand `mode == "voice"`, en réutilisant l'infra TTS existante.

**Architecture:** 1 helper backend `synthesize_audio_data_url()` + wire dans 2 endpoints + 1 composant frontend qui joue l'audio via `<audio autoplay>`. Format retour = data URL base64 inline (pas de S3/R2 V1.1).

**Tech Stack:** FastAPI + httpx ElevenLabs (pattern `tts/audio_summary.py`) ; React + HTML5 audio.

**Spec:** `docs/superpowers/specs/2026-05-03-le-tuteur-voice-v1-1-design.md` (commit à venir).

---

## Task V1.1.T1 : Backend helper `synthesize_audio_data_url`

**Files:**
- Modify: `backend/src/tutor/service.py` (add function)
- Modify: `backend/tests/test_tutor_service.py` (add test)

- [ ] **Step 1: Test FAILING dans `test_tutor_service.py`**

```python
import base64
from unittest.mock import patch, AsyncMock
from src.tutor.service import synthesize_audio_data_url


@pytest.mark.asyncio
async def test_synthesize_audio_data_url_returns_data_url():
    """Quand ElevenLabs répond OK, renvoie un data URL base64 valide."""
    fake_audio_bytes = b"\xff\xfb\x90\x00fake mp3 data"

    # Mock httpx response 200 avec bytes audio
    with patch("src.tutor.service.httpx.AsyncClient") as mock_client_cls:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.content = fake_audio_bytes
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await synthesize_audio_data_url("Bonjour", lang="fr")

    assert result is not None
    assert result.startswith("data:audio/mpeg;base64,")
    decoded = base64.b64decode(result.split(",", 1)[1])
    assert decoded == fake_audio_bytes


@pytest.mark.asyncio
async def test_synthesize_audio_data_url_returns_none_on_error():
    """Quand ElevenLabs fail (500), renvoie None (graceful)."""
    with patch("src.tutor.service.httpx.AsyncClient") as mock_client_cls:
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "internal error"
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        result = await synthesize_audio_data_url("Bonjour", lang="fr")

    assert result is None
```

- [ ] **Step 2: Run → FAIL (function doesn't exist)**

```bash
cd backend && python -m pytest tests/test_tutor_service.py::test_synthesize_audio_data_url_returns_data_url -v
```

- [ ] **Step 3: Implémenter `synthesize_audio_data_url` dans `service.py`**

```python
import base64
import httpx
from typing import Optional

# Importer le helper config existant
from core.config import get_elevenlabs_key


ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
ELEVENLABS_DEFAULT_VOICE_ID_FR = "21m00Tcm4TlvDq8ikWAM"  # Adapter si une voix FR plus native est dispo
ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"


async def synthesize_audio_data_url(
    text: str,
    lang: str = "fr",
    voice_id: Optional[str] = None,
) -> Optional[str]:
    """Synthétise l'audio via ElevenLabs et retourne un data URL base64.

    Returns None si la clé API est manquante ou l'API échoue (graceful fallback).
    """
    api_key = get_elevenlabs_key()
    if not api_key:
        logger.warning("[tutor] ELEVENLABS_API_KEY missing, skipping TTS")
        return None

    if not text.strip():
        return None

    resolved_voice = voice_id or ELEVENLABS_DEFAULT_VOICE_ID_FR
    url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{resolved_voice}"

    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
        "language_code": lang,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.3,
            "use_speaker_boost": True,
            "speed": 1.0,
        },
    }
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.warning(
                f"[tutor] ElevenLabs TTS failed status={response.status_code} body={response.text[:200]}"
            )
            return None
        b64 = base64.b64encode(response.content).decode("ascii")
        return f"data:audio/mpeg;base64,{b64}"
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        logger.warning(f"[tutor] ElevenLabs TTS exception: {exc}")
        return None
```

**Note implémentation** : `httpx` est déjà importé dans `service.py` ? À vérifier. Sinon ajouter `import httpx` en tête.

- [ ] **Step 4: Run tests → PASS (2 tests)**

```bash
cd backend && python -m pytest tests/test_tutor_service.py -v
```

Expected: **5 PASS** (3 V1.0 + 2 V1.1).

- [ ] **Step 5: Commit**

```bash
git add backend/src/tutor/service.py backend/tests/test_tutor_service.py
git commit -m "feat(tutor): synthesize_audio_data_url helper (ElevenLabs TTS)

V1.1 voice TTS — helper pur qui appelle ElevenLabs et renvoie un
data URL base64. Graceful fallback (None) si clé manquante ou API fail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task V1.1.T2 : Wire TTS dans `tutor/router.py`

**Files:**
- Modify: `backend/src/tutor/router.py`
- Modify: `backend/tests/test_tutor_router.py` (1 test)

- [ ] **Step 1: Test FAILING — `test_session_start_voice_mode_returns_audio_url`**

```python
@pytest.mark.asyncio
async def test_session_start_voice_mode_returns_audio_url(authenticated_pro_client, monkeypatch):
    """Mode voice → audio_url est un data URL non-null."""
    # Mock synthesize_audio_data_url pour retourner un data URL fake
    fake_data_url = "data:audio/mpeg;base64,ZmFrZQ=="

    async def fake_synth(text, lang="fr", voice_id=None):
        return fake_data_url

    monkeypatch.setattr("tutor.router.synthesize_audio_data_url", fake_synth)

    response = await authenticated_pro_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "mode": "voice",
            "lang": "fr",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["audio_url"] == fake_data_url


@pytest.mark.asyncio
async def test_session_start_text_mode_audio_url_is_null(authenticated_pro_client):
    """Mode text → audio_url reste None (régression V1.0)."""
    response = await authenticated_pro_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "mode": "text",
            "lang": "fr",
        },
    )
    assert response.status_code == 200
    assert response.json()["audio_url"] is None
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implémenter dans `router.py`**

Ajouter import en tête : `from .service import synthesize_audio_data_url` (compléter l'import existant).

Dans `session_start`, REMPLACER la section `audio_url = None` par :

```python
audio_url: Optional[str] = None
if body.mode == "voice":
    audio_url = await synthesize_audio_data_url(first_prompt, lang=body.lang)
```

Dans `session_turn`, idem, remplacer `audio_url = None` par :

```python
audio_url = None
if state.mode == "voice":
    audio_url = await synthesize_audio_data_url(ai_response, lang=state.lang)
```

- [ ] **Step 4: Re-run tests**

```bash
cd backend && python -m pytest tests/test_tutor_router.py -v
```

Expected: **9 PASS** (7 V1.0 + 2 V1.1).

- [ ] **Step 5: Commit**

```bash
git add backend/src/tutor/router.py backend/tests/test_tutor_router.py
git commit -m "feat(tutor): wire TTS dans /session/start et /turn quand mode=voice

V1.1 voice TTS — appelle synthesize_audio_data_url sur first_prompt
(start) et ai_response (turn) quand mode=voice. Mode text inchangé.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task V1.1.T3 : Frontend audio playback dans `TutorDeepSession`

**Files:**
- Modify: `frontend/src/components/Tutor/useTutor.ts` (state + actions)
- Modify: `frontend/src/components/Tutor/Tutor.tsx` (passer `audioUrl` en prop)
- Modify: `frontend/src/components/Tutor/TutorDeepSession.tsx` (audio element)
- Modify: `frontend/src/components/Tutor/__tests__/useTutor.test.ts` (adapter mocks)

- [ ] **Step 1: Adapter `useTutor.ts` — stocker currentAudioUrl**

Ajouter dans `TutorState` :
```typescript
currentAudioUrl: string | null;
```

Ajouter dans `initialState` : `currentAudioUrl: null`.

Modifier l'action `SESSION_STARTED` :
```typescript
case "SESSION_STARTED":
  return {
    ...state,
    phase: state.mode === "voice" ? "deep-session" : "mini-chat",
    sessionId: action.session_id,
    // ... existing fields ...
    currentAudioUrl: action.audio_url,  // NEW
    messages: [
      { role: "assistant", content: action.first_prompt, timestamp_ms: Date.now() },
    ],
    loading: false,
  };
```

Ajouter `audio_url: string | null` au type Action `SESSION_STARTED`.

Modifier `startSession` pour passer `audio_url: resp.audio_url` au dispatch.

Pareil pour `TURN_DONE` : nouvelle action prend `audio_url`. Modifier `submitTextTurn` pour dispatch `audio_url: resp.audio_url`.

- [ ] **Step 2: Mettre à jour `Tutor.tsx`**

Passer `audioUrl={tutor.currentAudioUrl}` à `<TutorDeepSession>`.

- [ ] **Step 3: Modifier `TutorDeepSession.tsx`**

Ajouter prop `audioUrl: string | null`.

Dans le JSX, ajouter le `<audio>` autoplay :

```tsx
{audioUrl && (
  <audio
    key={audioUrl}  // re-mount à chaque nouveau audio
    src={audioUrl}
    autoPlay
    onEnded={() => {/* V1.2 : déclencher prochain état UX */}}
    style={{ display: "none" }}  // pas de controls visibles, l'orb suffit
  />
)}
```

- [ ] **Step 4: Adapter les mocks de test**

Dans `useTutor.test.ts`, modifier les mocks `tutorApi.sessionStart/Turn` pour retourner aussi `audio_url: null` (ou un fake data URL pour les tests voice).

Les 6 tests existants doivent toujours pass.

- [ ] **Step 5: Run tests + typecheck**

```bash
cd frontend && npm run test -- useTutor.test.ts Tutor.test.tsx --run && npm run typecheck
```

Expected: 9/9 frontend Tuteur tests PASS, typecheck baseline (103 erreurs, +0).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Tutor/
git commit -m "feat(tutor): audio playback dans TutorDeepSession (mode voice)

V1.1 voice TTS frontend — currentAudioUrl dans useTutor state,
<audio autoplay> dans TutorDeepSession quand audioUrl présent.
Mode texte inchangé.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task V1.1.T4 : Push + PR + force-merge

- [ ] Push branch `feat/le-tuteur-voice-v1-1`
- [ ] `gh pr create` (template similaire à PR #284)
- [ ] Si CI rouge sur fails pré-existants : `gh pr merge X --admin --merge`
- [ ] Cleanup worktree + branche post-merge

---

## Self-review

Couverture spec :
- ✅ Décision 1 (ElevenLabs) : T1
- ✅ Décision 2 (data URL) : T1 step 3
- ✅ Décision 3 (no storage) : implicite (data URL inline)
- ✅ Décision 4 (voice ID FR) : T1 constante `ELEVENLABS_DEFAULT_VOICE_ID_FR`
- ✅ Décision 5 (mode voice only) : T2 conditional `if mode == "voice"`
- ✅ Décision 6 (HTML5 audio autoplay) : T3
- ✅ Décision 7 (STT V1.2) : non implémenté, documenté
- ✅ Décision 8 (graceful fail) : T1 retourne None si erreur
- ✅ Décision 9 (Opus 4.7) : header

No placeholders. Type consistency vérifiée (audio_url string|null partout).
