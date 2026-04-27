# Ambient Lighting v3 — PR4 Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter sur la Chrome Extension MV3 (entries actives : sidepanel, viewer) la couche AmbientLightLayer v3 + SunflowerLayer (mascot photoréaliste héliotrope), sortir de l'orphelinat les composants existants `extension/src/sidepanel/shared/AmbientLightLayer.tsx` et `extension/src/viewer/components/AmbientLightLayer.tsx` sur la branche `feat/voice-mobile-final`, ajouter Critical CSS via html-webpack-plugin et copy-webpack-plugin pour les sprites, coordonner avec la PR0 sidepanel-v3 pour BeamCard via Context optionnel, et garder la PR4 size-budget compliant (sidepanel/viewer < 150KB cumulés ajoutés).

**Architecture:** Chaque entry point (sidepanel, viewer) a son propre `<AmbientLightingProvider>`, son propre `<AmbientLightLayer>` (overlay rayon + halo), et son propre `<SunflowerLayer>` (mascot 76px bottom-right pour sidepanel, mascot fullscreen pour viewer). Tous consomment `useAmbientPreset()` du package `@deepsight/lighting-engine` v3 (livré par PR1). Critical CSS inline dans `sidepanel.html` et `viewer.html` via un plugin webpack maison qui consomme l'engine au build. BeamCard de PR0 lit le Context de manière optionnelle (back-compat avec ses defaults statiques) — si PR0 n'est pas mergée, le commit BeamCard wiring est isolé et revert-friendly.

**Tech Stack:** React 18 alias `preact/compat` (déjà actif dans `webpack.config.js`), TypeScript strict zéro `any`, Webpack 5 (entries `background`, `content`, `authSync`, `authSyncMain`, `sidepanel`, `viewer`), Manifest V3, Jest + jsdom + Testing Library, copy-webpack-plugin v12, html-webpack-plugin v5, size-limit (nouveau).

**Spec:** `C:\Users\33667\DeepSight-Main\docs\superpowers\specs\2026-04-26-ambient-lighting-v3-design.md` (§6.3 + §14)

---

## Pré-requis et Notes contextuelles

### Manifest V3 — pas de popup en Chrome

**IMPORTANT** : à la date du 2026-04-27, le code-base extension n'a **plus de popup actif**. La spec PR0 (`feat/extension-sidepanel-v3`) a supprimé `default_popup` du manifest Chrome au profit de `side_panel.default_path = "sidepanel.html"` (cf. spec sidepanel-v3 §4.1, et confirmé dans `extension/public/manifest.json`). Les 3 manifests (`manifest.json`, `manifest.firefox.json`, `manifest.safari.json`) ne contiennent **aucun** `default_popup`.

Conséquence pour PR4 :

- **Scope effectif** : sidepanel + viewer uniquement (2 entries pertinents)
- **Le « popup » mentionné dans la mission orchestrateur est obsolète/anticipé**. Aucun composant popup n'est créé dans cette PR.
- Une PR follow-up séparée pourra ajouter un popup minimaliste (Firefox/Safari uniquement, en complément du sidepanel Chrome) si besoin produit. Ce n'est pas le cas aujourd'hui — Firefox et Safari utilisent eux aussi le sidepanel.

### Branche source et frictions à résoudre

- **Branche actuelle** : `feat/voice-mobile-final`
- **Branche de PR4** : `feat/ambient-lighting-v3-extension` (à créer depuis `main` après merge PR1)
- **Orphelinat** : sur `feat/voice-mobile-final`, les composants `extension/src/sidepanel/shared/AmbientLightLayer.tsx` et `extension/src/viewer/components/AmbientLightLayer.tsx` existent mais **ne sont pas montés** dans `App.tsx` (sidepanel) ni `ViewerApp.tsx` (viewer). Cette PR les remplace par leur version v3 et les monte explicitement.

### Coordination cross-PR (OBLIGATOIRE à lire avant exécution)

| PR  | Statut prérequis pour PR4        | Impact si non mergée                                                                                                                                         |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR1 | DOIT être mergée avant exécution | Pas de sprites WebP committés, pas de `nightMode`/`frameIndex` dans `AmbientPreset` v3 → bloque Tasks 4, 7, 9, 12. Stop and resolve.                         |
| PR0 | Souhaitée mergée avant Task 17   | Si non mergée, Task 17 (BeamCard wiring) crée un commit isolé revert-friendly avec un stub `<BeamCard>` adaptable. Le reste de PR4 fonctionne sans BeamCard. |
| PR2 | Aucun impact (web)               | Indépendant.                                                                                                                                                 |
| PR3 | Aucun impact (mobile)            | Indépendant.                                                                                                                                                 |

### Reload Chrome (rappel CLAUDE.md)

Après chaque `npm run build` réussi dans `extension/`, l'utilisateur doit reload l'extension via `chrome://extensions` → bouton refresh sur la card DeepSight. Ce rappel est répété après chaque Task qui modifie webpack ou monte un composant racine.

### Hypothèses livrées par PR1 (à vérifier au début de la PR4)

- Package `@deepsight/lighting-engine` v3 disponible : nouveaux exports `nightMode` (`"asleep"|"glowing"|null`), `frameIndex` (0-23), `haloAccentColor?`, `isReducedMotion`, `isHighContrast`, `readingZoneIntensityCap`
- Sprites présents : `extension/public/assets/ambient/sunflower-day.webp` et `sunflower-night.webp` (commit par PR1, copiés en `dist/assets/ambient/` par copy-webpack-plugin dans cette PR)
- `extension/src/styles/tokens.css` (et viewer.css, sidepanel.css) ont leurs `--text-secondary`/`--text-muted` shift vers blanc cassé (livré par PR1)

---

## File Structure (créés / modifiés / supprimés)

### Sidepanel

| Fichier                                                       | Action     | Rôle                                                                                   |
| ------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `extension/src/sidepanel/contexts/AmbientLightingContext.tsx` | **Create** | Provider local sidepanel — `useAmbientPreset()` + Context React                        |
| `extension/src/sidepanel/hooks/useAmbientPreset.ts`           | **Create** | Wrapper du hook engine package — gère interval refresh + AbortController               |
| `extension/src/sidepanel/components/SunflowerLayer.tsx`       | **Create** | Mascot 76px bottom-right, sprite cross-fade jour/nuit                                  |
| `extension/src/sidepanel/shared/AmbientLightLayer.tsx`        | **Modify** | Réécriture v3 : consomme Context, pas de fetch direct engine                           |
| `extension/src/sidepanel/App.tsx`                             | **Modify** | Wrapper `<AmbientLightingProvider>` + monte `<AmbientLightLayer>` + `<SunflowerLayer>` |

### Viewer

| Fichier                                                    | Action     | Rôle                                                                  |
| ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `extension/src/viewer/contexts/AmbientLightingContext.tsx` | **Create** | Provider local viewer — pas partagé avec sidepanel (tab dédié séparé) |
| `extension/src/viewer/hooks/useAmbientPreset.ts`           | **Create** | Wrapper hook engine — refresh 30s (viewer reste ouvert longtemps)     |
| `extension/src/viewer/components/SunflowerLayer.tsx`       | **Create** | Mascot fullscreen viewer (96px bottom-right, légèrement plus grand)   |
| `extension/src/viewer/components/AmbientLightLayer.tsx`    | **Modify** | Réécriture v3 — consomme Context, pas de fetch direct                 |
| `extension/src/viewer/ViewerApp.tsx`                       | **Modify** | Wrapper `<AmbientLightingProvider>` + monte les 2 layers              |

### Webpack & build

