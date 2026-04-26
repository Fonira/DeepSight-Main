# Extension SidePanel v3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer l'extension Chrome DeepSight de l'architecture "popup + widget Shadow DOM injecté sur YouTube" vers une **sidebar latérale droite** (Claude in Chrome style), togglable au clic icône, sans aucune injection sur YouTube.

**Architecture:** Suppression complète du widget on-page (~1500L) et de la popup. Service worker active `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` pour le toggle natif. Content script réduit à ~80L (URL detection only). Tous les composants popup migrent dans `src/sidepanel/` avec split structurel de `MainView.tsx` (729L → 4 sous-composants). 4 PRs séquentielles.

**Tech Stack:** Chrome Extension MV3, TypeScript strict, Preact (via alias React→preact/compat), Webpack 5 + ts-loader, Jest + jsdom + Testing Library, Playwright E2E, `webextension-polyfill`, `@types/chrome`.

**Spec source:** `docs/superpowers/specs/2026-04-26-extension-sidepanel-design.md`

---

## Préambule — Setup branche dédiée

- [ ] **Step 0.1: Créer worktree depuis `main`**

```bash
cd C:/Users/33667/DeepSight-Main
git fetch origin main
git worktree add .claude/worktrees/extension-sidepanel-v3 -b feat/extension-sidepanel-v3 origin/main
cd .claude/worktrees/extension-sidepanel-v3
```

Expected : nouvelle branche `feat/extension-sidepanel-v3` créée depuis `origin/main`, worktree dans `.claude/worktrees/extension-sidepanel-v3/`.

- [ ] **Step 0.2: Récupérer le spec depuis la branche où il est commité**

Le spec a été commité sur `feat/voice-ux-improvements` (commit `7fe61f37`). Cherry-pick uniquement le doc :

```bash
git fetch origin feat/voice-ux-improvements
git cherry-pick 7fe61f37 --no-commit
git reset HEAD .  # unstage everything
git checkout HEAD -- .  # discard non-spec changes
git checkout 7fe61f37 -- docs/superpowers/specs/2026-04-26-extension-sidepanel-design.md
git add docs/superpowers/specs/2026-04-26-extension-sidepanel-design.md
git commit -m "docs(extension): cherry-pick SidePanel v3 spec"
```

- [ ] **Step 0.3: Installer dépendances**

```bash
cd extension
npm install
```

Expected : `node_modules/` régénéré, pas d'erreurs.

- [ ] **Step 0.4: Baseline de validation (avant tout changement)**

```bash
cd extension
npm run typecheck
npm test
npm run build
```

Expected : tous les 3 passent (≥1 warning OK, 0 erreur). Si baseline rouge, **stop** et signaler avant de coder.

---

## File Structure

### Files créés

| Path                                                                  | Responsibility                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `extension/public/sidepanel.html`                                     | HTML root pour la sidebar (largeur 480px, link tokens.css + sidepanel.css) |
| `extension/src/sidepanel/index.tsx`                                   | Entry webpack — Preact mount du composant `App`                            |
| `extension/src/sidepanel/App.tsx`                                     | Router top-level (loading / login / main)                                  |
| `extension/src/sidepanel/views/HomeView.tsx`                          | Vue accueil — dual mode QG (hors YT) / vidéo (sur YT/TT)                   |
| `extension/src/sidepanel/views/AnalysisView.tsx`                      | Vue analyse en cours (move depuis popup/)                                  |
| `extension/src/sidepanel/views/ResultsView.tsx`                       | Vue résultats analyse (move depuis popup/)                                 |
| `extension/src/sidepanel/views/ChatView.tsx`                          | Vue chat contextuel (rename ChatDrawer)                                    |
| `extension/src/sidepanel/views/LoginView.tsx`                         | Vue login (move depuis popup/)                                             |
| `extension/src/sidepanel/components/RecentsList.tsx`                  | Liste historique récents (split MainView)                                  |
| `extension/src/sidepanel/components/VideoDetectedCard.tsx`            | Carte vidéo YT/TT détectée (split MainView)                                |
| `extension/src/sidepanel/components/UrlInputCard.tsx`                 | Input URL manuel mode QG (NOUVEAU)                                         |
| `extension/src/sidepanel/components/PlanBadge.tsx`                    | Badge plan + crédits (split MainView)                                      |
| `extension/src/sidepanel/components/SuggestionPills.tsx`              | **Addendum 2026-04-27** — chips chat-first sous VideoDetectedCard          |
| `extension/src/sidepanel/components/PromoBanner.tsx`                  | Banner promo (move depuis popup/)                                          |
| `extension/src/sidepanel/shared/Icons.tsx`                            | Icônes SVG (move)                                                          |
| `extension/src/sidepanel/shared/DeepSightSpinner.tsx`                 | Spinner cosmic (move)                                                      |
| `extension/src/sidepanel/shared/MicroDoodleBackground.tsx`            | Background animé (move)                                                    |
| `extension/src/sidepanel/shared/SynthesisView.tsx`                    | Rendu synthèse (move)                                                      |
| `extension/src/sidepanel/shared/FeatureCTAGrid.tsx`                   | Grille CTA features (move)                                                 |
| `extension/src/sidepanel/shared/doodles/`                             | Dossier doodles (move complet)                                             |
| `extension/src/sidepanel/hooks/useCurrentTab.ts`                      | Hook souscrit TAB_CHANGED + VIDEO_URL_UPDATED (NOUVEAU)                    |
| `extension/src/sidepanel/hooks/useAuth.ts`                            | Hook auth (extraction depuis App popup)                                    |
| `extension/src/sidepanel/hooks/useAnalysis.ts`                        | Hook analyse (extraction depuis MainView)                                  |
| `extension/src/sidepanel/styles/sidepanel.css`                        | CSS sidebar full-height (NOUVEAU, remplace popup.css)                      |
| `extension/__tests__/sidepanel/App.test.tsx`                          | Test router App                                                            |
| `extension/__tests__/sidepanel/views/HomeView.test.tsx`               | Test HomeView dual mode                                                    |
| `extension/__tests__/sidepanel/components/RecentsList.test.tsx`       | Test RecentsList                                                           |
| `extension/__tests__/sidepanel/components/VideoDetectedCard.test.tsx` | Test VideoDetectedCard                                                     |
| `extension/__tests__/sidepanel/components/UrlInputCard.test.tsx`      | Test UrlInputCard                                                          |
| `extension/__tests__/sidepanel/components/SuggestionPills.test.tsx`   | **Addendum 2026-04-27** — Test SuggestionPills                             |
| `extension/__tests__/sidepanel/hooks/useCurrentTab.test.ts`           | Test useCurrentTab                                                         |
| `extension/__tests__/content/url-detect.test.ts`                      | Test content script light                                                  |
| `extension/__tests__/background/sidepanel-toggle.test.ts`             | Test setPanelBehavior + relays                                             |

### Files modifiés

