# Semantic Search V1 — Phase 4 Extension Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une fonctionnalité Quick Search légère dans l'extension Chrome (sidepanel `HomeView`) qui consomme `POST /api/search/global` (Phase 1 backend déjà mergé via PR #292) et offre un footer "Voir tous les résultats sur deepsightsynthesis.com" pour rebasculer vers le web tier (full feature).

**Architecture:** Light tier — UN seul composant `QuickSearch` collapse/expand placé dans `HomeView.tsx` au-dessus de `RecentsList`. Pas d'intra-analyse search, pas de tooltip IA, pas de filtres avancés (la spec impose la sobriété pour respecter l'espace contraint du sidepanel). Cache `chrome.storage.local` pour les 5 dernières queries du user. Click sur résultat → ouvre l'analyse correspondante via le pattern existant (sidepanel reste ouvert, route `summary/{id}` dans un nouvel onglet web). Footer → `chrome.tabs.create` vers `WEBAPP_URL/search?q=...`.

**Tech Stack:** TypeScript strict + React 18 + Webpack 5 + Manifest V3, Jest + jsdom + Testing Library (pattern existant). Le service worker `background.ts` gère les API calls via le pattern `apiRequest` (CSP MV3 oblige). Storage = `chrome.storage.local` uniquement (pas de localStorage côté extension).

**Spec source:** `docs/superpowers/specs/2026-05-03-semantic-search-design.md` — focus Section 6 (Extension Chrome).