| Fichier                                    | Action     | Rôle                                                                                                                                          |
| ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension/webpack.config.js`              | **Modify** | Fix doublon `sidepanel` entry, ajoute copy pattern `assets/ambient/*.webp`, HtmlWebpackPlugin pour `viewer.html`, plugin custom critical CSS  |
| `extension/scripts/critical-css-plugin.js` | **Create** | Webpack plugin maison qui lit l'engine au build et injecte `<style>` inline dans HtmlWebpackPlugin via `htmlWebpackPluginAlterAssetTags` hook |
| `extension/.size-limit.json`               | **Create** | Bundle assertion : sidepanel.js < (current + 80KB), viewer.js < (current + 70KB)                                                              |
| `extension/package.json`                   | **Modify** | Add devDeps `size-limit`, `@size-limit/preset-app`. Add scripts `size`, `size:why`.                                                           |

### Coordination PR0 (commit isolé revert-friendly)

| Fichier                                                          | Action            | Rôle                                                                                    |
| ---------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `extension/src/sidepanel/components/BeamCard.tsx`                | **Modify**        | (Si PR0 mergée) Ajoute prop `usePreset?: boolean = false` + lecture Context optionnelle |
| `extension/src/sidepanel/components/__tests__/BeamCard.test.tsx` | **Modify/Create** | Test back-compat : avec/sans Context, defaults statiques inchangés                      |

### Tests

| Fichier                                                         | Action     | Rôle                                                |
| --------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| `extension/__tests__/sidepanel/AmbientLightingContext.test.tsx` | **Create** | Test Provider mount + preset cycle                  |
| `extension/__tests__/sidepanel/useAmbientPreset.test.ts`        | **Create** | Test wrapper hook : interval, cleanup, intensityMul |
| `extension/__tests__/sidepanel/AmbientLightLayer.test.tsx`      | **Create** | Test rendu + a11y (`aria-hidden`, pointer-events)   |
| `extension/__tests__/sidepanel/SunflowerLayer.test.tsx`         | **Create** | Test sprite switch jour/nuit + cross-fade           |
| `extension/__tests__/sidepanel/App.integration.test.tsx`        | **Create** | Test que App.tsx monte bien Provider + 2 layers     |
| `extension/__tests__/viewer/AmbientLightLayer.test.tsx`         | **Create** | Idem viewer                                         |
| `extension/__tests__/viewer/SunflowerLayer.test.tsx`            | **Create** | Idem viewer                                         |
| `extension/__tests__/viewer/ViewerApp.integration.test.tsx`     | **Create** | Test que ViewerApp.tsx monte Provider + layers      |
| `extension/__tests__/build/critical-css-plugin.test.ts`         | **Create** | Snapshot du HTML émis avec `<style>` inline         |

---

## Convention des Tasks

Chaque Task suit le pattern bite-sized TDD (5 steps) :

- **Files** : paths absolus
- **Step 1: Write the failing test** — Jest + jsdom, avec mocks préchargés (chrome API, css, polyfill — déjà présents dans `__tests__/setup/`)
- **Step 2: Run test to verify it fails** — `cd C:/Users/33667/DeepSight-Main/extension && npm run test -- <pattern>`
- **Step 3: Write minimal implementation** — code complet, zéro placeholder
- **Step 4: Run test to verify it passes** — même commande, doit être vert
- **Step 5: Commit** — Conventional Commits format `feat(extension): ...`, scope précisé éventuellement

Tous les paths sont absolus. Tout le code est complet — pas de "similar to..." ni de TODO.

---

## Tasks

### Task 1 — Webpack: copy sprites WebP vers dist/assets/ambient/ + fix doublon entry

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\webpack.config.js`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\build\webpack-config.test.ts`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\build\webpack-config.test.ts` :

```ts
import path from "path";
import webpackConfigFactory from "../../webpack.config";

describe("webpack.config — ambient lighting v3", () => {
  it("has no duplicate entry keys (no double 'sidepanel')", () => {
    const config = webpackConfigFactory({}, { mode: "development" });
    const keys = Object.keys(config.entry);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it("copies extension/public/assets/ambient/*.webp to dist/assets/ambient/", () => {
    const config = webpackConfigFactory({}, { mode: "development" });
    const copyPlugin = config.plugins.find(
      (p: any) => p.constructor.name === "CopyPlugin",
    );
    const patterns: any[] = (copyPlugin as any).patterns;
    const found = patterns.find(
      (p: any) =>
        typeof p.from === "string" && p.from.includes("assets/ambient"),
    );
    expect(found).toBeDefined();
    expect(found.to).toMatch(/assets\/ambient/);
    expect(found.noErrorOnMissing).toBe(true);
  });

  it("declares an HtmlWebpackPlugin for viewer.html", () => {
    const config = webpackConfigFactory({}, { mode: "development" });
    const htmlPlugins = config.plugins.filter(
      (p: any) => p.constructor.name === "HtmlWebpackPlugin",
    );
    const viewer = htmlPlugins.find(
      (p: any) => p.userOptions?.filename === "viewer.html",
    );
    expect(viewer).toBeDefined();
    expect(viewer.userOptions.chunks).toEqual(["viewer"]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- webpack-config
```

3 fails attendus : doublon `sidepanel`, pas de pattern `assets/ambient`, pas de HtmlWebpackPlugin pour `viewer.html`.

**Step 3: Write minimal implementation**

Modifier `C:\Users\33667\DeepSight-Main\extension\webpack.config.js` :

```js
const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const manifestMap = {
  chrome: "manifest.json",
  firefox: "manifest.firefox.json",
  safari: "manifest.safari.json",
};

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";
  const targetBrowser = env?.target || "chrome";
  const manifestFile = manifestMap[targetBrowser] || "manifest.json";

  const outputDir = env?.target
    ? path.resolve(__dirname, "dist", targetBrowser)
    : path.resolve(__dirname, "dist");

  return {
    entry: {
      background: "./src/background.ts",
      content: "./src/content/index.ts",
      authSync: "./src/authSync/index.ts",
      authSyncMain: "./src/authSyncMain/index.ts",
      sidepanel: "./src/sidepanel/index.tsx",
      viewer: "./src/viewer.tsx",
    },
    output: {
      path: outputDir,
      filename: "[name].js",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: [/node_modules/, /__tests__/],
        },
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
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
      alias: {
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        __TARGET_BROWSER__: JSON.stringify(targetBrowser),
      }),
      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),
      new HtmlWebpackPlugin({
        template: "./public/sidepanel.html",
        filename: "sidepanel.html",
        chunks: ["sidepanel"],
        inject: "body",
      }),
      new HtmlWebpackPlugin({
        template: "./public/viewer.html",
        filename: "viewer.html",
        chunks: ["viewer"],
        inject: "body",
      }),
      new CopyPlugin({
        patterns: [
          { from: `public/${manifestFile}`, to: "manifest.json" },
          { from: "src/styles/design-tokens.css", to: "design-tokens.css" },
          { from: "src/styles/viewer.css", to: "viewer.css" },
          { from: "src/styles/tokens.css", to: "tokens.css" },
          { from: "icons", to: "icons" },
          {
            from: "public/assets/ambient",
            to: "assets/ambient",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/logo.png",
            to: "assets/deep-sight-logo.png",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/deepsight-logo-cosmic.png",
            to: "assets/deepsight-logo-cosmic.png",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/spinner-cosmic.jpg",
            to: "assets/spinner-cosmic.jpg",
            noErrorOnMissing: true,
          },
          {
            from: "../frontend/public/spinner-wheel.jpg",
            to: "assets/spinner-wheel.jpg",
            noErrorOnMissing: true,
          },
          { from: "public/platforms", to: "platforms", noErrorOnMissing: true },
        ],
      }),
    ],
    optimization: {
      minimize: isProd,
    },
    devtool: isProd ? false : "cheap-module-source-map",
  };
};
```

Notes :

1. Doublon `sidepanel` retiré (un seul `sidepanel: "./src/sidepanel/index.tsx"`).
2. HtmlWebpackPlugin pour `viewer.html` ajouté → permet le critical CSS plugin de Task 2.
3. Pattern copy `public/assets/ambient` → `assets/ambient` ajouté (`noErrorOnMissing: true` pour ne pas casser tant que PR1 n'est pas mergée).
4. La duplication des patterns existants pour `viewer.html` est retirée des `CopyPlugin.patterns` (HtmlWebpackPlugin s'en charge maintenant).

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- webpack-config
```

3 tests verts.

**Step 5: Commit**

```
feat(extension): copy ambient sprites + fix sidepanel entry duplicate

- Removes duplicate `sidepanel` key in webpack.entry (was overriding silently)
- Adds copy-webpack-plugin pattern for public/assets/ambient/*.webp → dist/assets/ambient/
- Replaces ad-hoc copy of viewer.html with HtmlWebpackPlugin instance (prerequisite for critical CSS plugin in next commit)
- Tests asserting no-duplicate, sprite copy presence, and viewer HtmlWebpackPlugin
```

---

### Task 2 — Webpack: critical CSS plugin maison

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\scripts\critical-css-plugin.js`
- `C:\Users\33667\DeepSight-Main\extension\webpack.config.js`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\build\critical-css-plugin.test.ts`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\build\critical-css-plugin.test.ts` :

```ts
import path from "path";
import { CriticalCssPlugin } from "../../scripts/critical-css-plugin";

describe("CriticalCssPlugin", () => {
  it("exposes a Webpack plugin class with apply()", () => {
    expect(typeof CriticalCssPlugin).toBe("function");
    const instance = new CriticalCssPlugin({ presetTime: new Date(0) });
    expect(typeof instance.apply).toBe("function");
  });

  it("emits a deterministic <style> block when computeCriticalStyles is called with a fixed Date", () => {
    const plugin = new CriticalCssPlugin({
      presetTime: new Date("2026-04-27T12:00:00.000Z"),
    });
    const css = plugin.computeCriticalStyles();
    expect(css).toMatch(/\.ambient-beam\s*\{/);
    expect(css).toMatch(/transform:\s*rotate\(/);
    expect(css).toMatch(/--ambient-beam-color:/);
  });

  it("inserts the style tag inside <head> via altered HTML asset", () => {
    const plugin = new CriticalCssPlugin({
      presetTime: new Date("2026-04-27T12:00:00.000Z"),
    });
    const html = "<html><head><title>x</title></head><body></body></html>";
    const out = plugin.injectIntoHtml(html);
    expect(out).toContain('<style id="ambient-critical">');
    expect(out.indexOf('<style id="ambient-critical">')).toBeLessThan(
      out.indexOf("</head>"),
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- critical-css-plugin
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\scripts\critical-css-plugin.js` :

```js
/**
 * CriticalCssPlugin — webpack plugin maison qui calcule les valeurs initiales du
 * preset ambient lighting (depuis @deepsight/lighting-engine v3) au build, et
 * injecte un <style id="ambient-critical"> dans le <head> des HTML émis par
 * HtmlWebpackPlugin.
 *
 * Pourquoi : le rayon doit être visible AVANT que React/Preact bootstrap. Sans
 * critical CSS, l'utilisateur voit le fond noir #0a0a0f vide pendant ~80ms.
 *
 * Usage dans webpack.config.js :
 *   new CriticalCssPlugin({ presetTime: new Date() })
 */

const HtmlWebpackPlugin = require("html-webpack-plugin");

class CriticalCssPlugin {
  constructor(options = {}) {
    this.presetTime = options.presetTime || new Date();
  }

  computeCriticalStyles() {
    // Importé dynamiquement pour ne pas crasher si l'engine n'est pas dispo
    // (par exemple en test sans build engine).
    let preset;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const engine = require("@deepsight/lighting-engine");
      preset = engine.getAmbientPreset(this.presetTime, { intensityMul: 0.8 });
    } catch (e) {
      // Fallback : valeurs neutres (zénith blanc) — l'app overridera dès hydratation.
      preset = {
        beam: {
          color: [255, 250, 225],
          angleDeg: 0,
          opacity: 0.4,
        },
        haloX: 50,
        haloY: 30,
      };
    }

    const [r, g, b] = preset.beam.color;
    const beamRgba = (a) =>
      `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

    return `
      :root {
        --ambient-beam-color: ${beamRgba(preset.beam.opacity)};
        --ambient-beam-color-mid: ${beamRgba(preset.beam.opacity * 0.5)};
        --ambient-beam-angle: ${preset.beam.angleDeg.toFixed(2)}deg;
        --ambient-halo-x: ${preset.haloX.toFixed(2)}%;
        --ambient-halo-y: ${preset.haloY.toFixed(2)}%;
      }
      html, body { background: #0a0a0f; }
      .ambient-beam {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        background: linear-gradient(
          var(--ambient-beam-angle),
          transparent 35%,
          var(--ambient-beam-color-mid) 48%,
          var(--ambient-beam-color) 50%,
          var(--ambient-beam-color-mid) 52%,
          transparent 65%
        );
        mix-blend-mode: screen;
        transform: rotate(0);
      }
    `
      .replace(/\s+/g, " ")
      .trim();
  }

  injectIntoHtml(html) {
    const css = this.computeCriticalStyles();
    const tag = `<style id="ambient-critical">${css}</style>`;
    if (html.includes("</head>")) {
      return html.replace("</head>", `${tag}</head>`);
    }
    return tag + html;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap("CriticalCssPlugin", (compilation) => {
      const hooks = HtmlWebpackPlugin.getHooks(compilation);
      hooks.beforeEmit.tapAsync("CriticalCssPlugin", (data, cb) => {
        data.html = this.injectIntoHtml(data.html);
        cb(null, data);
      });
    });
  }
}

module.exports = { CriticalCssPlugin };
```

Modifier `C:\Users\33667\DeepSight-Main\extension\webpack.config.js` pour utiliser le plugin :

```js
// Tout en haut, après les autres requires :
const { CriticalCssPlugin } = require("./scripts/critical-css-plugin");

// Dans le tableau plugins[], après les 2 HtmlWebpackPlugin :
new CriticalCssPlugin({ presetTime: new Date() }),
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- critical-css-plugin
```

3 tests verts.

**Step 5: Commit**

```
feat(extension): add CriticalCssPlugin for ambient lighting preload

Computes initial AmbientPreset at build via @deepsight/lighting-engine and
injects a <style id="ambient-critical"> into sidepanel.html and viewer.html
<head> blocks. The beam is now visible BEFORE React/Preact hydration.

- Plugin: extension/scripts/critical-css-plugin.js
- Wired into webpack.config.js after HtmlWebpackPlugin instances
- Tests cover plugin class shape, deterministic CSS output, and HTML insertion
- Fallback values when engine isn't loadable (CI without monorepo link)
```

---

### Task 3 — Sidepanel hook `useAmbientPreset`

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\hooks\useAmbientPreset.ts`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\useAmbientPreset.test.ts`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\useAmbientPreset.test.ts` :

```ts
import { renderHook, act } from "@testing-library/react";
import { useAmbientPreset } from "../../src/sidepanel/hooks/useAmbientPreset";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn((date, opts) => ({
    hour: date.getHours(),
    beam: {
      color: [255, 250, 225],
      angleDeg: 0,
      opacity: 0.5 * (opts?.intensityMul ?? 1),
    },
    sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 50,
    haloY: 30,
    colors: {
      primary: [255, 250, 225],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
    nightMode: null,
    frameIndex: 12,
  })),
}));

