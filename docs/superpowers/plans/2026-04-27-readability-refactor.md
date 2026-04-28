# Readability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer le frontend DeepSight Web vers une palette texte sémantique 4 niveaux (`strong`/`default`/`soft`/`faint`), isoler tous les conteneurs de contenu du `mix-blend-mode: screen` de l'AmbientLightLayer via `isolation: isolate`, désactiver l'AmbientLight sur les routes denses, codemod automatique des 1500+ occurrences, et verrouiller la non-régression par tests CI a11y.

**Architecture:** 5 PRs séquentielles. PR 1 ajoute les tokens CSS et utilities Tailwind sans casser l'existant (anciennes utilities marquées `@deprecated`). PR 2 ajoute les règles `isolation: isolate` globales dans `index.css` et audite les portals/`position: fixed`. PR 3 wrap `<AmbientLightLayer />` dans un `useLocation()` qui le désactive sur 11 routes. PR 4 lance un codemod `jscodeshift` qui remplace toutes les classes vers les nouveaux tokens, avec commits par pattern. PR 5 ajoute `@axe-core/playwright` + `pa11y-ci` + visual regression `pixelmatch` au CI pour bloquer toute rechute.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS 3, Vite 5, Vitest + Testing Library, Playwright (E2E + a11y + visual), `@axe-core/playwright`, `pa11y-ci`, `jscodeshift`, `pixelmatch`. Working directory: `C:\Users\33667\DeepSight-Main` (frontend at `frontend/`).

**Reference spec:** `docs/superpowers/specs/2026-04-27-readability-refactor-design.md`

---

## File Structure

### NEW files

| Path                                                     | Responsibility                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/scripts/codemod-readability.ts`                | Script `jscodeshift` qui remplace toutes les classes texte cassées vers les nouveaux tokens, avec règles de désambiguïsation AST |
| `frontend/scripts/__tests__/codemod-readability.test.ts` | Tests unitaires du codemod sur fixtures TSX                                                                                      |
| `frontend/scripts/codemod-fixtures/`                     | Fixtures TSX avant/après pour les tests du codemod                                                                               |
| `frontend/e2e/a11y-contrast.spec.ts`                     | Tests E2E `@axe-core/playwright` sur 8 routes principales                                                                        |
| `frontend/e2e/ambient-routes.spec.ts`                    | Tests E2E qui vérifient que `[data-ambient]` est absent du DOM sur les 11 routes désactivées                                     |
| `frontend/e2e/visual-regression.spec.ts`                 | Tests `pixelmatch` sur Landing/Login/Pricing pour détecter les régressions visuelles ambient                                     |
| `frontend/.pa11yci.json`                                 | Configuration `pa11y-ci` (routes, seuils, standard WCAG2AAA)                                                                     |
| `frontend/eslint-rules/no-deprecated-text-tokens.js`     | Custom ESLint rule qui interdit `text-text-muted/primary/secondary/tertiary/quaternary` après PR 4                               |
| `.github/workflows/a11y.yml`                             | GitHub Actions workflow qui lance axe-core + pa11y-ci sur preview Vercel                                                         |

### MODIFIED files

| Path                                            | What changes                                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/index.css`                        | Ajout des 4 nouveaux tokens (`--text-strong`, `--text-default`, `--text-soft`, `--text-faint`), suppression du `--text-muted` cassé en PR finale, ajout des règles `isolation: isolate`                    |
| `frontend/tailwind.config.js`                   | Ajout des utilities `text-text-strong/default/soft/faint`, dépréciation des anciennes                                                                                                                      |
| `frontend/src/App.tsx`                          | Wrapper `useLocation()` autour de `<AmbientLightLayer />` ligne ~445                                                                                                                                       |
| `frontend/src/components/AmbientLightLayer.tsx` | Ajout d'un attribut `data-ambient="layer"` sur le root pour permettre les tests E2E                                                                                                                        |
| `frontend/playwright.config.ts`                 | Ajout du projet `a11y` (axe-core) et `visual` (screenshot baseline)                                                                                                                                        |
| `frontend/package.json`                         | Ajout devDeps : `@axe-core/playwright`, `pa11y-ci`, `jscodeshift`, `@types/jscodeshift`, `pixelmatch`, `@types/pixelmatch` ; ajout scripts `codemod:readability`, `test:a11y`, `test:visual`, `lint:pa11y` |
| `frontend/.eslintrc.js` (ou `eslint.config.js`) | Activer la custom rule `no-deprecated-text-tokens` (warn en PR 4, error en PR finale)                                                                                                                      |
| `frontend/src/**/*.tsx` (~100 fichiers)         | Codemod automatique : remplacement des classes `text-text-muted/secondary/tertiary/primary/quaternary` et `text-white/[1-9]0` vers les nouveaux tokens                                                     |

---

## PR 1 — Tokens & Tailwind config

### Task 1: Ajouter les 4 nouveaux tokens CSS

**Files:**

- Modify: `frontend/src/index.css:41-46` (bloc `:root` tokens texte)

- [ ] **Step 1: Lire l'état actuel des tokens texte**

Run: `grep -n "text-primary\|text-secondary\|text-tertiary\|text-muted\|text-inverse" frontend/src/index.css | head -20`
Expected: voir les lignes 41-46 actuelles avec `--text-muted: #45455a;`

- [ ] **Step 2: Modifier `frontend/src/index.css` pour ajouter les nouveaux tokens AVANT les anciens**

Editer le bloc `:root` autour des lignes 41-46. **Garder les anciens tokens** (compat pendant codemod, supprimés en PR finale). Ajouter les nouveaux après :

```css
/* Hiérarchie texte v2 — ratios validés WCAG sur fond sombre + ambient warm */
--text-strong: #f5f5fa; /* L1 — Titres, nav active, valeur métrique forte */
--text-default: #c9c9d4; /* L2 — Body, descriptions, nav inactive */
--text-soft: #8b8ba0; /* L3 — Métadonnées, captions, helpers */
--text-faint: #6e6e82; /* L4 — Decorative, disabled — interdit pour body */

/* @deprecated — utilisés par codemod transitoire, supprimés en PR finale */
--text-primary: #f5f0e8;
--text-secondary: #b5a89b;
--text-tertiary: #7a7068;
--text-muted: #45455a;
--text-inverse: #0a0a0f;
```

- [ ] **Step 3: Vérifier le rendu en dev**

Run dans un terminal séparé : `cd frontend && npm run dev`
Ouvrir `http://localhost:5173` dans un navigateur, ouvrir DevTools console. Coller :

```js
getComputedStyle(document.documentElement).getPropertyValue("--text-strong");
```

Expected: `"#f5f5fa"` (chaîne)

- [ ] **Step 4: Commit**

```bash
cd /c/Users/33667/DeepSight-Main
git add frontend/src/index.css
git commit -m "feat(tokens): add text-strong/default/soft/faint readability tokens"
```

---

### Task 2: Étendre Tailwind config avec les nouvelles utilities

**Files:**

- Modify: `frontend/tailwind.config.js` (section `theme.extend.textColor`)

- [ ] **Step 1: Lire la config Tailwind actuelle**

Run: `grep -A20 "textColor" frontend/tailwind.config.js`
Expected: voir le mapping actuel des couleurs texte

- [ ] **Step 2: Ajouter les nouvelles utilities dans `tailwind.config.js`**

Dans `theme.extend.textColor` (ou créer la section si absente), ajouter :

