---
allowed-tools: Read, Edit, Grep, Glob
description: Enregistre un apprentissage (solution validée ou approche à éviter) dans la base de connaissances du projet
---

# Enregistrer un apprentissage

Contexte fourni par l'utilisateur : $ARGUMENTS

## Workflow

### 1. Lire la base actuelle
Lis `.claude/LEARNINGS.md` pour comprendre la structure et éviter les doublons.

### 2. Classifier l'apprentissage
- Approche à ÉVITER → section `À ÉVITER`
- Solution qui FONCTIONNE → section `SOLUTIONS VALIDÉES`
- Pattern d'erreur récurrent → section `PATTERNS RÉCURRENTS`
- Préférence technique → section `PRÉFÉRENCES TECHNIQUES`

### 3. Format OBLIGATOIRE

[COMPOSANT] Titre descriptif
QUAND : conditions PRÉCISES (OS, setup, état)
ALORS : ce qu'il faut faire/ne pas faire + alternative
PARCE QUE : explication causale technique
EXPIRE : quand réévaluer (date ou condition)
SCOPE : projet | environnement | global
Date : YYYY-MM-DD

Composants valides : BACKEND, FRONTEND, MOBILE, EXTENSION, DEPLOY, INFRA, GIT

### 4. ANTI-DÉRIVE
Pour "À ÉVITER" : TOUJOURS écrire "QUAND [contexte], éviter X, préférer Y" + "Ne s'applique PAS : [cas OK]"

### 5. Vérifier doublons, enrichir si similaire existe

### 6. Écrire dans LEARNINGS.md via Edit

### 7. Confirmer : Section, Composant, Scope, QUAND, ALORS, Expire

## Règles
- Concis mais précis — un autre Claude doit comprendre sans contexte
- Inclure commandes/code exacts quand pertinent
- Ne jamais supprimer d'entrées existantes
- Si pas de contexte fourni, analyser la conversation en cours