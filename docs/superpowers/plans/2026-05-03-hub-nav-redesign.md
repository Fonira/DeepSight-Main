# Hub Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la navigation et l'affichage du Hub `/hub` avec layout 2-band sticky (HubHeader + HubTabBar globale 6 onglets), markdown unifié dans le chat (react-markdown), InputBar context-aware unifiée, et fix de 13 frictions UX/UI identifiées par audit live (score 4,7/10).

**Architecture:** Layout `flex h-screen` avec deux bandes sticky en haut (HubHeader 56px + HubTabBar 40px) + InputBar sticky en bas. TabPanel central avec scroll INTERNE propre par onglet, mémoire de position scroll via `useRef<Map<TabId, number>>`. Onglet Chat intégré aux 5 onglets analyse (sticky tab bar globale). Markdown chat via `react-markdown` + `remark-gfm`.

**Tech Stack:** React 18.3 + TypeScript strict + Vite 5 + Tailwind 3 + Zustand (Immer middleware) + Framer Motion 12 + react-markdown 9 + remark-gfm 4 + Vitest + Testing Library + Playwright E2E.

**Spec source:** `docs/superpowers/specs/2026-05-03-hub-nav-redesign-design.md` (commit `e3b79443`).

---

## File Structure

**Created:**

- `frontend/src/components/hub/HubTabBar.tsx` — sticky tab bar 6 onglets (Synthèse/Quiz/Flashcards/Fiabilité/GEO/Chat)
- `frontend/src/components/hub/__tests__/HubTabBar.test.tsx`

**Modified:**

- `frontend/src/components/hub/types.ts` — ajout `TabId`
- `frontend/src/store/hubStore.ts` — ajout `activeTab`, `tabScrollPositions`, setters
- `frontend/src/components/hub/HubHeader.tsx` — suppression pill `Accueil`, `line-clamp-1` titre, guard subtitle duration
- `frontend/src/components/hub/VideoPiPPlayer.tsx` — masquer badge `00:00` si duration=0
- `frontend/src/components/hub/MessageBubble.tsx` — rendu markdown via react-markdown
- `frontend/src/components/hub/Timeline.tsx` — empty state contextuel chat-only + scroll-to-bubble
- `frontend/src/components/hub/InputBar.tsx` — chip Plateformes repliable + comportement context-aware
- `frontend/src/components/hub/ConversationsDrawer.tsx` — active state ring + créa courte pour doublons
- `frontend/src/components/hub/HubAnalysisPanel.tsx` — refacto sans wrapper card, expose tabs en mode controlled
- `frontend/src/components/AnalysisHub/index.tsx` — accepte `activeTab` + `onTabChange` props (mode controlled)
- `frontend/src/components/AnalysisHub/SynthesisTab.tsx` — overflow horizontal scroll sur toolbar actions (F8)
- `frontend/src/pages/HubPage.tsx` — refacto majeur layout 2-band, scroll preservation, routing `?tab=`

**Deleted:**

- `frontend/src/components/hub/SourcesShelf.tsx`

**Tests Modified:**

- `frontend/src/components/hub/__tests__/HubHeader.test.tsx`
- `frontend/src/components/hub/__tests__/MessageBubble.test.tsx`
- `frontend/src/components/hub/__tests__/Timeline.test.tsx`
- `frontend/src/components/hub/__tests__/InputBar.test.tsx`
- `frontend/src/components/hub/__tests__/VideoPiPPlayer.test.tsx`
- `frontend/src/components/hub/__tests__/ConversationsDrawer.test.tsx`
- `frontend/src/components/hub/__tests__/HubAnalysisPanel.test.tsx`
- `frontend/e2e/hub-unified.spec.ts`

---

## Phase 1 — Foundations (types + store)

### Task 1: Ajouter type `TabId` dans `types.ts`

**Files:**

- Modify: `frontend/src/components/hub/types.ts`

- [ ] **Step 1: Ajouter `TabId` à la fin du fichier**

```typescript
/**
 * Identifiant des onglets globaux du Hub. Inclut les 5 onglets d'analyse
 * (synthesis, quiz, flashcards, reliability, geo) ET l'onglet "chat" qui
 * remplace l'ancienne archi single-scroll par une nav sticky globale.
 *
 * Source de vérité : doit rester en sync avec AnalysisHub.TabType + l'ajout
 * "chat". URL deep-link via `?tab=<TabId>`.
 */
export type TabId =
  | "synthesis"
  | "quiz"
  | "flashcards"
  | "reliability"
  | "geo"
  | "chat";
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/hub/types.ts
git commit -m "feat(hub-types): add TabId type for global hub tab bar"
```

---

### Task 2: Étendre `hubStore` avec `activeTab` + `tabScrollPositions`

**Files:**

- Modify: `frontend/src/store/hubStore.ts`

- [ ] **Step 1: Ajouter import de `TabId`**

Ajouter dans les imports en haut du fichier :

```typescript
import type {
  HubConversation,
  HubMessage,
  HubSummaryContext,
  HubVoiceState,
  TabId,
} from "../components/hub/types";
```

- [ ] **Step 2: Étendre l'interface `HubState`**

Ajouter après `analyzingTaskId: string | null;` :

```typescript
/** Onglet actuellement actif dans la HubTabBar globale. */
activeTab: TabId;
/**
 * Position de scroll mémorisée par onglet (ms scrollTop). Réutilisée
 * lorsque l'utilisateur revient sur un onglet déjà visité (F15). Live
 * pendant la session — pas persistée.
 */
tabScrollPositions: Record<TabId, number>;
```

Et ajouter aux setters :

```typescript
  setActiveTab: (tab: TabId) => void;
  setTabScrollPosition: (tab: TabId, scrollTop: number) => void;
```

- [ ] **Step 3: Étendre `INITIAL`**

```typescript
const INITIAL: Pick<
  HubState,
  | "conversations"
  | "activeConvId"
  | "messages"
  | "summaryContext"
  | "fullSummary"
  | "concepts"
  | "reliability"
  | "reliabilityLoading"
  | "drawerOpen"
  | "summaryExpanded"
  | "pipExpanded"
  | "voiceCallOpen"
  | "voiceState"
  | "newConvModalOpen"
  | "analyzingTaskId"
  | "activeTab"
  | "tabScrollPositions"
> = {
  conversations: [],
  activeConvId: null,
  messages: [],
  summaryContext: null,
  fullSummary: null,
  concepts: [],
  reliability: null,
  reliabilityLoading: false,
  drawerOpen: false,
  summaryExpanded: false,
  pipExpanded: false,
  voiceCallOpen: false,
  voiceState: "idle",
  newConvModalOpen: false,
  analyzingTaskId: null,
  activeTab: "synthesis",
  tabScrollPositions: {
    synthesis: 0,
    quiz: 0,
    flashcards: 0,
    reliability: 0,
    geo: 0,
    chat: 0,
  },
};
```

- [ ] **Step 4: Ajouter les setters dans `create<HubState>()(immer((set) => ({...})))`**

Ajouter avant `reset:`:

```typescript
    setActiveTab: (tab) =>
      set((s) => {
        s.activeTab = tab;
      }),
    setTabScrollPosition: (tab, scrollTop) =>
      set((s) => {
        s.tabScrollPositions[tab] = scrollTop;
      }),
```

- [ ] **Step 5: Vérifier compilation TS**

