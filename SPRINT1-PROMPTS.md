# DeepSight Mobile V2 — Sprint 1 : 6 Prompts Claude Code

> **Pré-requis** : Sprint 0 terminé, tous les fichiers fondations sont dans `mobile/`
>
> **Lancement** : Ouvrir 6 terminaux dans `C:\Users\33667\DeepSight-Main\mobile` et exécuter chacun avec :
> ```
> claude --dangerously-skip-permissions
> ```
> Puis coller le prompt correspondant.

---

## FENÊTRE 1 — AUTH STACK

```
Tu es le développeur de la branche v2/auth du projet DeepSight Mobile V2 (Expo SDK 54 / React Native 0.81 / TypeScript strict).

MISSION : Recréer le flow d'authentification complet dans app/(auth)/.

CONTEXTE TECHNIQUE :
- Navigation : Expo Router (file-based routing). Les layouts existent déjà dans app/(auth)/_layout.tsx
- State : Zustand authStore dans src/stores/authStore.ts (setAuth, logout, updateUser)
- API : authApi dans src/services/api.ts (login, register, verifyEmail, forgotPassword, resetPassword, googleLogin)
- Design : Dark-first, palette indigo #6366f1. Theme dans src/theme/ (colors, spacing, typography, animations)
- UI primitives : src/components/ui/ (Button, Card, Input, Badge, BottomSheet, Chip, ProgressBar, Skeleton, Avatar)
- Fonts : DMSans (body), CormorantGaramond-Bold (display), JetBrainsMono (mono)

ÉCRANS À CRÉER (réécrire les fichiers existants qui sont des placeholders) :

1. app/(auth)/index.tsx — Onboarding Welcome (3 slides animés)
   - PagerView horizontal avec 3 slides :
     Slide 1: "Colle un lien YouTube" (icône link)
     Slide 2: "L'IA analyse pour toi" (icône sparkles)
     Slide 3: "Révise avec des flashcards" (icône book)
   - Dots indicator animé (Reanimated SharedValue)
   - 2 boutons CTA en bas : "Se connecter" (primary) / "Créer un compte" (outline)
   - Parallax léger sur les images/icônes pendant le swipe
   - router.push('/(auth)/login') et router.push('/(auth)/register')

2. app/(auth)/login.tsx — Connexion
   - Email Input + Password Input (avec toggle visibilité)
   - Bouton "Se connecter" (primary, gradient, fullWidth)
   - Séparateur "ou"
   - Bouton "Continuer avec Google" (secondary, icône Google)
   - Liens : "Mot de passe oublié ?" → router.push('/(auth)/forgot-password')
   - Lien bas : "Pas de compte ? Créer un compte" → router.push('/(auth)/register')
   - Google OAuth via expo-auth-session (utiliser authApi.googleLogin)
   - Sur succès : authStore.setAuth(user, tokens) → router.replace('/(tabs)')
   - Gestion erreurs inline sous chaque input + Alert pour erreurs réseau
   - Loading state sur le bouton pendant l'appel API

3. app/(auth)/register.tsx — Inscription
   - Username + Email + Password + Confirm Password (4 inputs)
   - Checkbox CGU avec lien cliquable
   - Bouton "Créer mon compte" (primary)
   - Validation : email format, password min 8 chars, passwords match, username min 3 chars
   - Erreurs inline sous chaque input (texte rouge)
   - Sur succès : router.push({ pathname: '/(auth)/verify', params: { email } })

4. app/(auth)/verify.tsx — Vérification email OTP
   - Texte : "Un code a été envoyé à {email}"
   - 6 inputs individuels (style OTP) avec auto-focus au suivant
   - Bouton "Vérifier" (primary)
   - Lien "Renvoyer le code" avec timer 60s (désactivé pendant countdown)
   - Sur succès : auto-login → router.replace('/(tabs)')

5. app/(auth)/forgot-password.tsx — Mot de passe oublié (3 étapes)
   - Étape 1 : Email input → "Envoyer le code"
   - Étape 2 : Code OTP (6 digits) → "Vérifier"
   - Étape 3 : Nouveau mot de passe + confirmation → "Réinitialiser"
   - Navigation entre étapes avec animation slide (Reanimated)
   - Bouton retour à chaque étape
   - Sur succès étape 3 : router.replace('/(auth)/login') avec toast succès

RÈGLES STRICTES :
- Utiliser UNIQUEMENT les composants de src/components/ui/ (Button, Input, Card)
- StyleSheet.create EN BAS de chaque fichier, jamais inline sauf dynamique
- TypeScript strict : pas de any, typer toutes les props et states
- Animations : Reanimated 3 (useSharedValue, useAnimatedStyle, withSpring, withTiming)
- Haptic feedback via expo-haptics sur tous les boutons CTA
- Couleurs depuis src/theme/colors.ts (darkColors, palette)
- Spacing depuis src/theme/spacing.ts (sp)
- Typography depuis src/theme/typography.ts (fontFamily, fontSize, textStyles)
- Tous les textes en français
- SafeAreaView pour chaque écran
- KeyboardAvoidingView pour les écrans avec inputs
- Gestion du clavier : dismiss on tap outside

Commence par lire les fichiers suivants pour comprendre les APIs disponibles :
- src/services/api.ts (cherche authApi)
- src/stores/authStore.ts
- src/components/ui/Button.tsx
- src/components/ui/Input.tsx
- src/theme/colors.ts
- src/theme/spacing.ts
- src/theme/typography.ts

Puis crée les 5 écrans un par un. Après chaque fichier, vérifie avec : npx tsc --noEmit 2>&1 | grep "app/(auth)"
À la fin, lance un typecheck complet : npx tsc --noEmit
```