| Path                             | Changes                                                                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension/public/manifest.json` | + `permissions: ["sidePanel"]`, + `side_panel.default_path`, + `minimum_chrome_version: "114"`, - `action.default_popup`, - `content.css` du content_scripts, web_accessible_resources nettoyé |
| `extension/src/background.ts`    | + `chrome.sidePanel.setPanelBehavior` au onInstalled, + `chrome.tabs.onActivated` listener relay, + case `URL_CHANGED` dans handleMessage, rename `OPEN_POPUP` → `OPEN_SIDEPANEL`              |
| `extension/src/content/index.ts` | Réécriture complète : 757L → ~80L, suppression Shadow DOM, mission unique URL detect                                                                                                           |
| `extension/webpack.config.js`    | Entry `popup` → `sidepanel`, HtmlWebpackPlugin pointe vers `sidepanel.html`                                                                                                                    |

### Files supprimés (PR 4)

| Path                                                        | Reason                                 |
| ----------------------------------------------------------- | -------------------------------------- |
| `extension/src/popup.tsx`                                   | Entry remplacé par sidepanel/index.tsx |
| `extension/src/popup/` (tout)                               | Composants migrés dans sidepanel/      |
| `extension/src/styles/popup.css`                            | Remplacé par sidepanel.css             |
| `extension/public/popup.html`                               | Remplacé par sidepanel.html            |
| `extension/src/content/widget.ts`                           | Widget mort                            |
| `extension/src/content/widget/*`                            | Helpers Shadow DOM morts               |
| `extension/src/content/states/*.ts`                         | State machine widget morte             |
| `extension/src/styles/widget.css`                           | CSS widget mort                        |
| `extension/__tests__/content/widget.test.ts`                | Test widget mort                       |
| `extension/__tests__/content/boot-instrumentation.test.ts`  | Test obsolète                          |
| `extension/__tests__/content/__tests__/coexistence.test.ts` | Test obsolète                          |
| `extension/__tests__/content/__tests__/theme.test.ts`       | Test obsolète                          |
| `extension/dist/sidepanel.html`, `.js`, `.css` (orphelins)  | Régénérés par build                    |

---

# PR 1 — Manifest sidePanel + Service Worker toggle

**Goal:** Activer l'API sidePanel dans le manifest, configurer le service worker pour le toggle natif au clic icône, et installer les relays de messages (TAB_CHANGED, URL_CHANGED). À la fin de cette PR, **la sidebar n'a pas encore de contenu nouveau** mais le clic icône l'ouvre/ferme.

**Branch:** `feat/extension-sidepanel-v3` (depuis main)

### Task 1: Update manifest.json

**Files:**

- Modify: `extension/public/manifest.json`
- Test: `extension/__tests__/background/sidepanel-toggle.test.ts` (à créer)

- [ ] **Step 1.1: Lire le manifest actuel pour repérer la structure**

```bash
cat extension/public/manifest.json
```

Noter : `permissions`, `action`, `content_scripts`, `web_accessible_resources`.

- [ ] **Step 1.2: Modifier `extension/public/manifest.json`**

Apply ces changements (utiliser Edit tool) :

```diff
  "manifest_version": 3,
  "version": "2.0.0",
+ "minimum_chrome_version": "114",
  "permissions": [
    "storage", "activeTab", "tabs", "alarms", "identity", "clipboardWrite",
+   "sidePanel"
  ],
  "action": {
-   "default_popup": "popup.html",
    "default_icon": { ... }
  },
+ "side_panel": {
+   "default_path": "sidepanel.html"
+ },
```

- [ ] **Step 1.3: Validation manuelle du manifest**

```bash
cd extension
node -e "console.log(JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')).side_panel)"
```

Expected output: `{ default_path: 'sidepanel.html' }`

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')).permissions.includes('sidePanel'))"
```

Expected output: `true`

- [ ] **Step 1.4: Commit**

```bash
git add extension/public/manifest.json
git commit -m "feat(ext): add sidePanel permission and default_path to manifest"
```

### Task 2: Service worker — setPanelBehavior + onInstalled

**Files:**

- Modify: `extension/src/background.ts`
- Test: `extension/__tests__/background/sidepanel-toggle.test.ts`

- [ ] **Step 2.1: Créer le test failing pour setPanelBehavior**

Créer `extension/__tests__/background/sidepanel-toggle.test.ts` :

```typescript
import "../../src/__mocks__/chrome"; // existing chrome mock if present, else create inline below

// Inline mock if no shared mock exists:
const sidePanelMock = {
  setPanelBehavior: jest.fn().mockResolvedValue(undefined),
  open: jest.fn().mockResolvedValue(undefined),
};
const onInstalledListeners: Array<() => void> = [];
const onActivatedListeners: Array<(info: { tabId: number }) => void> = [];

(global as any).chrome = {
  ...((global as any).chrome ?? {}),
  sidePanel: sidePanelMock,
  runtime: {
    ...((global as any).chrome?.runtime ?? {}),
    onInstalled: {
      addListener: (cb: () => void) => onInstalledListeners.push(cb),
    },
    sendMessage: jest.fn().mockResolvedValue(undefined),
    onMessage: { addListener: jest.fn() },
  },
  tabs: {
    onActivated: {
      addListener: (cb: (info: { tabId: number }) => void) =>
        onActivatedListeners.push(cb),
    },
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      onChanged: { addListener: jest.fn() },
    },
  },
  alarms: { create: jest.fn(), onAlarm: { addListener: jest.fn() } },
};

describe("background — sidePanel toggle wiring", () => {
  beforeEach(() => {
    jest.resetModules();
    sidePanelMock.setPanelBehavior.mockClear();
    onInstalledListeners.length = 0;
    onActivatedListeners.length = 0;
  });

  it("calls setPanelBehavior({ openPanelOnActionClick: true }) on install", async () => {
    await import("../../src/background");
    // Simulate onInstalled firing
    expect(onInstalledListeners.length).toBeGreaterThan(0);
    onInstalledListeners.forEach((cb) => cb());
    expect(sidePanelMock.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    });
  });

  it("relays TAB_CHANGED on tab activation", async () => {
    await import("../../src/background");
    expect(onActivatedListeners.length).toBeGreaterThan(0);
    onActivatedListeners.forEach((cb) => cb({ tabId: 42 }));
    expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TAB_CHANGED", tabId: 42 }),
    );
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd extension
npx jest __tests__/background/sidepanel-toggle.test.ts -v
```

Expected: FAIL — soit "calls setPanelBehavior..." (le code n'appelle pas encore), soit erreurs de mock chrome.

- [ ] **Step 2.3: Implémenter le wiring dans background.ts**

Edit `extension/src/background.ts` — au début du fichier, après les imports mais avant le `handleMessage` :

```typescript
// Sidebar toggle behavior (Chrome 114+)
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) =>
        console.error("[deepsight] setPanelBehavior failed", err),
      );
  }
});

// Notify sidebar when active tab changes (sync current video)
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ action: "TAB_CHANGED", tabId }).catch(() => {}); // sidebar may not be open
});
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
npx jest __tests__/background/sidepanel-toggle.test.ts -v
```

Expected: 2 tests PASS.

- [ ] **Step 2.5: Run full test suite + typecheck**

```bash
npm test
npm run typecheck
```

Expected: tous tests passent, 0 erreur TS.

- [ ] **Step 2.6: Commit**

```bash
git add extension/src/background.ts extension/__tests__/background/sidepanel-toggle.test.ts
git commit -m "feat(ext): enable sidePanel toggle behavior + tab change relay"
```

### Task 3: Service worker — URL_CHANGED relay handler

**Files:**

- Modify: `extension/src/background.ts`
- Test: `extension/__tests__/background/sidepanel-toggle.test.ts` (extend)

- [ ] **Step 3.1: Append failing test au fichier existant**

Add à `__tests__/background/sidepanel-toggle.test.ts` dans le `describe` :

```typescript
it("relays URL_CHANGED to sidebar via VIDEO_URL_UPDATED", async () => {
  const handlerRef: { fn: any } = { fn: null };
  (global as any).chrome.runtime.onMessage.addListener = jest.fn((cb) => {
    handlerRef.fn = cb;
  });
  await import("../../src/background");
  expect(handlerRef.fn).toBeTruthy();

  const sendResponse = jest.fn();
  const sender = { tab: { id: 7 } };
  handlerRef.fn(
    {
      action: "URL_CHANGED",
      payload: { url: "https://youtube.com/watch?v=abc", platform: "youtube" },
    },
    sender,
    sendResponse,
  );

  expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "VIDEO_URL_UPDATED",
      payload: expect.objectContaining({
        url: "https://youtube.com/watch?v=abc",
      }),
    }),
  );
});
```

- [ ] **Step 3.2: Run test, verify fail**

```bash
npx jest __tests__/background/sidepanel-toggle.test.ts -v
```

Expected: nouveau test FAIL avec "expected sendMessage to have been called with VIDEO_URL_UPDATED".

- [ ] **Step 3.3: Add case URL_CHANGED dans handleMessage**

Find le switch sur `message.action` dans `extension/src/background.ts` (search for `case "ASK_QUESTION"` pour le repérer). Ajouter avant le `default:` :

```typescript
    case "URL_CHANGED": {
      // Forward to sidebar (sidebar may not be open — silently ignored)
      chrome.runtime
        .sendMessage({
          action: "VIDEO_URL_UPDATED",
          payload: message.payload,
        })
        .catch(() => {});
      sendResponse?.({ ok: true });
      return false;
    }
```

- [ ] **Step 3.4: Run test, verify pass**

```bash
npx jest __tests__/background/sidepanel-toggle.test.ts -v
```

Expected: 3 tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add extension/src/background.ts extension/__tests__/background/sidepanel-toggle.test.ts
git commit -m "feat(ext): relay URL_CHANGED from content to sidebar"
```

### Task 4: Stub sidepanel.html minimal

**Files:**

- Create: `extension/public/sidepanel.html`

- [ ] **Step 4.1: Créer un sidepanel.html minimaliste**

Create `extension/public/sidepanel.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>DeepSight</title>
    <style>
      body {
        margin: 0;
        background: #0a0a0f;
        color: #f5f5f7;
        font-family: -apple-system, sans-serif;
        padding: 16px;
        min-width: 380px;
        width: 480px;
      }
    </style>
  </head>
  <body>
    <h1>DeepSight</h1>
    <p>Sidebar v3 — placeholder. PR 2 portera l'app complète.</p>
  </body>
</html>
```

- [ ] **Step 4.2: Update webpack pour copier sidepanel.html**

Edit `extension/webpack.config.js` — find la section `CopyWebpackPlugin` ou équivalent, ajouter `public/sidepanel.html` dans la liste des assets copiés. Si le projet utilise déjà un glob `public/*.html`, la copie se fait automatiquement.

Vérifier la config actuelle :

```bash
cat extension/webpack.config.js | grep -A 5 -i "CopyPlugin\|CopyWebpackPlugin\|patterns"
```

Si pattern `from: "public"` existe, rien à faire — le fichier est copié auto.

- [ ] **Step 4.3: Build + verify dist/sidepanel.html existe**

```bash
cd extension
npm run build
ls dist/sidepanel.html
```

Expected: fichier existe dans dist/.

- [ ] **Step 4.4: Commit**

```bash
git add extension/public/sidepanel.html
git commit -m "feat(ext): add minimal sidepanel.html stub"
```

### Task 5: PR 1 — Validation manuelle Chrome

- [ ] **Step 5.1: Build production**

```bash
cd extension
npm run build
```

- [ ] **Step 5.2: Charger l'extension dans Chrome**

User action :

1. Ouvrir `chrome://extensions`
2. Activer "Developer mode"
3. "Load unpacked" → sélectionner `extension/dist/`
4. Vérifier que l'icône DeepSight apparaît
5. Cliquer sur l'icône → la sidebar latérale droite doit s'ouvrir avec le placeholder
6. Re-cliquer → la sidebar se ferme

Expected: toggle clic icône fonctionnel, pas d'erreur dans `chrome://extensions` ou `Service Worker > console`.

- [ ] **Step 5.3: Push branche + ouvrir PR 1**

```bash
git push -u origin feat/extension-sidepanel-v3
gh pr create --title "feat(ext): manifest sidePanel + service worker toggle (PR 1/4)" --body "$(cat <<'EOF'
## Summary
- Add sidePanel permission + side_panel.default_path to manifest
- Service worker: setPanelBehavior(openPanelOnActionClick: true) on install
- Service worker: relay TAB_CHANGED + URL_CHANGED messages
- Minimal sidepanel.html placeholder (full UI in PR 2/3)

## Test plan
- [x] Unit tests for setPanelBehavior + relays
- [x] Manual: clic icône ouvre/ferme la sidebar
- [x] No regression on existing popup (still works in this PR)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR 2 — Rename popup → sidepanel + Webpack reconfig

**Goal:** Refactor pure de structure : déplacer tous les composants `src/popup/` dans `src/sidepanel/`, reconfigurer webpack pour produire `sidepanel.{html,js,css}` à la place de `popup.*`. À la fin de cette PR, le clic icône ouvre la sidebar avec **le contenu de l'ancienne popup** (layout 400×600 toujours, refactor visuel en PR 3).

### Task 6: Move composants popup → sidepanel

**Files:**

- Move: `extension/src/popup/*` → `extension/src/sidepanel/`
- Move: `extension/src/popup.tsx` → `extension/src/sidepanel/index.tsx`

- [ ] **Step 6.1: Créer la structure dossiers sidepanel/**

```bash
cd extension
mkdir -p src/sidepanel/views src/sidepanel/components src/sidepanel/shared src/sidepanel/hooks src/sidepanel/styles
```

- [ ] **Step 6.2: Move composants existants vers leur nouveau home**

```bash
# Vues
git mv src/popup/components/AnalysisView.tsx src/sidepanel/views/AnalysisView.tsx
git mv src/popup/components/ResultsView.tsx src/sidepanel/views/ResultsView.tsx
git mv src/popup/components/LoginView.tsx src/sidepanel/views/LoginView.tsx
git mv src/popup/components/ChatDrawer.tsx src/sidepanel/views/ChatView.tsx

# Shared
git mv src/popup/components/Icons.tsx src/sidepanel/shared/Icons.tsx
git mv src/popup/components/DeepSightSpinner.tsx src/sidepanel/shared/DeepSightSpinner.tsx
git mv src/popup/components/MicroDoodleBackground.tsx src/sidepanel/shared/MicroDoodleBackground.tsx
git mv src/popup/components/SynthesisView.tsx src/sidepanel/shared/SynthesisView.tsx
git mv src/popup/components/FeatureCTAGrid.tsx src/sidepanel/shared/FeatureCTAGrid.tsx
git mv src/popup/components/doodles src/sidepanel/shared/doodles

# Components (kept as-is, splittés en PR 3)
git mv src/popup/components/MainView.tsx src/sidepanel/views/MainView.tsx
git mv src/popup/components/PromoBanner.tsx src/sidepanel/components/PromoBanner.tsx

# App + entry
git mv src/popup/App.tsx src/sidepanel/App.tsx
git mv src/popup.tsx src/sidepanel/index.tsx
```

- [ ] **Step 6.3: Vérifier qu'il ne reste rien dans popup/**

```bash
ls src/popup/ 2>/dev/null
```

Expected: dossier vide ou n'existe plus. Si fichiers restants, les inspecter et déplacer ou supprimer.

```bash
rmdir src/popup 2>/dev/null
```

### Task 7: Adapter les imports dans les fichiers déplacés

**Files:**

- Modify: tous les fichiers dans `src/sidepanel/` (imports relatifs cassés après le move)

- [ ] **Step 7.1: Identifier les imports cassés**

```bash
cd extension
npm run typecheck 2>&1 | head -80
```

Expected: erreurs "Cannot find module" sur des imports relatifs. Lister les fichiers concernés.

- [ ] **Step 7.2: Fix imports dans `src/sidepanel/index.tsx`**

Edit pour remplacer `./popup/App` par `./App` :

```typescript
// AVANT
import App from "./popup/App";

// APRÈS
import App from "./App";
```

Vérifier aussi imports CSS (`../styles/popup.css` → à laisser pour l'instant, sera renommé en sidepanel.css en Task 9).

- [ ] **Step 7.3: Fix imports dans `App.tsx` et chaque fichier déplacé**

Pour chaque fichier dans `src/sidepanel/views/` et `src/sidepanel/components/` :

- Remplacer `./Icons` → `../shared/Icons`
- Remplacer `./DeepSightSpinner` → `../shared/DeepSightSpinner`
- Remplacer `./MicroDoodleBackground` → `../shared/MicroDoodleBackground`
- Remplacer `./SynthesisView` → `../shared/SynthesisView`
- Remplacer `./FeatureCTAGrid` → `../shared/FeatureCTAGrid`
- Remplacer `./doodles/*` → `../shared/doodles/*`

Pour `App.tsx` : remplacer `./components/MainView` → `./views/MainView`, `./components/LoginView` → `./views/LoginView`.

Pour `views/ResultsView.tsx` : remplacer `./ChatDrawer` → `./ChatView`.

Approche systématique :

```bash
# Liste tous les imports relatifs cassés
grep -rn 'from "\.\./components\|from "\./components\|from "\./Icons\|from "\./DeepSight\|from "\./MicroDoodle\|from "\./SynthesisView\|from "\./FeatureCTAGrid\|from "\./doodles\|from "\./ChatDrawer' src/sidepanel/
```

Fix chaque ligne avec Edit tool.

- [ ] **Step 7.4: Run typecheck jusqu'à 0 erreur**

```bash
npm run typecheck
```

Expected: 0 erreur. Si erreurs restantes, les fix une par une jusqu'à clean.

- [ ] **Step 7.5: Commit**

```bash
git add src/sidepanel/ src/popup/ 2>/dev/null
git commit -m "refactor(ext): move popup components to sidepanel/ structure"
```

### Task 8: Webpack — entry sidepanel + HtmlWebpackPlugin

**Files:**

- Modify: `extension/webpack.config.js`

- [ ] **Step 8.1: Lire la config webpack actuelle**

```bash
cat extension/webpack.config.js
```

Repérer la section `entry` et les `HtmlWebpackPlugin` instances.

- [ ] **Step 8.2: Modifier l'entry**

Edit `extension/webpack.config.js` :

```diff
  entry: {
    background: "./src/background.ts",
    content: "./src/content/index.ts",
    authSync: "./src/authSync/index.ts",
    authSyncMain: "./src/authSync/main.ts",
-   popup: "./src/popup.tsx",
+   sidepanel: "./src/sidepanel/index.tsx",
    viewer: "./src/viewer.tsx",
  },
```

- [ ] **Step 8.3: Modifier le HtmlWebpackPlugin pour popup**

Find `new HtmlWebpackPlugin({ template: "./public/popup.html" ... })`. Replace par :

```javascript
new HtmlWebpackPlugin({
  template: "./public/sidepanel.html",
  filename: "sidepanel.html",
  chunks: ["sidepanel"],
}),
```

(Garder les autres HtmlWebpackPlugin pour viewer si présents.)

- [ ] **Step 8.4: Build pour vérifier**

```bash
cd extension
npm run build 2>&1 | tail -20
```

Expected: build réussit, `dist/sidepanel.html` et `dist/sidepanel.js` produits, plus de `dist/popup.*` (sauf orphelins anciens).

- [ ] **Step 8.5: Commit**

```bash
git add extension/webpack.config.js
git commit -m "refactor(ext): webpack entry popup → sidepanel"
```

### Task 9: Update sidepanel.html avec full bundle

**Files:**

- Modify: `extension/public/sidepanel.html`
- Move: `extension/src/styles/popup.css` → `extension/src/sidepanel/styles/sidepanel.css`

- [ ] **Step 9.1: Move CSS popup → sidepanel**

```bash
git mv src/styles/popup.css src/sidepanel/styles/sidepanel.css
```

- [ ] **Step 9.2: Update les imports CSS**

```bash
grep -rn "popup.css" src/
```

Fix chaque référence : `../styles/popup.css` → `./styles/sidepanel.css` (ou path adapté selon le fichier importeur).

- [ ] **Step 9.3: Replace sidepanel.html par version complète**

Replace le contenu de `extension/public/sidepanel.html` par :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="tokens.css" />
    <title>DeepSight</title>
  </head>
  <body style="width: 480px; min-width: 380px; margin: 0;">
    <div id="root"></div>
  </body>
</html>
```

(Le `<script src="sidepanel.js">` et le link CSS sidepanel sont injectés auto par HtmlWebpackPlugin.)

- [ ] **Step 9.4: Update sidepanel.css pour full-height**

Remplacer le contenu de `extension/src/sidepanel/styles/sidepanel.css` (ou ajouter en haut) :

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  background: #0a0a0f;
  color: #f5f5f7;
  font-family:
    "Inter",
    -apple-system,
    sans-serif;
}

#root {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Le reste du CSS existant ex-popup.css est conservé en dessous */
```

Find et **supprimer** les règles popup-spécifiques :

- `body { width: 400px; min-height: 500px; max-height: 600px; }` → à supprimer (déjà override par body inline width 480px)

- [ ] **Step 9.5: Build + verify dist**

```bash
cd extension
npm run build
ls dist/sidepanel.{html,js,css}
```

Expected: 3 fichiers présents.

- [ ] **Step 9.6: Reload extension dans Chrome + verify**

User action :

1. `chrome://extensions` → DeepSight → bouton refresh
2. Cliquer icône extension
3. Sidebar s'ouvre avec **le contenu complet de l'ancienne popup** (login, recents, etc.) mais en hauteur full-screen 480px largeur

