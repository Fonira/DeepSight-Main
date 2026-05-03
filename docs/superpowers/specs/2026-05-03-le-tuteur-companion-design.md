# Le Tuteur (Companion conversationnel) — Design

**Date** : 2026-05-03
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Brainstorm session 2026-05-03 (Opus 4.7, brainstorming skill)

## Contexte et problème

DeepSight Web affiche aujourd'hui deux features ambient connectées au système d'analyse YouTube :

1. **`DidYouKnowCard`** (`frontend/src/components/DidYouKnowCard.tsx`) — petite card top-right qui affiche un concept rotatif. Sources : keywords extraits de l'historique d'analyses utilisateur via `/api/history/keywords` (avec définition Mistral + image fal.ai), fallback sur 50 mots fascinants par défaut (`frontend/src/data/defaultWords.ts`). Logique centralisée dans `LoadingWordContext` (rotation 70/30 historique/local, cache 5 min, biais centres d'intérêt user).
2. **`WhackAMoleToggle`** (`frontend/src/components/layout/Sidebar.tsx:304`) — toggle "Mode Quiz" + sub-tabs "Mode Classique" / "Mode Expert" qui activent un mini-jeu :
   - **Mode Classique** (`useWhackAMole.ts`) — une "taupe" apparaît à l'écran, l'user clique pour révéler une carte fact (`FactRevealCard.tsx`)
   - **Mode Expert** (alias `reverse`) — une image IA fal.ai s'affiche, l'user devine le concept (`ImageGuessCard.tsx`, fuzzy matching Levenshtein)

Ces features tournent en parallèle de la `StudyHubPage` (`/study`, route `/study/:summaryId`) qui héberge un système Study/SRS bien plus avancé : FSRS algorithm, gamification (XP, streaks, badges), `DailySessionCard`, `MasteryRing`, `HeatMap`, `BadgeGrid`. Mais la `StudyHubPage` ne couvre que les flashcards générées par-vidéo, pas les concepts/keywords.

**Conséquence** : trois silos d'apprentissage déconnectés sur le dashboard. Le widget passif est joli mais peu utilisé. Le mini-jeu WhackAMole est ludique mais distrayant et la "valeur produit" reste floue (qu'est-ce que ça fait gagner à l'user ?). Le système Study sérieux est isolé sur sa propre page.

L'utilisateur a écarté plusieurs pistes pendant le brainstorm :

- **Refonte complète de la `StudyHubPage`** — trop ambitieux, hors scope V1
- **Gamification type Duolingo** — pas aligné avec le positionnement DeepSight (sérieux, pro, IA française)
- **Sidebar en parallèle du widget** — doublon, deux features qui font la même chose
- **Extension/mobile dès V1** — disperser le scope, web first

Le brainstorming a verrouillé une vision : **remplacer le widget passif `DidYouKnowCard` par un Tuteur conversationnel sobre**, branché sur l'historique de concepts, avec dialogue IA centrale (Magistral texte + Voxtral voix). Le toggle Mode Quiz et le système WhackAMole disparaissent.

## Objectifs

1. **Élever la valeur produit** du widget ambient : passer de "joli rotateur de définitions" à "vraiment apprendre & retenir"
2. **IA conversationnelle centrale** — l'expérience principale EST un dialogue avec le Tuteur, pas un quiz binaire ni un clic-pour-révéler
3. **Sobre & professionnel** — pas de gamification gimmick, ton respectueux, aligné positionnement DeepSight (Mistral 100% FR/EU, sérieux)
4. **Réutilisation maximale de l'infra existante** — `LoadingWordContext` source des concepts, infra Voice (Voxtral STT + ElevenLabs TTS) déjà en prod, Magistral chat v4
5. **Scope serré V1** — web only, pas de SRS étendu aux concepts (rotation simple), pas de nouvelle table DB lourde

## Décisions verrouillées

| #   | Décision                            | Choix retenu                                                                                                                                                       |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Objectif produit                    | **Vraiment apprendre & retenir** les concepts vus dans les vidéos analysées                                                                                        |
| 2   | Angle dominant                      | **Sérieux + IA conversationnelle + touche ludique** (mix sobre Anki + compagnon Voxtral + un peu mini-jeux)                                                        |
| 3   | Place de l'IA                       | **Centrale** — l'expérience EST le dialogue (Voxtral voix + Magistral texte)                                                                                       |
| 4   | Approche                            | **Refonte du widget en compagnon conversationnel** — pas de page dédiée, pas de refonte StudyHubPage                                                               |
| 5   | Persona tuteur                      | **Sobre & professionnel** — vouvoiement ou tutoiement adulte neutre, citations académiques, "Voyons ensemble...", appellation "Tuteur" (pas de nom propre)         |
| 6   | Proactivité                         | **Discret — jamais d'initiative IA**. State `prompting` requalifié en intermédiaire de mode-selection après click manuel.                                          |
| 7   | Périmètre plateforme V1             | **Web only**. Mobile + Extension → V2                                                                                                                              |
| 8   | SRS sur concepts                    | **Hors scope V1** — rotation simple recency/historique comme aujourd'hui. V2 → table `concept_review_state` FSRS-compatible                                        |
| 9   | Suppressions                        | `WhackAMoleToggle`, components `WhackAMole/*`, hook `useWhackAMole`. Le toggle "Mode Quiz" disparaît de la sidebar.                                                 |
| 10  | Inchangé                            | `StudyHubPage` (`/study`), `LoadingWordContext`, FSRS sur flashcards par-vidéo, `StudyPage` (`/study/:summaryId`), gamification existante                          |
| 11  | LLM                                 | **Magistral** (medium pour Pro, large pour Expert). System prompt fixe V1, persona "Tuteur DeepSight"                                                              |
| 12  | Voix                                | **Voxtral STT** (input user) + **ElevenLabs TTS** (output) — réutilise infra Quick Voice Call déjà en prod                                                         |
| 13  | Sous-agents implémentation          | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`) pour tout sub-agent Agent/Task                                                                                    |

## Architecture macro

```
┌─────────────────────────┐       ┌──────────────────────────┐       ┌──────────────────────┐
│ Companion.tsx (refonte) │       │ Backend FastAPI          │       │ Mistral / Voxtral    │
│ — top-right ambient     │       │ /api/companion/*         │       │ ElevenLabs           │
└──────────┬──────────────┘       └───────────┬──────────────┘       └──────────┬───────────┘
           │                                   │                                  │
   ❶ User click "Dialoguer"                    │                                  │
           │──── POST /session/start ─────────▶│                                  │
           │     { concept, summary_id?,       │                                  │
           │       mode: text|voice, lang }    │                                  │
           │                                   │── system prompt + 1er message ──▶│
           │                                   │◀──── prompt Socratique ──────────│
           │◀──── { session_id, prompt } ──────│                                  │
           │                                   │                                  │
   ❷ User répond (texte ou audio)              │                                  │
           │──── POST /session/{id}/turn ─────▶│                                  │
           │     { user_input, audio_blob? }   │                                  │
           │                                   │── Voxtral STT (si audio) ───────▶│
           │                                   │◀── transcription ────────────────│
           │                                   │── Magistral chat ──────────────▶ │
           │                                   │◀── ai_response ─────────────────│
           │                                   │── ElevenLabs TTS (si voice) ───▶│
           │                                   │◀── audio_url ────────────────────│
           │◀── { ai_response, audio_url? } ───│                                  │
           │                                   │                                  │
   ❸ User ferme / "Fin"                        │                                  │
           │──── POST /session/{id}/end ──────▶│                                  │
           │                                   │── log analytics ─────────────────│
           │◀── { duration, turns, source_url? }│                                  │
```

## Composant frontend : `Companion.tsx`

Remplace `DidYouKnowCard.tsx`. State machine à 4 états avec transitions toutes manuelles (pas de transitions automatiques côté UI hors fin de session).

### State machine

```
                  ┌────────┐
                  │  IDLE  │ ◀── (par défaut, ambient discret)
                  └────┬───┘
                       │ user click sur le widget
                       ▼
                ┌──────────────┐
                │  PROMPTING   │ ── (mode selector : Texte/Voix, durée estimée)
                └─┬──────────┬─┘
            mode=text     mode=voice
                  │          │
                  ▼          ▼
           ┌──────────┐   ┌──────────────┐
           │ MINI-CHAT│ ─▶│ DEEP SESSION │
           └────┬─────┘   └──────┬───────┘
                │                 │
            user "Approfondir"    │
                │                 │
                ▼                 ▼
              return to IDLE on close/end
```

### États détaillés

| State          | Layout                                                       | Contenu                                                                                                                | Trigger out                                       |
| -------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `idle`         | Card top-right 200×140                                       | Concept actuel (term + short def) + spinner cosmic actuel + boutons next/refresh/close                                 | Click sur le widget → `prompting`                 |
| `prompting`    | Card top-right 220×180                                       | "**Rasoir d'Occam** — On en parle ?" + 2 boutons mode (`Texte 30s` / `Voix 5min`) + bouton retour                      | Click mode → `mini-chat` ou `deep-session`        |
| `mini-chat`    | Card top-right 280×400 (panel expansé)                       | Header + thread messages (msg-ai / msg-user) + input texte + bouton mic + bouton "Approfondir" + bouton fermer         | Click "Approfondir" → `deep-session` ; X → `idle` |
| `deep-session` | Modal fullscreen                                             | Header (concept + timer) + voice orb pulsante + transcript live + boutons Pause / Texte / Fin + lien analyse source    | Click "Fin" / Échap → `idle`                      |

### Hook `useCompanion`

- Reducer state machine (4 phases) — pattern repris de `useWhackAMole.ts` actuel
- Persistance localStorage : préférence mode (text/voice) par défaut, son ON/OFF, masquage widget
- Lecture concepts via `useLoadingWord()` (zéro changement à `LoadingWordContext`)
- API client : `companionApi` dans `services/api.ts` (3 endpoints, mirrors mobile API si V2 mobile arrive plus tard)

## Backend : router `/api/companion/`

Nouveau module `backend/src/companion/` :

```
companion/
├── __init__.py
├── router.py          # 3 endpoints + persona system prompt
├── schemas.py         # Pydantic v2 — SessionStart, SessionTurn, SessionEnd
├── service.py         # Orchestration Magistral/Voxtral/ElevenLabs + session state Redis
└── prompts.py         # System prompt template "Tuteur DeepSight"
```

### Endpoints

| Méthode | Route                                | Body                                                                       | Réponse                                                                       |
| ------- | ------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST    | `/api/companion/session/start`       | `{ concept_term, concept_def, summary_id?, mode: "text"\|"voice", lang }` | `{ session_id, first_prompt, audio_url? }`                                    |
| POST    | `/api/companion/session/{id}/turn`   | `{ user_input?, audio_blob? }`                                             | `{ ai_response, audio_url?, turn_count }`                                     |
| POST    | `/api/companion/session/{id}/end`    | `{}`                                                                       | `{ duration_sec, turns_count, source_summary_url?, source_video_title? }`    |

### Session state (Redis)

Pas de table SQL pour V1 — sessions stockées en Redis avec TTL 1h :

- Clé : `companion:session:{session_id}` → JSON `{ user_id, concept_term, mode, lang, started_at, turns: [...], persona_version }`
- Clé : `companion:session:{user_id}:active` → `session_id` (pour empêcher 2 sessions concurrentes par user)

### Quotas et plan gating

- **Free** : pas d'accès → CTA upgrade
- **Pro** : Magistral medium, voix Voxtral autorisée, 30 min/mois total (partage du quota voice existant)
- **Expert** : Magistral large, voix illimitée (dans le quota voice existant)

Réutilise `is_feature_available(plan, "companion_dialogue", platform="web")` du SSOT.

## Persona du Tuteur (system prompt template V1)

```
Tu es le Tuteur intellectuel de l'utilisateur de DeepSight, plateforme française d'analyse de vidéos YouTube.
Ton rôle : aider l'utilisateur à approfondir un concept qu'il a rencontré dans ses analyses récentes.

PRINCIPES :
- Ton sobre, professionnel, respectueux du temps de l'utilisateur
- Vouvoiement par défaut (ou tutoiement neutre si l'utilisateur l'utilise)
- Pose des questions ouvertes qui font réfléchir, ne donne pas tout de suite la réponse
- Si l'utilisateur dit "je ne sais pas", reformule plus simplement, ne juge jamais
- Cite l'origine du concept si pertinent ("Vous l'avez croisé dans votre analyse de [video_title]")
- Sois concis : réponses courtes (2-3 phrases), favorise le dialogue
- Si la session dépasse 5 min sans que l'utilisateur progresse, propose de "passer à autre chose"
- Pas de gimmick, pas d'emoji excessif, pas de "Bravo !" inutile

CONCEPT EN COURS : {concept_term}
DÉFINITION DE RÉFÉRENCE : {concept_def}
SOURCE (si dispo) : analyse vidéo "{source_video_title}" du {source_date}
LANGUE DE L'UTILISATEUR : {lang}

PREMIER MESSAGE :
Pose une question ouverte qui invite l'utilisateur à formuler le concept avec ses propres mots,
ou à appliquer le concept à un cas concret.
```

## Data flow détaillé

1. **IDLE** : `Companion.tsx` mount → `useLoadingWord()` fournit `currentWord`. Affichage passif. Aucun appel backend.
2. **Click sur widget** → state passe à `PROMPTING`. UI affiche les 2 boutons mode (Texte / Voix). Aucun appel backend.
3. **Click mode** :
   - State passe à `MINI-CHAT` (text) ou `DEEP-SESSION` (voice)
   - `companionApi.sessionStart({ concept_term: currentWord.term, concept_def: currentWord.definition, summary_id: currentWord.summaryId, mode, lang })`
   - Backend : crée session Redis, génère 1er prompt via Magistral, retourne `{ session_id, first_prompt, audio_url? }`
   - Frontend affiche le prompt (texte) + joue audio (voix mode)
4. **User répond** (texte input ou audio enregistrement) :
   - `companionApi.sessionTurn(session_id, { user_input?, audio_blob? })`
   - Backend : si audio → Voxtral STT ; append au context Magistral ; appelle Magistral ; si voice mode → ElevenLabs TTS
   - Retour `{ ai_response, audio_url? }`
5. **User clique "Approfondir"** depuis MINI-CHAT → state → DEEP-SESSION (même session, juste UI fullscreen + active voix)
6. **User clique "Fin" ou ferme la modal** :
   - `companionApi.sessionEnd(session_id)`
   - Backend : log analytics (events table), supprime session Redis, retourne durée + lien analyse source
   - Frontend : retour IDLE, affiche brève notif "Session terminée" + bouton "Voir l'analyse" si `source_summary_url`

## Réutilisation existant (zéro refonte sur ces briques)

| Brique                                                  | Rôle dans le Tuteur                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `LoadingWordContext`                                    | Source des concepts (historique user + 50 defaults)                                  |
| `/api/history/keywords` (existant)                      | Backend keyword extraction Mistral                                                   |
| Pipeline image IA fal.ai                                | Image éventuelle dans deep-session (background décoratif)                            |
| Voxtral STT (existant `/api/voice/*`)                   | Transcription de l'input user en mode voix                                           |
| ElevenLabs TTS (existant — Quick Voice Call en prod)    | Synthèse vocale du tuteur en mode voix                                               |
| Chat v4 Magistral (existant `/api/chat/*`)              | Référence d'implémentation pour le streaming SSE et l'enrichissement                 |
| `is_feature_available()` SSOT plan_limits               | Plan gating Pro/Expert                                                               |
| Voice quota existant (`VoiceQuota` table)               | Compteur des minutes voix consommées                                                 |
| Sentry / analytics                                      | Tracking erreurs et événements session                                               |

## Suppressions (la "remplacement" du Mode Quiz)

| Fichier / brique                                                          | Action                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `frontend/src/components/DidYouKnowCard.tsx`                              | **Supprimé** — remplacé par `Companion.tsx`             |
| `frontend/src/components/WhackAMole/` (tout le dossier)                   | **Archivé** dans `_archive/WhackAMole/` pour V2         |
| `frontend/src/components/WhackAMole/useWhackAMole.ts`                     | **Archivé** (renaîtra en V2 Mode Défi optionnel)        |
| `frontend/src/components/WhackAMole/whackAMoleConstants.ts`               | **Archivé**                                             |
| `frontend/src/components/layout/Sidebar.tsx` — `WhackAMoleToggle` (l.304) | **Supprimé** du composant Sidebar                        |
| `frontend/src/i18n/{fr,en}.json` — clés `dashboard.modes.{quiz,classic,expert}` | **Supprimées** ou réutilisées pour le Tuteur si pertinent |

## Migrations DB

**V1 : aucune migration**. Les sessions sont en Redis (TTL 1h), les analytics passent par la table `AnalyticsEvent` existante.

**V2 envisagée** (hors scope ici) : table `concept_review_state` FSRS-compatible pour étendre le SRS aux concepts/keywords.

## Tests

- **Unit (backend)** : `tests/test_companion_router.py` — 3 endpoints happy path + erreur (concept manquant, plan free, session expired)
- **Unit (frontend)** : `Companion.test.tsx` — state machine transitions (idle→prompting→mini-chat→deep→idle), API mock
- **E2E (Playwright)** : `e2e/companion.spec.ts` — flow complet text mode (start → 2 turns → end) ; flow voice mode est mocké côté audio
- **Manual** : QA de la qualité Magistral en sobre & pro avec 5 concepts variés

## Risks & open questions

| Risque                                                                        | Mitigation                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Magistral génère un dialogue creux ou trop long                               | Few-shot dans system prompt + max_tokens serré (300) + safeguards "réponse 2-3 phrases"                 |
| Voxtral STT mauvaise qualité sur accents francophones                         | Fallback texte toujours dispo + bouton "réessayer" sur turn raté                                        |
| User lance une session voix dans un environnement public et est embarrassé    | State PROMPTING force le choix Texte/Voix avant — pas de "voice par défaut surprise"                    |
| Perte de session sur reload de page                                           | localStorage avec `session_id` actif + endpoint `/session/{id}/resume` (V1.1 si nécessaire)             |
| Coût Magistral large (Expert) si user enchaîne 100 sessions/mois              | Quota voice existant capot ; ajouter compteur `companion_turns_per_month` si abus observé               |
| Confusion avec le "Coach Vocal de Découverte" (autre feature) déjà speccé     | UX : le Coach Vocal est dans la sidebar (onglet dédié), le Tuteur est ambient widget — rôles distincts  |

**Open questions** :
- Faut-il bloquer le widget Tuteur sur certaines pages où il est gênant (page d'analyse en cours, billing, settings) ? → **À trancher en review.**
- Persona V1 fixe ou personnalisable plus tôt (ex: réglage ton dans Settings) ? → **V2.**
- Faut-il logger les transcripts pour analyse qualité ? → **Oui, anonymisés, retention 30j.** À confirmer en review RGPD.

## V2+ roadmap (hors scope ce spec)

- **SRS étendu aux concepts** (table `concept_review_state` FSRS-compatible, daily push intelligent)
- **Mobile lite** : Mode Texte uniquement, pas de fullscreen modal mais bottom-sheet
- **Extension Chrome** : CTA "Ouvrir dans l'app" (cohérent doctrine extension = hameçon)
- **Mode Défi** : renaissance du WhackAMole comme option dans le widget (un mode parmi text/voice/défi)
- **Multi-tuteurs** : Socrate / Mentor scientifique / etc. — sélectionnable
- **Personnalité avatar évolutif** : visuel + ton qui s'adaptent à l'historique user
- **Mémoire cross-session** : table `companion_memory` (analogie avec Coach Vocal)
- **Knowledge graph** : visualisation des concepts maîtrisés et de leurs liens

## Références

- Brainstorm session 2026-05-03 (cette spec)
- Spec connexe `2026-04-28-coach-vocal-decouverte-design.md` (Coach Vocal — feature ≠ mais infra partagée)
- Spec connexe `2026-04-26-quick-voice-call-design.md` (Quick Voice Call — infra Voxtral/ElevenLabs en prod)
- Code actuel : `frontend/src/components/DidYouKnowCard.tsx`, `frontend/src/components/WhackAMole/*`, `frontend/src/contexts/LoadingWordContext.tsx`, `frontend/src/components/layout/Sidebar.tsx:304`
- Backend : `backend/src/study/router.py` (FSRS reference), `backend/src/voice/`, `backend/src/chat/router.py`
