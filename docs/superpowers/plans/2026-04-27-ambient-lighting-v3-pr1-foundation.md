# Ambient Lighting v3 — PR1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre l'engine `@deepsight/lighting-engine` vers v3 (frameIndex, nightMode, 48 keyframes, accents brand), produire le pipeline de génération du sprite tournesol photoréaliste avec palette logo officiel Tournesol, shift les design tokens textuels sur 3 plateformes vers blanc cassé, et ajouter le champ `User.preferences.ambient_lighting_enabled` côté backend.

**Architecture:** Le package TypeScript pur `packages/lighting-engine/` reste source de vérité unique. Sprite généré offline via Three.js Node, committed dans 3 répertoires d'assets. Tokens design shift via vars CSS + objet TS. Backend pref via JSON column `preferences` ajoutée par migration Alembic 008 (le model actuel n'a que des colonnes scalaires `default_lang/default_mode/default_model/voice_preferences`).

**Tech Stack:** TypeScript, Vitest, Three.js Node (`three`, `headless-gl` ou `canvas`), `sharp` (encoding WebP), Python 3.11/FastAPI, SQLAlchemy 2.0, Alembic.

**Reference spec:** `C:\Users\33667\DeepSight-Main\docs\superpowers\specs\2026-04-26-ambient-lighting-v3-design.md`

**Cross-PR coordination:** Cette PR1 est un **prérequis bloquant** pour PR2 (web), PR3 (mobile), PR4 (extension). Elles DOIVENT être démarrées seulement après merge de PR1 sur `main`. PR0 (`feat/extension-sidepanel-v3`) est indépendante et peut être mergée en parallèle.

---

## File Structure

### NEW files (created by this plan)

| Path                                                                                      | Responsibility                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\keyframes.v3.ts`              | 48 keyframes v3 (palette mix réaliste + accents indigo/violet brand)           |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts`                 | Algorithme `getAmbientPresetV3` (frameIndex + nightMode + reading-zone cap)    |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\useAmbientPreset.ts`          | Shared React hook (re-exporté pour les 3 plateformes)                          |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\keyframes.v3.test.ts`       | Vitest sur les 48 keyframes v3 (validité, monotonicité, palette)               |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts`          | Vitest sur algorithme v3 (8 horaires clés, seed déterministe, cap)             |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\useAmbientPreset.test.ts`   | Vitest hook avec mocks `prefers-reduced-motion`                                |
| `C:\Users\33667\DeepSight-Main\scripts\gen-sunflower-frames.mjs`                          | Pipeline Three.js Node headless (48 frames PNG → WebP via sharp)               |
| `C:\Users\33667\DeepSight-Main\scripts\__tests__\gen-sunflower-frames.test.mjs`           | Vitest snapshot d'1 frame (PNG buffer hash)                                    |
| `C:\Users\33667\DeepSight-Main\scripts\package.json`                                      | Dépendances Three.js + sharp + headless-gl                                     |
| `C:\Users\33667\DeepSight-Main\frontend\public\assets\ambient\sunflower-day.webp`         | Sprite WebP 1536×1024 jour (généré, committed)                                 |
| `C:\Users\33667\DeepSight-Main\frontend\public\assets\ambient\sunflower-night.webp`       | Sprite WebP 1536×1024 nuit luminescent (généré, committed)                     |
| `C:\Users\33667\DeepSight-Main\mobile\assets\ambient\sunflower-day.webp`                  | Copie du sprite jour pour Metro                                                |
| `C:\Users\33667\DeepSight-Main\mobile\assets\ambient\sunflower-night.webp`                | Copie du sprite nuit pour Metro                                                |
| `C:\Users\33667\DeepSight-Main\extension\public\assets\ambient\sunflower-day.webp`        | Copie du sprite jour pour copy-webpack-plugin                                  |
| `C:\Users\33667\DeepSight-Main\extension\public\assets\ambient\sunflower-night.webp`      | Copie du sprite nuit pour copy-webpack-plugin                                  |
| `C:\Users\33667\DeepSight-Main\backend\alembic\versions\008_add_user_preferences_json.py` | Migration alembic ajoutant colonne `preferences` JSON                          |
| `C:\Users\33667\DeepSight-Main\backend\tests\test_user_preferences_ambient.py`            | Pytest endpoint `PUT /api/auth/preferences` accepte `ambient_lighting_enabled` |

### MODIFIED files

| Path                                                                   | Changes                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\types.ts`  | Ajout `NightMode`, `AmbientPresetV3`, `PresetOptionsV3`                                     |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\index.ts`  | Exporter v3 API en plus de v2 (compat)                                                      |
| `C:\Users\33667\DeepSight-Main\packages\lighting-engine\package.json`  | Bump 2.0.0 → 3.0.0 + dep `react` peer                                                       |
| `C:\Users\33667\DeepSight-Main\frontend\src\index.css`                 | Shift `--text-secondary/muted/disabled/meta` vers slate-100/200/300                         |
| `C:\Users\33667\DeepSight-Main\mobile\src\theme\colors.ts`             | Shift `darkColors.textSecondary/textTertiary/textMuted` + ajout `textDisabled` + `textMeta` |
| `C:\Users\33667\DeepSight-Main\extension\src\styles\design-tokens.css` | Shift `--text-secondary/muted` + ajout `--text-disabled` + `--text-meta`                    |
| `C:\Users\33667\DeepSight-Main\backend\src\db\database.py`             | Ajout colonne `User.preferences` (JSON) + helper `get_preference()`                         |
| `C:\Users\33667\DeepSight-Main\backend\src\auth\schemas.py`            | `UpdatePreferencesRequest` accepte `ambient_lighting_enabled: Optional[bool]`               |
| `C:\Users\33667\DeepSight-Main\backend\src\auth\service.py`            | `update_user_preferences` gère la clé `ambient_lighting_enabled` (JSON merge)               |

### UNCHANGED files (read-only references)

- `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.ts` (v2, on garde)
- `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\keyframes.ts` (v2, on garde)
- `C:\Users\33667\DeepSight-Main\frontend\public\platforms\tournesol-icon.svg` (palette ref)

---

## External Dependencies to Install

### Add to `scripts/package.json` (NEW workspace, isolated devDeps)

```json
{
  "name": "@deepsight/scripts",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "build:sunflower-frames": "node gen-sunflower-frames.mjs",
    "test": "vitest run"
  },
  "devDependencies": {
    "three": "^0.169.0",
    "gl": "^8.0.2",
    "canvas": "^2.11.2",
    "sharp": "^0.33.5",
    "vitest": "^1.6.0"
  }
}
```

**Justification:**

- `three` 0.169 : moteur 3D (rendu pétales + lights)
- `gl` 8.0.2 : WebGL headless dans Node (combiné à `canvas`)
- `canvas` 2.11 : ImageData + readPixels readback du buffer GL
- `sharp` 0.33 : encoding WebP qualité 85 (taille cible <80KB par sprite)
- `vitest` 1.6 : aligné sur la version du package lighting-engine

### Add to `packages/lighting-engine/package.json`

```json
{
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  }
}
```

**Justification:** `useAmbientPreset` est un hook React. Les consumers (frontend/, mobile/, extension/) fournissent déjà React.

### Backend `requirements.txt` — aucun ajout (alembic et SQLAlchemy déjà présents).

---

## Tasks

### Task 1: Add `NightMode` type + `AmbientPresetV3` interface

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\types.ts`
- Test: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\types.v3.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\types.v3.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type {
  NightMode,
  AmbientPresetV3,
  PresetOptionsV3,
  AmbientKeyframeV3,
} from "../src/types";

describe("v3 type surface", () => {
  it("NightMode accepts 'asleep' | 'glowing'", () => {
    const a: NightMode = "asleep";
    const b: NightMode = "glowing";
    expect([a, b]).toEqual(["asleep", "glowing"]);
  });

  it("AmbientPresetV3 has all v3 fields", () => {
    const p: AmbientPresetV3 = {
      angle: 0,
      beamColor: "rgba(255,200,140,0.92)",
      haloColor: "rgba(255,200,140,0.45)",
      haloAccentColor: "rgba(99,102,241,0.30)",
      intensity: 0.8,
      frameIndex: 12,
      nightMode: null,
      isReducedMotion: false,
      isHighContrast: false,
      readingZoneIntensityCap: 0.5,
    };
    expect(p.frameIndex).toBe(12);
    expect(p.nightMode).toBeNull();
  });

  it("AmbientKeyframeV3 enforces optional haloAccentColor", () => {
    const k: AmbientKeyframeV3 = {
      time: "12:00",
      angle: -3,
      beamColor: "#fffae1",
      haloColor: "#fff4cc",
      intensity: 0.95,
      nightMode: null,
    };
    expect(k.haloAccentColor).toBeUndefined();
  });

  it("PresetOptionsV3 supports overrides", () => {
    const o: PresetOptionsV3 = {
      intensityMul: 0.5,
      forceNightMode: "glowing",
      forceTime: new Date("2026-04-27T22:00:00Z"),
      reducedMotionOverride: true,
      highContrastOverride: false,
    };
    expect(o.forceNightMode).toBe("glowing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- types.v3
```

Expected: `Cannot find name 'NightMode'` / `Cannot find name 'AmbientPresetV3'` etc. — compile error from `tsc`.

- [ ] **Step 3: Write minimal implementation**

Append to `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\types.ts` (after line 102, after `PresetOptions`):

```ts
// ─────────────────────────────────────────────────────────────────────────────
// v3 API surface (Ambient Lighting v3 — design spec 2026-04-26)
// Coexists with v2 types above (preset.ts, keyframes.ts). v3 lives in
// preset.v3.ts and keyframes.v3.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type NightMode = "asleep" | "glowing";

/**
 * Single keyframe in the v3 source-of-truth array (48 entries, 30 min step).
 */
export interface AmbientKeyframeV3 {
  /** "HH:MM" in 24h (00:00 → 23:30 step 30 min). */
  time: string;
  /** Beam angle in degrees, -90 to +90 (0 = horizontal beam left→right). */
  angle: number;
  /** Beam radial gradient core color (CSS hex or rgba). */
  beamColor: string;
  /** Halo source soft glow color (CSS hex or rgba). */
  haloColor: string;
  /** Optional brand accent layered over halo at twilights and night. */
  haloAccentColor?: string;
  /** 0..1 — base intensity (multiplied later by intensityMul + caps). */
  intensity: number;
  /** null = day, "asleep"|"glowing" = sunflower night state. */
  nightMode: NightMode | null;
}

/**
 * Computed preset returned by getAmbientPresetV3 (interpolated, capped, A11y-aware).
 */
export interface AmbientPresetV3 {
  /** Interpolated beam angle (degrees, -90..+90 + daily seed jitter ±15°). */
  angle: number;
  /** Interpolated beam color (rgba string). */
  beamColor: string;
  /** Interpolated halo color (rgba string). */
  haloColor: string;
  /** Optional brand accent (only set if at least one keyframe in the pair has one). */
  haloAccentColor?: string;
  /** Final intensity in 0..1 after caps + mul + a11y. */
  intensity: number;
  /** Sprite frame index 0..23 (day or night sheet). */
  frameIndex: number;
  /** null = day, otherwise sunflower variant. */
  nightMode: NightMode | null;
  /** True if media-query prefers-reduced-motion: reduce. */
  isReducedMotion: boolean;
  /** True if media-query prefers-contrast: more. */
  isHighContrast: boolean;
  /** Effective cap applied inside the 30%-70% reading band (max 0.5). */
  readingZoneIntensityCap: number;
}

export interface PresetOptionsV3 {
  /** Multiplier applied to intensity (default 1). */
  intensityMul?: number;
  /** Override of nightMode (testing/dev panel). */
  forceNightMode?: NightMode;
  /** Override of date (testing). */
  forceTime?: Date;
  /** Override prefers-reduced-motion detection (testing). */
  reducedMotionOverride?: boolean;
  /** Override prefers-contrast detection (testing). */
  highContrastOverride?: boolean;
  /** Disable daily seed variation (testing). */
  disableDailyVariation?: boolean;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- types.v3 && npm run typecheck
```

Expected: 4 tests pass, no TS errors.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/types.ts packages/lighting-engine/tests/types.v3.test.ts
git commit -m "feat(lighting-engine): add v3 type surface (NightMode, AmbientPresetV3, AmbientKeyframeV3)"
```

---

### Task 2: 48 keyframes v3 with brand accents

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\keyframes.v3.ts`
- Test: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\keyframes.v3.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\keyframes.v3.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { KEYFRAMES_V3 } from "../src/keyframes.v3";

