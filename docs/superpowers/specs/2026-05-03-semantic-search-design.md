---
date: 2026-05-03
type: spec-design
scope: DeepSight tri-plateforme — Recherche sémantique globale + intra-analyse + tooltip IA
status: draft (en attente de review user)
branch: feat/semantic-search-v1
related:
  - backend/src/search/embedding_service.py (pipeline existant transcripts)
  - backend/src/search/router.py (POST /api/search/semantic existant)
  - PR #246-#252 (migration Mistral-First, mistral-embed v23.12)
  - docs/superpowers/specs/2026-05-03-hub-nav-redesign-design.md (architecture Hub web)
auteur: Claude Sonnet 4.6
---

# Spec — Semantic Search V1 (Web + Mobile + Extension)

## 1. Contexte

DeepSight a déjà un endpoint `/api/search/semantic` (Mistral embed 1024-dim,
cosine pure Python) mais **aucune UI ne le consomme** sur les 3 plateformes.
Aujourd'hui :

- L'index porte uniquement sur `TranscriptEmbedding` (transcripts cachés cross-user)
- Les analyses (`summaries`), flashcards, quiz et chat history ne sont pas embeddés
- L'historique a une fausse "recherche sémantique" (`/api/history/search/semantic`)
  qui n'est qu'une recherche keyword Counter-based

Le user (Maxime) veut une feature qui couvre **tout son contenu DeepSight**
(synthèses, transcripts, flashcards, quiz, chat) avec :

1. Une **recherche globale** depuis un onglet dédié dans la sidebar
2. Une **recherche intra-analyse** qui surligne les passages en jaune
3. Un **tooltip IA** qui explique pourquoi un passage matche (web only)
4. Une **navigation entre matches** (↑/↓) à travers tous les tabs d'une analyse
5. Une **stratégie tri-plateforme tiered** : web full → mobile medium → extension light

**Périmètre du moteur** : personnel uniquement (filtré par `user_id`). Pas de
recherche cross-user du corpus public.

## 2. Décisions structurantes (issues du brainstorm 2026-05-03)

| Décision                                         | Choix retenu                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Entry point UI                                   | Onglet `/search` dédié dans la sidebar (pas modal, pas command palette)       |
| Click sur passage surligné (web)                 | Tooltip IA contextuel ("pourquoi ce passage matche") + actions rapides        |
| Click sur passage surligné (mobile)              | BottomSheet `PassageActionSheet` (pas de tooltip — tap-friendly)              |
| Scope d'index                                    | Personnel uniquement — filtré par `user_id` SQL                               |
| Sources indexées                                 | Synthèse + transcript + flashcards + quiz + chat history (toutes)             |
| Layout résultats                                 | Liste plate triée par score, badges typés (Synthèse/Flashcard/Quiz/Chat)      |
| Granularité Summary                              | 1 embedding par section du `structured_index` (table des matières temporelle) |
| Granularité Flashcard                            | 1 embedding (Q+A concaténés)                                                  |
| Granularité Quiz                                 | 1 embedding (question + bonne réponse)                                        |
| Granularité Chat                                 | 1 embedding par turn (paire user+agent fusionnés)                             |
| Stack backend                                    | Approche pragmatique — JSON 1024-dim, 4 nouvelles tables, cosine Python       |
| Tri plateformes                                  | Web full > Mobile medium > Extension light                                    |
| Visibilité commerciale                           | Recherche : tous plans. Tooltip IA : Pro + Expert (Free voit upsell)          |

## 3. Architecture backend

### 3.1 Nouvelles tables (Alembic 014)

Pattern identique à `TranscriptEmbedding` (déjà en prod) — `embedding_json` Text
1024-dim, `model_version` versionnable, indexes sur `(user_id, source_id)`.

