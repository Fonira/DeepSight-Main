# Quick Voice Call Mobile V3 — Design

**Date** : 2026-04-27
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Brainstorm session 2026-04-27 (Opus 4.7 + visual companion)
**Référence** : Étend la spec V1 [`2026-04-26-quick-voice-call-design.md`](./2026-04-26-quick-voice-call-design.md) à la plateforme Mobile (Expo).

---

## 1. Contexte et problème

La V1 du Quick Voice Call (Extension Chrome, PR #149) est validée et prête à merge. La V3 mobile doit livrer **le même killer feature sur Expo iOS + Android**, avec une promesse encore plus radicale : **friction zéro** pour lancer un appel sur n'importe quelle vidéo YouTube ou TikTok.

Sur extension, le flow est "ouvre YouTube → clique 🎙️". Sur mobile, on n'a pas l'avantage du contexte (l'utilisateur n'est pas déjà sur une vidéo dans l'app). Il faut donc ramener l'URL dans l'app de la manière la plus indolore possible :

- **Clipboard auto-detect** : si l'utilisateur a copié un lien YouTube/TikTok juste avant d'ouvrir l'app, on le détecte et on lui propose 1 tap pour appeler.
- **Share Extension OS** : depuis l'app YouTube ou TikTok, "Partager → DeepSight Voice Call" ouvre l'app _et_ lance l'appel directement.
- **Paste manuel** : fallback standard si le clipboard est vide et que l'utilisateur arrive depuis le launcher.

L'agent ElevenLabs est le même mécanisme asynchrone progressif que la V1 extension : appel instantané, contexte vidéo qui arrive en streaming pendant la conversation via SSE backend + `sendUserMessage("[CTX UPDATE: …]")` côté SDK.

## 2. Objectifs

1. **Killer feature mobile** : tap "Voice Call" → conversation vocale instantanée sur n'importe quelle vidéo YouTube ou TikTok, sans attendre l'analyse complète.
2. **Friction zéro** : l'utilisateur ne doit JAMAIS taper une URL à la main si on peut l'éviter (clipboard auto-detect + share extension OS).
3. **Réutilisation maximale** : étendre les composants voice mobile existants (`VoiceScreen`, `useVoiceChat`, `voiceApi.createSession`) plutôt que dupliquer.
4. **Cohérence cross-platform** : l'agent `explorer_streaming` créé pour la V1 extension est partagé avec la V3 mobile (même prompt, mêmes tools, même mécanisme `[CTX UPDATE]`).
5. **iOS + Android dès le sprint** : pas d'asymétrie temporaire, livraison simultanée des 2 OS.

## 3. Décisions verrouillées (brainstorm 2026-04-27)

| #   | Décision                   | Choix retenu                                                                                                                                                                        |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Niveau de friction         | **B + C + fallback A** : clipboard auto-detect (B) + share extension OS (C) + paste manuel (A) en fallback                                                                          |
| 2   | Mécanisme contexte         | **Asynchrone progressif** (mécanisme A de la spec V1) : SSE backend → `sendUserMessage("[CTX UPDATE: ...]")` côté SDK ElevenLabs RN                                                 |
| 3   | Quotas                     | **Réutiliser le quota voice existant** (45 min/mois selon CLAUDE.md v4.0) — pas de migration alembic supplémentaire, `useVoiceChatGate` actuel non modifié                          |
| 4   | Plateformes V3             | **iOS + Android dès le sprint** + sources URL = **YouTube + TikTok only**                                                                                                           |
| 5   | UI pendant l'appel         | **Réutiliser `VoiceScreen.tsx`** existant + variante `streaming` (props additionnels `streaming`, `contextProgress`, `contextComplete`)                                             |
| 6   | Post-call UX               | **Écran Résumé** (transcript + 2 CTA : "Voir l'analyse complète" → AnalysisScreen, "Appeler une autre vidéo" → reset). Banner upgrade si `quota_remaining === 0`.                   |
| 7   | Architecture backend       | **Endpoint unifié** `POST /api/voice/session` accepte `video_url` (NEW) en plus de `summary_id`. Backend orchestre la création du Summary placeholder + streaming via Redis pubsub. |
| 8   | Sous-agents implémentation | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`)                                                                                                                                    |
| 9   | Branche                    | `feat/quick-voice-call-mobile-v3` depuis `origin/main` (worktree `C:\Users\33667\DeepSight-quick-voice-mobile`)                                                                     |

### Décisions tacites (par défaut)

- **Mode companion libre (sans URL)** depuis Quick Voice Call : hors-scope V3. Le bouton Voice Call ne se déclenche QUE si une URL valide est présente (clipboard, paste, ou deep link). Si rien, le bouton est disabled avec hint "Colle un lien pour commencer".
- **Permission micro** : demandée au 1er tap Voice Call (via `expo-av`, déjà géré par `useVoiceChat.ts` ligne 287-303). Pas de pré-demande au boot de l'app.
- **Style bouton "Voice Call"** : gradient gold cohérent avec le FAB voice existant (`palette.gold` du theme mobile). Bouton "Analyser" reste en gradient indigo→violet.
- **Background app** : auto-stop déjà géré par `useVoiceChat.ts` ligne 459-479 (AppState listener).
- **Persistance transcript** : déjà câblée par `voiceApi.appendTranscript` (Spec #3 Mobile).

## 4. Architecture macro

```
┌─ ENTRÉES (3 sources cumulatives) ─────────────────────────────────────────────┐
│                                                                                │
│  A. Open app → paste URL manuel                                                │
│  B. Open app → clipboard scan auto → bandeau "📋 Lien détecté"                 │
│  C. Share OS depuis YouTube/TikTok → deeplink autostart=true                   │
│                                                                                │
└────────────────────────────────────┬───────────────────────────────────────────┘
                                     │
                                     ▼
                       validateVideoURL(url) → YT/TikTok regex
                                     │
                                     ▼
        POST /api/voice/session  { video_url, agent_type: "explorer_streaming" }
                                     │
                                     ▼
                 ┌──── Backend FastAPI ────────────────────────┐
                 │  1. valider URL (regex) + créer Summary     │
                 │     placeholder en DB                        │
                 │  2. lancer streaming_orchestrator background │
                 │  3. retourner conversation_token + sess_id   │
                 └──────────────────┬──────────────────────────┘
                                    │
                                    ▼
                  ┌────── Mobile VoiceScreen (Modal) ──────┐
                  │  variante streaming = true             │
                  │  agent transparent + progress bar 0%   │
                  │  conversation.startSession({           │
                  │    conversationToken })                │
                  └──────────────┬─────────────────────────┘
                                 │
                  ╔══════════════╪═════════════════════════╗
                  ║              │                          ║
        ELEVEN LABS WS           SSE /voice/context/stream  ║
        (audio bidir)            ?session_id=X              ║
                  ║              │                          ║
                  ║              ▼                          ║
                  ║   useStreamingVideoContext hook         ║
                  ║              │                          ║
                  ║              ▼                          ║
                  ║   conversation.sendUserMessage(         ║
                  ║     "[CTX UPDATE: transcript chunk      ║
                  ║      3/8] ...")                         ║
                  ║              │                          ║
                  ║              ▼                          ║
                  ║   contextProgress 0% → 80% → COMPLETE  ║
                  ╚═════════════════════════════════════════╝
                                 │
                                 ▼
                User hangup OU quota épuisé OU CTX_COMPLETE + 30s d'inactivité
                                 │
                                 ▼
                ┌─── PostCallScreen (NEW Modal) ──────────┐
                │  - Transcript de l'appel                 │
                │  - CTA "Voir l'analyse complète" →       │
                │    push /analysis/[summaryId]            │
                │  - CTA "Appeler une autre vidéo" →       │
                │    reset, retour Home + clipboard scan   │
                │  - Banner upgrade si quota_remaining=0   │
                └──────────────────────────────────────────┘
```

## 5. Spec Backend (FastAPI / Python)

### 5.1 Nouvel agent `explorer_streaming`

**Fichier** : `backend/src/voice/agent_types.py`

```python
EXPLORER_STREAMING = AgentConfig(
    agent_type="explorer_streaming",
    display_name="Streaming Explorer",
    display_name_fr="Explorateur (streaming)",
    description="Voice agent that learns the video as the user speaks",
    description_fr="Agent vocal qui apprend la vidéo pendant la conversation",
    system_prompt_fr=EXPLORER_STREAMING_PROMPT_FR,
    system_prompt_en=EXPLORER_STREAMING_PROMPT_EN,
    tools=["web_search", "deep_research", "check_fact"],
    voice_style="warm",
    requires_summary=False,  # contexte arrive en stream via [CTX UPDATE]
)
```

**Prompt FR (extrait clé)** :

```
Tu écoutes la vidéo YouTube ou TikTok en même temps que l'utilisateur.
Ton contexte arrive PROGRESSIVEMENT pendant la conversation via des messages
spéciaux préfixés [CTX UPDATE: ...]. Ces messages NE SONT PAS du dialogue —
absorbe-les silencieusement comme nouveau contexte.

Règles de transparence :
- Tant que tu n'as pas reçu [CTX COMPLETE], dis "d'après ce que j'écoute
  pour l'instant…" pour signaler honnêtement tes zones d'ombre
- Après [CTX COMPLETE], tu peux dire "maintenant que j'ai tout le contexte…"
- Si l'utilisateur pose une question factuelle non couverte, utilise web_search
- Annonce systématiquement "Je vais chercher sur le web" avant d'appeler le tool
```

### 5.2 Schéma `VoiceSessionRequest` étendu

**Fichier** : `backend/src/voice/schemas.py`

```python
class VoiceSessionRequest(BaseModel):
    summary_id: Optional[int] = Field(default=None, ...)
    debate_id: Optional[int] = Field(default=None, ...)
    video_url: Optional[str] = Field(  # NEW
        default=None,
        description="URL YouTube ou TikTok pour mode explorer_streaming",
        max_length=500,
    )
    language: str = Field(default="fr", ...)
    agent_type: str = Field(default="explorer", ...)

    @model_validator(mode="after")
    def _xor_source(self) -> "VoiceSessionRequest":
        sources = sum([
            self.summary_id is not None,
            self.debate_id is not None,
            self.video_url is not None,
        ])
        if sources > 1:
            raise ValueError("Fournir summary_id OU debate_id OU video_url, un seul")
        if self.video_url is not None and self.agent_type != "explorer_streaming":
            raise ValueError("video_url nécessite agent_type='explorer_streaming'")
        return self
```

### 5.3 Validator URL YouTube + TikTok

**Fichier** : `backend/src/voice/url_validator.py` (NEW)

```python
import re
from urllib.parse import urlparse, parse_qs

YOUTUBE_RE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)"
    r"([a-zA-Z0-9_-]{11})"
)
TIKTOK_RE = re.compile(
    r"^https?://(?:www\.|vm\.|m\.)?tiktok\.com/(?:@[\w.-]+/video/|t/|v/)?(\d+|[A-Za-z0-9]+)"
)

