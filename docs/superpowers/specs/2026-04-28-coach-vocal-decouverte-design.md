# Coach Vocal de Découverte — Design

**Date** : 2026-04-28
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Brainstorm session 2026-04-28 (Opus 4.7, mode caveman lite)

## Contexte et problème

Un onglet **« Appel Vocal »** a été ajouté à la sidebar gauche du frontend web. Il connecte à l'agent voice ElevenLabs `COMPANION` (`summary_id=None`, `ELEVENLABS_COMPANION_VOICE_ID`). L'agent fonctionne techniquement — la session démarre, l'audio bidir marche — mais il n'a **aucun contexte** sur l'utilisateur. L'agent ne sait ni qui il appelle, ni ce qui l'intéresse, ni quelles vidéos il a déjà analysées.

Conséquence : la conversation est générique, l'agent improvise sur le vide, et la feature ne sert à rien sur le plan produit. Pas de raison de revenir.

L'utilisateur a écarté deux pistes :

- **Tout dump l'historique** dans le system prompt — volume trop gros
- **Pas de contexte du tout** — état actuel inutile

Le brainstorming a verrouillé un rôle produit clair : **coach de découverte vocal**, qui pousse des nouvelles vidéos YouTube basées sur les centres d'intérêt de l'utilisateur, avec capacité à lancer une analyse depuis l'appel.

## Objectifs

1. **Activer un usage réel** de l'onglet Appel Vocal — passer de "marche mais sert à rien" à "raison de revenir hebdo"
2. **Levier d'engagement** : conversion vocale → analyse réelle pendant l'appel (tool `start_analysis`)
3. **Personnalisation forte** dès la première seconde — l'agent salue par prénom, mentionne une analyse récente
4. **Réutiliser les fondations existantes** : agent COMPANION, VoiceQuota Pro, Tournesol proxy, Trending Redis pre-cache, TranscriptEmbedding

## Décisions verrouillées

| #   | Décision                   | Choix retenu                                                                                   |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Rôle agent                 | **Coach de découverte (recos)** — curator vocal personnalisé                                   |
| 2   | Capacité actionnable       | **Actionnable + conversationnel** — tools `start_analysis` + `get_more_recos`                  |
| 3   | Sources de recos           | **4 sources combinées** : Historique+similarité, Trending DeepSight, Tournesol, YouTube Search |
| 4   | Quotas                     | **Voice quota Pro existante** (45 min/mois). Free/Plus → CTA upgrade                           |
| 5   | Extraction top 3 thèmes    | **Mistral small** sur 30 derniers titres analysés. Cache Redis 1h                              |
| 6   | Liberté agent              | Peut sauter le briefing 3 recos pré-fetch si l'user demande un sujet précis dès l'ouverture    |
| 7   | Mémoire cross-session      | **Hors-scope V1** — chaque appel from scratch. V2 → table `companion_memory`                   |
| 8   | Sous-agents implémentation | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`)                                               |

## Architecture macro

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────────┐
│ Sidebar onglet   │        │ Backend FastAPI  │        │ ElevenLabs ConvAI    │
│ "Appel Vocal"    │        │ /api/voice/*     │        │ COMPANION agent      │
└────────┬─────────┘        └────────┬─────────┘        └──────────┬───────────┘
         │                           │                             │
   ❶ Click "Appeler"                 │                             │
         │── POST /companion-context ▶                             │
         │                           │ ❷ Build profil compact      │
         │                           │   + 3 recos pré-fetch        │
         │                           │   (Mistral small + Redis     │
         │                           │    + Tournesol + Trending)   │
         │                           │                             │
         │── POST /voice/session ───▶│                             │
         │   (agent_type=companion,  │ ❸ system prompt enrichi     │
         │    summary_id=null)       │   avec profil + recos        │
         │                           │                             │
         │   {signed_url, jwt}       │                             │
         │◀──────────────────────────│                             │
         │                                                         │
         │── ❹ ElevenLabs WS ─────────────────── audio bidir ──────│
         │                                                         │
         │                           │   ❺ Webhook tools           │
         │                           │◀── get_more_recos(topic) ───│
         │                           │── recos JSON ──────────────▶│
         │                           │                             │
         │                           │◀── start_analysis(url) ─────│
         │                           │── summary_id ──────────────▶│
         │                           │   (analyse en bg)           │
```

## Spec backend

### a. Endpoint `/api/voice/companion-context`

