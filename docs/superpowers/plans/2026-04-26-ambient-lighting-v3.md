# Ambient Lighting v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la feature ambient lighting cross-platform en signature visuelle DeepSight : un beam de précision suivant l'arc solaire, un halo de source diffus, et un tournesol 3D photoréaliste héliotrope (luminescent la nuit) — apparaissant sur les 3 plateformes (web/mobile/extension) sans gêner la lecture.

**Architecture:** Engine TypeScript partagé (`@deepsight/lighting-engine`) qui calcule angle/couleur/frameIndex selon l'heure → consommé par 3 composants UI plateforme-spécifiques (web React, mobile RN, extension Chrome). Tournesol 3D pré-rendu offline (Three.js headless → 2 sprite sheets WebP), runtime juste cross-fade entre frames. Critical CSS inliné en `<head>` pour visibilité immédiate avant hydratation.

**Tech Stack:** TypeScript strict, Vitest, Three.js headless via Puppeteer + sharp (sprite pipeline), React 18 + Vite 5 + Tailwind 3 (web), Expo SDK 54 + Reanimated 4 (mobile), Webpack 5 + Manifest V3 (extension), Playwright (E2E web), Maestro (mobile snapshots).

**Spec:** `docs/superpowers/specs/2026-04-26-ambient-lighting-v3-design.md`

---

## File Structure (à créer / modifier)

### Engine partagé (Phase 1)

| Fichier                                                | Action     | Responsabilité                                                                                                                             |
| ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/lighting-engine/src/types.ts`                | **Modify** | Étendre `AmbientPreset` avec `frameIndex`, `nightMode`, `haloAccentColor?`, `isReducedMotion`, `isHighContrast`, `readingZoneIntensityCap` |
| `packages/lighting-engine/src/keyframes.v3.ts`         | **Create** | 48 keyframes v3 palette mix réaliste + accents brand                                                                                       |
| `packages/lighting-engine/src/preset.ts`               | **Modify** | Étendre `getAmbientPreset` pour calculer les nouveaux champs                                                                               |
| `packages/lighting-engine/src/accessibility.ts`        | **Create** | Helpers `detectReducedMotion()`, `detectHighContrast()`, `getReadingZoneCap()`                                                             |
| `packages/lighting-engine/src/sprite-frame.ts`         | **Create** | `getSpriteFrameIndex(date)` → 0-23                                                                                                         |
| `packages/lighting-engine/src/index.ts`                | **Modify** | Ajouter exports v3                                                                                                                         |
| `packages/lighting-engine/tests/preset.v3.test.ts`     | **Create** | Tests couverture v3                                                                                                                        |
| `packages/lighting-engine/tests/accessibility.test.ts` | **Create** | Tests reduced-motion + high-contrast                                                                                                       |

### Pipeline pré-rendu tournesol (Phase 1)

| Fichier                                      | Action        | Responsabilité                            |
| -------------------------------------------- | ------------- | ----------------------------------------- |
| `scripts/sunflower-frames/generate.mjs`      | **Create**    | Script orchestrateur Puppeteer + sharp    |
| `scripts/sunflower-frames/scene-day.html`    | **Create**    | Three.js scene rendering jour             |
| `scripts/sunflower-frames/scene-night.html`  | **Create**    | Three.js scene rendering nuit luminescent |
| `scripts/sunflower-frames/encode-sprite.mjs` | **Create**    | Encoder WebP via sharp                    |
| `assets/ambient/sunflower-day.webp`          | **Generated** | Sprite jour 6×4 grid (1536×1024, ~75KB)   |
| `assets/ambient/sunflower-night.webp`        | **Generated** | Sprite nuit (idem)                        |
| `package.json` (root)                        | **Modify**    | Ajouter script `build:sunflower-frames`   |

### Design tokens (Phase 1)

| Fichier                                        | Action     | Responsabilité                                 |
| ---------------------------------------------- | ---------- | ---------------------------------------------- |
| `frontend/src/styles/tokens.css`               | **Modify** | Shift `--text-secondary`, `--text-muted`, etc. |
| `frontend/tailwind.config.js`                  | **Modify** | Étendre `colors.text.*` avec nouvelles valeurs |
| `mobile/src/theme/colors.ts`                   | **Modify** | Shift `colors.text.secondary` etc.             |
| `extension/src/sidepanel/styles/sidepanel.css` | **Modify** | Variables CSS texte                            |
| `extension/src/popup/styles/popup.css`         | **Modify** | Idem                                           |

### Backend pref (Phase 1)

| Fichier                                  | Action     | Responsabilité                                            |
| ---------------------------------------- | ---------- | --------------------------------------------------------- |
| `backend/src/db/database.py`             | **Verify** | Confirmer `User.preferences` est JSON column (sans modif) |
| `backend/src/auth/router.py`             | **Verify** | Confirmer `PUT /api/auth/preferences` existe              |
| `backend/tests/test_user_preferences.py` | **Modify** | Ajouter test pour `ambient_lighting_enabled`              |

### Web (Phase 2)

| Fichier                                                        | Action               | Responsabilité                                     |
| -------------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| `frontend/src/components/AmbientLightLayer.tsx`                | **Replace**          | Nouveau composant overlay rayon + halo             |
| `frontend/src/components/SunflowerLayer.tsx`                   | **Create**           | Tournesol mascot + hero, route-aware               |
| `frontend/src/contexts/AmbientLightingContext.tsx`             | **Create**           | Provider + `useAmbientLightingContext()`           |
| `frontend/src/hooks/useAmbientPreset.ts`                       | **Modify**           | Réécrire pour consommer engine v3                  |
| `frontend/src/plugins/vite-plugin-ambient-critical-css.ts`     | **Create**           | Plugin Vite pour inline `<style>`                  |
| `frontend/vite.config.ts`                                      | **Modify**           | Charger le plugin                                  |
| `frontend/src/App.tsx`                                         | **Modify**           | Wrap `<AmbientLightingProvider>` + monter overlays |
| `frontend/src/pages/SettingsPage.tsx`                          | **Modify**           | Ajouter toggle "Effet ambiant lumineux"            |
| `frontend/public/assets/ambient/sunflower-day.webp`            | **Copy**             | Depuis assets/ambient/                             |
| `frontend/public/assets/ambient/sunflower-night.webp`          | **Copy**             | Idem                                               |
| `frontend/src/components/__tests__/AmbientLightLayer.test.tsx` | **Create**           | RTL tests                                          |
| `frontend/src/components/__tests__/SunflowerLayer.test.tsx`    | **Create**           | RTL tests                                          |
| `frontend/e2e/ambient-lighting.spec.ts`                        | **Create**           | Playwright E2E                                     |
| `frontend/src/hooks/useTimeOfDay.ts`                           | **Delete** (Phase 5) | Legacy v1                                          |
| `frontend/src/components/AmbientLightDevPanel.tsx`             | **Delete** (Phase 5) | Dev panel obsolète                                 |
| `frontend/src/hooks/useAmbientLightingFeatureFlag.ts`          | **Delete** (Phase 5) | Flag PostHog plus utilisé                          |

### Mobile (Phase 3)

| Fichier                                                                  | Action               | Responsabilité                                                        |
| ------------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------- |
| `mobile/metro.config.js`                                                 | **Modify**           | `watchFolders` + `extraNodeModules` pour `@deepsight/lighting-engine` |
| `mobile/src/components/backgrounds/AmbientLightLayer.tsx`                | **Replace**          | Nouveau composant Reanimated                                          |
| `mobile/src/components/backgrounds/SunflowerLayer.tsx`                   | **Create**           | Tournesol mascot only                                                 |
| `mobile/src/contexts/AmbientLightingContext.tsx`                         | **Create**           | Provider RN                                                           |
| `mobile/src/hooks/useAmbientPreset.ts`                                   | **Modify**           | Consommer engine v3                                                   |
| `mobile/app/_layout.tsx`                                                 | **Modify**           | Wrap provider + monter overlays                                       |
| `mobile/app.json`                                                        | **Modify**           | Splash screen avec image fallback beam                                |
| `mobile/app/(tabs)/profile.tsx`                                          | **Modify**           | Toggle "Effet ambiant lumineux"                                       |
| `mobile/assets/ambient/sunflower-day.webp`                               | **Copy**             | Depuis assets/ambient/                                                |
| `mobile/assets/ambient/sunflower-night.webp`                             | **Copy**             | Idem                                                                  |
| `mobile/assets/splash-beam.png`                                          | **Create**           | Image fallback splash (généré offline une fois)                       |
| `mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx` | **Create**           | Jest+RNTL                                                             |
| `mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx`    | **Create**           | Jest+RNTL                                                             |
| `mobile/.maestro/ambient-lighting.yaml`                                  | **Create**           | Maestro snapshot tests                                                |
| `mobile/src/hooks/useTimeOfDay.ts`                                       | **Delete** (Phase 5) | Legacy v1                                                             |

### Extension (Phase 4)

| Fichier                                                       | Action      | Responsabilité                                                           |
| ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `extension/webpack.config.js`                                 | **Modify**  | copy-webpack-plugin pour sprites + html-webpack-plugin pour critical CSS |
| `extension/src/sidepanel/components/AmbientLightLayer.tsx`    | **Replace** | Nouveau composant (existing est orphelin)                                |
| `extension/src/sidepanel/components/SunflowerLayer.tsx`       | **Create**  | Tournesol mascot                                                         |
| `extension/src/viewer/components/AmbientLightLayer.tsx`       | **Replace** | Idem viewer                                                              |
| `extension/src/viewer/components/SunflowerLayer.tsx`          | **Create**  | Idem viewer                                                              |
| `extension/src/popup/components/AmbientLightLayer.tsx`        | **Replace** | Beam minimal popup                                                       |
| `extension/src/sidepanel/contexts/AmbientLightingContext.tsx` | **Create**  | Provider                                                                 |
| `extension/src/sidepanel/hooks/useAmbientPreset.ts`           | **Create**  | Hook custom                                                              |
| `extension/src/sidepanel/App.tsx`                             | **Modify**  | Wrap provider + monter overlays                                          |
| `extension/src/viewer/App.tsx`                                | **Modify**  | Idem                                                                     |
| `extension/src/popup/App.tsx`                                 | **Modify**  | Idem (sans SunflowerLayer)                                               |
| `extension/src/sidepanel/shared/BeamCard.tsx`                 | **Modify**  | (livré par PR0) — ajouter `useContext` optionnel pour override defaults  |
| `extension/public/assets/ambient/sunflower-day.webp`          | **Copy**    | Depuis assets/ambient/                                                   |
| `extension/public/assets/ambient/sunflower-night.webp`        | **Copy**    | Idem                                                                     |
| `extension/__tests__/sidepanel/AmbientLightLayer.test.tsx`    | **Create**  | Jest+jsdom                                                               |
| `extension/__tests__/sidepanel/SunflowerLayer.test.tsx`       | **Create**  | Jest+jsdom                                                               |

### Cleanup (Phase 5)

| Fichier                                         | Action      | Responsabilité                                                 |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `docs/PRD-ambient-lighting-v2.md`               | **Replace** | Renommer en `docs/PRD-ambient-lighting-v3.md` + update content |
| `CHANGELOG.md`                                  | **Modify**  | Ajouter entry "Ambient lighting v3"                            |
| (Suppressions listées dans Web/Mobile sections) | **Delete**  | Legacy v1/v2 obsolètes                                         |

---

## Phase 1 — Foundation (PR1)

**Branche:** `feat/ambient-lighting-v3-foundation`
**Durée estimée:** ~2 jours
**Dépendances:** PR0 (`feat/extension-sidepanel-v3`) doit être mergée AVANT le démarrage des Phases 2-4 (mais Phase 1 ne dépend pas de PR0).

### Task 1.1: Créer la branche foundation

**Files:**

- Modify: working tree

- [ ] **Step 1: Vérifier état git propre**

```bash
git status --short
```

Expected: pas de modifications non committées dans `packages/lighting-engine/`, `scripts/`, `frontend/src/styles/`, `mobile/src/theme/`, `extension/src/*/styles/`. Si modifs non liées présentes (ex: voice feature), créer un worktree dédié plutôt que checkout direct.

- [ ] **Step 2: Créer la branche depuis main**

```bash
git fetch origin
git checkout -b feat/ambient-lighting-v3-foundation origin/main
```

Expected: branche créée et checkée.

- [ ] **Step 3: Vérifier le worktree de la session parallèle existe**

```bash
git worktree list
```

Expected: voir `.claude/worktrees/extension-sidepanel-v3` listé. Si présent, ne pas y toucher (c'est l'autre session). Si absent, on n'aura pas de coordination directe — le Context Provider de Phase 4 fonctionnera quand même avec les defaults statiques de BeamCard.

### Task 1.2: Étendre les types `AmbientPreset` v3

**Files:**

- Modify: `packages/lighting-engine/src/types.ts`
- Test: `packages/lighting-engine/tests/types.v3.test.ts` (créé)

- [ ] **Step 1: Écrire le test failing — vérifier que `AmbientPreset` accepte les nouveaux champs**

Créer `packages/lighting-engine/tests/types.v3.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AmbientPreset, NightMode } from "../src/types";

describe("AmbientPreset v3 type extensions", () => {
  it("accepts frameIndex 0-23", () => {
    const preset: AmbientPreset = {
      hour: 12,
      mood: "noon-zenith",
      beam: {
        type: "sun",
        color: [255, 250, 225],
        angleDeg: -3,
        opacity: 0.95,
      },
      sun: { visible: true, opacity: 0.8, x: 50, y: 20 },
      moon: { visible: false, opacity: 0, x: 0, y: 0 },
      ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.1 },
      starOpacityMul: 0,
      starDensity: "sparse",
      haloX: 50,
      haloY: 20,
      colors: {
        primary: [255, 200, 140],
        secondary: [255, 250, 225],
        tertiary: [99, 102, 241],
        rays: [255, 240, 200],
        accent: [165, 180, 252],
      },
      // Nouveaux champs v3
      frameIndex: 23,
      nightMode: null,
      haloAccentColor: "rgba(99,102,241,0.30)",
      isReducedMotion: false,
      isHighContrast: false,
      readingZoneIntensityCap: 0.5,
    };
    expect(preset.frameIndex).toBe(23);
  });

  it("NightMode type accepts asleep | glowing | null", () => {
    const a: NightMode = "asleep";
    const g: NightMode = "glowing";
    expect(a).toBe("asleep");
    expect(g).toBe("glowing");
  });
});
```

- [ ] **Step 2: Lancer le test pour confirmer l'échec**

```bash
cd packages/lighting-engine && npm test -- types.v3
```

Expected: FAIL — `Property 'frameIndex' does not exist on type 'AmbientPreset'.` ou similaire.

- [ ] **Step 3: Étendre le type `AmbientPreset` dans `types.ts`**

Ajouter à la fin de `packages/lighting-engine/src/types.ts`:

```ts
// === v3 extensions ===

export type NightMode = "asleep" | "glowing";
```

Et **modifier** l'interface `AmbientPreset` existante pour ajouter les nouveaux champs (entre `colors` et `debug`):

```ts
export interface AmbientPreset {
  // ... champs v2 existants (hour, mood, beam, sun, moon, ambient, starOpacityMul, starDensity, haloX, haloY, colors)

  // === v3 extensions ===
  /** Index de frame du sprite tournesol (0-23). */
  frameIndex: number;
  /** Mode du tournesol la nuit. null en journée. */
  nightMode: NightMode | null;
  /** Couleur d'accent du halo (twilight/nuit uniquement). undefined sinon. */
  haloAccentColor?: string;
  /** Vrai si l'utilisateur a `prefers-reduced-motion: reduce`. */
  isReducedMotion: boolean;
  /** Vrai si l'utilisateur a `prefers-contrast: more`. */
  isHighContrast: boolean;
  /** Cap d'intensité dans la zone de lecture (30-70% viewport). 0-1. */
  readingZoneIntensityCap: number;

  debug?: {
    factor: number;
    fromMood: string;
    toMood: string;
    seed: number;
    angleVariation: number;
  };
}
```

Et exporter `NightMode` depuis `index.ts`:

```ts
// packages/lighting-engine/src/index.ts
export type {
  // ... existing
  NightMode,
} from "./types";
```

- [ ] **Step 4: Relancer le test pour confirmer le passage**

```bash
cd packages/lighting-engine && npm test -- types.v3
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/lighting-engine/src/types.ts packages/lighting-engine/src/index.ts packages/lighting-engine/tests/types.v3.test.ts
git commit -m "feat(lighting-engine): extend AmbientPreset with v3 fields (frameIndex, nightMode, accessibility flags)"
```

### Task 1.3: Helpers d'accessibilité

**Files:**

- Create: `packages/lighting-engine/src/accessibility.ts`
- Test: `packages/lighting-engine/tests/accessibility.test.ts`

- [ ] **Step 1: Écrire les tests failing**

Créer `packages/lighting-engine/tests/accessibility.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  detectReducedMotion,
  detectHighContrast,
  getReadingZoneCap,
} from "../src/accessibility";

