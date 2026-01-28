# DeepSight Mobile - Guide de Développement Autonome Claude

## Vue d'Ensemble du Projet

**DeepSight Mobile** est une application React Native/Expo pour l'analyse vidéo YouTube par IA. Elle doit être parfaitement synchronisée avec l'application web DeepSight.

- **Framework**: React Native 0.81.5 + Expo SDK 54
- **Langage**: TypeScript
- **État**: TanStack Query + Zustand + React Context
- **Navigation**: React Navigation 6
- **Backend**: `https://deep-sight-backend-v3-production.up.railway.app`

---

## État Actuel (Janvier 2026)

### Ce qui FONCTIONNE

| Fonctionnalité | Statut | Fichiers Clés |
|----------------|--------|---------------|
| Authentification email/mot de passe | Fonctionnel | `AuthContext.tsx`, `LoginScreen.tsx` |
| Interface de connexion/inscription | Fonctionnel | `LoginScreen.tsx`, `RegisterScreen.tsx` |
| Analyse de vidéos YouTube | Fonctionnel | `DashboardScreen.tsx`, `AnalysisScreen.tsx` |
| Affichage des résultats d'analyse | Fonctionnel | `AnalysisScreen.tsx` (4 onglets) |
| Historique des analyses | Fonctionnel | `HistoryScreen.tsx` |
| Chat IA (Q&A) | Fonctionnel | `AnalysisScreen.tsx` (onglet Chat) |
| Thème Dark/Light | Fonctionnel | `ThemeContext.tsx` |
| Navigation complète | Fonctionnel | `AppNavigator.tsx` |
| Stockage sécurisé des tokens | Fonctionnel | `storage.ts` |
| DoodleBackground animé | Fonctionnel | `DoodleBackground.tsx` |

### Ce qui NE FONCTIONNE PAS

| Problème | Cause | Solution |
|----------|-------|----------|
| Playlists | UI stub seulement | Implémenter complètement |
| Mind Map | Non implémenté | Créer avec react-native-svg |
| Export PDF | Non implémenté | Utiliser Share API |
| TTS Audio | Non implémenté | Connecter à l'API TTS existante |
| Fact-checking UI | Non implémenté | Créer le composant d'affichage |

### Ce qui a été corrigé (28/01/2026)

| Fonctionnalité | Status |
|----------------|--------|
| **Google OAuth** | ✅ Endpoint `/api/auth/google/token` existe et fonctionne |
| **Study Tools** | ✅ Nouveau router `/api/study/*` (quiz, mindmap, flashcards) |
| **Trial Pro** | ✅ Endpoints `/api/billing/trial-eligibility` et `/api/billing/start-pro-trial` |
| **Playlists CRUD** | ✅ Endpoints `POST /api/playlists` et `PUT /api/playlists/{id}` |
| **Tournesol Search** | ✅ Endpoints `/api/tournesol/search` et `/api/tournesol/recommendations` |
| **Playlist Details** | ✅ `GET /api/playlists/{id}/details` et `POST /api/playlists/{id}/corpus-summary` |
| **Corpus Analyze** | ✅ Alias `/api/playlists/analyze-corpus` → `/api/playlists/corpus/analyze` |
| **Usage Detailed** | ✅ `GET /api/usage/detailed` avec statistiques granulaires |
| **Chat Streaming** | ✅ `chatApi.sendMessageStream()` pour SSE streaming |

---

## Architecture du Projet

