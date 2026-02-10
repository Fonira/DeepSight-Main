# DeepSight Extension Chrome - Plan de Refonte Complet

> **Date** : Fevrier 2026
> **Auteur** : Senior Frontend Architect
> **Version cible** : 2.0.0

---

## 1. AUDIT DE L'ARCHITECTURE ACTUELLE

### 1.1 Informations Generales

| Champ | Valeur |
|-------|--------|
| **Manifest** | v3 (Chrome Manifest V3) |
| **Version** | 1.1.0 |
| **Framework** | React 18.2 + TypeScript 5.4 |
| **Build** | Webpack 5.91 |
| **Nom** | "DeepSight - AI Video Analysis" |

### 1.2 Arborescence Actuelle

```
extension/
├── manifest.json                    # Chrome Manifest V3
├── package.json                     # npm config (React 18 + Webpack 5)
├── tsconfig.json                    # TypeScript config
├── webpack.config.js                # 5 entry points
│
├── icons/                           # Icones extension (PNG + SVG)
│   ├── icon16.png / icon16.svg
│   ├── icon32.png / icon32.svg
│   ├── icon48.png / icon48.svg
│   └── icon128.png / icon128.svg
│
├── src/
│   ├── background/                  # Service Worker
│   │   ├── index.ts                 (229 lignes) - Router de messages, alarms, auth
│   │   └── api.ts                   (140+ lignes) - Client API avec auto-refresh
│   │
│   ├── content/                     # Content Script YouTube
│   │   └── index.ts                 (665 lignes) - Injection DOM, UI sidebar, chat
│   │
│   ├── popup/                       # Popup React
│   │   ├── index.tsx                - Point d'entree React
│   │   ├── App.tsx                  (98 lignes) - State container + routing
│   │   ├── popup.html               - Shell HTML
│   │   └── components/
│   │       ├── LoginView.tsx        - Login email/password + Google
│   │       ├── MainView.tsx         - Dashboard utilisateur
│   │       ├── HistoryView.tsx      - Historique des analyses
│   │       └── SettingsView.tsx     - Parametres
│   │
│   ├── authSync/
│   │   └── index.ts                 (27 lignes) - ISOLATED world relay
│   │
│   ├── authSyncMain/
│   │   └── index.ts                 (30 lignes) - MAIN world sync
│   │
│   ├── styles/
│   │   ├── popup.css                (963 lignes) - Styles popup complets
│   │   └── content.css              (963 lignes) - Styles sidebar YouTube
│   │
│   ├── types/
│   │   └── index.ts                 (140 lignes) - Interfaces TypeScript
│   │
│   └── utils/
│       ├── config.ts                - URLs API + OAuth config
│       ├── storage.ts               - Helpers Chrome Storage
│       ├── youtube.ts               - Extraction Video ID
│       └── sanitize.ts              (280+ lignes) - Sanitization HTML + Markdown
│
└── dist/                            # Build output
    ├── background.js, content.js, popup.js, authSync.js, authSyncMain.js
    ├── content.css, popup.css
    ├── popup.html, manifest.json
    └── icons/
```

### 1.3 Points d'Entree Webpack (5 bundles)

| Bundle | Fichier | Role |
|--------|---------|------|
| `background.js` | `src/background/index.ts` | Service Worker (API, auth, alarms) |
| `content.js` | `src/content/index.ts` | Injection sidebar YouTube |
| `authSync.js` | `src/authSync/index.ts` | Relais auth (ISOLATED world) |
| `authSyncMain.js` | `src/authSyncMain/index.ts` | Sync auth (MAIN world) |
| `popup.js` | `src/popup/index.tsx` | UI React du popup |

### 1.4 Fonctionnalites Actuelles

**Service Worker :**
- Message routing (popup <-> background)
- Gestion tokens JWT (access 15min + refresh 7j)
- Auto-refresh token via chrome.alarms (14min)
- Delegation API avec injection Bearer token
- Polling de progression d'analyse