Run: `cd frontend && npm run typecheck`
Expected: `tsc --noEmit` exit code 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/hubStore.ts
git commit -m "feat(hub-store): add activeTab + tabScrollPositions state"
```

---

## Phase 2 — Nouveaux composants

### Task 3: Créer `HubTabBar` component avec tests

**Files:**

- Create: `frontend/src/components/hub/HubTabBar.tsx`
- Create: `frontend/src/components/hub/__tests__/HubTabBar.test.tsx`

- [ ] **Step 1: Écrire le test pour rendu 6 onglets + click**

Créer `frontend/src/components/hub/__tests__/HubTabBar.test.tsx` :

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HubTabBar } from "../HubTabBar";

describe("HubTabBar", () => {
  const baseProps = {
    activeTab: "synthesis" as const,
    onTabChange: vi.fn(),
    chatMessageCount: 0,
    factCheckCount: 0,
  };

  it("rend les 6 onglets globaux", () => {
    render(<HubTabBar {...baseProps} />);
    expect(screen.getByRole("tab", { name: /Synthèse/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Quiz/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Flashcards/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fiabilité/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /GEO/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Chat/ })).toBeInTheDocument();
  });

  it("marque l'onglet actif avec aria-selected", () => {
    render(<HubTabBar {...baseProps} activeTab="quiz" />);
    expect(screen.getByRole("tab", { name: /Quiz/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Synthèse/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("appelle onTabChange au click", () => {
    const onTabChange = vi.fn();
    render(<HubTabBar {...baseProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /Chat/ }));
    expect(onTabChange).toHaveBeenCalledWith("chat");
  });

  it("affiche un badge sur l'onglet Chat si messages > 0", () => {
    render(<HubTabBar {...baseProps} chatMessageCount={3} />);
    const chatTab = screen.getByRole("tab", { name: /Chat/ });
    expect(chatTab).toHaveTextContent("3");
  });

  it("n'affiche pas de badge sur Chat si messages === 0", () => {
    render(<HubTabBar {...baseProps} chatMessageCount={0} />);
    const chatTab = screen.getByRole("tab", { name: /Chat/ });
    // Le badge est dans un span — vérifier qu'aucun "0" n'est rendu visuellement
    expect(chatTab.textContent).toBe("Chat");
  });

  it("affiche un badge rouge sur Fiabilité si factCheckCount > 0", () => {
    render(<HubTabBar {...baseProps} factCheckCount={2} />);
    const fiaTab = screen.getByRole("tab", { name: /Fiabilité/ });
    expect(fiaTab).toHaveTextContent("2");
  });
});
```

- [ ] **Step 2: Run test pour vérifier qu'il échoue**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/HubTabBar.test.tsx`
Expected: FAIL — `Cannot find module '../HubTabBar'`.

- [ ] **Step 3: Créer `HubTabBar.tsx` minimal pour faire passer les tests**

Créer `frontend/src/components/hub/HubTabBar.tsx` :

