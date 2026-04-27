# Ambient Lighting v3 — PR2 Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter sur le frontend Vite/React 18 l'overlay AmbientLightLayer v3 (rayon + halo) + SunflowerLayer (hero/mascot route-aware avec cross-fade sprite jour↔nuit), wrapping via AmbientLightingProvider, plugin Vite Critical CSS, toggle Settings, suppression du legacy `useTimeOfDay`/`AmbientLightDevPanel`/`DayNightContext`.

**Architecture:** AmbientLightingProvider distribue le preset courant via Context React au composant AmbientLightLayer (rayon + halo, classes Tailwind + transitions CSS 1.5s) et SunflowerLayer (cross-fade Framer Motion sur background-position du sprite). Plugin Vite injecte le critical CSS dans index.html avant l'hydratation. Toggle Settings persistant via API existante PUT /api/auth/preferences.

**Tech Stack:** React 18, TypeScript strict, Vite 5, Tailwind CSS 3, Framer Motion 12, Vitest + Testing Library, Playwright pour E2E, TanStack Query 5 pour le toggle.

---

## Pre-flight Checklist

- [ ] **PR1 mergée** : `@deepsight/lighting-engine` v3 expose `getAmbientPreset(date)` retournant `{angle, beamColor, haloColor, haloAccentColor?, intensity, frameIndex, nightMode, isReducedMotion, isHighContrast, readingZoneIntensityCap}` + `useAmbientPreset(opts)` re-export. Vérifier `C:\Users\33667\DeepSight-Main\packages\lighting-engine\src\types.ts`.
- [ ] **Sprites présents** : `C:\Users\33667\DeepSight-Main\frontend\public\assets\ambient\sunflower-day.webp` et `sunflower-night.webp` (chacun 1536×1024, 6×4 grid, 24 frames de 256×256).
- [ ] **Tokens textuels shift PR1 appliqués** dans `C:\Users\33667\DeepSight-Main\frontend\src\styles\tokens.css` (créé par PR1).
- [ ] **Backend `User.preferences.ambient_lighting_enabled`** existe (PR1) et est exposé par `GET /api/auth/me` + accepté par `PUT /api/auth/preferences`.
- [ ] **Fichier `frontend/src/types/api.ts`** : confirmer que le type `User` expose `preferences?: { ambient_lighting_enabled?: boolean; [k: string]: unknown }` (PR1 a dû l'ajouter ; sinon, étendre dans la Task 13).
- [ ] **Branche** : créer worktree `frontend-ambient-v3-web` sur la branche `feat/ambient-lighting-v3-web`, basée sur `main` après merge de PR1.
- [ ] **Dépendances npm** : aucune nouvelle dépendance runtime requise (Framer Motion 12, TanStack Query 5, Tailwind 3 déjà présents). Pour les tests, `@testing-library/react`, `@testing-library/user-event`, `@playwright/test`, `vitest` sont déjà installés.

---

## Task 1 — Réécrire `useAmbientPreset` pour consommer le package v3

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\frontend\src\hooks\useAmbientPreset.ts`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\hooks\__tests__\useAmbientPreset.test.tsx` (à créer)

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\hooks\__tests__\useAmbientPreset.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAmbientPreset } from "../useAmbientPreset";