---

## FENÊTRE 2 — HOME SCREEN + URL INPUT

```
Tu es le développeur de la branche v2/home du projet DeepSight Mobile V2 (Expo SDK 54 / React Native 0.81 / TypeScript strict).

MISSION : Créer le Home Screen — le premier écran visible après connexion. C'est la page la plus importante de l'app.

CONTEXTE TECHNIQUE :
- Navigation : Expo Router, le fichier est app/(tabs)/index.tsx
- Stores : analysisStore (src/stores/analysisStore.ts), authStore (src/stores/authStore.ts)
- Hooks : useAnalysis (src/hooks/useAnalysis.ts), useCredits (src/hooks/useCredits.ts)
- API : videoApi (src/services/api.ts) — analyze, getHistory, getStatus
- UI primitives : src/components/ui/ (Button, Card, Input, Badge, BottomSheet, Chip, ProgressBar, Skeleton, Avatar)
- FlashList : @shopify/flash-list (installé)
- Design : Dark-first (#0a0a0f), palette indigo #6366f1, glassmorphism

FICHIERS À CRÉER :

1. app/(tabs)/index.tsx — Home Screen (réécrire le placeholder)
   Layout vertical :
   - Header : "DeepSight" (font display) à gauche + Avatar utilisateur à droite (tap → profile tab)
   - URLInput component (focal point, le plus gros élément)
   - CreditBar component
   - Section "Récents" avec RecentCarousel
   - Section "Favoris" avec RecentCarousel (filtré favorites)
   - ScrollView avec RefreshControl (pull-to-refresh)
   - Charger les données via videoApi.getHistory au mount

2. src/components/home/URLInput.tsx — Input principal
   - TextInput grand, bordure glassmorphic, placeholder "Colle un lien YouTube"
   - Icône link à gauche
   - Bouton "Analyser" intégré à droite (gradient indigo→violet, désactivé si URL vide)
   - Validation YouTube URL en temps réel (regex : youtube.com/watch, youtu.be/, youtube.com/shorts)
   - Quand URL valide : afficher mini-preview (titre vidéo + thumbnail) sous l'input — via videoApi.getVideoInfo si dispo
   - Bouton clipboard : "Coller" si clipboard contient une URL YouTube (expo-clipboard)
   - Loading spinner pendant validation
   - Sur "Analyser" : appeler useAnalysis().startAnalysis(url, options) puis router.push('/analysis/[taskId]')
   - Lien discret "Options avancées >" sous l'input → ouvre OptionsSheet

3. src/components/home/RecentCarousel.tsx — Carousel horizontal
   - Props : { title: string; items: AnalysisSummary[]; showEmpty?: boolean }
   - FlashList horizontal, estimatedItemSize={180}
   - Chaque item : Card glassmorphic (180x140) avec thumbnail (expo-image), titre (2 lignes max), durée, date relative
   - Tap → router.push(`/(tabs)/analysis/${item.id}`)
   - Empty state : Card avec icône + "Analyse ta première vidéo" (si showEmpty)
   - Skeleton loading (3 Skeleton cards)

4. src/components/home/CreditBar.tsx — Barre de crédits
   - Utilise useCredits() hook
   - ProgressBar animée avec label "12/40 analyses ce mois"
   - Couleur auto : vert (>50%), jaune (>20%), rouge (<20%)
   - Si isCritical : texte warning + tap ouvre upgrade
   - Compact : une seule ligne

5. src/components/home/OptionsSheet.tsx — BottomSheet options
   - BottomSheet (@gorhom/bottom-sheet) avec snapPoints ['40%']
   - Section "Mode d'analyse" : 3 Chips (Accessible / Standard / Expert) — default Standard
   - Section "Langue" : 2 Chips (Français / English) — default Français
   - Les sélections sont sauvées dans analysisStore.setOptions()
   - Pas de bouton "Appliquer" — sélection directe avec haptic feedback
   - Titre "Options" + bouton close (X)

COMPORTEMENT COMPLET :
1. Au mount : charger historique (videoApi.getHistory) + crédits (useCredits)
2. User colle/tape URL → validation temps réel → preview si valide
3. User tape "Analyser" → startAnalysis(url) → router.push vers analysis/[taskId]
4. Pull-to-refresh → recharger historique + crédits

RÈGLES STRICTES :
- FlashList partout (PAS FlatList)
- Smart defaults : mode=standard, langue=fr (pas besoin de configurer pour la majorité)
- Haptic feedback : impactMedium sur "Analyser", impactLight sur les Chips
- expo-clipboard pour le bouton coller
- expo-image pour les thumbnails (avec placeholder blurhash si dispo)
- Dates relatives : "Il y a 2h", "Hier", "12 jan" (créer un utilitaire formatRelativeDate)
- Performance : mémoriser les items avec useCallback/useMemo
- StyleSheet.create en bas, pas de styles inline
- Tous les textes en français
- TypeScript strict, pas de any

Commence par lire :
- src/services/api.ts (cherche videoApi, historyApi)
- src/stores/analysisStore.ts
- src/hooks/useAnalysis.ts
- src/hooks/useCredits.ts
- src/components/ui/Card.tsx
- src/components/ui/ProgressBar.tsx
- src/components/ui/Chip.tsx
- src/components/ui/BottomSheet.tsx
- src/theme/colors.ts

Puis crée les 5 fichiers. Vérifie avec npx tsc --noEmit après chaque fichier.
```

