# DeepSight Voice Agent — Recherche & Spec Technique
*Avril 2026 — Upgrade complet de l'expérience Voice Chat*

---

## 1. ÉTAT DES LIEUX

### Ce qui existe déjà dans DeepSight

| Feature | Status | Fichiers clés |
|---------|--------|---------------|
| Voice Chat via ElevenLabs Conversational AI | ✅ Prod | `backend/src/voice/elevenlabs.py`, `frontend/src/components/voice/useVoiceChat.ts` |
| 5 agents spécialisés (Explorer, Tutor, Debate, Quiz, Onboarding) | ✅ Prod | `backend/src/voice/agent_types.py` |
| Webhook tools (transcript search, analysis sections, sources, flashcards) | ✅ Prod | `backend/src/voice/tools.py` |
| Préférences voix utilisateur (voice_id, speed, stability, model) | ✅ Prod | `backend/src/voice/preferences.py` |
| Quota mensuel par plan (15 min/mois pro+) | ✅ Prod | `backend/src/voice/quota.py` |
| TTS multi-provider (ElevenLabs → Voxtral → OpenAI) | ✅ Prod | `backend/src/tts/providers.py` |
| Speed cycling extension Chrome (1x → 1.5x → 2x → 3x) | ✅ Prod | `extension/src/content/tts.ts` |

### Points faibles identifiés

1. **Latence** — Le mode toujours-à-l'écoute (VAD) introduit de la latence : détection de fin de parole + traitement LLM + TTS
2. **Pas de Push-to-Talk** — Micro toujours ouvert, pas de contrôle utilisateur
3. **Agent non-interruptible proprement** — Pas de gestion fine du barge-in
4. **Vitesse de lecture fixe** — Le speed control ElevenLabs ConvAI est limité à 0.7–1.2x (vs les préférences qui stockent 0.25–4.0)
5. **Pas de recherche web en live** — Les tools webhook sont read-only sur les données DeepSight
6. **Options de paramétrage limitées** — Pas d'UI pour turn eagerness, timeout, expressive mode

---

## 2. FONCTIONNALITÉS ELEVENLABS DISPONIBLES (Avril 2026)

### 2.1 Conversational AI 2.0 + ElevenAgents

ElevenLabs a lancé **Conversational AI 2.0** puis **ElevenAgents**, une plateforme complète :

| Feature | Description | Impact latence |
|---------|-------------|---------------|
| **Turn-taking model** | Modèle dédié qui analyse les signaux conversationnels ("um", "ah", pauses) pour déterminer quand parler | ⬇️ Réduit les faux positifs de fin de parole |
| **Expressive Mode (v3 Conversational)** | Voix qui s'adapte au ton/émotion + tags `[laughs]`, `[whispers]`, `[slow]`, `[excited]` | ≈ Même latence (ultra-low-latency) |
| **RAG Knowledge Base** | Upload de docs/URLs, le RAG est interrogé à chaque query (155ms médian) | +155ms (négligeable) |
| **Guardrails 2.0** | 3 couches de protection : prompt hardening + input screening + output screening | Minimal |
| **Batch Calling API** | Appels sortants automatisés | N/A pour DeepSight |
| **EU Data Residency** | Données en Europe (optionnel) | N/A |
| **HIPAA Compliance** | Pour le médical | N/A |

### 2.2 Conversation Flow — Paramètres disponibles

| Paramètre | Valeurs | Impact |
|-----------|---------|--------|
| **Turn Eagerness** | `eager` / `normal` / `patient` | Contrôle la réactivité de l'agent — `eager` = répond vite, `patient` = attend que l'user finisse |
| **Turn Timeout** | 1–30 secondes | Durée de silence avant que l'agent relance |
| **Soft Timeout** | 0.5–8.0 secondes (défaut: disabled) | Filler phrase ("Hhmmmm...") pendant la réflexion |
| **Interruptions** | on/off | L'utilisateur peut couper la parole à l'agent |
| **Skip Turn** (system tool) | Tool activable | L'agent peut décider de se taire et attendre |

