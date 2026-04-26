# Extension Chrome DeepSight — Refactor SidePanel v3.0

**Date** : 2026-04-26
**Auteur** : Claude (Senior Tech Lead) + Maxime
**Branche cible** : `feat/extension-sidepanel-v3` (à créer depuis main au début de la PR 1)
**Statut** : Spec validée, en attente du plan d'implémentation

---

## 1. Contexte et problème

### Mode actuel (v2.x)

L'extension DeepSight est aujourd'hui composée de :

- **Popup classique** (400×500-600px) : ouverte au clic sur l'icône, contient 12+ composants React (`MainView` 729L, `ChatDrawer` 389L, `ResultsView` 116L, `SynthesisView` 545L).
- **Widget on-page** : injecté directement dans YouTube/TikTok via Shadow DOM (`content/index.ts` 757L + `widget.ts` 291L + state machine `login/ready/analyzing/results/chat` ~1500L total).
- **Background service worker** (714L, robuste) : auth Google OAuth, polling analyse, 15+ actions messaging.
- **Travail SidePanel WIP non finalisé** : `useExtensionVoiceChat.ts` (90L) + 1 test cassé qui importe un `voiceMessages.ts` inexistant + artefacts `dist/sidepanel.*` orphelins.

### Vision cible

Reproduire l'expérience "Claude in Chrome" : une **sidebar latérale droite** ouverte par clic sur l'icône extension (et fermée au reclic), affichant l'intégralité de DeepSight sur **toute la hauteur** de la fenêtre, **sans aucune injection sur YouTube**.

---

## 2. Décisions verrouillées

| #   | Question                             | Décision                                                                                                                                 |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Affichage on-page sur YouTube/TikTok | **A — Suppression totale**. Toggle exclusivement via clic icône (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`). |
| Q2a | Hors YouTube/TikTok                  | **B — QG permanent** : sidebar partout. Hors YT/TT = historique récent + input URL manuel + gestion compte.                              |
| Q2b | Popup actuelle                       | **X — Suppression complète**. `action.default_popup` retiré, `src/popup/` supprimé, composants migrent vers sidebar.                     |
| Q3a | Largeur sidebar initiale             | **B — 480px**. Min-width 380px.                                                                                                          |
| Q3b | Stratégie composants                 | **B — Move complet `popup/` → `sidepanel/`** + split `MainView.tsx` (729L → 4 sous-composants).                                          |
| Q4a | Cross-browser                        | **A — Chrome only en v1**. FF/Safari conservent popup.                                                                                   |
| Q4b | Voice chat WIP                       | **A — Out of scope**. Branche/PR séparée.                                                                                                |

---

## 3. Architecture cible

```
AVANT (v2.x)                          APRÈS (v3.0)
┌──────────┐ ┌──────────────┐         ┌─────────────┐ ┌───────────────┐
│ Popup    │ │ Content      │         │ SidePanel   │ │ Content léger │
│ 400×600  │ │ Shadow DOM   │   →     │ 480px wide  │ │ ~80 lignes    │
│ (12 cmp) │ │ on YT/TT     │         │ Full-height │ │ URL detect    │
└──────────┘ │ ~1500 lignes │         │ (12 cmp     │ │ only, no UI   │
             └──────────────┘         │  splittés)  │ └───────────────┘
                                      └─────────────┘
+ Background SW 714L (inchangé, +3 ajouts ciblés)
```

---

## 4. Changements détaillés

### 4.1 Manifest (`extension/public/manifest.json`)

```diff
+ "minimum_chrome_version": "114",
  "permissions": [
    "storage", "activeTab", "tabs", "alarms", "identity", "clipboardWrite",
+   "sidePanel"
  ],
- "action": { "default_popup": "popup.html", "default_icon": {...} },
+ "action": { "default_icon": {...} },
+ "side_panel": { "default_path": "sidepanel.html" },
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*", "*://*.tiktok.com/*", ...],
      "js": ["content.js"],
-     "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [{
-   "resources": ["icons/*", "assets/*", "platforms/*", "widget.css", "content.css", "tokens.css"]
+   "resources": ["icons/*", "assets/*", "tokens.css"]
  }]
```