```typescript
import React from "react";
import {
  BookOpen,
  Brain,
  BookMarked,
  Shield,
  Target,
  MessageCircle,
} from "lucide-react";
import type { TabId } from "./types";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Nombre de messages dans la conversation, badge sur l'onglet Chat. */
  chatMessageCount: number;
  /** Nombre de claims fact-check P0, badge rouge sur Fiabilité. */
  factCheckCount: number;
}

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof BookOpen;
  activeColor: string;
  activeBorder: string;
}

const TABS: TabConfig[] = [
  {
    id: "synthesis",
    label: "Synthèse",
    icon: BookOpen,
    activeColor: "text-blue-400",
    activeBorder: "border-blue-500",
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: Brain,
    activeColor: "text-amber-400",
    activeBorder: "border-amber-500",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: BookMarked,
    activeColor: "text-emerald-400",
    activeBorder: "border-emerald-500",
  },
  {
    id: "reliability",
    label: "Fiabilité",
    icon: Shield,
    activeColor: "text-violet-400",
    activeBorder: "border-violet-500",
  },
  {
    id: "geo",
    label: "GEO",
    icon: Target,
    activeColor: "text-teal-400",
    activeBorder: "border-teal-500",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageCircle,
    activeColor: "text-indigo-400",
    activeBorder: "border-indigo-500",
  },
];

export const HubTabBar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  chatMessageCount,
  factCheckCount,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Sections du Hub"
      className="sticky top-[56px] z-10 flex border-b border-white/10 overflow-x-auto scrollbar-hide bg-[#0c0c14]/95 backdrop-blur-xl"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const badge =
          tab.id === "chat" && chatMessageCount > 0
            ? String(chatMessageCount)
            : tab.id === "reliability" && factCheckCount > 0
              ? String(factCheckCount)
              : null;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            data-testid={`hub-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0 " +
              (isActive
                ? `${tab.activeBorder} ${tab.activeColor}`
                : "border-transparent text-white/55 hover:text-white/85 hover:border-white/10")
            }
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{tab.label}</span>
            {badge && (
              <span
                className={
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center " +
                  (tab.id === "reliability"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-white/10 text-white/85")
                }
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run test pour vérifier qu'ils passent tous**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/HubTabBar.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/hub/HubTabBar.tsx frontend/src/components/hub/__tests__/HubTabBar.test.tsx
git commit -m "feat(hub): add HubTabBar — 6-tab sticky navigation (Synthèse/Quiz/Flashcards/Fiabilité/GEO/Chat)"
```

---

### Task 4: Refacto `AnalysisHub` pour mode controlled (props `activeTab` + `onTabChange`)

**Files:**

- Modify: `frontend/src/components/AnalysisHub/index.tsx`

- [ ] **Step 1: Lire le fichier actuel pour conserver la logique métier**

Le composant gère actuellement `activeTab` en local via `useState`. On va le passer en mode controlled : si `activeTab` et `onTabChange` props sont fournis, on les utilise ; sinon fallback au state local pour la rétrocompatibilité (Dashboard existant utilise AnalysisHub sans tabs externes).

- [ ] **Step 2: Modifier `AnalysisHubProps` interface**

Ajouter après `enabledTabs?: TabType[]` :

```typescript
  /**
   * Si fourni, le composant fonctionne en mode "controlled" : l'onglet actif
   * est piloté par le parent. Sinon, fallback au state local (rétrocompat).
   */
  activeTabExternal?: TabType;
  /** Setter externe — requis si `activeTabExternal` est fourni. */
  onTabChange?: (tab: TabType) => void;
  /** Si true, masque la tab bar interne (le parent affiche sa propre HubTabBar). */
  hideInternalTabBar?: boolean;
```

- [ ] **Step 3: Adapter la signature et le state**

Remplacer la ligne `const [activeTab, setActiveTab] = useState<TabType>("synthesis");` par :

```typescript
const [activeTabInternal, setActiveTabInternal] =
  useState<TabType>("synthesis");
const activeTab = activeTabExternal ?? activeTabInternal;
const setActiveTab = onTabChange ?? setActiveTabInternal;
```

Et destructurer les nouvelles props dans la signature :

```typescript
export const AnalysisHub: React.FC<AnalysisHubProps> = ({
  selectedSummary,
  reliabilityData,
  reliabilityLoading,
  user,
  language,
  concepts,
  onTimecodeClick,
  onOpenChat,
  onNavigate,
  enabledTabs,
  showKeywords,
  showStudyTools,
  showVoice,
  voiceEnabled,
  onOpenVoice,
  activeTabExternal,
  onTabChange,
  hideInternalTabBar,
}) => {
```

- [ ] **Step 4: Conditionnellement masquer la tab bar interne**

Remplacer le bloc :

```typescript
      {visibleTabs.length > 1 && (
        <div className="sticky top-0 z-10 flex border-b border-border-subtle ...">
          {visibleTabs.map((tab) => { ... })}
        </div>
      )}
```

Par :

```typescript
      {!hideInternalTabBar && visibleTabs.length > 1 && (
        <div className="sticky top-0 z-10 flex border-b border-border-subtle overflow-x-auto scrollbar-hide bg-[#12121a]/95 backdrop-blur-sm">
          {visibleTabs.map((tab) => { /* unchanged */ })}
        </div>
      )}
```

- [ ] **Step 5: Adapter le `useEffect` qui reset l'onglet quand `selectedSummary.id` change**

Remplacer :

```typescript
setActiveTab("synthesis");
```

Par (le `setActiveTab` désormais alias) :

```typescript
if (!activeTabExternal) {
  setActiveTab("synthesis");
}
// Si controlled, le parent gère le reset.
```

- [ ] **Step 6: Vérifier compilation TS et tests existants**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

Run: `cd frontend && npx vitest run src/components/AnalysisHub/`
Expected: PASS (les tests existants utilisent l'API non-controlled, doivent passer).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/AnalysisHub/index.tsx
git commit -m "refactor(analysis-hub): support controlled mode via activeTabExternal/onTabChange/hideInternalTabBar"
```

---

### Task 5: Refacto `HubAnalysisPanel` (suppression wrapper card)

**Files:**

- Modify: `frontend/src/components/hub/HubAnalysisPanel.tsx`
- Modify: `frontend/src/components/hub/__tests__/HubAnalysisPanel.test.tsx`

- [ ] **Step 1: Réécrire `HubAnalysisPanel` pour mode controlled + suppression wrapper card**

Remplacer le contenu de `frontend/src/components/hub/HubAnalysisPanel.tsx` :

```typescript
// frontend/src/components/hub/HubAnalysisPanel.tsx
//
// Wrapper de AnalysisHub pour l'embed dans /hub. Ne porte plus la tab bar
// interne (déléguée à HubTabBar globale). Plus de wrapper card — le panel
// remplit directement la zone TabPanel du HubPage.
//
// Reçoit `activeTab` du HubPage et le forward à AnalysisHub en mode controlled.

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnalysisHub } from "../AnalysisHub";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
  User,
} from "../../services/api";
import type { TabId } from "./types";

interface Props {
  selectedSummary: Summary | null;
  concepts: EnrichedConcept[];
  reliability: ReliabilityResult | null;
  reliabilityLoading: boolean;
  user: User | null;
  language: "fr" | "en";
  /** Onglet actif piloté par HubPage — exclut "chat" qui est rendu hors AnalysisHub. */
  activeTab: Exclude<TabId, "chat">;
  /** Callback pour switch d'onglet (depuis liens internes synthesis-tab). */
  onTabChange: (tab: Exclude<TabId, "chat">) => void;
}

export const HubAnalysisPanel: React.FC<Props> = ({
  selectedSummary,
  concepts,
  reliability,
  reliabilityLoading,
  user,
  language,
  activeTab,
  onTabChange,
}) => {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const handleTimecodeClick = useCallback((_seconds: number) => {
    /* no-op v1 */
  }, []);
  const handleOpenChat = useCallback(
    (_msg?: string) => {
      onTabChange("synthesis"); // Placeholder — onTabChange("chat") est géré par parent
    },
    [onTabChange],
  );

  if (!selectedSummary) return null;

  const analysisUser = {
    plan: user?.plan,
    credits: user?.credits,
  };

  return (
    <div className="px-4 py-4 w-full">
      <AnalysisHub
        selectedSummary={selectedSummary}
        reliabilityData={reliability}
        reliabilityLoading={reliabilityLoading}
        user={analysisUser}
        language={language}
        concepts={concepts}
        onTimecodeClick={handleTimecodeClick}
        onOpenChat={handleOpenChat}
        onNavigate={handleNavigate}
        enabledTabs={["synthesis", "reliability", "quiz", "flashcards", "geo"]}
        showKeywords
        showStudyTools={false}
        showVoice={false}
        activeTabExternal={activeTab}
        onTabChange={onTabChange}
        hideInternalTabBar
      />
    </div>
  );
};
```

- [ ] **Step 2: Mettre à jour les tests existants**

Lire `frontend/src/components/hub/__tests__/HubAnalysisPanel.test.tsx` puis adapter pour passer les nouvelles props `activeTab="synthesis"` et `onTabChange={vi.fn()}`. Si le test asserte sur le wrapper card (`rounded-2xl border-white/10 bg-white/[0.02]`), supprimer ces assertions — le wrapper card a été retiré.

Run: `cd frontend && npx vitest run src/components/hub/__tests__/HubAnalysisPanel.test.tsx`

Si tests cassent, corriger en passant les nouvelles props requises et en retirant les assertions sur les classes du wrapper card.

- [ ] **Step 3: Vérifier compilation TS**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur sur HubAnalysisPanel ou ses consumers (HubPage va être adapté en Task 6).

⚠️ Si erreur TS sur `HubPage.tsx` ligne `<HubAnalysisPanel ...>` : c'est attendu — sera fixé en Task 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/hub/HubAnalysisPanel.tsx frontend/src/components/hub/__tests__/HubAnalysisPanel.test.tsx
git commit -m "refactor(hub-panel): controlled-mode wrapper, drop card frame, hide internal tab bar"
```

---

## Phase 3 — Layout HubPage

### Task 6: Refacto `HubPage` layout 2-band sticky + routing onglet

**Files:**

- Modify: `frontend/src/pages/HubPage.tsx`

- [ ] **Step 1: Lire le fichier actuel pour conserver la logique métier (analyzing, fetch, voice, etc.)**

Le refacto change UNIQUEMENT le bloc JSX de retour + ajoute la gestion `activeTab` via URL `?tab=`. Toute la logique de fetch / voice / analyzing reste identique.

- [ ] **Step 2: Ajouter import HubTabBar + extraire `?tab=` dans HubPage**

Dans les imports en haut de `HubPage.tsx`, ajouter :

```typescript
import { HubTabBar } from "../components/hub/HubTabBar";
```

Dans la déstructuration `useHubStore()`, ajouter :

```typescript
    activeTab,
    tabScrollPositions,
    setActiveTab,
    setTabScrollPosition,
```

Dans le bloc `useSearchParams` au début, ajouter après `urlSummaryId` :

```typescript
const urlTab = searchParams.get("tab") as
  | "synthesis"
  | "quiz"
  | "flashcards"
  | "reliability"
  | "geo"
  | "chat"
  | null;
```

- [ ] **Step 3: Sync URL ↔ activeTab dans un useEffect**

Ajouter après les useEffects existants (avant `// Auto-play TTS`) :

```typescript
// ── Sync URL ?tab= avec activeTab du store ──
useEffect(() => {
  if (urlTab && urlTab !== activeTab) {
    setActiveTab(urlTab);
  }
}, [urlTab, activeTab, setActiveTab]);

// ── Tab par défaut au chargement d'une conv ──
useEffect(() => {
  if (urlTab) return; // URL prime
  if (activeConvId === null) return;
  // Si l'historique a déjà des messages → ouvrir Chat ; sinon Synthèse.
  const next = messages.length > 0 ? "chat" : "synthesis";
  if (next !== activeTab) setActiveTab(next);
}, [activeConvId, messages.length, urlTab, activeTab, setActiveTab]);
```

- [ ] **Step 4: Wrapper `setActiveTab` du store pour aussi pousser dans l'URL**

Créer un callback dans le composant :

```typescript
const handleTabChange = useCallback(
  (tab: TabId) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  },
  [setActiveTab, searchParams, setSearchParams],
);
```

Et importer `TabId` :

```typescript
import type {
  HubConversation,
  HubMessage,
  TabId,
} from "../components/hub/types";
```

- [ ] **Step 5: Réécrire le bloc JSX retourné par HubPage**

Remplacer tout le bloc `return (...)` à partir de `return (` jusqu'à la fermeture du composant par :

```tsx
  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-[#0a0a0f]">
      <DoodleBackground variant="default" className="!opacity-[0.32]" />
      <SEO title="Hub" path="/hub" />

      <HubHeader
        onMenuClick={toggleDrawer}
        onHomeClick={() => navigate("/")}
        title={activeConv?.title ?? "Hub"}
        subtitle={
          activeConv
            ? buildHubSubtitle(
                activeConv.video_source,
                summaryContext?.video_duration_secs,
                activeConv.updated_at,
              ) || undefined
            : undefined
        }
        videoSource={activeConv?.video_source ?? null}
        pipSlot={
          activeConv?.summary_id ? (
            <VideoPiPPlayer
              thumbnailUrl={activeConv.video_thumbnail_url ?? null}
              title={activeConv.title}
              durationSecs={summaryContext?.video_duration_secs ?? 0}
              expanded={pipExpanded}
              onExpand={() => setPipExpanded(true)}
              onShrink={() => setPipExpanded(false)}
            />
          ) : null
        }
      />

      {activeConvId !== null && (
        <HubTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          chatMessageCount={messages.length}
          factCheckCount={
            reliability?.fact_check_lite?.high_risk_claims?.length ?? 0
          }
        />
      )}

      <div className="relative flex-1 flex flex-col overflow-hidden">
        {analyzingTaskId && !activeConvId ? (
          <AnalyzingPlaceholder
            progress={analyzingProgress}
            message={analyzingMessage}
            error={analyzingError}
          />
        ) : activeConvId === null ? (
          <NoConvPlaceholder onOpenDrawer={toggleDrawer} />
        ) : (
          <>
            {activeTab === "chat" ? (
              <Timeline
                messages={messages}
                isThinking={isThinking}
                onQuestionClick={handleSend}
                isActiveTab
              />
            ) : (
              <div
                key={activeTab}
                className="flex-1 overflow-y-auto min-h-0"
                ref={(el) => {
                  if (!el) return;
                  // Restore scroll position pour ce tab.
                  el.scrollTop = tabScrollPositions[activeTab] ?? 0;
                }}
                onScroll={(e) => {
                  setTabScrollPosition(
                    activeTab,
                    (e.target as HTMLDivElement).scrollTop,
                  );
                }}
              >
                {summaryContext && (
                  <HubAnalysisPanel
                    selectedSummary={fullSummary}
                    concepts={concepts}
                    reliability={reliability}
                    reliabilityLoading={reliabilityLoading}
                    user={user}
                    language={language as "fr" | "en"}
                    activeTab={activeTab}
                    onTabChange={(t) => handleTabChange(t)}
                  />
                )}
              </div>
            )}
            <InputBar
              onSend={handleSend}
              onCallToggle={() => setVoiceCallOpen(!voiceCallOpen)}
              onPttHoldComplete={handlePttHoldComplete}
              disabled={!activeConvId}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </>
        )}

        <ConversationsDrawer
          open={drawerOpen}
          onClose={toggleDrawer}
          conversations={conversations}
          activeConvId={activeConvId}
          onSelect={(id) => {
            setActiveConv(id);
            setSearchParams({ conv: String(id) });
          }}
          onAnalyze={triggerAnalyze}
        />

        <NewConversationModal
          open={newConvModalOpen}
          onClose={() => setNewConvModalOpen(false)}
          onSuccess={async (summaryId) => {
            try {
              const resp = await videoApi.getHistory({ limit: 50, page: 1 });
              const convs: HubConversation[] = (resp.items || []).map(
                (item: any) => ({
                  id: item.id,
                  summary_id: item.id,
                  title: sanitizeTitle(item.video_title) || "Sans titre",
                  video_source: (item.platform === "tiktok"
                    ? "tiktok"
                    : "youtube") as "youtube" | "tiktok",
                  video_thumbnail_url: item.thumbnail_url ?? null,
                  last_snippet: undefined,
                  updated_at: item.created_at,
                }),
              );
              setConversations(convs);
              setActiveConv(summaryId);
              setSearchParams({ conv: String(summaryId) });
              if (drawerOpen) toggleDrawer();
            } catch (err) {
              console.error("[HubPage] re-fetch after analyze failed:", err);
              setActiveConv(summaryId);
              setSearchParams({ conv: String(summaryId) });
            }
          }}
          language={language as "fr" | "en"}
        />

        {voiceEnabled && (
          <CallModeFullBleed
            open={voiceCallOpen}
            onClose={() => setVoiceCallOpen(false)}
            summaryId={activeConv?.summary_id ?? null}
            title={activeConv?.title ?? null}
            subtitle={null}
            onVoiceMessage={handleVoiceMessage}
            controllerRef={voiceControllerRef}
            language={language as "fr" | "en"}
          />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Extraire `AnalyzingPlaceholder` et `NoConvPlaceholder` en sub-composants au-dessus de `HubPage`**

Au-dessus de `const HubPage: React.FC = () => {`, ajouter :

```typescript
const AnalyzingPlaceholder: React.FC<{
  progress: number;
  message: string;
  error: string | null;
}> = ({ progress, message, error }) => (
  <div className="flex-1 flex items-center justify-center px-6">
    <div className="max-w-md w-full text-center">
      <div className="relative mx-auto mb-5 w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
        <Loader2 className="relative w-16 h-16 text-indigo-400 mx-auto animate-spin" />
      </div>
      <p className="text-base text-white font-medium mb-1.5">
        Analyse en cours
      </p>
      <p className="text-sm text-white/65 mb-4 leading-relaxed">
        {message ||
          "Démarrage… extraction du transcript et synthèse en route."}
      </p>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progress, 95)}%` }}
        />
      </div>
      <p className="text-[11px] font-mono text-white/40">
        {Math.min(progress, 95)}% · L'analyse continue même si vous fermez
        l'onglet.
      </p>
      {error && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  </div>
);

const NoConvPlaceholder: React.FC<{ onOpenDrawer: () => void }> = ({
  onOpenDrawer,
}) => (
  <div className="flex-1 flex items-center justify-center px-6">
    <div className="max-w-sm text-center">
      <p className="text-base text-white font-medium mb-2">
        Aucune conversation sélectionnée
      </p>
      <p className="text-sm text-white/65 mb-4">
        Choisissez une conversation existante ou collez une URL YouTube/TikTok
        pour analyser une nouvelle vidéo.
      </p>
      <button
        type="button"
        onClick={onOpenDrawer}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-colors text-sm"
      >
        Ouvrir la liste
      </button>
    </div>
  </div>
);
```

- [ ] **Step 7: Supprimer les anciens imports `SourcesShelf`, `SummaryCollapsible` (non utilisés)**

Retirer les lignes :

```typescript
import { SourcesShelf } from "../components/hub/SourcesShelf";
```

(SummaryCollapsible n'est plus importé sur main, vérifier qu'il n'est pas dans les imports.)

- [ ] **Step 8: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 0 erreur. Si erreurs sur InputBar (props manquantes `activeTab` / `onTabChange`) → attendu, fixé en Task 13.

⚠️ Pour ne pas bloquer la chaîne de tasks, on peut temporairement passer `activeTab={activeTab as any}` dans `<InputBar>` pour faire passer le typecheck. Cette ligne sera nettoyée en Task 13.

- [ ] **Step 9: Run le test HubPage si existe (sinon skip)**

Run: `cd frontend && npx vitest run src/pages/__tests__/HubPage 2>&1 | head -30`
Expected: pas de fichier de test direct sur HubPage (les tests Hub sont au niveau composant).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/HubPage.tsx
git commit -m "feat(hub): 2-band sticky layout (HubHeader + HubTabBar) + scroll preservation per tab + URL routing ?tab="
```

---

## Phase 4 — Header / chrome polish

### Task 7: `HubHeader` — supprimer pill `Accueil`, line-clamp-1, guard subtitle

**Files:**

- Modify: `frontend/src/components/hub/HubHeader.tsx`
- Modify: `frontend/src/components/hub/__tests__/HubHeader.test.tsx`

- [ ] **Step 1: Modifier HubHeader pour retirer la pill `Accueil`**

Dans `HubHeader.tsx`, supprimer le bloc :

```typescript
      {onHomeClick && (
        <button
          type="button"
          aria-label="Retour à l'accueil"
          onClick={onHomeClick}
          className="h-9 px-3 flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:border-indigo-400/50 hover:text-indigo-200 transition-colors flex-shrink-0"
        >
          <Home className="w-4 h-4" />
          <span className="text-[13px] font-medium hidden sm:inline">
            Accueil
          </span>
        </button>
      )}
```

Et retirer l'import `Home` du `lucide-react` :

```typescript
import { Menu } from "lucide-react"; // au lieu de "Menu, Home"
```

- [ ] **Step 2: Appliquer `line-clamp-1` au titre**

Remplacer :

```typescript
        <p className="text-sm font-medium text-white truncate">{title}</p>
```

Par :

```typescript
        <p className="text-sm font-medium text-white line-clamp-1">{title}</p>
```

- [ ] **Step 3: Mettre à jour le test HubHeader pour confirmer la suppression**

Lire `frontend/src/components/hub/__tests__/HubHeader.test.tsx` et :

1. Si un test asserte sur la présence d'un bouton "Accueil" labellé → le supprimer.
2. Ajouter un test :

```typescript
  it("ne rend qu'un seul home cliquable (le logo, pas de pill 'Accueil')", () => {
    const onHomeClick = vi.fn();
    render(
      <HubHeader
        onMenuClick={vi.fn()}
        onHomeClick={onHomeClick}
        title="Test"
      />,
    );
    // Pas de bouton avec span text "Accueil" séparé du logo
    expect(screen.queryByText("Accueil")).not.toBeInTheDocument();
    // Le logo wrapper a aria-label "Retour à l'accueil"
    const homeButtons = screen.getAllByRole("button", {
      name: "Retour à l'accueil",
    });
    expect(homeButtons).toHaveLength(1);
  });

  it("applique line-clamp-1 au titre long", () => {
    const longTitle = "A".repeat(200);
    const { container } = render(
      <HubHeader
        onMenuClick={vi.fn()}
        title={longTitle}
      />,
    );
    const titleEl = container.querySelector("p.line-clamp-1");
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toBe(longTitle);
  });
```

- [ ] **Step 4: Run le test**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/HubHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/hub/HubHeader.tsx frontend/src/components/hub/__tests__/HubHeader.test.tsx
git commit -m "fix(hub-header): drop 'Accueil' pill (logo is single home click) + line-clamp-1 title"
```

---

### Task 8: Guard subtitle duration dans HubPage `buildHubSubtitle` (F7)

**Files:**

- Modify: `frontend/src/pages/HubPage.tsx`

- [ ] **Step 1: Modifier `buildHubSubtitle` pour omettre la durée si nulle**

Trouver la fonction `buildHubSubtitle` au début de HubPage.tsx. Remplacer :

```typescript
const buildHubSubtitle = (
  source: "youtube" | "tiktok" | undefined,
  durationSecs: number | undefined,
  updatedAt: string | undefined,
): string => {
  if (!source) return "";
  const platform = source === "tiktok" ? "TikTok" : "YouTube";
  const duration = formatVideoDuration(durationSecs ?? 0);
  const ago = formatAnalyzedAgo(updatedAt);
  const parts = [platform];
  if (duration) parts.push(duration);
  if (ago) parts.push(ago);
  return parts.join(" · ");
};
```

Par :

```typescript
const buildHubSubtitle = (
  source: "youtube" | "tiktok" | undefined,
  durationSecs: number | undefined,
  updatedAt: string | undefined,
): string => {
  if (!source) return "";
  const platform = source === "tiktok" ? "TikTok" : "YouTube";
  // Guard F7 : ne pas afficher "00:00" / "0:00" quand la durée n'est pas
  // disponible. formatVideoDuration retourne "" pour 0/null, mais on ajoute
  // une double sécurité ici.
  const duration =
    durationSecs && durationSecs > 0 ? formatVideoDuration(durationSecs) : "";
  const ago = formatAnalyzedAgo(updatedAt);
  const parts = [platform];
  if (duration) parts.push(duration);
  if (ago) parts.push(ago);
  return parts.join(" · ");
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/HubPage.tsx
git commit -m "fix(hub): hide duration in subtitle when 0 or null (F7)"
```

---

### Task 9: `VideoPiPPlayer` — masquer badge `00:00` si duration=0

**Files:**

- Modify: `frontend/src/components/hub/VideoPiPPlayer.tsx`
- Modify: `frontend/src/components/hub/__tests__/VideoPiPPlayer.test.tsx`

- [ ] **Step 1: Lire `VideoPiPPlayer.tsx` puis trouver le badge durée**

Le badge est le `<span>` (probablement avec classes `font-mono text-[8px]` d'après l'audit) qui rend `{fmt(durationSecs)}`. On veut le wrapper pour qu'il ne rende que si `durationSecs > 0`.

- [ ] **Step 2: Modifier le badge**

Trouver le pattern `<span ...>{fmt(durationSecs)}</span>` (peut apparaître 2 fois — état mini ET expanded) et remplacer par un rendu conditionnel :

```tsx
{
  durationSecs > 0 && (
    <span className="absolute bottom-0.5 right-1 font-mono text-[8px] px-1 bg-black/60 rounded text-white/85">
      {fmt(durationSecs)}
    </span>
  );
}
```

(Adapter les classes existantes selon le code actuel.)

- [ ] **Step 3: Ajouter test correspondant**

Dans `frontend/src/components/hub/__tests__/VideoPiPPlayer.test.tsx`, ajouter :

```typescript
  it("ne rend pas le badge durée si durationSecs === 0 (F7)", () => {
    const { container } = render(
      <VideoPiPPlayer
        thumbnailUrl="https://example.com/thumb.jpg"
        title="Test"
        durationSecs={0}
        expanded={false}
        onExpand={vi.fn()}
        onShrink={vi.fn()}
      />,
    );
    // Le badge "00:00" ne doit pas apparaître
    expect(container.textContent).not.toContain("00:00");
  });

  it("rend le badge durée formaté si durationSecs > 0", () => {
    const { container } = render(
      <VideoPiPPlayer
        thumbnailUrl="https://example.com/thumb.jpg"
        title="Test"
        durationSecs={125}
        expanded={false}
        onExpand={vi.fn()}
        onShrink={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("02:05");
  });
```

- [ ] **Step 4: Run test**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/VideoPiPPlayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/hub/VideoPiPPlayer.tsx frontend/src/components/hub/__tests__/VideoPiPPlayer.test.tsx
git commit -m "fix(pip): hide '00:00' badge when duration is 0 (F7)"
```

---

## Phase 5 — Chat

### Task 10: `MessageBubble` — rendu markdown via react-markdown

**Files:**

- Modify: `frontend/src/components/hub/MessageBubble.tsx`
- Modify: `frontend/src/components/hub/__tests__/MessageBubble.test.tsx`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `frontend/src/components/hub/__tests__/MessageBubble.test.tsx`, ajouter :

```typescript
  it("rend le markdown bold (**texte**) en <strong>", () => {
    const msg = {
      id: "m1",
      role: "assistant" as const,
      content: "Hello **world**",
      source: "text" as const,
      timestamp: Date.now(),
    };
    const { container } = render(<MessageBubble msg={msg} />);
    expect(container.querySelector("strong")?.textContent).toBe("world");
    expect(container.textContent).not.toContain("**");
  });

  it("rend les liens markdown [text](url) en <a target=_blank>", () => {
    const msg = {
      id: "m1",
      role: "assistant" as const,
      content: "See [GitHub](https://github.com)",
      source: "text" as const,
      timestamp: Date.now(),
    };
    const { container } = render(<MessageBubble msg={msg} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://github.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.textContent).toBe("GitHub");
    expect(container.textContent).not.toContain("](");
  });

  it("rend les listes ordonnées (1. item)", () => {
    const msg = {
      id: "m1",
      role: "assistant" as const,
      content: "1. premier\n2. second",
      source: "text" as const,
      timestamp: Date.now(),
    };
    const { container } = render(<MessageBubble msg={msg} />);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("rend les titres ### en <h3>", () => {
    const msg = {
      id: "m1",
      role: "assistant" as const,
      content: "### Sources",
      source: "text" as const,
      timestamp: Date.now(),
    };
    const { container } = render(<MessageBubble msg={msg} />);
    expect(container.querySelector("h3")?.textContent).toBe("Sources");
    expect(container.textContent).not.toContain("###");
  });
```

- [ ] **Step 2: Run tests pour vérifier qu'ils échouent**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/MessageBubble.test.tsx`
Expected: 4 tests FAIL — output contient `**`, `[`, `###` bruts.

- [ ] **Step 3: Modifier `MessageBubble.tsx` pour utiliser react-markdown**

Remplacer le bloc `<p className="whitespace-pre-wrap">{beforeQuestions}</p>` par :

```tsx
<MarkdownRenderer text={beforeQuestions} />
```

Et ajouter en haut du fichier :

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ href, children, ...props }) => (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-300 underline hover:text-indigo-200"
        >
          {children}
        </a>
      ),
      code: ({ className, children, ...props }) => {
        const isInline = !className?.includes("language-");
        if (isInline) {
          return (
            <code
              className="px-1 py-0.5 bg-white/10 rounded text-[12px] font-mono"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <pre className="my-2 p-3 bg-black/30 rounded-md overflow-x-auto">
            <code className="text-[12px] font-mono text-white/85" {...props}>
              {children}
            </code>
          </pre>
        );
      },
      ul: ({ children }) => (
        <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
      ),
      li: ({ children }) => <li className="my-0.5">{children}</li>,
      h1: ({ children }) => (
        <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-sm font-semibold mt-1.5 mb-1">{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="text-sm font-semibold mt-1.5 mb-1">{children}</h4>
      ),
      hr: () => <hr className="my-2 border-white/10" />,
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-white/20 pl-3 my-1.5 text-white/80 italic">
          {children}
        </blockquote>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="text-xs border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border border-white/10 px-2 py-1 text-left font-semibold">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-white/10 px-2 py-1">{children}</td>
      ),
      p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
    }}
  >
    {text}
  </ReactMarkdown>
);
```

- [ ] **Step 4: Run tests pour vérifier qu'ils passent**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/MessageBubble.test.tsx`
Expected: PASS — markdown rendu correctement.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/hub/MessageBubble.tsx frontend/src/components/hub/__tests__/MessageBubble.test.tsx
git commit -m "fix(hub-msg): render markdown via react-markdown + remark-gfm (F5 — was raw text)"
```

---

### Task 11: `Timeline` — empty state contextuel + scroll-to-bubble

**Files:**

- Modify: `frontend/src/components/hub/Timeline.tsx`
- Modify: `frontend/src/components/hub/__tests__/Timeline.test.tsx`

- [ ] **Step 1: Adapter Timeline pour ne rendre l'empty state que si `isActiveTab`**

Modifier la signature et la logique :

```typescript
interface Props {
  messages: HubMessage[];
  isThinking?: boolean;
  onQuestionClick?: (question: string) => void;
  /**
   * True si la Timeline est dans l'onglet Chat actif. L'empty state n'est
   * affiché QUE dans ce cas (cohérent : on est sur un tab vide).
   */
  isActiveTab?: boolean;
}
```

Modifier la condition d'empty state :

```typescript
  if (sorted.length === 0 && !isThinking) {
    if (!isActiveTab) {
      // Pas d'empty state si on n'est pas l'onglet actif (on rend rien — l'onglet
      // est invisible côté DOM via le parent qui ne nous monte pas).
      return null;
    }
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <Sparkles className="w-10 h-10 text-white/40 mx-auto mb-3" />
          <p className="text-base text-white/95 font-medium mb-1.5">
            Posez votre première question
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            L'agent connaît le contexte de la vidéo. Tapez votre question,
            maintenez le micro pour une note vocale, ou cliquez sur 📞 pour
            passer en appel.
          </p>
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Implémenter scroll-to-bubble (F14)**

Modifier le useEffect existant :

```typescript
const lastBubbleRef = useRef<HTMLDivElement>(null);
const lastIdRef = useRef<string | null>(null);

useEffect(() => {
  const newest = sorted[sorted.length - 1];
  if (!newest) return;
  if (newest.id === lastIdRef.current) return;
  lastIdRef.current = newest.id;
  // Scroll vers le NOUVEAU bubble (et pas le bottom du conteneur global).
  if (typeof lastBubbleRef.current?.scrollIntoView === "function") {
    lastBubbleRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }
}, [sorted]);
```

Et attacher la ref au DERNIER bubble seulement :

```tsx
{
  sorted.map((msg, i) => (
    <div key={msg.id} ref={i === sorted.length - 1 ? lastBubbleRef : undefined}>
      <MessageBubble msg={msg} onQuestionClick={onQuestionClick} />
    </div>
  ));
}
```

(Garder la div endRef après pour le `isThinking` indicator.)

- [ ] **Step 3: Wrapper le conteneur Timeline pour scroll interne**

Modifier le bloc retour :

```tsx
return (
  <div className="flex-1 overflow-y-auto min-h-0">
    <div className="px-4 py-5">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {sorted.map((msg, i) => (
          <div
            key={msg.id}
            ref={i === sorted.length - 1 ? lastBubbleRef : undefined}
          >
            <MessageBubble msg={msg} onQuestionClick={onQuestionClick} />
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start" aria-live="polite">
            <div className="px-4 py-3 rounded-2xl border border-white/10 bg-white/5 inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span className="text-xs text-white/65 ml-1">Réflexion…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4: Mettre à jour les tests**

Dans `frontend/src/components/hub/__tests__/Timeline.test.tsx`, ajouter / adapter :

```typescript
  it("rend l'empty state UNIQUEMENT si isActiveTab=true et messages vide", () => {
    const { rerender } = render(
      <Timeline messages={[]} isActiveTab={false} />,
    );
    expect(
      screen.queryByText(/Posez votre première question/),
    ).not.toBeInTheDocument();
    rerender(<Timeline messages={[]} isActiveTab={true} />);
    expect(
      screen.getByText(/Posez votre première question/),
    ).toBeInTheDocument();
  });

  it("scroll vers le dernier bubble quand un nouveau message arrive", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<Timeline messages={[
      { id: "m1", role: "user", content: "a", source: "text", timestamp: 1 },
    ]} />);
    rerender(<Timeline messages={[
      { id: "m1", role: "user", content: "a", source: "text", timestamp: 1 },
      { id: "m2", role: "assistant", content: "b", source: "text", timestamp: 2 },
    ]} />);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
    });
  });
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/Timeline.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/hub/Timeline.tsx frontend/src/components/hub/__tests__/Timeline.test.tsx
git commit -m "fix(hub-timeline): empty state conditional + scroll-to-bubble (F3, F14)"
```

---

### Task 12: `InputBar` — chip Plateformes + comportement context-aware

**Files:**

- Modify: `frontend/src/components/hub/InputBar.tsx`
- Modify: `frontend/src/components/hub/__tests__/InputBar.test.tsx`

- [ ] **Step 1: Étendre les Props et ajouter le state du chip**

Modifier la signature :

```typescript
interface Props {
  onSend: (text: string) => void;
  onCallToggle: () => void;
  onPttHoldComplete: (durationSecs: number) => void;
  disabled?: boolean;
  /** Onglet actif — l'envoi sur autre chose que "chat" doit aussi switcher. */
  activeTab?: TabId;
  /** Setter d'onglet — si fourni et activeTab !== "chat", l'envoi switche sur "chat". */
  onTabChange?: (tab: TabId) => void;
}
```

Importer `TabId` :

```typescript
import type { TabId } from "./types";
```

- [ ] **Step 2: Adapter `send()` pour switcher sur Chat si pas déjà dessus**

```typescript
const send = () => {
  const trimmed = val.trim();
  if (!trimmed) return;
  if (activeTab && activeTab !== "chat" && onTabChange) {
    onTabChange("chat");
  }
  onSend(trimmed);
  setVal("");
};
```

- [ ] **Step 3: Ajouter le chip Plateformes repliable**

Ajouter un state pour collapse :

```typescript
const [platformsOpen, setPlatformsOpen] = useState(() => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("hub-platforms-chip-collapsed") !== "1";
});
const togglePlatforms = () => {
  setPlatformsOpen((v) => {
    const next = !v;
    try {
      window.localStorage.setItem(
        "hub-platforms-chip-collapsed",
        next ? "0" : "1",
      );
    } catch {}
    return next;
  });
};
```

Et juste avant la fermeture du conteneur principal `<div ...>`, ajouter le chip :

```tsx
<div className="absolute -top-7 left-4 right-4 flex justify-center pointer-events-none">
  <button
    type="button"
    onClick={togglePlatforms}
    aria-expanded={platformsOpen}
    aria-controls="hub-platforms-chip"
    className="pointer-events-auto px-2.5 py-1 text-[10px] font-mono tracking-wider text-white/45 hover:text-white/70 bg-[#0a0a0f]/80 backdrop-blur rounded-full border border-white/10 transition-colors"
  >
    {platformsOpen ? "▾" : "▸"} Plateformes : YouTube · TikTok
  </button>
