# @deepsight/lighting-engine

Moteur d'éclairage ambiant temporel pour DeepSight (web + mobile + extension).

## Concept

48 keyframes de mood lumineux espacées de 30 minutes sur 24h. À tout instant, on prend les deux keyframes encadrantes et on interpole linéairement (couleurs RGB, opacités, positions, angles).

- **Jour** (06:00-18:00) : sun-beam doré chaud, halo solaire
- **Nuit** (22:00-04:00) : moon-beam argenté froid, lune visible
- **Crépuscule** (04:00-06:00 et 18:00-22:00) : cross-fade sun ↔ moon

Variation jour-à-jour seedée par date : l'angle du beam principal varie de ± 15° d'un jour à l'autre (mulberry32, déterministe).

## API

```ts
import { getAmbientPreset } from "@deepsight/lighting-engine";

const preset = getAmbientPreset(new Date());
// preset.beam.type === 'sun' | 'moon' | 'twilight'
// preset.beam.color === [r, g, b]
// preset.beam.angleDeg, preset.beam.opacity
// preset.moon.visible, preset.moon.opacity, preset.moon.x, preset.moon.y
// preset.sun.visible, preset.sun.opacity, preset.sun.x, preset.sun.y
// preset.ambient.primary | secondary | tertiary
// preset.colors.primary | secondary | tertiary | rays | accent
// preset.haloX, preset.haloY
// preset.starOpacityMul, preset.starDensity
// preset.mood ('Magic hour', 'Hypnagogique'...)
```

### Options

```ts
getAmbientPreset(date, {
  intensityMul: 0.5, // multiplicateur global (mobile typique)
  disableDailyVariation: true, // désactive la variation seedée
  skipCssStrings: true, // pas de helpers CSS (mobile RN)
  seedOverride: 12345, // forcer un seed (tests)
});
```

## Tests

```bash
npm install
npm test  # 55 tests
```

## Intégration

- **Web** : `frontend/src/hooks/useAmbientPreset.ts` + `<AmbientLightLayer />`
- **Mobile** : `mobile/src/hooks/useAmbientPreset.ts` + `<AmbientLightLayer />` (light)
- **Extension** : `extension/src/popup/components/AmbientLightLayer.tsx`

Voir `docs/PRD-ambient-lighting-v2.md` pour le PRD complet.
