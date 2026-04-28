# Refonte lisibilité — DeepSight Web

**Auteur** : Maxime Le Parc (DeepSight)
**Date** : 2026-04-27
**Statut** : Design approuvé, en attente du plan d'implémentation
**Scope** : DeepSight Web (`frontend/`, déployé sur Vercel via `frontend-v46-cppme`)
**Phase 2** : extension Chrome + mobile Expo + écosystème Telegram (principes seulement, hors fichiers)

---

## 1. Problème

Sur l'ensemble du frontend DeepSight Web, des textes affichés en gris translucide ou en gris foncé sont peu ou pas lisibles. Les zones les plus touchées sont :

- **Cards Tournesol** du Dashboard (métadonnées « X contributeurs / Fiabilité / Pédagogie » en `text-white/30`).
- **Sidebar** (nav inactive, label « RÉVISION & IA », Mode Jeu, crédits, plan badge).
- Pages denses (`History.tsx`, `MyAccount.tsx`, `AdminPage.tsx`, `LandingPage.tsx`, `UpgradePage.tsx`).

Audit complet (cf. brainstorm session 2026-04-27) :

| Métrique                                                      | Valeur                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Token cassé `--text-muted: #45455a`                           | contraste **1.6:1** sur fond sombre, **1.0:1** sur ambient warm — échec WCAG AA |
| Occurrences `text-text-muted/secondary/tertiary`              | **1 024+** dans 100+ fichiers                                                   |
| Occurrences `text-white/[3-6]0` (translucide)                 | **340** dans 65 fichiers                                                        |
| Occurrences legacy `text-gray/slate-X00` (hors design system) | **121** dans 25 fichiers                                                        |
| Opacités `opacity-[3-7]0` sur du texte                        | **170** dans 76 fichiers                                                        |
| Token fantôme `text-text-quaternary` (non défini)             | 2 usages dans `Sidebar.tsx`                                                     |

**Aggravant visuel** : `AmbientLightLayer` superpose 6 calques `position: fixed inset-0 z-1 mix-blend-mode: screen` (gradients ambient + beams + étoiles + sun/moon). Sans `isolation: isolate` sur le contenu, le `mix-blend-mode: screen` éclaircit chaque texte par-dessus de **30 à 60 %**, dégradant le contraste effectif. Le `body::after` ajoute en plus 3 gradients chauds (gold / sienna / terracotta).

**Vœu utilisateur** : tout doit être lisible partout, et les rayons de lumière ne doivent plus gêner — sans pour autant supprimer la signature visuelle de la marque.

---

## 2. Vision (4 phrases)

1. **Quatre niveaux de texte sémantiques** (`strong`, `default`, `soft`, `faint`) remplacent le fouillis actuel (`primary`, `secondary`, `tertiary`, `muted`, `quaternary` fantôme, `text-white/[3-6]0`, `text-gray-X00`).
2. **Tous les conteneurs de contenu** (cards, sidebar, modals, panels, `<main>`) reçoivent `isolation: isolate` — ferme le contexte de blend du parent, le texte n'est plus jamais éclairci par les rayons.
3. **AmbientLightLayer désactivé sur les routes denses** (Dashboard, History, MyAccount, Admin, Analysis, Study, Playlist, Upgrade, ApiDocs) via `useLocation()`, gardé sur les routes vitrines (Landing, Login, Signup, Pricing, About, Legal).
4. **Codemod automatique** pour remap les 1 500+ occurrences vers les nouveaux tokens, **CI** `axe-core` + `pa11y` sur preview Vercel pour bloquer les rechutes.

---

## 3. Palette tokens

### 3.1 Définition CSS

À ajouter dans `frontend/src/index.css` (remplace les 4 lignes actuelles `--text-primary/secondary/tertiary/muted`) :

