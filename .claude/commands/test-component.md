---
allowed-tools: Read, Grep, Glob, Bash(npm test:*), Bash(npm run typecheck:*), Write, Edit
description: Génère des tests complets pour un composant React Native
---

# Génération de tests pour composant

Crée des tests complets pour le composant : $ARGUMENTS

## Étapes

### 1. Analyse du composant
- Lis le fichier source du composant
- Identifie les props, états, et comportements
- Liste les interactions utilisateur possibles

### 2. Structure du fichier test
```typescript
// mobile/src/components/__tests__/[ComponentName].test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ComponentName } from '../ComponentName';

// Factory function
const getDefaultProps = (overrides?: Partial<Props>): Props => ({
  // ... props par défaut
  ...overrides,
});

// Mock des dépendances
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ colors: { /* ... */ }, isDark: false }),
}));

describe('ComponentName', () => {
  // Tests ici
});
```

### 3. Cas de test obligatoires

#### Rendu de base
- Le composant se rend sans erreur
- Les éléments principaux sont visibles

#### Props
- Chaque prop affecte le rendu correctement
- Props optionnelles ont des valeurs par défaut

#### États
- État initial correct
- Transitions d'état fonctionnent

#### Interactions
- onPress/onChange appelés correctement
- Feedback visuel après interaction

#### Edge cases
- Props null/undefined
- Listes vides
- Texte très long
- États de chargement
- États d'erreur

### 4. Exécution
```bash
cd mobile && npm test -- --testPathPattern="ComponentName" --coverage
```

## Output
Affiche le résumé de couverture et les tests créés.