`manifest.firefox.json` et `manifest.safari.json` : **inchangés** (popup conservée pour FF/Safari).

### 4.2 Service worker (`src/background.ts`)

3 ajouts ciblés (les 714 lignes existantes intactes) :

```typescript
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.error("[deepsight] setPanelBehavior failed", err));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ action: "TAB_CHANGED", tabId }).catch(() => {});
});

case "URL_CHANGED": {
  chrome.runtime.sendMessage({
    action: "VIDEO_URL_UPDATED",
    payload: message.payload
  }).catch(() => {});
  return false;
}
```

Action `OPEN_POPUP` → renommée `OPEN_SIDEPANEL` (`chrome.sidePanel.open({ tabId })`).

### 4.3 Content script light (`src/content/index.ts`)

757L → ~80L. Mission unique : observer changements URL YouTube/TikTok (SPA `history.pushState`) + notifier background.

```typescript
import { detectPlatform } from "../utils/video";

let lastUrl = location.href;
const notifyUrlChange = () => {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;
  chrome.runtime
    .sendMessage({
      action: "URL_CHANGED",
      payload: { url, platform: detectPlatform(url) },
    })
    .catch(() => {});
};

let throttleTimer: number | null = null;
const throttledNotify = () => {
  if (throttleTimer !== null) return;
  throttleTimer = window.setTimeout(() => {
    notifyUrlChange();
    throttleTimer = null;
  }, 500);
};

new MutationObserver(throttledNotify).observe(document, {
  subtree: true,
  childList: true,
});
window.addEventListener("popstate", notifyUrlChange);
notifyUrlChange();
```

**Suppressions** : `widget.ts` (291L), `states/*.ts` (~700L), `widget.css`, Shadow DOM helpers, instrumentation. **~1500 lignes total**.

### 4.4 Structure `src/sidepanel/`

```
src/sidepanel/
├── index.tsx                   # entry webpack (Preact mount)
├── App.tsx                     # router (loading | login | main)
├── views/
│   ├── HomeView.tsx            # NOUVEAU — split MainView. Dual mode (QG / vidéo)
│   ├── AnalysisView.tsx        # ← move de popup/components/ (503L)
│   ├── ResultsView.tsx         # ← move (116L)
│   ├── ChatView.tsx            # ← rename ChatDrawer
│   └── LoginView.tsx           # ← move (245L)
├── components/                 # NOUVEAU — split MainView 729L → 4 fichiers
│   ├── RecentsList.tsx         # historique (cap 20)
│   ├── VideoDetectedCard.tsx   # carte vidéo YT/TT + bouton "Analyser"
│   ├── UrlInputCard.tsx        # input URL manuel
│   ├── PlanBadge.tsx           # plan + crédits
│   └── PromoBanner.tsx         # ← move
├── shared/
│   ├── Icons.tsx               # ← move
│   ├── DeepSightSpinner.tsx    # ← move
│   ├── MicroDoodleBackground.tsx  # ← move
│   ├── SynthesisView.tsx       # ← move (545L)
│   ├── FeatureCTAGrid.tsx      # ← move
│   └── doodles/
├── hooks/
│   ├── useCurrentTab.ts        # NOUVEAU — souscrit TAB_CHANGED + VIDEO_URL_UPDATED
│   ├── useAuth.ts
│   └── useAnalysis.ts
└── styles/
    └── sidepanel.css
```

**Suppressions** : `src/popup.tsx`, `src/popup/`, `src/styles/popup.css`, `public/popup.html`.

### 4.5 Layout / CSS

```css
/* sidepanel.css */
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  background: #0a0a0f;
  color: #f5f5f7;
  font-family:
    "Inter",
    -apple-system,
    sans-serif;
}
#root {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidepanel-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  min-width: 0;
}
```

`public/sidepanel.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="tokens.css" />
    <link rel="stylesheet" href="sidepanel.css" />
    <title>DeepSight</title>
  </head>
  <body style="width: 480px; min-width: 380px;">
    <div id="root"></div>
    <script src="sidepanel.js"></script>
  </body>
</html>
```

