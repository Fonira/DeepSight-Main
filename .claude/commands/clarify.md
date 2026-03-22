---
allowed-tools: Read, Grep, Glob
description: Questionnement structuré pour définir précisément une tâche avant implémentation
---

# Clarification Structurée

Analyse la demande suivante et pose toutes les questions nécessaires : $ARGUMENTS

## Workflow

### Phase 1 — Analyse de la demande
1. Lis la demande attentivement
2. Identifie le(s) composant(s) concernés (backend/frontend/mobile/extension)
3. Recherche le code existant lié à la demande (Grep, Glob, Read)

### Phase 2 — Identification des zones d'ombre
Pour chaque aspect de la demande, évalue :
- Le scope est-il clair ? (quels fichiers, quels composants)
- Le comportement attendu est-il précis ?
- Les cas limites sont-ils définis ?
- L'impact sur les autres plateformes est-il considéré ?
- Les contraintes de plan (free/étudiant/starter/pro) sont-elles claires ?
- Le style/design est-il spécifié ?
- Les tests nécessaires sont-ils identifiés ?

### Phase 3 — Questions structurées
Utilise AskUserQuestion pour poser des questions groupées (max 4 par appel) :

**Catégories de questions :**

1. **Scope** : "Quelles plateformes sont concernées ?"
   - Options : Web uniquement / Mobile uniquement / Web + Mobile / Toutes

2. **Comportement** : "Comment X doit-il fonctionner quand Y ?"
   - Options avec descriptions claires des alternatives

3. **Design** : "Quel pattern UI pour cette feature ?"
   - Options avec previews si possible

4. **Priorité** : "Quels aspects sont prioritaires ?"
   - Multi-select activé

### Phase 4 — Brief de synthèse
Après les réponses, affiche un brief structuré :

```
BRIEF — [Nom de la tâche]

Objectif : [résumé en 1 phrase]

Scope :
  - Composants : [backend/frontend/mobile/extension]
  - Fichiers clés : [liste]

Spécifications :
  - [spec 1]
  - [spec 2]

Contraintes :
  - [contrainte 1]

Tests requis :
  - [test 1]

Hypothèses (non confirmées) :
  - [si applicable]
```

### Phase 5 — Validation finale
Pose une dernière question :
"Ce brief est-il correct ? Puis-je commencer l'implémentation ?"
- Oui, lance-toi
- Oui, mais ajuste [préciser]
- Non, il manque [préciser]

## Règles
- Poser au MINIMUM 2 questions, même si la demande semble claire
- Toujours vérifier le scope (quelles plateformes)
- Toujours demander la priorité si plusieurs sous-tâches
- Utiliser des options concrètes, jamais des questions ouvertes inutiles
- Les questions doivent apporter de la valeur — pas de questions évidentes
