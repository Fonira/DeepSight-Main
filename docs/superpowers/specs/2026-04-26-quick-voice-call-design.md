# Quick Voice Call — Killer Feature Design

**Date** : 2026-04-26
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Brainstorm session 2026-04-26 (Opus 4.7 + visual companion)

## Contexte et problème

DeepSight propose aujourd'hui un **Quick Chat texte** zero-credit sur les 3 plateformes (extension, web, mobile). Il a 3 problèmes :

1. **Friction texte** : sur mobile et sur YouTube, taper une question est une mauvaise UX par rapport à la voix
2. **Pas de "wow effect"** : aucun moment viral. Le Quick Chat est utile mais oubliable, donc pas un levier d'acquisition fort
3. **Sous-exploitation du sprint ElevenLabs** : 6 PRs (#122-128) en cours sur le voice agent, mais cantonnées à un usage "premium Expert 20 min/mois". Le voice est traité comme une feature de fin de funnel au lieu d'une killer feature d'acquisition

Parallèlement, la promesse "appeler une vidéo YouTube directement depuis l'extension, et l'analyse arrive en parallèle" n'a aucun équivalent sur le marché.

## Objectifs

1. **Killer feature d'acquisition** : 1 clic dans l'extension Chrome sur YouTube → conversation vocale instantanée avec un agent qui apprend la vidéo en temps réel
2. **Conversion** : Le 1 essai lifetime gratuit en Free crée un déclic émotionnel → CTA upgrade contextuel vers Expert immédiatement après l'appel
3. **Rétention multi-surface** : Le Quick Voice Call remplace le Quick Chat texte sur web et mobile (V2/V3)
4. **Capitalisation** : Réutiliser et étendre les fondations du sprint ElevenLabs en cours (PRs #124-128) plutôt que repartir de zéro

## Décisions verrouillées

| #   | Décision                  | Choix retenu                                                                                                  |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Démarrage vs analyse      | **Asynchrone progressif** : appel instant, contexte vidéo arrive en streaming pendant l'appel                 |
| 2   | Surface V1                | **Extension Chrome (YouTube)**                                                                                |
| 3   | Roadmap surfaces          | V1 Extension Chrome → V2 Web (Chat IA hub) → V3 Mobile (Expo) — web avant mobile car PR #126 plus avancé      |
| 4   | Monétisation              | **A+D strict** : Free = 1 essai lifetime 3 min · Pro = ❌ CTA upgrade vers Expert · Expert 14.99€ = 30 min/mois |
| 5   | Mécanisme streaming ctx   | `sendUserMessage("[CTX UPDATE: ...]")` (mécanisme A) — supporté nativement par SDK ElevenLabs                  |
| 6   | Mute YouTube              | Volume baissé à 10% (pas mute total — ambiance), restauré à la fermeture                                       |
| 7   | Transparence agent        | Prompt : "d'après ce que j'écoute pour l'instant" tant que ctx < 80%, puis "maintenant que j'ai tout le contexte" |
| 8   | Plateformes hors-scope V1 | TikTok (extension le détecte mais voice = YouTube only), Firefox/Safari (Chrome only), vidéos non-DeepSight    |
| 9   | Sous-agents implémentation | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`) — règle de mémoire perma                                     |

## Architecture macro

### Vue d'ensemble du flow asynchrone progressif

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  YouTube tab    │    │  Side Panel      │    │  Backend FastAPI   │
│  + DS widget    │    │  (Chrome MV3)    │    │  api.deepsight…    │
└────────┬────────┘    └────────┬─────────┘    └─────────┬──────────┘
         │                      │                        │
   ❶ Click "🎙️"               │                        │
         │──────open────────────▶│                        │
         │                      │  ❷ POST /voice/session │
         │                      │   {video_id,           │
         │                      │    agent_type=         │
         │                      │    explorer_streaming} │
         │                      │───────────────────────▶│
         │                      │                        │ ❸ Lance analyse
         │                      │   signed_url +         │   en background
         │                      │   conv_token           │   (Mistral + transcr)
         │                      │◀───────────────────────│
         │                      │                        │
         │                      │  ❹ ElevenLabs WS      ┌─▼──────────┐
         │                      │◀──────────────────────│ ElevenLabs │
         │                      │     (audio bidir)     │ Conv. AI   │
         │                      │                       └────────────┘
         │                      │                        │
         │                      │  ❺ SSE /voice/context  │
         │                      │     /stream?session_id │
         │                      │◀═══════════════════════│
         │                      │                        │
         │                      │  ❻ sendUserMessage    │
         │                      │     [CTX UPDATE: …]   │
         │                      │─────────to agent──────▶│
         │                      │                        │
         │                      │       💬 voice         │
   ❼ User parle ─────────────────────────────────────────▶ agent répond
```

### Composants — qui fait quoi

| Acteur                            | Code                            | Statut actuel                                                                                                |
| --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Content script** (widget YT)    | `extension/src/content/`        | Existe — ajouter bouton 🎙️                                                                                  |
| **Side panel** (call actif)       | `extension/src/sidepanel/`      | Existe (PR #128) — étendre VoiceView pour gérer SSE context                                                   |
| **Backend voice**                 | `backend/src/voice/`            | `/session` existe (PR #124) — **NEW** : `/context/stream` SSE + agent_type `explorer_streaming` + quota table |
| **ElevenLabs Conversational AI**  | SDK browser                     | Adapter MV3 existe (PR #128)                                                                                 |
| **Audio controller YT**           | `extension/src/content/`        | NEW — abaisse volume DOM video à 10% à l'ouverture, restaure à la fermeture                                   |

## Spec #1 — Backend

### a. Migration Alembic 008 — Voice quota table

`backend/migrations/alembic/versions/008_voice_quota_a_d_strict.py`

```python
def upgrade():
    op.create_table('voice_quota',
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('plan', sa.String(20), nullable=False),
        sa.Column('monthly_minutes_used', sa.Float, nullable=False, server_default='0'),
        sa.Column('monthly_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('lifetime_trial_used', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('lifetime_trial_used_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column('voice_sessions',
        sa.Column('is_streaming_session', sa.Boolean, server_default='false', nullable=False))
    op.add_column('voice_sessions',
        sa.Column('context_completion_pct', sa.Float, nullable=True))
```

### b. Nouvel `agent_type=explorer_streaming`

`backend/src/voice/agent_types.py`

```python
# NOTE: agent indépendant (pas un fork du existing EXPLORER) avec
# son propre system_prompt qui briefe explicitement sur le streaming context.
# Évite tout couplage avec l'agent explorer "classique" qui suppose contexte complet.
EXPLORER_STREAMING = AgentConfig(
    id="explorer_streaming",
    name_fr="Explorateur (streaming)",
    name_en="Streaming Explorer",
    voice_id=os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", DEFAULT_VOICE_ID),
    tools=["web_search", "deep_research", "check_fact"],
    system_prompt_fr=EXPLORER_STREAMING_PROMPT_FR,
    system_prompt_en=EXPLORER_STREAMING_PROMPT_EN,
    requires_summary=False,  # contexte arrive en stream via [CTX UPDATE]
)
```

Prompt FR (extrait clé) :

```
Tu écoutes la vidéo YouTube en même temps que l'utilisateur. Ton contexte
arrive PROGRESSIVEMENT pendant la conversation via des messages spéciaux
préfixés [CTX UPDATE: ...]. Ces messages NE SONT PAS du dialogue —
absorbe-les silencieusement comme nouveau contexte.

Règles de transparence :
- Tant que tu n'as pas reçu [CTX COMPLETE], dis "d'après ce que j'écoute
  pour l'instant…" pour signaler honnêtement tes zones d'ombre
- Après [CTX COMPLETE], tu peux dire "maintenant que j'ai tout le contexte…"
- Si l'utilisateur pose une question factuelle non couverte, utilise web_search
- Annonce systématiquement "Je vais chercher sur le web" avant d'appeler le tool
```

### c. Endpoint SSE `GET /api/voice/context/stream`

`backend/src/voice/router.py`

```python
@router.get("/context/stream")
async def stream_video_context(
    session_id: str,
    user=Depends(get_current_user)
) -> StreamingResponse:
    """
    SSE stream qui pousse les chunks de contexte vidéo
    au side panel pour qu'il les forward à l'agent ElevenLabs.

    Events:
    - {type: "transcript_chunk", chunk_index, text, total_chunks}
    - {type: "analysis_partial", section: "summary"|"keypoints"|..., content}
    - {type: "ctx_complete", final_digest_summary}
    - {type: "error", message}
    """
    return StreamingResponse(
        _stream_context_for_session(session_id, user.id),
        media_type="text/event-stream"
    )
```

### d. Streaming orchestrator (NEW)

`backend/src/voice/streaming_orchestrator.py` — orchestre le pipeline :

1. Au `POST /voice/session` avec `agent_type=explorer_streaming` et `video_id`, démarre une background task
2. Cette task lance en parallèle :
   - Fetch transcript (Supadata streaming → fallbacks chain) → push chaque chunk en SSE pubsub Redis
   - Analyse Mistral chunked → push `analysis_partial` events
3. À la fin, push `ctx_complete` event
4. Le SSE endpoint subscribe au pubsub Redis pour la session

### e. Voice quota A+D strict

`backend/src/billing/voice_quota.py` (NEW)

```python
async def check_voice_quota(user: User, db: AsyncSession) -> QuotaCheck:
    """
    Free  : lifetime_trial_used == False (1 essai 3 min)
    Pro   : raise 402 + CTA upgrade
    Expert: monthly_minutes_used + estimated_call_minutes <= 30
    """
    quota = await get_or_create_voice_quota(user.id, db)
    if user.plan == "free":
        if quota.lifetime_trial_used:
            return QuotaCheck(allowed=False, reason="trial_used", cta="upgrade_expert")
        return QuotaCheck(allowed=True, max_minutes=3, is_trial=True)
    if user.plan == "pro":
        return QuotaCheck(allowed=False, reason="pro_no_voice", cta="upgrade_expert")
    if user.plan == "expert":
        if quota.monthly_minutes_used >= 30:
            return QuotaCheck(allowed=False, reason="monthly_quota", cta=None)
        return QuotaCheck(allowed=True, max_minutes=30 - quota.monthly_minutes_used)
```

À brancher dans `POST /voice/session` avant la création de l'agent éphémère.

### f. Update `is_feature_available`

`backend/src/core/plan_features.py` (ou équivalent SSOT) :

```python
"voice_call_quick": {
    "free":   ("trial_only", 3),       # platforms: extension, web, mobile
    "pro":    ("upgrade_cta", None),
    "expert": ("monthly_minutes", 30),
}
```

## Spec #2 — Extension Chrome (V1)

### a. Bouton 🎙️ dans le widget

`extension/src/content/widget.ts` (étend l'existant)

- Ajouter un 2e CTA "🎙️ Appeler la vidéo" sous le bouton "📊 Analyser"
- Badge dynamique selon plan user :
  - Free vierge : "1 essai gratuit"
  - Free utilisé : grisé + tooltip "Essai utilisé — passer en Expert"
  - Pro : badge "Expert only" avec lien upgrade
  - Expert : compteur "X min restantes ce mois"
- Click → `chrome.runtime.sendMessage({type: "OPEN_VOICE_CALL", videoId, videoTitle})`
- `background.ts` reçoit → ouvre side panel + passe le videoId via `chrome.storage.session`

### b. VoiceView étendu (déjà existant PR #128)

`extension/src/sidepanel/VoiceView.tsx`

États rendus : `connecting` | `live_context_streaming` | `live_context_complete` | `ended_free_cta_upgrade` | `ended_expert` | `error_quota` | `error_mic_permission`

### c. `useStreamingVideoContext()` hook (NEW)

`extension/src/sidepanel/hooks/useStreamingVideoContext.ts`

```typescript
export function useStreamingVideoContext(sessionId: string, conversation: ElevenLabsConversation) {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_URL}/api/voice/context/stream?session_id=${sessionId}`,
      { withCredentials: true }
    );

    eventSource.addEventListener("transcript_chunk", (e) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage(`[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`);
      setContextProgress((data.chunk_index / data.total_chunks) * 100);
    });

    eventSource.addEventListener("analysis_partial", (e) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage(`[CTX UPDATE: analysis - ${data.section}]\n${data.content}`);
    });

    eventSource.addEventListener("ctx_complete", (e) => {
      const data = JSON.parse(e.data);
      conversation.sendUserMessage(`[CTX COMPLETE]\nFinal digest: ${data.final_digest_summary}`);
      setContextComplete(true);
    });

    return () => eventSource.close();
  }, [sessionId, conversation]);

  return { contextProgress, contextComplete };
}
```

### d. YouTube audio controller (NEW)

`extension/src/content/youtubeAudioController.ts`

```typescript
export class YouTubeAudioController {
  private originalVolume: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  attach() {
    this.videoElement = document.querySelector("video");
    if (!this.videoElement) return;
    this.originalVolume = this.videoElement.volume;
    this.videoElement.volume = Math.min(this.originalVolume, 0.1); // 10%
  }

