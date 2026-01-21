# Deep Sight Mobile

Application mobile React Native/Expo pour Deep Sight - Analyse de vidéos YouTube par IA.

## Fonctionnalités

- Analyse de vidéos YouTube avec différents modes (synthèse, détaillé, critique, éducatif)
- Historique des analyses avec recherche et favoris
- Chat avec l'IA sur les contenus analysés
- Outils d'étude (quiz, mindmaps, flashcards)
- Gestion du compte et des abonnements
- Mode sombre/clair
- Support multilingue (FR/EN)

## Technologies

- **React Native** avec **Expo SDK 51**
- **TypeScript** pour la sécurité de type
- **React Navigation** pour la navigation
- **React Query** pour la gestion des données serveur
- **Zustand** pour la gestion d'état locale
- **Expo SecureStore** pour le stockage sécurisé des tokens

## Installation

### Prérequis

- Node.js >= 18
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Xcode (pour iOS)
- Android Studio (pour Android)

### Étapes

1. Installer les dépendances :
```bash
cd DeepSight-Mobile
npm install
```

2. Lancer l'application en mode développement :
```bash
npm start
```

3. Ouvrir sur un appareil/simulateur :
- Appuyer sur `i` pour iOS Simulator
- Appuyer sur `a` pour Android Emulator
- Scanner le QR code avec l'app Expo Go

## Build pour Production

### Configuration EAS

1. Installer EAS CLI :
```bash
npm install -g eas-cli
```

2. Se connecter à Expo :
```bash
eas login
```

3. Configurer le projet :
```bash
eas build:configure
```

### Build iOS

```bash
# Build pour l'App Store
npm run build:ios

# Soumettre à l'App Store
npm run submit:ios
```

### Build Android

```bash
# Build pour le Play Store
npm run build:android

# Soumettre au Play Store
npm run submit:android
```

## Configuration App Store

### iOS

1. Créer un App ID sur Apple Developer Portal
2. Mettre à jour `app.json` avec votre `bundleIdentifier`
3. Configurer les certificats et profils dans EAS
4. Ajouter les icônes dans `src/assets/images/`:
   - `icon.png` (1024x1024)
   - `splash.png` (1284x2778)
   - `adaptive-icon.png` (1024x1024)

### Android

1. Créer une app sur Google Play Console
2. Mettre à jour `app.json` avec votre `package`
3. Générer une clé de signature
4. Ajouter le fichier `google-services.json` si nécessaire

## Structure du Projet

```
DeepSight-Mobile/
├── App.tsx                 # Point d'entrée
├── app.json               # Configuration Expo
├── eas.json               # Configuration EAS Build
├── src/
│   ├── assets/            # Images et polices
│   ├── components/        # Composants réutilisables
│   │   └── ui/           # Composants UI de base
│   ├── constants/         # Configuration et thème
│   ├── contexts/          # Contextes React (Auth, Theme)
│   ├── hooks/             # Hooks personnalisés
│   ├── navigation/        # Configuration de navigation
│   ├── screens/           # Écrans de l'application
│   ├── services/          # Services API
│   ├── types/             # Types TypeScript
│   └── utils/             # Utilitaires
└── package.json
```

## Variables d'Environnement

Pour la production, configurez les variables dans `app.json` ou via EAS Secrets :

- `VITE_API_URL` : URL du backend API

## Support

Pour toute question ou problème, contactez l'équipe Deep Sight.

## Licence

Propriétaire - Tous droits réservés.
