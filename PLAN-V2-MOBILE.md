# DeepSight Mobile V2 — Plan d'Action Complet

**Date** : Février 2026
**Auteur** : Senior Tech Lead
**Scope** : Refonte complète du frontend mobile Expo/React Native

---

## 1. Audit Comparatif Web vs Mobile

### 1.1 Matrice des fonctionnalités

| Fonctionnalité                                  | Web                                  | Mobile V1  | Mobile V2    | Justification                               |
| ----------------------------------------------- | ------------------------------------ | ---------- | ------------ | ------------------------------------------- |
| **Analyse vidéo YouTube**                       | ✅                                   | ✅         | ✅ CORE      | Cœur du produit                             |
| **Chat contextuel**                             | ✅                                   | ✅         | ✅ CORE      | Valeur ajoutée principale                   |
| **Historique analyses**                         | ✅ Full (search, grid/list, filters) | ✅ Full    | ✅ Simplifié | Recherche + scroll infini, pas de grid view |
| **Flashcards**                                  | ✅                                   | ✅         | ✅ CORE      | Fort engagement mobile                      |
| **Quiz**                                        | ✅                                   | ✅         | ✅ CORE      | Fort engagement mobile                      |
| **Export PDF/MD**                               | ✅                                   | ✅         | ✅ Simplifié | Share sheet natif, 1 clic                   |
| **Favoris**                                     | ✅                                   | ✅         | ✅           | Simple toggle                               |
| **Upgrade/Plans**                               | ✅ Full pricing table                | ✅ Full    | ✅ Simplifié | 1 écran card-based, pas de matrice          |
| **Profil/Compte**                               | ✅                                   | ✅         | ✅           | Allégé                                      |
| **Google OAuth**                                | ✅                                   | ✅         | ✅           | Inchangé                                    |
| **Notifications push**                          | ❌                                   | ✅         | ✅           | Avantage mobile                             |
| **Mode hors-ligne**                             | ❌                                   | ✅         | ✅ Amélioré  | Cache intelligent                           |
| **Deep linking**                                | ❌                                   | ✅         | ✅           | Partage URL                                 |
| **--- RETIRÉS DU MOBILE V2 ---**                |                                      |            |              |                                             |
| Customization avancée (mode, catégorie, modèle) | ✅                                   | ✅         | ❌ RETIRÉ    | Trop complexe pour mobile, smart defaults   |
| Playlists (création/gestion)                    | ✅                                   | ⚠️ Partiel | ❌ RETIRÉ    | Feature power-user → web only               |
| Chat corpus (playlist)                          | ✅                                   | ✅         | ❌ RETIRÉ    | Lié aux playlists                           |
| Sources académiques/Bibliographie               | ✅                                   | ✅         | ❌ RETIRÉ    | Niche, mieux sur grand écran                |
| Mind Maps                                       | ✅                                   | 🚫 Stub    | ❌ RETIRÉ    | Illisible sur petit écran                   |
| Admin Panel                                     | ✅                                   | ❌         | ❌           | Web only par nature                         |
| Analytics détaillés (graphiques)                | ✅                                   | ✅         | ❌ RETIRÉ    | Remplacé par usage simple                   |
| Fact-check complet                              | ✅                                   | ✅         | ⚠️ Simplifié | Badge fiabilité oui, panneau complet non    |
| TTS Player                                      | ✅                                   | ✅         | ⚠️ Optionnel | Gardé si demande, pas prioritaire           |
| Tournesol widget                                | ✅                                   | ✅         | ❌ RETIRÉ    | Niche                                       |
| Recherche vidéo (Discovery)                     | ✅                                   | ✅         | ❌ RETIRÉ    | L'utilisateur colle une URL, c'est tout     |
| Page de contact                                 | ✅                                   | ✅         | ❌ RETIRÉ    | Lien email dans Settings suffit             |
| Pages légales complètes                         | ✅                                   | ✅         | ⚠️ WebView   | Un lien vers la version web                 |

### 1.2 Diagnostic UX Mobile V1

**Problèmes identifiés :**