### 2.3 Speed Control

| Paramètre | Range | Notes |
|-----------|-------|-------|
| `conversation_config.tts.speed` | **0.7 – 1.2** | Contrôle natif dans l'API ConvAI |
| Qualité aux extrêmes | Dégradée | ElevenLabs recommande 0.9–1.1 pour le naturel |

> ⚠️ **Limitation critique** : La range officielle ConvAI est 0.7–1.2x. Pour du x2/x3/x4, il faut une approche hybride (voir section 4).

### 2.4 SDK JavaScript/React — Méthodes clés

```typescript
// Contrôle micro
conversation.setMicMuted(true/false)     // Mute/unmute le micro

// Volume de sortie
conversation.setVolume({ volume: 0.8 })  // 0 à 1

// Envoi de texte (alternative au micro)
conversation.sendUserMessage("texte")     // Traité comme message user

// Info contextuelle (pas de réponse agent)
conversation.sendContextualUpdate("texte")

// Prévenir l'interruption (push-to-talk signal)
conversation.sendUserActivity()           // Pause agent ~2 secondes

// Feedback
conversation.sendFeedback(true/false)     // Pouce haut/bas

// Callbacks
onModeChange: (mode) => {}               // speaking ↔ listening
onStatusChange: (status) => {}           // connected/connecting/disconnected
onMessage: (message) => {}               // Transcriptions + réponses
onAudioAlignment: (data) => {}           // Timing caractère par caractère
```

**React Hooks (v1.0+)** :
```typescript
useConversationControls()   // Start/end/mute/volume
useConversationStatus()     // Connection state
useConversationInput()      // Mic state
useConversationMode()       // Speaking/listening
useConversationFeedback()   // Feedback state
```

### 2.5 Types de Tools pour les Agents

| Type | Exécution | Use case |
|------|-----------|----------|
| **Server Tools** | Appel HTTP vers votre backend | Recherche web, API calls, DB queries |
| **Client Tools** | Exécuté côté navigateur | UI updates, navigation, clipboard |
| **System Tools** | Built-in ElevenLabs | End call, skip turn, language switch, agent transfer, DTMF |
| **MCP Tools** | Serveur MCP connecté | Accès à des services externes (CRM, Stripe, etc.) |
| **Tool Call Sounds** | Audio ambient | Son pendant l'exécution d'un tool |

### 2.6 Custom LLM Integration

ElevenLabs permet de **brancher son propre LLM** (compatible OpenAI API) :

- Format : `/v1/chat/completions` ou `/v1/responses` (SSE streaming)
- **Mistral est compatible** via son API OpenAI-compatible
- Tool calling supporté (format OpenAI function calling)
- Buffer words pour masquer la latence LLM ("... ")
- `elevenlabs_extra_body` pour passer des données custom

> **Opportunité** : Utiliser Mistral directement comme LLM de l'agent (cohérence avec le reste de DeepSight) au lieu du LLM par défaut d'ElevenLabs.

---

## 3. ANALYSE DES AMÉLIORATIONS DEMANDÉES

### 3.1 Push-to-Talk (PTT)

