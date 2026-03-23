---
allowed-tools: Read, Edit, Write, Grep, Glob
description: Best practices React Native / Expo pour DeepSight mobile — composants, navigation, performance, styles
---

# React Native Best Practices

Appliquer pour : $ARGUMENTS

## Composants
- UNIQUEMENT : `<View>`, `<Text>`, `<ScrollView>`, `<TouchableOpacity>`, `<FlatList>`, `<Image>`, `<TextInput>`, `<Pressable>`
- JAMAIS : `<div>`, `<span>`, `<p>`, `<button>`, `<input>` → crash fatal
- Composants fonctionnels uniquement (pas de class components)
- Typage strict des props avec TypeScript interfaces

## Styles
- `StyleSheet.create()` OBLIGATOIRE (pas d'inline styles, pas de Tailwind sauf NativeWind configuré)
- Pas de unités CSS (px, em, rem) → utiliser des nombres bruts
- Flexbox par défaut (`flexDirection: 'column'` en RN)
- `Platform.select()` pour différences iOS/Android

## Navigation
- React Navigation (Stack + Tab) : `@react-navigation/*`
- Typed navigation : `NativeStackNavigationProp<RootStackParamList>`
- Deep linking configuré dans `app.json`

## Performance
- `FlatList` au lieu de `ScrollView` pour les listes (virtualisation)
- `React.memo()` sur les composants lourds
- `useMemo` / `useCallback` pour éviter les re-renders
- Images : dimensions fixes, `resizeMode`, cache
- Animations : `react-native-reanimated` (pas Animated API de base)

## Stockage
- Tokens sensibles → `expo-secure-store` (chiffré par l'OS)
- Préférences non-sensibles → `@react-native-async-storage`
- JAMAIS `localStorage` (n'existe pas en RN)

## Expo SDK 54
- Managed workflow uniquement
- `app.json` pour la config (pas `app.config.js` sauf si dynamique)
- `eas.json` pour les profils de build
- `expo-constants` pour les env vars runtime

## API
- Même endpoints que le web : `https://api.deepsightsynthesis.com`
- JWT dans `expo-secure-store`, ajouté dans header Authorization
- Gestion offline : afficher le dernier état caché si pas de réseau

## Tests
- Jest + @testing-library/react-native
- Maestro pour E2E (flows .yaml)
- Mock navigation, contextes, et services API