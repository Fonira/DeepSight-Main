---
description: "Enregistre un apprentissage (solution validée ou approche à éviter) dans la base de connaissances du projet"
---

# Enregistrer un apprentissage

Contexte fourni par l'utilisateur : $ARGUMENTS

## Workflow

### 1. Lire la base actuelle

Lis `.claude/LEARNINGS.md` pour comprendre la structure et éviter les doublons.

### 2. Classifier l'apprentissage

- Approche à ÉVITER dans un contexte précis → section `À ÉVITER`
- Solution qui FONCTIONNE → section `SOLUTIONS VALIDÉES`
- Pattern d'erreur récurrent → section `PATTERNS RÉCURRENTS`
- Préférence technique → section `PRÉFÉRENCES TECHNIQUES`

### 3. Format OBLIGATOIRE pour chaque entrée

[COMPOSANT] Titre descriptif
QUAND : conditions PRÉCISES (OS, setup, état)
ALORS : ce qu'il faut faire/ne pas faire + alternative
PARCE QUE : explication causale technique
EXPIRE : quand réévaluer (date ou condition)
SCOPE : projet | environnement | global
Date : YYYY-MM-DD

Composants valides : BACKEND, FRONTEND, MOBILE, EXTENSION, DEPLOY, INFRA, GIT

### 4. ANTI-DÉRIVE — Vérifications obligatoires

Pour les entrées "À ÉVITER" :

- JAMAIS écrire "ne JAMAIS utiliser X" sans contexte
- TOUJOURS écrire "QUAND [contexte précis], éviter X, préférer Y"
- TOUJOURS ajouter "Ne s'applique PAS : [cas où ça marche]"
- Le scope doit être le plus restreint possible (environnement > projet > global)

### 5. Vérifier les doublons

Si similaire existe déjà → enrichir plutôt que dupliquer.

### 6. Écrire dans LEARNINGS.md

Utilise Edit pour ajouter dans la bonne section.

### 7. Mettre à jour les métriques

Si > 2 tentatives ont été nécessaires, ajouter une ligne dans le tableau MÉTRIQUES.

### 8. Ajouter à l'historique

Entrée courte dans HISTORIQUE DES SESSIONS.

### 9. Confirmer

Afficher :

- Section : À ÉVITER / SOLUTION / PATTERN / PRÉFÉRENCE
- Composant : XXX
- Scope : environnement / projet / global
- QUAND : ...
- ALORS : ...
- Expire : ...

## Règles

- Concis mais précis — un autre Claude doit comprendre sans contexte
- Inclure des commandes/code exacts quand pertinent
- Ne jamais supprimer d'entrées existantes
- Ne jamais écrire d'interdiction absolue — toujours contextualiser
- Si pas de contexte fourni, analyser la conversation en cours pour déduire l'apprentissage
