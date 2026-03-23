---
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*)
description: Enregistre un apprentissage (solution validée ou approche à éviter) dans la base de connaissances
---

# Enregistrer un apprentissage

Contexte fourni par l'utilisateur : $ARGUMENTS

## Workflow

### 1. Lire la base actuelle
Lis `.claude/LEARNINGS.md` pour comprendre la structure et éviter les doublons.

### 2. Classifier l'apprentissage
Demande-toi :
- Est-ce une **approche qui a ÉCHOUÉ** ? → Ajouter dans `BLACKLIST`
- Est-ce une **solution qui FONCTIONNE** ? → Ajouter dans `SOLUTIONS VALIDÉES`
- Est-ce un **pattern d'erreur récurrent** ? → Ajouter dans `PATTERNS RÉCURRENTS`
- Est-ce une **préférence technique** ? → Ajouter dans `PRÉFÉRENCES TECHNIQUES`

### 3. Extraire les informations clés
Pour chaque apprentissage, capturer :
- **Composant** : [BACKEND], [FRONTEND], [MOBILE], [EXTENSION], [DEPLOY], [INFRA], [GIT]
- **Date** : aujourd'hui
- **Contexte** : qu'est-ce qu'on essayait de faire
- **Ce qui a échoué** (si blacklist) : liste précise des approches tentées
- **Ce qui fonctionne** (si solution) : étapes exactes reproductibles
- **Pourquoi** : explication technique de la raison

### 4. Vérifier les doublons
Si un apprentissage similaire existe déjà :
- **Enrichir** l'entrée existante plutôt que créer un doublon
- **Mettre à jour** la date si les infos ont changé

### 5. Écrire dans LEARNINGS.md
Utilise Edit pour ajouter l'entrée dans la bonne section, en suivant le format existant.

### 6. Mettre à jour les métriques
Si l'apprentissage vient d'une session avec plusieurs tentatives ratées, ajouter une ligne dans le tableau MÉTRIQUES.

### 7. Ajouter à l'historique
Ajouter une entrée courte dans HISTORIQUE DES SESSIONS avec la date du jour.

### 8. Confirmer
Afficher un résumé de ce qui a été enregistré :
```
Apprentissage enregistré :
- Section : [BLACKLIST/SOLUTION/PATTERN/PRÉFÉRENCE]
- Composant : [XXX]
- Résumé : ...
```

## Règles
- Être CONCIS mais PRÉCIS — un autre Claude doit pouvoir comprendre sans contexte
- Inclure des commandes/code EXACTS quand pertinent
- Ne jamais supprimer d'entrées existantes
- Si l'utilisateur ne précise pas de contexte ($ARGUMENTS vide), analyser la conversation en cours pour déduire l'apprentissage