```python
class SummaryEmbedding(Base):
    __tablename__ = "summary_embeddings"
    id: int = primary_key
    summary_id: FK summaries.id (CASCADE)
    user_id: FK users.id  # dénormalisé pour filtre rapide
    section_index: int    # ordre dans structured_index
    section_ref: str | None  # ts ou anchor du structured_index
    embedding_json: Text  # JSON array 1024 floats
    text_preview: VARCHAR(500)
    token_count: int
    model_version: VARCHAR(50) default 'mistral-embed'
    source_metadata: JSON  # {tab: 'synthesis'|'digest', start_ts?, end_ts?, anchor?}
    created_at: DateTime
    UNIQUE(summary_id, section_index)
    INDEX (user_id), (summary_id), (model_version)

class FlashcardEmbedding(Base):
    __tablename__ = "flashcard_embeddings"
    flashcard_id: FK flashcards.id (CASCADE)
    summary_id: FK summaries.id (CASCADE)
    user_id: FK users.id
    embedding_json: Text  # Q+A concaténés
    text_preview: VARCHAR(500)
    model_version: VARCHAR(50)
    INDEX (user_id), (summary_id)

class QuizEmbedding(Base):
    __tablename__ = "quiz_embeddings"
    quiz_question_id: FK quiz_questions.id (CASCADE)
    summary_id: FK summaries.id (CASCADE)
    user_id: FK users.id
    embedding_json: Text  # question + bonne réponse
    text_preview: VARCHAR(500)
    model_version: VARCHAR(50)
    INDEX (user_id), (summary_id)

class ChatEmbedding(Base):
    __tablename__ = "chat_embeddings"
    summary_id: FK summaries.id (CASCADE)
    user_id: FK users.id
    turn_index: int        # ordre dans la conversation
    user_message_id: FK chat_messages.id (nullable)
    agent_message_id: FK chat_messages.id (nullable)
    embedding_json: Text   # turn user+agent fusionné
    text_preview: VARCHAR(500)  # "Q: ... | A: ..."
    token_count: int
    model_version: VARCHAR(50)
    INDEX (user_id), (summary_id, turn_index)

class ExplainPassageCache(Base):
    __tablename__ = "explain_passage_cache"
    cache_key: VARCHAR(64) primary_key  # sha256(query+passage_text+summary_id)
    explanation: Text
    model_used: VARCHAR(50)
    created_at: DateTime
    expires_at: DateTime  # 7 jours
    INDEX (expires_at) for cleanup cron
```

`TranscriptEmbedding` reste tel quel mais on ajoute une vue jointure
`transcript_embeddings_with_user` qui matérialise `summaries.user_id` pour
permettre le filtre personnel sur les transcripts (la même vidéo peut être
analysée par plusieurs users — un transcript = N summaries possibles).

### 3.2 Pipeline d'indexation

Pattern non-bloquant `asyncio.create_task` (déjà utilisé dans
`transcripts/cache_db.py:266-275`). Triggers ajoutés dans :

| Source     | Hook backend                                | Fonction               |
| ---------- | ------------------------------------------- | ---------------------- |
| Summary    | `summaries/service.py` — `create_summary()` | `embed_summary(id)`    |
| Flashcard  | `study/router.py` — `create_flashcards()`   | `embed_flashcards(id)` |
| Quiz       | `study/router.py` — `create_quiz()`         | `embed_quiz(id)`       |
| Chat turn  | `chat/router.py` — `ask()` post-completion  | `embed_chat_turn(id)`  |

Chaque service réutilise les helpers de `embedding_service.py` :

```python
# backend/src/search/embedding_service.py — extensions
async def embed_summary(summary_id: int) -> None:
    summary = await get_summary(summary_id)
    sections = parse_structured_index(summary.structured_index)
    if not sections:
        # fallback : chunks 500 mots du full_digest
        sections = chunk_text(summary.full_digest, words=500)
    texts = [section.title + "\n" + section.summary for section in sections]
    embeddings = await generate_embeddings_batch(texts)
    await bulk_insert_summary_embeddings(summary_id, sections, embeddings)

async def embed_chat_turn(user_msg_id: int, agent_msg_id: int) -> None:
    user_msg = await get_chat_message(user_msg_id)
    agent_msg = await get_chat_message(agent_msg_id)
    if user_msg.token_count + agent_msg.token_count < 30:
        return  # skip turns trop courts
    text = f"Q: {user_msg.content}\n\nA: {agent_msg.content}"
    embedding = await generate_embedding(text)
    await insert_chat_embedding(user_msg, agent_msg, embedding)
```

### 3.3 Endpoints API