**Fichier nouveau** : `backend/src/voice/companion_context.py`

```python
@router.get("/companion-context")
async def get_companion_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompanionContextResponse:
    """
    Build profil compact + 3 recos pré-fetch pour COMPANION agent.
    Cache Redis 1h par user_id.
    """
```

**Réponse** :

```python
class CompanionContextResponse(BaseModel):
    profile: ProfileBlock          # ~600 tokens
    initial_recos: list[RecoItem]  # 3 items pré-fetchés
    cache_hit: bool                # debug
```

**Pipeline** :

1. **Profil compact** :
   - Fetch User (prenom, plan, langue, created_at)
   - Count `Summary` total
   - Fetch top 5 derniers `Summary` (titre, video_id, created_at, category)
   - Fetch UserStudyStats (streak, flashcards_due_today)
   - Format texte ~600 tokens

2. **Top 3 thèmes** (Mistral small) :
   - Fetch les 30 derniers titres `Summary.title` user
   - Si `Summary.category` populé pour > 70% des items → **fallback no-LLM** : top 3 catégories par count
   - Sinon → Mistral small avec prompt :
     ```
     Voici les 30 derniers titres de vidéos analysées par cet utilisateur.
     Identifie ses 3 centres d'intérêt principaux. Réponds en JSON :
     {"themes": ["theme1", "theme2", "theme3"]}
     ```
   - Cache Redis `companion_themes:{user_id}` TTL 3600s

3. **3 recos pré-fetch** (parallèle) :
   - **Reco 1 — Historique+similarité** : query `TranscriptEmbedding` similaires aux 5 dernières analyses, exclure video_ids déjà analysés, top 1
   - **Reco 2 — Trending DeepSight** : `trending_pre_cache` Redis sur thème#1, top 1
   - **Reco 3 — Tournesol** : proxy `/api/tournesol/recommendations` avec category mappée depuis thème#1, top 1
   - Si une source retourne vide → fallback YouTube Search avec query = thème#1

**Cache Redis global** : `companion_context:{user_id}` TTL 3600s (1h). Refresh forcé via param `?refresh=true`.

### b. System prompt COMPANION enrichi

**Fichier modifié** : `backend/src/voice/agent_types.py:513` (COMPANION AgentConfig)

Ajouter au `system_prompt` un bloc `{COMPANION_CONTEXT}` injecté au runtime :

```python
COMPANION_SYSTEM_PROMPT_TEMPLATE = """
Tu es DeepSight Companion, un coach de découverte vocal qui connaît {prenom}
et l'aide à explorer YouTube.

PROFIL UTILISATEUR
==================
{profile_block}

CENTRES D'INTÉRÊT
=================
{themes_block}

RECOMMANDATIONS PRÉ-PRÉPARÉES (à présenter sauf si l'user demande un sujet précis)
===============================================================================
{initial_recos_block}

INSTRUCTIONS
============
1. Salue {prenom} par prénom, mentionne brièvement une analyse récente pour montrer
   que tu connais ses sujets.
2. Si {prenom} demande directement un sujet précis dès l'ouverture → saute les
   3 recos pré-préparées, appelle directement get_more_recos(topic=...).
3. Sinon → présente les 3 recos avec leurs accroches personnalisées (« similaire à
   ton analyse X », « en ce moment ça cartonne », « top score Tournesol sur Y »).
4. Pour chaque reco proposée :
   - Si {prenom} dit oui → propose start_analysis(video_url) puis demande s'il
     veut continuer à discuter pendant l'analyse ou raccrocher.
   - Si non → demande pourquoi et adapte (plus court / plus de fond / autre angle)
     puis appelle get_more_recos.
5. Reste cool, pas pushy. Source brièvement chaque reco. Ton Tournesol-friendly.
6. Tant que tu n'as pas appelé get_more_recos, n'invente jamais de vidéos —
   utilise UNIQUEMENT les recos pré-préparées ci-dessus.
"""
```

**Injection runtime** : `voice/router.py` au `POST /api/voice/session` quand `agent_type=companion` → fetch companion-context puis format template.

### c. Tools webhook ConvAI

**Fichier modifié** : `backend/src/voice/router.py` (section `/tools/`)

#### Tool 1 — `get_more_recos`

```
POST /api/voice/tools/companion-recos
Body: {topic: str, source?: "history"|"tournesol"|"youtube"|"trending"}
Auth: webhook secret + conversation_token validation
```

**Logique** :