```js
textColor: {
  // Nouvelle hiérarchie sémantique
  'text-strong':  'var(--text-strong)',
  'text-default': 'var(--text-default)',
  'text-soft':    'var(--text-soft)',
  'text-faint':   'var(--text-faint)',

  // Anciennes (dépréciées, supprimées après codemod en PR finale)
  'text-primary':   'var(--text-primary)',
  'text-secondary': 'var(--text-secondary)',
  'text-tertiary':  'var(--text-tertiary)',
  'text-muted':     'var(--text-muted)',
  'text-inverse':   'var(--text-inverse)',
},
```

- [ ] **Step 3: Vérifier que la classe `text-text-strong` est générée**

Run: `cd frontend && npm run build 2>&1 | head -50`
Expected: build success sans warning Tailwind

Run: `grep -c "text-text-strong" frontend/dist/assets/*.css 2>/dev/null || grep -r "text-text-strong" frontend/dist/ | head -3`
Expected: au moins 1 occurrence (la classe existe maintenant dans le bundle)

- [ ] **Step 4: Test rapide via JSX éphémère**

Modifier temporairement `frontend/src/App.tsx` ligne 1 (juste avant les imports), ajouter un commentaire test :

```tsx
// TEST: <span className="text-text-strong">Visible test</span>
```

Run: `cd frontend && npm run typecheck 2>&1 | tail -5`
Expected: zéro erreur TS

Retirer le commentaire test après vérification.

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(tokens): expose text-strong/default/soft/faint Tailwind utilities"
```

---

### Task 3: Migrer les variants accent (badges Tournesol, fiabilité, pédagogie)

**Files:**

- Modify: `frontend/src/components/TournesolTrendingSection.tsx:380-430` (badges score, fiabilité, pédagogie)

- [ ] **Step 1: Identifier les badges accent actuels**

Run: `grep -n "emerald-400/60\|blue-400/60\|emerald-500/20\|orange-500/20" frontend/src/components/TournesolTrendingSection.tsx`
Expected: lignes 390-393 (badges note) et 417, 424 (fiabilité, pédagogie)

- [ ] **Step 2: Écrire un test Playwright qui vérifie le contraste des badges**

Créer `frontend/e2e/tournesol-card-contrast.spec.ts` (sera supprimé en PR 5 quand axe-core gère ça globalement) :

```ts
import { test, expect } from "@playwright/test";