vi.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: vi.fn((date: Date) => ({
    angle: -10,
    beamColor: "rgba(255,200,140,0.92)",
    haloColor: "rgba(255,200,140,0.45)",
    haloAccentColor: "rgba(99,102,241,0.30)",
    intensity: 0.85,
    frameIndex: 12,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

describe("useAmbientPreset (v3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the v3 preset shape from the engine on mount", () => {
    const { result } = renderHook(() => useAmbientPreset());
    expect(result.current.angle).toBe(-10);
    expect(result.current.beamColor).toBe("rgba(255,200,140,0.92)");
    expect(result.current.haloColor).toBe("rgba(255,200,140,0.45)");
    expect(result.current.haloAccentColor).toBe("rgba(99,102,241,0.30)");
    expect(result.current.intensity).toBe(0.85);
    expect(result.current.frameIndex).toBe(12);
    expect(result.current.nightMode).toBeNull();
    expect(result.current.isReducedMotion).toBe(false);
    expect(result.current.isHighContrast).toBe(false);
    expect(result.current.readingZoneIntensityCap).toBe(0.5);
  });

  it("refreshes the preset every 30 seconds", async () => {
    const engine = await import("@deepsight/lighting-engine");
    const { result, rerender } = renderHook(() => useAmbientPreset());
    const callsBefore = (engine.getAmbientPreset as ReturnType<typeof vi.fn>)
      .mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    rerender();
    expect(
      (engine.getAmbientPreset as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(callsBefore);
    expect(result.current.angle).toBe(-10);
  });

  it("forwards options (intensityMul) to the engine", async () => {
    const engine = await import("@deepsight/lighting-engine");
    renderHook(() => useAmbientPreset({ intensityMul: 0.5 }));
    expect(engine.getAmbientPreset).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ intensityMul: 0.5 }),
    );
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/hooks/__tests__/useAmbientPreset.test.tsx
```

Attendu : test fail car le hook actuel retourne `{ preset, prefersReducedMotion }` (objet imbriqué), pas la shape v3 plate. Erreurs typiques : `expected undefined to be -10` sur `result.current.angle`.

### Step 3: Write minimal implementation

Réécrire complètement `C:\Users\33667\DeepSight-Main\frontend\src\hooks\useAmbientPreset.ts` :

```ts
/**
 * useAmbientPreset (v3) — Hook React qui retourne le preset AmbientLighting v3
 * fourni par `@deepsight/lighting-engine`.
 *
 * - Recalcul toutes les 30s (les transitions CSS 1.5s lissent visuellement).
 * - Forward des options (intensityMul, forceNightMode, forceTime) au moteur.
 * - Le preset retourné inclut déjà `isReducedMotion` et `isHighContrast` calculés
 *   par le moteur (lecture des MediaQueries côté client).
 *
 * Note : la signature v2 (`{ preset, prefersReducedMotion }`) est SUPPRIMÉE.
 * Tous les consumers doivent lire les champs directement sur l'objet retourné.
 */

import { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
  type PresetOptions,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 30_000;

export function useAmbientPreset(opts?: PresetOptions): AmbientPreset {
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), opts),
  );

  const optsKey = JSON.stringify(opts ?? {});

  useEffect(() => {
    let mounted = true;
    const tick = (): void => {
      if (!mounted) return;
      setPreset(getAmbientPreset(new Date(), opts));
    };
    tick();
    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey]);

  return preset;
}
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/hooks/__tests__/useAmbientPreset.test.tsx
```

Attendu : 3/3 tests pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/hooks/useAmbientPreset.ts frontend/src/hooks/__tests__/useAmbientPreset.test.tsx
git commit -m "$(cat <<'EOF'
refactor(web): rewrite useAmbientPreset for lighting-engine v3

Replace the v2 nested return shape ({ preset, prefersReducedMotion }) with
the flat v3 AmbientPreset object exported by @deepsight/lighting-engine.
isReducedMotion and isHighContrast are now provided by the engine itself.

EOF
)"
```

---

## Task 2 — Snapshot legacy consumer types pour migration

**Files:**

- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\hooks\__tests__\useAmbientPreset.compat.test.tsx` (à créer)

### Step 1: Write the failing test

Ce test garantit qu'aucun consumer n'utilise plus l'ancienne signature `{ preset, prefersReducedMotion }`. C'est un garde-fou contre les régressions.

Créer `C:\Users\33667\DeepSight-Main\frontend\src\hooks\__tests__\useAmbientPreset.compat.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { useAmbientPreset } from "../useAmbientPreset";

describe("useAmbientPreset (v3) — compat", () => {
  it("does NOT export the legacy { preset, prefersReducedMotion } wrapper", () => {
    const fnString = useAmbientPreset.toString();
    expect(fnString).not.toMatch(/prefersReducedMotion/);
  });

  it("exports a function with one optional parameter", () => {
    expect(useAmbientPreset.length).toBeLessThanOrEqual(1);
    expect(typeof useAmbientPreset).toBe("function");
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/hooks/__tests__/useAmbientPreset.compat.test.tsx
```

Attendu : pass (Task 1 a déjà supprimé le wrapper). Si fail, c'est une régression — corriger Task 1.

### Step 3: Write minimal implementation

Pas d'implémentation supplémentaire. Le test certifie le résultat de Task 1. Cette task sert de filet de sécurité explicite à committer.

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/hooks/__tests__/useAmbientPreset.compat.test.tsx
```

Attendu : 2/2 tests pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/hooks/__tests__/useAmbientPreset.compat.test.tsx
git commit -m "$(cat <<'EOF'
test(web): add compat guard against useAmbientPreset v2 wrapper

Static guard that fails if the legacy { preset, prefersReducedMotion }
shape is reintroduced into the hook source.

EOF
)"
```

---

## Task 3 — Créer `AmbientLightingContext` Provider

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\frontend\src\contexts\AmbientLightingContext.tsx`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\contexts\__tests__\AmbientLightingContext.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\contexts\__tests__\AmbientLightingContext.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AmbientLightingProvider,
  useAmbientLighting,
} from "../AmbientLightingContext";

vi.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: vi.fn(() => ({
    angle: 12,
    beamColor: "rgba(255,200,140,0.92)",
    haloColor: "rgba(255,200,140,0.45)",
    haloAccentColor: "rgba(99,102,241,0.30)",
    intensity: 0.85,
    frameIndex: 8,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

const Probe = (): JSX.Element => {
  const ambient = useAmbientLighting();
  return (
    <div>
      <span data-testid="angle">{ambient.angle}</span>
      <span data-testid="frame">{ambient.frameIndex}</span>
      <span data-testid="enabled">{String(ambient.enabled)}</span>
    </div>
  );
};

describe("AmbientLightingContext", () => {
  it("provides the engine preset to children when enabled is true", () => {
    render(
      <AmbientLightingProvider enabled={true}>
        <Probe />
      </AmbientLightingProvider>,
    );
    expect(screen.getByTestId("angle").textContent).toBe("12");
    expect(screen.getByTestId("frame").textContent).toBe("8");
    expect(screen.getByTestId("enabled").textContent).toBe("true");
  });

  it("exposes enabled=false when the toggle is off", () => {
    render(
      <AmbientLightingProvider enabled={false}>
        <Probe />
      </AmbientLightingProvider>,
    );
    expect(screen.getByTestId("enabled").textContent).toBe("false");
  });

  it("throws a clear error when useAmbientLighting is called outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(
      /useAmbientLighting must be used within an <AmbientLightingProvider>/,
    );
    spy.mockRestore();
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/contexts/__tests__/AmbientLightingContext.test.tsx
```

Attendu : `Cannot find module '../AmbientLightingContext'`.

### Step 3: Write minimal implementation

Créer `C:\Users\33667\DeepSight-Main\frontend\src\contexts\AmbientLightingContext.tsx` :

```tsx
/**
 * AmbientLightingContext — Distribue le preset AmbientLighting v3 courant
 * (`@deepsight/lighting-engine`) à tous les enfants sans avoir à appeler
 * `useAmbientPreset()` partout.
 *
 * Champ `enabled` :
 *   - `true`  : monte AmbientLightLayer + SunflowerLayer normalement
 *   - `false` : les overlays montent un fragment vide (toggle utilisateur OFF)
 *
 * Préparé pour la dépendance PR0 extension qui livrera <BeamCard> et
 * lira ce context via un hook partagé `useBeamCardPropsFromPreset()`.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { AmbientPreset, PresetOptions } from "@deepsight/lighting-engine";
import { useAmbientPreset } from "../hooks/useAmbientPreset";

export interface AmbientLightingContextValue extends AmbientPreset {
  enabled: boolean;
}

const AmbientLightingContext =
  createContext<AmbientLightingContextValue | null>(null);

export interface AmbientLightingProviderProps {
  enabled: boolean;
  options?: PresetOptions;
  children: ReactNode;
}

export const AmbientLightingProvider: React.FC<
  AmbientLightingProviderProps
> = ({ enabled, options, children }) => {
  const preset = useAmbientPreset(options);
  const value = useMemo<AmbientLightingContextValue>(
    () => ({ ...preset, enabled }),
    [preset, enabled],
  );
  return (
    <AmbientLightingContext.Provider value={value}>
      {children}
    </AmbientLightingContext.Provider>
  );
};

export function useAmbientLighting(): AmbientLightingContextValue {
  const ctx = useContext(AmbientLightingContext);
  if (ctx === null) {
    throw new Error(
      "useAmbientLighting must be used within an <AmbientLightingProvider>",
    );
  }
  return ctx;
}
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/contexts/__tests__/AmbientLightingContext.test.tsx
```

Attendu : 3/3 tests pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/contexts/AmbientLightingContext.tsx frontend/src/contexts/__tests__/AmbientLightingContext.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add AmbientLightingProvider context for v3 preset

Distributes the v3 preset (angle, beamColor, haloColor, haloAccentColor,
intensity, frameIndex, nightMode, a11y flags) to all children. The
enabled flag is forwarded so AmbientLightLayer and SunflowerLayer can
short-circuit when the user toggles the feature off.

EOF
)"
```

---

## Task 4 — `AmbientLightLayer` (test : DOM enabled vs disabled)

**Files:**

- Réécrire : `C:\Users\33667\DeepSight-Main\frontend\src\components\AmbientLightLayer.tsx`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\AmbientLightLayer.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\AmbientLightLayer.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmbientLightLayer } from "../AmbientLightLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

vi.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: vi.fn(() => ({
    angle: 18,
    beamColor: "rgba(255,200,140,0.92)",
    haloColor: "rgba(255,200,140,0.45)",
    haloAccentColor: "rgba(99,102,241,0.30)",
    intensity: 0.78,
    frameIndex: 10,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

describe("<AmbientLightLayer> (v3)", () => {
  it("mounts a beam and a halo div when enabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={true}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const beam = container.querySelector('[data-ambient="beam"]');
    const halo = container.querySelector('[data-ambient="halo"]');
    expect(beam).not.toBeNull();
    expect(halo).not.toBeNull();
  });

  it("renders nothing when disabled", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    expect(container.querySelector('[data-ambient="beam"]')).toBeNull();
    expect(container.querySelector('[data-ambient="halo"]')).toBeNull();
  });

  it("marks all overlays as aria-hidden=true (decorative)", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={true}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    container.querySelectorAll("[data-ambient]").forEach((el) => {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("places overlays at z-index 1 (below SunflowerLayer at z-2)", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={true}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const beam = container.querySelector(
      '[data-ambient="beam"]',
    ) as HTMLElement;
    expect(beam.className).toMatch(/z-\[1\]/);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/AmbientLightLayer.test.tsx
```

Attendu : tests fail car la version v2 actuelle utilise `useAmbientPreset` directement (pas le Context), retourne 6 calques sans `data-ambient`, et n'a pas de short-circuit `enabled=false`.

### Step 3: Write minimal implementation

Réécrire `C:\Users\33667\DeepSight-Main\frontend\src\components\AmbientLightLayer.tsx` :

```tsx
/**
 * AmbientLightLayer v3 — Couche d'effets lumineux globaux DeepSight (web).
 *
 * Architecture v3 simplifiée :
 *   - 1 calque "beam"  : rayon de lumière unique selon l'angle solaire
 *   - 1 calque "halo"  : halo doux à l'origine du rayon, mix accent brand
 *                        (haloAccentColor) aux twilights/nuit
 *
 * Plus de disque solaire ni lunaire net (cf. spec §6.1) — le tournesol
 * (SunflowerLayer) prend ce rôle.
 *
 * Z-index : 1 (en dessous de SunflowerLayer z-2 et du contenu app z-10+).
 * Décoratif : aria-hidden="true", pointer-events: none, jamais focusable.
 *
 * Transitions CSS 1.5s cubic-bezier(0.4, 0, 0.2, 1) sur background/transform/opacity.
 * Si `prefers-reduced-motion: reduce` (via le preset engine) → duration: 0.
 */

import React from "react";
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

const TRANSITION_MS = 1500;

export const AmbientLightLayer: React.FC = () => {
  const ambient = useAmbientLighting();

  if (!ambient.enabled) {
    return null;
  }

  const {
    angle,
    beamColor,
    haloColor,
    haloAccentColor,
    intensity,
    isReducedMotion,
    readingZoneIntensityCap,
  } = ambient;

  const transitionStyle: React.CSSProperties = isReducedMotion
    ? {}
    : {
        transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      };

  // Reading zone cap: limit beam opacity in 30%-70% vertical band
  const cappedIntensity = Math.min(intensity, readingZoneIntensityCap + 0.4);

  // Beam: thin gradient line at `angle` deg, with a soft hood
  const beamGradient = `linear-gradient(${angle}deg, transparent 35%, ${beamColor} 48%, ${beamColor} 50%, ${beamColor} 52%, transparent 65%)`;
  const beamHood = `linear-gradient(180deg, ${beamColor} 0%, transparent 32%)`;

  // Halo: radial centered on the beam origin, blends haloColor + accent if present
  const haloRadial = haloAccentColor
    ? `radial-gradient(ellipse 80% 50% at 50% 0%, ${haloColor} 0%, ${haloAccentColor} 30%, transparent 60%)`
    : `radial-gradient(ellipse 80% 50% at 50% 0%, ${haloColor} 0%, transparent 60%)`;

  return (
    <>
      <div
        data-ambient="halo"
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          background: haloRadial,
          mixBlendMode: "screen",
          opacity: cappedIntensity,
          ...transitionStyle,
        }}
      />
      <div
        data-ambient="beam"
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none overflow-hidden z-[1]"
        style={{
          background: `${beamGradient}, ${beamHood}`,
          mixBlendMode: "screen",
          opacity: cappedIntensity,
          ...transitionStyle,
        }}
      />
    </>
  );
};

export default AmbientLightLayer;
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/AmbientLightLayer.test.tsx
```

Attendu : 4/4 tests pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/AmbientLightLayer.tsx frontend/src/components/__tests__/AmbientLightLayer.test.tsx
git commit -m "$(cat <<'EOF'
refactor(web): rewrite AmbientLightLayer to v3 (beam + halo)

Replace the v2 6-layer stack with a single beam + halo overlay driven by
the v3 preset (angle, beamColor, haloColor, haloAccentColor, intensity).
Reads from AmbientLightingProvider; renders null when enabled=false.
aria-hidden, pointer-events:none, z-1.

EOF
)"
```

---

## Task 5 — `AmbientLightLayer` : haloAccentColor au twilight et nuit

**Files:**

- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\AmbientLightLayer.accent.test.tsx`
- (Pas de modification source — la Task 4 gère déjà l'accent. Cette task verrouille le comportement.)

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\AmbientLightLayer.accent.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AmbientLightLayer } from "../AmbientLightLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

const renderWithPreset = (overrides: Record<string, unknown>) => {
  vi.doMock("@deepsight/lighting-engine", () => ({
    getAmbientPreset: vi.fn(() => ({
      angle: -10,
      beamColor: "rgba(220,232,255,0.65)",
      haloColor: "rgba(199,210,254,0.45)",
      haloAccentColor: undefined,
      intensity: 0.65,
      frameIndex: 0,
      nightMode: "glowing",
      isReducedMotion: false,
      isHighContrast: false,
      readingZoneIntensityCap: 0.5,
      ...overrides,
    })),
  }));
};

describe("<AmbientLightLayer> halo accent", () => {
  it("includes haloAccentColor in halo gradient when provided", async () => {
    vi.resetModules();
    renderWithPreset({ haloAccentColor: "rgba(99,102,241,0.30)" });
    const { AmbientLightLayer: Comp } = await import("../AmbientLightLayer");
    const { AmbientLightingProvider: Provider } =
      await import("../../contexts/AmbientLightingContext");
    const { container } = render(
      <Provider enabled={true}>
        <Comp />
      </Provider>,
    );
    const halo = container.querySelector(
      '[data-ambient="halo"]',
    ) as HTMLElement;
    expect(halo.style.background).toContain("rgba(99,102,241,0.30)");
  });

  it("omits haloAccentColor when undefined (daytime / zenith)", () => {
    const { container } = render(
      <AmbientLightingProvider enabled={true}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const halo = container.querySelector(
      '[data-ambient="halo"]',
    ) as HTMLElement;
    expect(halo.style.background).not.toContain("rgba(99,102,241");
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/AmbientLightLayer.accent.test.tsx
```

Attendu : passe immédiatement si Task 4 est correcte. Sinon investiguer.

### Step 3: Write minimal implementation

N/A — comportement déjà implémenté en Task 4. Ce test est un guard rail explicite.

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/AmbientLightLayer.accent.test.tsx
```

Attendu : 2/2 pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/__tests__/AmbientLightLayer.accent.test.tsx
git commit -m "$(cat <<'EOF'
test(web): cover haloAccentColor twilight/night branching in AmbientLightLayer

Verifies the halo gradient includes haloAccentColor when present
(twilight + night) and omits it during daytime (undefined).

EOF
)"
```

---

## Task 6 — `AmbientLightLayer` : prefers-reduced-motion

**Files:**

- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\AmbientLightLayer.reducedMotion.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\AmbientLightLayer.reducedMotion.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

beforeEach(() => {
  vi.resetModules();
});

describe("<AmbientLightLayer> prefers-reduced-motion", () => {
  it("omits CSS transition when isReducedMotion=true", async () => {
    vi.doMock("@deepsight/lighting-engine", () => ({
      getAmbientPreset: vi.fn(() => ({
        angle: 0,
        beamColor: "rgba(255,255,255,0.5)",
        haloColor: "rgba(255,255,255,0.3)",
        haloAccentColor: undefined,
        intensity: 0.5,
        frameIndex: 0,
        nightMode: null,
        isReducedMotion: true,
        isHighContrast: false,
        readingZoneIntensityCap: 0.5,
      })),
    }));
    const { AmbientLightLayer } = await import("../AmbientLightLayer");
    const { AmbientLightingProvider } =
      await import("../../contexts/AmbientLightingContext");
    const { container } = render(
      <AmbientLightingProvider enabled={true}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const beam = container.querySelector(
      '[data-ambient="beam"]',
    ) as HTMLElement;
    expect(beam.style.transition).toBe("");
  });

  it("applies 1500ms transition when isReducedMotion=false", async () => {
    vi.doMock("@deepsight/lighting-engine", () => ({
      getAmbientPreset: vi.fn(() => ({
        angle: 0,
        beamColor: "rgba(255,255,255,0.5)",
        haloColor: "rgba(255,255,255,0.3)",
        haloAccentColor: undefined,
        intensity: 0.5,
        frameIndex: 0,
        nightMode: null,
        isReducedMotion: false,
        isHighContrast: false,
        readingZoneIntensityCap: 0.5,
      })),
    }));
    const { AmbientLightLayer } = await import("../AmbientLightLayer");
    const { AmbientLightingProvider } =
      await import("../../contexts/AmbientLightingContext");
    const { container } = render(
      <AmbientLightingProvider enabled={true}>
        <AmbientLightLayer />
      </AmbientLightingProvider>,
    );
    const beam = container.querySelector(
      '[data-ambient="beam"]',
    ) as HTMLElement;
    expect(beam.style.transition).toContain("1500ms");
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/AmbientLightLayer.reducedMotion.test.tsx
```

Attendu : pass si Task 4 a déjà géré le branchement `isReducedMotion`. Sinon, ajuster le code de Task 4.

### Step 3: Write minimal implementation

N/A — branchement déjà fait dans Task 4 (`transitionStyle` ternaire sur `isReducedMotion`). Test = filet de sécurité.

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/AmbientLightLayer.reducedMotion.test.tsx
```

Attendu : 2/2 pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/__tests__/AmbientLightLayer.reducedMotion.test.tsx
git commit -m "$(cat <<'EOF'
test(web): verify AmbientLightLayer disables transitions under reduced-motion

Guards the prefers-reduced-motion branch: when isReducedMotion=true the
inline transition is empty; when false it equals 1500ms cubic-bezier.

EOF
)"
```

---

## Task 7 — `SunflowerLayer` : route-aware mounting (Hero vs Mascot)

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\frontend\src\components\SunflowerLayer.tsx`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\SunflowerLayer.routing.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\SunflowerLayer.routing.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SunflowerLayer } from "../SunflowerLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

vi.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: vi.fn(() => ({
    angle: 0,
    beamColor: "rgba(255,255,255,0.5)",
    haloColor: "rgba(255,255,255,0.3)",
    haloAccentColor: undefined,
    intensity: 0.8,
    frameIndex: 12,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AmbientLightingProvider enabled={true}>
        <SunflowerLayer />
      </AmbientLightingProvider>
    </MemoryRouter>,
  );

describe("<SunflowerLayer> routing", () => {
  it.each(["/", "/login", "/signup"])(
    "renders Hero variant (90px centered) on %s",
    (path) => {
      const { container } = renderAt(path);
      const root = container.querySelector(
        '[data-sunflower="hero"]',
      ) as HTMLElement;
      expect(root).not.toBeNull();
      expect(container.querySelector('[data-sunflower="mascot"]')).toBeNull();
    },
  );

  it.each(["/dashboard", "/history", "/settings", "/study"])(
    "renders Mascot variant (76px bottom-right) on %s",
    (path) => {
      const { container } = renderAt(path);
      const root = container.querySelector(
        '[data-sunflower="mascot"]',
      ) as HTMLElement;
      expect(root).not.toBeNull();
      expect(container.querySelector('[data-sunflower="hero"]')).toBeNull();
    },
  );

  it("renders nothing when context.enabled is false", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AmbientLightingProvider enabled={false}>
          <SunflowerLayer />
        </AmbientLightingProvider>
      </MemoryRouter>,
    );
    expect(container.querySelector("[data-sunflower]")).toBeNull();
  });

  it("places overlays at z-index 2 (above AmbientLightLayer at z-1)", () => {
    const { container } = renderAt("/dashboard");
    const root = container.querySelector(
      '[data-sunflower="mascot"]',
    ) as HTMLElement;
    expect(root.className).toMatch(/z-\[2\]/);
  });

  it("marks SunflowerLayer as aria-hidden=true (decorative)", () => {
    const { container } = renderAt("/");
    const root = container.querySelector("[data-sunflower]") as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/SunflowerLayer.routing.test.tsx
```

Attendu : `Cannot find module '../SunflowerLayer'`.

### Step 3: Write minimal implementation

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\SunflowerLayer.tsx` :

```tsx
/**
 * SunflowerLayer (web v3) — Tournesol photoréaliste rendu en pré-render WebP.
 *
 * Deux variantes selon la route :
 *   - Hero (90px centré, 30% top)  : `/`, `/login`, `/signup`
 *   - Mascot (76px bottom-right)   : toutes les autres routes (espace de travail)
 *
 * Sprite : 6×4 grid de 24 frames 256×256 (1536×1024). Le `frameIndex` du preset
 * (0-23) shift `background-position`. Cross-fade 4s lors du changement de
 * `nightMode` (jour↔nuit) via Framer Motion (opacity 0↔1 de chaque variant).
 *
 * Décoratif : aria-hidden="true", pointer-events: none, z-index 2.
 * Si `prefers-reduced-motion` (lu via context.isReducedMotion), pas de motion.
 */

import React from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAmbientLighting } from "../contexts/AmbientLightingContext";

const HERO_ROUTES = new Set(["/", "/login", "/signup"]);
const SPRITE_DAY = "/assets/ambient/sunflower-day.webp";
const SPRITE_NIGHT = "/assets/ambient/sunflower-night.webp";
const FRAME_PX = 256;
const GRID_COLS = 6;
const SPRITE_W = 1536;
const SPRITE_H = 1024;
const CROSS_FADE_MS = 4000;

const spriteOffset = (frameIndex: number): string => {
  const idx = ((frameIndex % 24) + 24) % 24;
  const col = idx % GRID_COLS;
  const row = Math.floor(idx / GRID_COLS);
  return `-${col * FRAME_PX}px -${row * FRAME_PX}px`;
};

interface FrameProps {
  src: string;
  frameIndex: number;
  size: number;
}

const SpriteFrame: React.FC<FrameProps> = ({ src, frameIndex, size }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      backgroundImage: `url(${src})`,
      backgroundPosition: spriteOffset(frameIndex),
      backgroundSize: `${(SPRITE_W * size) / FRAME_PX}px ${(SPRITE_H * size) / FRAME_PX}px`,
      backgroundRepeat: "no-repeat",
    }}
  />
);

export const SunflowerLayer: React.FC = () => {
  const ambient = useAmbientLighting();
  const location = useLocation();

  if (!ambient.enabled) {
    return null;
  }

  const isHero = HERO_ROUTES.has(location.pathname);
  const variantKey = isHero ? "hero" : "mascot";
  const size = isHero ? 90 : 76;
  const isNight =
    ambient.nightMode === "glowing" || ambient.nightMode === "asleep";
  const sprite = isNight ? SPRITE_NIGHT : SPRITE_DAY;
  const fadeDuration = ambient.isReducedMotion ? 0 : CROSS_FADE_MS / 1000;

  const positionClass = isHero
    ? "fixed left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[2]"
    : "fixed bottom-[22px] right-[22px] pointer-events-none z-[2]";

  return (
    <div
      data-sunflower={variantKey}
      aria-hidden="true"
      className={positionClass}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={`${sprite}-${variantKey}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeDuration, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: "absolute", inset: 0 }}
        >
          <SpriteFrame
            src={sprite}
            frameIndex={ambient.frameIndex}
            size={size}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SunflowerLayer;
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/SunflowerLayer.routing.test.tsx
```

Attendu : 8/8 pass (3 hero + 4 mascot + disabled + z-index + aria-hidden = paramétrés via `it.each`).

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/SunflowerLayer.tsx frontend/src/components/__tests__/SunflowerLayer.routing.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SunflowerLayer route-aware (hero vs mascot)

Mounts the Hero variant (90px centered) on /, /login, /signup; the
Mascot variant (76px bottom-right) on every other route. Reads sprite
day/night and frameIndex from AmbientLightingProvider.

EOF
)"
```

---

## Task 8 — `SunflowerLayer` : cross-fade jour↔nuit

**Files:**

- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\SunflowerLayer.crossfade.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\SunflowerLayer.crossfade.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockEngine = vi.hoisted(() => ({
  getAmbientPreset: vi.fn(() => ({
    angle: 0,
    beamColor: "rgba(255,255,255,0.5)",
    haloColor: "rgba(255,255,255,0.3)",
    haloAccentColor: undefined,
    intensity: 0.8,
    frameIndex: 6,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

vi.mock("@deepsight/lighting-engine", () => mockEngine);

const renderAt = async (overrides: Record<string, unknown>) => {
  mockEngine.getAmbientPreset.mockReturnValueOnce({
    angle: 0,
    beamColor: "rgba(255,255,255,0.5)",
    haloColor: "rgba(255,255,255,0.3)",
    haloAccentColor: undefined,
    intensity: 0.8,
    frameIndex: 6,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
    ...overrides,
  });
  const { SunflowerLayer } = await import("../SunflowerLayer");
  const { AmbientLightingProvider } =
    await import("../../contexts/AmbientLightingContext");
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AmbientLightingProvider enabled={true}>
        <SunflowerLayer />
      </AmbientLightingProvider>
    </MemoryRouter>,
  );
};

describe("<SunflowerLayer> day/night cross-fade", () => {
  it("uses sunflower-day.webp when nightMode is null", async () => {
    const { container } = await renderAt({ nightMode: null });
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.backgroundImage).toContain("sunflower-day.webp");
  });

  it("uses sunflower-night.webp when nightMode is glowing", async () => {
    const { container } = await renderAt({ nightMode: "glowing" });
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.backgroundImage).toContain("sunflower-night.webp");
  });

  it("computes correct background-position for frameIndex 0", async () => {
    const { container } = await renderAt({ frameIndex: 0 });
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.backgroundPosition).toBe("-0px -0px");
  });

  it("computes correct background-position for frameIndex 7 (col 1, row 1)", async () => {
    const { container } = await renderAt({ frameIndex: 7 });
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.backgroundPosition).toBe("-256px -256px");
  });

  it("computes correct background-position for frameIndex 23 (col 5, row 3)", async () => {
    const { container } = await renderAt({ frameIndex: 23 });
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.backgroundPosition).toBe("-1280px -768px");
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/SunflowerLayer.crossfade.test.tsx
```

Attendu : pass si Task 7 est correcte. Sinon ajuster.

### Step 3: Write minimal implementation

N/A — comportement déjà implémenté en Task 7.

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/SunflowerLayer.crossfade.test.tsx
```

Attendu : 5/5 pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/__tests__/SunflowerLayer.crossfade.test.tsx
git commit -m "$(cat <<'EOF'
test(web): cover SunflowerLayer day/night sprite + frame offsets

Verifies sunflower-{day,night}.webp routing on nightMode and
background-position for frame indexes 0, 7, 23 (corners + middle).

EOF
)"
```

---

## Task 9 — `SunflowerLayer` : reduced-motion + size variant

**Files:**

- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\SunflowerLayer.size.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\components\__tests__\SunflowerLayer.size.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SunflowerLayer } from "../SunflowerLayer";
import { AmbientLightingProvider } from "../../contexts/AmbientLightingContext";

vi.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: vi.fn(() => ({
    angle: 0,
    beamColor: "rgba(255,255,255,0.5)",
    haloColor: "rgba(255,255,255,0.3)",
    haloAccentColor: undefined,
    intensity: 0.8,
    frameIndex: 0,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AmbientLightingProvider enabled={true}>
        <SunflowerLayer />
      </AmbientLightingProvider>
    </MemoryRouter>,
  );

describe("<SunflowerLayer> size variants", () => {
  it("Hero variant renders at 90px width/height on /", () => {
    const { container } = renderAt("/");
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.width).toBe("90px");
    expect(frame.style.height).toBe("90px");
  });

  it("Mascot variant renders at 76px width/height on /dashboard", () => {
    const { container } = renderAt("/dashboard");
    const frame = container.querySelector(
      "[data-sunflower] div div",
    ) as HTMLElement;
    expect(frame.style.width).toBe("76px");
    expect(frame.style.height).toBe("76px");
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/SunflowerLayer.size.test.tsx
```

Attendu : pass si Task 7 a respecté les tailles 90/76.

### Step 3: Write minimal implementation

N/A.

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/components/__tests__/SunflowerLayer.size.test.tsx
```

Attendu : 2/2 pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/__tests__/SunflowerLayer.size.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert SunflowerLayer hero=90px, mascot=76px sizes

Locks the spec §6.1 size contract: hero on /, /login, /signup is 90px
and mascot on every other route is 76px.

EOF
)"
```

---

## Task 10 — Plugin Vite Critical CSS : module avec snapshot

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\frontend\vite-plugins\ambient-critical-css.ts`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\vite-plugins\__tests__\ambient-critical-css.test.ts`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\vite-plugins\__tests__\ambient-critical-css.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@deepsight/lighting-engine", () => ({
  getAmbientPreset: vi.fn(() => ({
    angle: 18,
    beamColor: "rgba(255,200,140,0.92)",
    haloColor: "rgba(255,200,140,0.45)",
    haloAccentColor: undefined,
    intensity: 0.78,
    frameIndex: 12,
    nightMode: null,
    isReducedMotion: false,
    isHighContrast: false,
    readingZoneIntensityCap: 0.5,
  })),
}));

import { ambientCriticalCss } from "../ambient-critical-css";

describe("vite-plugin ambient-critical-css", () => {
  it("exposes a Vite plugin object with name and transformIndexHtml", () => {
    const plugin = ambientCriticalCss();
    expect(plugin.name).toBe("vite-plugin-ambient-critical-css");
    expect(typeof plugin.transformIndexHtml).toBe("function");
  });

  it("injects an inline <style> with body background and ambient classes", async () => {
    const plugin = ambientCriticalCss();
    const result = await (plugin.transformIndexHtml as Function)(
      "<!doctype html><html><head><title>test</title></head><body></body></html>",
    );
    const html = typeof result === "string" ? result : (result?.html ?? "");
    expect(html).toContain("<style data-ambient-critical>");
    expect(html).toContain("body{background:#0a0a0f");
    expect(html).toContain(".ambient-beam");
    expect(html).toContain(".ambient-halo");
    expect(html).toContain("transform:rotate(18deg)");
  });

  it("emits a <link rel=preload as=image> for the day sprite at noon", async () => {
    const plugin = ambientCriticalCss();
    const result = await (plugin.transformIndexHtml as Function)(
      "<!doctype html><html><head></head><body></body></html>",
    );
    const html = typeof result === "string" ? result : (result?.html ?? "");
    expect(html).toContain('rel="preload"');
    expect(html).toContain('as="image"');
    expect(html).toContain("/assets/ambient/sunflower-day.webp");
  });

  it("emits .ambient-disabled rule that hides overlays when html has the class", async () => {
    const plugin = ambientCriticalCss();
    const result = await (plugin.transformIndexHtml as Function)(
      "<!doctype html><html><head></head><body></body></html>",
    );
    const html = typeof result === "string" ? result : (result?.html ?? "");
    expect(html).toMatch(
      /html\.ambient-disabled .ambient-beam.*display:\s*none/,
    );
    expect(html).toMatch(
      /html\.ambient-disabled .ambient-halo.*display:\s*none/,
    );
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- vite-plugins/__tests__/ambient-critical-css.test.ts
```

Attendu : `Cannot find module '../ambient-critical-css'`.

### Step 3: Write minimal implementation

Créer `C:\Users\33667\DeepSight-Main\frontend\vite-plugins\ambient-critical-css.ts` :

```ts
/**
 * vite-plugin-ambient-critical-css
 *
 * Inject un <style data-ambient-critical> inliné dans index.html avant
 * que React boot, basé sur l'heure courante au démarrage Vite (dev/build).
 * Le rayon + halo apparaissent donc AVANT l'hydratation.
 *
 * Émet aussi <link rel="preload" as="image"> pour le sprite WebP attendu
 * (jour ou nuit selon l'heure) → réduit le LCP du tournesol.
 *
 * Inclut une règle .ambient-disabled (sur <html>) qui masque les overlays
 * via display:none — utilisée si le User a `ambient_lighting_enabled=false`.
 */

import type { Plugin } from "vite";
import { getAmbientPreset } from "@deepsight/lighting-engine";

export const ambientCriticalCss = (): Plugin => {
  return {
    name: "vite-plugin-ambient-critical-css",
    transformIndexHtml(html: string) {
      const preset = getAmbientPreset(new Date());
      const isNight =
        preset.nightMode === "glowing" || preset.nightMode === "asleep";
      const sprite = isNight
        ? "/assets/ambient/sunflower-night.webp"
        : "/assets/ambient/sunflower-day.webp";

      const haloAccent = preset.haloAccentColor
        ? `,${preset.haloAccentColor} 30%`
        : "";

      const css = [
        `body{background:#0a0a0f;}`,
        `.ambient-beam{position:fixed;inset:0;pointer-events:none;z-index:1;mix-blend-mode:screen;transform:rotate(${preset.angle}deg);background:linear-gradient(${preset.angle}deg,transparent 35%,${preset.beamColor} 48%,${preset.beamColor} 50%,${preset.beamColor} 52%,transparent 65%);opacity:${preset.intensity};}`,
        `.ambient-halo{position:fixed;inset:0;pointer-events:none;z-index:1;mix-blend-mode:screen;background:radial-gradient(ellipse 80% 50% at 50% 0%,${preset.haloColor} 0%${haloAccent},transparent 60%);opacity:${preset.intensity};}`,
        `html.ambient-disabled .ambient-beam{display:none;}`,
        `html.ambient-disabled .ambient-halo{display:none;}`,
      ].join("");

      const inlineStyle = `<style data-ambient-critical>${css}</style>`;
      const preload = `<link rel="preload" as="image" href="${sprite}" type="image/webp">`;

      const headInjection = `${inlineStyle}\n${preload}`;
      if (html.includes("</head>")) {
        return html.replace("</head>", `${headInjection}\n</head>`);
      }
      return `${headInjection}\n${html}`;
    },
  };
};

export default ambientCriticalCss;
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- vite-plugins/__tests__/ambient-critical-css.test.ts
```

Attendu : 4/4 pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/vite-plugins/ambient-critical-css.ts frontend/vite-plugins/__tests__/ambient-critical-css.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add vite-plugin-ambient-critical-css for v3 preload

Computes the v3 preset at Vite cold start and inlines body bg + beam +
halo CSS in index.html <head>, plus a <link rel=preload> for the
day/night sprite WebP. Includes an .ambient-disabled escape hatch.

EOF
)"
```

---

## Task 11 — Plugin Vite : wiring dans `vite.config.ts`

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\frontend\vite.config.ts`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\vite-plugins\__tests__\ambient-critical-css.wiring.test.ts`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\vite-plugins\__tests__\ambient-critical-css.wiring.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("vite.config.ts wiring", () => {
  const configPath = path.join(__dirname, "..", "..", "vite.config.ts");
  const config = fs.readFileSync(configPath, "utf-8");

  it("imports ambientCriticalCss from ./vite-plugins/ambient-critical-css", () => {
    expect(config).toMatch(
      /import\s+\{\s*ambientCriticalCss\s*\}\s+from\s+["']\.\/vite-plugins\/ambient-critical-css["']/,
    );
  });

  it("registers the plugin inside the plugins array", () => {
    expect(config).toMatch(/ambientCriticalCss\s*\(\s*\)/);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- vite-plugins/__tests__/ambient-critical-css.wiring.test.ts
```

Attendu : 0/2 pass — l'import et l'appel n'existent pas encore.

### Step 3: Write minimal implementation

Modifier `C:\Users\33667\DeepSight-Main\frontend\vite.config.ts` :

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { version } from "./package.json";
import { ambientCriticalCss } from "./vite-plugins/ambient-critical-css";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ambientCriticalCss(),
    // Upload source maps to Sentry on production builds
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
    ...(process.env.ANALYZE === "true"
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],

  // Inject build timestamp for cache-busting detection
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now().toString()),
    __APP_VERSION__: JSON.stringify(version),
  },

  build: {
    // Source maps for Sentry — uploaded then deleted by the plugin
    sourcemap: "hidden",

    // Taille minimale pour le code splitting
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Code splitting intelligent
        manualChunks: {
          // Vendor chunks (séparés pour meilleur cache)
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["lucide-react"],
          "vendor-motion": ["framer-motion"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-state": ["zustand"],
        },
      },
    },

    // Utiliser esbuild (par défaut) au lieu de terser
    // esbuild est beaucoup plus rapide et inclus dans Vite
    minify: "esbuild",
    target: "es2018",
  },

  // Optimisations pour le dev
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
      "zustand",
      "framer-motion",
    ],
  },
});
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- vite-plugins/__tests__/ambient-critical-css.wiring.test.ts
npm run build
```

Attendu : 2/2 pass + build réussit.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/vite.config.ts frontend/vite-plugins/__tests__/ambient-critical-css.wiring.test.ts
git commit -m "$(cat <<'EOF'
feat(web): wire ambientCriticalCss into vite.config.ts

Activates the critical-CSS injection plugin so the v3 beam + halo
appear before React hydrates and the sprite is preloaded.

EOF
)"
```

---

## Task 12 — Wiring `App.tsx` + suppression legacy

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\frontend\src\App.tsx`
- Supprimer : `C:\Users\33667\DeepSight-Main\frontend\src\hooks\useTimeOfDay.ts`
- Supprimer : `C:\Users\33667\DeepSight-Main\frontend\src\components\AmbientLightDevPanel.tsx`
- Supprimer : `C:\Users\33667\DeepSight-Main\frontend\src\contexts\DayNightContext.tsx`
- Supprimer : `C:\Users\33667\DeepSight-Main\frontend\src\hooks\useAmbientLightingFeatureFlag.ts`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\__tests__\App.ambient.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\__tests__\App.ambient.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..");

describe("App.tsx ambient v3 wiring", () => {
  const app = fs.readFileSync(path.join(SRC, "App.tsx"), "utf-8");

  it("imports AmbientLightingProvider", () => {
    expect(app).toMatch(/from\s+["']\.\/contexts\/AmbientLightingContext["']/);
    expect(app).toMatch(/AmbientLightingProvider/);
  });

  it("imports SunflowerLayer", () => {
    expect(app).toMatch(/from\s+["']\.\/components\/SunflowerLayer["']/);
  });

  it("wraps the Router with <AmbientLightingProvider>", () => {
    expect(app).toMatch(/<AmbientLightingProvider[\s\S]*<Router>/);
  });

  it("mounts <AmbientLightLayer /> inside the provider", () => {
    expect(app).toMatch(/<AmbientLightLayer\s*\/>/);
  });

  it("mounts <SunflowerLayer /> inside the provider", () => {
    expect(app).toMatch(/<SunflowerLayer\s*\/>/);
  });

  it("does not import legacy useTimeOfDay", () => {
    expect(app).not.toMatch(/useTimeOfDay/);
  });

  it("does not import legacy AmbientLightDevPanel", () => {
    expect(app).not.toMatch(/AmbientLightDevPanel/);
  });

  it("does not import legacy DayNightContext", () => {
    expect(app).not.toMatch(/DayNightContext/);
  });
});

describe("Legacy files removed", () => {
  const removed = [
    "hooks/useTimeOfDay.ts",
    "components/AmbientLightDevPanel.tsx",
    "contexts/DayNightContext.tsx",
    "hooks/useAmbientLightingFeatureFlag.ts",
  ];
  it.each(removed)("%s is deleted", (rel) => {
    expect(fs.existsSync(path.join(SRC, rel))).toBe(false);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/__tests__/App.ambient.test.tsx
```

Attendu : tous les tests fail (App.tsx encore en v2, fichiers legacy présents).

### Step 3: Write minimal implementation

**Step 3a** — Modifier `C:\Users\33667\DeepSight-Main\frontend\src\App.tsx` (uniquement les imports en haut + le bloc `<AppRoutes>` autour de la ligne ~445).

Remplacer dans les imports (ligne ~37) :

```tsx
import { AmbientLightLayer } from "./components/AmbientLightLayer";
```

par :

```tsx
import { AmbientLightLayer } from "./components/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { useAuth } from "./hooks/useAuth";
```

(garder l'import existant, ajouter SunflowerLayer + AmbientLightingProvider ; useAuth est déjà importé plus bas, ne pas dupliquer.)

Remplacer le bloc `AppRoutes` (autour de la ligne 435-450) — la nouvelle structure :

```tsx
const AppRoutes = () => {
  const auth = useAuth();
  const ambientEnabled =
    (auth.user?.preferences?.ambient_lighting_enabled ?? true) === true;

  return (
    <LanguageProvider>
      <LoadingWordProvider>
        <AuthProvider value={auth}>
          <TTSProvider>
            <AmbientLightingProvider enabled={ambientEnabled}>
              <Router>
                {/* Couche lumineuse v3 — beam + halo */}
                <AmbientLightLayer />
                {/* Tournesol photoréaliste — hero ou mascot selon route */}
                <SunflowerLayer />

                {/* Skip Link pour l'accessibilité */}
                <SkipLink targetId="main-content" />

                {/* Prefetcher intelligent */}
                <RoutePrefetcher />

                <ErrorBoundary>
                  <Routes>
                    {/* Routes publiques */}
                    <Route path="/" element={<HomeRoute />} />
                    {/* … le reste des routes inchangé … */}
                  </Routes>
                </ErrorBoundary>
              </Router>
            </AmbientLightingProvider>
          </TTSProvider>
        </AuthProvider>
      </LoadingWordProvider>
    </LanguageProvider>
  );
};
```

(Important : ne pas modifier les Routes elles-mêmes. Seuls le wrapping `<AmbientLightingProvider>` et le remplacement de `<AmbientLightLayer intensity="normal" />` par `<AmbientLightLayer />` + ajout de `<SunflowerLayer />` changent.)

**Step 3b** — Supprimer les fichiers legacy :

```bash
cd C:/Users/33667/DeepSight-Main
rm frontend/src/hooks/useTimeOfDay.ts
rm frontend/src/components/AmbientLightDevPanel.tsx
rm frontend/src/contexts/DayNightContext.tsx
rm frontend/src/hooks/useAmbientLightingFeatureFlag.ts
```

**Step 3c** — Si `frontend/src/types/api.ts` n'expose pas encore `User.preferences`, étendre :

```ts
export interface User {
  // … champs existants …
  preferences?: {
    ambient_lighting_enabled?: boolean;
    [key: string]: unknown;
  };
}
```

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/__tests__/App.ambient.test.tsx
npm run typecheck
```

Attendu : 12/12 pass + typecheck OK.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/App.tsx frontend/src/__tests__/App.ambient.test.tsx frontend/src/types/api.ts
git rm frontend/src/hooks/useTimeOfDay.ts frontend/src/components/AmbientLightDevPanel.tsx frontend/src/contexts/DayNightContext.tsx frontend/src/hooks/useAmbientLightingFeatureFlag.ts
git commit -m "$(cat <<'EOF'
refactor(web): wire AmbientLightingProvider in App.tsx, remove v2 legacy

Wraps the Router with AmbientLightingProvider, mounts AmbientLightLayer
and SunflowerLayer, reads ambient_lighting_enabled from user preferences
(default true). Deletes useTimeOfDay, AmbientLightDevPanel,
DayNightContext, useAmbientLightingFeatureFlag — none were mounted in
the active App tree anymore.

EOF
)"
```

---

## Task 13 — Settings toggle : i18n + composant

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\frontend\src\i18n\fr.json`
- Modifier : `C:\Users\33667\DeepSight-Main\frontend\src\i18n\en.json`
- Modifier : `C:\Users\33667\DeepSight-Main\frontend\src\pages\Settings.tsx`
- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\pages\__tests__\Settings.ambient.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\pages\__tests__\Settings.ambient.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Settings } from "../Settings";

vi.mock("../../services/api", () => ({
  api: {
    auth: {
      updatePreferences: vi.fn(async () => ({ success: true, message: "ok" })),
    },
  },
}));

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "fr" }),
}));

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ setLanguage: vi.fn() }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ isDark: true }),
}));

vi.mock("../../contexts/TTSContext", () => ({
  useTTSContext: () => ({ autoPlayEnabled: true, setAutoPlayEnabled: vi.fn() }),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { preferences: { ambient_lighting_enabled: true } },
    refreshUser: vi.fn(),
  }),
}));

const renderSettings = () => {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Settings — Ambient Lighting toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'Effet ambiant lumineux' row", () => {
    renderSettings();
    expect(screen.getByText("Effet ambiant lumineux")).toBeInTheDocument();
  });

  it("renders the descriptive subtitle", () => {
    renderSettings();
    expect(
      screen.getByText(/rayon de lumière subtil et un tournesol/i),
    ).toBeInTheDocument();
  });

  it("calls updatePreferences with ambient_lighting_enabled=false on toggle", async () => {
    const { api } = await import("../../services/api");
    renderSettings();
    const toggle = screen.getByRole("switch", {
      name: /effet ambiant lumineux/i,
    });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(
        (
          api as unknown as {
            auth: { updatePreferences: ReturnType<typeof vi.fn> };
          }
        ).auth.updatePreferences,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ ambient_lighting_enabled: false }),
      );
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/pages/__tests__/Settings.ambient.test.tsx
```

Attendu : `getByText("Effet ambiant lumineux")` echoue — la row n'existe pas.

### Step 3: Write minimal implementation

**Step 3a** — Ajouter clés i18n. Modifier `C:\Users\33667\DeepSight-Main\frontend\src\i18n\fr.json` (ajouter sous la clé `settings` ou en racine si pas de namespace dédié, dans une clé `ambient`) :

```json
{
  "settings": {
    "ambient": {
      "title": "Effet ambiant lumineux",
      "description": "Affiche un rayon de lumière subtil et un tournesol qui suit la course du soleil",
      "savedToast": "Préférence enregistrée"
    }
  }
}
```

Modifier `C:\Users\33667\DeepSight-Main\frontend\src\i18n\en.json` :

```json
{
  "settings": {
    "ambient": {
      "title": "Ambient Lighting Effect",
      "description": "Displays a subtle light ray and a sunflower that follows the sun's path",
      "savedToast": "Preference saved"
    }
  }
}
```

(Si la structure JSON n'a pas de namespace `settings`, ajouter ces clés à la racine sous `settings_ambient_*`. Adapter selon la convention déjà en place dans les fichiers existants.)

**Step 3b** — Modifier `C:\Users\33667\DeepSight-Main\frontend\src\pages\Settings.tsx`. Insérer juste avant la section "Notifications navigateur" (autour de la ligne 300) une nouvelle section :

```tsx
import { Sparkle } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// … dans le composant Settings, après les hooks existants :
const { user, refreshUser } = useAuth();
const queryClient = useQueryClient();
const ambientEnabled = user?.preferences?.ambient_lighting_enabled ?? true;

const ambientMutation = useMutation({
  mutationFn: async (next: boolean) =>
    api.auth.updatePreferences({ ambient_lighting_enabled: next }),
  onSuccess: async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    showToast(tr("Préférence enregistrée", "Preference saved"));
  },
});

const handleAmbientToggle = (): void => {
  ambientMutation.mutate(!ambientEnabled);
};
```

Et insérer la `<section>` glassmorphism dans le JSX (juste avant la section Notifications) :

```tsx
<section className="card backdrop-blur-xl bg-white/5 border border-white/10">
  <div className="panel-header">
    <h2 className="font-semibold text-text-primary flex items-center gap-2">
      <Sparkle className="w-5 h-5 text-accent-primary" />
      {tr("Apparence", "Appearance")}
    </h2>
  </div>
  <div className="panel-body divide-y divide-border-subtle">
    <SettingRow
      icon={Sparkle}
      iconColor="text-accent-primary"
      title={tr("Effet ambiant lumineux", "Ambient Lighting Effect")}
      description={tr(
        "Affiche un rayon de lumière subtil et un tournesol qui suit la course du soleil",
        "Displays a subtle light ray and a sunflower that follows the sun's path",
      )}
    >
      <Toggle
        enabled={ambientEnabled}
        onToggle={handleAmbientToggle}
        saved={ambientMutation.isSuccess}
        ariaLabel={tr("Effet ambiant lumineux", "Ambient Lighting Effect")}
      />
    </SettingRow>
  </div>
</section>
```

(Assumer qu'un composant `Toggle` existe déjà dans Settings.tsx avec props `enabled`/`onToggle`/`saved`. Si l'`ariaLabel` n'est pas supporté, le passer via un wrapper `<span role="switch" aria-label="…">` ou modifier `Toggle` pour forwarder `aria-label` à son `<button>`.)

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/pages/__tests__/Settings.ambient.test.tsx
npm run typecheck
```

Attendu : 3/3 pass + typecheck OK.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/i18n/fr.json frontend/src/i18n/en.json frontend/src/pages/Settings.tsx frontend/src/pages/__tests__/Settings.ambient.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add ambient lighting toggle in Settings

New "Apparence" section with a switch that flips
User.preferences.ambient_lighting_enabled via PUT /api/auth/preferences.
i18n keys added in fr.json and en.json. TanStack Query mutation
invalidates ['user','me'] after success so the AmbientLightingProvider
re-evaluates `enabled`.

EOF
)"
```

---

## Task 14 — Settings toggle : sync immédiat avec AmbientLightingProvider

**Files:**

- Tester : `C:\Users\33667\DeepSight-Main\frontend\src\pages\__tests__\Settings.toggleSync.test.tsx`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\src\pages\__tests__\Settings.toggleSync.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const refreshUser = vi.fn();
const updatePreferences = vi.fn(async () => ({ success: true, message: "ok" }));

vi.mock("../../services/api", () => ({
  api: { auth: { updatePreferences } },
}));
vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "fr" }),
}));
vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ setLanguage: vi.fn() }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ isDark: true }),
}));
vi.mock("../../contexts/TTSContext", () => ({
  useTTSContext: () => ({ autoPlayEnabled: true, setAutoPlayEnabled: vi.fn() }),
}));
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { preferences: { ambient_lighting_enabled: true } },
    refreshUser,
  }),
}));

import { Settings } from "../Settings";

describe("Settings ambient toggle sync", () => {
  it("calls refreshUser() after a successful preference update", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /effet ambiant lumineux/i }),
    );
    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalled();
      expect(refreshUser).toHaveBeenCalled();
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/pages/__tests__/Settings.toggleSync.test.tsx
```

Attendu : pass si Task 13 a bien câblé `onSuccess: refreshUser()`. Sinon ajuster.

### Step 3: Write minimal implementation

N/A — Task 13 le fait déjà. Cette task verrouille le contrat de sync.

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- src/pages/__tests__/Settings.toggleSync.test.tsx
```

Attendu : 1/1 pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/pages/__tests__/Settings.toggleSync.test.tsx
git commit -m "$(cat <<'EOF'
test(web): assert ambient toggle triggers refreshUser for live sync

Guarantees that flipping the switch refreshes the auth user so
AmbientLightingProvider re-evaluates the `enabled` prop without a
page reload.

EOF
)"
```

---

## Task 15 — E2E Playwright : 4 horaires × 2 routes

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\frontend\e2e\ambient-lighting.spec.ts`

### Step 1: Write the failing test

Créer `C:\Users\33667\DeepSight-Main\frontend\e2e\ambient-lighting.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

/**
 * Ambient Lighting v3 — E2E coverage.
 *
 * 4 horaires (matin / midi / coucher / nuit) × 2 routes (/ et /dashboard).
 * Vérifie :
 *  - Les overlays beam + halo sont mountés et aria-hidden
 *  - SunflowerLayer mount Hero sur /, Mascot sur /dashboard
 *  - Le sprite preload <link> est présent dans le head
 *  - prefers-reduced-motion désactive les transitions
 */

const HOURS = [
  { label: "morning", iso: "2026-04-27T06:30:00" },
  { label: "noon", iso: "2026-04-27T12:00:00" },
  { label: "sunset", iso: "2026-04-27T18:30:00" },
  { label: "night", iso: "2026-04-27T22:00:00" },
];

async function freezeClock(page: Page, iso: string): Promise<void> {
  await page.addInitScript((isoTime: string) => {
    const fixed = new Date(isoTime).getTime();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof RealDate>) {
        if (args.length === 0) {
          super(fixed);
        } else {
          super(...args);
        }
      }
      static now() {
        return fixed;
      }
    }
    // @ts-expect-error inject
    globalThis.Date = FakeDate;
  }, iso);
}

async function mockAuthMe(page: Page, ambientEnabled: boolean): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "test",
        email: "test@test.com",
        plan: "free",
        credits: 100,
        credits_monthly: 100,
        is_admin: false,
        total_videos: 0,
        total_words: 0,
        total_playlists: 0,
        email_verified: true,
        created_at: "2024-01-01T00:00:00Z",
        preferences: { ambient_lighting_enabled: ambientEnabled },
      }),
    }),
  );
}

test.describe("Ambient Lighting v3 — 4 hours × 2 routes", () => {
  for (const { label, iso } of HOURS) {
    test(`renders beam + halo on / at ${label}`, async ({ page }) => {
      await freezeClock(page, iso);
      await mockAuthMe(page, true);
      await page.goto("/");
      const beam = page.locator('[data-ambient="beam"]');
      const halo = page.locator('[data-ambient="halo"]');
      await expect(beam).toBeAttached();
      await expect(halo).toBeAttached();
      await expect(beam).toHaveAttribute("aria-hidden", "true");
      await expect(halo).toHaveAttribute("aria-hidden", "true");
    });

    test(`renders Hero sunflower on / at ${label}`, async ({ page }) => {
      await freezeClock(page, iso);
      await mockAuthMe(page, true);
      await page.goto("/");
      const hero = page.locator('[data-sunflower="hero"]');
      await expect(hero).toBeAttached();
      await expect(hero).toHaveAttribute("aria-hidden", "true");
    });

    test(`renders Mascot sunflower on /dashboard at ${label}`, async ({
      page,
    }) => {
      await freezeClock(page, iso);
      await mockAuthMe(page, true);
      await page
        .context()
        .addCookies([
          { name: "auth_test", value: "1", url: "http://localhost:5173" },
        ]);
      await page.goto("/dashboard");
      const mascot = page.locator('[data-sunflower="mascot"]');
      await expect(mascot).toBeAttached();
      await expect(page.locator('[data-sunflower="hero"]')).not.toBeAttached();
    });
  }

  test("preloads the sunflower sprite via <link rel=preload>", async ({
    page,
  }) => {
    await page.goto("/");
    const preload = page.locator('link[rel="preload"][as="image"]');
    await expect(preload).toHaveAttribute(
      "href",
      /\/assets\/ambient\/sunflower-(day|night)\.webp/,
    );
  });

  test("respects prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await mockAuthMe(page, true);
    await page.goto("/");
    const beam = page.locator('[data-ambient="beam"]');
    await expect(beam).toBeAttached();
    const inlineTransition = await beam.evaluate(
      (el) => (el as HTMLElement).style.transition,
    );
    expect(inlineTransition).toBe("");
    await context.close();
  });

  test("hides overlays when ambient_lighting_enabled=false", async ({
    page,
  }) => {
    await mockAuthMe(page, false);
    await page.goto("/");
    await expect(page.locator('[data-ambient="beam"]')).not.toBeAttached();
    await expect(page.locator('[data-ambient="halo"]')).not.toBeAttached();
    await expect(page.locator("[data-sunflower]")).not.toBeAttached();
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npx playwright test e2e/ambient-lighting.spec.ts
```

Attendu (avant `npm run dev`) : commande échoue ou tests fail si server pas up. Le runner Playwright doit booter Vite (config existante) ; vérifier que `playwright.config.ts` lance bien `npm run dev`.

### Step 3: Write minimal implementation

N/A — l'implémentation Vite + composants couvre déjà tout. Si un test fail, c'est un défaut d'implémentation à corriger dans la task concernée (4, 7, 10, 12 ou 13).

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npx playwright test e2e/ambient-lighting.spec.ts
```

Attendu : 4×3 + 3 supplémentaires = 15 tests pass.

### Step 5: Commit

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/e2e/ambient-lighting.spec.ts
git commit -m "$(cat <<'EOF'
test(web): add Playwright E2E for ambient lighting v3

Covers 4 frozen hours (06:30, 12:00, 18:30, 22:00) × 2 routes (/ and
/dashboard), the sprite preload <link>, prefers-reduced-motion handling
and the user toggle off branch.

EOF
)"
```

---

## Task 16 — Final smoke : typecheck + lint + build + tous tests

**Files:**

- N/A (validation finale)

### Step 1: Write the failing test

Pas de test additionnel. C'est une checklist de verification globale.

### Step 2: Run test to verify it fails

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
```

Si une erreur tombe, identifier le fichier et corriger spécifiquement.

### Step 3: Write minimal implementation

Si `npm run typecheck` ou `npm run lint` échoue, corriger les fichiers fautifs **uniquement**. Les regrets typiques :

- Imports manquants après suppression de `useTimeOfDay` → grep pour `useTimeOfDay` dans tout `frontend/src/` et nettoyer.
- Imports manquants après suppression de `DayNightContext` → idem.
- Type `User.preferences` manquant → étendre `frontend/src/types/api.ts` (déjà dans Task 12 si nécessaire).
- Eslint warnings sur les nouveaux composants → corriger (jamais de `any`, ajouter types).

### Step 4: Run test to verify it passes

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright test e2e/ambient-lighting.spec.ts
```

Attendu : tous green. Si build émet un warning sur le bundle size pour `vendor-motion` ou autre, c'est OK (rien de nouveau ajouté).

### Step 5: Commit

Aucun commit si tout est vert. Si des fixes mineurs ont été nécessaires :

```bash
cd C:/Users/33667/DeepSight-Main
git add -p frontend/src
git commit -m "$(cat <<'EOF'
chore(web): final lint/typecheck cleanup post ambient v3 migration

Removes lingering legacy imports flagged by typecheck and tightens
types around User.preferences for the new toggle.

EOF
)"
```

---

## Coordination cross-PR

- **PR1 (lighting-engine v3 + sprites + tokens + backend pref)** : doit être mergée AVANT PR2.
- **PR3 (mobile)** et **PR4 (extension)** : indépendantes, peuvent merger en parallèle de PR2.
- **PR0 (extension-sidepanel-v3)** : non bloquante pour PR2. Le `useBeamCardPropsFromPreset` dérivé du Context sera utilisé par PR4, pas par PR2.
- **PR5 (cleanup final)** : non concernée — PR2 supprime déjà tout son legacy local.

## Risques et mitigations spécifiques PR2

| Risque                                                      | Mitigation                                                                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `User.preferences` non typé après merge PR1                 | Task 12 étend `frontend/src/types/api.ts`                                                                             |
| `Toggle` existant ne forwarde pas `aria-label`              | Task 13 documente le fallback (wrapper `<span role="switch">` ou patch local minimal)                                 |
| Tests Playwright instables sur freeze clock                 | `addInitScript` injecte un `Date` mock avant n'importe quel JS — fiable                                               |
| Sprite preload pointe sur le mauvais fichier au transitions | Task 10 calcule au boot ; l'écart de 30 min entre cold start et first frame est lissé par le cross-fade Framer Motion |
| `mix-blend-mode: screen` peut altérer le contraste          | Task 4 utilise `readingZoneIntensityCap` pour clipper l'opacité ; couvert par axe-core en CI (PR1)                    |
| Z-index conflict avec modals                                | Task 4/7 utilisent `z-[1]` et `z-[2]` ; modals existent à z-50+ donc OK                                               |

## Critères de done

- [ ] Tous les tests Vitest pass : `npm run test`
- [ ] Tous les tests Playwright pass : `npx playwright test e2e/ambient-lighting.spec.ts`
- [ ] `npm run typecheck` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm run build` exit 0 et émet un `<style data-ambient-critical>` dans `dist/index.html`
- [ ] 4 fichiers legacy supprimés (`useTimeOfDay.ts`, `AmbientLightDevPanel.tsx`, `DayNightContext.tsx`, `useAmbientLightingFeatureFlag.ts`)
- [ ] Toggle Settings persiste après reload (vérifier en dev manuellement)
- [ ] Visuellement : beam + halo + sunflower visibles à 12:00 sur `/` (Hero) et `/dashboard` (Mascot)
- [ ] `prefers-reduced-motion: reduce` (DevTools → Rendering) → pas d'animation
- [ ] Aucune régression visuelle sur les autres pages (smoke `/login`, `/history`, `/settings`)

## Couverture de la spec

| Exigence spec                                                       | Task(s) couvrant |
| ------------------------------------------------------------------- | ---------------- |
| §6.1 — `AmbientLightLayer` réécrit (beam + halo)                    | 4, 5, 6          |
| §6.1 — `SunflowerLayer` route-aware (hero 90px / mascot 76px)       | 7, 8, 9          |
| §6.1 — `AmbientLightingContext`                                     | 3                |
| §6.1 — `useAmbientPreset` rewrite                                   | 1, 2             |
| §6.1 — Plugin Vite Critical CSS + preload sprite                    | 10, 11           |
| §6.1 — Z-indexes 0/1/2/10+                                          | 4, 7, 15         |
| §7 — Tokens textuels (déjà PR1)                                     | (pré-flight)     |
| §8 — Toggle Settings + sync API                                     | 13, 14           |
| §8 — `.ambient-disabled` critical CSS class                         | 10               |
| §9 — `aria-hidden=true`, decorative                                 | 4, 7, 15         |
| §9 — `prefers-reduced-motion`                                       | 6, 15            |
| §9 — `prefers-contrast: more` cap (déjà géré dans engine v3 — PR1)  | (pré-flight)     |
| §13 — Suppression legacy `useTimeOfDay`/`AmbientLightDevPanel`      | 12               |
| §13 — Suppression `DayNightContext`/`useAmbientLightingFeatureFlag` | 12               |
| §14.5 — pas de modif backend                                        | (no-backend)     |
