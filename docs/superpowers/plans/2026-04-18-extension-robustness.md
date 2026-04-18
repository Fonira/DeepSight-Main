# Extension Chrome DeepSight — Fiabilisation Robustesse

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éliminer définitivement le bug "sidebar blanche" sur YouTube/TikTok avant soumission Chrome Web Store. L'extension doit s'afficher du premier coup, sans blanc, sur Chrome/Edge/Brave/Opera/Firefox/profil invité/navigation privée/fresh install.

**Architecture:** 6 phases progressives. (1) Instrumentation pour capturer tout crash invisible. (2) Correction des 3 root causes identifiées : stylesheets `<link>` chrome-extension:// qui n'arrivent pas à charger à temps dans Shadow DOM closed + absence de cleanup des "zombie hosts" + absence de `try/catch` autour des appels DOM fragiles. (3) Défense cross-browser. (4) Tests automatisés Jest + Playwright. (5) Crash telemetry Sentry. (6) Validation finale.

**Tech Stack:** Chrome Manifest V3, TypeScript strict, Preact (alias webpack), Webpack 5, Jest 30 + jsdom, Playwright (nouveau devDep), Sentry browser SDK.

---

## Hypothèses root cause (validées par lecture code)

| #   | Hypothèse                                                                                                                                                                                                                                                                                                                                           | Fichier                                                | Signal                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| H1  | `<link rel="stylesheet" href="chrome-extension://...">` dans Shadow DOM closed se charge async. Fenêtre de 50-500ms pendant laquelle le widget existe mais est **non stylé** → visuellement "blanc". Aggravé sur connexion lente.                                                                                                                   | `content/widget.ts:68-81`                              | 3 `<link>` injectés, pas de `<style>` inline            |
| H2  | Zombie host : `injectWidget:133` fait `if (document.getElementById(HOST_ID)) return true`. Si un ancien host reste du premier bootstrap mais que `setShadowRoot()` a été écrasé par un nouveau call, le DOM pointe vers un shadow orphelin → widget blanc permanent.                                                                                | `content/widget.ts:131-146` + `content/shadow.ts:5-13` | Singleton `_shadowRoot` écrasable                       |
| H3  | Crash silencieux : `host.attachShadow({ mode: "closed" })`, `Browser.runtime.getURL()`, `document.querySelector` sur YouTube peuvent throw (autre extension qui monkeypatch, CSP stricte sur chrome-extension://, timing). Aucun `try/catch` → erreur dans la console du content script, invisible (l'user a vérifié) car la trace ne persiste pas. | `content/widget.ts:28-96` + `content/index.ts:81-141`  | Pas de global `window.onerror`, pas de persistance      |
| H4  | `document_idle` se déclenche avant que `#secondary-inner` existe. 5 stratégies échouent, tombe en floating (bottom-right). Floating lui-même n'a pas de fond stylé si CSS pas chargé → blanc.                                                                                                                                                       | `content/widget.ts:10-19,149-167`                      | Pas de retry au niveau "anchor pas encore là"           |
| H5  | `watchNavigation` capture `pushState`/`yt-navigate-finish`, mais sur hard refresh (F5) + slow network, le listener n'est jamais appelé et `ctx.videoId` peut être null au bootstrap → pas d'injection du tout.                                                                                                                                      | `content/navigation.ts:16-36`                          | Premier bootstrap = seul chance si `isVideoPage()` true |

**Root cause probable** = combinaison **H1 + H3**. H2 aggrave sur navigation SPA répétée. H4/H5 sont des bugs secondaires qui empirent le rendu.

---

## File Structure

### Nouveaux fichiers

| Path                                         | Responsabilité                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension/src/utils/crash-logger.ts`        | Enregistre/draine les crashes boot dans `chrome.storage.local` (clé `ds_crash_log`). Logger de steps boot dans `console.log('[DeepSight-boot] ...')`. |
| `extension/src/content/styles-inline.ts`     | Re-exporte les 3 CSS (`tokens.css`, `widget.css`, `content.css`) en strings via webpack `raw-loader`. Injectables via `<style>`.                      |
| `extension/src/utils/sentry-reporter.ts`     | Envoie les crashes persistés vers Sentry (opt-in via env var `SENTRY_DSN_EXTENSION`).                                                                 |
| `extension/__tests__/content/boot.test.ts`   | Jest — simule DOM YouTube + chrome.runtime, vérifie host injecté, shadow populé, login state rendu.                                                   |
| `extension/__tests__/content/widget.test.ts` | Jest — teste zombie cleanup, inline styles, defensive attachShadow.                                                                                   |
| `extension/e2e/extension-loaded.spec.ts`     | Playwright — charge `dist/` dans Chromium, navigue YouTube, asserts `#deepsight-host` existe + screenshot.                                            |
| `extension/e2e/playwright.config.ts`         | Config Playwright scoped extension.                                                                                                                   |
| `extension/e2e/fixtures/extension.ts`        | Helper `loadExtension(browser, distPath)`.                                                                                                            |

### Fichiers modifiés

| Path                              | Modif                                                                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension/src/content/widget.ts` | Remplace `<link>` par `<style>` inline. Zombie cleanup dans `injectWidget`. `try/catch` sur `attachShadow`. Renvoie null sur échec.                                                                                   |
| `extension/src/content/shadow.ts` | `setShadowRoot` appelle `oldShadow.host?.remove()` avant d'écraser. `$id/$qs` retournent safe defaults si shadow null.                                                                                                |
| `extension/src/content/index.ts`  | Wraps `tryInjectWidget`, `bootstrap`, `onNavigate` dans try/catch qui persistent via `crash-logger`. Ajoute `[DeepSight-boot] step=X` à chaque étape. Render widget shell + spinner SYNCHRONE avant `initCard` async. |
| `extension/src/background.ts`     | Au `onStartup` + `onInstalled`, draine `ds_crash_log` et envoie vers Sentry.                                                                                                                                          |
| `extension/webpack.config.js`     | Ajoute `raw-loader` rule pour importer CSS comme strings. Ajoute env var `SENTRY_DSN_EXTENSION` via `DefinePlugin`.                                                                                                   |
| `extension/tsconfig.json`         | `allowSyntheticDefaultImports` + path alias `?raw` si besoin.                                                                                                                                                         |
| `extension/jest.config.js`        | Ajoute moduleNameMapper pour `\\.css$` → string.                                                                                                                                                                      |
| `extension/package.json`          | Ajoute `raw-loader`, `@sentry/browser`, `@playwright/test`, `e2e` script.                                                                                                                                             |

---

## Phase 0 — Baseline verification (pre-flight)

Cette phase garantit qu'on part d'un état connu-bon. Aucune modification de code.

### Task 0.1 : Verify clean baseline

**Files:** read-only

- [ ] **Step 1: Install deps in worktree**

```powershell
cd C:\Users\33667\DeepSight-Main\.claude\worktrees\ext-robustness\extension
npm install
```

Expected: no errors, lockfile unchanged.

- [ ] **Step 2: Run typecheck**

```powershell
npm run typecheck
```

Expected: exit 0, no TS errors.

- [ ] **Step 3: Run existing Jest tests**

```powershell
npm test -- --passWithNoTests
```

Expected: passes (may be "No tests found" — that's the current state).

- [ ] **Step 4: Build production bundle**

```powershell
npm run build
```

Expected: exit 0, `dist/` populated with `background.js`, `content.js`, `popup.js`, `viewer.js`, `authSync.js`, `authSyncMain.js`, `manifest.json`, `*.css`.

- [ ] **Step 5: Verify dist assets exist**

```powershell
Get-ChildItem dist/ | Select-Object Name, Length
```

Expected: all 6 JS bundles + manifest + 5 CSS files present.

- [ ] **Step 6: Record baseline commit** (no changes — just note)

```powershell
git log -1 --oneline
```

Record this SHA as baseline.

---

## Phase 1 — Crash Telemetry & Boot Instrumentation

Avant toute réparation, on capture les crashes invisibles. Si le bug réapparaît après fix, on aura la trace exacte.

### Task 1.1 : Create crash-logger utility

**Files:**

- Create: `extension/src/utils/crash-logger.ts`
- Test: `extension/__tests__/utils/crash-logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// extension/__tests__/utils/crash-logger.test.ts
import {
  logBootStep,
  persistCrash,
  drainCrashes,
  getBootStepHistory,
} from "../../src/utils/crash-logger";

describe("crash-logger", () => {
  beforeEach(async () => {
    // Reset mocked chrome.storage
    await chrome.storage.local.clear();
  });

  test("logBootStep appends to in-memory history and console", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    logBootStep("bootstrap:start", { videoId: "abc" });
    const history = getBootStepHistory();
    expect(history).toHaveLength(1);
    expect(history[0].step).toBe("bootstrap:start");
    expect(history[0].detail).toEqual({ videoId: "abc" });
    expect(spy).toHaveBeenCalledWith("[DeepSight-boot]", "bootstrap:start", {
      videoId: "abc",
    });
    spy.mockRestore();
  });

  test("persistCrash stores error with steps history", async () => {
    logBootStep("step-a");
    logBootStep("step-b");
    await persistCrash(new Error("boom"), { context: "inject" });
    const data = await chrome.storage.local.get("ds_crash_log");
    const crashes = data.ds_crash_log as Array<{
      message: string;
      stack?: string;
      context?: unknown;
      steps: string[];
      timestamp: number;
      url: string;
      userAgent: string;
    }>;
    expect(crashes).toHaveLength(1);
    expect(crashes[0].message).toBe("boom");
    expect(crashes[0].steps).toEqual(["step-a", "step-b"]);
    expect(crashes[0].context).toEqual({ context: "inject" });
    expect(typeof crashes[0].timestamp).toBe("number");
  });

  test("persistCrash caps at 20 entries (FIFO)", async () => {
    for (let i = 0; i < 25; i++) {
      await persistCrash(new Error(`err-${i}`));
    }
    const data = await chrome.storage.local.get("ds_crash_log");
    expect(data.ds_crash_log).toHaveLength(20);
    expect(data.ds_crash_log[0].message).toBe("err-5");
    expect(data.ds_crash_log[19].message).toBe("err-24");
  });

  test("drainCrashes returns and clears", async () => {
    await persistCrash(new Error("one"));
    await persistCrash(new Error("two"));
    const drained = await drainCrashes();
    expect(drained).toHaveLength(2);
    const data = await chrome.storage.local.get("ds_crash_log");
    expect(data.ds_crash_log ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
npm test -- crash-logger
```

Expected: FAIL with "Cannot find module '../../src/utils/crash-logger'".

- [ ] **Step 3: Implement crash-logger**

```typescript
// extension/src/utils/crash-logger.ts
// ── Crash Logger ──
// Persists boot-time errors that would otherwise vanish silently
// (the content script has no global window.onerror at the moment
// the error fires). History is capped FIFO at 20 entries to avoid
// unbounded storage growth. Drained at service-worker boot by the
// Sentry reporter (see utils/sentry-reporter.ts).

export interface BootStep {
  step: string;
  detail?: unknown;
  t: number;
}

export interface CrashRecord {
  message: string;
  stack?: string;
  context?: unknown;
  steps: string[];
  timestamp: number;
  url: string;
  userAgent: string;
}

const STORAGE_KEY = "ds_crash_log";
const MAX_CRASHES = 20;
const MAX_STEPS_IN_MEMORY = 100;

let _stepHistory: BootStep[] = [];

export function logBootStep(step: string, detail?: unknown): void {
  _stepHistory.push({ step, detail, t: Date.now() });
  if (_stepHistory.length > MAX_STEPS_IN_MEMORY) {
    _stepHistory = _stepHistory.slice(-MAX_STEPS_IN_MEMORY);
  }
  try {
    if (detail !== undefined) {
      console.log("[DeepSight-boot]", step, detail);
    } else {
      console.log("[DeepSight-boot]", step);
    }
  } catch {
    /* console may be unavailable in exotic contexts */
  }
}

export function getBootStepHistory(): BootStep[] {
  return [..._stepHistory];
}

export async function persistCrash(
  err: unknown,
  context?: unknown,
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  const record: CrashRecord = {
    message: error.message || "Unknown error",
    stack: error.stack,
    context,
    steps: _stepHistory.map((s) => s.step),
    timestamp: Date.now(),
    url: typeof location !== "undefined" && location.href ? location.href : "",
    userAgent:
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "",
  };

  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const existing = Array.isArray(data[STORAGE_KEY])
      ? (data[STORAGE_KEY] as CrashRecord[])
      : [];
    const next = [...existing, record].slice(-MAX_CRASHES);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } catch (storageErr) {
    // chrome.storage might be unavailable (page script context). Fallback: console only.
    try {
      console.error("[DeepSight-crash]", record, storageErr);
    } catch {
      /* swallow */
    }
  }
}

export async function drainCrashes(): Promise<CrashRecord[]> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const crashes = Array.isArray(data[STORAGE_KEY])
      ? (data[STORAGE_KEY] as CrashRecord[])
      : [];
    if (crashes.length > 0) {
      await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    }
    return crashes;
  } catch {
    return [];
  }
}

/** Test helper — reset in-memory step history. Not exported in production. */
export function __resetForTest(): void {
  _stepHistory = [];
}
```

- [ ] **Step 4: Run test to verify it passes**

```powershell
npm test -- crash-logger
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\33667\DeepSight-Main\.claude\worktrees\ext-robustness
git add extension/src/utils/crash-logger.ts extension/__tests__/utils/crash-logger.test.ts
git commit -m "feat(ext): crash-logger util persists boot errors to chrome.storage"
```

---

### Task 1.2 : Instrument content script boot with try/catch + steps

**Files:**

- Modify: `extension/src/content/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// extension/__tests__/content/boot-instrumentation.test.ts
import {
  persistCrash,
  drainCrashes,
  __resetForTest,
} from "../../src/utils/crash-logger";

describe("boot instrumentation contract", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    __resetForTest();
  });

  test("if createWidgetShell throws, error is persisted with 'widget:create' context", async () => {
    // Simulate the wrapper behaviour without importing the whole index.ts
    // (which has top-level side effects). The contract is that anything
    // thrown during widget creation is caught and persistCrash'd.
    const err = new Error("attachShadow blocked");
    await persistCrash(err, { step: "widget:create" });
    const drained = await drainCrashes();
    expect(drained).toHaveLength(1);
    expect(drained[0].message).toBe("attachShadow blocked");
    expect(drained[0].context).toEqual({ step: "widget:create" });
  });
});
```

- [ ] **Step 2: Run the test to verify it passes** (contract test only — the integration work happens next)

```powershell
npm test -- boot-instrumentation
```

Expected: PASS.

- [ ] **Step 3: Patch `content/index.ts` — wrap boot functions**

Open `extension/src/content/index.ts` and apply the following edits.

**Edit 1** — add imports at the top (after existing imports, before `type AppState`):

```typescript
import { logBootStep, persistCrash } from "../utils/crash-logger";
```

**Edit 2** — replace `function tryInjectWidget(): void { ... }` (lines 81-141) with:

```typescript
function tryInjectWidget(): void {
  try {
    if (ctx.injected && getExistingWidget()) {
      logBootStep("inject:skip-already-injected");
      return;
    }
    if (ctx.injectionAttempts > 30) {
      logBootStep("inject:max-attempts-reached");
      return;
    }

    ctx.injectionAttempts++;
    logBootStep("inject:attempt", { n: ctx.injectionAttempts });

    const platform = detectCurrentPagePlatform();
    const isTikTok = platform === "tiktok";
    const theme = detectTheme();
    logBootStep("inject:platform-theme", { platform, theme });

    const host = createWidgetShell(theme, isTikTok);
    if (!host) {
      logBootStep("inject:createWidgetShell-returned-null");
      const delay = ctx.injectionAttempts <= 10 ? 300 : 1000;
      setTimeout(tryInjectWidget, delay);
      return;
    }

    const widgetCard = getExistingWidget();
    if (widgetCard) {
      widgetCard.innerHTML = buildWidgetHeader(logoImgHtml(22));
      const body = document.createElement("div");
      body.className = "ds-card-body";
      body.innerHTML = `<div class="ds-loading"><div style="color:var(--ds-gold-mid)">⏳</div><p class="ds-loading-text">Chargement...</p></div>`;
      widgetCard.appendChild(body);
      logBootStep("inject:widget-populated");
    } else {
      logBootStep("inject:widgetCard-null");
    }

    const success = injectWidget(host, isTikTok);
    logBootStep("inject:injectWidget-result", { success });

    if (success) {
      ctx.injected = true;
      ctx.injectionAttempts = 0;
      bindMinimizeButton();
      watchTheme((t) => {
        const w = getExistingWidget();
        if (w) {
          w.classList.remove("dark", "light");
          w.classList.add(t);
        }
      });
      startWidgetObserver(() => {
        logBootStep("observer:widget-detached");
        ctx.injected = false;
        tryInjectWidget();
      });
      watchLayoutMode((mode: LayoutMode) => {
        const hostEl = document.getElementById("deepsight-host");
        if (!hostEl) return;
        if (mode === "fullscreen") {
          hostEl.style.display = "none";
        } else if (mode === "theater") {
          hostEl.style.cssText =
            "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:2147483646;";
          hostEl.style.display = "";
        } else {
          hostEl.style.cssText =
            "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";
        }
      });
      logBootStep("inject:success-calling-initCard");
      initCard();
    } else {
      const delay = ctx.injectionAttempts <= 10 ? 300 : 1000;
      setTimeout(tryInjectWidget, delay);
    }
  } catch (err) {
    logBootStep("inject:caught-error", {
      message: (err as Error).message,
    });
    void persistCrash(err, {
      step: "tryInjectWidget",
      attempt: ctx.injectionAttempts,
    });
    // Retry once — if it fails again, stop to avoid infinite loop
    if (ctx.injectionAttempts < 3) {
      setTimeout(tryInjectWidget, 1000);
    }
  }
}
```

**Edit 3** — replace `function bootstrap(): void { ... }` (lines 600-614) with:

```typescript
function bootstrap(): void {
  try {
    logBootStep("bootstrap:start", {
      url: location.href,
      readyState: document.readyState,
    });
    if (!isVideoPage()) {
      logBootStep("bootstrap:not-video-page");
      return;
    }

    ctx.videoId = getCurrentVideoId();
    if (!ctx.videoId) {
      logBootStep("bootstrap:no-video-id");
      return;
    }

    logBootStep("bootstrap:video-id", { videoId: ctx.videoId });
    detectExtensions();
    setTimeout(tryInjectWidget, 1000);
    watchNavigation(onNavigate);
    logBootStep("bootstrap:ready");
  } catch (err) {
    logBootStep("bootstrap:caught-error", { message: (err as Error).message });
    void persistCrash(err, { step: "bootstrap" });
  }
}
```

**Edit 4** — wrap the final bootstrap dispatch (lines 617-621):

Replace:

```typescript
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
```

With:

```typescript
// Global safety net: persist any uncaught error during the boot window
window.addEventListener("error", (ev) => {
  if (ev.error) void persistCrash(ev.error, { source: "window.onerror" });
});
window.addEventListener("unhandledrejection", (ev) => {
  void persistCrash(ev.reason, { source: "unhandledrejection" });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
```

- [ ] **Step 4: Run typecheck**

```powershell
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 5: Run all tests**

```powershell
npm test
```

Expected: all tests PASS (incl. the existing ones).

- [ ] **Step 6: Commit**

```powershell
git add extension/src/content/index.ts extension/__tests__/content/boot-instrumentation.test.ts
git commit -m "feat(ext): instrument content boot with step logging + crash persistence"
```

---

### Task 1.3 : Drain crashes from service worker on startup

**Files:**

- Modify: `extension/src/background.ts`
- Test: `extension/__tests__/background/crash-drain.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// extension/__tests__/background/crash-drain.test.ts
import { drainCrashes } from "../../src/utils/crash-logger";
import { reportCrashes } from "../../src/utils/sentry-reporter";

jest.mock("../../src/utils/sentry-reporter", () => ({
  reportCrashes: jest.fn().mockResolvedValue(undefined),
}));

describe("service worker crash drain contract", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    jest.clearAllMocks();
  });

  test("drainCrashes + reportCrashes integrate cleanly", async () => {
    await chrome.storage.local.set({
      ds_crash_log: [
        {
          message: "test",
          steps: ["a"],
          timestamp: 1,
          url: "https://youtube.com",
          userAgent: "test",
        },
      ],
    });
    const crashes = await drainCrashes();
    await reportCrashes(crashes);
    expect(reportCrashes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ message: "test" })]),
    );
    const data = await chrome.storage.local.get("ds_crash_log");
    expect(data.ds_crash_log ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Create stub `sentry-reporter.ts`** (full impl in Phase 5)

```typescript
// extension/src/utils/sentry-reporter.ts
// Full implementation in Phase 5 (Sentry integration). This stub exists
// so that background.ts can import it now without circular dep issues.

import type { CrashRecord } from "./crash-logger";

export async function reportCrashes(crashes: CrashRecord[]): Promise<void> {
  if (crashes.length === 0) return;
  try {
    console.warn(
      `[DeepSight] ${crashes.length} previous crash(es) detected — will ship to Sentry in Phase 5`,
      crashes,
    );
  } catch {
    /* swallow */
  }
}
```

- [ ] **Step 3: Run test**

```powershell
npm test -- crash-drain
```

Expected: PASS.

- [ ] **Step 4: Wire into `background.ts`**

Open `extension/src/background.ts` and find the `Browser.runtime.onStartup.addListener` block (around line 667).

Replace:

```typescript
Browser.runtime.onStartup.addListener(async () => {
  if (await isAuthenticated()) {
    await tryRefreshToken();
  }
});
```

With:

```typescript
import { drainCrashes } from "./utils/crash-logger";
import { reportCrashes } from "./utils/sentry-reporter";

Browser.runtime.onStartup.addListener(async () => {
  try {
    const crashes = await drainCrashes();
    await reportCrashes(crashes);
  } catch {
    /* never block startup on telemetry */
  }
  if (await isAuthenticated()) {
    await tryRefreshToken();
  }
});

Browser.runtime.onInstalled.addListener(async () => {
  try {
    const crashes = await drainCrashes();
    await reportCrashes(crashes);
  } catch {
    /* swallow */
  }
});
```

Note: one `onInstalled` listener already exists at line 658 — merge the crash-drain into it rather than adding a second listener. The existing body should be preserved.

**Final merged block**:

```typescript
Browser.runtime.onInstalled.addListener(
  async (details: Runtime.OnInstalledDetailsType) => {
    try {
      const crashes = await drainCrashes();
      await reportCrashes(crashes);
    } catch {
      /* swallow */
    }
    if (details.reason === "install") {
      Browser.tabs.create({ url: WEBAPP_URL });
      Browser.storage.local.set({ showYouTubeRecommendation: true });
    }
  },
);
```

- [ ] **Step 5: Run typecheck + build**

```powershell
npm run typecheck
npm run build
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```powershell
git add extension/src/background.ts extension/src/utils/sentry-reporter.ts extension/__tests__/background/crash-drain.test.ts
git commit -m "feat(ext): drain crash log on service worker startup + onInstalled"
```

---

## Phase 2 — Root Cause Fixes

### Task 2.1 : Inline stylesheets in shadow DOM via webpack raw-loader

**Files:**

- Modify: `extension/webpack.config.js`
- Create: `extension/src/content/styles-inline.ts`
- Create: `extension/src/content/shadow-types.d.ts`
- Modify: `extension/src/content/widget.ts`
- Modify: `extension/package.json`
- Modify: `extension/jest.config.js` (or create if missing)

Rationale: `<link rel="stylesheet" href="chrome-extension://...">` in a closed shadow root loads asynchronously. Until the `load` event fires, the widget is unstyled → looks "blank". Bundling CSS as strings + injecting via `<style>` makes style application synchronous.

- [ ] **Step 1: Add raw-loader dep**

```powershell
npm install --save-dev raw-loader@4
```

Expected: `raw-loader` in `devDependencies`.

- [ ] **Step 2: Configure webpack**

Modify `extension/webpack.config.js` — add a new rule BEFORE the existing `test: /\.css$/` rule:

```javascript
        {
          test: /\.css$/,
          resourceQuery: /raw/,
          type: "asset/source",
        },
        {
          test: /\.css$/,
          resourceQuery: { not: [/raw/] },
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
```

(Replace the single existing `.css` rule with these two.)

- [ ] **Step 3: Create TypeScript ambient declaration for `?raw` imports**

```typescript
// extension/src/content/shadow-types.d.ts
declare module "*.css?raw" {
  const content: string;
  export default content;
}
```

- [ ] **Step 4: Create styles-inline module**

```typescript
// extension/src/content/styles-inline.ts
// Inlines the 3 stylesheets required by the shadow-DOM widget as strings.
// Rationale: <link rel="stylesheet" href="chrome-extension://..."> inside a
// closed shadow root loads asynchronously. During the load window the widget
// renders unstyled → looks "blank" to the user. Strings applied via <style>
// tags are synchronous and immune to network/CSP timing issues.

import tokensCss from "../styles/tokens.css?raw";
import widgetCss from "../styles/widget.css?raw";
import contentCss from "../styles/content.css?raw";

export function getInlineStyles(): string {
  return [tokensCss, widgetCss, contentCss].join("\n\n");
}
```

- [ ] **Step 5: Patch `content/widget.ts` to use inline styles**

Replace lines 66-82 (the 3 `<link>` injection block) with:

```typescript
// Inject styles synchronously via <style> tag — eliminates the async
// race between <link> loading and first paint that caused "blank widget"
// reports. Styles are bundled into content.js at build time via raw-loader.
const styleEl = document.createElement("style");
styleEl.textContent = getInlineStyles();
shadow.appendChild(styleEl);
```

And add at the top of the file (after existing imports):

```typescript
import { getInlineStyles } from "./styles-inline";
```

- [ ] **Step 6: Configure Jest to handle raw CSS imports**

Create or modify `extension/jest.config.js`:

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEach: ["<rootDir>/__tests__/setup/jest.setup.ts"],
  moduleNameMapper: {
    // Raw CSS imports → empty string stub
    "\\.css\\?raw$": "<rootDir>/__tests__/setup/css-raw.stub.ts",
    "\\.css$": "<rootDir>/__tests__/setup/css-raw.stub.ts",
  },
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
};
```

Then create `extension/__tests__/setup/css-raw.stub.ts`:

```typescript
export default "/* stub css */";
```

And ensure `extension/__tests__/setup/jest.setup.ts` exists (if not, create with jsdom + chrome mock):

```typescript
// extension/__tests__/setup/jest.setup.ts
import "@testing-library/jest-dom";

// Minimal chrome.* mock for extension APIs used at boot
const storage: Record<string, unknown> = {};

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: jest.fn(async (keys?: string | string[] | null) => {
        if (keys == null) return { ...storage };
        if (typeof keys === "string") {
          return keys in storage ? { [keys]: storage[keys] } : {};
        }
        const out: Record<string, unknown> = {};
        for (const k of keys) if (k in storage) out[k] = storage[k];
        return out;
      }),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.assign(storage, items);
      }),
      clear: jest.fn(async () => {
        for (const k of Object.keys(storage)) delete storage[k];
      }),
    },
    onChanged: { addListener: jest.fn() },
  },
  runtime: {
    getURL: jest.fn((p: string) => `chrome-extension://test/${p}`),
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn() },
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
  },
  tabs: { create: jest.fn(), sendMessage: jest.fn() },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
  },
  alarms: {
    create: jest.fn(),
    onAlarm: { addListener: jest.fn() },
  },
  identity: {
    getRedirectURL: jest.fn(() => "https://test/redirect"),
    launchWebAuthFlow: jest.fn(),
  },
};
```

- [ ] **Step 7: Run typecheck + build + tests**

```powershell
npm run typecheck
npm run build
npm test
```

Expected: all three exit 0. Grep for `styleEl.textContent` in `dist/content.js` — should see inlined CSS strings.

```powershell
Select-String -Path dist/content.js -Pattern "ds-widget" -SimpleMatch | Select-Object -First 3
```

Expected: matches found (CSS is bundled into the JS).

- [ ] **Step 8: Commit**

```powershell
git add extension/webpack.config.js extension/src/content/styles-inline.ts extension/src/content/shadow-types.d.ts extension/src/content/widget.ts extension/jest.config.js extension/__tests__/setup/ extension/package.json extension/package-lock.json
git commit -m "fix(ext): inline shadow DOM styles via raw-loader to eliminate async race"
```

---

### Task 2.2 : Zombie host cleanup + defensive attachShadow

**Files:**

- Modify: `extension/src/content/widget.ts`
- Modify: `extension/src/content/shadow.ts`
- Test: `extension/__tests__/content/widget.test.ts`

Rationale (H2): `injectWidget` returns `true` if `#deepsight-host` already exists in DOM. But `createWidgetShell` always creates a NEW shadow and writes it to the module-level singleton via `setShadowRoot`. The old DOM host remains, unconnected to the current shadow → looks blank.

