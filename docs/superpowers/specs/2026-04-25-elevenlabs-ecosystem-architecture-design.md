# ElevenLabs Voice Ecosystem — Architecture Design

**Date** : 2026-04-25
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue

## Contexte et problème

DeepSight intègre un agent vocal ElevenLabs sur deepsightsynthesis.com. Aujourd'hui, lorsque l'utilisateur lui pose une question non couverte par l'analyse de la vidéo, le bot répond qu'il ne peut pas accéder aux informations en ligne. Or l'API de recherche web Brave Search est déjà branchée côté backend, et le tool `web_search` est même déjà inclus dans la liste de tools de l'agent `explorer`.

Au-delà de ce bug, l'utilisateur veut que l'appel vocal soit accessible partout dans l'écosystème : extension Chrome (sur YouTube), application mobile (Expo), et site web (sur les pages History, Analyse, **et l'onglet Chat IA** où il faut un gros bouton qui permet d'appeler le bot sans quitter l'interface chat).

## Objectifs

1. Faire que l'agent ElevenLabs utilise effectivement la recherche web Brave Search déjà branchée
2. Étendre l'appel vocal à toutes les surfaces de l'écosystème (web Chat IA, extension Chrome, mobile Library, mobile Study chat)
3. Permettre une expérience unifiée chat texte ↔ voix sur le ChatPage web (sync bidirectionnelle temps réel)
4. Gérer le cas "pas de vidéo active" via un nouvel agent_type `companion`

## Hors-scope V1

- Port multi-browser de l'extension (Firefox via `browser.sidebarAction`, Safari via nouvel onglet) — Spec #6 ultérieur
- Transcripts partiels (interim) pendant qu'un user parle — non exposés par les SDKs publics ElevenLabs
- Monitor WebSocket enterprise pour transcripts server-side
- TTS du bot via Mistral en dehors de ElevenLabs

## Décisions verrouillées

| #   | Décision                 | Choix retenu                                                                       |
| --- | ------------------------ | ---------------------------------------------------------------------------------- |
| 1   | Découpage                | Plan unifié, 5 sous-specs avec séquencement explicite                              |
| 2   | Mode chat libre          | `summary_id` optionnel, agent_type `companion` en interne                          |
| 3   | UX Chat IA web           | Bouton header + overlay flottant 380×600 non-bloquant bottom-right                 |
| 4   | Sync chat ↔ voix         | Bidirectionnelle full via `onMessage` (capture) + `sendUserMessage` (injection)    |
| 5   | Extension multi-browser  | Chrome only V1 + roadmap explicite                                                 |
| 6   | Agent ElevenLabs         | Éphémère (création/suppression par session) — statu quo                            |
| 7   | Storage timeline unifiée | Migration Alembic 007 — colonne `source` + `voice_session_id` dans `chat_messages` |

## Architecture macro et séquencement des 5 sous-specs

```
                    ┌─── Spec #0 (express, 1-2h) ───┐
                    │ Fix prompts FR/EN web_search  │
                    │ Cache Redis Brave + tracking  │
                    └────────────┬───────────────────┘
                                 │
                    ┌────────────▼───────────────────┐
                    │ Spec #1 — Foundation backend   │
                    │ Migration 007, agent_type=     │
                    │ companion, transcripts/append  │
                    └────────────┬───────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
   ┌──────────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
   │ Spec #2 — Web     │  │ Spec #3 —   │  │ Spec #4 —       │
   │ Foundation UI     │  │ Mobile      │  │ Extension       │
   │ Provider/Button   │  │ Library +   │  │ Chrome          │
   │                   │  │ Study       │  │ Side Panel      │
   └──────────┬────────┘  └─────────────┘  └─────────────────┘
              │
   ┌──────────▼─────────────────────┐
   │ Spec #5 — Voice dans Chat IA   │
   │ Sync bidir + overlay compact   │
   └────────────────────────────────┘
```

Logique : Spec #0 est déployable seul. Spec #1 = fondation backend, prérequis pour #2/#3/#4/#5. Spec #2 prérequis pour #5. Spec #3 et #4 parallélisables avec #2.

Estimation : ~6-8 jours en séquentiel, ~4-5 jours avec #3/#4 en parallèle de #2/#5.

---

## Spec #0 — Fix express recherche web (déployable seul)

