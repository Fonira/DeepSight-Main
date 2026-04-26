# Ambient Lighting v3 — Design Spec

**Date** : 2026-04-26
**Status** : Brainstormed, awaiting implementation plan
**Owner** : Fonira
**Plateformes** : Web (frontend/) + Mobile (mobile/) + Extension Chrome (extension/)
**Predecessor** : `docs/PRD-ambient-lighting-v2.md` (v2 implémentée mais fragmentée, 4 implémentations divergentes)

---

## 1. Objectif

Refondre la feature "ambient lighting" en signature visuelle DeepSight cohérente sur les 3 plateformes :

- Un **rayon de lumière unique** (beam de précision) qui traverse l'écran selon l'arc solaire (lever Est → zénith → coucher Ouest → lune au-dessus)
- Un **halo de source** doux à l'origine du rayon (ni disque solaire net, ni orbe lunaire net)
- Un **tournesol photoréaliste 3D** qui pivote pour suivre la course du soleil (héliotropisme), luminescent la nuit (bioluminescence cyan/violet)
- Une **palette mix** : couleurs réalistes (doré matin → blanc midi → orange couchant → argent nuit) + accents indigo/violet brand DeepSight aux twilights et nuit
- **Préchargée** en critical CSS pour apparaître AVANT que React/RN bootstrap
- **Sans gêner la lecture** : tous les textes en blanc pur ou très clair (>= slate-200), cap d'intensité du rayon dans la zone de lecture, design tokens audités

C'est la "marque de fabrique" visible sur toutes les pages, toutes les plateformes, toujours discrète.

## 2. Décisions de design (validées en brainstorming)

