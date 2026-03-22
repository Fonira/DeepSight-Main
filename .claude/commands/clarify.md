---
allowed-tools: Read, Grep, Glob
description: Questionnement structuré pour définir précisément une tâche avant implémentation
---

# Clarification Structurée

Analyse la demande suivante et pose toutes les questions nécessaires : $ARGUMENTS

## Phase 1 — Analyse
1. Lis la demande attentivement
2. Identifie les composants concernés (backend/frontend/mobile/extension)
3. Recherche le code existant lié (Grep, Glob, Read)

## Phase 2 — Zones d'ombre
Évalue chaque aspect :
- Scope clair ? (quels fichiers, quels composants)
- Comportement attendu précis ?
- Cas limites définis ?
- Impact sur les autres plateformes ?
- Contraintes de plan (free/étudiant/starter/pro) claires ?
- Style/design spécifié ?

## Phase 3 — Questions
Utilise **AskUserQuestion** avec des questions groupées (max 4) :

1. **Scope** : "Quelles plateformes ?" → Web / Mobile / Web+Mobile / Toutes
2. **Comportement** : "Comment X fonctionne quand Y ?" → options concrètes
3. **Design** : "Quel pattern UI ?" → options avec previews
4. **Priorité** : "Quels aspects prioritaires ?" → multi-select

## Phase 4 — Brief
```
BRIEF — [Tâche]

Objectif : [1 phrase]
Scope : [composants + fichiers clés]
Specs : [liste]
Contraintes : [liste]
Tests : [liste]
```

## Phase 5 — Lancement
Dernière question : "Brief correct ? Puis-je commencer ?"
- Oui, lance-toi
- Oui, mais ajuste [préciser]
- Non, il manque [préciser]

Puis passe en mode `/do` pour l'exécution.

## Règles
- Minimum 2 questions, même si la demande semble claire
- Toujours vérifier le scope (quelles plateformes)
- Options concrètes, jamais de questions ouvertes inutiles
- Chaque question doit apporter de la valeur