### Modifications

**a. Prompts FR + EN** (`backend/src/voice/agent_types.py:84-137`) — instruire l'agent `explorer` qu'il a accès à `web_search`, `deep_research`, `check_fact`. Ajout dans la section "Tools available" :

```
- web_search(query, num_results=5) : recherche web via Brave Search.
  À utiliser SYSTÉMATIQUEMENT quand l'utilisateur pose une question
  factuelle non couverte par le transcript ou l'analyse de la vidéo.
  Annonce "Je vais chercher sur le web" avant l'appel pour gérer la latence.
- deep_research(query, num_queries=3) : recherche multi-requêtes pour synthèse.
- check_fact(claim) : vérification d'affirmation factuelle.
```

**b. Cache Redis Brave** (nouveau fichier `backend/src/voice/web_tools_cache.py`, ~50 lignes) :

```python
async def cached_brave_search(query: str, count: int = 5) -> BraveSearchResult:
    key = f"brave:search:{hashlib.sha1(f'{query}|{count}'.encode()).hexdigest()}"
    cached = await redis.get(key)
    if cached:
        return BraveSearchResult.parse_raw(cached)
    result = await _call_brave_api(query, count)
    if result.success:
        await redis.setex(key, 3600, result.json())
    return result
```

À brancher dans `voice/web_tools.py:38, 79, 139` à la place des appels directs.

**c. Tracking dans `WebSearchUsage`** — ajouter `await record_web_search_usage(user_id, summary_id, source="voice", query=query)` dans `_handle_web_search_tool`.

**d. Rate-limit** : `_WEB_SEARCH_MAX = 5/h` → `15/h` par `summary_id`, plus cap global `60/h` par `user_id`.

### Tests

- Pytest : tool web_search appelé avec query, hit cache, miss cache, tracking incrémenté
- Validation prompt : déployer sur staging, lancer une session, demander "qui est Aripiprazole ?" — vérifier que le bot fait `web_search` au lieu de refuser

---

## Spec #1 — Foundation backend

### a. Migration Alembic 007 (`backend/migrations/alembic/versions/007_unify_chat_voice_messages.py`)

```python
def upgrade():
    op.add_column('chat_messages',
        sa.Column('source', sa.String(10), server_default='text', nullable=False))
    op.add_column('chat_messages',
        sa.Column('voice_session_id', sa.String(36),
                  sa.ForeignKey('voice_sessions.id', ondelete='SET NULL'),
                  nullable=True))
    op.add_column('chat_messages',
        sa.Column('voice_speaker', sa.String(10), nullable=True))
    op.add_column('chat_messages',
        sa.Column('time_in_call_secs', sa.Float, nullable=True))

    op.create_index('ix_chat_messages_summary_created',
                    'chat_messages', ['summary_id', 'created_at'])
    op.create_index('ix_chat_messages_voice_session',
                    'chat_messages', ['voice_session_id'],
                    postgresql_where=sa.text("voice_session_id IS NOT NULL"))

    op.create_check_constraint('ck_voice_requires_session',
                               'chat_messages',
                               "(source != 'voice') OR (voice_session_id IS NOT NULL)")
```

Rétrocompat : DEFAULT `'text'` sur les lignes existantes. Pattern try/except déjà présent dans `chat/service.py:411-446` à reproduire pour les nouvelles colonnes.

### b. Nouvel `agent_type=companion` (`backend/src/voice/agent_types.py`)

```python
COMPANION = AgentConfig(
    id="companion",
    name_fr="Compagnon de réflexion",
    name_en="Reflection Companion",
    voice_id=os.getenv("ELEVENLABS_COMPANION_VOICE_ID", DEFAULT_VOICE_ID),
    tools=["web_search", "deep_research", "check_fact"],
    system_prompt_fr=COMPANION_PROMPT_FR,
    system_prompt_en=COMPANION_PROMPT_EN,
    requires_summary=False,
)
```

Le prompt insiste sur "tu n'as pas de vidéo de référence, utilise web_search systématiquement pour ancrer tes réponses".

### c. `POST /api/voice/session` — `summary_id` optionnel

`backend/src/voice/router.py:377` :