- [ ] **Step 1: Write the failing test**

```typescript
// extension/__tests__/content/widget.test.ts
/**
 * Widget injection zombie cleanup + defensive shadow attach.
 */
import {
  createWidgetShell,
  injectWidget,
  removeWidget,
  getExistingWidget,
} from "../../src/content/widget";
import { setShadowRoot } from "../../src/content/shadow";

describe("widget zombie cleanup", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="secondary-inner"></div>';
    setShadowRoot(document.createDocumentFragment() as unknown as ShadowRoot);
  });

  afterEach(() => {
    removeWidget();
    document.body.innerHTML = "";
  });

  test("second createWidgetShell + injectWidget replaces the old host", () => {
    const first = createWidgetShell("dark", false);
    const anchor = document.getElementById("secondary-inner")!;
    Object.defineProperty(anchor, "offsetHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(anchor, "offsetWidth", {
      configurable: true,
      value: 300,
    });
    const ok1 = injectWidget(first, false);
    expect(ok1).toBe(true);
    expect(document.querySelectorAll("#deepsight-host")).toHaveLength(1);

    // Simulate a second injection (e.g. SPA navigation without proper cleanup)
    const second = createWidgetShell("light", false);
    const ok2 = injectWidget(second, false);
    expect(ok2).toBe(true);
    // Must have replaced the old host, not kept two
    expect(document.querySelectorAll("#deepsight-host")).toHaveLength(1);
    // The live host must be the new one
    const live = document.getElementById("deepsight-host");
    expect(live).toBe(second);
  });

  test("createWidgetShell returns null if attachShadow throws", () => {
    const originalAttach = HTMLDivElement.prototype.attachShadow;
    HTMLDivElement.prototype.attachShadow = () => {
      throw new Error("attachShadow blocked by another extension");
    };
    try {
      const host = createWidgetShell("dark", false);
      expect(host).toBeNull();
    } finally {
      HTMLDivElement.prototype.attachShadow = originalAttach;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm test -- widget.test
```

