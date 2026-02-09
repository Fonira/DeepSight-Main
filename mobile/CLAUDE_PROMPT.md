Tu es le Senior Tech Lead du projet DeepSight Mobile (Expo SDK 54 / React Native 0.81.5 / TypeScript).

Backend API: https://deep-sight-backend-v3-production.up.railway.app/api

## TA MISSION
Complete les 5 features manquantes de l'app mobile, dans cet ordre:

### 1. PLAYLISTS SCREEN (PlaylistsScreen.tsx)
- Remplace le stub actuel par un ecran fonctionnel
- CRUD complet: liste, creation, suppression de playlists
- Utilise playlistApi deja implemente dans src/services/api.ts
- Pull-to-refresh, empty state, loading skeletons
- Modal de creation (titre + description)

### 2. FACT-CHECKING TAB
- Dans AnalysisResultScreen.tsx, ajoute un 5eme onglet "Fact-Check"
- Appelle l'endpoint de fact-checking du backend
- Affiche les claims avec statut (verified/disputed/unverified)
- Sources cliquables, score de fiabilite

### 3. EXPORT (PDF/Markdown)
- Bouton export dans le header de AnalysisResultScreen
- Bottom sheet avec choix du format
- Utilise expo-sharing et expo-file-system
- Installe les deps: npx expo install expo-sharing expo-file-system

### 4. MIND MAP
- Nouveau composant src/components/MindMap.tsx
- Utilise react-native-svg pour le rendu
- Pan & zoom avec gestures
- Installe: npx expo install react-native-svg

### 5. TTS AUDIO PLAYER
- Nouveau composant src/components/AudioPlayer.tsx
- Utilise expo-av pour la lecture audio
- Controles play/pause/seek, vitesse variable
- Installe: npx expo install expo-av

## REGLES
- Lis d'abord les fichiers existants avant de modifier (api.ts, navigation, screens existants)
- TypeScript strict, pas de any
- Utilise le ThemeContext existant pour les couleurs
- Texte en francais dans l'UI
- Apres chaque feature, verifie: npx tsc --noEmit
- Commite chaque feature separement avec un message descriptif