```python
class VoiceSessionRequest(BaseModel):
    summary_id: Optional[int] = None
    debate_id: Optional[int] = None
    agent_type: Literal["explorer", "debate_moderator", "companion"] = "explorer"
    language: str = "fr"

@router.post("/session")
async def create_voice_session(req: VoiceSessionRequest, user=Depends(get_current_user)):
    config = AGENT_CONFIGS[req.agent_type]
    if config.requires_summary and not req.summary_id:
        raise HTTPException(400, "summary_id required for this agent_type")
    # ... agent éphémère + signed_url + conversation_token
```

### d. Inject chat history dans system prompt

Dans `build_rich_context` (`router.py:548`), si `summary_id` présent :

```python
history = await get_chat_history(req.summary_id, user.id, limit=10)
if history:
    system_prompt += "\n\n## Historique récent du chat texte\n"
    for msg in history:
        role = "Utilisateur" if msg.role == "user" else "Toi"
        system_prompt += f"- {role}: {msg.content}\n"
    system_prompt += "\nContinue dans la lignée de cette conversation.\n"
```

### e. Endpoint `POST /api/voice/transcripts/append`

```python
class TranscriptAppendRequest(BaseModel):
    voice_session_id: str
    speaker: Literal["user", "agent"]
    content: str
    time_in_call_secs: float

@router.post("/transcripts/append")
async def append_transcript(req: TranscriptAppendRequest, user=Depends(get_current_user)):
    session = await get_voice_session(req.voice_session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(403, "forbidden")
    await db.execute(
        chat_messages.insert().values(
            user_id=user.id,
            summary_id=session.summary_id,
            role="user" if req.speaker == "user" else "assistant",
            content=req.content,
            source="voice",
            voice_session_id=req.voice_session_id,
            voice_speaker=req.speaker,
            time_in_call_secs=req.time_in_call_secs,
        )
    )
    return {"ok": True}
```

Auth : Bearer JWT user. Rate-limit : 60/min par `voice_session_id`.

### f. Webhook reconciliation post-call

Étendre `backend/src/voice/router.py:793` (handler `/voice/webhook`) — comparer `payload["data"]["transcript"]` avec les rows en DB :

```python
canonical = payload["data"]["transcript"]
existing = await db.fetch_all(
    "SELECT id, content, time_in_call_secs FROM chat_messages "
    "WHERE voice_session_id = :sid ORDER BY time_in_call_secs",
    sid=session_id
)
# Si N canonical > N existing → INSERT les manquants
# Si content drift > 10% sur un turn → UPDATE
# Sinon : no-op
```

### g. `GET /api/chat/{summary_id}/history` — schema étendu

`backend/src/chat/router.py:82-87` — schema `ChatMessage` enrichi :

```python
class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    source: Literal["text", "voice"] = "text"
    voice_speaker: Optional[str] = None
    voice_session_id: Optional[str] = None
    time_in_call_secs: Optional[float] = None
    web_search_used: bool = False
    sources: Optional[List[Dict]] = None
    created_at: datetime
```

Ordre `created_at ASC`. Voix et texte sortent mélangés chronologiquement.

### h. Quota chat ignore `source='voice'`

`backend/src/chat/service.py` — `check_chat_quota` ajoute `WHERE source = 'text'`.

### Sécurité — résumé matrices auth/IDOR/rate-limit

| Endpoint                         | Auth                         | IDOR                                 | Rate-limit               |
| -------------------------------- | ---------------------------- | ------------------------------------ | ------------------------ |
| `POST /voice/session`            | Bearer JWT user              | user owns summary_id (existant)      | quota minutes (existant) |
| `POST /voice/transcripts/append` | Bearer JWT user              | user owns voice_session_id (nouveau) | 60/min par session       |
| `POST /voice/webhook`            | HMAC-SHA256 ElevenLabs       | aucun (signé)                        | aucun                    |
| `GET /chat/{id}/history`         | Bearer JWT user              | user owns summary_id (existant)      | aucun                    |
| `POST /voice/tools/web-search`   | Bearer summary_id (existant) | existant                             | 15/h relevé, 60/h global |

### Tests

- Migration up/down avec données existantes
- `POST /voice/session` : explorer/companion routing, 400 si requirement violé, IDOR
- `POST /voice/transcripts/append` : insert OK, 403 IDOR, ordering
- Webhook reconciliation : drift → UPDATE, missing → INSERT, idempotent
- Quota chat ignore voice rows

