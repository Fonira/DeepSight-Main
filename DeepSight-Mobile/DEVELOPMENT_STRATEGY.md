# DeepSight Mobile - Stratégie de Développement Complète

## Vue d'ensemble

Ce document définit la stratégie pour créer une application mobile DeepSight parfaitement synchronisée avec la version web, avec une interface cohérente et des fonctionnalités complètes.

---

## 1. Analyse des Écarts (Web vs Mobile)

### Design System

| Élément | Web | Mobile Actuel | Action |
|---------|-----|---------------|--------|
| **Police Display** | Cormorant Garamond | Non chargée | Ajouter via expo-font |
| **Police Body** | DM Sans | Non chargée | Ajouter via expo-font |
| **Police Code** | JetBrains Mono | Non chargée | Ajouter via expo-font |
| **DoodleBackground** | 200+ icônes SVG | Absent | Implémenter avec react-native-svg |
| **Glass Effect** | backdrop-filter blur | Absent | Simuler avec LinearGradient + opacity |
| **Animations** | CSS transitions | Basiques | Améliorer avec Reanimated |

### Fonctionnalités

| Fonctionnalité | Web | Mobile | Priorité |
|----------------|-----|--------|----------|
| Analyse vidéo | ✅ | ✅ | - |
| Chat IA | ✅ | ✅ | - |
| Flashcards | ✅ | ✅ | - |
| **Mind Map** | ✅ | ❌ | Haute |
| **Quiz** | ✅ | ❌ | Haute |
| **Export PDF** | ✅ | ❌ | Moyenne |
| **TTS Audio** | ✅ | ❌ | Moyenne |
| **Playlists** | ✅ | Stub | Haute |
| **Fact-checking** | ✅ | ❌ | Moyenne |
| **Tournesol** | ✅ | ❌ | Basse |

---

## 2. Architecture Recommandée

### Structure des Dossiers (Optimisée)

```
DeepSight-Mobile/
├── src/
│   ├── assets/
│   │   ├── fonts/              # Polices personnalisées
│   │   │   ├── CormorantGaramond-*.ttf
│   │   │   ├── DMSans-*.ttf
│   │   │   └── JetBrainsMono-*.ttf
│   │   └── images/
│   │
│   ├── components/
│   │   ├── ui/                 # Composants atomiques
│   │   ├── layout/             # Header, TabBar, SafeArea
│   │   ├── analysis/           # Composants d'analyse
│   │   ├── chat/               # Composants de chat
│   │   ├── study/              # Flashcards, Quiz, MindMap
│   │   └── backgrounds/        # DoodleBackground
│   │
│   ├── screens/                # Écrans de navigation
│   ├── navigation/             # Configuration navigation
│   ├── contexts/               # Providers React
│   ├── hooks/                  # Hooks personnalisés
│   ├── services/               # API et services
│   ├── stores/                 # Zustand stores
│   ├── constants/              # Theme, config, i18n
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utilitaires
```

### Gestion d'État

```
┌─────────────────────────────────────────────────────┐
│                    React Query                       │
│         (Cache serveur, retry, invalidation)        │
└─────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│                   Zustand Stores                     │
│  - analysisStore (analyse en cours, résultats)      │
│  - uiStore (modals, toasts, loading states)         │
└─────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│                   React Context                      │
│  - AuthContext (user, tokens)                        │
│  - ThemeContext (dark/light)                         │
│  - LanguageContext (fr/en)                           │
└─────────────────────────────────────────────────────┘
```

---

## 3. Implémentation du DoodleBackground

### Approche Technique

Utiliser `react-native-svg` pour créer un pattern répétitif d'icônes SVG :

```typescript
// src/components/backgrounds/DoodleBackground.tsx
import React, { useMemo } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Svg, { G, Path, Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

// Icônes thématiques DeepSight (mêmes paths que web)
const ICONS = {
  video: [
    "M5 3l14 9-14 9V3z", // Play
    "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z", // Camera
  ],
  study: [
    "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3zm18 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z", // Book
    "M22 10l-10-5L2 10l10 5 10-5zM6 12v5c0 2 2.7 3 6 3s6-1 6-3v-5", // Graduation
  ],
  ai: [
    "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6", // Sparkles
    "M13 2L3 14h9l-1 8 10-12h-9l1-8z", // Lightning
  ],
  // ... autres catégories
};

const TILE_SIZE = 350;

export const DoodleBackground: React.FC = () => {
  const { isDark, colors } = useTheme();
  const { width, height } = Dimensions.get('window');

  const doodles = useMemo(() => {
    // Générer 150+ icônes avec positions pseudo-aléatoires
    return generateDoodles(isDark);
  }, [isDark]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="doodlePattern"
            width={TILE_SIZE}
            height={TILE_SIZE}
            patternUnits="userSpaceOnUse"
          >
            {doodles.map((d, i) => (
              <G
                key={i}
                transform={`translate(${d.x}, ${d.y}) rotate(${d.rotation}) scale(${d.scale})`}
                opacity={d.opacity}
              >
                <Path
                  d={d.path}
                  fill={d.fill ? d.color : 'none'}
                  stroke={d.fill ? 'none' : d.color}
                  strokeWidth={d.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#doodlePattern)" />
      </Svg>
    </View>
  );
};
```