describe("useAmbientPreset (sidepanel)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a preset on mount", () => {
    const { result } = renderHook(() =>
      useAmbientPreset({ intensityMul: 0.85 }),
    );
    expect(result.current).toBeDefined();
    expect(result.current.beam.opacity).toBeCloseTo(0.5 * 0.85, 5);
  });

  it("refreshes preset every 60s", () => {
    const { getAmbientPreset } = require("@deepsight/lighting-engine");
    renderHook(() => useAmbientPreset({ intensityMul: 1 }));
    expect(getAmbientPreset).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getAmbientPreset).toHaveBeenCalledTimes(2);
  });

  it("clears interval on unmount", () => {
    const { getAmbientPreset } = require("@deepsight/lighting-engine");
    const { unmount } = renderHook(() => useAmbientPreset({ intensityMul: 1 }));
    unmount();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getAmbientPreset).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- useAmbientPreset
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\hooks\useAmbientPreset.ts` :

```ts
import { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
  type PresetOptions,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 60_000;

export interface UseAmbientPresetOptions {
  intensityMul?: number;
  refreshIntervalMs?: number;
}

/**
 * Sidepanel-specific wrapper around @deepsight/lighting-engine.
 *
 * Refreshes every 60s by default. The sidepanel is opened/closed frequently
 * by the user, so we don't need a tight loop. Cleanup on unmount.
 */
export function useAmbientPreset(
  opts: UseAmbientPresetOptions = {},
): AmbientPreset {
  const intensityMul = opts.intensityMul ?? 0.85;
  const refreshIntervalMs = opts.refreshIntervalMs ?? REFRESH_INTERVAL_MS;

  const computeOpts: PresetOptions = { intensityMul };

  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), computeOpts),
  );

  useEffect(() => {
    const tick = (): void => {
      setPreset(getAmbientPreset(new Date(), computeOpts));
    };
    tick();
    const id = window.setInterval(tick, refreshIntervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensityMul, refreshIntervalMs]);

  return preset;
}
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- useAmbientPreset
```

3 tests verts.

**Step 5: Commit**

```
feat(extension/sidepanel): add useAmbientPreset hook wrapping engine

Wraps @deepsight/lighting-engine getAmbientPreset() for sidepanel consumers.
Refreshes preset every 60s (sidepanel open/close cycle is short, no need for
tight intervals). Clean interval cleanup on unmount.
```

---

### Task 4 — Sidepanel `AmbientLightingContext` + Provider

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\contexts\AmbientLightingContext.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\AmbientLightingContext.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\AmbientLightingContext.test.tsx` :

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  AmbientLightingProvider,
  useAmbientLighting,
} from "../../src/sidepanel/contexts/AmbientLightingContext";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 12,
    beam: { color: [255, 250, 225], angleDeg: 0, opacity: 0.5 },
    sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 50,
    haloY: 30,
    colors: {
      primary: [255, 250, 225],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
    nightMode: null,
    frameIndex: 12,
  })),
}));

const Consumer: React.FC = () => {
  const { preset } = useAmbientLighting();
  return <div data-testid="hour">{preset.hour}</div>;
};

describe("AmbientLightingProvider (sidepanel)", () => {
  it("provides preset to children via useAmbientLighting()", () => {
    render(
      <AmbientLightingProvider>
        <Consumer />
      </AmbientLightingProvider>,
    );
    expect(screen.getByTestId("hour")).toHaveTextContent("12");
  });

  it("returns a fallback preset when consumer is used outside Provider", () => {
    // Should not throw — Context has a default preset value so optional usage works.
    render(<Consumer />);
    expect(screen.getByTestId("hour")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- AmbientLightingContext
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\contexts\AmbientLightingContext.tsx` :

```tsx
import React, { createContext, useContext, useMemo } from "react";
import type { AmbientPreset } from "@deepsight/lighting-engine";
import { useAmbientPreset } from "../hooks/useAmbientPreset";

export interface AmbientLightingContextValue {
  preset: AmbientPreset;
}

/**
 * Default fallback preset — used when a consumer is rendered outside the
 * Provider (e.g. unit tests, BeamCard before PR0 merge). Returning a stable
 * neutral preset means BeamCard with `usePreset = true` keeps working in
 * isolation.
 */
const FALLBACK_PRESET: AmbientPreset = {
  hour: 12,
  mood: "midday",
  beam: { type: "sun", color: [255, 250, 225], angleDeg: 0, opacity: 0.4 },
  sun: { visible: true, opacity: 0.6, x: 50, y: 30 },
  moon: { visible: false, opacity: 0, x: 0, y: 0 },
  ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
  starOpacityMul: 0,
  starDensity: "sparse",
  haloX: 50,
  haloY: 30,
  colors: {
    primary: [255, 250, 225],
    secondary: [255, 200, 100],
    tertiary: [200, 150, 100],
    rays: [255, 255, 255],
    accent: [99, 102, 241],
  },
};

const AmbientLightingContext = createContext<AmbientLightingContextValue>({
  preset: FALLBACK_PRESET,
});

export interface AmbientLightingProviderProps {
  children: React.ReactNode;
  intensityMul?: number;
}

export const AmbientLightingProvider: React.FC<
  AmbientLightingProviderProps
> = ({ children, intensityMul = 0.85 }) => {
  const preset = useAmbientPreset({ intensityMul });
  const value = useMemo(() => ({ preset }), [preset]);
  return (
    <AmbientLightingContext.Provider value={value}>
      {children}
    </AmbientLightingContext.Provider>
  );
};

export function useAmbientLighting(): AmbientLightingContextValue {
  return useContext(AmbientLightingContext);
}
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- AmbientLightingContext
```

2 tests verts.

**Step 5: Commit**

```
feat(extension/sidepanel): add AmbientLightingContext + Provider

Provider wraps useAmbientPreset() and exposes preset via Context to the
entire sidepanel tree. Fallback neutral preset returned when used outside
Provider — required for BeamCard back-compat (PR0 coordination).
```

---

### Task 5 — Sidepanel `AmbientLightLayer` v3 (rewrite)

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\shared\AmbientLightLayer.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\AmbientLightLayer.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\AmbientLightLayer.test.tsx` :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../../src/sidepanel/shared/AmbientLightLayer";
import { AmbientLightingProvider } from "../../src/sidepanel/contexts/AmbientLightingContext";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 12,
    mood: "midday",
    beam: { type: "sun", color: [255, 250, 225], angleDeg: 12, opacity: 0.5 },
    sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 50,
    haloY: 30,
    colors: {
      primary: [255, 250, 225],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
  })),
}));

