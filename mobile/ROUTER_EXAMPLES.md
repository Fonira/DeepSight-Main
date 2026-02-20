# DeepSight Router - Exemples d'utilisation

## Navigations basiques

### Depuis un bouton
```typescript
import { Button } from '@/components/ui/Button';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <Button
      title="Se connecter"
      onPress={() => router.push('/(auth)/login')}
    />
  );
}
```

### Utiliser les helpers de route
```typescript
import { tabRoutes, authRoutes } from '@/navigation/routerHelpers';

// Navigation
<Button
  title="Aller à la bibliothèque"
  onPress={() => tabRoutes.library()}
/>

// Se déconnecter
<Button
  title="Déconnexion"
  onPress={() => authRoutes.welcome()}
/>
```

## Routes dynamiques

### Créer un lien vers une analyse
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Push vers le détail
router.push(`/(tabs)/analysis/123`);

// Ou avec helper
import { analysisRoutes } from '@/navigation/routerHelpers';
analysisRoutes.detail('123');
```

### Lire les paramètres dynamiques
```typescript
import { useLocalSearchParams } from 'expo-router';

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Text>Analyse {id}</Text>
  );
}
```

## Navigation de groupe

### Remplacer vers un groupe
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Après login - remplace pour éviter le back vers login
router.replace('/(tabs)');

// Après logout - remplace pour éviter le back
router.replace('/(auth)');
```

### Navigue avec paramètres
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

router.push({
  pathname: '/(auth)/verify',
  params: { email: 'user@example.com' },
});

// Dans verify.tsx
const { email } = useLocalSearchParams<{ email?: string }>();
```

## Deep linking

### Configuration dans app.json
```json
{
  "expo": {
    "scheme": "deepsight",
    "plugins": [
      ["expo-router", {
        "origin": "https://deepsightsynthesis.com"
      }]
    ]
  }
}
```

### URLs supportées
```
deepsight://home              → /(tabs)
deepsight://library           → /(tabs)/library
deepsight://analysis/123      → /(tabs)/analysis/[id]
deepsight://login             → /(auth)/login
https://deepsightsynthesis.com/analysis/456  → /(tabs)/analysis/456
```

### Gérer les deep links dans une screen
```typescript
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    const handleURL = ({ url }: { url: string }) => {
      const route = url.replace(/.*?:\/\/?/, '');
      const routeName = route.split('/')[0];

      if (routeName === 'analysis') {
        const id = route.split('/')[1];
        router.push(`/(tabs)/analysis/${id}`);
      }
    };

    const subscription = Linking.addEventListener('url', handleURL);

    return () => {
      subscription.remove();
    };
  }, [router]);

  return <View>{/* ... */}</View>;
}
```

## Animations de transition

### Désactiver animations
```typescript
export default function QuickNavigationScreen() {
  const router = useRouter();

  return (
    <Button
      title="Aller à l'accueil (sans animation)"
      onPress={() => {
        router.replace('/(tabs)', { animation: 'none' });
      }}
    />
  );
}
```

### Animation slide (défaut)
```typescript
router.push({
  pathname: '/details',
  animation: 'slide',
});
```

## Gestion des erreurs 404

### Affichage auto de 404
```typescript
// Si on navigue vers une route inexistante
router.push('/impossible-route');
// Affiche: app/_404.tsx
```

### Créer des routes de fallback
```typescript
// Dans app/_layout.tsx
<Stack>
  {/* Routes définies */}
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="(tabs)" />

  {/* Fallback 404 */}
  <Stack.Screen name="_404" />
</Stack>
```

## Gestion de la navigation de groupe (tabs)

### Naviguer entre tabs sans remplacer l'historique
```typescript
import { tabRoutes } from '@/navigation/routerHelpers';

// Remplace le root tab stack pour éviter le back en boucle
<Button title="Library" onPress={() => tabRoutes.library()} />
```

### Garder l'historique au sein des tabs
```typescript
const router = useRouter();

// Push préserve l'historique
router.push('/(tabs)/analysis/123');

// Peut faire back
router.back();
```

## Best practices

### 1. Utilisez `replace()` pour les transitions de groupe
```typescript
// ✅ Correct - après login
router.replace('/(tabs)');

// ❌ Mauvais - crée une boucle de back
router.push('/(tabs)');
```

### 2. Utilisez les helpers pour la cohérence
```typescript
// ✅ Centralisé
import { tabRoutes } from '@/navigation/routerHelpers';
tabRoutes.home();

// ❌ Répété partout
router.push('/(tabs)');
router.replace('/(tabs)');
```

### 3. Gérez les paramètres avec useLocalSearchParams
```typescript
// ✅ Typage fort
const { id } = useLocalSearchParams<{ id: string }>();

// ❌ Sans typage
const { id } = useLocalSearchParams();
```

### 4. Évitez la navigation circulaire
```typescript
// ✅ Bon flux
login → replace('/(tabs)') → Cannot back to login

// ❌ Mauvais flux
login → push('/(tabs)') → back → login → infinite loop
```

## Teste des routes

### Setup Jest
```typescript
import { render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

test('navigates to login', () => {
  const mockRouter = useRouter();
  // ... test
});
```

## Problèmes courants

### Problem: Boucle de back infinie
**Solution:** Utilisez `replace()` au lieu de `push()` pour les transitions de groupe

### Problem: Paramètres perdus dans deep link
**Solution:** Vérifiez la configuration dans linking config

### Problem: Animation lag entre screens
**Solution:** Optimisez les renders avec `React.memo()` et `useMemo()`

### Problem: TypeScript errors sur les routes
**Solution:** Importez depuis `app/types/navigation.ts`