1. **AnalysisScreen = monstre de 1682 lignes** avec 30+ useState, 4 onglets surchargés — ingérable, lent, impossible à maintenir
2. **DashboardScreen expose TOUTES les options** comme le web (mode, catégorie, modèle AI, deep research) — l'utilisateur mobile veut coller une URL et c'est tout
3. **Pas de philosophie mobile-first** — c'est un portage 1:1 du web, pas une app pensée pour le pouce
4. **Navigation profonde** — trop de modals empilés, l'utilisateur se perd
5. **Pas d'onboarding engageant** — landing screen basique
6. **Performance** — AnalysisScreen re-render constamment (30 states)
7. **Pas d'animations natives** — Reanimated sous-utilisé, transitions plates

---

## 2. Vision V2 : "Coller, Analyser, Apprendre"

### 2.1 Philosophie

> L'app mobile DeepSight V2 est une **app d'apprentissage contextuel** : tu colles un lien YouTube, l'IA te fait un résumé intelligent, et tu peux chatter et réviser. C'est tout. Pas de settings avancés, pas de playlists, pas d'analytics — juste le cœur de la valeur.

### 2.2 Principes de design

- **1-thumb UX** : Tout est accessible avec le pouce, zones d'action en bas
- **Card-based UI** : Chaque contenu est une carte avec des actions contextuelles
- **Minimal input** : Smart defaults partout, 0 configuration requise
- **Motion design** : Transitions fluides (Reanimated 3), feedback haptique
- **Dark-first glassmorphism** : Fond sombre, blur, gradients subtils, surfaces translucides
- **Max 3 taps** pour toute action principale

### 2.3 Nouvelle architecture de navigation

```
Auth Stack (non connecté)
  ├── Welcome (nouveau onboarding animé, 3 slides)
  ├── Login
  ├── Register
  ├── VerifyEmail
  └── ForgotPassword

Main Stack (connecté)
  ├── [Bottom Tabs]
  │   ├── Home (nouvelle page d'analyse simplifiée)
  │   ├── Library (historique repensé en feed)
  │   ├── Study (hub flashcards + quiz)
  │   └── Profile (compte + settings fusionnés)
  │
  └── [Screens empilés]
      ├── Analysis (résultat + chat, redesigné)
      ├── Upgrade (pricing cards)
      └── Legal (WebView)
```

**Changements clés :**

- 4 tabs au lieu de 4, mais **contenus totalement différents**
- `Dashboard` → `Home` (input simplifié + feed récents)
- `History` → `Library` (feed vertical, pas de grid, UX TikTok-like)
- Nouvel onglet `Study` dédié (flashcards/quiz toutes vidéos)
- `Profile` absorbe `Settings`, `Account`, `Usage`
- `Analysis` passe de 4 onglets à **2 vues swipeable** (Summary | Chat)

---

## 3. Écrans V2 — Spécifications détaillées

### 3.1 HOME SCREEN (remplace Dashboard)

**Objectif** : Coller une URL en 1 seconde, voir ses dernières analyses.

**Layout :**

```
┌─────────────────────────────┐
│  DeepSight          [avatar]│  ← Header minimal
│                             │
│  ┌─────────────────────────┐│
│  │ 🔗 Colle un lien YouTube││  ← Input géant, auto-focus
│  │    Analyser →           ││  ← Bouton CTA dans l'input
│  └─────────────────────────┘│
│                             │
│  Crédits: ████████░░ 72/100 │  ← Barre simple
│                             │
│  Récents                    │
│  ┌─────┐ ┌─────┐ ┌─────┐  │  ← Carousel horizontal
│  │thumb│ │thumb│ │thumb│   │     de cards compactes
│  │titre│ │titre│ │titre│   │
│  └─────┘ └─────┘ └─────┘  │
│                             │
│  Favoris                    │
│  ┌─────┐ ┌─────┐ ┌─────┐  │  ← Même carousel
│  └─────┘ └─────┘ └─────┘  │
│                             │
│  [Home] [Library] [Study] [Me]│
└─────────────────────────────┘
```

**Ce qui DISPARAÎT vs V1 :**

- CustomizationPanel entier (mode, catégorie, modèle, deep research)
- Discovery Modal (recherche vidéo)
- Free Trial Modal complexe
- Toute section configuration

**Smart Defaults appliqués automatiquement :**

- Mode = `standard`
- Langue = détectée depuis la vidéo
- Catégorie = auto-détectée
- Modèle = le meilleur disponible pour le plan de l'utilisateur

**Options avancées** : Un petit lien "Options >" sous l'input ouvre un bottom sheet avec mode (3 choix) et langue (2 choix). C'est tout.

### 3.2 ANALYSIS SCREEN (refonte totale)

