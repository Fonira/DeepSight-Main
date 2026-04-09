# DeepSight — Base de connaissances projet
*Apprentissages validés par l'expérience*

---

## À ÉVITER

### [DEPLOY] Ne pas tenter de déployer Vercel depuis Cowork/Claude Code
QUAND : environnement Cowork / Claude Code (cloud sandbox)
ALORS : ne PAS utiliser `vercel deploy`, MCP `deploy_to_vercel`, ni `gh` CLI — aucun ne fonctionne
PARCE QUE : pas d'accès réseau sortant vers vercel.com, MCP tool redirige vers CLI, gh CLI non authentifié (pas de GH_TOKEN)
SCOPE : environnement
Date : 2026-03-23

### [DEPLOY] Ne pas chercher à authentifier gh dans Cowork
QUAND : environnement Cowork / Claude Code
ALORS : ne PAS essayer `gh auth login` — pas d'accès réseau GitHub direct
PARCE QUE : le sandbox n'a pas d'accès réseau sortant vers github.com/vercel.com
SCOPE : environnement
Date : 2026-03-23

---

## SOLUTIONS VALIDÉES

### [DEPLOY] Déployer via merge dans main (git integration Vercel)
QUAND : besoin de déployer le frontend en production
ALORS : créer PR + merger dans `main` → Vercel auto-deploy via git integration
PARCE QUE : c'est la seule méthode qui fonctionne — Vercel surveille la branche main
SCOPE : projet
Date : 2026-03-23

### [DEPLOY] Utiliser gh CLI depuis le terminal Windows local
QUAND : besoin de créer/merger une PR
ALORS : fournir la commande `gh pr create` + `gh pr merge` à l'utilisateur pour exécution sur Windows
PARCE QUE : gh v2.88.1 est installé et authentifié sur la machine Windows dev locale
SCOPE : projet
Date : 2026-03-23

### [GIT] Le push depuis Cowork fonctionne via proxy local
QUAND : besoin de pousser du code depuis Cowork
ALORS : `git push -u origin branch-name` fonctionne normalement
PARCE QUE : le remote git passe par un proxy local (127.0.0.1:34801) qui a accès
SCOPE : environnement
Date : 2026-03-23

---

## PATTERNS RÉCURRENTS

### [DEPLOY] Workflow de déploiement type
QUAND : feature branch prête à déployer
ALORS :
1. Commit + push depuis Cowork (fonctionne)
2. Fournir commande `gh pr create` + `gh pr merge` à l'utilisateur
3. L'utilisateur exécute depuis Windows → merge dans main → Vercel auto-deploy
PARCE QUE : séparation des responsabilités — Cowork fait le code, Windows fait le deploy
SCOPE : projet
Date : 2026-03-23

---

## PRÉFÉRENCES TECHNIQUES

*(Aucune entrée pour le moment)*
