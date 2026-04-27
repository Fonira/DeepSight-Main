# Sidepanel — Nav architecture refactor + scroll fix

**Date** : 2026-04-27
**Auteur** : brainstorming session (DeepSight founder + Claude)
**Branche cible** : `feat/sidepanel-nav-refactor`
**Statut** : design validé, plan d'implémentation à venir

---

## 1 · Contexte

L'extension Chrome DeepSight (Manifest V3) expose une side panel React. Deux pain points UX rapportés en prod :

1. **Scroll bloqué** dans la vue Results : on ne peut pas faire défiler vers le bas pour voir l'analyse détaillée.
2. **Pas de vraie surface "plein écran"** : la sidebar est étirable au drag du bord (natif Chrome), mais utile uniquement pour quitter le contexte YouTube et lire confortablement / partager une URL.

En parallèle, l'exploration de `extension/src/sidepanel/` a révélé deux dettes techniques qui aggravent le problème :

- **`MainView.tsx` est monolithique** (730 lignes) — il porte simultanément les phases `idle / analyzing / complete / error` via une union d'état interne, plus deux banners (`v3-banner` YouTube + `PromoBanner`) plus une redirection ChatView par early-return.
- **Un refactor a été commencé puis abandonné** : `views/HomeView.tsx`, `views/AnalysisView.tsx`, `views/ResultsView.tsx` existent (avec leurs composants `RecentsList`, `VideoDetectedCard`, `UrlInputCard`, `PlanBadge`) mais **ne sont jamais branchés dans `App.tsx`**. La state machine est bloquée à `loading | login | main`. Les composants viennent même d'être polish dans la PR #151 — qui ne sera visible que si on les câble.
- **`extension/src/viewer.tsx` + `viewer.html`** existent comme entry point webpack autonome (avec `ViewerHeader`, `VerdictSection`, `KeyPointsSection`, `DetailedAnalysis`, `FactCheckSection`, `ActionBar`). Lit `?id=<summaryId>` et fait `chrome.runtime.sendMessage({ type: "GET_SUMMARY" })`. **Aucune référence depuis le sidepanel** : c'est le candidat évident pour le bouton "Plein écran".

## 2 · Goals

- G1. Le scroll dans Results fonctionne sur n'importe quelle longueur d'analyse, sans dépasser la hauteur visible de la sidebar.
- G2. Un bouton "⛶ Plein écran" sur ResultsView ouvre l'analyse dans un nouvel onglet via `viewer.html?id=<summaryId>`.
- G3. `App.tsx` route vers les vues refactor (`HomeView` / `AnalysisView` / `ResultsView` / `ChatView`) déjà en place ; `MainView.tsx` est progressivement vidé puis supprimé.
- G4. Pas de régression visuelle ni comportementale : login flow, voice flow, analyse end-to-end, chat.

## 3 · Non-goals

- Pas de nouveau pattern de navigation (pas de tabs, pas de bottom bar, pas de breadcrumbs). C'était le scope C écarté.
- Pas d'enrichissement du viewer plein écran (pas de mode debate / comparaison / lecture améliorée).
- Pas de redesign visuel : le polish UI cards + dismiss buttons reste tel que livré dans PR #151.
- Pas d'API de redimensionnement de la sidebar (Chrome n'en fournit pas) — l'utilisateur élargit déjà au drag du bord.
- Pas de migration backend ni d'évolution de schéma DB.

## 4 · Design

### 4.1 · Fix scroll — chaîne de containers normalisée

Root cause du blocage actuel :

- `#root { overflow: hidden; height: 100% }` clip le scroll global du document.
- `.app-container > .main-view > .main-content` — aucun de ces containers n'a `overflow-y: auto`. Le contenu déborde et `#root` le coupe.
- Le pattern correct (header haut, content scrollable au milieu, footer bas) existe dans le CSS sous le nom `.sidepanel-layout` (`grid auto / 1fr / auto`) **mais n'est utilisé nulle part dans le JSX**. Vestige.

Correctif (CSS uniquement) dans `extension/src/sidepanel/styles/sidepanel.css` :

```css
/* #root inchangé : overflow:hidden voulu (clip extérieur) */

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.main-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 12px 14px;
}
```

`min-height: 0` sur chaque flex item est la clé : sans ça, le contenu impose sa hauteur min et empêche le child `overflow-y` de prendre effet. Patron flexbox standard.