def parse_video_url(url: str) -> tuple[str, str]:
    """Returns (platform, video_id). Raises ValueError on invalid."""
    if m := YOUTUBE_RE.match(url):
        return ("youtube", m.group(1))
    if m := TIKTOK_RE.match(url):
        return ("tiktok", m.group(1))
    raise ValueError(f"URL non supportée: {url[:80]}")
```

### 5.4 Endpoint `POST /api/voice/session` étendu

**Fichier** : `backend/src/voice/router.py` (modifie l'existant)

Branche dans le handler quand `request.video_url` est fourni :

1. Valide URL via `parse_video_url()` → récupère `(platform, video_id)`
2. Vérifie le quota voice via `check_voice_quota(user, db)` (existant)
3. Crée un `Summary` placeholder en DB (`status='pending'`, `video_id`, `platform`, `user_id`)
4. Lance `streaming_orchestrator.start(session_id, summary_id, video_url)` en `BackgroundTasks`
5. Construit l'agent éphémère ElevenLabs avec `agent_type='explorer_streaming'`
6. Retourne `VoiceSessionResponse` standard (`signed_url`, `conversation_token`, `session_id`, `quota_remaining_minutes`, `max_session_minutes`) + `summary_id` (NEW field)

### 5.5 Streaming orchestrator (NEW module)

**Fichier** : `backend/src/voice/streaming_orchestrator.py` (NEW)

```python
async def start(session_id: str, summary_id: int, video_url: str, db: AsyncSession):
    """
    Lance le pipeline asynchrone : transcript → analyse → publish events Redis.
    Channel : voice:ctx:{session_id}
    """
    redis = get_redis_client()
    channel = f"voice:ctx:{session_id}"
    try:
        # 1. Fetch transcript via Supadata chain (existing in transcripts/youtube.py + tiktok.py)
        async for chunk in stream_transcript_chunks(video_url):
            await redis.publish(channel, json.dumps({
                "type": "transcript_chunk",
                "chunk_index": chunk.index,
                "total_chunks": chunk.total,
                "text": chunk.text,
            }))
        # 2. Mistral analyse chunked (résumé partiel par section)
        async for section in stream_mistral_analysis(summary_id, db):
            await redis.publish(channel, json.dumps({
                "type": "analysis_partial",
                "section": section.name,  # "summary"|"keypoints"|"sources"
                "content": section.content,
            }))
        # 3. Final
        await redis.publish(channel, json.dumps({
            "type": "ctx_complete",
            "final_digest_summary": await get_final_digest(summary_id, db),
        }))
    except Exception as e:
        logger.exception(f"streaming_orchestrator failed for session {session_id}")
        await redis.publish(channel, json.dumps({"type": "error", "message": str(e)}))
