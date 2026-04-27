# Ambient Lighting v3 — PR3 Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter sur le mobile Expo SDK 54 / React Native 0.81 la couche AmbientLightLayer v3 (rayon + halo) + SunflowerLayer mascot avec cross-fade sprite jour↔nuit, en branchant le mobile sur le package partagé `@deepsight/lighting-engine` v3 via une refonte minimale de Metro, suppression du legacy `useTimeOfDay`, splash screen Expo avec PNG fallback du beam initial, et toggle Profile.

**Architecture:** Metro config étendu (`watchFolders` + `extraNodeModules`) pour résoudre le workspace package. AmbientLightingProvider distribue le preset au runtime via Context React. AmbientLightLayer utilise expo-linear-gradient + Reanimated 4. SunflowerLayer cross-fade par opacity sur 2 Animated.Image plein-screen-positionnées. AppState listener pause cross-fade en background pour battery.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, TypeScript strict, Reanimated 4.1, expo-linear-gradient, expo-image, Jest + Testing Library RN, Maestro, TanStack Query 5.

---

## Pre-flight checks (avant de commencer)

- [ ] **Branch créée** : `git checkout -b feat/ambient-lighting-v3-mobile` depuis `main` à jour
- [ ] **PR1 mergée** : vérifier que `packages/lighting-engine/src/index.ts` exporte bien `getAmbientPreset` v3 + `useAmbientPreset` (présence de `nightMode`, `frameIndex`, `haloAccentColor` dans `AmbientPreset`). Si absent → STOP, attendre PR1
- [ ] **Sprites présents** : `mobile/assets/ambient/sunflower-day.webp` + `sunflower-night.webp` doivent exister (commités par PR1)
- [ ] **Tokens shift** : `mobile/src/theme/colors.ts` doit déjà avoir reçu le shift v3 par PR1
- [ ] **Worktree** : recommandé d'utiliser `superpowers:using-git-worktrees` pour isoler le travail
- [ ] **Working dir** : tous les paths absolus depuis `C:\Users\33667\DeepSight-Main\`

---

## Coordination cross-PR

- **PR1 (lighting-engine-v3-foundation)** : DOIT être mergée AVANT d'exécuter ce plan. PR1 livre l'engine v3, les sprites WebP, et le shift tokens.
- **PR2 (web)** et **PR4 (extension)** : tournent en parallèle de PR3. Aucune coordination directe, mais commits cross-PR potentiellement sur `packages/lighting-engine/` doivent être évités côté PR3 (sinon merge conflict).
- **Metro fix** : impératif **Task 1**, sans quoi rien d'autre ne marche (le commentaire L14-15 du composant actuel le documente).

---

## Task 1 — Configurer Metro pour résoudre `@deepsight/lighting-engine`

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\mobile\metro.config.js`
- Référence : `C:\Users\33667\DeepSight-Main\packages\lighting-engine\package.json` (main = `./src/index.ts`)

**Pourquoi :** le package est déclaré `file:../packages/lighting-engine` dans `mobile/package.json` mais Metro ignore par défaut les TS sources hors `mobile/`. `watchFolders` lui dit où surveiller, `extraNodeModules` lui dit où aller chercher quand un import correspond.

**Step 1: Write the failing test**

Créer le smoke test bash (pas un test Jest — c'est un test d'environnement Metro). On l'enregistre dans le plan et on s'en sert dans les Steps 2 et 4.

```bash
# Smoke test — depuis C:\Users\33667\DeepSight-Main\mobile
# Doit démarrer sans "Unable to resolve module @deepsight/lighting-engine"
npx expo start --clear --no-dev --offline 2>&1 | head -50 | grep -iE "error|unable to resolve|deepsight/lighting-engine"
# Attendu : aucune ligne d'erreur de résolution
```

**Step 2: Run test to verify it fails**

Avant la modification, créer un fichier dummy `mobile/src/__metro_smoke.ts` qui importe le package, puis lancer le bundler. Si le bundler échoue à résoudre, le test "fail" est confirmé.

```bash
echo "import { getAmbientPreset } from '@deepsight/lighting-engine'; console.log(typeof getAmbientPreset);" > mobile/src/__metro_smoke.ts
cd mobile ; npx expo export --platform ios --output-dir /tmp/expo-smoke 2>&1 | tail -30
# Attendu : "Unable to resolve @deepsight/lighting-engine" OU sortie sans .ts compilé
```

**Step 3: Write minimal implementation**

Réécrire `C:\Users\33667\DeepSight-Main\mobile\metro.config.js` :

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root (so Metro picks up changes in packages/)
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(monorepoRoot, "packages", "lighting-engine"),
];

// 2. Resolve modules from BOTH mobile/node_modules AND root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Force resolution of the workspace package to its src entry (TS pure)
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@deepsight/lighting-engine": path.resolve(
    monorepoRoot,
    "packages",
    "lighting-engine",
  ),
};

// 4. Make sure Metro knows TS extensions for this workspace package
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts ?? []), "ts", "tsx", "css"]),
);

// 5. Disable hierarchical lookup to avoid Metro climbing past monorepoRoot
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
rm -rf .expo node_modules/.cache /tmp/metro-cache
npx expo start --clear &
# Attendre 10s
# Vérifier qu'aucune erreur de résolution n'apparaît
# Tuer le serveur (Ctrl+C ou kill)
```

Puis re-run `npx expo export --platform ios --output-dir /tmp/expo-smoke` — la sortie doit cette fois inclure le code transpilé du `__metro_smoke.ts` sans erreur.

**Step 5: Commit**

```bash
rm mobile/src/__metro_smoke.ts
git add mobile/metro.config.js
git commit -m "feat(mobile): configure Metro to resolve @deepsight/lighting-engine workspace package"
```

---

## Task 2 — Vérifier la dépendance `@deepsight/lighting-engine` dans `package.json`

**Files:**

- Vérifier (et au besoin modifier) : `C:\Users\33667\DeepSight-Main\mobile\package.json`

**Pourquoi :** la résolution Metro ne suffit pas si `npm install` ne crée pas de symlink dans `node_modules`. On confirme la déclaration `file:../packages/lighting-engine`.

**Step 1: Write the failing test**

```bash
# Doit retourner exactement la ligne de dépendance
grep '"@deepsight/lighting-engine"' mobile/package.json
# Attendu : "@deepsight/lighting-engine": "file:../packages/lighting-engine",
```

**Step 2: Run test to verify it fails**

Si la ligne existe déjà (ce que la lecture de `mobile/package.json` montre), ce step **PASSE**. On confirme alors juste l'install :

```bash
cd mobile
ls node_modules/@deepsight/lighting-engine/src/index.ts 2>&1
# Si "No such file or directory" → réinstaller
```

**Step 3: Write minimal implementation**

Si la dépendance manque, ajouter dans `mobile/package.json` (section `dependencies`, ordre alphabétique) :

```json
"@deepsight/lighting-engine": "file:../packages/lighting-engine",
```

Puis :

```bash
cd mobile
npm install
```

**Step 4: Run test to verify it passes**

```bash
ls mobile/node_modules/@deepsight/lighting-engine/src/index.ts
# Doit retourner le chemin sans erreur
node -e "console.log(require.resolve('@deepsight/lighting-engine', { paths: ['mobile'] }))"
```

**Step 5: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): pin @deepsight/lighting-engine workspace dependency"
```

(Si la ligne existait déjà et `node_modules` est OK, **skip ce commit** — passer directement à Task 3.)

---

## Task 3 — Smoke test : import resolved + types OK

**Files:**

- Créer (temporaire) : `C:\Users\33667\DeepSight-Main\mobile\src\__tests__\lighting-engine-smoke.test.ts`

**Pourquoi :** verrouiller dans Jest que l'import passe le typecheck **et** runtime, pour ne plus jamais régresser.

**Step 1: Write the failing test**