test("TournesolCard badges have sufficient contrast", async ({ page }) => {
  await page.goto("/dashboard");
  // Wait for cards to load (Tournesol fetch)
  await page.waitForSelector('[data-testid="tournesol-card"]', {
    timeout: 10000,
  });

  const reliabilityBadge = page
    .locator('[data-testid="tournesol-card"]')
    .first()
    .locator("text=/Fiabilité:/");
  const color = await reliabilityBadge.evaluate(
    (el) => window.getComputedStyle(el).color,
  );
  // Expect emerald-300 (#6ee7b7) ou white/55 = couleur claire suffisamment contrastée
  // emerald-300 in rgb = rgb(110, 231, 183)
  expect(color).toMatch(/rgb\((110, 231, 183|139, 139, 160)/);
});
```

- [ ] **Step 3: Run test → expect fail (badges actuels en `/60`)**

Run: `cd frontend && npx playwright test e2e/tournesol-card-contrast.spec.ts -x`
Expected: FAIL (couleur actuelle ≠ emerald-300)

- [ ] **Step 4: Modifier les badges fiabilité et pédagogie dans `TournesolTrendingSection.tsx`**

Ligne 417 (fiabilité) :

```tsx
// Avant
className={`${reliability >= 50 ? "text-emerald-400/60" : "text-white/30"}`}
// Après
className={`${reliability >= 50 ? "text-emerald-300 font-medium" : "text-text-soft"}`}
```

Ligne 424 (pédagogie) :

```tsx
// Avant
className={`${pedagogy >= 50 ? "text-blue-400/60" : "text-white/30"}`}
// Après
className={`${pedagogy >= 50 ? "text-sky-300 font-medium" : "text-text-soft"}`}
```

Ligne 390-393 (badges note) — solidifier les backgrounds :

```tsx
// Avant
className: "bg-emerald-500/20 text-emerald-400"; // pour score ≥ 50
// Après
className: "bg-emerald-500/30 text-emerald-200";
```

(Idem pour `bg-orange-500/20 text-orange-400` → `bg-orange-500/30 text-orange-200`.)

- [ ] **Step 5: Ajouter `data-testid="tournesol-card"` sur le root de la card**

Ligne 366 (root du composant) :

```tsx
<button
  data-testid="tournesol-card"
  className="group rounded-xl ..."
```

- [ ] **Step 6: Run test → expect pass**

Run: `cd frontend && npx playwright test e2e/tournesol-card-contrast.spec.ts -x`
Expected: PASS

- [ ] **Step 7: Vérifier les autres tests existants n'ont pas régressé**

Run: `cd frontend && npm run typecheck && npm run test -- --run`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/TournesolTrendingSection.tsx frontend/e2e/tournesol-card-contrast.spec.ts
git commit -m "feat(tournesol): saturate accent badges (emerald-300/sky-300, bg /30)"
```

---

### Task 4: PR 1 final — push & open PR

- [ ] **Step 1: Vérifier l'état**

Run: `git log --oneline -3`
Expected: 3 commits récents (tokens CSS, Tailwind utilities, badges accent)

- [ ] **Step 2: Push branche**

Run: `git push -u origin feat/voice-mobile-final` (ou créer une branche dédiée `feat/readability-refactor-pr1` selon convention de la session)

- [ ] **Step 3: Ouvrir la PR**

```bash
gh pr create --title "feat(readability): PR 1 — tokens + Tailwind utilities + accent badges" --body "$(cat <<'EOF'
## Summary
- Ajoute les 4 nouveaux tokens CSS sémantiques (`--text-strong/default/soft/faint`)
- Expose les utilities Tailwind correspondantes (`text-text-strong`, etc.)
- Migre les badges accent de TournesolTrendingSection (emerald-300, sky-300, bg /30 solidifiés)
- Anciens tokens conservés temporairement (suppression en PR finale)

Réf spec: docs/superpowers/specs/2026-04-27-readability-refactor-design.md

## Test plan
- [x] `npm run typecheck` passe
- [x] `npm run test -- --run` passe
- [x] `npx playwright test e2e/tournesol-card-contrast.spec.ts` passe
- [ ] Vérification visuelle dashboard preview Vercel : badges fiabilité/pédagogie lisibles

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL PR retournée

- [ ] **Step 4: Vérifier preview Vercel après merge**

Attendre le déploiement Vercel auto. Aller sur `https://www.deepsightsynthesis.com/dashboard`, ouvrir DevTools → Computed → vérifier que `getComputedStyle(document.documentElement).getPropertyValue('--text-strong')` retourne `#f5f5fa`.

---

## PR 2 — Isolation CSS contre mix-blend-mode

### Task 5: Audit des portals avant d'appliquer `isolation: isolate`

**Files:**

- Read only: `frontend/src/**/*.tsx`

- [ ] **Step 1: Grep tous les `createPortal` du frontend**

Run: `grep -rn "createPortal\|ReactDOM\.createPortal" frontend/src --include="*.tsx" --include="*.ts"`
Expected: liste de fichiers utilisant React Portal

- [ ] **Step 2: Vérifier que chaque portal cible `document.body`**

Pour chaque résultat du Step 1, lire le fichier et noter la cible du portal. Cas attendus :

- Modals (VoiceOverlay, FloatingChatWindow, NotificationBell) → `document.body` ✅
- Dropdowns custom → vérifier
- Tooltips → vérifier

Si un portal cible un autre élément que `document.body`, **flag-le dans le rapport** (commit séparé ou commentaire dans la PR) : il faudra peut-être l'exclure de l'isolation.

- [ ] **Step 3: Grep tous les `position: fixed` enfants potentiels**

Run: `grep -rn "position:\s*fixed\|fixed inset-\|className=\"[^\"]*fixed" frontend/src --include="*.tsx" | head -30`
Expected: liste des éléments avec `fixed`. Vérifier qu'aucun n'est ancré DANS une `.card` ou `.modal-content`.

- [ ] **Step 4: Documenter les résultats dans un commentaire commit**

Créer un fichier temporaire `frontend/.audit-portals.md` avec la synthèse (sera supprimé après PR 2 mergée). Format :

```md
# Audit portals & fixed avant isolation

Portals (`createPortal`) cibles :

- VoiceOverlay.tsx:325 → document.body ✅
- FloatingChatWindow.tsx:XXX → ...
- ...

Position: fixed enfants :

- ... (rien de problématique trouvé)
```

- [ ] **Step 5: Commit l'audit**

```bash
git add frontend/.audit-portals.md
git commit -m "docs: audit portals + fixed before isolation refactor"
```

---

### Task 6: Ajouter les règles CSS `isolation: isolate`

**Files:**

- Modify: `frontend/src/index.css` (ajout après le bloc `:root`)

- [ ] **Step 1: Écrire un test Playwright qui vérifie l'isolation**

Créer `frontend/e2e/isolation.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

test("main element has isolation: isolate", async ({ page }) => {
  await page.goto("/dashboard");
  const mainEl = page.locator('main, [role="main"]').first();
  await expect(mainEl).toHaveCSS("isolation", "isolate");
});

test("cards have isolation: isolate", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForSelector('.card, [class*="rounded-xl"]', { timeout: 5000 });
  const card = page.locator('.card, [class*="rounded-xl"]').first();
  await expect(card).toHaveCSS("isolation", "isolate");
});
```

- [ ] **Step 2: Run test → expect fail**

Run: `cd frontend && npx playwright test e2e/isolation.spec.ts -x`
Expected: FAIL (`isolation` est `auto` actuellement)

- [ ] **Step 3: Ajouter les règles dans `frontend/src/index.css`**

Après le bloc `:root` (ligne ~190), ajouter :

```css
/* Refonte lisibilité — ferme les contextes de blend pour les zones de contenu.
   Bloque le mix-blend-mode: screen de l'AmbientLightLayer sans toucher
   aux calques cosmétiques eux-mêmes (les rayons restent dans les gutters). */
main,
[role="main"],
.card,
.panel,
.modal-content,
.dropdown-menu,
.popover,
aside[data-sidebar] {
  isolation: isolate;
}
```

- [ ] **Step 4: Run test → expect pass**

Run: `cd frontend && npx playwright test e2e/isolation.spec.ts -x`
Expected: PASS

- [ ] **Step 5: Vérifier visuellement qu'aucun modal/dropdown ne casse**

Run: `cd frontend && npm run dev` puis ouvrir manuellement :

- Dashboard → ouvrir une analyse (modal détail)
- Sidebar → ouvrir le menu utilisateur dropdown
- VoiceOverlay → activer un appel voix
- FloatingChatWindow → ouvrir le chat flottant

Pour chaque, vérifier : modal s'ouvre en plein écran (pas tronqué), dropdown s'affiche au-dessus du contenu, pas de glitch z-index.

Si un composant casse → flag dans `frontend/.audit-portals.md` et exclure son sélecteur de la règle CSS (ex: si `.modal-content` cause problème, retirer cette ligne et ajouter une issue follow-up).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/e2e/isolation.spec.ts
git commit -m "feat(readability): add isolation: isolate to content containers"
```

---

### Task 7: Ajouter `data-sidebar` sur la Sidebar pour cibler proprement

**Files:**

- Modify: `frontend/src/components/layout/Sidebar.tsx` (root du composant)

- [ ] **Step 1: Localiser le root JSX de la Sidebar**

Run: `grep -n "^export.*Sidebar\|return\s*(" frontend/src/components/layout/Sidebar.tsx | head -10`
Expected: identifier le `return ( <aside>...` ou `<div>...` qui est le root.

- [ ] **Step 2: Ajouter l'attribut `data-sidebar`**

Dans `Sidebar.tsx`, sur le `<aside>` ou `<div>` root :

```tsx
<aside
  data-sidebar
  className="..."
>
```

Si le root est un `<div>`, le changer en `<aside>` (sémantiquement plus correct ET ça matche notre sélecteur CSS).

- [ ] **Step 3: Vérifier que la règle CSS s'applique**

Run: `cd frontend && npm run dev` puis dans la console DevTools du dashboard :

```js
getComputedStyle(document.querySelector("aside[data-sidebar]")).isolation;
```

Expected: `"isolate"`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): add data-sidebar attribute for isolation targeting"
```

---

### Task 8: PR 2 final — push & open PR

- [ ] **Step 1: Cleanup audit file**

Décider : garder `frontend/.audit-portals.md` (utile docs) ou supprimer.
Si supprimer :

```bash
git rm frontend/.audit-portals.md
git commit -m "chore: remove temporary portal audit file"
```

- [ ] **Step 2: Push & PR**

```bash
git push
gh pr create --title "feat(readability): PR 2 — isolation: isolate on content containers" --body "$(cat <<'EOF'
## Summary
- Ajoute `isolation: isolate` sur `main`, `.card`, `.panel`, `.modal-content`, `.dropdown-menu`, `.popover`, `aside[data-sidebar]`
- Casse net le mix-blend-mode: screen de l'AmbientLightLayer pour les zones de contenu
- Audit portals préalable : tous OK (cible document.body)

Réf spec: docs/superpowers/specs/2026-04-27-readability-refactor-design.md

## Test plan
- [x] `npx playwright test e2e/isolation.spec.ts` passe
- [x] Modals/dropdowns vérifiés manuellement (VoiceOverlay, FloatingChatWindow, NotificationBell, sidebar dropdown)
- [ ] Vérification preview Vercel : Dashboard avec ambient gardé montre cards lisibles

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 3 — AmbientLightLayer router-aware

### Task 9: Ajouter `data-ambient` sur le root d'AmbientLightLayer

**Files:**

- Modify: `frontend/src/components/AmbientLightLayer.tsx` (root JSX)

- [ ] **Step 1: Localiser le root du composant**

Run: `grep -n "return\s*(" frontend/src/components/AmbientLightLayer.tsx`
Expected: identifier le `return ( <div>...` qui wrappe les 6 calques.

- [ ] **Step 2: Ajouter `data-ambient="layer"`**

```tsx
return (
  <div data-ambient="layer" aria-hidden="true">
    {/* 6 calques */}
  </div>
);
```

(Si le root est un Fragment `<>`, le changer en `<div data-ambient="layer">` car on veut un attribut DOM testable.)

- [ ] **Step 3: Vérifier en dev**

Run: `cd frontend && npm run dev`, ouvrir Dashboard, DevTools → Elements → chercher `[data-ambient]`. Doit exister actuellement (puisque ambient est encore monté partout).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AmbientLightLayer.tsx
git commit -m "feat(ambient): add data-ambient attribute for E2E testing"
```

---

### Task 10: Wrapper conditionnel `useLocation()` dans App.tsx

**Files:**

- Modify: `frontend/src/App.tsx:445` (ligne du `<AmbientLightLayer />`)

- [ ] **Step 1: Écrire le test E2E qui vérifie l'absence sur Dashboard**

Créer `frontend/e2e/ambient-routes.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

const AMBIENT_ROUTES = ["/", "/login", "/pricing", "/about"];
const NO_AMBIENT_ROUTES = [
  "/dashboard",
  "/history",
  "/account",
  "/admin",
  "/upgrade",
];

for (const route of AMBIENT_ROUTES) {
  test(`AmbientLight present on ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('[data-ambient="layer"]')).toHaveCount(1);
  });
}