**Content Script YouTube :**
- Detection theme YouTube (dark/light)
- Extraction metadata video
- Injection carte sidebar dans `#secondary-inner`
- Affichage resultats avec rendu Markdown
- Points cles avec marqueurs epistemiques
- Navigation timestamps (seek video)
- Modal Q&A (chat contextuel)
- Login inline (email + Google redirect)

**Popup React :**
- 4 vues : Loading -> Login -> Main -> History/Settings
- Avatar + username + badge plan
- Barre de credits
- Actions rapides (Analyze, History)
- Analyses recentes avec thumbnails
- Parametres (mode, langue, notifications)

**Auth Sync (cross-origin) :**
- MAIN world ecoute les events auth du site web
- ISOLATED world relaye vers le service worker
- Validation d'origine securisee

### 1.5 Problemes Identifies

| # | Probleme | Severite |
|---|----------|----------|
| 1 | **Content script monolithique** - 665 lignes de DOM manipulation imperative | Critique |
| 2 | **Pas de composants React dans content script** - tout en `innerHTML` | Critique |
| 3 | **Duplication CSS** - popup.css et content.css partagent des tokens sans source commune | Majeur |
| 4 | **Pas de design system unifie** - couleurs hardcodees, inconsistances entre popup et content | Majeur |
| 5 | **Google OAuth non configure** - Client ID vide dans config.ts | Majeur |
| 6 | **Pas de tests** - zero test unitaire ou E2E | Majeur |
| 7 | **Pas de state management** - useState brut dans App.tsx | Mineur |
| 8 | **Pas d'internationalisation** - textes hardcodes en anglais | Mineur |
| 9 | **Spinner CSS basique** - pas le DeepSight spinner cosmique | Cosmetique |
| 10 | **Pas d'animations premium** - stagger basique, pas de glassmorphism reel | Cosmetique |

---

## 2. ASSETS WEB A REUTILISER

### 2.1 Logo DeepSight (Compass Rose Cosmique)

| Asset | Chemin | Format | Taille |
|-------|--------|--------|--------|
| Logo principal | `frontend/public/deep-sight-logo.png` | PNG 512x512 | 2.1 MB |
| Logo standard | `frontend/public/logo.png` | PNG | 94 KB |
| Logo dark | `frontend/public/logo-dark.png` | PNG | 94 KB |
| Logo dark bg | `frontend/public/logo-dark-bg.png` | PNG | 94 KB |
| Logo original | `frontend/public/logo-original.png` | PNG | 950 KB |

### 2.2 Spinner DeepSight

| Asset | Chemin | Usage |
|-------|--------|-------|
| Spinner cosmic flames | `frontend/public/spinner-cosmic.jpg` | Fond fixe (800x800) |
| Spinner wheel | `frontend/public/spinner-wheel.jpg` | Roue rotative (1024x1024) |
| Composant React | `frontend/src/components/ui/DeepSightSpinner.tsx` | Logique d'animation |
| Composant Loading | `frontend/src/components/LoadingSpinner.tsx` | Variantes + progress bar |

**SVG Fallback Spinner (gradient tricolore) :**
```
Bleu:   #5B8DB8 (0%)
Gold:   #C4935A (50%)
Violet: #6B4380 (100%)
```

### 2.3 Icones PWA (pour favicon extension)

| Taille | Chemin |
|--------|--------|
| 72x72 | `frontend/public/icons/icon-72x72.png` |
| 96x96 | `frontend/public/icons/icon-96x96.png` |
| 128x128 | `frontend/public/icons/icon-128x128.png` |
| 144x144 | `frontend/public/icons/icon-144x144.png` |
| 192x192 | `frontend/public/icons/icon-192x192.png` |
| 512x512 | `frontend/public/icons/icon-512x512.png` |

### 2.4 Design Tokens Web