```
POST /api/search/global
  body: {
    query: str (2..500),
    limit: int (1..50) = 20,
    source_types?: list["summary","flashcard","quiz","chat","transcript"],
    platform?: "youtube" | "tiktok" | "text",
    lang?: str,
    category?: str,
    date_from?: date, date_to?: date,
    favorites_only?: bool = false,
    playlist_id?: int
  }
  auth: required (filtre user_id JWT)
  response: {
    query: str,
    total_results: int,
    results: [
      {
        source_type: "summary" | "flashcard" | "quiz" | "chat" | "transcript",
        source_id: int,
        summary_id: int,
        score: float,            # cosine 0..1
        text_preview: str,       # ~200 chars avec query mise en évidence
        source_metadata: {       # variable selon type
          summary_title?, summary_thumbnail?, video_id?, channel?,
          tab?: "synthesis"|"digest"|"flashcards"|"quiz"|"chat"|"transcript",
          start_ts?, end_ts?, anchor?, flashcard_id?, quiz_question_id?
        }
      }
    ],
    searched_at: datetime
  }

POST /api/search/within/{summary_id}
  body: { query, source_types?: [tous par défaut] }
  auth: required (vérif user_id == summary.user_id)
  response: {
    matches: [
      {
        source_type, source_id,
        text: str,           # passage complet (pas tronqué)
        text_html: str,      # passage avec <mark> autour des spans matches
        start_offset: int,   # offset char dans le tab
        end_offset: int,
        tab: "synthesis"|"digest"|"flashcards"|"quiz"|"chat"|"transcript",
        score: float,
        passage_id: str      # hash stable pour deeplink
      }
    ]
  }

POST /api/search/explain-passage
  body: {
    summary_id: int,
    passage_text: str,
    query: str,
    source_type: str
  }
  auth: required (Pro + Expert plan check)
  response: {
    explanation: str,    # ~2 phrases Mistral
    cached: bool,
    model_used: str
  }
  caching: PG cache 7 jours sur sha256(query+passage_text+summary_id)
  modèle: mistral-small-latest (économie 6× vs large, suffisant 2 phrases)

POST /api/search/recent-queries
  auth: required
  response: {
    queries: list[str]   # 10 dernières queries du user
  }

DELETE /api/search/recent-queries
  auth: required
```

### 3.4 Stratégie de query (cosine pure Python)

```python
async def search_global(user_id: int, query: str, filters: SearchFilters) -> list[SearchResult]:
    # 1. Cache Redis 24h sur hash(user_id + query + filters)
    cache_key = f"search:global:{user_id}:{hash_filters(query, filters)}"
    if cached := await redis.get(cache_key):
        return json.loads(cached)

    # 2. Embed query (1 call Mistral, ~50ms)
    query_embedding = await generate_embedding(query)

    # 3. Charger embeddings filtrés en SQL
    candidates = []
    if "summary" in filters.source_types:
        candidates += await load_summary_embeddings(user_id, filters)
    if "flashcard" in filters.source_types:
        candidates += await load_flashcard_embeddings(user_id, filters)
    # ...idem pour quiz, chat, transcript

    # 4. Cosine en Python (pour scope personnel < 5000 passages, OK)
    scored = [
        (cosine(query_embedding, c.embedding), c)
        for c in candidates
        if cosine(query_embedding, c.embedding) >= MIN_SIMILARITY
    ]
    scored.sort(key=lambda x: -x[0])
    results = scored[:filters.limit]

    # 5. Cache 24h
    await redis.setex(cache_key, 86400, json.dumps(results))
    return results
```

**Performance attendue** :
- Personnel + 1000 passages : ~80-120ms (cosine + load) — acceptable
- Au-delà de 5000 passages : monitoring Posthog déclenche alerte → roadmap pgvector

### 3.5 Backfill des analyses existantes

Script `backend/scripts/backfill_search_index.py` :

```python
# Usage : python -m scripts.backfill_search_index --user-id 42 --batch-size 50
# Ou : --all-users (pour migration prod globale)

async def backfill_user(user_id: int, batch_size: int = 50):
    summaries = await get_summaries_without_embeddings(user_id)
    for batch in chunked(summaries, batch_size):
        await asyncio.gather(*[
            embed_summary(s.id) for s in batch
        ])
        await asyncio.sleep(2)  # rate limit Mistral
        log_progress(user_id, len(batch))
```

Estimation prod : ~5000 summaries existantes × ~5 chunks/summary × $0.10/1M tokens
≈ **$5-30 pour backfill complet**, ~6h en série.

### 3.6 Feature flag

`FEATURE_SEMANTIC_SEARCH_V1` env var backend (default `false` initial). Endpoint
`/api/features` retourne le flag pour que web/mobile/extension décident d'afficher
ou cacher l'onglet Search. Permet rollback instantané sans redéploiement.

## 4. Frontend Web (full tier)

### 4.1 Routes & navigation

- Nouveau path : `/search` (page dédiée, pas modal)
- Item ajouté dans `frontend/src/components/sidebar/SidebarNav.tsx` entre History et Hub
- URL stateful avec query params : `/search?q=...&types=summary,flashcard&platform=youtube`