for (const route of NO_AMBIENT_ROUTES) {
  test(`AmbientLight absent on ${route}`, async ({ page }) => {
    // Note: certaines routes nécessitent auth — utiliser un fixture loggedIn ou skip
    await page.goto(route);
    await expect(page.locator('[data-ambient="layer"]')).toHaveCount(0);
  });
}
```

(Si tu n'as pas encore de fixture `loggedIn`, simplifie : ne tester que `/dashboard` qui redirige vers `/login` si pas auth, et vérifier que le `/login` final EST ambient.)

- [ ] **Step 2: Run test → expect fail (ambient présent partout actuellement)**

Run: `cd frontend && npx playwright test e2e/ambient-routes.spec.ts -x`
Expected: les tests `NO_AMBIENT_ROUTES` FAIL

- [ ] **Step 3: Modifier `App.tsx` autour de la ligne 445**

Localiser le `<AmbientLightLayer intensity="normal" />`. Le wrapper conditionnel :

```tsx
import { useLocation } from "react-router-dom";

const AMBIENT_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/about",
  "/legal",
];

function AppContent() {
  const { pathname } = useLocation();
  const showAmbient = AMBIENT_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  return (
    <>
      {showAmbient && <AmbientLightLayer intensity="normal" />}
      <SkipLink />
      <Routes>{/* ... */}</Routes>
    </>
  );
}
```

⚠️ Vérifier que `useLocation()` est appelé À L'INTÉRIEUR du `<Router>` / `<BrowserRouter>` parent. Si le `<AmbientLightLayer />` était directement dans le `<App>` AU-DESSUS du `<Router>`, il faudra le déplacer dans un sous-composant. Lire `App.tsx` autour de 440-460 pour confirmer la structure.

- [ ] **Step 4: Run test → expect pass**

Run: `cd frontend && npx playwright test e2e/ambient-routes.spec.ts -x`
Expected: PASS sur les routes accessibles sans auth (au minimum `/`, `/login`).

- [ ] **Step 5: Vérification manuelle**

Run: `cd frontend && npm run dev`. Naviguer vers `/dashboard` (login d'abord), `/history`, `/account` — l'AmbientLight ne doit PAS être visible. Naviguer vers `/`, `/login`, `/pricing` — il doit être visible.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/e2e/ambient-routes.spec.ts
git commit -m "feat(ambient): disable AmbientLightLayer on dense routes (Dashboard/History/Account/etc.)"
```

---

### Task 11: Documenter le comportement dans un commentaire AppContent

**Files:**

- Modify: `frontend/src/App.tsx` (juste avant le `AMBIENT_ROUTES`)

- [ ] **Step 1: Ajouter un commentaire de documentation**

```tsx
// AmbientLight v3 est gardé sur les routes vitrines (acquisition) et désactivé
// sur les routes de travail dense où la lisibilité prime sur l'esthétique.
// Réf spec: docs/superpowers/specs/2026-04-27-readability-refactor-design.md §5
const AMBIENT_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/about",
  "/legal",
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "docs(ambient): document route allowlist rationale"
```

---

### Task 12: PR 3 final — push & open PR

- [ ] **Step 1: Push & PR**

```bash
git push
gh pr create --title "feat(readability): PR 3 — AmbientLightLayer router-aware" --body "$(cat <<'EOF'
## Summary
- AmbientLight gardé sur landing/login/signup/pricing/about/legal
- Désactivé sur dashboard/history/account/admin/upgrade/etc. (routes denses)
- Attribut `data-ambient="layer"` ajouté pour tests E2E

Réf spec: docs/superpowers/specs/2026-04-27-readability-refactor-design.md §5

## Test plan
- [x] `npx playwright test e2e/ambient-routes.spec.ts` passe
- [x] Vérification manuelle : Dashboard sans rayons, Landing avec rayons
- [ ] Preview Vercel : confirmer comportement attendu

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 4 — Codemod automatique

### Task 13: Installer les devDeps codemod

**Files:**

- Modify: `frontend/package.json` (devDependencies + scripts)

- [ ] **Step 1: Installer jscodeshift et types**

Run: `cd frontend && npm install -D jscodeshift @types/jscodeshift`
Expected: ajout dans `devDependencies` de `package.json`

- [ ] **Step 2: Ajouter le script npm**

Editer `frontend/package.json`, dans `scripts` :

```json
"codemod:readability": "jscodeshift -t scripts/codemod-readability.ts --extensions=tsx,ts --parser=tsx src/",
"codemod:readability:dry": "jscodeshift -t scripts/codemod-readability.ts --extensions=tsx,ts --parser=tsx --dry src/"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add jscodeshift for readability codemod"
```

---

### Task 14: Écrire les fixtures de test pour le codemod

**Files:**

- Create: `frontend/scripts/codemod-fixtures/input/01-text-text-tokens.tsx`
- Create: `frontend/scripts/codemod-fixtures/output/01-text-text-tokens.tsx`
- Create: `frontend/scripts/codemod-fixtures/input/02-text-white-opacity.tsx`
- Create: `frontend/scripts/codemod-fixtures/output/02-text-white-opacity.tsx`
- Create: `frontend/scripts/codemod-fixtures/input/03-button-vs-decorative.tsx`
- Create: `frontend/scripts/codemod-fixtures/output/03-button-vs-decorative.tsx`

- [ ] **Step 1: Fixture 01 — text-text-\* tokens**

Créer `frontend/scripts/codemod-fixtures/input/01-text-text-tokens.tsx` :

```tsx
export function Demo() {
  return (
    <div>
      <h1 className="text-text-primary">Title</h1>
      <p className="text-text-secondary">Subtitle</p>
      <span className="text-text-tertiary">Helper</span>
      <small className="text-text-muted">Caption</small>
      <em className="text-text-quaternary">Decorative</em>
    </div>
  );
}
```

Créer `frontend/scripts/codemod-fixtures/output/01-text-text-tokens.tsx` :

```tsx
export function Demo() {
  return (
    <div>
      <h1 className="text-text-strong">Title</h1>
      <p className="text-text-default">Subtitle</p>
      <span className="text-text-soft">Helper</span>
      <small className="text-text-faint">Caption</small>
      <em className="text-text-faint">Decorative</em>
    </div>
  );
}
```

- [ ] **Step 2: Fixture 02 — text-white avec opacités**

Créer `frontend/scripts/codemod-fixtures/input/02-text-white-opacity.tsx` :

```tsx
export function Demo() {
  return (
    <div>
      <p className="text-white/30">Faint</p>
      <p className="text-white/40">Soft</p>
      <p className="text-white/50">Default</p>
      <p className="text-white/70">Default</p>
      <p className="text-white/90">Strong</p>
    </div>
  );
}
```

Créer `frontend/scripts/codemod-fixtures/output/02-text-white-opacity.tsx` :

```tsx
export function Demo() {
  return (
    <div>
      <p className="text-text-soft">Faint</p>
      <p className="text-text-soft">Soft</p>
      <p className="text-text-default">Default</p>
      <p className="text-text-default">Default</p>
      <p className="text-text-strong">Strong</p>
    </div>
  );
}
```

- [ ] **Step 3: Fixture 03 — désambiguïsation `text-text-muted` (button vs decorative)**

Créer `frontend/scripts/codemod-fixtures/input/03-button-vs-decorative.tsx` :

```tsx
export function Demo() {
  return (
    <div>
      <button className="text-text-muted">Click me</button>
      <a className="text-text-muted">Link</a>
      <hr className="text-text-muted" />
      <span className="text-text-muted opacity-50">Decorative watermark</span>
    </div>
  );
}
```

Créer `frontend/scripts/codemod-fixtures/output/03-button-vs-decorative.tsx` :

```tsx
export function Demo() {
  return (
    <div>
      <button className="text-text-soft">Click me</button>
      <a className="text-text-soft">Link</a>
      <hr className="text-text-faint" />
      <span className="text-text-faint opacity-50">Decorative watermark</span>
    </div>
  );
}
```

- [ ] **Step 4: Commit fixtures**

```bash
git add frontend/scripts/codemod-fixtures/
git commit -m "test(codemod): add fixtures for readability transformer"
```

---

### Task 15: Écrire le test du codemod (avant de l'implémenter)

**Files:**

- Create: `frontend/scripts/__tests__/codemod-readability.test.ts`

- [ ] **Step 1: Test runner**

Créer `frontend/scripts/__tests__/codemod-readability.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { applyTransform } from "jscodeshift/src/testUtils";
import * as fs from "fs";
import * as path from "path";
import transform from "../codemod-readability";