```css
:root {
  /* Hiérarchie texte — sémantique, ratios validés WCAG sur fond sombre + ambient warm */
  --text-strong: #f5f5fa; /* L1 — Titres, nav active, valeur métrique forte */
  --text-default: #c9c9d4; /* L2 — Body, descriptions, nav inactive */
  --text-soft: #8b8ba0; /* L3 — Métadonnées, captions, helpers */
  --text-faint: #6e6e82; /* L4 — Decorative, disabled — interdit pour body */
  --text-inverse: #0a0a0f; /* Sur backgrounds clairs */
}
```

### 3.2 Ratios de contraste

| Token              | HEX           | Fond `#0a0a0f` | Fond ambient warm `#2a2520` | Cible                 | Usage                                |
| ------------------ | ------------- | -------------- | --------------------------- | --------------------- | ------------------------------------ |
| `--text-strong`    | `#F5F5FA`     | 18.17:1 ✓ AAA  | 13.96:1 ✓ AAA               | ≥ 12:1                | Titres, nav active, métriques fortes |
| `--text-default`   | `#C9C9D4`     | 12.03:1 ✓ AAA  | 9.24:1 ✓ AAA                | ≥ 7:1 (AAA body)      | Body, descriptions, nav inactive     |
| `--text-soft`      | `#8B8BA0`     | 5.92:1 ✓ AA    | 4.55:1 ✓ AA                 | ≥ 4.5:1 (AA helpers)  | Métadonnées, captions, helpers       |
| `--text-faint`     | `#6E6E82`     | 3.97:1         | 3.05:1                      | ≥ 3:1 (AA large only) | Decorative, disabled                 |
| ~~`--text-muted`~~ | ~~`#45455a`~~ | 2.12:1 ✗       | 1.63:1 ✗                    | —                     | **Supprimé**                         |

Sources palette : Radix Colors (gray/mauve dark step 11/12), GitHub Primer dark, IBM Carbon g100, Apple HIG dark, Material 3. Teinte légèrement violette (hue ~240) qui s'harmonise avec le fond `#0a0a0f` sans virer au gris pur sur les zones gold (évite contraste chromatique désagréable jaune × cyan).

### 3.3 Tailwind config

`frontend/tailwind.config.js` doit exposer les 4 nouveaux tokens en utilities :

```js
theme: {
  extend: {
    textColor: {
      'text-strong':  'var(--text-strong)',
      'text-default': 'var(--text-default)',
      'text-soft':    'var(--text-soft)',
      'text-faint':   'var(--text-faint)',
    }
  }
}
```

Les anciennes utilities (`text-text-primary`, `-secondary`, `-tertiary`, `-muted`) sont **conservées temporairement** pendant la phase de codemod, marquées `@deprecated` dans un commentaire, puis supprimées en PR finale.

### 3.4 Variants accent

Les couleurs sémantiques (vert fiabilité, bleu pédagogie, gold note Tournesol) sont **conservées** mais saturées correctement :

| Avant                                                        | Après                                                                        | Ratio        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------ |
| `text-emerald-400/60` (fiabilité ≥ 50)                       | `text-emerald-300`                                                           | 5.5:1 ✓ AA   |
| `text-blue-400/60` (pédagogie ≥ 50)                          | `text-sky-300`                                                               | 10.4:1 ✓ AAA |
| `text-yellow-400` (badge gold Tournesol score)               | inchangé — sur `bg-yellow-500/20` qui devient `bg-yellow-500/30` (solidifié) | OK           |
| `text-emerald-400` sur `bg-emerald-500/20` (badge note ≥ 50) | `text-emerald-200` sur `bg-emerald-500/30`                                   | 9.1:1 ✓ AAA  |
| `text-orange-400` sur `bg-orange-500/20` (badge note < 50)   | `text-orange-200` sur `bg-orange-500/30`                                     | 7.5:1 ✓ AAA  |

Les `/60` opacités sont supprimées partout sur les variants colorés (un texte coloré à 60 % sur fond ambient warm = double dégradation). Les backgrounds des badges passent de `/20` à `/30` pour solidifier l'isolement de la couleur de texte vis-à-vis du fond ambient.

