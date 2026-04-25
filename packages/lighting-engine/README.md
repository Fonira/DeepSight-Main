# @deepsight/lighting-engine

Moteur d'éclairage ambient **partagé** pour DeepSight Web, Mobile, et Extension.

> 🎨 48 keyframes/24h, interpolation continue, sun-beam ↔ moon-beam, variation seedée jour-à-jour.

---

## Quick Start

### Côté web (frontend/) ou mobile/

```bash
# Depuis frontend/, mobile/, ou extension/
npm install file:../packages/lighting-engine
```

```typescript
import { getAmbientPreset } from "@deepsight/lighting-engine";

const preset = getAmbientPreset(new Date());

// Web : utilise directement les CSS strings
<div style={{
  background: preset.ambient.cssGradient,
  opacity: preset.centralBeam.opacity,
}}>

// Mobile (RN) : recompose avec rgb tuple
backgroundColor: `rgba(${preset.ambient.primary.join(",")}, ${preset.ambient.primaryOpacity})`
```

---

## API publique

### `getAmbientPreset(date?, options?) → AmbientPreset`

Cœur du moteur. Calcule le mood d'éclairage pour un instant donné.

| Param                           | Type      | Default      | Description                               |
| ------------------------------- | --------- | ------------ | ----------------------------------------- |
| `date`                          | `Date`    | `new Date()` | Instant cible                             |
| `options.intensityMul`          | `number`  | `1`          | Multiplicateur global (0..1.5 recommandé) |
| `options.seedOverride`          | `number`  | auto         | Force le seed (testing)                   |
| `options.disableDailyVariation` | `boolean` | `false`      | Désactive la variation jour-à-jour        |
| `options.skipCssStrings`        | `boolean` | `false`      | Skip le calcul des CSS strings (perf)     |

**Retourne `AmbientPreset`** : structure complète avec couleurs, opacités, angles, positions soleil/lune, débogage.

### Autres helpers exposés

| Symbole                                          | Rôle                                          |
| ------------------------------------------------ | --------------------------------------------- |
| `KEYFRAMES`                                      | Tableau des 48 keyframes (readonly)           |
| `findKeyframePair(hour)`                         | Retourne les 2 keyframes encadrantes + factor |
| `seedFromDate(date)`                             | Calcule le seed (jour-de-l'année + année)     |
| `mulberry32(seed)`                               | PRNG déterministe                             |
| `PALETTES`                                       | Palette nommée des couleurs                   |
| `validateKeyframes()`                            | Sanity check au boot                          |
| `computeMoonPosition(hour)`                      | Trajectoire lune (cosine arc)                 |
| `computeSunPosition(hour)`                       | Trajectoire soleil                            |
| `computeBeamBlend(hour)`                         | Cross-fade sun/moon en twilight               |
| `rgbToCss`, `lerpColor`, `lerpAngle`, `shiftHue` | Utilitaires couleur                           |

---

## Architecture

```
src/
├── types.ts             # Interfaces (Keyframe, AmbientPreset, RGB, ...)
├── tokens.ts            # PALETTES, EASINGS, ENGINE_CONFIG, DAILY_VARIATION
├── keyframes.ts         # Les 48 keyframes (00:00 → 23:30, toutes les 30min)
├── interpolate.ts       # lerp, lerpColor, lerpAngle, easings, HSL helpers
├── seeded-random.ts     # mulberry32 PRNG + seedFromDate
├── angle-variation.ts   # Variation seedée d'angle (organique sinusoïdale)
├── moon-trajectory.ts   # Position lune/soleil + cross-fade twilight
└── index.ts             # Public API (getAmbientPreset)
```

---

## Comportement

### Découpage temporel

| Plage         | Type beam  | # keyframes | Mood phares                                     |
| ------------- | ---------- | ----------- | ----------------------------------------------- |
| 00:00 → 04:30 | `moon`     | 10          | Minuit profond, Lune haute, Heure du loup       |
| 05:00 → 06:30 | `twilight` | 4           | Premier souffle, Aube naissante, Premier rayon  |
| 07:00 → 11:30 | `sun`      | 10          | Lever doux, Matin clair, Café du matin          |
| 12:00 → 16:30 | `sun`      | 10          | Zénith, Pause déjeuner, Goûter d'or             |
| 17:00 → 18:30 | `twilight` | 4           | Magic hour, Crépuscule chaud, Coucher de soleil |
| 19:00 → 23:30 | `moon`     | 10          | Soir indigo, Lune levante, Hypnagogique         |

**Total : 48 keyframes**, interpolation linéaire avec easing entre chaque paire.

### Cross-fade sun ↔ moon

Pendant les transitions twilight (5h-7h et 17h-19h), les deux astres sont co-visibles avec opacités complémentaires (sin/cos sur la durée). Voir `computeBeamBlend()`.

### Variation jour-à-jour

Le seed est calculé via `seedFromDate(date) = (jourDeLAnnée × 1009) ^ (année × 31) ^ 0xc0ffee`.

Variations seedées :

- **Angle base** : ± 15° via somme de 4 sinusoïdes seedées (mouvement organique)
- **Position X moon/sun** : ± 5% / ± 8%
- **Star density** : multiplicateur 0.7..1.3
- **Hue shift** : ± 3° HSL (très subtil)

→ 2 jours consécutifs n'ont jamais le même rendu à la même heure, mais reload = identique (déterministe).

---

## Performance

- `getAmbientPreset()` cible : **< 0.2 ms p99** sur device moderne.
- Recompute recommandé : **toutes les 60 s** côté UI.
- Si tu n'as pas besoin des CSS strings (mobile RN), passe `skipCssStrings: true` → -30% temps.

Mesure runtime : `preset._debug.computeTimeMs`.

---

## Tests

```bash
cd packages/lighting-engine
npm install
npm test
```

Couverture cible : > 90%.

---

## Modifier l'identité visuelle

**Pour ajuster une couleur globale** : modifier `tokens.ts > PALETTES`. Impacte plusieurs keyframes.

**Pour ajuster un mood spécifique** : modifier `keyframes.ts > KEYFRAMES[index]`. Impact local.

**Pour ajouter/retirer des keyframes** : ⚠️ ne pas changer le count = 48 ; sinon `validateKeyframes()` throw. Si vraiment besoin, modifier `ENGINE_CONFIG.KEYFRAME_COUNT` + régénérer le mapping.

---

## Roadmap

- [x] **v2.0** — Moteur core (ce package), 48 keyframes, interpolation continue, variation seedée
- [ ] **v2.1** — Migration `frontend/` (remplace `useTimeOfDay.ts` + `AmbientLightLayer.tsx`)
- [ ] **v2.2** — Implémentation mobile (`mobile/src/components/AmbientLightLayer.tsx` from scratch)
- [ ] **v2.3** — Implémentation extension popup
- [ ] **v3.0** — Mode Saisons (palettes hiver/printemps/été/automne)
- [ ] **v3.1** — Sync géolocalisation (lever/coucher selon latitude, opt-in)

---

## Contributing

Avant de commit, run :

```bash
npm run typecheck
npm test
```

Voir `docs/PRD-ambient-lighting-v2.md` pour la spec complète.