---

## Spec #2 — Foundation frontend web

### a. `frontend/src/components/voice/VoiceCallProvider.tsx` (nouveau, ~120 lignes)

Wrapper React Context qui internalise tout le boilerplate dupliqué entre DashboardPage, History, DebatePage :

```tsx
interface VoiceCallProviderProps {
  summaryId?: number;
  debateId?: number;
  agentType?: "explorer" | "companion" | "debate_moderator";
  videoTitle?: string;
  channelName?: string;
  thumbnailUrl?: string;
  videoId?: string;
  platform?: string;
  compact?: boolean; // mode overlay flottant pour Chat IA
  onVoiceMessage?: (msg: VoiceChatMessage) => void;
  children: ReactNode;
}
```

Encapsule `useVoiceChat`, `useMicLevel`, `useVoiceEnabled`, `isVoiceModalOpen`, le rendu de `<VoiceModal compact={compact}>`. Expose le context via `useVoiceCall()`.

### b. `VoiceCallButton.tsx` (nouveau, ~80 lignes)

```tsx
type Variant = "hero" | "header" | "fab" | "inline";
interface Props {
  variant: Variant;
  size?: "sm" | "md" | "lg";
  label?: string;
}
```

Variantes :

- `hero` reproduit `AnalysisVoiceHero` actuel
- `header` bouton compact 40×40 + label "Appeler" (pour ChatPage header)
- `fab` floating button mobile-style
- `inline` pour AnalysisActionBar

### c. `hooks/useVoiceEnabled.ts` (nouveau, ~30 lignes)

Extrait la logique admin email + PLAN_LIMITS dupliquée dans 3 pages.

### d. Modif `VoiceModal.tsx` — prop `compact`

```tsx
className={compact
  ? "fixed bottom-6 right-6 w-[380px] h-[600px] rounded-2xl shadow-2xl"
  : "fixed inset-0"}
```

Garde-fou : ESC global ne ferme pas en mode compact (l'utilisateur peut taper dans le chat sans fermer).

### e. Migration des 3 pages existantes

`pages/DashboardPage.tsx`, `pages/History.tsx`, `pages/DebatePage.tsx` : supprimer ~50 lignes de wiring `<VoiceModal>` chacune, wrapper la zone analysis avec `<VoiceCallProvider>`, remplacer `<AnalysisVoiceHero>` par `<VoiceCallButton variant="hero" />`.

### Tests

- `VoiceCallProvider` : open/close, voiceEnabled gating, prewarm
- `VoiceCallButton` variants : snapshot rendering
- `VoiceModal compact` : positioning, ESC handling
- Snapshot tests Dashboard/History/Debate identiques avant/après migration

---

## Spec #3 — Mobile (Library + Study chat)

### a. `mobile/src/components/voice/VoiceButton.tsx` — prop `bottomOffset`

```tsx
interface Props {
  summaryId?: number;
  agentType?: "explorer" | "companion";
  bottomOffset?: number;
}

const computedBottom =
  bottomOffset ?? TAB_BAR_HEIGHT + ACTION_BAR_HEIGHT + insets.bottom;
```

### b. Câblage `mobile/app/(tabs)/library.tsx`

```tsx
<VoiceButton
  agentType="companion"
  bottomOffset={TAB_BAR_HEIGHT + insets.bottom + 16}
/>
```

### c. Câblage `mobile/app/(tabs)/study.tsx` (sous-onglet `chat`)

```tsx
{
  activeSubTab === "chat" && (
    <VoiceButton
      summaryId={selectedSummaryId}
      agentType={selectedSummaryId ? "explorer" : "companion"}
      bottomOffset={TAB_BAR_HEIGHT + insets.bottom + 16}
    />
  );
}
```

### d. Sync bidir mobile (`mobile/src/components/voice/useVoiceChat.ts`)

Étendre le `onMessage` callback :

```tsx
onMessage: ({ source, message }) => {
  setMessages(prev => [...prev, { source, text: message }]);
  voiceApi.appendTranscript({
    voice_session_id: sessionId,
    speaker: source === "user" ? "user" : "agent",
    content: message,
    time_in_call_secs: (Date.now() - sessionStartedAt) / 1000,
  });
},
```

### e. `voiceApi.createSession` — `summary_id` optionnel + `agent_type`

`mobile/src/services/api.ts:1965-1980` — payload accepte `summary_id?: number` et `agent_type?: string`.

### Tests

- `VoiceButton bottomOffset` : computed bottom selon contexte
- Library/Study placement : visibility selon selectedSummaryId
- `useVoiceChat.appendTranscript` : appel après onMessage
- agent_type companion vs explorer routing

---

## Spec #4 — Extension Chrome (Side Panel)

### a. Manifest patches (`extension/public/manifest.json`)

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "alarms",
    "identity",
    "clipboardWrite",
    "sidePanel"
  ],
  "side_panel": { "default_path": "sidepanel.html" },
  "host_permissions": [
    "...existant...",
    "https://api.elevenlabs.io/*",
    "wss://api.elevenlabs.io/*",
    "https://*.elevenlabs.io/*",
    "wss://*.elevenlabs.io/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://api.deepsightsynthesis.com https://api.elevenlabs.io wss://api.elevenlabs.io https://*.elevenlabs.io wss://*.elevenlabs.io"
  }
}
```

Pas de patch sur `manifest.firefox.json`/`manifest.safari.json` — Chrome only V1.

### b. Bundle Webpack — entry `sidepanel`

`extension/webpack.config.js:23` — ajouter `sidepanel: "./src/sidepanel/index.tsx"`.

Nouveau dossier `extension/src/sidepanel/` :

- `index.tsx` : bootstrap React/Preact
- `App.tsx` : video card + bouton "Appeler" + VoiceModal réutilisé
- `useExtensionVoiceChat.ts` : adapter local de `useVoiceChat` qui passe par `chrome.runtime.sendMessage` au lieu de fetch direct

### c. Bouton trigger dans widget Shadow DOM

`extension/src/content/widget.ts` — header à côté de `#ds-minimize-btn` :