### 4.2 Composants à créer

```
frontend/src/pages/SearchPage.tsx               ← page racine (route /search)
frontend/src/components/search/
├── SearchInput.tsx                             ← input + autocomplete (queries récentes)
├── SearchFiltersBar.tsx                        ← pills filtres + dropdowns
├── SearchResultsList.tsx                       ← virtual scroll (react-window)
├── SearchResultCard.tsx                        ← carte avec badge type + thumbnail
├── SearchEmptyState.tsx
└── useSemanticSearch.ts                        ← hook React Query, debounce 300ms

frontend/src/components/highlight/
├── SemanticHighlighter.tsx                     ← provider state matches + nav
├── HighlightedText.tsx                         ← wrapper qui injecte <mark>
├── ExplainTooltip.tsx                          ← tooltip IA (call /explain-passage)
├── HighlightNavigationBar.tsx                  ← compteur "3/12" + ↑↓ buttons
└── useHighlightNav.ts                          ← logique navigation cross-tab
```

### 4.3 Page `/search`

Layout (à 1280px) :

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar nav]                                                    │
│   Hub                                                            │
│   History            ┌───────────────────────────────────────┐  │
│ ▶ Recherche          │ [🔍 Rechercher dans tes analyses…]   │  │
│   Profil             └───────────────────────────────────────┘  │
│                      [Tout (42)] [Synthèse 18] [Flashcards 9]  │
│                      [Chat 8] [Transcripts 7] [+Filtres avancés] │
│                                                                  │
│                      ┌─ Résultat 1 ────────────────────────┐   │
│                      │ [SYNTHÈSE] Crise énergétique EU    │   │
│                      │ score 0.91                  ▶ aller│   │
│                      │ …la transition énergétique impose…  │   │
│                      └─────────────────────────────────────┘   │
│                      ┌─ Résultat 2 ────────────────────────┐   │
│                      │ [FLASHCARD] Green Deal 2030         │   │
│                      │ score 0.87                          │   │
│                      │ Q: Quels objectifs pour la transit. │   │
│                      └─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

Filtres par défaut visibles : pills par type (Tout/Synthèse/Flashcards/Quiz/Chat/Transcripts).
Bouton "+Filtres avancés" expand vers : Plateforme (YouTube/TikTok), Langue,
Catégorie, Période, "Favoris uniquement", "Dans une playlist".

### 4.4 Click flow vers une analyse

1. Click sur `SearchResultCard` → navigate vers `/analysis/{summary_id}` avec
   query params : `?q={query}&highlight={passage_id}&tab={source_tab}`
2. La page `/analysis/[id]` détecte les params au mount → instancie
   `SemanticHighlighter` provider
3. `SemanticHighlighter` fetch `/api/search/within/{summary_id}` (déjà connu, debounce 0)
4. Tous les `<HighlightedText>` rendent leurs `<mark>` jaunes pour les matches
5. Le `passage_id` cliqué est auto-scrollé (`scrollIntoView({block:'center'})`)
   et flashé en jaune appuyé pendant 800ms via animation CSS
6. La `HighlightNavigationBar` apparaît en haut sticky : `[3/12] ↑ ↓ ✕ "transition énergétique"`

### 4.5 Recherche intra-analyse (Cmd+F sémantique)

- Bouton loupe ajouté dans le header de l'analyse (`HubHeader.tsx`)
- Raccourci clavier `Cmd/Ctrl+F` intercepté **uniquement quand l'analyse a le focus**
  (event bubbling stop sur container `.analysis-page`, fallback browser default ailleurs)
- Ouvre une mini-search bar flottante en haut de la page (sticky, z-50)
- Tape → fetch `/api/search/within/{summary_id}` debounced 200ms
- `SemanticHighlighter` met à jour les `<mark>` partout dans tous les tabs visibles
- Boutons `↑/↓` jump aussi de tab à tab si nécessaire (active automatiquement le tab
  où vit le prochain match via `setActiveTab(match.tab)`)
- `Esc` ferme la search bar et retire tous les highlights

### 4.6 Stratégie de rendu des highlights

`<mark className="ds-highlight" data-passage-id={id} onClick={openTooltip}>`
injecté dans le DOM via React (pas de DOM manipulation native — cohérence avec
re-renders).

CSS dans `frontend/src/styles/highlight.css` :