**Fichier principal** : `frontend/src/index.css` (1131 lignes)
**Fichier TS** : `frontend/src/styles/design-tokens.ts`
**Tailwind config** : `frontend/tailwind.config.js`

### 2.5 Composants UI Web (reference)

| Composant | Chemin Web | A adapter pour extension |
|-----------|------------|--------------------------|
| Button | `frontend/src/components/Button.tsx` | Oui - variantes primary/secondary/ghost |
| Card | `frontend/src/components/Card.tsx` | Oui - glass + elevated |
| Input | `frontend/src/components/Input.tsx` | Oui - floating label |
| Badge | `frontend/src/components/Badge.tsx` | Oui - plans colors |
| Modal | `frontend/src/components/Modal.tsx` | Oui - pour chat |
| Toggle | `frontend/src/components/ui/Toggle.tsx` | Oui - settings |
| Skeleton | `frontend/src/components/ui/Skeleton.tsx` | Oui - shimmer loading |
| Tooltip | `frontend/src/components/ui/Tooltip.tsx` | Oui - hover info |
| ThemeToggle | `frontend/src/components/ThemeToggle.tsx` | Non - YouTube sync |
| DeepSightSpinner | `frontend/src/components/ui/DeepSightSpinner.tsx` | Oui - loading states |

---

## 3. PALETTE DE COULEURS EXTRAITE

### 3.1 Couleurs Principales (Dark Mode - Default)

```css
/* Fond */
--ds-bg-primary:     #0a0a0f;     /* Deep black */
--ds-bg-secondary:   #12121a;     /* Almost black */
--ds-bg-tertiary:    #1a1a24;     /* Dark slate */
--ds-bg-elevated:    #1e1e2a;     /* Elevated surface */

/* Texte */
--ds-text-primary:   #f5f5f7;     /* Off-white */
--ds-text-secondary: #a1a1b5;     /* Medium gray */
--ds-text-tertiary:  #6b6b80;     /* Darker gray */
--ds-text-muted:     #45455a;     /* Muted */

/* Accents */
--ds-accent-blue:    #3b82f6;     /* Primary Blue */
--ds-accent-indigo:  #6366f1;     /* Electric Indigo (web primary) */
--ds-accent-violet:  #8b5cf6;     /* Purple */
--ds-accent-cyan:    #06b6d4;     /* Cyan/Teal */

/* Semantique */
--ds-success:        #22c55e;     /* Green */
--ds-warning:        #f59e0b;     /* Amber */
--ds-error:          #ef4444;     /* Red */

/* Glass */
--ds-glass-bg:       rgba(255, 255, 255, 0.05);
--ds-glass-border:   rgba(255, 255, 255, 0.10);
--ds-glass-strong:   rgba(17, 17, 24, 0.8);

/* Bordures */
--ds-border-subtle:  rgba(255, 255, 255, 0.04);
--ds-border-default: rgba(255, 255, 255, 0.08);
--ds-border-strong:  rgba(255, 255, 255, 0.12);
--ds-border-accent:  rgba(99, 102, 241, 0.3);

/* Ombres & Glow */
--ds-shadow-sm:      0 2px 4px rgba(0, 0, 0, 0.4);
--ds-shadow-md:      0 4px 16px rgba(0, 0, 0, 0.5);
--ds-shadow-glow:    0 0 40px rgba(99, 102, 241, 0.35);
--ds-glow-violet:    0 0 40px rgba(139, 92, 246, 0.3);
--ds-glow-cyan:      0 0 40px rgba(6, 182, 212, 0.3);

/* Gradients */
--ds-gradient-primary: linear-gradient(135deg, #3b82f6, #8b5cf6);
--ds-gradient-indigo:  linear-gradient(135deg, #6366f1, #8b5cf6);
--ds-gradient-warm:    linear-gradient(90deg, #4A7BA7, #C4935A, #6B4380);
```

### 3.2 Couleurs Light Mode