**Problème** : Le mode VAD (Voice Activity Detection) toujours actif cause :
- Faux positifs (bruits ambiants déclenchent l'écoute)
- Latence supplémentaire (le système doit détecter la fin de parole)
- L'utilisateur ne contrôle pas quand il parle

**Solution ElevenLabs** :

ElevenLabs n'a **pas de mode PTT natif**, mais le SDK fournit les briques :

```typescript
// IMPLÉMENTATION PUSH-TO-TALK
// 1. Démarrer la session avec le micro muté
await conversation.startSession({ agentId: '...', /* ... */ });
conversation.setMicMuted(true); // Micro OFF par défaut

// 2. Push-to-Talk : unmute quand l'user appuie
const handlePressStart = () => {
  conversation.setMicMuted(false);     // Micro ON
  conversation.sendUserActivity();      // Signal "je parle" → agent se tait
};

const handlePressEnd = () => {
  conversation.setMicMuted(true);      // Micro OFF
  // L'agent détecte le silence et répond
};
```

**Gain latence** : ~200-500ms économisés (plus besoin d'attendre la détection de fin de parole par le VAD).

### 3.2 Interruption de l'Agent

**Problème** : Quand l'agent parle, l'utilisateur veut pouvoir le couper net.

**Solution** :

```typescript
// Quand l'user appuie sur PTT pendant que l'agent parle
const handlePTTWhileAgentSpeaking = () => {
  conversation.setMicMuted(false);     // Active le micro
  // L'interruption est gérée nativement si "interruptions: enabled"
  // L'agent s'arrête de parler et écoute
};
```

**Configuration backend** (dans `agent_types.py`) :
```python
# Activer les interruptions pour chaque type d'agent
agent_config = {
    "conversation_config": {
        "client_events": ["interruption"],  # ← Activer
        "turn": {
            "turn_timeout": 5,              # Timeout réduit pour PTT
            "mode": "turn_based"            # Au lieu de "auto"
        }
    }
}
```

### 3.3 Vitesse de Lecture Agent (x1, x1.5, x2, x3, x4)

**Contrainte** : L'API ConvAI ne supporte que 0.7–1.2x.

**Solutions possibles** :

| Approche | Faisabilité | Qualité | Latence |
|----------|-------------|---------|---------|
| **A) Speed natif 0.7–1.2** | ✅ Trivial | ✅ Bonne | ✅ Zéro |
| **B) Client-side playback rate** | ✅ Faisable | ⚠️ Pitch altéré au-delà de x2 | ✅ Zéro |
| **C) Custom LLM + prompt "sois concis"** | ✅ Faisable | ✅ Bonne | ⬇️ Moins de tokens |
| **D) Hybrid : speed API + playback rate** | ✅ Recommandé | ✅ Bonne jusqu'à x2, ok x3 | ✅ Bon |

**Approche recommandée (D — Hybride)** :

```typescript
// Côté client : combiner speed API + playback rate
const SPEED_PRESETS = {
  '1x':   { apiSpeed: 1.0, playbackRate: 1.0 },
  '1.5x': { apiSpeed: 1.2, playbackRate: 1.25 },  // 1.2 × 1.25 = 1.5
  '2x':   { apiSpeed: 1.2, playbackRate: 1.67 },   // 1.2 × 1.67 ≈ 2.0
  '3x':   { apiSpeed: 1.2, playbackRate: 2.5 },    // 1.2 × 2.5 = 3.0
  '4x':   { apiSpeed: 1.2, playbackRate: 3.33 },   // 1.2 × 3.33 ≈ 4.0
};

// Pour le playback rate côté client (WebRTC audio)
// Option: intercepter l'audio stream et appliquer un playback rate
// Via AudioContext + playbackRate sur le MediaStream
```

**Alternative clean pour x2+ : Adapter le prompt**

Au-delà de x2, plutôt que déformer l'audio, on peut demander à l'agent d'être ultra-concis :

```python
# Injection dans le system prompt selon le speed choisi
CONCISENESS_PROMPTS = {
    "1x": "",
    "1.5x": "Sois concis dans tes réponses. Va à l'essentiel.",
    "2x": "Réponses ultra-courtes. Maximum 2 phrases. Bullet points si possible.",
    "3x": "Mode télégraphique. Mots-clés uniquement. Pas de phrases complètes.",
    "4x": "Un mot ou deux maximum par point. Style: titre de slide."
}
```

### 3.4 Recherche Web en Live (Tool Use)

**Problème** : L'utilisateur dit "va chercher des infos sur X" → l'agent doit pouvoir faire une recherche et revenir avec le résultat.

**Solution : Server Tools + Backend DeepSight**