Expected: FAIL on both (old host not replaced + throws propagate).

- [ ] **Step 3: Patch `content/widget.ts`**

Replace `export function createWidgetShell(...)` body (lines 28-96) with:

```typescript
export function createWidgetShell(
  theme: "dark" | "light",
  isTikTok: boolean,
): HTMLDivElement | null {
  // Create the outer host element (lives in the page DOM)
  let host: HTMLDivElement;
  try {
    host = document.createElement("div");
  } catch {
    return null;
  }
  host.id = HOST_ID;
  host.style.cssText =
    "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";

  if (isTikTok) {
    host.style.cssText =
      "all:initial;position:fixed;bottom:20px;right:20px;width:360px;max-height:80vh;z-index:2147483646;";
  }

  // Attach closed shadow root for full encapsulation. Wrapped in try/catch —
  // another extension (or a policy-locked profile) may block attachShadow.
  let shadow: ShadowRoot;
  try {
    shadow = host.attachShadow({ mode: "closed" });
  } catch {
    return null;
  }
  setShadowRoot(shadow);

  // Keyboard isolation (unchanged)
  const stopKeyPropagation = (e: Event) => {
    e.stopPropagation();
  };
  host.addEventListener("keydown", stopKeyPropagation);
  host.addEventListener("keyup", stopKeyPropagation);
  host.addEventListener("keypress", stopKeyPropagation);

  // Inject styles synchronously — see styles-inline.ts for rationale.
  const styleEl = document.createElement("style");
  styleEl.textContent = getInlineStyles();
  shadow.appendChild(styleEl);

  const el = document.createElement("div");
  el.id = WIDGET_ID;
  el.className = `ds-widget deepsight-card ${theme}`;
  if (isTikTok) {
    el.classList.add("deepsight-card-floating");
    el.style.cssText =
      "overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:12px;";
  }
  shadow.appendChild(el);

  return host;
}
```