```css
.ds-highlight {
  background: rgb(251 191 36 / 0.35); /* tailwind amber-400 35% */
  color: rgb(252 211 77);             /* amber-300 */
  padding: 0 2px;
  border-radius: 2px;
  border-bottom: 2px solid rgb(251 191 36);
  cursor: pointer;
  transition: background 200ms ease;
}
.ds-highlight:hover { background: rgb(251 191 36 / 0.55); }
.ds-highlight.flash {
  animation: ds-highlight-flash 800ms ease-in-out;
}
@keyframes ds-highlight-flash {
  0%, 100% { background: rgb(251 191 36 / 0.35); }
  50%      { background: rgb(251 191 36 / 0.85); }
}
```

### 4.7 Tooltip IA (`ExplainTooltip`)

Lib : `@floating-ui/react` (déjà utilisé dans le projet).

```
┌──────────────────────────────────────┐
│ [IA] Pourquoi ce passage match       │
│                                      │
│ Mentionne directement la transition  │
│ énergétique européenne via le       │
│ solaire — concept central de ta     │
│ requête.                             │
│                                      │
│ [📌 Citer dans chat] [⏱ 03:42]      │
│ [→ Voir dans Flashcards]             │
└──────────────────────────────────────┘
```

- Click sur `<mark>` → `ExplainTooltip` s'ouvre (floating UI top placement, fallback bottom)
- Loading skeleton pendant 200-800ms (Mistral call)
- Cache mémoire React Query 1h sur même `(query, passage_text)` → tooltip réouvert
  ne re-fetch pas
- Fermeture : click outside, Esc, ou nouveau click sur autre `<mark>`
- Action **"Citer dans chat"** : navigate vers tab Chat avec `chatStore.prefillMessage`
  pré-rempli `"Explique-moi ce passage : [passage_text]"`
- Action **"Voir dans X"** : si match flashcard/quiz/chat → switch active tab + scroll
- Action **"Sauter au timecode"** : si transcript ou structured_index avec ts → seek
  dans le `AudioSummaryPlayer` (si présent) ou ouvre la vidéo originale

### 4.8 Free plan upsell

Si user free clique sur un `<mark>` :

```
┌──────────────────────────────────────┐
│ ✨ Comprendre ce passage avec l'IA   │
│                                      │
│ Le tooltip IA est inclus avec Pro.   │
│ [Essai gratuit 7 jours →]           │
│                                      │
│ Passage : "la transition énergétique │
│ impose une refonte du mix électrique │
│ européen…"                           │
└──────────────────────────────────────┘
```

Le passage est quand même surligné, on bloque uniquement la génération IA.

## 5. Mobile (medium tier)

### 5.1 Routing & nav

Nouveau tab dans `mobile/app/(tabs)/_layout.tsx` → `search.tsx` (icône loupe entre
Library et Hub). Ou, si l'UX consensus est "trop de tabs", remplacer Library
par un sous-onglet de Hub. **Décision V1 : nouveau tab dédié.**

### 5.2 Composants à créer

```
mobile/app/(tabs)/search.tsx                        ← screen racine
mobile/src/components/search/
├── SearchBar.tsx                                   ← input + suggestions
├── SearchFiltersSheet.tsx                          ← BottomSheet filtres
├── SearchResultsList.tsx                           ← FlashList virtualisée
├── SearchResultCard.tsx                            ← carte avec badge + thumbnail
└── useSemanticSearch.ts                            ← hook React Query

mobile/src/components/highlight/
├── HighlightedText.tsx                             ← équivalent web, RN-friendly
├── PassageActionSheet.tsx                          ← BottomSheet actions au tap
├── HighlightNavigationBar.tsx                      ← compteur + ↑↓ flottants
└── useHighlightNav.ts
```

### 5.3 Recherche intra-analyse

- Bouton loupe dans le header de `mobile/app/(tabs)/analysis/[id].tsx`
- Tap → ouvre une `SearchBar` flottante en haut du screen (sticky)
- Tape → highlight les passages dans le tab actif
- **Pas de tooltip IA** (espace contraint, tap-friendly)
- Tap sur passage jaune → `PassageActionSheet` (gorhom/bottom-sheet) avec :
  1. **"Demander à l'IA"** → injecte le passage dans le tab Chat
     (`chatStore.prefillMessage("Explique-moi : [passage]")`)
  2. **"Sauter au timecode"** (si transcript/structured_index avec ts)
  3. **"Voir dans Synthèse / Flashcard / Quiz / Chat"** (selon source)
- Boutons `↑/↓` flottants en bas-droite (FAB-style) pour naviguer entre matches

### 5.4 Adaptation tactile