---

## FENÊTRE 3 — ANALYSIS SCREEN (LE PLUS GROS)

```
Tu es le développeur de la branche v2/analysis du projet DeepSight Mobile V2 (Expo SDK 54 / React Native 0.81 / TypeScript strict).

MISSION : Recréer l'écran d'analyse — le cœur de l'app. L'ancien faisait 1682 lignes avec 30+ useState. La V2 doit être modulaire : max 300 lignes par fichier.

CONTEXTE TECHNIQUE :
- Navigation : Expo Router, route dynamique app/(tabs)/analysis/[id].tsx (existe déjà en placeholder)
- Hooks : useAnalysis (src/hooks/useAnalysis.ts), useChat (src/hooks/useChat.ts)
- Stores : analysisStore (src/stores/analysisStore.ts)
- API : videoApi, chatApi dans src/services/api.ts
- PagerView : react-native-pager-view (installé) pour swipe entre onglets
- UI primitives : src/components/ui/

ARCHITECTURE — 1 screen + 5 composants :

1. app/(tabs)/analysis/[id].tsx — Screen principal (~250 lignes max)
   - useLocalSearchParams<{ id: string }>() pour récupérer l'ID
   - Charger le summary via videoApi.getSummary(id) avec useQuery
   - SI l'analyse est en cours (status !== 'completed') : afficher StreamingOverlay
   - SI complétée : afficher le contenu
   - Header animé : titre vidéo qui collapse au scroll (Reanimated interpolate)
   - Bouton retour (←) en haut à gauche
   - VideoPlayer collapsible en haut
   - Tab selector : 2 boutons "Résumé" / "Chat" avec indicateur animé
   - PagerView pour swiper entre SummaryView et ChatView
   - ActionBar fixe en bas
   - SafeAreaView + StatusBar light

2. src/components/analysis/StreamingOverlay.tsx — Overlay pendant l'analyse
   - Modal plein écran semi-transparent
   - Cercle de progression animé (SVG + Reanimated, arc qui se remplit de 0 à 100%)
   - 5 étapes textuelles avec icônes :
     ○ Connexion au serveur
     ○ Récupération des métadonnées
     ○ Extraction de la transcription
     ○ Analyse IA en cours
     ○ Terminé !
   - Étape active : couleur indigo + pulse animation
   - Étapes complétées : vert + checkmark
   - Texte progression : "42%" centré dans le cercle
   - Estimation temps : "~30 secondes restantes"
   - Bouton "Annuler" discret en bas (ghost button)
   - Quand 100% : animation de sortie (fade + scale down) puis révèle le contenu

3. src/components/analysis/SummaryView.tsx — Vue résumé
   - ScrollView avec le contenu markdown du résumé
   - Utiliser react-native-markdown-display pour le rendu (si installé, sinon Text simple avec parsing basique)
   - Badges de fiabilité inline : quand le texte contient [SOLIDE], [PLAUSIBLE], [INCERTAIN], [A VERIFIER] → remplacer par le composant Badge coloré
   - Sections collapsibles (si le résumé a des headers ##)
   - Mode streaming : si isStreaming, afficher le texte progressivement (store.streamingText) avec curseur clignotant
   - Bouton "Copier le résumé" en haut à droite (expo-clipboard)

4. src/components/analysis/ChatView.tsx — Vue chat contextuel
   - FlatList inversée (inverted={true}) pour les messages
   - En haut : 3 chips de questions suggérées (exemples FR) :
     "Résume en 3 points", "Quels sont les arguments ?", "C'est fiable ?"
   - Bulle user : alignée à droite, fond indigo
   - Bulle assistant : alignée à gauche, fond surface (bgCard)
   - Input en bas : TextInput + bouton envoi (icône send, indigo)
   - Typing indicator : 3 points animés quand isLoading
   - Compteur discret sous l'input : "3/15 questions"
   - useChat(summaryId) pour la logique
   - Empty state : illustration + "Pose ta première question sur cette vidéo"
   - Pas de toggle web search, pas de markdown complexe dans les réponses

5. src/components/analysis/ActionBar.tsx — Barre d'actions fixe
   - Position absolue en bas, au-dessus du tab bar (bottom: 80)
   - Fond glassmorphic (blur + semi-transparent)
   - 3 boutons icône + label horizontal :
     ⭐ Favori (toggle, haptic, analysisStore.toggleFavorite)
     📤 Partager (expo-sharing Share.share avec titre + URL)
     📚 Étudier (router.push vers study tab)
   - Animations : withSpring scale sur press
   - État favori synchronisé avec le store

6. src/components/analysis/VideoPlayer.tsx — Player YouTube (optionnel, simplifié)
   - SI react-native-youtube-iframe est installé : player intégré
   - SINON : Card avec thumbnail (expo-image) + bouton play → Linking.openURL(youtube)
   - Collapsible : au scroll vers le bas, le player se réduit (Reanimated interpolate height)
   - Hauteur expanded : 200px, collapsed : 0 (disparaît)

RÈGLES STRICTES :
- MAX 300 lignes par fichier — décomposer si nécessaire
- Pas de useState en cascade — utiliser les stores Zustand
- Toute animation = Reanimated 3 (useSharedValue, useAnimatedStyle, withSpring/withTiming)
- Haptic : impactLight sur favori, impactMedium sur partage, selectionAsync sur envoi message
- Gestion erreurs : chaque composant a un error state avec bouton retry
- Loading : Skeleton pour le summary, typing dots pour le chat
- StyleSheet.create en bas de chaque fichier
- TypeScript strict, aucun any
- Textes en français

Commence par lire :
- src/services/api.ts (videoApi.getSummary, videoApi.getStatus, chatApi)
- src/hooks/useAnalysis.ts
- src/hooks/useChat.ts
- src/stores/analysisStore.ts
- src/components/ui/Badge.tsx
- src/components/ui/Card.tsx
- src/theme/colors.ts

Crée d'abord le screen principal, puis les composants un par un. Typecheck après chaque fichier : npx tsc --noEmit 2>&1 | grep "analysis"
À la fin : npx tsc --noEmit complet.
```