```css
--ds-bg-primary:     #fafafa;
--ds-bg-elevated:    #ffffff;
--ds-text-primary:   #111118;
--ds-text-secondary: #6b7280;
--ds-accent-indigo:  #4f46e5;
--ds-border-default: rgba(0, 0, 0, 0.08);
```

### 3.3 Couleurs Specifiques Plans

| Plan | Couleur |
|------|---------|
| Free | `#6b7280` (gray) |
| Student | `#3b82f6` (blue) |
| Starter | `#8b5cf6` (violet) |
| Pro | `#f59e0b` (amber) |
| Team | `#06b6d4` (cyan) |

### 3.4 Marqueurs Epistemiques

| Marqueur | Background | Text Color |
|----------|------------|------------|
| SOLIDE | `rgba(34,197,94,0.12)` | `#4ade80` |
| PLAUSIBLE | `rgba(99,102,241,0.12)` | `#a5b4fc` |
| INCERTAIN | `rgba(245,158,11,0.12)` | `#fbbf24` |
| A VERIFIER | `rgba(239,68,68,0.12)` | `#f87171` |

---

## 4. NOUVELLE ARCHITECTURE PROPOSEE

### 4.1 Stack Technique

| Categorie | Actuel | Nouveau | Raison |
|-----------|--------|---------|--------|
| Framework | React 18 + Webpack | **React 18 + Vite** | Build 10x plus rapide, HMR, aligne avec le frontend web |
| CSS | CSS pur (2 fichiers) | **Tailwind CSS 3** | Coherence avec le frontend web, utility-first |
| State | useState brut | **Zustand** | Leger, aligne avec frontend web, persiste dans storage |
| Icones | Emojis | **Lucide React** | Icones SVG coherentes, tree-shakeable |
| Tests | Aucun | **Vitest + Testing Library** | Rapide, compatible Vite |
| Lint | Aucun | **ESLint + Prettier** | Qualite code |
| i18n | Hardcode EN | **i18next** | FR/EN/ES/DE comme le web |

### 4.2 Nouvelle Arborescence