  detach() {
    if (this.videoElement && this.originalVolume !== null) {
      this.videoElement.volume = this.originalVolume;
    }
  }
}
```

Trigger via message du side panel (`chrome.runtime.sendMessage({type: "VOICE_CALL_STARTED"})` / `VOICE_CALL_ENDED`).

### e. UpgradeCTA component (NEW)

`extension/src/sidepanel/components/UpgradeCTA.tsx`

Carte État 4 post-call avec :
- Texte "Tu as adoré ?" + "Continue avec 30 min/mois"
- Carte plan Expert (14.99€/mois) avec bullet features
- Bouton "Passer en Expert →" → deeplink Stripe checkout via API key user
- Lien discret "Continuer en Free (sans voice)"

## Spec #3 — Web (V2)

Réutilise PR #125 + #126 :

- `frontend/src/components/voice/VoiceCallButton.tsx` (PR #125) → ajouter prop `streaming` qui active le mode asynchrone progressif
- `frontend/src/components/voice/VoiceOverlay.tsx` (PR #126) → étendre avec barre progression contexte + indicateur "Analyse en cours"
- `frontend/src/components/voice/useStreamingVideoContext.ts` (NEW) → web equivalent du hook extension
- Bouton "🎙️ Appeler" sur DashboardPage, AnalysisPage, ChatPage (remplace/complète le Quick Chat actuel)
- Mobile web : design responsive (overlay full-screen sur viewport < 768px)

## Spec #4 — Mobile (V3)

Réutilise PR #127 :

- `mobile/src/components/voice/VoiceButton.tsx` (PR #127) → variante streaming
- `mobile/src/hooks/useStreamingVideoContext.ts` (NEW) — utilise `react-native-sse` ou `EventSource` polyfill RN
- Câblage `mobile/app/(tabs)/library.tsx` (FAB voice) et `mobile/app/(tabs)/study.tsx` (chat sub-tab) avec mode streaming
- Permissions micro iOS/Android : `expo-av` `Audio.requestPermissionsAsync()` au 1er tap
- Native audio ducking (iOS `AVAudioSession` mode) pour le mute YouTube embed si applicable

## Phasage et dépendances

```
PHASE 0 — finir le sprint ElevenLabs en cours (prérequis)
  PR #124 (backend foundation) — 6 sous-tâches restantes (résumé : elevenlabs-resume-plan-2026-04-25.md)
  PR #128 (extension side panel) — npm test + build verify

