# PRD — Ambient Lighting v3 (DeepSight)

**Version** : 3.0
**Date** : 2026-04-26
**Owner** : Frontend / Cross-platform
**Status** : Implemented v3 (PRs #139 #140 #144 #145)

---

## 1. Problem statement

L'éclairage ambient v2 améliorait nettement la v1 (48 keyframes vs 6 phases) mais souffrait encore de plusieurs défauts :

- **Beam imprécis** : interpolation linéaire entre keyframes — l'arc solaire restait grossier.
- **Pas de mascotte ambient** : la fenêtre vide manquait d'identité visuelle (contrairement aux briefs Figma qui prévoyaient un tournesol héliotrope).
- **Pas de hint visuel avant hydratation** : sur web, le rayon n'apparaissait qu'après chargement de React → flash visuel à l'ouverture.
- **Texte parfois illisible** sur les fonds clairs des palettes day → contraste insuffisant.
- **Aucune préférence utilisateur** : impossible de désactiver le rayon sans toucher au système OS (`prefers-reduced-motion`).
- **Trois implémentations divergentes** : web/mobile/extension partageaient un engine commun mais chaque plateforme avait ses propres calques DOM/Reanimated, rendant les évolutions coûteuses.

## 2. Goals

1. **Beam de précision** suivant l'arc solaire avec interpolation cubic-bezier (vs linéaire v2).
2. **Tournesol 3D photoréaliste** héliotrope (suit le rayon le jour, luminescent la nuit) en sprite WebP pré-rendu Three.js.
3. **Pipeline pré-rendu** : 2 sprites jour/nuit (~150KB total) — pas de coût runtime WebGL.
4. **Critical CSS preload** : rayon visible avant hydratation React (web).
5. **Toggle préférence utilisateur** : opt-out du rayon, persisté en localStorage / AsyncStorage / chrome.storage.
6. **Design tokens textuels shifted** vers blanc cassé pour garantir la lisibilité sur toutes les palettes.
7. **Engine v3 partagé** consommé par 3 contexts unifiés (web / mobile / extension dual sidepanel + viewer).

## 3. Non-goals

- Génération runtime des sprites (rendu Three.js fait offline lors du build).
- Animations procédurales 3D dans le runtime (sprite seulement, perf-first).
- Effets météo (pluie, neige) — phase ultérieure éventuelle.
- Personnalisation du tournesol (taille, couleur) — preset fixé.

## 4. User stories

| Persona                 | Story                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Étudiante du soir (22h) | "Quand j'ouvre DeepSight la nuit, le tournesol luit doucement et le rayon est bleu — l'app a une âme calme" |
| Pro qui bosse 12h-14h   | "Le rayon midi traverse précisément l'écran, le tournesol suit le soleil — c'est subtil mais ça vit"        |
| Power user quotidien    | "Chaque jour la lumière a un angle légèrement différent — cumul d'angle + mood, je remarque l'app vit"      |
| User sensible mouvement | "Je peux désactiver le rayon dans les préférences — pas besoin de toucher prefers-reduced-motion système"   |
| Designer interne        | "Le sprite est rendu offline, je peux le re-générer en lançant le pipeline Three.js — pas de coût runtime"  |

## 5. Functional requirements

### 5.1 Engine v3 (`@deepsight/lighting-engine` v2.0.0)

- API principale : `getAmbientPresetV3(date: Date, opts?: PresetOptionsV3): AmbientPresetV3`
- Interpolation **cubic-bezier** entre keyframes (vs linéaire v2) → arc solaire précis.
- `getSpriteFrameIndex(date)` → renvoie l'index de frame (0-N) à utiliser pour l'animation tournesol.
- `KEYFRAMES_V3` étendu avec mood, beamType, beamColor, beamAngleDeg, beamOpacity, sun/moon, sunflowerHue, sunflowerLuminosity.
- Variation seedée daily préservée (mulberry32 + lissage).
- < 1ms par appel (perf 60fps tenable).

### 5.2 Sprite pipeline (`assets/ambient/sunflower-{day,night}.webp`)

- 2 sprites WebP : `sunflower-day.webp` + `sunflower-night.webp`
- Total ~150KB (cap budget bundle).
- Rendus offline via Three.js (script de build).
- Animation = scrub linéaire de la frame index selon `getSpriteFrameIndex(date)`.

### 5.3 Web (`frontend/src/`)

- `contexts/AmbientLightingContext.tsx` : provider + hook `useAmbientLightingContext()`.
- `shared/AmbientLightLayer.tsx` réécrit v3 : consomme le context, applique le beam cubic-bezier.
- `shared/SunflowerLayer.tsx` : sprite mascot positionné dans l'écran selon le preset.
- Critical CSS preload : `<style>` inline injecté avant l'hydratation React (rayon visible immédiatement).
- Toggle préférence dans Settings → persistance localStorage.
- Respect `prefers-reduced-motion`.

### 5.4 Mobile (`mobile/src/`)

- `contexts/AmbientLightingContext.tsx` : provider Reanimated 4.
- Layer Reanimated 4 (UI thread) : beam + tournesol sprite via `react-native-fast-image`.
- Toggle préférence dans Profil → AsyncStorage.
- Respect `AccessibilityInfo.isReduceMotionEnabled()`.
- AppState listener : pause animation en background.

### 5.5 Extension (`extension/src/`)

- **Dual contexts** : sidepanel + viewer (chaque entrypoint a son propre provider).
- `AmbientLightLayer` + `SunflowerLayer` partagés (même API que web).
- Toggle préférence dans Settings sidepanel → `chrome.storage.local`.
- Pas de PostHog (pas dans le bundle extension).

## 6. Non-functional requirements

| Catégorie      | Requirement                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| Performance    | < 1ms par appel `getAmbientPresetV3`                                                        |
| Bundle size    | Engine < 5KB gzipped + sprites ~150KB total                                                 |
| Accessibility  | Respect prefers-reduced-motion (web/ext) + AccessibilityInfo (mobile) + toggle user opt-out |
| Tests          | ≥ 50 tests unitaires sur engine v3, 100% green                                              |
| Cross-platform | Sortie identique sur web/mobile/extension pour même Date                                    |
| Determinism    | Même date = même preset, dates différentes = angles différents                              |
| Lisibilité     | Texte blanc cassé sur toutes les palettes, contraste AA min                                 |

## 7. Acceptance criteria

- [x] Engine v3 avec API `getAmbientPresetV3` + interpolation cubic-bezier
- [x] Pipeline sprite tournesol jour/nuit (~150KB)
- [x] Tests unitaires engine v3 green
- [x] Web : `AmbientLightingContext` + `AmbientLightLayer` v3 + `SunflowerLayer`
- [x] Web : critical CSS preload pré-hydratation
- [x] Mobile : Reanimated 4 layer + sprite mascot + AppState pause
- [x] Extension : dual contexts (sidepanel + viewer) + toggle settings
- [x] Toggle préférence user persistant sur les 3 plateformes
- [x] Design tokens textuels shifted (blanc cassé)
- [x] Doc d'intégration et CHANGELOG entry

## 8. Architecture

Voir spec complet : `docs/superpowers/specs/2026-04-26-ambient-lighting-v3-design.md`
Voir plan d'exécution : `docs/superpowers/plans/2026-04-26-ambient-lighting-v3.md`

Principaux composants :

- **Engine** : `packages/lighting-engine/` (v2.0.0)
- **Sprites** : `assets/ambient/sunflower-{day,night}.webp`
- **Web** : `frontend/src/contexts/AmbientLightingContext.tsx`, `shared/AmbientLightLayer.tsx`, `shared/SunflowerLayer.tsx`
- **Mobile** : `mobile/src/contexts/AmbientLightingContext.tsx`, layer + sprite mascot
- **Extension** : dual contexts sidepanel + viewer, layer + sprite mascot

## 9. Success metrics

- Bug rate < 1 / mois sur AmbientLightLayer après rollout v3
- 0 régression de perf (Lighthouse perf score stable, pas de jank Reanimated)
- 0 plainte d'accessibilité (motion-sickness)
- Adoption opt-out user < 5% (signal que le toggle est utile pour la minorité sensible mais l'effet est globalement apprécié)
- 0 layout shift (CLS) sur web grâce au critical CSS preload

## 10. Timeline (livré)

| Phase | PR   | Date       | Livrable                                                   |
| ----- | ---- | ---------- | ---------------------------------------------------------- |
| 1     | #139 | 2026-04-26 | Foundation : engine v3 + sprite pipeline + design tokens   |
| 2     | #140 | 2026-04-26 | Web : AmbientLightLayer v3 + SunflowerLayer + critical CSS |
| 3     | #144 | 2026-04-26 | Extension : sidepanel + viewer + sprite pipeline           |
| 4     | #145 | 2026-04-26 | Mobile : Reanimated 4 + sprite mascot                      |
| 5     | #TBD | 2026-04-26 | Cleanup : suppression v1/v2 legacy + PRD v3 + CHANGELOG    |

## 11. Risks & mitigations

| Risk                         | Mitigation                                           |
| ---------------------------- | ---------------------------------------------------- |
| Sprite WebP trop gros        | Cap budget total 150KB, recompression possible       |
| Reanimated 4 jank background | AppState listener → pause animation hors foreground  |
| Bundle engine grandit        | Mesure post-build, tree-shaking préservé             |
| Critical CSS pas synchro     | Tests E2E vérifient l'absence de flash (Playwright)  |
| Toggle user oublié           | Persistance per-platform validée, restauré au reload |

## 12. Out of scope (volontaire)

- Génération runtime du sprite (Three.js coûteux côté client → on reste pré-rendu)
- Customisation visuelle du tournesol par l'utilisateur (taille/couleur)
- Effets météo dynamiques (pluie/neige)
- Sync cloud des préférences (le toggle reste local par device)