Zone de tap des `<mark>` étendue à 32×32px min via `hitSlop={{top:8,bottom:8,...}}`
(le rendu visuel reste à la taille typo). Background jaune. Single tap = ouvre
`PassageActionSheet` directement (pas de double tap, simple).

## 6. Extension Chrome (light tier)

### 6.1 Composant unique

`extension/src/sidepanel/components/QuickSearch.tsx` placé dans
`extension/src/sidepanel/views/HomeView.tsx` au-dessus de `RecentsList`.

```
┌────────────────────────────────┐
│ HomeView                       │
│  [Logo] [Plan badge]           │
│  ┌──────────────────────────┐  │
│  │ 🔍 Rechercher mes        │  │
│  │   analyses…              │  │
│  └──────────────────────────┘  │
│  Recents                       │
│  ▶ Crise énergétique EU       │
│  ▶ Transition solaire         │
│  ...                           │
└────────────────────────────────┘
```

### 6.2 Comportement

- Tap/focus dans le champ → expand vers une zone de résultats inline
  (remplace temporairement `RecentsList` pendant la recherche)
- Tape → debounce 400ms → fetch `/api/search/global?limit=10` (limite réduite)
- Résultats : flat list **simplifiée** (1 ligne par résultat avec badge type compact)
- Tap sur résultat → ouvre l'analyse dans `AnalysisView` du sidepanel
- **Pas d'intra-analyse search** (le user peut scroll, ou cliquer sur le footer)
- **Pas de tooltip IA**
- Footer du résultat-set : "Voir tous les résultats sur deepsightsynthesis.com →"
  qui ouvre l'app web `/search?q=...` dans un nouvel onglet via `chrome.tabs.create`

### 6.3 Synchronisation cross-platform

Cache local des **5 dernières queries** :
- Web : `localStorage.deepsight_recent_queries`
- Mobile : `AsyncStorage` clé `deepsight_recent_queries`
- Extension : `chrome.storage.local` clé `recent_queries`

**Pas de sync cross-device pour V1** (yagni). Le user peut DELETE ses recent
queries via `/api/search/recent-queries`.

## 7. Cross-cutting concerns

### 7.1 Performance & coûts Mistral

| Opération            | Coût Mistral      | Latence          | Caching                            |
| -------------------- | ----------------- | ---------------- | ---------------------------------- |
| Embedding indexation | ~$0.0001 / chunk  | ~50ms / batch 10 | DB persistent (1× par création)    |
| Embedding query      | ~$0.0001 / query  | ~50ms            | Redis 24h sur `hash(query)`        |
| Cosine similarity    | $0 (pure Python)  | ~30-100ms / 1k   | —                                  |
| Tooltip explain      | ~$0.0005 / tooltip | ~400-800ms       | PG 7j sur `hash(query+passage)`    |

**Backfill prod** estimé ~$5-30 pour ~5000 summaries existantes (chunks d'environ
5 sections par summary). Tournable en background avec rate-limit `asyncio.sleep(2)`
toutes les 50 chunks. Total ~6h.

### 7.2 Quota / pricing

| Feature                 | Free             | Pro              | Expert              |
| ----------------------- | ---------------- | ---------------- | ------------------- |
| Recherche globale       | ✅ illimitée     | ✅ illimitée     | ✅ illimitée        |
| Recherche intra-analyse | ✅ illimitée     | ✅ illimitée     | ✅ illimitée        |
| Tooltip IA              | ❌ (upsell)      | ✅ illimité      | ✅ illimité         |
| Indexation auto         | ✅               | ✅               | ✅                  |

Mise à jour `frontend/src/config/planPrivileges.ts` + miroir
`mobile/src/config/planPrivileges.ts` + check côté backend dans
`is_feature_available(plan, "semantic_search_tooltip", platform)`.

### 7.3 Edge cases techniques

| Cas                                                | Comportement                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Recherche pendant qu'une analyse s'embed           | Renvoie ce qui existe à T-1, badge UI "indexation en cours"       |
| Query <2 caractères                                | Pas d'API call, bouton search disabled                            |
| 0 résultats                                        | Empty state + suggestions (queries récentes ou catégories du user) |
| Analyse supprimée                                  | ON DELETE CASCADE auto sur embeddings                             |
| Re-analyse même vidéo                              | Remplace l'ancien embedding (1 user → 1 analyse active par vidéo) |
| Mistral API timeout (>10s)                         | Fallback : retour résultats keyword via `history_service` (degrade) |
| Vidéo ajoutée à playlist après embed              | Embedding inchangé (filtre playlist en SQL au moment du fetch)    |
| User passe Free → Pro                              | Tooltip IA débloqué instantanément (pas de cache UI)              |