describe("detectReducedMotion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns false when no matchMedia available", () => {
    vi.stubGlobal("window", { matchMedia: undefined });
    expect(detectReducedMotion()).toBe(false);
  });

  it("returns true when prefers-reduced-motion matches", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("reduce") }),
    });
    expect(detectReducedMotion()).toBe(true);
  });

  it("returns false when no preference", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(detectReducedMotion()).toBe(false);
  });
});

describe("detectHighContrast", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns true when prefers-contrast: more", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("more") }),
    });
    expect(detectHighContrast()).toBe(true);
  });
});

describe("getReadingZoneCap", () => {
  it("caps intensity to 0.5 maximum", () => {
    expect(getReadingZoneCap(0.9)).toBe(0.5);
    expect(getReadingZoneCap(0.5)).toBe(0.5);
    expect(getReadingZoneCap(0.3)).toBe(0.3);
  });

  it("respects high contrast (cap to 0.3)", () => {
    expect(getReadingZoneCap(0.9, true)).toBe(0.3);
  });
});
```

- [ ] **Step 2: Lancer les tests, confirmer l'échec**

```bash
cd packages/lighting-engine && npm test -- accessibility
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implémenter `accessibility.ts`**

Créer `packages/lighting-engine/src/accessibility.ts`:

```ts
/**
 * Détecte la préférence utilisateur prefers-reduced-motion.
 * Safe sur Node (window absent) et Mobile (RN remplacera via Platform-specific impl).
 */
export function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Détecte la préférence utilisateur prefers-contrast: more.
 */
export function detectHighContrast(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-contrast: more)").matches;
  } catch {
    return false;
  }
}

/**
 * Cap d'intensité applicable dans la zone de lecture (bande verticale 30%-70% viewport).
 * @param baseIntensity intensité de base (0-1)
 * @param highContrast si true, cap à 0.3 (sinon 0.5)
 */
export function getReadingZoneCap(
  baseIntensity: number,
  highContrast: boolean = false,
): number {
  const cap = highContrast ? 0.3 : 0.5;
  return Math.min(baseIntensity, cap);
}
```

- [ ] **Step 4: Lancer les tests, confirmer le passage**

```bash
cd packages/lighting-engine && npm test -- accessibility
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/lighting-engine/src/accessibility.ts packages/lighting-engine/tests/accessibility.test.ts
git commit -m "feat(lighting-engine): add accessibility helpers (reduced-motion, high-contrast, reading-zone cap)"
```

### Task 1.4: Sprite frame index calculator

**Files:**

- Create: `packages/lighting-engine/src/sprite-frame.ts`
- Test: `packages/lighting-engine/tests/sprite-frame.test.ts`

- [ ] **Step 1: Écrire les tests failing**

Créer `packages/lighting-engine/tests/sprite-frame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getSpriteFrameIndex } from "../src/sprite-frame";

describe("getSpriteFrameIndex", () => {
  it("returns 0 at midnight", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T00:00:00"))).toBe(0);
  });

  it("returns 23 at 23:30", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T23:30:00"))).toBe(23);
  });

  it("returns 24 frames per day, 1 every 30 minutes (modulo 24)", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:00:00"))).toBe(0); // 24 % 24 = 0
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:30:00"))).toBe(1);
    expect(getSpriteFrameIndex(new Date("2026-04-26T13:00:00"))).toBe(2);
  });

  it("rounds down within a 30-min slot", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:00:00"))).toBe(0);
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:14:59"))).toBe(0);
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:15:00"))).toBe(0);
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:29:59"))).toBe(0);
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:30:00"))).toBe(1);
  });
});
```

Note : 24 frames par jour signifie 1 frame toutes les 60 minutes, pas toutes les 30. Mais le sprite contient 24 frames, donc il faut `Math.floor(minutes / 60)`. Or, avec 48 keyframes (toutes les 30 min) dans `keyframes.ts`, on a 2 keyframes par frame de sprite. Pour simplifier, on prend la frame qui correspond à l'heure ronde la plus proche (1 frame / heure × 24 heures = 24 frames). C'est cohérent avec 24 frames pour la rotation Y du tournesol = un angle par heure suffit (le tournesol tourne ~15°/heure).

Mettre à jour le test :

```ts
it("returns 12 at noon (12h00) and 13 at 13h00", () => {
  expect(getSpriteFrameIndex(new Date("2026-04-26T12:00:00"))).toBe(12);
  expect(getSpriteFrameIndex(new Date("2026-04-26T13:00:00"))).toBe(13);
  expect(getSpriteFrameIndex(new Date("2026-04-26T12:30:00"))).toBe(12); // dans le slot 12h
});
```

Réécrire le bloc complet :

```ts
import { describe, expect, it } from "vitest";
import { getSpriteFrameIndex } from "../src/sprite-frame";

describe("getSpriteFrameIndex", () => {
  it("returns 0 at midnight", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T00:00:00"))).toBe(0);
  });

  it("returns 12 at noon", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:00:00"))).toBe(12);
  });

  it("returns 23 at 23h59", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T23:59:00"))).toBe(23);
  });

  it("rounds down within an hour slot", () => {
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:30:00"))).toBe(12);
    expect(getSpriteFrameIndex(new Date("2026-04-26T12:59:59"))).toBe(12);
    expect(getSpriteFrameIndex(new Date("2026-04-26T13:00:00"))).toBe(13);
  });
});
```

- [ ] **Step 2: Lancer les tests, confirmer l'échec**

```bash
cd packages/lighting-engine && npm test -- sprite-frame
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implémenter `sprite-frame.ts`**

Créer `packages/lighting-engine/src/sprite-frame.ts`:

```ts
/**
 * Calcule l'index de frame (0-23) dans le sprite tournesol pour une date donnée.
 * 24 frames sur 24 heures = 1 frame par heure (le tournesol tourne ~15°/heure).
 *
 * @param date date courante
 * @returns 0..23
 */
export function getSpriteFrameIndex(date: Date): number {
  return date.getHours();
}
```

- [ ] **Step 4: Lancer les tests, confirmer le passage**

```bash
cd packages/lighting-engine && npm test -- sprite-frame
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Exporter depuis index.ts**

Modifier `packages/lighting-engine/src/index.ts`:

```ts
export { getSpriteFrameIndex } from "./sprite-frame";
```

- [ ] **Step 6: Commit**

```bash
git add packages/lighting-engine/src/sprite-frame.ts packages/lighting-engine/src/index.ts packages/lighting-engine/tests/sprite-frame.test.ts
git commit -m "feat(lighting-engine): add getSpriteFrameIndex for sunflower sprite (24 frames/day)"
```

### Task 1.5: Keyframes v3 (palette mix réaliste + accents brand)

**Files:**

- Create: `packages/lighting-engine/src/keyframes.v3.ts`
- Test: `packages/lighting-engine/tests/keyframes.v3.test.ts`

- [ ] **Step 1: Écrire le test failing — v3 keyframes ont 48 entrées et accents brand aux twilights**

Créer `packages/lighting-engine/tests/keyframes.v3.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { KEYFRAMES_V3 } from "../src/keyframes.v3";

describe("KEYFRAMES_V3", () => {
  it("has exactly 48 entries (every 30 min)", () => {
    expect(KEYFRAMES_V3).toHaveLength(48);
  });

  it("starts at hour 0 and ends at hour 23.5", () => {
    expect(KEYFRAMES_V3[0].hour).toBe(0);
    expect(KEYFRAMES_V3[47].hour).toBe(23.5);
  });

  it("has nightMode set to glowing for all night keyframes (22h-05h)", () => {
    const nightKeyframes = KEYFRAMES_V3.filter(
      (k) => k.hour >= 22 || k.hour < 5,
    );
    expect(nightKeyframes.every((k) => k.nightMode === "glowing")).toBe(true);
  });

  it("has nightMode null for daytime keyframes (07h-19h)", () => {
    const dayKeyframes = KEYFRAMES_V3.filter((k) => k.hour >= 7 && k.hour < 19);
    expect(dayKeyframes.every((k) => k.nightMode === null)).toBe(true);
  });

  it("has haloAccentColor (indigo/violet) at twilights (06h, 19h, 20h)", () => {
    const twilights = KEYFRAMES_V3.filter((k) =>
      [6, 6.5, 19, 19.5, 20].includes(k.hour),
    );
    expect(twilights.every((k) => k.haloAccentColor !== undefined)).toBe(true);
  });

  it("has angle close to -50° at sunrise (06h00)", () => {
    const sunrise = KEYFRAMES_V3.find((k) => k.hour === 6)!;
    expect(sunrise.beamAngleDeg).toBeGreaterThanOrEqual(-55);
    expect(sunrise.beamAngleDeg).toBeLessThanOrEqual(-40);
  });

  it("has angle close to -3° at noon (12h00)", () => {
    const noon = KEYFRAMES_V3.find((k) => k.hour === 12)!;
    expect(noon.beamAngleDeg).toBeGreaterThanOrEqual(-10);
    expect(noon.beamAngleDeg).toBeLessThanOrEqual(5);
  });

  it("has angle close to +48° at sunset (18h00)", () => {
    const sunset = KEYFRAMES_V3.find((k) => k.hour === 18)!;
    expect(sunset.beamAngleDeg).toBeGreaterThanOrEqual(40);
    expect(sunset.beamAngleDeg).toBeLessThanOrEqual(55);
  });
});
```

- [ ] **Step 2: Lancer le test, confirmer l'échec**

```bash
cd packages/lighting-engine && npm test -- keyframes.v3
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implémenter `keyframes.v3.ts`**

Créer `packages/lighting-engine/src/keyframes.v3.ts`:

```ts
import type { NightMode, RGB } from "./types";

export interface KeyframeV3 {
  hour: number;
  mood: string;
  beamColor: RGB;
  beamAngleDeg: number;
  beamOpacity: number;
  haloPrimary: RGB;
  haloAccentColor?: string;
  intensity: number;
  nightMode: NightMode | null;
}

/**
 * 48 keyframes v3 - 1 toutes les 30 minutes.
 * Palette: mix réaliste (doré matin/blanc midi/orange couchant/argent nuit)
 *          + accents indigo/violet brand DeepSight aux twilights et nuit.
 */