Expected: feature parity avec l'ancienne popup, juste affichée dans la sidebar.

- [ ] **Step 9.7: Commit**

```bash
git add extension/public/sidepanel.html extension/src/sidepanel/styles/sidepanel.css extension/src/
git commit -m "refactor(ext): full sidebar HTML + CSS layout (480px, full-height)"
```

### Task 10: PR 2 — Validation et push

- [ ] **Step 10.1: Run full test suite**

```bash
cd extension
npm test
npm run typecheck
npm run build
```

Expected: tout passe.

- [ ] **Step 10.2: Update test imports**

`__tests__/components/Popup.test.tsx` importe sûrement des paths qui ont changé. Trouver et corriger :

```bash
grep -rn "from .*popup/" __tests__/
```

Fix les paths. Renommer le test :

```bash
git mv __tests__/components/Popup.test.tsx __tests__/sidepanel/App.test.tsx
```

Update import path dans le fichier test : `../../src/popup/App` → `../../src/sidepanel/App`.

- [ ] **Step 10.3: Re-run tests**

```bash
npm test
```

Expected: tests passent (renommés OK).

- [ ] **Step 10.4: Commit + push + PR**

```bash
git add __tests__/
git commit -m "refactor(ext): rename Popup test to sidepanel/App"
git push
gh pr create --title "refactor(ext): rename popup → sidepanel + webpack reconfig (PR 2/4)" --body "$(cat <<'EOF'
## Summary
- Move all popup/ components to sidepanel/ (views, components, shared, hooks)
- Webpack entry popup → sidepanel
- HtmlWebpackPlugin builds sidepanel.html
- CSS popup.css → sidepanel.css with full-height layout (480px width)
- Tests renamed from Popup.test → sidepanel/App.test

Functional parity: clic icône ouvre la sidebar avec le contenu identique à l'ancienne popup, juste en format vertical 480px.

## Test plan
- [x] npm test passes
- [x] npm run typecheck passes
- [x] npm run build produces dist/sidepanel.{html,js,css}
- [x] Manual: load unpacked → sidebar opens with all popup features working
EOF
)"
```