- Si `source` non fourni → chaîne fallback automatique : Historique+similarité → Tournesol → YouTube Search → Trending
- Retourne 3 recos max, format `{video_id, title, channel, duration, source, why}`
- Exclut les video_ids déjà analysés par l'user

#### Tool 2 — `start_analysis`

```
POST /api/voice/tools/start-analysis
Body: {video_url: str}
Auth: webhook secret + conversation_token validation
```

**Logique** :

- Valide URL YouTube
- Vérifie quota d'analyses du plan user (utilise `is_feature_available`)
- Lance `POST /api/videos/analyze` en background (mode `quick`)
- Retourne `{summary_id, status: "started", eta_seconds}`
- L'agent peut dire « C'est lancé, ETA ~2 min, on continue à discuter ? »

**Sécurité** : both tools doivent valider que la `conversation_id` ElevenLabs correspond à une `VoiceSession` active du user (anti-IDOR).

### d. Quota — pas de migration

Hérite de `VoiceQuota` Pro existante (45 min/mois). Free/Plus → l'endpoint `/companion-context` retourne 402 avec `upgrade_url`. Le frontend handle le CTA.

## Spec frontend

**État vérifié 2026-04-28** : l'onglet « Appel Vocal » sidebar **n'existe sur aucune branche Git** (ni `main`, ni `feat/voice-*`, ni `feature/quick-voice-call-v1`). `SidebarNav.tsx` contient uniquement Vidéo / Débat IA / Historique / Upgrade / Paramètres / Admin. Le mot « Appel vocal » apparaît seulement comme `callTitle` dans `VoiceOverlay.tsx:116` (modal de chat). **L'onglet est donc à créer dans cette spec** — c'est un livrable V1 et non un état existant.

### a. Page principale — `VoiceCallPage.tsx` (création)

Nouveau fichier : `frontend/src/pages/VoiceCallPage.tsx` (route `/voice-call`).

**Flux** :

1. Au mount → `api.getCompanionContext()` (nouveau call dans `services/api.ts`)
2. Affichage état loading avec ambiant light
3. Bouton « Appeler » → `useVoiceChat({ agentType: "companion", summaryId: null })` (hook existant)
4. UI pendant l'appel : transcript live, bouton raccrocher, micro état
5. Si tool `start_analysis` invoqué → toast « Analyse en cours... » + lien vers /history quand prête (via SSE notification existant)

### b. Sidebar — ajout item

Modifier `frontend/src/components/sidebar/SidebarNav.tsx` :

```tsx
import {
  Video,
  Swords,
  History,
  Phone,
  Gem,
  Settings,
  Crown,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: Video, label: "Vidéo" },
  { path: "/debate", icon: Swords, label: "Débat IA" },
  { path: "/voice-call", icon: Phone, label: "Appel Vocal" }, // ← NEW
  { path: "/history", icon: History, label: "Historique" },
  { path: "/upgrade", icon: Gem, label: "Upgrade" },
  { path: "/settings", icon: Settings, label: "Paramètres" },
];
```

Position entre « Débat IA » et « Historique » (proximité fonctionnelle voice ↔ contenu).

### c. Routes

`frontend/src/App.tsx` ou équivalent → nouvelle route lazy `<VoiceCallPage />` sur `/voice-call`.

### d. Feature gating

```typescript
if (!canAccess(user.plan, "voice_chat", "web")) {
  return <UpgradeCTA feature="voice_chat" />;
}
```

(Réutilise la matrice `planPrivileges.ts` existante.)

## Persona — détails

**Style vocal** : enthousiaste mesuré, curiosité sincère, sourçant ses suggestions sans en faire trop. Ton « ami curator » plutôt que « assistant marketing ». Phrases courtes pour respirer (output ElevenLabs).

**Phrase d'ouverture type** :

> « Salut Maxime, content de te retrouver. J'ai vu que t'as analysé [titre récent] — bien vu. Du coup j'ai trois pistes pour toi aujourd'hui, tu veux que je te raconte ou t'as un sujet précis en tête ? »

**Si reco refusée** :

> « OK, t'es plutôt sur quoi en ce moment ? Plus court, plus dense, autre sujet ? »

**Si reco acceptée** :

> « Cool, je te lance l'analyse. Ça prend environ deux minutes. On continue à parler ou tu préfères raccrocher pour aller la lire tranquille ? »

## Hors-scope V1

