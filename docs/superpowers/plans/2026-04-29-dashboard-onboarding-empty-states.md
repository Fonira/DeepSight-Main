# Dashboard Mode Rename + Onboarding 3 Steps + EmptyState Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer les libellés des 3 modes de dashboard (Hypnagogique → Focus, Mode Jeu → Quiz, Prompt Inverse → Expert), ajouter un onboarding 3 étapes (Bienvenue → Persona → Première analyse) après signup, et factoriser un composant `<EmptyState>` générique réutilisable sur les écrans History/Debate/Chat/Study.

**Architecture:** Plan **frontend-only**. Aucune migration DB (la colonne `User.preferences` JSON existe déjà depuis migration 008/009 et l'endpoint `PUT /api/auth/preferences` accepte déjà `extra_preferences` mergé non-destructivement). Onboarding monté en overlay dans `ProtectedLayout` derrière check `user.preferences.has_completed_onboarding !== true`. EmptyState générique remplace les placeholders inline et coexiste avec `DoodleEmptyState` (ne pas migrer Debate qui utilise déjà ce composant). Sidebar i18n keys remplacent les chaînes hardcodées tout en préservant les IDs techniques (`classic`, `reverse`) du localStorage `ds-whack-a-mole-mode`.

**Tech Stack:** React 18 + TypeScript strict + Vite 5, Tailwind CSS 3, Framer Motion 12, Zustand, custom `useTranslation` (lit `i18n/{fr,en}.json`), Vitest + Testing Library. Pas de react-i18next — la traduction lit le JSON directement (`t.dashboard.modes.focus.label`). Test wrapper existe : `renderWithProviders` dans `src/__tests__/test-utils.tsx`. Branche : `feature/audit-kimi-plans-2026-04-29`.

---

## Contexte préalable (état codebase à 2026-04-29)

### État Sidebar.tsx (chaînes hardcodées à remplacer)

`frontend/src/components/layout/Sidebar.tsx`, composant `WhackAMoleToggle` (lignes 304-410) :

- L. 363 : `title={enabled ? "Mode Jeu : activé" : "Mode Jeu : désactivé"}`
- L. 369 : `<span className="text-xs font-medium truncate">Mode Jeu</span>`
- L. 394 : bouton "Classique"
- L. 404 : bouton "Prompt Inverse"

Imports lucide existants ligne 9-30 : `LayoutDashboard, History, Swords, Settings, CreditCard, LogOut, ChevronLeft, ChevronRight, Sparkles, ExternalLink, Shield, Info, Scale, BarChart3, User, MessageSquare, GraduationCap, Phone, Menu, Gamepad2`.

⚠ Le hook `useTranslation` (`src/hooks/useTranslation.ts`) retourne directement le JSON sous forme d'objet : `const { t } = useTranslation()` puis `t.nav.dashboard`. Pas de fonction `t("nav.dashboard")` ; les valeurs sont donc déjà du HTML littéral. Pour les nouvelles clés on les lit avec la même syntaxe : `t.dashboard.modes.quiz.label`.

### IDs techniques à NE PAS toucher

`frontend/src/components/layout/Sidebar.tsx:313-321` :

```tsx
const [mode, setMode] = useState<"classic" | "reverse">(() => {
  try {
    return localStorage.getItem("ds-whack-a-mole-mode") === "reverse"
      ? "reverse"
      : "classic";
  } catch {
    return "classic";
  }
});
```

Et consommé dans `frontend/src/hooks/useWhackAMole.ts:366` + `frontend/src/components/WhackAMole.tsx:86,101,113`. Le localStorage `ds-whack-a-mole-mode` reste `"classic" | "reverse"` (PAS `"expert"`).

### État User.preferences

- Migration 008 (déployée prod) ajoute `User.preferences JSON` (cf. mémoire `project_ambient-lighting-v3.md`, `reference_deepsight-hetzner-auto-deploy.md`).
- Backend `backend/src/auth/schemas.py:72-85` : `UpdatePreferencesRequest` accepte `extra_preferences: Optional[dict]`.
- Backend `backend/src/auth/service.py:388-438` : `update_user_preferences` merge le dict `extra_preferences` non-destructivement dans `User.preferences`. Donc envoyer `{ extra_preferences: { has_completed_onboarding: true, persona: "researcher" } }` ne supprime PAS `ambient_lighting_enabled`.
- Backend `backend/src/auth/router.py:339` : `GET /api/auth/me` retourne déjà `preferences: getattr(current_user, "preferences", None) or {}`.
- Backend `backend/src/auth/schemas.py:177-187` : `UserResponse.preferences: dict` est exposé au frontend.
- ⚠ Frontend `services/api.ts:28-57` : interface `User` n'expose PAS encore `preferences`. À ajouter.
- ⚠ Frontend `services/api.ts:843-852` : `authApi.updatePreferences()` whitelist seulement `default_lang | default_mode | default_model`. À étendre pour accepter `extra_preferences`.

### État composants empty existants

- `frontend/src/components/doodles/DoodleEmptyState.tsx` : composant existe avec types `no-analyses | no-flashcards | no-playlists | no-results | welcome`. Utilisé dans `DebatePage.tsx:784-791`. **Décision DB-2 (RELEASE-ORCHESTRATION L.561)** : garder DoodleEmptyState dans Debate (NE PAS migrer). Le nouvel `<EmptyState>` est plus simple/générique et ne remplace pas Doodle.
- `frontend/src/pages/History.tsx:1583-1593` : placeholder inline "Quick Chat — Pas encore d'analyse" → migrer.
- `frontend/src/pages/ChatPage.tsx:778-805` (no video selected) + `:836-859` (empty messages) → migrer.
- `frontend/src/pages/StudyHubPage.tsx:399-413` (Aucun badge encore) → migrer.
- `frontend/src/pages/StudyPage.tsx:899-935` (composant `EmptyState` LOCAL) → conserver (scope vidéo détail différent), pas migrer.
- `frontend/src/pages/PlaylistPage.tsx` : pas d'empty state simple identifié, skip.

### App.tsx structure pour mount onboarding

`frontend/src/App.tsx:435-443` :

```tsx
const ProtectedLayout = () => {
  return (
    <>
      <SEO noindex />
      <Outlet />
    </>
  );
};
```

C'est ici qu'on mount `<OnboardingFlow />` conditionnel. Importe `useAuth` depuis `./hooks/useAuth` (déjà fait L.31).

### Stack tests

- `frontend/vitest.config.ts` : env jsdom, setupFiles `src/__tests__/setup.ts`, include `src/**/*.{test,spec}.{ts,tsx}`.
- `frontend/src/__tests__/test-utils.tsx` : `renderWithProviders` wrappe avec MemoryRouter + QueryClient + LanguageProvider.
- Convention : tests à côté du composant ou dans `src/__tests__/`. Utiliser format `<Component>.test.tsx`.

### Audit gap couvert par ce plan

Issu de `docs/superpowers/plans/2026-04-29-RELEASE-ORCHESTRATION.md` Sprint A :

- Renommer modes dashboard : "Hypnagogique" → "Focus", "Mode Jeu" → "Quiz", "Prompt Inverse" → "Expert" + "Classique" stable.
- Onboarding inexistant après signup → 3 étapes (Welcome / Persona / First analysis).
- Empty states absents → composant générique réutilisable.

⚠ **Décision RELEASE-ORCHESTRATION DB-1** : "Hypnagogique" n'existe pas en code (audit Kimi a confondu avec un mode théorique). On rename `Mode Jeu` → `Mode Quiz`, `Classique` → `Mode Classique`, `Prompt Inverse` → `Mode Expert`. Le label "Mode Focus" demandé par audit est mappé sur l'**état désactivé** du toggle global (`enabled=false`), avec icône `Focus`. Décision à confirmer en self-review.

---

## File Structure

| Fichier                                                                | Action | Responsabilité                                                                                                                                                        |
| ---------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `frontend/src/i18n/fr.json`                                            | Modify | Ajouter namespaces `dashboard.modes.{focus,quiz,classic,expert}.{label,description}` + `onboarding.*` + `empty_states.*`                                              |
| `frontend/src/i18n/en.json`                                            | Modify | Idem (miroir EN)                                                                                                                                                      |
| `frontend/src/components/EmptyState.tsx`                               | Create | Composant générique : `icon, title, description, ctaLabel?, ctaHref?, suggestedVideo?` ; dark mode + glassmorphism + Framer Motion                                    |
| `frontend/src/components/__tests__/EmptyState.test.tsx`                | Create | Tests Vitest : rendu props, CTA cliquable, suggestedVideo conditionnel                                                                                                |
| `frontend/src/services/api.ts`                                         | Modify | Étendre `User` interface (ligne 28) avec `preferences?: Record<string, unknown>` + étendre `authApi.updatePreferences` (ligne 843) avec `extra_preferences` optionnel |
| `frontend/src/components/layout/Sidebar.tsx`                           | Modify | Lignes 363, 369, 394, 404 : remplacer hardcoded par `t.dashboard.modes.{focus,quiz,classic,expert}.label`. IDs `classic                                               | reverse`localStorage inchangés. Ajouter import`Focus, Layout, Terminal` lucide |
| `frontend/src/components/onboarding/OnboardingFlow.tsx`                | Create | Modal 3 étapes Framer Motion, gating sur `user.preferences.has_completed_onboarding`, persiste via `authApi.updatePreferences({ extra_preferences: ... })`            |
| `frontend/src/components/onboarding/PersonaCard.tsx`                   | Create | Card sélectionnable persona (chercheur/journaliste/étudiant/professionnel) avec icône + label + description                                                           |
| `frontend/src/components/onboarding/__tests__/OnboardingFlow.test.tsx` | Create | Tests : 3 étapes, navigation Suivant/Précédent, skip flow, persona persisté, fermeture après step 3                                                                   |
| `frontend/src/components/onboarding/__tests__/PersonaCard.test.tsx`    | Create | Tests : rendu, état sélectionné, click handler                                                                                                                        |
| `frontend/src/App.tsx`                                                 | Modify | Lignes 435-443 : `ProtectedLayout` lit `useAuth().user.preferences?.has_completed_onboarding` ; render `<OnboardingFlow />` conditionnel                              |
| `frontend/src/pages/History.tsx`                                       | Modify | Lignes ~1573-1593 : remplacer placeholder Quick Chat inline par `<EmptyState>` (icon BookOpen, title traduit, ctaLabel "Lancer une analyse")                          |
| `frontend/src/pages/ChatPage.tsx`                                      | Modify | Lignes 778-805 (no video selected) ET 836-859 (empty messages) : migrer vers `<EmptyState>`                                                                           |
| `frontend/src/pages/StudyHubPage.tsx`                                  | Modify | Lignes 399-413 (Aucun badge encore) : migrer vers `<EmptyState>`                                                                                                      |

⚠ **NON modifiés** : `DebatePage.tsx` (garde `DoodleEmptyState` — décision DB-2), `StudyPage.tsx` (composant `EmptyState` local scope vidéo détail, conserve), `PlaylistPage.tsx` (pas de placeholder simple identifié).

---

## Tasks

### Task 1: i18n FR + EN — clés modes + onboarding + empty_states

**Files:**

- Modify: `frontend/src/i18n/fr.json`
- Modify: `frontend/src/i18n/en.json`

- [ ] **Step 1: Ajouter namespace `dashboard.modes` dans `fr.json`**

Insérer (avant `auth` ou après `nav`) :

```json
"dashboard": {
  "modes": {
    "toggle_on": "Mode Quiz : activé",
    "toggle_off": "Mode Quiz : désactivé",
    "focus": {
      "label": "Mode Focus",
      "description": "Interface minimaliste sans distraction"
    },
    "quiz": {
      "label": "Mode Quiz",
      "description": "Apprenez en jouant avec des questions interactives"
    },
    "classic": {
      "label": "Mode Classique",
      "description": "Interface standard avec toutes les options"
    },
    "expert": {
      "label": "Mode Expert",
      "description": "Contrôle total sur les prompts et paramètres"
    }
  }
}
```

- [ ] **Step 2: Ajouter namespace `onboarding` dans `fr.json`**

Ajouter (à la suite de `dashboard`) :

```json
"onboarding": {
  "skip": "Passer",
  "next": "Suivant",
  "previous": "Précédent",
  "step_indicator": "Étape {{current}} / {{total}}",
  "welcome": {
    "title": "Bienvenue sur DeepSight !",
    "description": "Vous avez 5 analyses gratuites ce mois-ci pour découvrir nos résumés vidéo intelligents.",
    "cta": "Commencer"
  },
  "persona": {
    "title": "Que faites-vous principalement ?",
    "description": "Cela nous aide à personnaliser vos recommandations.",
    "researcher": {
      "label": "Chercheur",
      "description": "Veille scientifique, papers, conférences"
    },
    "journalist": {
      "label": "Journaliste",
      "description": "Fact-checking, enquêtes, sources"
    },
    "student": {
      "label": "Étudiant",
      "description": "Cours, révisions, flashcards"
    },
    "professional": {
      "label": "Professionnel",
      "description": "Veille marché, formation continue"
    }
  },
  "first_analysis": {
    "title": "Lançons votre première analyse",
    "description": "Collez l'URL d'une vidéo YouTube ou TikTok.",
    "placeholder": "https://www.youtube.com/watch?v=...",
    "tip": "Conseil : commencez par une vidéo de 10 min max pour un premier résultat rapide.",
    "cta": "Analyser",
    "skip": "Passer — Aller au tableau de bord"
  }
}
```

- [ ] **Step 3: Ajouter namespace `empty_states` dans `fr.json`**

```json
"empty_states": {
  "history": {
    "title": "Aucune analyse pour l'instant",
    "description": "Lancez votre première analyse vidéo pour commencer.",
    "cta": "Lancer une analyse"
  },
  "chat_no_selection": {
    "title": "Sélectionnez une vidéo",
    "description": "Choisissez une vidéo dans la sidebar pour discuter avec l'IA.",
    "cta": "Voir mon historique"
  },
  "chat_empty_thread": {
    "title": "Posez votre première question",
    "description": "L'IA répondra en se basant sur le contenu de la vidéo."
  },
  "study_no_badges": {
    "title": "Aucun badge encore",
    "description": "Continuez vos révisions pour débloquer vos premiers badges."
  }
}
```

- [ ] **Step 4: Miroir complet dans `en.json`**

Mêmes clés, traductions anglaises. Pour `dashboard.modes` :

```json
"dashboard": {
  "modes": {
    "toggle_on": "Quiz mode: enabled",
    "toggle_off": "Quiz mode: disabled",
    "focus": { "label": "Focus Mode", "description": "Distraction-free minimalist interface" },
    "quiz": { "label": "Quiz Mode", "description": "Learn through interactive questions" },
    "classic": { "label": "Classic Mode", "description": "Standard interface with all options" },
    "expert": { "label": "Expert Mode", "description": "Full control over prompts and parameters" }
  }
}
```

Et pour `onboarding` + `empty_states` : traductions miroir directes (Welcome to DeepSight!, You have 5 free analyses this month, etc.).

- [ ] **Step 5: Vérifier syntaxe JSON valide**

Run: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/fr.json'))" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/en.json'))"`
Expected: pas d'output (JSON valide).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat(i18n): add dashboard.modes, onboarding, empty_states keys"
```

---

### Task 2: Composant EmptyState générique (TDD)

**Files:**

- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/components/__tests__/EmptyState.test.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

```tsx
// frontend/src/components/__tests__/EmptyState.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { History as HistoryIcon } from "lucide-react";
import { renderWithProviders } from "../../__tests__/test-utils";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title, description and icon", () => {
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Aucune analyse"
        description="Lancez votre première analyse"
      />,
    );
    expect(screen.getByText("Aucune analyse")).toBeInTheDocument();
    expect(
      screen.getByText("Lancez votre première analyse"),
    ).toBeInTheDocument();
  });

  it("renders CTA when ctaLabel and ctaHref provided", async () => {
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Vide"
        description="Rien"
        ctaLabel="Lancer une analyse"
        ctaHref="/dashboard"
      />,
    );
    const cta = screen.getByRole("link", { name: /lancer une analyse/i });
    expect(cta).toHaveAttribute("href", "/dashboard");
  });

  it("calls onCta when ctaLabel + onCta provided (no href)", async () => {
    const onCta = vi.fn();
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Vide"
        description="Rien"
        ctaLabel="Action"
        onCta={onCta}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /action/i }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("renders suggestedVideo block when provided", () => {
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Vide"
        description="Rien"
        suggestedVideo={{
          title: "Vidéo recommandée",
          thumbnailUrl: "https://example.com/thumb.jpg",
          href: "/dashboard?video=abc",
        }}
      />,
    );
    expect(screen.getByText("Vidéo recommandée")).toBeInTheDocument();
    const thumb = screen.getByRole("img");
    expect(thumb).toHaveAttribute("src", "https://example.com/thumb.jpg");
  });

  it("does NOT render CTA when ctaLabel missing", () => {
    renderWithProviders(
      <EmptyState icon={HistoryIcon} title="Vide" description="Rien" />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run le test → échec attendu**

Run: `cd frontend && npx vitest run src/components/__tests__/EmptyState.test.tsx`
Expected: FAIL — `Cannot find module '../EmptyState'`.

- [ ] **Step 3: Implémenter le composant minimal**

```tsx
// frontend/src/components/EmptyState.tsx
import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface SuggestedVideo {
  title: string;
  thumbnailUrl: string;
  href: string;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  suggestedVideo?: SuggestedVideo;
  className?: string;
}

/**
 * Composant générique d'état vide réutilisable.
 *
 * Usage minimal :
 *   <EmptyState icon={History} title="..." description="..." />
 *
 * Avec CTA navigation :
 *   <EmptyState ... ctaLabel="..." ctaHref="/dashboard" />
 *
 * Avec CTA action :
 *   <EmptyState ... ctaLabel="..." onCta={() => doSomething()} />
 *
 * Avec suggestion vidéo (optionnel) :
 *   <EmptyState ... suggestedVideo={{ title, thumbnailUrl, href }} />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
  suggestedVideo,
  className = "",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <div className="w-14 h-14 mb-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl flex items-center justify-center">
        <Icon className="w-7 h-7 text-cyan-400/40" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-text-secondary mb-2">
        {title}
      </h3>
      <p className="text-sm text-text-tertiary max-w-sm mb-6">{description}</p>

      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors"
        >
          {ctaLabel}
        </a>
      )}
      {ctaLabel && !ctaHref && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors"
        >
          {ctaLabel}
        </button>
      )}

      {suggestedVideo && (
        <a
          href={suggestedVideo.href}
          className="mt-8 flex items-center gap-3 max-w-xs p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.06] transition-colors"
        >
          <img
            src={suggestedVideo.thumbnailUrl}
            alt=""
            className="w-16 h-9 rounded-md object-cover flex-shrink-0"
          />
          <span className="text-sm text-text-secondary text-left line-clamp-2">
            {suggestedVideo.title}
          </span>
        </a>
      )}
    </motion.div>
  );
};

export default EmptyState;
```

- [ ] **Step 4: Run le test → passe**

Run: `cd frontend && npx vitest run src/components/__tests__/EmptyState.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur sur les nouveaux fichiers.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/EmptyState.tsx frontend/src/components/__tests__/EmptyState.test.tsx
git commit -m "feat(empty-state): generic EmptyState component with optional CTA + suggested video"
```

---

### Task 3: Étendre User type + authApi.updatePreferences

**Files:**

- Modify: `frontend/src/services/api.ts:28-57` (User interface)
- Modify: `frontend/src/services/api.ts:843-852` (updatePreferences)

- [ ] **Step 1: Étendre l'interface `User`**

Dans `frontend/src/services/api.ts`, ligne 28-57, après `analysis_limit?: number;` et avant le `}` final de l'interface, ajouter :

```typescript
  // Bag JSON merge non-destructivement par PUT /api/auth/preferences
  // (ambient_lighting_enabled, has_completed_onboarding, persona, etc.)
  preferences?: Record<string, unknown>;
```

- [ ] **Step 2: Étendre `authApi.updatePreferences`**

Ligne 843-852, remplacer :

```typescript
async updatePreferences(prefs: {
  default_lang?: string;
  default_mode?: string;
  default_model?: string;
}): Promise<{ success: boolean; message: string }> {
  return request("/api/auth/preferences", {
    method: "PUT",
    body: prefs,
  });
},
```

par :

```typescript
async updatePreferences(prefs: {
  default_lang?: string;
  default_mode?: string;
  default_model?: string;
  // Bag JSON arbitraire mergé non-destructivement côté backend
  // (auth/service.py:update_user_preferences). Utilisé pour
  // has_completed_onboarding, persona, ambient_lighting_enabled.
  extra_preferences?: Record<string, unknown>;
}): Promise<{ success: boolean; message: string }> {
  return request("/api/auth/preferences", {
    method: "PUT",
    body: prefs,
  });
},
```

- [ ] **Step 3: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 4: Vérifier non-régression tests existants**

Run: `cd frontend && npx vitest run`
Expected: tous les tests existants passent (rien ne casse).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(api): extend User.preferences and authApi.updatePreferences with extra_preferences"
```

---

### Task 4: Sidebar — remplacer labels hardcoded par i18n keys

**Files:**

- Modify: `frontend/src/components/layout/Sidebar.tsx:9-30` (imports)
- Modify: `frontend/src/components/layout/Sidebar.tsx:304-410` (WhackAMoleToggle)

- [ ] **Step 1: Ajouter imports lucide manquants**

Lignes 9-30, ajouter `Focus, Layout as LayoutIcon, Terminal` à l'import lucide-react :

```tsx
import {
  LayoutDashboard,
  History,
  Swords,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Shield,
  Info,
  Scale,
  BarChart3,
  User,
  MessageSquare,
  GraduationCap,
  Phone,
  Menu,
  Gamepad2,
  Focus,
  Layout as LayoutIcon,
  Terminal,
} from "lucide-react";
```

- [ ] **Step 2: Remplacer les chaînes hardcodées dans `WhackAMoleToggle`**

Ligne 363 (title attribute) — remplacer :

```tsx
title={enabled ? "Mode Jeu : activé" : "Mode Jeu : désactivé"}
```

par :

```tsx
title={enabled ? t.dashboard.modes.toggle_on : t.dashboard.modes.toggle_off}
```

Ligne 369 (label visible toggle) — remplacer :

```tsx
<span className="text-xs font-medium truncate">Mode Jeu</span>
```

par :

```tsx
<span className="text-xs font-medium truncate">
  {t.dashboard.modes.quiz.label}
</span>
```

Ligne 394 (bouton classic) — remplacer :

```tsx
Classique;
```

par :

```tsx
{
  t.dashboard.modes.classic.label;
}
```

Ligne 404 (bouton reverse) — remplacer :

```tsx
Prompt Inverse
```

par :

```tsx
{
  t.dashboard.modes.expert.label;
}
```

⚠ Le composant `WhackAMoleToggle` ne consomme pas encore `useTranslation`. Modifier la signature pour ajouter le hook :

Ligne 305, remplacer :

```tsx
const WhackAMoleToggle: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
```

par :

```tsx
const WhackAMoleToggle: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const { t } = useTranslation();
```

(`useTranslation` est déjà importé ligne 32.)

- [ ] **Step 3: Vérifier non-régression localStorage IDs**

Lignes 313-321 et 339-352 NE DOIVENT PAS être modifiées. Le contrat reste `"classic" | "reverse"` côté localStorage `ds-whack-a-mole-mode`.

Vérifier en grep :

Run: `cd frontend && grep -n "ds-whack-a-mole-mode" src/`
Expected: voir les références dans Sidebar.tsx, useWhackAMole.ts, WhackAMole.tsx — toutes utilisent `"classic" | "reverse"` (ID technique inchangé).

- [ ] **Step 4: Lancer le frontend en dev pour smoke test (optionnel)**

Run: `cd frontend && npm run dev`
Naviguer vers `/dashboard` (after login). Vérifier que la sidebar affiche :

- "Mode Quiz" au lieu de "Mode Jeu"
- "Mode Classique" au lieu de "Classique"
- "Mode Expert" au lieu de "Prompt Inverse"
- Switcher language → EN affiche "Quiz Mode", "Classic Mode", "Expert Mode"

- [ ] **Step 5: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "refactor(sidebar): replace hardcoded mode labels with i18n keys (Quiz/Classic/Expert)"
```

---

### Task 5: Composant PersonaCard (TDD)

**Files:**

- Create: `frontend/src/components/onboarding/PersonaCard.tsx`
- Create: `frontend/src/components/onboarding/__tests__/PersonaCard.test.tsx`

- [ ] **Step 1: Créer le dossier `onboarding/`**

Run: `mkdir -p "frontend/src/components/onboarding/__tests__"`

- [ ] **Step 2: Écrire le test PersonaCard qui échoue**

```tsx
// frontend/src/components/onboarding/__tests__/PersonaCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraduationCap } from "lucide-react";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { PersonaCard } from "../PersonaCard";

describe("PersonaCard", () => {
  it("renders label, description, icon", () => {
    renderWithProviders(
      <PersonaCard
        icon={GraduationCap}
        label="Étudiant"
        description="Cours, révisions"
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Étudiant")).toBeInTheDocument();
    expect(screen.getByText("Cours, révisions")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <PersonaCard
        icon={GraduationCap}
        label="Étudiant"
        description="Cours"
        selected={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /étudiant/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("applies selected styles when selected=true", () => {
    renderWithProviders(
      <PersonaCard
        icon={GraduationCap}
        label="Étudiant"
        description="Cours"
        selected={true}
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: /étudiant/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 3: Run le test → échec**

Run: `cd frontend && npx vitest run src/components/onboarding/__tests__/PersonaCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implémenter `PersonaCard`**

```tsx
// frontend/src/components/onboarding/PersonaCard.tsx
import React from "react";
import type { LucideIcon } from "lucide-react";

export interface PersonaCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  icon: Icon,
  label,
  description,
  selected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-2 p-4 rounded-xl border backdrop-blur-xl transition-all text-left ${
        selected
          ? "bg-accent-primary/15 border-accent-primary/40"
          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          selected ? "bg-accent-primary/25" : "bg-white/[0.05]"
        }`}
      >
        <Icon
          className={`w-5 h-5 ${selected ? "text-accent-primary" : "text-text-tertiary"}`}
        />
      </div>
      <span className="text-sm font-semibold text-text-primary">{label}</span>
      <span className="text-xs text-text-tertiary">{description}</span>
    </button>
  );
};