L'agent ElevenLabs peut appeler des **Server Tools** (webhooks HTTP) pendant la conversation. On peut ajouter un outil de recherche web :

```python
# backend/src/voice/tools.py — NOUVEAU TOOL

async def web_search(query: str, user_id: int) -> str:
    """
    Tool appelé par l'agent ElevenLabs pour faire une recherche web.
    Utilise Brave Search (déjà intégré dans DeepSight pour le fact-check).
    """
    from backend.src.core.config import settings
    import httpx
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"X-Subscription-Token": settings.BRAVE_SEARCH_API_KEY},
            params={"q": query, "count": 5}
        )
        results = response.json().get("web", {}).get("results", [])
        
    # Formatter pour réponse vocale (concis)
    formatted = []
    for r in results[:3]:
        formatted.append(f"• {r['title']}: {r['description'][:150]}")
    
    return "\n".join(formatted) if formatted else "Aucun résultat trouvé."
```

**Configuration webhook dans ElevenLabs** :

```python
# Dans agent_types.py — ajouter le tool à chaque agent
WEB_SEARCH_TOOL = {
    "type": "webhook",
    "name": "web_search",
    "description": "Recherche sur le web pour trouver des informations actuelles. Utilise quand l'utilisateur demande de chercher quelque chose, de vérifier une info, ou de trouver des sources.",
    "api_schema": {
        "url": "https://api.deepsightsynthesis.com/api/voice/tool/web-search",
        "method": "POST",
        "headers": {"Authorization": "Bearer {{auth_token}}"},
        "request_body": {
            "query": {"type": "string", "description": "La requête de recherche"},
            "language": {"type": "string", "description": "Langue (fr/en)", "default": "fr"}
        }
    }
}
```

**Autres tools à ajouter** :

| Tool | Description | Endpoint |
|------|-------------|----------|
| `web_search` | Recherche web via Brave Search | `/api/voice/tool/web-search` |
| `deep_research` | Recherche approfondie via Perplexity AI | `/api/voice/tool/deep-research` |
| `academic_search` | Recherche papers via arXiv/Crossref | `/api/voice/tool/academic-search` |
| `compare_videos` | Comparer 2 vidéos analysées | `/api/voice/tool/compare` |
| `get_quiz_question` | Poser une question de quiz | `/api/voice/tool/quiz` |
| `check_fact` | Fact-check une affirmation | `/api/voice/tool/fact-check` |

**Tool Call Sounds** : Pendant que l'agent exécute un tool (recherche web = ~1-3s), jouer un son ambient ("bip de recherche") pour que l'user sache qu'il se passe quelque chose.

### 3.5 Options de Paramétrage Avancées

Toutes les options qu'on peut exposer à l'utilisateur :

| Catégorie | Option | Valeurs | Défaut |
|-----------|--------|---------|--------|
| **Voix** | Voice ID | Catalogue ElevenLabs | DeepSight default |
| **Voix** | Expressive Mode | on/off | on |
| **Voix** | Stability | 0–1 | 0.5 |
| **Voix** | Similarity Boost | 0–1 | 0.75 |
| **Voix** | Style | 0–1 | 0 |
| **Voix** | Speaker Boost | on/off | off |
| **Vitesse** | Speed Preset | 1x / 1.5x / 2x / 3x / 4x | 1x |
| **Conversation** | Turn Eagerness | eager / normal / patient | normal |
| **Conversation** | Turn Timeout | 1–30s | 5s |
| **Conversation** | Soft Timeout | off / 0.5–8.0s | off |
| **Conversation** | Interruptions | on/off | on |
| **Input** | Mode | Push-to-Talk / Voix libre (VAD) | PTT |
| **Input** | Texte | on/off (envoyer du texte en plus de la voix) | on |
| **Agent** | Type | Explorer / Tutor / Quiz / Debate / Onboarding | Explorer |
| **Agent** | Langue | FR / EN / Auto | Auto |
| **Agent** | Concision | Normal / Concis / Télégraphique | Normal |
| **Tools** | Web Search | on/off | on (Pro+) |
| **Tools** | Academic Search | on/off | on (Expert) |
| **Tools** | Fact-Check | on/off | on (Pro+) |
| **Audio** | Volume sortie | 0–100% | 80% |
| **Audio** | Tool Call Sounds | on/off | on |