### 7.4 Observabilité

**Métriques Posthog** :
- `search_query` : `{query_length, results_count, latency_ms, source_filter, has_filters}`
- `search_result_clicked` : `{position, source_type, score}`
- `tooltip_explain_opened` : `{cached_hit, latency_ms, source_type}`
- `intra_analysis_search_opened` : `{from: "button"|"shortcut", summary_id}`
- `highlight_navigation` : `{direction: "next"|"prev", current_index, total}`

**Logs backend** (structured) : par requête avec `user_id`, `query_length`,
`embedding_latency_ms`, `cosine_latency_ms`, `results_count`, `cache_hit`.

**Sentry** : captureException sur tout fail Mistral + breadcrumb query+filters
pour debug.

### 7.5 Accessibilité

- `<mark>` ont un `aria-label="Passage correspondant : ..."`
- `HighlightNavigationBar` est landmark `<nav role="navigation" aria-label="Résultats de recherche">`
- Raccourci `Cmd/Ctrl+F` annoncé via `aria-keyshortcuts`
- `ExplainTooltip` : trap focus, Escape fermable, `role="tooltip"`
- Mobile : `accessibilityRole="button"` + `accessibilityLabel` sur tous les `<mark>` taps

## 8. Rollout plan (4 phases)

Découpage en **4 PRs séquentielles** pour limiter les conflits et permettre rollback.

### Phase 1 — Backend foundation (~3 jours)

**Sub-agent Opus 4.7** sur worktree `feat/search-backend`.

Livrables :
- Migration Alembic 014 (4 tables + cache + indexes)
- `backend/src/search/` étendu : services pour summary/flashcard/quiz/chat
- Triggers auto dans services existants
- Endpoints `POST /api/search/global`, `POST /api/search/within/{id}`,
  `POST /api/search/explain-passage`, `GET/DELETE /api/search/recent-queries`
- Script `backend/scripts/backfill_search_index.py`
- Tests pytest avec fixtures Mistral mockées (≥80% coverage)
- Feature flag `FEATURE_SEMANTIC_SEARCH_V1` env var
- PR `feat/search-backend` mergée + déployée Hetzner avec flag OFF (numéro à attribuer)

### Phase 2 — Web full feature (~4 jours)

**2 sub-agents Opus 4.7 en parallèle** sur worktrees distincts :
- Agent A : `feat/search-page-web` — `SearchPage` + components search
- Agent B : `feat/search-highlight-web` — `SemanticHighlighter` + tooltip IA

Livrables :
- Sidebar nav + route `/search`
- `SearchPage` complète avec filtres
- `SemanticHighlighter` provider + composants associés
- `ExplainTooltip` avec call API + cache 1h React Query
- Cmd+F intercept + `HighlightNavigationBar`
- Click flow `/search` → `/analysis/{id}?q=...&highlight=...`
- Free plan upsell modal
- Tests Vitest unitaires + Playwright E2E (3 specs : global search, intra search, tooltip)
- PR `feat/search-page-web` + `feat/search-highlight-web` mergées + déployées Vercel (numéros à attribuer)
- Backfill prod lancé en background

### Phase 3 — Mobile (~3 jours)

**Sub-agent Opus 4.7** sur worktree `feat/search-mobile`.

Livrables :
- Tab `search.tsx` + tous les composants mobile
- `PassageActionSheet` (BottomSheet)
- `HighlightedText` mobile + nav buttons FAB
- Intégration `analysis/[id]` avec highlights et action sheet
- EAS preview build pour test iOS/Android
- Tests Jest sur composants critiques + Detox sur 1 flow E2E
- PR `feat/search-mobile` mergée + EAS update OTA (numéro à attribuer)

### Phase 4 — Extension (~2 jours)

**Sub-agent Opus 4.7** sur worktree `feat/search-extension`. Plus léger.

Livrables :
- `QuickSearch` dans `HomeView`
- Lien "Voir tous les résultats" → web `/search`
- Build extension + ZIP pour Chrome Web Store
- Test manuel sur YouTube
- PR `feat/search-extension` mergée (numéro à attribuer)

### Activation feature flag

Une fois les 4 phases mergées et backfill prod terminé :
1. SSH Hetzner → set `FEATURE_SEMANTIC_SEARCH_V1=true` dans `.env.production`
2. `docker restart repo-backend-1` (~10s downtime)
3. Web/Mobile/Extension détectent automatiquement via `/api/features`
4. Annonce email + Posthog feature flag rollout 10% → 50% → 100%

