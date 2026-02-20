# DeepSight Mobile V2 — Plan d'Exécution Parallèle

**Objectif** : Réduire 8 semaines → ~2-3 semaines en lançant 6 fenêtres Claude Code simultanées.

---

## Architecture de Parallélisation

```
                    SPRINT 0 (Jour 1) — TU FAIS ÇA EN PREMIER, SEUL
                    ════════════════════════════════════
                    Fenêtre 0 : FONDATIONS
                    - Expo Router setup
                    - Design system V2 (theme/)
                    - Types V2 (types/)
                    - Zustand stores (3 fichiers)
                    - Composants UI primitifs (8 fichiers)
                    - Hooks métier (4 fichiers)
                    - Navigation skeleton
                    ════════════════════════════════════
                              │
                              ▼ COMMIT "v2-foundations" → branche main-v2
                              │
          ┌───────────┬───────┼───────┬───────────┬──────────┐
          ▼           ▼       ▼       ▼           ▼          ▼
     Fenêtre 1   Fenêtre 2  Fen. 3  Fen. 4   Fen. 5    Fen. 6
     AUTH STACK   HOME +     ANALYSIS LIBRARY   STUDY     PROFILE +
                  INPUT      SCREEN   SCREEN    HUB       UPGRADE
          │           │       │       │           │          │
          ▼           ▼       ▼       ▼           ▼          ▼
     branche:    branche:  branche: branche:  branche:   branche:
     v2/auth     v2/home   v2/analysis v2/library v2/study v2/profile
          │           │       │       │           │          │
          └───────────┴───────┼───────┴───────────┴──────────┘
                              │
                              ▼ SPRINT FINAL (1-2 jours)
                    ════════════════════════════════════
                    Fenêtre 0 : INTÉGRATION
                    - Merge toutes les branches
                    - Navigation linking final
                    - Tests e2e
                    - Build EAS
                    ════════════════════════════════════
```

---

## SPRINT 0 — FONDATIONS (Jour 1, fenêtre unique)

> **CRITIQUE** : Rien ne peut démarrer en parallèle tant que ce sprint n'est pas terminé et committé.

### Fichiers à créer/modifier

```
mobile/
├── app.json                        # MODIFIER : mise à jour config Expo Router
├── package.json                    # MODIFIER : ajouter expo-router, @gorhom/bottom-sheet,
│                                   #   @shopify/flash-list, expo-haptics, react-native-gesture-handler
├── app/                            # NOUVEAU : structure Expo Router
│   ├── _layout.tsx                 # Root layout avec providers
│   ├── (auth)/
│   │   └── _layout.tsx             # Auth stack layout
│   ├── (tabs)/
│   │   └── _layout.tsx             # Tab bar layout + CustomTabBar V2
│   └── +not-found.tsx
│
├── src/
│   ├── types/
│   │   └── index.ts                # RÉÉCRIRE : types V2 simplifiés
│   │
│   ├── theme/                      # RÉÉCRIRE : nouveau design system
│   │   ├── colors.ts               # Palette V2 (indigo, glassmorphism)
│   │   ├── spacing.ts              # Scale 4px
│   │   ├── typography.ts           # NOUVEAU : scale typo Inter
│   │   └── animations.ts           # NOUVEAU : presets Reanimated 3
│   │
│   ├── stores/                     # NOUVEAU : remplace 8 Contexts
│   │   ├── authStore.ts            # Auth + user + tokens
│   │   ├── analysisStore.ts        # État analyse en cours
│   │   └── studyStore.ts           # Progression study
│   │
│   ├── hooks/                      # NOUVEAU : logique extraite
│   │   ├── useAnalysis.ts          # Start/poll/get analysis
│   │   ├── useChat.ts              # Send/receive messages
│   │   ├── useStudy.ts             # Flashcards + quiz
│   │   └── useCredits.ts           # Crédits + quota
│   │
│   ├── services/
│   │   └── api.ts                  # SIMPLIFIER : retirer endpoints inutilisés V2
│   │
│   └── components/ui/              # NOUVEAU : primitives V2
│       ├── Button.tsx              # Gradient CTA + variants
│       ├── Card.tsx                # Glassmorphic card
│       ├── Input.tsx               # Input avec icônes
│       ├── Badge.tsx               # Badge fiabilité
│       ├── BottomSheet.tsx         # Wrapper @gorhom
│       ├── Chip.tsx                # Tag/filtre selectable
│       ├── ProgressBar.tsx         # Barre animée
│       ├── Skeleton.tsx            # Loading skeleton
│       └── Avatar.tsx              # Avatar circulaire
```