| #   | Domaine                        | Choix                                                                                                         |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1   | Direction artistique           | Beam de précision (trait fin + halo subtil, ni god rays cinématiques ni aurora sans pic)                      |
| 2   | Composition de la source       | Halo doux à l'origine, sans disque solaire/lunaire net                                                        |
| 3   | Comportement temporel          | Arc solaire continu (l'angle suit le soleil dans le ciel) avec interpolation cubic-bezier ~4s entre keyframes |
| 4   | Palette                        | Mix réaliste (doré/blanc/orange/argent) + accents indigo/violet aux twilights et nuit                         |
| 5   | Style 3D du tournesol          | Réaliste photoréaliste, ombrages, pétales nuancés, centre texturé                                             |
| 6   | Comportement nuit du tournesol | Luminescent (bioluminescence cyan/violet, pétales bleutés glowing, source de lumière interne)                 |
| 7   | Placement                      | Hybride : Hero centré 90px (landing/login) + Mascotte 76px bottom-right (pages de travail)                    |
| 8   | Tech 3D                        | **Pré-rendu** : 48 frames PNG/WebP générées offline en Three.js, runtime juste un sprite cross-fade           |
| 9   | Lisibilité textes              | Audit ciblé via design tokens (`text-secondary`, `text-muted` etc.) shift vers blanc pur ou très clair        |
| 10  | User control                   | Toggle "Effet ambiant lumineux" dans Préférences user + respect strict de `prefers-reduced-motion`            |
| 11  | Preload                        | Critical CSS inlined (`<head>`) + `<link rel="preload">` du sprite WebP                                       |

## 3. Architecture globale

```
┌─────────────────────────────────────────────────────────────────────┐
│  packages/lighting-engine/   (TypeScript pur, zéro dépendance UI)   │
│                                                                     │
│  • 48 keyframes v3 (toutes les 30 min, palette mix + accents brand) │
│  • getAmbientPreset(date, opts) → AmbientPreset                     │
│  • Daily seed mulberry32 pour ±15° de variation par jour            │
│  • Cap intensity dans la zone de lecture (anti-gêne)                │
│  • Respect prefers-reduced-motion (mouvement gelé)                  │
└──────┬──────────────────┬──────────────────┬───────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐
│  Web         │  │  Mobile      │  │  Extension Chrome            │
│  (React 18)  │  │  (RN 0.81)   │  │  (sidepanel + popup + viewer)│
│              │  │              │  │                              │
│ AmbientLight │  │ AmbientLight │  │ AmbientLightLayer +          │
│ Layer +      │  │ Layer +      │  │ SunflowerLayer +             │
│ SunflowerLay │  │ SunflowerLay │  │ AmbientLightingProvider →    │
│ er           │  │ er (mascot   │  │ <BeamCard> (livré par        │
│ + Critical   │  │ only)        │  │ session parallèle)           │
│ CSS plugin   │  │ + Reanimated │  │                              │
│ Vite         │  │ 4 + Splash   │  │                              │
└──────────────┘  └──────────────┘  └──────────────────────────────┘
```

### Principes structurants

1. **Source de vérité unique** : `packages/lighting-engine/` calcule TOUT (angle, couleur, frameIndex, mode jour/nuit). Les composants UI sont des "vues" de cet état. Aucune logique temporelle dupliquée.

2. **Sprites WebP partagés** : `assets/ambient/sunflower-day.webp` (24 frames jour) + `assets/ambient/sunflower-night.webp` (24 frames nuit luminescente). Consommés tels quels par les 3 plateformes.

3. **Pas de Three.js au runtime** : le rendu 3D photoréaliste est fait UNE FOIS au build (offline). Au runtime, juste des `background-position` qui shift sur le sprite. Bundle ajouté ~5KB JS + ~150KB d'assets WebP par plateforme.

4. **Critical CSS auto-généré** : un plugin Vite/Webpack lit `lighting-engine`, calcule les valeurs initiales pour l'heure courante au cold start, et émet une `<style>` inlinée dans `<head>`. Le rayon est visible avant l'hydratation React.

5. **Coordination avec session parallèle** : la session `feat/extension-sidepanel-v3` livre `<BeamCard>` SVG inline avec props `(beamColor, haloColor, angle, intensity)`. Mon implémentation ajoute un `<AmbientLightingProvider>` qui passe les valeurs courantes du preset par Context React → BeamCard les consomme via un hook `useAmbientPreset()` au lieu de ses defaults statiques.

## 4. API du `lighting-engine` v3

```ts
// packages/lighting-engine/src/types.ts

export type NightMode = "asleep" | "glowing";

export interface AmbientPreset {
  // Angle du rayon (degrés CSS, -90 à +90)
  angle: number;

  // Couleurs du beam (radial gradient ready)
  beamColor: string; // ex: "rgba(255,200,140,0.92)"
  haloColor: string; // ex: "rgba(255,200,140,0.45)"
  haloAccentColor?: string; // ex: "rgba(99,102,241,0.30)" (twilight/nuit uniquement)

  // Intensity 0-1 (consommé pour box-shadow et opacity)
  intensity: number;

  // Frame index pour le sprite (0-23 dans le sprite jour ou nuit)
  frameIndex: number;

  // Mode du tournesol
  nightMode: NightMode | null; // null = jour

  // États accessibilité
  isReducedMotion: boolean;
  isHighContrast: boolean;

  // Cap d'intensité dans la zone de lecture (computed)
  readingZoneIntensityCap: number; // 0-1
}

export interface PresetOptions {
  intensityMul?: number; // 0-1, default 1.0 (web), 0.5 (mobile)
  forceNightMode?: NightMode; // override pour testing
  forceTime?: Date; // override pour testing/dev panel
}

export function getAmbientPreset(
  date: Date,
  opts?: PresetOptions,
): AmbientPreset;

// Hook React shared (re-exported par chaque plateforme avec leur propre useEffect/setState)
export function useAmbientPreset(opts?: PresetOptions): AmbientPreset;
```

### Keyframes (48 entries, toutes les 30 min)

```ts
// packages/lighting-engine/src/keyframes.v3.ts

export const KEYFRAMES_V3: AmbientPresetRaw[] = [
  // 00:00 — pleine nuit, lune au zénith, tournesol luminescent
  {
    time: "00:00",
    angle: -10,
    beamColor: "#dce8ff",
    haloColor: "#c7d2fe",
    haloAccentColor: "#4f46e5",
    intensity: 0.65,
    nightMode: "glowing",
  },
  { time: "00:30", angle: -8 /* ... */ },
  // ...
  // 06:00 — lever, rayon doré rosé bas-droite vers haut-gauche, fleur s'éveille
  {
    time: "06:00",
    angle: -50,
    beamColor: "#ffd699",
    haloColor: "#ffc88c",
    haloAccentColor: "#a5b4fc",
    intensity: 0.78,
    nightMode: null,
  },
  // 12:00 — zénith, rayon blanc-or quasi horizontal, fleur regarde haut
  {
    time: "12:00",
    angle: -3,
    beamColor: "#fffae1",
    haloColor: "#fff4cc",
    intensity: 0.95,
    nightMode: null,
  },
  // 18:00 — coucher, orange-rouge, fleur regarde Ouest
  {
    time: "18:00",
    angle: 48,
    beamColor: "#ff8c50",
    haloColor: "#ff9966",
    haloAccentColor: "#d8b4fe",
    intensity: 0.85,
    nightMode: null,
  },
  // 22:00 — nuit, transition vers luminescent
  { time: "22:00", angle: -22, /* ... */ nightMode: "glowing" },
  // 48 entries au total
];
```

### Algorithme `getAmbientPreset`

```
1. Trouver les 2 keyframes encadrant `date.getHours() + date.getMinutes()/60`
2. Calculer le ratio d'interpolation (0-1) entre les 2 keyframes
3. Interpoler chaque champ numérique (angle, intensity, RGB des couleurs)
4. Calculer frameIndex = floor((minutes since midnight) / 30) % 24 (par sprite)
5. Appliquer daily seed mulberry32(date.toDateString()) pour ±15° de variation sur angle
6. Détecter prefers-reduced-motion → si reduce, geler toutes les valeurs
7. Détecter prefers-contrast: more → cap intensity à 0.3
8. Calculer readingZoneIntensityCap (toujours <= 0.5 dans la bande verticale 30%-70% de viewport height)
9. Retourner AmbientPreset
```

### Compat v2

- L'ancien `useTimeOfDay()` (web + mobile) est **supprimé** dans la PR cleanup
- L'ancien `getAmbientPreset()` v2 est **réécrit** (signature compatible mais `AmbientPreset` étendu avec nouveaux champs)
- Les anciens consumers (`AmbientLightDevPanel`, `useAmbientLightingFeatureFlag`) sont **supprimés**

## 5. Pipeline pré-rendu du tournesol

### Script de génération

**Path** : `scripts/gen-sunflower-frames.mjs` (à créer)

**Stack** : Three.js headless via `gl` (canvas WebGL Node.js) ou `puppeteer` avec WebGL flag. Alternative : Blender CLI avec un fichier `.blend` versionné.

**Modèle 3D** :

- Tournesol low-poly (~2K tris)
- Pétales : 12 pétales générés algorithmiquement (ellipsoïdes radiaux, dégradé jaune `#fef9c3` → orange `#fbbf24` → marron `#b45309`)
- Centre : disque texturé "tournesol" (graines) avec dégradé radial marron `#a16207` → `#451a03` → `#1c1917`
- Tige : off (économise pixels du sprite)

**Lighting** :

- Variant jour : HDRI golden hour + directional light blanc-or
- Variant nuit (luminescent) : MeshStandardMaterial avec `emissive` cyan/violet (`#4f46e5`) + faible directional cool light, glow renderpass

**Output** :

- 24 angles de rotation Y (1 frame / 30 min de keyframe principal) × 2 modes = 48 frames
- Render : 256×256 px transparent (alpha)
- Encoding : WebP qualité 85 via `sharp`
- Layout : 2 sprite sheets, grille 6×4 (1536×1024 par sprite)

**Commande** :

```bash
npm run build:sunflower-frames
# →  assets/ambient/sunflower-day.webp     ~75KB
#   assets/ambient/sunflower-night.webp   ~75KB
```

### Distribution

Les sprites sont **commit dans le repo** (pas regénérés à chaque CI) :

- Web : `frontend/public/assets/ambient/sunflower-{day,night}.webp`
- Mobile : `mobile/assets/ambient/sunflower-{day,night}.webp` (require statique)
- Extension : `extension/public/assets/ambient/sunflower-{day,night}.webp` (copié par `copy-webpack-plugin` vers `dist/`)

Pour mutualiser, on peut symlink ou créer un step `npm run sync:sprites` qui copie depuis `assets/ambient/` (root) vers les 3 destinations. Décision : **fichiers committés dupliqués** dans chaque plateforme pour éviter les pièges de bundlers (Metro RN qui ne suit pas les symlinks correctement).

### Cross-fade au runtime

```tsx
// Pseudocode (web), équivalent RN avec Animated.Image
const preset = useAmbientPreset();
const [prevIdx, setPrevIdx] = useState(preset.frameIndex);
const sprite =
  preset.nightMode === "glowing"
    ? "sunflower-night.webp"
    : "sunflower-day.webp";

// Quand frameIndex change : transition opacity 0→1 sur 4s du nouveau layer,
// 1→0 du précédent. Les 2 sont rendus simultanément.
return (
  <div className="sunflower-cross-fade">
    <div
      className="frame-prev"
      style={{
        backgroundImage: `url(/assets/ambient/${sprite})`,
        backgroundPosition: spritePosition(prevIdx),
        opacity: 0,
      }}
    />
    <div
      className="frame-next"
      style={{
        backgroundImage: `url(/assets/ambient/${sprite})`,
        backgroundPosition: spritePosition(preset.frameIndex),
        opacity: 1,
      }}
    />
  </div>
);
```

## 6. Composants par plateforme

### 6.1 Web (`frontend/`)

**Fichiers** :

- `frontend/src/components/AmbientLightLayer.tsx` — réécriture (overlay rayon + halo)
- `frontend/src/components/SunflowerLayer.tsx` — nouveau (route-aware : hero sur `/`, `/login`, `/signup` + mascotte ailleurs)
- `frontend/src/contexts/AmbientLightingContext.tsx` — nouveau Provider (passe le preset courant aux consumers)
- `frontend/src/hooks/useAmbientPreset.ts` — réécrit pour consommer le package `@deepsight/lighting-engine`
- `frontend/vite.config.ts` — nouveau plugin `vite-plugin-ambient-critical-css.ts` injecté

**Structure** :

```tsx
// frontend/src/App.tsx
<AmbientLightingProvider>
  <AmbientLightLayer /> {/* fixed inset-0 z-1 pointer-events-none */}
  <SunflowerLayer />{" "}
  {/* fixed bottom-22 right-22 z-2 (mascot) ou center hero */}
  <Router>{/* routes */}</Router>
</AmbientLightingProvider>
```

**Critical CSS plugin** :

- Lit `lighting-engine` au build/dev start
- Calcule les valeurs initiales pour l'heure courante
- Émet un `<style>` inliné dans `index.html` (head) avec :
  - `body { background: #0a0a0f; }`
  - `.ambient-beam { transform: rotate(<angle>); background: <gradient>; }`
  - `.ambient-halo { background: <radial>; }`
  - `<link rel="preload" as="image" href="/assets/ambient/sunflower-{mode}.webp">`
- Le rayon est donc visible AVANT que le bundle JS soit téléchargé

**Z-indexes** :

- 0 : background `#0a0a0f` (body)
- 1 : `<AmbientLightLayer>` (rayon + halo source)
- 2 : `<SunflowerLayer>` (tournesol mascot bottom-right OU hero centré)
- 10+ : contenu app (header, routes, modals)

**Tests** :

- `frontend/src/components/__tests__/AmbientLightLayer.test.tsx`
- `frontend/src/components/__tests__/SunflowerLayer.test.tsx`
- `frontend/e2e/ambient-lighting.spec.ts` (Playwright, 4 horaires × 2 routes)

### 6.2 Mobile (`mobile/`)

**Fichiers** :

- `mobile/src/components/backgrounds/AmbientLightLayer.tsx` — réécriture
- `mobile/src/components/backgrounds/SunflowerLayer.tsx` — nouveau (mascot only, pas de hero)
- `mobile/src/contexts/AmbientLightingContext.tsx` — nouveau
- `mobile/src/hooks/useAmbientPreset.ts` — réécrit pour consommer `@deepsight/lighting-engine`
- `mobile/metro.config.js` — `watchFolders` étendu pour inclure `packages/lighting-engine/`
- `mobile/app/_layout.tsx` — réécrit pour wrapper avec `<AmbientLightingProvider>` et monter les overlays
- `mobile/app.json` — splash screen mis à jour avec une PNG fallback statique du beam + halo

**Structure** :

```tsx
// mobile/app/_layout.tsx
<AmbientLightingProvider>
  <Stack /* expo router */ />
  <AmbientLightLayer /> {/* absoluteFill pointerEvents=none */}
  <SunflowerLayer variant="mascot" />{" "}
  {/* fixed bottom-right au-dessus tab bar */}
</AmbientLightingProvider>
```

**Spécificités** :

- Reanimated 4 `withTiming(value, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) })` sur angle, opacity, position
- Sprite via `<Image source={require('../../assets/ambient/sunflower-day.webp')} />` (Metro bundle natif)
- BottomTabBar collapse-aware : le tournesol mascot remonte de 64px quand le tab bar est visible (useBottomTabBarHeight)
- Pas de critical CSS (RN n'a pas de DOM) → on utilise le splash screen Expo pour afficher le beam initial dès le boot
- AppState listener : pause cross-fade quand background

**Tests** :

- `mobile/src/components/backgrounds/__tests__/AmbientLightLayer.test.tsx`
- `mobile/src/components/backgrounds/__tests__/SunflowerLayer.test.tsx`
- Maestro : `mobile/.maestro/ambient-lighting.yaml` (snapshots à 4 horaires)

### 6.3 Extension (`extension/`)

**Fichiers** :

- `extension/src/sidepanel/components/AmbientLightLayer.tsx` — nouveau (réécriture par-dessus l'orphelin existant)
- `extension/src/viewer/components/AmbientLightLayer.tsx` — nouveau (idem viewer)
- `extension/src/popup/components/AmbientLightLayer.tsx` — nouveau (popup, beam minimal)
- `extension/src/sidepanel/components/SunflowerLayer.tsx` — nouveau (mascot)
- `extension/src/viewer/components/SunflowerLayer.tsx` — nouveau (mascot)
- (PAS de SunflowerLayer dans popup — espace 360×600 trop contraint)
- `extension/src/sidepanel/contexts/AmbientLightingContext.tsx` — nouveau Provider
- `extension/src/sidepanel/hooks/useAmbientPreset.ts` — nouveau
- `extension/webpack.config.js` — copy-webpack-plugin pour les sprites + html-webpack-plugin pour critical CSS inline

**Coordination avec PR0 (session parallèle)** :

- Sa `<BeamCard>` accepte `beamColor`, `haloColor`, `angle`, `intensity` en props
- Mon `<AmbientLightingProvider>` (root du sidepanel) wrap tout
- Un hook custom `useBeamCardPropsFromPreset()` dérive les props BeamCard depuis le preset courant
- Modification minime de BeamCard : si elle accepte un prop optionnel `usePreset?: boolean = false`, elle peut elle-même appeler le hook et override ses defaults. Sinon, c'est l'appelant (MainView) qui passe les props depuis le hook.
- **Décision recommandée** : modification de `<BeamCard>` pour qu'elle lise le Context si présent (back-compat avec ses defaults statiques)

**Structure** :

```tsx
// extension/src/sidepanel/App.tsx (réécriture)
<AmbientLightingProvider>
  <AmbientLightLayer /> {/* fixed inset-0 z-1 */}
  <SunflowerLayer /> {/* fixed bottom-22 right-22 z-2 */}
  <Routes>
    <Route path="/" element={<MainView />} />{" "}
    {/* livré par PR0, ses BeamCard consomment le Context */}
    <Route path="/login" element={<LoginView />} />
    {/* ... */}
  </Routes>
</AmbientLightingProvider>
```

**Bundle constraint** : tous les composants additionnels < 50KB (Manifest V3 limite stricte sur popup, plus relax sur sidepanel mais on reste prudent).

**Tests** :

- `extension/__tests__/sidepanel/AmbientLightLayer.test.tsx`
- `extension/__tests__/sidepanel/SunflowerLayer.test.tsx`
- Visual : screenshots manuels après reload Chrome (pas de Playwright pour extension)

## 7. Audit textes / design tokens

### Mapping des shifts (cohérent sur les 3 plateformes)

| Token                    | Avant               | Après                    | Justification               |
| ------------------------ | ------------------- | ------------------------ | --------------------------- |
| `text-primary`           | `#fff` / `#f5f5f7`  | inchangé                 | Déjà très clair             |
| `text-secondary`         | `#94a3b8` slate-400 | `#f1f5f9` slate-100      | Gris moyen → blanc cassé    |
| `text-muted`             | `#64748b` slate-500 | `#e2e8f0` slate-200      | Gris foncé → blanc cassé    |
| `text-disabled`          | `#475569` slate-600 | `rgba(255,255,255,0.45)` | Plus de gris, juste opacité |
| `text-meta` (timestamps) | `#64748b`           | `#cbd5e1` slate-300      | Reste lisible mais distinct |

### Fichiers touchés

- **Web** : `frontend/src/styles/tokens.css` (variables CSS) + `frontend/tailwind.config.js` (extend `colors.text.*` + remplacer instances de `text-slate-400`/`text-slate-500` dans les composants pour utiliser les tokens)
- **Mobile** : `mobile/src/theme/colors.ts` (objet `colors.text.*`) + chaque consumer qui hardcode des hex à corriger
- **Extension** : `extension/src/sidepanel/styles/sidepanel.css` (classes `.v3-text-*`) + `extension/src/popup/styles/popup.css`

### Vérification WCAG

- Tous les textes sur fond `#0a0a0f` doivent atteindre WCAG AA (4.5:1 minimum)
- Vérifié via `@axe-core/playwright` dans la CI sur 4 horaires différents (au cas où le rayon altère le contraste)

## 8. User preferences

### Backend

**Champ** : `User.preferences.ambient_lighting_enabled` (bool, default `true`)

- Le model `User` a déjà un champ `preferences` (JSON column) → on ajoute la clé sans migration breaking
- Endpoint `PUT /api/auth/preferences` (existant) accepte `{ ambient_lighting_enabled: bool }`

### UI Settings (3 plateformes)

- **Web** : `frontend/src/pages/SettingsPage.tsx` — switch toggle "Effet ambiant lumineux" avec description "Affiche un rayon de lumière subtil et un tournesol qui suit la course du soleil"
- **Mobile** : `mobile/app/(tabs)/profile.tsx` — Switch RN avec même label
- **Extension** : pas d'UI dédiée (le pref vient du backend, sync via le AuthContext)

### Comportement

- Toggle OFF → `<AmbientLightingProvider>` rend `null` au lieu des overlays
- Critical CSS conditionnel : si `User.preferences.ambient_lighting_enabled === false` au cold start, on émet une classe `.ambient-disabled` sur `<html>` qui masque tout via `display: none`
- Sync : changement web → backend → mobile/extension via TanStack Query refresh sur `userPreferences` query key

## 9. Tests & Accessibilité

### Couverture cible

| Layer                    | Tooling      | Couverture                                                                                                                          |
| ------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `lighting-engine`        | Vitest unit  | `getAmbientPreset()` à 8 horaires clés, daily seed déterministe, `prefers-reduced-motion`, cap intensity, transitions interpolation |
| Composants Web           | Vitest + RTL | `<AmbientLightLayer>`, `<SunflowerLayer>`, route-aware mounting, sprite preload, toggle off                                         |
| Composants Mobile        | Jest + RNTL  | Reanimated mocks, sprite require, splash integration, AppState pause                                                                |
| Composants Extension     | Jest + jsdom | Mount dans 3 entries, BeamCard Context integration, no-Three.js bundle assertion                                                    |
| Visual regression Web    | Playwright   | 4 horaires × 4 pages → screenshots vs baseline                                                                                      |
| Visual regression Mobile | Maestro      | 4 horaires × home → snapshots                                                                                                       |
| Bundle budget            | size-limit   | Web +<200KB, Mobile +<200KB, Extension +<150KB                                                                                      |
| Lighthouse               | LHCI         | LCP regression check (rayon en critical CSS doit pas dégrader)                                                                      |

### Accessibilité

| Préférence/contexte              | Comportement                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `prefers-reduced-motion: reduce` | Angle/couleur figés sur la valeur courante. Pas de cross-fade. Pas de pivot tournesol.                  |
| `prefers-contrast: more`         | Cap intensity beam à 30% max, tournesol opacity 0.5.                                                    |
| Toggle utilisateur OFF           | Overlays montent un fragment vide (`null`). Critical CSS conditionnel `.ambient-disabled` sur `<html>`. |
| Focus / clavier                  | Tous les overlays = `aria-hidden="true"`, jamais focusables, jamais dans le tab order.                  |
| Lecteurs d'écran                 | Aucun `alt`/`aria-label` parlant — purement décoratif.                                                  |
| WCAG AA contraste textes         | Vérifié via `@axe-core/playwright` dans CI sur 4 horaires.                                              |

## 10. Roadmap d'implémentation

### Ordre des PRs

```
PR 0 (session parallèle) — feat/extension-sidepanel-v3
  Statut : EN COURS, mergée avant PR1.
  Livrables : <BeamCard>, classes .v3-*, redesign MainView.

PR 1 (~2 jours) — feat/lighting-engine-v3-foundation
  • packages/lighting-engine/ étendu (48 keyframes v3, nightMode, accents brand)
  • scripts/gen-sunflower-frames.mjs + sprites WebP committed
  • Design tokens shift (text-secondary/muted/disabled) sur 3 plateformes
  • Backend champ User.preferences.ambient_lighting_enabled
  • Tests engine + tokens (Vitest)

PR 2-4 (en parallèle, ~1.5 j chaque)
  • PR 2 — feat/ambient-lighting-v3-web
  • PR 3 — feat/ambient-lighting-v3-mobile
  • PR 4 — feat/ambient-lighting-v3-extension

PR 5 (~0.5 j) — feat/ambient-lighting-v3-cleanup
  • Supprime useTimeOfDay legacy, AmbientLightDevPanel,
    useAmbientLightingFeatureFlag
  • Met à jour docs/PRD-ambient-lighting-v2.md → v3
  • Met à jour CHANGELOG
```

### Effort total

- Sans parallélisation : ~6.5 jours
- Avec dispatch d'agents sur PR2/3/4 : ~3-4 jours réels

### Stratégie de rollout

- **Default ON** dès PR1 (champ pref initialisé à `true`)
- **Feature flag PostHog** `ambient_lighting_v3` pour kill-switch d'urgence
- **Pas de A/B test** — feature de polish, pas de mécanique métier

## 11. Risques & Mitigations

| Risque                                                           | Mitigation                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sprite pipeline rend mal (3D approximative)                      | Itérations sur `gen-sunflower-frames.mjs`, sprite committable indépendamment du code                                                 |
| Bundle mobile dépasse budget                                     | Lazy-load du sprite après mount + Hermes engine                                                                                      |
| Conflit avec session parallèle MainView                          | Le Context Provider override les defaults de BeamCard, pas l'API. Modifications de BeamCard se limitent à un `useContext` optionnel. |
| Lighthouse LCP régression                                        | Critical CSS ~2KB inline, mesure prouve impact négligeable                                                                           |
| Performance battery mobile                                       | Cross-fade pause si app en background (`AppState`)                                                                                   |
| Bundle extension popup (1MB max)                                 | Pas de SunflowerLayer dans popup, AmbientLightLayer minimal (~6KB total)                                                             |
| Metro RN ne résout pas le workspace `@deepsight/lighting-engine` | `metro.config.js` `watchFolders` + `extraNodeModules` configurés explicitement                                                       |

## 12. Hors scope (PR follow-up éventuelles)

- Audit complet du monorepo pour chasser TOUTES les couleurs grises hex (utilisateur a opté pour audit ciblé via tokens uniquement)
- A/B test de différentes palettes (palette validée = mix réaliste + accents brand)
- Customization avancée (intensité, palette) côté user (rejeté en faveur d'un simple toggle)
- Tournesol interactif (cliquable, easter eggs) — peut venir en v3.1

## 13. Références

- Brainstorming session : 2026-04-26 (visual companion `http://localhost:54368` puis `:56930`)
- Engine v2 existant : `packages/lighting-engine/` (à étendre)
- PRD v2 : `docs/PRD-ambient-lighting-v2.md` (sera mis à jour vers v3 dans PR5)
- Composants v2 (à remplacer) :
  - Web : `frontend/src/components/AmbientLightLayer.tsx`, `frontend/src/hooks/useTimeOfDay.ts`, `frontend/src/components/AmbientLightDevPanel.tsx`
  - Mobile : `mobile/src/components/backgrounds/AmbientLightLayer.tsx`
  - Extension : `extension/src/popup/components/AmbientLightLayer.tsx`, `extension/src/viewer/components/AmbientLightLayer.tsx` (orphelins jamais montés)
- Session parallèle (coordination) : worktree `C:\Users\33667\DeepSight-Main\.claude\worktrees\extension-sidepanel-v3`, branche `feat/extension-sidepanel-v3`, spec `docs/superpowers/specs/2026-04-26-extension-sidepanel-design.md`