**Objectif** : Lire le résumé et chatter, sans surcharge cognitive.

**Architecture V1 (4 onglets)** → **V2 (2 vues swipeable)**

```
┌─────────────────────────────┐
│  ← Retour    "Titre vidéo"  │
│                             │
│  [▶ Player YouTube mini]    │  ← Collapsible, 30% hauteur max
│                             │
│  ┌──────────┬──────────────┐│
│  │ Résumé   │    Chat      ││  ← 2 tabs, swipeable
│  └──────────┴──────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │   Contenu Markdown      ││  ← ScrollView
│  │   avec badges fiabilité ││
│  │   (SOLIDE/PLAUSIBLE...) ││
│  │                         ││
│  │   Concepts cliquables   ││  ← Inline, expand on tap
│  │                         ││
│  └─────────────────────────┘│
│                             │
│  [⭐] [📤 Share] [📚 Study] │  ← Action bar fixe en bas
└─────────────────────────────┘
```

**Ce qui DISPARAÎT vs V1 :**

- Onglet "Concepts" séparé → intégré inline dans le résumé
- Onglet "Tools" entier → actions déplacées dans la barre du bas
- Sources académiques / Bibliographie
- Tournesol widget
- Notes editor
- Tags editor
- Web enrichment panel
- Fact-check panel complet (gardé en badge simple)

**Barre d'actions bas (3-4 icônes) :**