### Critères de fin Sprint 0
- [ ] `npx expo start` démarre sans erreur
- [ ] Navigation (auth) → (tabs) fonctionne
- [ ] Tab bar affiche 4 onglets avec icônes
- [ ] Chaque tab affiche un placeholder `<Text>Screen Name</Text>`
- [ ] `authStore` gère login/logout/refresh
- [ ] Tous les composants UI render sans erreur
- [ ] Branche `main-v2` poussée

---

## SPRINT 1 — PARALLEL (Jours 2-8, 6 fenêtres simultanées)

---

### FENÊTRE 1 : AUTH STACK
**Branche** : `v2/auth`
**Durée estimée** : 2 jours

#### Brief pour Claude Code

```
Tu travailles sur la branche v2/auth de DeepSight Mobile V2.
Ta mission : recréer le flow d'authentification complet.

CONTEXTE :
- Expo Router (file-based routing dans app/(auth)/)
- Zustand authStore dans src/stores/authStore.ts
- API client dans src/services/api.ts (authApi)
- Design system V2 dans src/theme/ (dark-first, palette indigo)
- Composants UI dans src/components/ui/

ÉCRANS À CRÉER :
1. app/(auth)/welcome.tsx — Onboarding 3 slides animés (Reanimated 3)
   - Slide 1: "Colle un lien YouTube"
   - Slide 2: "L'IA analyse pour toi"
   - Slide 3: "Révise avec des flashcards"
   - Boutons: Se connecter / Créer un compte
   - Animations: parallax scroll horizontal, dots indicator

2. app/(auth)/login.tsx — Connexion
   - Email + mot de passe
   - Google OAuth (expo-auth-session)
   - Lien "Mot de passe oublié"
   - Lien "Créer un compte"
   - Style: glassmorphic card centrée, gradient button

3. app/(auth)/register.tsx — Inscription
   - Username + Email + Mot de passe + Confirmation
   - Checkbox CGU
   - Même style que login

4. app/(auth)/verify.tsx — Vérification email
   - Input 6 digits (OTP style)
   - Bouton Renvoyer le code
   - Timer 60s

5. app/(auth)/forgot-password.tsx — Mot de passe oublié
   - Email input → code → nouveau mot de passe (3 étapes)

RÈGLES :
- Utiliser UNIQUEMENT les composants de src/components/ui/
- Utiliser useAuth() depuis src/stores/authStore.ts (pas de Context)
- Animations Reanimated 3 (SharedValue, withSpring, withTiming)
- Haptic feedback sur les CTA (expo-haptics)
- Gestion erreurs : toast + inline errors
- NO StyleSheet.create inline — exporter en bas du fichier
- TypeScript strict, pas de any
```

#### Fichiers produits
```
app/(auth)/
├── _layout.tsx
├── welcome.tsx
├── login.tsx
├── register.tsx
├── verify.tsx
└── forgot-password.tsx
```

---

### FENÊTRE 2 : HOME SCREEN + URL INPUT
**Branche** : `v2/home`
**Durée estimée** : 2 jours

#### Brief pour Claude Code