```ts
// mobile/src/__tests__/lighting-engine-smoke.test.ts
import {
  getAmbientPreset,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

describe("@deepsight/lighting-engine resolution (smoke)", () => {
  it("resolves getAmbientPreset to a callable function", () => {
    expect(typeof getAmbientPreset).toBe("function");
  });

  it("returns a v3-shaped AmbientPreset with frameIndex + nightMode", () => {
    const noon = new Date("2026-04-27T12:00:00");
    const preset: AmbientPreset = getAmbientPreset(noon);
    expect(preset).toMatchObject({
      angle: expect.any(Number),
      beamColor: expect.any(String),
      haloColor: expect.any(String),
      intensity: expect.any(Number),
      frameIndex: expect.any(Number),
    });
    // v3 fields (PR1 contract)
    expect(preset).toHaveProperty("nightMode");
    expect(preset).toHaveProperty("isReducedMotion");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- lighting-engine-smoke
# Attendu : si Metro/Jest mal configuré, "Cannot find module @deepsight/lighting-engine"
# Si Task 1+2 OK : test passe directement (cas normal)
```

**Step 3: Write minimal implementation**

Si Jest n'arrive pas à résoudre, vérifier que `mobile/jest.config.js` (ou champ `jest` de `package.json`) inclut bien :

```js
moduleNameMapper: {
  "^@deepsight/lighting-engine$": "<rootDir>/../packages/lighting-engine/src/index.ts",
},
transformIgnorePatterns: [
  "node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|@deepsight/lighting-engine)",
],
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- lighting-engine-smoke
# Attendu : 2 tests passent
npm run typecheck
# Attendu : 0 nouvelle erreur
```

**Step 5: Commit**

```bash
git add mobile/src/__tests__/lighting-engine-smoke.test.ts mobile/jest.config.js mobile/package.json
git commit -m "test(mobile): add smoke test verifying @deepsight/lighting-engine resolves"
```

---

## Task 4 — Créer `useAmbientPreset` hook mobile (avec AppState pause)

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\hooks\useAmbientPreset.ts`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\hooks\__tests__\useAmbientPreset.test.ts`

**Pourquoi :** le hook du package est pensé pour le web. Le mobile a besoin :

1. de pause quand `AppState !== 'active'` (économie batterie)
2. de détection `prefers-reduced-motion` via RN `AccessibilityInfo` (pas `window.matchMedia`)
3. d'un recompute périodique (toutes les 5min) plutôt qu'un `requestAnimationFrame`

**Step 1: Write the failing test**

```ts
// mobile/src/hooks/__tests__/useAmbientPreset.test.ts
import { renderHook, act } from "@testing-library/react-native";
import { AppState, AccessibilityInfo } from "react-native";
import { useAmbientPreset } from "../useAmbientPreset";

jest.mock("react-native/Libraries/Utilities/AccessibilityInfo", () => ({
  isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

describe("useAmbientPreset (mobile)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns an AmbientPreset on mount", () => {
    const { result } = renderHook(() => useAmbientPreset());
    expect(result.current.preset).toMatchObject({
      angle: expect.any(Number),
      beamColor: expect.any(String),
      frameIndex: expect.any(Number),
    });
  });

  it("recomputes preset every 5 minutes", () => {
    const { result } = renderHook(() => useAmbientPreset());
    const initialFrame = result.current.preset.frameIndex;

    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000 + 100);
    });

    // Le frameIndex peut être identique si on est dans la meme demi-heure,
    // mais le hook doit avoir tourné sans crasher.
    expect(typeof result.current.preset.frameIndex).toBe("number");
  });

  it("pauses recompute when AppState becomes background", () => {
    const listeners: Record<string, (s: string) => void> = {};
    jest.spyOn(AppState, "addEventListener").mockImplementation((event, cb) => {
      listeners[event] = cb as (s: string) => void;
      return { remove: jest.fn() } as never;
    });

    const { result } = renderHook(() => useAmbientPreset());
    expect(result.current.isPaused).toBe(false);

    act(() => {
      listeners["change"]?.("background");
    });
    expect(result.current.isPaused).toBe(true);

    act(() => {
      listeners["change"]?.("active");
    });
    expect(result.current.isPaused).toBe(false);
  });

  it("respects intensityMul option (mobile default 0.5)", () => {
    const { result: full } = renderHook(() =>
      useAmbientPreset({ intensityMul: 1 }),
    );
    const { result: half } = renderHook(() =>
      useAmbientPreset({ intensityMul: 0.5 }),
    );
    expect(half.current.preset.intensity).toBeLessThanOrEqual(
      full.current.preset.intensity,
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- useAmbientPreset
# Attendu : "Cannot find module '../useAmbientPreset'"
```

**Step 3: Write minimal implementation**

```ts
// mobile/src/hooks/useAmbientPreset.ts
/**
 * useAmbientPreset (mobile) — wrapper RN du hook engine v3.
 *
 * Différences vs web :
 *   - pause quand AppState !== 'active' (batterie)
 *   - reduce-motion via AccessibilityInfo (pas window.matchMedia)
 *   - recompute toutes les 5 minutes (pas RAF)
 *   - intensityMul default 0.5 sur mobile (la spec dit ainsi)
 */
import { useEffect, useRef, useState } from "react";
import { AppState, AccessibilityInfo, type AppStateStatus } from "react-native";
import {
  getAmbientPreset,
  type AmbientPreset,
  type PresetOptions,
} from "@deepsight/lighting-engine";

const RECOMPUTE_INTERVAL_MS = 5 * 60 * 1000;
const MOBILE_DEFAULT_INTENSITY_MUL = 0.5;

export interface UseAmbientPresetResult {
  preset: AmbientPreset;
  isPaused: boolean;
  prefersReducedMotion: boolean;
}

export function useAmbientPreset(opts?: PresetOptions): UseAmbientPresetResult {
  const intensityMul = opts?.intensityMul ?? MOBILE_DEFAULT_INTENSITY_MUL;
  const optsRef = useRef<PresetOptions>({ ...opts, intensityMul });
  optsRef.current = { ...opts, intensityMul };

  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), optsRef.current),
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState<boolean>(false);

  // ── prefers-reduced-motion (RN) ───────────────────────────────────
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setPrefersReducedMotion(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v: boolean) => {
        if (mounted) setPrefersReducedMotion(v);
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // ── AppState pause/resume ─────────────────────────────────────────
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      setIsPaused(next !== "active");
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  // ── Recompute périodique (skip si paused) ─────────────────────────
  useEffect(() => {
    if (isPaused) return;
    // Recompute immédiat dès qu'on revient en foreground
    setPreset(getAmbientPreset(new Date(), optsRef.current));
    const id = setInterval(() => {
      setPreset(getAmbientPreset(new Date(), optsRef.current));
    }, RECOMPUTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPaused]);

  return { preset, isPaused, prefersReducedMotion };
}

export default useAmbientPreset;
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- useAmbientPreset
# Attendu : 4 tests passent
npm run typecheck
```

**Step 5: Commit**

```bash
git add mobile/src/hooks/useAmbientPreset.ts mobile/src/hooks/__tests__/useAmbientPreset.test.ts
git commit -m "feat(mobile): add useAmbientPreset hook with AppState pause + reduced-motion"
```

---

## Task 5 — Créer `AmbientLightingContext` Provider

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\contexts\AmbientLightingContext.tsx`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\contexts\__tests__\AmbientLightingContext.test.tsx`

**Pourquoi :** plusieurs composants (AmbientLightLayer, SunflowerLayer) doivent partager le même preset, et le toggle utilisateur (`User.preferences.ambient_lighting_enabled`) doit pouvoir court-circuiter tout le sous-arbre.

**Step 1: Write the failing test**

```tsx
// mobile/src/contexts/__tests__/AmbientLightingContext.test.tsx
import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import {
  AmbientLightingProvider,
  useAmbientLighting,
} from "../AmbientLightingContext";

const Probe: React.FC = () => {
  const { preset, enabled, prefersReducedMotion } = useAmbientLighting();
  return (
    <>
      <Text testID="frame">{preset.frameIndex}</Text>
      <Text testID="enabled">{String(enabled)}</Text>
      <Text testID="reduce">{String(prefersReducedMotion)}</Text>
    </>
  );
};

describe("AmbientLightingProvider", () => {
  it("exposes a preset, enabled=true by default, and reduced-motion flag", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <Probe />
      </AmbientLightingProvider>,
    );
    expect(Number(getByTestId("frame").props.children)).toBeGreaterThanOrEqual(
      0,
    );
    expect(getByTestId("enabled").props.children).toBe("true");
    expect(getByTestId("reduce").props.children).toBe("false");
  });

  it("respects enabled=false prop (toggle OFF user)", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <Probe />
      </AmbientLightingProvider>,
    );
    expect(getByTestId("enabled").props.children).toBe("false");
  });

  it("throws when useAmbientLighting is used outside the Provider", () => {
    const Spy = () => {
      useAmbientLighting();
      return null;
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => render(<Spy />)).toThrow(/AmbientLightingProvider/);
    consoleError.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- AmbientLightingContext
# Attendu : "Cannot find module '../AmbientLightingContext'"
```