```

### 5.6 Endpoint SSE `GET /api/voice/context/stream`

**Fichier** : `backend/src/voice/router.py`

```python
@router.get("/context/stream")
async def stream_video_context(
    session_id: str,
    user=Depends(get_current_user),
) -> StreamingResponse:
    # Vérifier que la session appartient bien à user (IDOR check)
    # Subscribe au pubsub Redis voice:ctx:{session_id}
    # Forward events au client en SSE format
    return StreamingResponse(
        _redis_pubsub_to_sse(session_id, user.id),
        media_type="text/event-stream",
    )
```

## 6. Spec Mobile — Home Screen

**Fichier** : `mobile/app/(tabs)/index.tsx` (modifie l'existant)

### 6.1 Layout

- Input URL (existing) avec auto-focus désactivé en mode clipboard
- Sous l'input : **2 CTA côte à côte** dans une `Row`
  - Bouton "📊 Analyser" (gradient indigo→violet, primaire web mode)
  - Bouton "🎙️ Voice Call" (gradient gold, primaire voice mode)
- Bandeau gold "📋 Lien détecté" affiché AU-DESSUS de l'input quand `clipboardURL !== null`

### 6.2 Hook `useClipboardURLDetector` (NEW)

**Fichier** : `mobile/src/hooks/useClipboardURLDetector.ts`

```typescript
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { validateVideoURL } from "../utils/validateVideoURL";