```
Tu travailles sur la branche v2/home de DeepSight Mobile V2.
Ta mission : créer le Home Screen (tab principal) — la page la plus
importante de l'app.

CONTEXTE :
- Expo Router : app/(tabs)/index.tsx
- Stores Zustand : authStore, analysisStore
- Hook : useAnalysis() depuis src/hooks/useAnalysis.ts
- Hook : useCredits() depuis src/hooks/useCredits.ts
- API : videoApi depuis src/services/api.ts
- Composants UI : src/components/ui/

ÉCRAN : app/(tabs)/index.tsx (HOME)

LAYOUT :
┌─────────────────────────────┐
│  DeepSight          [avatar]│  Header minimal
│                             │
│  ┌─────────────────────────┐│
│  │ 🔗 Colle un lien YouTube││  Input géant, focal point
│  │    Analyser →           ││  CTA gradient dans l'input
│  └─────────────────────────┘│
│                             │
│  Crédits: ████████░░ 72/100 │  Barre crédits animée
│                             │
│  Récents                    │
│  ┌─────┐ ┌─────┐ ┌─────┐  │  Carousel FlashList horizontal
│  │thumb│ │thumb│ │thumb│   │  Cards glassmorphic
│  │titre│ │titre│ │titre│   │
│  └─────┘ └─────┘ └─────┘  │
│                             │
│  Favoris                    │
│  ┌─────┐ ┌─────┐ ┌─────┐  │  Même carousel
│  └─────┘ └─────┘ └─────┘  │
└─────────────────────────────┘

Options avancées : un petit lien "Options >" sous l'input ouvre un
BottomSheet avec :
- Mode : Accessible | Standard | Expert (3 chips)
- Langue : Français | English (2 chips)
C'est TOUT. Pas de catégorie, pas de modèle AI, pas de deep research.

COMPOSANTS À CRÉER :
1. src/components/home/URLInput.tsx
   - Auto-focus au mount
   - Validation YouTube URL en temps réel (regex)
   - Affiche thumbnail + titre quand URL valide (videoApi.getMetadata)
   - Bouton "Analyser" gradient indigo→violet
   - Loading state pendant validation
   - Paste depuis clipboard (Clipboard API)

2. src/components/home/RecentCarousel.tsx
   - FlashList horizontal
   - Cards : thumbnail (expo-image + blurhash), titre (2 lignes max),
     durée, date relative
   - Tap → router.push(`/analysis/${id}`)
   - Empty state si 0 analyses

3. src/components/home/CreditBar.tsx
   - Barre de progression animée (Reanimated)
   - Format : "12/40 analyses ce mois"
   - Couleur : vert → jaune → rouge selon %
   - Tap → router.push('/upgrade') si < 20%

4. src/components/home/OptionsSheet.tsx
   - BottomSheet (@gorhom/bottom-sheet)
   - Mode selector (3 Chips)
   - Language selector (2 Chips)
   - Bouton "Appliquer"

COMPORTEMENT ANALYSE :
1. User colle URL → validation → affiche metadata
2. User tape "Analyser" → analysisStore.startAnalysis(url, options)
3. Redirect vers /analysis/[taskId] avec streaming overlay
4. En arrière-plan : polling status toutes les 2.5s

RÈGLES :
- Smart defaults : mode=standard, lang=auto-detect
- Haptic feedback sur "Analyser" (impactMedium)
- Pull-to-refresh sur les carousels
- Empty states avec illustrations (pas de texte seul)
- Performance : FlashList, pas FlatList
```

#### Fichiers produits
```
app/(tabs)/index.tsx
src/components/home/
├── URLInput.tsx
├── RecentCarousel.tsx
├── CreditBar.tsx
└── OptionsSheet.tsx
```

---

### FENÊTRE 3 : ANALYSIS SCREEN (LE PLUS GROS CHANTIER)
**Branche** : `v2/analysis`
**Durée estimée** : 4-5 jours

#### Brief pour Claude Code