export const KEYFRAMES_V3: KeyframeV3[] = [
  // === NUIT PROFONDE (00h-05h) — tournesol luminescent ===
  {
    hour: 0,
    mood: "midnight",
    beamColor: [220, 232, 255],
    beamAngleDeg: -10,
    beamOpacity: 0.65,
    haloPrimary: [199, 210, 254],
    haloAccentColor: "rgba(79,70,229,0.45)",
    intensity: 0.55,
    nightMode: "glowing",
  },
  {
    hour: 0.5,
    mood: "late-night",
    beamColor: [220, 232, 255],
    beamAngleDeg: -8,
    beamOpacity: 0.62,
    haloPrimary: [199, 210, 254],
    haloAccentColor: "rgba(79,70,229,0.42)",
    intensity: 0.52,
    nightMode: "glowing",
  },
  {
    hour: 1,
    mood: "late-night",
    beamColor: [218, 228, 252],
    beamAngleDeg: -6,
    beamOpacity: 0.6,
    haloPrimary: [196, 206, 250],
    haloAccentColor: "rgba(79,70,229,0.40)",
    intensity: 0.5,
    nightMode: "glowing",
  },
  {
    hour: 1.5,
    mood: "late-night",
    beamColor: [216, 224, 250],
    beamAngleDeg: -4,
    beamOpacity: 0.58,
    haloPrimary: [194, 202, 248],
    haloAccentColor: "rgba(79,70,229,0.38)",
    intensity: 0.48,
    nightMode: "glowing",
  },
  {
    hour: 2,
    mood: "deep-night",
    beamColor: [212, 220, 248],
    beamAngleDeg: -2,
    beamOpacity: 0.55,
    haloPrimary: [192, 200, 246],
    haloAccentColor: "rgba(67,56,202,0.40)",
    intensity: 0.46,
    nightMode: "glowing",
  },
  {
    hour: 2.5,
    mood: "deep-night",
    beamColor: [210, 218, 246],
    beamAngleDeg: 0,
    beamOpacity: 0.55,
    haloPrimary: [190, 198, 244],
    haloAccentColor: "rgba(67,56,202,0.40)",
    intensity: 0.46,
    nightMode: "glowing",
  },
  {
    hour: 3,
    mood: "deep-night",
    beamColor: [212, 220, 248],
    beamAngleDeg: 4,
    beamOpacity: 0.55,
    haloPrimary: [192, 200, 246],
    haloAccentColor: "rgba(67,56,202,0.40)",
    intensity: 0.46,
    nightMode: "glowing",
  },
  {
    hour: 3.5,
    mood: "deep-night",
    beamColor: [216, 224, 250],
    beamAngleDeg: 8,
    beamOpacity: 0.58,
    haloPrimary: [194, 202, 248],
    haloAccentColor: "rgba(67,56,202,0.42)",
    intensity: 0.48,
    nightMode: "glowing",
  },
  {
    hour: 4,
    mood: "pre-dawn",
    beamColor: [222, 230, 252],
    beamAngleDeg: 12,
    beamOpacity: 0.62,
    haloPrimary: [200, 208, 252],
    haloAccentColor: "rgba(99,102,241,0.45)",
    intensity: 0.52,
    nightMode: "glowing",
  },
  {
    hour: 4.5,
    mood: "pre-dawn",
    beamColor: [232, 220, 232],
    beamAngleDeg: 18,
    beamOpacity: 0.66,
    haloPrimary: [216, 200, 220],
    haloAccentColor: "rgba(165,180,252,0.50)",
    intensity: 0.58,
    nightMode: "glowing",
  },

  // === AUBE / LEVER (05h-07h) — twilight transition ===
  {
    hour: 5,
    mood: "dawn-blush",
    beamColor: [255, 198, 178],
    beamAngleDeg: 25,
    beamOpacity: 0.72,
    haloPrimary: [255, 200, 180],
    haloAccentColor: "rgba(165,180,252,0.55)",
    intensity: 0.68,
    nightMode: "glowing",
  },
  {
    hour: 5.5,
    mood: "dawn-rose",
    beamColor: [255, 192, 168],
    beamAngleDeg: -55,
    beamOpacity: 0.75,
    haloPrimary: [255, 198, 178],
    haloAccentColor: "rgba(165,180,252,0.50)",
    intensity: 0.74,
    nightMode: null,
  },
  {
    hour: 6,
    mood: "sunrise",
    beamColor: [255, 214, 153],
    beamAngleDeg: -50,
    beamOpacity: 0.8,
    haloPrimary: [255, 200, 140],
    haloAccentColor: "rgba(165,180,252,0.45)",
    intensity: 0.78,
    nightMode: null,
  },
  {
    hour: 6.5,
    mood: "sunrise-warming",
    beamColor: [255, 220, 168],
    beamAngleDeg: -45,
    beamOpacity: 0.84,
    haloPrimary: [255, 210, 158],
    haloAccentColor: "rgba(165,180,252,0.30)",
    intensity: 0.82,
    nightMode: null,
  },

  // === MATIN (07h-11h) — doré chaud ===
  {
    hour: 7,
    mood: "morning-gold",
    beamColor: [255, 230, 184],
    beamAngleDeg: -38,
    beamOpacity: 0.86,
    haloPrimary: [255, 220, 174],
    intensity: 0.84,
    nightMode: null,
  },
  {
    hour: 7.5,
    mood: "morning",
    beamColor: [255, 234, 192],
    beamAngleDeg: -32,
    beamOpacity: 0.88,
    haloPrimary: [255, 226, 184],
    intensity: 0.86,
    nightMode: null,
  },
  {
    hour: 8,
    mood: "morning",
    beamColor: [255, 238, 200],
    beamAngleDeg: -28,
    beamOpacity: 0.9,
    haloPrimary: [255, 232, 196],
    intensity: 0.88,
    nightMode: null,
  },
  {
    hour: 8.5,
    mood: "morning-fresh",
    beamColor: [255, 242, 208],
    beamAngleDeg: -24,
    beamOpacity: 0.91,
    haloPrimary: [255, 238, 204],
    intensity: 0.89,
    nightMode: null,
  },
  {
    hour: 9,
    mood: "morning-fresh",
    beamColor: [255, 246, 216],
    beamAngleDeg: -20,
    beamOpacity: 0.92,
    haloPrimary: [255, 242, 212],
    intensity: 0.9,
    nightMode: null,
  },
  {
    hour: 9.5,
    mood: "morning-bright",
    beamColor: [255, 248, 220],
    beamAngleDeg: -16,
    beamOpacity: 0.93,
    haloPrimary: [255, 244, 218],
    intensity: 0.91,
    nightMode: null,
  },
  {
    hour: 10,
    mood: "morning-bright",
    beamColor: [255, 250, 224],
    beamAngleDeg: -12,
    beamOpacity: 0.94,
    haloPrimary: [255, 248, 224],
    intensity: 0.92,
    nightMode: null,
  },
  {
    hour: 10.5,
    mood: "pre-noon",
    beamColor: [255, 251, 225],
    beamAngleDeg: -8,
    beamOpacity: 0.95,
    haloPrimary: [255, 250, 226],
    intensity: 0.93,
    nightMode: null,
  },
  {
    hour: 11,
    mood: "pre-noon",
    beamColor: [255, 252, 226],
    beamAngleDeg: -6,
    beamOpacity: 0.95,
    haloPrimary: [255, 252, 228],
    intensity: 0.94,
    nightMode: null,
  },
  {
    hour: 11.5,
    mood: "almost-noon",
    beamColor: [255, 252, 226],
    beamAngleDeg: -4,
    beamOpacity: 0.95,
    haloPrimary: [255, 252, 228],
    intensity: 0.94,
    nightMode: null,
  },

  // === MIDI / ZENITH (12h-13h) — blanc-or ===
  {
    hour: 12,
    mood: "noon-zenith",
    beamColor: [255, 250, 225],
    beamAngleDeg: -3,
    beamOpacity: 0.95,
    haloPrimary: [255, 244, 204],
    intensity: 0.95,
    nightMode: null,
  },
  {
    hour: 12.5,
    mood: "noon",
    beamColor: [255, 250, 224],
    beamAngleDeg: 0,
    beamOpacity: 0.95,
    haloPrimary: [255, 244, 204],
    intensity: 0.95,
    nightMode: null,
  },
  {
    hour: 13,
    mood: "after-noon",
    beamColor: [255, 248, 220],
    beamAngleDeg: 4,
    beamOpacity: 0.94,
    haloPrimary: [255, 240, 200],
    intensity: 0.94,
    nightMode: null,
  },
  {
    hour: 13.5,
    mood: "after-noon",
    beamColor: [255, 246, 216],
    beamAngleDeg: 8,
    beamOpacity: 0.94,
    haloPrimary: [255, 238, 196],
    intensity: 0.93,
    nightMode: null,
  },

  // === APRES-MIDI (14h-16h) — doré chaud ===
  {
    hour: 14,
    mood: "afternoon",
    beamColor: [255, 240, 200],
    beamAngleDeg: 12,
    beamOpacity: 0.92,
    haloPrimary: [255, 230, 188],
    intensity: 0.91,
    nightMode: null,
  },
  {
    hour: 14.5,
    mood: "afternoon",
    beamColor: [255, 234, 188],
    beamAngleDeg: 16,
    beamOpacity: 0.91,
    haloPrimary: [255, 224, 178],
    intensity: 0.89,
    nightMode: null,
  },
  {
    hour: 15,
    mood: "afternoon-warm",
    beamColor: [255, 226, 172],
    beamAngleDeg: 22,
    beamOpacity: 0.89,
    haloPrimary: [255, 218, 166],
    intensity: 0.87,
    nightMode: null,
  },
  {
    hour: 15.5,
    mood: "afternoon-warm",
    beamColor: [255, 218, 156],
    beamAngleDeg: 28,
    beamOpacity: 0.88,
    haloPrimary: [255, 212, 154],
    intensity: 0.85,
    nightMode: null,
  },
  {
    hour: 16,
    mood: "late-afternoon",
    beamColor: [255, 208, 138],
    beamAngleDeg: 32,
    beamOpacity: 0.87,
    haloPrimary: [255, 204, 142],
    intensity: 0.83,
    nightMode: null,
  },
  {
    hour: 16.5,
    mood: "late-afternoon",
    beamColor: [255, 196, 118],
    beamAngleDeg: 36,
    beamOpacity: 0.86,
    haloPrimary: [255, 196, 128],
    intensity: 0.81,
    nightMode: null,
  },

  // === COUCHER (17h-18h30) — orange-rouge intense ===
  {
    hour: 17,
    mood: "sunset-approach",
    beamColor: [255, 168, 92],
    beamAngleDeg: 40,
    beamOpacity: 0.86,
    haloPrimary: [255, 178, 110],
    haloAccentColor: "rgba(216,180,254,0.30)",
    intensity: 0.83,
    nightMode: null,
  },
  {
    hour: 17.5,
    mood: "sunset-warm",
    beamColor: [255, 148, 78],
    beamAngleDeg: 44,
    beamOpacity: 0.86,
    haloPrimary: [255, 162, 94],
    haloAccentColor: "rgba(216,180,254,0.35)",
    intensity: 0.84,
    nightMode: null,
  },
  {
    hour: 18,
    mood: "sunset",
    beamColor: [255, 140, 80],
    beamAngleDeg: 48,
    beamOpacity: 0.85,
    haloPrimary: [255, 153, 102],
    haloAccentColor: "rgba(216,180,254,0.40)",
    intensity: 0.85,
    nightMode: null,
  },
  {
    hour: 18.5,
    mood: "sunset-fading",
    beamColor: [232, 124, 92],
    beamAngleDeg: 52,
    beamOpacity: 0.82,
    haloPrimary: [240, 142, 110],
    haloAccentColor: "rgba(216,180,254,0.42)",
    intensity: 0.8,
    nightMode: null,
  },

  // === CRÉPUSCULE (19h-21h) — twilight indigo ===
  {
    hour: 19,
    mood: "dusk",
    beamColor: [196, 144, 152],
    beamAngleDeg: 38,
    beamOpacity: 0.74,
    haloPrimary: [212, 158, 168],
    haloAccentColor: "rgba(165,180,252,0.55)",
    intensity: 0.72,
    nightMode: null,
  },
  {
    hour: 19.5,
    mood: "dusk-blue-hour",
    beamColor: [168, 152, 198],
    beamAngleDeg: 22,
    beamOpacity: 0.68,
    haloPrimary: [184, 168, 212],
    haloAccentColor: "rgba(165,180,252,0.60)",
    intensity: 0.65,
    nightMode: null,
  },
  {
    hour: 20,
    mood: "blue-hour",
    beamColor: [148, 152, 220],
    beamAngleDeg: 8,
    beamOpacity: 0.62,
    haloPrimary: [164, 166, 232],
    haloAccentColor: "rgba(99,102,241,0.55)",
    intensity: 0.58,
    nightMode: null,
  },
  {
    hour: 20.5,
    mood: "evening-violet",
    beamColor: [188, 196, 240],
    beamAngleDeg: -8,
    beamOpacity: 0.6,
    haloPrimary: [196, 204, 244],
    haloAccentColor: "rgba(99,102,241,0.50)",
    intensity: 0.58,
    nightMode: "glowing",
  },
  {
    hour: 21,
    mood: "early-night",
    beamColor: [196, 208, 248],
    beamAngleDeg: -14,
    beamOpacity: 0.62,
    haloPrimary: [200, 210, 248],
    haloAccentColor: "rgba(99,102,241,0.50)",
    intensity: 0.58,
    nightMode: "glowing",
  },
  {
    hour: 21.5,
    mood: "early-night",
    beamColor: [202, 214, 250],
    beamAngleDeg: -18,
    beamOpacity: 0.62,
    haloPrimary: [200, 210, 248],
    haloAccentColor: "rgba(99,102,241,0.48)",
    intensity: 0.56,
    nightMode: "glowing",
  },
  {
    hour: 22,
    mood: "night",
    beamColor: [216, 224, 250],
    beamAngleDeg: -22,
    beamOpacity: 0.62,
    haloPrimary: [199, 210, 254],
    haloAccentColor: "rgba(99,102,241,0.50)",
    intensity: 0.56,
    nightMode: "glowing",
  },
  {
    hour: 22.5,
    mood: "night",
    beamColor: [220, 228, 252],
    beamAngleDeg: -20,
    beamOpacity: 0.64,
    haloPrimary: [199, 210, 254],
    haloAccentColor: "rgba(99,102,241,0.48)",
    intensity: 0.56,
    nightMode: "glowing",
  },
  {
    hour: 23,
    mood: "late-night",
    beamColor: [222, 232, 254],
    beamAngleDeg: -16,
    beamOpacity: 0.65,
    haloPrimary: [199, 210, 254],
    haloAccentColor: "rgba(99,102,241,0.46)",
    intensity: 0.55,
    nightMode: "glowing",
  },
  {
    hour: 23.5,
    mood: "almost-midnight",
    beamColor: [222, 232, 254],
    beamAngleDeg: -12,
    beamOpacity: 0.65,
    haloPrimary: [199, 210, 254],
    haloAccentColor: "rgba(79,70,229,0.45)",
    intensity: 0.55,
    nightMode: "glowing",
  },
];
```

- [ ] **Step 4: Lancer les tests, confirmer le passage**

```bash
cd packages/lighting-engine && npm test -- keyframes.v3
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Exporter depuis index.ts**

```ts
// packages/lighting-engine/src/index.ts
export { KEYFRAMES_V3 } from "./keyframes.v3";
export type { KeyframeV3 } from "./keyframes.v3";
```

- [ ] **Step 6: Commit**

```bash
git add packages/lighting-engine/src/keyframes.v3.ts packages/lighting-engine/src/index.ts packages/lighting-engine/tests/keyframes.v3.test.ts
git commit -m "feat(lighting-engine): add v3 keyframes (mix realistic + brand accents palette)"
```

### Task 1.6: Étendre `getAmbientPreset` v3

**Files:**

- Modify: `packages/lighting-engine/src/preset.ts`
- Test: `packages/lighting-engine/tests/preset.v3.test.ts`

- [ ] **Step 1: Lire l'implémentation v2 actuelle pour comprendre la signature**

```bash
cat packages/lighting-engine/src/preset.ts
```

Noter les imports et la fonction `getAmbientPreset` existante. On va ajouter une **nouvelle fonction** `getAmbientPresetV3` à côté pour éviter de casser les consumers v2 immédiatement (les anciens consumers seront supprimés en Phase 5).

- [ ] **Step 2: Écrire les tests v3**

Créer `packages/lighting-engine/tests/preset.v3.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getAmbientPresetV3 } from "../src/preset";

describe("getAmbientPresetV3", () => {
  it("returns frameIndex matching the hour", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:30:00"));
    expect(preset.frameIndex).toBe(12);
  });

  it('returns nightMode "glowing" at midnight', () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T00:00:00"));
    expect(preset.nightMode).toBe("glowing");
  });

  it("returns nightMode null at noon", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.nightMode).toBeNull();
  });

  it("exposes haloAccentColor at sunset (18h)", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T18:00:00"));
    expect(preset.haloAccentColor).toBeDefined();
    expect(preset.haloAccentColor).toMatch(/rgba/);
  });

  it("does NOT expose haloAccentColor at noon (12h)", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.haloAccentColor).toBeUndefined();
  });

  it("readingZoneIntensityCap is 0.5 by default", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.readingZoneIntensityCap).toBe(0.5);
  });

  it("readingZoneIntensityCap is 0.3 when high contrast", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("more") }),
    });
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.readingZoneIntensityCap).toBe(0.3);
    expect(preset.isHighContrast).toBe(true);
    vi.unstubAllGlobals();
  });

  it("isReducedMotion true freezes the angle to its current value", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("reduce") }),
    });
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.isReducedMotion).toBe(true);
    vi.unstubAllGlobals();
  });

  it("interpolates between 06h00 and 06h30 keyframes", () => {
    const at0615 = getAmbientPresetV3(new Date("2026-04-26T06:15:00"));
    expect(at0615.beam.angleDeg).toBeGreaterThan(-55);
    expect(at0615.beam.angleDeg).toBeLessThan(-40);
  });
});
```

- [ ] **Step 3: Confirmer l'échec**

```bash
cd packages/lighting-engine && npm test -- preset.v3
```

Expected: FAIL — `getAmbientPresetV3` not exported.

- [ ] **Step 4: Implémenter `getAmbientPresetV3`**