```
extension/
├── manifest.json                          # Chrome Manifest V3 (inchange)
├── package.json                           # Deps mises a jour
├── vite.config.ts                         # Vite config avec multi-entry
├── tailwind.config.ts                     # Tailwind aligne avec frontend web
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
│
├── public/
│   ├── icons/                             # Icones extension (depuis frontend/public/icons)
│   │   ├── icon16.png
│   │   ├── icon32.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── assets/
│       ├── logo.png                       # Logo DeepSight (copie optimisee)
│       ├── logo-dark.png
│       ├── spinner-cosmic.jpg             # Spinner background
│       └── spinner-wheel.jpg              # Spinner wheel
│
├── src/
│   ├── shared/                            # Code partage entre popup et content
│   │   ├── design-tokens.ts               # Tokens aligne avec frontend/src/styles/design-tokens.ts
│   │   ├── constants.ts                   # Config, URLs, categories
│   │   ├── types.ts                       # Interfaces TypeScript
│   │   ├── i18n/
│   │   │   ├── index.ts                   # Config i18next
│   │   │   ├── fr.json
│   │   │   ├── en.json
│   │   │   ├── es.json
│   │   │   └── de.json
│   │   ├── hooks/
│   │   │   ├── useAuth.ts                 # Hook auth (message passing)
│   │   │   ├── useAnalysis.ts             # Hook analyse video
│   │   │   ├── useSettings.ts             # Hook settings
│   │   │   ├── useTheme.ts                # Hook theme (YouTube sync ou toggle)
│   │   │   └── useStorage.ts              # Hook chrome.storage reactif
│   │   ├── stores/
│   │   │   ├── authStore.ts               # Zustand auth state
│   │   │   ├── analysisStore.ts           # Zustand analysis state
│   │   │   └── settingsStore.ts           # Zustand settings state
│   │   └── utils/
│   │       ├── api.ts                     # Client API type-safe
│   │       ├── storage.ts                 # Chrome Storage helpers
│   │       ├── youtube.ts                 # Video ID extraction
│   │       ├── sanitize.ts                # HTML sanitization
│   │       └── format.ts                  # Date, credits formatting
│   │
│   ├── components/                        # Composants UI partages
│   │   ├── ui/
│   │   │   ├── Button.tsx                 # Variantes: primary, secondary, ghost, danger
│   │   │   ├── Card.tsx                   # Variantes: glass, elevated, interactive
│   │   │   ├── Input.tsx                  # Avec validation + floating label
│   │   │   ├── Badge.tsx                  # Plan badges colores
│   │   │   ├── Toggle.tsx                 # Switch on/off
│   │   │   ├── Select.tsx                 # Dropdown stylise
│   │   │   ├── Skeleton.tsx               # Loading shimmer
│   │   │   ├── Spinner.tsx                # DeepSight cosmic spinner
│   │   │   ├── ProgressBar.tsx            # Barre de progression
│   │   │   ├── Tooltip.tsx                # Hover tooltip
│   │   │   ├── Avatar.tsx                 # Avatar utilisateur
│   │   │   ├── EmptyState.tsx             # Etat vide
│   │   │   └── ErrorState.tsx             # Etat erreur
│   │   ├── EpistemicMarker.tsx            # Badges SOLIDE/PLAUSIBLE/etc.
│   │   ├── CreditsBar.tsx                 # Barre de credits avec gradient
│   │   ├── PlanBadge.tsx                  # Badge plan avec couleur
│   │   ├── VideoThumbnail.tsx             # Thumbnail avec overlay
│   │   └── TimestampLink.tsx              # Lien timestamp cliquable
│   │
│   ├── popup/                             # Popup UI (entry point #1)
│   │   ├── index.tsx                      # Mount React
│   │   ├── popup.html                     # Shell HTML
│   │   ├── App.tsx                        # Root avec router
│   │   ├── views/
│   │   │   ├── LoadingView.tsx            # Spinner cosmique
│   │   │   ├── LoginView.tsx              # Login avec logo anime
│   │   │   ├── DashboardView.tsx          # Dashboard principal (ex MainView)
│   │   │   ├── HistoryView.tsx            # Historique enrichi
│   │   │   ├── SettingsView.tsx           # Parametres complets
│   │   │   └── AnalysisView.tsx           # NOUVEAU: voir analyse en cours
│   │   └── components/
│   │       ├── PopupHeader.tsx            # Header avec avatar + actions
│   │       ├── QuickActions.tsx           # Grille d'actions rapides
│   │       ├── RecentList.tsx             # Liste analyses recentes
│   │       └── CreditCard.tsx             # Carte credits gradient
│   │
│   ├── content/                           # Content Script YouTube (entry point #2)
│   │   ├── index.tsx                      # Mount React dans Shadow DOM
│   │   ├── App.tsx                        # Root content app
│   │   ├── views/
│   │   │   ├── LoginCard.tsx              # Carte login inline
│   │   │   ├── AnalyzeCard.tsx            # Carte "Analyser cette video"
│   │   │   ├── ProgressCard.tsx           # Carte progression analyse
│   │   │   ├── ResultsCard.tsx            # Carte resultats analyse
│   │   │   └── ChatView.tsx               # Interface chat contextuel
│   │   └── components/
│   │       ├── SidebarCard.tsx            # Container carte sidebar
│   │       ├── SummarySection.tsx         # Rendu resume
│   │       ├── KeyPointsList.tsx          # Points cles avec markers
│   │       ├── DetailPanel.tsx            # Panel detail collapsible
│   │       ├── TagsList.tsx               # Tags / categories
│   │       └── ChatMessage.tsx            # Message chat individuel
│   │
│   ├── background/                        # Service Worker (entry point #3)
│   │   ├── index.ts                       # Message router + alarms
│   │   ├── api.ts                         # Client API avec retry
│   │   ├── auth.ts                        # Gestion tokens separee
│   │   └── notifications.ts               # Chrome notifications
│   │
│   ├── authSync/                          # Auth sync (entry points #4 & #5)
│   │   ├── isolated.ts                    # ISOLATED world
│   │   └── main.ts                        # MAIN world
│   │
│   └── styles/
│       ├── globals.css                    # @tailwind base/components/utilities
│       ├── content-inject.css             # Styles pour Shadow DOM
│       └── animations.css                 # Keyframes partages
│
├── tests/
│   ├── setup.ts                           # Config Vitest
│   ├── components/                        # Tests composants
│   ├── hooks/                             # Tests hooks
│   └── utils/                             # Tests utilitaires
│
└── scripts/
    ├── build.ts                           # Script build custom
    └── copy-assets.ts                     # Copie assets depuis frontend
```