```
Tu travailles sur la branche v2/analysis de DeepSight Mobile V2.
Ta mission : recréer l'écran d'analyse — le cœur de l'app.

CONTEXTE CRITIQUE :
L'ancien AnalysisScreen était un monstre de 1682 lignes avec 30+ useState
et 4 onglets. La V2 le remplace par 2 vues swipeable + des composants
décomposés.

ARCHITECTURE V2 :
- 1 screen principal : app/analysis/[id].tsx (~300 lignes max)
- 5 composants dédiés dans src/components/analysis/
- 2 hooks : useAnalysis() et useChat()
- Swipe horizontal entre Résumé et Chat (react-native-pager-view)

LAYOUT :
┌─────────────────────────────┐
│  ← Retour    "Titre vidéo"  │
│                             │
│  [▶ Player YouTube mini]    │  Collapsible (scroll down = collapse)
│                             │
│  ┌──────────┬──────────────┐│
│  │ Résumé   │    Chat      ││  2 tabs, swipeable
│  └──────────┴──────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │   Contenu               ││  ScrollView / FlatList
│  │   (selon tab active)    ││
│  └─────────────────────────┘│
│                             │
│  [⭐] [📤 Share] [📚 Study] │  ActionBar fixe en bas
└─────────────────────────────┘

COMPOSANTS À CRÉER :

1. app/analysis/[id].tsx — Screen principal
   - useLocalSearchParams() pour récupérer l'ID
   - useAnalysis(id) hook pour données
   - PagerView pour swipe Résumé ↔ Chat
   - Gestion 3 états : streaming | complete | error
   - Animated header (titre collapse on scroll)

2. src/components/analysis/VideoPlayer.tsx
   - react-native-youtube-iframe (ou webview)
   - Collapsible : grand (30% écran) → mini (barre 60px) au scroll
   - Reanimated interpolation
   - Play/Pause overlay

3. src/components/analysis/SummaryView.tsx
   - Markdown rendering (react-native-markdown-display)
   - Badges fiabilité inline : SOLIDE (vert), PLAUSIBLE (jaune),
     INCERTAIN (orange), A VERIFIER (rouge) — composant Badge
   - Concepts cliquables : tap = expand definition inline (Accordion)
   - Timecodes cliquables : tap = seek vidéo
   - Streaming text : texte qui apparaît progressivement (useAnalysis.streamingText)

4. src/components/analysis/ChatView.tsx
   - FlatList inversée (messages en bas)
   - 3 questions suggérées en Chips (en haut)
   - Input en bas avec bouton envoi
   - Bulles : user (droite, indigo) / AI (gauche, surface)
   - Typing indicator (3 dots animés)
   - useChat(summaryId) hook
   - Quota : "3/15 questions" discret sous l'input
   - PAS de toggle web search
   - PAS de markdown complexe dans les réponses (texte simple)

5. src/components/analysis/ActionBar.tsx
   - Barre fixe en bas, au-dessus du tab bar
   - 3-4 boutons icône + label
   - ⭐ Favori (toggle, haptic)
   - 📤 Partager → Share sheet natif (expo-sharing)
     → Options : "Copier le lien" / "Exporter en PDF"
   - 📚 Étudier → router.push vers Study avec summaryId
   - Animations : scale on press

6. src/components/analysis/StreamingOverlay.tsx
   - Overlay plein écran pendant l'analyse (0-100%)
   - Progress circle animé (Reanimated, SVG arc)
   - 5 étapes avec labels :
     Connexion → Métadonnées → Transcription → Analyse → Terminé
   - Étape active pulse
   - Estimation temps restant
   - Bouton "Annuler" discret
   - Quand 100% → fade out overlay, révèle le résumé

HOOKS :
- useAnalysis(id) : { summary, isStreaming, progress, progressMessage,
    streamingText, error, refetch }
  → Utilise analysisStore + videoApi.getStatus polling

- useChat(summaryId) : { messages, send(text), isLoading, quota,
    suggestedQuestions }
  → Utilise chatApi.ask + chatApi.getHistory

RÈGLES :
- MAX 300 lignes par fichier (décomposer si plus)
- Pas de useState spaghetti — utiliser useReducer si > 5 states locaux
- Animations Reanimated 3 pour TOUT (collapse, swipe, streaming)
- Haptic sur favori, partage, envoi message
- Gestion offline : afficher cache si disponible, banner "hors ligne"
- Empty state pour chat (illustration + "Pose ta première question")
- Error state avec retry
```

#### Fichiers produits
```
app/analysis/[id].tsx
src/components/analysis/
├── VideoPlayer.tsx
├── SummaryView.tsx
├── ChatView.tsx
├── ActionBar.tsx
└── StreamingOverlay.tsx
```

---

### FENÊTRE 4 : LIBRARY SCREEN
**Branche** : `v2/library`
**Durée estimée** : 2 jours

#### Brief pour Claude Code