---

## FENÊTRE 4 — LIBRARY SCREEN

```
Tu es le développeur de la branche v2/library du projet DeepSight Mobile V2 (Expo SDK 54 / React Native 0.81 / TypeScript strict).

MISSION : Créer le Library Screen — l'historique de toutes les analyses de l'utilisateur.

CONTEXTE TECHNIQUE :
- Navigation : Expo Router, fichier app/(tabs)/library.tsx (placeholder existant à réécrire)
- API : historyApi.getHistory() et videoApi dans src/services/api.ts
- Store : analysisStore (pour les favoris)
- TanStack Query : useInfiniteQuery pour la pagination
- FlashList : @shopify/flash-list
- UI primitives : src/components/ui/

FICHIERS À CRÉER :

1. app/(tabs)/library.tsx — Screen principal (réécrire le placeholder)
   Layout :
   - Header : "Ma Bibliothèque" + icône recherche (🔍) à droite
   - Tap 🔍 → expand SearchBar animée
   - Chip "⭐ Favoris" pour toggle filtre
   - FlashList vertical scroll infini (20 items par page)
   - useInfiniteQuery avec historyApi.getHistory({ page, limit: 20 })
   - Pull-to-refresh (RefreshControl)
   - Chaque item = AnalysisCard
   - Tap card → router.push(`/(tabs)/analysis/${item.id}`)
   - Empty state : icône + "Analyse ta première vidéo" + bouton "Commencer" → Home tab
   - Loading state : 5 Skeleton cards

2. src/components/library/AnalysisCard.tsx — Card d'analyse
   Props : { summary: AnalysisSummary; isFavorite: boolean; onPress: () => void; onDelete: (id: string) => void }
   Layout horizontal :
   - Thumbnail à gauche (80x60, border-radius 8, expo-image avec placeholder gris)
   - À droite : titre (2 lignes max, ellipsis), sous-titre "Chaîne · 12min", date relative
   - Icône ⭐ si favori (petit, coin haut droit)
   - Reanimated : scale 0.98 on press (withSpring)
   - Swipe gauche → révèle bouton rouge "Supprimer" (Reanimated translateX + PanGestureHandler)
   - Sur delete : Alert.alert confirmation → suppression optimiste (retirer de la liste, API call, rollback si échec)
   - Fond glassmorphic (Card style)

3. src/components/library/SearchBar.tsx — Barre de recherche expandable
   Props : { value: string; onChangeText: (text: string) => void; onClose: () => void }
   - Animation expand : de 0 width → full width (Reanimated withTiming)
   - Auto-focus quand ouvert
   - Icône search à gauche, bouton X à droite pour fermer
   - Debounce 300ms (setTimeout + clearTimeout dans useCallback)
   - Filtre côté client par titre et URL du summary
   - Fond glassmorphic, bordure focusée indigo

UTILITAIRE À CRÉER :
4. src/utils/formatDate.ts
   - formatRelativeDate(dateString: string): string
   - Logique : <1min "À l'instant", <1h "Il y a Xmin", <24h "Il y a Xh", <48h "Hier", sinon "12 jan 2026"
   - Export nommé

RÈGLES STRICTES :
- FlashList avec estimatedItemSize={80} — PAS FlatList
- useInfiniteQuery de @tanstack/react-query pour la pagination
- Swipe-to-delete avec PanGestureHandler (react-native-gesture-handler) + Reanimated
- Suppression optimiste : retirer immédiatement de la liste, API call en background, rollback si erreur
- Pas de Grid view, pas de filtres catégorie/mode — simplicité maximum
- Pas de tabs Videos/Playlists — tout dans une liste unique
- Cache TanStack Query avec staleTime: 5 * 60 * 1000
- StyleSheet.create en bas
- TypeScript strict
- Textes en français

Commence par lire :
- src/services/api.ts (cherche historyApi, videoApi.deleteSummary)
- src/stores/analysisStore.ts (favorites)
- src/types/index.ts (AnalysisSummary)
- src/components/ui/Card.tsx
- src/components/ui/Chip.tsx
- src/components/ui/Skeleton.tsx

Crée les 4 fichiers. Typecheck après chaque : npx tsc --noEmit 2>&1 | grep "library\|formatDate"
À la fin : npx tsc --noEmit complet.
```