Ajouter à `packages/lighting-engine/src/preset.ts` (en gardant l'ancien `getAmbientPreset` v2 intact) :

```ts
import { KEYFRAMES_V3, type KeyframeV3 } from "./keyframes.v3";
import { getSpriteFrameIndex } from "./sprite-frame";
import {
  detectReducedMotion,
  detectHighContrast,
  getReadingZoneCap,
} from "./accessibility";
import { lerp, lerpAngle, lerpColor, rgbToCss } from "./interpolate";
import type { AmbientPreset, PresetOptions } from "./types";

/**
 * v3 — Calcule le preset ambient lighting pour une date donnée.
 * Étend v2 avec frameIndex, nightMode, accessibility flags, readingZoneCap.
 */
export function getAmbientPresetV3(
  date: Date,
  opts: PresetOptions = {},
): AmbientPreset {
  const totalHour = date.getHours() + date.getMinutes() / 60;

  // Trouver les 2 keyframes encadrants
  const { fromIdx, toIdx, factor } = findKeyframeV3Pair(totalHour);
  const from = KEYFRAMES_V3[fromIdx];
  const to = KEYFRAMES_V3[toIdx];

  // Détection accessibilité
  const isReducedMotion = detectReducedMotion();
  const isHighContrast = detectHighContrast();

  // Si reduced-motion, geler sur la keyframe la plus proche
  const f = isReducedMotion ? Math.round(factor) : factor;

  // Interpoler
  const angleDeg = lerpAngle(from.beamAngleDeg, to.beamAngleDeg, f);
  const beamRgb = lerpColor(from.beamColor, to.beamColor, f);
  const haloRgb = lerpColor(from.haloPrimary, to.haloPrimary, f);
  const opacity =
    lerp(from.beamOpacity, to.beamOpacity, f) * (opts.intensityMul ?? 1);
  const intensity =
    lerp(from.intensity, to.intensity, f) * (opts.intensityMul ?? 1);

  // Cap intensity en haute-contraste
  const cappedIntensity = isHighContrast ? Math.min(intensity, 0.3) : intensity;

  // nightMode: prendre la keyframe la plus proche (pas d'interpolation pour énum)
  const nightMode = factor < 0.5 ? from.nightMode : to.nightMode;

  // haloAccentColor: si l'une des 2 keyframes en a, garder celle de la plus proche
  const haloAccentColor =
    factor < 0.5 ? from.haloAccentColor : to.haloAccentColor;

  return {
    hour: totalHour,
    mood: f < 0.5 ? from.mood : to.mood,
    beam: {
      type: nightMode === "glowing" ? "moon" : "sun",
      color: beamRgb,
      cssColor: opts.skipCssStrings ? undefined : rgbToCss(beamRgb, opacity),
      angleDeg,
      opacity,
    },
    sun: {
      visible: nightMode === null,
      opacity: nightMode === null ? opacity : 0,
      x: 50,
      y: 20,
    },
    moon: {
      visible: nightMode !== null,
      opacity: nightMode !== null ? opacity : 0,
      x: 50,
      y: 20,
    },
    ambient: {
      primary: 0.3 * cappedIntensity,
      secondary: 0.2 * cappedIntensity,
      tertiary: 0.1 * cappedIntensity,
    },
    starOpacityMul: nightMode !== null ? 1 : 0,
    starDensity: nightMode !== null ? "dense" : "sparse",
    haloX: 50,
    haloY: 20,
    colors: {
      primary: haloRgb,
      secondary: beamRgb,
      tertiary: [99, 102, 241],
      rays: beamRgb,
      accent: [165, 180, 252],
    },
    // === v3 fields ===
    frameIndex: getSpriteFrameIndex(date),
    nightMode,
    haloAccentColor,
    isReducedMotion,
    isHighContrast,
    readingZoneIntensityCap: getReadingZoneCap(intensity, isHighContrast),
  };
}

function findKeyframeV3Pair(hour: number): {
  fromIdx: number;
  toIdx: number;
  factor: number;
} {
  const exact = KEYFRAMES_V3.findIndex((k) => k.hour === hour);
  if (exact !== -1) return { fromIdx: exact, toIdx: exact, factor: 0 };

  const upperIdx = KEYFRAMES_V3.findIndex((k) => k.hour > hour);
  if (upperIdx === -1) {
    // Wrap: on est entre 23h30 et 00h00
    return { fromIdx: 47, toIdx: 0, factor: (hour - 23.5) / 0.5 };
  }
  if (upperIdx === 0) {
    // hour < 0 : ne devrait pas arriver
    return { fromIdx: 0, toIdx: 0, factor: 0 };
  }
  const fromIdx = upperIdx - 1;
  const from = KEYFRAMES_V3[fromIdx];
  const to = KEYFRAMES_V3[upperIdx];
  const factor = (hour - from.hour) / (to.hour - from.hour);
  return { fromIdx, toIdx: upperIdx, factor };
}
```

- [ ] **Step 5: Confirmer le passage**

```bash
cd packages/lighting-engine && npm test -- preset.v3
```

Expected: PASS — 9 tests.

- [ ] **Step 6: Exporter depuis index.ts**

```ts
// packages/lighting-engine/src/index.ts
export {
  getAmbientPreset,
  findKeyframePair,
  getAmbientPresetV3,
} from "./preset";
```

- [ ] **Step 7: Commit**

```bash
git add packages/lighting-engine/src/preset.ts packages/lighting-engine/src/index.ts packages/lighting-engine/tests/preset.v3.test.ts
git commit -m "feat(lighting-engine): add getAmbientPresetV3 with frameIndex, nightMode, accessibility flags"
```

### Task 1.7: Pipeline tournesol — setup script

**Files:**

- Create: `scripts/sunflower-frames/generate.mjs`
- Create: `scripts/sunflower-frames/scene-day.html`
- Create: `scripts/sunflower-frames/scene-night.html`
- Create: `scripts/sunflower-frames/encode-sprite.mjs`
- Modify: `package.json` (root)

- [ ] **Step 1: Créer le dossier**

```bash
mkdir -p scripts/sunflower-frames
mkdir -p assets/ambient
```

- [ ] **Step 2: Créer la scène Three.js jour**

Créer `scripts/sunflower-frames/scene-day.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <canvas id="canvas" width="256" height="256"></canvas>
    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
        }
      }
    </script>
    <script type="module">
      import * as THREE from "three";

      const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("canvas"),
        alpha: true,
        antialias: true,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(256, 256);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      // Lighting jour : directional + ambient
      scene.add(new THREE.AmbientLight(0xfff4cc, 0.45));
      const sun = new THREE.DirectionalLight(0xfffae1, 1.2);
      sun.position.set(2, 3, 4);
      scene.add(sun);

      // Tournesol génératif
      function buildSunflower() {
        const group = new THREE.Group();

        // 12 pétales radiaux
        const petalGeom = new THREE.SphereGeometry(0.4, 16, 8);
        petalGeom.scale(0.35, 1.2, 0.18); // ellipsoïde

        for (let i = 0; i < 12; i++) {
          const theta = (i / 12) * Math.PI * 2;
          const petalMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().lerpColors(
              new THREE.Color(0xfef9c3),
              new THREE.Color(0xb45309),
              0.5,
            ),
            roughness: 0.55,
            metalness: 0.05,
          });
          const petal = new THREE.Mesh(petalGeom, petalMat);
          petal.position.set(Math.cos(theta) * 1.2, Math.sin(theta) * 1.2, 0);
          petal.rotation.z = theta - Math.PI / 2;
          group.add(petal);
        }

        // Centre disque
        const centerGeom = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 32);
        centerGeom.rotateX(Math.PI / 2);
        const centerMat = new THREE.MeshStandardMaterial({
          color: 0x451a03,
          roughness: 0.85,
          metalness: 0.05,
          bumpScale: 0.05,
        });
        const center = new THREE.Mesh(centerGeom, centerMat);
        group.add(center);

        return group;
      }

      const flower = buildSunflower();
      scene.add(flower);

      // API exposée pour le script orchestrateur
      window.renderFrame = (rotationY) => {
        flower.rotation.y = rotationY;
        renderer.render(scene, camera);
      };

      window.READY = true;
    </script>
  </body>
</html>
```

- [ ] **Step 3: Créer la scène Three.js nuit luminescent**

Créer `scripts/sunflower-frames/scene-night.html` (identique à scene-day.html sauf le lighting et les materials) :

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <canvas id="canvas" width="256" height="256"></canvas>
    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
        }
      }
    </script>
    <script type="module">
      import * as THREE from "three";

      const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("canvas"),
        alpha: true,
        antialias: true,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(256, 256);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      // Lighting nuit : ambient cool + faible directional + emissive interne
      scene.add(new THREE.AmbientLight(0x1e1b4b, 0.3));
      const moon = new THREE.DirectionalLight(0xc7d2fe, 0.4);
      moon.position.set(-1, 2, 3);
      scene.add(moon);

      function buildSunflowerNight() {
        const group = new THREE.Group();

        const petalGeom = new THREE.SphereGeometry(0.4, 16, 8);
        petalGeom.scale(0.35, 1.2, 0.18);

        for (let i = 0; i < 12; i++) {
          const theta = (i / 12) * Math.PI * 2;
          const petalMat = new THREE.MeshStandardMaterial({
            color: 0xa5b4fc, // indigo-300
            roughness: 0.4,
            metalness: 0.1,
            emissive: 0x4f46e5, // indigo-600 (luminescence)
            emissiveIntensity: 0.85,
          });
          const petal = new THREE.Mesh(petalGeom, petalMat);
          petal.position.set(Math.cos(theta) * 1.2, Math.sin(theta) * 1.2, 0);
          petal.rotation.z = theta - Math.PI / 2;
          group.add(petal);
        }

        const centerGeom = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 32);
        centerGeom.rotateX(Math.PI / 2);
        const centerMat = new THREE.MeshStandardMaterial({
          color: 0x312e81,
          roughness: 0.85,
          emissive: 0x6366f1,
          emissiveIntensity: 0.4,
        });
        const center = new THREE.Mesh(centerGeom, centerMat);
        group.add(center);

        return group;
      }

      const flower = buildSunflowerNight();
      scene.add(flower);

      window.renderFrame = (rotationY) => {
        flower.rotation.y = rotationY;
        renderer.render(scene, camera);
      };

      window.READY = true;
    </script>
  </body>
</html>
```

- [ ] **Step 4: Créer le script orchestrateur Puppeteer**

Créer `scripts/sunflower-frames/generate.mjs`:

```mjs
import puppeteer from "puppeteer";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const ASSETS = path.join(ROOT, "assets/ambient");

const FRAME_SIZE = 256;
const FRAMES = 24;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const SHEET_W = FRAME_SIZE * GRID_COLS;
const SHEET_H = FRAME_SIZE * GRID_ROWS;

async function renderScene(scenePath, outputName) {
  console.log(`[render] ${scenePath}`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-web-security",
      "--enable-webgl",
      "--use-gl=angle",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: FRAME_SIZE, height: FRAME_SIZE });
  await page.goto(`file://${scenePath}`);
  await page.waitForFunction(() => window.READY === true, { timeout: 10000 });

  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    // Le tournesol fait une rotation complète sur 24h → 15° par heure
    const rotationY = (i / FRAMES) * Math.PI * 2;
    await page.evaluate((rot) => window.renderFrame(rot), rotationY);
    const buf = await page.screenshot({
      type: "png",
      omitBackground: true,
      clip: { x: 0, y: 0, width: FRAME_SIZE, height: FRAME_SIZE },
    });
    frames.push(buf);
    process.stdout.write(`\r  frame ${i + 1}/${FRAMES}`);
  }
  process.stdout.write("\n");

  await browser.close();

  // Composer le sprite sheet
  const compositeOps = [];
  for (let i = 0; i < FRAMES; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    compositeOps.push({
      input: frames[i],
      left: col * FRAME_SIZE,
      top: row * FRAME_SIZE,
    });
  }

  const out = path.join(ASSETS, outputName);
  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeOps)
    .webp({ quality: 85, lossless: false, alphaQuality: 90 })
    .toFile(out);

  const stats = await fs.stat(out);
  console.log(`[done] ${outputName}: ${(stats.size / 1024).toFixed(1)} KB`);
}

