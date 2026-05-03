# Semantic Search V1 — Phase 2 Web Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher l'app web DeepSight sur les 4 endpoints search backend (Phase 1 mergée via PR #292) en exposant une page `/search` complète + une recherche intra-analyse Cmd+F sémantique avec highlights jaunes, navigation cross-tab et tooltip IA "Pourquoi ce passage matche" pour Pro/Expert.

**Architecture:** Page `/search` lazy-loadée avec layout standard (Sidebar + container) consommant `POST /api/search/global` via TanStack Query (debounce 300ms). Click sur un résultat → `/hub?summaryId={id}&q=...&highlight={passage_id}&tab={tab}` (le Hub est notre page d'analyse — pas de route `/analysis/[id]` dédiée). Un `SemanticHighlightProvider` mount dans `HubPage` détecte les query params, fetch `/api/search/within/{summary_id}` et expose les matches via Context aux tabs visibles. Composant `<HighlightedText>` wrapper autour de `<EnrichedMarkdown>` qui injecte des `<mark>` post-render via traversée DOM dans un container ref. Tooltip IA construit avec Framer Motion (déjà installé) + un positionnement custom léger (pas de `@floating-ui` à ajouter — on évite la dep).

**Tech Stack:** React 18 + TypeScript strict, Vite 5, React Router 6, TanStack Query 5, `@tanstack/react-virtual` (déjà présent — virtual scroll), Framer Motion 12, Tailwind 3, Vitest + Testing Library, Playwright E2E, lucide-react.

**Spec source:** `docs/superpowers/specs/2026-05-03-semantic-search-design.md` — section 4 "Frontend Web (full tier)"

**Backend Phase 1:** Déjà mergée (PR #292). Endpoints disponibles : `POST /api/search/global`, `POST /api/search/within/{summary_id}`, `POST /api/search/explain-passage`, `GET/DELETE /api/search/recent-queries`. Feature flag backend `SEMANTIC_SEARCH_V1_ENABLED` env var (false en prod).

---

## File Structure

### Files créés

| Path                                                                          | Responsibility                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `frontend/src/pages/SearchPage.tsx`                                           | Page racine route `/search` — layout Sidebar + SearchInput + Filters + ResultsList |
| `frontend/src/components/search/SearchInput.tsx`                              | Input + autocomplete (queries récentes localStorage + GET /recent-queries)         |
| `frontend/src/components/search/SearchFiltersBar.tsx`                         | Pills (type) + bouton expand vers filtres avancés                                  |
| `frontend/src/components/search/SearchAdvancedFilters.tsx`                    | Plateforme/Lang/Catégorie/Période/Favoris (collapsible)                            |
| `frontend/src/components/search/SearchResultsList.tsx`                        | Virtual scroll via `@tanstack/react-virtual` + integration empty/loading states    |
| `frontend/src/components/search/SearchResultCard.tsx`                         | Carte résultat — badge type + thumbnail + score + preview                          |
| `frontend/src/components/search/SearchEmptyState.tsx`                         | Empty state (no query / 0 résultats) + suggestions queries récentes                |
| `frontend/src/components/search/SearchTypeBadge.tsx`                          | Badge typé (synthese/flashcard/quiz/chat/transcript) avec couleur+icône            |
| `frontend/src/components/search/useSemanticSearch.ts`                         | Hook React Query + debounce 300ms + URL state sync                                 |
| `frontend/src/components/search/useRecentQueries.ts`                          | Hook localStorage + sync GET/DELETE `/api/search/recent-queries`                   |
| `frontend/src/components/highlight/SemanticHighlightProvider.tsx`             | React Context : matches, navigation index, fetch within, open tooltip              |
| `frontend/src/components/highlight/SemanticHighlightContext.ts`               | Définition Context + types `Match`, `HighlightState`                               |
| `frontend/src/components/highlight/useSemanticHighlight.ts`                   | Hook consumer du Context (`useContext`) + helpers                                  |
| `frontend/src/components/highlight/HighlightedText.tsx`                       | Wrapper React qui post-process le DOM (range API) pour injecter `<mark>` jaunes    |
| `frontend/src/components/highlight/HighlightNavigationBar.tsx`                | Sticky top — compteur "3/12" + ↑/↓ + close + query display                         |
| `frontend/src/components/highlight/IntraAnalysisSearchBar.tsx`                | Mini-search bar floating ouverte par Cmd+F dans Hub                                |
| `frontend/src/components/highlight/ExplainTooltip.tsx`                        | Tooltip IA — call /explain-passage + cache RQ + actions (citer/timecode/voir)      |
| `frontend/src/components/highlight/ExplainUpsellModal.tsx`                    | Modal upsell free → "Comprendre ce passage avec l'IA"                              |
| `frontend/src/components/highlight/useCmdFIntercept.ts`                       | Hook `keydown` listener `Cmd/Ctrl+F` scopé à `.analysis-page`                      |
| `frontend/src/styles/highlight.css`                                           | Styles `.ds-highlight`, `.ds-highlight.flash`, `@keyframes ds-highlight-flash`     |
| `frontend/src/components/search/__tests__/SearchInput.test.tsx`               | Test debounce + clear + autocomplete                                               |
| `frontend/src/components/search/__tests__/SearchResultCard.test.tsx`          | Test rendu badge + click → navigate                                                |
| `frontend/src/components/search/__tests__/useSemanticSearch.test.ts`          | Test hook (mock `searchApi.searchGlobal`)                                          |
| `frontend/src/components/search/__tests__/SearchFiltersBar.test.tsx`          | Test toggle pills + expand advanced                                                |
| `frontend/src/components/highlight/__tests__/HighlightedText.test.tsx`        | Test injection `<mark>` post-render                                                |
| `frontend/src/components/highlight/__tests__/ExplainTooltip.test.tsx`         | Test free upsell vs Pro tooltip + cache                                            |
| `frontend/src/components/highlight/__tests__/HighlightNavigationBar.test.tsx` | Test compteur + nav ↑/↓                                                            |
| `frontend/src/pages/__tests__/SearchPage.test.tsx`                            | Test page integration (mock api)                                                   |
| `frontend/e2e/semantic-search-global.spec.ts`                                 | E2E spec 1 — recherche globale + click → Hub                                       |
| `frontend/e2e/semantic-search-intra.spec.ts`                                  | E2E spec 2 — Cmd+F intercept + nav matches                                         |
| `frontend/e2e/semantic-search-tooltip.spec.ts`                                | E2E spec 3 — tooltip IA Pro vs upsell free                                         |

### Files modifiés

| Path                                               | Changes                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/src/services/api.ts`                     | Ajouter types `SearchResult`/`SearchFilters`/`WithinMatch`/`ExplainPassageResponse` + 5 méthodes `searchApi.*`                                                     |
| `frontend/src/App.tsx`                             | Lazy-load `SearchPage`, route `/search` dans le bloc routes protégées, prefetch hint depuis `/dashboard` et `/history`                                             |
| `frontend/src/components/sidebar/SidebarNav.tsx`   | Ajout item `{ path: "/search", icon: Search, label: "Recherche" }` (composant orphelin mentionné par le spec)                                                      |
| `frontend/src/components/layout/Sidebar.tsx`       | Ajout `NavItem` Search dans le 1er pill group entre History et Hub (LE sidebar réellement utilisé en prod)                                                         |
| `frontend/src/config/planPrivileges.ts`            | Ajouter `semanticSearchTooltip: boolean` dans `PlanFeatures` + valeurs par plan + map dans `PLAN_FEATURES`                                                         |
| `frontend/src/pages/HubPage.tsx`                   | Wrapper `<SemanticHighlightProvider>`, mount `<HighlightNavigationBar>` + `<IntraAnalysisSearchBar>`, classe `analysis-page`, lecture query params q/highlight/tab |
| `frontend/src/components/hub/HubAnalysisPanel.tsx` | Wrap children avec un container `data-highlight-root` pour scoper la traversée DOM                                                                                 |
| `frontend/src/components/hub/HubHeader.tsx`        | Ajouter bouton loupe (loop button) qui ouvre `IntraAnalysisSearchBar`                                                                                              |
| `frontend/src/index.css`                           | Importer `./styles/highlight.css`                                                                                                                                  |
| `frontend/src/i18n/fr.json` + `en.json`            | Ajouter clés `nav.search`, `search.placeholder`, `search.empty.*`, `search.tooltip.*`, `search.upsell.*`                                                           |

### Hors scope (Phases 3+)

- `mobile/src/config/planPrivileges.ts` — Phase 3
- `extension/src/sidepanel/components/QuickSearch.tsx` — Phase 4
- Activation feature flag prod — Phase 5

---

## Conventions globales pour TOUTES les tasks

- **Branche worktree dédiée** : à créer depuis `main` via `git worktree add` au début (Step 0). Nom suggéré : `feat/search-web-phase2`. Si on veut suivre la division spec en 2 sub-agents parallèles, créer 2 branches : `feat/search-page-web` (Tasks 1-10, 19) et `feat/search-highlight-web` (Tasks 11-18). **Ce plan est écrit pour exécution séquentielle par UN sub-agent — split possible mais pas nécessaire**.
- Commits ASCII propres (pas d'emojis), prefix `feat(search):` / `feat(highlight):` / `test(search):` / `chore(search):` selon scope.
- Tests Vitest avec `renderWithProviders` depuis `__tests__/test-utils.tsx`.
- Tous les composants : TypeScript strict, zéro `any`, interfaces (pas type aliases) pour les objets.
- Functional components uniquement.
- Toutes les API calls passent par `services/api.ts` — jamais de `fetch()` direct.
- Tailwind only — pas de CSS modules / styled-components. Une exception : `styles/highlight.css` pour les `@keyframes` (cohérent avec patterns ambient lighting existants).
- Dark mode first — fond `#0a0a0f`, surfaces `#12121a`, glassmorphism `backdrop-blur-xl bg-white/5 border border-white/10`.
- Avant chaque commit : `npm run typecheck && npm run lint && npm run test -- --run` doivent passer green dans `frontend/`.
- Pas de redéploiement de feature flag — le frontend affiche toujours l'onglet Search ; le backend retourne 404 si flag OFF (gracefull empty state).
- Pas de modification de `mobile/` ni `extension/` dans cette phase.
- Pas de modification du SSOT pricing : pas de Stripe, pas de plan_config backend.

### Étape Step 0 — Setup worktree (à faire UNE fois en début de session)

- [ ] **Step 0.1: Créer le worktree depuis `main`**

```bash
cd C:/Users/33667/DeepSight-Main
git fetch origin main
git worktree add .worktrees/search-web-phase2 -b feat/search-web-phase2 origin/main
cd .worktrees/search-web-phase2
```

Expected : nouveau worktree dans `.worktrees/search-web-phase2/` sur branche `feat/search-web-phase2`.

- [ ] **Step 0.2: Installer dépendances**

```bash
cd frontend
npm install
```

Expected : `node_modules/` régénéré, pas d'erreur.

- [ ] **Step 0.3: Baseline avant tout changement**

```bash
cd frontend
npm run typecheck
npm run lint
npm run test -- --run
```

Expected : 3 commandes green (warnings ESLint OK si déjà présents sur main, 0 erreur). Si baseline rouge, **stop** et signaler.

---

## Task 1: Étendre `services/api.ts` — types + méthodes searchApi

**Files:**

- Modify: `frontend/src/services/api.ts`

**Dependencies:** Aucune. C'est la base pour toutes les autres tasks.

- [ ] **Step 1.1: Localiser le bloc SEARCH API existant** (lignes ~2563-2595, contient déjà `searchApi.semanticSearch`).

- [ ] **Step 1.2: Ajouter les nouveaux types juste après les types existants `SemanticSearchResult` et `SemanticSearchResponse`**

```typescript
// ─── Search V1 — Phase 2 (Global / Within / Explain) ──────────────────────────

export type SearchSourceType =
  | "summary"
  | "flashcard"
  | "quiz"
  | "chat"
  | "transcript";

export interface SearchFilters {
  source_types?: SearchSourceType[];
  platform?: "youtube" | "tiktok" | "text";
  lang?: string;
  category?: string;
  date_from?: string; // ISO date YYYY-MM-DD
  date_to?: string;
  favorites_only?: boolean;
  playlist_id?: number;
}

export interface SearchResultMetadata {
  summary_title?: string;
  summary_thumbnail?: string;
  video_id?: string;
  channel?: string;
  tab?: "synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript";
  start_ts?: number;
  end_ts?: number;
  anchor?: string;
  flashcard_id?: number;
  quiz_question_id?: number;
}

export interface GlobalSearchResult {
  source_type: SearchSourceType;
  source_id: number;
  summary_id: number;
  score: number;
  text_preview: string;
  source_metadata: SearchResultMetadata;
}

export interface GlobalSearchResponse {
  query: string;
  total_results: number;
  results: GlobalSearchResult[];
  searched_at: string;
}

export interface WithinMatch {
  source_type: SearchSourceType;
  source_id: number;
  text: string;
  text_html: string; // contient <mark> autour des spans matches
  start_offset: number;
  end_offset: number;
  tab: "synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript";
  score: number;
  passage_id: string;
}

export interface WithinSearchResponse {
  matches: WithinMatch[];
}

export interface ExplainPassageResponse {
  explanation: string;
  cached: boolean;
  model_used: string;
}

export interface RecentQueriesResponse {
  queries: string[];
}
```

- [ ] **Step 1.3: Étendre l'objet `searchApi` (laisser `semanticSearch` legacy pour rétrocompat)**

```typescript
export const searchApi = {
  // Legacy — keep for backward compat with /api/search/semantic transcript-only
  async semanticSearch(
    query: string,
    limit: number = 10,
    category?: string,
  ): Promise<SemanticSearchResponse> {
    return request("/api/search/semantic", {
      method: "POST",
      body: { query, limit, category },
    });
  },

  // V1 Phase 2 — Global cross-source search
  async searchGlobal(
    query: string,
    filters: SearchFilters = {},
    limit: number = 20,
  ): Promise<GlobalSearchResponse> {
    return request("/api/search/global", {
      method: "POST",
      body: { query, limit, ...filters },
    });
  },

  // V1 Phase 2 — Intra-analysis search
  async searchWithin(
    summaryId: number,
    query: string,
    sourceTypes?: SearchSourceType[],
  ): Promise<WithinSearchResponse> {
    return request(`/api/search/within/${summaryId}`, {
      method: "POST",
      body: { query, source_types: sourceTypes },
    });
  },

  // V1 Phase 2 — Explain a passage (Pro/Expert only on backend)
  async explainPassage(
    summaryId: number,
    passageText: string,
    query: string,
    sourceType: SearchSourceType,
  ): Promise<ExplainPassageResponse> {
    return request("/api/search/explain-passage", {
      method: "POST",
      body: {
        summary_id: summaryId,
        passage_text: passageText,
        query,
        source_type: sourceType,
      },
    });
  },

  // V1 Phase 2 — Recent queries (server-side persistence)
  async getRecentQueries(): Promise<RecentQueriesResponse> {
    return request("/api/search/recent-queries", { method: "GET" });
  },

  async clearRecentQueries(): Promise<void> {
    await request("/api/search/recent-queries", { method: "DELETE" });
  },
};
```

- [ ] **Step 1.4: Run typecheck**

```bash
cd frontend && npm run typecheck
```

Expected : 0 erreur.

- [ ] **Step 1.5: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(search): add searchApi.searchGlobal/searchWithin/explainPassage/recentQueries"
```

---

## Task 2: Ajouter le feature key `semanticSearchTooltip` dans `planPrivileges.ts`

**Files:**

- Modify: `frontend/src/config/planPrivileges.ts`

**Dependencies:** Aucune.

- [ ] **Step 2.1: Étendre l'interface `PlanFeatures` (ligne ~178)**

Ajouter `semanticSearchTooltip: boolean;` à la fin de l'interface, avant la closing brace.

- [ ] **Step 2.2: Ajouter la valeur dans les 3 entrées de `PLAN_FEATURES`**

```typescript
free: { ...existing, semanticSearchTooltip: false },
pro:  { ...existing, semanticSearchTooltip: true  },
expert: { ...existing, semanticSearchTooltip: true },
```

(Garder l'ordre des autres clés intact — insérer juste avant `factcheck` ou la dernière clé existante du bloc.)

- [ ] **Step 2.3: Vérifier qu'aucun appel `hasFeature(plan, "semanticSearchTooltip")` ne pète au build (la fonction utilise `keyof PlanLimits` mais on a ajouté à `PlanFeatures`)** — pas besoin de toucher à `hasFeature` car cette feature est consultée directement via `PLAN_FEATURES[plan].semanticSearchTooltip`.

- [ ] **Step 2.4: Run typecheck**

```bash
cd frontend && npm run typecheck
```

Expected : 0 erreur.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/config/planPrivileges.ts
git commit -m "feat(search): add semanticSearchTooltip feature flag (free=off, pro/expert=on)"
```

---

## Task 3: Hook `useSemanticSearch` (debounce 300ms + React Query)

**Files:**

- Create: `frontend/src/components/search/useSemanticSearch.ts`
- Create: `frontend/src/components/search/__tests__/useSemanticSearch.test.ts`

**Dependencies:** Task 1.

- [ ] **Step 3.1: Créer le dossier `frontend/src/components/search/` et le fichier hook**

```typescript
// frontend/src/components/search/useSemanticSearch.ts
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchApi,
  type GlobalSearchResponse,
  type SearchFilters,
} from "../../services/api";

interface UseSemanticSearchOptions {
  query: string;
  filters: SearchFilters;
  limit?: number;
  /** debounce ms — defaults to 300, pass 0 to disable for tests */
  debounceMs?: number;
  /** disable the query entirely (e.g. when query.length < 2) */
  enabled?: boolean;
}

export function useSemanticSearch({
  query,
  filters,
  limit = 20,
  debounceMs = 300,
  enabled = true,
}: UseSemanticSearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (debounceMs === 0) {
      setDebouncedQuery(query);
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const trimmed = debouncedQuery.trim();
  const isEnabled = enabled && trimmed.length >= 2;

  return useQuery<GlobalSearchResponse, Error>({
    queryKey: ["search", "global", trimmed, filters, limit],
    queryFn: () => searchApi.searchGlobal(trimmed, filters, limit),
    enabled: isEnabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false, // search failures should not silently retry
  });
}
```

- [ ] **Step 3.2: Créer le test (TDD-style)**

```typescript
// frontend/src/components/search/__tests__/useSemanticSearch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSemanticSearch } from "../useSemanticSearch";
import { searchApi } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  searchApi: { searchGlobal: vi.fn() },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe("useSemanticSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not call API when query is empty", () => {
    const { result } = renderHook(
      () => useSemanticSearch({ query: "", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(searchApi.searchGlobal).not.toHaveBeenCalled();
  });

  it("does not call API when query has less than 2 chars", () => {
    renderHook(
      () => useSemanticSearch({ query: "a", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    expect(searchApi.searchGlobal).not.toHaveBeenCalled();
  });

  it("calls searchGlobal when query has >= 2 chars", async () => {
    (searchApi.searchGlobal as any).mockResolvedValue({
      query: "ai",
      total_results: 0,
      results: [],
      searched_at: "2026-05-03T12:00:00Z",
    });
    renderHook(
      () => useSemanticSearch({ query: "ai", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    await waitFor(() =>
      expect(searchApi.searchGlobal).toHaveBeenCalledWith("ai", {}, 20),
    );
  });

  it("debounces input changes", async () => {
    (searchApi.searchGlobal as any).mockResolvedValue({
      query: "f",
      total_results: 0,
      results: [],
      searched_at: "x",
    });
    const { rerender } = renderHook(
      ({ q }: { q: string }) =>
        useSemanticSearch({ query: q, filters: {}, debounceMs: 50 }),
      { wrapper, initialProps: { q: "ai" } },
    );
    rerender({ q: "ais" });
    rerender({ q: "aist" });
    // Wait for debounce + fetch
    await new Promise((r) => setTimeout(r, 100));
    await waitFor(() => {
      expect(searchApi.searchGlobal).toHaveBeenCalledTimes(1);
      expect(searchApi.searchGlobal).toHaveBeenLastCalledWith("aist", {}, 20);
    });
  });
});
```

- [ ] **Step 3.3: Run test**

```bash
cd frontend && npm run test -- --run src/components/search/__tests__/useSemanticSearch.test.ts
```

Expected : 4/4 pass.

- [ ] **Step 3.4: Commit**

```bash
git add frontend/src/components/search/useSemanticSearch.ts \
        frontend/src/components/search/__tests__/useSemanticSearch.test.ts
git commit -m "feat(search): add useSemanticSearch hook with 300ms debounce"
```

---

## Task 4: Hook `useRecentQueries` (localStorage + sync server)

**Files:**

- Create: `frontend/src/components/search/useRecentQueries.ts`

**Dependencies:** Task 1.

- [ ] **Step 4.1: Créer le hook**

```typescript
// frontend/src/components/search/useRecentQueries.ts
import { useCallback, useEffect, useState } from "react";
import { searchApi } from "../../services/api";

const STORAGE_KEY = "deepsight_recent_queries";
const MAX_LOCAL = 5;

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(queries: string[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(queries.slice(0, MAX_LOCAL)),
    );
  } catch {
    /* quota / private mode — silent ignore */
  }
}

export function useRecentQueries() {
  const [queries, setQueries] = useState<string[]>(() => readLocal());

  // Sync with server on mount (server has up to 10, merge with local)
  useEffect(() => {
    let cancelled = false;
    searchApi
      .getRecentQueries()
      .then(({ queries: server }) => {
        if (cancelled) return;
        const merged = Array.from(new Set([...readLocal(), ...server])).slice(
          0,
          MAX_LOCAL,
        );
        setQueries(merged);
        writeLocal(merged);
      })
      .catch(() => {
        /* offline / 404 / 401 — keep local */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setQueries((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(
        0,
        MAX_LOCAL,
      );
      writeLocal(next);
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    setQueries([]);
    writeLocal([]);
    try {
      await searchApi.clearRecentQueries();
    } catch {
      /* swallow */
    }
  }, []);

  return { queries, addQuery, clear };
}
```

- [ ] **Step 4.2: Run typecheck**

```bash
cd frontend && npm run typecheck
```

- [ ] **Step 4.3: Commit**

```bash
git add frontend/src/components/search/useRecentQueries.ts
git commit -m "feat(search): add useRecentQueries hook with localStorage + server sync"
```

---

## Task 5: Composant `SearchInput` (input + autocomplete)

**Files:**

- Create: `frontend/src/components/search/SearchInput.tsx`
- Create: `frontend/src/components/search/__tests__/SearchInput.test.tsx`

**Dependencies:** Task 4.

- [ ] **Step 5.1: Créer `SearchInput.tsx`**

```tsx
// frontend/src/components/search/SearchInput.tsx
import React, { useState, useRef } from "react";
import { Search, X, Clock } from "lucide-react";
import { useRecentQueries } from "./useRecentQueries";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: (q: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export const SearchInput: React.FC<Props> = ({
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  placeholder = "Rechercher dans tes analyses…",
}) => {
  const [focused, setFocused] = useState(false);
  const { queries: recent } = useRecentQueries();
  const inputRef = useRef<HTMLInputElement>(null);

  const showSuggestions =
    focused && value.trim().length === 0 && recent.length > 0;

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45 pointer-events-none"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) onSubmit(value);
          }}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full pl-12 pr-12 py-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl text-white placeholder-white/35 outline-none focus:border-indigo-500/40 focus:bg-white/[0.07] transition-colors"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {showSuggestions && (
        <ul
          role="listbox"
          aria-label="Recherches récentes"
          className="absolute z-30 left-0 right-0 mt-2 rounded-xl bg-[#12121a] border border-white/10 shadow-2xl overflow-hidden"
        >
          {recent.map((q) => (
            <li key={q}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before click
                  onChange(q);
                  onSubmit?.(q);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
              >
                <Clock className="w-4 h-4 text-white/40" aria-hidden />
                <span className="truncate">{q}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 5.2: Créer le test**

```tsx
// frontend/src/components/search/__tests__/SearchInput.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "../SearchInput";

vi.mock("../useRecentQueries", () => ({
  useRecentQueries: () => ({
    queries: ["transition énergétique", "crise énergie"],
    addQuery: vi.fn(),
    clear: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("SearchInput", () => {
  it("renders placeholder", () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/rechercher/i)).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} autoFocus={false} />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "ai");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows suggestions when focused with empty value", async () => {
    const user = userEvent.setup();
    render(<SearchInput value="" onChange={() => {}} autoFocus={false} />);
    await user.click(screen.getByRole("searchbox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("transition énergétique")).toBeInTheDocument();
  });

  it("clears value when X button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} autoFocus={false} />);
    await user.click(screen.getByLabelText(/effacer/i));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("calls onSubmit when pressing Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <SearchInput
        value="hello"
        onChange={() => {}}
        onSubmit={onSubmit}
        autoFocus={false}
      />,
    );
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });
});
```

- [ ] **Step 5.3: Run test**

```bash
cd frontend && npm run test -- --run src/components/search/__tests__/SearchInput.test.tsx
```

Expected : 5/5 pass.

- [ ] **Step 5.4: Commit**

```bash
git add frontend/src/components/search/SearchInput.tsx \
        frontend/src/components/search/__tests__/SearchInput.test.tsx
git commit -m "feat(search): add SearchInput with recent queries autocomplete"
```

---

## Task 6: Composants `SearchTypeBadge` + `SearchFiltersBar` + `SearchAdvancedFilters`

**Files:**

- Create: `frontend/src/components/search/SearchTypeBadge.tsx`
- Create: `frontend/src/components/search/SearchFiltersBar.tsx`
- Create: `frontend/src/components/search/SearchAdvancedFilters.tsx`
- Create: `frontend/src/components/search/__tests__/SearchFiltersBar.test.tsx`

**Dependencies:** Task 1.

- [ ] **Step 6.1: Créer `SearchTypeBadge.tsx`**

```tsx
// frontend/src/components/search/SearchTypeBadge.tsx
import React from "react";
import {
  BookOpen,
  Brain,
  BookMarked,
  MessageCircle,
  FileText,
} from "lucide-react";
import type { SearchSourceType } from "../../services/api";

const TYPE_CONFIG: Record<
  SearchSourceType,
  { label: string; icon: typeof BookOpen; bg: string; text: string }
> = {
  summary: {
    label: "Synthèse",
    icon: BookOpen,
    bg: "bg-blue-500/15",
    text: "text-blue-300",
  },
  flashcard: {
    label: "Flashcard",
    icon: BookMarked,
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  quiz: {
    label: "Quiz",
    icon: Brain,
    bg: "bg-amber-500/15",
    text: "text-amber-300",
  },
  chat: {
    label: "Chat",
    icon: MessageCircle,
    bg: "bg-indigo-500/15",
    text: "text-indigo-300",
  },
  transcript: {
    label: "Transcript",
    icon: FileText,
    bg: "bg-violet-500/15",
    text: "text-violet-300",
  },
};

export const SearchTypeBadge: React.FC<{ type: SearchSourceType }> = ({
  type,
}) => {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {cfg.label}
    </span>
  );
};
```

- [ ] **Step 6.2: Créer `SearchFiltersBar.tsx` (pills par type + bouton expand)**

```tsx
// frontend/src/components/search/SearchFiltersBar.tsx
import React from "react";
import { SlidersHorizontal } from "lucide-react";
import type { SearchSourceType, SearchFilters } from "../../services/api";

const ALL_TYPES: SearchSourceType[] = [
  "summary",
  "flashcard",
  "quiz",
  "chat",
  "transcript",
];
const TYPE_LABELS: Record<SearchSourceType, string> = {
  summary: "Synthèse",
  flashcard: "Flashcards",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcripts",
};

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  countsByType?: Partial<Record<SearchSourceType, number>>;
  totalCount?: number;
  onToggleAdvanced: () => void;
  advancedOpen: boolean;
}

export const SearchFiltersBar: React.FC<Props> = ({
  filters,
  onChange,
  countsByType = {},
  totalCount,
  onToggleAdvanced,
  advancedOpen,
}) => {
  const active = filters.source_types ?? [];
  const isAll = active.length === 0;

  const toggleAll = () => onChange({ ...filters, source_types: undefined });
  const toggleType = (t: SearchSourceType) => {
    const set = new Set(active);
    set.has(t) ? set.delete(t) : set.add(t);
    onChange({
      ...filters,
      source_types: set.size === 0 ? undefined : Array.from(set),
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleAll}
        aria-pressed={isAll}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          isAll
            ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40"
            : "bg-white/5 text-white/65 border border-white/10 hover:bg-white/10"
        }`}
      >
        Tout {totalCount !== undefined ? `(${totalCount})` : ""}
      </button>
      {ALL_TYPES.map((t) => {
        const isActive = active.includes(t);
        const n = countsByType[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggleType(t)}
            aria-pressed={isActive}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40"
                : "bg-white/5 text-white/65 border border-white/10 hover:bg-white/10"
            }`}
          >
            {TYPE_LABELS[t]}
            {typeof n === "number" ? ` ${n}` : ""}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onToggleAdvanced}
        aria-expanded={advancedOpen}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white hover:bg-white/10"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtres avancés
      </button>
    </div>
  );
};
```

- [ ] **Step 6.3: Créer `SearchAdvancedFilters.tsx`**

```tsx
// frontend/src/components/search/SearchAdvancedFilters.tsx
import React from "react";
import type { SearchFilters } from "../../services/api";

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}