```
DeepSight-Mobile/
├── src/
│   ├── assets/images/          # Icônes SVG
│   ├── components/
│   │   ├── ui/                 # Button, Card, Input, Avatar, Badge
│   │   ├── backgrounds/        # DoodleBackground
│   │   ├── Header.tsx
│   │   ├── VideoCard.tsx
│   │   └── EmptyState.tsx
│   ├── constants/
│   │   ├── config.ts           # API_BASE_URL, GOOGLE_CLIENT_ID
│   │   └── theme.ts            # Couleurs, espacement, typographie
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Authentification + Google OAuth
│   │   └── ThemeContext.tsx    # Thème dark/light
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Structure de navigation complète
│   ├── screens/                # 13 écrans
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── AnalysisScreen.tsx  # Le plus complexe (4 onglets)
│   │   ├── HistoryScreen.tsx
│   │   ├── PlaylistsScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── AccountScreen.tsx
│   │   ├── UpgradeScreen.tsx
│   │   ├── UsageScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   └── VerifyEmailScreen.tsx
│   ├── services/
│   │   └── api.ts              # Client API complet (auth, video, chat, billing...)
│   ├── types/
│   │   └── index.ts            # Interfaces TypeScript
│   └── utils/
│       ├── storage.ts          # SecureStore + AsyncStorage
│       └── formatters.ts       # Utilitaires de formatage
├── App.tsx                     # Point d'entrée
├── app.json                    # Configuration Expo
└── DEVELOPMENT_STRATEGY.md     # Stratégie détaillée
```

---

## Problème Critique : Google OAuth

### Situation Actuelle (Mise à jour 28/01/2026)

L'app mobile utilise `expo-auth-session/providers/google` pour obtenir un access token directement de Google, puis l'échange avec notre backend.

**Flux actuel :**
1. L'utilisateur clique "Continuer avec Google"
2. `Google.useAuthRequest()` ouvre le flux OAuth Google
3. Google retourne un `access_token` directement à l'app
4. L'app envoie ce token à `/api/auth/google/token` pour l'échanger contre des tokens de session

**STATUS** : ✅ L'endpoint `/api/auth/google/token` **existe** sur le backend v3 (lignes 508-541 de `auth/router.py`).

### Backend Implementation (Existing)

L'endpoint est déjà implémenté dans `backend/src/auth/router.py`:

```python
@router.post("/google/token")
async def google_token_login(request: GoogleTokenRequest):
    """
    Échange un Google access token contre des tokens de session.
    Utilisé par l'app mobile qui obtient le token directement via expo-auth-session.
    """
    # Vérifie le token avec l'API Google userinfo
    # Trouve ou crée l'utilisateur
    # Retourne access_token + refresh_token + user
```

✅ Cet endpoint fonctionne correctement avec le flux mobile.

### Configuration Google Cloud Console

L'URI de redirection autorisée doit inclure :
```
https://auth.expo.io/@maximeadmin/deepsight
```

Pour le client ID web (utilisé par Expo Go) :
- Type: Application Web
- Origines JavaScript autorisées: `https://auth.expo.io`
- URIs de redirection: `https://auth.expo.io/@maximeadmin/deepsight`

---

## Tâches de Développement Prioritaires

### Phase 1 : Backend ✅ COMPLÉTÉ

1. ✅ `/api/auth/google/token` existe et fonctionne
2. ✅ `/api/billing/trial-eligibility` et `/api/billing/start-pro-trial` ajoutés
3. ✅ `/api/playlists` (POST/PUT) endpoints ajoutés
4. ✅ `/api/study/*` router ajouté (quiz, mindmap, flashcards)
5. ✅ `/api/tournesol/search` et `/api/tournesol/recommendations` ajoutés

### Phase 2 : Fonctionnalités Manquantes

1. **Playlists** - Compléter l'interface et connecter à l'API
2. **Mind Map** - Créer un composant de visualisation
3. **Quiz** - Interface interactive
4. **Export** - PDF/Markdown via Share API

### Phase 3 : Polish

1. Charger les polices personnalisées (Cormorant, DM Sans)
2. Améliorer les animations avec Reanimated
3. Ajouter TTS Audio Player
4. Affichage Fact-checking

---

## API Disponibles (Déjà Implémentées)

Toutes ces API sont prêtes dans `src/services/api.ts` :

