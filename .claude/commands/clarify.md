---
allowed-tools: Read, Grep, Glob
description: Questionne puis produit un brief avant impl\u00e9mentation
---

# /clarify — Clarification

Clarifie : $ARGUMENTS

## Workflow
1. Lis le code existant lié à la demande
2. Identifie composants concernés (backend/frontend/mobile/extension)
3. Pose 2-4 questions via AskUserQuestion :
   - Scope (quelles plateformes ?)
   - Comportement (comment ça marche ?)
   - Priorité (quoi d'abord ?) — multi-select
4. Résume en brief :
   ```
   BRIEF — [Tâche]
   Objectif : [1 phrase]
   Scope : [composants + fichiers]
   Specs : [liste]
   ```
5. Demande validation puis passe en mode /do