**Step 3: Write minimal implementation**

```tsx
// mobile/src/contexts/AmbientLightingContext.tsx
/**
 * AmbientLightingContext (mobile) — distribue le preset v3 aux overlays.
 *
 * - Lit `User.preferences.ambient_lighting_enabled` via `enabled` prop
 * - Pose le hook `useAmbientPreset` une seule fois (évite duplication)
 * - Si `enabled === false`, les consumers doivent rendre `null`
 */
import React, { createContext, useContext, useMemo } from "react";
import {
  useAmbientPreset,
  type UseAmbientPresetResult,
} from "@/hooks/useAmbientPreset";
import type { PresetOptions } from "@deepsight/lighting-engine";

interface AmbientLightingContextValue extends UseAmbientPresetResult {
  enabled: boolean;
}

const AmbientLightingContext =
  createContext<AmbientLightingContextValue | null>(null);

interface AmbientLightingProviderProps {
  enabled?: boolean;
  options?: PresetOptions;
  children: React.ReactNode;
}

export const AmbientLightingProvider: React.FC<
  AmbientLightingProviderProps
> = ({ enabled = true, options, children }) => {
  const hookResult = useAmbientPreset(options);

  const value = useMemo<AmbientLightingContextValue>(
    () => ({ ...hookResult, enabled }),
    [hookResult, enabled],
  );

  return (
    <AmbientLightingContext.Provider value={value}>
      {children}
    </AmbientLightingContext.Provider>
  );
};

export function useAmbientLighting(): AmbientLightingContextValue {
  const ctx = useContext(AmbientLightingContext);
  if (!ctx) {
    throw new Error(
      "useAmbientLighting must be used inside <AmbientLightingProvider>",
    );
  }
  return ctx;
}

export default AmbientLightingProvider;
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- AmbientLightingContext
# Attendu : 3 tests passent
```

**Step 5: Commit**

```bash
git add mobile/src/contexts/AmbientLightingContext.tsx mobile/src/contexts/__tests__/AmbientLightingContext.test.tsx
git commit -m "feat(mobile): add AmbientLightingProvider Context with toggle support"
```

---

## Task 6 — Réécrire `AmbientLightLayer` (rayon + halo, plus de soleil/lune disque)

**Files:**

- Modifier (réécriture complète) : `C:\Users\33667\DeepSight-Main\mobile\src\components\backgrounds\AmbientLightLayer.tsx`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\components\backgrounds\__tests__\AmbientLightLayer.test.tsx`

**Pourquoi :** la spec §6.2 exige beam + halo (PAS de disque solaire net). L'implémentation v2 actuelle a soleil/lune disques + étoiles → tout supprimer. Garder uniquement :

1. un rayon (LinearGradient diagonal piloté par `preset.angle`)
2. un halo de source (View+gradient à l'origine du rayon, opacité dérivée de `preset.intensity`)

**Step 1: Write the failing test**

```tsx
// mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

import { AmbientLightLayer } from "../AmbientLightLayer";
import { AmbientLightingProvider } from "@/contexts/AmbientLightingContext";

describe("<AmbientLightLayer />", () => {
  it("renders a beam + halo wrapper inside the Provider", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer intensity="normal" />
      </AmbientLightingProvider>,
    );
    expect(getByTestId("ambient-beam")).toBeTruthy();
    expect(getByTestId("ambient-halo")).toBeTruthy();
  });

  it("renders nothing when ambient-lighting is disabled", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <AmbientLightLayer intensity="normal" />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("ambient-beam")).toBeNull();
    expect(queryByTestId("ambient-halo")).toBeNull();
  });

  it("uses pointerEvents=none on the root", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer intensity="normal" />
      </AmbientLightingProvider>,
    );
    const root = getByTestId("ambient-light-root");
    expect(root.props.pointerEvents).toBe("none");
  });

  it("does NOT render any sun/moon disc element (v3 = halo only)", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider>
        <AmbientLightLayer intensity="normal" />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("sun-disc")).toBeNull();
    expect(queryByTestId("moon-disc")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- AmbientLightLayer
# Attendu : FAIL — l'implémentation v2 a sun-disc/moon-disc + n'utilise pas le Provider
```

**Step 3: Write minimal implementation**

```tsx
// mobile/src/components/backgrounds/AmbientLightLayer.tsx
/**
 * AmbientLightLayer v3 (mobile) — rayon de précision + halo de source.
 *
 * v3 spec (§6.2) :
 *   - Beam unique piloté par preset.angle, couleurs preset.beamColor/haloColor
 *   - Halo doux à l'origine (pas de disque solaire/lunaire net)
 *   - Reanimated 4 sur opacity + transform.rotate, durée 1500ms (0 si reduce-motion)
 *   - Consume AmbientLightingContext (pas useTimeOfDay)
 *   - pointerEvents="none" partout (overlays décoratifs)
 *   - Renvoie null si toggle utilisateur OFF
 */
import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useAmbientLighting } from "@/contexts/AmbientLightingContext";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  intensity?: Intensity;
}

const INTENSITY_MUL: Record<Intensity, number> = {
  soft: 0.5,
  normal: 0.75,
  strong: 1.0,
};

