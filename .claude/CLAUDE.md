# DeepSight - Configuration Claude Code

## Stack Technique
- **Backend**: FastAPI + Python 3.11 (async)
- **Frontend**: React 18 + TypeScript + Vite
- **Mobile**: Expo SDK 54 + React Native 0.81
- **Tests**: Jest + React Testing Library (mobile), Pytest (backend)

## Commandes essentielles

### Mobile
```bash
cd mobile && npm run typecheck    # Vérification TypeScript
cd mobile && npm test             # Exécuter tous les tests
cd mobile && npm test -- --watch  # Mode watch
cd mobile && npx expo start       # Démarrer l'app
```

### Backend
```bash
cd backend && pytest              # Exécuter tous les tests
cd backend && pytest -x           # Stopper au premier échec
cd backend && pytest --cov        # Avec couverture
```

### Frontend
```bash
cd frontend && npm run typecheck  # Vérification TypeScript
cd frontend && npm run lint       # Linting
cd frontend && npm run build      # Build production
```

## Workflow TDD Strict

### Cycle obligatoire
1. **RED** : Écrire un test qui ÉCHOUE
2. **GREEN** : Implémenter le code MINIMAL pour passer
3. **REFACTOR** : Améliorer sans casser les tests

### Règles absolues
- Ne JAMAIS modifier un test pour le faire passer
- Couverture minimum : 80%
- Toujours exécuter les tests après modification
- Un commit = tests verts

## Modes de réflexion
- `think` : Modifications simples
- `think hard` : Logique complexe, bugs subtils
- `think harder` : Refactoring majeur
- `ultrathink` : Architecture, décisions critiques

## Conventions de code

### TypeScript/React Native
```typescript
// ✅ Imports destructurés
import { View, Text, StyleSheet } from 'react-native';

// ✅ Interfaces (pas types) pour les objets
interface Props {
  title: string;
  onPress: () => void;
}

// ✅ Composants fonctionnels uniquement
export const MyComponent: React.FC<Props> = ({ title, onPress }) => {
  // ...
};

// ✅ Styles en bas du fichier
const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

### Python/FastAPI
```python
# ✅ Toujours async
async def get_data(db: AsyncSession) -> list[Model]:
    result = await db.execute(select(Model))
    return result.scalars().all()

# ✅ Type hints obligatoires
def process(items: list[str]) -> dict[str, int]:
    pass

# ✅ Pas de print(), utiliser logger
from core.logging import logger
logger.info("Message structuré", extra={"key": "value"})
```

## Patterns de test

### React Native / Jest
```typescript
// Factory function pour les props
const getDefaultProps = (overrides?: Partial<Props>): Props => ({
  title: 'Default',
  onPress: jest.fn(),
  isLoading: false,
  ...overrides,
});

// Pattern AAA
describe('Component', () => {
  it('should handle action', () => {
    // Arrange
    const props = getDefaultProps({ title: 'Test' });

    // Act
    render(<Component {...props} />);
    fireEvent.press(screen.getByText('Test'));

    // Assert
    expect(props.onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Edge cases obligatoires
1. États vides (null, undefined, [])
2. Valeurs limites (0, -1, MAX_INT)
3. États d'erreur (network, API, validation)
4. États de chargement
5. Interactions rapides (double-tap, spam)

## Workflow Git
```bash
# Feature branch
git checkout -b feature/nom-feature

# Commits atomiques
git add <fichiers spécifiques>
git commit -m "type(scope): description"

# Types: feat, fix, refactor, test, docs, chore
```

## Sécurité
- Jamais de secrets en dur
- Valider tous les inputs utilisateur
- Échapper les outputs (XSS)
- Utiliser les dépendances du projet

## Debug Protocol
1. Lire le message d'erreur COMPLET
2. Identifier le fichier et la ligne
3. Comprendre le contexte (stack trace)
4. Formuler une hypothèse
5. Tester la correction
6. Vérifier que les tests passent
