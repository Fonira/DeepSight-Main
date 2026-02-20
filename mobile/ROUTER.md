# DeepSight Mobile - Expo Router V2 Navigation

## Structure

La navigation Expo Router V2 est organisée en groupes de layouts :

```
app/
├── _layout.tsx              # Root layout avec QueryClient, SafeAreaProvider, Theme
├── splash.tsx               # Splash screen (chargement initial)
├── _404.tsx                 # Page 404 non trouvée
├── (auth)/                  # Auth group - stack non authentifié
│   ├── _layout.tsx          # Stack layout (pas de headers)
│   ├── index.tsx            # Landing/Welcome screen
│   ├── login.tsx            # Login form
│   ├── register.tsx         # Registration form
│   ├── verify.tsx           # Email verification
│   └── forgot-password.tsx  # Password reset
└── (tabs)/                  # Tabs group - stack authentifié avec custom tab bar
    ├── _layout.tsx          # Tab navigator + CustomTabBar
    ├── CustomTabBar.tsx     # Composant custom tab bar (glassmorphism + animations)
    ├── index.tsx            # Home tab
    ├── library.tsx          # Library tab
    ├── study.tsx            # Study tab
    ├── profile.tsx          # Profile tab
    └── analysis/
        └── [id].tsx         # Dynamic route - détail d'analyse
```

## Flux d'authentification

```
Root Layout
    ↓
  Theme + Query Client + Auth Provider
    ↓
  isLoading ? → splash.tsx (écran de chargement)
    ↓
  isAuthenticated ?
    ├─ YES → (tabs) group
    └─ NO → (auth) group
```

## Custom Tab Bar

Le `CustomTabBar.tsx` implémente :

- **Glassmorphism** : BlurView avec rgba(12, 12, 26, 0.85) + backdrop-blur
- **Animated indicator** : Top bar indicateur avec animation Reanimated
- **Icons** : Ionicons (home, book, school, person)
- **Colors** : Indigo actif (#6366f1), gris inactif (rgba(255,255,255,0.4))
- **Haptic feedback** : Impactasync à chaque changement de tab
- **Safe area** : Padding bas auto-géré

## Conventions

### Routes dynamiques
```typescript
// Accéder à [id] depuis une screen
import { useLocalSearchParams } from 'expo-router';

const { id } = useLocalSearchParams<{ id: string }>();
```

### Deep linking
L'app est configurée avec `scheme: "deepsight"` dans app.json :
```
deepsight://analysis/123        → app/(tabs)/analysis/[id].tsx
https://deepsightsynthesis.com/analysis/123  → même screen
```

### Navigation
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();
router.push('/login');              // Navigue vers (auth)/login
router.push('/(tabs)/library');     // Navigue vers (tabs)/library
router.push('/(tabs)/analysis/42'); // Navigue vers (tabs)/analysis/[id].tsx
router.push('...');                 // Remonte d'un niveau
router.back();                      // Retour historique
```

## Styles et Thème

- **Couleurs** : Importé depuis `@/theme/colors` (darkColors, palette)
- **Espacement** : Importé depuis `@/theme/spacing` (sp, borderRadius)
- **Typography** : Importé depuis `@/theme/typography` (fontFamily, fontSize, textStyles)
- **Animations** : Reanimated pour les transitions
- **Safe area** : Gestion auto via useSafeAreaInsets()

## QueryClient

Configuration dans `src/utils/queryClient.ts` :
- `gcTime` : 24 heures
- `staleTime` : 5 minutes
- Retry automatique avec backoff exponentiel

## Fonts

Les polices sont chargées en root layout via expo-font :
- DMSans (Regular, Medium, SemiBold, Bold)
- JetBrainsMono (Code)
- Cormorant (Display)

## Splash Screen

Gérée via expo-splash-screen :
1. Prévient l'auto-hide au démarrage
2. Affiche pending pendant le chargement des fonts
3. Se masque quand les fonts sont chargées
4. Root layout affiche `splash.tsx` pendant `isLoading`

## StatusBar

- Style : `light-content` (couleur claire)
- Fond : `darkColors.bgPrimary` (#0a0a0f)
- Configuré au root layout

## À compléter

### Auth group screens
- [ ] login.tsx - Implémenter formulaire (email, password, Google OAuth)
- [ ] register.tsx - Implémenter formulaire (username, email, password)
- [ ] verify.tsx - Code de vérification OTP ou lien email
- [ ] forgot-password.tsx - Reset password avec email

### Tabs group screens
- [ ] index.tsx - Dashboard avec actions récentes
- [ ] library.tsx - Liste des analyses avec filtres/search
- [ ] study.tsx - Flashcards, mind maps, glossaire
- [ ] profile.tsx - Infos user, plans, settings
- [ ] analysis/[id].tsx - Détail complet d'une analyse

### Fonctionnalités additionnelles
- [ ] Linking setup pour deep links
- [ ] Error boundary global
- [ ] Navigation middleware (auth guards)
- [ ] Toast/notifications système