describe("AmbientLightLayer (sidepanel)", () => {
  it("renders an aria-hidden overlay", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const overlays = container.querySelectorAll("[aria-hidden='true']");
    expect(overlays.length).toBeGreaterThan(0);
  });

  it("disables pointer events on the overlay", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const overlay = container.querySelector("[data-testid='ambient-beam']");
    expect(overlay).not.toBeNull();
    expect(window.getComputedStyle(overlay as Element).pointerEvents).toBe(
      "none",
    );
  });

  it("falls back gracefully when used outside the Provider", () => {
    expect(() => render(<AmbientLightLayer />)).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel/AmbientLightLayer"
```

L'ancien composant existe mais consomme `getAmbientPreset` directement. Test fail sur Provider mock + data-testid manquant.

**Step 3: Write minimal implementation**

Réécrire `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\shared\AmbientLightLayer.tsx` :

```tsx
/**
 * AmbientLightLayer — Sidepanel v3.
 *
 * Reads preset from AmbientLightingContext (single source of truth, refreshes
 * every 60s). No direct engine call. Renders:
 *   1. Beam linear-gradient (rotated by preset.beam.angleDeg)
 *   2. Sun radial gradient (when preset.sun.visible)
 *   3. Moon radial gradient (when preset.moon.visible)
 *
 * All overlays are aria-hidden and have pointer-events: none. Cap on beam
 * opacity prevents reading-zone glare in the narrow 380×600 sidepanel.
 */

import React from "react";
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

const TRANSITION_MS = 1500;
const BEAM_OPACITY_CAP = 0.22;

const rgba = (rgb: [number, number, number], a: number): string =>
  `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export const AmbientLightLayer: React.FC = () => {
  const { preset } = useAmbientLighting();

  const beamOpacity = Math.min(BEAM_OPACITY_CAP, preset.beam.opacity);
  const moonOpacity = Math.min(0.65, preset.moon.opacity);
  const sunOpacity = Math.min(0.4, preset.sun.opacity);

  const transitionStyle: React.CSSProperties = {
    transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  };

  const beamColor = preset.beam.color;
  const beamGradient = `linear-gradient(${preset.beam.angleDeg}deg, transparent 35%, ${rgba(beamColor, beamOpacity * 0.5)} 48%, ${rgba(beamColor, beamOpacity)} 50%, ${rgba(beamColor, beamOpacity * 0.5)} 52%, transparent 65%)`;

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="ambient-beam"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "none",
          background: beamGradient,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {preset.sun.visible && sunOpacity > 0.05 && (
        <div
          aria-hidden="true"
          data-testid="ambient-sun"
          style={{
            position: "absolute",
            top: `${preset.sun.y}%`,
            left: `${preset.sun.x}%`,
            width: 40,
            height: 40,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            pointerEvents: "none",
            zIndex: 0,
            background:
              "radial-gradient(circle at 50% 50%, #fff8d4 0%, #fde68a 50%, #fbbf24 80%, transparent 100%)",
            boxShadow: "0 0 30px 5px rgba(253,224,71,0.3)",
            opacity: sunOpacity,
            ...transitionStyle,
          }}
        />
      )}

      {preset.moon.visible && moonOpacity > 0.05 && (
        <div
          aria-hidden="true"
          data-testid="ambient-moon"
          style={{
            position: "absolute",
            top: `${preset.moon.y}%`,
            left: `${preset.moon.x}%`,
            width: 32,
            height: 32,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            pointerEvents: "none",
            zIndex: 0,
            background:
              "radial-gradient(circle at 38% 38%, #ffffff 0%, #f1f5f9 65%, transparent 100%)",
            boxShadow: "0 0 25px 6px rgba(255,255,255,0.3)",
            opacity: moonOpacity,
            ...transitionStyle,
          }}
        />
      )}
    </>
  );
};

export default AmbientLightLayer;
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel/AmbientLightLayer"
```

3 tests verts.

**Step 5: Commit**

```
feat(extension/sidepanel): rewrite AmbientLightLayer to consume Context

Removes direct getAmbientPreset() call (was duplicated against the Provider).
Adds data-testid hooks for Jest assertions, explicit aria-hidden + pointer-events
none on every overlay, and falls back gracefully when used outside Provider via
the Context default value.
```

---

### Task 6 — Sidepanel `SunflowerLayer` (mascot 76px)

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\components\SunflowerLayer.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\SunflowerLayer.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\SunflowerLayer.test.tsx` :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { SunflowerLayer } from "../../src/sidepanel/components/SunflowerLayer";
import { AmbientLightingProvider } from "../../src/sidepanel/contexts/AmbientLightingContext";

const presetFactory = (overrides: any = {}) => ({
  hour: 12,
  mood: "midday",
  beam: { type: "sun", color: [255, 250, 225], angleDeg: 0, opacity: 0.5 },
  sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
  moon: { visible: false, opacity: 0, x: 0, y: 0 },
  ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
  starOpacityMul: 0,
  starDensity: "sparse",
  haloX: 50,
  haloY: 30,
  colors: {
    primary: [255, 250, 225],
    secondary: [255, 200, 100],
    tertiary: [200, 150, 100],
    rays: [255, 255, 255],
    accent: [99, 102, 241],
  },
  nightMode: null,
  frameIndex: 12,
  ...overrides,
});

const mockGetPreset = jest.fn();
jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: (...args: any[]) => mockGetPreset(...args),
}));

describe("SunflowerLayer (sidepanel)", () => {
  beforeEach(() => mockGetPreset.mockReset());

  it("renders the day sprite when nightMode is null", () => {
    mockGetPreset.mockReturnValue(
      presetFactory({ nightMode: null, frameIndex: 8 }),
    );
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const node = container.querySelector(
      "[data-testid='sunflower-mascot']",
    ) as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.style.backgroundImage).toMatch(/sunflower-day\.webp/);
  });

  it("renders the night sprite when nightMode is glowing", () => {
    mockGetPreset.mockReturnValue(
      presetFactory({ nightMode: "glowing", frameIndex: 3 }),
    );
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const node = container.querySelector(
      "[data-testid='sunflower-mascot']",
    ) as HTMLElement;
    expect(node.style.backgroundImage).toMatch(/sunflower-night\.webp/);
  });

  it("is positioned bottom-right and is aria-hidden", () => {
    mockGetPreset.mockReturnValue(presetFactory());
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const node = container.querySelector(
      "[data-testid='sunflower-mascot']",
    ) as HTMLElement;
    expect(node.getAttribute("aria-hidden")).toBe("true");
    expect(node.style.bottom).not.toBe("");
    expect(node.style.right).not.toBe("");
    expect(window.getComputedStyle(node).pointerEvents).toBe("none");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel/SunflowerLayer"
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\components\SunflowerLayer.tsx` :

```tsx
/**
 * SunflowerLayer — Sidepanel mascot v3.
 *
 * 76×76px tournesol bottom-right corner, sprite-based cross-fade between
 * frames. Day variant when preset.nightMode === null, night (glowing)
 * variant otherwise. Sprite assets are 6×4 grids of 256×256 frames =
 * 1536×1024 each.
 *
 * The sprite path is loaded relative to the extension dist root :
 * `assets/ambient/sunflower-{day,night}.webp` (copied by webpack in Task 1).
 */

import React, { useEffect, useState } from "react";
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

const SPRITE_GRID_COLS = 6;
const SPRITE_GRID_ROWS = 4;
const FRAME_PX = 256;
const DISPLAY_PX = 76;
const CROSS_FADE_MS = 4000;

const computeBackgroundPosition = (frameIndex: number): string => {
  const col = frameIndex % SPRITE_GRID_COLS;
  const row = Math.floor(frameIndex / SPRITE_GRID_COLS) % SPRITE_GRID_ROWS;
  // Display is 76px but sprite is 256px frame → ratio for background-position
  const ratio = DISPLAY_PX / FRAME_PX;
  return `${-col * DISPLAY_PX}px ${-row * DISPLAY_PX}px`;
  // Note: with `background-size: ${DISPLAY_PX * SPRITE_GRID_COLS}px ${DISPLAY_PX * SPRITE_GRID_ROWS}px`
};

const SPRITE_SIZE = `${DISPLAY_PX * SPRITE_GRID_COLS}px ${DISPLAY_PX * SPRITE_GRID_ROWS}px`;

interface SunflowerLayerProps {
  /** Override sprite base URL — useful for testing. Defaults to dist relative path. */
  spriteBaseUrl?: string;
}

export const SunflowerLayer: React.FC<SunflowerLayerProps> = ({
  spriteBaseUrl = "assets/ambient",
}) => {
  const { preset } = useAmbientLighting();
  const isNight =
    preset.nightMode === "glowing" || preset.nightMode === "asleep";
  const sprite = isNight
    ? `${spriteBaseUrl}/sunflower-night.webp`
    : `${spriteBaseUrl}/sunflower-day.webp`;
  const frameIndex = preset.frameIndex ?? 12;

  const [prevFrame, setPrevFrame] = useState(frameIndex);
  const [nextFrame, setNextFrame] = useState(frameIndex);
  const [phase, setPhase] = useState<"idle" | "cross">("idle");

  useEffect(() => {
    if (frameIndex === nextFrame) return;
    setPrevFrame(nextFrame);
    setNextFrame(frameIndex);
    setPhase("cross");
    const t = window.setTimeout(() => setPhase("idle"), CROSS_FADE_MS);
    return () => window.clearTimeout(t);
  }, [frameIndex, nextFrame]);

  const layerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 22,
    right: 22,
    width: DISPLAY_PX,
    height: DISPLAY_PX,
    pointerEvents: "none",
    zIndex: 2,
  };

  const frameStyle = (idx: number, opacity: number): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    backgroundImage: `url('${sprite}')`,
    backgroundSize: SPRITE_SIZE,
    backgroundPosition: computeBackgroundPosition(idx),
    backgroundRepeat: "no-repeat",
    opacity,
    transition: `opacity ${CROSS_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  });

  return (
    <div
      aria-hidden="true"
      data-testid="sunflower-mascot"
      style={{
        ...layerStyle,
        backgroundImage: `url('${sprite}')`,
        backgroundSize: SPRITE_SIZE,
        backgroundPosition: computeBackgroundPosition(nextFrame),
        backgroundRepeat: "no-repeat",
      }}
    >
      {phase === "cross" && <div style={frameStyle(prevFrame, 0)} />}
    </div>
  );
};

export default SunflowerLayer;
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel/SunflowerLayer"
```

3 tests verts.

**Step 5: Commit**

```
feat(extension/sidepanel): add SunflowerLayer mascot 76px

Renders a 76×76px sprite-based tournesol bottom-right of the sidepanel,
crossfading between frames over 4s when frameIndex changes. Day and night
sprites switched based on preset.nightMode. aria-hidden + pointer-events:none
to stay decorative.
```

---

### Task 7 — Sidepanel `App.tsx` : monter Provider + 2 layers (sortie d'orphelinat)

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\App.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\App.integration.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\App.integration.test.tsx` :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { App } from "../../src/sidepanel/App";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 12,
    mood: "midday",
    beam: { type: "sun", color: [255, 250, 225], angleDeg: 0, opacity: 0.5 },
    sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 50,
    haloY: 30,
    colors: {
      primary: [255, 250, 225],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
    nightMode: null,
    frameIndex: 12,
  })),
}));

jest.mock("../../src/utils/browser-polyfill", () => ({
  __esModule: true,
  default: {
    runtime: {
      sendMessage: jest.fn(() => Promise.resolve({ authenticated: false })),
    },
    storage: { session: { get: jest.fn(() => Promise.resolve({})) } },
  },
}));