</div>
```

(Pour les tests, on garde l'API simple — le state localStorage est encapsulé.)

- [ ] **Step 4: Mettre à jour les tests**

```typescript
  it("envoi sur tab non-chat appelle onTabChange('chat') puis onSend", () => {
    const onSend = vi.fn();
    const onTabChange = vi.fn();
    render(
      <InputBar
        onSend={onSend}
        onCallToggle={vi.fn()}
        onPttHoldComplete={vi.fn()}
        activeTab="synthesis"
        onTabChange={onTabChange}
      />,
    );
    const input = screen.getByPlaceholderText(/Posez votre question/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByLabelText("Envoyer"));
    expect(onTabChange).toHaveBeenCalledWith("chat");
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("envoi sur tab chat n'appelle PAS onTabChange", () => {
    const onSend = vi.fn();
    const onTabChange = vi.fn();
    render(
      <InputBar
        onSend={onSend}
        onCallToggle={vi.fn()}
        onPttHoldComplete={vi.fn()}
        activeTab="chat"
        onTabChange={onTabChange}
      />,
    );
    const input = screen.getByPlaceholderText(/Posez votre question/);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByLabelText("Envoyer"));
    expect(onTabChange).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("affiche le chip Plateformes (open par défaut)", () => {
    render(
      <InputBar
        onSend={vi.fn()}
        onCallToggle={vi.fn()}
        onPttHoldComplete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Plateformes/)).toBeInTheDocument();
  });
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/InputBar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/hub/InputBar.tsx frontend/src/components/hub/__tests__/InputBar.test.tsx
git commit -m "feat(hub-input): platforms chip + context-aware send (switch to Chat tab if other) (F4)"
```

---

### Task 13: Supprimer `SourcesShelf` (orphelin remplacé par chip InputBar)

**Files:**

- Delete: `frontend/src/components/hub/SourcesShelf.tsx`
- Modify (vérifier) : grep pour les imports.

- [ ] **Step 1: Vérifier qu'aucun autre fichier n'importe SourcesShelf**

Run: `cd frontend && grep -rn "SourcesShelf" src/ e2e/`
Expected: pas d'import (HubPage.tsx l'a déjà retiré en Task 6).

Si trouvé : retirer ces imports manuellement.

- [ ] **Step 2: Supprimer le fichier**

```bash
git rm frontend/src/components/hub/SourcesShelf.tsx
```

- [ ] **Step 3: Si test SourcesShelf existe, le supprimer**

```bash
test -f frontend/src/components/hub/__tests__/SourcesShelf.test.tsx && git rm frontend/src/components/hub/__tests__/SourcesShelf.test.tsx
```

- [ ] **Step 4: Run typecheck pour confirmer pas de référence morte**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(hub): remove orphan SourcesShelf — replaced by Plateformes chip in InputBar (F4)"
```

---

## Phase 6 — Drawer

### Task 14: `ConversationsDrawer` — active state ring + créa courte pour doublons

**Files:**

- Modify: `frontend/src/components/hub/ConversationsDrawer.tsx`
- Modify: `frontend/src/components/hub/__tests__/ConversationsDrawer.test.tsx`

- [ ] **Step 1: Améliorer l'active state**

Dans le `renderGroup` callback, modifier le className conditionnel du `<button>` item :

```typescript
            className={
              "w-full px-3 py-2 rounded-lg mb-0.5 flex gap-2.5 items-start text-left transition-colors " +
              (c.id === activeConvId
                ? "bg-indigo-500/15 border border-indigo-500/40 ring-2 ring-indigo-500/30"
                : "border border-transparent hover:bg-white/[0.04]")
            }
```

- [ ] **Step 2: Ajouter une date courte sous le titre pour différencier les doublons**

Ajouter un helper en haut du fichier :

```typescript
const fmtShortDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: sameYear ? undefined : "2-digit",
    });
  } catch {
    return "";
  }
};
```

Et modifier le bloc snippet/last_snippet pour afficher la date :

```tsx
<div className="flex-1 min-w-0">
  <p className="text-[13px] text-white/85 truncate">{c.title}</p>
  <p className="text-[11px] text-white/45 truncate mt-0.5 flex items-center gap-1.5">
    {c.last_snippet ? <span className="truncate">{c.last_snippet}</span> : null}
    {c.last_snippet && fmtShortDate(c.updated_at) && (
      <span className="text-white/30">·</span>
    )}
    {fmtShortDate(c.updated_at) && (
      <span className="font-mono text-white/35 flex-shrink-0">
        {fmtShortDate(c.updated_at)}
      </span>
    )}
  </p>
</div>
```

- [ ] **Step 3: Ajouter un test pour le ring**

Dans `frontend/src/components/hub/__tests__/ConversationsDrawer.test.tsx` :

```typescript
  it("active conv item a un ring indigo visible", () => {
    const conv = {
      id: 42,
      summary_id: 42,
      title: "Test conv",
      video_source: "youtube" as const,
      video_thumbnail_url: null,
      updated_at: new Date().toISOString(),
    };
    const { container } = render(
      <ConversationsDrawer
        open
        onClose={vi.fn()}
        conversations={[conv]}
        activeConvId={42}
        onSelect={vi.fn()}
      />,
    );
    const activeBtn = container.querySelector(`[data-conv-id="42"]`);
    expect(activeBtn?.className).toMatch(/ring-2/);
    expect(activeBtn?.className).toMatch(/ring-indigo/);
  });

  it("affiche la date courte sous le titre", () => {
    const conv = {
      id: 1,
      summary_id: 1,
      title: "Avec date",
      video_source: "youtube" as const,
      updated_at: "2026-04-15T10:00:00Z",
    };
    render(
      <ConversationsDrawer
        open
        onClose={vi.fn()}
        conversations={[conv]}
        activeConvId={null}
        onSelect={vi.fn()}
      />,
    );
    // Vérifier la présence d'un format type "15 avr."
    expect(screen.getByText(/15 avr/)).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/hub/__tests__/ConversationsDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/hub/ConversationsDrawer.tsx frontend/src/components/hub/__tests__/ConversationsDrawer.test.tsx
git commit -m "fix(hub-drawer): visible active ring + short date for duplicate disambiguation (F13)"
```

---

## Phase 7 — Toolbar overflow

### Task 15: `SynthesisTab` toolbar — overflow horizontal scroll (F8)

**Files:**

- Modify: `frontend/src/components/AnalysisHub/SynthesisTab.tsx`

- [ ] **Step 1: Lire `SynthesisTab.tsx` pour identifier le toolbar**

Le toolbar contient les boutons "Parler avec l'Agent IA / Copier / Partager / Export / Écouter / Citer" et est probablement un `<div className="flex flex-wrap lg:flex-nowrap ...">` enfoui dans un parent `overflow-hidden`.

Run: `cd frontend && grep -n "flex-wrap\|flex-nowrap" src/components/AnalysisHub/SynthesisTab.tsx | head -5`

- [ ] **Step 2: Ajouter overflow-x-auto sur le conteneur toolbar**

Trouver le bloc toolbar (autour des boutons d'actions) et :

1. Remplacer `flex-wrap lg:flex-nowrap` par `flex-nowrap overflow-x-auto scrollbar-hide`.
2. Ajouter sur chaque bouton enfant `flex-shrink-0`.

Exemple de pattern à appliquer :

```tsx
<div
  role="toolbar"
  aria-label="Actions de la synthèse"
  className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2 pb-2"
>
  <Button className="flex-shrink-0">...</Button>
  ...
</div>
```

- [ ] **Step 3: Vérifier visuellement (lancer dev server pour test manuel)**

Run: `cd frontend && npm run dev`

Ouvrir `http://localhost:5173/hub` (avec compte connecté local) → vérifier que le toolbar peut être scrollé horizontalement à des viewports ≥1280px.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AnalysisHub/SynthesisTab.tsx
git commit -m "fix(synthesis-tab): horizontal scrollable toolbar — no more truncated 'Citer'/'Écouter' (F8)"
```

---

## Phase 8 — E2E + verification

### Task 16: Mettre à jour les tests E2E

**Files:**

- Modify: `frontend/e2e/hub-unified.spec.ts`

- [ ] **Step 1: Lire le fichier E2E actuel**

Run: `cd frontend && cat e2e/hub-unified.spec.ts | head -80`

Identifier les sélecteurs cassés par le redesign (tab bar interne, SourcesShelf, pill Accueil).

- [ ] **Step 2: Adapter les sélecteurs**

- Remplacer toute référence à `text=Accueil` (pill) par `aria-label="Retour à l'accueil"` (logo button).
- Remplacer les sélecteurs de tab `text=Synthèse` ciblant `AnalysisHub` interne par `[data-testid="hub-tab-synthesis"]` (HubTabBar globale).
- Remplacer toute référence à `SourcesShelf` (texte "Plateformes supportées") par le chip InputBar (`text=/Plateformes : YouTube/`).

- [ ] **Step 3: Ajouter un test sticky tab bar**

```typescript
test("tab bar reste visible après scroll dans Synthèse", async ({ page }) => {
  await page.goto("/hub?conv=<id-test>"); // remplacer par un id de fixture
  await page.waitForSelector('[data-testid="hub-tab-synthesis"]');
  await page.evaluate(() => {
    const panel = document.querySelector('[role="tablist"]')?.parentElement
      ?.nextElementSibling as HTMLElement;
    panel?.scrollTo({ top: 2000 });
  });
  await page.waitForTimeout(300);
  // La tab bar doit rester visible (sticky)
  expect(await page.isVisible('[data-testid="hub-tab-synthesis"]')).toBe(true);
});

test("clic sur onglet Chat affiche la Timeline / empty state", async ({
  page,
}) => {
  await page.goto("/hub?conv=<id-test>");
  await page.click('[data-testid="hub-tab-chat"]');
  await page.waitForSelector("text=/Posez votre première question|Vocal/");
});
```

- [ ] **Step 4: Run E2E (skip si environnement non monté)**

Run: `cd frontend && npx playwright test e2e/hub-unified.spec.ts --reporter=list`

Si la suite tourne contre prod / staging et nécessite auth — skip ce step et le faire en post-PR. Marker dans le commit message.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/hub-unified.spec.ts
git commit -m "test(e2e-hub): adapt selectors to new layout (HubTabBar globale, no SourcesShelf)"
```

---

### Task 17: Verification finale (typecheck + tests + dev server)

**Files:** aucun (validation only)

- [ ] **Step 1: Typecheck propre**

Run: `cd frontend && npm run typecheck`
Expected: 0 erreur sur les fichiers Hub. Si erreurs sur d'autres fichiers (pré-existantes), les ignorer.

- [ ] **Step 2: Run tous les tests Hub unit**

Run: `cd frontend && npx vitest run src/components/hub/ src/store/hubStore`
Expected: tous PASS.

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: 0 nouvelle erreur introduite.

- [ ] **Step 4: Lancer dev server + check manuel**

Run: `cd frontend && npm run dev`

Ouvrir Chrome sur `http://localhost:5173/hub` (avec login local — accountFeats).

Checklist visuelle :

- [ ] HubHeader : un seul bouton "home" cliquable (le logo). Plus de pill `Accueil`.
- [ ] HubTabBar visible sous le HubHeader (6 onglets). Reste sticky en scrollant.
- [ ] Switch d'onglet Synthèse → Quiz → Chat : URL met à jour `?tab=`.
- [ ] Onglet Chat : empty state visible si messages vides.
- [ ] Envoi message depuis tab Synthèse : switche automatiquement sur Chat.
- [ ] Markdown dans messages chat : gras, listes, liens cliquables tous rendus.
- [ ] Subtitle header : pas de `00:00` quand duration absente.
- [ ] PiP badge `00:00` masqué quand duration=0.
- [ ] Toolbar Synthèse scroll horizontalement à 1280px / 1440px.
- [ ] Drawer : ring indigo visible sur conv active, créa date sous titre.
- [ ] Mobile 393px : header tient, tabs scrollables, InputBar accessible.

- [ ] **Step 5: Commit (si fixes manuels nécessaires sur step 4)**

```bash
git add -p  # cherry-pick les fixes manuels
git commit -m "fix(hub): polish from manual review pass"
```

- [ ] **Step 6: Push branche pour PR**

```bash
git push -u origin fix/hub-nav-redesign
```

- [ ] **Step 7: Créer la Pull Request**

```bash
gh pr create --title "fix(hub): redesign navigation + sticky tab bar globale + markdown chat" --body "$(cat <<'EOF'
## Summary

Refonte de la navigation et de l'affichage du Hub `/hub` pour résoudre les 13 frictions identifiées par l'audit live (score 4.7/10 → cible 8+/10).

- Layout 2-band sticky : `HubHeader` (56px) + `HubTabBar` (6 onglets globaux : Synthèse / Quiz / Flashcards / Fiabilité / GEO / Chat)
- Scroll INTERNE par tab + mémoire de position via `useRef<Map<TabId, number>>`
- InputBar context-aware : envoyer sur tab Synthèse switche automatiquement sur Chat
- Markdown unifié dans messages chat via `react-markdown` + `remark-gfm` (F5 critique)
- Header polish : un seul home (logo), `line-clamp-1` titre, guard duration `> 0`
- Drawer : active ring + créa date courte pour doublons
- Toolbar Synthèse : overflow horizontal scrollable

Hors scope (PRs séparés) : F6 dedup backend, F10/F11 i18n cleanup, F12 score GEO incohérent.

## Spec & plan

- Spec : `docs/superpowers/specs/2026-05-03-hub-nav-redesign-design.md`
- Plan : `docs/superpowers/plans/2026-05-03-hub-nav-redesign.md`
- Audit base : `docs/audit/2026-05-03-deepsight-web-audit.md` + audit live Claude in Chrome

## Test plan

- [ ] Typecheck propre (`npm run typecheck`)
- [ ] Tests unit Hub PASS (`vitest run src/components/hub/`)
- [ ] Lint propre (`npm run lint`)
- [ ] E2E `hub-unified.spec.ts` PASS
- [ ] Manual : tab bar sticky au scroll, switch tab fonctionne, markdown chat rendu, plus de `00:00` parasite, mobile 393 px tient
- [ ] Manual : conversation existante riche (`?conv=<id>`) → onglet Chat affiche les messages avec markdown rendu

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Reporter l'URL de la PR à l'utilisateur**

---

## Self-Review

**Spec coverage** :

- Layout 2-band sticky → Task 6 ✓
- HubTabBar 6 onglets → Task 3 ✓
- Scroll preservation → Task 6 (steps 3 + 5) ✓
- URL routing `?tab=` → Task 6 (steps 2-4) ✓
- Onglet par défaut au mount → Task 6 (step 3) ✓
- Empty state contextuel chat-only → Task 11 ✓
- InputBar context-aware → Task 12 ✓
- Chip Plateformes → Task 12 ✓
- Suppression SourcesShelf → Task 13 ✓
- Markdown chat → Task 10 ✓
- Suppression pill Accueil → Task 7 ✓
- Line-clamp titre → Task 7 ✓
- Guard subtitle duration → Task 8 ✓
- Guard PiP badge `00:00` → Task 9 ✓
- Toolbar overflow → Task 15 ✓
- Active ring drawer + date → Task 14 ✓
- Scroll-to-bubble → Task 11 ✓
- Tests E2E mis à jour → Task 16 ✓

**Placeholder scan** : pas de TBD/TODO/"fill in details". Step 4 de Task 15 demande lecture interactive du fichier (pour identifier le bon block) — c'est explicite et productif, pas un placeholder. Step 4 Task 16 (run E2E) inclut une instruction d'éligibilité (skip si auth manquante) — c'est légitime.

**Type consistency** :

- `TabId` défini Task 1 et utilisé Tasks 2, 3, 6, 12 ✓
- `setActiveTab(tab: TabId)` cohérent ✓
- `tabScrollPositions: Record<TabId, number>` cohérent (Task 2 utilise `Record`, c'est plus simple que `Map<TabId, number>` mentionné dans le spec — mais le spec disait `useRef<Map>` ; ici on stocke dans le store Zustand donc `Record` est plus idiomatique. Comportement identique.) ✓

**Décisions consolidées** :

- `Record<TabId, number>` au lieu de `Map<TabId, number>` (idiomatique Zustand)
- `useEffect` polling URL au lieu de `useLayoutEffect` (acceptable car scroll restoration s'applique au moment du render React, pas avant)

Plan complet, exécutable.

---

## Execution Handoff

**Plan complet et sauvegardé à `docs/superpowers/plans/2026-05-03-hub-nav-redesign.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Je dispatche un sous-agent frais (Opus 4.7) par tâche, review entre tâches, itération rapide. Bien pour ce plan car les tasks sont assez indépendantes (sauf Phase 1 → Phase 2 → Phase 3 enchaînées).

**2. Inline Execution** — Exécution dans cette session via `executing-plans`, batch avec checkpoints pour review.

**Quelle approche ?**