### 4.3 Architecture des Flux

```
┌─────────────────────────────────────────────────────────────┐
│                      SERVICE WORKER                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Auth     │  │ API      │  │ Alarms   │  │ Notifica-   │ │
│  │ Manager  │  │ Client   │  │ Handler  │  │ tions       │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────────┘ │
│       │              │              │                         │
│       └──────────────┴──────────────┘                        │
│                      │ chrome.runtime.sendMessage            │
└──────────────────────┼───────────────────────────────────────┘
                       │
          ┌────────────┼────────────────┐
          │            │                │
   ┌──────▼──────┐ ┌──▼────────┐ ┌─────▼──────────┐
   │   POPUP     │ │  CONTENT  │ │   AUTH SYNC    │
   │   (React)   │ │  SCRIPT   │ │  (MAIN +       │
   │             │ │  (React   │ │   ISOLATED)    │
   │ Zustand     │ │  Shadow   │ │                │
   │ Store       │ │  DOM)     │ │ Website <->    │
   │             │ │           │ │ Extension      │
   └─────────────┘ └───────────┘ └────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   YOUTUBE DOM   │
              │ #secondary-inner│
              │ Shadow DOM Root │
              └─────────────────┘
```

### 4.4 Shadow DOM pour Content Script

Le content script utilisera un **Shadow DOM** pour isoler completement les styles React/Tailwind du site YouTube :

```tsx
// content/index.tsx
const host = document.createElement('div');
host.id = 'deepsight-root';
const shadow = host.attachShadow({ mode: 'closed' });

// Injecter Tailwind compile dans le Shadow DOM
const style = document.createElement('style');
style.textContent = compiledCSS; // Tailwind compile inline
shadow.appendChild(style);

// Mount React dans le Shadow DOM
const root = createRoot(shadow);
root.render(<ContentApp />);

// Injecter dans YouTube sidebar
const target = document.querySelector('#secondary-inner');
target?.prepend(host);
```

### 4.5 Zustand Store Architecture

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  syncFromStorage: () => Promise<void>;
}

// stores/analysisStore.ts
interface AnalysisState {
  currentAnalysis: TaskStatus | null;
  summary: Summary | null;
  recentAnalyses: RecentAnalysis[];
  isAnalyzing: boolean;
  startAnalysis: (videoId: string, options: AnalyzeOptions) => Promise<void>;
  pollStatus: (taskId: string) => Promise<void>;
  loadRecent: () => Promise<void>;
}