Les vues réorganisées (`HomeView`, `AnalysisView`, `ResultsView`) doivent **toutes** rendre leur contenu scrollable dans `.main-content` (ou équivalent), pas dans leur propre overflow interne — un seul scroll container par écran.

### 4.2 · App.tsx state machine étendue

Avant :

```ts
type ViewName = "loading" | "login" | "main";
```

`MainView` gère en interne `analysis.phase = "idle" | "analyzing" | "complete" | "error"` plus la sous-vue chat par early-return.

Après :

```ts
type AppState =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "home" } // → HomeView
  | { kind: "analyzing"; taskId: string } // → AnalysisView
  | { kind: "results"; summaryId: number } // → ResultsView
  | { kind: "chat"; summaryId: number } // → ChatView
  | { kind: "voice" }; // → VoiceView (déjà en place)
```

Discriminated union → chaque vue reçoit ses props précisément, pas de prop drilling. Transitions explicites câblées dans `App.tsx` :

- `HomeView` reçoit `onAnalyze: (url) => void` qui POST `/api/videos/analyze` puis transitionne vers `{ kind: "analyzing", taskId }`.
- `AnalysisView` reçoit `taskId` + `onAnalysisComplete: (summaryId) => void` qui transitionne vers `{ kind: "results", summaryId }`.
- `ResultsView` reçoit `summaryId` + `onNewAnalysis` (→ `home`) + `onOpenChat` (→ `chat`) + `onOpenFullscreen` (→ `chrome.tabs.create(viewer.html?id=...)`).
- `ChatView` reçoit `summaryId` + `onBack` (→ `results`).

`VoiceView` est inchangé (déjà branché par court-circuit `voiceContext`).

### 4.3 · Bouton "⛶ Plein écran" — branchement viewer.html

Dans `ResultsView` (header), à côté du bouton "← Nouvelle analyse" existant, ajouter un bouton "⛶ Plein écran" :

```tsx
const handleFullscreen = () => {
  const url = chrome.runtime.getURL(`viewer.html?id=${summaryId}`);
  chrome.tabs.create({ url });
};
```

`viewer.html` est déjà déclaré dans `webpack.config.js` et copié au build dans `dist/`. Aucune nouvelle entry, aucune nouvelle permission requise (`chrome.tabs.create` est autorisé en MV3 sans permission spéciale pour les URLs internes de l'extension).

Le bouton n'apparaît que si `summaryId` est défini (donc impossible avant qu'une analyse soit complète). Texte + icône + `aria-label="Ouvrir l'analyse en plein écran"`.

### 4.4 · Migration MainView (incrémentale)

Pour éviter un big-bang risqué, le refactor se fait en 3 étapes commitables séparément, chacune testable manuellement avant la suivante :

**Étape 1 — Brancher `home`**

- Étendre `AppState` (ajouter `home` ; `main` reste pour l'instant).
- Modifier `App.tsx` : par défaut après login → `{ kind: "home" }` → rend `<HomeView ...>`. Le clic "Analyser" depuis HomeView pose `{ kind: "main" }` avec un flag interne qui pré-remplit l'URL et déclenche l'analyse — `MainView` continue de gérer `analyzing | complete | error` via son state interne en attendant l'étape 2.
- Smoke test : login → home → entrer URL → MainView prend la main et lance l'analyse.

**Étape 2 — Brancher `analyzing` + `results`**

- Ajouter `analyzing` et `results` à `AppState`.
- Modifier `App.tsx` : transitions home → analyzing (sur `onAnalyze`), analyzing → results (sur `onAnalysisComplete`), results → home (sur `onNewAnalysis`), results → chat (sur `onOpenChat`).
- Câbler le bouton "⛶ Plein écran" sur ResultsView (section 4.3).
- `MainView` n'est plus rendu que pour `error`.
- Smoke test : analyse complète end-to-end + chat + plein écran.

**Étape 3 — Supprimer MainView**

- État d'erreur géré localement dans `AnalysisView` (la seule vue qui peut produire une erreur d'analyse) : on étend son contrat pour accepter un callback `onAnalysisError: (msg: string) => void` que `App.tsx` mappe sur un toast via le système de notification existant. Pas de banner global persistant — c'était hors scope.
- Supprimer `extension/src/sidepanel/views/MainView.tsx` + tests obsolètes.
- Vérifier qu'aucun import résiduel n'existe (`grep "MainView"` dans `extension/src/`).
- Smoke test : forcer un échec d'analyse (URL invalide / quota épuisé) → vérifier que l'erreur s'affiche correctement.