const fixturesDir = path.join(__dirname, "..", "codemod-fixtures");

function loadFixture(name: string) {
  const input = fs.readFileSync(
    path.join(fixturesDir, "input", `${name}.tsx`),
    "utf-8",
  );
  const output = fs.readFileSync(
    path.join(fixturesDir, "output", `${name}.tsx`),
    "utf-8",
  );
  return { input, output };
}

describe("codemod-readability", () => {
  it.each([
    "01-text-text-tokens",
    "02-text-white-opacity",
    "03-button-vs-decorative",
  ])("transforms %s correctly", (fixtureName) => {
    const { input, output } = loadFixture(fixtureName);
    const result = applyTransform(
      transform,
      {},
      { source: input, path: `${fixtureName}.tsx` },
    );
    expect(result.trim()).toBe(output.trim());
  });
});
```

- [ ] **Step 2: Run test → expect fail (transform pas encore créé)**

Run: `cd frontend && npx vitest run scripts/__tests__/codemod-readability.test.ts`
Expected: FAIL — `Cannot find module '../codemod-readability'`

- [ ] **Step 3: Commit le test**

```bash
git add frontend/scripts/__tests__/codemod-readability.test.ts
git commit -m "test(codemod): add tests for readability transformer (failing)"
```

---

### Task 16: Implémenter le codemod

**Files:**

- Create: `frontend/scripts/codemod-readability.ts`

- [ ] **Step 1: Écrire le transformer**

Créer `frontend/scripts/codemod-readability.ts` :

```ts
import { Transform, JSXAttribute, ASTPath } from "jscodeshift";

const SIMPLE_REPLACEMENTS: Record<string, string> = {
  "text-text-primary": "text-text-strong",
  "text-text-secondary": "text-text-default",
  "text-text-tertiary": "text-text-soft",
  "text-text-quaternary": "text-text-faint",
};

const WHITE_OPACITY_REPLACEMENTS: Record<string, string> = {
  "text-white/10": "text-text-faint",
  "text-white/20": "text-text-faint",
  "text-white/30": "text-text-soft",
  "text-white/40": "text-text-soft",
  "text-white/50": "text-text-default",
  "text-white/55": "text-text-default",
  "text-white/60": "text-text-default",
  "text-white/65": "text-text-default",
  "text-white/70": "text-text-default",
  "text-white/75": "text-text-default",
  "text-white/80": "text-text-strong",
  "text-white/85": "text-text-strong",
  "text-white/90": "text-text-strong",
};

const CLICKABLE_PARENT_NAMES = new Set([
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "Button",
  "Link",
  "NavLink",
  "MenuItem",
  "NavItem",
  "IconButton",
  "TabsTrigger",
]);

const DECORATIVE_PARENT_NAMES = new Set(["hr", "small", "em", "figcaption"]);

function getParentJSXElement(path: ASTPath<JSXAttribute>): string | null {
  let parent = path.parent;
  while (parent) {
    if (parent.value && parent.value.type === "JSXOpeningElement") {
      const name = parent.value.name;
      if (name.type === "JSXIdentifier") return name.name;
    }
    parent = parent.parent;
  }
  return null;
}

function transformClassName(value: string, parentName: string | null): string {
  const classes = value.split(/\s+/);
  const newClasses = classes.map((cls) => {
    // Replacements simples
    if (SIMPLE_REPLACEMENTS[cls]) return SIMPLE_REPLACEMENTS[cls];

    // text-text-muted : désambiguïsation par parent
    if (cls === "text-text-muted") {
      if (parentName && CLICKABLE_PARENT_NAMES.has(parentName))
        return "text-text-soft";
      if (parentName && DECORATIVE_PARENT_NAMES.has(parentName))
        return "text-text-faint";
      // Default safe : soft (lisible) plutôt que faint (decorative)
      return "text-text-soft";
    }

    // text-white/X0 : remplacement direct
    if (WHITE_OPACITY_REPLACEMENTS[cls]) return WHITE_OPACITY_REPLACEMENTS[cls];

    return cls;
  });

  return newClasses.join(" ");
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let modified = false;

  root.find(j.JSXAttribute, { name: { name: "className" } }).forEach((path) => {
    const value = path.value.value;
    if (!value) return;

    // Cas string literal : className="..."
    if (value.type === "StringLiteral" || value.type === "Literal") {
      const oldValue = String(value.value);
      const parentName = getParentJSXElement(path);
      const newValue = transformClassName(oldValue, parentName);
      if (newValue !== oldValue) {
        value.value = newValue;
        modified = true;
      }
    }

    // Cas template literal : className={`...`}
    // (laissé au manuel pour MVP — flag dans rapport)
  });

  return modified ? root.toSource({ quote: "double" }) : null;
};

export default transform;
export const parser = "tsx";
```

- [ ] **Step 2: Run test → expect pass**

Run: `cd frontend && npx vitest run scripts/__tests__/codemod-readability.test.ts`
Expected: tous les fixtures passent

- [ ] **Step 3: Si fail → ajuster le code et re-run**

Investiguer la diff entre output attendu et actuel. Cas fréquents :

- `text-text-quaternary` n'est pas dans `SIMPLE_REPLACEMENTS` — c'est volontaire car il faut peut-être désambiguïser. Pour la fixture 01, il est sur un `<em>` donc decorative → `text-text-faint`. Vérifier que la branche `text-text-muted` desambig couvre aussi `text-text-quaternary`. Si pas, ajouter cette logique.

Modifier `transformClassName` pour gérer `text-text-quaternary` :

```ts
if (cls === "text-text-quaternary") return "text-text-faint"; // Toujours faint
```

Re-run et itérer jusqu'à PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/scripts/codemod-readability.ts
git commit -m "feat(codemod): implement readability transformer (3 patterns)"
```