export function useClipboardURLDetector() {
  const [clipboardURL, setClipboardURL] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const text = await Clipboard.getStringAsync();
        if (cancelled) return;
        if (text && validateVideoURL(text)) {
          setClipboardURL(text);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );
  return { clipboardURL, dismiss: () => setClipboardURL(null) };
}
```

iOS : `expo-clipboard.getStringAsync()` triggers le banner transient natif "DeepSight a collé depuis votre presse-papier". Acceptable UX (un peu intrusif mais standard iOS).

### 6.3 Hook `useDeepLinkURL` (NEW)

**Fichier** : `mobile/src/hooks/useDeepLinkURL.ts`

```typescript
import * as Linking from "expo-linking";

export function useDeepLinkURL(
  onURL: (url: string, autostart: boolean) => void,
) {
  useEffect(() => {
    const handler = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === "voice-call") {
        const target = String(parsed.queryParams?.url ?? "");
        const autostart = parsed.queryParams?.autostart === "true";
        if (target && validateVideoURL(target)) {
          onURL(target, autostart);
        }
      }
    };
    Linking.getInitialURL().then((url) => url && handler({ url }));
    const sub = Linking.addEventListener("url", handler);
    return () => sub.remove();
  }, [onURL]);
}
```

### 6.4 Util `validateVideoURL`

**Fichier** : `mobile/src/utils/validateVideoURL.ts` (mirror du backend regex)

```typescript
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
const TIKTOK_RE =
  /^https?:\/\/(?:www\.|vm\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|t\/|v\/)?(\d+|[A-Za-z0-9]+)/;