> Chrome utilise `width` du body pour la largeur initiale (480px = parité Claude). User peut redimensionner par drag, Chrome persiste per-extension. `min-width: 380px` empêche squeeze trop agressif.

### 4.6 Webpack

```diff
  entry: {
    background: "./src/background.ts",
    content: "./src/content/index.ts",
    authSync: "./src/authSync/index.ts",
    authSyncMain: "./src/authSync/main.ts",
-   popup: "./src/popup.tsx",
+   sidepanel: "./src/sidepanel/index.tsx",
    viewer: "./src/viewer.tsx",
  },
  plugins: [
-   new HtmlWebpackPlugin({ template: "./public/popup.html", filename: "popup.html", chunks: ["popup"] }),
+   new HtmlWebpackPlugin({ template: "./public/sidepanel.html", filename: "sidepanel.html", chunks: ["sidepanel"] }),
  ]
```

### 4.7 Tests

| Existant                               | Action                                              |
| -------------------------------------- | --------------------------------------------------- |
| `Popup.test.tsx`                       | Renommer → `__tests__/sidepanel/App.test.tsx`       |
| `content/widget.test.ts`               | Supprimer                                           |
| `content/boot.test.ts`                 | Réécrire pour content léger (URL detect + throttle) |
| `content/boot-instrumentation.test`    | Supprimer                                           |
| `content/__tests__/coexistence.test`   | Supprimer                                           |
| `content/__tests__/theme.test`         | Supprimer                                           |
| `sidepanel/useExtensionVoiceChat.test` | `.skip` (out of scope voice)                        |

**Nouveaux** :

- `sidepanel/App.test.tsx`
- `sidepanel/hooks/useCurrentTab.test.ts`
- `sidepanel/views/HomeView.test.tsx`
- `sidepanel/components/{RecentsList,VideoDetectedCard,UrlInputCard}.test.tsx`
- `content/url-detect.test.ts`
- `background/sidepanel-toggle.test.ts`

**Couverture cible** : >80% sur `src/sidepanel/`.

---

## 5. Découpage en PRs

| PR  | Titre                                                        | Lignes ±     | Risque   |
| --- | ------------------------------------------------------------ | ------------ | -------- |
| 1   | `feat(ext): manifest sidePanel + service worker toggle`      | +50 / -30    | 🟢 Bas   |
| 2   | `refactor(ext): rename popup → sidepanel + webpack reconfig` | +200 / -200  | 🟢 Bas   |
| 3   | `feat(ext): HomeView + split MainView + URL detect content`  | +600 / -1500 | 🟡 Moyen |
| 4   | `chore(ext): cleanup widget Shadow DOM + dist orphelins`     | -800         | 🟢 Bas   |

PR 1 — manifest + setPanelBehavior + relay messages. Test : sidebar ouvre/ferme au clic icône.
PR 2 — pure refactor structure. Sidebar existe mais layout popup encore. Test : build OK.
PR 3 — HomeView dual mode, split MainView, content light, sync useCurrentTab. Test E2E flow complet.
PR 4 — suppression code mort. Test : build clean, bundle size réduit.

---

## 6. Risques et mitigations

| Risque                                   | Mitigation                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| SW s'endort, sidebar perd sync           | Réveil via `chrome.runtime.sendMessage` ; alarme keepAlive 30s déjà en place |
| Reload extension casse session           | Auth dans `chrome.storage.local`, restauration au mount                      |
| Chrome < 114 pas de sidePanel            | `"minimum_chrome_version": "114"` dans manifest                              |
| YouTube SPA cassé MutationObserver       | Double détection : popstate + MutationObserver throttled 500ms               |
| Voice WIP `voiceMessages.ts` casse build | Hook exclu via tsconfig `exclude`. Test `.skip` jusqu'à PR voice.            |
| Régression v2.x → v3.0                   | Migration douce : message in-sidebar au premier launch v3                    |

---

## 7. Critères d'acceptation