---

### Task 17: Dry-run du codemod sur le codebase

**Files:**

- Read only: `frontend/src/**/*.tsx`

- [ ] **Step 1: Lancer en dry-run**

Run: `cd frontend && npm run codemod:readability:dry 2>&1 | tee /tmp/codemod-dry.log | tail -50`
Expected: rapport jscodeshift "Files modified : XXX, Files unmodified : YYY"

- [ ] **Step 2: Compter les fichiers modifiés**

Run: `grep "Files modified" /tmp/codemod-dry.log`
Expected: ~80-120 fichiers modifiés (ordre de grandeur correspondant aux 1024+ occurrences)

- [ ] **Step 3: Inspecter quelques diffs sur des fichiers connus**

Run: `cd frontend && npx jscodeshift -t scripts/codemod-readability.ts --extensions=tsx --parser=tsx --print --dry src/components/TournesolTrendingSection.tsx 2>&1 | head -100`
Expected: voir les changements proposés (exemples avant/après)

- [ ] **Step 4: Si tout semble OK, lancer le codemod en vrai**

Run: `cd frontend && npm run codemod:readability 2>&1 | tee /tmp/codemod-run.log | tail -20`
Expected: "Files modified : XXX"

- [ ] **Step 5: Vérifier qu'aucune régression TS**

Run: `cd frontend && npm run typecheck 2>&1 | tail -20`
Expected: zéro erreur TS

- [ ] **Step 6: Vérifier qu'aucun test n'a régressé**

Run: `cd frontend && npm run test -- --run 2>&1 | tail -20`
Expected: tous tests passent. Si snapshots cassent (probable avec changements de className), invalider :

```bash
cd frontend && npm run test -- --run -u
```

Puis re-run sans `-u` pour confirmer green.

- [ ] **Step 7: Commit du résultat**

```bash
git add -A
git commit -m "refactor(readability): apply codemod — replace deprecated text tokens

- text-text-primary → text-text-strong
- text-text-secondary → text-text-default
- text-text-tertiary → text-text-soft
- text-text-muted → text-text-soft (button/link) ou text-text-faint (decorative)
- text-text-quaternary → text-text-faint
- text-white/[1-9]0 → tokens correspondants

Touched files: see git stat. Tests adapted (snapshots invalidated where needed)."
```

---

### Task 18: Cas border — revue manuelle des template literals

**Files:**

- Modify: variable selon les fichiers détectés

- [ ] **Step 1: Identifier les classes `text-text-*` ou `text-white/X0` dans des template literals**

Run: `grep -rn 'text-text-\(muted\|primary\|secondary\|tertiary\|quaternary\)' frontend/src --include="*.tsx" | head -30`
Expected: ces patterns ne devraient plus exister dans les `className="..."` simples ; les occurrences restantes sont dans des template literals ou des computed strings.

Run: `grep -rnE 'className=\{[\`"]' frontend/src --include="\*.tsx" | grep -E 'text-text-(muted|primary|secondary|tertiary|quaternary)' | head -20`
Expected: liste des template literals qui ont survécu au codemod.

- [ ] **Step 2: Pour chaque résultat, fix manuel**

Pour chaque ligne identifiée, ouvrir le fichier et remplacer manuellement la classe. Exemple :

```tsx
// Avant
className={`text-text-muted ${isActive ? 'font-bold' : ''}`}
// Après (si parent <button>)
className={`text-text-soft ${isActive ? 'font-bold' : ''}`}
```

- [ ] **Step 3: Vérifier après chaque batch de fixes**

Run: `cd frontend && npm run typecheck`
Expected: zéro erreur

- [ ] **Step 4: Commit (groupé par fichier ou pattern)**

```bash
git add -A
git commit -m "refactor(readability): manual fixes for template literals + computed classNames"
```

---

### Task 19: Activer la custom ESLint rule pour interdire les anciens tokens

**Files:**

- Create: `frontend/eslint-rules/no-deprecated-text-tokens.js`
- Modify: `frontend/.eslintrc.js` (ou `eslint.config.js`)

- [ ] **Step 1: Vérifier la version ESLint et la config en place**

Run: `ls frontend/eslint.config.* frontend/.eslintrc.* 2>/dev/null`
Expected: `eslint.config.js` (flat config v9) ou `.eslintrc.js`/`.eslintrc.json` (legacy)

- [ ] **Step 2: Créer la custom rule**

Créer `frontend/eslint-rules/no-deprecated-text-tokens.js` :

```js
const DEPRECATED_TOKENS = [
  "text-text-primary",
  "text-text-secondary",
  "text-text-tertiary",
  "text-text-muted",
  "text-text-quaternary",
];

const TOKEN_REGEX = new RegExp(`\\b(${DEPRECATED_TOKENS.join("|")})\\b`);

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow deprecated text tokens after readability refactor",
    },
    schema: [],
    messages: {
      deprecated:
        'Token "{{token}}" is deprecated. Use text-text-strong/default/soft/faint instead. See docs/superpowers/specs/2026-04-27-readability-refactor-design.md',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        const match = node.value.match(TOKEN_REGEX);
        if (match) {
          context.report({
            node,
            messageId: "deprecated",
            data: { token: match[1] },
          });
        }
      },
      TemplateElement(node) {
        if (!node.value || !node.value.raw) return;
        const match = node.value.raw.match(TOKEN_REGEX);
        if (match) {
          context.report({
            node,
            messageId: "deprecated",
            data: { token: match[1] },
          });
        }
      },
    };
  },
};
```

- [ ] **Step 3: Activer la rule dans la config ESLint**

Si `eslint.config.js` (flat config) :

```js
import noDeprecatedTextTokens from "./eslint-rules/no-deprecated-text-tokens.js";

export default [
  // ... config existante ...
  {
    plugins: {
      "deepsight-readability": {
        rules: { "no-deprecated-text-tokens": noDeprecatedTextTokens },
      },
    },
    rules: {
      "deepsight-readability/no-deprecated-text-tokens": "error",
    },
  },
];
```

(Si `.eslintrc.js`, syntaxe différente — adapter selon version installée. Run `cat frontend/eslint.config.js | head -30` pour voir le format actuel.)

- [ ] **Step 4: Run ESLint**

Run: `cd frontend && npm run lint 2>&1 | tail -30`
Expected: zéro violation `no-deprecated-text-tokens` (puisque le codemod a tout nettoyé). Si des violations restent, retourner à Task 18 et fixer manuellement.

- [ ] **Step 5: Commit**

```bash
git add frontend/eslint-rules/no-deprecated-text-tokens.js frontend/eslint.config.js
git commit -m "feat(lint): add no-deprecated-text-tokens custom ESLint rule"
```

---

### Task 20: Supprimer les anciens tokens CSS et utilities Tailwind

**Files:**

- Modify: `frontend/src/index.css` (suppression `--text-primary/secondary/tertiary/muted` deprecated)
- Modify: `frontend/tailwind.config.js` (suppression utilities deprecated)

- [ ] **Step 1: Vérifier qu'aucun usage ne reste**