À chaque étape : `npm run typecheck` clean + `npm run build` + reload extension dans Chrome + smoke test du flow concerné. Commit séparé par étape pour faciliter le rollback si régression.

### 4.5 · Récap fichiers touchés (estimation)

| Fichier                                         | Étape | Action                                   |
| ----------------------------------------------- | ----- | ---------------------------------------- |
| `extension/src/sidepanel/styles/sidepanel.css`  | 1     | Fix `.app-container` / `.main-view` / `.main-content` |
| `extension/src/sidepanel/App.tsx`               | 1+2+3 | State machine étendue, transitions câblées |
| `extension/src/sidepanel/views/HomeView.tsx`    | 1     | Câblé (existe déjà, polish PR #151)      |
| `extension/src/sidepanel/views/AnalysisView.tsx`| 2     | Câblé (existe déjà)                      |
| `extension/src/sidepanel/views/ResultsView.tsx` | 2     | Câblé + bouton "⛶ Plein écran"           |
| `extension/src/sidepanel/views/MainView.tsx`    | 3     | Supprimé                                 |
| `extension/__tests__/...`                       | 3     | Tests MainView obsolètes supprimés       |

## 5 · Testing strategy

- **Build vert à chaque étape** : `cd extension && npm run typecheck && npm run build`. Erreur TS → étape rejetée.
- **Smoke tests manuels** par étape (cf. 4.4). Pas de Playwright sur l'extension actuellement, donc on s'appuie sur le contrôle manuel + les tests Jest existants.
- **Tests unitaires existants** : préserver la passrate sur `extension/__tests__/sidepanel/views/HomeView.test.tsx` et les composants déjà polish (PR #151).
- **Pas de nouveau test demandé** dans cette spec. Si une régression surface en prod, on itère.

## 6 · Risks & mitigations

| Risk                                                    | Likelihood | Mitigation                                                                 |
| ------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Le refactor casse le polling de status d'analyse        | Moyen      | Garder la même `apiClient.getTaskStatus` ; juste déplacer l'appel de MainView vers AnalysisView. Smoke test étape 2. |
| ChatView attend un contexte qui était dans MainView     | Moyen      | Auditer les props ChatView au passage, passer ce qu'il faut depuis App.tsx. Pas de logique nouvelle. |
| Le drag manuel de la sidebar casse à certaines largeurs | Faible     | Le scroll fix utilise `flex: 1; min-height: 0` qui s'adapte naturellement. Tester à 280px (min OS) et à 700px (large). |
| Erreurs `chrome.tabs.create` en MV3                     | Faible     | URLs internes (`chrome-extension://...`) ne nécessitent pas de permission. Vérifier dans le manifest qu'on a au moins la permission de base. |
| Tests Jest cassent à cause de mocks MainView            | Moyen      | Étape 3 supprime les tests obsolètes en même temps que le fichier. Pas de tentative de garder MainView "pour la compat". |

## 7 · Déploiement

- Branche : `feat/sidepanel-nav-refactor`, partant de `main` après merge de PR #151 (polish UI). Si PR #151 toujours en review au moment de démarrer l'implémentation : on rebase au moment du merge.
- Extension : pas d'auto-deploy (contrairement au backend Hetzner). Cycle = `npm run build` local + reload dans `chrome://extensions`.
- Pas de soumission Chrome Web Store dans ce sprint (l'extension n'est pas encore soumise — c'est un known issue séparé).

## 8 · Hors scope (pour mémoire)

Repris du brainstorming, signalés ici pour ne pas être perdus :

- **Refonte navigation produit** (tabs / bottom bar / breadcrumbs / header sticky enrichi).
- **Viewer plein écran enrichi** : modes lecture / debate / comparaison côte-à-côte de 2 analyses.
- **Memoization du polling pendant analyses longues** : actuellement `setInterval` brut dans MainView, à revoir si on observe des leaks.
- **Internalisation de l'erreur** : aujourd'hui certains messages d'erreur sont en français hardcodé dans MainView, à passer à `t.errors.*` lors de l'extraction étape 3.

---

Spec complète. Prochain step : `superpowers:writing-plans` pour décomposer en plan d'implémentation TDD task-by-task.