describe("KEYFRAMES_V3", () => {
  it("has exactly 48 entries (every 30 minutes)", () => {
    expect(KEYFRAMES_V3.length).toBe(48);
  });

  it("times are sorted ascending and at exact 30-min steps", () => {
    KEYFRAMES_V3.forEach((kf, i) => {
      const expectedHour = Math.floor(i / 2);
      const expectedMin = (i % 2) * 30;
      const expected = `${String(expectedHour).padStart(2, "0")}:${String(expectedMin).padStart(2, "0")}`;
      expect(kf.time).toBe(expected);
    });
  });

  it("midnight (00:00) is glowing nightMode", () => {
    expect(KEYFRAMES_V3[0].time).toBe("00:00");
    expect(KEYFRAMES_V3[0].nightMode).toBe("glowing");
  });

  it("noon (12:00) is daylight (nightMode null)", () => {
    expect(KEYFRAMES_V3[24].time).toBe("12:00");
    expect(KEYFRAMES_V3[24].nightMode).toBeNull();
  });

  it("06:00 (sunrise) has indigo/violet accent", () => {
    const k = KEYFRAMES_V3[12];
    expect(k.time).toBe("06:00");
    expect(k.haloAccentColor).toBeDefined();
    expect(k.haloAccentColor!.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("18:00 (sunset) has accent + day mode", () => {
    const k = KEYFRAMES_V3[36];
    expect(k.time).toBe("18:00");
    expect(k.haloAccentColor).toBeDefined();
    expect(k.nightMode).toBeNull();
  });

  it("22:00 transitions back to glowing", () => {
    const k = KEYFRAMES_V3[44];
    expect(k.time).toBe("22:00");
    expect(k.nightMode).toBe("glowing");
  });

  it("all intensity values are in [0,1]", () => {
    KEYFRAMES_V3.forEach((kf) => {
      expect(kf.intensity).toBeGreaterThanOrEqual(0);
      expect(kf.intensity).toBeLessThanOrEqual(1);
    });
  });

  it("all angles are in [-90, +90]", () => {
    KEYFRAMES_V3.forEach((kf) => {
      expect(kf.angle).toBeGreaterThanOrEqual(-90);
      expect(kf.angle).toBeLessThanOrEqual(90);
    });
  });

  it("all beamColor and haloColor are valid CSS color strings", () => {
    const colorRe = /^(#[0-9a-fA-F]{6}|rgba?\(.+\))$/;
    KEYFRAMES_V3.forEach((kf) => {
      expect(kf.beamColor).toMatch(colorRe);
      expect(kf.haloColor).toMatch(colorRe);
    });
  });

  it("twilight slots (5:30-6:30 and 17:30-18:30) all carry brand accent", () => {
    const twilightIndices = [11, 12, 13, 35, 36, 37];
    twilightIndices.forEach((i) => {
      expect(KEYFRAMES_V3[i].haloAccentColor).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- keyframes.v3
```

Expected: `Cannot find module '../src/keyframes.v3'`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\keyframes.v3.ts`:

```ts
// 48 ambient lighting keyframes v3 — every 30 minutes from 00:00 to 23:30.
// Index N → time floor(N/2):(N%2)*30. See spec §3 + §4.
//
// Palette mix: realistic golden/white/orange/silver + brand accents
// (indigo #4f46e5, violet #8b5cf6, lavender #a5b4fc, plum #d8b4fe) at
// twilights and during the night, when sunflower goes "glowing" (luminescent).

import type { AmbientKeyframeV3 } from "./types";

export const KEYFRAMES_V3: ReadonlyArray<AmbientKeyframeV3> = [
  // ─────────────── 00:00 — 05:30 — DEEP NIGHT (moon zenith → pre-dawn) ──────
  {
    time: "00:00",
    angle: -10,
    beamColor: "#dce8ff",
    haloColor: "#c7d2fe",
    haloAccentColor: "#4f46e5",
    intensity: 0.65,
    nightMode: "glowing",
  },
  {
    time: "00:30",
    angle: -8,
    beamColor: "#dce8ff",
    haloColor: "#c7d2fe",
    haloAccentColor: "#4f46e5",
    intensity: 0.62,
    nightMode: "glowing",
  },
  {
    time: "01:00",
    angle: -6,
    beamColor: "#d8e3ff",
    haloColor: "#c0cdfe",
    haloAccentColor: "#4f46e5",
    intensity: 0.6,
    nightMode: "glowing",
  },
  {
    time: "01:30",
    angle: -4,
    beamColor: "#d4def9",
    haloColor: "#bdc6fb",
    haloAccentColor: "#4f46e5",
    intensity: 0.58,
    nightMode: "glowing",
  },
  {
    time: "02:00",
    angle: -2,
    beamColor: "#d0d9f3",
    haloColor: "#b8c0f7",
    haloAccentColor: "#4f46e5",
    intensity: 0.56,
    nightMode: "glowing",
  },
  {
    time: "02:30",
    angle: 0,
    beamColor: "#cbd2ec",
    haloColor: "#b3bbf2",
    haloAccentColor: "#4338ca",
    intensity: 0.54,
    nightMode: "glowing",
  },
  {
    time: "03:00",
    angle: 2,
    beamColor: "#c5cce6",
    haloColor: "#aeb6ed",
    haloAccentColor: "#4338ca",
    intensity: 0.52,
    nightMode: "glowing",
  },
  {
    time: "03:30",
    angle: 5,
    beamColor: "#bfc6e0",
    haloColor: "#a8b0e8",
    haloAccentColor: "#4338ca",
    intensity: 0.5,
    nightMode: "glowing",
  },
  {
    time: "04:00",
    angle: 8,
    beamColor: "#bcc4dc",
    haloColor: "#a3aae3",
    haloAccentColor: "#4338ca",
    intensity: 0.49,
    nightMode: "glowing",
  },
  {
    time: "04:30",
    angle: 12,
    beamColor: "#c0c8de",
    haloColor: "#a8aee5",
    haloAccentColor: "#6366f1",
    intensity: 0.51,
    nightMode: "glowing",
  },
  {
    time: "05:00",
    angle: 16,
    beamColor: "#cdb8d8",
    haloColor: "#b9a3df",
    haloAccentColor: "#7c3aed",
    intensity: 0.55,
    nightMode: "asleep",
  },
  {
    time: "05:30",
    angle: -65,
    beamColor: "#e7b3a8",
    haloColor: "#d6a09a",
    haloAccentColor: "#a5b4fc",
    intensity: 0.62,
    nightMode: "asleep",
  },
  // ─────────────── 06:00 — 11:30 — MORNING (sunrise → late morning) ─────────
  {
    time: "06:00",
    angle: -50,
    beamColor: "#ffd699",
    haloColor: "#ffc88c",
    haloAccentColor: "#a5b4fc",
    intensity: 0.78,
    nightMode: null,
  },
  {
    time: "06:30",
    angle: -45,
    beamColor: "#ffd9a0",
    haloColor: "#ffce95",
    haloAccentColor: "#c4b5fd",
    intensity: 0.8,
    nightMode: null,
  },
  {
    time: "07:00",
    angle: -40,
    beamColor: "#ffdfae",
    haloColor: "#ffd6a3",
    intensity: 0.82,
    nightMode: null,
  },
  {
    time: "07:30",
    angle: -35,
    beamColor: "#ffe5bb",
    haloColor: "#ffddb1",
    intensity: 0.84,
    nightMode: null,
  },
  {
    time: "08:00",
    angle: -30,
    beamColor: "#ffeac4",
    haloColor: "#ffe2b9",
    intensity: 0.86,
    nightMode: null,
  },
  {
    time: "08:30",
    angle: -25,
    beamColor: "#ffefcd",
    haloColor: "#ffe8c2",
    intensity: 0.88,
    nightMode: null,
  },
  {
    time: "09:00",
    angle: -20,
    beamColor: "#fff2d5",
    haloColor: "#ffeccb",
    intensity: 0.9,
    nightMode: null,
  },
  {
    time: "09:30",
    angle: -16,
    beamColor: "#fff5dd",
    haloColor: "#ffefd2",
    intensity: 0.91,
    nightMode: null,
  },
  {
    time: "10:00",
    angle: -12,
    beamColor: "#fff7e3",
    haloColor: "#fff2d8",
    intensity: 0.92,
    nightMode: null,
  },
  {
    time: "10:30",
    angle: -9,
    beamColor: "#fff8e9",
    haloColor: "#fff4dd",
    intensity: 0.93,
    nightMode: null,
  },
  {
    time: "11:00",
    angle: -6,
    beamColor: "#fff9ed",
    haloColor: "#fff5e0",
    intensity: 0.94,
    nightMode: null,
  },
  {
    time: "11:30",
    angle: -4,
    beamColor: "#fffae1",
    haloColor: "#fff4cc",
    intensity: 0.94,
    nightMode: null,
  },
  // ─────────────── 12:00 — 17:30 — DAY (zenith → late afternoon) ────────────
  {
    time: "12:00",
    angle: -3,
    beamColor: "#fffae1",
    haloColor: "#fff4cc",
    intensity: 0.95,
    nightMode: null,
  },
  {
    time: "12:30",
    angle: 0,
    beamColor: "#fffae0",
    haloColor: "#fff3c8",
    intensity: 0.95,
    nightMode: null,
  },
  {
    time: "13:00",
    angle: 4,
    beamColor: "#fff8d8",
    haloColor: "#fff0bf",
    intensity: 0.94,
    nightMode: null,
  },
  {
    time: "13:30",
    angle: 8,
    beamColor: "#fff5cf",
    haloColor: "#ffecb4",
    intensity: 0.93,
    nightMode: null,
  },
  {
    time: "14:00",
    angle: 12,
    beamColor: "#fff2c4",
    haloColor: "#ffe7a8",
    intensity: 0.92,
    nightMode: null,
  },
  {
    time: "14:30",
    angle: 16,
    beamColor: "#ffeeb6",
    haloColor: "#ffe09a",
    intensity: 0.91,
    nightMode: null,
  },
  {
    time: "15:00",
    angle: 20,
    beamColor: "#ffe9a8",
    haloColor: "#ffd98c",
    intensity: 0.9,
    nightMode: null,
  },
  {
    time: "15:30",
    angle: 25,
    beamColor: "#ffe39a",
    haloColor: "#ffd07f",
    intensity: 0.89,
    nightMode: null,
  },
  {
    time: "16:00",
    angle: 30,
    beamColor: "#ffd989",
    haloColor: "#ffc370",
    intensity: 0.88,
    nightMode: null,
  },
  {
    time: "16:30",
    angle: 35,
    beamColor: "#ffcb74",
    haloColor: "#ffb162",
    intensity: 0.87,
    nightMode: null,
  },
  {
    time: "17:00",
    angle: 40,
    beamColor: "#ffba61",
    haloColor: "#ffa258",
    intensity: 0.86,
    nightMode: null,
  },
  {
    time: "17:30",
    angle: 44,
    beamColor: "#ffa657",
    haloColor: "#ff985f",
    haloAccentColor: "#c4b5fd",
    intensity: 0.85,
    nightMode: null,
  },
  // ─────────────── 18:00 — 23:30 — EVENING (sunset → night) ─────────────────
  {
    time: "18:00",
    angle: 48,
    beamColor: "#ff8c50",
    haloColor: "#ff9966",
    haloAccentColor: "#d8b4fe",
    intensity: 0.85,
    nightMode: null,
  },
  {
    time: "18:30",
    angle: 52,
    beamColor: "#f57848",
    haloColor: "#f5894e",
    haloAccentColor: "#d8b4fe",
    intensity: 0.83,
    nightMode: null,
  },
  {
    time: "19:00",
    angle: 55,
    beamColor: "#e0654a",
    haloColor: "#e07a55",
    haloAccentColor: "#c4b5fd",
    intensity: 0.79,
    nightMode: null,
  },
  {
    time: "19:30",
    angle: 58,
    beamColor: "#c5564f",
    haloColor: "#c66d56",
    haloAccentColor: "#a78bfa",
    intensity: 0.74,
    nightMode: null,
  },
  {
    time: "20:00",
    angle: 60,
    beamColor: "#a04c5b",
    haloColor: "#a36058",
    haloAccentColor: "#a78bfa",
    intensity: 0.69,
    nightMode: null,
  },
  {
    time: "20:30",
    angle: 55,
    beamColor: "#7d4969",
    haloColor: "#7e5a64",
    haloAccentColor: "#8b5cf6",
    intensity: 0.62,
    nightMode: null,
  },
  {
    time: "21:00",
    angle: 40,
    beamColor: "#5d4778",
    haloColor: "#5d556e",
    haloAccentColor: "#8b5cf6",
    intensity: 0.55,
    nightMode: null,
  },
  {
    time: "21:30",
    angle: 0,
    beamColor: "#48458b",
    haloColor: "#4d4d77",
    haloAccentColor: "#7c3aed",
    intensity: 0.48,
    nightMode: null,
  },
  {
    time: "22:00",
    angle: -22,
    beamColor: "#3d4495",
    haloColor: "#48487c",
    haloAccentColor: "#6366f1",
    intensity: 0.42,
    nightMode: "glowing",
  },
  {
    time: "22:30",
    angle: -18,
    beamColor: "#3a4ba0",
    haloColor: "#4a4f88",
    haloAccentColor: "#6366f1",
    intensity: 0.55,
    nightMode: "glowing",
  },
  {
    time: "23:00",
    angle: -15,
    beamColor: "#4258ad",
    haloColor: "#5260a0",
    haloAccentColor: "#4f46e5",
    intensity: 0.62,
    nightMode: "glowing",
  },
  {
    time: "23:30",
    angle: -12,
    beamColor: "#5568bd",
    haloColor: "#5e6cb0",
    haloAccentColor: "#4f46e5",
    intensity: 0.64,
    nightMode: "glowing",
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- keyframes.v3
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/keyframes.v3.ts packages/lighting-engine/tests/keyframes.v3.test.ts
git commit -m "feat(lighting-engine): add 48 keyframes v3 with brand accents at twilights and night"
```

---

### Task 3: Helper `parseTimeToHours` + `findKeyframePairV3`

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts` (initial skeleton)
- Test: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts` (partial)

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTimeToHours, findKeyframePairV3 } from "../src/preset.v3";
import { KEYFRAMES_V3 } from "../src/keyframes.v3";

describe("parseTimeToHours", () => {
  it("converts '00:00' to 0", () => {
    expect(parseTimeToHours("00:00")).toBe(0);
  });
  it("converts '06:30' to 6.5", () => {
    expect(parseTimeToHours("06:30")).toBe(6.5);
  });
  it("converts '23:30' to 23.5", () => {
    expect(parseTimeToHours("23:30")).toBe(23.5);
  });
});

describe("findKeyframePairV3", () => {
  it("returns identical keyframe at exact time match", () => {
    const { from, to, ratio } = findKeyframePairV3(12);
    expect(from.time).toBe("12:00");
    expect(to.time).toBe("12:30");
    expect(ratio).toBe(0);
  });

  it("returns mid ratio at +15 min", () => {
    const { ratio } = findKeyframePairV3(12.25);
    expect(ratio).toBeCloseTo(0.5, 5);
  });

  it("wraps midnight (23:59 → 00:00)", () => {
    const { from, to } = findKeyframePairV3(23.99);
    expect(from.time).toBe("23:30");
    expect(to.time).toBe("00:00");
  });

  it("handles hour > 24 via modulo", () => {
    const { from } = findKeyframePairV3(25);
    expect(from.time).toBe("01:00");
  });

  it("returns the v3 keyframe shape", () => {
    const { from } = findKeyframePairV3(6);
    expect(from).toEqual(KEYFRAMES_V3[12]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- preset.v3
```

Expected: `Cannot find module '../src/preset.v3'`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts`:

```ts
// Ambient Lighting v3 — algorithm refonte (spec §4 "Algorithme")
//
// Refactored entry point getAmbientPresetV3(date, opts) computing:
//   1. Find 2 keyframes encadrant date (30-min slot)
//   2. Linear interp on angle, intensity, RGB(beamColor/haloColor)
//   3. frameIndex = floor(minutesSinceMidnight / 30) % 24 (per sprite)
//   4. Daily seed (mulberry32) → ±15° angle jitter
//   5. prefers-reduced-motion → freeze
//   6. prefers-contrast: more → cap intensity at 0.3
//   7. readingZoneIntensityCap = min(intensity, 0.5)
//   8. nightMode propagated from later keyframe (snap, no blend)

import type {
  AmbientKeyframeV3,
  AmbientPresetV3,
  NightMode,
  PresetOptionsV3,
} from "./types";
import { KEYFRAMES_V3 } from "./keyframes.v3";

/**
 * Parse "HH:MM" to fractional hours (e.g., "06:30" → 6.5).
 */
export function parseTimeToHours(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h + m / 60;
}

/**
 * Find the 2 keyframes surrounding `hour` (in fractional hours, 0..24)
 * with proper wrap around midnight.
 */
export function findKeyframePairV3(hour: number): {
  from: AmbientKeyframeV3;
  to: AmbientKeyframeV3;
  ratio: number;
} {
  const h = ((hour % 24) + 24) % 24;
  const slot = h * 2; // index in [0, 48)
  const i = Math.floor(slot) % 48;
  const next = (i + 1) % 48;
  const ratio = slot - Math.floor(slot);
  return { from: KEYFRAMES_V3[i], to: KEYFRAMES_V3[next], ratio };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- preset.v3
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/preset.v3.ts packages/lighting-engine/tests/preset.v3.test.ts
git commit -m "feat(lighting-engine): add parseTimeToHours and findKeyframePairV3 helpers"
```

---

### Task 4: Color interpolation (hex → rgba) + frameIndex computation

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts`
- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts`:

```ts
import {
  parseColorToRgba,
  lerpColorString,
  computeFrameIndex,
  applyDailySeedJitter,
} from "../src/preset.v3";

describe("parseColorToRgba", () => {
  it("parses hex #ff0000 to [255,0,0,1]", () => {
    expect(parseColorToRgba("#ff0000")).toEqual([255, 0, 0, 1]);
  });
  it("parses #fffae1 (mid color)", () => {
    expect(parseColorToRgba("#fffae1")).toEqual([255, 250, 225, 1]);
  });
  it("parses rgba(99,102,241,0.30)", () => {
    expect(parseColorToRgba("rgba(99,102,241,0.30)")).toEqual([
      99, 102, 241, 0.3,
    ]);
  });
  it("throws on invalid", () => {
    expect(() => parseColorToRgba("not-a-color")).toThrow();
  });
});

describe("lerpColorString", () => {
  it("returns from at ratio 0", () => {
    expect(lerpColorString("#ff0000", "#00ff00", 0)).toBe(
      "rgba(255,0,0,1.000)",
    );
  });
  it("returns to at ratio 1", () => {
    expect(lerpColorString("#ff0000", "#00ff00", 1)).toBe(
      "rgba(0,255,0,1.000)",
    );
  });
  it("interpolates linearly at ratio 0.5", () => {
    expect(lerpColorString("#ff0000", "#00ff00", 0.5)).toBe(
      "rgba(128,128,0,1.000)",
    );
  });
  it("interpolates alpha", () => {
    expect(lerpColorString("rgba(0,0,0,0)", "rgba(0,0,0,1)", 0.5)).toBe(
      "rgba(0,0,0,0.500)",
    );
  });
});

describe("computeFrameIndex", () => {
  it("00:00 → frame 0", () => {
    expect(computeFrameIndex(new Date("2026-04-27T00:00:00"))).toBe(0);
  });
  it("00:30 → frame 1", () => {
    expect(computeFrameIndex(new Date("2026-04-27T00:30:00"))).toBe(1);
  });
  it("12:15 → frame 24 % 24 = 0 (wraps each 12h)", () => {
    // floor((12*60+15)/30) % 24 = 24 % 24 = 0
    expect(computeFrameIndex(new Date("2026-04-27T12:15:00"))).toBe(0);
  });
  it("11:30 → frame 23", () => {
    expect(computeFrameIndex(new Date("2026-04-27T11:30:00"))).toBe(23);
  });
});

describe("applyDailySeedJitter", () => {
  it("is deterministic for same date", () => {
    const d1 = new Date("2026-04-27T10:00:00");
    const d2 = new Date("2026-04-27T18:00:00");
    expect(applyDailySeedJitter(0, d1)).toBe(applyDailySeedJitter(0, d2));
  });
  it("differs across days", () => {
    const d1 = new Date("2026-04-27T10:00:00");
    const d2 = new Date("2026-04-28T10:00:00");
    expect(applyDailySeedJitter(0, d1)).not.toBe(applyDailySeedJitter(0, d2));
  });
  it("stays within ±15° of base", () => {
    const d = new Date("2026-04-27T10:00:00");
    for (let base = -90; base <= 90; base += 5) {
      const j = applyDailySeedJitter(base, d);
      expect(Math.abs(j - base)).toBeLessThanOrEqual(15);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- preset.v3
```

Expected: `parseColorToRgba is not exported` etc.

- [ ] **Step 3: Write minimal implementation**

Append to `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts`:

```ts
import { mulberry32, seedFromDate } from "./seeded-random";
import { clamp } from "./interpolate";

/**
 * Parse a CSS color (#rgb, #rrggbb, rgba(r,g,b,a), rgb(r,g,b)) → [r,g,b,a].
 */
export function parseColorToRgba(c: string): [number, number, number, number] {
  const trimmed = c.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(isNaN)) throw new Error(`Invalid hex color: ${c}`);
      return [r, g, b, 1];
    }
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 1];
    }
    throw new Error(`Invalid hex color: ${c}`);
  }
  const m = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/,
  );
  if (!m) throw new Error(`Invalid CSS color: ${c}`);
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  return [r, g, b, a];
}

function rgbaToString(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)})`;
}

/**
 * Linear interpolation between 2 CSS color strings, returns rgba(...).
 */
export function lerpColorString(
  from: string,
  to: string,
  ratio: number,
): string {
  const t = clamp(ratio, 0, 1);
  const a = parseColorToRgba(from);
  const b = parseColorToRgba(to);
  return rgbaToString(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  );
}

/**
 * Sprite frame index: 0..23 (per sheet — day or night).
 * Uses minutes-since-midnight / 30 modulo 24, so each 12h cycles across the
 * 24 frames of one sheet.
 */
export function computeFrameIndex(date: Date): number {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return Math.floor(minutes / 30) % 24;
}

/**
 * Apply daily ±15° angle jitter using mulberry32 seeded from date.
 */
export function applyDailySeedJitter(baseAngle: number, date: Date): number {
  const seed = seedFromDate(date);
  const rng = mulberry32(seed);
  // 1st draw is offset jitter, 2nd would be future use
  const jitter = (rng() * 2 - 1) * 15; // ±15°
  return baseAngle + jitter;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- preset.v3
```

Expected: all tests pass (8 + 14 new = 22).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/preset.v3.ts packages/lighting-engine/tests/preset.v3.test.ts
git commit -m "feat(lighting-engine): add color interpolation and frameIndex helpers (v3)"
```

---

### Task 5: `getAmbientPresetV3` — full algorithm with caps + a11y

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts`
- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\preset.v3.test.ts`:

```ts
import { getAmbientPresetV3 } from "../src/preset.v3";

describe("getAmbientPresetV3 — 8 key hours", () => {
  const cases: Array<{ time: string; nightMode: "asleep" | "glowing" | null }> =
    [
      { time: "00:00", nightMode: "glowing" },
      { time: "03:00", nightMode: "glowing" },
      { time: "06:00", nightMode: null },
      { time: "09:00", nightMode: null },
      { time: "12:00", nightMode: null },
      { time: "15:00", nightMode: null },
      { time: "18:00", nightMode: null },
      { time: "22:00", nightMode: "glowing" },
    ];

  cases.forEach(({ time, nightMode }) => {
    it(`returns nightMode=${nightMode} at ${time}`, () => {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(2026, 3, 27, h, m, 0);
      const p = getAmbientPresetV3(d, { disableDailyVariation: true });
      expect(p.nightMode).toBe(nightMode);
    });
  });

  it("intensity is in [0,1] at all 8 reference hours", () => {
    cases.forEach(({ time }) => {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(2026, 3, 27, h, m, 0);
      const p = getAmbientPresetV3(d, { disableDailyVariation: true });
      expect(p.intensity).toBeGreaterThanOrEqual(0);
      expect(p.intensity).toBeLessThanOrEqual(1);
    });
  });

  it("frameIndex matches computeFrameIndex", () => {
    const d = new Date(2026, 3, 27, 6, 30);
    const p = getAmbientPresetV3(d, { disableDailyVariation: true });
    expect(p.frameIndex).toBe(13); // 6.5h → 13
  });

  it("readingZoneIntensityCap never exceeds 0.5", () => {
    for (let h = 0; h < 24; h += 0.5) {
      const d = new Date(2026, 3, 27, Math.floor(h), (h % 1) * 60);
      const p = getAmbientPresetV3(d, { disableDailyVariation: true });
      expect(p.readingZoneIntensityCap).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("getAmbientPresetV3 — daily seed determinism", () => {
  it("same date+time gives same angle", () => {
    const d1 = new Date(2026, 3, 27, 10, 0);
    const d2 = new Date(2026, 3, 27, 10, 0);
    const p1 = getAmbientPresetV3(d1);
    const p2 = getAmbientPresetV3(d2);
    expect(p1.angle).toBe(p2.angle);
  });

  it("different dates give different angles (different seed)", () => {
    const d1 = new Date(2026, 3, 27, 10, 0);
    const d2 = new Date(2026, 3, 28, 10, 0);
    const p1 = getAmbientPresetV3(d1);
    const p2 = getAmbientPresetV3(d2);
    expect(p1.angle).not.toBe(p2.angle);
  });

  it("disableDailyVariation removes jitter — angle = pure interpolation", () => {
    const d = new Date(2026, 3, 27, 12, 0);
    const p = getAmbientPresetV3(d, { disableDailyVariation: true });
    // 12:00 keyframe angle = -3
    expect(p.angle).toBe(-3);
  });
});

describe("getAmbientPresetV3 — accessibility", () => {
  it("reducedMotionOverride freezes intensity (still returns valid)", () => {
    const d = new Date(2026, 3, 27, 12, 0);
    const p = getAmbientPresetV3(d, {
      reducedMotionOverride: true,
      disableDailyVariation: true,
    });
    expect(p.isReducedMotion).toBe(true);
    expect(p.intensity).toBeGreaterThan(0);
  });

  it("highContrastOverride caps intensity at 0.3", () => {
    const d = new Date(2026, 3, 27, 12, 0);
    const p = getAmbientPresetV3(d, {
      highContrastOverride: true,
      disableDailyVariation: true,
    });
    expect(p.isHighContrast).toBe(true);
    expect(p.intensity).toBeLessThanOrEqual(0.3);
  });

  it("intensityMul applies before caps", () => {
    const d = new Date(2026, 3, 27, 12, 0);
    const p1 = getAmbientPresetV3(d, { disableDailyVariation: true });
    const p2 = getAmbientPresetV3(d, {
      intensityMul: 0.5,
      disableDailyVariation: true,
    });
    expect(p2.intensity).toBeCloseTo(p1.intensity * 0.5, 3);
  });

  it("forceNightMode overrides keyframe nightMode", () => {
    const d = new Date(2026, 3, 27, 12, 0);
    const p = getAmbientPresetV3(d, {
      forceNightMode: "glowing",
      disableDailyVariation: true,
    });
    expect(p.nightMode).toBe("glowing");
  });

  it("forceTime overrides actual date", () => {
    const baseDate = new Date(2026, 3, 27, 0, 0);
    const force = new Date(2026, 3, 27, 12, 0);
    const p = getAmbientPresetV3(baseDate, {
      forceTime: force,
      disableDailyVariation: true,
    });
    expect(p.frameIndex).toBe(0); // 12:00 → 24 % 24 = 0
    expect(p.nightMode).toBeNull();
  });
});

describe("getAmbientPresetV3 — interpolation", () => {
  it("interpolates beam color between 2 keyframes", () => {
    // 06:15 = midway between 06:00 and 06:30
    const d = new Date(2026, 3, 27, 6, 15);
    const p = getAmbientPresetV3(d, { disableDailyVariation: true });
    expect(p.beamColor).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
  });

  it("interpolates angle between 2 keyframes", () => {
    // 12:15 = midway between -3 (12:00) and 0 (12:30) → -1.5
    const d = new Date(2026, 3, 27, 12, 15);
    const p = getAmbientPresetV3(d, { disableDailyVariation: true });
    expect(p.angle).toBeCloseTo(-1.5, 1);
  });

  it("snaps nightMode to the later keyframe (no blend)", () => {
    // 04:45 → between 04:30 (glowing) and 05:00 (asleep)
    const d = new Date(2026, 3, 27, 4, 45);
    const p = getAmbientPresetV3(d, { disableDailyVariation: true });
    // Snap to "to" if ratio > 0.5, else "from"
    expect(["asleep", "glowing"]).toContain(p.nightMode);
  });

  it("haloAccentColor only present when at least one keyframe has it", () => {
    // 12:00 has no accent
    const d1 = new Date(2026, 3, 27, 12, 0);
    const p1 = getAmbientPresetV3(d1, { disableDailyVariation: true });
    expect(p1.haloAccentColor).toBeUndefined();

    // 18:00 has accent
    const d2 = new Date(2026, 3, 27, 18, 0);
    const p2 = getAmbientPresetV3(d2, { disableDailyVariation: true });
    expect(p2.haloAccentColor).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- preset.v3
```

Expected: `getAmbientPresetV3 is not exported`.

- [ ] **Step 3: Write minimal implementation**

Append to `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\preset.v3.ts`:

```ts
/**
 * Detect prefers-reduced-motion in browser. Returns false if SSR/Node.
 */
function detectReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Detect prefers-contrast: more in browser. Returns false if SSR/Node.
 */
function detectHighContrast(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-contrast: more)").matches;
}

/**
 * Lerp number a→b at t in [0,1].
 */
function lerpNum(a: number, b: number, t: number): number {
  const tt = clamp(t, 0, 1);
  return a + (b - a) * tt;
}

/**
 * Compute the v3 ambient preset for a given Date.
 */
export function getAmbientPresetV3(
  date: Date = new Date(),
  opts: PresetOptionsV3 = {},
): AmbientPresetV3 {
  const effectiveDate = opts.forceTime ?? date;
  const intensityMul = opts.intensityMul ?? 1;

  const isReducedMotion = opts.reducedMotionOverride ?? detectReducedMotion();
  const isHighContrast = opts.highContrastOverride ?? detectHighContrast();

  // 1+2. Find keyframe pair + interpolate
  const hour =
    effectiveDate.getHours() +
    effectiveDate.getMinutes() / 60 +
    effectiveDate.getSeconds() / 3600;
  const { from, to, ratio } = findKeyframePairV3(hour);

  // 3. Interp beam color, halo color, intensity, angle
  const beamColor = lerpColorString(from.beamColor, to.beamColor, ratio);
  const haloColor = lerpColorString(from.haloColor, to.haloColor, ratio);

  // haloAccentColor: keep optional, lerp if both present, else snap
  let haloAccentColor: string | undefined;
  if (from.haloAccentColor && to.haloAccentColor) {
    haloAccentColor = lerpColorString(
      from.haloAccentColor,
      to.haloAccentColor,
      ratio,
    );
  } else if (from.haloAccentColor && ratio < 0.5) {
    haloAccentColor = from.haloAccentColor;
  } else if (to.haloAccentColor && ratio >= 0.5) {
    haloAccentColor = to.haloAccentColor;
  }

  let angle = lerpNum(from.angle, to.angle, ratio);

  // 4. frameIndex
  const frameIndex = computeFrameIndex(effectiveDate);

  // 5. Daily seed jitter (±15°)
  if (!opts.disableDailyVariation && !isReducedMotion) {
    angle = applyDailySeedJitter(angle, effectiveDate);
  }

  // 6+7. Intensity caps:
  let intensity = lerpNum(from.intensity, to.intensity, ratio) * intensityMul;
  if (isHighContrast) {
    intensity = Math.min(intensity, 0.3);
  }
  intensity = clamp(intensity, 0, 1);

  // 8. Reading zone cap = always <= 0.5
  const readingZoneIntensityCap = Math.min(intensity, 0.5);

  // 9. nightMode — snap to the dominant keyframe (no fade — sunflower
  // identity must not blur). 0..0.5 → from, 0.5..1 → to.
  const rawNightMode: NightMode | null =
    ratio < 0.5 ? from.nightMode : to.nightMode;
  const nightMode = opts.forceNightMode ?? rawNightMode;

  return {
    angle,
    beamColor,
    haloColor,
    haloAccentColor,
    intensity,
    frameIndex,
    nightMode,
    isReducedMotion,
    isHighContrast,
    readingZoneIntensityCap,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- preset.v3 && npm run typecheck
```

Expected: all tests pass (22 + 19 new = 41).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/preset.v3.ts packages/lighting-engine/tests/preset.v3.test.ts
git commit -m "feat(lighting-engine): implement getAmbientPresetV3 with caps, a11y, daily seed"
```

---

### Task 6: `useAmbientPreset` shared React hook

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\useAmbientPreset.ts`
- Test: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\useAmbientPreset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\useAmbientPreset.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAmbientPreset } from "../src/useAmbientPreset";

describe("useAmbientPreset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 27, 12, 0, 0));
    // jsdom matchMedia mock
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a preset for current time", () => {
    const { result } = renderHook(() => useAmbientPreset());
    expect(result.current.frameIndex).toBe(0); // 12:00 → 24 % 24 = 0
    expect(result.current.nightMode).toBeNull();
  });

  it("re-renders every minute (default cadence)", () => {
    const { result } = renderHook(() => useAmbientPreset());
    const initialFrame = result.current.frameIndex;

    act(() => {
      vi.advanceTimersByTime(60_000); // +1 min → still in 12:00 slot
    });
    expect(result.current.frameIndex).toBe(initialFrame); // same slot

    act(() => {
      vi.advanceTimersByTime(30 * 60_000); // +30 min → next slot
    });
    expect(result.current.frameIndex).not.toBe(initialFrame);
  });

  it("respects forceTime (no auto-update)", () => {
    const force = new Date(2026, 3, 27, 6, 0, 0);
    const { result } = renderHook(() => useAmbientPreset({ forceTime: force }));
    expect(result.current.frameIndex).toBe(12); // 06:00 → 12
  });

  it("respects intensityMul prop", () => {
    const { result, rerender } = renderHook(
      ({ mul }: { mul: number }) => useAmbientPreset({ intensityMul: mul }),
      { initialProps: { mul: 1 } },
    );
    const i1 = result.current.intensity;
    rerender({ mul: 0.5 });
    expect(result.current.intensity).toBeCloseTo(i1 * 0.5, 3);
  });

  it("listens to prefers-reduced-motion changes", () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    (window.matchMedia as any).mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: (_: string, cb: any) => {
        if (q.includes("reduced-motion")) listener = cb;
      },
      removeEventListener: vi.fn(),
    }));
    const { result } = renderHook(() => useAmbientPreset());
    expect(result.current.isReducedMotion).toBe(false);

    act(() => {
      listener?.({ matches: true });
    });
    expect(result.current.isReducedMotion).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

First add `@testing-library/react` + `jsdom` if not present:

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine
npm install --save-dev @testing-library/react@^14.2.1 react@^18.2.0 react-dom@^18.2.0 jsdom@^24.0.0
```

Then:

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- useAmbientPreset
```

Expected: `Cannot find module '../src/useAmbientPreset'`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\useAmbientPreset.ts`:

```ts
// React hook that re-computes the v3 ambient preset on a tick (default 60s)
// and listens to media-query changes for prefers-reduced-motion / contrast.
//
// Re-exported by the package; consumers just import from
// "@deepsight/lighting-engine".

import { useEffect, useMemo, useState } from "react";
import { getAmbientPresetV3 } from "./preset.v3";
import type { AmbientPresetV3, PresetOptionsV3 } from "./types";

export interface UseAmbientPresetOptions extends PresetOptionsV3 {
  /** Tick interval in ms; default 60_000 (1 min). */
  tickMs?: number;
}

function readMq(query: string): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function useAmbientPreset(
  opts: UseAmbientPresetOptions = {},
): AmbientPresetV3 {
  const tickMs = opts.tickMs ?? 60_000;

  // Tick counter to force re-render every tickMs
  const [tick, setTick] = useState(0);

  // Live media-query state (the engine also reads them, but we want a state
  // change to trigger re-render when the user toggles their OS setting).
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      opts.reducedMotionOverride ?? readMq("(prefers-reduced-motion: reduce)"),
  );
  const [highContrast, setHighContrast] = useState(
    () => opts.highContrastOverride ?? readMq("(prefers-contrast: more)"),
  );

  // Setup interval (only if no forceTime)
  useEffect(() => {
    if (opts.forceTime) return;
    const id = setInterval(() => setTick((t) => t + 1), tickMs);
    return () => clearInterval(id);
  }, [tickMs, opts.forceTime]);

  // Setup matchMedia listeners
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (opts.reducedMotionOverride !== undefined) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent | { matches: boolean }) =>
      setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler as any);
    return () => mq.removeEventListener?.("change", handler as any);
  }, [opts.reducedMotionOverride]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (opts.highContrastOverride !== undefined) return;
    const mq = window.matchMedia("(prefers-contrast: more)");
    const handler = (e: MediaQueryListEvent | { matches: boolean }) =>
      setHighContrast(e.matches);
    mq.addEventListener?.("change", handler as any);
    return () => mq.removeEventListener?.("change", handler as any);
  }, [opts.highContrastOverride]);

  return useMemo(() => {
    const date = opts.forceTime ?? new Date();
    return getAmbientPresetV3(date, {
      ...opts,
      reducedMotionOverride: reducedMotion,
      highContrastOverride: highContrast,
    });
  }, [
    tick,
    reducedMotion,
    highContrast,
    opts.intensityMul,
    opts.forceNightMode,
    opts.forceTime,
    opts.disableDailyVariation,
    opts,
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Update `C:\Users\33667\DeepSight-Main\packages\lighting-engine\vitest.config.ts` to enable jsdom env on test file:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    environmentMatchGlobs: [["tests/useAmbientPreset.test.ts", "jsdom"]],
    include: ["tests/**/*.test.ts"],
  },
});
```

Then:

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test
```

Expected: all tests pass (5 new + previous).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/useAmbientPreset.ts packages/lighting-engine/tests/useAmbientPreset.test.ts packages/lighting-engine/vitest.config.ts packages/lighting-engine/package.json packages/lighting-engine/package-lock.json
git commit -m "feat(lighting-engine): add useAmbientPreset shared React hook with mq listeners"
```

---

### Task 7: Export v3 API from package + bump version

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\index.ts`
- Modify: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\package.json`
- Test: `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\index.v3.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\packages\lighting-engine\tests\index.v3.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as engine from "../src/index";

describe("public v3 API surface", () => {
  it("exports v3 algorithm", () => {
    expect(typeof engine.getAmbientPresetV3).toBe("function");
    expect(typeof engine.findKeyframePairV3).toBe("function");
    expect(typeof engine.parseTimeToHours).toBe("function");
    expect(typeof engine.parseColorToRgba).toBe("function");
    expect(typeof engine.lerpColorString).toBe("function");
    expect(typeof engine.computeFrameIndex).toBe("function");
    expect(typeof engine.applyDailySeedJitter).toBe("function");
  });

  it("exports v3 keyframes (48 entries)", () => {
    expect(Array.isArray(engine.KEYFRAMES_V3)).toBe(true);
    expect(engine.KEYFRAMES_V3.length).toBe(48);
  });

  it("exports useAmbientPreset hook", () => {
    expect(typeof engine.useAmbientPreset).toBe("function");
  });

  it("preserves v2 API (compat)", () => {
    expect(typeof engine.getAmbientPreset).toBe("function");
    expect(typeof engine.findKeyframePair).toBe("function");
    expect(Array.isArray(engine.KEYFRAMES)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test -- index.v3
```

Expected: missing exports.

- [ ] **Step 3: Write minimal implementation**

Replace `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\index.ts`:

```ts
// Public API of @deepsight/lighting-engine
//
// v2 API (legacy, supported until v3 fully rolled out across PR2/3/4):
export { getAmbientPreset, findKeyframePair } from "./preset";
export { KEYFRAMES } from "./keyframes";
export { seedFromDate, mulberry32 } from "./seeded-random";
export { computeAngleVariation, DAILY_VARIATION } from "./angle-variation";
export { getMoonState } from "./moon-trajectory";
export { getSunState } from "./sun-trajectory";
export {
  lerp,
  lerpColor,
  lerpAngle,
  rgbToCss,
  rgbToHex,
  clamp,
} from "./interpolate";

export type {
  RGB,
  StarDensity,
  BeamType,
  Keyframe,
  KeyframeColors,
  BeamPreset,
  DiscPreset,
  AmbientLayerPreset,
  ColorPalettePreset,
  AmbientPreset,
  PresetOptions,
} from "./types";

// v3 API (Ambient Lighting v3 — design spec 2026-04-26):
export { KEYFRAMES_V3 } from "./keyframes.v3";
export {
  getAmbientPresetV3,
  findKeyframePairV3,
  parseTimeToHours,
  parseColorToRgba,
  lerpColorString,
  computeFrameIndex,
  applyDailySeedJitter,
} from "./preset.v3";
export { useAmbientPreset } from "./useAmbientPreset";
export type { UseAmbientPresetOptions } from "./useAmbientPreset";

export type {
  NightMode,
  AmbientKeyframeV3,
  AmbientPresetV3,
  PresetOptionsV3,
} from "./types";
```

Bump version in `C:\Users\33667\DeepSight-Main\packages\lighting-engine\package.json`:

```json
{
  "name": "@deepsight/lighting-engine",
  "version": "3.0.0",
  "description": "Ambient lighting engine v3 — 48 keyframes, frameIndex sprite, brand accents, A11y caps",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
  "devDependencies": {
    "@testing-library/react": "^14.2.1",
    "jsdom": "^24.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "files": ["src", "README.md"],
  "license": "UNLICENSED"
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test && npm run typecheck
```

Expected: all tests pass (incl. v2 untouched).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add packages/lighting-engine/src/index.ts packages/lighting-engine/package.json packages/lighting-engine/tests/index.v3.test.ts
git commit -m "feat(lighting-engine): bump to 3.0.0 and export v3 public API alongside v2"
```

---

### Task 8: Scaffold `scripts/` workspace + sunflower geometry helper

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\scripts\package.json`
- Create: `C:\Users\33667\DeepSight-Main\scripts\sunflower-geometry.mjs`
- Create: `C:\Users\33667\DeepSight-Main\scripts\__tests__\sunflower-geometry.test.mjs`
- Create: `C:\Users\33667\DeepSight-Main\scripts\vitest.config.mjs`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\scripts\package.json`:

```json
{
  "name": "@deepsight/scripts",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "build:sunflower-frames": "node gen-sunflower-frames.mjs",
    "test": "vitest run"
  },
  "devDependencies": {
    "three": "^0.169.0",
    "gl": "^8.0.2",
    "canvas": "^2.11.2",
    "sharp": "^0.33.5",
    "vitest": "^1.6.0"
  }
}
```

Create `C:\Users\33667\DeepSight-Main\scripts\vitest.config.mjs`:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.mjs"],
    environment: "node",
  },
});
```

Create `C:\Users\33667\DeepSight-Main\scripts\__tests__\sunflower-geometry.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import {
  TOURNESOL_PALETTE,
  generatePetalRing,
  generateFibonacciSeeds,
} from "../sunflower-geometry.mjs";

describe("TOURNESOL_PALETTE", () => {
  it("matches official Tournesol logo colors", () => {
    expect(TOURNESOL_PALETTE.outerPetals).toBe("#9DC209"); // green lime
    expect(TOURNESOL_PALETTE.innerPetals).toBe("#F3BE00"); // gold yellow
    expect(TOURNESOL_PALETTE.centerOuter).toBe("#BF5F06"); // rust
    expect(TOURNESOL_PALETTE.centerMid).toBe("#7A3A03");
    expect(TOURNESOL_PALETTE.centerInner).toBe("#3D1D01");
  });

  it("night palette uses brand emissive", () => {
    expect(TOURNESOL_PALETTE.emissiveNight).toBe("#4f46e5"); // indigo
  });
});

describe("generatePetalRing", () => {
  it("produces 12 outer petals (green corona)", () => {
    const petals = generatePetalRing("outer", 12);
    expect(petals.length).toBe(12);
    petals.forEach((p) => {
      expect(p.color).toBe(TOURNESOL_PALETTE.outerPetals);
      expect(p.radius).toBeGreaterThan(0);
      expect(p.angle).toBeGreaterThanOrEqual(0);
      expect(p.angle).toBeLessThan(Math.PI * 2);
    });
  });

  it("produces 12 inner petals (golden corona) at offset radius", () => {
    const outer = generatePetalRing("outer", 12);
    const inner = generatePetalRing("inner", 12);
    expect(inner[0].radius).toBeLessThan(outer[0].radius);
    inner.forEach((p) => {
      expect(p.color).toBe(TOURNESOL_PALETTE.innerPetals);
    });
  });

  it("petals are evenly spaced", () => {
    const petals = generatePetalRing("outer", 12);
    const expectedStep = (Math.PI * 2) / 12;
    expect(petals[1].angle - petals[0].angle).toBeCloseTo(expectedStep, 5);
  });
});

describe("generateFibonacciSeeds", () => {
  it("produces 24 seeds in a Fibonacci spiral pattern", () => {
    const seeds = generateFibonacciSeeds(24);
    expect(seeds.length).toBe(24);
    seeds.forEach((s) => {
      expect(s.x).toBeGreaterThanOrEqual(-1);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.alpha).toBeGreaterThanOrEqual(0.6);
      expect(s.alpha).toBeLessThanOrEqual(1);
    });
  });

  it("seed alpha increases towards the rim", () => {
    const seeds = generateFibonacciSeeds(24);
    // Seed 0 is closest to center → lower alpha
    // Seed 23 is closest to rim → higher alpha
    expect(seeds[23].alpha).toBeGreaterThan(seeds[0].alpha);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/scripts && npm install && npm test
```

Expected: `Cannot find module '../sunflower-geometry.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\33667\DeepSight-Main\scripts\sunflower-geometry.mjs`:

```js
// Geometric helpers for the sunflower 3D model used by gen-sunflower-frames.mjs.
// Pure functions — no Three.js / WebGL dependency, fully unit-testable.

/**
 * Official Tournesol logo palette (from frontend/public/platforms/tournesol-icon.svg).
 * See spec §14.2.
 */
export const TOURNESOL_PALETTE = Object.freeze({
  outerPetals: "#9DC209", // green lime (couronne externe)
  innerPetals: "#F3BE00", // gold yellow (couronne interne)
  centerOuter: "#BF5F06", // rust (disque externe)
  centerMid: "#7A3A03", // depth gradient mid
  centerInner: "#3D1D01", // depth gradient inner
  seedColor: "#1c0f00", // tiny seeds dot color
  emissiveNight: "#4f46e5", // indigo emissive for night variant
});

/**
 * Generate `count` petal descriptors for ring `kind`.
 * @param {"outer" | "inner"} kind
 * @param {number} count
 * @returns {Array<{ angle:number, radius:number, color:string, length:number, width:number }>}
 */
export function generatePetalRing(kind, count) {
  const isOuter = kind === "outer";
  const radius = isOuter ? 1.0 : 0.62;
  const length = isOuter ? 0.55 : 0.42;
  const width = isOuter ? 0.18 : 0.14;
  const color = isOuter
    ? TOURNESOL_PALETTE.outerPetals
    : TOURNESOL_PALETTE.innerPetals;

  const petals = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    petals.push({ angle, radius, color, length, width });
  }
  return petals;
}

/**
 * Generate `count` seed positions following a Fibonacci spiral on the
 * sunflower disk (golden angle = ~137.508°).
 * @param {number} count
 * @returns {Array<{ x:number, y:number, alpha:number }>}
 */
export function generateFibonacciSeeds(count) {
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0..1
    const r = Math.sqrt(t) * 0.55; // seeds stay inside the brown center
    const a = i * phi;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    // Alpha ramps 0.6→1.0 from center to rim
    const alpha = 0.6 + 0.4 * t;
    out.push({ x, y, alpha });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/scripts && npm test
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add scripts/package.json scripts/package-lock.json scripts/vitest.config.mjs scripts/sunflower-geometry.mjs scripts/__tests__/sunflower-geometry.test.mjs
git commit -m "feat(scripts): add sunflower geometry helpers (Tournesol palette + petal rings + Fibonacci seeds)"
```

---

### Task 9: `gen-sunflower-frames.mjs` — Three.js scene + 1-frame snapshot

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\scripts\gen-sunflower-frames.mjs`
- Test: `C:\Users\33667\DeepSight-Main\scripts\__tests__\gen-sunflower-frames.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\scripts\__tests__\gen-sunflower-frames.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import {
  buildSunflowerScene,
  renderSingleFrame,
} from "../gen-sunflower-frames.mjs";

describe("buildSunflowerScene", () => {
  it("returns a Three.js scene with 24 petals + 1 center disk", () => {
    const { scene, camera, sunflower } = buildSunflowerScene("day");
    expect(scene).toBeDefined();
    expect(camera).toBeDefined();
    // 12 outer + 12 inner = 24 petals
    expect(
      sunflower.children.filter((c) => c.userData.role === "petal").length,
    ).toBe(24);
    expect(
      sunflower.children.filter((c) => c.userData.role === "center").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("night variant has emissive material on petals", () => {
    const { sunflower } = buildSunflowerScene("night");
    const petal = sunflower.children.find((c) => c.userData.role === "petal");
    expect(petal.material.emissiveIntensity).toBeGreaterThan(0.5);
  });
});

describe("renderSingleFrame (snapshot)", () => {
  it("returns a 256x256 RGBA buffer", async () => {
    const buf = await renderSingleFrame({ variant: "day", angleY: 0 });
    // 256 * 256 * 4 channels (RGBA) = 262144 bytes
    expect(buf.length).toBe(256 * 256 * 4);
  });

  it("buffer is non-empty (contains painted pixels)", async () => {
    const buf = await renderSingleFrame({ variant: "day", angleY: 0 });
    // At least some non-zero pixel (either petal or center)
    let nonZero = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] > 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(1000);
  });

  it("frames at different angles produce different buffers", async () => {
    const a = await renderSingleFrame({ variant: "day", angleY: 0 });
    const b = await renderSingleFrame({ variant: "day", angleY: Math.PI / 2 });
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    expect(diff).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/scripts && npm test -- gen-sunflower-frames
```

Expected: `Cannot find module '../gen-sunflower-frames.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\33667\DeepSight-Main\scripts\gen-sunflower-frames.mjs`:

```js
// Headless Three.js renderer producing 48 sunflower frames (24 day + 24 night).
//
// Output sprite layout: 6 cols × 4 rows = 24 frames per sheet @ 256×256
// Total sheet: 1536×1024 px, encoded WebP quality 85 via sharp.
//
// Run with: npm run build:sunflower-frames
// Inputs:   none
// Outputs:  frontend/public/assets/ambient/sunflower-{day,night}.webp
//           mobile/assets/ambient/sunflower-{day,night}.webp
//           extension/public/assets/ambient/sunflower-{day,night}.webp

import * as THREE from "three";
import gl from "gl";
import { createCanvas } from "canvas";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import {
  TOURNESOL_PALETTE,
  generatePetalRing,
  generateFibonacciSeeds,
} from "./sunflower-geometry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const FRAME_SIZE = 256;
const FRAMES_PER_SHEET = 24;
const SHEET_COLS = 6;
const SHEET_ROWS = 4;

function hexToColor(hex) {
  return new THREE.Color(hex);
}

/**
 * Build a Three.js scene with the sunflower model + lights.
 */
export function buildSunflowerScene(variant /* "day" | "night" */) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 3.6);
  camera.lookAt(0, 0, 0);

  const sunflower = new THREE.Group();

  // Center disk (3 layered cones for depth gradient brown)
  const centerColors = [
    TOURNESOL_PALETTE.centerOuter,
    TOURNESOL_PALETTE.centerMid,
    TOURNESOL_PALETTE.centerInner,
  ];
  centerColors.forEach((c, i) => {
    const radius = 0.55 - i * 0.12;
    const geom = new THREE.CircleGeometry(radius, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: hexToColor(c),
      roughness: 0.7,
      metalness: 0.05,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = 0.001 * (i + 1);
    mesh.userData.role = "center";
    sunflower.add(mesh);
  });

  // Fibonacci seeds dots (sprites)
  const seeds = generateFibonacciSeeds(24);
  seeds.forEach((s) => {
    const geom = new THREE.CircleGeometry(0.018, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: hexToColor(TOURNESOL_PALETTE.seedColor),
      transparent: true,
      opacity: s.alpha,
    });
    const m = new THREE.Mesh(geom, mat);
    m.position.set(s.x, s.y, 0.005);
    m.userData.role = "seed";
    sunflower.add(m);
  });

  // Petals — outer (green) ring + inner (golden) ring, 12 each
  const outerRing = generatePetalRing("outer", 12);
  const innerRing = generatePetalRing("inner", 12);

  [...outerRing, ...innerRing].forEach((p) => {
    const geom = new THREE.PlaneGeometry(p.width, p.length);
    const matOpts = {
      color: hexToColor(p.color),
      roughness: 0.4,
      metalness: 0.0,
      transparent: true,
      side: THREE.DoubleSide,
    };
    if (variant === "night") {
      matOpts.emissive = hexToColor(TOURNESOL_PALETTE.emissiveNight);
      matOpts.emissiveIntensity = 0.8;
    }
    const mat = new THREE.MeshStandardMaterial(matOpts);
    const mesh = new THREE.Mesh(geom, mat);
    const cx = Math.cos(p.angle) * p.radius;
    const cy = Math.sin(p.angle) * p.radius;
    mesh.position.set(cx * 0.6, cy * 0.6, -0.001);
    mesh.rotation.z = p.angle - Math.PI / 2;
    mesh.userData.role = "petal";
    sunflower.add(mesh);
  });

  scene.add(sunflower);

  // Lighting
  if (variant === "day") {
    // Golden hour key + fill
    const key = new THREE.DirectionalLight(0xfff4cc, 1.2);
    key.position.set(2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe1b3, 0.5);
    fill.position.set(-2, 1, 2);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  } else {
    // Night: cool key low intensity + emissive does most of the work
    const cool = new THREE.DirectionalLight(0xb6c8ff, 0.15);
    cool.position.set(0, 2, 4);
    scene.add(cool);
    scene.add(new THREE.AmbientLight(0x1a1a2a, 0.35));
  }

  return { scene, camera, sunflower };
}

/**
 * Render a single frame to a raw RGBA Buffer (256×256×4).
 * Uses headless WebGL via the `gl` package.
 */
export async function renderSingleFrame({ variant, angleY }) {
  const { scene, camera, sunflower } = buildSunflowerScene(variant);
  sunflower.rotation.y = angleY;

  const glCtx = gl(FRAME_SIZE, FRAME_SIZE, { preserveDrawingBuffer: true });
  if (!glCtx) {
    throw new Error("Could not create headless WebGL context (gl package).");
  }

  const renderer = new THREE.WebGLRenderer({
    context: glCtx,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(FRAME_SIZE, FRAME_SIZE, false);
  renderer.setClearColor(0x000000, 0);

  // Render
  renderer.render(scene, camera);

  // Read pixels
  const pixels = Buffer.alloc(FRAME_SIZE * FRAME_SIZE * 4);
  glCtx.readPixels(
    0,
    0,
    FRAME_SIZE,
    FRAME_SIZE,
    glCtx.RGBA,
    glCtx.UNSIGNED_BYTE,
    pixels,
  );

  renderer.dispose();
  return pixels;
}

/**
 * Build a 24-frame sprite sheet by stitching frames into a 6×4 grid.
 */
async function buildSheet(variant) {
  const sheetW = FRAME_SIZE * SHEET_COLS;
  const sheetH = FRAME_SIZE * SHEET_ROWS;
  const composite = [];

  for (let i = 0; i < FRAMES_PER_SHEET; i++) {
    const angleY = (i / FRAMES_PER_SHEET) * Math.PI * 2;
    const buf = await renderSingleFrame({ variant, angleY });

    // OpenGL gives bottom-up rows → flip vertically for sharp.
    const flipped = Buffer.alloc(buf.length);
    for (let row = 0; row < FRAME_SIZE; row++) {
      const srcStart = row * FRAME_SIZE * 4;
      const dstStart = (FRAME_SIZE - 1 - row) * FRAME_SIZE * 4;
      buf.copy(flipped, dstStart, srcStart, srcStart + FRAME_SIZE * 4);
    }

    const col = i % SHEET_COLS;
    const row = Math.floor(i / SHEET_COLS);
    composite.push({
      input: await sharp(flipped, {
        raw: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4 },
      })
        .png()
        .toBuffer(),
      top: row * FRAME_SIZE,
      left: col * FRAME_SIZE,
    });
  }

  return sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .webp({ quality: 85 })
    .toBuffer();
}

async function writeSpriteToAllPlatforms(variant, buffer) {
  const targets = [
    `frontend/public/assets/ambient/sunflower-${variant}.webp`,
    `mobile/assets/ambient/sunflower-${variant}.webp`,
    `extension/public/assets/ambient/sunflower-${variant}.webp`,
  ];
  for (const rel of targets) {
    const abs = path.join(REPO_ROOT, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    console.log(`✓ wrote ${rel} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }
}

async function main() {
  for (const variant of ["day", "night"]) {
    console.log(`Building ${variant} sprite sheet…`);
    const buf = await buildSheet(variant);
    await writeSpriteToAllPlatforms(variant, buf);
  }
  console.log("Done.");
}

// Only run main when invoked directly (not when imported by tests)
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/scripts && npm test -- gen-sunflower-frames
```

Expected: 4 tests pass. Note: if `gl` fails to compile on Windows native, fallback approach in Task 11.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add scripts/gen-sunflower-frames.mjs scripts/__tests__/gen-sunflower-frames.test.mjs
git commit -m "feat(scripts): add Three.js headless renderer for sunflower frames (TDD via 1-frame snapshot)"
```

---

### Task 10: Generate the actual 48 frames + commit WebP sprites

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\frontend\public\assets\ambient\sunflower-day.webp`
- Create: `C:\Users\33667\DeepSight-Main\frontend\public\assets\ambient\sunflower-night.webp`
- Create: `C:\Users\33667\DeepSight-Main\mobile\assets\ambient\sunflower-day.webp`
- Create: `C:\Users\33667\DeepSight-Main\mobile\assets\ambient\sunflower-night.webp`
- Create: `C:\Users\33667\DeepSight-Main\extension\public\assets\ambient\sunflower-day.webp`
- Create: `C:\Users\33667\DeepSight-Main\extension\public\assets\ambient\sunflower-night.webp`

**Justification — no test:** Cette task ne contient pas de test unitaire car elle exécute simplement le pipeline déjà testé (Task 9) pour produire des assets binaires committés. La validation se fait :

1. Visuellement (l'agent humain inspecte le sprite généré),
2. Par taille (`< 200 KB par fichier`, vérifié au step 3),
3. Par cardinalité (6 fichiers committés, 1 par plateforme × 2 variants).

- [ ] **Step 1: Run the generation pipeline**

```bash
cd C:/Users/33667/DeepSight-Main/scripts && npm install && npm run build:sunflower-frames
```

Expected stdout:

```
Building day sprite sheet…
✓ wrote frontend/public/assets/ambient/sunflower-day.webp (~75 KB)
✓ wrote mobile/assets/ambient/sunflower-day.webp (~75 KB)
✓ wrote extension/public/assets/ambient/sunflower-day.webp (~75 KB)
Building night sprite sheet…
✓ wrote frontend/public/assets/ambient/sunflower-night.webp (~78 KB)
✓ wrote mobile/assets/ambient/sunflower-night.webp (~78 KB)
✓ wrote extension/public/assets/ambient/sunflower-night.webp (~78 KB)
Done.
```

- [ ] **Step 2: Verify file sizes and counts**

```bash
cd C:/Users/33667/DeepSight-Main && \
  ls -la frontend/public/assets/ambient/ mobile/assets/ambient/ extension/public/assets/ambient/
```

Expected: 6 files, each between 50 KB and 200 KB.

- [ ] **Step 3: Visual validation**

Open the 2 sheets in an image viewer. Should see:

- `sunflower-day.webp` : 6×4 grid of 24 sunflowers rotating around vertical axis, green outer + golden inner petals, brown center with seeds
- `sunflower-night.webp` : same layout, indigo emissive glow on petals

If visual is wrong, **STOP** and iterate on `scripts/gen-sunflower-frames.mjs` (Task 9), do NOT commit broken sprites.

- [ ] **Step 4: Commit assets**

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/public/assets/ambient/sunflower-day.webp \
        frontend/public/assets/ambient/sunflower-night.webp \
        mobile/assets/ambient/sunflower-day.webp \
        mobile/assets/ambient/sunflower-night.webp \
        extension/public/assets/ambient/sunflower-day.webp \
        extension/public/assets/ambient/sunflower-night.webp
git commit -m "feat(assets): generate 48 sunflower frames (24 day + 24 night) committed across 3 platforms"
```

---

### Task 11: Web design tokens shift — `frontend/src/index.css`

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\frontend\src\index.css` (lines 30-50 and dark-mode block lines 145-160)
- Create: `C:\Users\33667\DeepSight-Main\frontend\src\__tests__\tokens-contrast.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\frontend\src\__tests__\tokens-contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const cssPath = path.resolve(__dirname, "../index.css");
const css = fs.readFileSync(cssPath, "utf-8");

function extractVar(name: string): string | null {
  // Match the FIRST :root occurrence (default declaration block).
  const re = new RegExp(`--${name}:\\s*([^;]+);`);
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

describe("tokens v3 shift — frontend/src/index.css", () => {
  it("--text-secondary is shifted to slate-100 (#f1f5f9)", () => {
    expect(extractVar("text-secondary")).toBe("#f1f5f9");
  });

  it("--text-muted is shifted to slate-200 (#e2e8f0)", () => {
    expect(extractVar("text-muted")).toBe("#e2e8f0");
  });

  it("--text-disabled token is added (rgba 45% white)", () => {
    expect(extractVar("text-disabled")).toBe("rgba(255, 255, 255, 0.45)");
  });

  it("--text-meta token is added (slate-300 #cbd5e1)", () => {
    expect(extractVar("text-meta")).toBe("#cbd5e1");
  });

  it("--text-primary remains #f5f0e8 (untouched)", () => {
    expect(extractVar("text-primary")).toBe("#f5f0e8");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/frontend && npx vitest run src/__tests__/tokens-contrast.test.ts
```

Expected: --text-secondary still old `#b5a89b`, others missing → fail.

- [ ] **Step 3: Write minimal implementation**

Use the Edit tool on `C:\Users\33667\DeepSight-Main\frontend\src\index.css` lines 40-46:

```
old_string:
    /* === Text (warmer) === */
    --text-primary: #f5f0e8;
    --text-secondary: #b5a89b;
    --text-tertiary: #7a7068;
    --text-muted: #45455a;
    --text-inverse: #0a0a0f;

new_string:
    /* === Text (Ambient Lighting v3 — shifted to slate for off-white legibility) === */
    --text-primary: #f5f0e8;
    --text-secondary: #f1f5f9; /* slate-100 — ex #b5a89b */
    --text-tertiary: #e2e8f0;  /* slate-200 — ex #7a7068 */
    --text-muted: #e2e8f0;     /* slate-200 — ex #45455a */
    --text-disabled: rgba(255, 255, 255, 0.45);
    --text-meta: #cbd5e1;      /* slate-300 — pour timestamps + labels secondaires */
    --text-inverse: #0a0a0f;
```

Light-mode block also needs updates. Edit `C:\Users\33667\DeepSight-Main\frontend\src\index.css` lines 150-156:

```
old_string:
    --text-secondary: #52525b;
    --text-tertiary: #71717a;
    --text-muted: #a1a1aa;

new_string:
    --text-secondary: #1e293b; /* slate-800 — sombre pour fond clair */
    --text-tertiary: #334155;  /* slate-700 */
    --text-muted: #475569;     /* slate-600 */
    --text-disabled: rgba(15, 23, 42, 0.45);
    --text-meta: #64748b;      /* slate-500 */
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/frontend && npx vitest run src/__tests__/tokens-contrast.test.ts && npm run typecheck
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/index.css frontend/src/__tests__/tokens-contrast.test.ts
git commit -m "feat(frontend): shift text tokens (secondary/muted/disabled/meta) to slate-100/200/300 for legibility (Ambient Lighting v3)"
```

---

### Task 12: Mobile design tokens shift — `mobile/src/theme/colors.ts`

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\mobile\src\theme\colors.ts`
- Create: `C:\Users\33667\DeepSight-Main\mobile\src\theme\__tests__\colors-v3.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\mobile\src\theme\__tests__\colors-v3.test.ts`:

```ts
import { darkColors, lightColors } from "../colors";

describe("Ambient Lighting v3 — mobile color tokens", () => {
  describe("darkColors", () => {
    it("textSecondary is shifted to slate-100 (#f1f5f9)", () => {
      expect(darkColors.textSecondary).toBe("#f1f5f9");
    });
    it("textTertiary is shifted to slate-200 (#e2e8f0)", () => {
      expect(darkColors.textTertiary).toBe("#e2e8f0");
    });
    it("textMuted is shifted to slate-200 (#e2e8f0)", () => {
      expect(darkColors.textMuted).toBe("#e2e8f0");
    });
    it("exposes textDisabled token", () => {
      expect(darkColors.textDisabled).toBe("rgba(255, 255, 255, 0.45)");
    });
    it("exposes textMeta token (slate-300)", () => {
      expect(darkColors.textMeta).toBe("#cbd5e1");
    });
    it("textPrimary remains #F5F0E8 (untouched)", () => {
      expect(darkColors.textPrimary).toBe("#F5F0E8");
    });
  });

  describe("lightColors", () => {
    it("textSecondary is slate-800 dark for light background", () => {
      expect(lightColors.textSecondary).toBe("#1e293b");
    });
    it("textDisabled is rgba slate dark 45%", () => {
      expect(lightColors.textDisabled).toBe("rgba(15, 23, 42, 0.45)");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/mobile && npx jest src/theme/__tests__/colors-v3.test.ts
```

Expected: `darkColors.textDisabled is undefined` etc.

- [ ] **Step 3: Write minimal implementation**

Use the Edit tool on `C:\Users\33667\DeepSight-Main\mobile\src\theme\colors.ts` lines 50-55:

```
old_string:
  // Text - warm palette
  textPrimary: "#F5F0E8", // ivoire blanc
  textSecondary: "#D4CCC4",
  textTertiary: "#B5A89B",
  textMuted: "#7A7068",

new_string:
  // Text — Ambient Lighting v3 (slate ramp for off-white legibility on dark)
  textPrimary: "#F5F0E8", // ivoire blanc (untouched)
  textSecondary: "#f1f5f9", // slate-100 (ex #D4CCC4)
  textTertiary: "#e2e8f0", // slate-200 (ex #B5A89B)
  textMuted: "#e2e8f0", // slate-200 (ex #7A7068)
  textDisabled: "rgba(255, 255, 255, 0.45)",
  textMeta: "#cbd5e1", // slate-300 — timestamps, labels secondaires
```

Edit lines 102-105 (lightColors text block):

```
old_string:
  // Text - warm palette
  textPrimary: "#2A2420",
  textSecondary: "#5A4F45",
  textTertiary: "#7A6F65",
  textMuted: "#9A8F85",

new_string:
  // Text — Ambient Lighting v3
  textPrimary: "#2A2420",
  textSecondary: "#1e293b", // slate-800
  textTertiary: "#334155", // slate-700
  textMuted: "#475569", // slate-600
  textDisabled: "rgba(15, 23, 42, 0.45)",
  textMeta: "#64748b", // slate-500
```

Update `ThemeColors` interface (lines 138-173). Edit:

```
old_string:
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;
  bgCard: string;
  glassBg: string;
  glassBorder: string;
  glassHover: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

new_string:
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;
  bgCard: string;
  glassBg: string;
  glassBorder: string;
  glassHover: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textDisabled: string;
  textMeta: string;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/mobile && npx jest src/theme/__tests__/colors-v3.test.ts && npm run typecheck
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add mobile/src/theme/colors.ts mobile/src/theme/__tests__/colors-v3.test.ts
git commit -m "feat(mobile): shift text tokens (secondary/tertiary/muted) to slate-100/200/300 + add textDisabled/textMeta (Ambient Lighting v3)"
```

---

### Task 13: Extension design tokens shift — `extension/src/styles/design-tokens.css`

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\extension\src\styles\design-tokens.css`
- Create: `C:\Users\33667\DeepSight-Main\extension\__tests__\design-tokens-v3.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\extension\__tests__\design-tokens-v3.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

const cssPath = path.resolve(__dirname, "../src/styles/design-tokens.css");
const css = fs.readFileSync(cssPath, "utf-8");

function extractVar(name: string): string | null {
  const re = new RegExp(`--${name}:\\s*([^;]+);`);
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

describe("Ambient Lighting v3 — extension design-tokens.css", () => {
  it("--text-secondary shifted to slate-100", () => {
    expect(extractVar("text-secondary")).toBe("#f1f5f9");
  });
  it("--text-tertiary shifted to slate-200", () => {
    expect(extractVar("text-tertiary")).toBe("#e2e8f0");
  });
  it("--text-muted shifted to slate-200", () => {
    expect(extractVar("text-muted")).toBe("#e2e8f0");
  });
  it("--text-disabled added", () => {
    expect(extractVar("text-disabled")).toBe("rgba(255, 255, 255, 0.45)");
  });
  it("--text-meta added (slate-300)", () => {
    expect(extractVar("text-meta")).toBe("#cbd5e1");
  });
  it("--text-primary kept", () => {
    expect(extractVar("text-primary")).toBe("#f5f0e8");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npx jest __tests__/design-tokens-v3.test.ts
```

Expected: missing tokens.

- [ ] **Step 3: Write minimal implementation**

Use Edit on `C:\Users\33667\DeepSight-Main\extension\src\styles\design-tokens.css` lines 16-21:

```
old_string:
  /* === Text === */
  --text-primary: #f5f0e8;
  --text-secondary: #b5a89b;
  --text-tertiary: #7a7068;
  --text-muted: #45455a;
  --text-inverse: #0a0a0f;

new_string:
  /* === Text (Ambient Lighting v3 — slate ramp for off-white legibility) === */
  --text-primary: #f5f0e8;
  --text-secondary: #f1f5f9; /* slate-100 — ex #b5a89b */
  --text-tertiary: #e2e8f0; /* slate-200 — ex #7a7068 */
  --text-muted: #e2e8f0; /* slate-200 — ex #45455a */
  --text-disabled: rgba(255, 255, 255, 0.45);
  --text-meta: #cbd5e1; /* slate-300 — timestamps, labels secondaires */
  --text-inverse: #0a0a0f;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npx jest __tests__/design-tokens-v3.test.ts && npm run typecheck
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add extension/src/styles/design-tokens.css extension/__tests__/design-tokens-v3.test.ts
git commit -m "feat(extension): shift text tokens (secondary/tertiary/muted) to slate-100/200/300 + add text-disabled/text-meta (Ambient Lighting v3)"
```

---

### Task 14: Backend — Alembic migration 008 adding `User.preferences` JSON column

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\backend\alembic\versions\008_add_user_preferences_json.py`
- Modify: `C:\Users\33667\DeepSight-Main\backend\src\db\database.py` (add `preferences` column to `User`)

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\backend\tests\test_user_preferences_column.py`:

```python
"""Test schema migration 008 — adding User.preferences JSON column."""
import pytest
from sqlalchemy import inspect, select

from db.database import User


@pytest.mark.asyncio
async def test_user_model_has_preferences_column():
    """The SQLAlchemy User model declares a `preferences` JSON column."""
    cols = {c.name for c in User.__table__.columns}
    assert "preferences" in cols, (
        "User.preferences column missing — migration 008 not applied to model"
    )


@pytest.mark.asyncio
async def test_preferences_default_is_empty_dict(test_session):
    """A freshly-created User has preferences = {} by default."""
    user = User(
        username="ambient_test",
        email="ambient_test@example.com",
        password_hash="hashed",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    assert user.preferences == {} or user.preferences is None


@pytest.mark.asyncio
async def test_preferences_can_store_ambient_flag(test_session):
    """Storing {ambient_lighting_enabled: false} round-trips through DB."""
    user = User(
        username="ambient_pref_test",
        email="ambient_pref@example.com",
        password_hash="hashed",
        preferences={"ambient_lighting_enabled": False},
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    assert user.preferences == {"ambient_lighting_enabled": False}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_user_preferences_column.py -v
```

Expected: `User.preferences column missing` failure.

- [ ] **Step 3: Write minimal implementation**

(a) Edit `C:\Users\33667\DeepSight-Main\backend\src\db\database.py` line 164 — append after `voice_preferences`:

```
old_string:
    # Voice
    voice_bonus_seconds = Column(Integer, default=0)
    voice_preferences = Column(Text, default=None)  # JSON blob: voice_id, speed, stability, etc.

new_string:
    # Voice
    voice_bonus_seconds = Column(Integer, default=0)
    voice_preferences = Column(Text, default=None)  # JSON blob: voice_id, speed, stability, etc.

    # Ambient Lighting v3 + futures préférences UI utilisateur (clé/valeur souple)
    preferences = Column(JSON, nullable=True, default=dict, server_default="{}")
```

Verify `JSON` is imported at the top of database.py — if not, add to imports:

Look at the existing imports of `database.py`. If `JSON` isn't there, add it. Edit the imports block (lines 1-30 of database.py) accordingly.

(b) Create `C:\Users\33667\DeepSight-Main\backend\alembic\versions\008_add_user_preferences_json.py`:

```python
"""Add User.preferences JSON column (Ambient Lighting v3 foundation).

Revision ID: 008_add_user_preferences_json
Revises: 007_unify_chat_voice_messages
Create Date: 2026-04-27

Adds a flexible JSON column `preferences` on `users`. This is intentionally a
generic key/value bag rather than discrete columns, so that future UI prefs
(theme variant, ambient lighting toggle, list density, etc.) don't require a
schema migration each time.

The first key seeded by application logic is `ambient_lighting_enabled`
(default true if absent — see core/preferences.py reader).

Backward compatibility:
  - Default `{}` for existing rows (server_default).
  - Reader code (auth/service.py update_user_preferences) tolerates None.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "008_add_user_preferences_json"
down_revision: Union[str, None] = "007_unify_chat_voice_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "preferences",
            sa.JSON(),
            nullable=True,
            server_default=sa.text("'{}'::json"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "preferences")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/backend && \
  alembic upgrade head && \
  python -m pytest tests/test_user_preferences_column.py -v
```

Expected: migration applies cleanly + 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/db/database.py backend/alembic/versions/008_add_user_preferences_json.py backend/tests/test_user_preferences_column.py
git commit -m "feat(backend): add User.preferences JSON column + alembic migration 008 (Ambient Lighting v3 foundation)"
```

---

### Task 15: Backend — `UpdatePreferencesRequest` accepts `ambient_lighting_enabled`

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\backend\src\auth\schemas.py`
- Modify: `C:\Users\33667\DeepSight-Main\backend\src\auth\service.py` (function `update_user_preferences`)
- Create: `C:\Users\33667\DeepSight-Main\backend\tests\test_user_preferences_ambient.py`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\backend\tests\test_user_preferences_ambient.py`:

```python
"""Test PUT /api/auth/preferences accepts ambient_lighting_enabled."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_put_preferences_accepts_ambient_lighting_enabled(
    auth_client: AsyncClient, auth_user
):
    """Toggling ambient_lighting_enabled = false persists to user.preferences."""
    res = await auth_client.put(
        "/api/auth/preferences",
        json={"ambient_lighting_enabled": False},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True

    # Verify persistence — fetch /me
    me_res = await auth_client.get("/api/auth/me")
    assert me_res.status_code == 200
    me = me_res.json()
    assert me.get("preferences", {}).get("ambient_lighting_enabled") is False


@pytest.mark.asyncio
async def test_put_preferences_default_is_enabled(
    auth_client: AsyncClient, auth_user
):
    """If ambient_lighting_enabled is never set, GET /me returns true (or absent)."""
    me_res = await auth_client.get("/api/auth/me")
    assert me_res.status_code == 200
    me = me_res.json()
    val = me.get("preferences", {}).get("ambient_lighting_enabled", True)
    assert val is True


@pytest.mark.asyncio
async def test_put_preferences_does_not_overwrite_other_keys(
    auth_client: AsyncClient, auth_user
):
    """Setting ambient_lighting_enabled preserves any other preferences keys."""
    # Pre-seed an unrelated key
    await auth_client.put(
        "/api/auth/preferences",
        json={"theme_variant": "compact"},  # hypothetical other key
    )

    # Now toggle ambient
    await auth_client.put(
        "/api/auth/preferences",
        json={"ambient_lighting_enabled": False},
    )

    me = (await auth_client.get("/api/auth/me")).json()
    prefs = me.get("preferences", {})
    assert prefs.get("ambient_lighting_enabled") is False
    assert prefs.get("theme_variant") == "compact"


@pytest.mark.asyncio
async def test_put_preferences_rejects_non_bool_ambient(
    auth_client: AsyncClient, auth_user
):
    """`ambient_lighting_enabled` must be a boolean."""
    res = await auth_client.put(
        "/api/auth/preferences",
        json={"ambient_lighting_enabled": "yes"},
    )
    assert res.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_user_preferences_ambient.py -v
```

Expected: schema doesn't accept the new key; tests fail.

- [ ] **Step 3: Write minimal implementation**

(a) Edit `C:\Users\33667\DeepSight-Main\backend\src\auth\schemas.py` lines 72-77:

```
old_string:
class UpdatePreferencesRequest(BaseModel):
    """Schéma pour mettre à jour les préférences"""

    default_lang: Optional[str] = None
    default_mode: Optional[str] = None
    default_model: Optional[str] = None

new_string:
class UpdatePreferencesRequest(BaseModel):
    """Schéma pour mettre à jour les préférences utilisateur.

    Ambient Lighting v3 : `ambient_lighting_enabled` est stocké dans
    User.preferences (JSON column) ; les autres champs sont historiquement
    sur des colonnes scalaires (default_lang, default_mode, default_model).
    Toute clé future doit aller dans .preferences (clé/valeur souple).
    """

    default_lang: Optional[str] = None
    default_mode: Optional[str] = None
    default_model: Optional[str] = None
    ambient_lighting_enabled: Optional[bool] = None
    # Catch-all pour clés futures non-typées (ex: theme_variant)
    extra_preferences: Optional[dict] = None
```

(b) Edit `C:\Users\33667\DeepSight-Main\backend\src\auth\service.py` lines 388-401:

```
old_string:
async def update_user_preferences(session: AsyncSession, user_id: int, **kwargs) -> bool:
    """Met à jour les préférences utilisateur"""
    allowed_fields = ["default_lang", "default_mode", "default_model", "mistral_key", "supadata_key"]

    user = await get_user_by_id(session, user_id)
    if not user:
        return False

    for field, value in kwargs.items():
        if field in allowed_fields and value is not None:
            setattr(user, field, value)

    await session.commit()
    return True

new_string:
async def update_user_preferences(session: AsyncSession, user_id: int, **kwargs) -> bool:
    """Met à jour les préférences utilisateur.

    - Champs scalaires (default_lang/default_mode/default_model/keys) :
      assignés directement sur les colonnes existantes.
    - Champs JSON (ambient_lighting_enabled, extra_preferences) :
      mergés dans user.preferences (préserve les clés existantes).
    """
    scalar_fields = {
        "default_lang",
        "default_mode",
        "default_model",
        "mistral_key",
        "supadata_key",
    }
    json_bool_fields = {"ambient_lighting_enabled"}

    user = await get_user_by_id(session, user_id)
    if not user:
        return False

    # Ensure preferences is a dict (legacy users may have None)
    current_prefs = dict(user.preferences or {})

    for field, value in kwargs.items():
        if value is None:
            continue
        if field in scalar_fields:
            setattr(user, field, value)
        elif field in json_bool_fields:
            current_prefs[field] = bool(value)
        elif field == "extra_preferences" and isinstance(value, dict):
            # Shallow merge — caller is responsible for the keys
            current_prefs.update(value)

    user.preferences = current_prefs
    await session.commit()
    return True
```

(c) Edit `C:\Users\33667\DeepSight-Main\backend\src\auth\router.py` line 375 — pass new args:

```
old_string:
    success = await update_user_preferences(
        session,
        current_user.id,
        default_lang=data.default_lang,
        default_mode=data.default_mode,
        default_model=data.default_model,
    )

new_string:
    success = await update_user_preferences(
        session,
        current_user.id,
        default_lang=data.default_lang,
        default_mode=data.default_mode,
        default_model=data.default_model,
        ambient_lighting_enabled=data.ambient_lighting_enabled,
        extra_preferences=data.extra_preferences,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_user_preferences_ambient.py -v
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/auth/schemas.py backend/src/auth/service.py backend/src/auth/router.py backend/tests/test_user_preferences_ambient.py
git commit -m "feat(backend): PUT /api/auth/preferences accepts ambient_lighting_enabled (Ambient Lighting v3)"
```

---

### Task 16: Expose `preferences` in `/api/auth/me` response

**Files:**

- Modify: `C:\Users\33667\DeepSight-Main\backend\src\auth\schemas.py` (`UserResponse` Pydantic schema)
- Modify: `C:\Users\33667\DeepSight-Main\backend\src\auth\service.py` (function returning `/me` payload — find existing `get_current_user_response` or `to_user_response`)
- Tests already covered in Task 15 (`test_put_preferences_default_is_enabled` checks `/me` returns the key)

- [ ] **Step 1: Verify the test from Task 15 still fails for the right reason**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_user_preferences_ambient.py::test_put_preferences_default_is_enabled -v
```

If `me.get("preferences", {})` returns `{}` because UserResponse doesn't expose the field → that's the symptom we fix here.

- [ ] **Step 2: Run a targeted exploratory grep to find the response shape**

```bash
cd C:/Users/33667/DeepSight-Main/backend && grep -rn "class UserResponse" src/ | head -5
```

Expected: identifies the exact class and file.

- [ ] **Step 3: Write minimal implementation**

Edit the `UserResponse` Pydantic class (likely in `src/auth/schemas.py`). Locate the class definition and add a `preferences` field:

Pattern to apply (the exact `old_string` will be the actual `UserResponse` you find — given the existing schemas style, it should be a `BaseModel` block):

```
old_string:
class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    plan: str

new_string:
class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    plan: str
    preferences: dict = {}
```

(If `UserResponse` already has more fields, only the `preferences: dict = {}` line is added before the closing of the class.)

Make sure the function that builds the response in `service.py` includes `preferences=user.preferences or {}` in its return statement. Apply the change with Edit tool by reading the actual function first.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_user_preferences_ambient.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/auth/schemas.py backend/src/auth/service.py
git commit -m "feat(backend): expose User.preferences in /api/auth/me response (Ambient Lighting v3)"
```

---

### Task 17: Helper `get_ambient_lighting_enabled(user)` for backend feature gate

**Files:**

- Create: `C:\Users\33667\DeepSight-Main\backend\src\core\preferences.py`
- Create: `C:\Users\33667\DeepSight-Main\backend\tests\test_preferences_helper.py`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\33667\DeepSight-Main\backend\tests\test_preferences_helper.py`:

```python
"""Unit tests for core/preferences.py helpers."""
import pytest

from core.preferences import (
    get_ambient_lighting_enabled,
    AMBIENT_LIGHTING_DEFAULT,
)


class _FakeUser:
    def __init__(self, preferences):
        self.preferences = preferences


def test_returns_default_when_preferences_none():
    user = _FakeUser(preferences=None)
    assert get_ambient_lighting_enabled(user) is AMBIENT_LIGHTING_DEFAULT


def test_returns_default_when_preferences_empty():
    user = _FakeUser(preferences={})
    assert get_ambient_lighting_enabled(user) is AMBIENT_LIGHTING_DEFAULT


def test_returns_default_when_key_absent():
    user = _FakeUser(preferences={"theme_variant": "compact"})
    assert get_ambient_lighting_enabled(user) is AMBIENT_LIGHTING_DEFAULT


def test_returns_true_when_explicitly_set():
    user = _FakeUser(preferences={"ambient_lighting_enabled": True})
    assert get_ambient_lighting_enabled(user) is True


def test_returns_false_when_explicitly_disabled():
    user = _FakeUser(preferences={"ambient_lighting_enabled": False})
    assert get_ambient_lighting_enabled(user) is False


def test_default_is_true():
    """Per spec §10 — 'Default ON dès PR1'."""
    assert AMBIENT_LIGHTING_DEFAULT is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_preferences_helper.py -v
```

Expected: `Cannot import 'get_ambient_lighting_enabled'`.

- [ ] **Step 3: Write minimal implementation**

Create `C:\Users\33667\DeepSight-Main\backend\src\core\preferences.py`:

```python
"""Helpers de lecture des préférences UI utilisateur (User.preferences JSON).

Single source of truth pour l'état des features de polish UX :
- Ambient Lighting v3 (`ambient_lighting_enabled`)
- (futurs) theme_variant, list_density, etc.

Le défaut est défini ici (PR1 : default ON pour ambient lighting, par §10
de la spec).
"""
from __future__ import annotations

from typing import Any


AMBIENT_LIGHTING_DEFAULT: bool = True


def get_ambient_lighting_enabled(user: Any) -> bool:
    """Return True if ambient lighting is enabled for this user.

    Defaults to AMBIENT_LIGHTING_DEFAULT when:
    - user.preferences is None
    - user.preferences is empty dict
    - the key 'ambient_lighting_enabled' is absent
    """
    prefs = getattr(user, "preferences", None) or {}
    val = prefs.get("ambient_lighting_enabled", AMBIENT_LIGHTING_DEFAULT)
    return bool(val)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_preferences_helper.py -v
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/core/preferences.py backend/tests/test_preferences_helper.py
git commit -m "feat(backend): add core/preferences.py helper for ambient_lighting_enabled (default ON)"
```

---

### Task 18: Final regression — full test sweep + typecheck on all touched scopes

**Files:** none modified (verification only). Aucun test n'est ajouté ici car cette tâche valide globalement les outputs des tasks 1-17. Si une régression est détectée, on revient sur la task concernée et on commit un fix dans une nouvelle task.

- [ ] **Step 1: Run lighting-engine full test suite**

```bash
cd C:/Users/33667/DeepSight-Main/packages/lighting-engine && npm test && npm run typecheck
```

Expected: 100% green, 0 TS errors.

- [ ] **Step 2: Run scripts test suite**

```bash
cd C:/Users/33667/DeepSight-Main/scripts && npm test
```

Expected: green.

- [ ] **Step 3: Frontend tokens test + typecheck (only the new test, no full suite to stay in scope)**

```bash
cd C:/Users/33667/DeepSight-Main/frontend && npx vitest run src/__tests__/tokens-contrast.test.ts && npm run typecheck
```

Expected: green.

- [ ] **Step 4: Mobile tokens test + typecheck**

```bash
cd C:/Users/33667/DeepSight-Main/mobile && npx jest src/theme/__tests__/colors-v3.test.ts && npm run typecheck
```

Expected: green.

- [ ] **Step 5: Extension tokens test + typecheck**

```bash
cd C:/Users/33667/DeepSight-Main/extension && npx jest __tests__/design-tokens-v3.test.ts && npm run typecheck
```

Expected: green.

- [ ] **Step 6: Backend tests for PR1 scope**

```bash
cd C:/Users/33667/DeepSight-Main/backend && python -m pytest tests/test_user_preferences_column.py tests/test_user_preferences_ambient.py tests/test_preferences_helper.py -v
```

Expected: 13 tests pass (3 + 4 + 6).

- [ ] **Step 7: Verify sprite asset count**

```bash
cd C:/Users/33667/DeepSight-Main && \
  test -f frontend/public/assets/ambient/sunflower-day.webp && \
  test -f frontend/public/assets/ambient/sunflower-night.webp && \
  test -f mobile/assets/ambient/sunflower-day.webp && \
  test -f mobile/assets/ambient/sunflower-night.webp && \
  test -f extension/public/assets/ambient/sunflower-day.webp && \
  test -f extension/public/assets/ambient/sunflower-night.webp && \
  echo "All 6 sprite files present"
```

Expected stdout: `All 6 sprite files present`.

- [ ] **Step 8: Final commit (signature de fin de PR1)**

If steps 1-7 all green, no additional commit needed. PR1 is ready to be opened against `main`.

If any step fails, **STOP** and create a fix commit in a new task following the same TDD pattern.

```bash
cd C:/Users/33667/DeepSight-Main && git log --oneline -20
```

Expected: see ~17 commits chronologically since branch start.

---

## Cross-PR Coordination Notes

### Blocking PR2/3/4

PR1 must be merged into `main` before:

- **PR2 (web)** — needs `getAmbientPresetV3`, `useAmbientPreset`, sprites in `frontend/public/assets/ambient/`, shifted tokens in `frontend/src/index.css`
- **PR3 (mobile)** — needs same engine v3 + sprites in `mobile/assets/ambient/` + shifted `mobile/src/theme/colors.ts`
- **PR4 (extension)** — needs same engine v3 + sprites in `extension/public/assets/ambient/` + shifted `extension/src/styles/design-tokens.css`

### Independent

- **PR0 (extension-sidepanel-v3)** — can be merged any time before/after/in parallel with PR1. PR4 will pick up its `<BeamCard>` once both are in.

### What PR1 explicitly does NOT do

- No `<AmbientLightLayer>` / `<SunflowerLayer>` components on any platform (PR2/3/4)
- No `<AmbientLightingProvider>` Context (PR2/3/4)
- No critical CSS Vite plugin (PR2)
- No Reanimated/AppState code (PR3)
- No copy-webpack-plugin / html-webpack-plugin changes (PR4)
- No Settings UI toggle (PR2/3, web + mobile have UI, extension reads pref via auth sync)
- No removal of legacy v2 code (PR5 cleanup)

---

## Risks & Mitigations (PR1-specific)

| Risque                                                                   | Mitigation                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `gl` (headless WebGL) ne compile pas sur Windows (native dep)            | Fallback : utiliser `puppeteer` avec `--enable-webgl` flag dans Task 9 et regénérer Task 10               |
| Three.js render diffère selon plateforme CI (Linux GPU vs local Windows) | Sprites générés localement et **commités**, pas regénérés en CI. La task 10 valide visuellement.          |
| Migration alembic 008 plante sur prod (champ JSON natif Postgres)        | Postgres 17 supporte JSON nativement. Test local passe avec SQLite (fallback `Text` si JSON pas dispo).   |
| `ThemeColors` interface mobile breaking (ajout textDisabled/textMeta)    | Tous les consumers existants ne lisent pas ces clés → ajout strict, aucun retrait. TS strict valide.      |
| Tokens contrast tests trop fragiles (regex sur CSS)                      | Regex prend la 1re occurrence du `:root` — précis. Test en `tokens-contrast.test.ts` lit le fichier brut. |
| Coordination avec session parallèle PR0 sur extension                    | Aucune intersection : PR1 ne touche QUE design-tokens.css en extension, jamais sidepanel/.                |

---

## Coverage Spec (self-review)

| Spec section             | Exigence                                                        | Task(s)            |
| ------------------------ | --------------------------------------------------------------- | ------------------ |
| §3 Architecture          | Engine source de vérité unique                                  | T1, T2, T5         |
| §3 Architecture          | Sprites partagés 3 plateformes                                  | T9, T10            |
| §3 Architecture          | Pas de Three.js runtime                                         | T9 (offline only)  |
| §4 API engine            | NightMode type                                                  | T1                 |
| §4 API engine            | AmbientPreset étendu (frameIndex, nightMode, accents, caps)     | T1                 |
| §4 API engine            | 48 keyframes v3                                                 | T2                 |
| §4 API engine            | getAmbientPreset algo                                           | T3, T4, T5         |
| §4 API engine            | useAmbientPreset hook React                                     | T6                 |
| §4 API engine            | Compat v2 (signature préservée)                                 | T7 (export both)   |
| §4 Algo - 8 horaires     | Tests à 8 horaires clés                                         | T5                 |
| §4 Algo - daily seed     | mulberry32 ±15° déterministe                                    | T4, T5             |
| §4 Algo - reduced motion | prefers-reduced-motion freeze                                   | T5, T6             |
| §4 Algo - high contrast  | prefers-contrast: more cap 0.3                                  | T5, T6             |
| §4 Algo - reading zone   | readingZoneIntensityCap <= 0.5                                  | T5                 |
| §4 Algo - interpolation  | Lerp continue entre keyframes                                   | T4, T5             |
| §5 Pipeline tournesol    | gen-sunflower-frames.mjs Three.js                               | T8, T9             |
| §5 Pipeline tournesol    | 24 frames jour + 24 frames nuit luminescent                     | T9                 |
| §5 Pipeline tournesol    | 256×256 sprite, WebP qualité 85, 6×4 grid                       | T9                 |
| §5 Pipeline tournesol    | Distribution 3 plateformes (committed)                          | T9, T10            |
| §7 Tokens shift web      | --text-secondary/muted/disabled/meta vers slate                 | T11                |
| §7 Tokens shift mobile   | textSecondary/Tertiary/Muted vers slate + textDisabled/textMeta | T12                |
| §7 Tokens shift ext      | --text-secondary/muted vers slate + --text-disabled/meta        | T13                |
| §10 Roadmap PR1          | engine v3                                                       | T1-T7              |
| §10 Roadmap PR1          | gen-sunflower-frames.mjs + sprites                              | T8-T10             |
| §10 Roadmap PR1          | Tokens 3 plateformes                                            | T11-T13            |
| §10 Roadmap PR1          | User.preferences.ambient_lighting_enabled                       | T14, T15, T16, T17 |
| §10 Roadmap PR1          | Tests engine + tokens (Vitest) + backend (pytest)               | All tasks have TDD |
| §10 Default ON           | AMBIENT_LIGHTING_DEFAULT = True                                 | T17                |
| §14.2 Palette tournesol  | #9DC209 / #F3BE00 / #BF5F06 (logo officiel)                     | T8                 |
| §14.2 Palette tournesol  | Émissif cyan/violet `#4f46e5` variant nuit                      | T8, T9             |
| §14.2 Palette tournesol  | Spirale Fibonacci 24 graines alpha 0.6→1                        | T8                 |

---

## Definition of Done

- [ ] Tasks 1-18 all checked off
- [ ] `cd packages/lighting-engine && npm test && npm run typecheck` → green
- [ ] `cd scripts && npm test` → green
- [ ] `cd frontend && npx vitest run src/__tests__/tokens-contrast.test.ts && npm run typecheck` → green
- [ ] `cd mobile && npx jest src/theme/__tests__/colors-v3.test.ts && npm run typecheck` → green
- [ ] `cd extension && npx jest __tests__/design-tokens-v3.test.ts && npm run typecheck` → green
- [ ] `cd backend && python -m pytest tests/test_user_preferences_column.py tests/test_user_preferences_ambient.py tests/test_preferences_helper.py` → green
- [ ] 6 sprite WebP files present (3 platforms × 2 variants), each <200 KB
- [ ] `git log --oneline` shows ~17 atomic commits with conventional-commits prefixes
- [ ] PR opened against `main` with title `feat: lighting engine v3 foundation (PR1) — keyframes + sprites + tokens + backend pref`
- [ ] PR description references this plan path and links to spec