export function validateVideoURL(url: string): boolean {
  return YOUTUBE_RE.test(url) || TIKTOK_RE.test(url);
}
```

## 7. Spec Mobile — VoiceScreen variante streaming

**Fichier** : `mobile/src/components/voice/VoiceScreen.tsx` (modifie l'existant)

### 7.1 Props additionnels

```typescript
interface VoiceScreenProps {
  // ... existing props
  streaming?: boolean; // NEW — active la variante streaming
  contextProgress?: number; // NEW — 0-100
  contextComplete?: boolean; // NEW
}
```

### 7.2 Progress bar (visible si `streaming === true`)

Sous le titre vidéo (`videoTitle`) :

```
┌────────────────────────────────────────┐
│ 🎙️ J'écoute la vidéo en même temps    │  ← contextComplete === false
│    que toi  · Analyse en cours: 60%    │
│ ▰▰▰▰▰▰▱▱▱▱                              │  ← Reanimated withTiming
└────────────────────────────────────────┘

ou (contextComplete === true)

┌────────────────────────────────────────┐
│ ✓ Contexte vidéo complet               │
└────────────────────────────────────────┘
```

### 7.3 Hook `useStreamingVideoContext` (NEW)

**Fichier** : `mobile/src/components/voice/useStreamingVideoContext.ts`

```typescript
import EventSource from "react-native-sse";