export const SearchAdvancedFilters: React.FC<Props> = ({
  filters,
  onChange,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Plateforme</span>
        <select
          value={filters.platform ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              platform: (e.target.value ||
                undefined) as SearchFilters["platform"],
            })
          }
          className="bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
        >
          <option value="">Toutes</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="text">Texte</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Langue</span>
        <select
          value={filters.lang ?? ""}
          onChange={(e) =>
            onChange({ ...filters, lang: e.target.value || undefined })
          }
          className="bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
        >
          <option value="">Toutes</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Catégorie</span>
        <input
          type="text"
          value={filters.category ?? ""}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value || undefined })
          }
          placeholder="ex: science, politique…"
          className="bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Période</span>
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.date_from ?? ""}
            onChange={(e) =>
              onChange({ ...filters, date_from: e.target.value || undefined })
            }
            className="flex-1 bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
          />
          <input
            type="date"
            value={filters.date_to ?? ""}
            onChange={(e) =>
              onChange({ ...filters, date_to: e.target.value || undefined })
            }
            className="flex-1 bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!filters.favorites_only}
          onChange={(e) =>
            onChange({
              ...filters,
              favorites_only: e.target.checked || undefined,
            })
          }
        />
        <span className="text-white/85">Favoris uniquement</span>
      </label>
    </div>
  );
};
```

- [ ] **Step 6.4: Créer le test pour `SearchFiltersBar`**

```tsx
// frontend/src/components/search/__tests__/SearchFiltersBar.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchFiltersBar } from "../SearchFiltersBar";