- ❌ **Mémoire cross-session** : chaque appel from scratch. V2 → table `companion_memory(user_id, summary_text, last_call_at)` mise à jour en post-call webhook avec résumé LLM des points clés.
- ❌ **Feedback loop explicite** : pas de système « j'aime / j'aime pas » qui ajuste futures recos. V2 → `companion_reco_feedback` table.
- ❌ **Tracking conversion** : pas de métrique « recos écoutées → analyses lancées ». V2 → champ `triggered_by=companion_session_id` sur Summary.
- ❌ **YouTube Search au pré-fetch** : utilisée uniquement en fallback du tool `get_more_recos`. Évite latence + coût quota YouTube au démarrage.
- ❌ **Mode mobile / extension** : V1 = web uniquement. Mobile/extension = roadmap V2/V3.

## Risques et mitigations

| Risque                                                            | Mitigation                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Latence pré-fetch (4 sources en parallèle)                        | `asyncio.gather` avec timeout 2s par source, fallback gracieux si une source timeout                                                           |
| Mistral small lent ou en panne                                    | Fallback no-LLM via `Summary.category` count si > 70% des items ont une catégorie                                                              |
| L'agent invente des vidéos (hallucination)                        | Instruction stricte dans system prompt + validation : l'agent ne peut référencer que les recos pré-fetchées ou retournées par `get_more_recos` |
| `start_analysis` lance trop d'analyses (abus)                     | Vérification quota plan + rate limit 3 analyses / appel vocal                                                                                  |
| Tournesol API down                                                | Skip silencieux, fallback Trending ou YouTube                                                                                                  |
| Cache Redis stale (user a analysé 10 vidéos depuis dernier cache) | Invalidation cache `companion_context:{user_id}` au `POST /api/videos/analyze` (hook)                                                          |

## Plan de tests

### Backend

- `test_companion_context.py` : profil format, top 3 thèmes (LLM + fallback category), recos pré-fetch (4 sources), cache hit/miss
- `test_companion_tools.py` : `get_more_recos` chaîne fallback, `start_analysis` quota check + rate limit, IDOR validation
- `test_companion_agent_prompt.py` : injection template, escape correct des champs user

### Frontend

- `VoiceCallPage.test.tsx` : rendu loading/error/connected, gating Free/Plus → CTA, intégration `useVoiceChat`

### E2E

- `voice-call.spec.ts` Playwright : login Pro user → /voice-call → bouton Appeler → mock ElevenLabs WS → vérif tool calls

### Manuel post-déploy

1. Login Pro → /voice-call → vérifier que l'agent salue par prénom + mentionne une analyse récente
2. Demander un sujet précis dès le début → vérifier que l'agent saute les 3 recos pré-fetch
3. Accepter une reco → vérifier que `start_analysis` lance bien une analyse visible dans /history
4. User Free → vérifier CTA upgrade

## Fichiers à créer / modifier — résumé

### Backend

- ➕ `backend/src/voice/companion_context.py` — build profil + recos
- ➕ `backend/src/voice/companion_recos.py` — orchestration des 4 sources
- 🔧 `backend/src/voice/router.py` — endpoint `/companion-context` + tools `/tools/companion-recos` + `/tools/start-analysis`
- 🔧 `backend/src/voice/agent_types.py:513` — system prompt COMPANION enrichi avec template
- ➕ `backend/tests/test_companion_*.py` — couverture tests

### Frontend

- ➕ `frontend/src/pages/VoiceCallPage.tsx` (ou équiv — **fichier à confirmer**)
- 🔧 `frontend/src/services/api.ts` — méthode `getCompanionContext()`
- 🔧 `frontend/src/components/sidebar/SidebarNav.tsx` — item « Appel Vocal » (si pas déjà fait)
- 🔧 `frontend/src/App.tsx` — route lazy `/voice-call`
- ➕ `frontend/src/pages/__tests__/VoiceCallPage.test.tsx`

### Pas de migration DB

Aucune. Hérite VoiceQuota Pro existante.

## Roadmap V2 (référence)

- Table `companion_memory` — résumé condensé des sessions passées, injecté dans system prompt
- Feedback loop `companion_reco_feedback` — apprentissage des préférences
- Tracking conversion `Summary.triggered_by` — métrique levier d'engagement
- Extension Chrome onglet vocal libre similaire (Side Panel)
- Mobile Expo onglet vocal libre

---

_Spec validée par brainstorm Opus 4.7 du 2026-04-28._
