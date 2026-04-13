---
allowed-tools: Read, Edit, Grep, Glob
description: Simplifier et refactorer du code DeepSight — réduire la complexité, améliorer la lisibilité
---

# Code Simplifier

Simplifier / refactorer : $ARGUMENTS

## Workflow

### 1. Lire et comprendre le code actuel

- Identifier le fichier et son contexte (quelle plateforme ?)
- Comprendre le flux de données
- Repérer les code smells

### 2. Identifier les opportunités

- **Duplication** : extraire en fonction/hook/service partagé
- **Complexité cyclomatique** : réduire les if/else imbriqués (early return, guard clauses)
- **Responsabilité mixte** : séparer en fonctions à responsabilité unique
- **Abstractions manquantes** : créer des hooks custom (React), des services (Python)
- **Types faibles** : remplacer `any` par des types stricts, `dict` par Pydantic
- **Code mort** : supprimer le code commenté, les imports inutilisés
- **Magic numbers** : extraire en constantes nommées

### 3. Refactorer

- Garder la même API externe (pas de breaking changes)
- Modifier un fichier à la fois
- Vérifier les types après chaque modification

### 4. Vérifier

- Les tests existants passent toujours
- Le comportement est identique
- Aucun import cassé

## Principes

- Le code le plus simple est celui qu'on n'écrit pas
- Préférer la composition à l'héritage
- Un fichier = une responsabilité
- Si c'est dur à tester, c'est mal architecturé

## Output

```
🔧 SIMPLIFICATION
Avant : X lignes, complexité Y
Après : X' lignes, complexité Y'
Changements : [liste des refactors appliqués]
```