---

## FENÊTRE 5 — STUDY HUB

```
Tu es le développeur de la branche v2/study du projet DeepSight Mobile V2 (Expo SDK 54 / React Native 0.81 / TypeScript strict).

MISSION : Créer le Study Hub — un NOUVEAU tab dédié aux révisions (flashcards + quiz). C'est une feature différenciante de DeepSight.

CONTEXTE TECHNIQUE :
- Navigation : Expo Router, fichier app/(tabs)/study.tsx (placeholder à réécrire)
- Store : studyStore (src/stores/studyStore.ts) — progress par vidéo, stats globales, streak
- Hook : useStudy (src/hooks/useStudy.ts) — generateFlashcards, generateQuiz, saveProgress
- API : studyApi (src/services/api.ts) — generateQuiz, generateFlashcards
- UI primitives : src/components/ui/

FICHIERS À CRÉER :

1. app/(tabs)/study.tsx — Hub Screen (réécrire le placeholder)
   Layout vertical ScrollView :
   - Header : "Réviser" (font display)
   - StatsCard en haut (stats globales)
   - Section "Reprendre" : si une session est incomplète, afficher la dernière avec bouton "Continuer"
   - Section "Toutes les vidéos" : grid 2 colonnes de VideoStudyCard
   - Charger les summaries depuis videoApi.getHistory puis croiser avec studyStore.progress
   - Empty state : "Analyse une vidéo pour commencer à réviser" + bouton vers Home

2. src/components/study/StatsCard.tsx — Carte statistiques
   Props : { stats: StudyStats } (depuis studyStore)
   Layout horizontal, Card glassmorphic :
   - 📚 "X vidéos étudiées" (totalStudied)
   - 🎯 "X% score moyen" (averageScore) avec cercle progress mini (Reanimated)
   - 🔥 "X jours de suite" (streak) avec animation flamme si streak > 0
   - Si aucune stat : afficher "Commence à réviser !"

3. src/components/study/VideoStudyCard.tsx — Card par vidéo
   Props : { summary: AnalysisSummary; progress?: StudyProgress; onFlashcards: () => void; onQuiz: () => void }
   Layout vertical, Card glassmorphic (largeur 50% - spacing) :
   - Thumbnail en haut (expo-image, ratio 16:9, border-radius top)
   - Titre (2 lignes max, ellipsis)
   - 2 boutons empilés :
     🃏 "Flashcards" → onFlashcards()
     ❓ "Quiz" → onQuiz()
   - Si déjà fait : Badge score (ex: "85%") en vert/jaune/rouge
   - Si jamais fait : Badge "Nouveau" en indigo
   - Si user = free plan : overlay lock + tap → BottomSheet upgrade message

4. src/components/study/FlashcardDeck.tsx — Mode Flashcards FULLSCREEN
   Ce composant est présenté en modal plein écran (router.push avec présentation modal ou state).
   Props : { summaryId: string; onClose: () => void }

   Comportement :
   - Au mount : appeler useStudy(summaryId).generateFlashcards()
   - Loading : Skeleton + texte "Génération des flashcards..."
   - Deck de cartes empilées (1 visible à la fois)
   - FLIP 3D : tap sur la carte → rotation Y 180° (Reanimated 3, rotateY interpolation)
     Face avant : question (texte blanc, fond bgCard)
     Face arrière : réponse (texte blanc, fond indigo/20%)
   - SWIPE : PanGestureHandler
     Droite (>100px) = "Je sais" → carte sort à droite, vert flash, compteur +1
     Gauche (>100px) = "Je ne sais pas" → carte sort à gauche, rouge flash
   - Progress bar en haut : "8/20"
   - Bouton retour (X) en haut à gauche
   - Animation de la carte suivante : spring entrance from bottom
   - Haptic : impactMedium sur flip, notificationSuccess/Error sur swipe
   - Écran fin : score final (X/Y), bouton "Recommencer" ou "Fermer"
   - Sauvegarder avec useStudy().saveProgress({ flashcardsCompleted, flashcardsTotal })

5. src/components/study/QuizGame.tsx — Mode Quiz FULLSCREEN
   Props : { summaryId: string; onClose: () => void }

   Comportement :
   - Au mount : appeler useStudy(summaryId).generateQuiz()
   - Loading : Skeleton + texte "Génération du quiz..."
   - 1 question à la fois, plein écran
   - Question en haut (texte grand, font bodySemiBold)
   - 4 boutons réponse (Cards pressables, pleine largeur)
   - Timer optionnel : cercle countdown 15s (Reanimated arc animation)
   - Au tap sur une réponse :
     Si correct : fond vert + haptic notificationSuccess + "+1" animé
     Si incorrect : fond rouge + shake animation (Reanimated translateX wiggle) + haptic notificationError
     Afficher l'explication (texte gris sous les options) pendant 2s
   - Auto-advance à la question suivante après 2s
   - Score running en haut : "4/7"
   - Écran fin : score circulaire animé (ex: "85%"), détail réponses (correct/incorrect par question)
   - Boutons : "Recommencer" / "Fermer"
   - Sauvegarder avec useStudy().saveProgress({ quizScore, quizTotal })

INTÉGRATION DANS LE HUB :
- Tap "Flashcards" sur une VideoStudyCard → setState showFlashcards = { summaryId }
- Tap "Quiz" → setState showQuiz = { summaryId }
- Rendu conditionnel dans study.tsx :
  if (showFlashcards) return <FlashcardDeck summaryId={showFlashcards} onClose={() => setShowFlashcards(null)} />
  if (showQuiz) return <QuizGame summaryId={showQuiz} onClose={() => setShowQuiz(null)} />
  else return le hub normal

RÈGLES STRICTES :
- Animations Reanimated 3 pour TOUT : flip 3D, swipe, shake, progress, transitions
- PanGestureHandler (react-native-gesture-handler) pour le swipe des flashcards
- Haptic feedback sur chaque interaction
- Gate plan : si user.plan === 'free', afficher un message "Fonctionnalité Student+" avec bouton upgrade
- Données persistées via studyStore (AsyncStorage)
- Pas de MindMap — retiré du scope V2
- Max 300 lignes par fichier
- StyleSheet.create en bas
- TypeScript strict, pas de any
- Textes en français

Commence par lire :
- src/services/api.ts (cherche studyApi)
- src/hooks/useStudy.ts
- src/stores/studyStore.ts
- src/types/v2.ts (Flashcard, QuizQuestionV2, StudyProgress, StudyStats)
- src/components/ui/Card.tsx
- src/components/ui/Badge.tsx
- src/components/ui/ProgressBar.tsx
- src/theme/animations.ts (springs, timings)

Crée les 5 fichiers un par un. Typecheck après chaque : npx tsc --noEmit 2>&1 | grep "study"
À la fin : npx tsc --noEmit complet.
```