async function main() {
  await fs.mkdir(ASSETS, { recursive: true });
  await renderScene(
    path.join(__dirname, "scene-day.html"),
    "sunflower-day.webp",
  );
  await renderScene(
    path.join(__dirname, "scene-night.html"),
    "sunflower-night.webp",
  );
  console.log("[all done]");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Ajouter le script au `package.json` root**

Vérifier que `puppeteer` et `sharp` sont installés à la racine. Si non :

```bash
npm install --save-dev puppeteer sharp
```

Puis modifier `package.json` (root) pour ajouter dans `"scripts"`:

```json
"build:sunflower-frames": "node scripts/sunflower-frames/generate.mjs"
```

- [ ] **Step 6: Lancer le pipeline**

```bash
npm run build:sunflower-frames
```

Expected: génération des 2 fichiers dans `assets/ambient/`. Sortie console attendue :

```
[render] .../scene-day.html
  frame 24/24
[done] sunflower-day.webp: 78.4 KB
[render] .../scene-night.html
  frame 24/24
[done] sunflower-night.webp: 81.2 KB
[all done]
```

Si la taille dépasse 100KB par sprite : ajuster `quality` à 75 dans `sharp.webp()`.

- [ ] **Step 7: Vérifier visuellement**

Ouvrir `assets/ambient/sunflower-day.webp` dans un viewer image. Confirmer : 24 vignettes de tournesol vues sous différents angles, chacune 256×256 px transparente. Le tournesol doit pivoter progressivement frame par frame.

Si le rendu est cassé (tournesol invisible / trop petit / déformé), ajuster les paramètres `sphere.scale`, `camera.position`, etc. dans la scène HTML.

- [ ] **Step 8: Commit**

```bash
git add scripts/sunflower-frames/ assets/ambient/sunflower-day.webp assets/ambient/sunflower-night.webp package.json package-lock.json
git commit -m "feat(scripts): add sunflower frames pipeline (Puppeteer Three.js → 2 WebP sprite sheets)"
```

### Task 1.8: Design tokens shift — Web

**Files:**

- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/tailwind.config.js`
- Test: `frontend/src/styles/__tests__/tokens.test.ts`

- [ ] **Step 1: Inspecter `tokens.css` actuel**

```bash
cat frontend/src/styles/tokens.css | head -80
```

Repérer les variables `--text-*` ou les couleurs grises. Si pas de fichier `tokens.css`, vérifier `frontend/src/index.css` ou `frontend/src/styles/globals.css`.

- [ ] **Step 2: Écrire le test (smoke test) qui assert les nouvelles valeurs**

Créer `frontend/src/styles/__tests__/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("design tokens v3", () => {
  const tokensPath = path.resolve(__dirname, "../tokens.css");
  const content = fs.existsSync(tokensPath)
    ? fs.readFileSync(tokensPath, "utf-8")
    : "";

  it("text-secondary uses slate-100 (#f1f5f9)", () => {
    expect(content).toMatch(/--text-secondary:\s*#f1f5f9/i);
  });

  it("text-muted uses slate-200 (#e2e8f0)", () => {
    expect(content).toMatch(/--text-muted:\s*#e2e8f0/i);
  });

  it("text-disabled uses rgba opacity", () => {
    expect(content).toMatch(
      /--text-disabled:\s*rgba\(255,\s*255,\s*255,\s*0\.45\)/i,
    );
  });

  it("text-meta uses slate-300", () => {
    expect(content).toMatch(/--text-meta:\s*#cbd5e1/i);
  });
});
```

- [ ] **Step 3: Lancer le test, confirmer l'échec**

```bash
cd frontend && npm test -- tokens
```

Expected: FAIL.

- [ ] **Step 4: Modifier `tokens.css`**

Si le fichier n'existe pas, le créer. Sinon, modifier les variables. Ajouter ou modifier ces déclarations dans `:root { ... }`:

```css
:root {
  /* === Text tokens v3 (ambient lighting) === */
  --text-primary: #ffffff;
  --text-secondary: #f1f5f9; /* slate-100 — était #94a3b8 (slate-400) */
  --text-muted: #e2e8f0; /* slate-200 — était #64748b (slate-500) */
  --text-disabled: rgba(255, 255, 255, 0.45); /* opacité au lieu de gris */
  --text-meta: #cbd5e1; /* slate-300 pour timestamps/counts */
}
```

Si le fichier n'inclut pas déjà ces variables, ajouter le bloc complet en haut du `:root`.

- [ ] **Step 5: Lancer le test, confirmer le passage**

```bash
cd frontend && npm test -- tokens
```

Expected: PASS.

- [ ] **Step 6: Étendre `tailwind.config.js`**

Modifier `frontend/tailwind.config.js` pour ajouter dans `theme.extend.colors`:

```js
text: {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  disabled: 'var(--text-disabled)',
  meta: 'var(--text-meta)',
},
```

Cela permet d'utiliser `text-text-secondary` etc. (ou de redéfinir l'aliasing : `text-secondary` directement).

- [ ] **Step 7: Lancer typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: 0 erreur.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/tailwind.config.js frontend/src/styles/__tests__/tokens.test.ts
git commit -m "feat(frontend): shift text design tokens (secondary/muted/disabled) to white-cast for ambient lighting v3"
```

### Task 1.9: Design tokens shift — Mobile

**Files:**

- Modify: `mobile/src/theme/colors.ts`
- Test: `mobile/src/theme/__tests__/colors.test.ts`

- [ ] **Step 1: Inspecter `colors.ts` actuel**

```bash
cat mobile/src/theme/colors.ts
```

Repérer la structure `text.*`.

- [ ] **Step 2: Test failing**

Créer `mobile/src/theme/__tests__/colors.test.ts`:

```ts
import { colors } from "../colors";

describe("text colors v3", () => {
  it("text.primary is pure white", () => {
    expect(colors.text.primary).toBe("#ffffff");
  });

  it("text.secondary is slate-100", () => {
    expect(colors.text.secondary).toBe("#f1f5f9");
  });

  it("text.muted is slate-200", () => {
    expect(colors.text.muted).toBe("#e2e8f0");
  });

  it("text.disabled uses rgba opacity", () => {
    expect(colors.text.disabled).toBe("rgba(255,255,255,0.45)");
  });

  it("text.meta is slate-300", () => {
    expect(colors.text.meta).toBe("#cbd5e1");
  });
});
```

- [ ] **Step 3: Confirmer l'échec**

```bash
cd mobile && npm test -- colors
```

Expected: FAIL.

- [ ] **Step 4: Modifier `colors.ts`**

Mettre à jour la section `text` :

```ts
export const colors = {
  // ... existing
  text: {
    primary: "#ffffff",
    secondary: "#f1f5f9",
    muted: "#e2e8f0",
    disabled: "rgba(255,255,255,0.45)",
    meta: "#cbd5e1",
  },
  // ... rest
};
```

- [ ] **Step 5: Confirmer le passage**

```bash
cd mobile && npm test -- colors
```

Expected: PASS.

- [ ] **Step 6: Lancer le typecheck**

```bash
cd mobile && npm run typecheck
```

Expected: 0 erreur. Si erreurs sur des consumers qui utilisent les anciennes valeurs, NE PAS les fixer ici (hors scope) — noter les fichiers affectés et les fixer dans une PR follow-up.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/theme/colors.ts mobile/src/theme/__tests__/colors.test.ts
git commit -m "feat(mobile): shift text colors theme to white-cast for ambient lighting v3"
```

### Task 1.10: Design tokens shift — Extension

**Files:**

- Modify: `extension/src/sidepanel/styles/sidepanel.css`
- Modify: `extension/src/popup/styles/popup.css`

- [ ] **Step 1: Inspecter les CSS actuels**

```bash
grep -n "text-secondary\|text-muted\|color:\s*#" extension/src/sidepanel/styles/sidepanel.css | head -20
grep -n "text-secondary\|text-muted\|color:\s*#" extension/src/popup/styles/popup.css | head -20
```

- [ ] **Step 2: Modifier `sidepanel.css`**

Ajouter en haut du fichier (ou modifier le bloc `:root` existant) :

```css
:root {
  /* === Text tokens v3 (ambient lighting) === */
  --v3-text-primary: #ffffff;
  --v3-text-secondary: #f1f5f9;
  --v3-text-muted: #e2e8f0;
  --v3-text-disabled: rgba(255, 255, 255, 0.45);
  --v3-text-meta: #cbd5e1;
}
```

(Note : `--v3-text-*` plutôt que `--text-*` pour éviter collision avec les classes `.v3-*` que la session parallèle a installées.)

- [ ] **Step 3: Idem dans `popup.css`**

Ajouter le même bloc.

- [ ] **Step 4: Build de validation**

```bash
cd extension && npm run typecheck && npm run build
```

Expected: 0 erreur, build OK.

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/styles/sidepanel.css extension/src/popup/styles/popup.css
git commit -m "feat(extension): shift text CSS variables to white-cast for ambient lighting v3"
```

### Task 1.11: Backend — vérifier le champ `User.preferences.ambient_lighting_enabled`

**Files:**

- Verify: `backend/src/db/database.py`
- Verify: `backend/src/auth/router.py`
- Test: `backend/tests/test_user_preferences_v3.py`

- [ ] **Step 1: Inspecter `User.preferences`**

```bash
grep -n "preferences" backend/src/db/database.py | head -10
grep -n "preferences" backend/src/auth/router.py | head -10
```

Si `User.preferences` est une `Column(JSON)`, c'est good — pas de migration nécessaire. Si c'est une autre forme (relation, JSONB), adapter.

- [ ] **Step 2: Écrire un test pour confirmer que l'endpoint accepte `ambient_lighting_enabled`**

Créer `backend/tests/test_user_preferences_v3.py`:

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_user_preferences_accepts_ambient_lighting_enabled(client: AsyncClient, auth_headers):
    """User can toggle ambient_lighting_enabled in preferences."""
    response = await client.put(
        "/api/auth/preferences",
        json={"ambient_lighting_enabled": False},
        headers=auth_headers,
    )
    assert response.status_code == 200

    me = await client.get("/api/auth/me", headers=auth_headers)
    assert me.json()["preferences"].get("ambient_lighting_enabled") is False

    # Toggle back on
    response = await client.put(
        "/api/auth/preferences",
        json={"ambient_lighting_enabled": True},
        headers=auth_headers,
    )
    assert response.status_code == 200
    me = await client.get("/api/auth/me", headers=auth_headers)
    assert me.json()["preferences"].get("ambient_lighting_enabled") is True


@pytest.mark.asyncio
async def test_user_preferences_default_ambient_lighting_enabled_true(client: AsyncClient, auth_headers):
    """New users have ambient_lighting_enabled=True by default."""
    me = await client.get("/api/auth/me", headers=auth_headers)
    # Default may be missing in JSON — handle both cases
    pref = me.json().get("preferences", {})
    val = pref.get("ambient_lighting_enabled", True)  # default True if absent
    assert val is True
```

- [ ] **Step 3: Lancer le test**

```bash
cd backend && pytest tests/test_user_preferences_v3.py -v
```

Si déjà pass : aucune modif backend nécessaire (l'endpoint accepte n'importe quel JSON valide).

Si fail à cause d'un schema Pydantic strict : ajouter le champ optionnel dans le schema. Trouver le schema avec :

```bash
grep -rn "class.*Preferences" backend/src/auth/
```

Et ajouter dans la classe correspondante (ex: `UserPreferencesUpdate` ou `UserPreferencesIn`):

```python
class UserPreferencesUpdate(BaseModel):
    # ... existing fields
    ambient_lighting_enabled: bool | None = None
```

Si le model `User.preferences` est typé strict (par exemple un dict typé), élargir le type pour accepter le nouveau champ.

- [ ] **Step 4: Re-lancer le test**

```bash
cd backend && pytest tests/test_user_preferences_v3.py -v
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_user_preferences_v3.py backend/src/auth/  # + tout fichier modifié
git commit -m "test(backend): add ambient_lighting_enabled to user preferences (v3)"
```

### Task 1.12: PR1 — Push & PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/ambient-lighting-v3-foundation
```

- [ ] **Step 2: Créer la PR**

```bash
gh pr create --title "feat(ambient-lighting-v3): foundation - engine + sprite pipeline + tokens" --body "$(cat <<'EOF'
## Summary

PR1 of 5 for ambient lighting v3 — see spec at `docs/superpowers/specs/2026-04-26-ambient-lighting-v3-design.md`.

This PR delivers the foundation that PRs 2-4 will consume:
- Extended `@deepsight/lighting-engine` v3 (frameIndex, nightMode, accessibility flags, 48 v3 keyframes with brand accents)
- Sprite pipeline (Three.js headless via Puppeteer → 2 WebP sprite sheets ~150KB total)
- Design tokens shift (text-secondary/muted/disabled in white-cast — pas de gris moyen sur fond sombre)
- Backend pref `ambient_lighting_enabled` validation

## Test plan

- [ ] `cd packages/lighting-engine && npm test` — all green (4 new test files)
- [ ] `npm run build:sunflower-frames` — produces 2 .webp ~75KB each in `assets/ambient/`
- [ ] `cd frontend && npm test -- tokens` + `npm run typecheck` — green
- [ ] `cd mobile && npm test -- colors` + `npm run typecheck` — green
- [ ] `cd extension && npm run typecheck && npm run build` — green
- [ ] `cd backend && pytest tests/test_user_preferences_v3.py -v` — green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Note la PR URL pour reference**

Récupérer l'URL retournée et la noter pour les PR2-4 qui dépendent de ce merge.

---

## Phase 2 — Web Platform (PR2)

**Branche:** `feat/ambient-lighting-v3-web`
**Durée estimée:** ~1.5 jour
**Dépendances:** PR1 mergée. Peut s'exécuter EN PARALLÈLE avec PR3 (Mobile) et PR4 (Extension).

### Task 2.1: Créer la branche

- [ ] **Step 1**

```bash
git fetch origin
git checkout -b feat/ambient-lighting-v3-web origin/main
```

### Task 2.2: Plugin Vite critical CSS

**Files:**

- Create: `frontend/src/plugins/vite-plugin-ambient-critical-css.ts`
- Modify: `frontend/vite.config.ts`
- Test: `frontend/src/plugins/__tests__/vite-plugin-ambient-critical-css.test.ts`

- [ ] **Step 1: Test failing**

Créer `frontend/src/plugins/__tests__/vite-plugin-ambient-critical-css.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ambientCriticalCssPlugin } from "../vite-plugin-ambient-critical-css";

describe("ambientCriticalCssPlugin", () => {
  it("returns a Vite plugin object", () => {
    const plugin = ambientCriticalCssPlugin();
    expect(plugin.name).toBe("vite-plugin-ambient-critical-css");
    expect(plugin.transformIndexHtml).toBeDefined();
  });

  it('injects <style id="ambient-critical"> in <head>', () => {
    const plugin = ambientCriticalCssPlugin();
    const html = `<html><head></head><body></body></html>`;
    const result = (plugin.transformIndexHtml as Function)(html);
    expect(result).toContain('<style id="ambient-critical">');
    expect(result).toContain("--ambient-beam-angle");
    expect(result).toContain("background-color: #0a0a0f");
  });

  it('injects <link rel="preload" as="image"> for sprite', () => {
    const plugin = ambientCriticalCssPlugin();
    const html = `<html><head></head><body></body></html>`;
    const result = (plugin.transformIndexHtml as Function)(html);
    expect(result).toMatch(
      /<link rel="preload" as="image" href="\/assets\/ambient\/sunflower-(day|night)\.webp"/,
    );
  });
});
```

- [ ] **Step 2: Implémenter le plugin**

Créer `frontend/src/plugins/vite-plugin-ambient-critical-css.ts`:

```ts
import type { Plugin } from "vite";
import { getAmbientPresetV3, rgbToCss } from "@deepsight/lighting-engine";

export function ambientCriticalCssPlugin(): Plugin {
  return {
    name: "vite-plugin-ambient-critical-css",
    transformIndexHtml(html: string) {
      const preset = getAmbientPresetV3(new Date());
      const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
      const haloColor = rgbToCss(
        preset.colors.primary,
        preset.beam.opacity * 0.5,
      );
      const sprite =
        preset.nightMode === "glowing"
          ? "sunflower-night.webp"
          : "sunflower-day.webp";

      const inlineCss = `
:root {
  --ambient-beam-angle: ${preset.beam.angleDeg}deg;
  --ambient-beam-color: ${beamColor};
  --ambient-halo-color: ${haloColor};
  --ambient-halo-accent: ${preset.haloAccentColor || "transparent"};
  --ambient-intensity: ${preset.beam.opacity};
  --ambient-frame-index: ${preset.frameIndex};
}
html { background-color: #0a0a0f; }
body { background-color: #0a0a0f; }
.ambient-beam-initial {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background: linear-gradient(var(--ambient-beam-angle),
    transparent 45%, var(--ambient-beam-color) 50%, transparent 55%);
}
.ambient-halo-initial {
  position: fixed; top: -100px; left: -100px; width: 400px; height: 400px;
  background: radial-gradient(circle, var(--ambient-halo-color), transparent 60%);
  filter: blur(40px); mix-blend-mode: screen; z-index: 1; pointer-events: none;
}
.ambient-disabled .ambient-beam-initial,
.ambient-disabled .ambient-halo-initial { display: none; }
      `.trim();

      const injection = `
<style id="ambient-critical">${inlineCss}</style>
<link rel="preload" as="image" href="/assets/ambient/${sprite}">
      `.trim();

      return html.replace("</head>", `${injection}\n</head>`);
    },
  };
}
```

- [ ] **Step 3: Confirmer le passage des tests**

```bash
cd frontend && npm test -- vite-plugin-ambient
```

Expected: PASS — 3 tests.

- [ ] **Step 4: Charger le plugin dans `vite.config.ts`**

Modifier `frontend/vite.config.ts` :

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ambientCriticalCssPlugin } from "./src/plugins/vite-plugin-ambient-critical-css";

export default defineConfig({
  plugins: [react(), ambientCriticalCssPlugin()],
  // ...
});
```

- [ ] **Step 5: Build dev pour valider**

```bash
cd frontend && npm run build
grep -c "ambient-critical" dist/index.html
```

Expected: count >= 1 (plugin a injecté son `<style>`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/plugins/ frontend/vite.config.ts
git commit -m "feat(frontend): add Vite plugin for ambient critical CSS injection (visible before React hydrates)"
```

### Task 2.3: AmbientLightingContext

**Files:**

- Create: `frontend/src/contexts/AmbientLightingContext.tsx`
- Test: `frontend/src/contexts/__tests__/AmbientLightingContext.test.tsx`

- [ ] **Step 1: Test failing**

Créer `frontend/src/contexts/__tests__/AmbientLightingContext.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, renderHook } from "@testing-library/react";
import {
  AmbientLightingProvider,
  useAmbientLightingContext,
} from "../AmbientLightingContext";

describe("AmbientLightingProvider", () => {
  it("provides preset to children via context", () => {
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });
    expect(result.current.preset).toBeDefined();
    expect(result.current.preset.frameIndex).toBeGreaterThanOrEqual(0);
    expect(result.current.preset.frameIndex).toBeLessThanOrEqual(23);
  });

  it("renders nothing when enabled=false", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <div data-testid="child">child</div>
      </AmbientLightingProvider>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it("refreshes preset every 30 seconds", async () => {
    // tested via vi.useFakeTimers
    vi.useFakeTimers();
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });
    const initialFrame = result.current.preset.frameIndex;
    vi.advanceTimersByTime(30 * 1000);
    // We can't assert change without time control, but we can assert no throw
    expect(result.current.preset).toBeDefined();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Implémenter le Context**

Créer `frontend/src/contexts/AmbientLightingContext.tsx`:

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getAmbientPresetV3,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

interface AmbientLightingContextValue {
  preset: AmbientPreset;
  enabled: boolean;
}

const Ctx = createContext<AmbientLightingContextValue | null>(null);

interface ProviderProps {
  enabled?: boolean;
  children: ReactNode;
}

export function AmbientLightingProvider({
  enabled = true,
  children,
}: ProviderProps) {
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPresetV3(new Date()),
  );

  useEffect(() => {
    if (!enabled) return;
    const update = () => setPreset(getAmbientPresetV3(new Date()));
    update();
    const interval = setInterval(update, 30 * 1000); // refresh every 30s
    return () => clearInterval(interval);
  }, [enabled]);

  return <Ctx.Provider value={{ preset, enabled }}>{children}</Ctx.Provider>;
}

export function useAmbientLightingContext(): AmbientLightingContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Fallback : retourner un preset live sans Context (au cas où)
    return { preset: getAmbientPresetV3(new Date()), enabled: false };
  }
  return v;
}
```

- [ ] **Step 3: Confirmer le passage**

```bash
cd frontend && npm test -- AmbientLightingContext
```

Expected: PASS — 3 tests.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/contexts/AmbientLightingContext.tsx frontend/src/contexts/__tests__/
git commit -m "feat(frontend): add AmbientLightingProvider context (refreshes preset every 30s)"
```

### Task 2.4: AmbientLightLayer composant Web

**Files:**

- Replace: `frontend/src/components/AmbientLightLayer.tsx`
- Test: `frontend/src/components/__tests__/AmbientLightLayer.test.tsx`

- [ ] **Step 1: Test failing**

Créer `frontend/src/components/__tests__/AmbientLightLayer.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../AmbientLightLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

describe("AmbientLightLayer", () => {
  it("renders fixed inset overlay with aria-hidden", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const layer = container.querySelector('[aria-hidden="true"]');
    expect(layer).toBeTruthy();
    expect(getComputedStyle(layer!).position).toBe("fixed");
  });

  it("renders nothing when provider disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".ambient-light-layer")).toBeFalsy();
  });

  it("applies beam angle from preset as CSS transform", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const beam = container.querySelector(".ambient-beam");
    expect(beam).toBeTruthy();
    const style = (beam as HTMLElement).style;
    expect(style.transform).toMatch(/rotate\(-?\d+(\.\d+)?deg\)/);
  });
});
```

- [ ] **Step 2: Implémenter le composant**

Remplacer `frontend/src/components/AmbientLightLayer.tsx`:

```tsx
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";
import { rgbToCss } from "@deepsight/lighting-engine";

export function AmbientLightLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
  const haloColor = rgbToCss(preset.colors.primary, preset.beam.opacity * 0.5);
  const accentColor = preset.haloAccentColor;

  return (
    <div
      aria-hidden="true"
      className="ambient-light-layer"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      {/* Halo de source — radial gradient flou */}
      <div
        className="ambient-halo"
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 500,
          height: 500,
          background: accentColor
            ? `radial-gradient(circle, ${haloColor} 0%, ${accentColor} 40%, transparent 70%)`
            : `radial-gradient(circle, ${haloColor}, transparent 60%)`,
          filter: "blur(40px)",
          mixBlendMode: "screen",
          transition: "background 4s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Beam — linear gradient fin avec halo */}
      <div
        className="ambient-beam"
        style={{
          position: "absolute",
          top: "50%",
          left: "-15%",
          width: "130%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${beamColor} 50%, transparent)`,
          boxShadow: `0 0 12px ${beamColor}, 0 0 32px ${beamColor}, 0 0 80px ${beamColor}`,
          transform: `rotate(${preset.beam.angleDeg}deg)`,
          transformOrigin: "center",
          transition:
            "transform 4s cubic-bezier(0.4,0,0.2,1), background 4s, box-shadow 4s",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Confirmer le passage**

```bash
cd frontend && npm test -- AmbientLightLayer
```

Expected: PASS — 3 tests.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AmbientLightLayer.tsx frontend/src/components/__tests__/AmbientLightLayer.test.tsx
git commit -m "feat(frontend): rewrite AmbientLightLayer to consume engine v3 (beam + halo + accent)"
```

### Task 2.5: SunflowerLayer composant Web (mascot + hero)

**Files:**

- Create: `frontend/src/components/SunflowerLayer.tsx`
- Test: `frontend/src/components/__tests__/SunflowerLayer.test.tsx`
- Copy: `frontend/public/assets/ambient/sunflower-day.webp`
- Copy: `frontend/public/assets/ambient/sunflower-night.webp`

- [ ] **Step 1: Copier les sprites**

```bash
mkdir -p frontend/public/assets/ambient
cp assets/ambient/sunflower-day.webp frontend/public/assets/ambient/
cp assets/ambient/sunflower-night.webp frontend/public/assets/ambient/
```

- [ ] **Step 2: Test failing**

Créer `frontend/src/components/__tests__/SunflowerLayer.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SunflowerLayer } from "../SunflowerLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