```ts
const voiceBtn = document.createElement("button");
voiceBtn.id = "ds-voice-btn";
voiceBtn.innerHTML = "🎙️ Appeler";
voiceBtn.onclick = () => {
  chrome.runtime.sendMessage({
    action: "OPEN_VOICE_PANEL",
    summaryId: lastAnalysisId,
    videoId: getCurrentYouTubeId(),
    videoTitle: document.title,
  });
};
if (!("sidePanel" in (chrome as any))) voiceBtn.style.display = "none";
```

Feature detection : caché sur Firefox/Safari.

### d. Background — handlers (`extension/src/background.ts:423`)

```ts
case "OPEN_VOICE_PANEL":
  await chrome.sidePanel.setOptions({ tabId: sender.tab.id, path: "sidepanel.html", enabled: true });
  await chrome.sidePanel.open({ tabId: sender.tab.id });
  await chrome.storage.session.set({ voicePanelContext: { summaryId, videoId, videoTitle } });
  break;

case "VOICE_CREATE_SESSION":
  return await apiRequest("/voice/session", { method: "POST", body: msg.payload });

case "VOICE_APPEND_TRANSCRIPT":
  return await apiRequest("/voice/transcripts/append", { method: "POST", body: msg.payload });
```

### e. Side panel mount

```tsx
useEffect(() => {
  chrome.storage.session
    .get("voicePanelContext")
    .then(({ voicePanelContext }) => {
      setContext(voicePanelContext);
    });
}, []);
```

Si `summaryId` présent → `agent_type = "explorer"`. Sinon → `companion`.

### Tests

- Manifest CSP syntactique
- Side panel mount avec context
- Feature detection : bouton caché sur Firefox/Safari
- Background handlers : `OPEN_VOICE_PANEL`, `VOICE_CREATE_SESSION`, `VOICE_APPEND_TRANSCRIPT`

---

## Spec #5 — Voice dans Chat IA web (sync bidir complète)

### a. Schema `ChatMessage` étendu (`frontend/src/pages/ChatPage.tsx:66-72`)

```ts
interface ChatMessage {
  id: string; // crypto.randomUUID() obligatoire
  role: "user" | "assistant";
  content: string;
  source?: "text" | "voice_user" | "voice_agent";
  voice_session_id?: string;
  ephemeral?: boolean;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
  timestamp?: number; // pour tri en cas de race
}
```