const TRANSITION_MS = 1500;
const BEAM_HEIGHT_PCT = 0.35;
const BEAM_TOP_PCT = 0.32;
const HALO_SIZE = 240;

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
}) => {
  const { preset, enabled, prefersReducedMotion } = useAmbientLighting();

  const intensityMul = INTENSITY_MUL[intensity];
  const targetOpacity = Math.min(1, preset.intensity * intensityMul);
  const targetAngle = preset.angle;

  // Halo origin — coté gauche pour angle négatif (matin), droit pour positif (couchant)
  const haloLeftPct = preset.angle < 0 ? 12 : 88 - 100 * (HALO_SIZE / SCREEN_W);
  const haloTopPct = 14;

  const opacity = useSharedValue(targetOpacity);
  const rotation = useSharedValue(targetAngle);

  useEffect(() => {
    const ms = prefersReducedMotion ? 0 : TRANSITION_MS;
    const cfg = { duration: ms, easing: Easing.bezier(0.4, 0, 0.2, 1) };
    opacity.value = withTiming(targetOpacity, cfg);
    rotation.value = withTiming(targetAngle, cfg);
  }, [targetOpacity, targetAngle, prefersReducedMotion, opacity, rotation]);

  const animatedBeamStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedHaloStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.85,
  }));

  if (!enabled) return null;

  const beamRgb = preset.beamColor;
  const haloRgb = preset.haloColor;
  const accent = preset.haloAccentColor ?? "transparent";

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      testID="ambient-light-root"
    >
      {/* Halo de source (radial-ish gradient via LinearGradient + opacity stack) */}
      <Animated.View
        testID="ambient-halo"
        style={[
          styles.halo,
          {
            left: `${haloLeftPct}%`,
            top: `${haloTopPct}%`,
            backgroundColor: "transparent",
          },
          animatedHaloStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[haloRgb, accent, "transparent"]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Beam — rayon traversant */}
      <Animated.View
        testID="ambient-beam"
        style={[
          styles.beamWrap,
          { height: SCREEN_H * BEAM_HEIGHT_PCT, top: SCREEN_H * BEAM_TOP_PCT },
          animatedBeamStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["transparent", beamRgb, "transparent"]}
          start={{ x: 0.55, y: 0 }}
          end={{ x: 0.45, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  beamWrap: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    overflow: "hidden",
  },
});

export default AmbientLightLayer;
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- AmbientLightLayer
# Attendu : 4 tests passent
npm run typecheck
```

**Step 5: Commit**

```bash
git add mobile/src/components/backgrounds/AmbientLightLayer.tsx mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx
git commit -m "refactor(mobile): rewrite AmbientLightLayer to v3 (beam + halo, consume Context)"
```

---

## Task 7 — Helper `spritePosition(frameIndex)` pour le sprite tournesol

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\components\backgrounds\spritePosition.ts`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\components\backgrounds\__tests__\spritePosition.test.ts`

**Pourquoi :** sprites jour/nuit = grilles 6×4 (24 frames, 256×256 chacune, total 1536×1024 par sprite — cf. spec §5). Mobile RN ne peut pas faire `background-position` CSS sur une `<Image>` ; il faut afficher l'image entière et la translater dans une `View` clippée. Le helper retourne `{ x, y }` à appliquer en `transform: [{ translateX }, { translateY }]`.

**Step 1: Write the failing test**

```ts
// mobile/src/components/backgrounds/__tests__/spritePosition.test.ts
import {
  spritePosition,
  FRAME_SIZE,
  GRID_COLS,
  GRID_ROWS,
} from "../spritePosition";

describe("spritePosition", () => {
  it("returns {0,0} for frame 0", () => {
    expect(spritePosition(0)).toEqual({ x: 0, y: 0 });
  });

  it("returns x = -FRAME_SIZE for frame 1", () => {
    expect(spritePosition(1)).toEqual({ x: -FRAME_SIZE, y: 0 });
  });

  it("wraps to next row at frame GRID_COLS", () => {
    expect(spritePosition(GRID_COLS)).toEqual({ x: 0, y: -FRAME_SIZE });
  });

  it("returns last frame correctly", () => {
    const last = GRID_COLS * GRID_ROWS - 1;
    expect(spritePosition(last)).toEqual({
      x: -(GRID_COLS - 1) * FRAME_SIZE,
      y: -(GRID_ROWS - 1) * FRAME_SIZE,
    });
  });

  it("clamps frameIndex modulo total frames", () => {
    const total = GRID_COLS * GRID_ROWS;
    expect(spritePosition(total)).toEqual(spritePosition(0));
    expect(spritePosition(total + 5)).toEqual(spritePosition(5));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- spritePosition
```

**Step 3: Write minimal implementation**

```ts
// mobile/src/components/backgrounds/spritePosition.ts
/**
 * Sprite layout for sunflower-{day,night}.webp.
 * Spec §5 : grille 6×4 = 24 frames, 256×256 px chacune (sprite total 1536×1024).
 */
export const FRAME_SIZE = 256;
export const GRID_COLS = 6;
export const GRID_ROWS = 4;
export const FRAME_COUNT = GRID_COLS * GRID_ROWS;

export interface SpriteOffset {
  x: number;
  y: number;
}

export function spritePosition(frameIndex: number): SpriteOffset {
  const idx = ((frameIndex % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
  const col = idx % GRID_COLS;
  const row = Math.floor(idx / GRID_COLS);
  return { x: -col * FRAME_SIZE, y: -row * FRAME_SIZE };
}
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- spritePosition
# Attendu : 5 tests passent
```

**Step 5: Commit**

```bash
git add mobile/src/components/backgrounds/spritePosition.ts mobile/src/components/backgrounds/__tests__/spritePosition.test.ts
git commit -m "feat(mobile): add spritePosition helper for 6x4 sunflower sprite layout"
```

---

## Task 8 — Créer `SunflowerLayer` (mascot + cross-fade Animated.Image jour↔nuit)

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\components\backgrounds\SunflowerLayer.tsx`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\components\backgrounds\__tests__\SunflowerLayer.test.tsx`

**Pourquoi :** spec §6.2 mobile = mascot only (pas de variant hero). Position bottom-right, 76px, au-dessus du tab bar. Cross-fade opacity entre 2 layers (jour + nuit) selon `preset.nightMode`. Sprite affiché entièrement, clippé par une View.

**Step 1: Write the failing test**

```tsx
// mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

import { SunflowerLayer } from "../SunflowerLayer";
import { AmbientLightingProvider } from "@/contexts/AmbientLightingContext";

describe("<SunflowerLayer />", () => {
  it("renders the mascot wrapper inside the Provider", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <SunflowerLayer variant="mascot" />
      </AmbientLightingProvider>,
    );
    expect(getByTestId("sunflower-root")).toBeTruthy();
    expect(getByTestId("sunflower-day")).toBeTruthy();
    expect(getByTestId("sunflower-night")).toBeTruthy();
  });

  it("renders nothing when toggle off", () => {
    const { queryByTestId } = render(
      <AmbientLightingProvider enabled={false}>
        <SunflowerLayer variant="mascot" />
      </AmbientLightingProvider>,
    );
    expect(queryByTestId("sunflower-root")).toBeNull();
  });

  it("uses pointerEvents=none on the root", () => {
    const { getByTestId } = render(
      <AmbientLightingProvider>
        <SunflowerLayer variant="mascot" />
      </AmbientLightingProvider>,
    );
    expect(getByTestId("sunflower-root").props.pointerEvents).toBe("none");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- SunflowerLayer
```

**Step 3: Write minimal implementation**

```tsx
// mobile/src/components/backgrounds/SunflowerLayer.tsx
/**
 * SunflowerLayer v3 (mobile) — mascot bottom-right.
 *
 * - 2 sprites superposés (day + night) cross-fadés via opacity Reanimated 4
 * - `frameIndex` du preset → translation à l'intérieur d'une View clippée
 *   (RN n'a pas backgroundPosition CSS)
 * - 76px de côté (mascot), bottom: 24, right: 24, au-dessus du tab bar (zIndex 2)
 * - pointerEvents="none"
 * - Renvoie null si toggle utilisateur OFF
 */
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useAmbientLighting } from "@/contexts/AmbientLightingContext";
import { spritePosition, FRAME_SIZE } from "./spritePosition";

const TRANSITION_MS = 1500;
const MASCOT_SIZE = 76;

interface SunflowerLayerProps {
  variant?: "mascot";
}

const SUNFLOWER_DAY = require("../../../assets/ambient/sunflower-day.webp");
const SUNFLOWER_NIGHT = require("../../../assets/ambient/sunflower-night.webp");

export const SunflowerLayer: React.FC<SunflowerLayerProps> = (
  { variant = "mascot" }, // eslint-disable-line @typescript-eslint/no-unused-vars
) => {
  const { preset, enabled, prefersReducedMotion } = useAmbientLighting();

  const isNight = preset.nightMode === "glowing";
  const offset = spritePosition(preset.frameIndex);

  const dayOpacity = useSharedValue(isNight ? 0 : 1);
  const nightOpacity = useSharedValue(isNight ? 1 : 0);

  useEffect(() => {
    const ms = prefersReducedMotion ? 0 : TRANSITION_MS;
    const cfg = { duration: ms, easing: Easing.bezier(0.4, 0, 0.2, 1) };
    dayOpacity.value = withTiming(isNight ? 0 : 1, cfg);
    nightOpacity.value = withTiming(isNight ? 1 : 0, cfg);
  }, [isNight, prefersReducedMotion, dayOpacity, nightOpacity]);

  const dayStyle = useAnimatedStyle(() => ({ opacity: dayOpacity.value }));
  const nightStyle = useAnimatedStyle(() => ({ opacity: nightOpacity.value }));

  if (!enabled) return null;

  const scale = MASCOT_SIZE / FRAME_SIZE; // ~0.297
  const innerStyle = {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    transform: [
      { scale },
      // Aligner sur top-left avant translation pour que la frame visible commence en (0,0)
      { translateX: offset.x },
      { translateY: offset.y },
    ],
  } as const;

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible={false}
      testID="sunflower-root"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, dayStyle]}
        pointerEvents="none"
        testID="sunflower-day"
      >
        <View style={styles.clip}>
          <Image
            source={SUNFLOWER_DAY}
            style={innerStyle}
            contentFit="cover"
            transition={0}
          />
        </View>
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, nightStyle]}
        pointerEvents="none"
        testID="sunflower-night"
      >
        <View style={styles.clip}>
          <Image
            source={SUNFLOWER_NIGHT}
            style={innerStyle}
            contentFit="cover"
            transition={0}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    bottom: 88, // au-dessus du tab bar (~64) + marge 24
    right: 24,
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    zIndex: 2,
  },
  clip: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    overflow: "hidden",
  },
});

export default SunflowerLayer;
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- SunflowerLayer
# Attendu : 3 tests passent
npm run typecheck
```

**Step 5: Commit**

```bash
git add mobile/src/components/backgrounds/SunflowerLayer.tsx mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx
git commit -m "feat(mobile): add SunflowerLayer mascot with day/night cross-fade"
```

---

## Task 9 — Wire `AmbientLightingProvider` + overlays dans `_layout.tsx` + supprimer `useTimeOfDay`

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\mobile\app\_layout.tsx`
- Supprimer : `C:\Users\33667\DeepSight-Main\mobile\src\hooks\useTimeOfDay.ts`
- Vérifier : aucun autre consumer de `useTimeOfDay` dans `mobile/src/` (run `grep`)

**Pourquoi :** brancher la nouvelle architecture en root. `AmbientLightingProvider` doit voir `useAuth` (pour piocher `user.preferences.ambient_lighting_enabled`) → il se monte **sous** `AuthProvider`. Les overlays sont posés au-dessus du `<Stack>` (z-order natif RN). Le legacy `useTimeOfDay` n'a plus de consumer (la PR3 cleanup officielle est PR5, mais comme on doit modifier le seul consumer mobile dans Task 6, on peut supprimer le hook ici sans attendre).

**Step 1: Write the failing test**

```bash
# Smoke test : grep doit retourner 0 occurrence après refactor
grep -r "useTimeOfDay" mobile/src/ mobile/app/ 2>&1
# Attendu (après) : aucune occurrence
```

Et test Jest pour le wiring :

```tsx
// mobile/app/__tests__/_layout.smoke.test.tsx (NOUVEAU)
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);
jest.mock("expo-router", () => ({
  Slot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Stack: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSegments: () => [],
}));

// Import après les mocks
import RootLayout from "../_layout";

describe("RootLayout (mobile)", () => {
  it("renders without crashing (smoke test, ensures Provider wiring is OK)", () => {
    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
grep -r "useTimeOfDay" mobile/src/ mobile/app/  # Attendu : matchs présents AVANT
npm run test -- _layout.smoke
# Attendu : pourra passer ou échouer selon mocks ; le vrai test est typecheck après refactor
```

**Step 3: Write minimal implementation**

Modifier `mobile/app/_layout.tsx` :

1. Importer `AmbientLightingProvider`, `SunflowerLayer`, et utiliser le `useAuth` pour piocher la préférence.
2. Remplacer `<AmbientLightLayer intensity="normal" />` par un wrapper qui inclut Provider + AmbientLightLayer + SunflowerLayer.
3. Supprimer l'import de l'ancien composant si l'API a changé (rest gère ça via Task 6).

Pseudo-diff :

```tsx
// AVANT (lignes 23, 200) :
import { AmbientLightLayer } from "../src/components/backgrounds/AmbientLightLayer";
// ...
<AmbientLightLayer intensity="normal" />

// APRÈS :
import { AmbientLightingProvider } from "../src/contexts/AmbientLightingContext";
import { AmbientLightLayer } from "../src/components/backgrounds/AmbientLightLayer";
import { SunflowerLayer } from "../src/components/backgrounds/SunflowerLayer";

// Dans RootNavigator (après le Stack) :
const ambientEnabled =
  user?.preferences?.ambient_lighting_enabled !== false; // default true

// Wrap Stack + overlays dans Provider :
return (
  <AmbientLightingProvider enabled={ambientEnabled}>
    <View style={rootStyles.root}>
      <StatusBar style="light" backgroundColor={darkColors.bgPrimary} />
      <Stack screenOptions={{ ... }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="splash" />
      </Stack>
      <AmbientLightLayer intensity="normal" />
      <SunflowerLayer variant="mascot" />
    </View>
  </AmbientLightingProvider>
);
```

⚠️ **Note** : `useAuth()` est déjà appelé dans `RootNavigator`. Il faut étendre l'interface `User` (côté types) pour inclure `preferences?.ambient_lighting_enabled?: boolean`. Si le type n'a pas encore ce champ (PR1 pose le champ backend), ajouter le type côté mobile :

```ts
// mobile/src/types/user.ts (ou le fichier types existant)
export interface UserPreferences {
  ambient_lighting_enabled?: boolean;
  default_lang?: string;
  default_mode?: string;
  default_model?: string;
}
// User.preferences?: UserPreferences
```

Puis suppression du legacy :

```bash
rm mobile/src/hooks/useTimeOfDay.ts
# Vérifier qu'aucun import résiduel n'existe :
grep -r "useTimeOfDay" mobile/  # Doit ne rien retourner
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run typecheck   # Doit être vert
npm run test        # Tous les tests passent
grep -r "useTimeOfDay" mobile/src/ mobile/app/   # 0 occurrence
```

**Step 5: Commit**

```bash
git add mobile/app/_layout.tsx mobile/app/__tests__/_layout.smoke.test.tsx mobile/src/types/
git rm mobile/src/hooks/useTimeOfDay.ts
git commit -m "feat(mobile): wire AmbientLightingProvider + SunflowerLayer in root layout, drop useTimeOfDay legacy"
```

---

## Task 10 — Splash screen Expo avec PNG fallback du beam initial

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\mobile\app.json`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\assets\images\splash-ambient.png` (asset à committer)
- Référence : `C:\Users\33667\DeepSight-Main\mobile\src\assets\images\splash.png` (existant)

**Pourquoi :** spec §6.2 dit : "Pas de critical CSS (RN n'a pas de DOM) → on utilise le splash screen Expo pour afficher le beam initial dès le boot". L'idée : générer un PNG statique 1242×2688 (taille iPhone Pro Max) qui montre un beam doré 12h figé sur fond `#0a0a0f`, et l'utiliser comme `splash.image` dans `app.json`. Le PNG est régénéré offline (par PR1 ou ad-hoc via le script `gen-sunflower-frames.mjs`), commité.

**Step 1: Write the failing test**

```bash
# Test : le PNG existe et fait > 50KB (sinon c'est juste un placeholder vide)
test -s mobile/src/assets/images/splash-ambient.png
ls -la mobile/src/assets/images/splash-ambient.png
# Attendu : fichier présent, taille > 50000
```

Et un test JSON sur `app.json` :

```bash
# Le splash doit pointer vers splash-ambient.png
node -e "
const j = require('./mobile/app.json');
if (j.expo.splash.image !== './src/assets/images/splash-ambient.png') {
  console.error('FAIL: splash.image not updated');
  process.exit(1);
}
console.log('OK');
"
```

**Step 2: Run test to verify it fails**

Avant la PR : le PNG n'existe pas, donc `test -s` échoue.

**Step 3: Write minimal implementation**

1. Générer le PNG (option A : commande ad-hoc, option B : asset livré par PR1).

   Si PR1 livre le PNG dans `assets/ambient/splash-ambient.png` → copier dans mobile :

   ```bash
   cp DeepSight-Main/assets/ambient/splash-ambient.png mobile/src/assets/images/splash-ambient.png
   ```

   Sinon, ajouter une étape de génération minimale (PNG bouché au beam doré 12h via `sharp` Node.js) :

   ```bash
   # scripts/gen-splash-ambient.mjs (créé si pas livré par PR1)
   node scripts/gen-splash-ambient.mjs
   # Génère mobile/src/assets/images/splash-ambient.png
   ```

   Si on dépend de PR1 et ce n'est pas livré : créer un script local minimal :

   ```js
   // scripts/gen-splash-ambient.mjs
   import sharp from "sharp";
   import { getAmbientPreset } from "../packages/lighting-engine/src/index.ts";

   const W = 1242,
     H = 2688;
   const noon = new Date("2026-04-27T12:00:00");
   const preset = getAmbientPreset(noon, { intensityMul: 0.6 });

   const svg = `
     <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="100%" height="100%" fill="#0a0a0f"/>
       <defs>
         <linearGradient id="beam" x1="0.55" y1="0" x2="0.45" y2="1">
           <stop offset="0" stop-color="transparent"/>
           <stop offset="0.5" stop-color="${preset.beamColor}"/>
           <stop offset="1" stop-color="transparent"/>
         </linearGradient>
       </defs>
       <g transform="rotate(${preset.angle} ${W / 2} ${H / 2})">
         <rect x="0" y="${H * 0.32}" width="${W}" height="${H * 0.35}" fill="url(#beam)"/>
       </g>
     </svg>
   `;
   await sharp(Buffer.from(svg))
     .png()
     .toFile("mobile/src/assets/images/splash-ambient.png");
   ```

2. Modifier `mobile/app.json` :

   ```json
   "splash": {
     "image": "./src/assets/images/splash-ambient.png",
     "resizeMode": "cover",
     "backgroundColor": "#0a0a0f"
   },
   ```

   Et dans `plugins.expo-splash-screen` :

   ```json
   [
     "expo-splash-screen",
     {
       "image": "./src/assets/images/splash-ambient.png",
       "resizeMode": "cover",
       "backgroundColor": "#0a0a0f"
     }
   ]
   ```

**Step 4: Run test to verify it passes**

```bash
test -s mobile/src/assets/images/splash-ambient.png && echo OK
node -e "console.log(require('./mobile/app.json').expo.splash.image)"
# Attendu : ./src/assets/images/splash-ambient.png
cd mobile ; npx expo prebuild --clean   # facultatif, vérifier que le splash compile
```

**Step 5: Commit**

```bash
git add mobile/src/assets/images/splash-ambient.png mobile/app.json scripts/gen-splash-ambient.mjs
git commit -m "feat(mobile): use ambient beam PNG as splash screen for cold-start fidelity"
```

---

## Task 11 — Étendre `userApi.updatePreferences` pour `ambient_lighting_enabled`

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\mobile\src\services\api.ts` (autour ligne 414)
- Modifier : `C:\Users\33667\DeepSight-Main\mobile\src\types/` (le type `User` ou `UserPreferences`)

**Pourquoi :** PR1 a ajouté le champ backend `User.preferences.ambient_lighting_enabled`. Le mobile doit pouvoir le PUT via `/api/auth/preferences`. Le module `userApi.updatePreferences` actuel n'inclut pas ce champ.

**Step 1: Write the failing test**

```ts
// mobile/src/services/__tests__/userApi.preferences.test.ts
import { userApi } from "../api";
import type { User } from "../../types"; // ou wherever

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    id: 1,
    preferences: { ambient_lighting_enabled: false },
  }),
}) as unknown as typeof fetch;