```
Tu travailles sur la branche v2/library de DeepSight Mobile V2.
Ta mission : créer le Library Screen (historique des analyses).

CONTEXTE :
- Expo Router : app/(tabs)/library.tsx
- API : videoApi.getHistory() depuis src/services/api.ts
- Composants UI : src/components/ui/
- FlashList depuis @shopify/flash-list

LAYOUT :
┌─────────────────────────────┐
│  Ma Bibliothèque    🔍      │
│  [⭐ Favoris]               │  Toggle filtre favoris (Chip)
│                             │
│  ┌─────────────────────────┐│
│  │ [thumb] Titre vidéo     ││  Card glassmorphic
│  │         Chaîne · 12min  ││
│  │         Il y a 2h  ⭐   ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ [thumb] Titre vidéo 2   ││
│  │         ...              ││
│  └─────────────────────────┘│
│  ...scroll infini...        │
└─────────────────────────────┘

COMPOSANTS À CRÉER :

1. app/(tabs)/library.tsx — Screen principal
   - FlashList vertical, scroll infini
   - useInfiniteQuery pour pagination (20 items/page)
   - Pull-to-refresh
   - Recherche : icône loupe → expand SearchBar animée
   - Filtre favoris : Chip toggle
   - Empty state : illustration + "Analyse ta première vidéo"
   - Tap card → router.push(`/analysis/${id}`)

2. src/components/library/AnalysisCard.tsx
   - Thumbnail à gauche (expo-image, blurhash, 80x60)
   - Titre (2 lignes max, ellipsis)
   - Chaîne YouTube · durée formatée
   - Date relative ("Il y a 2h", "Hier", "12 jan")
   - Icône ⭐ si favori
   - Swipe gauche → bouton supprimer (rouge)
   - Tap → navigation
   - Reanimated : scale down on press (0.98)

3. src/components/library/SearchBar.tsx
   - Expand animation (icône → full width input)
   - Debounce 300ms
   - Icône clear (X)
   - Filtre côté client (titre + URL)

RÈGLES :
- FlashList (PAS FlatList) — estimatedItemSize={80}
- Pas de Grid view, pas de tabs Videos/Playlists
- Pas de filtres catégorie/mode
- Swipe-to-delete avec confirmation Alert
- Optimistic update sur suppression
- Cache TanStack Query (staleTime: 5min)
```

#### Fichiers produits
```
app/(tabs)/library.tsx
src/components/library/
├── AnalysisCard.tsx
└── SearchBar.tsx
```

---

### FENÊTRE 5 : STUDY HUB
**Branche** : `v2/study`
**Durée estimée** : 3 jours

#### Brief pour Claude Code

```
Tu travailles sur la branche v2/study de DeepSight Mobile V2.
Ta mission : créer le Study Hub — NOUVEAU tab dédié aux révisions.

CONTEXTE :
- Expo Router : app/(tabs)/study.tsx
- Store : studyStore depuis src/stores/studyStore.ts
- Hook : useStudy() depuis src/hooks/useStudy.ts
- API : studyApi depuis src/services/api.ts

LAYOUT — HUB :
┌─────────────────────────────┐
│  Réviser                    │
│                             │
│  ┌─────────────────────────┐│
│  │  📚 12 vidéos étudiées  ││  Stats card
│  │  🎯 87% score moyen     ││
│  └─────────────────────────┘│
│                             │
│  Reprendre                  │
│  ┌─────────────────────────┐│
│  │ [thumb] Dernière vidéo  ││  Resume card
│  │ Flashcards · 8/20       ││
│  │ [Continuer →]           ││
│  └─────────────────────────┘│
│                             │
│  Toutes les vidéos          │
│  ┌───────────┐ ┌───────────┐│  Grid 2 colonnes
│  │ Vidéo 1   │ │ Vidéo 2   ││
│  │ 🃏 Flash  │ │ 🃏 Flash  ││
│  │ ❓ Quiz   │ │ ❓ Quiz   ││
│  └───────────┘ └───────────┘│
└─────────────────────────────┘

COMPOSANTS À CRÉER :

1. app/(tabs)/study.tsx — Hub screen
   - Stats en haut (vidéos étudiées, score moyen)
   - "Reprendre" : dernière session incomplète
   - Grid 2 colonnes : toutes les vidéos avec analyses
   - Chaque card a 2 boutons : Flashcards / Quiz
   - Tap Flashcards → fullscreen FlashcardDeck
   - Tap Quiz → fullscreen QuizGame

2. src/components/study/StatsCard.tsx
   - Nombre de vidéos étudiées
   - Score moyen (cercle progress animé)
   - Séries consécutives (streak)

3. src/components/study/VideoStudyCard.tsx
   - Thumbnail mini + titre
   - 2 boutons : 🃏 Flashcards / ❓ Quiz
   - Badge : score si déjà fait, "Nouveau" sinon
   - Plan gate : Student+ requis, sinon badge lock

4. src/components/study/FlashcardDeck.tsx — FULLSCREEN
   - Deck de cartes flip (Reanimated 3D rotation)
   - Face avant : question
   - Face arrière : réponse
   - Swipe droite = correct (vert), swipe gauche = incorrect (rouge)
   - Compteur : "8/20"
   - Progress bar en haut
   - Bouton retour
   - Écran fin : score + option "Recommencer"
   - Haptic sur flip et swipe

5. src/components/study/QuizGame.tsx — FULLSCREEN
   - Question + 4 options (boutons)
   - Timer optionnel (15s par question)
   - Feedback immédiat : vert (correct) / rouge (incorrect) + explication
   - Score running en haut
   - Écran fin : score / total + détail réponses
   - Animations : shake sur erreur, bounce sur correct
   - Haptic feedback

HOOK useStudy(summaryId?) :
  - generateFlashcards(summaryId) → studyApi
  - generateQuiz(summaryId) → studyApi
  - getProgress(summaryId) → studyStore
  - saveProgress(summaryId, result) → studyStore

STORE studyStore :
  - progress: Record<summaryId, { flashcards: score, quiz: score, lastPlayed }>
  - globalStats: { totalStudied, averageScore, streak }
  - persist via AsyncStorage

RÈGLES :
- Animations Reanimated 3 pour le flip 3D des flashcards
- PanGestureHandler pour le swipe des flashcards
- Pas de MindMap (retiré du scope V2)
- Gate Student+ : si free user, afficher BottomSheet upgrade
- Données persistées localement (studyStore persisted)
```