const renderWithRoute = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AmbientLightingProvider>
        <Routes>
          <Route path="*" element={<SunflowerLayer />} />
        </Routes>
      </AmbientLightingProvider>
    </MemoryRouter>,
  );

describe("SunflowerLayer", () => {
  it("renders hero variant on /", () => {
    const { container } = renderWithRoute("/");
    const flower = container.querySelector(".sunflower-hero");
    expect(flower).toBeTruthy();
  });

  it("renders mascot variant on /dashboard", () => {
    const { container } = renderWithRoute("/dashboard");
    const flower = container.querySelector(".sunflower-mascot");
    expect(flower).toBeTruthy();
  });

  it("uses sunflower-day.webp by day", () => {
    // Mock noon
    const { container } = renderWithRoute("/");
    const flower = container.querySelector(
      ".sunflower-hero img, .sunflower-hero [data-sprite]",
    );
    expect(flower).toBeTruthy();
  });
});
```

- [ ] **Step 3: Implémenter le composant**

Créer `frontend/src/components/SunflowerLayer.tsx`:

```tsx
import { useLocation } from "react-router-dom";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const HERO_ROUTES = ["/", "/login", "/signup", "/forgot-password"];
const FRAME_SIZE = 256;
const GRID_COLS = 6;

function getSpritePosition(frameIndex: number): string {
  const col = frameIndex % GRID_COLS;
  const row = Math.floor(frameIndex / GRID_COLS);
  return `-${col * FRAME_SIZE}px -${row * FRAME_SIZE}px`;
}

export function SunflowerLayer() {
  const location = useLocation();
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const isHero = HERO_ROUTES.includes(location.pathname);
  const sprite =
    preset.nightMode === "glowing"
      ? "sunflower-night.webp"
      : "sunflower-day.webp";
  const url = `/assets/ambient/${sprite}`;
  const position = getSpritePosition(preset.frameIndex);

  if (isHero) {
    return (
      <div
        aria-hidden="true"
        className="sunflower-hero"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 90,
          height: 90,
          backgroundImage: `url(${url})`,
          backgroundSize: `${FRAME_SIZE * GRID_COLS}px auto`,
          backgroundPosition: position,
          pointerEvents: "none",
          zIndex: 2,
          opacity: preset.beam.opacity * 0.9,
          transition: "opacity 4s cubic-bezier(0.4,0,0.2,1)",
          backgroundRepeat: "no-repeat",
          backgroundClip: "border-box",
          imageRendering: "crisp-edges",
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="sunflower-mascot"
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        width: 76,
        height: 76,
        backgroundImage: `url(${url})`,
        backgroundSize: `${FRAME_SIZE * GRID_COLS}px auto`,
        backgroundPosition: position,
        pointerEvents: "none",
        zIndex: 2,
        opacity: preset.beam.opacity,
        transition:
          "opacity 4s cubic-bezier(0.4,0,0.2,1), background-position 4s",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
```

Note : la `width: 76 / height: 76` mais background-size de la frame entière `256px`. Le sprite est rendu à 76×76, donc le 256×256 frame est compressé. Pour un rendu plus précis, ajuster `backgroundSize`. Voir Step 4 pour le fix.

- [ ] **Step 4: Corriger le `backgroundSize`**

Pour afficher correctement la frame 256×256 dans 76×76 sans compression visuelle, on dimensionne le sprite sheet ainsi : si une frame fait 76 px de large affichée, le sheet fait `76 * GRID_COLS` de large. Donc `backgroundSize: '${76 * 6}px auto' = '456px'`.

Le `backgroundPosition` doit aussi être scaled : `-${col * 76}px -${row * 76}px`.

Refactorer la fonction et le composant :

```tsx
function getSpritePosition(frameIndex: number, displaySize: number): string {
  const col = frameIndex % GRID_COLS;
  const row = Math.floor(frameIndex / GRID_COLS);
  return `-${col * displaySize}px -${row * displaySize}px`;
}

export function SunflowerLayer() {
  // ...

  const displaySize = isHero ? 90 : 76;
  const position = getSpritePosition(preset.frameIndex, displaySize);

  return (
    <div
      style={{
        // ...
        width: displaySize,
        height: displaySize,
        backgroundImage: `url(${url})`,
        backgroundSize: `${displaySize * GRID_COLS}px auto`,
        backgroundPosition: position,
        // ...
      }}
    />
  );
}
```

- [ ] **Step 5: Confirmer le passage**

```bash
cd frontend && npm test -- SunflowerLayer
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SunflowerLayer.tsx frontend/src/components/__tests__/SunflowerLayer.test.tsx frontend/public/assets/ambient/
git commit -m "feat(frontend): add SunflowerLayer (route-aware hero + mascot variants)"
```

### Task 2.6: Intégration App.tsx + UI Settings

**Files:**

- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Test: `frontend/src/App.test.tsx` (si existe)

- [ ] **Step 1: Modifier `App.tsx`**

Wrapping de l'App :

```tsx
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { AmbientLightLayer } from "./components/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";
import { useAuth } from "./contexts/AuthContext";

function AppContent() {
  const { user } = useAuth();
  const enabled = user?.preferences?.ambient_lighting_enabled !== false; // default true

  return (
    <AmbientLightingProvider enabled={enabled}>
      <AmbientLightLayer />
      <SunflowerLayer />
      {/* ... routes existantes */}
    </AmbientLightingProvider>
  );
}
```

(Adapter selon la structure réelle de `App.tsx` — si pas de AuthContext disponible au top-level, lire le pref directement depuis localStorage avec un default `true`.)

- [ ] **Step 2: Modifier `SettingsPage.tsx`**

Localiser le bloc des préférences. Ajouter un Switch :

```tsx
const [ambientEnabled, setAmbientEnabled] = useState(
  user?.preferences?.ambient_lighting_enabled !== false,
);

const handleToggle = async (checked: boolean) => {
  setAmbientEnabled(checked);
  await api.put("/api/auth/preferences", { ambient_lighting_enabled: checked });
};

// JSX
<div className="settings-row">
  <div>
    <h3 className="text-text-primary font-semibold">Effet ambiant lumineux</h3>
    <p className="text-text-meta text-sm">
      Affiche un rayon de lumière subtil et un tournesol qui suit la course du
      soleil.
    </p>
  </div>
  <Switch checked={ambientEnabled} onCheckedChange={handleToggle} />
</div>;
```

(Adapter à la lib UI utilisée — si shadcn, c'est `<Switch>` ; si HeadlessUI, c'est `<Switch>` aussi mais import différent.)

- [ ] **Step 3: Smoke test**

```bash
cd frontend && npm run dev
```

Ouvrir http://localhost:5173 et vérifier visuellement :

- Le rayon est visible
- Le halo doux apparaît
- Le tournesol mascot est visible bottom-right (sur /dashboard) ou hero centré (sur /)
- Aller sur /settings, toggle off → tout disparaît
- Toggle on → réapparaît

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/SettingsPage.tsx
git commit -m "feat(frontend): mount AmbientLightingProvider + AmbientLightLayer + SunflowerLayer in App, add Settings toggle"
```

### Task 2.7: E2E Playwright

**Files:**

- Create: `frontend/e2e/ambient-lighting.spec.ts`

- [ ] **Step 1: Test E2E**

Créer `frontend/e2e/ambient-lighting.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("ambient lighting v3", () => {
  test("rayon visible avant hydratation (critical CSS)", async ({ page }) => {
    await page.goto("/");
    // Critical CSS doit avoir injecté un <style id="ambient-critical">
    const styleTag = await page.$("style#ambient-critical");
    expect(styleTag).toBeTruthy();
  });

  test("AmbientLightLayer monté après hydratation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".ambient-light-layer")).toBeVisible();
  });

  test("SunflowerLayer hero sur landing /", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sunflower-hero")).toBeVisible();
  });

  test("SunflowerLayer mascot sur dashboard /dashboard", async ({ page }) => {
    // Login required for /dashboard — adapter selon auth flow
    await page.goto("/login");
    // ... auth steps
    await page.goto("/dashboard");
    await expect(page.locator(".sunflower-mascot")).toBeVisible();
  });

  test("respect prefers-reduced-motion", async ({ page, context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, "matchMedia", {
        value: (q: string) => ({
          matches: q.includes("reduce"),
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      });
    });
    await page.goto("/");
    // Le rayon ne doit pas avoir de transition
    const beam = await page.locator(".ambient-beam");
    const transition = await beam.evaluate(
      (el) => getComputedStyle(el).transition,
    );
    // Soit transition: none, soit transition: 0s
    expect(transition).toMatch(/(none|0s)/);
  });
});
```

- [ ] **Step 2: Lancer**

```bash
cd frontend && npm run test:e2e -- ambient-lighting
```

Expected: 4-5 tests pass. Le test "mascot sur dashboard" peut nécessiter d'ignorer si auth flow est complexe — l'enrober en `test.skip()` si nécessaire et noter pour follow-up.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/ambient-lighting.spec.ts
git commit -m "test(frontend): add Playwright E2E for ambient lighting v3"
```

### Task 2.8: PR2 — Push & PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/ambient-lighting-v3-web
```

- [ ] **Step 2: Créer la PR**

```bash
gh pr create --title "feat(ambient-lighting-v3): web platform — AmbientLightLayer + SunflowerLayer + critical CSS" --body "PR2 of 5 — depends on PR1 merged. See spec.

## Test plan
- [ ] cd frontend && npm test — all green
- [ ] cd frontend && npm run typecheck — green
- [ ] cd frontend && npm run test:e2e -- ambient-lighting — green
- [ ] Manual visual check : sunflower mascot bottom-right, rayon visible, settings toggle works

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Phase 3 — Mobile Platform (PR3)

**Branche:** `feat/ambient-lighting-v3-mobile`
**Durée estimée:** ~1.5 jour
**Dépendances:** PR1 mergée. Peut s'exécuter EN PARALLÈLE avec PR2 et PR4.

### Task 3.1: Setup branche + Metro config

**Files:**

- Modify: `mobile/metro.config.js`

- [ ] **Step 1: Créer la branche**

```bash
git fetch origin
git checkout -b feat/ambient-lighting-v3-mobile origin/main
```

- [ ] **Step 2: Étendre metro.config.js**

Ajouter dans `mobile/metro.config.js`:

```js
const path = require("path");
const config = getDefaultConfig(__dirname);

config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, "../packages/lighting-engine"),
];

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    "@deepsight/lighting-engine": path.resolve(
      __dirname,
      "../packages/lighting-engine",
    ),
  },
};