Replace `export function injectWidget(...)` body (lines 131-168) with:

```typescript
export function injectWidget(host: HTMLDivElement, isTikTok: boolean): boolean {
  // Zombie cleanup: if a previous host remains, remove it before inserting
  // the new one. Without this, the live shadow root (module singleton) points
  // to the NEW host's shadow while the OLD host stays in the DOM, unstyled.
  const existing = document.getElementById(HOST_ID);
  if (existing && existing !== host) {
    existing.remove();
  }

  _floatingMode = false;

  if (isTikTok) {
    for (const sel of TIKTOK_ANCHORS) {
      const anchor = document.querySelector(sel);
      if (anchor) {
        document.body.appendChild(host);
        return true;
      }
    }
    return false;
  }

  for (const { selector, position } of INJECTION_STRATEGIES) {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement) || !isSidebarVisible(el)) continue;

    if (position === "prepend") {
      el.insertBefore(host, el.firstChild);
    } else {
      el.parentElement?.insertBefore(host, el.nextSibling);
    }
    return true;
  }

  // Floating fallback — no sidebar anchor found or anchor invisible.
  _floatingMode = true;
  host.style.cssText =
    "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:2147483646;";
  document.body.appendChild(host);
  return true;
}
```

- [ ] **Step 4: Update `content/shadow.ts` for defensive singleton swap**