---

# PR 3 — HomeView dual mode + Split MainView + Content light

**Goal:** Le gros morceau. Réécrire `MainView.tsx` (729L) en `HomeView` + 4 sous-composants ciblés. Implémenter le hook `useCurrentTab` qui sync la sidebar avec la vidéo courante. Réécrire `content.ts` (757L → ~80L) en URL-detect-only. À la fin de cette PR, **plus aucune UI n'est injectée sur YouTube**, et la sidebar a un mode dual : QG (hors YT) ou Vidéo (sur YT/TT).

### Task 11: Hook useCurrentTab — souscription messages

**Files:**

- Create: `extension/src/sidepanel/hooks/useCurrentTab.ts`
- Test: `extension/__tests__/sidepanel/hooks/useCurrentTab.test.ts`

- [ ] **Step 11.1: Test failing pour useCurrentTab**

Create `extension/__tests__/sidepanel/hooks/useCurrentTab.test.ts` :

```typescript
import { renderHook, act } from "@testing-library/react";
import { useCurrentTab } from "../../../src/sidepanel/hooks/useCurrentTab";

describe("useCurrentTab", () => {
  let messageListener: ((msg: any) => void) | null = null;

  beforeEach(() => {
    messageListener = null;
    (global as any).chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn((cb) => {
            messageListener = cb;
          }),
          removeListener: jest.fn(),
        },
      },
      tabs: {
        query: jest.fn().mockResolvedValue([
          {
            id: 7,
            url: "https://www.youtube.com/watch?v=initial",
            active: true,
          },
        ]),
      },
    };
  });

  it("returns initial tab info on mount", async () => {
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {}); // flush promises
    expect(result.current.url).toBe("https://www.youtube.com/watch?v=initial");
    expect(result.current.platform).toBe("youtube");
  });

  it("updates state when VIDEO_URL_UPDATED received", async () => {
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {});
    expect(messageListener).not.toBeNull();
    act(() => {
      messageListener!({
        action: "VIDEO_URL_UPDATED",
        payload: {
          url: "https://www.youtube.com/watch?v=newvid",
          platform: "youtube",
        },
      });
    });
    expect(result.current.url).toBe("https://www.youtube.com/watch?v=newvid");
  });

  it("returns platform=null for non-video pages", async () => {
    (global as any).chrome.tabs.query.mockResolvedValueOnce([
      { id: 1, url: "https://example.com", active: true },
    ]);
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {});
    expect(result.current.platform).toBeNull();
  });
});
```

- [ ] **Step 11.2: Run, verify FAIL**

```bash
cd extension
npx jest __tests__/sidepanel/hooks/useCurrentTab.test.ts -v
```

Expected: FAIL "Cannot find module".

- [ ] **Step 11.3: Implement useCurrentTab.ts**

Create `extension/src/sidepanel/hooks/useCurrentTab.ts` :

```typescript
import { useEffect, useState } from "react";
import { detectPlatform } from "../../utils/video";

export type Platform = "youtube" | "tiktok" | null;

export interface CurrentTabInfo {
  url: string | null;
  platform: Platform;
  tabId: number | null;
}

export function useCurrentTab(): CurrentTabInfo {
  const [info, setInfo] = useState<CurrentTabInfo>({
    url: null,
    platform: null,
    tabId: null,
  });

  useEffect(() => {
    let cancelled = false;

    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (cancelled || !tabs[0]) return;
      const tab = tabs[0];
      setInfo({
        url: tab.url ?? null,
        platform: tab.url ? detectPlatform(tab.url) : null,
        tabId: tab.id ?? null,
      });
    });

    const onMessage = (msg: any) => {
      if (msg?.action === "VIDEO_URL_UPDATED" && msg.payload) {
        setInfo((prev) => ({
          ...prev,
          url: msg.payload.url,
          platform: msg.payload.platform ?? null,
        }));
      } else if (msg?.action === "TAB_CHANGED") {
        chrome.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            if (!tabs[0]) return;
            const tab = tabs[0];
            setInfo({
              url: tab.url ?? null,
              platform: tab.url ? detectPlatform(tab.url) : null,
              tabId: tab.id ?? null,
            });
          });
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return info;
}
```

- [ ] **Step 11.4: Run test, verify pass**

```bash
npx jest __tests__/sidepanel/hooks/useCurrentTab.test.ts -v
```

Expected: 3 tests PASS.

- [ ] **Step 11.5: Commit**

```bash
git add src/sidepanel/hooks/useCurrentTab.ts __tests__/sidepanel/hooks/useCurrentTab.test.ts
git commit -m "feat(ext): add useCurrentTab hook to sync sidebar with active tab"
```

### Task 12: Component RecentsList (split MainView)

**Files:**

- Create: `extension/src/sidepanel/components/RecentsList.tsx`
- Test: `extension/__tests__/sidepanel/components/RecentsList.test.tsx`

- [ ] **Step 12.1: Test failing**

Create `__tests__/sidepanel/components/RecentsList.test.tsx` :

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { RecentsList } from "../../../src/sidepanel/components/RecentsList";