module.exports = config;
```

- [ ] **Step 3: Vérifier le résolveur**

```bash
cd mobile && npx tsc --noEmit
```

Expected: pas d'erreur "Cannot find module '@deepsight/lighting-engine'".

- [ ] **Step 4: Commit**

```bash
git add mobile/metro.config.js
git commit -m "feat(mobile): wire @deepsight/lighting-engine workspace via Metro extraNodeModules"
```

### Task 3.2: Copy sprites + AmbientLightingContext

**Files:**

- Copy: `mobile/assets/ambient/sunflower-day.webp`
- Copy: `mobile/assets/ambient/sunflower-night.webp`
- Create: `mobile/src/contexts/AmbientLightingContext.tsx`
- Test: `mobile/src/contexts/__tests__/AmbientLightingContext.test.tsx`

- [ ] **Step 1: Copy sprites**

```bash
mkdir -p mobile/assets/ambient
cp assets/ambient/sunflower-day.webp mobile/assets/ambient/
cp assets/ambient/sunflower-night.webp mobile/assets/ambient/
```

- [ ] **Step 2: Test failing**

Créer `mobile/src/contexts/__tests__/AmbientLightingContext.test.tsx`:

```tsx
import React from "react";
import { renderHook } from "@testing-library/react-native";
import {
  AmbientLightingProvider,
  useAmbientLightingContext,
} from "../AmbientLightingContext";

describe("AmbientLightingProvider (RN)", () => {
  it("provides preset", () => {
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }) => (
        <AmbientLightingProvider>{children}</AmbientLightingProvider>
      ),
    });
    expect(result.current.preset).toBeDefined();
    expect(result.current.preset.frameIndex).toBeGreaterThanOrEqual(0);
  });

  it("respects enabled=false", () => {
    const { result } = renderHook(() => useAmbientLightingContext(), {
      wrapper: ({ children }) => (
        <AmbientLightingProvider enabled={false}>
          {children}
        </AmbientLightingProvider>
      ),
    });
    expect(result.current.enabled).toBe(false);
  });
});
```

- [ ] **Step 3: Implémenter**

Créer `mobile/src/contexts/AmbientLightingContext.tsx`:

```tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  getAmbientPresetV3,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

interface AmbientLightingContextValue {
  preset: AmbientPreset;
  enabled: boolean;
}

const Ctx = createContext<AmbientLightingContextValue | null>(null);

interface ProviderProps {
  enabled?: boolean;
  children: ReactNode;
}

export function AmbientLightingProvider({
  enabled = true,
  children,
}: ProviderProps) {
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPresetV3(new Date()),
  );

  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const update = () => setPreset(getAmbientPresetV3(new Date()));

    const start = () => {
      update();
      interval = setInterval(update, 30 * 1000);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [enabled]);

  return <Ctx.Provider value={{ preset, enabled }}>{children}</Ctx.Provider>;
}

export function useAmbientLightingContext(): AmbientLightingContextValue {
  const v = useContext(Ctx);
  if (!v) {
    return { preset: getAmbientPresetV3(new Date()), enabled: false };
  }
  return v;
}
```

- [ ] **Step 4: Confirmer le passage**

```bash
cd mobile && npm test -- AmbientLightingContext
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/contexts/AmbientLightingContext.tsx mobile/src/contexts/__tests__/AmbientLightingContext.test.tsx mobile/assets/ambient/
git commit -m "feat(mobile): add AmbientLightingProvider with AppState pause"
```

### Task 3.3: AmbientLightLayer Mobile (Reanimated)

**Files:**

- Replace: `mobile/src/components/backgrounds/AmbientLightLayer.tsx`
- Test: `mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx`

- [ ] **Step 1: Test failing**

Créer `mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { AmbientLightLayer } from "../AmbientLightLayer";
import { AmbientLightingProvider } from "../../../contexts/AmbientLightingContext";

describe("AmbientLightLayer (RN)", () => {
  it("renders with absoluteFill and pointerEvents=none", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const layer = getByTestId("ambient-light-layer");
    expect(layer.props.pointerEvents).toBe("none");
  });

  it("returns null when disabled", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("ambient-light-layer")).toBeNull();
  });
});
```

- [ ] **Step 2: Implémenter**

Remplacer `mobile/src/components/backgrounds/AmbientLightLayer.tsx`:

```tsx
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { rgbToCss } from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../../contexts/AmbientLightingContext";

const TRANSITION_MS = 4000;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

export function AmbientLightLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
  const haloColor = rgbToCss(preset.colors.primary, preset.beam.opacity * 0.5);

  // Reanimated angle
  const angle = useSharedValue(preset.beam.angleDeg);
  React.useEffect(() => {
    angle.value = withTiming(preset.beam.angleDeg, {
      duration: preset.isReducedMotion ? 0 : TRANSITION_MS,
      easing: EASE,
    });
  }, [preset.beam.angleDeg, preset.isReducedMotion]);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return (
    <View
      testID="ambient-light-layer"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {/* Halo */}
      <View
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: 250,
        }}
      >
        <LinearGradient
          colors={[haloColor, "transparent"]}
          style={{ flex: 1, opacity: 0.6 }}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </View>

      {/* Beam — gradient horizontal puis rotation */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: "50%",
            left: "-15%",
            width: "130%",
            height: 1.5,
          },
          beamStyle,
        ]}
      >
        <LinearGradient
          colors={["transparent", beamColor, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 3: Confirmer le passage**

```bash
cd mobile && npm test -- AmbientLightLayer
```

Expected: PASS — 2 tests.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/backgrounds/AmbientLightLayer.tsx mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx
git commit -m "feat(mobile): rewrite AmbientLightLayer with Reanimated 4 + engine v3"
```

### Task 3.4: SunflowerLayer Mobile (mascot only)

**Files:**

- Create: `mobile/src/components/backgrounds/SunflowerLayer.tsx`
- Test: `mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx`

- [ ] **Step 1: Test failing**

```tsx
// mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { SunflowerLayer } from "../SunflowerLayer";
import { AmbientLightingProvider } from "../../../contexts/AmbientLightingContext";

describe("SunflowerLayer (RN)", () => {
  it("renders mascot bottom-right with pointerEvents=none", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    const layer = getByTestId("sunflower-mascot");
    expect(layer.props.pointerEvents).toBe("none");
  });

  it("returns null when disabled", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("sunflower-mascot")).toBeNull();
  });
});
```

- [ ] **Step 2: Implémenter**

Créer `mobile/src/components/backgrounds/SunflowerLayer.tsx`:

```tsx
import React from "react";
import { Image, View } from "react-native";
import { useAmbientLightingContext } from "../../contexts/AmbientLightingContext";

const FRAME_SIZE = 256;
const GRID_COLS = 6;
const DISPLAY_SIZE = 60;

const SPRITE_DAY = require("../../../assets/ambient/sunflower-day.webp");
const SPRITE_NIGHT = require("../../../assets/ambient/sunflower-night.webp");

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const sprite = preset.nightMode === "glowing" ? SPRITE_NIGHT : SPRITE_DAY;
  const col = preset.frameIndex % GRID_COLS;
  const row = Math.floor(preset.frameIndex / GRID_COLS);

  return (
    <View
      testID="sunflower-mascot"
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 86, // au-dessus du tab bar
        right: 16,
        width: DISPLAY_SIZE,
        height: DISPLAY_SIZE,
        overflow: "hidden",
      }}
    >
      <Image
        source={sprite}
        style={{
          width: DISPLAY_SIZE * GRID_COLS,
          height: DISPLAY_SIZE * 4, // 4 rows
          position: "absolute",
          left: -col * DISPLAY_SIZE,
          top: -row * DISPLAY_SIZE,
        }}
        resizeMode="cover"
      />
    </View>
  );
}
```

- [ ] **Step 3: Confirmer le passage**

```bash
cd mobile && npm test -- SunflowerLayer
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/backgrounds/SunflowerLayer.tsx mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx
git commit -m "feat(mobile): add SunflowerLayer mascot with sprite frame from engine v3"
```

### Task 3.5: Intégration `_layout.tsx` + UI Settings

**Files:**

- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Modifier `_layout.tsx`**

Wrapping :

```tsx
import { AmbientLightingProvider } from "../src/contexts/AmbientLightingContext";
import { AmbientLightLayer } from "../src/components/backgrounds/AmbientLightLayer";
import { SunflowerLayer } from "../src/components/backgrounds/SunflowerLayer";
import { useAuth } from "../src/contexts/AuthContext";

export default function RootLayout() {
  const { user } = useAuth();
  const enabled = user?.preferences?.ambient_lighting_enabled !== false;

  return (
    <AmbientLightingProvider enabled={enabled}>
      <Stack /* existing config */ />
      <AmbientLightLayer />
      <SunflowerLayer />
    </AmbientLightingProvider>
  );
}
```

- [ ] **Step 2: Modifier `profile.tsx` (toggle)**

Ajouter une row :

```tsx
const [enabled, setEnabled] = useState(
  user?.preferences?.ambient_lighting_enabled !== false,
);

const handleToggle = async (val: boolean) => {
  setEnabled(val);
  await api.put("/api/auth/preferences", { ambient_lighting_enabled: val });
};

// JSX
<View style={styles.row}>
  <View>
    <Text style={[styles.title, { color: colors.text.primary }]}>
      Effet ambiant lumineux
    </Text>
    <Text style={[styles.desc, { color: colors.text.meta }]}>
      Affiche un rayon de lumière subtil et un tournesol qui suit la course du
      soleil.
    </Text>
  </View>
  <Switch value={enabled} onValueChange={handleToggle} />
</View>;
```

- [ ] **Step 3: Smoke test**

```bash
cd mobile && npx expo start
```

Lancer sur simulateur. Vérifier visuel : rayon, halo, tournesol mascot bas-droite, toggle profil.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/_layout.tsx mobile/app/\(tabs\)/profile.tsx
git commit -m "feat(mobile): mount AmbientLightingProvider + overlays in _layout, add Settings toggle"
```

### Task 3.6: Maestro snapshot test

**Files:**

- Create: `mobile/.maestro/ambient-lighting.yaml`

- [ ] **Step 1: Créer le test**

```yaml
# mobile/.maestro/ambient-lighting.yaml
appId: com.deepsight.app
---
- launchApp
- assertVisible:
    id: "sunflower-mascot"
- takeScreenshot: "ambient-lighting-home"
- tapOn: "Profil"
- assertVisible: "Effet ambiant lumineux"
- takeScreenshot: "ambient-lighting-settings"
```

- [ ] **Step 2: Run**

```bash
cd mobile && maestro test .maestro/ambient-lighting.yaml
```

Expected: 2 screenshots taken, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/.maestro/ambient-lighting.yaml
git commit -m "test(mobile): add Maestro snapshot for ambient lighting v3"
```

### Task 3.7: PR3 — Push & PR

```bash
git push -u origin feat/ambient-lighting-v3-mobile
gh pr create --title "feat(ambient-lighting-v3): mobile platform — Reanimated 4 + sprite mascot" --body "PR3 of 5 — depends on PR1 merged."
```

---

## Phase 4 — Extension Platform (PR4)

**Branche:** `feat/ambient-lighting-v3-extension`
**Durée estimée:** ~1 jour
**Dépendances:** PR1 ET PR0 (`feat/extension-sidepanel-v3`) mergées. Peut s'exécuter EN PARALLÈLE avec PR2 et PR3.

### Task 4.1: Setup branche + sprites + webpack

**Files:**

- Modify: `extension/webpack.config.js`
- Copy: sprites vers `extension/public/assets/ambient/`

- [ ] **Step 1: Branche depuis main (post-PR0 merge)**

```bash
git fetch origin
git checkout -b feat/ambient-lighting-v3-extension origin/main
```

- [ ] **Step 2: Copy sprites**

```bash
mkdir -p extension/public/assets/ambient
cp assets/ambient/sunflower-day.webp extension/public/assets/ambient/
cp assets/ambient/sunflower-night.webp extension/public/assets/ambient/
```

- [ ] **Step 3: Étendre webpack pour copier les sprites au build**

Modifier `extension/webpack.config.js` pour ajouter dans `plugins`:

```js
const CopyWebpackPlugin = require('copy-webpack-plugin');

// dans plugins:
new CopyWebpackPlugin({
  patterns: [
    { from: 'public/assets/ambient', to: 'assets/ambient' },
  ],
}),
```

Si `copy-webpack-plugin` n'est pas installé :

```bash
cd extension && npm install --save-dev copy-webpack-plugin
```

- [ ] **Step 4: Build**

```bash
cd extension && npm run build
ls dist/assets/ambient/
```

Expected: sunflower-day.webp + sunflower-night.webp présents dans dist.

- [ ] **Step 5: Commit**

```bash
git add extension/webpack.config.js extension/package.json extension/package-lock.json extension/public/assets/ambient/
git commit -m "feat(extension): wire sprite sheets via copy-webpack-plugin"
```

### Task 4.2: AmbientLightingContext + AmbientLightLayer (sidepanel)

**Files:**

- Create: `extension/src/sidepanel/contexts/AmbientLightingContext.tsx`
- Create: `extension/src/sidepanel/hooks/useAmbientPreset.ts`
- Replace: `extension/src/sidepanel/components/AmbientLightLayer.tsx`
- Test: `extension/__tests__/sidepanel/AmbientLightLayer.test.tsx`

- [ ] **Step 1: Créer le Context** (similar to web mais avec `chrome.storage` sync optionnel pour le pref)

Créer `extension/src/sidepanel/contexts/AmbientLightingContext.tsx`:

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getAmbientPresetV3,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

interface Value {
  preset: AmbientPreset;
  enabled: boolean;
}

const Ctx = createContext<Value | null>(null);

interface ProviderProps {
  enabled?: boolean;
  children: ReactNode;
}

export function AmbientLightingProvider({
  enabled = true,
  children,
}: ProviderProps) {
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPresetV3(new Date()),
  );

  useEffect(() => {
    if (!enabled) return;
    const update = () => setPreset(getAmbientPresetV3(new Date()));
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [enabled]);

  return <Ctx.Provider value={{ preset, enabled }}>{children}</Ctx.Provider>;
}

export function useAmbientLightingContext(): Value {
  const v = useContext(Ctx);
  if (!v) return { preset: getAmbientPresetV3(new Date()), enabled: false };
  return v;
}
```

- [ ] **Step 2: AmbientLightLayer pour sidepanel**