- ⭐ Favori (toggle)
- 📤 Partager (Share sheet natif → export PDF ou copier lien)
- 📚 Étudier (ouvre Study Screen pré-filtré sur cette vidéo)
- 💬 Chat (si on est sur l'onglet Résumé, switch vers Chat)

**Chat simplifié :**

- Questions suggérées en chips (3 max)
- Input en bas avec envoi
- Messages en bulles (pas de markdown complexe)
- Pas de toggle "web search"
- Quota affiché discrètement ("3 questions restantes")

### 3.3 LIBRARY SCREEN (remplace History)

**Objectif** : Feed vertical simple de toutes les analyses passées.

```
┌─────────────────────────────┐
│  Ma Bibliothèque    🔍      │
│                             │
│  ┌─────────────────────────┐│
│  │ [thumb] Titre vidéo     ││  ← Card verticale
│  │         Chaîne · 12min  ││
│  │         Il y a 2h  ⭐   ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ [thumb] Titre vidéo 2   ││
│  │         ...              ││
│  └─────────────────────────┘│
│  ...scroll infini...        │
│                             │
│  [Home] [Library] [Study] [Me]│
└─────────────────────────────┘
```

**Simplifications vs V1 :**

- Pas de tabs Videos/Playlists (playlists retirées)
- Pas de Grid view (list only)
- Pas de filtres catégorie/mode
- Recherche par titre uniquement (icône loupe)
- Toggle favoris uniquement comme filtre
- Scroll infini (FlatList paginée, pas de bouton "load more")
- Swipe gauche sur une card = supprimer

### 3.4 STUDY SCREEN (NOUVEAU — tab dédié)

**Objectif** : Hub de révision centralisé pour TOUTES les analyses.

```
┌─────────────────────────────┐
│  Réviser                    │
│                             │
│  ┌─────────────────────────┐│
│  │  📚 12 vidéos étudiées  ││  ← Stats résumées
│  │  🎯 87% score moyen     ││
│  └─────────────────────────┘│
│                             │
│  Reprendre                  │
│  ┌─────────────────────────┐│
│  │ [thumb] Dernière vidéo  ││  ← Quick resume
│  │ Flashcards · 8/20 faits ││
│  │ [Continuer →]           ││
│  └─────────────────────────┘│
│                             │
│  Toutes les vidéos          │
│  ┌───────────┐ ┌───────────┐│
│  │ Vidéo 1   │ │ Vidéo 2   ││  ← Grid 2 colonnes
│  │ 🃏 Flash  │ │ 🃏 Flash  ││
│  │ ❓ Quiz   │ │ ❓ Quiz   ││
│  └───────────┘ └───────────┘│
│                             │
│  [Home] [Library] [Study] [Me]│
└─────────────────────────────┘
```

**Nouveautés :**

- Hub centralisé (V1 = study tools cachés dans un sous-onglet d'Analysis)
- Score global de révision
- "Reprendre" avec la dernière session incomplète
- Accès direct flashcards OU quiz pour chaque vidéo

### 3.5 PROFILE SCREEN (fusion Profil + Settings + Usage)

**Objectif** : Tout le compte en 1 seul écran scrollable.

```
┌─────────────────────────────┐
│  ┌─────┐                    │
│  │avatar│ Username           │
│  │     │ Plan Pro · 2.99€/m │
│  └─────┘ [Gérer abonnement] │
│                             │
│  ─── Utilisation ───        │
│  Analyses : 12/40 ce mois  │
│  Crédits  : ████░░ 1200    │
│  Renouvellement : 15 jours │
│                             │
│  ─── Préférences ───       │
│  Thème        [Auto ▼]     │
│  Langue       [Français ▼] │
│                             │
│  ─── Compte ───            │
│  Modifier le profil    >   │
│  Changer le mot de passe > │
│  Conditions d'utilisation > │
│  Nous contacter       >    │
│                             │
│  [Se déconnecter]          │
│  [Supprimer mon compte]    │
│                             │
│  [Home] [Library] [Study] [Me]│
└─────────────────────────────┘
```

**Ce qui DISPARAÎT vs V1 :**

- SettingsScreen séparé
- AccountScreen séparé
- UsageScreen séparé
- AnalyticsScreen séparé
- Toutes les analytics détaillées (graphiques, breakdown par modèle/catégorie)

### 3.6 UPGRADE SCREEN

**Objectif** : Comparaison simple en cards swipeable.

```
┌─────────────────────────────┐
│  Passer au niveau supérieur │
│                             │
│  ← [Student] [Starter] [Pro] → │  ← Carousel horizontal
│     ┌─────────────────┐        │
│     │   STARTER        │        │
│     │   5.99€/mois     │        │
│     │                   │        │
│     │   ✅ 60 analyses  │        │
│     │   ✅ Export PDF    │        │
│     │   ✅ 2h max       │        │
│     │   ✅ 60j historique│        │
│     │                   │        │
│     │  [Choisir ce plan] │        │
│     └─────────────────┘        │
│                             │
│  Plan actuel : Free         │
└─────────────────────────────┘
```

---

## 4. Nouvelle Architecture Technique

### 4.1 Structure des fichiers V2

```
mobile/src/
├── app/                          # NOUVEAU : Expo Router (remplace React Navigation)
│   ├── _layout.tsx               # Root layout
│   ├── (auth)/                   # Auth group
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── verify.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                   # Main tabs group
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # Home
│   │   ├── library.tsx           # Library
│   │   ├── study.tsx             # Study hub
│   │   └── profile.tsx           # Profile
│   ├── analysis/[id].tsx         # Analysis detail
│   ├── upgrade.tsx               # Pricing
│   └── legal.tsx                 # WebView legal
│
├── components/                   # REFACTORÉ
│   ├── ui/                       # Primitives réutilisables
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── BottomSheet.tsx       # NOUVEAU
│   │   ├── Chip.tsx              # NOUVEAU
│   │   ├── ProgressBar.tsx
│   │   ├── Skeleton.tsx
│   │   └── Avatar.tsx
│   ├── home/
│   │   ├── URLInput.tsx          # Input simplifié
│   │   ├── RecentCarousel.tsx    # Carousel récents
│   │   └── CreditBar.tsx        # Barre crédits
│   ├── analysis/
│   │   ├── SummaryView.tsx       # Vue résumé (1 fichier, pas 4 tabs)
│   │   ├── ChatView.tsx          # Vue chat simplifiée
│   │   ├── VideoPlayer.tsx       # Player collapsible
│   │   ├── ActionBar.tsx         # Barre actions bas
│   │   └── StreamingOverlay.tsx  # Overlay pendant analyse
│   ├── library/
│   │   ├── AnalysisCard.tsx      # Card unique
│   │   └── SearchBar.tsx         # Recherche
│   ├── study/
│   │   ├── FlashcardDeck.tsx     # Refactoré
│   │   ├── QuizGame.tsx          # Refactoré
│   │   ├── StatsCard.tsx         # NOUVEAU
│   │   └── VideoStudyCard.tsx    # NOUVEAU
│   ├── profile/
│   │   ├── UsageSection.tsx
│   │   ├── PreferencesSection.tsx
│   │   └── AccountSection.tsx
│   └── upgrade/
│       └── PlanCard.tsx          # Card plan swipeable
│
├── stores/                       # NOUVEAU : Zustand uniquement
│   ├── authStore.ts              # Remplace AuthContext
│   ├── analysisStore.ts          # État analyse simplifié
│   └── studyStore.ts             # NOUVEAU : progression study
│
├── services/
│   ├── api.ts                    # Allégé (endpoints utilisés seulement)
│   └── storage.ts                # SecureStore helpers
│
├── hooks/                        # NOUVEAU : logique extraite
│   ├── useAnalysis.ts            # Hook analyse complet
│   ├── useChat.ts                # Hook chat
│   ├── useStudy.ts               # Hook study tools
│   └── useCredits.ts             # Hook crédits/quota
│
├── theme/                        # REFACTORÉ
│   ├── colors.ts
│   ├── spacing.ts
│   ├── typography.ts             # NOUVEAU : scale typographique
│   └── animations.ts             # NOUVEAU : presets Reanimated
│
├── constants/
│   └── config.ts
│
└── types/
    └── index.ts
```

### 4.2 Changements techniques majeurs

| Aspect         | V1                                   | V2                                 | Raison                                     |
| -------------- | ------------------------------------ | ---------------------------------- | ------------------------------------------ |
| Navigation     | React Navigation 6 (config manuelle) | **Expo Router** (file-based)       | Convention over config, deep linking natif |
| State global   | 8 Contexts wrappés                   | **Zustand stores** (3 max)         | Performance, pas de re-render cascade      |
| AnalysisScreen | 1 fichier 1682 LOC, 30+ useState     | **3 composants + 2 hooks**         | Maintenabilité, testabilité                |
| Animations     | Reanimated basique                   | **Reanimated 3 + Gesture Handler** | Swipe, spring, shared transitions          |
| Bottom Sheet   | Modal custom                         | **@gorhom/bottom-sheet**           | Standard, performant, gesture-native       |
| Listes         | FlatList + pagination manuelle       | **FlashList** (Shopify)            | 5x plus rapide sur grandes listes          |
| Images         | expo-image basique                   | **expo-image + blurhash**          | Placeholder flou pendant chargement        |

### 4.3 Réduction de complexité

```
V1 : 21 screens, 64 components, 8 contexts, ~12000 LOC
V2 : 11 screens, ~35 components, 3 stores, ~5000 LOC estimé

Réduction : -48% screens, -45% components, -58% LOC
```

---

## 5. Design System V2

### 5.1 Palette

```
Background:     #07070b (plus sombre que V1)
Surface L1:     #0f0f17
Surface L2:     #16162a
Surface L3:     #1e1e38 (cards élevées)

Accent Primary: #6366f1 (indigo, plus moderne que le bleu V1)
Accent Glow:    #818cf8 (indigo clair pour hover/active)
Accent Success: #22c55e
Accent Warning: #f59e0b
Accent Error:   #ef4444

Text Primary:   #f8fafc
Text Secondary: #94a3b8
Text Muted:     #475569

Glass:          rgba(255,255,255,0.04)
Glass Border:   rgba(255,255,255,0.08)
```

### 5.2 Typographie

```
Headlines:   Inter Bold, 28/24/20px
Body:        Inter Regular, 16px / line-height 24px
Caption:     Inter Medium, 13px
Mono:        JetBrains Mono, 14px (code blocks uniquement)
```

### 5.3 Composants visuels signature

- **Glassmorphic Cards** : `backgroundColor: rgba(255,255,255,0.04)`, `borderWidth: 1`, `borderColor: rgba(255,255,255,0.08)`, `borderRadius: 16`
- **Gradient Accents** : Dégradé `indigo → violet` sur les CTA principaux
- **Glow Effects** : `shadowColor: '#6366f1'`, `shadowRadius: 20`, `shadowOpacity: 0.3` sur éléments actifs
- **Haptic Feedback** : `expo-haptics` sur chaque action (impactLight pour taps, impactMedium pour succès)
- **Shared Element Transitions** : Thumbnail qui s'agrandit quand on ouvre une analyse

---

## 6. Plan d'Exécution — Phases

### Phase 1 : Fondations (Semaine 1-2)

**Objectif** : Nouveau squelette, navigation, design system

| Tâche                             | Fichiers                      | Estimation |
| --------------------------------- | ----------------------------- | ---------- |
| Migrer vers Expo Router           | `app/` directory complète     | 1 jour     |
| Implémenter le design system V2   | `theme/`                      | 0.5 jour   |
| Créer les composants UI primitifs | `components/ui/` (8 fichiers) | 1 jour     |
| Créer les Zustand stores          | `stores/` (3 fichiers)        | 0.5 jour   |
| Extraire les hooks métier         | `hooks/` (4 fichiers)         | 1 jour     |
| Setup FlashList + expo-image      | `package.json` + config       | 0.5 jour   |
| Auth flow (login/register/verify) | `app/(auth)/`                 | 1 jour     |
| Tab bar custom avec animations    | `app/(tabs)/_layout.tsx`      | 0.5 jour   |

### Phase 2 : Écrans Core (Semaine 3-4)

| Tâche                               | Fichiers                                   | Estimation |
| ----------------------------------- | ------------------------------------------ | ---------- |
| Home Screen (input + carousels)     | `app/(tabs)/index.tsx` + 3 components      | 1.5 jours  |
| Analysis Screen V2 (summary + chat) | `app/analysis/[id].tsx` + 5 components     | 3 jours    |
| Streaming overlay + progress        | `components/analysis/StreamingOverlay.tsx` | 1 jour     |
| Library Screen (feed + search)      | `app/(tabs)/library.tsx` + 2 components    | 1.5 jours  |
| Profile Screen (fusion 4→1)         | `app/(tabs)/profile.tsx` + 3 sections      | 1 jour     |

### Phase 3 : Study Hub + Polish (Semaine 5-6)

| Tâche                                | Fichiers                              | Estimation |
| ------------------------------------ | ------------------------------------- | ---------- |
| Study Hub Screen                     | `app/(tabs)/study.tsx` + 4 components | 2 jours    |
| Flashcards refonte (animations flip) | `components/study/FlashcardDeck.tsx`  | 1 jour     |
| Quiz refonte (gamification)          | `components/study/QuizGame.tsx`       | 1 jour     |
| Upgrade Screen (carousel plans)      | `app/upgrade.tsx` + `PlanCard.tsx`    | 1 jour     |
| Animations et transitions            | Shared elements, spring anims         | 1.5 jours  |
| Haptic feedback partout              | `expo-haptics` integration            | 0.5 jour   |

### Phase 4 : Edge Cases + QA (Semaine 7)

| Tâche                                        | Estimation |
| -------------------------------------------- | ---------- |
| Mode hors-ligne (cache analyses)             | 1 jour     |
| Gestion erreurs (network, API, empty states) | 1 jour     |
| Deep linking (analysis?url=...)              | 0.5 jour   |
| Push notifications (analyse terminée)        | 0.5 jour   |
| Tests manuels iOS + Android                  | 2 jours    |
| Performance profiling + optimisation         | 1 jour     |

### Phase 5 : Release (Semaine 8)

| Tâche                              | Estimation |
| ---------------------------------- | ---------- |
| EAS Build production iOS + Android | 0.5 jour   |
| Screenshots App Store / Play Store | 0.5 jour   |
| Soumission stores                  | 1 jour     |
| Monitoring post-release (Sentry)   | Continu    |

---

## 7. Métriques de succès V2

| Métrique                                    | V1 (estimée)                | Cible V2                      |
| ------------------------------------------- | --------------------------- | ----------------------------- |
| Temps pour analyser une vidéo (user action) | ~15 secondes (URL + config) | < 5 secondes (URL → Analyser) |
| Lignes de code mobile                       | ~12000 LOC                  | < 5500 LOC                    |
| Nombre de screens                           | 21                          | 11                            |
| Crash rate                                  | Inconnu                     | < 0.5%                        |
| Time to Interactive (app start)             | ~3s                         | < 1.5s                        |
| Taux de rétention J7                        | Baseline                    | +30% vs V1                    |

---

## 8. Ce qu'on ne fait PAS (scope lock)

- ❌ Pas de playlists (web-only)
- ❌ Pas d'admin panel
- ❌ Pas d'analytics détaillés (graphiques, breakdowns)
- ❌ Pas de sources académiques / bibliographie
- ❌ Pas de mind maps
- ❌ Pas de discovery/recherche vidéo
- ❌ Pas de TTS (V2.1 potentiel)
- ❌ Pas de thème clair (dark-only pour V2, light en V2.1)
- ❌ Pas de tablet layout (mobile-only pour V2)

---

_Ce plan est conçu pour être exécuté tâche par tâche avec validation à chaque étape. Chaque phase produit une version testable._
