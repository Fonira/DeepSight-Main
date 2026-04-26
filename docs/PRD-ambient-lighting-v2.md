# PRD — Ambient Lighting v2 (DeepSight)

**Version** : 2.0
**Date** : 2026-04-26
**Owner** : Frontend / Cross-platform
**Status** : Implemented

---

## 1. Problem statement

L'éclairage ambient v1 (web) utilise 6 phases discrètes (dawn / morning / noon / dusk / evening / night) avec des transitions de 2s entre phases. Limitations majeures :

- **Variations trop grossières** : 6 paliers / 24h. Tout l'après-midi ressemble à toute la matinée.
- **Pas de variation jour-à-jour** : la même lumière à 14h tous les jours.
- **Pas de "moon-beam"** : la nuit, le rayon central reste doré comme le jour, ce qui casse l'immersion (la lune blanche du fond ne dialogue pas avec le rayon).
- **Pas d'angle dynamique** : tous les jours le rayon est au même angle.
- **Web only** : mobile et extension ont leurs propres implémentations bricolées.

## 2. Goals

1. **48 keyframes** (toutes les 30 minutes) avec moods nommés et identité visuelle marquée.
2. **Sun-beam le jour ↔ moon-beam la nuit**, avec cross-fade twilight aux 2 crépuscules.
3. **Variation seedée jour-à-jour** : angle du beam ± 15°, déterministe par date.
4. **Engine partagé cross-plateforme** : web + mobile + extension consomment la même source de vérité.
5. **Performance** : < 1ms par appel (rendering 60fps tenable).
6. **Accessibility** : respect prefers-reduced-motion / AccessibilityInfo.isReduceMotionEnabled.

## 3. Non-goals

- WebGL / Canvas particles
- Effets météo (pluie, neige) — phase ultérieure éventuelle
- Persistence par utilisateur (toujours basé sur l'heure locale du device)
- Customisation par utilisateur (préset fixé par l'heure)

## 4. User stories

| Persona                 | Story                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Étudiante du soir (22h) | "Quand j'ouvre DeepSight la nuit, l'app a l'air calme et bleue, pas agressive comme la version jour"    |
| Pro qui bosse 12h-14h   | "Il y a une vraie différence entre 'midi pile' et '14h après le déjeuner'"                              |
| Power user quotidien    | "Chaque jour la lumière a un angle légèrement différent — je remarque quand je passe sur l'app, ça vit" |
| Designer interne        | "Je peux scrubber les 24h dans une dev panel pour valider les transitions"                              |

## 5. Functional requirements

### 5.1 Engine (`@deepsight/lighting-engine`)

- 48 keyframes ordonnés par hour (0, 0.5, 1, ..., 23.5)
- Chaque keyframe : mood, beamType, beamColor (RGB), beamAngleDeg, beamOpacity, sun + moon visibility/opacity/position, ambient gradients, stars, halo center, color palette
- API principale : `getAmbientPreset(date: Date, opts?: PresetOptions): AmbientPreset`
- Interpolation linéaire entre les 2 keyframes encadrants (factor = position dans le slot)
- Variation angle daily seedée par `seedFromDate(date)` + mulberry32 + lissage entre slots adjacents

### 5.2 Web (`frontend/src/components/AmbientLightLayer.tsx`)

- Re-render via `useAmbientPreset()` hook (refresh 30s)
- 5-6 calques DOM avec `mix-blend-mode: screen`
- CSS transitions 1.5s cubic-bezier(0.4, 0, 0.2, 1)
- Feature flag PostHog `ambient_lighting_v2` pour rollout progressif

### 5.3 Mobile (`mobile/src/components/backgrounds/AmbientLightLayer.tsx`)

- **Version LIGHT** différente de la web : préserver fond noir + doodles bien visibles
- Lune blanche pure `#ffffff` (pas l'argenté froid de l'engine)
- Soleil discret 60×60px
- Beam capé à opacité 0.18 max
- intensityMul par défaut 0.5 (soft)
- Reanimated 4 transitions UI thread

### 5.4 Extension (popup + viewer)

- Popup : version mini (40×32 sun/moon, beam capé 0.22)
- Viewer : version proche web (84×72 sun/moon)
- Pas de PostHog (pas dans le bundle extension)

### 5.5 Dev tooling

- `AmbientLightDevPanel.tsx` : scrubber 24h + dayOffset + intensity + disable variation
- Affiche debug info (mood, beam angle, sun/moon position, factor, seed)

## 6. Non-functional requirements

| Catégorie      | Requirement                                                       |
| -------------- | ----------------------------------------------------------------- |
| Performance    | < 1ms par appel `getAmbientPreset`                                |
| Bundle size    | Engine < 5KB gzipped (objectif)                                   |
| Accessibility  | Respect prefers-reduced-motion (web) + AccessibilityInfo (mobile) |
| Tests          | ≥ 50 tests unitaires sur engine, 100% green                       |
| Cross-platform | Sortie identique sur web/mobile/extension pour même Date          |
| Determinism    | Même date = même preset, dates différentes = angles différents    |

## 7. Acceptance criteria

- [x] Engine 48 keyframes
- [x] 55 tests unitaires green
- [x] Web AmbientLightLayer v2 consomme l'engine
- [x] Mobile light component avec lune blanche et fond préservé
- [x] Extension popup + viewer
- [x] Dev panel de QA
- [x] Doc d'intégration
- [x] CHANGELOG entry

## 8. Success metrics

- Bug rate < 1 / mois sur AmbientLightLayer après rollout
- 0 régression de perf (Lighthouse perf score stable)
- Feature flag rollout : 10% → 50% → 100% sur 2 semaines
- 0 plainte d'accessibilité (motion-sickness)

## 9. Timeline

| Phase | Date            | Livrable                                               |
| ----- | --------------- | ------------------------------------------------------ |
| 1     | J0 (2026-04-26) | Engine package + 55 tests + intégrations 3 plateformes |
| 2     | J+3             | Rollout PostHog 10% web                                |
| 3     | J+7             | Rollout 50% web + déploiement mobile EAS update        |
| 4     | J+14            | Rollout 100% + soumission extension Chrome Web Store   |

## 10. Risks

| Risk                            | Mitigation                                                        |
| ------------------------------- | ----------------------------------------------------------------- |
| Engine bundle trop gros         | Mesure post-build, tree-shaking si > 8KB                          |
| Reanimated v4 instabilité       | Fallback CSS transitions si crash                                 |
| Doodles masqués sur mobile      | Cap opacité beam à 0.18 + intensityMul 0.5 par défaut             |
| Variation jour-à-jour invisible | ± 15° angle, mais aussi mood/couleurs varient → cumul perceptible |