---

## FENÊTRE 6 — PROFILE + UPGRADE

```
Tu es le développeur de la branche v2/profile du projet DeepSight Mobile V2 (Expo SDK 54 / React Native 0.81 / TypeScript strict).

MISSION : Créer le Profile Screen (fusion de 4 anciens écrans : Profil, Settings, Usage, Account) et l'Upgrade Screen.

CONTEXTE TECHNIQUE :
- Navigation : Expo Router, fichier app/(tabs)/profile.tsx (placeholder à réécrire) + app/upgrade.tsx (nouveau)
- Store : authStore (src/stores/authStore.ts) — user, logout
- Hooks : useCredits (src/hooks/useCredits.ts)
- API : authApi, billingApi, usageApi dans src/services/api.ts
- UI primitives : src/components/ui/

FICHIERS À CRÉER :

1. app/(tabs)/profile.tsx — Profile Screen (réécrire le placeholder)
   Layout vertical ScrollView :

   === Section Profil ===
   - Avatar (composant Avatar de ui/) + Username + Email
   - Badge plan actuel (ex: "Pro" en violet, "Free" en gris)
   - Si plan payant : bouton "Gérer l'abonnement" → billingApi.getPortalUrl() → WebBrowser.openBrowserAsync(url)
   - Si plan gratuit : bouton "Passer à Premium ✨" → router.push('/upgrade')

   === Section Utilisation (UsageSection) ===

   === Section Préférences (PreferencesSection) ===

   === Section Compte (AccountSection) ===

   === Bas de page ===
   - Version app (expo-constants : Constants.expoConfig?.version)
   - Bouton "Se déconnecter" (ghost, rouge)

2. src/components/profile/UsageSection.tsx
   Props : aucune (utilise useCredits() en interne)
   Layout :
   - Titre section "Utilisation"
   - ProgressBar "Analyses" : "12/40 ce mois" avec couleur auto
   - ProgressBar "Crédits" : "1200/3000 utilisés" avec couleur auto
   - Texte "Renouvellement dans X jours" (calculer depuis user.subscription_end ou current_period_end)
   - Card glassmorphic pour le container

3. src/components/profile/PreferencesSection.tsx
   Props : aucune (utilise un state local ou AsyncStorage)
   Layout :
   - Titre section "Préférences"
   - Row "Thème" : label + valeur actuelle → tap ouvre BottomSheet avec options "Auto" / "Sombre"
   - Row "Langue" : label + valeur actuelle → tap ouvre BottomSheet avec options "Français" / "English"
   - Style : ListItem avec chevron > à droite
   - Sauvegarder dans AsyncStorage (clés depuis STORAGE_KEYS dans constants/config.ts)

4. src/components/profile/AccountSection.tsx
   Props : aucune (utilise authStore et authApi en interne)
   Layout :
   - Titre section "Compte"
   - Row "Modifier le profil" → tap ouvre BottomSheet avec inputs username + email + bouton sauvegarder
     → authApi.updateProfile({ username, email })
     → authStore.updateUser({ username, email })
   - Row "Changer le mot de passe" → tap ouvre BottomSheet avec 3 inputs (ancien, nouveau, confirmer)
     → authApi.changePassword(oldPassword, newPassword)
   - Row "Conditions d'utilisation" → Linking.openURL('https://www.deepsightsynthesis.com/legal')
   - Row "Nous contacter" → Linking.openURL('mailto:contact@deepsightsynthesis.com')
   - Séparateur
   - Row "Supprimer mon compte" (texte rouge) → flow double confirmation :
     Alert 1 : "Es-tu sûr ? Cette action est irréversible."
     Alert 2 : "Confirme en tapant ton mot de passe" → prompt password → authApi.deleteAccount(password)
     Sur succès : authStore.logout() → router.replace('/(auth)')

5. app/upgrade.tsx — Pricing Screen (nouveau fichier, hors tabs)
   Layout :
   - Header avec bouton retour ← et titre "Passer au niveau supérieur"
   - PagerView horizontal (react-native-pager-view) avec 4 plan cards :
     Student (2.99€), Starter (5.99€), Pro (12.99€), Team (29.99€)
   - Dots indicator en bas du carousel
   - Texte "Plan actuel : {planName}" en bas
   - SafeAreaView, fond bgPrimary

6. src/components/upgrade/PlanCard.tsx
   Props : { plan: { id: string; name: string; price: string; features: string[]; popular?: boolean }; isCurrentPlan: boolean; onSelect: (planId: string) => void }
   Layout Card glassmorphic pleine hauteur (~70% écran) :
   - Badge "Populaire" sur Pro (gradient indigo)
   - Badge "Actuel" si isCurrentPlan (bordure verte)
   - Nom du plan (font display, grand)
   - Prix "5.99€/mois"
   - Liste features : chaque item avec ✅ vert + texte
   - Bouton CTA en bas : "Choisir ce plan" (primary gradient)
   - Disabled si isCurrentPlan (opacité réduite, texte "Plan actuel")
   - Sur tap CTA : billingApi.createCheckout(planId) → WebBrowser.openBrowserAsync(checkoutUrl)

DONNÉES DES PLANS (hardcoded dans upgrade.tsx) :
```typescript
const UPGRADE_PLANS = [
  { id: 'student', name: 'Student', price: '2,99€', period: '/mois',
    features: ['40 analyses/mois', '2000 crédits', 'Flashcards & Quiz', 'Exports PDF'] },
  { id: 'starter', name: 'Starter', price: '5,99€', period: '/mois',
    features: ['60 analyses/mois', '3000 crédits', 'Vidéos 2h max', 'Exports tous formats', '60 jours historique'] },
  { id: 'pro', name: 'Pro', price: '12,99€', period: '/mois', popular: true,
    features: ['300 analyses/mois', '15000 crédits', 'Playlists complètes', 'Chat illimité', 'TTS audio', 'Support prioritaire'] },
  { id: 'team', name: 'Team', price: '29,99€', period: '/mois',
    features: ['1000 analyses/mois', '50000 crédits', 'Accès API', '5 utilisateurs', 'Dashboard analytics'] },
];
```

RÈGLES STRICTES :
- TOUTES actions destructives (logout, delete) = Alert.alert avec confirmation
- Delete account = double confirmation + saisie mot de passe obligatoire
- Stripe checkout = expo-web-browser (WebBrowser.openBrowserAsync) — PAS de WebView inline
- Pas d'écran Settings/Account/Usage séparés — tout est fusionné dans profile.tsx
- Pas de graphiques/charts dans la section utilisation
- BottomSheet pour tous les formulaires d'édition (profil, mot de passe, sélecteurs)
- Haptic feedback sur les actions importantes
- StyleSheet.create en bas
- TypeScript strict, aucun any
- Textes en français

Commence par lire :
- src/services/api.ts (cherche authApi, billingApi, usageApi)
- src/stores/authStore.ts
- src/hooks/useCredits.ts
- src/components/ui/Avatar.tsx
- src/components/ui/ProgressBar.tsx
- src/components/ui/BottomSheet.tsx
- src/components/ui/Button.tsx
- src/constants/config.ts (PLANS, STORAGE_KEYS)

Crée les 6 fichiers un par un. Typecheck après chaque : npx tsc --noEmit 2>&1 | grep "profile\|upgrade"
À la fin : npx tsc --noEmit complet.
```

---

## Commande de lancement rapide

```powershell
# Terminal 1 — AUTH
cd C:\Users\33667\DeepSight-Main\mobile && claude --dangerously-skip-permissions

# Terminal 2 — HOME
cd C:\Users\33667\DeepSight-Main\mobile && claude --dangerously-skip-permissions

# Terminal 3 — ANALYSIS
cd C:\Users\33667\DeepSight-Main\mobile && claude --dangerously-skip-permissions

# Terminal 4 — LIBRARY
cd C:\Users\33667\DeepSight-Main\mobile && claude --dangerously-skip-permissions

# Terminal 5 — STUDY
cd C:\Users\33667\DeepSight-Main\mobile && claude --dangerously-skip-permissions

# Terminal 6 — PROFILE
cd C:\Users\33667\DeepSight-Main\mobile && claude --dangerously-skip-permissions
```

Puis coller le prompt correspondant dans chaque fenêtre.