describe("Sidepanel App — ambient lighting integration", () => {
  it("mounts AmbientLightLayer and SunflowerLayer at the root", async () => {
    const { container, findByTestId } = render(<App />);
    expect(await findByTestId("ambient-beam")).toBeInTheDocument();
    expect(await findByTestId("sunflower-mascot")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel/App.integration"
```

Les data-testid n'existent pas car App.tsx ne monte pas encore Provider/Layers.

**Step 3: Write minimal implementation**

Modifier `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\App.tsx` (uniquement le bloc `return` final + l'import) :

```tsx
import React, { useState, useEffect, useCallback } from "react";
import type { User, PlanInfo, MessageResponse } from "../types";
import Browser from "../utils/browser-polyfill";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { VoiceView } from "./VoiceView";
import type { VoicePanelContext } from "./types";
import { DeepSightSpinner } from "./shared/DeepSightSpinner";
import MicroDoodleBackground from "./shared/MicroDoodleBackground";
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { AmbientLightLayer } from "./shared/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";

// ... [reste du fichier identique jusqu'au return final]
```

Puis remplacer le bloc `return ( ... )` final par :

```tsx
return (
  <AmbientLightingProvider>
    <div
      className="app-container noise-overlay ambient-glow"
      style={{ position: "relative" }}
    >
      <AmbientLightLayer />
      <MicroDoodleBackground variant={getCurrentVariant()} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {toast && (
          <div
            className={`ds-toast ds-toast-${toast.type}`}
            onClick={() => setToast(null)}
          >
            {toast.message}
          </div>
        )}

        {view === "loading" && (
          <div className="loading-view">
            <DeepSightSpinner
              size="md"
              speed="normal"
              showLabel
              label="DeepSight"
            />
          </div>
        )}

        {view === "login" && (
          <LoginView
            onLogin={handleLogin}
            onGoogleLogin={handleGoogleLogin}
            onGuestMode={handleGuestMode}
            error={error}
          />
        )}

        {view === "main" && (
          <MainView
            user={user}
            planInfo={planInfo}
            isGuest={isGuest}
            onLogout={handleLogout}
            onLoginRedirect={handleLoginRedirect}
            onError={showError}
          />
        )}
      </div>
      <SunflowerLayer />
    </div>
  </AmbientLightingProvider>
);
```

Note : également remplacer le early-return du voice context pour qu'il soit dans le Provider :

```tsx
if (voiceContext) {
  return (
    <AmbientLightingProvider>
      <AmbientLightLayer />
      <VoiceView context={voiceContext} />
      <SunflowerLayer />
    </AmbientLightingProvider>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel/App.integration"
```

Test vert. Tous les autres tests existants (App.test.tsx, etc.) doivent rester verts → vérifier avec :

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "sidepanel"
```

**Step 5: Commit**

```
feat(extension/sidepanel): mount AmbientLightingProvider + layers in App.tsx

Resolves orphelinat: AmbientLightLayer (rewrite v3) and SunflowerLayer
are now mounted at the root of every sidepanel view (loading, login, main,
voice). Provider hoisted above MicroDoodleBackground so existing layers
can also consume the preset later if needed.

User must reload extension via chrome://extensions after build.
```

(Reload Chrome rappel — ce commit change le mount root).

---

### Task 8 — Viewer hook `useAmbientPreset`

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\viewer\hooks\useAmbientPreset.ts`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\useAmbientPreset.test.ts`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\useAmbientPreset.test.ts` (identique à Task 3 mais pour viewer + refresh 30s) :

```ts
import { renderHook, act } from "@testing-library/react";
import { useAmbientPreset } from "../../src/viewer/hooks/useAmbientPreset";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 12,
    beam: { color: [255, 250, 225], angleDeg: 0, opacity: 0.5 },
    sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 50,
    haloY: 30,
    colors: {
      primary: [255, 250, 225],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
    nightMode: null,
    frameIndex: 12,
  })),
}));

describe("useAmbientPreset (viewer)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("refreshes every 30s by default (viewer stays open longer)", () => {
    const { getAmbientPreset } = require("@deepsight/lighting-engine");
    renderHook(() => useAmbientPreset());
    expect(getAmbientPreset).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(getAmbientPreset).toHaveBeenCalledTimes(2);
  });

  it("clears interval on unmount", () => {
    const { getAmbientPreset } = require("@deepsight/lighting-engine");
    const { unmount } = renderHook(() => useAmbientPreset());
    unmount();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getAmbientPreset).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/useAmbientPreset"
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\src\viewer\hooks\useAmbientPreset.ts` :

```ts
import { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
  type PresetOptions,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 30_000;

export interface UseAmbientPresetOptions {
  intensityMul?: number;
  refreshIntervalMs?: number;
}

/**
 * Viewer-specific wrapper around @deepsight/lighting-engine.
 *
 * Refreshes every 30s — the viewer is a dedicated tab kept open while reading
 * a long analysis, so we want smoother day-cycle progression than the
 * sidepanel.
 */
export function useAmbientPreset(
  opts: UseAmbientPresetOptions = {},
): AmbientPreset {
  const intensityMul = opts.intensityMul ?? 1;
  const refreshIntervalMs = opts.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  const computeOpts: PresetOptions = { intensityMul };

  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), computeOpts),
  );

  useEffect(() => {
    const tick = (): void => {
      setPreset(getAmbientPreset(new Date(), computeOpts));
    };
    tick();
    const id = window.setInterval(tick, refreshIntervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensityMul, refreshIntervalMs]);

  return preset;
}
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/useAmbientPreset"
```

2 tests verts.

**Step 5: Commit**

```
feat(extension/viewer): add useAmbientPreset hook (30s refresh)

Mirrors sidepanel hook but with 30s interval — the viewer tab is kept
open for long analyses, so we want smoother day-cycle transitions.
```

---

### Task 9 — Viewer `AmbientLightingContext`

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\viewer\contexts\AmbientLightingContext.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\AmbientLightingContext.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\AmbientLightingContext.test.tsx` (identique à Task 4 mais pour viewer) :

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  AmbientLightingProvider,
  useAmbientLighting,
} from "../../src/viewer/contexts/AmbientLightingContext";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 18,
    beam: { color: [255, 140, 80], angleDeg: 48, opacity: 0.8 },
    sun: { visible: false, opacity: 0, x: 0, y: 0 },
    moon: { visible: true, opacity: 0.5, x: 70, y: 20 },
    ambient: { primary: 0.4, secondary: 0.3, tertiary: 0.2 },
    starOpacityMul: 0.3,
    starDensity: "dense",
    haloX: 70,
    haloY: 20,
    colors: {
      primary: [255, 140, 80],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [216, 180, 254],
    },
    nightMode: null,
    frameIndex: 18,
  })),
}));

const Consumer: React.FC = () => {
  const { preset } = useAmbientLighting();
  return <div data-testid="hour">{preset.hour}</div>;
};