---

## 4. Isolation contre `mix-blend-mode`

### 4.1 Règles CSS globales

À ajouter dans `frontend/src/index.css` après les tokens :

```css
/* Ferme le contexte de blend pour les zones de contenu — bloque le mix-blend-mode: screen
   de l'AmbientLightLayer sans toucher aux calques cosmétiques eux-mêmes. */
main,
[role="main"],
.card,
.panel,
.modal-content,
.dropdown-menu,
.popover,
aside[data-sidebar] {
  isolation: isolate;
}
```

### 4.2 Mécanisme

`isolation: isolate` crée un nouveau stacking context. Le `mix-blend-mode: screen` du parent (les 6 calques AmbientLight en `z-1`) ne mixe plus avec ce qu'il y a _dans_ le conteneur isolé. Les rayons continuent d'exister visuellement entre/derrière les blocs (gutters, headers, transitions de section), donnant un effet plus _cinématographique_ que l'effet « lumière sur le texte » actuel.

### 4.3 Vérifications obligatoires

- **Portals** : modals, dropdowns, tooltips doivent rester rendus dans `document.body` (React Portal). Audit nécessaire pendant l'implémentation : grep `createPortal` dans le frontend, vérifier qu'aucun portal n'est ancré sous un wrapper isolé.
- **`position: fixed` enfants** : les éléments `position: fixed` à l'intérieur d'un conteneur isolé s'ancrent désormais au conteneur, pas au viewport. Auditer notamment `VoiceOverlay.tsx`, `FloatingChatWindow.tsx`, `NotificationBell.tsx`.
- **Z-index local** : les valeurs de `z-index` à l'intérieur d'un conteneur isolé sont remises à zéro. Auditer les composants qui utilisent `z-50` / `z-100` dans des sous-arbres isolés.

---

## 5. AmbientLightLayer router-aware

### 5.1 Wrapper conditionnel

Modifier `frontend/src/App.tsx` autour de la ligne 445 :

```tsx
const AMBIENT_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/about",
  "/legal",
];
const { pathname } = useLocation();
const showAmbient = AMBIENT_ROUTES.some(
  (r) => pathname === r || pathname.startsWith(r + "/"),
);

return (
  <>
    {showAmbient && <AmbientLightLayer intensity="normal" />}
    <SkipLink />
    <Routes>{/* ... */}</Routes>
  </>
);
```

### 5.2 Routes désactivées

`/dashboard`, `/history`, `/account`, `/admin`, `/analysis/*`, `/study`, `/playlist/*`, `/upgrade`, `/api-docs`, `/chat`, `/debate`. La signature visuelle reste sur l'acquisition (où elle compte le plus), absente du QG de travail (où la lisibilité prime).

### 5.3 Pas de feature flag par route

Le flag PostHog `ambient_lighting_v2` reste **global on/off**. La granularité par route est une décision produit, pas un toggle utilisateur. Si à l'avenir un mode « lumière partout, je m'en fiche » est demandé, ajouter une préférence utilisateur dans `MyAccount` qui override la route allowlist.

---

## 6. Codemod

### 6.1 Stack

`jscodeshift` (transformations AST JSX/TSX) avec aide ponctuelle de `ts-morph` pour les cas TypeScript complexes. Script dans `frontend/scripts/codemod-readability.ts`. Lancement manuel via `pnpm codemod:readability` (ajouter au `package.json`).

### 6.2 Mapping de remplacement