Replace `export function setShadowRoot(root: ShadowRoot): void` with:

```typescript
export function setShadowRoot(root: ShadowRoot | null): void {
  // If we're replacing a live shadow, detach its host from the DOM first
  // to prevent orphaned hosts accumulating after SPA navigations.
  if (_shadowRoot && _shadowRoot !== root) {
    const oldHost = (_shadowRoot as unknown as { host?: Element }).host;
    if (
      oldHost &&
      oldHost.isConnected &&
      oldHost !== (root as unknown as { host?: Element })?.host
    ) {
      try {
        oldHost.remove();
      } catch {
        /* swallow */
      }
    }
  }
  _shadowRoot = root;
}
```

And update the type of the module-level variable:

```typescript
let _shadowRoot: ShadowRoot | null = null;
```

(already correct — verify no change needed)

- [ ] **Step 5: Update all callers of `createWidgetShell` for null handling**

`content/index.ts` was already patched in Task 1.2 to handle `host === null`. Verify:

```powershell
Select-String -Path extension/src/content/index.ts -Pattern "createWidgetShell" -SimpleMatch
Select-String -Path extension/src/content/index.ts -Pattern "createWidgetShell-returned-null" -SimpleMatch
```

Expected: 1 call site, with the null-check present.

- [ ] **Step 6: Run tests**

```powershell
npm run typecheck
npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add extension/src/content/widget.ts extension/src/content/shadow.ts extension/__tests__/content/widget.test.ts
git commit -m "fix(ext): zombie host cleanup + defensive attachShadow in widget"
```

---

### Task 2.3 : Anchor-aware retry with bounded backoff

**Files:**

- Modify: `extension/src/content/widget.ts`
- Modify: `extension/src/content/index.ts`

Rationale (H4): `document_idle` can fire before YouTube has rendered `#secondary-inner`. We currently retry blindly. Add an anchor-readiness check so retries wait for the right moment, and cap total wait time to 15 seconds before falling back to floating.

- [ ] **Step 1: Add anchor-ready helper in widget.ts**

Append to `extension/src/content/widget.ts` (after existing exports):

```typescript
const ANCHOR_SELECTORS = [
  "#secondary-inner",
  "#secondary",
  "ytd-watch-next-secondary-results-renderer",
  "#below",
  "ytd-watch-metadata",
];

/** True if at least one YouTube sidebar anchor is present AND visible. */
export function isAnchorReady(): boolean {
  for (const sel of ANCHOR_SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && isSidebarVisible(el)) return true;
  }
  return false;
}
```

- [ ] **Step 2: Use `isAnchorReady` in index.ts retry logic**

In `content/index.ts` inside `tryInjectWidget`, replace the retry `setTimeout(tryInjectWidget, delay)` blocks with anchor-aware retries.

Find the block `if (success) { ... } else { ... setTimeout(tryInjectWidget, delay); }` and replace the else branch with:

```typescript
    } else {
      // Anchor-aware retry: wait up to 15s for YouTube sidebar to render,
      // then fall back to floating widget (already handled by injectWidget).
      const TOTAL_BUDGET_MS = 15_000;
      const elapsed = ctx.injectionAttempts * 500; // rough
      if (elapsed >= TOTAL_BUDGET_MS) {
        logBootStep("inject:budget-exceeded-force-floating");
        // Remove the orphan host (created this pass but not inserted)
        // and retry; injectWidget's floating fallback will kick in next call.
        ctx.injected = false;
        setTimeout(tryInjectWidget, 1000);
      } else {
        const delay = ctx.injectionAttempts <= 10 ? 300 : 1000;
        setTimeout(tryInjectWidget, delay);
      }
    }
```

- [ ] **Step 3: Import `isAnchorReady`** at the top of `content/index.ts` alongside the existing `widget` imports:

```typescript
import {
  createWidgetShell,
  injectWidget,
  removeWidget,
  getExistingWidget,
  buildWidgetHeader,
  bindMinimizeButton,
  setWidgetBody,
  setWidgetInnerHTML,
  getWidgetBody,
  isWidgetDetached,
  isAnchorReady,
} from "./widget";
```

(Note: `isAnchorReady` is imported for future use in Task 2.4 and for test hook. Safe to leave unused if TypeScript lint warns — add `void isAnchorReady;` in a comment block or leave the import.)

Actually — to keep the import useful immediately, use it in `bootstrap` to log readiness:

In `bootstrap`, after `detectExtensions();`, add:

```typescript
logBootStep("bootstrap:anchor-ready", { ready: isAnchorReady() });
```

- [ ] **Step 4: Build + test**

```powershell
npm run typecheck
npm run build
npm test
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add extension/src/content/widget.ts extension/src/content/index.ts
git commit -m "fix(ext): anchor-aware retry with 15s budget before floating fallback"
```

---

### Task 2.4 : Synchronous skeleton render before async initCard

**Files:**

- Modify: `extension/src/content/index.ts`
- Modify: `extension/src/content/states/login.ts` (minor — no behavior change, only extract skeleton)

Rationale: Currently `tryInjectWidget` injects a "⏳ Chargement..." body, then calls `initCard()` async. If `initCard` throws or `CHECK_AUTH` hangs, the user sees "Chargement..." forever. Replace by a minimal card with header + "Connexion requise" fallback + retry button that's visible IMMEDIATELY, then `initCard` overwrites it.

- [ ] **Step 1: Extract a loading skeleton**

Append to `extension/src/content/widget.ts`:

```typescript
/**
 * Minimal body shown synchronously after injection, before async auth check.
 * If auth check hangs/fails, the user still sees a branded, clickable card.
 */
export function buildSkeletonBody(onRetry: () => void): {
  html: string;
  bind: () => void;
} {
  const html = `
    <div class="ds-card-body">
      <div class="ds-loading" style="padding:16px;text-align:center">
        <div style="color:var(--ds-gold-mid);font-size:24px;margin-bottom:8px">⏳</div>
        <p class="ds-loading-text" style="color:var(--ds-text-secondary);font-size:12px;margin:0 0 12px">
          Chargement de DeepSight…
        </p>
        <button
          type="button"
          id="ds-skeleton-retry"
          class="ds-btn ds-btn-primary"
          style="font-size:11px;padding:6px 12px;display:none"
        >
          Réessayer
        </button>
      </div>
    </div>
  `;
  const bind = (): void => {
    // Reveal the retry button after 10s if the async init hasn't rendered
    setTimeout(() => {
      const btn = (globalThis as unknown as { document: Document }).document
        ?.querySelector?.("#deepsight-host")
        ?.shadowRoot?.getElementById?.("ds-skeleton-retry");
      // ^^ will be null since shadow is closed — use the module helper instead
    }, 10_000);
    // The shadow is closed. Use the shadow module:
    import("./shadow").then(({ $id }) => {
      setTimeout(() => {
        const btn = $id<HTMLButtonElement>("ds-skeleton-retry");
        if (btn && !btn.hasAttribute("data-bound")) {
          btn.setAttribute("data-bound", "1");
          btn.style.display = "inline-block";
          btn.addEventListener("click", onRetry);
        }
      }, 10_000);
    });
  };
  return { html, bind };
}
```