export function useStreamingVideoContext(
  sessionId: string | null,
  conversation: ReturnType<typeof useConversation>,
) {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const url = `${API_BASE_URL}/api/voice/context/stream?session_id=${sessionId}`;
    const es = new EventSource(url, { headers: getAuthHeaders() });

    es.addEventListener("transcript_chunk", (e) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage?.(
        `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
      );
      setContextProgress((data.chunk_index / data.total_chunks) * 80); // 80% pour transcript
    });
    es.addEventListener("analysis_partial", (e) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage?.(
        `[CTX UPDATE: analysis - ${data.section}]\n${data.content}`,
      );
      setContextProgress((p) => Math.min(p + 5, 95));
    });
    es.addEventListener("ctx_complete", (e) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage?.(
        `[CTX COMPLETE]\nFinal digest: ${data.final_digest_summary}`,
      );
      setContextProgress(100);
      setContextComplete(true);
    });
    es.addEventListener("error", (e) => {
      console.warn("[CTX STREAM] error", e);
    });
    return () => es.close();
  }, [sessionId, conversation]);

  return { contextProgress, contextComplete };
}
```

### 7.4 Wiring `useStreamingVideoContext` (parent Home, pas dans `useVoiceChat`)

`useVoiceChat.ts` est **étendu** pour exposer dans son retour :

- `sessionId: string | null` (NEW — null avant `start()`, set après backend ack)
- `conversation: ReturnType<typeof useConversation>` (NEW — l'objet SDK ElevenLabs RN)

Le hook `useStreamingVideoContext(sessionId, conversation)` est ensuite appelé **dans le parent Home** (au-dessus de `VoiceScreen`), uniquement si `agentType === 'explorer_streaming'`. Il fournit `contextProgress` et `contextComplete` qu'on passe en props à `VoiceScreen`.

```typescript
// app/(tabs)/index.tsx (Home)
const voice = useVoiceChat({ agentType: "explorer_streaming", videoUrl });
const ctx = useStreamingVideoContext(voice.sessionId, voice.conversation);

return (
  <VoiceScreen
    visible={voiceOpen}
    streaming={true}
    contextProgress={ctx.contextProgress}
    contextComplete={ctx.contextComplete}
    voiceStatus={voice.status}
    messages={voice.messages}
    /* ...autres props existantes... */
  />
);
```

Raison de ce découpage : `VoiceScreen` reste presentational (props-only), `useVoiceChat` ne dépend pas du SSE (utilisable seul pour les modes `explorer`/`companion`/`debate_moderator`), et `useStreamingVideoContext` peut être testé indépendamment.

### 7.5 Étendre `voiceApi.createSession` pour accepter `videoUrl`

**Fichier** : `mobile/src/services/api.ts` (modifie l'existant)

Ajouter `video_url?: string` dans le payload accepté + transmettre tel quel au backend :

```typescript
async createSession(arg1: number | {
  summary_id?: number;
  debate_id?: number;
  video_url?: string;        // NEW
  agent_type?: "explorer" | "companion" | "debate_moderator" | "explorer_streaming";  // NEW value
  language?: string;
}, legacyLanguage?: string): Promise<SessionResponse & { summary_id?: number }> {
  // ...existing logic, append video_url + new agent_type to body
}
```

`SessionResponse` est étendu avec `summary_id?: number` (le backend retourne le summary_id du Summary placeholder créé, indispensable pour le PostCallScreen CTA "Voir l'analyse complète").

## 8. Spec Mobile — PostCallScreen (NEW)

**Fichier** : `mobile/src/components/voice/PostCallScreen.tsx` (NEW)

```typescript
interface PostCallScreenProps {
  visible: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  summaryId?: number; // pour deep link vers /analysis
  durationSeconds: number;
  messages: VoiceMessage[];
  quotaRemaining: number;
}
```

### Layout

```
┌──────────────────────────────────────┐
│ ✕                                    │
│                                       │
│   ✓ Appel terminé                    │
│   YouTube · 4:32 min                 │
│   "Le futur de l'IA en 2026"         │
│                                       │
│   ─────────── Transcript ──────────   │
│   ┌───────────────────────────────┐  │
│   │ Toi: …                         │  │
│   │ Agent: …                       │  │
│   │ … (FlashList scrollable)       │  │
│   └───────────────────────────────┘  │
│                                       │
│   ┌───────────────────────────────┐  │
│   │ Voir l'analyse complète →     │  │  ← CTA primaire gold gradient
│   └───────────────────────────────┘  │
│   ┌───────────────────────────────┐  │
│   │ Appeler une autre vidéo       │  │  ← CTA secondaire glass
│   └───────────────────────────────┘  │
│                                       │
│   [si quotaRemaining===0]             │
│   ⚠ Quota voice épuisé · Pro 5.99€    │
└──────────────────────────────────────┘
```

### Wiring

Dans `Home` (ou conteneur parent de VoiceScreen), après `useVoiceChat` :

```typescript
const showPostCall = status === "idle" && messages.length > 0 && lastSummaryId;

return (
  <>
    {/* ...home content... */}
    <VoiceScreen visible={showVoiceScreen} ... />
    <PostCallScreen visible={showPostCall} summaryId={lastSummaryId} ... />
  </>
);
```

## 9. Spec Native — Share Extension iOS + Android

### 9.1 iOS Share Extension

**Approche** : utiliser `expo-share-intent` (community plugin) si compatible Expo SDK 54, sinon implémenter via Expo config plugin custom + target Xcode `DeepSightShareExtension`.

**Fichiers** (config plugin custom) :

- `mobile/plugins/withShareExtension.ts` — config plugin Expo qui injecte le target Xcode
- `mobile/ios/DeepSightShareExtension/ShareViewController.swift` — Swift handler
- `mobile/ios/DeepSightShareExtension/Info.plist` — déclaration `NSExtensionActivationRule` (URL YouTube + TikTok)

**Comportement** : `ShareViewController` extrait l'URL partagée → ouvre l'app principale via `openURL("deepsight://voice-call?url=ENCODED&autostart=true")`.

**App Group** : `group.com.deepsight.shared` pour permettre l'extension de communiquer avec l'app principale (en cas de extension persistente, optional V3.1).

### 9.2 Android Intent Filter

**Fichier** : `mobile/app.json`

```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "SEND",
          "category": ["DEFAULT"],
          "data": [{ "mimeType": "text/plain" }]
        }
      ]
    }
  }
}
```

**Handler** : Expo Linking récupère automatiquement l'`Intent.EXTRA_TEXT` via `Linking.getInitialURL()` (avec un format spécial Android `?action=android.intent.action.SEND&...`). Le hook `useDeepLinkURL` (§6.3) doit gérer ce format.

### 9.3 EAS Build natif obligatoire

`mobile/eas.json` profiles `development` et `production` doivent utiliser `developmentClient` (déjà le cas en V2) — Expo Go ne fonctionnera plus pour ce flow.

`npx expo run:ios` / `npx expo run:android` requis pour smoke-test local.

## 10. Phasage — 3 PRs cumulatives

| PR  | Scope                                                                                                                                              | Effort | Bloque |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| PR1 | Backend `explorer_streaming` + `/voice/session` extended + SSE `/voice/context/stream` + `streaming_orchestrator` + URL validator + tests pytest   | 2-3 j  | PR2    |
| PR2 | Mobile Home (paste + clipboard auto-detect + UI 2 CTA) + VoiceScreen variante streaming + `useStreamingVideoContext` + PostCallScreen + tests Jest | 2-3 j  | PR3    |
| PR3 | Native Share Extensions iOS + Android Intent Filter + deep link routing + EAS Build natif config + smoke E2E manuel                                | 3-4 j  | —      |

**Total : 7-10 jours** sur Opus 4.7 sous-agents.

Les 3 PRs sont mergées indépendamment dans cet ordre. Après PR1+PR2, l'utilisateur peut DÉJÀ utiliser le Quick Voice Call via paste manuel + clipboard auto-detect. PR3 ajoute le 1-tap viral via Share OS.

## 11. Risques et mitigations

| Risque                                                                         | Mitigation                                                                                                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-clipboard` permission iOS bouge entre versions                           | Tester sur iOS 17+ + Android 13+ (clipboard API stable). Documenter le banner transient iOS dans le release notes.                              |
| Share Extension iOS = effort dev élevé (Swift + Xcode)                         | Si `expo-share-intent` plugin compat SDK 54 : utiliser direct (-2 j). Sinon config plugin custom (~3 j incluant tests).                         |
| Deep link autostart=true peut spammer le backend si le user re-share en boucle | Throttle au niveau Mobile : 1 session voice / 30s max. AppState + clipboard reset à chaque ouverture.                                           |
| Latence SSE + ElevenLabs sur connexions slow mobiles                           | Fallback agent companion + web_search si transcript pas dispo en 5s. UI message "Je commence sans contexte, je l'absorbe au fur et à mesure".   |
| TikTok URL extraction transcript peut échouer (DRM, deleted)                   | `transcripts/tiktok.py` existe déjà avec ses fallbacks. Si tout échoue → `[CTX UPDATE: erreur transcript]` + agent informe le user honnêtement. |
| Coûts ElevenLabs explosent avec viral mobile                                   | Kill switch global env var `VOICE_CALL_DISABLED=true` + alertes Sentry sur dépassement budget mensuel.                                          |
| `[CTX UPDATE]` messages leaks en dialogue (agent les répète)                   | Tests E2E sur 50+ conversations + éval qualitative ; fallback mécanisme B (tool custom) si récurrent.                                           |
| Race condition deep link autostart vs clipboard auto-detect                    | Deep link a priorité absolue. Clear `clipboardURL` state si deep link reçu < 2s après focus.                                                    |

## 12. Métriques de succès (PostHog)

- `voice_call_started` (segmenté par plan, plateforme=mobile, source=clipboard|paste|share_os)
- `voice_call_duration_seconds`
- `voice_call_context_complete_at_ms`
- `voice_call_ended_reason` (user_hangup, quota_exceeded, error, app_backgrounded)
- `voice_call_post_call_cta_clicked` (analyse|next_call|upgrade)
- `share_extension_opened_count` (iOS + Android, segmenté par source app si détectable)
- `clipboard_url_detected_count` / `clipboard_url_used_count` (taux de conversion)
- **KPI primary** : conversion rate Free → Pro/Plus dans les 7 jours suivant le 1er Voice Call mobile

## 13. Tests

### Backend (pytest)

- `tests/voice/test_streaming_orchestrator.py` : chunks order, ctx_complete, error path
- `tests/voice/test_voice_session_video_url.py` : POST /voice/session avec video_url valide YT/TikTok, validator XOR, IDOR check
- `tests/voice/test_voice_context_sse.py` : Redis pubsub → SSE roundtrip, auth filter
- `tests/voice/test_url_validator.py` : YouTube watch/shorts/embed/youtu.be + TikTok video/vm.tiktok + invalid URLs

### Mobile (Jest)

- `mobile/__tests__/hooks/useClipboardURLDetector.test.ts` : focus → detect, ignore non-URL, ignore non-YT/TikTok
- `mobile/__tests__/hooks/useDeepLinkURL.test.ts` : initial URL + addEventListener, autostart param, invalid URL ignored
- `mobile/__tests__/components/voice/useStreamingVideoContext.test.ts` : mock EventSource, dispatch sendUserMessage, progress, complete
- `mobile/__tests__/components/voice/VoiceScreen.streaming.test.tsx` : progress bar render conditionnel
- `mobile/__tests__/components/voice/PostCallScreen.test.tsx` : CTAs, banner upgrade conditionnel
- `mobile/__tests__/utils/validateVideoURL.test.ts` : YT + TikTok matrix, invalid URLs

### E2E manuel (smoke test après PR3)

1. iOS : ouvrir YouTube app → choisir une vidéo → bouton Partager → "DeepSight Voice Call" → vérifier ouverture app + appel démarre + agent dit "j'écoute la vidéo en même temps que toi"
2. Android : idem depuis TikTok app
3. iOS + Android : copier un lien YouTube → ouvrir DeepSight depuis launcher → vérifier bandeau "Lien détecté" + 1 tap pour appeler
4. iOS + Android : ouvrir DeepSight → coller manuellement un lien TikTok → tap "Voice Call" → vérifier flow complet

## 14. Décisions ouvertes (à valider en review)

| #   | Décision                                                                  | Défaut proposé                                                                     |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Plugin Expo Share Extension : `expo-share-intent` ou config plugin custom | À tester pendant PR3. Si `expo-share-intent` compat SDK 54 → préférer.             |
| 2   | Mode companion libre depuis Quick Voice Call (sans URL)                   | NON en V3 (fallback hint "colle un lien"). Reconsidérer en V3.1.                   |
| 3   | Persistance des transcripts post-call dans `chat_messages`                | OUI (déjà géré par `voiceApi.appendTranscript` Spec #3 mobile)                     |
| 4   | Deep link scheme                                                          | `deepsight://voice-call?url=...&autostart=true` (à confirmer dans `app.json` Expo) |
| 5   | App Group iOS                                                             | `group.com.deepsight.shared` (à provisionner sur Apple Dev portal)                 |
| 6   | Cache transcript chunks dans Redis pour reconnect SSE                     | OUI, TTL = 30 min (durée max session voice)                                        |

## 15. Méga-plan d'implémentation

Le découpage en sous-agents Opus 4.7 sera produit par invocation de la skill `writing-plans` après approbation de ce spec. Vue macro envisagée :

- **Agent A — PR1 Backend** : nouveau agent_type, schemas extended, URL validator, streaming orchestrator, SSE endpoint, tests pytest. Estimation : 2-3 jours Opus 4.7.
- **Agent B — PR2 Mobile UI** : Home redesign (paste + clipboard auto-detect + 2 CTA), VoiceScreen variante streaming, useStreamingVideoContext, PostCallScreen, tests Jest. Estimation : 2-3 jours Opus 4.7.
- **Agent C — PR3 Native + Share Extensions** : iOS Swift Share Extension, Android Intent Filter, EAS Build natif config, smoke E2E. Estimation : 3-4 jours Opus 4.7.

Les agents A et B peuvent travailler en parallèle (B mocke le backend pour ses tests Jest). C démarre après B mergée (deep link routing testable).

**Toutes les invocations Agent doivent utiliser `model: claude-opus-4-7[1m]`** (règle perma de mémoire utilisateur).