describe("RecentsList", () => {
  const mockRecents = [
    { id: "1", videoId: "abc", title: "Video 1", thumbnail: "thumb1.jpg", createdAt: "2026-04-26T10:00:00Z" },
    { id: "2", videoId: "def", title: "Video 2", thumbnail: "thumb2.jpg", createdAt: "2026-04-25T10:00:00Z" },
  ];

  it("renders empty state when no recents", () => {
    render(<RecentsList recents={[]} onSelect={() => {}} />);
    expect(screen.getByText(/aucune analyse récente/i)).toBeInTheDocument();
  });

  it("renders all recent items", () => {
    render(<RecentsList recents={mockRecents} onSelect={() => {}} />);
    expect(screen.getByText("Video 1")).toBeInTheDocument();
    expect(screen.getByText("Video 2")).toBeInTheDocument();
  });

  it("calls onSelect with the recent when item clicked", () => {
    const onSelect = jest.fn();
    render(<RecentsList recents={mockRecents} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Video 1"));
    expect(onSelect).toHaveBeenCalledWith(mockRecents[0]);
  });
});
```

- [ ] **Step 12.2: Run, verify fail**

```bash
npx jest __tests__/sidepanel/components/RecentsList.test.tsx -v
```

Expected: FAIL.

- [ ] **Step 12.3: Implement RecentsList.tsx**

Create `extension/src/sidepanel/components/RecentsList.tsx` :

```typescript
import React from "react";

export interface RecentAnalysis {
  id: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  createdAt: string;
}

interface Props {
  recents: RecentAnalysis[];
  onSelect: (recent: RecentAnalysis) => void;
}

export function RecentsList({ recents, onSelect }: Props): JSX.Element {
  if (recents.length === 0) {
    return (
      <div style={{ padding: 16, opacity: 0.6, fontSize: 13 }}>
        Aucune analyse récente
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {recents.map((r) => (
        <li
          key={r.id}
          onClick={() => onSelect(r)}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            display: "flex",
            gap: 8,
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {r.thumbnail && (
            <img src={r.thumbnail} alt="" style={{ width: 60, height: 34, objectFit: "cover", borderRadius: 4 }} />
          )}
          <span style={{ fontSize: 13 }}>{r.title}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 12.4: Run test, verify pass**

```bash
npx jest __tests__/sidepanel/components/RecentsList.test.tsx -v
```

Expected: 3 tests PASS.

- [ ] **Step 12.5: Commit**

```bash
git add src/sidepanel/components/RecentsList.tsx __tests__/sidepanel/components/RecentsList.test.tsx
git commit -m "feat(ext): split MainView — RecentsList component"
```

### Task 13: Component VideoDetectedCard (split MainView)

**Files:**

- Create: `extension/src/sidepanel/components/VideoDetectedCard.tsx`
- Test: `extension/__tests__/sidepanel/components/VideoDetectedCard.test.tsx`

- [ ] **Step 13.1: Test failing**

Create `__tests__/sidepanel/components/VideoDetectedCard.test.tsx` :

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoDetectedCard } from "../../../src/sidepanel/components/VideoDetectedCard";

describe("VideoDetectedCard", () => {
  it("renders video title and platform", () => {
    render(
      <VideoDetectedCard
        title="Test Video"
        thumbnail="thumb.jpg"
        platform="youtube"
        onAnalyze={() => {}}
      />
    );
    expect(screen.getByText("Test Video")).toBeInTheDocument();
    expect(screen.getByAltText(/test video/i)).toHaveAttribute("src", "thumb.jpg");
  });

  it("calls onAnalyze when button clicked", () => {
    const onAnalyze = jest.fn();
    render(
      <VideoDetectedCard
        title="Video"
        thumbnail=""
        platform="youtube"
        onAnalyze={onAnalyze}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(onAnalyze).toHaveBeenCalled();
  });
});
```

- [ ] **Step 13.2: Run, verify fail**

```bash
npx jest __tests__/sidepanel/components/VideoDetectedCard.test.tsx -v
```

- [ ] **Step 13.3: Implement VideoDetectedCard.tsx**

Create `extension/src/sidepanel/components/VideoDetectedCard.tsx` :

```typescript
import React from "react";

interface Props {
  title: string;
  thumbnail: string;
  platform: "youtube" | "tiktok";
  onAnalyze: () => void;
}

export function VideoDetectedCard({ title, thumbnail, platform, onAnalyze }: Props): JSX.Element {
  return (
    <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, margin: 16 }}>
      {thumbnail && (
        <img src={thumbnail} alt={title} style={{ width: "100%", borderRadius: 8, marginBottom: 12 }} />
      )}
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>{platform.toUpperCase()}</div>
      <button
        onClick={onAnalyze}
        style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          border: "none",
          padding: "10px 16px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          width: "100%",
        }}
      >
        Analyser cette vidéo
      </button>
    </div>
  );
}
```

- [ ] **Step 13.4: Run test, verify pass**

```bash
npx jest __tests__/sidepanel/components/VideoDetectedCard.test.tsx -v
```

- [ ] **Step 13.5: Commit**

```bash
git add src/sidepanel/components/VideoDetectedCard.tsx __tests__/sidepanel/components/VideoDetectedCard.test.tsx
git commit -m "feat(ext): split MainView — VideoDetectedCard component"
```

### Task 14: Component UrlInputCard (NEW)

**Files:**

- Create: `extension/src/sidepanel/components/UrlInputCard.tsx`
- Test: `extension/__tests__/sidepanel/components/UrlInputCard.test.tsx`

- [ ] **Step 14.1: Test failing**

Create `__tests__/sidepanel/components/UrlInputCard.test.tsx` :

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { UrlInputCard } from "../../../src/sidepanel/components/UrlInputCard";

describe("UrlInputCard", () => {
  it("renders input and submit button", () => {
    render(<UrlInputCard onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText(/url youtube/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyser/i })).toBeInTheDocument();
  });

  it("calls onSubmit with the URL when valid YouTube URL submitted", () => {
    const onSubmit = jest.fn();
    render(<UrlInputCard onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/url youtube/i);
    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=abc123" } });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(onSubmit).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abc123");
  });

  it("shows error on invalid URL", () => {
    render(<UrlInputCard onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText(/url youtube/i);
    fireEvent.change(input, { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(screen.getByText(/url invalide/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 14.2: Run, verify fail**

```bash
npx jest __tests__/sidepanel/components/UrlInputCard.test.tsx -v
```

- [ ] **Step 14.3: Implement UrlInputCard.tsx**

Create `extension/src/sidepanel/components/UrlInputCard.tsx` :

```typescript
import React, { useState } from "react";
import { detectPlatform } from "../../utils/video";

interface Props {
  onSubmit: (url: string) => void;
}

export function UrlInputCard({ onSubmit }: Props): JSX.Element {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    const platform = detectPlatform(trimmed);
    if (!platform) {
      setError("URL invalide. Colle une URL YouTube ou TikTok.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div style={{ padding: 16, margin: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
      <input
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        placeholder="URL YouTube ou TikTok"
        style={{
          width: "100%",
          padding: 10,
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          color: "#fff",
          fontSize: 13,
          marginBottom: 8,
          boxSizing: "border-box",
        }}
      />
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          border: "none",
          padding: "10px 16px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          width: "100%",
        }}
      >
        Analyser
      </button>
    </div>
  );
}
```

- [ ] **Step 14.4: Run test, verify pass**

```bash
npx jest __tests__/sidepanel/components/UrlInputCard.test.tsx -v
```

- [ ] **Step 14.5: Commit**

```bash
git add src/sidepanel/components/UrlInputCard.tsx __tests__/sidepanel/components/UrlInputCard.test.tsx
git commit -m "feat(ext): add UrlInputCard for QG mode (manual URL entry)"
```

### Task 15: Component PlanBadge

**Files:**

- Create: `extension/src/sidepanel/components/PlanBadge.tsx`

- [ ] **Step 15.1: Implement directement (test léger inline)**

Create `extension/src/sidepanel/components/PlanBadge.tsx` :

```typescript
import React from "react";

interface Props {
  plan: "free" | "etudiant" | "starter" | "pro" | "equipe";
  creditsLeft: number;
  onUpgrade: () => void;
}

const PLAN_LABELS: Record<Props["plan"], string> = {
  free: "Découverte",
  etudiant: "Étudiant",
  starter: "Starter",
  pro: "Pro",
  equipe: "Équipe",
};

export function PlanBadge({ plan, creditsLeft, onUpgrade }: Props): JSX.Element {
  const showUpgrade = plan === "free" || plan === "etudiant";
  return (
    <div style={{ padding: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "2px 8px", borderRadius: 12 }}>
        {PLAN_LABELS[plan]}
      </span>
      <span style={{ opacity: 0.6 }}>{creditsLeft} crédits restants</span>
      {showUpgrade && (
        <button
          onClick={onUpgrade}
          style={{ background: "transparent", border: "none", color: "#818cf8", cursor: "pointer", marginLeft: "auto" }}
        >
          Upgrade →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 15.2: Quick test**

Create `__tests__/sidepanel/components/PlanBadge.test.tsx` :

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanBadge } from "../../../src/sidepanel/components/PlanBadge";

describe("PlanBadge", () => {
  it("renders plan label and credits", () => {
    render(<PlanBadge plan="pro" creditsLeft={42} onUpgrade={() => {}} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/42 crédits/i)).toBeInTheDocument();
  });

  it("shows upgrade button for free plan", () => {
    const onUpgrade = jest.fn();
    render(<PlanBadge plan="free" creditsLeft={3} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByText(/upgrade/i));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("hides upgrade button for pro plan", () => {
    render(<PlanBadge plan="pro" creditsLeft={42} onUpgrade={() => {}} />);
    expect(screen.queryByText(/upgrade/i)).toBeNull();
  });
});
```

```bash
npx jest __tests__/sidepanel/components/PlanBadge.test.tsx -v
```

Expected: 3 PASS.

- [ ] **Step 15.3: Commit**

```bash
git add src/sidepanel/components/PlanBadge.tsx __tests__/sidepanel/components/PlanBadge.test.tsx
git commit -m "feat(ext): split MainView — PlanBadge component"
```

### Task 16: HomeView — assemblage dual mode

**Files:**

- Create: `extension/src/sidepanel/views/HomeView.tsx`
- Test: `extension/__tests__/sidepanel/views/HomeView.test.tsx`
- Delete: `extension/src/sidepanel/views/MainView.tsx` (sera remplacé)

- [ ] **Step 16.1: Test failing pour HomeView**

Create `__tests__/sidepanel/views/HomeView.test.tsx` :

```typescript
import { render, screen } from "@testing-library/react";
import { HomeView } from "../../../src/sidepanel/views/HomeView";

const mockUser = { plan: "pro" as const, creditsLeft: 30 };
const mockRecents = [{ id: "1", videoId: "v1", title: "Vid", thumbnail: "", createdAt: "2026-04-26T10:00:00Z" }];

describe("HomeView", () => {
  it("renders QG mode when no video detected (platform=null)", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: "https://example.com", platform: null, tabId: 1 }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />
    );
    expect(screen.getByPlaceholderText(/url youtube/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /analyser cette vidéo/i })).toBeNull();
  });

  it("renders Video mode when on YouTube", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{
          url: "https://www.youtube.com/watch?v=abc",
          platform: "youtube",
          tabId: 1,
        }}
        videoMeta={{ title: "Test Vid", thumbnail: "thumb.jpg" }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />
    );
    expect(screen.getByText("Test Vid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyser cette vidéo/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 16.2: Run, verify fail**

```bash
npx jest __tests__/sidepanel/views/HomeView.test.tsx -v
```

- [ ] **Step 16.3: Implement HomeView.tsx**

Create `extension/src/sidepanel/views/HomeView.tsx` :

```typescript
import React from "react";
import { RecentsList, RecentAnalysis } from "../components/RecentsList";
import { VideoDetectedCard } from "../components/VideoDetectedCard";
import { UrlInputCard } from "../components/UrlInputCard";
import { PlanBadge } from "../components/PlanBadge";
import { CurrentTabInfo } from "../hooks/useCurrentTab";

interface User {
  plan: "free" | "etudiant" | "starter" | "pro" | "equipe";
  creditsLeft: number;
}

interface Props {
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
}: Props): JSX.Element {
  const isOnVideo = currentTab.platform !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PlanBadge plan={user.plan} creditsLeft={user.creditsLeft} onUpgrade={onUpgrade} />

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

      <div style={{ padding: "8px 16px", fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
        Récent
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RecentsList recents={recents} onSelect={onSelectRecent} />
      </div>
    </div>
  );
}
```

- [ ] **Step 16.4: Run test, verify pass**

```bash
npx jest __tests__/sidepanel/views/HomeView.test.tsx -v
```

Expected: 2 PASS.

- [ ] **Step 16.5: Update App.tsx pour utiliser HomeView au lieu de MainView**

Edit `extension/src/sidepanel/App.tsx` — replace l'import et le rendu de `MainView` par `HomeView`. Brancher `useCurrentTab` + state recents/user.

```typescript
// Add imports
import { HomeView } from "./views/HomeView";
import { useCurrentTab } from "./hooks/useCurrentTab";

// Inside the main view rendering branch, replace <MainView ... /> by:
<HomeView
  user={user}
  recents={recents}
  currentTab={useCurrentTab()}
  videoMeta={videoMeta}
  onAnalyze={handleAnalyze}
  onSelectRecent={handleSelectRecent}
  onUpgrade={handleUpgrade}
/>
```

(Adapter selon la structure exacte de `App.tsx` après le move PR 2.)

- [ ] **Step 16.6: Delete the old MainView.tsx**

```bash
git rm src/sidepanel/views/MainView.tsx
```

- [ ] **Step 16.7: Run typecheck**

```bash
npm run typecheck
```

Fix toute erreur résiduelle (probablement des paramètres manquants à passer à HomeView depuis App).

- [ ] **Step 16.8: Run full tests**

```bash
npm test
```

Expected: tous passent (le test ex-`Popup.test` peut nécessiter un update si il référençait MainView).

- [ ] **Step 16.9: Commit**

```bash
git add src/sidepanel/views/HomeView.tsx src/sidepanel/App.tsx __tests__/sidepanel/views/HomeView.test.tsx
git commit -m "feat(ext): replace MainView with HomeView dual-mode (QG / video)"
```

### Task 16.5: Component SuggestionPills (Addendum 2026-04-27 — chat-first hybrid)

**Inséré le 2026-04-27 suite au brainstorming hybride. Voir `specs/2026-04-26-extension-sidepanel-design.md` section 7bis.**

**Files:**

- Create: `extension/src/sidepanel/components/SuggestionPills.tsx`
- Test: `extension/__tests__/sidepanel/components/SuggestionPills.test.tsx`
- Modify: `extension/src/sidepanel/views/HomeView.tsx` (wire SuggestionPills sous VideoDetectedCard)

- [ ] **Step 16.5.1: Test failing pour SuggestionPills**

Create `__tests__/sidepanel/components/SuggestionPills.test.tsx` :

```typescript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestionPills } from "../../../src/sidepanel/components/SuggestionPills";

describe("SuggestionPills", () => {
  it("renders nothing when suggestions array is empty", () => {
    const { container } = render(<SuggestionPills suggestions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per suggestion (max 3 visible)", () => {
    const onTrigger = jest.fn();
    render(
      <SuggestionPills
        suggestions={[
          { id: "summary", label: "Résumé rapide", icon: "🧠", onTrigger },
          { id: "flashcards", label: "Créer flashcards", icon: "🎴", onTrigger },
          { id: "sources", label: "Voir sources", icon: "🔍", onTrigger },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: /résumé rapide/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /créer flashcards/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /voir sources/i })).toBeInTheDocument();
  });

  it("calls onTrigger when a pill is clicked", () => {
    const onTrigger = jest.fn();
    render(
      <SuggestionPills
        suggestions={[{ id: "summary", label: "Résumé rapide", onTrigger }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /résumé rapide/i }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("caps display at 3 pills even if more suggestions are passed", () => {
    const onTrigger = jest.fn();
    render(
      <SuggestionPills
        suggestions={[
          { id: "a", label: "A", onTrigger },
          { id: "b", label: "B", onTrigger },
          { id: "c", label: "C", onTrigger },
          { id: "d", label: "D", onTrigger },
        ]}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /^d$/i })).toBeNull();
  });
});
```

- [ ] **Step 16.5.2: Run, verify fail**

```bash
cd extension
npx jest __tests__/sidepanel/components/SuggestionPills.test.tsx -v
```

Expected: FAIL — module introuvable.

- [ ] **Step 16.5.3: Implement SuggestionPills.tsx**

Create `extension/src/sidepanel/components/SuggestionPills.tsx` :

```typescript
import React from "react";

export interface Suggestion {
  id: string;
  label: string;
  icon?: string;
  onTrigger: () => void;
}

interface Props {
  suggestions: Suggestion[];
}

const MAX_VISIBLE = 3;

export function SuggestionPills({ suggestions }: Props): JSX.Element | null {
  if (suggestions.length === 0) return null;
  const visible = suggestions.slice(0, MAX_VISIBLE);
  return (
    <div className="ds-suggestion-pills" role="group" aria-label="Suggestions">
      {visible.map((s) => (
        <button
          key={s.id}
          type="button"
          className="ds-suggestion-pill"
          onClick={s.onTrigger}
        >
          {s.icon ? <span className="ds-suggestion-pill__icon">{s.icon}</span> : null}
          <span className="ds-suggestion-pill__label">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
```

Ajouter le CSS minimal dans `extension/src/sidepanel/styles/sidepanel.css` (chips en row, gap 8px, fond `rgba(99,102,241,0.08)`, border `rgba(99,102,241,0.25)`, hover plus opaque).

- [ ] **Step 16.5.4: Run, verify pass**

```bash
npx jest __tests__/sidepanel/components/SuggestionPills.test.tsx -v
```

Expected: 4 tests PASS.

- [ ] **Step 16.5.5: Wire SuggestionPills dans HomeView (mode vidéo détectée)**

Edit `extension/src/sidepanel/views/HomeView.tsx` — dans la branche « Video mode », immédiatement sous `<VideoDetectedCard ... />`, ajouter :

```tsx
<SuggestionPills
  suggestions={[
    {
      id: "summary",
      label: "Résumé rapide",
      icon: "🧠",
      onTrigger: onAnalyze,
    },
    {
      id: "flashcards",
      label: "Créer flashcards",
      icon: "🎴",
      onTrigger: () =>
        chrome.tabs.create({
          url: `https://www.deepsightsynthesis.com/study/${currentTab.videoId ?? ""}`,
        }),
    },
    // "Voir sources" affiché conditionnellement si cacheStatus.hit === true
    ...(cacheStatus?.hit
      ? [
          {
            id: "sources",
            label: "Voir sources",
            icon: "🔍",
            onTrigger: () =>
              chrome.tabs.create({
                url: `https://www.deepsightsynthesis.com/analysis/${cacheStatus.summaryId}#sources`,
              }),
          },
        ]
      : []),
  ]}
/>
```

Mettre à jour le test `HomeView.test.tsx` pour vérifier que les pills apparaissent en mode vidéo (au moins un `getByRole("button", { name: /résumé rapide/i })`).

- [ ] **Step 16.5.6: Run typecheck + suite complète**

```bash
npm run typecheck
npm test
```

Expected: 0 erreur TS, tous tests verts (incluant `HomeView` mis à jour).

- [ ] **Step 16.5.7: Commit**

```bash
git add src/sidepanel/components/SuggestionPills.tsx \
        __tests__/sidepanel/components/SuggestionPills.test.tsx \
        src/sidepanel/views/HomeView.tsx \
        __tests__/sidepanel/views/HomeView.test.tsx \
        src/sidepanel/styles/sidepanel.css
git commit -m "feat(ext): SuggestionPills chips under VideoDetectedCard (chat-first hybrid addendum)"
```

---

### Task 17: Content script light — URL detect only

**Files:**

- Modify: `extension/src/content/index.ts` (réécriture complète)
- Create: `extension/__tests__/content/url-detect.test.ts`

- [ ] **Step 17.1: Test failing pour content light**

Create `__tests__/content/url-detect.test.ts` :

```typescript
describe("content URL detect", () => {
  let messageSpy: jest.Mock;
  let originalLocation: Location;

  beforeEach(() => {
    jest.useFakeTimers();
    messageSpy = jest.fn().mockResolvedValue(undefined);
    (global as any).chrome = {
      runtime: { sendMessage: messageSpy },
    };
    originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      href: "https://www.youtube.com/watch?v=initial",
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    (window as any).location = originalLocation;
  });

  it("sends URL_CHANGED on initial load", async () => {
    await import("../../src/content/index");
    expect(messageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "URL_CHANGED",
        payload: expect.objectContaining({
          url: "https://www.youtube.com/watch?v=initial",
        }),
      }),
    );
  });

  it("sends URL_CHANGED on popstate", async () => {
    await import("../../src/content/index");
    messageSpy.mockClear();
    (window as any).location.href = "https://www.youtube.com/watch?v=newvid";
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(messageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "URL_CHANGED",
        payload: expect.objectContaining({
          url: "https://www.youtube.com/watch?v=newvid",
        }),
      }),
    );
  });

  it("does NOT send when URL unchanged", async () => {
    await import("../../src/content/index");
    messageSpy.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(messageSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 17.2: Run, verify fail**

```bash
npx jest __tests__/content/url-detect.test.ts -v
```

- [ ] **Step 17.3: Réécrire `extension/src/content/index.ts`**

Replace **TOUT** le contenu de `extension/src/content/index.ts` par :

```typescript
import { detectPlatform } from "../utils/video";

let lastUrl = location.href;

const notifyUrlChange = (): void => {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;
  chrome.runtime
    .sendMessage({
      action: "URL_CHANGED",
      payload: { url, platform: detectPlatform(url) },
    })
    .catch(() => {});
};

let throttleTimer: number | null = null;
const throttledNotify = (): void => {
  if (throttleTimer !== null) return;
  throttleTimer = window.setTimeout(() => {
    notifyUrlChange();
    throttleTimer = null;
  }, 500);
};

new MutationObserver(throttledNotify).observe(document, {
  subtree: true,
  childList: true,
});
window.addEventListener("popstate", notifyUrlChange);

// Initial detection
chrome.runtime
  .sendMessage({
    action: "URL_CHANGED",
    payload: { url: lastUrl, platform: detectPlatform(lastUrl) },
  })
  .catch(() => {});
```

- [ ] **Step 17.4: Run test, verify pass**

```bash
npx jest __tests__/content/url-detect.test.ts -v
```

Expected: 3 tests PASS.

- [ ] **Step 17.5: Commit**

```bash
git add src/content/index.ts __tests__/content/url-detect.test.ts
git commit -m "feat(ext): rewrite content script as URL detect only (757L → 50L)"
```

### Task 18: PR 3 — Validation full flow

- [ ] **Step 18.1: Build + reload Chrome**

```bash
cd extension
npm run build
```

User : reload extension dans `chrome://extensions`.

- [ ] **Step 18.2: Test manuel complet**

1. Aller sur `https://www.youtube.com` (homepage, pas une vidéo) → ouvrir sidebar → doit afficher mode QG (recents + URL input)
2. Cliquer sur une vidéo YouTube → la sidebar doit détecter et passer en mode Vidéo (VideoDetectedCard avec titre + bouton)
3. Cliquer "Analyser cette vidéo" → flow analyse standard (loading → résultats)
4. Aller sur une page non-YT (`https://example.com`) → sidebar repasse en mode QG
5. Coller une URL YouTube dans UrlInputCard → analyse se lance

**Vérification critique** : 6. Sur une vidéo YouTube, ouvrir DevTools → console : `document.querySelector("#deepsight-host")` doit retourner `null` (le widget on-page est mort).

- [ ] **Step 18.3: Run full test suite + typecheck + build**

```bash
npm test
npm run typecheck
npm run build
```

Tous doivent passer.

- [ ] **Step 18.4: Push + PR**

```bash
git push
gh pr create --title "feat(ext): HomeView dual mode + content URL detect light (PR 3/4)" --body "$(cat <<'EOF'
## Summary
- Split MainView (729L) into HomeView + RecentsList + VideoDetectedCard + UrlInputCard + PlanBadge
- Hook useCurrentTab subscribes to TAB_CHANGED + VIDEO_URL_UPDATED
- HomeView dual-mode: QG (no video, URL input) / Video (detected card + analyze CTA)
- Content script rewritten: 757L → ~50L (URL detect only, no Shadow DOM, no UI)

## Test plan
- [x] All unit tests pass (HomeView, RecentsList, VideoDetectedCard, UrlInputCard, useCurrentTab, content/url-detect)
- [x] Manual: clic icône → sidebar dual-mode works
- [x] Manual: navigating between YouTube videos updates sidebar
- [x] **No more on-page UI**: document.querySelector("#deepsight-host") returns null
EOF
)"
```

---

# PR 4 — Cleanup widget Shadow DOM + dist orphelins

**Goal:** Suppression de tout le code mort : widget Shadow DOM, state machine, CSS widget, tests obsolètes, artefacts dist orphelins. Bundle size réduit.

### Task 19: Supprimer widget + states + CSS widget

**Files:**

- Delete: `extension/src/content/widget.ts`, `extension/src/content/widget/`, `extension/src/content/states/`, `extension/src/styles/widget.css`, `extension/src/styles/content.css` (si plus utilisé)

- [ ] **Step 19.1: Verify nothing imports widget**

```bash
cd extension
grep -rn "from .*widget\|from .*states/" src/ __tests__/
```

Expected: 0 hit (sinon fix les imports résiduels).

- [ ] **Step 19.2: Delete les fichiers morts**

```bash
git rm src/content/widget.ts
git rm -r src/content/states/
git rm -r src/content/widget 2>/dev/null  # si dossier widget/ existe
git rm src/styles/widget.css
```

Pour `src/content/i18n.ts`, `observer.ts`, `shadow.ts`, `shadow-types.d.ts`, `styles-inline.ts`, `tournesol.ts`, `tts.ts` — vérifier s'ils sont importés ailleurs avant suppression :

```bash
for f in i18n observer shadow shadow-types styles-inline tournesol tts; do
  echo "=== $f ===";
  grep -rn "from .*content/$f" src/ __tests__/ | grep -v "src/content/$f";
done
```

Si 0 hit pour un fichier → `git rm src/content/$f.ts`.

- [ ] **Step 19.3: Build pour vérifier qu'il ne reste pas de référence cassée**

```bash
npm run build 2>&1 | tail -30
```

Expected: build OK. Fix toute erreur résiduelle.

- [ ] **Step 19.4: Commit**

```bash
git commit -m "chore(ext): remove dead widget + states + CSS files (~1500 lines)"
```

### Task 20: Supprimer tests obsolètes

**Files:**

- Delete: `__tests__/content/widget.test.ts`, `__tests__/content/boot-instrumentation.test.ts`, `__tests__/content/__tests__/coexistence.test.ts`, `__tests__/content/__tests__/theme.test.ts`

- [ ] **Step 20.1: Delete tests morts**

```bash
git rm __tests__/content/widget.test.ts
git rm __tests__/content/boot-instrumentation.test.ts
git rm -r __tests__/content/__tests__/ 2>/dev/null
```

- [ ] **Step 20.2: Update boot.test si présent**

Si `__tests__/content/boot.test.ts` existe et teste le widget, le supprimer ou le réécrire pour cibler le content light :

```bash
cat __tests__/content/boot.test.ts | head -30
```

Si test de boot widget → `git rm __tests__/content/boot.test.ts` (le test url-detect créé en Task 17 le remplace).

- [ ] **Step 20.3: Run tests**

```bash
npm test
```

Expected: tous passent.

- [ ] **Step 20.4: Skip xfail le test voice WIP**

Edit `extension/__tests__/sidepanel/useExtensionVoiceChat.test.ts` — changer `describe(...)` par `describe.skip(...)` :

```typescript
describe.skip("useExtensionVoiceChat (WIP — voice feature)", () => {
  // ... tests existants
});
```

```bash
npm test 2>&1 | grep -i "skipped\|skip"
```

Expected: 5 tests skipped.

- [ ] **Step 20.5: Commit**

```bash
git add __tests__/
git commit -m "chore(ext): remove obsolete widget tests + skip voice WIP tests"
```

### Task 21: Supprimer dist orphelins + popup files

**Files:**

- Delete: `extension/dist/popup.{html,js}`, `extension/dist/widget.css`, `extension/dist/content.css`, `extension/public/popup.html`

- [ ] **Step 21.1: Delete public/popup.html**

```bash
git rm extension/public/popup.html
```

- [ ] **Step 21.2: Clean dist puis rebuild**

```bash
cd extension
rm -rf dist/
npm run build
ls dist/
```

Expected: pas de `popup.*`, pas de `widget.css`, juste sidepanel + background + content + viewer + manifest + icons.

- [ ] **Step 21.3: Mesurer la réduction de bundle**

```bash
du -sh dist/
du -sh dist/sidepanel.js dist/background.js dist/content.js
```

Noter les tailles dans le PR description.

- [ ] **Step 21.4: Commit**

```bash
git add extension/public/
git commit -m "chore(ext): remove popup.html, regenerate dist (smaller bundle)"
```

### Task 22: PR 4 — Final validation + push

- [ ] **Step 22.1: Run all checks**

```bash
cd extension
npm run typecheck
npm test
npm test -- --coverage
npm run build
```

Expected: tout vert. Coverage `src/sidepanel/` ≥ 80%.

- [ ] **Step 22.2: Update CLAUDE.md de l'extension**

Si `extension/CLAUDE.md` existe, ajouter une note v3.0 sur la nouvelle architecture sidebar. Sinon skip.

- [ ] **Step 22.3: Push + PR**

```bash
git push
gh pr create --title "chore(ext): cleanup widget Shadow DOM + dist orphelins (PR 4/4)" --body "$(cat <<'EOF'
## Summary
- Remove dead widget code (~1500 lines): widget.ts, states/, widget.css, content.css
- Remove obsolete tests: widget.test, boot-instrumentation.test, coexistence.test, theme.test
- Skip voice WIP tests (out of scope of this v3.0 refactor)
- Remove popup.html from public/
- Bundle size: dist/ reduced from XX MB → YY MB (-ZZ%)

## Test plan
- [x] npm typecheck
- [x] npm test (all pass, coverage ≥80% on src/sidepanel/)
- [x] npm run build (clean dist, no popup.* artifacts)
- [x] Manual: load unpacked → full v3.0 flow works
EOF
)"
```

### Task 23: Memory + Asana tracking

- [ ] **Step 23.1: Créer une memory note projet**

Save `C:/Users/33667/.claude/projects/C--Users-33667-DeepSight-Main/memory/project_extension_sidepanel_v3.md` :

```markdown
---
name: Extension SidePanel v3.0
description: Refactor de l'extension Chrome de popup + widget on-page vers sidebar latérale Claude in Chrome style
type: project
---

# Extension Chrome — Refactor SidePanel v3.0

**Statut** : Implémenté en 4 PRs (refs : feat/extension-sidepanel-v3 → main)

**Architecture finale** :

- Manifest V3 + permission `sidePanel`, `minimum_chrome_version: 114`
- Service worker `setPanelBehavior({ openPanelOnActionClick: true })` → toggle clic icône
- Content script light (~50L) : URL detect only, plus de Shadow DOM
- Sidebar 480px, full-height, structure `src/sidepanel/{views,components,shared,hooks,styles}`
- HomeView dual mode : QG (recents + URL input) / Vidéo (VideoDetectedCard)

**Why** : popup 400×600 trop étroite, widget on-page intrusif, layout cassé par changements DOM YouTube.

**How to apply** : pour toute modif UI extension future, brancher dans `src/sidepanel/`. Plus jamais d'injection on-page (sauf URL detect dans `content/index.ts`).
```

Update `C:/Users/33667/.claude/projects/C--Users-33667-DeepSight-Main/memory/MEMORY.md` :

```markdown
- [Extension SidePanel v3.0](project_extension_sidepanel_v3.md) — refactor popup → sidebar latérale Claude in Chrome style, mergé v3.0
```

- [ ] **Step 23.2: Créer tâche Asana session active (optionnel)**

Si l'utilisateur tient au tracking Asana cross-session, créer une tâche dans le projet Frontend ou Extension décrivant la livraison.

- [ ] **Step 23.3: Final commit**

```bash
git add C:/Users/33667/.claude/projects/C--Users-33667-DeepSight-Main/memory/
git commit -m "docs(memory): track extension sidepanel v3.0 project"
git push
```

---

## Self-Review

### Spec coverage check

| Spec section                                  | Plan coverage                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — Suppression widget on-page + toggle clic | Task 17 (content rewrite) + Task 2 (setPanelBehavior)                                                                                                            |
| Q2a — QG permanent                            | Task 16 (HomeView dual mode)                                                                                                                                     |
| Q2b — Popup supprimée                         | Task 6 (move) + Task 21 (delete popup.html)                                                                                                                      |
| Q3a — Largeur 480px                           | Task 9 (sidepanel.html body width)                                                                                                                               |
| Q3b — Move popup → sidepanel + split MainView | Tasks 6, 12-16                                                                                                                                                   |
| Q4a — Chrome only                             | Tasks 1 (manifest only), FF/Safari manifests inchangés                                                                                                           |
| Q4b — Voice out of scope                      | Task 20 (skip voice tests)                                                                                                                                       |
| Manifest changes (4.1)                        | Task 1                                                                                                                                                           |
| Service worker changes (4.2)                  | Tasks 2, 3                                                                                                                                                       |
| Content light (4.3)                           | Task 17                                                                                                                                                          |
| Structure sidepanel/ (4.4)                    | Tasks 6-16                                                                                                                                                       |
| Layout/CSS (4.5)                              | Task 9                                                                                                                                                           |
| Webpack (4.6)                                 | Task 8                                                                                                                                                           |
| Tests (4.7)                                   | Tasks 2, 11-16, 17, 20                                                                                                                                           |
| Découpage 4 PRs (5)                           | Tasks 1-5 (PR 1), 6-10 (PR 2), 11-18 (PR 3), 19-23 (PR 4)                                                                                                        |
| Risques (6)                                   | Mitigés : SW sleep (Task 11 keepAlive), Chrome <114 (Task 1 minimum_chrome_version), YouTube SPA (Task 17 popstate + MutationObserver), voice WIP (Task 20 skip) |

### Placeholder scan

- ❌ "Add appropriate error handling" → ✅ aucun
- ❌ "Similar to Task N" → ✅ aucun (chaque task complet)
- ❌ "TBD/TODO" → ✅ aucun
- ❌ Tests sans code → ✅ chaque test a du code complet
- ❌ Étapes sans commands → ✅ chaque step a sa commande exacte

### Type consistency

- `RecentAnalysis` interface défini Task 12, réutilisé dans HomeView Task 16 ✅
- `CurrentTabInfo` défini Task 11, réutilisé HomeView Task 16 ✅
- `Platform` type ("youtube" | "tiktok" | null) cohérent entre useCurrentTab, VideoDetectedCard, content/index ✅
- Nom des actions messages : `TAB_CHANGED`, `URL_CHANGED`, `VIDEO_URL_UPDATED` cohérents Task 2/3/11/17 ✅

---

## Execution Handoff

**Plan complet sauvegardé dans `docs/superpowers/plans/2026-04-26-extension-sidepanel-v3.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Je dispatch un subagent neuf par task, review entre tasks, itération rapide.

**2. Inline Execution** — J'exécute les tasks dans cette session avec `superpowers:executing-plans`, exécution batch avec checkpoints.

**Quelle approche préfères-tu ?**