describe("userApi.updatePreferences (ambient_lighting_enabled)", () => {
  it("accepts ambient_lighting_enabled and posts it correctly", async () => {
    await userApi.updatePreferences({ ambient_lighting_enabled: false });
    const call = (fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toMatch(/\/api\/auth\/preferences$/);
    expect(JSON.parse(call[1].body)).toEqual({
      ambient_lighting_enabled: false,
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- userApi.preferences
# Attendu : TypeScript error → "ambient_lighting_enabled is not assignable"
```

**Step 3: Write minimal implementation**

Modifier la signature de `userApi.updatePreferences` dans `mobile/src/services/api.ts` (ligne 414) :

```ts
async updatePreferences(preferences: {
  default_lang?: string;
  default_mode?: string;
  default_model?: string;
  ambient_lighting_enabled?: boolean;
}): Promise<User> {
  return request("/api/auth/preferences", {
    method: "PUT",
    body: preferences,
  });
},
```

Et étendre le type `User`/`UserPreferences` dans le fichier types correspondant.

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- userApi.preferences
npm run typecheck
```

**Step 5: Commit**

```bash
git add mobile/src/services/api.ts mobile/src/types/ mobile/src/services/__tests__/
git commit -m "feat(mobile): extend updatePreferences with ambient_lighting_enabled"
```

---

## Task 12 — Toggle "Effet ambiant lumineux" dans `PreferencesSection`

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\mobile\src\components\profile\PreferencesSection.tsx`
- Modifier : `C:\Users\33667\DeepSight-Main\mobile\src\i18n\fr.json`
- Modifier : `C:\Users\33667\DeepSight-Main\mobile\src\i18n\en.json`
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\components\profile\__tests__\PreferencesSection.test.tsx`

**Pourquoi :** spec §8 demande un toggle. Le composant existant gère déjà thème + langue. On ajoute une 3e ligne avec un `<Switch />` RN. Le state se propage au `useAuth` (`user.preferences.ambient_lighting_enabled`) via `userApi.updatePreferences` → refresh `user`.

**Step 1: Write the failing test**

```tsx
// mobile/src/components/profile/__tests__/PreferencesSection.test.tsx
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PreferencesSection } from "../PreferencesSection";

jest.mock("@/services/api", () => ({
  userApi: {
    updatePreferences: jest.fn().mockResolvedValue({
      id: 1,
      preferences: { ambient_lighting_enabled: false },
    }),
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, preferences: { ambient_lighting_enabled: true } },
    refreshUser: jest.fn(),
  }),
}));

describe("<PreferencesSection /> ambient toggle", () => {
  it("renders the ambient lighting toggle row", () => {
    const { getByTestId } = render(<PreferencesSection />);
    expect(getByTestId("toggle-ambient-lighting")).toBeTruthy();
  });

  it("flips the toggle and calls userApi.updatePreferences", async () => {
    const { getByTestId } = render(<PreferencesSection />);
    fireEvent(getByTestId("toggle-ambient-lighting"), "valueChange", false);

    await waitFor(() => {
      const { userApi } = require("@/services/api");
      expect(userApi.updatePreferences).toHaveBeenCalledWith({
        ambient_lighting_enabled: false,
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- PreferencesSection
```

**Step 3: Write minimal implementation**

Patch dans `PreferencesSection.tsx` :

1. Importer `Switch` de `react-native`, `useAuth`, `userApi`.
2. Ajouter une ligne (à placer après la ligne langue) :

   ```tsx
   import { Switch } from "react-native";
   import { useAuth } from "@/contexts/AuthContext";
   import { userApi } from "@/services/api";
   import { useTranslation } from "@/i18n"; // si présent — sinon strings inline

   const { user, refreshUser } = useAuth();
   const ambientEnabled = user?.preferences?.ambient_lighting_enabled !== false;
   const [pendingAmbient, setPendingAmbient] = useState(false);

   const handleAmbientToggle = async (next: boolean) => {
     setPendingAmbient(true);
     try {
       await userApi.updatePreferences({ ambient_lighting_enabled: next });
       await refreshUser?.();
     } finally {
       setPendingAmbient(false);
     }
   };

   // Dans le JSX, après les renderRow existants :
   <View style={[styles.row, { borderBottomColor: colors.border }]}>
     <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
       Effet ambiant lumineux
     </Text>
     <Switch
       testID="toggle-ambient-lighting"
       value={ambientEnabled}
       onValueChange={handleAmbientToggle}
       disabled={pendingAmbient}
     />
   </View>;
   ```

3. Strings i18n :

   ```json
   // mobile/src/i18n/fr.json (ajouter sous profile.preferences)
   {
     "profile": {
       "preferences": {
         "ambient_lighting": "Effet ambiant lumineux",
         "ambient_lighting_desc": "Affiche un rayon de lumière subtil et un tournesol qui suit la course du soleil"
       }
     }
   }

   // mobile/src/i18n/en.json
   {
     "profile": {
       "preferences": {
         "ambient_lighting": "Ambient lighting effect",
         "ambient_lighting_desc": "Shows a subtle light beam and a sunflower that follows the sun"
       }
     }
   }
   ```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- PreferencesSection
npm run typecheck
```

**Step 5: Commit**

```bash
git add mobile/src/components/profile/PreferencesSection.tsx mobile/src/i18n/fr.json mobile/src/i18n/en.json mobile/src/components/profile/__tests__/PreferencesSection.test.tsx
git commit -m "feat(mobile): add ambient-lighting toggle in profile preferences"
```

---

## Task 13 — Maestro snapshot test (4 horaires)

**Files:**

- Créer : `C:\Users\33667\DeepSight-Main\mobile\.maestro\ambient-lighting.yaml`

**Pourquoi :** Maestro est l'outil de visual regression mobile (cf. spec §9). On capture 4 screenshots à 06:00, 12:00, 18:00, 22:00 via une dev-flag `EXPO_PUBLIC_FORCE_AMBIENT_TIME`.

**Step 1: Write the failing test**

```yaml
# mobile/.maestro/ambient-lighting.yaml
appId: com.deepsight.app
---
- launchApp:
    arguments:
      EXPO_PUBLIC_FORCE_AMBIENT_TIME: "06:00"
- waitForAnimationToEnd:
    timeout: 5000
- takeScreenshot: ambient-06h00

- launchApp:
    arguments:
      EXPO_PUBLIC_FORCE_AMBIENT_TIME: "12:00"
- waitForAnimationToEnd:
    timeout: 5000
- takeScreenshot: ambient-12h00

- launchApp:
    arguments:
      EXPO_PUBLIC_FORCE_AMBIENT_TIME: "18:00"
- waitForAnimationToEnd:
    timeout: 5000
- takeScreenshot: ambient-18h00

- launchApp:
    arguments:
      EXPO_PUBLIC_FORCE_AMBIENT_TIME: "22:00"
- waitForAnimationToEnd:
    timeout: 5000
- takeScreenshot: ambient-22h00
```

**Step 2: Run test to verify it fails**

```bash
maestro test mobile/.maestro/ambient-lighting.yaml
# Attendu : si l'app ne lit pas la flag → échoue (screenshots tous identiques)
```

**Step 3: Write minimal implementation**

Modifier `useAmbientPreset.ts` pour lire la flag dev :

```ts
import Constants from "expo-constants";

// Au début de useAmbientPreset, après opts :
const forceTimeStr =
  process.env.EXPO_PUBLIC_FORCE_AMBIENT_TIME ??
  Constants.expoConfig?.extra?.forceAmbientTime;

const forcedDate = forceTimeStr ? parseHHMM(forceTimeStr) : undefined;
optsRef.current = { ...opts, intensityMul, forceTime: forcedDate };

function parseHHMM(s: string): Date | undefined {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return undefined;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}
```

(`PresetOptions.forceTime` est exposé par PR1 — cf. spec §4.)

**Step 4: Run test to verify it passes**

```bash
EXPO_PUBLIC_FORCE_AMBIENT_TIME=12:00 npx expo start
# Visuellement vérifier le beam noon
maestro test mobile/.maestro/ambient-lighting.yaml
# 4 screenshots distincts générés dans .maestro/screenshots/
```

**Step 5: Commit**

```bash
git add mobile/.maestro/ambient-lighting.yaml mobile/src/hooks/useAmbientPreset.ts
git commit -m "test(mobile): add Maestro snapshots at 4 ambient time windows + dev forceTime flag"
```

---

## Task 14 — Audit visual a11y (`prefers-reduced-motion` + `prefers-contrast`)

**Files:**

- Modifier : `C:\Users\33667\DeepSight-Main\mobile\src\hooks\useAmbientPreset.ts` (compléter si manquant)
- Créer : `C:\Users\33667\DeepSight-Main\mobile\src\hooks\__tests__\useAmbientPreset.a11y.test.ts`

**Pourquoi :** spec §9 exige :

- `prefers-reduced-motion: reduce` → angle/couleur figés, pas de cross-fade. **Le hook engine v3 le fait déjà** mais on garantit le pass-through.
- `prefers-contrast: more` → cap intensity à 30% max. RN expose `AccessibilityInfo.isHighContrastEnabled()` (Android API 26+, iOS 13+).

**Step 1: Write the failing test**

```ts
// mobile/src/hooks/__tests__/useAmbientPreset.a11y.test.ts
import { renderHook, act } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { useAmbientPreset } from "../useAmbientPreset";

describe("useAmbientPreset a11y", () => {
  it("flags isReducedMotion when AccessibilityInfo says yes", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValueOnce(true);
    const { result } = renderHook(() => useAmbientPreset());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.prefersReducedMotion).toBe(true);
  });

  it("caps intensity in high-contrast mode (preset.intensity <= 0.3)", async () => {
    // Si AccessibilityInfo expose isHighContrastEnabled :
    const spy = (
      AccessibilityInfo as unknown as {
        isHighContrastEnabled?: jest.Mock;
      }
    ).isHighContrastEnabled;
    if (!spy) {
      // Fallback : skip si l'API n'est pas dispo (Expo Go peut ne pas l'exposer)
      return;
    }
    spy.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useAmbientPreset());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.preset.intensity).toBeLessThanOrEqual(0.3);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd mobile
npm run test -- useAmbientPreset.a11y
```

**Step 3: Write minimal implementation**

Le pass-through de `prefersReducedMotion` est déjà OK (Task 4). Pour `isHighContrast`, ajouter un effet :

```ts
const [isHighContrast, setIsHighContrast] = useState(false);
useEffect(() => {
  const api = AccessibilityInfo as unknown as {
    isHighContrastEnabled?: () => Promise<boolean>;
  };
  if (typeof api.isHighContrastEnabled === "function") {
    api
      .isHighContrastEnabled()
      .then(setIsHighContrast)
      .catch(() => {});
  }
}, []);

// Dans le calcul de optsRef.current, override intensityMul si high-contrast :
const finalIntensityMul = isHighContrast
  ? Math.min(intensityMul, 0.3)
  : intensityMul;
optsRef.current = {
  ...opts,
  intensityMul: finalIntensityMul,
  forceTime: forcedDate,
};
```

**Step 4: Run test to verify it passes**

```bash
cd mobile
npm run test -- useAmbientPreset.a11y
```

**Step 5: Commit**

```bash
git add mobile/src/hooks/useAmbientPreset.ts mobile/src/hooks/__tests__/useAmbientPreset.a11y.test.ts
git commit -m "feat(mobile): cap intensity in high-contrast mode + verify reduced-motion pass-through"
```

---

## Task 15 — Vérifier que les tokens v3 (PR1) sont consommés par les composants

**Files:**

- Vérifier : `C:\Users\33667\DeepSight-Main\mobile\src\theme\colors.ts`
- Auditer : composants qui utilisent `textSecondary`, `textTertiary`, `textMuted`

**Pourquoi :** spec §7 demande que les tokens shift par PR1 (vers blanc cassé) soient effectivement utilisés. Certains composants peuvent encore hardcoder `#94a3b8` (ancien `text-secondary`) ou similaire.

**Step 1: Write the failing test**

```bash
# Audit grep sur les hex problématiques dans mobile/src/
grep -rE "#94a3b8|#64748b|#475569" mobile/src/ mobile/app/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v __tests__
# Attendu : 0 occurrence (à la sortie de PR3)
```

**Step 2: Run test to verify it fails**

Run le grep : si > 0 occurrence, lister les fichiers à patcher.

**Step 3: Write minimal implementation**

Pour chaque fichier listé, remplacer le hex par le token correspondant via `useTheme().colors.*` :

| Hex       | Token theme                              |
| --------- | ---------------------------------------- |
| `#94a3b8` | `colors.textSecondary` (slate-100 v3)    |
| `#64748b` | `colors.textTertiary` (slate-200 v3)     |
| `#475569` | `rgba(255,255,255,0.45)` (text-disabled) |

**Step 4: Run test to verify it passes**

```bash
grep -rE "#94a3b8|#64748b|#475569" mobile/src/ mobile/app/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v __tests__
# Attendu : 0 occurrence
npm run typecheck
npm run test
```

**Step 5: Commit**

```bash
git add mobile/src/
git commit -m "refactor(mobile): replace remaining hardcoded slate hex with v3 theme tokens"
```

(Si grep initial = 0, **skip ce commit** — le travail de PR1 a déjà tout shift.)

---

## Task 16 — Smoke run iOS + Android (manuel, à logguer)

**Files:** aucun changement code — c'est un check de validation.

**Pourquoi :** Jest ne couvre pas le rendu natif. Avant merge, lancer un dev build sur un simulateur iOS et un émulateur Android pour confirmer que :

1. Metro bundle sans erreur
2. Le beam s'affiche
3. Le tournesol mascot apparaît bottom-right
4. La transition jour/nuit fonctionne (forcer via `EXPO_PUBLIC_FORCE_AMBIENT_TIME`)
5. Le toggle profile désactive bien les overlays

**Step 1: Write the failing test**

Liste de checks (à cocher manuellement) dans la PR description :

- [ ] iOS : `EXPO_PUBLIC_FORCE_AMBIENT_TIME=06:00 npx expo start --ios` → beam doré rosé visible
- [ ] iOS : `=12:00` → beam blanc-or zénith
- [ ] iOS : `=18:00` → beam orange couchant
- [ ] iOS : `=22:00` → beam bleu-argent + tournesol luminescent
- [ ] Android : mêmes 4 checks via `npx expo start --android`
- [ ] Toggle profile OFF → overlays disparaissent (les 2 plateformes)
- [ ] Toggle profile ON → overlays réapparaissent
- [ ] AppState : home button → preset ne recompute pas (logger via `console.log` temp)
- [ ] AppState : retour foreground → recompute immédiat
- [ ] Pas de warning Reanimated dans Metro logs

**Step 2: Run test to verify it fails**

Avant les Tasks 1-15 : tout casserait. Après : tout doit cocher.

**Step 3: Write minimal implementation**

Si un check échoue, fix le bug et incrémenter le commit du Task concerné.

**Step 4: Run test to verify it passes**

Re-run les 10 checks après correction.

**Step 5: Commit**

Pas de commit dédié — c'est un gate de PR.

---

## Task 17 — Mise à jour CHANGELOG.md (optionnel si projet en a un)

**Files:**

- Modifier (si présent) : `C:\Users\33667\DeepSight-Main\CHANGELOG.md`

**Pourquoi :** documenter le changement utilisateur (toggle profile, nouvelle palette).

**Step 1: Write the failing test**

```bash
test -f C:/Users/33667/DeepSight-Main/CHANGELOG.md && echo "exists"
# Si pas de CHANGELOG → skip task
```

**Step 2: Run test to verify it fails**

n/a si le fichier n'existe pas.

**Step 3: Write minimal implementation**

Ajouter une entrée :

```markdown
## [Unreleased]

### Added

- Mobile : nouvelle couche d'éclairage ambiant v3 (rayon + halo + tournesol mascot bottom-right)
- Mobile : toggle "Effet ambiant lumineux" dans Profile > Préférences

### Changed

- Mobile : Metro résout maintenant le package workspace `@deepsight/lighting-engine`
- Mobile : splash screen utilise un PNG fallback du beam initial

### Removed

- Mobile : hook legacy `useTimeOfDay` (remplacé par `useAmbientPreset`)
```

**Step 4: Run test to verify it passes**

n/a — c'est de la doc.

**Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for mobile ambient-lighting v3"
```

---

## Task 18 — Self-review final & push de la PR

**Files:** aucun.

**Pourquoi :** dernière passe avant merge.

**Step 1: Self-review checklist**

- [ ] **Coverage spec** :
  - §6.2 : composants AmbientLightLayer + SunflowerLayer mascot rewrite ✅ Tasks 6, 8
  - §7 : tokens shift v3 utilisés ✅ Task 15
  - §8 : toggle profile branché sur backend ✅ Tasks 11, 12
  - §9 : prefers-reduced-motion + prefers-contrast ✅ Tasks 4, 14
  - §6.2 mobile-spécifique : splash PNG fallback ✅ Task 10, AppState pause ✅ Task 4
- [ ] **Placeholder scan** : `grep -r "TODO\|FIXME\|TBD\|implement later" mobile/src/components/backgrounds mobile/src/contexts/AmbientLightingContext.tsx mobile/src/hooks/useAmbientPreset.ts` → 0 occurrence
- [ ] **Type consistency** : `npm run typecheck` vert (0 nouvelle erreur ; les 19 erreurs pré-existantes du refonte mobile sont admises)
- [ ] **Tests** : `npm run test` vert ; nouvelles suites (lighting-engine-smoke, useAmbientPreset, AmbientLightingContext, AmbientLightLayer, SunflowerLayer, spritePosition, PreferencesSection, useAmbientPreset.a11y) toutes vertes
- [ ] **Metro fix** : Task 1 commitée en première position, sinon le reste casse
- [ ] **Coordination** : la PR description mentionne explicitement la dépendance à PR1 mergée
- [ ] **iOS + Android smoke** : Task 16 cochée (logs joints à la PR)
- [ ] **Bundle budget** : `npx expo export --platform ios` montre que la PR ajoute < 200KB (sprite + JS bundle delta)

**Step 2-4:** n/a (méta-task).

**Step 5: Push & ouvrir la PR**

```bash
git push -u origin feat/ambient-lighting-v3-mobile
gh pr create --base main --head feat/ambient-lighting-v3-mobile \
  --title "feat(mobile): ambient lighting v3 — beam + halo + sunflower mascot" \
  --body "$(cat <<'EOF'
## Summary
- Réécrit AmbientLightLayer (beam + halo, plus de disque solaire) en consommant `@deepsight/lighting-engine` v3
- Ajoute SunflowerLayer mascot (bottom-right) avec cross-fade jour↔nuit du sprite WebP
- Configure Metro pour résoudre le workspace package (Task 1 = critique)
- Branche un toggle "Effet ambiant lumineux" dans Profile > Préférences
- Splash screen Expo utilise un PNG du beam initial pour le cold start

## Coordination
- ⚠️ Dépend de PR1 (`feat/lighting-engine-v3-foundation`) **mergée**
- Indépendant de PR2 (web) et PR4 (extension), parallélisable

## Test plan
- [ ] CI : `npm run test` (mobile) vert — nouvelles suites Reanimated mockées
- [ ] CI : `npm run typecheck` vert
- [ ] Smoke iOS : `EXPO_PUBLIC_FORCE_AMBIENT_TIME=12:00 npx expo start --ios` → beam blanc-or 12h
- [ ] Smoke Android : idem
- [ ] Maestro : 4 snapshots cohérents à 06h/12h/18h/22h
- [ ] Toggle profile OFF → overlays disparaissent
- [ ] AppState background → recompute pause

EOF
)"
```

---

## Definition of Done

| Critère                                                 | Validation                                 |
| ------------------------------------------------------- | ------------------------------------------ |
| `npm run test` vert (mobile)                            | CI                                         |
| `npm run typecheck` vert (0 nouvelle erreur)            | CI                                         |
| `npx expo start --clear` démarre sans erreur résolution | Local                                      |
| `npx expo export --platform ios` build sans erreur      | Local                                      |
| Maestro 4 snapshots distincts                           | Local + CI si configuré                    |
| Smoke run iOS + Android                                 | Manuel (Task 16)                           |
| `useTimeOfDay` supprimé, 0 import résiduel              | `grep -r useTimeOfDay mobile/`             |
| Toggle profile fonctionnel                              | Manuel + test Jest                         |
| Bundle delta < 200KB                                    | `npx expo export --platform ios` size diff |

---

## Risks & Mitigations (PR3-spécifiques)

| Risque                                                              | Mitigation                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Metro ne résout pas le package même après config                    | `disableHierarchicalLookup: true` + `extraNodeModules` pointant directement sur le dossier (pas vers `dist/` qui n'existe pas) |
| Jest ne résout pas le package (différent de Metro)                  | Ajouter `moduleNameMapper` dans `jest.config.js` (Task 3)                                                                      |
| `expo-image` ne supporte pas `transform: scale` au-dessus du sprite | Backup : utiliser `<Image>` natif RN si `expo-image` clipping pose problème — testé en Task 8                                  |
| Sprite trop gros (300KB) → bundle dépasse budget                    | Vérifier que les WebP sont bien à ~75KB chacun (PR1 contract). Si > 100KB, demander à PR1 de re-encoder qualité 80             |
| AppState listener pas fiable sur Android                            | Test Maestro vérifie comportement. Fallback : ne pas pause sur Android si timer ne crash pas                                   |
| Reanimated 4 mock incompatibles avec setInterval Jest               | `jest.useFakeTimers()` dans les tests + `react-native-reanimated/mock` (déjà testé dans le repo)                               |
| `useTimeOfDay` encore importé par un fichier oublié                 | Grep en Task 9 + CI run complet avant merge                                                                                    |
| Toggle backend/mobile désynchronisés (race condition)               | Refresh `user` après PUT preferences (Task 12)                                                                                 |
| Tournesol mascot couvert par un FAB ou modal                        | zIndex 2 pour SunflowerLayer, zIndex 1 pour AmbientLightLayer, contenu app à zIndex 10+ (par défaut RN)                        |
| Tab bar collapse ne réajuste pas la position du mascot              | bottom: 88 fixe pour MVP. Future amélioration : `useBottomTabBarHeight()` (cf. spec §6.2). Hors scope PR3                      |

---

## Hors scope explicitement (renvoyés à PR5 cleanup ou future PR)

- Refactor complet du theme system mobile vers `design-tokens.css`
- Tournesol interactif (cliquable / easter eggs)
- Customization avancée (intensité, palette) côté user
- Variants `mascot` autres que default (par exemple `mascot-pulse` au tap)
- BottomTabBar dynamic height awareness pour SunflowerLayer
- Audit textes complet hors `text-secondary/muted/disabled` (audit ciblé seulement)