describe("AmbientLightingProvider (viewer)", () => {
  it("provides preset", () => {
    render(
      <AmbientLightingProvider>
        <Consumer />
      </AmbientLightingProvider>,
    );
    expect(screen.getByTestId("hour")).toHaveTextContent("18");
  });

  it("fallback when used outside Provider", () => {
    render(<Consumer />);
    expect(screen.getByTestId("hour")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/AmbientLightingContext"
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\src\viewer\contexts\AmbientLightingContext.tsx` :

```tsx
import React, { createContext, useContext, useMemo } from "react";
import type { AmbientPreset } from "@deepsight/lighting-engine";
import { useAmbientPreset } from "../hooks/useAmbientPreset";

export interface AmbientLightingContextValue {
  preset: AmbientPreset;
}

const FALLBACK_PRESET: AmbientPreset = {
  hour: 12,
  mood: "midday",
  beam: { type: "sun", color: [255, 250, 225], angleDeg: 0, opacity: 0.5 },
  sun: { visible: true, opacity: 0.6, x: 50, y: 30 },
  moon: { visible: false, opacity: 0, x: 0, y: 0 },
  ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
  starOpacityMul: 0,
  starDensity: "sparse",
  haloX: 50,
  haloY: 30,
  colors: {
    primary: [255, 250, 225],
    secondary: [255, 200, 100],
    tertiary: [200, 150, 100],
    rays: [255, 255, 255],
    accent: [99, 102, 241],
  },
};

const AmbientLightingContext = createContext<AmbientLightingContextValue>({
  preset: FALLBACK_PRESET,
});

export interface AmbientLightingProviderProps {
  children: React.ReactNode;
  intensityMul?: number;
}

export const AmbientLightingProvider: React.FC<
  AmbientLightingProviderProps
> = ({ children, intensityMul = 1 }) => {
  const preset = useAmbientPreset({ intensityMul });
  const value = useMemo(() => ({ preset }), [preset]);
  return (
    <AmbientLightingContext.Provider value={value}>
      {children}
    </AmbientLightingContext.Provider>
  );
};

export function useAmbientLighting(): AmbientLightingContextValue {
  return useContext(AmbientLightingContext);
}
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/AmbientLightingContext"
```

2 tests verts.

**Step 5: Commit**

```
feat(extension/viewer): add AmbientLightingContext + Provider

Mirrors sidepanel Provider — viewer is a separate tab so it gets its own
local Context (not shared with sidepanel). Default intensityMul=1 (viewer
has more screen real estate, can afford full intensity).
```

---

### Task 10 — Viewer `AmbientLightLayer` v3 (rewrite)

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\viewer\components\AmbientLightLayer.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\AmbientLightLayer.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\AmbientLightLayer.test.tsx` :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../../src/viewer/components/AmbientLightLayer";
import { AmbientLightingProvider } from "../../src/viewer/contexts/AmbientLightingContext";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 18,
    mood: "sunset",
    beam: { type: "sun", color: [255, 140, 80], angleDeg: 48, opacity: 0.8 },
    sun: { visible: true, opacity: 0.7, x: 75, y: 50 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.4, secondary: 0.3, tertiary: 0.2 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 75,
    haloY: 50,
    colors: {
      primary: [255, 140, 80],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
  })),
}));

describe("AmbientLightLayer (viewer)", () => {
  it("renders ambient gradient + beam + disc with aria-hidden", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(
      container.querySelector("[data-testid='viewer-ambient-gradient']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-testid='viewer-ambient-beam']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-testid='viewer-ambient-sun']"),
    ).not.toBeNull();
    container
      .querySelectorAll("[data-testid^='viewer-ambient']")
      .forEach((el) => {
        expect(el.getAttribute("aria-hidden")).toBe("true");
      });
  });

  it("disables pointer events on every overlay", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    container
      .querySelectorAll("[data-testid^='viewer-ambient']")
      .forEach((el) => {
        expect(window.getComputedStyle(el as Element).pointerEvents).toBe(
          "none",
        );
      });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/AmbientLightLayer"
```

L'ancien composant existe mais lit `getAmbientPreset` directement et n'a pas de `data-testid`.

**Step 3: Write minimal implementation**

Réécrire `C:\Users\33667\DeepSight-Main\extension\src\viewer\components\AmbientLightLayer.tsx` :

```tsx
/**
 * AmbientLightLayer — Viewer v3.
 *
 * Reads preset from AmbientLightingContext. Renders 3 stacked overlays:
 *   1. Ambient radial gradient (3 spots) — z-index 1
 *   2. Beam linear-gradient — z-index 1 (over gradient)
 *   3. Sun OR Moon disc — z-index 1
 *
 * Fullscreen `position: fixed inset: 0`. Viewer has more screen real-estate
 * than sidepanel, so we keep the original 3-layer composition (no opacity cap).
 */

import React from "react";
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

const TRANSITION_MS = 1500;

const rgba = (rgb: [number, number, number], a: number): string =>
  `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export const AmbientLightLayer: React.FC = () => {
  const { preset } = useAmbientLighting();

  const transitionStyle: React.CSSProperties = {
    transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  };

  const beamColor = preset.beam.color;
  const beamGradient = `linear-gradient(${preset.beam.angleDeg}deg, transparent 35%, ${rgba(beamColor, preset.beam.opacity * 0.5)} 48%, ${rgba(beamColor, preset.beam.opacity)} 50%, ${rgba(beamColor, preset.beam.opacity * 0.5)} 52%, transparent 65%)`;

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="viewer-ambient-gradient"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 80% 50% at ${preset.haloX}% ${preset.haloY}%, ${rgba(preset.colors.primary, preset.ambient.primary)} 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 10% 100%, ${rgba(preset.colors.secondary, preset.ambient.secondary)} 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 90% 90%, ${rgba(preset.colors.tertiary, preset.ambient.tertiary)} 0%, transparent 50%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      <div
        aria-hidden="true"
        data-testid="viewer-ambient-beam"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          overflow: "hidden",
          pointerEvents: "none",
          background: beamGradient,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {preset.sun.visible && preset.sun.opacity > 0.05 && (
        <div
          aria-hidden="true"
          data-testid="viewer-ambient-sun"
          style={{
            position: "fixed",
            top: `${preset.sun.y}%`,
            left: `${preset.sun.x}%`,
            width: 84,
            height: 84,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            zIndex: 1,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 50%, #fff8d4 0%, #fde68a 50%, #fbbf24 80%, transparent 100%)",
            boxShadow:
              "0 0 80px 20px rgba(253,224,71,0.35), 0 0 160px 50px rgba(251,191,36,0.18)",
            opacity: preset.sun.opacity,
            ...transitionStyle,
          }}
        />
      )}

      {preset.moon.visible && preset.moon.opacity > 0.05 && (
        <div
          aria-hidden="true"
          data-testid="viewer-ambient-moon"
          style={{
            position: "fixed",
            top: `${preset.moon.y}%`,
            left: `${preset.moon.x}%`,
            width: 72,
            height: 72,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            zIndex: 1,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 38% 38%, #ffffff 0%, #f1f5f9 60%, #cbd5e1 85%, transparent 100%)",
            boxShadow:
              "0 0 50px 10px rgba(255,255,255,0.35), 0 0 110px 28px rgba(186,230,253,0.18)",
            opacity: preset.moon.opacity,
            ...transitionStyle,
          }}
        />
      )}
    </>
  );
};

export default AmbientLightLayer;
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/AmbientLightLayer"
```

2 tests verts.

**Step 5: Commit**

```
feat(extension/viewer): rewrite AmbientLightLayer to consume Context

Removes direct getAmbientPreset() call. Adds explicit data-testid attributes
on each overlay (gradient/beam/sun/moon), enforces aria-hidden + pointer-events
none, and falls back gracefully when used outside Provider.
```

---

### Task 11 — Viewer `SunflowerLayer` (mascot 96px)

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\viewer\components\SunflowerLayer.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\SunflowerLayer.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\SunflowerLayer.test.tsx` (similaire à Task 6 mais data-testid `viewer-sunflower`) :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { SunflowerLayer } from "../../src/viewer/components/SunflowerLayer";
import { AmbientLightingProvider } from "../../src/viewer/contexts/AmbientLightingContext";

const presetFactory = (overrides: any = {}) => ({
  hour: 12,
  mood: "midday",
  beam: { type: "sun", color: [255, 250, 225], angleDeg: 0, opacity: 0.5 },
  sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
  moon: { visible: false, opacity: 0, x: 0, y: 0 },
  ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
  starOpacityMul: 0,
  starDensity: "sparse",
  haloX: 50,
  haloY: 30,
  colors: {
    primary: [255, 250, 225],
    secondary: [255, 200, 100],
    tertiary: [200, 150, 100],
    rays: [255, 255, 255],
    accent: [99, 102, 241],
  },
  nightMode: null,
  frameIndex: 12,
  ...overrides,
});

const mockGetPreset = jest.fn();
jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: (...args: any[]) => mockGetPreset(...args),
}));

describe("SunflowerLayer (viewer)", () => {
  beforeEach(() => mockGetPreset.mockReset());

  it("uses 96px display size (vs 76px sidepanel)", () => {
    mockGetPreset.mockReturnValue(presetFactory());
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const node = container.querySelector(
      "[data-testid='viewer-sunflower']",
    ) as HTMLElement;
    expect(node.style.width).toBe("96px");
    expect(node.style.height).toBe("96px");
  });

  it("switches to night sprite when nightMode='asleep'", () => {
    mockGetPreset.mockReturnValue(presetFactory({ nightMode: "asleep" }));
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const node = container.querySelector(
      "[data-testid='viewer-sunflower']",
    ) as HTMLElement;
    expect(node.style.backgroundImage).toMatch(/sunflower-night\.webp/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/SunflowerLayer"
```

Module introuvable.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\src\viewer\components\SunflowerLayer.tsx` :

```tsx
/**
 * SunflowerLayer — Viewer mascot v3.
 *
 * 96×96px (slightly larger than sidepanel 76px) sprite-based tournesol
 * bottom-right, identical cross-fade logic.
 */

import React, { useEffect, useState } from "react";
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

const SPRITE_GRID_COLS = 6;
const SPRITE_GRID_ROWS = 4;
const DISPLAY_PX = 96;
const CROSS_FADE_MS = 4000;

const computeBackgroundPosition = (frameIndex: number): string => {
  const col = frameIndex % SPRITE_GRID_COLS;
  const row = Math.floor(frameIndex / SPRITE_GRID_COLS) % SPRITE_GRID_ROWS;
  return `${-col * DISPLAY_PX}px ${-row * DISPLAY_PX}px`;
};

const SPRITE_SIZE = `${DISPLAY_PX * SPRITE_GRID_COLS}px ${DISPLAY_PX * SPRITE_GRID_ROWS}px`;

interface SunflowerLayerProps {
  spriteBaseUrl?: string;
}

export const SunflowerLayer: React.FC<SunflowerLayerProps> = ({
  spriteBaseUrl = "assets/ambient",
}) => {
  const { preset } = useAmbientLighting();
  const isNight =
    preset.nightMode === "glowing" || preset.nightMode === "asleep";
  const sprite = isNight
    ? `${spriteBaseUrl}/sunflower-night.webp`
    : `${spriteBaseUrl}/sunflower-day.webp`;
  const frameIndex = preset.frameIndex ?? 12;

  const [prevFrame, setPrevFrame] = useState(frameIndex);
  const [nextFrame, setNextFrame] = useState(frameIndex);
  const [phase, setPhase] = useState<"idle" | "cross">("idle");

  useEffect(() => {
    if (frameIndex === nextFrame) return;
    setPrevFrame(nextFrame);
    setNextFrame(frameIndex);
    setPhase("cross");
    const t = window.setTimeout(() => setPhase("idle"), CROSS_FADE_MS);
    return () => window.clearTimeout(t);
  }, [frameIndex, nextFrame]);

  const layerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 28,
    right: 28,
    width: DISPLAY_PX,
    height: DISPLAY_PX,
    pointerEvents: "none",
    zIndex: 2,
  };

  const frameStyle = (idx: number, opacity: number): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    backgroundImage: `url('${sprite}')`,
    backgroundSize: SPRITE_SIZE,
    backgroundPosition: computeBackgroundPosition(idx),
    backgroundRepeat: "no-repeat",
    opacity,
    transition: `opacity ${CROSS_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  });

  return (
    <div
      aria-hidden="true"
      data-testid="viewer-sunflower"
      style={{
        ...layerStyle,
        backgroundImage: `url('${sprite}')`,
        backgroundSize: SPRITE_SIZE,
        backgroundPosition: computeBackgroundPosition(nextFrame),
        backgroundRepeat: "no-repeat",
      }}
    >
      {phase === "cross" && <div style={frameStyle(prevFrame, 0)} />}
    </div>
  );
};

export default SunflowerLayer;
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/SunflowerLayer"
```

2 tests verts.

**Step 5: Commit**

```
feat(extension/viewer): add SunflowerLayer mascot 96px

96×96px tournesol bottom-right of the viewer tab. Slightly larger than
sidepanel mascot (76px) to match the increased screen real-estate. Same
day/night sprite logic via preset.nightMode.
```

---

### Task 12 — Viewer `ViewerApp.tsx` : monter Provider + 2 layers

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\viewer\ViewerApp.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\ViewerApp.integration.test.tsx`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\viewer\ViewerApp.integration.test.tsx` :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { ViewerApp } from "../../src/viewer/ViewerApp";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 14,
    mood: "afternoon",
    beam: { type: "sun", color: [255, 240, 200], angleDeg: 15, opacity: 0.6 },
    sun: { visible: true, opacity: 0.7, x: 60, y: 25 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 60,
    haloY: 25,
    colors: {
      primary: [255, 240, 200],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
    nightMode: null,
    frameIndex: 14,
  })),
}));

jest.mock("../../src/utils/browser-polyfill", () => ({
  __esModule: true,
  default: {
    runtime: {
      sendMessage: jest.fn(() =>
        Promise.resolve({ success: false, error: "test stub" }),
      ),
    },
  },
}));