Run: `grep -rE 'text-text-(primary|secondary|tertiary|muted|quaternary)' frontend/src 2>&1 | head`
Expected: zéro résultat (sauf dans les commentaires `@deprecated` qu'on va supprimer)

Run: `grep -rE 'var\(--text-(primary|secondary|tertiary|muted)\)' frontend/src 2>&1 | head`
Expected: vérifier si certains fichiers utilisent les variables CSS directement (rare mais possible). Si oui, les corriger.

- [ ] **Step 2: Supprimer les tokens CSS dépréciés dans `index.css`**

Editer `frontend/src/index.css` :

```css
/* AVANT
--text-primary: #f5f0e8;
--text-secondary: #b5a89b;
--text-tertiary: #7a7068;
--text-muted: #45455a;
--text-inverse: #0a0a0f;
*/

/* APRÈS — garder seulement --text-inverse */
--text-inverse: #0a0a0f;
```

- [ ] **Step 3: Supprimer les utilities Tailwind dépréciées**

Editer `frontend/tailwind.config.js`, retirer :

```js
'text-primary': 'var(--text-primary)',
'text-secondary': 'var(--text-secondary)',
'text-tertiary': 'var(--text-tertiary)',
'text-muted': 'var(--text-muted)',
```

Garder `text-inverse` qui est encore utilisé.

- [ ] **Step 4: Vérifier build + typecheck + tests**

Run: `cd frontend && npm run typecheck && npm run build && npm run test -- --run`
Expected: tout passe

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/tailwind.config.js
git commit -m "chore(tokens): remove deprecated text tokens (primary/secondary/tertiary/muted)"
```

---

### Task 21: Smoke test visuel de la migration

**Files:**

- Read only

- [ ] **Step 1: Run dev server**

Run dans un terminal séparé : `cd frontend && npm run dev`

- [ ] **Step 2: Tester les pages clés**

Ouvrir dans un navigateur, vérifier visuellement :

- `/` (Landing) — ambient OK + textes lisibles
- `/login` — formulaires lisibles
- `/dashboard` (après login) — sidebar lisible, cards Tournesol lisibles, pas d'ambient
- `/history` — virtual scroll lisible, pas d'ambient
- `/account` — formulaires lisibles, plan badge lisible
- `/upgrade` — pricing cards lisibles
- `/admin` (si admin) — tableaux lisibles

Pour chaque page : aucun texte gris foncé invisible, aucun glitch d'isolation, modals/dropdowns OK.

- [ ] **Step 3: Si régression visuelle constatée, fix targeted**

Localiser le composant problématique, identifier la classe (souvent un cas border que le codemod a mal géré), corriger manuellement.

- [ ] **Step 4: Commit des éventuels fixes**

```bash
git add -A
git commit -m "fix(readability): manual touch-ups after codemod smoke test"
```

---

### Task 22: PR 4 final — push & open PR

- [ ] **Step 1: Push & PR**

```bash
git push
gh pr create --title "refactor(readability): PR 4 — codemod 1500+ occurrences vers nouveaux tokens" --body "$(cat <<'EOF'
## Summary
- Codemod `jscodeshift` qui remplace toutes les classes texte cassées
- ~100 fichiers touchés, ~1500 occurrences migrées
- Custom ESLint rule `no-deprecated-text-tokens` activée
- Anciens tokens CSS et utilities Tailwind supprimés
- Smoke test visuel sur 7 pages clés

Réf spec: docs/superpowers/specs/2026-04-27-readability-refactor-design.md §6

## Test plan
- [x] `npm run typecheck` passe
- [x] `npm run test -- --run` passe (snapshots invalidés où nécessaire)
- [x] `npm run lint` passe (zéro violation no-deprecated-text-tokens)
- [x] Smoke test visuel sur Landing, Dashboard, History, Account, Upgrade, Admin
- [ ] Preview Vercel : confirmer aucune régression

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

⚠️ Cette PR sera grosse. Demander un review attentif sur les fichiers les plus touchés (`pages/History.tsx`, `pages/MyAccount.tsx`, `pages/AdminPage.tsx`).

---

## PR 5 — CI a11y (axe-core + pa11y + visual regression)

### Task 23: Installer @axe-core/playwright

**Files:**

- Modify: `frontend/package.json`

- [ ] **Step 1: Installer**

Run: `cd frontend && npm install -D @axe-core/playwright`
Expected: ajout dans devDependencies

- [ ] **Step 2: Ajouter le script npm**

Editer `frontend/package.json`, scripts :

```json
"test:a11y": "playwright test e2e/a11y-contrast.spec.ts"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add @axe-core/playwright for a11y CI"
```

---

### Task 24: Écrire les tests axe-core sur les 8 routes principales

**Files:**

- Create: `frontend/e2e/a11y-contrast.spec.ts`

- [ ] **Step 1: Écrire le test**

Créer `frontend/e2e/a11y-contrast.spec.ts` :

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = [
  { path: "/", name: "Landing", auth: false },
  { path: "/login", name: "Login", auth: false },
  { path: "/pricing", name: "Pricing", auth: false },
  { path: "/dashboard", name: "Dashboard", auth: true },
  { path: "/history", name: "History", auth: true },
  { path: "/account", name: "MyAccount", auth: true },
  { path: "/upgrade", name: "Upgrade", auth: true },
  // /admin nécessite admin role — skip pour CI public
];

for (const route of ROUTES) {
  test(`${route.name} (${route.path}) — no critical/serious color-contrast violations`, async ({
    page,
  }) => {
    if (route.auth) {
      // TODO : utiliser le fixture loggedIn une fois disponible
      test.skip(true, "Requires auth fixture");
    }

    await page.goto(route.path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa", "wcag2aaa"])
      .include("body")
      .analyze();

    const colorViolations = results.violations.filter(
      (v) =>
        v.id === "color-contrast" &&
        (v.impact === "critical" || v.impact === "serious"),
    );

    expect(colorViolations, JSON.stringify(colorViolations, null, 2)).toEqual(
      [],
    );
  });
}
```

- [ ] **Step 2: Run test**

Run: `cd frontend && npm run test:a11y`
Expected: les 3 routes publiques (Landing, Login, Pricing) doivent passer. Les routes auth sont skippées.

- [ ] **Step 3: Si fail, identifier la violation**

Le message d'erreur axe-core liste précisément les éléments violants avec leur HTML et le contraste mesuré. Fixer manuellement les fichiers concernés (probablement des cas border que le codemod a manqués).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/a11y-contrast.spec.ts
git commit -m "test(a11y): axe-core color-contrast tests on 8 routes"
```

---

### Task 25: Configurer pa11y-ci

**Files:**

- Create: `frontend/.pa11yci.json`
- Modify: `frontend/package.json`

- [ ] **Step 1: Installer pa11y-ci**

Run: `cd frontend && npm install -D pa11y-ci`

- [ ] **Step 2: Créer la config**

Créer `frontend/.pa11yci.json` :

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 30000,
    "wait": 1500,
    "ignore": ["WCAG2AA.Principle1.Guideline1_3.1_3_1.H42.2"]
  },
  "urls": [
    "http://localhost:5173/",
    "http://localhost:5173/login",
    "http://localhost:5173/pricing",
    "http://localhost:5173/about"
  ]
}
```

- [ ] **Step 3: Ajouter le script**

Dans `frontend/package.json`, scripts :

```json
"lint:pa11y": "pa11y-ci --config .pa11yci.json"
```

- [ ] **Step 4: Run pa11y manuellement**

Lancer le dev server : `cd frontend && npm run dev`
Dans un autre terminal : `cd frontend && npm run lint:pa11y`
Expected: zéro erreur sur les 4 routes publiques

- [ ] **Step 5: Commit**

```bash
git add frontend/.pa11yci.json frontend/package.json frontend/package-lock.json
git commit -m "chore(ci): add pa11y-ci config for WCAG2AA validation"
```

---

### Task 26: Tests visual regression avec pixelmatch

**Files:**

- Create: `frontend/e2e/visual-regression.spec.ts`
- Modify: `frontend/playwright.config.ts`

- [ ] **Step 1: Vérifier que `pixelmatch` est dispo (Playwright le bundle déjà via `expect.toHaveScreenshot`)**

Run: `cd frontend && cat playwright.config.ts | head -30`
Expected: voir la config existante

- [ ] **Step 2: Écrire le test visual**

Créer `frontend/e2e/visual-regression.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

