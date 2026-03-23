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
- Est-ce une **approche à ÉVITER dans un contexte précis** ? → Ajouter dans `À ÉVITER`
- Est-ce une **solution qui FONCTIONNE** ? → Ajouter dans `SOLUTIONS VALIDÉES`
- Est-ce un **pattern d'erreur récurrent** ? → Ajouter dans `PATTERNS RÉCURRENTS`
- Est-ce une **préférence technique** ? → Ajouter dans `PRÉFÉRENCES TECHNIQUES`

### 3. Extraire les informations clés (format OBLIGATOIRE)
Chaque entrée DOIT contenir ces 5 champs :

```markdown
### [COMPOSANT] Titre descriptif
- **QUAND** : conditions PRÉCISES où le problème survient (OS, setup, état)
- **ALORS** : ce qu'il faut faire (ou ne pas faire) + alternative
- **PARCE QUE** : explication causale technique (pas juste "ça marche pas")
- **EXPIRE** : quand réévaluer (date, ou condition comme "si changement de setup")
- **SCOPE** : `projet` | `environnement` | `global`
- **Date**: YYYY-MM-DD
```

**Composants valides** : [BACKEND], [FRONTEND], [MOBILE], [EXTENSION], [DEPLOY], [INFRA], [GIT]

### 4. ANTI-DÉRIVE — Vérifications obligatoires avant d'écrire

**Pour les entrées "À ÉVITER"** :
- ❌ JAMAIS écrire "ne JAMAIS utiliser X" sans contexte
- ✅ TOUJOURS écrire "QUAND [contexte précis], éviter X, préférer Y"
- ✅ TOUJOURS ajouter un champ "⚠️ Ne s'applique PAS" listant les cas où ça marche
- ✅ Le scope doit être le plus restreint possible (`environnement` > `projet` > `global`)

**Exemples** :
```
# ❌ MAUVAIS (trop absolu, cause de la dérive)
"Ne JAMAIS utiliser git merge sur ce repo"

# ✅ BON (contextuel, avec limites claires)
"QUAND filesystem Windows monté + locks .git présents, ALORS éviter git merge local, préférer GitHub CLI"
"⚠️ Ne s'applique PAS : git merge depuis Linux, VPS, ou clone natif"
```

### 5. Vérifier les doublons
Si un apprentissage similaire existe déjà :
- **Enrichir** l'entrée existante plutôt que créer un doublon
- **Mettre à jour** la date si les infos ont changé

### 6. Écrire dans LEARNINGS.md
Utilise Edit pour ajouter l'entrée dans la bonne section, en suivant le format.

### 7. Mettre à jour les métriques
Si l'apprentissage vient d'une session avec plusieurs tentatives ratées, ajouter une ligne dans le tableau MÉTRIQUES.

### 8. Ajouter à l'historique
Ajouter une entrée courte dans HISTORIQUE DES SESSIONS avec la date du jour.

### 9. Confirmer
Afficher un résumé :
```
Apprentissage enregistré :
- Section : [À ÉVITER / SOLUTION / PATTERN / PRÉFÉRENCE]
- Composant : [XXX]
- Scope : [environnement / projet / global]
- QUAND : ...
- ALORS : ...
- Expire : ...
```

## Règles
- Être CONCIS mais PRÉCIS — un autre Claude doit pouvoir comprendre sans contexte
- Inclure des commandes/code EXACTS quand pertinent
- Ne jamais supprimer d'entrées existantes
- **Ne jamais écrire d'interdiction absolue** — toujours contextualiser
- Si l'utilisateur ne précise pas de contexte ($ARGUMENTS vide), analyser la conversation en cours pour déduire l'apprentissage