**Phase 1 backend dependencies (déjà disponibles en prod via PR #292) :**

- `POST /api/search/global` — body `{ query, limit, source_types?, platform?, lang?, category?, date_from?, date_to?, favorites_only?, playlist_id? }` — auth required, JWT déjà manipulé par `apiRequest` dans `background.ts`
- `GET /api/search/recent-queries` → `{ queries: list[str] }` (10 dernières queries du user)
- `DELETE /api/search/recent-queries` → 204

Réponse `/global` :

```json
{
  "query": "string",
  "total_results": 42,
  "results": [
    {
      "source_type": "summary" | "flashcard" | "quiz" | "chat" | "transcript",
      "source_id": 123,
      "summary_id": 456,
      "score": 0.87,
      "text_preview": "…la transition énergétique impose…",
      "source_metadata": {
        "summary_title": "…",
        "summary_thumbnail": "…",
        "video_id": "abc",
        "channel": "…",
        "tab": "synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript"
      }
    }
  ],
  "searched_at": "2026-05-03T..."
}
```

---

## File Structure

### Files créés

- `extension/src/types/search.ts` — TypeScript types pour les responses search (mirror du backend Pydantic)
- `extension/src/sidepanel/components/QuickSearch.tsx` — composant racine (input + collapse/expand + results)
- `extension/src/sidepanel/components/QuickSearchResultsList.tsx` — liste compacte de résultats
- `extension/src/sidepanel/components/QuickSearchResultItem.tsx` — 1 ligne par résultat avec badge type compact
- `extension/src/sidepanel/hooks/useQuickSearch.ts` — hook avec debounce 400ms + cache local
- `extension/src/utils/searchCache.ts` — helpers `chrome.storage.local` pour les 5 dernières queries
- `extension/__tests__/sidepanel/components/QuickSearch.test.tsx`
- `extension/__tests__/sidepanel/components/QuickSearchResultsList.test.tsx`
- `extension/__tests__/sidepanel/components/QuickSearchResultItem.test.tsx`
- `extension/__tests__/sidepanel/hooks/useQuickSearch.test.tsx`
- `extension/__tests__/utils/searchCache.test.ts`
- `extension/__tests__/background/search-global.test.ts`

### Files modifiés

- `extension/src/types/index.ts` — ajout `SEARCH_GLOBAL`, `GET_RECENT_QUERIES` dans `MessageAction`
- `extension/src/background.ts` — handler `searchGlobal()` + `getRecentQueries()` (route via `apiRequest`)
- `extension/src/sidepanel/views/HomeView.tsx` — insère `<QuickSearch />` au-dessus du label "Récent"
- `extension/__tests__/sidepanel/views/HomeView.test.tsx` — assert que QuickSearch render avant RecentsList

### Hors scope explicit

- Intra-analyse search (`POST /api/search/within/{id}`) → absent extension light tier
- Tooltip IA (`POST /api/search/explain-passage`) → absent extension
- Filtres avancés (platform/lang/date_from/favorites_only) → web tier only
- Sync cross-device des recent queries → out of scope V1 (chaque plateforme a son cache local)

---

## Conventions globales pour TOUTES les tasks

- Branche worktree dédiée : `feat/search-extension-phase4`
- Commits ASCII propres (pas d'emojis), prefix `feat(extension):` / `test(extension):` / `chore(extension):`
- Tests Jest + jsdom + Testing Library — pattern existant (cf. `__tests__/sidepanel/components/RecentsList.test.tsx`)
- Pas de `localStorage`, uniquement `chrome.storage.local` (CSP MV3)
- API calls TOUJOURS via `chrome.runtime.sendMessage` vers `background.ts` (sidepanel ne peut pas fetch directement à cause de CSP MV3 + le pattern existant `apiRequest` gère le refresh JWT 401)
- TypeScript strict, zéro `any` — utiliser les types de `extension/src/types/search.ts`
- Styling : reuse classes CSS existantes du sidepanel (`v3-*`, ds-\*) sinon inline styles cohérents avec `RecentsList` (fontSize 13, padding 8/16, opacity 0.5/0.6)
- Le sidepanel fait ~360px de large — la liste 1 ligne par résultat est non-négociable

---

## Task 1: Extension API client — `searchGlobal` + `getRecentQueries` dans background.ts

**Files:**

- Modify: `extension/src/types/index.ts` (ajout actions)
- Create: `extension/src/types/search.ts`
- Modify: `extension/src/background.ts` (ajout 2 fonctions API + 2 cases switch)
- Test: `extension/__tests__/background/search-global.test.ts`

- [ ] **Step 1: Créer le fichier types `extension/src/types/search.ts`**

```typescript
// Types pour les endpoints de recherche sémantique V1 (Phase 1 backend PR #292)

export type SearchSourceType =
  | "summary"
  | "flashcard"
  | "quiz"
  | "chat"
  | "transcript";

export interface SearchSourceMetadata {
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

export interface SearchResult {
  source_type: SearchSourceType;
  source_id: number;
  summary_id: number | null;
  score: number;
  text_preview: string;
  source_metadata: SearchSourceMetadata;
}

export interface GlobalSearchResponse {
  query: string;
  total_results: number;
  results: SearchResult[];
  searched_at: string;
}

export interface RecentQueriesResponse {
  queries: string[];
}

export interface GlobalSearchOptions {
  query: string;
  limit?: number;
  source_types?: SearchSourceType[];
}
```

- [ ] **Step 2: Étendre `MessageAction` dans `extension/src/types/index.ts`**

Trouver la ligne 210 du fichier (la fin du type union `MessageAction`), juste avant `;`. Ajouter 2 actions :

```typescript
  // Recherche sémantique V1 (Phase 4 extension)
  | "SEARCH_GLOBAL"
  | "GET_RECENT_QUERIES"
```

Puis dans `MessageResponse` (ligne ~223) ajouter les fields optionnels :

```typescript
export interface MessageResponse {
  success?: boolean;
  authenticated?: boolean;
  user?: User;
  status?: TaskStatus;
  summary?: Summary;
  plan?: PlanInfo;
  result?: unknown;
  error?: string;
  share_url?: string;
  state?: VoiceButtonState;
  // Phase 4 search
  searchResults?: GlobalSearchResponse;
  recentQueries?: string[];
}
```

Et au top du fichier (après le bloc d'imports/types existants) :

```typescript
import type { GlobalSearchResponse } from "./search";
```

- [ ] **Step 3: Écrire le test échouant `__tests__/background/search-global.test.ts`**

```typescript
/**
 * Tests — SEARCH_GLOBAL action handler
 * Source : src/background.ts (handleMessage switch case)
 */

import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";

const mockFetch = jest.fn();
(global as unknown as Record<string, unknown>).fetch = mockFetch;

let handleMessage: (message: {
  action: string;
  data?: Record<string, unknown>;
}) => Promise<unknown>;

beforeAll(() => {
  const onMessageAddListener = chrome.runtime.onMessage
    .addListener as jest.Mock;
  onMessageAddListener.mockClear();
  require("../../src/background");
  const registeredCallback = onMessageAddListener.mock.calls[0]?.[0];
  if (registeredCallback) {
    handleMessage = async (message) => {
      return new Promise((resolve) => {
        registeredCallback(message, {}, resolve);
      });
    };
  }
});

beforeEach(() => {
  resetChromeMocks();
  mockFetch.mockReset();
  seedLocalStorage({ accessToken: "test-token" });
});

describe("SEARCH_GLOBAL", () => {
  it("calls /search/global with the right body and forwards the response", async () => {
    const fakeResults = {
      query: "transition énergétique",
      total_results: 2,
      results: [
        {
          source_type: "summary",
          source_id: 12,
          summary_id: 12,
          score: 0.91,
          text_preview: "…la transition énergétique impose…",
          source_metadata: { summary_title: "Crise EU", video_id: "abc" },
        },
        {
          source_type: "flashcard",
          source_id: 34,
          summary_id: 12,
          score: 0.87,
          text_preview: "Q: Quels objectifs pour la transition…",
          source_metadata: { summary_title: "Crise EU" },
        },
      ],
      searched_at: "2026-05-03T10:00:00Z",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(fakeResults),
    });

    const response = (await handleMessage({
      action: "SEARCH_GLOBAL",
      data: { query: "transition énergétique", limit: 10 },
    })) as { success: boolean; searchResults: typeof fakeResults };

    expect(response.success).toBe(true);
    expect(response.searchResults).toEqual(fakeResults);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/search/global"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "transition énergétique", limit: 10 }),
      }),
    );
  });

  it("returns error when not authenticated", async () => {
    seedLocalStorage({}); // no accessToken
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Not authenticated" }),
    });

    const response = (await handleMessage({
      action: "SEARCH_GLOBAL",
      data: { query: "test" },
    })) as { success: boolean; error?: string };

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});

describe("GET_RECENT_QUERIES", () => {
  it("calls /search/recent-queries and returns the queries array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ queries: ["énergie", "europe", "ia mistral"] }),
    });

    const response = (await handleMessage({
      action: "GET_RECENT_QUERIES",
    })) as { success: boolean; recentQueries: string[] };

    expect(response.success).toBe(true);
    expect(response.recentQueries).toEqual(["énergie", "europe", "ia mistral"]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd extension && npm test -- search-global.test`
Expected: FAIL with "Unknown action" (le case n'existe pas encore dans le switch)

- [ ] **Step 5: Implémenter `searchGlobal` + `getRecentQueries` dans `background.ts`**

Insérer après la fonction `quickChat` (vers ligne 413), avant la section `// ── Chat API ──` :

```typescript
// ── Search API (Phase 4 extension) ──

import type {
  GlobalSearchOptions,
  GlobalSearchResponse,
  RecentQueriesResponse,
} from "./types/search";

async function searchGlobal(
  options: GlobalSearchOptions,
): Promise<GlobalSearchResponse> {
  // limit max 10 côté extension (vs 30 web/mobile) — espace contraint sidepanel.
  const body: Record<string, unknown> = {
    query: options.query,
    limit: options.limit ?? 10,
  };
  if (options.source_types && options.source_types.length > 0) {
    body.source_types = options.source_types;
  }
  return apiRequest<GlobalSearchResponse>("/search/global", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function getRecentQueries(): Promise<RecentQueriesResponse> {
  return apiRequest<RecentQueriesResponse>("/search/recent-queries");
}
```

⚠️ Le `import type` doit être déplacé en haut du fichier avec les autres imports (TypeScript strict refuse les imports en milieu de fichier).

Puis ajouter 2 cases dans `handleExtensionMessage` switch (vers ligne 1063, après `case "GET_PLAN"`):

```typescript
    case "SEARCH_GLOBAL": {
      const opts = message.data as GlobalSearchOptions;
      try {
        const searchResults = await searchGlobal(opts);
        return { success: true, searchResults };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }

    case "GET_RECENT_QUERIES": {
      try {
        const result = await getRecentQueries();
        return { success: true, recentQueries: result.queries };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd extension && npm test -- search-global.test`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add extension/src/types/search.ts extension/src/types/index.ts extension/src/background.ts extension/__tests__/background/search-global.test.ts
git commit -m "feat(extension): add SEARCH_GLOBAL and GET_RECENT_QUERIES actions in background"
```

---

## Task 2: Cache local des 5 dernières queries (`searchCache.ts`)

**Files:**

- Create: `extension/src/utils/searchCache.ts`
- Test: `extension/__tests__/utils/searchCache.test.ts`

- [ ] **Step 1: Écrire le test échouant**

```typescript
/**
 * Tests — searchCache helpers
 * Source : src/utils/searchCache.ts
 */

import { resetChromeMocks } from "../setup/chrome-api-mock";
import {
  getCachedQueries,
  pushCachedQuery,
  clearCachedQueries,
} from "../../src/utils/searchCache";

describe("searchCache", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("returns empty array when no queries cached yet", async () => {
    const queries = await getCachedQueries();
    expect(queries).toEqual([]);
  });

  it("pushes a new query at the head and persists it", async () => {
    await pushCachedQuery("transition énergétique");
    const queries = await getCachedQueries();
    expect(queries).toEqual(["transition énergétique"]);
  });

  it("keeps only the 5 most recent queries (LRU cap)", async () => {
    for (let i = 1; i <= 7; i++) {
      await pushCachedQuery(`query ${i}`);
    }
    const queries = await getCachedQueries();
    expect(queries).toHaveLength(5);
    // Most recent first
    expect(queries[0]).toBe("query 7");
    expect(queries[4]).toBe("query 3");
  });

  it("dedupes : pushing an existing query moves it to the head", async () => {
    await pushCachedQuery("a");
    await pushCachedQuery("b");
    await pushCachedQuery("c");
    await pushCachedQuery("a"); // already present → moved to head
    const queries = await getCachedQueries();
    expect(queries).toEqual(["a", "c", "b"]);
  });

  it("trims and ignores empty queries", async () => {
    await pushCachedQuery("   ");
    await pushCachedQuery("");
    const queries = await getCachedQueries();
    expect(queries).toEqual([]);
  });

  it("clearCachedQueries empties the cache", async () => {
    await pushCachedQuery("x");
    await clearCachedQueries();
    const queries = await getCachedQueries();
    expect(queries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test -- searchCache.test`
Expected: FAIL with "Cannot find module '../../src/utils/searchCache'"

- [ ] **Step 3: Implémenter `extension/src/utils/searchCache.ts`**

```typescript
/**
 * searchCache — Cache local des 5 dernières queries de recherche.
 *
 * Stocké dans `chrome.storage.local` clé `recent_queries` (cf. spec § 6.3).
 * Pas de sync cross-device en V1 (cf. spec « Pas de sync cross-device pour V1 »).
 */

import Browser from "./browser-polyfill";

const STORAGE_KEY = "recent_queries";
const MAX_QUERIES = 5;

export async function getCachedQueries(): Promise<string[]> {
  try {
    const data = (await Browser.storage.local.get(STORAGE_KEY)) as {
      [STORAGE_KEY]?: string[];
    };
    const queries = data[STORAGE_KEY];
    return Array.isArray(queries) ? queries.slice(0, MAX_QUERIES) : [];
  } catch {
    return [];
  }
}

export async function pushCachedQuery(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;
  const existing = await getCachedQueries();
  const deduped = existing.filter((q) => q !== trimmed);
  const next = [trimmed, ...deduped].slice(0, MAX_QUERIES);
  try {
    await Browser.storage.local.set({ [STORAGE_KEY]: next });
  } catch {
    // Storage quota or permission error — fail silently
  }
}

export async function clearCachedQueries(): Promise<void> {
  try {
    await Browser.storage.local.remove(STORAGE_KEY);
  } catch {
    // Ignore errors on clear
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test -- searchCache.test`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/utils/searchCache.ts extension/__tests__/utils/searchCache.test.ts
git commit -m "feat(extension): add searchCache helpers for chrome.storage.local LRU"
```

---

## Task 3: Hook `useQuickSearch` (debounce 400ms + cache)

**Files:**

- Create: `extension/src/sidepanel/hooks/useQuickSearch.ts`
- Test: `extension/__tests__/sidepanel/hooks/useQuickSearch.test.tsx`

- [ ] **Step 1: Écrire le test échouant**

```typescript
/**
 * Tests — useQuickSearch hook
 * Source : src/sidepanel/hooks/useQuickSearch.ts
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { useQuickSearch } from "../../../src/sidepanel/hooks/useQuickSearch";

// Test harness — minimal React component that exposes the hook state.
function Harness({ query }: { query: string }) {
  const { results, loading, error } = useQuickSearch(query);
  return (
    <div>
      <span data-testid="loading">{loading ? "true" : "false"}</span>
      <span data-testid="error">{error || ""}</span>
      <span data-testid="count">{results.length}</span>
      {results.map((r, i) => (
        <span key={i} data-testid={`result-${i}`}>
          {r.source_type}:{r.source_id}
        </span>
      ))}
    </div>
  );
}

describe("useQuickSearch", () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns empty results when query is shorter than 2 chars", async () => {
    render(<Harness query="a" />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("debounces 400ms before sending the search request", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "test",
        total_results: 0,
        results: [],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    render(<Harness query="test" />);

    // Avant 400ms — aucun call
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2);
    });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SEARCH_GLOBAL",
          data: { query: "test", limit: 10 },
        }),
      );
    });
  });

  it("populates results when sendMessage succeeds", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "ai",
        total_results: 1,
        results: [
          {
            source_type: "summary",
            source_id: 7,
            summary_id: 7,
            score: 0.9,
            text_preview: "…",
            source_metadata: {},
          },
        ],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    render(<Harness query="ai" />);
    act(() => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
      expect(screen.getByTestId("result-0")).toHaveTextContent("summary:7");
    });
  });

  it("surfaces error when sendMessage fails", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: false,
      error: "Network error",
    });

    render(<Harness query="test" />);
    act(() => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Network error");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test -- useQuickSearch.test`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implémenter `extension/src/sidepanel/hooks/useQuickSearch.ts`**

```typescript
/**
 * useQuickSearch — Hook React qui appelle SEARCH_GLOBAL avec debounce 400ms.
 *
 * Spec : extension light tier (max 10 résultats, debounce 400ms cf. spec § 6.2).
 * Pas de cache mémoire intra-session — l'extension est censée être légère ;
 * un re-render avec la même query fait un nouveau call (acceptable car le
 * backend cache 24h en Redis).
 */

import { useEffect, useState } from "react";
import Browser from "../../utils/browser-polyfill";
import type { MessageResponse } from "../../types";
import type { GlobalSearchResponse, SearchResult } from "../../types/search";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface QuickSearchState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  totalResults: number;
}

export function useQuickSearch(query: string): QuickSearchState {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      setTotalResults(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const response = await Browser.runtime.sendMessage<
          unknown,
          MessageResponse
        >({
          action: "SEARCH_GLOBAL",
          data: { query: trimmed, limit: 10 },
        });

        if (cancelled) return;

        if (response.success && response.searchResults) {
          const payload = response.searchResults as GlobalSearchResponse;
          setResults(payload.results);
          setTotalResults(payload.total_results);
          setError(null);
        } else {
          setResults([]);
          setTotalResults(0);
          setError(response.error || "Recherche impossible");
        }
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        setTotalResults(0);
        setError((e as Error).message || "Recherche impossible");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading, error, totalResults };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test -- useQuickSearch.test`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/hooks/useQuickSearch.ts extension/__tests__/sidepanel/hooks/useQuickSearch.test.tsx
git commit -m "feat(extension): add useQuickSearch hook with 400ms debounce"
```

---

## Task 4: Composant `QuickSearchResultItem` (1 ligne par résultat)

**Files:**

- Create: `extension/src/sidepanel/components/QuickSearchResultItem.tsx`
- Test: `extension/__tests__/sidepanel/components/QuickSearchResultItem.test.tsx`

- [ ] **Step 1: Écrire le test échouant**

```typescript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickSearchResultItem } from "../../../src/sidepanel/components/QuickSearchResultItem";
import type { SearchResult } from "../../../src/types/search";

describe("QuickSearchResultItem", () => {
  const baseResult: SearchResult = {
    source_type: "summary",
    source_id: 12,
    summary_id: 12,
    score: 0.91,
    text_preview: "…la transition énergétique impose une refonte du mix électrique européen…",
    source_metadata: {
      summary_title: "Crise énergétique EU",
      summary_thumbnail: "https://example.com/thumb.jpg",
      video_id: "abc",
    },
  };

  it("renders the summary title", () => {
    render(<QuickSearchResultItem result={baseResult} onSelect={() => {}} />);
    expect(screen.getByText("Crise énergétique EU")).toBeInTheDocument();
  });

  it("renders the source type badge", () => {
    render(<QuickSearchResultItem result={baseResult} onSelect={() => {}} />);
    // Badge text matches the source type, case-insensitive
    expect(screen.getByText(/synth/i)).toBeInTheDocument();
  });

  it("renders different badge for flashcard", () => {
    const flashcardResult: SearchResult = {
      ...baseResult,
      source_type: "flashcard",
      source_metadata: { ...baseResult.source_metadata, summary_title: "Ex" },
    };
    render(
      <QuickSearchResultItem
        result={flashcardResult}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/flashcard/i)).toBeInTheDocument();
  });

  it("calls onSelect with the result when clicked", () => {
    const onSelect = jest.fn();
    render(<QuickSearchResultItem result={baseResult} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Crise énergétique EU"));
    expect(onSelect).toHaveBeenCalledWith(baseResult);
  });

  it("falls back to text_preview if no summary_title", () => {
    const noTitle: SearchResult = {
      ...baseResult,
      source_metadata: {},
    };
    render(<QuickSearchResultItem result={noTitle} onSelect={() => {}} />);
    expect(
      screen.getByText(/la transition énergétique impose/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test -- QuickSearchResultItem.test`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implémenter `extension/src/sidepanel/components/QuickSearchResultItem.tsx`**

```typescript
import React from "react";
import type { SearchResult, SearchSourceType } from "../../types/search";

interface Props {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}

const BADGE_LABELS: Record<SearchSourceType, string> = {
  summary: "Synthèse",
  flashcard: "Flashcard",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcript",
};

const BADGE_COLORS: Record<SearchSourceType, string> = {
  summary: "rgba(99, 102, 241, 0.25)", // indigo
  flashcard: "rgba(139, 92, 246, 0.25)", // violet
  quiz: "rgba(6, 182, 212, 0.25)", // cyan
  chat: "rgba(59, 130, 246, 0.25)", // bleu
  transcript: "rgba(255, 255, 255, 0.1)", // gris
};

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

export function QuickSearchResultItem({
  result,
  onSelect,
}: Props): JSX.Element {
  const title =
    result.source_metadata?.summary_title?.trim() ||
    truncate(result.text_preview, 60);

  const badgeLabel = BADGE_LABELS[result.source_type];
  const badgeColor = BADGE_COLORS[result.source_type];

  return (
    <li
      onClick={() => onSelect(result)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(result);
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        padding: "8px 16px",
        cursor: "pointer",
        display: "flex",
        gap: 8,
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 4,
          background: badgeColor,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
        }}
      >
        {badgeLabel}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={title}
      >
        {title}
      </span>
    </li>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test -- QuickSearchResultItem.test`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/components/QuickSearchResultItem.tsx extension/__tests__/sidepanel/components/QuickSearchResultItem.test.tsx
git commit -m "feat(extension): add QuickSearchResultItem with type badge"
```

---

## Task 5: Composant `QuickSearchResultsList` (liste compacte + footer)

**Files:**

- Create: `extension/src/sidepanel/components/QuickSearchResultsList.tsx`
- Test: `extension/__tests__/sidepanel/components/QuickSearchResultsList.test.tsx`

- [ ] **Step 1: Écrire le test échouant**

```typescript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { QuickSearchResultsList } from "../../../src/sidepanel/components/QuickSearchResultsList";
import type { SearchResult } from "../../../src/types/search";

describe("QuickSearchResultsList", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  const mockResults: SearchResult[] = [
    {
      source_type: "summary",
      source_id: 1,
      summary_id: 1,
      score: 0.92,
      text_preview: "Crise énergétique européenne",
      source_metadata: { summary_title: "Crise EU", video_id: "v1" },
    },
    {
      source_type: "flashcard",
      source_id: 2,
      summary_id: 1,
      score: 0.87,
      text_preview: "Q: Quels objectifs pour la transition…",
      source_metadata: { summary_title: "Crise EU", video_id: "v1" },
    },
  ];

  it("renders a loading state when loading is true", () => {
    render(
      <QuickSearchResultsList
        results={[]}
        loading={true}
        error={null}
        query="test"
        totalResults={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/recherche/i)).toBeInTheDocument();
  });

  it("renders an error state when error is set", () => {
    render(
      <QuickSearchResultsList
        results={[]}
        loading={false}
        error="Network down"
        query="test"
        totalResults={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
  });

  it("renders an empty state when no results", () => {
    render(
      <QuickSearchResultsList
        results={[]}
        loading={false}
        error={null}
        query="zzz"
        totalResults={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
  });

  it("renders all results when populated", () => {
    render(
      <QuickSearchResultsList
        results={mockResults}
        loading={false}
        error={null}
        query="test"
        totalResults={2}
        onSelect={() => {}}
      />,
    );
    // Both items should be present (Crise EU appears in both)
    expect(screen.getAllByText("Crise EU")).toHaveLength(2);
  });

  it("forwards onSelect when a result item is clicked", () => {
    const onSelect = jest.fn();
    render(
      <QuickSearchResultsList
        results={mockResults}
        loading={false}
        error={null}
        query="test"
        totalResults={2}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getAllByText("Crise EU")[0]);
    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it("renders footer with total_results that opens web app on click", () => {
    const tabsCreate = chrome.tabs.create as jest.Mock;
    render(
      <QuickSearchResultsList
        results={mockResults}
        loading={false}
        error={null}
        query="énergie"
        totalResults={42}
        onSelect={() => {}}
      />,
    );
    const footer = screen.getByText(/voir tous les résultats/i);
    expect(footer).toBeInTheDocument();
    fireEvent.click(footer);
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/search?q="),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test -- QuickSearchResultsList.test`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implémenter `extension/src/sidepanel/components/QuickSearchResultsList.tsx`**

```typescript
import React from "react";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { QuickSearchResultItem } from "./QuickSearchResultItem";
import type { SearchResult } from "../../types/search";

interface Props {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  totalResults: number;
  onSelect: (result: SearchResult) => void;
}

export function QuickSearchResultsList({
  results,
  loading,
  error,
  query,
  totalResults,
  onSelect,
}: Props): JSX.Element {
  const openWebSearch = () => {
    const url = `${WEBAPP_URL}/search?q=${encodeURIComponent(query)}`;
    Browser.tabs.create({ url });
  };

  if (loading) {
    return (
      <div
        style={{
          padding: 16,
          opacity: 0.6,
          fontSize: 13,
          textAlign: "center",
        }}
        role="status"
        aria-live="polite"
      >
        Recherche en cours…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          color: "#fca5a5",
          fontSize: 13,
        }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          opacity: 0.6,
          fontSize: 13,
        }}
      >
        Aucun résultat pour « {query} »
      </div>
    );
  }

  return (
    <div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {results.map((r) => (
          <QuickSearchResultItem
            key={`${r.source_type}-${r.source_id}`}
            result={r}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={openWebSearch}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          color: "rgba(99, 102, 241, 0.95)",
          fontSize: 12,
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-label={`Voir les ${totalResults} résultats sur deepsightsynthesis.com`}
      >
        Voir tous les résultats ({totalResults}) sur deepsightsynthesis.com →
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test -- QuickSearchResultsList.test`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/components/QuickSearchResultsList.tsx extension/__tests__/sidepanel/components/QuickSearchResultsList.test.tsx
git commit -m "feat(extension): add QuickSearchResultsList with web footer link"
```

---

## Task 6: Composant racine `QuickSearch` (input + collapse/expand + cache)

**Files:**

- Create: `extension/src/sidepanel/components/QuickSearch.tsx`
- Test: `extension/__tests__/sidepanel/components/QuickSearch.test.tsx`

- [ ] **Step 1: Écrire le test échouant**

```typescript
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { QuickSearch } from "../../../src/sidepanel/components/QuickSearch";

describe("QuickSearch", () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the collapsed input with the placeholder", () => {
    render(<QuickSearch onSelectResult={() => {}} />);
    expect(
      screen.getByPlaceholderText(/rechercher mes analyses/i),
    ).toBeInTheDocument();
  });

  it("does not show results panel until user types", () => {
    render(<QuickSearch onSelectResult={() => {}} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("expands and shows loading after typing 2+ chars", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "ai",
        total_results: 0,
        results: [],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "ai" } });

    // Loading visible immediately (debounce starts but loading state is set)
    expect(screen.getByText(/recherche/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
    });
  });

  it("does not call SEARCH_GLOBAL for queries shorter than 2 chars", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({ success: true, searchResults: { query: "", total_results: 0, results: [], searched_at: "" } });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "a" } });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "SEARCH_GLOBAL" }),
    );
  });

  it("collapses (clears results) when input is emptied", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "ai",
        total_results: 0,
        results: [],
        searched_at: "",
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "ai" } });
    act(() => {
      jest.advanceTimersByTime(401);
    });
    await waitFor(() => {
      expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText(/aucun résultat/i)).toBeNull();
  });

  it("calls onSelectResult when a result item is clicked", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    const fakeResult = {
      source_type: "summary",
      source_id: 5,
      summary_id: 5,
      score: 0.9,
      text_preview: "test preview",
      source_metadata: { summary_title: "Test" },
    };
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "test",
        total_results: 1,
        results: [fakeResult],
        searched_at: "",
      },
    });

    const onSelect = jest.fn();
    render(<QuickSearch onSelectResult={onSelect} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "test" } });
    act(() => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test"));
    expect(onSelect).toHaveBeenCalledWith(fakeResult);
  });

  it("persists the query into chrome.storage.local cache after a successful search", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "energie",
        total_results: 0,
        results: [],
        searched_at: "",
      },
    });
    const setSpy = chrome.storage.local.set as jest.Mock;

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "energie" } });
    act(() => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recent_queries: expect.arrayContaining(["energie"]),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test -- QuickSearch.test`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implémenter `extension/src/sidepanel/components/QuickSearch.tsx`**

```typescript
import React, { useState, useEffect } from "react";
import { useQuickSearch } from "../hooks/useQuickSearch";
import { QuickSearchResultsList } from "./QuickSearchResultsList";
import { pushCachedQuery } from "../../utils/searchCache";
import type { SearchResult } from "../../types/search";

interface Props {
  onSelectResult: (result: SearchResult) => void;
}

export function QuickSearch({ onSelectResult }: Props): JSX.Element {
  const [query, setQuery] = useState("");
  const { results, loading, error, totalResults } = useQuickSearch(query);

  const trimmed = query.trim();
  const isExpanded = trimmed.length >= 2;

  // Persist query in chrome.storage.local cache once we have a non-empty
  // backend response (success path). We don't cache on error/loading to avoid
  // spamming the cache with half-typed queries.
  useEffect(() => {
    if (!loading && !error && trimmed.length >= 2) {
      void pushCachedQuery(trimmed);
    }
  }, [loading, error, trimmed]);

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div style={{ padding: "8px 16px" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 10,
            fontSize: 14,
            opacity: 0.6,
            pointerEvents: "none",
          }}
        >
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Rechercher mes analyses…"
          aria-label="Rechercher dans mes analyses"
          spellCheck={false}
          autoComplete="off"
          style={{
            width: "100%",
            padding: "8px 32px 8px 32px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            color: "inherit",
            fontSize: 13,
            outline: "none",
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Effacer la recherche"
            style={{
              position: "absolute",
              right: 6,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 14,
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {isExpanded && (
        <div
          style={{
            marginTop: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 6,
            overflow: "hidden",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          <QuickSearchResultsList
            results={results}
            loading={loading}
            error={error}
            query={trimmed}
            totalResults={totalResults}
            onSelect={onSelectResult}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test -- QuickSearch.test`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/components/QuickSearch.tsx extension/__tests__/sidepanel/components/QuickSearch.test.tsx
git commit -m "feat(extension): add QuickSearch root component with collapse/expand"
```

---

## Task 7: Click sur résultat → ouvre l'analyse

**Files:**

- Modify: `extension/src/sidepanel/views/HomeView.tsx`
- Test: `extension/__tests__/sidepanel/views/HomeView.test.tsx` (extension)

**Décision design** : Vu que `HomeView` reçoit déjà `onSelectRecent: (recent: RecentAnalysis) => void` (qui pousse vers une analyse complète), on adopte le même pattern : `onSelectResult` ouvre l'analyse dans un nouvel onglet web (cohérent avec le footer "voir tous sur deepsightsynthesis.com" et avec le pattern existant "v3-recent-item" dans `MainView.tsx:778-782` qui fait déjà `target="_blank"`).

L'extension light tier ne dispose PAS d'`AnalysisView` autonome dans le sidepanel pour rendre une analyse arbitraire (cf. spec § 6.2 « Tap sur résultat → ouvre l'analyse dans `AnalysisView` du sidepanel »). En réalité l'extension n'a aucun composant qui sait afficher une analyse depuis un `summary_id` arbitraire (l'`AnalysisView.tsx` actuel pilote l'analyse de la vidéo du tab actif). On suit donc la convention `MainView` recents : ouvrir `${WEBAPP_URL}/summary/{summaryId}` dans un nouvel onglet.

- [ ] **Step 1: Étendre le test `HomeView.test.tsx`**

Ajouter un nouveau bloc `describe` à la fin du fichier existant `extension/__tests__/sidepanel/views/HomeView.test.tsx` :

```typescript
describe("HomeView — QuickSearch integration", () => {
  it("renders the QuickSearch input above the Recents label", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: null, platform: null, tabId: null }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    const searchInput = screen.getByPlaceholderText(/rechercher mes analyses/i);
    const recentsLabel = screen.getByText(/^récent$/i);
    // QuickSearch DOIT apparaître AVANT le label "Récent" dans le DOM
    expect(
      searchInput.compareDocumentPosition(recentsLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens summary URL in a new tab when a result is clicked", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "test",
        total_results: 1,
        results: [
          {
            source_type: "summary",
            source_id: 99,
            summary_id: 99,
            score: 0.95,
            text_preview: "Mock preview",
            source_metadata: { summary_title: "Mock Title" },
          },
        ],
        searched_at: "",
      },
    });
    const tabsCreate = chrome.tabs.create as jest.Mock;

    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: null, platform: null, tabId: null }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(
      () => {
        expect(screen.getByText("Mock Title")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByText("Mock Title"));
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/summary/99") }),
    );
  });
});
```

⚠️ Au top du fichier, ajouter `fireEvent` et `waitFor` à l'import existant :

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npm test -- HomeView.test`
Expected: FAIL ("Unable to find an element with placeholder rechercher mes analyses")

- [ ] **Step 3: Modifier `HomeView.tsx` — insérer QuickSearch**

Le fichier source actuel (`extension/src/sidepanel/views/HomeView.tsx`, 73 lignes). Modifier comme suit :

```typescript
import React from "react";
import { RecentsList, RecentAnalysis } from "../components/RecentsList";
import { VideoDetectedCard } from "../components/VideoDetectedCard";
import { UrlInputCard } from "../components/UrlInputCard";
import { PlanBadge } from "../components/PlanBadge";
import { QuickSearch } from "../components/QuickSearch";
import { CurrentTabInfo } from "../hooks/useCurrentTab";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import type { SearchResult } from "../../types/search";

interface User {
  plan: "free" | "etudiant" | "starter" | "pro" | "equipe";
  creditsLeft: number;
}

export interface HomeViewProps {
  user: User;
  recents: RecentAnalysis[];
  currentTab: CurrentTabInfo;
  videoMeta?: { title: string; thumbnail: string };
  onAnalyze: (url: string) => void;
  onSelectRecent: (recent: RecentAnalysis) => void;
  onUpgrade: () => void;
}

export function HomeView({
  user,
  recents,
  currentTab,
  videoMeta,
  onAnalyze,
  onSelectRecent,
  onUpgrade,
}: HomeViewProps): JSX.Element {
  const isOnVideo =
    currentTab.platform !== null &&
    currentTab.url !== null &&
    videoMeta !== undefined;

  const handleSelectSearchResult = (result: SearchResult) => {
    // Phase 4 spec § 6.2 — extension light tier : on ouvre l'analyse
    // directement dans l'app web (pas d'AnalysisView autonome côté extension).
    if (result.summary_id !== null && result.summary_id !== undefined) {
      Browser.tabs.create({
        url: `${WEBAPP_URL}/summary/${result.summary_id}`,
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PlanBadge
        plan={user.plan}
        creditsLeft={user.creditsLeft}
        onUpgrade={onUpgrade}
      />

      {isOnVideo && videoMeta && currentTab.url && currentTab.platform ? (
        <VideoDetectedCard
          title={videoMeta.title}
          thumbnail={videoMeta.thumbnail}
          platform={currentTab.platform}
          onAnalyze={() => onAnalyze(currentTab.url!)}
        />
      ) : (
        <UrlInputCard onSubmit={onAnalyze} />
      )}

      {/* Phase 4 — Quick Search (light tier) */}
      <QuickSearch onSelectResult={handleSelectSearchResult} />

      <div
        style={{
          padding: "8px 16px",
          fontSize: 11,
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Récent
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RecentsList recents={recents} onSelect={onSelectRecent} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test -- HomeView.test`
Expected: PASS (les 5 tests existants + 2 nouveaux = 7 total)

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/views/HomeView.tsx extension/__tests__/sidepanel/views/HomeView.test.tsx
git commit -m "feat(extension): integrate QuickSearch above RecentsList in HomeView"
```

---

## Task 8: Vérification typecheck + tests full suite

**Files:** aucune modification — vérification globale.

- [ ] **Step 1: Run TypeScript typecheck (zéro erreur attendue)**

Run: `cd extension && npm run typecheck`
Expected: 0 erreurs TypeScript. Si erreur sur `MessageResponse` → vérifier que `searchResults?` et `recentQueries?` sont bien typés.

- [ ] **Step 2: Run full Jest suite**

Run: `cd extension && npm test`
Expected: tous les tests verts, incluant les ~40+ nouveaux tests Phase 4.

Si un test pré-existant (`MainView.test.tsx`, `App.test.tsx`, etc.) casse → diagnostiquer ; ne pas masquer.

- [ ] **Step 3: Commit du typecheck si nettoyage nécessaire (sinon skip)**

Si l'étape 1 ou 2 a nécessité des fixes mineurs (ex : import manquant, type narrowing), commit :

```bash
git add -p
git commit -m "chore(extension): fix typecheck for Phase 4 search integration"
```

---

## Task 9: Build extension + ZIP pour Chrome Web Store

**Files:**

- Run: `npm run build`
- Output: `extension/dist/` updated
- Output: `~/Documents/deepsight-extension-search-v1.zip` (à uploader sur Chrome Web Store par Maxime)

- [ ] **Step 1: Build production**

Run: `cd extension && npm run build`
Expected:

- Output `dist/` updated
- 0 erreurs Webpack
- Vérifier que `dist/sidepanel.js` contient bien le nouveau bundle (taille ~+10-15 KB)

- [ ] **Step 2: Vérifier le manifest.json**

Run: `cat extension/dist/manifest.json | head -30`
Expected:

- Pas de nouvelles permissions requises (search/global utilise `host_permissions: api.deepsightsynthesis.com` déjà présent)
- `manifest_version: 3` toujours OK

⚠️ Si une nouvelle permission s'avérait nécessaire (ne devrait pas — on réutilise `apiRequest` existant), il faudrait l'ajouter dans le source manifest et soumettre Maxime à un re-review Chrome Web Store. Dans le scope V1, ce ne devrait pas arriver.

- [ ] **Step 3: Test manuel local — chrome://extensions**

Sequence (à exécuter par Maxime ou un sub-agent avec Chrome):

1. Ouvrir `chrome://extensions/`
2. Mode développeur activé
3. "Charger l'extension non empaquetée" → sélectionner `C:/Users/33667/DeepSight-Main/extension/dist/`
4. Recharger l'extension si déjà loaded (icône reload sur la card)
5. Ouvrir le sidepanel (clic icône action ou raccourci natif Chrome)
6. Vérifier :
   - Input "🔍 Rechercher mes analyses…" présent au-dessus de la liste Recents
   - Taper 2+ caractères → debounce 400ms → liste de résultats apparaît
   - Click sur un résultat → nouvel onglet web `/summary/{id}` s'ouvre
   - Footer "Voir tous les résultats sur deepsightsynthesis.com →" → click ouvre `/search?q=...`
   - Vider l'input → la liste se collapse
7. Vérifier `chrome.storage.local` (DevTools sidepanel → Application → Storage) :
   - `recent_queries: [...]` (max 5 éléments) après 2-3 recherches
8. Test offline / API down : couper le réseau, recommencer une recherche → message d'erreur affiché, pas de crash

⚠️ Si le test révèle un bug fonctionnel, ne pas commit le ZIP — fix d'abord, re-build, retest.

- [ ] **Step 4: Créer le ZIP pour Chrome Web Store**

Sur Windows (PowerShell) :

```powershell
cd C:\Users\33667\DeepSight-Main\extension
Compress-Archive -Path dist\* -DestinationPath ~\Documents\deepsight-extension-search-v1.zip -Force
```

Sur bash :

```bash
cd /c/Users/33667/DeepSight-Main/extension
rm -f ~/Documents/deepsight-extension-search-v1.zip
(cd dist && zip -r ~/Documents/deepsight-extension-search-v1.zip .)
```

Expected: fichier ZIP ~1-3 MB selon assets.

- [ ] **Step 5: Commit dist/ rebuild + report**

```bash
git add extension/dist/
git commit -m "chore(extension): rebuild dist for Phase 4 QuickSearch + zip ready for Chrome Web Store"
```

⚠️ **Ne pas push --force**, ne pas auto-soumettre Chrome Web Store. Le ZIP ~/Documents/deepsight-extension-search-v1.zip est l'artefact final que Maxime upload manuellement sur le Developer Dashboard (cf. Vault note `audit-kimi-deepsight-2026-04-29` — pattern récurrent du projet).

---

## Task 10: Préparer la PR

**Files:**

- Branche : `feat/search-extension-phase4`
- Base : `main`
- Test plan dans la description PR

- [ ] **Step 1: Sanity check — git status propre**

Run: `git status -sb`
Expected: branch ahead of origin, working tree clean

- [ ] **Step 2: Push la branche**

```bash
git push -u origin feat/search-extension-phase4
```

- [ ] **Step 3: Créer la PR via gh CLI**

```bash
gh pr create --base main --head feat/search-extension-phase4 \
  --title "feat(extension): semantic search V1 — phase 4 (QuickSearch sidepanel)" \
  --body "$(cat <<'EOF'
## Summary

- Ajoute `QuickSearch` (light tier) dans le sidepanel `HomeView` au-dessus de `RecentsList`.
- Consomme `POST /api/search/global?limit=10` (Phase 1 backend déjà mergé via PR #292).
- Footer "Voir tous les résultats sur deepsightsynthesis.com" qui ouvre `/search?q=...` dans un nouvel onglet web.
- Cache `chrome.storage.local` des 5 dernières queries (LRU dedup).
- Pas d'intra-analyse search ni de tooltip IA — espace contraint sidepanel (cf. spec § 6).

## Architecture

| Couche | Composant | Responsabilité |
|---|---|---|
| Background | `searchGlobal()` + `getRecentQueries()` | API client, refresh JWT 401 via `apiRequest` existant |
| Hook | `useQuickSearch(query)` | Debounce 400ms, gère loading/error/results state |
| UI | `QuickSearch` | Input + collapse/expand + persist cache |
| UI | `QuickSearchResultsList` | États loading/error/empty + footer web |
| UI | `QuickSearchResultItem` | 1 ligne par résultat avec badge type compact |
| Storage | `searchCache.ts` | LRU 5 queries, `chrome.storage.local` clé `recent_queries` |

## Test plan

- [ ] `cd extension && npm test` — tous les tests Jest verts (~40 nouveaux)
- [ ] `cd extension && npm run typecheck` — 0 erreurs TS
- [ ] `npm run build` — webpack build OK
- [ ] Test manuel chrome://extensions :
  - [ ] Input visible au-dessus de "Récent"
  - [ ] Debounce 400ms fonctionne (pas d'API call avant)
  - [ ] Click résultat → nouvel onglet `/summary/{id}`
  - [ ] Footer → nouvel onglet `/search?q=...`
  - [ ] `chrome.storage.local.recent_queries` populé
  - [ ] Erreur réseau gracieuse (pas de crash)

## Spec source

`docs/superpowers/specs/2026-05-03-semantic-search-design.md` — Section 6.

## Plan d'exécution

`docs/superpowers/plans/2026-05-03-semantic-search-v1-phase4-extension.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Linker la PR au sub-agent runner / hub Asana**

Pas de modif code. Juste copier l'URL PR dans le projet Asana **DeepSight Extension Chrome** (`1214026081649153`).

---

## Self-Review Checklist (à exécuter en fin de plan)

**1. Spec coverage** :

- ✅ Composant unique `QuickSearch.tsx` placé dans `HomeView.tsx` au-dessus de `RecentsList` → Task 7
- ✅ Input "🔍 Rechercher mes analyses…" → Task 6
- ✅ Expand inline avec liste résultats simplifiée → Tasks 5+6
- ✅ Pas d'intra-analyse search → confirmé dans "Hors scope explicit"
- ✅ Pas de tooltip IA → confirmé dans "Hors scope explicit"
- ✅ Pas de filtres avancés → liste flat compacte par défaut (`source_types` accepté en param mais jamais utilisé côté UI V1)
- ✅ Footer "Voir tous les résultats sur deepsightsynthesis.com →" via `chrome.tabs.create` → Task 5
- ✅ Cache `chrome.storage.local` 5 dernières queries → Task 2
- ✅ `POST /api/search/global` avec `limit=10` (extension space) → Task 1 (ligne `body.limit ?? 10`)
- ✅ `GET /api/search/recent-queries` exposé pour future use (suggestions) → Task 1
- ✅ Pas d'`/within` ni `/explain-passage` → confirmé "Hors scope explicit"
- ✅ Test manuel Chrome → Task 9
- ✅ Build extension + ZIP → Task 9

**2. Placeholder scan** : Aucun "TBD/TODO/implement later" trouvé. Toutes les sections de code sont concrètes et copy-pasteables.

**3. Type consistency** :

- `SearchResult.summary_id: number | null` cohérent entre Task 1 (types/search.ts) + Task 4 (rendu) + Task 7 (handler)
- `SearchSourceType` réutilisé partout (pas de string libre)
- `MessageResponse.searchResults?: GlobalSearchResponse` cohérent entre background.ts + useQuickSearch
- `pushCachedQuery(query: string): Promise<void>` même signature partout

**4. Conventions extension respectées** :

- ✅ Manifest V3 — `chrome.storage.local` only (Task 2)
- ✅ Service worker → API calls → CSP-safe (Task 1)
- ✅ Espace ≤360px → 1 ligne par résultat (Task 4)
- ✅ Limit=10 résultats (vs 30 web/mobile)
- ✅ Auth via JWT existant + `apiRequest` qui handle refresh (Task 1)

---

_Plan rédigé le 2026-05-03 par Claude Opus 4.7. Phase 4 du sprint Semantic Search V1 — light tier extension Chrome. Phase 1 backend déjà déployée prod via PR #292. Phases 2 (web) et 3 (mobile) à mener en parallèle dans des sprints séparés._