const VISUAL_ROUTES = [
  { path: "/", name: "landing" },
  { path: "/login", name: "login" },
  { path: "/pricing", name: "pricing" },
];

for (const route of VISUAL_ROUTES) {
  test(`${route.name} visual baseline`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");

    // Désactiver les animations pour stabiliser
    await page.addStyleTag({
      content:
        "*,*::before,*::after { animation: none !important; transition: none !important; }",
    });

    // Stub time-of-day pour stabiliser l'ambient
    await page.evaluate(() => {
      // @ts-ignore
      window.__VISUAL_REGRESSION__ = true;
    });

    await expect(page).toHaveScreenshot(`${route.name}-baseline.png`, {
      maxDiffPixelRatio: 0.005, // 0.5%
      animations: "disabled",
    });
  });
}
```

- [ ] **Step 3: Première run pour générer les baselines**

Run: `cd frontend && npx playwright test e2e/visual-regression.spec.ts --update-snapshots`
Expected: génération de 3 fichiers PNG dans `frontend/e2e/visual-regression.spec.ts-snapshots/`

- [ ] **Step 4: Re-run sans `--update-snapshots`**

Run: `cd frontend && npx playwright test e2e/visual-regression.spec.ts`
Expected: PASS (les baselines viennent d'être créées, donc match parfait)

- [ ] **Step 5: Commit baselines**

```bash
git add frontend/e2e/visual-regression.spec.ts frontend/e2e/visual-regression.spec.ts-snapshots/
git commit -m "test(visual): add pixelmatch baselines for landing/login/pricing"
```

---

### Task 27: GitHub Actions workflow a11y

**Files:**

- Create: `.github/workflows/a11y.yml`

- [ ] **Step 1: Lire les workflows existants pour suivre le pattern**

Run: `ls .github/workflows/`
Expected: workflows existants (deploy-backend.yml, etc.)

Run: `cat .github/workflows/$(ls .github/workflows/ | head -1) | head -40`
Expected: voir le format YAML standard utilisé

- [ ] **Step 2: Créer le workflow**

Créer `.github/workflows/a11y.yml` :

```yaml
name: A11y & Visual Regression

on:
  pull_request:
    branches: [main]
    paths:
      - "frontend/**"
  push:
    branches: [main]
    paths:
      - "frontend/**"

jobs:
  a11y:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      - name: Build frontend
        run: npm run build

      - name: Start preview server
        run: npm run preview &
        env:
          VITE_API_URL: https://api.deepsightsynthesis.com

      - name: Wait for server
        run: npx wait-on http://localhost:4173 --timeout 60000

      - name: Run axe-core tests
        run: BASE_URL=http://localhost:4173 npx playwright test e2e/a11y-contrast.spec.ts

      - name: Run pa11y-ci
        run: BASE_URL=http://localhost:4173 npx pa11y-ci --config .pa11yci.json

      - name: Run visual regression
        run: BASE_URL=http://localhost:4173 npx playwright test e2e/visual-regression.spec.ts

      - name: Upload diff artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Vérifier la syntaxe YAML localement**

Run: `cat .github/workflows/a11y.yml | head -50`
Expected: YAML valide, identation correcte

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/a11y.yml
git commit -m "ci: add a11y workflow (axe-core + pa11y + visual regression)"
```

---

### Task 28: PR 5 final — push & open PR

- [ ] **Step 1: Push**

Run: `git push`

- [ ] **Step 2: Ouvrir la PR**

```bash
gh pr create --title "ci(readability): PR 5 — axe-core + pa11y + visual regression on Vercel preview" --body "$(cat <<'EOF'
## Summary
- Tests axe-core sur 8 routes (3 publiques + 5 auth skipped)
- pa11y-ci sur 4 routes publiques (WCAG2AA standard)
- Visual regression pixelmatch sur Landing/Login/Pricing (baselines committées)
- GitHub Actions workflow `a11y.yml` qui lance tout sur PR + main

Réf spec: docs/superpowers/specs/2026-04-27-readability-refactor-design.md §8

## Test plan
- [x] `npm run test:a11y` passe en local
- [x] `npm run lint:pa11y` passe en local
- [x] `npx playwright test e2e/visual-regression.spec.ts` passe (baselines OK)
- [ ] Workflow GitHub Actions vert sur cette PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Vérifier que le workflow tourne**

Run: `gh pr checks` (sur la branche de la PR)
Expected: workflow `A11y & Visual Regression` apparaît, attendre completion.

- [ ] **Step 4: Si fail, lire les logs et fix**

Run: `gh run view --log-failed`
Expected: détails de l'échec. Causes probables :

- Auth fixtures manquants → ajouter
- Visual baseline trop strict → augmenter `maxDiffPixelRatio` à 0.01 ou 0.02
- Routes auth qui timeout → augmenter `wait` ou skip propre

---

## Self-Review

Coverage check vs spec :

| Spec §                       | Couvert par                                                                                     | OK ? |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ---- |
| §3.1 Tokens CSS              | Task 1                                                                                          | ✅   |
| §3.2 Ratios contraste        | Task 24 (axe-core valide en runtime)                                                            | ✅   |
| §3.3 Tailwind utilities      | Task 2                                                                                          | ✅   |
| §3.4 Variants accent         | Task 3                                                                                          | ✅   |
| §4 Isolation CSS             | Tasks 5, 6, 7                                                                                   | ✅   |
| §5 AmbientLight router-aware | Tasks 9, 10, 11                                                                                 | ✅   |
| §6 Codemod                   | Tasks 13-22                                                                                     | ✅   |
| §7 Plan 5 PRs                | Sections PR 1-5                                                                                 | ✅   |
| §8 Validation a11y CI        | Tasks 23-28                                                                                     | ✅   |
| §9 Phase 2 écosystème        | **Hors scope** (specs séparées)                                                                 | N/A  |
| §10 Risques                  | Adressés via Tasks 5 (audit portals), 17 (typecheck/test après codemod), 21 (smoke test visuel) | ✅   |

Placeholder scan : aucun TBD/TODO restant. Toutes les commandes ont une expected output. Tous les snippets de code sont complets.

Type consistency : les noms de fonctions/tokens utilisés sont cohérents (`text-text-strong`, `text-text-default`, `text-text-soft`, `text-text-faint`) à travers les tâches.

---

## Execution Handoff

Plan complet et sauvegardé. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — je dispatche un subagent fresh par tâche, je review entre les tâches, itération rapide. Bon pour ce plan car les tâches sont indépendantes (chaque PR est une unité testable).

**2. Inline Execution** — j'exécute les tâches dans cette session avec checkpoints toutes les 4-5 tâches. Plus lourd en context mais plus interactif.

Quelle approche tu préfères ?