- [ ] `npm run build` produit `dist/sidepanel.{html,js,css}` cohérents
- [ ] Manifest charge dans Chrome 114+ sans erreur
- [ ] Clic icône → sidebar ouvre, deuxième clic → ferme
- [ ] Sur YouTube : sidebar détecte vidéo courante, "Analyser" lance flow
- [ ] Hors YouTube/TikTok : sidebar affiche historique + input URL + état compte
- [ ] **Aucune UI injectée dans YouTube** (`document.querySelector("#deepsight-host")` retourne `null`)
- [ ] Toutes fonctionnalités existantes OK : login, analyse, synthèse, chat, quick chat, recents, share
- [ ] `npm test` passe (≥80% couverture sur `src/sidepanel/`)
- [ ] Bundle size plus petit que v2.x
- [ ] Sentry : 0 erreur critique sur 24h après release interne

---

## 7bis. Addendum 2026-04-27 — `SuggestionPills` (option 3 hybride)

Suite à un brainstorming complémentaire (« inspiration Claude in Chrome » poussée plus loin côté UX), un seul ajout chat-first est intégré au socle v3 : un composant `SuggestionPills` rendu **sous `VideoDetectedCard`** dans `HomeView` mode vidéo.

### Objectif

Donner à l'utilisateur des actions contextuelles cliquables dès la détection d'une vidéo, sans imposer un parcours linéaire « Analyser → ResultsView → ChatView ». Les pills accélèrent les actions courantes et donnent un signal Claude-like.

### Composant

`extension/src/sidepanel/components/SuggestionPills.tsx` — chips horizontales (3 max), affichées uniquement quand `currentTab.platform ∈ {youtube, tiktok}` ET vidéo détectée.

```tsx
type Suggestion = { id: string; label: string; icon?: string; onTrigger: () => void };

interface Props {
  suggestions: Suggestion[];
}

export function SuggestionPills({ suggestions }: Props): JSX.Element { ... }
```

### Set de pills v1

| Pill                | Action                             | Comportement                                                                         |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| 🧠 Résumé rapide    | équivalent au bouton « Analyser »  | déclenche `onAnalyze()` (raccourci, pas une feature distincte)                       |
| 🎴 Créer flashcards | CTA web                            | ouvre `https://www.deepsightsynthesis.com/study/{video_id}` dans un nouvel onglet    |
| 🔍 Voir sources     | CTA web (si analyse déjà en cache) | ouvre l'app web sur la section sources de l'analyse — masqué si pas de cache backend |

### Wiring

`HomeView` (Task 16 du plan) reçoit en props la liste de suggestions calculée à partir de `videoMeta` et `cacheStatus`. `HomeView` rend `<SuggestionPills suggestions={...} />` immédiatement sous `<VideoDetectedCard ... />` en mode vidéo détectée.

### Hors scope de l'addendum

Pas de slash commands dans `ChatView`. Pas de variantes de `Message` (synthesis/cta/system). Pas de refonte chat-first du flux principal. Ces idées sont reportées à une éventuelle v3.x ultérieure si la métrique « clic sur pill » justifie l'investissement.

### Impact sur le plan d'implémentation

- Nouveau fichier : `extension/src/sidepanel/components/SuggestionPills.tsx`
- Nouveau test : `extension/__tests__/sidepanel/components/SuggestionPills.test.tsx`
- Nouvelle Task **16.5** insérée dans PR 3, entre Task 16 (`HomeView` assemblage) et Task 17 (content script light).
- Aucune modification de Q1-Q4b — toutes les décisions verrouillées restent valides.

---

## 8. Hors scope (roadmap v3.x+)

- Voice chat ElevenLabs : branche séparée, intégrée après merge v3.0
- Sidebar Firefox / Safari : v3.0 = Chrome only. FF aura PR dédiée plus tard (`sidebar_action`)
- Resize persistant cross-machines : Chrome local only, pas de sync cloud
- Drag-and-drop URL dans sidebar : nice-to-have v3.1
- Mode multi-onglets : nécessite re-design store, hors scope v3.0

---

## 9. Liens

- **Plan d'implémentation** : à générer via `superpowers:writing-plans`
- **Documents Chrome** :
  - https://developer.chrome.com/docs/extensions/reference/api/sidePanel
  - https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-setPanelBehavior