#### Fichiers produits
```
app/(tabs)/study.tsx
src/components/study/
├── StatsCard.tsx
├── VideoStudyCard.tsx
├── FlashcardDeck.tsx
└── QuizGame.tsx
```

---

### FENÊTRE 6 : PROFILE + UPGRADE
**Branche** : `v2/profile`
**Durée estimée** : 2 jours

#### Brief pour Claude Code

```
Tu travailles sur la branche v2/profile de DeepSight Mobile V2.
Ta mission : créer le Profile Screen (fusion de 4 anciens écrans)
et l'Upgrade Screen.

CONTEXTE :
- Expo Router : app/(tabs)/profile.tsx et app/upgrade.tsx
- Store : authStore (user, logout)
- API : authApi, billingApi, usageApi

ÉCRAN 1 : app/(tabs)/profile.tsx — Profile (fusion Profil+Settings+Usage+Account)

LAYOUT :
┌─────────────────────────────┐
│  ┌─────┐                    │
│  │avatar│ Username           │  Section profil
│  │     │ Plan Pro · 2.99€/m │
│  └─────┘ [Gérer abonnement] │  → Stripe portal
│                             │
│  ─── Utilisation ───        │
│  Analyses : 12/40 ce mois  │  ProgressBar
│  Crédits  : ████░░ 1200    │  ProgressBar
│  Renouvellement : 15 jours │
│                             │
│  ─── Préférences ───       │
│  Thème        [Auto ▼]     │  BottomSheet select
│  Langue       [Français ▼] │  BottomSheet select
│                             │
│  ─── Compte ───            │
│  Modifier le profil    >   │  → BottomSheet avec inputs
│  Changer le mot de passe > │  → BottomSheet 3 inputs
│  Conditions d'utilisation > │ → router.push('/legal')
│  Nous contacter       >    │  → Linking.openURL(mailto:)
│                             │
│  [Se déconnecter]          │  Alert confirmation
│  [Supprimer mon compte]    │  Alert double confirmation + password
└─────────────────────────────┘

ÉCRAN 2 : app/upgrade.tsx — Pricing

LAYOUT :
┌─────────────────────────────┐
│  ← Retour                   │
│  Passer au niveau supérieur │
│                             │
│  ← swipe [Plan Cards] →    │  Carousel PagerView
│     ┌─────────────────┐    │
│     │   STARTER        │    │
│     │   5.99€/mois     │    │
│     │                   │    │
│     │   ✅ 60 analyses  │    │
│     │   ✅ Export PDF    │    │
│     │   ✅ 2h max       │    │
│     │   ✅ 60j historique│    │
│     │                   │    │
│     │  [Choisir ce plan] │    │  Stripe checkout
│     └─────────────────┘    │
│                             │
│  ● ○ ○ ○                   │  Dots indicator
│  Plan actuel : Free         │
└─────────────────────────────┘

COMPOSANTS À CRÉER :

1. src/components/profile/UsageSection.tsx
   - 2 ProgressBars (analyses + crédits)
   - Date renouvellement
   - Couleurs : vert > 50%, jaune > 20%, rouge < 20%

2. src/components/profile/PreferencesSection.tsx
   - Theme selector (Auto/Dark — pas de Light en V2)
   - Language selector (FR/EN)
   - BottomSheet pour chaque sélection

3. src/components/profile/AccountSection.tsx
   - Liste de menu items avec chevrons
   - Modifier profil → BottomSheet (username, email)
   - Changer mot de passe → BottomSheet (ancien, nouveau, confirmer)
   - Logout → Alert
   - Delete → Alert double + password input

4. src/components/upgrade/PlanCard.tsx
   - Card glassmorphic grande (80% largeur écran)
   - Nom du plan + prix
   - Liste features (✅ items)
   - Badge "Populaire" sur Pro
   - Badge "Actuel" si c'est le plan de l'user
   - Bouton CTA gradient "Choisir ce plan"
   - Disabled si plan actuel
   - Tap CTA → billingApi.checkout(planId) → WebBrowser

5. app/legal.tsx
   - WebView simple vers https://www.deepsightsynthesis.com/legal

RÈGLES :
- TOUTES les actions destructives (logout, delete) = Alert.alert confirmation
- Delete account = double confirmation + saisie mot de passe
- Stripe checkout = expo-web-browser (pas de WebView inline)
- Pas d'écran Settings séparé
- Pas d'écran Account séparé
- Pas d'écran Usage séparé
- Pas d'écran Analytics (retiré V2)
- Pas de graphiques/charts
```