| Pattern actuel                                                         | Cible                                                        | Occurrences estimées  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------- |
| `text-text-primary`                                                    | `text-text-strong`                                           | ≈ 200                 |
| `text-text-secondary`                                                  | `text-text-default`                                          | ≈ 280                 |
| `text-text-tertiary`                                                   | `text-text-soft`                                             | ≈ 290                 |
| `text-text-muted`                                                      | `text-text-soft` (default) ou `text-text-faint` (decorative) | ≈ 254                 |
| `text-text-quaternary` (fantôme)                                       | `text-text-faint`                                            | 2                     |
| `text-white/30`, `text-white/40`                                       | `text-text-soft`                                             | ≈ 140                 |
| `text-white/50`, `text-white/60`, `text-white/70`                      | `text-text-default`                                          | ≈ 120                 |
| `text-white/80`, `text-white/90`                                       | `text-text-strong`                                           | ≈ 80                  |
| `text-gray-400`, `text-slate-400`, `text-zinc-400`, `text-neutral-400` | `text-text-soft`                                             | partie des 121 legacy |
| `text-gray-500/600`, etc.                                              | `text-text-faint` ou `text-text-default` selon scale         | partie des 121        |
| `text-emerald-400/60`                                                  | `text-emerald-300`                                           | ≈ 30                  |
| `text-blue-400/60`                                                     | `text-sky-300`                                               | ≈ 25                  |

### 6.3 Cas border (revue manuelle)

- **`text-text-muted` ambigu** : règle de désambiguïsation par contexte AST. Si le nœud parent est un `<button>`, `<a>`, `<input>`, ou un composant cliquable (détection par nom : `Button`, `Link`, `MenuItem`, `NavItem`, `IconButton`), → `text-text-soft`. Sinon (séparateurs `<hr>` stylés, watermarks/filigranes, captions illustratifs sous des images, hint text non-cliquable), → `text-text-faint`.
- **Opacités sur span coloré** : si la classe est sur un `<span>` qui a aussi un variant couleur (`text-emerald-X`, `text-amber-X`, `text-rose-X`, etc.), ne pas toucher l'opacité dans le codemod — laisser à la phase de revue manuelle pour ne pas casser un branding intentionnel. Marquer le fichier dans le rapport de codemod pour audit ciblé.
- **Gradients sur texte** (`text-gradient`, `bg-clip-text`) : ne pas toucher.
- **Textes en hover/focus** : si la classe est dans un modificateur `hover:` ou `focus:` Tailwind (ex: `hover:text-text-secondary`), appliquer le mapping standard sans hésitation — ces états sont temporaires et non-soumis aux mêmes contraintes WCAG strictes que les états par défaut.

### 6.4 Garde-fous