| Module | Endpoints | Usage |
|--------|-----------|-------|
| `authApi` | login, register, googleTokenLogin, verifyEmail, logout, forgotPassword | Authentification |
| `videoApi` | analyze, getStatus, getSummary, getConcepts, factCheck, webEnrich | Analyse vidéo |
| `chatApi` | sendMessage, getHistory, getQuota | Chat IA |
| `historyApi` | getHistory, toggleFavorite, deleteSummary | Historique |
| `playlistApi` | getPlaylists, createPlaylist, analyzePlaylist | Playlists |
| `studyApi` | generateQuiz, generateMindmap, generateFlashcards | Outils d'étude |
| `billingApi` | getPlans, createCheckout, getSubscriptionStatus | Abonnements |
| `exportApi` | exportSummary (PDF, Markdown, Text) | Exports |
| `ttsApi` | generateAudio, getVoices | Text-to-Speech |

---

## Commandes Utiles

```bash
# Démarrer l'app en développement
cd DeepSight-Mobile && npx expo start

# Nettoyer le cache
npx expo start --clear

# Vérifier les types TypeScript
npm run typecheck

# Linter
npm run lint

# Build iOS (preview)
eas build --platform ios --profile preview

# Build Android (preview)
eas build --platform android --profile preview
```

---

## Configuration Importante

### Backend URL (UNIFIÉ)
```typescript
// src/constants/config.ts
export const API_BASE_URL = 'https://deep-sight-backend-v3-production.up.railway.app';
```

### Google OAuth
```typescript
// src/constants/config.ts
export const GOOGLE_CLIENT_ID = '763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com';
```

### Expo Configuration
```json
// app.json
{
  "expo": {
    "name": "Deep Sight",
    "slug": "deepsight",
    "scheme": "deepsight",
    "owner": "maximeadmin",
    "ios": { "bundleIdentifier": "com.deepsight.app" },
    "android": { "package": "com.deepsight.app" }
  }
}
```

---

## Historique des Commits (Session Précédente)

```
16f1a8f - Unify all backend URLs to deep-sight-backend-v3-production
4b3f24f - Improve Google OAuth debugging and fix deprecated useProxy
f529452 - Fix Google OAuth to use expo-auth-session with token exchange
db0a93d - Fix Google OAuth and add doodle backgrounds to all screens
9c85a91 - Add DoodleBackground component and development strategy
c2e18bb - Fix Google OAuth to use proper Expo auth redirect URI
2ab7875 - Implement Google OAuth with expo-auth-session for mobile app
60ab352 - Add .gitignore to exclude node_modules and build artifacts
55fbbd2 - Fix CI: Update package-lock.json and exclude mobile app from lint
5c68a50 - Add mobile redirect URI support for Google OAuth
f7d66bc - Fix critical bugs in mobile app authentication and UX
1fa1fe8 - Add comprehensive AnalysisScreen with chat and study tools
e4daeb4 - Add complete screens: Account, Upgrade, Usage, VerifyEmail
44df1d1 - Fix Card component style prop type to accept style arrays
7251f12 - Add missing screens and fix navigation bugs
52f3192 - Fix API configuration and login screen error handling
```

---

## Tips pour Claude Autonome

1. **Commence petit** : 5-10 itérations pour valider le setup
2. **Surveille les premiers runs** : Ajuste ce fichier si besoin
3. **Git souvent** : Permet de rollback facilement
4. **Review PROGRESS_NOTES.md** : Toutes les 30 min environ
5. **Interviens si blocage** : Marquer "NEEDS_HUMAN_REVIEW" et passer à la suite

---

## Résultat Attendu

Après le développement autonome :

- App Expo fonctionnelle
- Navigation complète
- Auth Google intégrée (une fois backend fixé)
- Analyse vidéo opérationnelle
- Interface professionnelle
- Prête pour tests sur Expo Go

---

## Fichiers Clés à Connaître

| Fichier | Importance | Description |
|---------|------------|-------------|
| `src/contexts/AuthContext.tsx` | Critique | Toute la logique d'authentification |
| `src/services/api.ts` | Critique | Toutes les requêtes API |
| `src/screens/AnalysisScreen.tsx` | Haute | Écran le plus complexe (4 onglets) |
| `src/navigation/AppNavigator.tsx` | Haute | Structure de navigation |
| `src/constants/config.ts` | Haute | Configuration API et OAuth |
| `src/constants/theme.ts` | Moyenne | Design system complet |

---

*Dernière mise à jour : 28 janvier 2026*
