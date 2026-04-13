---
allowed-tools: Bash(npm run typecheck:*), Bash(npx eas:*), Bash(npx eas-cli:*), Read, Glob
description: Build iOS avec validation préalable
---

# Build iOS

Prépare et lance un build iOS : $ARGUMENTS

## Profils disponibles

- `preview` : Test interne (Ad Hoc)
- `production` : App Store
- `development` : Dev client

## Workflow

### 1. Validation préalable

```bash
echo "🔍 Vérification TypeScript..."
cd mobile && npm run typecheck

echo "🧪 Exécution des tests..."
cd mobile && npm test -- --passWithNoTests
```

### 2. Vérification de la configuration

- Lis `mobile/app.json` et `mobile/eas.json`
- Vérifie que les versions sont correctes
- Vérifie le bundleIdentifier

### 3. Lancement du build

```bash
cd mobile && npx eas build --platform ios --profile $ARGUMENTS
```

### 4. Suivi

Le build prend 15-20 minutes. Commandes utiles :

```bash
# Voir le statut
npx eas build:list --platform ios --limit 1

# Voir les logs
npx eas build:view <build-id>
```

## Notes importantes

- Pour `preview` : Distribution Ad Hoc, nécessite des devices enregistrés
- Pour `production` : Sera soumis à Apple, nécessite App Store Connect configuré
- Première fois : EAS demandera les credentials Apple en mode interactif

## Output

Affiche le lien du build EAS quand lancé.