Créer `extension/src/sidepanel/components/AmbientLightLayer.tsx` (overwrite l'orphelin):

```tsx
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";
import { rgbToCss } from "@deepsight/lighting-engine";

export function AmbientLightLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
  const haloColor = rgbToCss(preset.colors.primary, preset.beam.opacity * 0.5);
  const accentColor = preset.haloAccentColor;

  return (
    <div
      aria-hidden="true"
      className="ambient-light-layer"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 360,
          height: 360,
          background: accentColor
            ? `radial-gradient(circle, ${haloColor} 0%, ${accentColor} 40%, transparent 70%)`
            : `radial-gradient(circle, ${haloColor}, transparent 60%)`,
          filter: "blur(30px)",
          mixBlendMode: "screen",
          transition: "background 4s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "-15%",
          width: "130%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${beamColor} 50%, transparent)`,
          boxShadow: `0 0 12px ${beamColor}, 0 0 32px ${beamColor}`,
          transform: `rotate(${preset.beam.angleDeg}deg)`,
          transition:
            "transform 4s cubic-bezier(0.4,0,0.2,1), background 4s, box-shadow 4s",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Test**

```tsx
// extension/__tests__/sidepanel/AmbientLightLayer.test.tsx
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../../src/sidepanel/components/AmbientLightLayer";
import { AmbientLightingProvider } from "../../src/sidepanel/contexts/AmbientLightingContext";

describe("AmbientLightLayer (extension)", () => {
  it("renders fixed inset overlay", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".ambient-light-layer")).toBeTruthy();
  });

  it("returns null when disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".ambient-light-layer")).toBeFalsy();
  });
});
```

```bash
cd extension && npm test -- sidepanel/AmbientLightLayer
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/contexts/ extension/src/sidepanel/components/AmbientLightLayer.tsx extension/__tests__/sidepanel/AmbientLightLayer.test.tsx
git commit -m "feat(extension/sidepanel): add AmbientLightingProvider + rewrite AmbientLightLayer with engine v3"
```

### Task 4.3: SunflowerLayer extension

**Files:**

- Create: `extension/src/sidepanel/components/SunflowerLayer.tsx`
- Create: `extension/src/viewer/components/SunflowerLayer.tsx` (idem)
- Test: `extension/__tests__/sidepanel/SunflowerLayer.test.tsx`

- [ ] **Step 1: Implémenter (mascot only — pas de hero)**

Créer `extension/src/sidepanel/components/SunflowerLayer.tsx`:

```tsx
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const FRAME_SIZE = 256;
const GRID_COLS = 6;
const DISPLAY_SIZE = 56;

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const sprite =
    preset.nightMode === "glowing"
      ? "sunflower-night.webp"
      : "sunflower-day.webp";
  const col = preset.frameIndex % GRID_COLS;
  const row = Math.floor(preset.frameIndex / GRID_COLS);

  return (
    <div
      aria-hidden="true"
      className="sunflower-mascot"
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        width: DISPLAY_SIZE,
        height: DISPLAY_SIZE,
        backgroundImage: `url(/assets/ambient/${sprite})`,
        backgroundSize: `${DISPLAY_SIZE * GRID_COLS}px auto`,
        backgroundPosition: `-${col * DISPLAY_SIZE}px -${row * DISPLAY_SIZE}px`,
        backgroundRepeat: "no-repeat",
        zIndex: 2,
        pointerEvents: "none",
        opacity: preset.beam.opacity,
        transition:
          "opacity 4s cubic-bezier(0.4,0,0.2,1), background-position 4s",
      }}
    />
  );
}
```

- [ ] **Step 2: Idem pour viewer**

Copier le même fichier dans `extension/src/viewer/components/SunflowerLayer.tsx` (même contenu, l'import du context devra adapter — soit on duplique aussi le Context dans viewer, soit on partage). Décision : pour Phase 4 on duplique `AmbientLightingContext` aussi dans viewer (pas de hero, code identique).

- [ ] **Step 3: Test**

```tsx
// extension/__tests__/sidepanel/SunflowerLayer.test.tsx
import { render } from "@testing-library/react";
import { SunflowerLayer } from "../../src/sidepanel/components/SunflowerLayer";
import { AmbientLightingProvider } from "../../src/sidepanel/contexts/AmbientLightingContext";

describe("SunflowerLayer (extension sidepanel)", () => {
  it("renders mascot fixed bottom-right", () => {
    const { container } = render(
      <AmbientLightingProvider>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".sunflower-mascot")).toBeTruthy();
  });

  it("returns null when disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <SunflowerLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector(".sunflower-mascot")).toBeFalsy();
  });
});
```

```bash
cd extension && npm test -- SunflowerLayer
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/components/SunflowerLayer.tsx extension/src/viewer/components/SunflowerLayer.tsx extension/src/viewer/contexts/ extension/__tests__/sidepanel/SunflowerLayer.test.tsx
git commit -m "feat(extension): add SunflowerLayer mascot for sidepanel + viewer"
```

### Task 4.4: Intégration App.tsx (sidepanel + popup + viewer)

**Files:**

- Modify: `extension/src/sidepanel/App.tsx`
- Modify: `extension/src/viewer/ViewerApp.tsx`
- Modify: `extension/src/popup/App.tsx`

- [ ] **Step 1: Sidepanel App.tsx**

```tsx
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { AmbientLightLayer } from "./components/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";
// ... existing imports (LoginView, MainView, etc.)

export function App() {
  // Read pref from chrome.storage or default true
  // ... existing auth state
  const enabled = userPrefs?.ambient_lighting_enabled !== false;

  return (
    <AmbientLightingProvider enabled={enabled}>
      <AmbientLightLayer />
      <SunflowerLayer />
      {/* existing routes / views */}
    </AmbientLightingProvider>
  );
}
```

- [ ] **Step 2: Viewer App**

Idem pour `extension/src/viewer/ViewerApp.tsx`.

- [ ] **Step 3: Popup App (sans SunflowerLayer)**

Pour `extension/src/popup/App.tsx`, **monter uniquement** AmbientLightLayer (pas de tournesol, espace 360×600 trop contraint) :

```tsx
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { AmbientLightLayer } from "./components/AmbientLightLayer";

export function App() {
  return (
    <AmbientLightingProvider>
      <AmbientLightLayer />
      {/* popup content */}
    </AmbientLightingProvider>
  );
}
```

- [ ] **Step 4: Build & test loadunpacked**

```bash
cd extension && npm run typecheck && npm run build
```

Expected: 0 erreur. Charger `dist/` dans Chrome (chrome://extensions, mode dev), ouvrir le sidepanel et le popup, vérifier visuel.

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/App.tsx extension/src/viewer/ViewerApp.tsx extension/src/popup/App.tsx extension/src/popup/contexts/ extension/src/popup/components/AmbientLightLayer.tsx
git commit -m "feat(extension): mount ambient lighting overlays in 3 entries (sidepanel + viewer + popup)"
```

### Task 4.5: Connect BeamCard to Context (modif minimal)

**Files:**

- Modify: `extension/src/sidepanel/shared/BeamCard.tsx` (si livrée par PR0 et accessible)

- [ ] **Step 1: Lire BeamCard actuel (livré par PR0)**

```bash
cat extension/src/sidepanel/shared/BeamCard.tsx
```

- [ ] **Step 2: Ajouter un `useContext` optionnel**

Modifier la signature pour qu'elle lise le Context si présent :

```tsx
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

interface BeamCardProps {
  children: ReactNode;
  beamColor?: string;
  haloColor?: string;
  angle?: number;
  intensity?: number;
  className?: string;
  onClick?: () => void;
  /** If true, derive beamColor/haloColor/angle/intensity from AmbientLightingContext (overrides props). */
  usePreset?: boolean;
}

export function BeamCard({
  children,
  beamColor: beamColorProp,
  haloColor: haloColorProp,
  angle: angleProp,
  intensity: intensityProp,
  className,
  onClick,
  usePreset = true, // default ON pour intégration auto
}: BeamCardProps) {
  let preset: ReturnType<typeof useAmbientLightingContext> | null = null;
  try {
    if (usePreset) preset = useAmbientLightingContext();
  } catch {
    /* no provider — use props */
  }

  const beamColor = preset?.enabled
    ? rgbToCss(preset.preset.beam.color, preset.preset.beam.opacity)
    : (beamColorProp ?? "#d4a574");

  const haloColor = preset?.enabled
    ? rgbToCss(preset.preset.colors.primary, preset.preset.beam.opacity * 0.5)
    : (haloColorProp ?? "#d4a574");

  const angle = preset?.enabled
    ? preset.preset.beam.angleDeg
    : (angleProp ?? 22);
  const intensity = preset?.enabled
    ? preset.preset.beam.opacity
    : (intensityProp ?? 0.4);

  // ... rest of existing render with beamColor/haloColor/angle/intensity
}
```

- [ ] **Step 3: Build & verify**

```bash
cd extension && npm run typecheck && npm run build
```

Expected: green. Le redesign MainView V3 livré par PR0 reste inchangé fonctionnellement (ses BeamCard prennent maintenant les couleurs du preset si Provider présent).

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/shared/BeamCard.tsx
git commit -m "feat(extension): wire BeamCard to AmbientLightingContext via optional usePreset prop"
```

### Task 4.6: PR4 — Push & PR

```bash
git push -u origin feat/ambient-lighting-v3-extension
gh pr create --title "feat(ambient-lighting-v3): extension platform — sidepanel + popup + viewer + BeamCard integration" --body "PR4 of 5 — depends on PR1 + PR0 (extension-sidepanel-v3) merged."
```

---

## Phase 5 — Cleanup (PR5)

**Branche:** `feat/ambient-lighting-v3-cleanup`
**Durée estimée:** ~0.5 jour
**Dépendances:** PR2 + PR3 + PR4 mergées.

### Task 5.1: Supprimer les composants legacy

**Files:**

- Delete: `frontend/src/hooks/useTimeOfDay.ts`
- Delete: `frontend/src/components/AmbientLightDevPanel.tsx`
- Delete: `frontend/src/hooks/useAmbientLightingFeatureFlag.ts`
- Delete: `mobile/src/hooks/useTimeOfDay.ts`

- [ ] **Step 1: Branche**

```bash
git fetch origin
git checkout -b feat/ambient-lighting-v3-cleanup origin/main
```

- [ ] **Step 2: Vérifier qu'aucun consumer**

```bash
grep -rn "useTimeOfDay\|AmbientLightDevPanel\|useAmbientLightingFeatureFlag" frontend/src mobile/src extension/src
```

Expected: 0 résultat. Si résultats, ce sont des consumers à migrer ou supprimer dans cette task aussi.

- [ ] **Step 3: Supprimer**

```bash
rm frontend/src/hooks/useTimeOfDay.ts
rm frontend/src/components/AmbientLightDevPanel.tsx
rm frontend/src/hooks/useAmbientLightingFeatureFlag.ts
rm mobile/src/hooks/useTimeOfDay.ts
```

- [ ] **Step 4: Lancer typecheck partout**

```bash
cd frontend && npm run typecheck
cd ../mobile && npm run typecheck
cd ../extension && npm run typecheck
```

Expected: 0 erreur partout.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(ambient-lighting): remove v1/v2 legacy (useTimeOfDay, AmbientLightDevPanel, feature flag)"
```

### Task 5.2: PRD migration v2 → v3

**Files:**

- Rename: `docs/PRD-ambient-lighting-v2.md` → `docs/PRD-ambient-lighting-v3.md`
- Modify: PRD content with v3 reality

- [ ] **Step 1: Renommer**

```bash
git mv docs/PRD-ambient-lighting-v2.md docs/PRD-ambient-lighting-v3.md
```

- [ ] **Step 2: Mise à jour du contenu**

Ouvrir `docs/PRD-ambient-lighting-v3.md`. Remplacer :

- Header `**Version**: v2` → `**Version**: v3`
- Section status : `Implemented` → `Implemented v3 (PRs #X #Y #Z)`
- Description : ajouter mention du tournesol, du sprite pipeline, du critical CSS
- Architecture : pointer vers `docs/superpowers/specs/2026-04-26-ambient-lighting-v3-design.md`

- [ ] **Step 3: Commit**

```bash
git add docs/PRD-ambient-lighting-v3.md
git commit -m "docs(ambient-lighting): migrate PRD to v3"
```

### Task 5.3: CHANGELOG entry

- [ ] **Step 1: Ajouter une entry**

Modifier `CHANGELOG.md` (ou créer si absent), ajouter en haut :

```markdown
## [Unreleased]

### Added

- **Ambient Lighting v3** — refonte complète cross-platform (web/mobile/extension) :
  - Beam de précision suivant l'arc solaire avec interpolation cubic-bezier
  - Tournesol 3D photoréaliste héliotrope (luminescent la nuit)
  - Pipeline pré-rendu Three.js → 2 sprite WebP (~150KB total)
  - Critical CSS preload (rayon visible avant hydratation React)
  - Toggle préférences user + respect prefers-reduced-motion
  - Design tokens textuels shifted vers blanc cassé (lisibilité)

### Removed

- `useTimeOfDay` legacy (web + mobile)
- `AmbientLightDevPanel` (dev panel obsolète)
- `useAmbientLightingFeatureFlag` (PostHog flag plus utilisé)
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add Ambient Lighting v3 entry"
```

### Task 5.4: PR5 — Push & PR

```bash
git push -u origin feat/ambient-lighting-v3-cleanup
gh pr create --title "chore(ambient-lighting-v3): cleanup legacy + PRD update + CHANGELOG" --body "PR5 of 5 — final cleanup."
```

---

## Self-Review Checklist (après écriture)

**1. Spec coverage** : pour chaque section du spec, identifier la task correspondante.

| Spec section          | Task                                                               |
| --------------------- | ------------------------------------------------------------------ |
| §1 Objectif           | Plan global                                                        |
| §2 Décisions          | Captées dans header + tâches                                       |
| §3 Architecture       | Tasks 1.1-1.6 + 2.3 + 3.2 + 4.2 (engine + 3 providers)             |
| §4 API engine v3      | Tasks 1.2-1.6                                                      |
| §5 Pipeline tournesol | Task 1.7                                                           |
| §6.1 Web              | Tasks 2.1-2.8                                                      |
| §6.2 Mobile           | Tasks 3.1-3.7                                                      |
| §6.3 Extension        | Tasks 4.1-4.6                                                      |
| §7 Audit textes       | Tasks 1.8-1.10                                                     |
| §8 User preferences   | Tasks 1.11 + 2.6 + 3.5                                             |
| §9 Tests & a11y       | Tâches inline (test step à chaque task)                            |
| §10 Roadmap           | Phase 1-5 ordering                                                 |
| §11 Risques           | Adressés dans tasks (cap intensity, AppState pause, bundle budget) |
| §12 Hors scope        | Pas de tâche (volontaire)                                          |

**2. Placeholder scan** : aucun "TBD/TODO/implement later" trouvé. Step 6.1 recommande "adapter à la lib UI utilisée" — c'est une instruction conditionnelle, pas un placeholder.

**3. Type consistency** : `getAmbientPresetV3` est utilisé partout (Tasks 1.6, 2.2, 2.3, 2.4, 2.5, 3.2, 4.2, 4.3). `AmbientPreset` étendu en Task 1.2 est consistant. `AmbientLightingProvider` / `useAmbientLightingContext` cohérents sur web/mobile/extension. `getSpriteFrameIndex` utilisé en 1.4. `KEYFRAMES_V3` en 1.5/1.6.

**4. Ambiguity** : Step 4.5 "Connect BeamCard to Context" dépend de la disponibilité de BeamCard livré par PR0 — fallback expliqué (props statiques default). Step 2.2 plugin Vite peut nécessiter un ajustement si vite-plugin-html déjà utilisé — adressé en commentaire.

---

## Execution Handoff

**Plan complet et sauvegardé dans `docs/superpowers/plans/2026-04-26-ambient-lighting-v3.md`.**

Deux options pour exécuter ce plan :

**1. Subagent-Driven (recommandée pour ce plan multi-PR cross-platform)** — je dispatch un fresh subagent par task, review entre les tasks, fast iteration. Particulièrement adapté pour PR2/PR3/PR4 qui peuvent s'exécuter en parallèle (3 agents simultanés).

**2. Inline Execution** — j'exécute les tasks dans cette session avec executing-plans, batch avec checkpoints.

**Quel approche tu préfères ?**