export default PersonaCard;
```

- [ ] **Step 5: Run le test → passe**

Run: `cd frontend && npx vitest run src/components/onboarding/__tests__/PersonaCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/onboarding/PersonaCard.tsx frontend/src/components/onboarding/__tests__/PersonaCard.test.tsx
git commit -m "feat(onboarding): PersonaCard selectable component"
```

---

### Task 6: Composant OnboardingFlow 3 étapes (TDD)

**Files:**

- Create: `frontend/src/components/onboarding/OnboardingFlow.tsx`
- Create: `frontend/src/components/onboarding/__tests__/OnboardingFlow.test.tsx`

- [ ] **Step 1: Écrire les tests OnboardingFlow qui échouent**

```tsx
// frontend/src/components/onboarding/__tests__/OnboardingFlow.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { OnboardingFlow } from "../OnboardingFlow";

// Mock authApi
vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>(
    "../../../services/api",
  );
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      updatePreferences: vi.fn(async () => ({ success: true, message: "OK" })),
    },
  };
});

import { authApi } from "../../../services/api";

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome step initially", () => {
    renderWithProviders(<OnboardingFlow onComplete={() => {}} />);
    expect(screen.getByText(/bienvenue/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /commencer/i }),
    ).toBeInTheDocument();
  });

  it("advances to persona step on Commencer", async () => {
    renderWithProviders(<OnboardingFlow onComplete={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /commencer/i }));
    expect(
      screen.getByText(/que faites-vous principalement/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/chercheur/i)).toBeInTheDocument();
    expect(screen.getByText(/journaliste/i)).toBeInTheDocument();
    expect(screen.getByText(/étudiant/i)).toBeInTheDocument();
    expect(screen.getByText(/professionnel/i)).toBeInTheDocument();
  });

  it("persists persona and completes onboarding when researcher selected then Suivant", async () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingFlow onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /commencer/i }));
    await userEvent.click(screen.getByRole("button", { name: /chercheur/i }));
    await userEvent.click(screen.getByRole("button", { name: /^suivant$/i }));
    // Step 3
    expect(screen.getByPlaceholderText(/youtube\.com/i)).toBeInTheDocument();
    // Skip step 3 → completion
    await userEvent.click(
      screen.getByRole("button", { name: /aller au tableau de bord/i }),
    );
    await waitFor(() => {
      expect(authApi.updatePreferences).toHaveBeenCalledWith({
        extra_preferences: expect.objectContaining({
          has_completed_onboarding: true,
          persona: "researcher",
        }),
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("skip flow at step 1 sets has_completed_onboarding=true with persona null", async () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingFlow onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /^passer$/i }));
    await waitFor(() => {
      expect(authApi.updatePreferences).toHaveBeenCalledWith({
        extra_preferences: {
          has_completed_onboarding: true,
          persona: null,
        },
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run le test → échec**

Run: `cd frontend && npx vitest run src/components/onboarding/__tests__/OnboardingFlow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implémenter `OnboardingFlow`**

```tsx
// frontend/src/components/onboarding/OnboardingFlow.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  GraduationCap,
  BookOpen,
  Newspaper,
  Briefcase,
  Search,
} from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { authApi } from "../../services/api";
import { PersonaCard } from "./PersonaCard";

export type Persona =
  | "researcher"
  | "journalist"
  | "student"
  | "professional"
  | null;

export interface OnboardingFlowProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

/**
 * Onboarding modal 3 étapes : Welcome → Persona → First analysis.
 *
 * Mounted depuis `ProtectedLayout` quand `user.preferences.has_completed_onboarding !== true`.
 *
 * Persistance : `authApi.updatePreferences({ extra_preferences: { has_completed_onboarding, persona } })`.
 * Skip à n'importe quelle étape → set `has_completed_onboarding=true` avec `persona=null`
 * (ou la valeur sélectionnée si déjà choisie).
 */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [persona, setPersona] = useState<Persona>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finish = async (finalPersona: Persona = persona) => {
    setSubmitting(true);
    try {
      await authApi.updatePreferences({
        extra_preferences: {
          has_completed_onboarding: true,
          persona: finalPersona,
        },
      });
    } catch (err) {
      // Best-effort : on ferme quand même pour ne pas bloquer l'utilisateur
      // sur un échec réseau. Le flag sera retenté à la prochaine session.
      // eslint-disable-next-line no-console
      console.warn("[onboarding] persist failed", err);
    } finally {
      setSubmitting(false);
      onComplete();
    }
  };

  const personas: Array<{
    id: Exclude<Persona, null>;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
  }> = [
    {
      id: "researcher",
      icon: Search,
      label: t.onboarding.persona.researcher.label,
      description: t.onboarding.persona.researcher.description,
    },
    {
      id: "journalist",
      icon: Newspaper,
      label: t.onboarding.persona.journalist.label,
      description: t.onboarding.persona.journalist.description,
    },
    {
      id: "student",
      icon: GraduationCap,
      label: t.onboarding.persona.student.label,
      description: t.onboarding.persona.student.description,
    },
    {
      id: "professional",
      icon: Briefcase,
      label: t.onboarding.persona.professional.label,
      description: t.onboarding.persona.professional.description,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-lg mx-4 rounded-2xl bg-bg-secondary border border-white/10 backdrop-blur-xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs text-text-tertiary">{`${step} / 3`}</span>
          <button
            type="button"
            onClick={() => finish(step === 2 ? persona : null)}
            disabled={submitting}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {t.onboarding.skip}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-14 h-14 mb-5 rounded-2xl bg-accent-primary/15 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-accent-primary" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t.onboarding.welcome.title}
              </h2>
              <p className="text-sm text-text-tertiary mb-8">
                {t.onboarding.welcome.description}
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full px-4 py-3 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors"
              >
                {t.onboarding.welcome.cta}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="persona"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t.onboarding.persona.title}
              </h2>
              <p className="text-sm text-text-tertiary mb-6">
                {t.onboarding.persona.description}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {personas.map((p) => (
                  <PersonaCard
                    key={p.id}
                    icon={p.icon as never}
                    label={p.label}
                    description={p.description}
                    selected={persona === p.id}
                    onSelect={() => setPersona(p.id)}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg bg-white/[0.05] text-text-secondary text-sm font-medium hover:bg-white/[0.08] transition-colors"
                >
                  {t.onboarding.previous}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={persona === null}
                  className="flex-1 px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.onboarding.next}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="first"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-14 h-14 mb-5 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t.onboarding.first_analysis.title}
              </h2>
              <p className="text-sm text-text-tertiary mb-4">
                {t.onboarding.first_analysis.description}
              </p>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={t.onboarding.first_analysis.placeholder}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-accent-primary/40"
              />
              <p className="text-xs text-text-tertiary mt-2 mb-6">
                {t.onboarding.first_analysis.tip}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (videoUrl.trim()) {
                      // Navigation déléguée : on stocke l'URL pour DashboardPage
                      try {
                        sessionStorage.setItem(
                          "ds-onboarding-video-url",
                          videoUrl.trim(),
                        );
                      } catch {
                        /* */
                      }
                    }
                    void finish();
                  }}
                  disabled={submitting}
                  className="w-full px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
                >
                  {t.onboarding.first_analysis.cta}
                </button>
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={submitting}
                  className="w-full px-4 py-2 rounded-lg bg-white/[0.04] text-text-secondary text-sm hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  {t.onboarding.first_analysis.skip}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default OnboardingFlow;
```

- [ ] **Step 4: Run les tests → passent**

Run: `cd frontend && npx vitest run src/components/onboarding/__tests__/OnboardingFlow.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/onboarding/OnboardingFlow.tsx frontend/src/components/onboarding/__tests__/OnboardingFlow.test.tsx
git commit -m "feat(onboarding): 3-step flow (welcome / persona / first analysis) with skip support"
```

---

### Task 7: Mount conditionnel dans ProtectedLayout

**Files:**

- Modify: `frontend/src/App.tsx:435-443` (ProtectedLayout)

- [ ] **Step 1: Modifier `ProtectedLayout`**

Lignes 435-443, remplacer :

```tsx
const ProtectedLayout = () => {
  // noindex sur toutes les routes protégées (dashboard, history, settings, etc.)
  return (
    <>
      <SEO noindex />
      <Outlet />
    </>
  );
};
```

par :

```tsx
const ProtectedLayout = () => {
  const { user } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Décision DB-3 (RELEASE-ORCHESTRATION L.562) : show pour anciens users sans flag
  // → tous les users dont preferences.has_completed_onboarding !== true voient le flow.
  const shouldShowOnboarding =
    user !== null &&
    user.preferences?.has_completed_onboarding !== true &&
    !onboardingDismissed;

  return (
    <>
      <SEO noindex />
      <Outlet />
      {shouldShowOnboarding && (
        <OnboardingFlow onComplete={() => setOnboardingDismissed(true)} />
      )}
    </>
  );
};
```

- [ ] **Step 2: Ajouter les imports**

En haut du fichier `frontend/src/App.tsx`, ajouter (après les imports existants) :

```tsx
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
```

Et compléter `useState` dans l'import React :

Vérifier que `import { useState } from "react"` est déjà présent (ligne ~25-30). Si non, ajouter.

Run: `grep -n "import.*useState" "frontend/src/App.tsx" | head -3`

Si manquant, ajouter à l'import React :

```tsx
import React, { Suspense, useState } from "react";
```

- [ ] **Step 3: Vérifier le typage**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur. `user.preferences?.has_completed_onboarding` est typé via la modif Task 3.

- [ ] **Step 4: Smoke test manuel**

Run: `cd frontend && npm run dev`

- Login avec un compte qui n'a pas `has_completed_onboarding=true` dans `User.preferences` → modal apparaît.
- Cliquer "Passer" → modal disparaît, ne réapparaît pas après navigation. Recharger → ne réapparaît pas (DB persistée).
- Network tab : vérifier `PUT /api/auth/preferences` avec body `{ "extra_preferences": { "has_completed_onboarding": true, "persona": null } }`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(layout): mount OnboardingFlow conditionally in ProtectedLayout"
```

---

### Task 8: Migrer placeholders existants vers EmptyState

**Files:**

- Modify: `frontend/src/pages/History.tsx:1573-1593` (Quick Chat placeholder)
- Modify: `frontend/src/pages/ChatPage.tsx:778-805, 836-859` (no video + empty thread)
- Modify: `frontend/src/pages/StudyHubPage.tsx:399-413` (no badges)

⚠ NE PAS toucher : `DebatePage.tsx` (utilise `DoodleEmptyState` — décision DB-2), `StudyPage.tsx` (composant local scope vidéo), `PlaylistPage.tsx`.

- [ ] **Step 1: Modifier `History.tsx` — remplacer placeholder Quick Chat**

Aux lignes ~1573-1593 (rechercher "Quick Chat — Pas encore d'analyse"), remplacer le bloc div placeholder existant par :

```tsx
import { BookOpen } from "lucide-react"; // si pas déjà importé
import { EmptyState } from "../components/EmptyState";

// Dans le rendu :
<EmptyState
  icon={BookOpen}
  title={
    language === "fr"
      ? "Quick Chat — Pas encore d'analyse"
      : "Quick Chat — No analysis yet"
  }
  description={
    language === "fr"
      ? "Vous pouvez générer une analyse complète pour cette vidéo."
      : "You can generate a full analysis for this video."
  }
/>;
```

⚠ Le bloc original L.1576 contient un mode selector + bouton Generate qu'il faut PRÉSERVER en dessous de l'EmptyState. Concrètement : ne remplacer que le bloc _titre + sous-titre_ (lignes ~1577-1594), et garder le mode selector/bouton intact.

Référence ligne approximative (peut bouger) :

```tsx
{!selectedVideoDetail.summary_content ? (
  /* Quick Chat Upgrade Panel */
  <div className="card p-6">
    <div className="flex items-center gap-3 mb-5">
      ...header div à remplacer par <EmptyState>...
    </div>
    {/* Mode selector — KEEP */}
    <div className="mb-4">...</div>
  </div>
) : ...}
```

- [ ] **Step 2: Modifier `ChatPage.tsx` — empty state "no video selected"**

Lignes 778-805, remplacer le bloc `<div className="flex-1 flex items-center justify-center p-6 relative">` par :

```tsx
import { MessageSquare } from "lucide-react"; // déjà importé
import { EmptyState } from "../components/EmptyState";
import { useNavigate } from "react-router-dom"; // déjà importé probablement

// Dans le rendu :
const navigate = useNavigate(); // si pas déjà déclaré dans le composant

<EmptyState
  icon={MessageSquare}
  title={t.empty_states.chat_no_selection.title}
  description={t.empty_states.chat_no_selection.description}
  ctaLabel={t.empty_states.chat_no_selection.cta}
  onCta={() => navigate("/history")}
/>;
```

⚠ Garder le composant `<ChatWelcomeInsight>` séparé après l'EmptyState (il a une logique propre).

- [ ] **Step 3: Modifier `ChatPage.tsx` — empty thread (suggestions)**

Lignes 836-859, remplacer le bloc empty state messages par un layout combinant `<EmptyState>` simple + suggestions intactes :

```tsx
{
  !isLoadingMessages && messages.length === 0 && (
    <>
      <EmptyState
        icon={Sparkles}
        title={t.empty_states.chat_empty_thread.title}
        description={t.empty_states.chat_empty_thread.description}
      />
      <div className="flex flex-wrap justify-center gap-2">
        {t.suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSend(s)}
            className="px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.1] text-text-muted hover:text-text-secondary text-sm transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
```

⚠ Vérifier que `t.suggestions` n'a PAS été cassé (il est sur l'objet local `t = { emptyTitle, emptySubtitle, suggestions }` du composant ChatPage, pas sur `t.empty_states`). Conserver les deux objets en cohabitation.

- [ ] **Step 4: Modifier `StudyHubPage.tsx` — empty badges**

Lignes 399-413, remplacer :

```tsx
) : (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <BookOpen className="w-8 h-8 text-text-tertiary mb-2" />
    <p className="text-xs text-text-tertiary">
      {fr ? "Aucun badge encore" : "No badges yet"}
    </p>
  </div>
)}
```

par :

```tsx
import { EmptyState } from "../components/EmptyState"; // si pas déjà importé

) : (
  <EmptyState
    icon={BookOpen}
    title={t.empty_states.study_no_badges.title}
    description={t.empty_states.study_no_badges.description}
    className="py-8"
  />
)}
```

⚠ `StudyHubPage` utilise `const fr = language === "fr"` localement. Confirmer que `useTranslation` est appelé pour récupérer `t`. Sinon ajouter :

```tsx
import { useTranslation } from "../hooks/useTranslation";
const { t } = useTranslation();
```

- [ ] **Step 5: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 6: Run l'ensemble des tests**

Run: `cd frontend && npx vitest run`
Expected: tous les tests passent (EmptyState + PersonaCard + OnboardingFlow + tests existants).

- [ ] **Step 7: Smoke test manuel**

Run: `cd frontend && npm run dev`

- Naviguer `/chat` sans sélection → EmptyState avec CTA "Voir mon historique".
- Naviguer `/study` → onglet Overview, scroller jusqu'aux badges → si vide, EmptyState compact.
- Naviguer `/history`, ouvrir une vidéo Quick Chat sans analyse → EmptyState + mode selector intact.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/History.tsx frontend/src/pages/ChatPage.tsx frontend/src/pages/StudyHubPage.tsx
git commit -m "refactor(empty-states): migrate History/Chat/StudyHub placeholders to EmptyState"
```

---

## Self-Review

### 1. Spec coverage

| Spec demandé                                       | Task          | Couvert ?                                                                                        |
| -------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| Renommer "Hypnagogique" → "Focus"                  | T1, T4        | ⚠ Voir D1 — n'existe pas en code, label "Mode Focus" mappé sur état désactivé du toggle          |
| Renommer "Mode Jeu" → "Quiz"                       | T1, T4        | ✅                                                                                               |
| Renommer "Prompt Inverse" → "Expert"               | T1, T4        | ✅                                                                                               |
| IDs internes inchangés (classic/reverse)           | T4 step 3     | ✅                                                                                               |
| i18n FR + EN                                       | T1            | ✅                                                                                               |
| Onboarding 3 étapes Welcome → Persona → First      | T6            | ✅                                                                                               |
| 4 personas (chercheur/journaliste/étudiant/pro)    | T6 (personas) | ✅                                                                                               |
| Skip flag                                          | T6 (finish)   | ✅                                                                                               |
| Persona stocké via PUT /api/auth/preferences       | T3 + T6       | ✅ (extra_preferences merge)                                                                     |
| EmptyState générique réutilisable                  | T2            | ✅                                                                                               |
| Migrer placeholders History/Debate/Chat/Study      | T8            | ✅ sauf Debate (DB-2) et StudyPage local                                                         |
| Tests Vitest OnboardingFlow + EmptyState           | T2, T5, T6    | ✅                                                                                               |
| Backend `User.preferences shape Pydantic` (Q8 opt) | —             | ⚠ Skip — backend déjà accepte dict arbitraire via `extra_preferences`, pas besoin de typer en V1 |

### 2. Placeholder scan

Aucun "TBD", "TODO", "implement later", "fill in details", "add appropriate error handling" sans détail dans les tasks. Tous les snippets de code sont complets.

### 3. Type consistency

- `EmptyState` props `icon: LucideIcon` cohérent entre T2 et T8.
- `PersonaCard.onSelect: () => void` cohérent entre T5 et T6.
- `OnboardingFlow.onComplete: () => void` cohérent entre T6 et T7.
- `User.preferences?: Record<string, unknown>` cohérent T3 → T7.
- `authApi.updatePreferences` accepte `extra_preferences?: Record<string, unknown>` cohérent T3 → T6.
- Persona type `"researcher" | "journalist" | "student" | "professional" | null` cohérent T6.

### 4. Décisions à confirmer avant exécution

| ID  | Décision                                                                                                                                                                                                          | Default proposé                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | "Hypnagogique" / "Mode Focus" : aucun mode "Hypnagogique" n'existe en code. Le label "Mode Focus" suggéré par l'audit Kimi est-il pour le toggle global _désactivé_ (état OFF) ou pour un futur 5ᵉ mode à créer ? | **(A)** Ne pas créer de mode "Focus", le label reste pour i18n future (consistance audit). Aujourd'hui les 3 modes actifs = Quiz / Classique / Expert. (cohérent RELEASE-ORCHESTRATION DB-1)                                                                                     |
| D2  | Onboarding pour anciens users (sans flag `has_completed_onboarding`) : leur montrer ?                                                                                                                             | **OUI** — décision DB-3 RELEASE-ORCHESTRATION. `preferences?.has_completed_onboarding !== true` → modal show.                                                                                                                                                                    |
| D3  | Persona "obligatoire" vs skip OK : empêcher de finir step 2 sans choisir, ou autoriser passer ?                                                                                                                   | **Skip OK à n'importe quelle étape** + bouton "Suivant" désactivé tant qu'aucun persona sélectionné en step 2 (cohérent décision DB-4 RELEASE-ORCHESTRATION).                                                                                                                    |
| D4  | 4 personas suffisent ou ajouter "Créateur de contenu" / "Curieux" ?                                                                                                                                               | **4 personas V1** — itérer si feedback fort.                                                                                                                                                                                                                                     |
| D5  | Branche git pour ce plan : `feature/audit-kimi-plans-2026-04-29` (existante, multi-plans) ou `feature/dashboard-onboarding` (dédiée Sprint A) ?                                                                   | **`feature/dashboard-onboarding`** dédiée comme suggéré par RELEASE-ORCHESTRATION Sprint A (worktree parallèle).                                                                                                                                                                 |
| D6  | Step 3 : redirect vers analyse de la vidéo collée ?                                                                                                                                                               | **(B)** sessionStorage `ds-onboarding-video-url` posé par OnboardingFlow ; DashboardPage le lit au mount et pré-remplit son input principal (à câbler dans une PR séparée Phase 2 — ne pas bloquer ce plan). En V1, juste persister l'URL dans sessionStorage et fermer le flow. |

### 5. Risques résiduels et atténuations

- **Risque** : conflit avec autre PR du Sprint A modifiant `services/api.ts` (`User` interface) → coordonné via RELEASE-ORCHESTRATION section B "ordre optimal" : merger pricing-v2 d'abord puis rebase ce plan.
- **Risque** : `t.suggestions` dans ChatPage est un objet local, pas dans `i18n/*.json`. T8 step 3 le confirme et conserve le pattern existant.
- **Risque** : le type `t` retourné par `useTranslation()` est l'objet JSON typé via TypeScript inference. Si TS strict reproche un accès non typé, ajouter une assertion `(t as any).empty_states.X` provisoire ou typer l'objet via un fichier `.d.ts` (hors scope V1).
- **Atténuation timeout backend** : `finish()` dans OnboardingFlow utilise try/catch et appelle `onComplete()` dans `finally` → l'utilisateur ne reste jamais bloqué sur un échec réseau.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-29-dashboard-onboarding-empty-states.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Je dispatche un subagent fresh par task, review entre tasks, itération rapide. Adapté pour les 8 tasks bite-sized de ce plan.

**2. Inline Execution** - Exécuter les tasks dans cette session via `superpowers:executing-plans`, batch execution avec checkpoints.

**Quelle approche ?**

**Si Subagent-Driven choisi:**

- REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
- Fresh subagent par task + two-stage review
- Avant de démarrer, créer worktree dédié `feature/dashboard-onboarding` (cf. `superpowers:using-git-worktrees`).

**Si Inline Execution choisi:**

- REQUIRED SUB-SKILL: Use `superpowers:executing-plans`
- Batch execution avec checkpoints pour review.
- Avant de démarrer, créer worktree dédié `feature/dashboard-onboarding`.