---

## 4. SPEC TECHNIQUE — PLAN D'IMPLÉMENTATION

### Phase 1 : Push-to-Talk + Interruption (Priorité haute — Latence)

**Frontend** (`useVoiceChat.ts` + nouveau `VoicePTTButton.tsx`)

```
Fichiers à modifier :
├── frontend/src/components/voice/useVoiceChat.ts    — Ajouter mode PTT
├── frontend/src/components/voice/VoiceModal.tsx      — UI bouton PTT
├── frontend/src/components/voice/VoicePTTButton.tsx  — NOUVEAU composant PTT
├── frontend/src/components/voice/VoiceSettings.tsx   — Toggle PTT/VAD
└── backend/src/voice/elevenlabs.py                   — Config interruptions
```

**Implémentation clé** :

```typescript
// VoicePTTButton.tsx — Bouton Push-to-Talk
// Long press = parle, release = agent répond
// Tap pendant que l'agent parle = interruption

interface PTTState {
  mode: 'ptt' | 'vad';          // Push-to-Talk ou Voice Activity Detection
  isPressed: boolean;
  isAgentSpeaking: boolean;
}

// Gestion des événements tactiles/souris
onPointerDown → setMicMuted(false) + sendUserActivity()
onPointerUp   → setMicMuted(true)
```

**Gain latence estimé** : 200–500ms (suppression du délai VAD de fin de parole)

### Phase 2 : Speed Control Avancé

```
Fichiers à modifier :
├── frontend/src/components/voice/VoiceSettings.tsx    — UI speed presets
├── frontend/src/components/voice/useVoiceChat.ts      — Appliquer speed
├── frontend/src/services/tts.ts                       — Speed presets unifiés
├── backend/src/voice/elevenlabs.py                    — Speed dans config agent
├── backend/src/voice/preferences.py                   — Stocker le preset
└── backend/src/voice/schemas.py                       — Schema speed preset
```

**Stratégie** :
1. Speeds 0.7x–1.2x : Utiliser le paramètre natif `conversation_config.tts.speed`
2. Speeds 1.5x–2x : Speed natif 1.2x + playback rate côté client
3. Speeds 3x–4x : Speed natif 1.2x + playback rate + prompt de concision
4. Le tout combiné avec l'adaptation du system prompt

### Phase 3 : Web Search + Tools Avancés

```
Fichiers à créer/modifier :
├── backend/src/voice/tools.py              — Ajouter web_search, deep_research, etc.
├── backend/src/voice/router.py             — Endpoints pour les tools webhook
├── backend/src/voice/agent_types.py        — Enregistrer les nouveaux tools
├── frontend/src/components/voice/VoiceModal.tsx — UI indicateur "recherche en cours"
└── frontend/src/components/voice/VoiceToolIndicator.tsx — NOUVEAU
```

**Architecture** :

```
User dit "cherche des infos sur X"
  → ElevenLabs détecte l'intent
  → Appelle POST /api/voice/tool/web-search {query: "X"}
  → Backend utilise Brave Search API (déjà intégré)
  → Retourne les résultats formatés pour voix
  → Agent lit les résultats à l'utilisateur
  
Pendant l'exécution :
  → Client reçoit un event "tool_call_started"
  → Affiche un indicateur visuel + son ambient
  → Agent dit "Je cherche..." (via soft timeout ou prompt)
```

### Phase 4 : Paramètres Avancés UI

```
Fichiers à créer/modifier :
├── frontend/src/components/voice/VoiceSettings.tsx       — Refonte complète
├── frontend/src/components/voice/VoiceAdvancedPanel.tsx   — NOUVEAU
├── backend/src/voice/preferences.py                       — Étendre le schema
├── backend/src/voice/schemas.py                           — Nouveaux champs
└── backend/src/voice/elevenlabs.py                        — Appliquer les params
```