### Rollback strategy

Set flag = `false` → web/mobile/extension cachent l'onglet Search. Les
embeddings restent en DB (pas de rollback data). Coût rollback : 0.

## 9. Risques & mitigations

| Risque                                                    | Probabilité | Impact   | Mitigation                                                                 |
| --------------------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------------- |
| Mistral API down → indexation bloquée                     | Faible      | Moyen    | Trigger non-bloquant `asyncio.create_task` + retry exponential queue       |
| Backfill explose les credits Mistral                      | Faible      | Moyen    | Rate limit `asyncio.sleep(2)` + monitoring spend Mistral dashboard         |
| Cosine Python ralentit au-delà 5k passages                | Moyen       | Moyen    | Posthog alert + roadmap pgvector phase 5                                   |
| Conflits embedding `model_version` en cas bump Mistral    | Faible      | Faible   | Pattern `reembed_progressive.py` réutilisable + colonne `model_version`    |
| Cmd+F intercept casse le browser default ailleurs         | Moyen       | Faible   | Event scope strict `.analysis-page` + tests Playwright                     |
| Tooltip IA hallucine en confirmant un mauvais match      | Moyen       | Moyen    | Prompt système conservateur + bouton "Pas pertinent" (feedback Posthog)    |
| Highlight rendering casse layout des analyses existantes  | Moyen       | Élevé    | Tests visuels Playwright sur 3 analyses canon + safelist Tailwind          |
| Mobile keyboard masque la `HighlightNavigationBar`        | Élevé       | Faible   | `KeyboardAvoidingView` + tests iOS/Android sur le screen analysis          |
| Extension sidepanel trop étroit pour résultats lisibles  | Moyen       | Faible   | UI compacte (1 ligne/résultat) + footer "voir tous sur web"                |
| User Free spam tooltip → coût Mistral                     | Faible      | Faible   | Quota côté backend (tooltip = 0 calls pour free, juste upsell)             |

## 10. Hors scope V1 (idées V2+)

- **Search cross-user** (corpus public DeepSight) — décidé personnel-only V1
- **pgvector + index HNSW** — phase 5 si scaling le justifie
- **Filtres avancés** : sentiment, fiabilité, longueur, etc.
- **Sync cross-device** des recent queries
- **Search dans les sources web** (Perplexity / fact-check enrichments)
- **Voice search** ("Hey DeepSight, trouve-moi les passages sur…") — relate à voice agent
- **Embeddings multilingues** (mistral-embed est déjà multilingue mais pas optimisé)
- **Re-ranking via LLM** des top-N résultats (qualité ↑ coût ↑)
- **Highlight comparé** : afficher 2 passages côte à côte ("ces 2 passages disent l'opposé")
- **Saved searches** (alertes quand une nouvelle analyse matche une recherche sauvegardée)

## 11. Definition of Done

- [ ] Migration Alembic 014 appliquée Hetzner prod
- [ ] 4 endpoints API en prod, smoke-tested via curl avec JWT
- [ ] Backfill prod terminé pour les ~5000 summaries existantes
- [ ] Tests backend ≥80% coverage sur `backend/src/search/*` (pytest)
- [ ] Web : `/search` accessible, intra-analyse Cmd+F fonctionne, tooltip IA répond
- [ ] Mobile : tab search fonctionne, intra-analyse + action sheet OK, EAS update OTA prod
- [ ] Extension : QuickSearch opérationnel, lien web fonctionne, build ZIP prêt Chrome Web Store
- [ ] Feature flag `FEATURE_SEMANTIC_SEARCH_V1=true` en prod
- [ ] Tests Vitest + Playwright (3 specs E2E web) verts
- [ ] Tests Jest mobile verts sur composants critiques
- [ ] Posthog dashboard `Semantic Search V1` créé avec 5 métriques principales
- [ ] Sentry pas d'erreur >2% sur les 4 endpoints search
- [ ] Documentation `docs/CLAUDE-BACKEND.md` mise à jour avec section "Semantic Search"
- [ ] CHANGELOG.md prod entry "v1.3.0 — Semantic Search V1"
- [ ] Annonce email user (Resend) + post Twitter/LinkedIn

---

_Spec rédigé le 2026-05-03 par Claude Sonnet 4.6 après brainstorming
collaboratif avec Maxime (founder DeepSight) via le visual companion._
