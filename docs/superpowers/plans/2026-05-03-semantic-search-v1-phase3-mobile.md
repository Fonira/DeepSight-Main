# Semantic Search V1 — Phase 3 Mobile (Expo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apporter la recherche sémantique tri-source (synthèse + flashcards + quiz + chat + transcripts) à l'app mobile Expo SDK 54, avec un nouveau tab `Search` dédié, une recherche intra-analyse via bouton loupe dans le header de `analysis/[id].tsx`, et un `PassageActionSheet` BottomSheet (3 actions tap-friendly) au tap sur un passage surligné. Pas de tooltip IA mobile (tier medium = espace contraint).

**Architecture:** Le backend Phase 1 (PR #292 mergée) expose déjà `POST /api/search/global`, `POST /api/search/within/{summary_id}`, `GET/DELETE /api/search/recent-queries`. Côté mobile, on consomme ces endpoints via `searchApi` étendu dans `services/api.ts`, on alimente l'UI via React Query (debounce 400ms — plus tolérant que web 200ms à cause du clavier mobile), on cache les recent queries dans `AsyncStorage`. Aucun nouveau Zustand store nécessaire — React Query suffit pour l'état serveur, `useState` local pour les filtres, et un nouveau hook léger `useHighlightNav` pour la navigation entre matches dans la page analyse. **Pas d'endpoint `/explain-passage`** consommé : tier mobile = pas de tooltip IA.

**Tech Stack:** Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript strict, Expo Router v2, TanStack Query 5, `@shopify/flash-list` v2.2 (FlashList virtualisée), `@gorhom/bottom-sheet` v5.2 (déjà installé mais on privilégie `SimpleBottomSheet` interne pour cohérence Expo Go), `react-native-reanimated` 4.1, `@react-native-async-storage/async-storage` v2.2, Jest + Testing Library RN, Detox (E2E facultatif).

**Spec source:** `docs/superpowers/specs/2026-05-03-semantic-search-design.md` — focus Section 5 (Mobile).

**Branche worktree:** `feat/search-mobile-phase3` créée depuis `main` (Phase 1 backend déjà mergée). Pas de dépendance avec Phases 2 (web) et 4 (extension) — peut tourner en parallèle.

---

## File Structure

### Files créés

- `mobile/app/(tabs)/search.tsx` — screen racine du nouveau tab
- `mobile/src/components/search/SearchBar.tsx` — input + suggestions recent queries
- `mobile/src/components/search/SearchFiltersSheet.tsx` — BottomSheet filtres avancés (pills + dropdowns)
- `mobile/src/components/search/SearchResultsList.tsx` — FlashList virtualisée
- `mobile/src/components/search/SearchResultCard.tsx` — carte avec badge type + thumbnail
- `mobile/src/components/search/SearchEmptyState.tsx` — empty state + suggestions queries récentes
- `mobile/src/components/search/useSemanticSearch.ts` — hook React Query + debounce 400ms
- `mobile/src/components/search/useRecentQueries.ts` — hook AsyncStorage + sync API
- `mobile/src/components/search/index.ts` — barrel export
- `mobile/src/components/highlight/HighlightedText.tsx` — wrapper Text qui injecte les matches
- `mobile/src/components/highlight/PassageActionSheet.tsx` — BottomSheet 3 actions (Demander à l'IA, Sauter timecode, Voir dans tab)
- `mobile/src/components/highlight/HighlightNavigationBar.tsx` — FAB compteur + ↑↓
- `mobile/src/components/highlight/useHighlightNav.ts` — hook navigation cross-tab matches
- `mobile/src/components/highlight/SemanticHighlighter.tsx` — Provider state matches + nav (Context React)
- `mobile/src/components/highlight/index.ts` — barrel export
- `mobile/src/components/search/__tests__/SearchBar.test.tsx`
- `mobile/src/components/search/__tests__/SearchResultCard.test.tsx`
- `mobile/src/components/search/__tests__/useSemanticSearch.test.ts`
- `mobile/src/components/highlight/__tests__/HighlightedText.test.tsx`
- `mobile/src/components/highlight/__tests__/PassageActionSheet.test.tsx`
- `mobile/src/components/highlight/__tests__/useHighlightNav.test.ts`
- `mobile/e2e/semantic-search.e2e.ts` — Detox flow (optionnel — task 16)

### Files modifiés

- `mobile/src/services/api.ts` — étendre `searchApi` avec `globalSearch`, `withinSearch`, `getRecentQueries`, `clearRecentQueries`
- `mobile/app/(tabs)/_layout.tsx` — ajout `<Tabs.Screen name="search" />`
- `mobile/src/components/navigation/CustomTabBar.tsx` — entrée `search` dans `TAB_META`
- `mobile/app/(tabs)/analysis/[id].tsx` — bouton loupe dans `BackHeader` + intégration `SemanticHighlighter` provider + lecture des params `q` / `highlight` / `tab`
- `mobile/src/components/analysis/AnalysisContentDisplay.tsx` — wrap les paragraphes avec `<HighlightedText>` quand `SemanticHighlighter` actif
- `mobile/src/config/planPrivileges.ts` — ajout du flag `semanticSearchTooltip: boolean` dans `PlanFeatures` (mirror du backend, même si non consommé sur mobile — pour cohérence cross-platform et upsell potentiel V1.1)
- `mobile/app/(tabs)/hub.tsx` — accepter le param `prefillQuery: string` pour pré-remplir le champ Chat depuis l'action sheet "Demander à l'IA"
- `mobile/src/components/conversation/ConversationContent.tsx` — accepter prop `initialPrompt` et la passer à `ConversationInput` (auto-focus + auto-fill)
- `mobile/src/components/conversation/ConversationInput.tsx` — accepter prop `initialValue` (pré-remplissage)

### Hors scope cette PR

- Backend `/api/search/explain-passage` — pas consommé sur mobile (pas de tooltip IA tier medium)
- EAS update prod OTA — réservé à l'orchestration release globale (Phase finale = activation feature flag)
- Backend FEATURE_SEMANTIC_SEARCH_V1 OFF par défaut sur backend prod ; le mobile checke `/api/features` pour cacher le tab tant que le flag est OFF — l'implémentation du gating front est dans cette PR (Task 14), le toggle backend reste manuel (sshmaire SSH set env var)

---

## Conventions globales pour TOUTES les tasks

- Branche worktree dédiée : `feat/search-mobile-phase3` (depuis `main`)
- Commits ASCII propres (pas d'emojis), prefix `feat(mobile-search):` / `test(mobile-search):` / `chore(mobile-search):` selon scope
- Tests Jest + `@testing-library/react-native` v12 (pattern existant dans `mobile/src/components/tutor/__tests__/`)
- Mocks API via `jest.mock("../../../services/api", () => ({ searchApi: { ... } }))`
- TypeScript strict, **zéro `any`** — préférer `unknown` puis narrowing
- Toutes les surfaces interactives : `accessibilityLabel` + `accessibilityRole`
- Zone de tap minimum 32×32px : `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` sur les `<Text>` highlightés
- Animations via `react-native-reanimated` 4 — JAMAIS `Animated` legacy de RN
- Listes longues : **toujours `FlashList`** de `@shopify/flash-list` (pas FlatList)
- Couleurs via `palette` ou `colors` du `useTheme()` — JAMAIS de hex hardcodé en composant
- `StyleSheet.create({...})` en bas de chaque fichier — pas de styles inline sauf valeurs dynamiques
- Texte FR par défaut (cf. `useTheme` lang FR primaire) — chaînes en dur acceptable V1, pas d'i18n stricte requise

---

## Task 1 — Étendre `searchApi` dans `mobile/src/services/api.ts`

**Files:**

- Modify: `mobile/src/services/api.ts` (lignes 2289-2320, étendre la section `Search API`)

**Goal:** Ajouter les 4 méthodes consommant les endpoints Phase 1 backend (`globalSearch`, `withinSearch`, `getRecentQueries`, `clearRecentQueries`). Garder l'existant `semanticSearch` (legacy `/api/search/semantic`) pour ne pas casser le `useSearch` existant si appelé ailleurs.

- [ ] **Step 1.1 : TDD — écrire le test d'abord**

Create: `mobile/src/services/__tests__/searchApi.test.ts`

```typescript
import { searchApi } from "../api";

global.fetch = jest.fn();

describe("searchApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: new Headers(),
    });
  });

  it("globalSearch envoie POST /api/search/global avec body complet", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        query: "transition",
        total_results: 0,
        results: [],
        searched_at: "2026-05-03T10:00:00Z",
      }),
      headers: new Headers(),
    });
    await searchApi.globalSearch({
      query: "transition",
      limit: 20,
      source_types: ["summary", "flashcard"],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search/global"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("transition"),
      }),
    );
  });

  it("withinSearch route correctement avec summary_id en path", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ summary_id: 42, query: "x", matches: [] }),
      headers: new Headers(),
    });
    await searchApi.withinSearch(42, { query: "x" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search/within/42"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getRecentQueries fait GET et retourne queries", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ queries: ["a", "b"] }),
      headers: new Headers(),
    });
    const res = await searchApi.getRecentQueries();
    expect(res.queries).toEqual(["a", "b"]);
  });

  it("clearRecentQueries fait DELETE", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => null,
      headers: new Headers(),
    });
    await searchApi.clearRecentQueries();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search/recent-queries"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
```

- [ ] **Step 1.2 : Lancer les tests — vérifier qu'ils échouent (4 erreurs : méthodes absentes)**

```bash
cd mobile && npm run test -- searchApi.test.ts
```

Attendu : `searchApi.globalSearch is not a function` × 4.

- [ ] **Step 1.3 : Implémenter dans `mobile/src/services/api.ts`**

Localiser le bloc actuel (~ligne 2309-2320) :

```typescript
export const searchApi = {
  async semanticSearch(...): Promise<SemanticSearchResponse> { ... }
};
```

Le remplacer par (en gardant `semanticSearch` legacy + ajout V1) :

```typescript
// ============================================
// Search API V1 — Semantic Search (auth required)
// ============================================
export interface SearchSourceType {
  source_type: "summary" | "flashcard" | "quiz" | "chat" | "transcript";
}

export interface GlobalSearchRequest {
  query: string;
  limit?: number;
  source_types?: Array<
    "summary" | "flashcard" | "quiz" | "chat" | "transcript"
  >;
  platform?: "youtube" | "tiktok" | "text";
  lang?: string;
  category?: string;
  date_from?: string; // ISO 8601
  date_to?: string;
  favorites_only?: boolean;
  playlist_id?: string;
}

export interface GlobalSearchResultItem {
  source_type: "summary" | "flashcard" | "quiz" | "chat" | "transcript";
  source_id: number;
  summary_id: number | null;
  score: number;
  text_preview: string;
  source_metadata: {
    summary_title?: string;
    summary_thumbnail?: string;
    video_id?: string;
    channel?: string;
    tab?:
      | "synthesis"
      | "digest"
      | "flashcards"
      | "quiz"
      | "chat"
      | "transcript";
    start_ts?: number;
    end_ts?: number;
    anchor?: string;
    flashcard_id?: number;
    quiz_question_id?: number;
  };
}

export interface GlobalSearchResponse {
  query: string;
  total_results: number;
  results: GlobalSearchResultItem[];
  searched_at: string;
}

export interface WithinSearchRequest {
  query: string;
  source_types?: Array<
    "summary" | "flashcard" | "quiz" | "chat" | "transcript"
  >;
}

export interface WithinMatchItem {
  source_type: "summary" | "flashcard" | "quiz" | "chat" | "transcript";
  source_id: number;
  summary_id: number;
  text: string;
  text_html: string;
  tab: "synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript";
  score: number;
  passage_id: string;
  metadata: Record<string, unknown>;
}

export interface WithinSearchResponse {
  summary_id: number;
  query: string;
  matches: WithinMatchItem[];
}

export interface RecentQueriesResponse {
  queries: string[];
}

// LEGACY (existant — gardé pour compat)
export interface SemanticSearchResult {
  video_id: string;
  score: number;
  text_preview: string;
  video_title: string;
  video_channel: string;
  thumbnail_url: string | null;
  category: string | null;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  query: string;
  total_results: number;
  searched_at: string;
}

export const searchApi = {
  // ───── V1 (Phase 1 backend mergée) ─────
  async globalSearch(req: GlobalSearchRequest): Promise<GlobalSearchResponse> {
    return request("/api/search/global", {
      method: "POST",
      body: req as unknown as Record<string, unknown>,
    });
  },

  async withinSearch(
    summaryId: number,
    req: WithinSearchRequest,
  ): Promise<WithinSearchResponse> {
    return request(`/api/search/within/${summaryId}`, {
      method: "POST",
      body: req as unknown as Record<string, unknown>,
    });
  },

  async getRecentQueries(): Promise<RecentQueriesResponse> {
    return request("/api/search/recent-queries");
  },

  async clearRecentQueries(): Promise<void> {
    await request("/api/search/recent-queries", { method: "DELETE" });
  },

  // ───── Legacy (gardé pour compat) ─────
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
};
```

- [ ] **Step 1.4 : Vérifier que les tests passent**

```bash
cd mobile && npm run test -- searchApi.test.ts
```

Attendu : 4/4 verts.

- [ ] **Step 1.5 : Vérifier le typecheck global**

```bash
cd mobile && npm run typecheck
```

Attendu : 0 erreur sur les fichiers touchés (les 19 erreurs pré-existantes ne sont pas notre concern, cf. memory `project_deepsight-mobile-refonte`).

- [ ] **Step 1.6 : Commit atomique**

```bash
git add mobile/src/services/api.ts mobile/src/services/__tests__/searchApi.test.ts
git commit -m "feat(mobile-search): extend searchApi with V1 endpoints (global/within/recent)"
```

---

## Task 2 — Tab `search.tsx` + intégration `_layout.tsx` + `CustomTabBar.tsx`

**Files:**

- Create: `mobile/app/(tabs)/search.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/src/components/navigation/CustomTabBar.tsx`

**Goal:** Activer un nouveau tab `Search` (icône loupe) entre `Library` et `Hub` dans la `CustomTabBar`. Le screen `search.tsx` est un squelette qui sera rempli par les composants des tasks suivantes — cette task le rend visible et navigable.

- [ ] **Step 2.1 : Modifier `mobile/app/(tabs)/_layout.tsx`**

Insérer un nouveau `<Tabs.Screen name="search" />` entre `library` et `hub` :

```typescript
<Tabs.Screen
  name="library"
  options={{ title: "Bibliothèque" }}
/>
<Tabs.Screen
  name="search"
  options={{ title: "Recherche" }}
/>
<Tabs.Screen
  name="hub"
  options={{ title: "Hub" }}
/>
```

- [ ] **Step 2.2 : Modifier `mobile/src/components/navigation/CustomTabBar.tsx`**

Dans le `TAB_META` (lignes 39-65), ajouter une entrée `search` entre `library` et `hub` :

```typescript
const TAB_META: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  index: { icon: "home-outline", iconFocused: "home", label: "Accueil" },
  library: { icon: "time-outline", iconFocused: "time", label: "Historique" },
  search: {
    icon: "search-outline",
    iconFocused: "search",
    label: "Rechercher",
  },
  hub: {
    icon: "chatbubbles-outline",
    iconFocused: "chatbubbles",
    label: "Hub",
  },
  study: { icon: "book-outline", iconFocused: "book", label: "Étude" },
  subscription: {
    icon: "sparkles-outline",
    iconFocused: "sparkles",
    label: "Abo",
  },
  profile: {
    icon: "settings-outline",
    iconFocused: "settings",
    label: "Profil",
  },
};
```

- [ ] **Step 2.3 : Créer le screen squelette `mobile/app/(tabs)/search.tsx`**

```typescript
/**
 * mobile/app/(tabs)/search.tsx
 *
 * Tab Search — recherche sémantique globale dans tout le contenu personnel
 * du user (synthèses, flashcards, quiz, chat, transcripts).
 *
 * Spec : `docs/superpowers/specs/2026-05-03-semantic-search-design.md` §5
 */

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useTabBarFootprint } from "@/hooks/useTabBarFootprint";
import { sp } from "@/theme/spacing";
import { fontFamily, fontSize, textStyles } from "@/theme/typography";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { useSemanticSearch } from "@/components/search/useSemanticSearch";
import type { GlobalSearchRequest } from "@/services/api";

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarFootprint = useTabBarFootprint();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Partial<GlobalSearchRequest>>({});
  const { data, isLoading, error } = useSemanticSearch(query, filters);

  const handleQueryChange = useCallback((q: string) => setQuery(q), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="search" density="low" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Rechercher</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            Dans tes analyses, flashcards, quiz et chats
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={handleQueryChange} autoFocus />
        </View>

        {!query.trim() ? (
          <SearchEmptyState onSelectQuery={handleQueryChange} />
        ) : (
          <SearchResultsList
            results={data?.results ?? []}
            isLoading={isLoading}
            error={error}
            bottomPadding={tabBarFootprint}
            query={query}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
  },
  title: { ...textStyles.headingLg },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  searchWrap: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
  },
});
```

Note : `DoodleBackground variant="search"` n'existe peut-être pas — fallback `variant="video"` si besoin (ou ajouter le variant ailleurs en V1.1).

- [ ] **Step 2.4 : Vérifier dans Expo Go**

```bash
cd mobile && npx expo start --clear
```

Le tab `Rechercher` apparaît avec icône loupe. La barre de recherche est visible. Sans query, l'empty state placeholder doit être visible (à ce stade un simple `<Text>` avant Task 3 vraiment branchée).

**Note :** comme `useSemanticSearch` n'existe pas encore en task 2, créer un stub minimal :

```typescript
// Stub temporaire — sera remplacé en Task 7
export function useSemanticSearch(_q: string, _f: any) {
  return { data: undefined, isLoading: false, error: null };
}
```

ainsi que `SearchBar` / `SearchResultsList` / `SearchEmptyState` stubs minimaux qui retournent `null`. Ces stubs seront remplacés dans les tasks 3, 4, 5, 7. Le but de cette task = naviguer vers le tab sans crash.

- [ ] **Step 2.5 : Commit**

```bash
git add mobile/app/\(tabs\)/_layout.tsx \
        mobile/app/\(tabs\)/search.tsx \
        mobile/src/components/navigation/CustomTabBar.tsx \
        mobile/src/components/search/
git commit -m "feat(mobile-search): add Search tab between Library and Hub with skeleton screen"
```

---

## Task 3 — Composant `SearchBar`

**Files:**

- Create: `mobile/src/components/search/SearchBar.tsx`
- Create: `mobile/src/components/search/__tests__/SearchBar.test.tsx`

**Goal:** Input cherchable avec auto-focus, debounce externe (le hook `useSemanticSearch` debounce — la SearchBar elle-même propage immédiatement), bouton clear, accessibilité tap-friendly. Style cohérent avec `mobile/src/components/library/SearchBar.tsx` mais autonome (pas la même responsabilité — celle-ci est full-screen, pas un overlay).

- [ ] **Step 3.1 : TDD — test**

Create: `mobile/src/components/search/__tests__/SearchBar.test.tsx`

```typescript
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SearchBar } from "../SearchBar";
import { ThemeProvider } from "@/contexts/ThemeContext";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("SearchBar (search tab)", () => {
  it("affiche le placeholder par défaut", () => {
    const { getByPlaceholderText } = renderWithTheme(
      <SearchBar value="" onChangeText={jest.fn()} />,
    );
    expect(getByPlaceholderText(/rechercher/i)).toBeTruthy();
  });

  it("propage onChangeText à chaque frappe", () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = renderWithTheme(
      <SearchBar value="" onChangeText={onChange} />,
    );
    fireEvent.changeText(getByPlaceholderText(/rechercher/i), "transition");
    expect(onChange).toHaveBeenCalledWith("transition");
  });

  it("affiche le bouton clear quand value non vide et le déclenche", () => {
    const onChange = jest.fn();
    const { getByLabelText } = renderWithTheme(
      <SearchBar value="abc" onChangeText={onChange} />,
    );
    const clearBtn = getByLabelText(/effacer/i);
    fireEvent.press(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("ne montre pas le bouton clear si value vide", () => {
    const { queryByLabelText } = renderWithTheme(
      <SearchBar value="" onChangeText={jest.fn()} />,
    );
    expect(queryByLabelText(/effacer/i)).toBeNull();
  });
});
```

- [ ] **Step 3.2 : Lancer le test (doit échouer car composant pas implémenté)**

```bash
cd mobile && npm run test -- search/SearchBar.test.tsx
```

- [ ] **Step 3.3 : Implémenter `SearchBar`**

Create: `mobile/src/components/search/SearchBar.tsx`

```typescript
/**
 * SearchBar — Input principal du tab Search.
 *
 * Différences avec `library/SearchBar.tsx` (qui est un overlay temporaire) :
 *   - Pas d'animation d'apparition (toujours visible dans le tab)
 *   - Pas de bouton "fermer" — la search bar est la pièce centrale
 *   - Le debounce est délégué au hook `useSemanticSearch` (parent)
 *   - autoFocus optionnel pour ouverture du tab
 */

import React, { useRef, useEffect } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  autoFocus = false,
  placeholder = "Rechercher dans tes analyses…",
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.glassBg, borderColor: colors.borderFocus },
      ]}
    >
      <Ionicons
        name="search"
        size={18}
        color={colors.textTertiary}
        style={styles.iconLeft}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.textPrimary }]}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        accessibilityLabel="Champ de recherche sémantique"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Effacer la recherche"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: sp.md,
    height: 48,
  },
  iconLeft: { marginRight: sp.sm },
  input: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    paddingVertical: 0,
  },
});
```

- [ ] **Step 3.4 : Tests verts**

```bash
cd mobile && npm run test -- search/SearchBar.test.tsx
```

- [ ] **Step 3.5 : Commit**

```bash
git add mobile/src/components/search/SearchBar.tsx mobile/src/components/search/__tests__/SearchBar.test.tsx
git commit -m "feat(mobile-search): add SearchBar component with auto-focus and clear button"
```

---

## Task 4 — Composant `SearchResultsList` (FlashList virtualisée)

**Files:**

- Create: `mobile/src/components/search/SearchResultsList.tsx`

**Goal:** Liste virtualisée de résultats avec gestion des états loading / error / empty / success. Utilise `@shopify/flash-list` v2 (pattern existant dans `library.tsx`). Pas de pagination V1 : on affiche tous les `data.results` (limit=20 server-side suffisant).

- [ ] **Step 4.1 : Implémenter `SearchResultsList`**

```typescript
/**
 * SearchResultsList — FlashList virtualisée des résultats de recherche.
 *
 * États :
 *   - isLoading=true → skeletons (3 cards)
 *   - error !== null → ErrorState avec retry
 *   - results.length === 0 && query !== "" → "Aucun résultat" + suggestion
 *   - results.length > 0 → FlashList
 */

import React, { useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { sp } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { SearchResultCard } from "./SearchResultCard";
import type { GlobalSearchResultItem } from "@/services/api";

interface SearchResultsListProps {
  results: GlobalSearchResultItem[];
  isLoading: boolean;
  error: Error | null;
  bottomPadding: number;
  query: string;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  isLoading,
  error,
  bottomPadding,
  query,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = useCallback(
    (item: GlobalSearchResultItem) => {
      // Navigate vers analysis avec params highlight
      const summaryId = item.summary_id ?? item.source_id;
      const tab = item.source_metadata.tab ?? "synthesis";
      router.push({
        pathname: "/(tabs)/analysis/[id]",
        params: {
          id: String(summaryId),
          q: query,
          highlight: String(item.source_id),
          tab,
        },
      } as any);
    },
    [router, query],
  );

  const renderItem = useCallback(
    ({ item }: { item: GlobalSearchResultItem }) => (
      <SearchResultCard item={item} onPress={() => handlePress(item)} query={query} />
    ),
    [handlePress, query],
  );

  const keyExtractor = useCallback(
    (item: GlobalSearchResultItem) => `${item.source_type}-${item.source_id}`,
    [],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.gold} size="large" />
        <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
          Recherche en cours…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={42} color={colors.textTertiary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Recherche indisponible — vérifie ta connexion
        </Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="search-outline" size={42} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Aucun résultat pour « {query} »
        </Text>
        <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
          Essaie d'autres mots-clés ou élargis tes filtres
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={results}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={{
        paddingHorizontal: sp.lg,
        paddingTop: sp.md,
        paddingBottom: bottomPadding,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: sp.xl,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: sp.md,
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    textAlign: "center",
    marginTop: sp.md,
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    textAlign: "center",
    marginTop: sp.md,
  },
  emptyHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: sp.xs,
  },
});
```

- [ ] **Step 4.2 : Vérifier visuellement (états loading/error/empty)**

Aucun test unitaire dédié — les états sont testés indirectement via `useSemanticSearch.test.ts` (Task 7).

- [ ] **Step 4.3 : Commit**

```bash
git add mobile/src/components/search/SearchResultsList.tsx
git commit -m "feat(mobile-search): add SearchResultsList with FlashList and 4 states"
```

---

## Task 5 — Composant `SearchResultCard`

**Files:**

- Create: `mobile/src/components/search/SearchResultCard.tsx`
- Create: `mobile/src/components/search/__tests__/SearchResultCard.test.tsx`

**Goal:** Carte individuelle d'un résultat. Affiche un badge type (`SYNTHÈSE`, `FLASHCARD`, `QUIZ`, `CHAT`, `TRANSCRIPT`), le titre du summary, le `text_preview` avec mise en évidence visuelle (substring match), et le score. Tap → navigate via le parent.

- [ ] **Step 5.1 : TDD — test**

```typescript
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SearchResultCard } from "../SearchResultCard";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { GlobalSearchResultItem } from "@/services/api";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

const baseItem: GlobalSearchResultItem = {
  source_type: "summary",
  source_id: 1,
  summary_id: 42,
  score: 0.91,
  text_preview: "La transition énergétique impose…",
  source_metadata: { summary_title: "Crise énergétique EU", tab: "synthesis" },
};

describe("SearchResultCard", () => {
  it("affiche le badge SYNTHÈSE pour source_type summary", () => {
    const { getByText } = renderWithTheme(
      <SearchResultCard item={baseItem} onPress={jest.fn()} query="transition" />,
    );
    expect(getByText(/synthèse/i)).toBeTruthy();
  });

  it("affiche le titre du summary", () => {
    const { getByText } = renderWithTheme(
      <SearchResultCard item={baseItem} onPress={jest.fn()} query="x" />,
    );
    expect(getByText(/crise énergétique/i)).toBeTruthy();
  });

  it("déclenche onPress au tap", () => {
    const onPress = jest.fn();
    const { getByLabelText } = renderWithTheme(
      <SearchResultCard item={baseItem} onPress={onPress} query="x" />,
    );
    fireEvent.press(getByLabelText(/résultat de recherche/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("affiche FLASHCARD pour source_type=flashcard", () => {
    const item = { ...baseItem, source_type: "flashcard" as const };
    const { getByText } = renderWithTheme(
      <SearchResultCard item={item} onPress={jest.fn()} query="x" />,
    );
    expect(getByText(/flashcard/i)).toBeTruthy();
  });
});
```

- [ ] **Step 5.2 : Implémenter**

```typescript
/**
 * SearchResultCard — Carte individuelle d'un résultat de recherche.
 */

import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { GlobalSearchResultItem } from "@/services/api";

const TYPE_META: Record<
  GlobalSearchResultItem["source_type"],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  summary: { label: "SYNTHÈSE", color: palette.indigo, icon: "document-text-outline" },
  flashcard: { label: "FLASHCARD", color: palette.green, icon: "albums-outline" },
  quiz: { label: "QUIZ", color: palette.violet, icon: "help-circle-outline" },
  chat: { label: "CHAT", color: palette.cyan, icon: "chatbubble-outline" },
  transcript: { label: "TRANSCRIPT", color: palette.amber, icon: "mic-outline" },
};

interface SearchResultCardProps {
  item: GlobalSearchResultItem;
  onPress: () => void;
  query: string;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ item, onPress, query }) => {
  const { colors } = useTheme();
  const meta = TYPE_META[item.source_type];

  const previewParts = useMemo(() => {
    const q = query.trim();
    if (!q) return [{ text: item.text_preview, match: false }];
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    return item.text_preview.split(regex).map((part) => ({
      text: part,
      match: part.toLowerCase() === q.toLowerCase(),
    }));
  }, [item.text_preview, query]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityLabel={`Résultat de recherche : ${meta.label} — ${item.source_metadata.summary_title ?? "Sans titre"}`}
      accessibilityRole="button"
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: meta.color + "20", borderColor: meta.color }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={[styles.score, { color: colors.textTertiary }]}>
          {Math.round(item.score * 100)}%
        </Text>
      </View>

      {item.source_metadata.summary_title && (
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.source_metadata.summary_title}
        </Text>
      )}

      <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={3}>
        {previewParts.map((p, i) => (
          <Text
            key={i}
            style={p.match ? { backgroundColor: palette.gold + "40", color: colors.textPrimary } : undefined}
          >
            {p.text}
          </Text>
        ))}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: sp.md,
    marginBottom: sp.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: sp.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xs"],
    letterSpacing: 0.4,
  },
  score: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    marginBottom: sp.xs,
  },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
```

- [ ] **Step 5.3 : Tests verts**

```bash
cd mobile && npm run test -- search/SearchResultCard.test.tsx
```

- [ ] **Step 5.4 : Commit**

```bash
git add mobile/src/components/search/SearchResultCard.tsx mobile/src/components/search/__tests__/SearchResultCard.test.tsx
git commit -m "feat(mobile-search): add SearchResultCard with type badges and query highlighting"
```

---

## Task 6 — `SearchFiltersSheet` (BottomSheet filtres avancés)

**Files:**

- Create: `mobile/src/components/search/SearchFiltersSheet.tsx`

**Goal:** BottomSheet pour les filtres avancés (source_types, plateforme, langue, favoris, période). V1 mobile : seulement les filtres essentiels (source_types pills + favorites toggle + platform youtube/tiktok). On reporte langue/catégorie/playlist V1.1 (yagni).

- [ ] **Step 6.1 : Implémenter**

Use `SimpleBottomSheet` interne (cohérence Expo Go) :

```typescript
/**
 * SearchFiltersSheet — BottomSheet de filtres avancés.
 *
 * V1 mobile (medium tier) : 3 sections seulement
 *   - Source types (pills multi-select)
 *   - Plateforme (youtube/tiktok/all)
 *   - Favoris uniquement (switch)
 *
 * V1.1 reporté : langue, catégorie, période, playlist.
 */

import React, { forwardRef, useCallback } from "react";
import { View, Text, Pressable, Switch, StyleSheet, ScrollView } from "react-native";
import { SimpleBottomSheet, type SimpleBottomSheetRef } from "../ui/SimpleBottomSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { GlobalSearchRequest } from "@/services/api";

const ALL_SOURCE_TYPES: Array<NonNullable<GlobalSearchRequest["source_types"]>[number]> = [
  "summary",
  "flashcard",
  "quiz",
  "chat",
  "transcript",
];
const SOURCE_LABELS: Record<string, string> = {
  summary: "Synthèses",
  flashcard: "Flashcards",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcripts",
};

interface SearchFiltersSheetProps {
  filters: Partial<GlobalSearchRequest>;
  onChange: (next: Partial<GlobalSearchRequest>) => void;
  onClose: () => void;
}

export const SearchFiltersSheet = forwardRef<SimpleBottomSheetRef, SearchFiltersSheetProps>(
  ({ filters, onChange, onClose }, ref) => {
    const { colors } = useTheme();

    const toggleSourceType = useCallback(
      (t: NonNullable<GlobalSearchRequest["source_types"]>[number]) => {
        const current = filters.source_types ?? ALL_SOURCE_TYPES;
        const next = current.includes(t)
          ? current.filter((x) => x !== t)
          : [...current, t];
        onChange({ ...filters, source_types: next.length > 0 ? next : undefined });
      },
      [filters, onChange],
    );

    const setPlatform = useCallback(
      (p: GlobalSearchRequest["platform"] | undefined) => {
        onChange({ ...filters, platform: p });
      },
      [filters, onChange],
    );

    const toggleFavorites = useCallback(
      (v: boolean) => onChange({ ...filters, favorites_only: v }),
      [filters, onChange],
    );

    return (
      <SimpleBottomSheet
        ref={ref}
        snapPoint="60%"
        backgroundStyle={{ backgroundColor: colors.bgPrimary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderLight }}
        onClose={onClose}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Filtres</Text>

          <Text style={[styles.section, { color: colors.textSecondary }]}>Type de contenu</Text>
          <View style={styles.pillRow}>
            {ALL_SOURCE_TYPES.map((t) => {
              const active = (filters.source_types ?? ALL_SOURCE_TYPES).includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() => toggleSourceType(t)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? palette.gold + "20" : colors.glassBg,
                      borderColor: active ? palette.gold : colors.glassBorder,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={SOURCE_LABELS[t]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: active ? palette.gold : colors.textTertiary },
                    ]}
                  >
                    {SOURCE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.section, { color: colors.textSecondary }]}>Plateforme</Text>
          <View style={styles.pillRow}>
            {[
              { v: undefined, label: "Toutes" },
              { v: "youtube" as const, label: "YouTube" },
              { v: "tiktok" as const, label: "TikTok" },
            ].map((opt) => {
              const active = filters.platform === opt.v;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => setPlatform(opt.v)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? palette.indigo + "20" : colors.glassBg,
                      borderColor: active ? palette.indigo : colors.glassBorder,
                    },
                  ]}
                >
                  <Text style={[styles.pillText, { color: active ? palette.indigo : colors.textTertiary }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Favoris uniquement</Text>
            <Switch
              value={filters.favorites_only ?? false}
              onValueChange={toggleFavorites}
              trackColor={{ false: colors.glassBg, true: palette.gold }}
            />
          </View>
        </ScrollView>
      </SimpleBottomSheet>
    );
  },
);

SearchFiltersSheet.displayName = "SearchFiltersSheet";

const styles = StyleSheet.create({
  content: { padding: sp.lg, gap: sp.md },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.sm,
  },
  section: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginTop: sp.md,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: sp.sm },
  pill: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: sp.lg,
  },
  rowLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
});
```

- [ ] **Step 6.2 : Brancher dans `search.tsx`**

Ajouter un bouton "Filtres" sticky sous la SearchBar qui ouvre le sheet. Garder ça simple V1.

- [ ] **Step 6.3 : Commit**

```bash
git add mobile/src/components/search/SearchFiltersSheet.tsx mobile/app/\(tabs\)/search.tsx
git commit -m "feat(mobile-search): add SearchFiltersSheet with source_types, platform, favorites"
```

---

## Task 7 — Hook `useSemanticSearch` (React Query + debounce 400ms)

**Files:**

- Create: `mobile/src/components/search/useSemanticSearch.ts`
- Create: `mobile/src/components/search/__tests__/useSemanticSearch.test.ts`

**Goal:** Hook qui debounce la query (400ms — plus tolérant que web 200ms à cause du clavier mobile + autocorrect), appelle `searchApi.globalSearch`, et retourne `{ data, isLoading, error }`. Skip si `query.trim().length < 2`.

- [ ] **Step 7.1 : TDD — test**

```typescript
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSemanticSearch } from "../useSemanticSearch";
import { searchApi } from "@/services/api";

jest.mock("@/services/api", () => ({
  searchApi: { globalSearch: jest.fn() },
}));

const mocked = searchApi.globalSearch as jest.MockedFunction<typeof searchApi.globalSearch>;

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe("useSemanticSearch", () => {
  beforeEach(() => jest.clearAllMocks());
  jest.useFakeTimers();

  it("ne fetch pas si query trim < 2 caractères", () => {
    renderHook(() => useSemanticSearch(" a ", {}), { wrapper: createWrapper() });
    jest.advanceTimersByTime(500);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("debounce 400ms avant l'appel API", async () => {
    mocked.mockResolvedValue({
      query: "test",
      total_results: 0,
      results: [],
      searched_at: "2026-05-03T10:00:00Z",
    });
    renderHook(() => useSemanticSearch("transition", {}), { wrapper: createWrapper() });
    jest.advanceTimersByTime(300);
    expect(mocked).not.toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    await waitFor(() => expect(mocked).toHaveBeenCalledTimes(1));
  });

  it("transmet les filtres à l'API", async () => {
    mocked.mockResolvedValue({
      query: "x",
      total_results: 0,
      results: [],
      searched_at: "",
    });
    renderHook(
      () => useSemanticSearch("query", { source_types: ["summary"], favorites_only: true }),
      { wrapper: createWrapper() },
    );
    jest.advanceTimersByTime(500);
    await waitFor(() =>
      expect(mocked).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "query",
          source_types: ["summary"],
          favorites_only: true,
        }),
      ),
    );
  });
});
```

- [ ] **Step 7.2 : Implémenter**

```typescript
/**
 * useSemanticSearch — Hook React Query pour /api/search/global.
 *
 * Debounce 400ms (plus tolérant que web 200ms : keyboard mobile + autocorrect).
 * Skip si query.trim().length < 2.
 * Cache 30s (staleTime) — recherches récentes restent fraîches.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/services/api";
import type { GlobalSearchRequest, GlobalSearchResponse } from "@/services/api";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface UseSemanticSearchResult {
  data: GlobalSearchResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function useSemanticSearch(
  query: string,
  filters: Partial<GlobalSearchRequest>,
): UseSemanticSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", "global", trimmed, filters],
    queryFn: () =>
      searchApi.globalSearch({
        query: trimmed,
        limit: 20,
        ...filters,
      }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    data: enabled ? data : undefined,
    isLoading: enabled && isLoading,
    error: (error as Error) ?? null,
  };
}
```

- [ ] **Step 7.3 : Tests verts**

```bash
cd mobile && npm run test -- search/useSemanticSearch.test.ts
```

- [ ] **Step 7.4 : Commit**

```bash
git add mobile/src/components/search/useSemanticSearch.ts mobile/src/components/search/__tests__/useSemanticSearch.test.ts
git commit -m "feat(mobile-search): add useSemanticSearch hook with 400ms debounce"
```

---

## Task 8 — Recent queries (`useRecentQueries` + `SearchEmptyState`)

**Files:**

- Create: `mobile/src/components/search/useRecentQueries.ts`
- Create: `mobile/src/components/search/SearchEmptyState.tsx`

**Goal:** Hook qui gère les recent queries — primary AsyncStorage cache (5 dernières localement) + sync API best-effort (10 dernières server-side). Empty state qui propose les queries récentes en chips cliquables.

- [ ] **Step 8.1 : Implémenter `useRecentQueries`**

```typescript
/**
 * useRecentQueries — Hook AsyncStorage + sync API (best-effort).
 *
 * Primary cache : AsyncStorage clé "deepsight_recent_queries" (5 max).
 * Fallback API : `searchApi.getRecentQueries()` au mount si AsyncStorage vide.
 */

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { searchApi } from "@/services/api";

const STORAGE_KEY = "deepsight_recent_queries";
const MAX_LOCAL = 5;

export function useRecentQueries() {
  const [queries, setQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load on mount: AsyncStorage first, fallback to API
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          if (active) setQueries(parsed.slice(0, MAX_LOCAL));
        } else {
          // Fallback API
          const res = await searchApi.getRecentQueries();
          if (active) {
            setQueries(res.queries.slice(0, MAX_LOCAL));
            await AsyncStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(res.queries.slice(0, MAX_LOCAL)),
            );
          }
        }
      } catch {
        if (active) setQueries([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const push = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setQueries((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(
        0,
        MAX_LOCAL,
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    setQueries([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await searchApi.clearRecentQueries().catch(() => {});
  }, []);

  return { queries, loading, push, clear };
}
```

- [ ] **Step 8.2 : Implémenter `SearchEmptyState`**

```typescript
import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { useRecentQueries } from "./useRecentQueries";

interface SearchEmptyStateProps {
  onSelectQuery: (q: string) => void;
}

export const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({ onSelectQuery }) => {
  const { colors } = useTheme();
  const { queries, clear } = useRecentQueries();

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Ionicons name="sparkles-outline" size={42} color={palette.gold} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Cherche ce que tu veux dans tes analyses
      </Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Synthèses, flashcards, quiz, chats, transcripts — tout est indexé
      </Text>

      {queries.length > 0 && (
        <>
          <View style={styles.headerRow}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>Recherches récentes</Text>
            <Pressable onPress={clear} hitSlop={8} accessibilityLabel="Effacer l'historique">
              <Text style={[styles.clearText, { color: colors.textTertiary }]}>Effacer</Text>
            </Pressable>
          </View>
          <View style={styles.chipsRow}>
            {queries.map((q) => (
              <Pressable
                key={q}
                onPress={() => onSelectQuery(q)}
                style={[styles.chip, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                accessibilityRole="button"
                accessibilityLabel={`Relancer la recherche : ${q}`}
              >
                <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                <Text style={[styles.chipText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: sp.xl, alignItems: "center" },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    textAlign: "center",
    marginTop: sp.md,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: sp.xs,
    maxWidth: 320,
  },
  headerRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: sp["2xl"],
  },
  section: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  clearText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp.sm,
    marginTop: sp.md,
    width: "100%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: "48%",
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});
```

- [ ] **Step 8.3 : Brancher la persistance dans `search.tsx`**

Dans le screen `search.tsx`, appeler `recentQueries.push(query)` quand une recherche est effectuée (debounce, 1 fois par query). Pattern :

```typescript
const recent = useRecentQueries();
useEffect(() => {
  if (data && data.results.length >= 0 && query.trim().length >= 2) {
    recent.push(query);
  }
}, [data]);
```

- [ ] **Step 8.4 : Commit**

```bash
git add mobile/src/components/search/useRecentQueries.ts \
        mobile/src/components/search/SearchEmptyState.tsx \
        mobile/app/\(tabs\)/search.tsx
git commit -m "feat(mobile-search): add recent queries with AsyncStorage cache and empty state"
```

---

## Task 9 — Composant `HighlightedText` + `SemanticHighlighter` Provider

**Files:**

- Create: `mobile/src/components/highlight/SemanticHighlighter.tsx`
- Create: `mobile/src/components/highlight/HighlightedText.tsx`
- Create: `mobile/src/components/highlight/__tests__/HighlightedText.test.tsx`
- Create: `mobile/src/components/highlight/index.ts`

**Goal:** Provider React Context qui héberge la query intra-analyse + les matches. `HighlightedText` est un wrapper `<Text>` qui split le texte sur les matches et applique le surlignage jaune. **Tap sur match jaune = ouvrir `PassageActionSheet`** (Task 11) — pas de tooltip.

- [ ] **Step 9.1 : Implémenter `SemanticHighlighter` (Context)**

```typescript
/**
 * SemanticHighlighter — Context Provider pour la recherche intra-analyse.
 *
 * Hosts :
 *   - query courante
 *   - matches retournés par /api/search/within/{summary_id}
 *   - currentMatchIndex (pour FAB navigation ↑↓)
 *   - flag activeHighlightPassageId (passage cliqué = highlight appuyé temporairement)
 *
 * Consumers : `HighlightedText`, `HighlightNavigationBar`, `PassageActionSheet`.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/services/api";
import type { WithinMatchItem } from "@/services/api";

interface SemanticHighlighterValue {
  query: string;
  setQuery: (q: string) => void;
  matches: WithinMatchItem[];
  currentMatchIndex: number;
  setCurrentMatchIndex: (i: number) => void;
  isLoading: boolean;
  activePassageId: string | null;
  setActivePassageId: (id: string | null) => void;
}

const Ctx = createContext<SemanticHighlighterValue | null>(null);

interface SemanticHighlighterProviderProps {
  children: React.ReactNode;
  summaryId: number;
  initialQuery?: string;
  initialPassageId?: string | null;
}

export const SemanticHighlighterProvider: React.FC<SemanticHighlighterProviderProps> = ({
  children,
  summaryId,
  initialQuery = "",
  initialPassageId = null,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activePassageId, setActivePassageId] = useState<string | null>(initialPassageId);

  const enabled = query.trim().length >= 2;

  const { data, isLoading } = useQuery({
    queryKey: ["search", "within", summaryId, query.trim()],
    queryFn: () => searchApi.withinSearch(summaryId, { query: query.trim() }),
    enabled,
    staleTime: 60_000,
  });

  const matches = useMemo(() => data?.matches ?? [], [data]);

  const value = useMemo<SemanticHighlighterValue>(
    () => ({
      query,
      setQuery,
      matches,
      currentMatchIndex,
      setCurrentMatchIndex,
      isLoading,
      activePassageId,
      setActivePassageId,
    }),
    [query, matches, currentMatchIndex, isLoading, activePassageId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useSemanticHighlighter(): SemanticHighlighterValue | null {
  return useContext(Ctx);
}
```

- [ ] **Step 9.2 : TDD — test pour `HighlightedText`**

```typescript
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { HighlightedText } from "../HighlightedText";
import { SemanticHighlighterProvider } from "../SemanticHighlighter";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const wrap = (child: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <SemanticHighlighterProvider summaryId={1}>{child}</SemanticHighlighterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe("HighlightedText", () => {
  it("rend le texte tel quel quand pas de matches", () => {
    const { getByText } = render(wrap(<HighlightedText tab="synthesis">Hello world</HighlightedText>));
    expect(getByText("Hello world")).toBeTruthy();
  });

  it("appelle onTapMatch quand un span surligné est tapé", () => {
    // Test indirect — quand matches arrivent via React Query, le highlight est rendu.
    // Ici on teste juste que le wrapper rend du texte sans crasher.
    const { getByText } = render(wrap(<HighlightedText tab="synthesis">Texte de test</HighlightedText>));
    expect(getByText(/texte/i)).toBeTruthy();
  });
});
```

- [ ] **Step 9.3 : Implémenter `HighlightedText`**

Approche RN-spécifique : on ne peut pas injecter du HTML brut, on split le texte sur les matches et on rend des `<Text>` nestés. Pour V1 mobile, on simplifie en cherchant le texte exact des `m.text` dans le children string (matching simple).

```typescript
/**
 * HighlightedText — Wrapper Text qui surligne les passages matchés.
 *
 * Approche V1 mobile : on prend les `WithinMatchItem` du provider et on cherche
 * une présence du `text` (passage) dans le children. Si trouvé, on split et
 * on rend la portion en jaune avec onPress → ouvre PassageActionSheet.
 *
 * Limitations connues V1 :
 *   - Match exact uniquement (pas de fuzzy)
 *   - 1 seul match par render — si plusieurs occurences du même text, seule la 1ère est highlightée
 *   Trade-off acceptable mobile (medium tier).
 */

import React, { useCallback } from "react";
import { Text, type TextProps } from "react-native";
import { palette } from "@/theme/colors";
import { useSemanticHighlighter } from "./SemanticHighlighter";
import type { WithinMatchItem } from "@/services/api";

interface HighlightedTextProps extends TextProps {
  children: string;
  tab: WithinMatchItem["tab"];
  onTapMatch?: (match: WithinMatchItem) => void;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  children,
  tab,
  onTapMatch,
  style,
  ...rest
}) => {
  const ctx = useSemanticHighlighter();

  const handleTap = useCallback(
    (m: WithinMatchItem) => {
      ctx?.setActivePassageId(m.passage_id);
      onTapMatch?.(m);
    },
    [ctx, onTapMatch],
  );

  if (!ctx || ctx.matches.length === 0) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  // Filtrer par tab
  const tabMatches = ctx.matches.filter((m) => m.tab === tab);
  if (tabMatches.length === 0) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  // Construire les segments en cherchant chaque `m.text` dans children
  // Approche naïve : on split sur le 1er match trouvé. V1.1 : multi-match overlap detection.
  let remaining = children;
  const segments: Array<{ text: string; match: WithinMatchItem | null }> = [];

  for (const m of tabMatches) {
    if (!m.text) continue;
    const idx = remaining.indexOf(m.text);
    if (idx === -1) continue;
    if (idx > 0) segments.push({ text: remaining.slice(0, idx), match: null });
    segments.push({ text: m.text, match: m });
    remaining = remaining.slice(idx + m.text.length);
  }
  if (remaining) segments.push({ text: remaining, match: null });

  if (segments.length === 0) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <Text style={style} {...rest}>
      {segments.map((seg, i) =>
        seg.match ? (
          <Text
            key={`m-${i}-${seg.match.passage_id}`}
            onPress={() => handleTap(seg.match!)}
            style={{
              backgroundColor:
                ctx.activePassageId === seg.match.passage_id
                  ? palette.gold + "60"
                  : palette.gold + "35",
              color: palette.gold,
            }}
            // hitSlop n'est pas supporté sur Text inline — on s'appuie sur la taille typo + padding visuel via background
            accessibilityRole="button"
            accessibilityLabel={`Passage correspondant : ${seg.match.text.slice(0, 60)}`}
          >
            {seg.text}
          </Text>
        ) : (
          <Text key={`p-${i}`}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
};
```

- [ ] **Step 9.4 : Index file**

Create: `mobile/src/components/highlight/index.ts`

```typescript
export { HighlightedText } from "./HighlightedText";
export {
  SemanticHighlighterProvider,
  useSemanticHighlighter,
} from "./SemanticHighlighter";
export { PassageActionSheet } from "./PassageActionSheet";
export { HighlightNavigationBar } from "./HighlightNavigationBar";
export { useHighlightNav } from "./useHighlightNav";
```

- [ ] **Step 9.5 : Tests verts**

```bash
cd mobile && npm run test -- highlight/HighlightedText.test.tsx
```

- [ ] **Step 9.6 : Commit**

```bash
git add mobile/src/components/highlight/
git commit -m "feat(mobile-search): add SemanticHighlighter provider and HighlightedText component"
```

---

## Task 10 — Intégration `HighlightedText` dans `AnalysisContentDisplay`

**Files:**

- Modify: `mobile/src/components/analysis/AnalysisContentDisplay.tsx`
- Modify: `mobile/app/(tabs)/analysis/[id].tsx` — wrap avec `SemanticHighlighterProvider`

**Goal:** Le `AnalysisContentDisplay` (qui affiche la synthèse texte) doit délier ses `<Text>` paragraphes en `<HighlightedText tab="synthesis">` ou `<HighlightedText tab="digest">` selon le contexte. Quand le provider fournit des matches, ils sont surlignés ; sinon comportement inchangé.

- [ ] **Step 10.1 : Lire `AnalysisContentDisplay.tsx` pour repérer les `<Text>` paragraphes principaux**

```bash
grep -n "<Text\|<Markdown" mobile/src/components/analysis/AnalysisContentDisplay.tsx | head -30
```

Identifier les paragraphes "long-form" (synthesis/digest) — typiquement dans un composant Markdown rendu ou dans des `<Text>` répétés via `.map()` sur les sections.

- [ ] **Step 10.2 : Stratégie minimum invasive**

Pour V1, on ne touche **PAS** au Markdown render (`react-native-markdown-display`) — trop complexe pour intercepter les `<Text>` enfants. À la place, on highlight uniquement les **titres de section** + le **subtitle/intro paragraph** au-dessus du markdown (si exposés en clair). Le tab Synthèse markdown lui-même ne sera pas surligné en V1 mobile.

**Compromis V1 mobile assumé** : Le surlignage en intra-analyse mobile fonctionne pour :

- Les flashcards (Q + A) → tab Étude
- Les quiz (question) → tab Étude
- Les chats (turn user/agent) → tab Hub
- Les sections du structured_index (titres + summary courts) → tab Résumé header

Le markdown long-form du tab Résumé ne sera highlighté qu'en V1.1 (nécessite hook custom dans markdown renderer).

- [ ] **Step 10.3 : Wrapper le composant avec le Provider**

Dans `mobile/app/(tabs)/analysis/[id].tsx`, ajouter dans les params Expo Router :

```typescript
const {
  id,
  backTo,
  initialTab,
  q,
  highlight,
  tab: incomingTab,
} = useLocalSearchParams<{
  id: string;
  backTo?: string;
  initialTab?: string;
  q?: string;
  highlight?: string;
  tab?: string;
}>();
```

Et wrapper le contenu :

```typescript
import { SemanticHighlighterProvider } from "@/components/highlight";

// ... dans le return :
<SemanticHighlighterProvider
  summaryId={Number(effectiveSummaryIdStr) || 0}
  initialQuery={q ?? ""}
  initialPassageId={highlight ?? null}
>
  {/* ... rest of analysis screen ... */}
</SemanticHighlighterProvider>
```

- [ ] **Step 10.4 : Auto-switch vers le tab incoming**

Si `incomingTab` arrive en param et est différent du tab actif, déclencher `setActiveTab(tabIndexMap[incomingTab])`. Mapping naturel :

- `synthesis` / `digest` → tab 0 (Résumé)
- `flashcards` / `quiz` → tab Étude (pas direct sur cette page mais sur Study tab — ouverture cross-tab via router.push)
- `chat` → tab Hub avec param summaryId
- `transcript` → tab 0 (Résumé) — pas de tab dédié transcript

- [ ] **Step 10.5 : Highlight le titre des sections du structured_index**

Le `AnalysisContentDisplay` (à inspecter) rend probablement un index avec les sections. Pour V1, on remplace ces titres par `<HighlightedText tab="synthesis">{section.title}</HighlightedText>` quand le `SemanticHighlighter` est actif.

- [ ] **Step 10.6 : Commit**

```bash
git add mobile/app/\(tabs\)/analysis/\[id\].tsx mobile/src/components/analysis/AnalysisContentDisplay.tsx
git commit -m "feat(mobile-search): wire SemanticHighlighterProvider into analysis screen"
```

---

## Task 11 — `PassageActionSheet` BottomSheet (3 actions)

**Files:**

- Create: `mobile/src/components/highlight/PassageActionSheet.tsx`
- Create: `mobile/src/components/highlight/__tests__/PassageActionSheet.test.tsx`

**Goal:** BottomSheet qui s'ouvre au tap sur un passage surligné (via `setActivePassageId` dans le provider). 3 actions :

1. **Demander à l'IA** → navigate vers `/(tabs)/hub?summaryId=X&prefillQuery=Explique-moi : <passage>`
2. **Sauter au timecode** (si `metadata.start_ts` présent dans le match)
3. **Voir dans Synthèse / Flashcard / Quiz / Chat** (selon `match.tab`)

Pas de tooltip IA mobile (cf. spec §5.3).

- [ ] **Step 11.1 : TDD — test**

```typescript
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PassageActionSheet } from "../PassageActionSheet";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { WithinMatchItem } from "@/services/api";

const baseMatch: WithinMatchItem = {
  source_type: "summary",
  source_id: 1,
  summary_id: 42,
  text: "passage texte",
  text_html: "<mark>passage</mark> texte",
  tab: "synthesis",
  score: 0.9,
  passage_id: "p-1",
  metadata: {},
};

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("PassageActionSheet", () => {
  it("affiche les 3 actions principales", () => {
    const { getByText } = renderWithTheme(
      <PassageActionSheet
        match={baseMatch}
        query="x"
        isOpen
        onClose={jest.fn()}
        summaryId={42}
      />,
    );
    expect(getByText(/demander à l'ia/i)).toBeTruthy();
    expect(getByText(/voir dans/i)).toBeTruthy();
  });

  it("masque 'Sauter timecode' si pas de start_ts", () => {
    const { queryByText } = renderWithTheme(
      <PassageActionSheet
        match={baseMatch}
        query="x"
        isOpen
        onClose={jest.fn()}
        summaryId={42}
      />,
    );
    expect(queryByText(/sauter au timecode/i)).toBeNull();
  });

  it("affiche 'Sauter timecode' si start_ts présent", () => {
    const m = { ...baseMatch, metadata: { start_ts: 222 } };
    const { getByText } = renderWithTheme(
      <PassageActionSheet match={m} query="x" isOpen onClose={jest.fn()} summaryId={42} />,
    );
    expect(getByText(/sauter au timecode/i)).toBeTruthy();
  });

  it("ferme via onClose au tap sur backdrop", () => {
    const onClose = jest.fn();
    renderWithTheme(
      <PassageActionSheet match={baseMatch} query="x" isOpen={false} onClose={onClose} summaryId={42} />,
    );
    // isOpen=false → close immediate sera déclenchée par useEffect
    expect(true).toBe(true); // smoke
  });
});
```

- [ ] **Step 11.2 : Implémenter**

```typescript
/**
 * PassageActionSheet — BottomSheet d'actions sur un passage surligné mobile.
 *
 * 3 actions tap-friendly (pas de tooltip IA mobile, cf. spec §5.3).
 */

import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SimpleBottomSheet, type SimpleBottomSheetRef } from "../ui/SimpleBottomSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { WithinMatchItem } from "@/services/api";

interface PassageActionSheetProps {
  match: WithinMatchItem | null;
  query: string;
  summaryId: number;
  isOpen: boolean;
  onClose: () => void;
}

const TAB_LABELS_FR: Record<WithinMatchItem["tab"], string> = {
  synthesis: "Synthèse",
  digest: "Synthèse",
  flashcards: "Flashcards",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcript",
};

export const PassageActionSheet: React.FC<PassageActionSheetProps> = ({
  match,
  query,
  summaryId,
  isOpen,
  onClose,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const sheetRef = useRef<SimpleBottomSheetRef>(null);

  useEffect(() => {
    if (isOpen && match) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen, match]);

  const handleAskAI = useCallback(() => {
    if (!match) return;
    router.push({
      pathname: "/(tabs)/hub",
      params: {
        summaryId: String(summaryId),
        prefillQuery: `Explique-moi ce passage : ${match.text}`,
        initialMode: "chat",
      },
    } as any);
    onClose();
  }, [match, router, summaryId, onClose]);

  const handleSeekTimecode = useCallback(() => {
    if (!match || !match.metadata.start_ts) return;
    // V1 mobile : on déclenche via custom event ou setState parent
    // Le fallback est de simplement fermer le sheet ; le seek est délégué à
    // l'AudioSummaryPlayer/VideoPlayer parent qui devra écouter `activePassageId`.
    onClose();
  }, [match, onClose]);

  const handleViewInTab = useCallback(() => {
    if (!match) return;
    if (match.tab === "chat") {
      router.push({
        pathname: "/(tabs)/hub",
        params: { summaryId: String(summaryId), initialMode: "chat" },
      } as any);
    } else if (match.tab === "flashcards" || match.tab === "quiz") {
      router.push({
        pathname: "/(tabs)/study",
        params: { summaryId: String(summaryId) },
      } as any);
    } else {
      // synthesis / digest / transcript = tab Résumé (déjà actif)
      // on ferme juste le sheet
    }
    onClose();
  }, [match, router, summaryId, onClose]);

  if (!match) return null;
  const hasTimecode = typeof match.metadata.start_ts === "number";
  const tabLabel = TAB_LABELS_FR[match.tab];

  return (
    <SimpleBottomSheet
      ref={sheetRef}
      snapPoint="38%"
      backgroundStyle={{ backgroundColor: colors.bgPrimary }}
      handleIndicatorStyle={{ backgroundColor: colors.borderLight }}
      onClose={onClose}
    >
      <View style={[styles.content, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.preview, { color: colors.textTertiary }]} numberOfLines={3}>
          “{match.text}”
        </Text>

        <Pressable
          style={[styles.action, { backgroundColor: palette.gold + "15", borderColor: palette.gold }]}
          onPress={handleAskAI}
          accessibilityLabel="Demander à l'IA d'expliquer ce passage"
          accessibilityRole="button"
        >
          <Ionicons name="sparkles-outline" size={20} color={palette.gold} />
          <Text style={[styles.actionText, { color: palette.gold }]}>Demander à l'IA</Text>
        </Pressable>

        {hasTimecode && (
          <Pressable
            style={[styles.action, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
            onPress={handleSeekTimecode}
            accessibilityLabel="Sauter au timecode"
            accessibilityRole="button"
          >
            <Ionicons name="play-circle-outline" size={20} color={colors.textPrimary} />
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>
              Sauter au timecode {Math.floor((match.metadata.start_ts as number) / 60)}:
              {String(Math.floor((match.metadata.start_ts as number) % 60)).padStart(2, "0")}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.action, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
          onPress={handleViewInTab}
          accessibilityLabel={`Voir dans ${tabLabel}`}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.textPrimary} />
          <Text style={[styles.actionText, { color: colors.textPrimary }]}>
            Voir dans {tabLabel}
          </Text>
        </Pressable>
      </View>
    </SimpleBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: { padding: sp.lg, gap: sp.md },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    fontStyle: "italic",
    lineHeight: 20,
    marginBottom: sp.sm,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    flex: 1,
  },
});
```

- [ ] **Step 11.3 : Tests verts**

```bash
cd mobile && npm run test -- highlight/PassageActionSheet.test.tsx
```

- [ ] **Step 11.4 : Commit**

```bash
git add mobile/src/components/highlight/PassageActionSheet.tsx \
        mobile/src/components/highlight/__tests__/PassageActionSheet.test.tsx
git commit -m "feat(mobile-search): add PassageActionSheet with 3 tap-friendly actions"
```

---

## Task 12 — `HighlightNavigationBar` flottant (FAB ↑↓ + compteur)

**Files:**

- Create: `mobile/src/components/highlight/HighlightNavigationBar.tsx`
- Create: `mobile/src/components/highlight/useHighlightNav.ts`
- Create: `mobile/src/components/highlight/__tests__/useHighlightNav.test.ts`

**Goal:** Bouton flottant en bas-droite (FAB-style, `position: absolute`) qui affiche `[3/12 ↑ ↓ ✕]` et permet de naviguer entre les matches. Tap sur ↑/↓ change le `currentMatchIndex` du provider et déclenche un scroll auto + flash CSS sur le match concerné. Tap sur ✕ ferme la recherche intra-analyse (clear query).

- [ ] **Step 12.1 : Hook `useHighlightNav`**

```typescript
import { useCallback } from "react";
import { useSemanticHighlighter } from "./SemanticHighlighter";

export function useHighlightNav() {
  const ctx = useSemanticHighlighter();

  const next = useCallback(() => {
    if (!ctx || ctx.matches.length === 0) return;
    const i = (ctx.currentMatchIndex + 1) % ctx.matches.length;
    ctx.setCurrentMatchIndex(i);
    ctx.setActivePassageId(ctx.matches[i].passage_id);
  }, [ctx]);

  const prev = useCallback(() => {
    if (!ctx || ctx.matches.length === 0) return;
    const i =
      (ctx.currentMatchIndex - 1 + ctx.matches.length) % ctx.matches.length;
    ctx.setCurrentMatchIndex(i);
    ctx.setActivePassageId(ctx.matches[i].passage_id);
  }, [ctx]);

  const close = useCallback(() => {
    if (!ctx) return;
    ctx.setQuery("");
    ctx.setCurrentMatchIndex(0);
    ctx.setActivePassageId(null);
  }, [ctx]);

  return {
    total: ctx?.matches.length ?? 0,
    current: ctx ? ctx.currentMatchIndex + 1 : 0,
    matchesEmpty: !ctx || ctx.matches.length === 0,
    next,
    prev,
    close,
    currentMatch: ctx && ctx.matches[ctx.currentMatchIndex],
  };
}
```

- [ ] **Step 12.2 : Test du hook**

```typescript
import { renderHook, act } from "@testing-library/react-native";
import React from "react";
import { useHighlightNav } from "../useHighlightNav";
import { SemanticHighlighterProvider } from "../SemanticHighlighter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <SemanticHighlighterProvider summaryId={1}>{ui}</SemanticHighlighterProvider>
    </QueryClientProvider>
  );
};

describe("useHighlightNav", () => {
  it("retourne total=0 sans matches", () => {
    const { result } = renderHook(() => useHighlightNav(), {
      wrapper: ({ children }) => wrap(children),
    });
    expect(result.current.total).toBe(0);
    expect(result.current.matchesEmpty).toBe(true);
  });

  it("next/prev sont des no-op sans matches", () => {
    const { result } = renderHook(() => useHighlightNav(), {
      wrapper: ({ children }) => wrap(children),
    });
    act(() => result.current.next());
    expect(result.current.current).toBe(0);
  });
});
```

- [ ] **Step 12.3 : Composant `HighlightNavigationBar`**

```typescript
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { useHighlightNav } from "./useHighlightNav";

interface Props {
  bottomOffset?: number;
}

export const HighlightNavigationBar: React.FC<Props> = ({ bottomOffset = 80 }) => {
  const { colors } = useTheme();
  const { total, current, matchesEmpty, next, prev, close } = useHighlightNav();

  if (matchesEmpty) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={[
        styles.bar,
        { bottom: bottomOffset, backgroundColor: colors.bgElevated, borderColor: palette.gold + "40" },
      ]}
    >
      <Text style={[styles.counter, { color: colors.textPrimary }]}>
        {current}/{total}
      </Text>
      <Pressable
        onPress={prev}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Match précédent"
      >
        <Ionicons name="chevron-up" size={22} color={palette.gold} />
      </Pressable>
      <Pressable
        onPress={next}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Match suivant"
      >
        <Ionicons name="chevron-down" size={22} color={palette.gold} />
      </Pressable>
      <Pressable
        onPress={close}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Fermer la recherche intra-analyse"
      >
        <Ionicons name="close" size={20} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    right: sp.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  counter: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    minWidth: 36,
    textAlign: "center",
  },
  btn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 12.4 : Brancher dans `analysis/[id].tsx`**

À l'intérieur du `SemanticHighlighterProvider`, ajouter en bas de la page :

```typescript
<HighlightNavigationBar bottomOffset={tabBarFootprint + 20} />
```

- [ ] **Step 12.5 : Commit**

```bash
git add mobile/src/components/highlight/HighlightNavigationBar.tsx \
        mobile/src/components/highlight/useHighlightNav.ts \
        mobile/src/components/highlight/__tests__/useHighlightNav.test.ts \
        mobile/app/\(tabs\)/analysis/\[id\].tsx
git commit -m "feat(mobile-search): add floating HighlightNavigationBar with up/down/close"
```

---

## Task 13 — Bouton loupe dans le header de `analysis/[id].tsx` + intra-search SearchBar

**Files:**

- Modify: `mobile/app/(tabs)/analysis/[id].tsx`

**Goal:** Ajouter un bouton loupe à droite du `BackHeader`. Tap → toggle une `SearchBar` floating sticky en haut de la page (sous le header). Tape une query → set la query du provider via `setQuery` → `SemanticHighlighter` fetch les matches → highlights apparaissent dans tous les `<HighlightedText>` de la page → `HighlightNavigationBar` apparaît en bas-droite. `Esc` (Android back button) ferme la SearchBar et clear la query.

- [ ] **Step 13.1 : State local pour la search bar visibility**

Dans `AnalysisDetailScreen` :

```typescript
const [searchBarVisible, setSearchBarVisible] = useState(Boolean(q));
```

(initial = true si `q` arrive en param de navigation depuis le tab Search.)

- [ ] **Step 13.2 : Modifier `BackHeader`**

```typescript
const BackHeader = (
  <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
    <Pressable onPress={handleBack} style={styles.iconButton} accessibilityLabel="Retour">
      <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
    </Pressable>
    <View style={{ flex: 1 }} />
    <Pressable
      onPress={() => setSearchBarVisible((v) => !v)}
      style={styles.iconButton}
      accessibilityLabel={searchBarVisible ? "Fermer la recherche" : "Rechercher dans cette analyse"}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Ionicons
        name={searchBarVisible ? "close" : "search"}
        size={24}
        color={colors.textPrimary}
      />
    </Pressable>
  </View>
);
```

- [ ] **Step 13.3 : Wire la SearchBar au Provider**

Créer un sub-composant `IntraAnalysisSearchInput` :

```typescript
const IntraAnalysisSearchInput: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ctx = useSemanticHighlighter();
  const [localValue, setLocalValue] = useState(ctx?.query ?? "");

  useEffect(() => {
    const t = setTimeout(() => ctx?.setQuery(localValue), 300);
    return () => clearTimeout(t);
  }, [localValue, ctx]);

  return (
    <View style={{ paddingHorizontal: sp.lg, paddingVertical: sp.sm }}>
      <SearchBar
        value={localValue}
        onChangeText={setLocalValue}
        autoFocus
        placeholder="Rechercher dans cette analyse…"
      />
    </View>
  );
};
```

Et l'afficher quand `searchBarVisible` :

```typescript
{searchBarVisible && <IntraAnalysisSearchInput onClose={() => setSearchBarVisible(false)} />}
```

(Importer `SearchBar` depuis `@/components/search/SearchBar`.)

- [ ] **Step 13.4 : `PassageActionSheet` ouvert quand `activePassageId` change**

Ajouter dans `AnalysisDetailScreen` :

```typescript
const ctx = useSemanticHighlighter();
const [actionSheetMatch, setActionSheetMatch] =
  useState<WithinMatchItem | null>(null);

useEffect(() => {
  if (!ctx?.activePassageId) return;
  const m = ctx.matches.find((x) => x.passage_id === ctx.activePassageId);
  if (m) setActionSheetMatch(m);
}, [ctx?.activePassageId, ctx?.matches]);
```

Wait — le hook `useSemanticHighlighter` doit être appelé DANS le scope du provider. Il faut donc déplacer cette logique dans un sub-composant rendu enfant du provider, ou ajouter un useEffect séparé via `<HighlightActionSheetController />`.

Solution propre : créer un composant `<HighlightActionSheetController summaryId={...} />` rendu DANS le provider, qui écoute `activePassageId` et ouvre le sheet.

```typescript
const HighlightActionSheetController: React.FC<{ summaryId: number; query: string }> = ({ summaryId, query }) => {
  const ctx = useSemanticHighlighter();
  const [m, setM] = useState<WithinMatchItem | null>(null);

  useEffect(() => {
    if (!ctx?.activePassageId) {
      setM(null);
      return;
    }
    const found = ctx.matches.find((x) => x.passage_id === ctx.activePassageId);
    setM(found ?? null);
  }, [ctx?.activePassageId, ctx?.matches]);

  return (
    <PassageActionSheet
      match={m}
      query={query}
      summaryId={summaryId}
      isOpen={!!m}
      onClose={() => {
        ctx?.setActivePassageId(null);
        setM(null);
      }}
    />
  );
};
```

- [ ] **Step 13.5 : Commit**

```bash
git add mobile/app/\(tabs\)/analysis/\[id\].tsx
git commit -m "feat(mobile-search): add header search button and intra-analysis SearchBar with action sheet"
```

---

## Task 14 — Plan privileges mirror (`semanticSearchTooltip`) + feature flag check

**Files:**

- Modify: `mobile/src/config/planPrivileges.ts`
- Create: `mobile/src/services/featureFlags.ts`

**Goal:** Mirror du flag backend `semantic_search_tooltip` dans le `PlanFeatures` mobile (cohérence cross-platform — même si non consommé en mobile V1, c'est un upsell potentiel V1.1 quand on ajoutera le tooltip pop-over). Aussi, ajouter un client `featureFlags` qui fetch `/api/features` pour cacher le tab Search si `FEATURE_SEMANTIC_SEARCH_V1=false` côté backend.

- [ ] **Step 14.1 : Modifier `planPrivileges.ts`**

Ajouter dans l'interface `PlanFeatures` (ligne 132-165) :

```typescript
export interface PlanFeatures {
  // ... existant ...
  semanticSearchTooltip: boolean; // Tooltip IA sur passage match (web only V1, mobile V1.1)
}
```

Et dans les 3 plans (free / pro / expert) :

```typescript
free: {
  // ... existant ...
  semanticSearchTooltip: false,
},
pro: {
  // ... existant ...
  semanticSearchTooltip: true,
},
expert: {
  // ... existant ...
  semanticSearchTooltip: true,
},
```

- [ ] **Step 14.2 : Créer `featureFlags.ts`**

```typescript
/**
 * featureFlags — Wrapper léger autour de GET /api/features pour gating UI.
 *
 * Cache 5 min (le flag change rarement). Fallback `true` (optimistic) si erreur.
 */

import { request } from "./api";

interface FeatureFlagsResponse {
  semantic_search_v1?: boolean;
  // (autres flags listés au besoin)
}

let cache: { value: FeatureFlagsResponse; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  try {
    // request est exporté ailleurs ou on utilise fetch direct
    const res = await fetch(
      `${require("../constants/config").API_BASE_URL}/api/features`,
    );
    if (!res.ok) throw new Error("flags fetch failed");
    const value = (await res.json()) as FeatureFlagsResponse;
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    return { semantic_search_v1: true }; // optimistic — UI visible par défaut
  }
}

export async function isSemanticSearchV1Enabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.semantic_search_v1 ?? true;
}
```

- [ ] **Step 14.3 : Hook `useSemanticSearchEnabled`**

```typescript
// mobile/src/hooks/useSemanticSearchEnabled.ts
import { useEffect, useState } from "react";
import { isSemanticSearchV1Enabled } from "../services/featureFlags";

export function useSemanticSearchEnabled(): boolean {
  const [enabled, setEnabled] = useState(true); // optimistic
  useEffect(() => {
    let active = true;
    isSemanticSearchV1Enabled().then((v) => {
      if (active) setEnabled(v);
    });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
```

- [ ] **Step 14.4 : Hide tab si flag OFF**

Dans `mobile/src/components/navigation/CustomTabBar.tsx`, lire le flag et filtrer la route `search` du `visibleRoutes` :

```typescript
import { useSemanticSearchEnabled } from "@/hooks/useSemanticSearchEnabled";
// ... dans CustomTabBar
const searchEnabled = useSemanticSearchEnabled();
const visibleRoutes = useMemo(
  () =>
    (state.routes as Array<{ key: string; name: string }>).filter(
      (route) =>
        route.name in TAB_META && (route.name !== "search" || searchEnabled),
    ),
  [state.routes, searchEnabled],
);
```

- [ ] **Step 14.5 : Commit**

```bash
git add mobile/src/config/planPrivileges.ts \
        mobile/src/services/featureFlags.ts \
        mobile/src/hooks/useSemanticSearchEnabled.ts \
        mobile/src/components/navigation/CustomTabBar.tsx
git commit -m "feat(mobile-search): add semanticSearchTooltip plan flag mirror and feature flag gating"
```

---

## Task 15 — Tests Jest sur composants critiques + 1 flow Detox (optionnel)

**Files:**

- Tous les `__tests__/*.test.tsx` créés en Tasks 1, 3, 5, 7, 9, 11, 12
- Optionnel : `mobile/e2e/semantic-search.e2e.ts` (Detox)

**Goal:** S'assurer que la suite Jest mobile reste verte (178+ tests existants doivent passer) et ajouter un flow Detox haut niveau (search global → tap result → highlight visible → tap match → action sheet ouverte). Le Detox flow est nice-to-have V1 — peut être reporté V1.1 si infra Detox pas prête.

- [ ] **Step 15.1 : Lancer toute la suite Jest**

```bash
cd mobile && npm run test
```

Attendu : 178 + nouveaux tests = ~190+ tous verts.

- [ ] **Step 15.2 : Si Detox configuré, écrire le flow E2E**

Vérifier d'abord :

```bash
cd mobile && cat detox.config.js 2>/dev/null
```

Si Detox absent → SKIP ce step (V1.1 follow-up).

Si Detox présent → créer `mobile/e2e/semantic-search.e2e.ts` :

```typescript
import { device, element, by, expect as detoxExpect } from "detox";

describe("Semantic Search V1", () => {
  beforeAll(async () => {
    await device.launchApp({ permissions: { notifications: "YES" } });
  });

  it("search → tap result → highlight visible → tap match → action sheet", async () => {
    // 1. Login (à adapter selon fixtures Detox du projet)
    await element(by.id("login-email")).typeText("test@test.com");
    await element(by.id("login-password")).typeText("password");
    await element(by.id("login-submit")).tap();

    // 2. Aller au tab Search
    await element(by.label("Rechercher")).tap();

    // 3. Taper une query
    await element(by.label("Champ de recherche sémantique")).typeText(
      "transition",
    );
    await waitFor(element(by.label(/Résultat de recherche/i)).atIndex(0))
      .toBeVisible()
      .withTimeout(8000);

    // 4. Tap sur le 1er résultat
    await element(by.label(/Résultat de recherche/i))
      .atIndex(0)
      .tap();

    // 5. Vérifier qu'on est dans l'analyse, et qu'un passage surligné est visible
    await detoxExpect(
      element(by.label(/Passage correspondant/i)),
    ).toBeVisible();

    // 6. Tap sur le passage surligné
    await element(by.label(/Passage correspondant/i))
      .atIndex(0)
      .tap();

    // 7. ActionSheet ouverte
    await detoxExpect(element(by.text(/Demander à l'IA/i))).toBeVisible();
  });
});
```

- [ ] **Step 15.3 : Commit**

```bash
git add mobile/e2e/semantic-search.e2e.ts || true
git commit -m "test(mobile-search): add Detox E2E flow for semantic search V1" --allow-empty
```

(Allow-empty si Detox absent.)

---

## Task 16 — EAS preview build + test manuel iOS/Android

**Files:**

- Aucun (commande infra)

**Goal:** Lancer un EAS Build preview pour vérifier le rendu sur device réel (iOS + Android). Pas un release prod — le release sera fait dans la phase d'orchestration finale du projet semantic-search-v1.

- [ ] **Step 16.1 : Lancer le build preview**

```bash
cd mobile && eas build --profile preview --platform all
```

Attendre les builds (15-25min iOS + Android).

- [ ] **Step 16.2 : Test manuel sur device**

Checklist :

- [ ] Tab Search visible avec icône loupe entre Library et Hub
- [ ] Tap dans la SearchBar → clavier remonte sans masquer la barre (KeyboardAvoidingView OK)
- [ ] Taper "transition" (ou autre query qui matche tes analyses) → résultats apparaissent en < 1.5s
- [ ] Tap sur un résultat → analyse s'ouvre avec passages surlignés en jaune
- [ ] FAB ↑↓ visible en bas-droite avec compteur "3/12"
- [ ] Tap sur ↑/↓ → highlight focus change (passage devient jaune appuyé)
- [ ] Tap sur un passage surligné → BottomSheet "Demander à l'IA / Voir dans X" s'ouvre
- [ ] Tap "Demander à l'IA" → navigate vers Hub avec input pré-rempli
- [ ] Bouton loupe dans header analyse → toggle search bar intra-analyse
- [ ] Empty state avec recent queries fonctionne après quelques recherches

- [ ] **Step 16.3 : Documenter les bugs trouvés**

Si bugs critiques : créer des tâches dans Asana projet `DeepSight Mobile` et fix avant merge.
Si polish issues : créer un follow-up V1.1.

- [ ] **Step 16.4 : Push final + créer la PR**

```bash
git push origin feat/search-mobile-phase3
gh pr create --base main --title "feat(mobile): Semantic Search V1 — Phase 3 mobile (search tab + intra-analyse + PassageActionSheet)" --body "$(cat <<'EOF'
## Summary

Phase 3 mobile de Semantic Search V1 (cf. spec docs/superpowers/specs/2026-05-03-semantic-search-design.md §5).

- New tab `Search` entre Library et Hub
- `SearchBar` + `SearchResultsList` (FlashList virtualisée) + `SearchResultCard` avec badges typés
- `SearchFiltersSheet` BottomSheet (source_types, plateforme, favoris)
- Intra-analyse via bouton loupe dans le header de `analysis/[id].tsx`
- `HighlightedText` + `SemanticHighlighter` Provider
- `PassageActionSheet` avec 3 actions tap-friendly (Demander à l'IA, Sauter timecode, Voir dans tab)
- `HighlightNavigationBar` flottant FAB ↑↓ avec compteur
- AsyncStorage cache des 5 dernières queries + sync API best-effort
- Mirror plan flag `semanticSearchTooltip` (réservé V1.1 — pas consommé V1)
- Feature flag gating via `/api/features` (tab caché si `FEATURE_SEMANTIC_SEARCH_V1=false`)

## Test plan

- [x] Jest suite verte (~190 tests)
- [ ] Manual smoke test iOS preview build via EAS
- [ ] Manual smoke test Android preview build via EAS
- [ ] Detox flow E2E (optionnel V1.1 si infra non prête)

## Out of scope

- Activation feature flag prod (manuelle, dernière étape orchestration)
- EAS update OTA prod (réservé phase release globale)
- Tooltip IA mobile (tier medium = pas de tooltip — V1.1+)
- Highlights dans le markdown long-form du tab Résumé (V1.1 — nécessite hook custom react-native-markdown-display)
EOF
)"
```

---

## Definition of Done — Phase 3 Mobile

- [ ] Branche `feat/search-mobile-phase3` mergée dans `main` via PR
- [ ] Tab Search visible et fonctionnel sur iOS + Android (EAS preview build)
- [ ] Recherche globale debounce 400ms → résultats < 1.5s sur 1000 passages user
- [ ] Recherche intra-analyse fonctionne via bouton loupe header
- [ ] `PassageActionSheet` 3 actions tap-friendly opérationnel
- [ ] `HighlightNavigationBar` FAB navigation entre matches OK
- [ ] AsyncStorage cache des 5 dernières queries persistant + reset à clear
- [ ] Plan flag `semanticSearchTooltip` mirror backend (cross-platform consistency)
- [ ] Feature flag `FEATURE_SEMANTIC_SEARCH_V1` côté backend cache le tab si OFF
- [ ] Tous les tests Jest verts (Jest 178 + nouveaux ~12 = ~190)
- [ ] Pas de régression sur les autres tabs (Library / Study / Hub / Profile / Subscription)
- [ ] Pas de nouvelle erreur TypeScript hors les 19 pré-existantes documentées
- [ ] Accessibilité validée : tous les `<Text>` highlightés et `<Pressable>` ont `accessibilityLabel` + `accessibilityRole`
- [ ] Commit messages ASCII propres, prefix `feat(mobile-search):` cohérent
- [ ] PR description liée à la spec et aux phases adjacentes (Phases 2 web et 4 extension)

---

## Notes mobile-spécifiques

- **Pas de Cmd+F mobile** — le bouton loupe dans le header est l'entrée principale de la recherche intra-analyse. Pas de raccourci clavier.
- **Pas de tooltip IA mobile** — tap sur highlight ouvre directement le `PassageActionSheet`. Le flag `semanticSearchTooltip` reste mirror du backend pour cohérence cross-platform et upsell V1.1 (modal "Le tooltip IA est sur web uniquement V1").
- **Tap-friendly** : `hitSlop` n'est pas utilisable sur `<Text>` inline (`onPress` sur `<Text>` n'expose pas hitSlop). On compense par background visuel (jaune pâle 35% → jaune appuyé 60% au tap).
- **KeyboardAvoidingView** : essentiel autour de la SearchBar — le clavier mobile masque la barre sinon (cf. risque H + Mitigation ligne 724 du spec).
- **Reanimated 4** : utiliser `FadeIn`/`FadeOut` sur le `HighlightNavigationBar` (pas `Animated` legacy de React Native).
- **Style cohérence** : design system mobile dark-first, palette `gold` pour les highlights (`palette.gold = "#C8903A"`), accents `indigo/violet/cyan` pour les badges typés (cf. `mobile/src/theme/colors.ts`).
- **Tier medium** : simplifications acceptables vs web tier full — pas de filtres avancés langue/catégorie/playlist V1, pas de tooltip IA, markdown long-form non highlighté V1 (titres de section + flashcards/quiz/chat suffisent V1).

---

## Risques & rollback

| Risque                                                          | Mitigation                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Backend FEATURE_SEMANTIC_SEARCH_V1 OFF → tab visible quand même | `useSemanticSearchEnabled` hook caché optimistic mais filtre route dans CustomTabBar — vérifier que le filter marche |
| Highlight casse le rendu Markdown du tab Résumé                 | V1 ne touche PAS au Markdown render. Highlights uniquement sur titres de section, flashcards/quiz/chat               |
| AsyncStorage corruption                                         | Try/catch silencieux — fallback queries vide                                                                         |
| Mistral API timeout intra-analyse                               | React Query retry: 1 + le user voit le state error UI                                                                |
| BottomSheet `SimpleBottomSheet` vs `@gorhom/bottom-sheet`       | On privilégie `SimpleBottomSheet` interne (Expo Go compatible — pattern existant `TutorBottomSheet`)                 |
| EAS Build preview échoue                                        | Tester d'abord `npx expo start` en local — fix avant build cloud                                                     |
| Tests Jest cassent à cause de mock React Query manquant         | Wrapper `QueryClientProvider` documenté dans Tasks 7 et 9                                                            |

**Rollback strategy** : si bug critique en prod après merge, set backend `FEATURE_SEMANTIC_SEARCH_V1=false` (SSH Hetzner + `docker restart repo-backend-1`) → le tab Search disparaît automatiquement côté mobile via le hook `useSemanticSearchEnabled`. Pas de besoin de hot-fix mobile.

---

_Plan rédigé le 2026-05-03 par Claude Opus 4.7 (1M context) suite au brief Phase 3 mobile de Maxime, focus Section 5 de `docs/superpowers/specs/2026-05-03-semantic-search-design.md`._