### Phase 5 : Custom LLM (Mistral) — Optionnel

**Opportunité** : Remplacer le LLM par défaut d'ElevenLabs par Mistral (déjà utilisé par DeepSight).

**Avantages** :
- Cohérence des réponses avec le reste de l'app
- Contrôle total sur le modèle et les prompts
- Pas de dépendance au LLM d'ElevenLabs (coût potentiel)

**Risques** :
- Latence réseau supplémentaire (ElevenLabs → votre serveur → Mistral → retour)
- Complexité de maintenance
- Mistral API doit supporter le streaming SSE format OpenAI

**Recommandation** : Tester d'abord avec le LLM intégré ElevenLabs, puis évaluer si le switch Mistral apporte une réelle valeur.

---

## 5. PRIORISATION & EFFORT

| Phase | Feature | Effort | Impact latence | Impact UX |
|-------|---------|--------|----------------|-----------|
| **1** | Push-to-Talk + Interruption | 2-3 jours | ⬇️⬇️⬇️ Fort | ⬆️⬆️⬆️ Critique |
| **2** | Speed Control (x1–x4) | 1-2 jours | ⬇️ Moyen | ⬆️⬆️ Fort |
| **3** | Web Search + Tools | 3-4 jours | — Neutre | ⬆️⬆️⬆️ Critique |
| **4** | Paramètres avancés UI | 2-3 jours | ⬇️ Moyen | ⬆️⬆️ Fort |
| **5** | Custom LLM Mistral | 3-5 jours | ⬆️ Risque latence | ⬆️ Moyen |

**Total estimé** : 11–17 jours de développement

---

## 6. RECOMMANDATIONS LATENCE

Au-delà du Push-to-Talk, voici les leviers pour réduire la latence globale :

1. **Activer Expressive Mode (v3 Conversational)** — Même latence, meilleure qualité de turn-taking
2. **Turn Eagerness = "eager"** — L'agent répond plus vite (attention aux faux positifs)
3. **Soft Timeout = 1.5s** — Filler "Hmm..." pendant la réflexion → perception de latence réduite
4. **Buffer Words** (si custom LLM) — "... " envoyé en début de stream → TTS commence plus tôt
5. **RAG optimisé** — ElevenLabs a réduit le RAG à 155ms médian
6. **WebRTC** (pas WebSocket) — Moins de latence audio que le WebSocket
7. **Prompts concis** — Moins de tokens = réponse LLM plus rapide = TTS plus rapide

---

## 7. SOURCES

- [ElevenLabs Conversational AI Platform](https://elevenlabs.io/conversational-ai)
- [Conversation Flow Documentation](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)
- [Speed Control](https://elevenlabs.io/docs/eleven-agents/customization/voice/speed-control)
- [Tools Overview](https://elevenlabs.io/docs/eleven-agents/customization/tools)
- [Server Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools)
- [Client Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/client-tools)
- [MCP Integration](https://elevenlabs.io/docs/eleven-agents/customization/tools/mcp)
- [Custom LLM Integration](https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm)
- [Expressive Mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)
- [Skip Turn Tool](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/skip-turn)
- [JavaScript SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script)
- [Latency Optimization Blog](https://elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai)
- [Conversational AI 2.0 Announcement](https://elevenlabs.io/blog/conversational-ai-2-0)
- [Guardrails 2.0](https://elevenlabs.io/blog/guardrails)
- [RAG Engineering (50% faster)](https://elevenlabs.io/blog/engineering-rag)
- [ElevenLabs Agents Platform](https://elevenlabs.io/docs/eleven-agents/overview)
- [GitHub — ElevenLabs Packages SDK](https://github.com/elevenlabs/packages)

---

*Document généré le 11 avril 2026 — DeepSight Voice Agent Upgrade Research*