### b. Wrapping ChatPage avec `<VoiceCallProvider compact>`

```tsx
<VoiceCallProvider
  summaryId={selectedAnalysis?.id}
  agentType={selectedAnalysis ? "explorer" : "companion"}
  videoTitle={selectedAnalysis?.title}
  thumbnailUrl={selectedAnalysis?.thumbnail_url}
  compact
  onVoiceMessage={handleVoiceMessage}
>
  {/* Header avec <VoiceCallButton variant="header" label="Appeler" /> */}
  {/* messages + input */}
</VoiceCallProvider>
```

### c. Sync voix → timeline chat

```tsx
const handleVoiceMessage = useCallback(
  (msg: VoiceChatMessage) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: msg.source === "user" ? "user" : "assistant",
        content: msg.text,
        source: msg.source === "user" ? "voice_user" : "voice_agent",
        voice_session_id: voiceSessionId,
        timestamp: Date.now(),
      },
    ]);
    voiceApi.appendTranscript({
      voice_session_id: voiceSessionId,
      speaker: msg.source === "user" ? "user" : "agent",
      content: msg.text,
      time_in_call_secs: Date.now() / 1000 - sessionStartedAt,
    });
  },
  [voiceSessionId, sessionStartedAt],
);
```

### d. Sync texte → voix (`handleSend` étendu)

```tsx
const handleSend = async (text?: string) => {
  const content = text ?? inputValue;
  if (!content.trim()) return;
  appendUserMessage(content, voiceSession ? "voice_user" : "text");
  if (voiceSession) {
    voiceConversation.sendUserMessage(content);
    // Agent répondra via onMessage
  } else {
    const response = await chatApi.send(summaryId, content);
    appendAssistantMessage(response);
  }
};
```

### e. Garde-fous UX

| Risque                      | Mitigation                                                   |
| --------------------------- | ------------------------------------------------------------ |
| Race conditions setMessages | UUID v4 + champ `timestamp` séparé                           |
| Auto-scroll spam            | Détection scroll user (si pas en bas, désactive auto-scroll) |
| Switch vidéo pendant appel  | Confirm dialog "Couper l'appel et changer de vidéo ?"        |
| TTS double audio            | Skip `autoPlay` si `last.source === "voice_agent"`           |
| Suggestions follow-up       | Skip `parseAskQuestions` pour messages voix                  |

### f. UI badges

```tsx
{
  msg.source?.startsWith("voice_") && (
    <span className="inline-flex items-center gap-1 text-xs text-violet-400">
      <Mic className="w-3 h-3" /> Vocal
    </span>
  );
}
```

`<CopyMessageButton>`, `<AudioPlayerButton>` désactivés si `ephemeral`.

### Tests

- Voice message append : ordre correct, badge UI, ephemeral flag
- sendUserMessage routing : si voiceSession actif → SDK, sinon API
- E2E Playwright : flow complet user tape → response → click Appeler → speak → transcripts apparaissent → end → reload → transcripts persistés

---

## Data flow sync bidirectionnelle (vue end-to-end)

```
[User clique Appeler]
        │
        ▼
POST /api/voice/session
{ summary_id?, agent_type, language }
        │
        ▼
Backend : agent ElevenLabs éphémère
+ system_prompt (transcript + chat_history 10 msgs)
        │
        ▼
{ signed_url, conversation_token, voice_session_id }
        │
        ▼
Frontend : Conversation.startSession({...})
        │
   ┌────┼────────────────────┐
   │    │                    │
   ▼    ▼                    ▼
User  Agent             User tape texte
parle répond            (input chat)
   │    │                    │
   ▼    ▼                    ▼
onMessage(user/ai)    sendUserMessage(text)
   │                         │
   ▼                         ▼
appendMessage         appendMessage(user)
+ POST /voice/transcripts/append
   │                         │
   ▼                         ▼
INSERT chat_messages source='voice'
        │
        ▼
[Fin de l'appel]
        │
        ▼
Webhook post_call_transcription HMAC-SHA256
        │
        ▼
Backend : reconciliation transcript canonique
UPDATE chat_messages si drift > 10%
INSERT turns manquants
UPDATE voice_sessions duration + status
```

---

## Error handling