PHASE 1 — V1 Extension Chrome (J+30, killer launch)
  Backend : migration 008 + agent_type explorer_streaming + SSE context/stream + quota A+D
  Extension : bouton widget + VoiceView étendu + useStreamingVideoContext + audio controller + UpgradeCTA
  E2E : Free 1 essai → upgrade flow

PHASE 2 — V2 Web + mobile web (J+45)
  Réutilise composants PR #125/#126 + ajoute streaming hooks et UI
  Responsive design pour viewport mobile

PHASE 3 — V3 Mobile (J+60)
  Réutilise PR #127 + adapte streaming RN + permissions natives
```

## Risques et mitigations

| Risque                                              | Mitigation                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Latence SSE + ElevenLabs sur connexions slow         | Fallback agent companion + web_search si transcript pas dispo en 5s                    |
| Abus quota Free (reset compte)                       | Tracking IP + device fingerprint sur lifetime_trial_used                                |
| Coûts ElevenLabs explosent                           | Kill switch global env var `VOICE_CALL_DISABLED=true` + alertes Sentry sur dépassement budget mensuel |
| Audio simultané vidéo YouTube + agent peut surprendre | Volume YT baissé à 10% par défaut, toggleable par user (Mute total dans State 3)        |
| `[CTX UPDATE]` messages pourraient leak en dialogue  | Tests E2E sur 50+ conversations + éval qualitative ; fallback mécanisme B (tool custom) |
| MV3 SDK ElevenLabs ne supporte pas SSE direct        | Le SSE est consommé par le side panel (process worker MV3 OK), pas par background script |
| Session ElevenLabs crash en cours d'appel            | Reconnect automatique côté side panel (réutilise même `session_id` backend, nouvelle conn ElevenLabs avec context restauré depuis cache Redis pubsub) |
| User ferme l'onglet YouTube pendant l'appel          | Side panel persiste (Chrome MV3) ; backend détecte fin via heartbeat 30s et clôt session + débite quota au prorata |

## Métriques de succès (PostHog)

- `voice_call_started` (segmenté par plan, plateforme, surface_origine)
- `voice_call_duration_seconds`
- `voice_call_context_complete_at_ms` (temps avant que `[CTX COMPLETE]` arrive)
- `voice_call_ended_reason` (user_hangup, quota_exceeded, error, tab_closed)
- `voice_call_upgrade_cta_shown` / `voice_call_upgrade_cta_clicked` / `voice_call_upgrade_completed`
- **KPI primary** : conversion rate Free 1-essai → Expert dans les 7 jours suivant l'essai

## Tests

- **Backend pytest** : SSE stream (chunks order, ctx_complete, errors), quota A+D (free trial used, pro 402, expert monthly), security (auth, IDOR session_id)
- **Extension Jest** : VoiceView state machine, useStreamingVideoContext mock SSE, audio controller volume/restore
- **Web Vitest** : VoiceCallButton streaming variant, VoiceOverlay progression bar
- **Mobile Jest** : useStreamingVideoContext RN polyfill, permissions flow
- **E2E Playwright** : "Free user installs extension → opens YouTube video → clicks 🎙️ → uses 3 min trial → upgrade CTA → Stripe checkout completes"

## Décisions ouvertes (à valider en review)

| #   | Décision                                                | Défaut proposé                                            |
| --- | ------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Voice ID streaming                                      | Statu quo Rachel (override via `ELEVENLABS_DEFAULT_VOICE_ID`) |
| 2   | Persistance transcripts du voice call dans `chat_messages` | Oui, `source='voice'` `voice_session_id=session_id` (réutilise migration 007 PR #124) |
| 3   | Replay du call (audio enregistré)                       | NON en V1 (RGPD / coûts storage). Transcription écrite OUI en V2 |
| 4   | Compteur Free visible avant utilisation                 | OUI ("1 essai gratuit" sur le bouton)                      |
| 5   | Trial Free reset si user upgrade puis downgrade         | NON (lifetime = lifetime, anti-abus)                      |

## Méga-plan d'implémentation

Le découpage en sous-agents Opus 4.7 sera produit par invocation de la skill `writing-plans` après approbation de ce spec. Vue macro envisagée :

- **Agent A — Backend phase 0** : finir PR #124 (6 sous-tâches restantes du resume plan 2026-04-25)
- **Agent B — Extension phase 0** : valider PR #128 (npm test + build verify + widget integrity)
- **Agent C — Backend Spec #1** : migration 008 + explorer_streaming + SSE context/stream + quota A+D
- **Agent D — Extension Spec #2** : widget button + VoiceView étendu + streaming hook + audio controller + UpgradeCTA
- **Agent E — Tests E2E V1** : Playwright "Free trial → upgrade"
- **Agent F — Web Spec #3** (V2) : composants streaming + responsive mobile web
- **Agent G — Mobile Spec #4** (V3) : composants RN streaming + permissions natives

Les agents A et B sont prérequis ; C/D peuvent démarrer en parallèle après ; E suit C+D ; F et G en parallèle après V1 stable.

**Toutes les invocations Agent doivent utiliser model: claude-opus-4-7[1m]** (règle perma de mémoire utilisateur).