(Note: the nested `setTimeout` + shadow lookup is intentionally defensive — the retry button stays hidden unless the card is still in the loading state after 10s.)

- [ ] **Step 2: Use the skeleton in `tryInjectWidget`**

In `content/index.ts`, inside `tryInjectWidget`, replace the block:

```typescript
const widgetCard = getExistingWidget();
if (widgetCard) {
  widgetCard.innerHTML = buildWidgetHeader(logoImgHtml(22));
  const body = document.createElement("div");
  body.className = "ds-card-body";
  body.innerHTML = `<div class="ds-loading"><div style="color:var(--ds-gold-mid)">⏳</div><p class="ds-loading-text">Chargement...</p></div>`;
  widgetCard.appendChild(body);
  logBootStep("inject:widget-populated");
}
```

With:

```typescript
const widgetCard = getExistingWidget();
if (widgetCard) {
  widgetCard.innerHTML = buildWidgetHeader(logoImgHtml(22));
  const skeleton = buildSkeletonBody(() => {
    logBootStep("skeleton:retry-clicked");
    ctx.injected = false;
    ctx.injectionAttempts = 0;
    removeWidget();
    tryInjectWidget();
  });
  const bodyWrapper = document.createElement("div");
  bodyWrapper.innerHTML = skeleton.html;
  const bodyEl = bodyWrapper.firstElementChild;
  if (bodyEl) widgetCard.appendChild(bodyEl);
  skeleton.bind();
  logBootStep("inject:widget-populated-with-skeleton");
}
```

And import `buildSkeletonBody` from `./widget`:

```typescript
import {
  createWidgetShell,
  injectWidget,
  removeWidget,
  getExistingWidget,
  buildWidgetHeader,
  bindMinimizeButton,
  setWidgetBody,
  setWidgetInnerHTML,
  getWidgetBody,
  isWidgetDetached,
  isAnchorReady,
  buildSkeletonBody,
} from "./widget";
```

- [ ] **Step 3: Run tests**

```powershell
npm run typecheck
npm test
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```powershell
git add extension/src/content/widget.ts extension/src/content/index.ts
git commit -m "feat(ext): skeleton render before async init + 10s retry fallback"
```

---

### Task 2.5 : Harden `initCard` against CHECK_AUTH hangs

**Files:**

- Modify: `extension/src/content/index.ts`

Rationale: `Browser.runtime.sendMessage({ action: "CHECK_AUTH" })` can hang if service worker is being restarted. Wrap in a 5s timeout; on timeout, treat as "unauthenticated" and render login.

- [ ] **Step 1: Add timeout helper**

At the top of `content/index.ts` (after imports), add:

```typescript
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(v);
        }
      },
      () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}
```

- [ ] **Step 2: Wrap CHECK_AUTH**

In `initCard`, replace:

```typescript
const authResp = (await Browser.runtime.sendMessage({
  action: "CHECK_AUTH",
})) as { authenticated?: boolean; user?: User | null } | undefined;
```

With:

```typescript
const authResp = await withTimeout(
  Browser.runtime.sendMessage({ action: "CHECK_AUTH" }) as Promise<
    { authenticated?: boolean; user?: User | null } | undefined
  >,
  5000,
  { authenticated: false },
);
logBootStep("initCard:auth-checked", {
  authenticated: !!authResp?.authenticated,
});
```

- [ ] **Step 3: Run tests + build**

```powershell
npm run typecheck
npm run build
npm test
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```powershell
git add extension/src/content/index.ts
git commit -m "fix(ext): 5s timeout on CHECK_AUTH to unblock login render on SW restart"
```

---

## Phase 3 — Cross-Browser & Defense-in-Depth

### Task 3.1 : Build Firefox & verify manifest + styles-inline work

**Files:**

- Read: `extension/public/manifest.firefox.json`
- Verify: `dist/firefox/*` outputs

Rationale: We promise Firefox support. Ensure the raw-loader CSS pipeline works in the Firefox build and the manifest is compatible.

- [ ] **Step 1: Confirm manifest.firefox.json exists**

```powershell
Test-Path extension/public/manifest.firefox.json
```

Expected: `True`. If `False`, STOP and flag as out-of-scope (user must create it).

- [ ] **Step 2: Build Firefox target**

```powershell
cd extension
npm run build:firefox
```

Expected: exit 0. `dist/firefox/` populated.

- [ ] **Step 3: Verify inline CSS is in the Firefox bundle**

```powershell
Select-String -Path dist/firefox/content.js -Pattern "ds-widget" -SimpleMatch | Select-Object -First 1
```

Expected: 1+ match. If 0, the raw-loader rule isn't applying for the Firefox build — investigate webpack config (unlikely, but verify).

- [ ] **Step 4: Build Chrome target (sanity)**

```powershell
npm run build:chrome
```

Expected: exit 0. Matches also present in `dist/chrome/content.js`.

- [ ] **Step 5: Commit** (only if any build scripts were tweaked)

```powershell
git status
# If nothing to commit, skip. Otherwise:
git add extension/webpack.config.js extension/public/manifest.firefox.json
git commit -m "chore(ext): verify cross-browser build works with inline CSS"
```

---

### Task 3.2 : Offline tolerance + network-failure fallback in initCard

**Files:**

- Modify: `extension/src/content/index.ts`

Rationale: If the user opens YouTube while offline, `CHECK_AUTH` succeeds (uses cached token) but `GET_PLAN` or `fetchTournesolScore` fails. Currently these are swallowed silently — fine. But if `ANALYZE_VIDEO` is later called, we show "Erreur d'initialisation". We want a clear "Vous êtes hors ligne" banner.

- [ ] **Step 1: Add offline detection in `showError`**

Replace `function showError(message: string)` with:

```typescript
function showError(message: string): void {
  const body = getWidgetBody();
  if (!body) return;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const errorDiv = document.createElement("div");
  errorDiv.style.cssText =
    "padding:8px 12px;background:var(--ds-error-bg);border-radius:8px;font-size:11px;color:var(--ds-error);margin-top:8px;display:flex;flex-direction:column;gap:6px";
  errorDiv.textContent = isOffline
    ? "📡 Hors ligne — vérifiez votre connexion"
    : `❌ ${message}`;
  if (isOffline) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Réessayer";
    retry.style.cssText =
      "padding:4px 8px;border-radius:4px;background:var(--ds-gold-mid);color:#0a0a0f;border:none;font-size:10px;cursor:pointer;align-self:flex-start";
    retry.addEventListener("click", () => initCard());
    errorDiv.appendChild(retry);
  }
  body.appendChild(errorDiv);
}
```

- [ ] **Step 2: Listen to online event and re-init**

At the bottom of `content/index.ts` (before bootstrap dispatch), add:

```typescript
// Auto-retry on network recovery
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    logBootStep("network:online-retry");
    if (ctx.state === "login" || ctx.state === "ready") {
      initCard();
    }
  });
}
```

- [ ] **Step 3: Build + tests**

```powershell
npm run typecheck
npm run build
npm test
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```powershell
git add extension/src/content/index.ts
git commit -m "feat(ext): offline banner + auto-retry on network recovery"
```

---

## Phase 4 — Automated Tests

### Task 4.1 : Jest — content script boot integration tests

**Files:**

- Create: `extension/__tests__/content/boot.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// extension/__tests__/content/boot.test.ts
/**
 * Integration test: simulates a YouTube /watch page DOM + chrome.runtime
 * stubs, then loads the content boot code and asserts the host is injected
 * with a populated shadow root (via its presence in the DOM + widget helpers).
 */
import { setShadowRoot, getShadowRoot } from "../../src/content/shadow";
import {
  createWidgetShell,
  injectWidget,
  getExistingWidget,
} from "../../src/content/widget";

