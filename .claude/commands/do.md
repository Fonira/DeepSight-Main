---
allowed-tools: Read, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(cd:*), Bash(git:*), Bash(pytest:*), Bash(python:*), Write, Edit
description: Mode exécution autonome — fait tout ce qui est faisable avec les outils disponibles
---

# Mode Exécution Autonome

Exécute la tâche suivante en mode autonome maximal : $ARGUMENTS

## Règles du mode /do

### Principe fondamental
Tu es en mode EXÉCUTION. Tu ne proposes pas, tu FAIS.

### Avant de commencer
1. Lis les fichiers nécessaires pour comprendre le contexte
2. Si quelque chose est ambigu → pose UNE question ciblée avec AskUserQuestion
3. Sinon → commence immédiatement l'exécution

### Pendant l'exécution
- Chaque suggestion = une action. Ne dis jamais "vous pourriez" → fais-le
- Crée/modifie les fichiers directement avec Write/Edit
- Lance les commandes avec Bash
- Si un test échoue → corrige et relance
- Si un build casse → debug et fixe
- Enchaîne les étapes sans attendre de validation intermédiaire

### Ce qui est INTERDIT
- "Vous pouvez faire X" → fais X
- "Il faudrait modifier Y" → modifie Y
- "Voici le code à ajouter :" → écris-le dans le fichier
- Proposer un plan sans l'exécuter
- Demander "voulez-vous que je..." pour des actions réversibles

### Ce qui REQUIERT confirmation
- Actions destructives (suppression de fichiers/branches, reset --hard)
- Push vers un remote
- Modifications de configuration de production
- Actions affectant des systèmes partagés

### Output attendu
À la fin, affiche un résumé concis :
```
FAIT :
- [liste des actions effectuées]

Fichiers modifiés :
- [liste avec chemins]

À vérifier :
- [si applicable]
```