#### Fichiers produits
```
app/(tabs)/profile.tsx
app/upgrade.tsx
app/legal.tsx
src/components/profile/
├── UsageSection.tsx
├── PreferencesSection.tsx
└── AccountSection.tsx
src/components/upgrade/
└── PlanCard.tsx
```

---

## SPRINT FINAL — INTÉGRATION (Jours 9-10)

> Toi seul, dans une fenêtre, tu merges et intègres tout.

### Checklist

```
1. MERGE
   □ git merge v2/auth → main-v2
   □ git merge v2/home → main-v2
   □ git merge v2/analysis → main-v2
   □ git merge v2/library → main-v2
   □ git merge v2/study → main-v2
   □ git merge v2/profile → main-v2
   □ Résoudre conflits (principalement navigation + types)

2. NAVIGATION LINKING
   □ Vérifier tous les router.push/replace fonctionnent
   □ Deep linking : deepsight://analysis/[id]
   □ Notifications → navigation correcte
   □ Auth guard : redirect vers login si non-connecté

3. TESTS MANUELS
   □ Flow complet : Register → Verify → Home → Analyze → Chat → Study
   □ Flow login : Login → Home → History → Profile → Logout
   □ Flow upgrade : Home → Upgrade → Stripe → Success
   □ Flow offline : Couper réseau → Banner → Cache → Reconnexion
   □ Swipe navigation (analysis tabs, upgrade carousel)
   □ iOS + Android (Expo Go ou dev build)

4. POLISH
   □ Toutes les animations fluides (60fps)
   □ Haptic feedback sur toutes les actions
   □ Empty states partout
   □ Error states avec retry
   □ Loading states (skeletons)
   □ Safe area (notch, home indicator)

5. BUILD
   □ npx expo run:ios (test local)
   □ npx expo run:android (test local)
   □ eas build --platform all --profile preview
   □ Test sur devices réels
   □ eas build --platform all --profile production
```

---

## TIMELINE RÉSUMÉE

```
Jour 1          : Sprint 0 — Fondations (toi seul)
Jours 2-8       : Sprint 1 — 6 fenêtres en parallèle
Jours 9-10      : Sprint Final — Intégration + QA
Jour 11         : Build + soumission stores

TOTAL : ~11 jours ouvrés (≈ 2.5 semaines)
vs 8 semaines séquentiel = 3x plus rapide
```

---

## RÈGLES DE COORDINATION

1. **Chaque fenêtre travaille sur SA branche** — jamais de push direct sur main-v2
2. **Les fichiers partagés (types, stores, hooks, theme) sont en READ-ONLY** pendant Sprint 1
3. **Si un composant UI manque** : le créer dans son propre dossier de composants (pas dans ui/), on refactorisera au merge
4. **Convention de nommage** : PascalCase pour composants, camelCase pour hooks/utils
5. **Chaque fenêtre fait son propre typecheck** avant de déclarer terminé : `npx tsc --noEmit`
6. **Pas de npm install supplémentaire** sans coordination — les deps sont fixées au Sprint 0

---

*Plan prêt pour exécution. Sprint 0 = le goulot d'étranglement. Tout le reste est parallélisable.*