| Cas                                        | Stratégie                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network drop pendant appel                 | SDK ElevenLabs reconnect auto (3 retries). Si échec → `onError` → toast user "Connexion perdue" + cleanup voice_session. Webhook reconciliation finalise transcript |
| `appendTranscript` 5xx                     | Retry exponentiel 3x (2s, 4s, 8s). Si échec → buffer en mémoire, flush via webhook                                                                                  |
| `appendTranscript` 403 IDOR                | Log Sentry critique, `endSession()` immédiat                                                                                                                        |
| User refuse mic                            | Toast "Permission micro refusée. Active-la dans Réglages > Site." + lien aide                                                                                       |
| Quota minutes dépassé                      | Modal `VoiceAddonModal` (composant existant)                                                                                                                        |
| `sendUserMessage` pendant `agent_speaking` | SDK gère interruption naturelle (VAD). Optionnel : `sendUserActivity()` 200ms avant                                                                                 |
| Switch vidéo pendant appel                 | Confirm dialog → `endSession()` → cleanup                                                                                                                           |
| Brave Search rate limit                    | Cache Redis évite. Sinon fallback message "Recherche indispo, réessaie dans 1 min"                                                                                  |

---

## Testing strategy résumée

### Backend (pytest)

- Migration 007 up/down avec données existantes
- `POST /voice/session` explorer/companion, 400 si requirement violé, IDOR
- `POST /voice/transcripts/append` insert OK, 403, ordering
- Webhook reconciliation drift/missing/idempotent
- Quota chat ignore voice rows
- Cache Brave hit/miss/TTL
- Tracking WebSearchUsage pour `source="voice"`

### Frontend web (vitest)

- VoiceCallProvider open/close/gating/prewarm
- VoiceCallButton variants snapshot
- VoiceModal compact positioning + ESC
- ChatPage sync : voice append, sendUserMessage routing, badge UI, scroll detection
- Snapshot Dashboard/History/Debate identiques avant/après migration

### Mobile (jest)

- VoiceButton bottomOffset computed
- Library/Study placement
- useVoiceChat.appendTranscript après onMessage
- agent_type routing companion vs explorer

### Extension (jest + Playwright)

- Manifest CSP syntactique
- Side panel mount avec context depuis storage.session
- Feature detection (bouton caché sur Firefox/Safari)
- Background handlers OPEN_VOICE_PANEL / VOICE_CREATE_SESSION / VOICE_APPEND_TRANSCRIPT

### E2E (Playwright web)

- ChatPage flow complet : tape → response → Appeler → speak → transcripts → end → reload → persistance OK

---

## Variables d'environnement nouvelles

| Var                             | Plateforme | Usage                                                                           |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `ELEVENLABS_COMPANION_VOICE_ID` | backend    | Voice ID dédié pour agent_type=companion (optionnel, fallback DEFAULT_VOICE_ID) |

Aucune autre variable nouvelle. Les clés ElevenLabs et Brave existent déjà.

---

## Roadmap post-V1

- **Spec #6** : Port extension Firefox (`browser.sidebarAction`) et Safari (nouvel onglet) — quand part de marché justifie l'effort
- **Spec #7** : Tool `read_chat_input` côté agent pour scénarios où `sendUserMessage` ne convient pas (ex: notification d'événement externe)
- **Spec #8** : Streaming SSE sur `/api/chat/{summary_id}/history` pour push en temps réel à d'autres clients connectés (ex: même user sur web + mobile)
- **Spec #9** : Intégration Perplexity en fallback de Brave pour deep_research multi-sources

---

## Décisions ouvertes / à valider en revue

1. **Voice ID companion** : créer une voice ID dédiée sur ElevenLabs Dashboard ou réutiliser Rachel (`21m00Tcm4TlvDq8ikWAM`) ?
2. **Persistance transcripts companion** (sans `summary_id`) : où les stocker ? La table `chat_messages` actuelle est indexée par `summary_id`. Options : NULL summary_id autorisé (besoin migration), ou nouvelle table `companion_messages` séparée.
3. **Mobile** : tab `(tabs)/library.tsx` peut-il afficher un FAB voice sans summary_id ? Ou on rentre toujours par une vidéo sélectionnée ?
4. **Chat IA web** : l'overlay flottant 380×600 doit-il être déplaçable (drag) ou fixé bottom-right ?