afterEach(cleanup);

describe("SearchFiltersBar", () => {
  it("renders 'Tout' active by default when no source_types", () => {
    render(
      <SearchFiltersBar
        filters={{}}
        onChange={() => {}}
        onToggleAdvanced={() => {}}
        advancedOpen={false}
      />,
    );
    const all = screen.getByRole("button", { name: /Tout/ });
    expect(all).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles a type pill on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchFiltersBar
        filters={{}}
        onChange={onChange}
        onToggleAdvanced={() => {}}
        advancedOpen={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Synthèse/ }));
    expect(onChange).toHaveBeenCalledWith({ source_types: ["summary"] });
  });

  it("expands advanced filters when clicked", async () => {
    const user = userEvent.setup();
    const onToggleAdvanced = vi.fn();
    render(
      <SearchFiltersBar
        filters={{}}
        onChange={() => {}}
        onToggleAdvanced={onToggleAdvanced}
        advancedOpen={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Filtres avancés/ }));
    expect(onToggleAdvanced).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.5: Run tests**

```bash
cd frontend && npm run test -- --run src/components/search/__tests__/SearchFiltersBar.test.tsx
```

Expected : 3/3 pass.

- [ ] **Step 6.6: Commit**

```bash
git add frontend/src/components/search/SearchTypeBadge.tsx \
        frontend/src/components/search/SearchFiltersBar.tsx \
        frontend/src/components/search/SearchAdvancedFilters.tsx \
        frontend/src/components/search/__tests__/SearchFiltersBar.test.tsx
git commit -m "feat(search): add SearchTypeBadge + filter pills + advanced filters"
```

---

## Task 7: `SearchResultCard` + `SearchEmptyState` + `SearchResultsList`

**Files:**

- Create: `frontend/src/components/search/SearchResultCard.tsx`
- Create: `frontend/src/components/search/SearchEmptyState.tsx`
- Create: `frontend/src/components/search/SearchResultsList.tsx`
- Create: `frontend/src/components/search/__tests__/SearchResultCard.test.tsx`

**Dependencies:** Task 1, Task 6.

- [ ] **Step 7.1: Créer `SearchResultCard.tsx`**

```tsx
// frontend/src/components/search/SearchResultCard.tsx
import React from "react";
import { ChevronRight } from "lucide-react";
import { SearchTypeBadge } from "./SearchTypeBadge";
import type { GlobalSearchResult } from "../../services/api";

interface Props {
  result: GlobalSearchResult;
  query: string;
  onOpen: (r: GlobalSearchResult) => void;
}

/** Bold the query terms inside the preview text. */
function highlight(preview: string, q: string): React.ReactNode {
  if (!q.trim()) return preview;
  const re = new RegExp(
    `(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "ig",
  );
  const parts = preview.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-amber-400/30 text-amber-100 rounded px-0.5">
        {p}
      </mark>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export const SearchResultCard: React.FC<Props> = ({
  result,
  query,
  onOpen,
}) => {
  const meta = result.source_metadata;
  const title = meta.summary_title ?? "Analyse sans titre";
  const channel = meta.channel ?? "";
  const thumb = meta.summary_thumbnail;
  const score = (result.score * 100).toFixed(0);

  return (
    <button
      type="button"
      onClick={() => onOpen(result)}
      data-testid="search-result-card"
      className="w-full text-left flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/5 hover:border-white/20 transition-colors group"
    >
      {thumb && (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="w-24 h-16 sm:w-32 sm:h-20 rounded-md object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <SearchTypeBadge type={result.source_type} />
          <span className="text-[11px] font-mono text-white/40">
            score {score}%
          </span>
        </div>
        <h3 className="text-sm font-medium text-white truncate">{title}</h3>
        {channel && <p className="text-xs text-white/45 truncate">{channel}</p>}
        <p className="text-sm text-white/70 mt-1 line-clamp-2">
          {highlight(result.text_preview, query)}
        </p>
      </div>
      <ChevronRight className="self-center w-4 h-4 text-white/25 group-hover:text-white/65 flex-shrink-0" />
    </button>
  );
};
```

- [ ] **Step 7.2: Créer `SearchEmptyState.tsx`**

```tsx
// frontend/src/components/search/SearchEmptyState.tsx
import React from "react";
import { Search as SearchIcon, Inbox } from "lucide-react";

interface Props {
  variant: "no-query" | "no-results";
  query?: string;
  recentQueries?: string[];
  onPickQuery?: (q: string) => void;
}

export const SearchEmptyState: React.FC<Props> = ({
  variant,
  query,
  recentQueries = [],
  onPickQuery,
}) => {
  if (variant === "no-query") {
    return (
      <div className="text-center py-16">
        <SearchIcon
          className="w-10 h-10 text-white/25 mx-auto mb-3"
          aria-hidden
        />
        <p className="text-white/65 mb-1">
          Cherche dans toutes tes analyses, flashcards, quiz et chats.
        </p>
        {recentQueries.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-white/40 mb-2">Recherches récentes</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {recentQueries.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onPickQuery?.(q)}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <Inbox className="w-10 h-10 text-white/25 mx-auto mb-3" aria-hidden />
      <p className="text-white/85 mb-1">Aucun résultat pour « {query} »</p>
      <p className="text-sm text-white/45">
        Essaie une formulation différente ou retire un filtre.
      </p>
    </div>
  );
};
```

- [ ] **Step 7.3: Créer `SearchResultsList.tsx` avec virtual scroll**

```tsx
// frontend/src/components/search/SearchResultsList.tsx
import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SearchResultCard } from "./SearchResultCard";
import type { GlobalSearchResult } from "../../services/api";

interface Props {
  results: GlobalSearchResult[];
  query: string;
  onOpen: (r: GlobalSearchResult) => void;
}

export const SearchResultsList: React.FC<Props> = ({
  results,
  query,
  onOpen,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 6,
  });

  return (
    <div
      ref={parentRef}
      className="w-full max-w-3xl mx-auto overflow-y-auto"
      style={{ maxHeight: "calc(100vh - 280px)" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const r = results[vi.index];
          return (
            <div
              key={`${r.source_type}-${r.source_id}`}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
                paddingBottom: 8,
              }}
            >
              <SearchResultCard result={r} query={query} onOpen={onOpen} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 7.4: Test pour `SearchResultCard`**

```tsx
// frontend/src/components/search/__tests__/SearchResultCard.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResultCard } from "../SearchResultCard";
import type { GlobalSearchResult } from "../../../services/api";

afterEach(cleanup);

const mockResult: GlobalSearchResult = {
  source_type: "summary",
  source_id: 42,
  summary_id: 42,
  score: 0.91,
  text_preview:
    "La transition énergétique impose une refonte du mix électrique européen.",
  source_metadata: {
    summary_title: "Crise énergétique EU",
    channel: "Le Monde",
    summary_thumbnail: "https://img.example/thumb.jpg",
    tab: "synthesis",
  },
};

describe("SearchResultCard", () => {
  it("renders title, channel and score", () => {
    render(<SearchResultCard result={mockResult} query="" onOpen={() => {}} />);
    expect(screen.getByText("Crise énergétique EU")).toBeInTheDocument();
    expect(screen.getByText("Le Monde")).toBeInTheDocument();
    expect(screen.getByText(/score 91%/)).toBeInTheDocument();
  });

  it("renders the type badge", () => {
    render(<SearchResultCard result={mockResult} query="" onOpen={() => {}} />);
    expect(screen.getByText("Synthèse")).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <SearchResultCard result={mockResult} query="énergie" onOpen={onOpen} />,
    );
    await user.click(screen.getByTestId("search-result-card"));
    expect(onOpen).toHaveBeenCalledWith(mockResult);
  });

  it("highlights the query term in preview", () => {
    render(
      <SearchResultCard
        result={mockResult}
        query="transition"
        onOpen={() => {}}
      />,
    );
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7.5: Run tests**

```bash
cd frontend && npm run test -- --run src/components/search/__tests__/SearchResultCard.test.tsx
```

Expected : 4/4 pass.

- [ ] **Step 7.6: Commit**

```bash
git add frontend/src/components/search/SearchResultCard.tsx \
        frontend/src/components/search/SearchEmptyState.tsx \
        frontend/src/components/search/SearchResultsList.tsx \
        frontend/src/components/search/__tests__/SearchResultCard.test.tsx
git commit -m "feat(search): add SearchResultCard + EmptyState + virtualized ResultsList"
```

---

## Task 8: Page `SearchPage` — assembly + URL state + click flow vers Hub

**Files:**

- Create: `frontend/src/pages/SearchPage.tsx`
- Create: `frontend/src/pages/__tests__/SearchPage.test.tsx`

**Dependencies:** Task 3, Task 4, Task 5, Task 6, Task 7.

- [ ] **Step 8.1: Créer `SearchPage.tsx`**

```tsx
// frontend/src/pages/SearchPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { DeepSightSpinner } from "../components/ui/DeepSightSpinner";
import { SearchInput } from "../components/search/SearchInput";
import { SearchFiltersBar } from "../components/search/SearchFiltersBar";
import { SearchAdvancedFilters } from "../components/search/SearchAdvancedFilters";
import { SearchResultsList } from "../components/search/SearchResultsList";
import { SearchEmptyState } from "../components/search/SearchEmptyState";
import { useSemanticSearch } from "../components/search/useSemanticSearch";
import { useRecentQueries } from "../components/search/useRecentQueries";
import type {
  GlobalSearchResult,
  SearchFilters,
  SearchSourceType,
} from "../services/api";
import { analytics } from "../services/analytics";

const SearchPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { addQuery, queries: recent } = useRecentQueries();

  // URL ⇄ state sync
  const initialQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const initialTypes = useMemo<SearchSourceType[] | undefined>(() => {
    const raw = params.get("types");
    if (!raw) return undefined;
    return raw.split(",").filter(Boolean) as SearchSourceType[];
  }, [params]);
  const [filters, setFilters] = useState<SearchFilters>({
    source_types: initialTypes,
    platform: (params.get("platform") ||
      undefined) as SearchFilters["platform"],
    lang: params.get("lang") || undefined,
    category: params.get("category") || undefined,
    favorites_only: params.get("favs") === "1" || undefined,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync state → URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (filters.source_types?.length)
      next.set("types", filters.source_types.join(","));
    if (filters.platform) next.set("platform", filters.platform);
    if (filters.lang) next.set("lang", filters.lang);
    if (filters.category) next.set("category", filters.category);
    if (filters.favorites_only) next.set("favs", "1");
    setParams(next, { replace: true });
  }, [query, filters, setParams]);

  const { data, isFetching, error } = useSemanticSearch({ query, filters });

  // Track query when results land
  useEffect(() => {
    if (data && query.trim().length >= 2) {
      addQuery(query);
      analytics.track?.("search_query", {
        query_length: query.length,
        results_count: data.total_results,
        latency_ms: undefined, // backend latency not exposed currently
        has_filters: Object.keys(filters).some(
          (k) => (filters as Record<string, unknown>)[k] !== undefined,
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.searched_at]);

  const countsByType = useMemo<
    Partial<Record<SearchSourceType, number>>
  >(() => {
    if (!data) return {};
    const counts: Partial<Record<SearchSourceType, number>> = {};
    for (const r of data.results) {
      counts[r.source_type] = (counts[r.source_type] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const handleOpen = (r: GlobalSearchResult) => {
    analytics.track?.("search_result_clicked", {
      position: data?.results.indexOf(r) ?? -1,
      source_type: r.source_type,
      score: r.score,
    });
    const tab = r.source_metadata.tab ?? "synthesis";
    const url = new URLSearchParams({
      summaryId: String(r.summary_id),
      q: query,
      highlight: `${r.source_type}-${r.source_id}`,
      tab,
    });
    navigate(`/hub?${url.toString()}`);
  };

  const isEmptyQuery = query.trim().length < 2;
  const hasResults = !!data && data.results.length > 0;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary relative">
      <SEO title="Recherche — Deep Sight" noindex />
      <DoodleBackground />
      <Sidebar />
      <main
        id="main-content"
        className="lg:pl-[240px] pt-6 pb-12 px-4 sm:px-6 lg:px-8 relative z-10"
      >
        <div className="max-w-5xl mx-auto space-y-6">
          <header>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-1">
              Recherche
            </h1>
            <p className="text-sm text-white/55">
              Sémantique sur tes analyses, flashcards, quiz et chats.
            </p>
          </header>

          <SearchInput value={query} onChange={setQuery} onSubmit={setQuery} />

          <SearchFiltersBar
            filters={filters}
            onChange={setFilters}
            countsByType={countsByType}
            totalCount={data?.total_results}
            onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
            advancedOpen={advancedOpen}
          />

          {advancedOpen && (
            <SearchAdvancedFilters filters={filters} onChange={setFilters} />
          )}

          {error && (
            <div className="text-center py-8 text-red-300">
              Une erreur est survenue. Réessaie dans un instant.
            </div>
          )}

          {!error && isFetching && (
            <div className="flex justify-center py-10">
              <DeepSightSpinner size="md" />
            </div>
          )}

          {!error && !isFetching && isEmptyQuery && (
            <SearchEmptyState
              variant="no-query"
              recentQueries={recent}
              onPickQuery={(q) => setQuery(q)}
            />
          )}

          {!error && !isFetching && !isEmptyQuery && !hasResults && (
            <SearchEmptyState variant="no-results" query={query} />
          )}

          {!error && !isFetching && hasResults && data && (
            <SearchResultsList
              results={data.results}
              query={query}
              onOpen={handleOpen}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
```

- [ ] **Step 8.2: Créer le test page-level (mock api + RQ wrapper)**

```tsx
// frontend/src/pages/__tests__/SearchPage.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchPage from "../SearchPage";
import { searchApi } from "../../services/api";

vi.mock("../../services/api", () => ({
  searchApi: {
    searchGlobal: vi.fn(),
    getRecentQueries: vi.fn().mockResolvedValue({ queries: [] }),
    clearRecentQueries: vi.fn(),
  },
}));
vi.mock("../../components/layout/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../../components/DoodleBackground", () => ({ default: () => null }));
vi.mock("../../components/SEO", () => ({ SEO: () => null }));
vi.mock("../../services/analytics", () => ({ analytics: { track: vi.fn() } }));

afterEach(cleanup);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/search"]}>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SearchPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the no-query empty state initially", () => {
    renderPage();
    expect(screen.getByText(/cherche dans toutes/i)).toBeInTheDocument();
  });

  it("calls searchGlobal when typing >= 2 chars", async () => {
    (searchApi.searchGlobal as any).mockResolvedValue({
      query: "ai",
      total_results: 0,
      results: [],
      searched_at: "2026-05-03T12:00:00Z",
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByRole("searchbox"), "ai");
    await waitFor(() => expect(searchApi.searchGlobal).toHaveBeenCalled(), {
      timeout: 1000,
    });
  });
});
```

- [ ] **Step 8.3: Run tests**

```bash
cd frontend && npm run test -- --run src/pages/__tests__/SearchPage.test.tsx
```

Expected : 2/2 pass.

- [ ] **Step 8.4: Commit**

```bash
git add frontend/src/pages/SearchPage.tsx \
        frontend/src/pages/__tests__/SearchPage.test.tsx
git commit -m "feat(search): add SearchPage with URL state sync and click flow to /hub"
```

---

## Task 9: Enregistrer la route `/search` dans `App.tsx` + ajout au sidebar

**Files:**

- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/sidebar/SidebarNav.tsx`
- Modify: `frontend/src/i18n/fr.json` + `en.json`

**Dependencies:** Task 8.

- [ ] **Step 9.1: Dans `App.tsx`, ajouter le lazy import (après `History`, ligne ~315)**

```typescript
const SearchPage = lazyWithRetry(() => import("./pages/SearchPage"));
```

- [ ] **Step 9.2: Ajouter la route protégée juste après `/history`**

```tsx
<Route
  path="/search"
  element={
    <RouteErrorBoundary variant="full" componentName="SearchPage">
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <SearchPage />
      </Suspense>
    </RouteErrorBoundary>
  }
/>
```

- [ ] **Step 9.3: Ajouter `/search` au `PREFETCH_MAP` (sous `/dashboard` array, et créer une entrée `"/history": [...]` pour également prefetch /search)**

```typescript
"/dashboard": [
  "/history", "/settings", "/debate", "/analytics",
  "/hub", "/chat", "/voice-call", "/study", "/about",
  "/search", // ← add
],
"/history": ["/dashboard", "/analytics", "/search"],
```

Et ajouter au `PAGE_LOADERS` :

```typescript
"/search": () => import("./pages/SearchPage"),
```

- [ ] **Step 9.4: Modifier `frontend/src/components/layout/Sidebar.tsx` — ajouter le NavItem Search**

Importer `Search` depuis `lucide-react` (ajouter à la liste d'imports existante).
Dans le 1er pill group, **entre `/history` et `/debate`** :

```tsx
<NavItem
  to="/search"
  icon={Search}
  label={language === "fr" ? "Recherche" : "Search"}
  collapsed={collapsed}
/>
```

- [ ] **Step 9.5: Modifier `frontend/src/components/sidebar/SidebarNav.tsx` (composant orphelin mentionné par le spec — synchroniser pour cohérence)**

Importer `Search` et ajouter `{ path: "/search", icon: Search, label: "Recherche" }` à `navItems` entre History et Hub.

- [ ] **Step 9.6: Ajouter clés i18n**

Dans `frontend/src/i18n/fr.json`, sous `nav` :

```json
"search": "Recherche"
```

Dans `en.json` :

```json
"search": "Search"
```

- [ ] **Step 9.7: Run typecheck + lint + tests existants**

```bash
cd frontend && npm run typecheck && npm run lint && npm run test -- --run
```

Expected : tout green.

- [ ] **Step 9.8: Commit**

```bash
git add frontend/src/App.tsx \
        frontend/src/components/layout/Sidebar.tsx \
        frontend/src/components/sidebar/SidebarNav.tsx \
        frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat(search): register /search route + sidebar nav item + i18n"
```

---

## Task 10: Styles `highlight.css` + import global

**Files:**

- Create: `frontend/src/styles/highlight.css`
- Modify: `frontend/src/index.css`

**Dependencies:** Aucune.

- [ ] **Step 10.1: Créer `highlight.css` (verbatim depuis le spec section 4.6)**

```css
/* frontend/src/styles/highlight.css
   Semantic Search V1 highlight visuals.
   amber-400 = rgb(251 191 36) ; amber-300 = rgb(252 211 77) */

.ds-highlight {
  background: rgb(251 191 36 / 0.35);
  color: rgb(252 211 77);
  padding: 0 2px;
  border-radius: 2px;
  border-bottom: 2px solid rgb(251 191 36);
  cursor: pointer;
  transition: background 200ms ease;
}
.ds-highlight:hover {
  background: rgb(251 191 36 / 0.55);
}
.ds-highlight.flash {
  animation: ds-highlight-flash 800ms ease-in-out;
}
@keyframes ds-highlight-flash {
  0%,
  100% {
    background: rgb(251 191 36 / 0.35);
  }
  50% {
    background: rgb(251 191 36 / 0.85);
  }
}

/* Honour reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  .ds-highlight.flash {
    animation: none;
  }
}
```

- [ ] **Step 10.2: Importer dans `frontend/src/index.css` (en haut, sous les autres `@import`)**

```css
@import "./styles/highlight.css";
```

- [ ] **Step 10.3: Build sanity check**

```bash
cd frontend && npm run build
```

Expected : pas d'erreur Vite, le CSS est inclus dans le bundle.

- [ ] **Step 10.4: Commit**

```bash
git add frontend/src/styles/highlight.css frontend/src/index.css
git commit -m "feat(highlight): add highlight.css with .ds-highlight and flash animation"
```

---

## Task 11: `SemanticHighlightProvider` + Context + types

**Files:**

- Create: `frontend/src/components/highlight/SemanticHighlightContext.ts`
- Create: `frontend/src/components/highlight/SemanticHighlightProvider.tsx`
- Create: `frontend/src/components/highlight/useSemanticHighlight.ts`

**Dependencies:** Task 1.

- [ ] **Step 11.1: Créer `SemanticHighlightContext.ts`**

```typescript
// frontend/src/components/highlight/SemanticHighlightContext.ts
import { createContext } from "react";
import type { WithinMatch } from "../../services/api";

export interface SemanticHighlightState {
  /** Active query — empty string when search bar closed */
  query: string;
  /** Loading state for /api/search/within */
  loading: boolean;
  /** Matches across all tabs */
  matches: WithinMatch[];
  /** Index in `matches` of the currently focused match (-1 if none) */
  currentIndex: number;
  /** Tab to switch to when current match is selected */
  activeTab: WithinMatch["tab"] | null;
  /** Open a search session */
  setQuery: (q: string) => void;
  /** Close the search session (clears matches) */
  close: () => void;
  /** Navigate next/prev match (wraps) */
  next: () => void;
  prev: () => void;
  /** Jump to a specific passage_id (e.g. from search result deeplink) */
  focus: (passageId: string) => void;
}

export const SemanticHighlightContext =
  createContext<SemanticHighlightState | null>(null);
```

- [ ] **Step 11.2: Créer `SemanticHighlightProvider.tsx`**

```tsx
// frontend/src/components/highlight/SemanticHighlightProvider.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { searchApi, type WithinMatch } from "../../services/api";
import {
  SemanticHighlightContext,
  type SemanticHighlightState,
} from "./SemanticHighlightContext";

interface Props {
  summaryId: number | null;
  children: React.ReactNode;
}

export const SemanticHighlightProvider: React.FC<Props> = ({
  summaryId,
  children,
}) => {
  const [query, setQueryRaw] = useState("");
  const [matches, setMatches] = useState<WithinMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const debounceRef = useRef<number | undefined>(undefined);

  const fetchMatches = useCallback(
    async (q: string) => {
      if (!summaryId || q.trim().length < 2) {
        setMatches([]);
        setCurrentIndex(-1);
        return;
      }
      setLoading(true);
      try {
        const res = await searchApi.searchWithin(summaryId, q.trim());
        setMatches(res.matches);
        setCurrentIndex(res.matches.length > 0 ? 0 : -1);
      } catch {
        setMatches([]);
        setCurrentIndex(-1);
      } finally {
        setLoading(false);
      }
    },
    [summaryId],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryRaw(q);
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => fetchMatches(q), 200);
    },
    [fetchMatches],
  );

  const close = useCallback(() => {
    setQueryRaw("");
    setMatches([]);
    setCurrentIndex(-1);
  }, []);

  const next = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const prev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i <= 0 ? matches.length - 1 : i - 1));
  }, [matches.length]);

  const focus = useCallback(
    (passageId: string) => {
      const idx = matches.findIndex((m) => m.passage_id === passageId);
      if (idx >= 0) setCurrentIndex(idx);
    },
    [matches],
  );

  // Cleanup
  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current);
    },
    [],
  );

  const activeTab = matches[currentIndex]?.tab ?? null;

  const state: SemanticHighlightState = useMemo(
    () => ({
      query,
      loading,
      matches,
      currentIndex,
      activeTab,
      setQuery,
      close,
      next,
      prev,
      focus,
    }),
    [
      query,
      loading,
      matches,
      currentIndex,
      activeTab,
      setQuery,
      close,
      next,
      prev,
      focus,
    ],
  );

  return (
    <SemanticHighlightContext.Provider value={state}>
      {children}
    </SemanticHighlightContext.Provider>
  );
};
```

- [ ] **Step 11.3: Créer `useSemanticHighlight.ts`**

```typescript
// frontend/src/components/highlight/useSemanticHighlight.ts
import { useContext } from "react";
import {
  SemanticHighlightContext,
  type SemanticHighlightState,
} from "./SemanticHighlightContext";

/** Returns the highlight state, or null if not within a provider. */
export function useSemanticHighlight(): SemanticHighlightState | null {
  return useContext(SemanticHighlightContext);
}
```

- [ ] **Step 11.4: Run typecheck**

```bash
cd frontend && npm run typecheck
```

- [ ] **Step 11.5: Commit**

```bash
git add frontend/src/components/highlight/SemanticHighlightContext.ts \
        frontend/src/components/highlight/SemanticHighlightProvider.tsx \
        frontend/src/components/highlight/useSemanticHighlight.ts
git commit -m "feat(highlight): add SemanticHighlightProvider context with debounced within fetch"
```

---

## Task 12: `HighlightedText` (DOM post-process pour injecter `<mark>`)

**Files:**

- Create: `frontend/src/components/highlight/HighlightedText.tsx`
- Create: `frontend/src/components/highlight/__tests__/HighlightedText.test.tsx`

**Dependencies:** Task 10, Task 11.

> **Note technique** : on n'utilise PAS la traversée du DOM via Range (trop fragile avec re-renders React et `react-markdown`). On opère via une **passe de remplacement DOM dans `useEffect`** sur un container `ref`, en wrappant chaque occurrence du texte de match dans un `<mark>`. Pour rester simple et robuste : on utilise les `start_offset` / `end_offset` retournés par le backend dans le tab actif uniquement (string position dans le markdown brut).

> **Approche V1 retenue (pragmatique)** : injecter les `<mark>` après render, en cherchant le passage `text` exact dans les nodes texte du container. C'est correct pour 95% des cas (texte simple, sans inline formatting cassant le span). Les cas où le passage chevauche du markdown inline (gras, lien) seront skippés silencieusement — acceptable pour V1.

- [ ] **Step 12.1: Créer `HighlightedText.tsx`**

```tsx
// frontend/src/components/highlight/HighlightedText.tsx
import React, { useEffect, useRef } from "react";
import { useSemanticHighlight } from "./useSemanticHighlight";
import type { WithinMatch } from "../../services/api";

interface Props {
  /** Tab identity — only matches for this tab are rendered */
  tab: WithinMatch["tab"];
  /** Click handler (passage_id) — typically opens ExplainTooltip */
  onMarkClick?: (passageId: string, passage: WithinMatch) => void;
  children: React.ReactNode;
}

/**
 * Wrapper that traverses children DOM after render and wraps text spans
 * matching `match.text` with <mark className="ds-highlight">.
 * Idempotent: clears previous marks on every effect run.
 */
export const HighlightedText: React.FC<Props> = ({
  tab,
  onMarkClick,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useSemanticHighlight();

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // 1. Strip previous marks (unwrap)
    root.querySelectorAll("mark.ds-highlight").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });

    if (!ctx || ctx.matches.length === 0) return;

    const tabMatches = ctx.matches.filter((m) => m.tab === tab);
    if (tabMatches.length === 0) return;

    // 2. Walk text nodes and wrap exact `text` occurrences
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets: { node: Text; match: WithinMatch }[] = [];
    let node: Node | null = walker.nextNode();
    while (node) {
      const txt = node.nodeValue ?? "";
      for (const m of tabMatches) {
        const idx = txt.indexOf(m.text);
        if (idx >= 0) {
          targets.push({ node: node as Text, match: m });
          break; // first match per text node — others picked up next pass
        }
      }
      node = walker.nextNode();
    }

    targets.forEach(({ node: textNode, match }) => {
      const txt = textNode.nodeValue ?? "";
      const idx = txt.indexOf(match.text);
      if (idx < 0) return;
      const before = txt.slice(0, idx);
      const after = txt.slice(idx + match.text.length);
      const parent = textNode.parentNode;
      if (!parent) return;
      const mark = document.createElement("mark");
      mark.className = "ds-highlight";
      mark.dataset.passageId = match.passage_id;
      mark.setAttribute(
        "aria-label",
        `Passage correspondant : ${match.text.slice(0, 60)}`,
      );
      mark.textContent = match.text;
      if (ctx.matches[ctx.currentIndex]?.passage_id === match.passage_id) {
        mark.classList.add("flash");
      }
      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(mark);
      if (after) fragment.appendChild(document.createTextNode(after));
      parent.replaceChild(fragment, textNode);
    });

    // 3. Auto-scroll to current
    if (
      ctx.currentIndex >= 0 &&
      tabMatches.includes(ctx.matches[ctx.currentIndex])
    ) {
      const target = root.querySelector<HTMLElement>(
        `mark.ds-highlight[data-passage-id="${ctx.matches[ctx.currentIndex].passage_id}"]`,
      );
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    // 4. Wire click handlers
    if (onMarkClick) {
      const handler = (e: Event) => {
        const target = (e.target as HTMLElement).closest<HTMLElement>(
          "mark.ds-highlight",
        );
        if (!target) return;
        const id = target.dataset.passageId;
        if (!id) return;
        const match = ctx.matches.find((m) => m.passage_id === id);
        if (match) onMarkClick(id, match);
      };
      root.addEventListener("click", handler);
      return () => root.removeEventListener("click", handler);
    }
  }, [ctx?.matches, ctx?.currentIndex, tab, onMarkClick, ctx]);

  return (
    <div ref={containerRef} data-highlight-tab={tab}>
      {children}
    </div>
  );
};
```

- [ ] **Step 12.2: Test unitaire**

```tsx
// frontend/src/components/highlight/__tests__/HighlightedText.test.tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { HighlightedText } from "../HighlightedText";
import { SemanticHighlightContext } from "../SemanticHighlightContext";
import type { WithinMatch } from "../../../services/api";

afterEach(cleanup);

const mockMatch: WithinMatch = {
  source_type: "summary",
  source_id: 1,
  text: "transition énergétique",
  text_html: "transition énergétique",
  start_offset: 0,
  end_offset: 22,
  tab: "synthesis",
  score: 0.91,
  passage_id: "p1",
};

const wrap =
  (matches: WithinMatch[], idx = 0) =>
  ({ children }: { children: React.ReactNode }) => (
    <SemanticHighlightContext.Provider
      value={{
        query: "transition",
        loading: false,
        matches,
        currentIndex: idx,
        activeTab: "synthesis",
        setQuery: () => {},
        close: () => {},
        next: () => {},
        prev: () => {},
        focus: () => {},
      }}
    >
      {children}
    </SemanticHighlightContext.Provider>
  );

describe("HighlightedText", () => {
  it("wraps a matching text span in <mark>", () => {
    const Wrapper = wrap([mockMatch]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="synthesis">
          <p>La transition énergétique impose une refonte.</p>
        </HighlightedText>
      </Wrapper>,
    );
    const mark = container.querySelector("mark.ds-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("transition énergétique");
    expect(mark?.getAttribute("data-passage-id")).toBe("p1");
  });

  it("does not wrap when no matches", () => {
    const Wrapper = wrap([]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="synthesis">
          <p>La transition énergétique.</p>
        </HighlightedText>
      </Wrapper>,
    );
    expect(container.querySelector("mark.ds-highlight")).toBeNull();
  });

  it("only wraps for matching tab", () => {
    const Wrapper = wrap([mockMatch]);
    const { container } = render(
      <Wrapper>
        <HighlightedText tab="quiz">
          <p>La transition énergétique.</p>
        </HighlightedText>
      </Wrapper>,
    );
    expect(container.querySelector("mark.ds-highlight")).toBeNull();
  });
});
```

- [ ] **Step 12.3: Run tests**

```bash
cd frontend && npm run test -- --run src/components/highlight/__tests__/HighlightedText.test.tsx
```

Expected : 3/3 pass.

- [ ] **Step 12.4: Commit**

```bash
git add frontend/src/components/highlight/HighlightedText.tsx \
        frontend/src/components/highlight/__tests__/HighlightedText.test.tsx
git commit -m "feat(highlight): add HighlightedText DOM-walker that injects <mark> spans"
```

---

## Task 13: `HighlightNavigationBar` (compteur + ↑/↓ + close)

**Files:**

- Create: `frontend/src/components/highlight/HighlightNavigationBar.tsx`
- Create: `frontend/src/components/highlight/__tests__/HighlightNavigationBar.test.tsx`

**Dependencies:** Task 11.

- [ ] **Step 13.1: Créer le composant**

```tsx
// frontend/src/components/highlight/HighlightNavigationBar.tsx
import React, { useEffect } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { useSemanticHighlight } from "./useSemanticHighlight";

export const HighlightNavigationBar: React.FC = () => {
  const ctx = useSemanticHighlight();

  // Keyboard shortcuts F3 / Shift+F3 for next/prev (browser standard)
  useEffect(() => {
    if (!ctx || ctx.matches.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        e.shiftKey ? ctx.prev() : ctx.next();
      }
      if (e.key === "Escape" && ctx.query) {
        e.preventDefault();
        ctx.close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx]);

  if (!ctx || ctx.matches.length === 0) return null;

  const total = ctx.matches.length;
  const current = ctx.currentIndex + 1;

  return (
    <nav
      role="navigation"
      aria-label="Résultats de recherche"
      className="sticky top-[56px] z-40 mx-auto w-full max-w-3xl px-4"
    >
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121a]/95 border border-amber-500/30 backdrop-blur-xl shadow-lg">
        <span
          className="text-sm font-mono text-amber-300 tabular-nums"
          aria-live="polite"
        >
          {current}/{total}
        </span>
        <span className="flex-1 truncate text-xs text-white/55">
          « {ctx.query} »
        </span>
        <button
          type="button"
          onClick={ctx.prev}
          aria-label="Match précédent"
          aria-keyshortcuts="Shift+F3"
          className="p-1.5 rounded-md text-white/65 hover:bg-white/5 hover:text-white"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={ctx.next}
          aria-label="Match suivant"
          aria-keyshortcuts="F3"
          className="p-1.5 rounded-md text-white/65 hover:bg-white/5 hover:text-white"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={ctx.close}
          aria-label="Fermer la recherche"
          aria-keyshortcuts="Escape"
          className="p-1.5 rounded-md text-white/65 hover:bg-white/5 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
```

- [ ] **Step 13.2: Test**

```tsx
// frontend/src/components/highlight/__tests__/HighlightNavigationBar.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { HighlightNavigationBar } from "../HighlightNavigationBar";
import { SemanticHighlightContext } from "../SemanticHighlightContext";
import type { WithinMatch } from "../../../services/api";

afterEach(cleanup);

const mockMatch = (id: string): WithinMatch => ({
  source_type: "summary",
  source_id: 1,
  text: "x",
  text_html: "x",
  start_offset: 0,
  end_offset: 1,
  tab: "synthesis",
  score: 0.9,
  passage_id: id,
});

function withState(
  matches: WithinMatch[],
  idx = 0,
  fns: Partial<{ next: () => void; prev: () => void; close: () => void }> = {},
) {
  return ({ children }: { children: React.ReactNode }) => (
    <SemanticHighlightContext.Provider
      value={{
        query: "ai",
        loading: false,
        matches,
        currentIndex: idx,
        activeTab: "synthesis",
        setQuery: () => {},
        close: fns.close ?? (() => {}),
        next: fns.next ?? (() => {}),
        prev: fns.prev ?? (() => {}),
        focus: () => {},
      }}
    >
      {children}
    </SemanticHighlightContext.Provider>
  );
}

describe("HighlightNavigationBar", () => {
  it("returns null when no matches", () => {
    const Wrap = withState([]);
    const { container } = render(
      <Wrap>
        <HighlightNavigationBar />
      </Wrap>,
    );
    expect(container.querySelector("nav")).toBeNull();
  });

  it("displays counter '1/2'", () => {
    const Wrap = withState([mockMatch("a"), mockMatch("b")], 0);
    render(
      <Wrap>
        <HighlightNavigationBar />
      </Wrap>,
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("calls next/prev/close when buttons clicked", async () => {
    const user = userEvent.setup();
    const next = vi.fn();
    const prev = vi.fn();
    const close = vi.fn();
    const Wrap = withState([mockMatch("a"), mockMatch("b")], 0, {
      next,
      prev,
      close,
    });
    render(
      <Wrap>
        <HighlightNavigationBar />
      </Wrap>,
    );
    await user.click(screen.getByLabelText(/match suivant/i));
    await user.click(screen.getByLabelText(/match précédent/i));
    await user.click(screen.getByLabelText(/fermer la recherche/i));
    expect(next).toHaveBeenCalled();
    expect(prev).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 13.3: Run**

```bash
cd frontend && npm run test -- --run src/components/highlight/__tests__/HighlightNavigationBar.test.tsx
```

- [ ] **Step 13.4: Commit**

```bash
git add frontend/src/components/highlight/HighlightNavigationBar.tsx \
        frontend/src/components/highlight/__tests__/HighlightNavigationBar.test.tsx
git commit -m "feat(highlight): add HighlightNavigationBar with counter and F3/Esc shortcuts"
```

---

## Task 14: `IntraAnalysisSearchBar` + hook `useCmdFIntercept`

**Files:**

- Create: `frontend/src/components/highlight/useCmdFIntercept.ts`
- Create: `frontend/src/components/highlight/IntraAnalysisSearchBar.tsx`

**Dependencies:** Task 11.

- [ ] **Step 14.1: Créer `useCmdFIntercept.ts`**

```typescript
// frontend/src/components/highlight/useCmdFIntercept.ts
import { useEffect } from "react";

interface Options {
  /** CSS selector that must contain the active focus / mouse target for interception */
  scopeSelector: string;
  /** Called when Cmd/Ctrl+F is pressed inside scope */
  onIntercept: () => void;
  /** Disable the listener (e.g. user is in a textarea) */
  enabled?: boolean;
}

export function useCmdFIntercept({
  scopeSelector,
  onIntercept,
  enabled = true,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const isCmdF =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f" && !e.shiftKey;
      if (!isCmdF) return;
      const scope = document.querySelector(scopeSelector);
      if (!scope) return;
      const active = document.activeElement;
      const inScope = active
        ? scope.contains(active) || scope === active
        : false;
      // Also intercept if the user is just on the page (no input focused)
      const onPageNoInputFocused =
        !active ||
        active === document.body ||
        (active instanceof HTMLElement &&
          !["INPUT", "TEXTAREA"].includes(active.tagName));
      if (inScope || onPageNoInputFocused) {
        e.preventDefault();
        onIntercept();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scopeSelector, onIntercept, enabled]);
}
```

- [ ] **Step 14.2: Créer `IntraAnalysisSearchBar.tsx`**

```tsx
// frontend/src/components/highlight/IntraAnalysisSearchBar.tsx
import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useSemanticHighlight } from "./useSemanticHighlight";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const IntraAnalysisSearchBar: React.FC<Props> = ({ open, onClose }) => {
  const ctx = useSemanticHighlight();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open || !ctx) return null;

  return (
    <div
      role="search"
      aria-label="Recherche dans l'analyse"
      className="fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-xl px-4"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#12121a]/95 border border-white/15 backdrop-blur-xl shadow-2xl">
        <Search className="w-4 h-4 text-white/55" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={ctx.query}
          onChange={(e) => ctx.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              ctx.close();
              onClose();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              e.shiftKey ? ctx.prev() : ctx.next();
            }
          }}
          placeholder="Rechercher dans l'analyse…"
          aria-label="Rechercher dans l'analyse"
          className="flex-1 bg-transparent text-white placeholder-white/35 outline-none text-sm"
        />
        {ctx.loading && (
          <span className="text-[11px] font-mono text-white/45">…</span>
        )}
        {!ctx.loading && ctx.matches.length > 0 && (
          <span className="text-[11px] font-mono text-amber-300 tabular-nums">
            {ctx.currentIndex + 1}/{ctx.matches.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            ctx.close();
            onClose();
          }}
          aria-label="Fermer"
          className="p-1.5 rounded-md text-white/55 hover:bg-white/5 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 14.3: Run typecheck**

```bash
cd frontend && npm run typecheck
```

- [ ] **Step 14.4: Commit**

```bash
git add frontend/src/components/highlight/useCmdFIntercept.ts \
        frontend/src/components/highlight/IntraAnalysisSearchBar.tsx
git commit -m "feat(highlight): add IntraAnalysisSearchBar + useCmdFIntercept hook"
```

---

## Task 15: `ExplainTooltip` + `ExplainUpsellModal`

**Files:**

- Create: `frontend/src/components/highlight/ExplainTooltip.tsx`
- Create: `frontend/src/components/highlight/ExplainUpsellModal.tsx`
- Create: `frontend/src/components/highlight/__tests__/ExplainTooltip.test.tsx`

**Dependencies:** Task 1, Task 2.

- [ ] **Step 15.1: Créer `ExplainUpsellModal.tsx`**

```tsx
// frontend/src/components/highlight/ExplainUpsellModal.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

interface Props {
  open: boolean;
  passageText: string;
  onClose: () => void;
}

export const ExplainUpsellModal: React.FC<Props> = ({
  open,
  passageText,
  onClose,
}) => {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-upsell-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#12121a] border border-white/10 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2
            id="explain-upsell-title"
            className="text-base font-semibold text-white flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Comprendre ce passage avec l'IA
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-md hover:bg-white/5"
          >
            <X className="w-4 h-4 text-white/55" />
          </button>
        </div>
        <p className="text-sm text-white/65 mb-3">
          Le tooltip IA est inclus avec Pro et Expert.
        </p>
        <p className="text-sm text-white/85 italic mb-4 line-clamp-3">
          « {passageText} »
        </p>
        <button
          type="button"
          onClick={() => navigate("/upgrade")}
          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium hover:opacity-95"
        >
          Essai gratuit 7 jours →
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 15.2: Créer `ExplainTooltip.tsx`**

```tsx
// frontend/src/components/highlight/ExplainTooltip.tsx
import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageSquare, Clock, ExternalLink, X } from "lucide-react";
import { searchApi, type WithinMatch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { PLAN_FEATURES, normalizePlanId } from "../../config/planPrivileges";
import { ExplainUpsellModal } from "./ExplainUpsellModal";

interface Props {
  open: boolean;
  match: WithinMatch | null;
  query: string;
  summaryId: number;
  /** Anchor element rectangle (from getBoundingClientRect) for positioning */
  anchorRect: DOMRect | null;
  onClose: () => void;
  onCiteInChat: (passage: string) => void;
  onSeekTimecode?: (seconds: number) => void;
  onJumpToTab?: (tab: WithinMatch["tab"]) => void;
}

export const ExplainTooltip: React.FC<Props> = ({
  open,
  match,
  query,
  summaryId,
  anchorRect,
  onClose,
  onCiteInChat,
  onSeekTimecode,
  onJumpToTab,
}) => {
  const { user } = useAuth();
  const plan = normalizePlanId(user?.plan);
  const tooltipAllowed = PLAN_FEATURES[plan].semanticSearchTooltip;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node))
        onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  // Open upsell instead of fetching for free users
  useEffect(() => {
    if (open && match && !tooltipAllowed) setUpsellOpen(true);
  }, [open, match, tooltipAllowed]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["explain-passage", summaryId, match?.passage_id, query],
    queryFn: () => {
      if (!match) return Promise.reject(new Error("no match"));
      return searchApi.explainPassage(
        summaryId,
        match.text,
        query,
        match.source_type,
      );
    },
    enabled: open && !!match && tooltipAllowed,
    staleTime: 60 * 60 * 1000, // 1h cache
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  if (!open || !match) {
    return upsellOpen && match ? (
      <ExplainUpsellModal
        open
        passageText={match.text}
        onClose={() => {
          setUpsellOpen(false);
          onClose();
        }}
      />
    ) : null;
  }

  if (!tooltipAllowed) {
    return (
      <ExplainUpsellModal
        open={upsellOpen}
        passageText={match.text}
        onClose={() => {
          setUpsellOpen(false);
          onClose();
        }}
      />
    );
  }

  // Position : prefer above anchor, fallback below
  const margin = 8;
  const tooltipMaxWidth = 360;
  const top = anchorRect
    ? anchorRect.top - margin - 220 < 0
      ? anchorRect.bottom + margin
      : anchorRect.top - margin - 220
    : 100;
  const left = anchorRect
    ? Math.max(
        8,
        Math.min(window.innerWidth - tooltipMaxWidth - 8, anchorRect.left),
      )
    : 100;

  const tsHint =
    match.tab === "transcript" || match.tab === "synthesis" ? null : null;
  const seekableSecs =
    match.tab === "transcript" || match.tab === "synthesis"
      ? // try to extract from match text or metadata — V1: skip
        null
      : null;

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        role="tooltip"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.15 }}
        style={{ top, left, maxWidth: tooltipMaxWidth }}
        className="fixed z-[55] rounded-xl bg-[#12121a] border border-white/15 shadow-2xl backdrop-blur-xl p-3 w-[min(90vw,360px)]"
      >
        <div className="flex items-start justify-between mb-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300">
            <Sparkles className="w-3 h-3" />
            IA · Pourquoi ce passage matche
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-0.5 rounded hover:bg-white/5"
          >
            <X className="w-3.5 h-3.5 text-white/55" />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-1.5">
            <div className="h-2.5 bg-white/10 rounded animate-pulse w-full" />
            <div className="h-2.5 bg-white/10 rounded animate-pulse w-4/5" />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-300">
            Impossible de générer l'explication.
          </p>
        )}

        {data && (
          <p className="text-sm text-white/85 leading-relaxed">
            {data.explanation}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              onCiteInChat(`Explique-moi ce passage : ${match.text}`);
              onClose();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/85 hover:bg-white/10"
          >
            <MessageSquare className="w-3 h-3" /> Citer dans chat
          </button>
          {seekableSecs !== null && onSeekTimecode && (
            <button
              type="button"
              onClick={() => onSeekTimecode(seekableSecs)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/85 hover:bg-white/10"
            >
              <Clock className="w-3 h-3" /> Sauter au timecode
            </button>
          )}
          {onJumpToTab && match.tab !== "synthesis" && (
            <button
              type="button"
              onClick={() => {
                onJumpToTab(match.tab);
                onClose();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/85 hover:bg-white/10"
            >
              <ExternalLink className="w-3 h-3" />
              Voir dans {match.tab}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```

- [ ] **Step 15.3: Test ExplainTooltip**

```tsx
// frontend/src/components/highlight/__tests__/ExplainTooltip.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ExplainTooltip } from "../ExplainTooltip";
import { searchApi } from "../../../services/api";
import type { WithinMatch } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  searchApi: { explainPassage: vi.fn() },
}));

// Auth mock — we'll override per-test
const useAuthMock = vi.fn();
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));

afterEach(cleanup);

const mockMatch: WithinMatch = {
  source_type: "summary",
  source_id: 1,
  text: "transition énergétique",
  text_html: "transition énergétique",
  start_offset: 0,
  end_offset: 22,
  tab: "synthesis",
  score: 0.91,
  passage_id: "p1",
};

function renderTooltip(
  props: Partial<React.ComponentProps<typeof ExplainTooltip>> = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ExplainTooltip
          open
          match={mockMatch}
          query="transition"
          summaryId={42}
          anchorRect={null}
          onClose={() => {}}
          onCiteInChat={() => {}}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExplainTooltip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls explainPassage and renders explanation for Pro", async () => {
    useAuthMock.mockReturnValue({ user: { plan: "pro" } });
    (searchApi.explainPassage as any).mockResolvedValue({
      explanation: "Mentionne directement la transition énergétique.",
      cached: false,
      model_used: "mistral-small-latest",
    });
    renderTooltip();
    await waitFor(() =>
      expect(screen.getByText(/mentionne directement/i)).toBeInTheDocument(),
    );
    expect(searchApi.explainPassage).toHaveBeenCalledWith(
      42,
      "transition énergétique",
      "transition",
      "summary",
    );
  });

  it("does NOT call explainPassage and shows upsell for free", async () => {
    useAuthMock.mockReturnValue({ user: { plan: "free" } });
    (searchApi.explainPassage as any).mockResolvedValue({
      explanation: "should-not-render",
      cached: false,
      model_used: "x",
    });
    renderTooltip();
    await waitFor(() =>
      expect(
        screen.getByText(/Comprendre ce passage avec l'IA/i),
      ).toBeInTheDocument(),
    );
    expect(searchApi.explainPassage).not.toHaveBeenCalled();
  });

  it("close button triggers onClose", async () => {
    useAuthMock.mockReturnValue({ user: { plan: "pro" } });
    (searchApi.explainPassage as any).mockResolvedValue({
      explanation: "x",
      cached: true,
      model_used: "mistral-small-latest",
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderTooltip({ onClose });
    await waitFor(() => screen.getByText("x"));
    await user.click(screen.getByLabelText(/fermer/i));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 15.4: Run tests**

```bash
cd frontend && npm run test -- --run src/components/highlight/__tests__/ExplainTooltip.test.tsx
```

Expected : 3/3 pass.

- [ ] **Step 15.5: Commit**

```bash
git add frontend/src/components/highlight/ExplainTooltip.tsx \
        frontend/src/components/highlight/ExplainUpsellModal.tsx \
        frontend/src/components/highlight/__tests__/ExplainTooltip.test.tsx
git commit -m "feat(highlight): add ExplainTooltip with cache + free plan upsell modal"
```

---

## Task 16: Wire Hub — provider + nav bar + Cmd+F + read query params

**Files:**

- Modify: `frontend/src/pages/HubPage.tsx`
- Modify: `frontend/src/components/hub/HubAnalysisPanel.tsx`
- Modify: `frontend/src/components/hub/HubHeader.tsx`

**Dependencies:** Tasks 11, 12, 13, 14, 15.

- [ ] **Step 16.1: Dans `HubPage.tsx`, ajouter les imports et le wrap provider**

Imports à ajouter :

```tsx
import { SemanticHighlightProvider } from "../components/highlight/SemanticHighlightProvider";
import { HighlightNavigationBar } from "../components/highlight/HighlightNavigationBar";
import { IntraAnalysisSearchBar } from "../components/highlight/IntraAnalysisSearchBar";
import { ExplainTooltip } from "../components/highlight/ExplainTooltip";
import { useCmdFIntercept } from "../components/highlight/useCmdFIntercept";
import { useSemanticHighlight } from "../components/highlight/useSemanticHighlight";
import type { WithinMatch } from "../services/api";
```

À l'intérieur du composant `HubPage` (avant le return) :

```tsx
// Search params côté Hub : ?summaryId=...&q=...&highlight=...&tab=...
const initialQ = searchParams.get("q") ?? "";
const initialHighlight = searchParams.get("highlight");
const initialTabFromSearch = searchParams.get("tab");

// Search bar visibility (Cmd+F)
const [searchBarOpen, setSearchBarOpen] = useState(initialQ.length > 0);
useCmdFIntercept({
  scopeSelector: ".analysis-page",
  enabled: !!selectedSummary,
  onIntercept: () => setSearchBarOpen(true),
});

// Tooltip state
const [tooltip, setTooltip] = useState<{
  match: WithinMatch | null;
  rect: DOMRect | null;
}>({ match: null, rect: null });
```

Wrapper le JSX racine avec `<SemanticHighlightProvider>` et ajouter `className="analysis-page"` sur le container racine de l'analyse :

```tsx
return (
  <SemanticHighlightProvider summaryId={selectedSummary?.id ?? null}>
    <div className="analysis-page min-h-screen flex flex-col bg-bg-primary">
      <HubHeader
        /* ...existing props... */
        onSearchClick={() => setSearchBarOpen(true)}
      />
      <IntraAnalysisSearchBar
        open={searchBarOpen}
        onClose={() => setSearchBarOpen(false)}
      />
      <HighlightNavigationBar />
      {/* ...rest of existing JSX... */}
      <ExplainTooltip
        open={!!tooltip.match}
        match={tooltip.match}
        query={/* read from highlight ctx */ ""}
        summaryId={selectedSummary?.id ?? 0}
        anchorRect={tooltip.rect}
        onClose={() => setTooltip({ match: null, rect: null })}
        onCiteInChat={(text) => {
          /* prefill chat input via existing hubStore */
          useHubStore.getState().setPrefillMessage?.(text);
        }}
        onJumpToTab={(tab) => setActiveTab(tab as TabId)}
      />
    </div>
  </SemanticHighlightProvider>
);
```

> **Note** : `query` dans `<ExplainTooltip>` doit venir du highlight context. Comme `useSemanticHighlight()` n'est dispo qu'à l'intérieur du provider, créer un sous-composant interne `<HubBody>` qui fait le `useSemanticHighlight()` et reçoit en prop `tooltip` + setter. Ou simpler : passer `query` directement via tooltip state. Laisser le sub-agent décider de la factorisation cleanest.

- [ ] **Step 16.2: Brancher l'auto-focus du highlight initial (`?highlight=...`)**

Dans le sous-composant qui consomme le highlight context, à mount :

```tsx
const ctx = useSemanticHighlight();
useEffect(() => {
  if (ctx && initialQ && initialHighlight && ctx.matches.length === 0) {
    ctx.setQuery(initialQ); // triggers fetch
  }
}, [initialQ, initialHighlight, ctx]);
useEffect(() => {
  if (ctx && initialHighlight && ctx.matches.length > 0) {
    ctx.focus(initialHighlight);
  }
}, [ctx?.matches, initialHighlight]);
```

Et activer le bon tab :

```tsx
useEffect(() => {
  if (initialTabFromSearch && initialTabFromSearch !== activeTab) {
    setActiveTab(initialTabFromSearch as TabId);
  }
}, [initialTabFromSearch]);
```

- [ ] **Step 16.3: Ajouter `onSearchClick` dans `HubHeader.tsx`**

Étendre `Props` :

```typescript
onSearchClick?: () => void;
```

Ajouter un bouton loupe dans la barre, à droite du title (avant `pipSlot`) :

```tsx
{
  onSearchClick && (
    <button
      type="button"
      aria-label="Rechercher dans cette analyse"
      aria-keyshortcuts="Control+F Meta+F"
      onClick={onSearchClick}
      className="w-8 h-8 grid place-items-center rounded-lg text-white/65 hover:bg-white/[0.06] hover:text-white"
    >
      <Search className="w-4 h-4" />
    </button>
  );
}
```

(Importer `Search` de `lucide-react`.)

- [ ] **Step 16.4: Wrapper `HubAnalysisPanel.tsx` children avec `<HighlightedText tab={activeTab}>`**

Importer `HighlightedText`. Wrapper le `<AnalysisHub>` :

```tsx
return (
  <div className="px-4 py-4 w-full">
    <HighlightedText
      tab={activeTab}
      onMarkClick={(_id, match) => {
        // Need access to the click target rect — use document.querySelector inline
        const el = document.querySelector<HTMLElement>(
          `mark.ds-highlight[data-passage-id="${match.passage_id}"]`,
        );
        const rect = el?.getBoundingClientRect() ?? null;
        // Bubble up to HubPage via a custom event for simplicity
        window.dispatchEvent(
          new CustomEvent("ds-highlight-click", { detail: { match, rect } }),
        );
      }}
    >
      <AnalysisHub /* ...props existants... */ />
    </HighlightedText>
  </div>
);
```

Et dans `HubPage.tsx`, écouter l'event :

```tsx
useEffect(() => {
  const onClick = (e: Event) => {
    const ce = e as CustomEvent<{ match: WithinMatch; rect: DOMRect }>;
    setTooltip({ match: ce.detail.match, rect: ce.detail.rect });
  };
  window.addEventListener("ds-highlight-click", onClick);
  return () => window.removeEventListener("ds-highlight-click", onClick);
}, []);
```

- [ ] **Step 16.5: Run tests existants Hub pour vérifier non-régression**

```bash
cd frontend && npm run test -- --run src/pages/__tests__ src/components/hub
```

Expected : 0 régression. (S'il y a des tests Hub qui utilisent `HubPage`, ils peuvent nécessiter un mock léger pour les nouveaux providers — adapter au cas par cas.)

- [ ] **Step 16.6: Commit**

```bash
git add frontend/src/pages/HubPage.tsx \
        frontend/src/components/hub/HubAnalysisPanel.tsx \
        frontend/src/components/hub/HubHeader.tsx
git commit -m "feat(highlight): wire SemanticHighlight into Hub (Cmd+F + nav bar + tooltip + deeplink)"
```

---

## Task 17: i18n — clés FR/EN pour search/tooltip/upsell

**Files:**

- Modify: `frontend/src/i18n/fr.json` + `en.json`

**Dependencies:** Tasks 5, 7, 8, 13, 14, 15.

> **Note** : pendant les tasks 5-15 le code utilise des chaînes inline FR ("Recherche", "Filtres avancés", etc.). Cette task migre vers `t.search.*`. Si la quantité de strings est faible, l'agent peut décider de garder les strings inline pour V1 et juste ajouter `nav.search` (déjà fait task 9). Dans ce cas, **skipper cette task** et marquer comme "i18n V2".

- [ ] **Step 17.1: Ajouter dans `fr.json`**

```json
"search": {
  "placeholder": "Rechercher dans tes analyses…",
  "filters": {
    "all": "Tout",
    "summary": "Synthèse",
    "flashcard": "Flashcards",
    "quiz": "Quiz",
    "chat": "Chat",
    "transcript": "Transcripts",
    "advanced": "Filtres avancés"
  },
  "empty": {
    "noQuery": "Cherche dans toutes tes analyses, flashcards, quiz et chats.",
    "noResults": "Aucun résultat pour « {query} »",
    "recentTitle": "Recherches récentes"
  },
  "tooltip": {
    "title": "IA · Pourquoi ce passage matche",
    "citeInChat": "Citer dans chat",
    "seekTimecode": "Sauter au timecode",
    "viewIn": "Voir dans {tab}",
    "error": "Impossible de générer l'explication."
  },
  "upsell": {
    "title": "Comprendre ce passage avec l'IA",
    "body": "Le tooltip IA est inclus avec Pro et Expert.",
    "cta": "Essai gratuit 7 jours →"
  }
}
```

- [ ] **Step 17.2: Mirror dans `en.json`** (traduire string par string).

- [ ] **Step 17.3: Migrer (optionnel — V2 si scope serré) les strings inline des composants vers `t.search.*` via `useTranslation()`**.

- [ ] **Step 17.4: Run tests**

```bash
cd frontend && npm run test -- --run
```

- [ ] **Step 17.5: Commit**

```bash
git add frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat(search): add i18n keys for search page, tooltip and upsell"
```

---

## Task 18: E2E spec 1 — Recherche globale + click → Hub

**Files:**

- Create: `frontend/e2e/semantic-search-global.spec.ts`

**Dependencies:** Tasks 1-9.

- [ ] **Step 18.1: Créer le spec**

```typescript
// frontend/e2e/semantic-search-global.spec.ts
import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: process.env.E2E_USER ?? "e2e@deepsight.test",
  password: process.env.E2E_PASS ?? "test1234",
};

test.describe("Semantic Search V1 — Global page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API so the test does not depend on backend data
    await page.route("**/api/search/global", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: "transition",
          total_results: 1,
          results: [
            {
              source_type: "summary",
              source_id: 42,
              summary_id: 42,
              score: 0.91,
              text_preview:
                "La transition énergétique impose une refonte du mix.",
              source_metadata: {
                summary_title: "Crise énergétique EU",
                channel: "Le Monde",
                tab: "synthesis",
              },
            },
          ],
          searched_at: new Date().toISOString(),
        }),
      });
    });
    await page.route("**/api/search/recent-queries", async (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ queries: [] }) }),
    );

    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("/search loads, search returns results, click goes to /hub", async ({
    page,
  }) => {
    await page.goto("/search");
    await expect(
      page.getByRole("heading", { name: /recherche/i }),
    ).toBeVisible();

    await page.fill('input[type="search"]', "transition");
    await expect(page.getByText("Crise énergétique EU")).toBeVisible({
      timeout: 5000,
    });

    await page.getByTestId("search-result-card").first().click();
    await expect(page).toHaveURL(/\/hub\?.*summaryId=42/);
    await expect(page).toHaveURL(/highlight=summary-42/);
  });

  test("'Tout' pill is active by default and toggles type", async ({
    page,
  }) => {
    await page.goto("/search");
    await page.fill('input[type="search"]', "ai");
    const allPill = page.getByRole("button", { name: /Tout/ });
    await expect(allPill).toHaveAttribute("aria-pressed", "true");

    const synthPill = page.getByRole("button", { name: /Synthèse/ });
    await synthPill.click();
    await expect(synthPill).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 18.2: Lancer**

```bash
cd frontend && npx playwright test e2e/semantic-search-global.spec.ts
```

Expected : 2/2 pass (avec un user de test seedé OU en skippant via `test.skip(!E2E_USER)` ; le premier `test.beforeEach` peut être commenté pour exécution sans backend si user_test indisponible).

- [ ] **Step 18.3: Commit**

```bash
git add frontend/e2e/semantic-search-global.spec.ts
git commit -m "test(search): add e2e spec for global search page and click flow"
```

---

## Task 19: E2E spec 2 — Cmd+F intercept + intra-analyse navigation

**Files:**

- Create: `frontend/e2e/semantic-search-intra.spec.ts`

**Dependencies:** Task 16.

- [ ] **Step 19.1: Créer le spec**

```typescript
// frontend/e2e/semantic-search-intra.spec.ts
import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: process.env.E2E_USER ?? "e2e@deepsight.test",
  password: process.env.E2E_PASS ?? "test1234",
};

test.describe("Semantic Search V1 — Intra-analysis", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/search/within/**", async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          matches: [
            {
              source_type: "summary",
              source_id: 1,
              text: "transition énergétique",
              text_html: "transition énergétique",
              start_offset: 0,
              end_offset: 22,
              tab: "synthesis",
              score: 0.91,
              passage_id: "s-1",
            },
            {
              source_type: "summary",
              source_id: 2,
              text: "transition énergétique",
              text_html: "transition énergétique",
              start_offset: 0,
              end_offset: 22,
              tab: "synthesis",
              score: 0.85,
              passage_id: "s-2",
            },
          ],
        }),
      }),
    );

    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("Cmd+F opens floating search bar and navigates matches", async ({
    page,
  }) => {
    await page.goto("/hub");
    // Need an active analysis. If user has none, skip:
    const drawerBtn = page.getByRole("button", { name: /Conversations/ });
    await drawerBtn.click();
    const firstConv = page.locator("aside button").first();
    if (!(await firstConv.isVisible())) {
      test.skip(true, "no analysis for test user");
    }
    await firstConv.click();

    // Trigger Cmd+F (use Control on Linux/Win)
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+F" : "Control+F");

    const intraInput = page.getByRole("searchbox", {
      name: /rechercher dans l'analyse/i,
    });
    await expect(intraInput).toBeVisible();

    await intraInput.fill("transition");
    await expect(page.getByText("1/2")).toBeVisible({ timeout: 3000 });

    // Press F3 → counter goes to 2/2
    await page.keyboard.press("F3");
    await expect(page.getByText("2/2")).toBeVisible();

    // Esc closes the bar
    await page.keyboard.press("Escape");
    await expect(intraInput).not.toBeVisible();
  });
});
```

- [ ] **Step 19.2: Lancer**

```bash
cd frontend && npx playwright test e2e/semantic-search-intra.spec.ts
```

Expected : 1/1 pass (ou skip si user de test sans analyse).

- [ ] **Step 19.3: Commit**

```bash
git add frontend/e2e/semantic-search-intra.spec.ts
git commit -m "test(search): add e2e spec for Cmd+F intra-analysis search and F3 navigation"
```

---

## Task 20: E2E spec 3 — Tooltip IA Pro vs upsell free

**Files:**

- Create: `frontend/e2e/semantic-search-tooltip.spec.ts`

**Dependencies:** Task 15, Task 16.

- [ ] **Step 20.1: Créer le spec**

```typescript
// frontend/e2e/semantic-search-tooltip.spec.ts
import { test, expect } from "@playwright/test";

// This spec mocks BOTH within and explain endpoints, and uses two test users
// (E2E_USER_PRO and E2E_USER_FREE) — provided via env. If unset, skips.

const PRO = {
  email: process.env.E2E_USER_PRO ?? "",
  password: process.env.E2E_PASS_PRO ?? "",
};
const FREE = {
  email: process.env.E2E_USER_FREE ?? "",
  password: process.env.E2E_PASS_FREE ?? "",
};

async function loginAndOpenHub(
  page: any,
  creds: { email: string; password: string },
) {
  await page.goto("/login");
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);
  await page.goto("/hub");
  const drawer = page.getByRole("button", { name: /Conversations/ });
  await drawer.click();
  const first = page.locator("aside button").first();
  if (!(await first.isVisible())) test.skip(true, "no analysis");
  await first.click();
}

async function setupMocks(page: any) {
  await page.route("**/api/search/within/**", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        matches: [
          {
            source_type: "summary",
            source_id: 1,
            text: "transition",
            text_html: "transition",
            start_offset: 0,
            end_offset: 10,
            tab: "synthesis",
            score: 0.9,
            passage_id: "s-1",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/search/explain-passage", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        explanation: "Mentionne directement la transition énergétique.",
        cached: false,
        model_used: "mistral-small-latest",
      }),
    }),
  );
}

test.describe("Semantic Search V1 — Tooltip IA", () => {
  test.skip(
    !PRO.email || !FREE.email,
    "needs E2E_USER_PRO + E2E_USER_FREE envs",
  );

  test("Pro user gets the tooltip with IA explanation", async ({ page }) => {
    await setupMocks(page);
    await loginAndOpenHub(page, PRO);

    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+F" : "Control+F");
    await page
      .getByRole("searchbox", { name: /rechercher dans l'analyse/i })
      .fill("transition");
    // Wait for highlight to appear, then click it
    const mark = page.locator("mark.ds-highlight").first();
    await expect(mark).toBeVisible();
    await mark.click();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await expect(page.getByText(/mentionne directement/i)).toBeVisible();
  });

  test("Free user sees upsell modal instead of tooltip", async ({ page }) => {
    await setupMocks(page);
    await loginAndOpenHub(page, FREE);

    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+F" : "Control+F");
    await page
      .getByRole("searchbox", { name: /rechercher dans l'analyse/i })
      .fill("transition");
    const mark = page.locator("mark.ds-highlight").first();
    await mark.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByText(/Comprendre ce passage avec l'IA/i),
    ).toBeVisible();
  });
});
```

- [ ] **Step 20.2: Lancer**

```bash
cd frontend && npx playwright test e2e/semantic-search-tooltip.spec.ts
```

Expected : 2/2 pass si users seeded, sinon skip.

- [ ] **Step 20.3: Commit**

```bash
git add frontend/e2e/semantic-search-tooltip.spec.ts
git commit -m "test(search): add e2e spec for IA tooltip Pro vs upsell free"
```

---

## Task 21: Final validation + cleanup

**Files:** Aucun (validation uniquement)

**Dependencies:** Toutes les tasks précédentes.

- [ ] **Step 21.1: Run full frontend validation**

```bash
cd frontend
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

Expected : 4/4 green.

- [ ] **Step 21.2: Sanity manuel local**

```bash
cd frontend && npm run dev
```

Ouvrir `http://localhost:5173/search` après login → vérifier :

- Page rend, sidebar a "Recherche", input visible
- Taper >= 2 chars → fetch (peut 404 si flag backend OFF en dev — c'est attendu, juste vérifier qu'il n'y a pas de crash UI)

Ouvrir `/hub`, sélectionner une conversation, presser Cmd/Ctrl+F → la search bar s'ouvre.

- [ ] **Step 21.3: Vérifier la liste des fichiers attendus**

```bash
git diff main --stat
```

Doit lister les fichiers énumérés en "Files créés" et "Files modifiés" plus haut.

- [ ] **Step 21.4: Push (sans merger — la branche reste pour review)**

```bash
git push -u origin feat/search-web-phase2
```

- [ ] **Step 21.5: (optionnel) Ouvrir la PR**

```bash
gh pr create --title "feat(search): semantic search V1 phase 2 web frontend" \
  --body "$(cat <<'EOF'
## Summary
- /search page (sidebar nav + filters + virtualized results + recent queries)
- Intra-analysis Cmd+F search with highlights, navigation bar (F3, Esc) and ExplainTooltip (Pro+) / upsell (free)
- 5 new searchApi methods + types
- semanticSearchTooltip plan feature flag (Free=off, Pro/Expert=on)

## Test plan
- [ ] Vitest unit suites pass: search/* + highlight/* + pages/SearchPage
- [ ] Playwright: semantic-search-global, semantic-search-intra, semantic-search-tooltip
- [ ] Manual: /search renders, /hub Cmd+F opens search bar, mark click opens tooltip (or upsell for free)
- [ ] Backend feature flag SEMANTIC_SEARCH_V1_ENABLED stays OFF in prod for now (Phase 5 activation)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Si l'utilisateur préfère merger lui-même, skipper cette étape.)

---

## Récapitulatif des dépendances entre tasks

```
Task 1 (api.ts) ──────────► Tasks 3, 4, 6, 11, 15
Task 2 (planPrivileges) ──► Task 15

Task 3 (useSemanticSearch) ──┐
Task 4 (useRecentQueries) ───┤
Task 5 (SearchInput) ────────┼──► Task 8 (SearchPage) ──► Task 9 (route + sidebar) ──► Task 18 (e2e global)
Task 6 (filters) ────────────┤
Task 7 (results) ────────────┘

Task 10 (highlight.css) ─────┐
Task 11 (Provider) ──────────┼──► Task 12 (HighlightedText)
                             ├──► Task 13 (NavBar)        ──┐
                             ├──► Task 14 (SearchBar+Cmd+F) ┤
                             └──► Task 15 (ExplainTooltip)  ┤
                                                            ▼
                                                   Task 16 (Hub wire)
                                                            │
                                                            ▼
                                              Tasks 19, 20 (e2e intra/tooltip)

Task 17 (i18n) — optional, après 5/7/8/13/14/15 si on migre les strings

Task 21 (final validation) — dernière
```

## Estimation totale

- **21 tasks** au total (incluant Step 0 setup)
- **3-5 minutes par step** × ~5 steps moyenne par task = **~15-20 min par task**
- **Total estimé : 5-7 heures de travail focused** (un sub-agent Opus 4.7)
- Si scindé en 2 sub-agents parallèles (Tasks 1-10/19 + Tasks 11-16/19-20), durée wall-clock : **3-4h**

## Risques et concerns flaggés pour review humaine

1. **Le composant `frontend/src/components/sidebar/SidebarNav.tsx` mentionné par le spec est ORPHELIN** — il n'est importé nulle part en prod. Le sidebar réel est `frontend/src/components/layout/Sidebar.tsx`. Le plan modifie les 2 par cohérence avec l'intent du spec, mais la modif du fichier orphelin est cosmétique.
2. **Pas de `@floating-ui/react` dans le projet** — le spec demande `@floating-ui/react` mais on ne l'a pas. Le plan utilise un positionnement custom Framer Motion + DOMRect (déjà installé). Si l'utilisateur veut le polish floating-ui (auto-flip, collision detection), ajouter `npm i @floating-ui/react` et refacto Task 15 — coût : +30 min.
3. **Le spec dit click flow → `/analysis/{id}?...` mais cette route N'EXISTE PAS dans App.tsx** — la "page d'analyse" est `/hub` avec query params (architecture Hub Unified mergée 2026-05-03). Le plan utilise donc `/hub?summaryId=...&q=...&highlight=...&tab=...`. Confirmer que c'est l'intention.
4. **L'injection `<mark>` via DOM walker post-render** est pragmatique mais imparfaite : si le passage texte chevauche du markdown inline (gras, lien) il sera skip. C'est V1 acceptable selon le spec mais à monitorer en prod.
5. **Le tooltip mockup spec montre "Sauter au timecode" mais on ne sait pas extraire le timecode du `WithinMatch.text` sans logique custom** — le plan laisse un `seekableSecs = null` placeholder en V1. Phase 5+ : améliorer en lisant `source_metadata.start_ts` quand backend l'exposera dans within response (actuellement seulement dans global response).
6. **Les E2E tests dépendent de `E2E_USER` env vars** existants ou seedés. Si le user de test n'a pas d'analyse, les tests skip — c'est aligné avec les patterns existants (`hub-unified.spec.ts`).
7. **i18n Task 17 est marquée optional** — pour rester strict scope, le plan utilise des strings inline FR partout (sauf `nav.search`). Si UX EN est requis pour le launch, faire la task 17 complètement.
8. **Pas de mise à jour `posthog`** — les events `search_query` / `search_result_clicked` / etc. utilisent `analytics.track` (helper existant) mais leur définition côté Posthog dashboard est hors scope frontend.