describe("ViewerApp — ambient lighting integration", () => {
  it("mounts AmbientLightLayer + SunflowerLayer regardless of summary state", async () => {
    const { findByTestId } = render(<ViewerApp summaryId={0} />);
    expect(await findByTestId("viewer-ambient-beam")).toBeInTheDocument();
    expect(await findByTestId("viewer-sunflower")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/ViewerApp.integration"
```

Layers non montés.

**Step 3: Write minimal implementation**

Modifier `C:\Users\33667\DeepSight-Main\extension\src\viewer\ViewerApp.tsx` — ajouter les imports en haut et wrapper TOUS les early-returns + le return final dans `<AmbientLightingProvider>` avec les 2 layers :

```tsx
import React, { useEffect, useState } from "react";
import Browser from "../utils/browser-polyfill";
import type { Summary, MessageResponse } from "../types";
import { parseAnalysisToSummary } from "../utils/sanitize";
import { ViewerHeader } from "./components/ViewerHeader";
import { VerdictSection } from "./components/VerdictSection";
import { KeyPointsSection } from "./components/KeyPointsSection";
import { DetailedAnalysis } from "./components/DetailedAnalysis";
import { FactCheckSection } from "./components/FactCheckSection";
import { ActionBar } from "./components/ActionBar";
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { AmbientLightLayer } from "./components/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";

interface Props {
  summaryId: number;
}

const ViewerChrome: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <AmbientLightingProvider>
    <AmbientLightLayer />
    {children}
    <SunflowerLayer />
  </AmbientLightingProvider>
);

export const ViewerApp: React.FC<Props> = ({ summaryId }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!summaryId) {
      setError("ID d'analyse manquant");
      setLoading(false);
      return;
    }

    let cancelled = false;

    Browser.runtime
      .sendMessage({
        action: "GET_SUMMARY",
        data: { summaryId },
      })
      .then((resp) => {
        if (cancelled) return;
        const response = resp as MessageResponse | undefined;
        if (response?.success && response.summary) {
          setSummary(response.summary as Summary);
        } else {
          setError(response?.error || "Analyse introuvable");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [summaryId]);

  if (loading) {
    return (
      <ViewerChrome>
        <div className="viewer-loading">
          <div className="viewer-spinner" aria-hidden="true" />
          <p>Chargement de l'analyse…</p>
        </div>
      </ViewerChrome>
    );
  }

  if (error || !summary) {
    return (
      <ViewerChrome>
        <div className="viewer-error">
          <h1>Analyse introuvable</h1>
          <p>{error ?? "Aucune donnée retournée."}</p>
          <button
            type="button"
            className="v-btn v-btn-primary"
            onClick={() => window.close()}
          >
            Fermer
          </button>
        </div>
      </ViewerChrome>
    );
  }

  const parsed = parseAnalysisToSummary(summary.summary_content);

  return (
    <ViewerChrome>
      <div className="viewer-container">
        <ViewerHeader summary={summary} />
        <VerdictSection verdict={parsed.verdict} />
        <KeyPointsSection points={parsed.keyPoints} />
        <FactCheckSection facts={summary.facts_to_verify ?? []} />
        <DetailedAnalysis content={summary.summary_content} />
        <ActionBar summary={summary} summaryId={summary.id} />
      </div>
    </ViewerChrome>
  );
};
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer/ViewerApp.integration"
```

Test vert. Aucun test viewer existant ne doit régresser → vérifier :

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "viewer"
```

**Step 5: Commit**

```
feat(extension/viewer): mount AmbientLightingProvider + layers in ViewerApp

Resolves orphelinat: AmbientLightLayer (rewrite v3) and SunflowerLayer
are now mounted at the root of every viewer state (loading, error, success)
via a small ViewerChrome wrapper.

User must reload extension via chrome://extensions after build.
```

---

### Task 13 — Coordination PR0 : BeamCard wiring (commit revert-friendly)

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\src\sidepanel\components\BeamCard.tsx`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\sidepanel\components\BeamCard.test.tsx`

**Pré-condition:** vérifier d'abord si PR0 a livré BeamCard via :

```bash
ls "C:/Users/33667/DeepSight-Main/extension/src/sidepanel/components/" | grep -i Beam
```

Si présent → exécuter la version A. Si absent → exécuter la version B (stub adaptable).

#### Version A — BeamCard livré par PR0

**Step 1: Write the failing test**

Mettre à jour le test existant `BeamCard.test.tsx` pour vérifier la nouvelle prop `usePreset` :

```tsx
import React from "react";
import { render } from "@testing-library/react";
import { BeamCard } from "../../../src/sidepanel/components/BeamCard";
import { AmbientLightingProvider } from "../../../src/sidepanel/contexts/AmbientLightingContext";

jest.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: jest.fn(() => ({
    hour: 12,
    mood: "midday",
    beam: { type: "sun", color: [10, 20, 30], angleDeg: 45, opacity: 0.7 },
    sun: { visible: true, opacity: 0.8, x: 50, y: 30 },
    moon: { visible: false, opacity: 0, x: 0, y: 0 },
    ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.15 },
    starOpacityMul: 0,
    starDensity: "sparse",
    haloX: 50,
    haloY: 30,
    colors: {
      primary: [10, 20, 30],
      secondary: [255, 200, 100],
      tertiary: [200, 150, 100],
      rays: [255, 255, 255],
      accent: [99, 102, 241],
    },
    nightMode: null,
    frameIndex: 12,
  })),
}));

describe("BeamCard — Context wiring (PR4)", () => {
  it("uses static defaults when usePreset prop is omitted (back-compat)", () => {
    const { container } = render(<BeamCard title="Test" />);
    // The card MUST render without a Provider (static defaults).
    expect(container.firstChild).not.toBeNull();
  });

  it("consumes preset values when usePreset=true and Provider is present", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <BeamCard title="Test" usePreset />
      </AmbientLightingProvider>,
    );
    // Beam color should reflect the mocked rgb(10,20,30).
    const beam = container.querySelector(
      "[data-testid='beam-card-beam']",
    ) as HTMLElement | null;
    expect(beam).not.toBeNull();
    if (beam) {
      expect(beam.style.background || "").toMatch(/10,\s*20,\s*30/);
    }
  });

  it("falls back to static defaults when usePreset=true but no Provider (still uses Context fallback)", () => {
    const { container } = render(<BeamCard title="Test" usePreset />);
    expect(container.firstChild).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "BeamCard"
```

Échec — BeamCard ne lit pas encore le Context.

**Step 3: Write minimal implementation**

Modification chirurgicale de `BeamCard.tsx` (livré par PR0) — ajouter les 5 lignes ciblées :

```tsx
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

// Dans la signature des props, ajouter :
interface BeamCardProps {
  // ... props existantes livrées par PR0 (title, beamColor?, haloColor?, angle?, intensity?, ...)
  usePreset?: boolean;
}

// Dans le corps du composant :
export const BeamCard: React.FC<BeamCardProps> = ({
  usePreset = false,
  beamColor,
  haloColor,
  angle,
  intensity,
  ...rest
}) => {
  const { preset } = useAmbientLighting();

  const resolvedBeamColor =
    usePreset && !beamColor
      ? `rgb(${preset.beam.color[0]}, ${preset.beam.color[1]}, ${preset.beam.color[2]})`
      : (beamColor ?? PR0_DEFAULT_BEAM_COLOR);
  const resolvedHaloColor =
    usePreset && !haloColor
      ? `rgba(${preset.beam.color[0]}, ${preset.beam.color[1]}, ${preset.beam.color[2]}, 0.3)`
      : (haloColor ?? PR0_DEFAULT_HALO_COLOR);
  const resolvedAngle =
    usePreset && angle === undefined ? preset.beam.angleDeg : (angle ?? 0);
  const resolvedIntensity =
    usePreset && intensity === undefined
      ? preset.beam.opacity
      : (intensity ?? 0.5);

  // ... reste du code BeamCard inchangé, utilisant resolved* à la place des defaults
  // S'assurer qu'un élément interne du beam porte data-testid="beam-card-beam".
};
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "BeamCard"
```

3 tests verts.

**Step 5: Commit**

```
feat(extension): wire BeamCard to AmbientLightingContext

Adds optional `usePreset?: boolean` prop. When true and a Provider is in
scope, BeamCard reads beamColor/haloColor/angle/intensity from the current
ambient preset instead of its hard-coded defaults. Back-compat: static
defaults are unchanged for existing call sites.

This commit is REVERT-FRIENDLY — it touches only BeamCard.tsx (and its
test). If PR0's BeamCard implementation changes upstream, this commit
can be reverted with `git revert <hash>` without disturbing the rest of
PR4.
```

#### Version B — PR0 pas encore mergée

Si BeamCard absent, créer un stub minimal `BeamCard.tsx` documenté comme placeholder, dans un commit isolé. Au merge de PR0, ce stub sera écrasé par leur implémentation et le BeamCard wiring sera reposé via `git cherry-pick` du commit de Version A. Documenter ce choix dans le message de commit.

---

### Task 14 — Bundle assertion : size-limit configuré

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\.size-limit.json`
- `C:\Users\33667\DeepSight-Main\extension\package.json`
- `C:\Users\33667\DeepSight-Main\extension\__tests__\build\size-limit.test.ts`

**Step 1: Write the failing test**

Créer `C:\Users\33667\DeepSight-Main\extension\__tests__\build\size-limit.test.ts` :

```ts
import fs from "fs";
import path from "path";

describe(".size-limit.json", () => {
  it("exists", () => {
    const p = path.resolve(__dirname, "../../.size-limit.json");
    expect(fs.existsSync(p)).toBe(true);
  });

  it("declares budgets for sidepanel.js and viewer.js", () => {
    const p = path.resolve(__dirname, "../../.size-limit.json");
    const config = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(Array.isArray(config)).toBe(true);
    const names = config.map((entry: any) => entry.name);
    expect(names).toContain("sidepanel.js");
    expect(names).toContain("viewer.js");
  });

  it("budget for each entry is below MV3 1MB hard cap", () => {
    const p = path.resolve(__dirname, "../../.size-limit.json");
    const config = JSON.parse(fs.readFileSync(p, "utf8"));
    const parseLimit = (s: string): number => {
      const m = /^(\d+(?:\.\d+)?)\s*(KB|MB)?$/i.exec(s.trim());
      if (!m) return Number.MAX_SAFE_INTEGER;
      const v = parseFloat(m[1]);
      return m[2]?.toUpperCase() === "MB" ? v * 1024 * 1024 : v * 1024;
    };
    config.forEach((entry: any) => {
      expect(parseLimit(entry.limit)).toBeLessThan(1024 * 1024);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "build/size-limit"
```

Fichier absent.

**Step 3: Write minimal implementation**

Créer `C:\Users\33667\DeepSight-Main\extension\.size-limit.json` :

```json
[
  {
    "name": "sidepanel.js",
    "path": "dist/sidepanel.js",
    "limit": "350 KB",
    "running": false,
    "gzip": false
  },
  {
    "name": "viewer.js",
    "path": "dist/viewer.js",
    "limit": "260 KB",
    "running": false,
    "gzip": false
  },
  {
    "name": "background.js",
    "path": "dist/background.js",
    "limit": "180 KB",
    "running": false,
    "gzip": false
  }
]
```

Mettre à jour `package.json` (extraits) :

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "size": "size-limit",
    "size:why": "size-limit --why",
    "test": "jest"
  },
  "devDependencies": {
    "size-limit": "^11.1.4",
    "@size-limit/preset-app": "^11.1.4"
  }
}
```

Ensuite installer :

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm install --save-dev size-limit @size-limit/preset-app
```

**Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run test -- "build/size-limit"
```

3 tests verts. Ensuite (manuellement après un `npm run build`) :

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run build && npm run size
```

Doit passer sous les budgets.

**Step 5: Commit**

```
feat(extension): add size-limit budgets for ambient lighting v3

Enforces bundle ceilings to detect regressions:
- sidepanel.js < 350KB
- viewer.js < 260KB
- background.js < 180KB

All entries comfortably under the MV3 1MB extension page hard cap. Run
`npm run size` after build, `npm run size:why` to inspect what's heavy.
```

---

### Task 15 — Vérification non-régression : full Jest suite + build smoke

**Files:** aucun (commande seulement)

**Step 1: Write the failing test** — n/a (aggregate)

**Step 2: Run test to verify it fails** — n/a

**Step 3: Smoke commands**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npm run typecheck && npm run test && npm run build
```

Si `typecheck` échoue : zéro `any`, vérifier les imports type-only de `AmbientPreset`.
Si `test` échoue : voir le test qui régresse, fix.
Si `build` échoue : copy-webpack-plugin doit avoir `noErrorOnMissing: true` sur `assets/ambient` tant que les sprites ne sont pas dans le repo (dépendance PR1).

**Step 4: Verify dist outputs**

```bash
ls "C:/Users/33667/DeepSight-Main/extension/dist/" | grep -E "sidepanel|viewer|assets"
```

Doit lister : `sidepanel.html`, `sidepanel.js`, `sidepanel.css`, `viewer.html`, `viewer.js`, `viewer.css`, `assets/`.

Inspecter les 2 HTML pour le critical CSS :

```bash
grep -c "ambient-critical" "C:/Users/33667/DeepSight-Main/extension/dist/sidepanel.html"
grep -c "ambient-critical" "C:/Users/33667/DeepSight-Main/extension/dist/viewer.html"
```

Doivent retourner `1` chacun.

**Step 5: Commit** — n/a (no file change)

> Note : ce n'est pas un commit. C'est une checklist de verification que l'agent doit cocher manuellement avant de pousser la branche.

---

### Task 16 — Reload Chrome + smoke visuel

**Files:** aucun

**Step 1-4:** demander à l'utilisateur de :

1. Ouvrir `chrome://extensions`
2. Activer le mode développeur si nécessaire
3. Cliquer sur le bouton refresh de la card DeepSight (ou « Charger l'extension non empaquetée » et sélectionner `C:\Users\33667\DeepSight-Main\extension\dist`)
4. Cliquer sur l'icône DeepSight pour ouvrir le sidepanel → vérifier visuellement :
   - Beam visible derrière le contenu (très subtil, opacité < 22%)
   - Tournesol mascot bottom-right (76px, sprite WebP — gros doré le matin/midi, plus orange en fin d'après-midi, bleu glowing la nuit)
   - Aucun layer ne capture les clics (le bouton « Analyser » et autres restent cliquables)
5. Ouvrir une analyse complète via le viewer → vérifier idem (mascot 96px, 3 overlays + tournesol visible)

**Step 5: Commit** — n/a

---

### Task 17 — Documentation mise à jour : `extension/CLAUDE.md`

**Files:**

- `C:\Users\33667\DeepSight-Main\extension\CLAUDE.md`

**Step 1: Write the failing test** — n/a (doc only)

**Step 2: Run test to verify it fails** — n/a

**Step 3: Implementation**

Ajouter une section dans `extension/CLAUDE.md` sous "Structure src/" :

```markdown
## Ambient Lighting v3 (PR4)

Chaque entry HTML active (sidepanel, viewer) wrap son App.tsx avec un
`<AmbientLightingProvider>` local qui fournit le preset depuis
`@deepsight/lighting-engine` (refresh 60s sidepanel, 30s viewer).

- Provider sidepanel : `src/sidepanel/contexts/AmbientLightingContext.tsx`
- Provider viewer : `src/viewer/contexts/AmbientLightingContext.tsx`
- Layers :
  - Sidepanel : `shared/AmbientLightLayer.tsx` (beam + sun/moon, opacité capée à 22%)
  - Viewer : `components/AmbientLightLayer.tsx` (gradient + beam + sun/moon, fullscreen)
- Mascots :
  - Sidepanel : `components/SunflowerLayer.tsx` (76px bottom-right)
  - Viewer : `components/SunflowerLayer.tsx` (96px bottom-right)

Sprites WebP : copiés depuis `public/assets/ambient/sunflower-{day,night}.webp` vers
`dist/assets/ambient/` par copy-webpack-plugin (PR1 livre les sprites).

Critical CSS : injecté en `<head>` de `sidepanel.html` et `viewer.html` par
`scripts/critical-css-plugin.js` au build — le rayon est visible avant
hydratation Preact.

Bundle budgets (`.size-limit.json`) :

- sidepanel.js < 350KB
- viewer.js < 260KB
- background.js < 180KB

Tous les overlays sont `aria-hidden="true"` + `pointer-events: none`.
Aucun toggle UI dans l'extension : la pref vient du backend via AuthContext.

Pas de popup actif (manifest sidepanel-only depuis PR0 sidepanel-v3).
```

**Step 4: Verification** — n/a (doc)

**Step 5: Commit**

```
docs(extension): document AmbientLighting v3 architecture

Adds a section to extension/CLAUDE.md covering Provider/Layer placement,
sprite copy pipeline, critical CSS injection, bundle budgets, and the
absence of a popup entry.
```

---

### Task 18 — PR description finale + branche

**Files:** aucun fichier de code, seulement le `gh pr create`

**Step 1-4:** créer la PR :

```bash
cd C:/Users/33667/DeepSight-Main && gh pr create \
  --base main \
  --head feat/ambient-lighting-v3-extension \
  --title "feat(extension): ambient lighting v3 — sidepanel + viewer" \
  --body "$(cat <<'EOF'
## Summary

PR4 du roadmap ambient-lighting-v3 (cf. spec `docs/superpowers/specs/2026-04-26-ambient-lighting-v3-design.md` §6.3 + §14).

- Sortie d'orphelinat des composants `AmbientLightLayer` (sidepanel + viewer) sur la branche `feat/voice-mobile-final` — désormais montés à la racine de chaque App
- Nouveaux composants : `SunflowerLayer` (76px sidepanel, 96px viewer), `AmbientLightingContext` + Provider local par entry
- Webpack : copy-webpack-plugin pour `public/assets/ambient/*.webp` → `dist/assets/ambient/`, HtmlWebpackPlugin pour `viewer.html`, plugin maison `CriticalCssPlugin` pour injection `<style id="ambient-critical">` dans `<head>` (rayon visible avant hydratation Preact)
- Bundle assertions : `size-limit` configuré, `sidepanel.js < 350KB`, `viewer.js < 260KB`
- Coordination PR0 : `BeamCard` accepte une prop optionnelle `usePreset?: boolean = false` (commit isolé revert-friendly)
- Pas de popup : le manifest est sidepanel-only depuis PR0 sidepanel-v3

## Dépendances

- **PR1 mergée** : sprites WebP committés dans `extension/public/assets/ambient/`, engine v3 avec `nightMode`/`frameIndex` exposés
- **PR0 souhaitée mergée** : sinon Task 13 (BeamCard wiring) crée un stub revert-friendly

## Test plan

- [ ] `npm run typecheck` (extension)
- [ ] `npm run test` (extension) — full suite verte, incluant les 9 nouveaux tests Jest
- [ ] `npm run build` (extension) — dist/sidepanel.html et dist/viewer.html contiennent `<style id="ambient-critical">`
- [ ] `npm run size` (extension) — budgets respectés
- [ ] Reload manuel `chrome://extensions` : beam + tournesol visibles dans sidepanel et viewer, aucun click capturé
- [ ] WCAG contrast textes : `aria-hidden=true` partout, `pointer-events:none` partout

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 5: Commit** — n/a (PR seulement)

---

## Risques et mitigations

| Risque                                             | Mitigation                                                                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR1 pas encore mergée (sprites absents)            | `copy-webpack-plugin` patterns avec `noErrorOnMissing: true`. Build passe, sprites apparaîtront 404 en runtime jusqu'à PR1 — les CSS gradients fonctionnent quand même. |
| PR0 pas encore mergée (BeamCard absent)            | Task 13 a deux versions documentées : version A si présent (modification chirurgicale), version B si absent (stub adaptable, commit isolé revert-friendly).             |
| Critical CSS plugin charge l'engine au build       | Try/catch silencieux + fallback preset neutre (zénith blanc) — le build ne casse jamais.                                                                                |
| Bundle popup explose (>1MB)                        | N/A — pas de popup actif. Si l'utilisateur veut un popup FF/Safari plus tard, scope d'une PR séparée (et créer le composant minimaliste en suivant le même pattern).    |
| Doublon `sidepanel` entry du webpack source actuel | Fix dans Task 1 (un seul `sidepanel: "./src/sidepanel/index.tsx"`) — détecté par le test webpack-config.                                                                |
| Régression test existants (`App.test.tsx`)         | Le mock `@deepsight/lighting-engine` doit être ajouté au `jest.setup.js` global OU à chaque test impacté. Préférer l'option locale (mock par fichier de test).          |
| Reading-zone glare dans le sidepanel 380×600       | `BEAM_OPACITY_CAP = 0.22` dans `AmbientLightLayer` sidepanel — preset peut atteindre 0.95 mais le composant cap.                                                        |
| Cross-fade frame qui flicker au mount initial      | `useState` initial = `frameIndex` (pas 0), donc pas de transition au mount. Le `useEffect` ne déclenche le cross-fade que quand `frameIndex` change effectivement.      |
| `getComputedStyle` retourne valeur vide en jsdom   | Les tests de `pointerEvents` peuvent avoir besoin d'asserter via `style.pointerEvents` direct au lieu de `getComputedStyle`. Vérifier au step 2 de chaque test.         |

---

## Coordination cross-PR — résumé

```
PR1 (lighting-engine v3 + sprites + tokens shift)
   └── DOIT être mergée AVANT cette PR4
       (sprites présents, AmbientPreset.nightMode/frameIndex disponibles, tokens shift)

PR0 (extension-sidepanel-v3 — livre <BeamCard>)
   └── SOUHAITÉE mergée avant Task 13
       Si non, Task 13 crée stub revert-friendly. Commit isolé pour cherry-pick post-merge PR0.

PR4 (cette PR)
   └── INDÉPENDANTE de PR2 (web) et PR3 (mobile)
       Peut tourner en parallèle. Les seules collisions possibles sont sur PR1
       (sprites) — toutes les 3 PRs (2/3/4) en dépendent.

Reload Chrome obligatoire après merge — rappel utilisateur final.
```

---

## Definition of Done

- [ ] 18 commits atomiques poussés sur `feat/ambient-lighting-v3-extension`
- [ ] `npm run typecheck` (extension) — vert, zéro `any` ajouté
- [ ] `npm run test` (extension) — full suite verte (9 nouveaux fichiers de test + tous les existants)
- [ ] `npm run build` (extension) — produit `dist/sidepanel.html`, `dist/viewer.html` avec critical CSS, `dist/assets/ambient/sunflower-{day,night}.webp` (si PR1 mergée)
- [ ] `npm run size` (extension) — tous les budgets respectés
- [ ] PR ouverte avec body conforme (Task 18)
- [ ] Visual smoke test reload Chrome : beam + tournesol visibles, aucun clic capturé, pas de régression sur le toast/login/main flow
- [ ] BeamCard wiring (Task 13) : commit isolé `feat(extension): wire BeamCard to AmbientLightingContext` — peut être revert seul

---

## Recap chiffré

- **Tasks** : 18 (16 avec commit + 2 sans : verification + reload)
- **Commits attendus** : ~17 (selon version A/B de Task 13)
- **Fichiers créés** : 11 (4 sidepanel, 4 viewer, 1 webpack plugin, 1 size-limit, 1 doc update virtuel via Task 17)
- **Fichiers modifiés** : 6 (`webpack.config.js`, `package.json`, `App.tsx` sidepanel, `ViewerApp.tsx`, `AmbientLightLayer` sidepanel + viewer, `BeamCard.tsx` si PR0)
- **Tests créés** : 9 fichiers Jest
- **Bundle** : sidepanel < 350KB, viewer < 260KB (assertions automatisées via size-limit)
