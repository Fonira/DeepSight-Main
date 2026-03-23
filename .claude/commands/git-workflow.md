---
allowed-tools: Bash(git:*), Read, Grep
description: Conventions Git obligatoires pour le monorepo DeepSight — commits, branches, merge
---

# Git Workflow DeepSight

Action git : $ARGUMENTS

## Commits (Conventional Commits)
Format : `type(scope): description courte` (impératif, minuscule, max 72 chars, pas de point)
Types : feat, fix, refactor, style, docs, test, chore, perf, ci, hotfix
Scopes : web, mobile, api, ext, shared, infra, db, stripe

## Branches
Format : `type/description-courte`
Exemples : `feat/studio-flashcards`, `fix/mobile-auth-crash`, `hotfix/stripe-webhook-500`

## Workflow
main = production (auto-deploy Vercel). Branches feature, merge direct si solo.
```powershell
git checkout -b feat/nom-feature
git add . ; git commit -m "feat(web): add comparison view"
git push origin feat/nom-feature
git checkout main ; git merge feat/nom-feature ; git push origin main
```

## Hotfix
```powershell
git checkout main
git checkout -b hotfix/description
git add . ; git commit -m "hotfix(api): fix critical auth bypass"
git checkout main ; git merge hotfix/description ; git push origin main
```

## Multi-plateforme : `feat(api,web): add share endpoint and UI`
## Annuler (pas pushé) : `git reset --soft HEAD~1`
## Annuler (pushé) : `git revert HEAD ; git push origin main`
## ⚠️ PowerShell : TOUJOURS `;` PAS `&&`