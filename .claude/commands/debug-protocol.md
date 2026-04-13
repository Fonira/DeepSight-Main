---
description: "Procédure stricte et obligatoire pour analyser les erreurs avant de proposer une solution. TOUJOURS utiliser cette skill quand l'utilisateur colle un message d'erreur, un stack trace, un log d'échec, ou décrit un bug."
---

Protocole de Debug DeepSight
ÉTAPE 1 : STOP — Ne PAS proposer de solution immédiate
Lire l'erreur EN ENTIER. Identifier :

La plateforme concernée (Web/Mobile/Backend/Extension)
Le type d'erreur (build-time, runtime, réseau, env)
Le fichier et la ligne si disponibles

ÉTAPE 2 : CLASSIFIER l'erreur
TypeSignesSyntaxe/TypeSyntaxError, TypeError, ts(xxxx), ligne:colonneImport/ModuleModule not found, Cannot resolve, No module namedEnvironnementundefined sur une env var, KEY_ERROR, variable manquanteRéseautimeout, ECONNREFUSED, fetch failed, 502/503/504Auth401 Unauthorized, 403 Forbidden, JWT expiredBDDrelation does not exist, column not found, migration manquanteBuildBuild failed, erreur dans CI/CD logsRuntimeCrash en prod/dev, comportement inattendu
ÉTAPE 3 : CHECKLIST par plateforme
Vercel (Frontend Web)

Vérifier les logs de build sur Vercel Dashboard
Variables d'environnement présentes ? (NEXT*PUBLIC*\* pour le client)
Version Node.js compatible ?
Import côté serveur dans un composant client ? (manque "use client")
Hydration mismatch ? (HTML serveur ≠ client)

Railway (Backend Python)

Vérifier les logs Railway (railway logs)
Variables d'env dans Railway Dashboard (pas en local)
requirements.txt ou pyproject.toml à jour ?
Migration Alembic appliquée ? (alembic upgrade head)
Port correct ? Railway assigne $PORT dynamiquement
Limites mémoire/CPU Railway atteintes ?

Expo / React Native (Mobile)

Cache Metro corrompu ? → npx expo start -c
Pods iOS à jour ? → cd ios ; npx pod-install
Compatibilité Expo SDK ↔ lib native ?
Import HTML (<div>) dans du code RN ? → crash
app.json / eas.json correctement configuré ?
Pour Android : vérifier le android/ et les permissions

Extension Chrome

Manifest V3 valide ? (pas de manifest_version: 2)
CSP (Content Security Policy) bloque un script ?
chrome. API utilisée dans le mauvais contexte (content vs background) ?
Permissions manquantes dans le manifest ?

PostgreSQL

Migration non appliquée → alembic upgrade head
Connexion refusée → vérifier DATABASE_URL et SSL
relation does not exist → migration manquante ou mauvais schéma

ÉTAPE 4 : DIAGNOSTIQUER avant de corriger
Formuler une HYPOTHÈSE à l'utilisateur :

"L'erreur vient probablement de [X] parce que [Y]. Voici ce que je propose..."

Si l'hypothèse nécessite plus d'info, DEMANDER avant de proposer du code :

"Peux-tu me montrer le fichier [X] ?"
"Quelle est la valeur de [variable] ?"
"Est-ce que ça marchait avant un changement récent ?"

ÉTAPE 5 : PROPOSER la correction

Donner la commande de réparation EXACTE (compatible Windows PowerShell — PAS de &&)
Si c'est un fix de code, donner le fichier COMPLET modifié (pas un extrait)
Expliquer POURQUOI ça corrige le problème
Si le fix est risqué, proposer un plan B

RAPPELS

Commandes Windows : utiliser ; pas && (voir skill windows-terminal)
Toujours vérifier si l'erreur n'est pas un faux positif (cache stale, HMR cassé)
Un redémarrage propre résout 30% des problèmes : npx expo start -c / npm run dev / redéployer