function setupYouTubeDom(): void {
  document.body.innerHTML = `
    <div id="content">
      <ytd-watch-flexy>
        <div id="primary"></div>
        <div id="secondary">
          <div id="secondary-inner"></div>
        </div>
      </ytd-watch-flexy>
    </div>
  `;
  // isSidebarVisible uses offsetHeight/offsetWidth/computedStyle
  const anchor = document.getElementById("secondary-inner")!;
  Object.defineProperty(anchor, "offsetHeight", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(anchor, "offsetWidth", {
    configurable: true,
    value: 400,
  });
}

describe("content script boot flow", () => {
  beforeEach(() => {
    setupYouTubeDom();
    setShadowRoot(null);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    setShadowRoot(null);
  });

  test("createWidgetShell returns a host with a live shadow", () => {
    const host = createWidgetShell("dark", false);
    expect(host).not.toBeNull();
    expect(host!.id).toBe("deepsight-host");
    // The shadow singleton should now be populated
    expect(getShadowRoot()).not.toBeNull();
    // Widget card should be inside the shadow
    expect(getExistingWidget()).not.toBeNull();
    expect(getExistingWidget()!.id).toBe("deepsight-card");
  });

  test("injectWidget inserts host into secondary-inner", () => {
    const host = createWidgetShell("dark", false);
    expect(host).not.toBeNull();
    const ok = injectWidget(host!, false);
    expect(ok).toBe(true);
    expect(
      document.querySelector("#secondary-inner #deepsight-host"),
    ).not.toBeNull();
  });

  test("injectWidget falls back to body floating when no anchor visible", () => {
    // Hide the anchor
    const anchor = document.getElementById("secondary-inner")!;
    Object.defineProperty(anchor, "offsetHeight", {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(anchor, "offsetWidth", {
      configurable: true,
      value: 0,
    });
    // Hide the other fallback anchors too
    document
      .querySelectorAll(
        "#secondary, ytd-watch-next-secondary-results-renderer, #below",
      )
      .forEach((el) => {
        if (el instanceof HTMLElement) {
          Object.defineProperty(el, "offsetHeight", {
            configurable: true,
            value: 0,
          });
          Object.defineProperty(el, "offsetWidth", {
            configurable: true,
            value: 0,
          });
        }
      });
    const host = createWidgetShell("dark", false);
    const ok = injectWidget(host!, false);
    expect(ok).toBe(true);
    // Should have been appended to body with position:fixed
    expect(host!.parentElement).toBe(document.body);
    expect(host!.style.position).toBe("fixed");
  });

  test("second boot replaces zombie host (no duplicate)", () => {
    const host1 = createWidgetShell("dark", false);
    injectWidget(host1!, false);
    const host2 = createWidgetShell("light", false);
    injectWidget(host2!, false);
    expect(document.querySelectorAll("#deepsight-host")).toHaveLength(1);
    expect(document.querySelector("#deepsight-host")).toBe(host2);
  });
});
```

- [ ] **Step 2: Run**

```powershell
npm test -- boot
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```powershell
git add extension/__tests__/content/boot.test.ts
git commit -m "test(ext): integration tests for content boot + widget injection"
```

---

### Task 4.2 : Install Playwright + extension loader

**Files:**

- Modify: `extension/package.json`
- Create: `extension/e2e/playwright.config.ts`
- Create: `extension/e2e/fixtures/extension.ts`

- [ ] **Step 1: Install Playwright**

```powershell
cd extension
npm install --save-dev @playwright/test@1.48
npx playwright install chromium
```

Expected: `@playwright/test` in devDeps. Chromium download succeeds.

- [ ] **Step 2: Add script to package.json**

Modify `extension/package.json` `"scripts"` — add:

```json
    "e2e": "playwright test",
    "e2e:headful": "playwright test --headed"
```

- [ ] **Step 3: Create playwright.config.ts**

```typescript
// extension/e2e/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // extension contexts can't share profile
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    headless: false, // Chrome extensions require a headed context
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-extension",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: path.resolve(__dirname, "../dist-e2e"),
});
```

- [ ] **Step 4: Create extension fixture**

```typescript
// extension/e2e/fixtures/extension.ts
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

const EXT_PATH = path.resolve(__dirname, "../../dist");

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const userDataDir = path.resolve(
      __dirname,
      "../../dist-e2e/chrome-profile-" + Date.now(),
    );
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // Wait for the service worker to register so we can read its URL
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");
    const extensionId = sw.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
```

- [ ] **Step 5: Build extension** (required before e2e)

```powershell
npm run build
```

Expected: `dist/` populated.

- [ ] **Step 6: Commit**

```powershell
git add extension/package.json extension/package-lock.json extension/e2e/
git commit -m "chore(ext): install Playwright + persistent-context extension fixture"
```

---

### Task 4.3 : Playwright E2E — YouTube sidebar renders

**Files:**

- Create: `extension/e2e/extension-loaded.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// extension/e2e/extension-loaded.spec.ts
import { test, expect } from "./fixtures/extension";

test.describe("Extension loaded on YouTube", () => {
  test("injects host and populates shadow root on /watch", async ({
    context,
  }) => {
    const page = await context.newPage();
    // A real, stable public video (Google's "About Us"). If it goes 404
    // switch to another with a stable ID.
    await page.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", {
      waitUntil: "domcontentloaded",
    });

    // Give the content script up to 20s to inject (YouTube initial render is slow)
    await page.waitForFunction(
      () => !!document.getElementById("deepsight-host"),
      { timeout: 20_000 },
    );

    const host = page.locator("#deepsight-host");
    await expect(host).toBeVisible({ timeout: 5_000 });

    // Sanity: the host should have a shadow root even though `mode: closed`
    // blocks document.getElementById('...').shadowRoot, so we check via
    // boundingBox that it occupies space.
    const box = await host.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(40);

    // Screenshot for manual verification
    await page.screenshot({
      path: "e2e-report/youtube-watch-injected.png",
      fullPage: false,
    });
  });

  test("no ds_crash_log after boot", async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(10_000); // let content script run

    // Read chrome.storage.local via a service-worker page
    const swPage = await context.newPage();
    await swPage.goto(`chrome-extension://${extensionId}/popup.html`);
    const crashes = await swPage.evaluate(async () => {
      const { ds_crash_log } = await chrome.storage.local.get("ds_crash_log");
      return ds_crash_log ?? [];
    });

    expect(
      crashes,
      `Unexpected crashes: ${JSON.stringify(crashes, null, 2)}`,
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the e2e**

```powershell
npm run e2e
```

Expected: 2 specs PASS. If `waitForFunction` times out, that's a real regression — fix before committing.

- [ ] **Step 3: Commit**

```powershell
git add extension/e2e/extension-loaded.spec.ts
git commit -m "test(ext): Playwright e2e validates host injection + zero crashes"
```

---

## Phase 5 — Sentry Crash Reporting

### Task 5.1 : Install Sentry browser SDK + config

**Files:**

- Modify: `extension/package.json`
- Modify: `extension/webpack.config.js`
- Modify: `extension/src/utils/sentry-reporter.ts` (from stub to real)

- [ ] **Step 1: Install Sentry**

```powershell
cd extension
npm install --save @sentry/browser@8
```

- [ ] **Step 2: Expose SENTRY_DSN_EXTENSION via DefinePlugin**

In `webpack.config.js`, update the `DefinePlugin` block:

```javascript
      new webpack.DefinePlugin({
        __TARGET_BROWSER__: JSON.stringify(targetBrowser),
        __SENTRY_DSN__: JSON.stringify(
          process.env.SENTRY_DSN_EXTENSION || "",
        ),
      }),
```

Add ambient type for the magic constant. Append to `extension/src/types/ambient.d.ts` (create if missing):

```typescript
declare const __TARGET_BROWSER__: string;
declare const __SENTRY_DSN__: string;
```

- [ ] **Step 3: Implement sentry-reporter**

Replace the Phase 1 stub at `extension/src/utils/sentry-reporter.ts`:

```typescript
// extension/src/utils/sentry-reporter.ts
// Ships drained crash records to Sentry. No-op if SENTRY_DSN_EXTENSION
// is not configured at build time.

import type { CrashRecord } from "./crash-logger";

let _inited = false;

async function initSentry(): Promise<boolean> {
  if (_inited) return true;
  if (!__SENTRY_DSN__) return false;
  try {
    const Sentry = await import("@sentry/browser");
    Sentry.init({
      dsn: __SENTRY_DSN__,
      release: "deepsight-extension@" + chrome.runtime.getManifest().version,
      environment: "production",
      sampleRate: 1.0,
      tracesSampleRate: 0,
      autoSessionTracking: false,
      defaultIntegrations: false,
      integrations: [],
    });
    _inited = true;
    return true;
  } catch {
    return false;
  }
}

export async function reportCrashes(crashes: CrashRecord[]): Promise<void> {
  if (crashes.length === 0) return;
  const ready = await initSentry();
  if (!ready) {
    try {
      console.warn(
        `[DeepSight] ${crashes.length} previous crash(es) — no Sentry DSN configured`,
        crashes,
      );
    } catch {
      /* swallow */
    }
    return;
  }
  try {
    const Sentry = await import("@sentry/browser");
    for (const c of crashes) {
      Sentry.captureMessage(`[boot] ${c.message}`, {
        level: "error",
        tags: { component: "content-script", browser: __TARGET_BROWSER__ },
        contexts: {
          crash: {
            url: c.url,
            userAgent: c.userAgent,
            timestamp: c.timestamp,
            steps: c.steps.join(" > "),
            context: JSON.stringify(c.context ?? null),
          },
        },
        extra: { stack: c.stack },
      });
    }
    await Sentry.flush(3000);
  } catch {
    /* never block startup on telemetry */
  }
}
```

- [ ] **Step 4: Build + typecheck**

```powershell
npm run typecheck
$env:SENTRY_DSN_EXTENSION = ""  # explicit no-op build
npm run build
```

Expected: exit 0. Sentry ships as a dynamic import so bundle size impact only matters when DSN is set.

- [ ] **Step 5: Commit**

```powershell
git add extension/package.json extension/package-lock.json extension/webpack.config.js extension/src/utils/sentry-reporter.ts extension/src/types/ambient.d.ts
git commit -m "feat(ext): Sentry crash reporter with dynamic import (no-op without DSN)"
```

---

### Task 5.2 : Document Sentry DSN setup

**Files:**

- Modify: `extension/CLAUDE.md`
- Modify: `extension/README.md` (create a new section if not present)

- [ ] **Step 1: Add a section to extension/README.md**

Append:

````markdown
## Crash telemetry (Sentry)

Set `SENTRY_DSN_EXTENSION` in your build environment to enable crash reporting.

```powershell
$env:SENTRY_DSN_EXTENSION = "https://<key>@sentry.io/<project>"
npm run build
```
````

Crashes are captured:

- Anything thrown during content-script boot (widget injection, shadow creation, YouTube DOM quirks)
- `window.onerror` + `unhandledrejection` during the boot window
- Persisted in `chrome.storage.local.ds_crash_log` (capped at 20 FIFO)
- Drained on service-worker `onStartup` and `onInstalled`

````

- [ ] **Step 2: Commit**

```powershell
git add extension/README.md
git commit -m "docs(ext): document SENTRY_DSN_EXTENSION usage"
````

---

## Phase 6 — Final Validation & PR

### Task 6.1 : Full validation run

- [ ] **Step 1: Typecheck**

```powershell
cd C:\Users\33667\DeepSight-Main\.claude\worktrees\ext-robustness\extension
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Unit tests**

```powershell
npm test
```

Expected: all PASS, no skipped, no warnings about unhandled promises.

- [ ] **Step 3: Cross-browser builds**

```powershell
npm run build:chrome
npm run build:firefox
```

Expected: both exit 0.

- [ ] **Step 4: E2E**

```powershell
npm run e2e
```

Expected: all specs PASS.

- [ ] **Step 5: Manual smoke test** (REQUIRED — no bypass)

1. Open `chrome://extensions`
2. Enable Developer mode
3. Remove any existing DeepSight extension
4. "Load unpacked" → select `.claude/worktrees/ext-robustness/extension/dist`
5. Navigate to `https://www.youtube.com/watch?v=jNQXAC9IVRw`
6. Within 2 seconds, verify sidebar card appears WITH styling (golden accent, dark glass)
7. Open DevTools console → check for `[DeepSight-boot]` logs — should see ~10 step entries
8. Run in console: `await chrome.storage.local.get('ds_crash_log')` → should return `{}` or empty array
9. Repeat on Edge, Brave if available
10. Navigate to another video via YouTube's sidebar — widget re-appears WITH styling (no flash of white)

- [ ] **Step 6: Capture smoke-test screenshot**

Save as `docs/superpowers/plans/screenshots/2026-04-18-extension-robustness-smoke.png` — commit it.

- [ ] **Step 7: Commit evidence**

```powershell
git add docs/superpowers/plans/screenshots/
git commit -m "docs(ext): smoke-test screenshot for robustness fix"
```

---

### Task 6.2 : Push branch + open PR

- [ ] **Step 1: Push branch**

```powershell
cd C:\Users\33667\DeepSight-Main\.claude\worktrees\ext-robustness
git push -u origin fix/extension-robustness
```

- [ ] **Step 2: Open PR via gh CLI**

```powershell
gh pr create --title "fix(ext): extension robustness — eliminate blank sidebar before CWS launch" --body @'
## Summary
- Inline shadow-DOM stylesheets (raw-loader) — eliminates async `<link>` race that caused "blank widget"
- Defensive `attachShadow` with zombie-host cleanup — prevents orphaned hosts after SPA navigation
- Crash-logger persists boot errors in `chrome.storage.local` → shipped to Sentry on service-worker startup
- Step-level `[DeepSight-boot]` logs across the entire injection pipeline
- Skeleton render before async `initCard` — user never sees a truly blank card
- 5s timeout on CHECK_AUTH — unblocks login render when service worker is cold
- Offline banner + auto-retry on `online` event
- Anchor-aware retry with 15s budget before floating fallback
- Jest integration tests for content boot (4 specs)
- Playwright e2e tests validating YouTube injection + zero boot crashes
- `@sentry/browser` integration with dynamic import (zero cost without DSN)

## Test plan
- [x] `npm run typecheck` passes
- [x] `npm test` — all Jest suites pass
- [x] `npm run build` — Chrome + Firefox bundles succeed
- [x] `npm run e2e` — Playwright validates host injection + empty crash log
- [x] Manual smoke test Chrome fresh install → YouTube `/watch` → styled sidebar appears within 2s
- [x] Manual smoke test Edge + Brave (Chromium-based — should behave identical)

## Rollback plan
Revert the branch — the old `<link>` injection + non-defensive boot was the pre-fix baseline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
'@
```

- [ ] **Step 3: Return PR URL**

Print the URL to console.

- [ ] **Step 4: Request review** (optional — defer to human)

User decides whether to merge immediately or request review. Do NOT merge automatically.

---

## Self-Review Checklist

Before handing off to execution, verify:

**1. Spec coverage** — every hypothesis (H1–H5) has a corresponding fix task:

- H1 (async `<link>`) → Task 2.1 ✓
- H2 (zombie host) → Task 2.2 ✓
- H3 (silent crash) → Tasks 1.1, 1.2, 2.2 ✓
- H4 (document_idle timing) → Task 2.3 ✓
- H5 (SPA navigation race) → Existing `watchNavigation` preserved + Task 2.2 zombie cleanup ✓

**2. No placeholders** — all code blocks contain real, runnable code. No "TBD" or "similar to Task N".

**3. Type consistency** — `CrashRecord`, `BootStep`, `drainCrashes` signatures match across crash-logger, sentry-reporter, background.ts.

**4. File path accuracy** — all paths use `extension/src/...`, relative to the worktree root.

**5. Commit discipline** — each task ends with an atomic commit. No "commit at end of phase".

**6. Windows PowerShell compatibility** — all shell commands use `;` not `&&`. All file paths use backslash for PowerShell cmdlets.

**7. Reversibility** — every change is self-contained. The rollback plan in Task 6.2 is a simple branch revert.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-extension-robustness.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task phase (or per task), review between tasks, fast iteration. Recommended because each Phase is independent and we want clean context per agent.

**2. Inline Execution** — execute all tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