### Performance

- Utiliser `useMemo` pour éviter les recalculs
- Limiter le nombre d'éléments à ~150 pour les performances mobiles
- Utiliser `pointerEvents="none"` pour ne pas bloquer les interactions

---

## 4. Synchronisation Web/Mobile

### Principes Clés

1. **Même Backend API** - Les deux apps utilisent la même API REST
2. **Même Compte Utilisateur** - Authentification partagée via tokens JWT
3. **Historique Synchronisé** - Toutes les analyses sont stockées côté serveur
4. **Préférences Synchronisées** - Langue, mode par défaut, etc.

### Tokens Design Partagés

Créer un fichier `shared-tokens.ts` identique web/mobile :

```typescript
// Couleurs identiques
export const SharedColors = {
  bgPrimary: '#0a0a0b',
  bgSecondary: '#111113',
  accentPrimary: '#6366F1',
  accentSecondary: '#F59E0B',
  // ...
};

// Espacements identiques
export const SharedSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24
};

// Rayons identiques
export const SharedRadius = {
  sm: 6, md: 10, lg: 14, xl: 20
};
```

---

## 5. Plan d'Implémentation Prioritaire

### Phase 1 : Fondations (1-2 jours)

- [ ] Charger les polices Cormorant, DM Sans, JetBrains Mono
- [ ] Implémenter DoodleBackground avec react-native-svg
- [ ] Ajouter effet "glass" avec LinearGradient
- [ ] Améliorer les animations avec Reanimated

### Phase 2 : Fonctionnalités Manquantes (3-4 jours)

- [ ] Quiz interactif (UI + API)
- [ ] Mind Map (react-native-graph ou custom SVG)
- [ ] Playlists (compléter le stub existant)
- [ ] Export (Share API pour PDF/texte)

### Phase 3 : Polish (2-3 jours)

- [ ] TTS Audio Player
- [ ] Fact-checking display
- [ ] Animations de transition entre écrans
- [ ] Haptic feedback amélioré

### Phase 4 : Production (1-2 jours)

- [ ] Tests sur devices réels
- [ ] Optimisation performances
- [ ] Configuration EAS Build
- [ ] Soumission stores

---

## 6. Bonnes Pratiques Claude Code

### Pour Coder Efficacement avec Claude

1. **Contexte Clair** : Toujours préciser le fichier et la fonction à modifier
2. **Petits Changements** : Préférer des modifications incrémentales
3. **Tests Immédiatement** : Tester après chaque modification
4. **Commits Fréquents** : Sauvegarder régulièrement

### Commandes Utiles

```bash
# Lancer l'app
cd DeepSight-Mobile && npx expo start

# Vérifier les types
npm run typecheck

# Voir les logs
npx expo start --clear
```

---

## 7. Ressources

### Documentation
- [Expo SDK 54](https://docs.expo.dev/)
- [React Native SVG](https://github.com/software-mansion/react-native-svg)
- [Reanimated 3](https://docs.swmansion.com/react-native-reanimated/)

### Design System
- [Gluestack UI](https://gluestack.io/) - Composants cross-platform
- [NativeWind](https://www.nativewind.dev/) - Tailwind pour React Native

### Sources de Recherche
- [React Native Expo Guide](https://reactnativeexpert.com/blog/react-native-expo-complete-guide/)
- [Cross-Platform Design Systems](https://bit.dev/blog/creating-a-cross-platform-design-system-for-react-and-react-native-with-bit-l7i3qgmw/)
- [SVG Animations in React Native](https://medium.com/tribalscale/intro-to-svg-animations-with-react-native-reanimated-2-78bd87438129)

---

## Résumé Exécutif

L'application mobile DeepSight a une **bonne base** mais nécessite :

1. **Interface Visuelle** : Ajouter les polices, le DoodleBackground, et les effets glass
2. **Fonctionnalités** : Compléter Quiz, Mind Map, Playlists, Export
3. **Cohérence** : Aligner parfaitement les design tokens avec le web
4. **Performance** : Optimiser les animations et le rendu SVG

La synchronisation web/mobile est déjà assurée par le backend commun. Le travail principal est sur l'UI et les fonctionnalités manquantes.