// stores/settingsStore.ts
interface SettingsState {
  settings: ExtensionSettings;
  theme: 'dark' | 'light' | 'auto';
  language: 'fr' | 'en' | 'es' | 'de';
  updateSettings: (partial: Partial<ExtensionSettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
}
```

---

## 5. LISTE DES COMPOSANTS A CREER

### 5.1 Composants UI de Base (shared)

| Composant | Priorite | Reference Web | Description |
|-----------|----------|---------------|-------------|
| `Button` | P0 | `frontend/src/components/Button.tsx` | 5 variantes, 4 tailles, loading state, icon |
| `Card` | P0 | `frontend/src/components/Card.tsx` | glass, elevated, interactive avec hover gradient |
| `Input` | P0 | `frontend/src/components/Input.tsx` | Floating label, validation, focus gradient |
| `Spinner` | P0 | `frontend/src/components/ui/DeepSightSpinner.tsx` | Cosmic spinner avec roue + flammes |
| `Badge` | P1 | `frontend/src/components/Badge.tsx` | Plan colors, epistemique markers |
| `Select` | P1 | - | Dropdown stylise (mode, langue) |
| `Toggle` | P1 | `frontend/src/components/ui/Toggle.tsx` | Switch avec animation |
| `Skeleton` | P1 | `frontend/src/components/ui/Skeleton.tsx` | Shimmer loading |
| `ProgressBar` | P1 | - | Credits + analyse progress |
| `Tooltip` | P2 | `frontend/src/components/ui/Tooltip.tsx` | Hover contextuel |
| `Avatar` | P2 | - | Initiale + image + gradient fallback |
| `EmptyState` | P2 | - | Illustration + message |
| `ErrorState` | P2 | - | Erreur + retry |

### 5.2 Composants Metier (popup)

| Composant | Priorite | Description |
|-----------|----------|-------------|
| `PopupHeader` | P0 | Avatar + nom + plan badge + boutons action |
| `CreditCard` | P0 | Gradient primary->violet, barre progress, count |
| `QuickActions` | P0 | Grid 2x2 actions (Analyser, Historique, Chat, Upgrade) |
| `RecentList` | P1 | Liste scrollable avec thumbnails + date relative |
| `LoginForm` | P0 | Email/pass + Google button + links |
| `SettingsPanel` | P1 | Mode, langue, notifications, theme |

### 5.3 Composants Metier (content script)

| Composant | Priorite | Description |
|-----------|----------|-------------|
| `SidebarCard` | P0 | Container avec header gradient + body |
| `LoginCard` | P0 | Login inline adapte YouTube |
| `AnalyzeCard` | P0 | Bouton analyser + options (mode, langue) |
| `ProgressCard` | P0 | Spinner + barre progress + status text |
| `ResultsCard` | P0 | Resume + score + verdict |
| `KeyPointsList` | P1 | Points cles avec markers epistemiques |
| `DetailPanel` | P1 | Collapsible markdown rendu |
| `ChatView` | P1 | Messages + input + historique |
| `ChatMessage` | P1 | Bulle user/bot avec markdown |
| `TimestampLink` | P1 | Lien cliquable seek video |
| `TagsList` | P2 | Pills categories/tags |
| `EpistemicMarker` | P1 | Badge SOLIDE/PLAUSIBLE/INCERTAIN/A VERIFIER |

### 5.4 Hooks Custom

| Hook | Priorite | Description |
|------|----------|-------------|
| `useAuth` | P0 | Login/logout/check via message passing |
| `useAnalysis` | P0 | Start/poll/results d'analyse |
| `useSettings` | P1 | CRUD settings chrome.storage |
| `useStorage` | P1 | Hook reactif chrome.storage.local |
| `useTheme` | P1 | Sync theme YouTube ou toggle |
| `useYouTube` | P1 | Video ID, metadata, navigation |
| `useChat` | P1 | Send/receive messages chat |

---

## 6. PLAN D'EXECUTION (Phases)

### Phase 1 : Setup & Infrastructure (2-3 jours)

- [ ] Migrer de Webpack vers Vite (vite-plugin-crx ou @crxjs/vite-plugin)
- [ ] Configurer Tailwind CSS avec les tokens du design system web
- [ ] Setup Zustand stores de base
- [ ] Setup i18next avec traductions FR/EN
- [ ] Setup Vitest + Testing Library
- [ ] Script de copie des assets depuis frontend/public/
- [ ] Configurer Shadow DOM pour content script

### Phase 2 : Design System & Composants UI (3-4 jours)

- [ ] Creer tous les composants UI de base (Button, Card, Input, etc.)
- [ ] Implementer le DeepSight Spinner cosmique
- [ ] Porter les animations (stagger, fadeIn, glow, shimmer)
- [ ] Creer les composants Badge, PlanBadge, EpistemicMarker
- [ ] Tester visuellement dans le popup

### Phase 3 : Popup Refonte (2-3 jours)

- [ ] Refaire LoginView avec logo anime + glassmorphism
- [ ] Refaire DashboardView avec CreditCard + QuickActions
- [ ] Refaire HistoryView avec thumbnails et animations
- [ ] Refaire SettingsView avec Toggle et Select
- [ ] Ajouter AnalysisView (nouvelle vue)
- [ ] Connecter aux Zustand stores

### Phase 4 : Content Script React (4-5 jours)

- [ ] Migrer content script de DOM imperatif vers React
- [ ] Implementer Shadow DOM isolation
- [ ] Creer SidebarCard container
- [ ] Creer LoginCard, AnalyzeCard, ProgressCard
- [ ] Creer ResultsCard avec KeyPoints + DetailPanel
- [ ] Creer ChatView avec messages
- [ ] Tester sur YouTube (dark + light mode)

### Phase 5 : Polish & QA (2-3 jours)

- [ ] Animations premium (micro-interactions, transitions entre vues)
- [ ] Tests unitaires (cible 80% coverage)
- [ ] Tests manuels sur YouTube
- [ ] Optimisation taille bundle
- [ ] Documentation mise a jour
- [ ] Version 2.0.0

---

## 7. DECISIONS TECHNIQUES

### 7.1 Pourquoi Vite au lieu de Webpack ?

- Build 10-50x plus rapide (esbuild + Rollup)
- HMR natif pour le developpement popup
- Aligne avec le frontend web (deja sur Vite)
- Plugin `@crxjs/vite-plugin` specifique Chrome extensions
- Config plus simple et maintenable

### 7.2 Pourquoi Tailwind au lieu de CSS pur ?

- Coherence totale avec le design system du frontend web
- Les memes classes produisent les memes resultats
- Utility-first reduit la duplication CSS
- Purge automatique = bundle CSS minimal
- Config partageable (`tailwind.config.ts`)

### 7.3 Pourquoi Shadow DOM pour le content script ?

- Isolation CSS complete : les styles YouTube n'affectent pas nos composants
- Nos styles Tailwind n'affectent pas YouTube
- React peut fonctionner normalement dans le Shadow DOM
- Eliminates le besoin de prefixer toutes les classes CSS

### 7.4 Pourquoi Zustand ?

- Deja utilise dans le frontend web
- 1.1 KB gzippe (leger pour une extension)
- Middleware `persist` compatible chrome.storage
- API simple, pas de boilerplate
- Compatible React 18 concurrent features

### 7.5 Couleur primaire : `#3b82f6` (Blue) vs `#6366f1` (Indigo) ?

Le popup utilise `#3b82f6` et le content script `#6366f1`. La refonte **unifiera sur `#6366f1` (Indigo)** comme couleur primaire, alignee avec le frontend web qui utilise `--accent-primary: #6366f1`. Le bleu `#3b82f6` restera disponible comme couleur secondaire.

---

## 8. RISQUES & MITIGATIONS

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Shadow DOM + Tailwind complexe | Moyen | Prototype early, tester sur YouTube reel |
| Bundle size augmente (React dans content) | Moyen | Code splitting, lazy loading, purge Tailwind |
| @crxjs/vite-plugin incompatibilites | Faible | Fallback vers rollup-plugin-chrome-extension |
| YouTube change sa structure DOM | Faible | MutationObserver robuste, selecteurs de fallback |
| Regression fonctionnelle | Moyen | Tests E2E, checklist manuelle, beta testers |

---

*Ce document sera mis a jour au fur et a mesure de l'avancement de la refonte.*