- Chaque pattern → 1 commit séparé pour faciliter la revue.
- Le script génère un rapport `codemod-readability-report.md` avec : pour chaque fichier touché, le diff résumé + les cas border laissés au manuel.
- Tests unitaires existants doivent passer après codemod (les couleurs n'affectent pas les tests sauf snapshot — invalider les snapshots Jest si présents).

---

## 7. Plan d'implémentation (5 PRs)

| PR                                   | Scope                                                                                                                                                                                                | Taille | Risque           | Reviewer focus                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **PR 1** — Tokens & config           | `frontend/src/index.css` (nouveaux tokens, suppression `--text-muted`), `frontend/tailwind.config.js` (utilities `text-text-strong/default/soft/faint`). Anciennes utilities marquées `@deprecated`. | S      | Faible           | Vérifier qu'aucun code ne casse (les anciennes utilities restent fonctionnelles).                                               |
| **PR 2** — Isolation CSS             | Règles `isolation: isolate` dans `index.css`. Audit portals + `position: fixed` enfants.                                                                                                             | S      | Moyen            | Tester visuellement modals (`VoiceOverlay`, `FloatingChatWindow`), dropdowns (`NotificationBell`).                              |
| **PR 3** — AmbientLight router-aware | `App.tsx` wrapper conditionnel + tests E2E sur 2 routes (Landing OK, Dashboard désactivé).                                                                                                           | XS     | Faible           | Vérifier sur les 11 routes désactivées qu'aucun calque ambient n'apparaît.                                                      |
| **PR 4** — Codemod                   | Script + exécution + revue manuelle des cas border + commit-by-pattern.                                                                                                                              | XL     | Faible mécanique | Revue par diff scan : chercher les patterns suspects (`text-emerald-300` sur fond clair, `text-text-faint` dans un body, etc.). |
| **PR 5** — CI a11y                   | `axe-core/playwright` sur les routes principales + `pa11y-ci` sur preview Vercel. Bloque PR si régression contraste.                                                                                 | M      | Faible           | Configurer le seuil (zero violations critical/serious) et la liste des routes auditées.                                         |

PR 1 → 5 séquentielles. PR 1+2+3 peuvent être mergées dans la semaine 1, PR 4 en semaine 2 (gros mais mécanique), PR 5 en semaine 2-3.

---

## 8. Validation a11y (CI)

### 8.1 Outils

- **`@axe-core/playwright`** : tests E2E qui auditent le DOM rendu. Détecte ~57 % des violations WCAG dont les contrastes statiques. Routes auditées : Landing, Login, Dashboard, History, MyAccount, AdminPage, Analysis (au moins 1 vidéo), UpgradePage.
- **`pa11y-ci`** : seconde passe sur les preview Vercel via GitHub Action. Configuration zéro tolérance pour les violations `critical` et `serious`.
- **Lighthouse CI** (déjà configuré ?) : audit Accessibility doit rester ≥ 95.

### 8.2 Limite connue

`axe-core` mesure le contraste sur le DOM **statique**. Il ne voit pas l'effet du `mix-blend-mode: screen` actif. Pour valider l'effet _réel_ sur les routes ambient, ajouter une suite Playwright de **screenshot tests** (`pixelmatch`) sur Landing/Login/Pricing : capture before/after refactor + diff < 0.1 % sur les zones de texte critiques.

### 8.3 Critères d'acceptation

- ✅ Aucune utility `text-text-muted`, `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-quaternary` dans le codebase après PR 4 (vérifiable par `grep -r "text-text-\(muted\|primary\|secondary\|tertiary\|quaternary\)" frontend/src` qui doit retourner 0 résultat).
- ✅ Aucune classe `text-white/[1-7]0` (transparent ≤ 70 %) sur un nœud non-décoratif. Audit final = grep `text-white/[1-7]0` dans `frontend/src` + revue manuelle des occurrences restantes (overlays badges sur backgrounds opaques OK, body text NON OK).
- ✅ `axe-core` zéro violation `critical`/`serious` de catégorie `color-contrast` sur les 8 routes auditées (Landing, Login, Dashboard, History, MyAccount, AdminPage, Analysis, UpgradePage).
- ✅ AmbientLightLayer absent du DOM sur les 11 routes désactivées (test E2E : `expect(page.locator('[data-ambient]')).toHaveCount(0)` après ajout d'un `data-ambient` sur le root du composant).
- ✅ Lighthouse Accessibility ≥ 95 sur Landing et Dashboard.
- ✅ Aucune régression visuelle perçue sur Landing/Login/Pricing (screenshot diff `pixelmatch` < 0.5 % — seuil réaliste vu les variations naturelles d'AmbientLight selon `useTimeOfDay`).

---

## 9. Phase 2 — extension de la doctrine à l'écosystème

**Hors scope de cette spec** — chacun des projets ci-dessous obtient sa propre spec courte qui réutilise les principes (palette, isolation, AAA body / AA helpers).

### 9.1 Extension Chrome DeepSight (Shadow DOM sur YouTube)

- L'extension utilise un Shadow DOM isolé. Les tokens CSS doivent être réinjectés dans le shadow root (le `:root` du document hôte n'est pas hérité).
- Action : ajouter un `:host { --text-strong: ...; ... }` dans la feuille de style du shadow root.
- Revue spéciale : l'extension ne contrôle pas le fond YouTube — adapter les seuils contraste au cas où le fond est blanc (light mode YouTube) ou noir (dark mode YouTube). Probablement deux palettes : une pour `prefers-color-scheme: dark`, une pour `light`.
- Référence préalable : MEMORY `project_extension-shadow-dom-white-widget-fix.md`.

### 9.2 Mobile Expo (DeepSight Mobile)

- Theme system distinct dans `src/theme/` (refonte récente, cf. MEMORY `project_deepsight-mobile-refonte.md`).
- Action : appliquer la même hiérarchie 4 niveaux (`textStrong`, `textDefault`, `textSoft`, `textFaint`) dans le theme RN. Les HEX restent identiques au Web.
- Pas d'AmbientLightLayer sur mobile actuellement → pas de problème d'isolation.
- Validation : tester sur iOS et Android en mode dark/light, sur écrans OLED (dark) et LCD (clair).

### 9.3 Telegram MiniApps (lalanation, Grassmotion, Dug-Bot)

- Stacks différentes (Next.js / Vite / autre). Pas d'urgence — ces apps n'ont pas l'AmbientLightLayer ni le système de tokens DeepSight.
- Action légère : créer un fichier `tokens.css` partagé sous forme de CSS variables que chaque mini-app peut importer si elle veut s'aligner.
- Pas de codemod automatique — refonte manuelle ciblée par projet.

---

## 10. Risques et hors scope

### 10.1 Risques

- **Codemod sur 1 500 occurrences** : risque de cassure visuelle subtile sur un composant que personne ne regarde régulièrement. Mitigation : screenshots Playwright de toutes les routes principales avant/après PR 4, comparaison par diff visuel.
- **Suppression `--text-muted`** : si un fichier oublié l'utilise via une string template (ex: `className={\`text-text-muted ${...}\`}`), le codemod jscodeshift peut rater. Mitigation : grep final manuel + ESLint custom rule qui interdit `text-text-muted` après PR 4.
- **`isolation: isolate` sur `<main>`** : si le `<main>` enveloppe les modals (rare), peut couper leur affichage en plein écran. Mitigation : audit portals avant PR 2.
- **AmbientLight désactivé sur Dashboard** : régression visuelle perçue par les utilisateurs habitués. Mitigation : changelog clair, possibilité de réactiver via préférence utilisateur en Phase 2.

### 10.2 Hors scope

- **Refonte complète du thème light** : seul le dark theme est traité (le light est très peu utilisé sur DeepSight). Une passe similaire sur le light en spec séparée si demandé.
- **Refonte AmbientLightLayer** (lever L5 du brainstorm) : on ne touche pas au moteur lumineux, on l'isole et on le restreint à certaines routes. Refonte complète = nouvelle spec.
- **Composants orphelins détectés** (`SidebarLogo.tsx`, `SidebarNavItem.tsx`, `SidebarUserCard.tsx` v5/v6 non utilisés par la Sidebar v8) : suppression mentionnée dans l'option C du brainstorm mais pas retenue dans l'option B. Nettoyage en spec séparée si l'utilisateur le souhaite.
- **Migration des tests snapshots Jest** : si présents, à invalider en bloc lors du codemod (charge mécanique, pas une question de design).

---

## 11. Annexe — sources

- Audit complet du brainstorm session 2026-04-27 (4 agents Explore parallèles : AmbientLightLayer, Sidebar, Cards, best practices externes).
- Radix Colors documentation : <https://www.radix-ui.com/colors/docs/palette-composition/scales>
- GitHub Primer dark : <https://primer.style/foundations/color>
- IBM Carbon g100 : <https://carbondesignsystem.com/elements/color/tokens/>
- Apple HIG dark mode : <https://developer.apple.com/design/human-interface-guidelines/dark-mode>
- MDN — `isolation` : <https://developer.mozilla.org/en-US/docs/Web/CSS/isolation>
- MDN — `mix-blend-mode` : <https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode>
- axe-core : <https://github.com/dequelabs/axe-core>
- pa11y-ci : <https://github.com/pa11y/pa11y-ci>
