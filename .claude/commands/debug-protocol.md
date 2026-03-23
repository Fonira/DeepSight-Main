---
allowed-tools: Read, Grep, Glob, Bash
description: Protocole de debug obligatoire — classifier, diagnostiquer AVANT de proposer un fix
---

# Protocole de Debug

Analyser l'erreur : $ARGUMENTS

## ÉTAPE 1 : STOP — Lire l'erreur EN ENTIER
Identifier : plateforme (Web/Mobile/Backend/Extension), type d'erreur, fichier + ligne.

## ÉTAPE 2 : CLASSIFIER
Syntaxe/Type | Import/Module | Environnement | Réseau | Auth | BDD | Build | Runtime

## ÉTAPE 3 : CHECKLIST par plateforme
### Vercel : logs build, env vars NEXT_PUBLIC_*, Node version, "use client" manquant, hydration mismatch
### Hetzner : docker logs, env vars .env.production, Alembic migration, PORT, mémoire/CPU
### Expo : `npx expo start -c` (cache), pods iOS, compatibilité SDK ↔ libs, imports HTML dans RN, app.json/eas.json
### Extension : MV3 valide, CSP bloque, chrome.* mauvais contexte, permissions manifest
### PostgreSQL : migration manquante, DATABASE_URL + SSL, schéma

## ÉTAPE 4 : HYPOTHÈSE
"L'erreur vient probablement de [X] parce que [Y]." Si besoin d'info → demander.

## ÉTAPE 5 : CORRIGER
- Commande exacte (PowerShell = `;` pas `&&`)
- Fichier COMPLET modifié (pas d'extrait)
- Expliquer POURQUOI ça corrige
- Plan B si risqué

## Rappel : cache stale / HMR cassé résout 30% des problèmes