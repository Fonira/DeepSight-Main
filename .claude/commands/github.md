---
description: "Opérations GitHub DeepSight via gh CLI : PRs, issues, CI, releases, labels. TOUJOURS utiliser pour toute interaction GitHub (créer PR, merge, issues, checks, releases)."
allowed-tools: Bash, Read, Grep
---

# GitHub Operations — DeepSight

Repo : `Fonira/DeepSight-Main` | Owner : `Fonira` | Solo dev | `gh` authenticated

---

## Créer une PR

```powershell
git push -u origin HEAD
gh pr create --title "type(scope): description" --body "$(cat <<'EOF'
## Summary
- What and why

## Changes
- File-level list of changes

## Platforms affected
- [ ] web (frontend/)
- [ ] api (backend/)
- [ ] mobile (mobile/)
- [ ] extension (extension/)
- [ ] shared/infra

## Test plan
- [ ] Tests pass locally
- [ ] Manual smoke test
- [ ] CI green

## Deploy notes
_None / Migration needed / Env var added / etc._
EOF
)"
```

**Scopes** : `web`, `mobile`, `api`, `ext`, `shared`, `infra`, `db`, `stripe`
**Types** : `feat`, `fix`, `refactor`, `chore`, `docs`, `perf`, `ci`, `hotfix`, `test`, `style`

### PR rapide (petite modification)

```powershell
git push -u origin HEAD
gh pr create --title "type(scope): description" --body "Quick fix — description."
```

### Merge PR (squash)

```powershell
gh pr merge <number> --squash --delete-branch
```

### Merge + deploy backend

```powershell
gh pr merge <number> --squash --delete-branch
# Puis lancer la skill /deplo pour le déploiement backend
```

---

## Issues

### Bug report

```powershell
gh issue create --title "bug(scope): description" --label "bug,platform" --body "$(cat <<'EOF'
## Environment
Platform: web / mobile / api / extension

## Steps to reproduce
1. ...

## Expected vs actual
**Expected:** ...
**Actual:** ...

## Logs / screenshots
...
EOF
)"
```

### Feature request

```powershell
gh issue create --title "feat(scope): description" --label "enhancement,platform" --body "$(cat <<'EOF'
## Motivation
Why this feature matters.

## Proposed solution
How it should work.

## Platforms
- [ ] web  - [ ] api  - [ ] mobile  - [ ] extension

## Acceptance criteria
- [ ] ...
EOF
)"
```

### Lister / trier

```powershell
gh issue list --state open
gh issue list --label "bug"
gh issue list --label "web"
gh issue view <number>
```

Fermer via commit : `Fixes #<number>` ou `Closes #<number>` dans le message.

---

## CI / Workflows

14 workflows dans `.github/workflows/` :

| Workflow        | Fichier               | Trigger             |
| --------------- | --------------------- | ------------------- |
| Backend CI      | `backend-ci.yml`      | push backend/\*\*   |
| Frontend CI     | `frontend-ci.yml`     | push frontend/\*\*  |
| Mobile CI       | `mobile-ci.yml`       | push mobile/\*\*    |
| Extension CI    | `extension-ci.yml`    | push extension/\*\* |
| Deploy Backend  | `deploy-backend.yml`  | push main + manual  |
| Deploy Frontend | `deploy-frontend.yml` | push main           |
| Full Test Suite | `full-test.yml`       | manual              |
| Tests           | `tests.yml`           | push/PR             |
| Smoke Tests     | `smoke-tests.yml`     | manual              |
| Smoke on Deploy | `smoke-on-deploy.yml` | post-deploy         |
| DB Backup       | `db-backup.yml`       | scheduled           |
| Gitleaks        | `gitleaks.yml`        | push                |
| Notify          | `notify.yml`          | workflow events     |
| Claude Code     | `claude.yml`          | PR comments         |

### Commandes CI

```powershell
# Derniers runs d'un workflow
gh run list --workflow=backend-ci.yml --limit 5

# Détail + logs d'un run
gh run view <run-id>
gh run view <run-id> --log-failed

# Relancer / déclencher
gh run rerun <run-id>
gh workflow run deploy-backend.yml
gh workflow run full-test.yml

# Checks d'une PR
gh pr checks <number>
```

---

## Labels (setup one-time)

```powershell
# Plateformes
gh label create "web" --color "61DAFB" --description "Frontend React/Vite"
gh label create "api" --color "009688" --description "Backend FastAPI"
gh label create "mobile" --color "7C4DFF" --description "Expo React Native"
gh label create "extension" --color "F9A825" --description "Chrome Extension MV3"

# Types
gh label create "bug" --color "d73a4a" --description "Something is broken"
gh label create "enhancement" --color "a2eeef" --description "New feature"
gh label create "refactor" --color "e6e6e6" --description "Code cleanup"
gh label create "infra" --color "0075ca" --description "CI/CD, Docker, deploy"
gh label create "docs" --color "0075ca" --description "Documentation"

# Priorité
gh label create "P0-critical" --color "b60205" --description "Production down"
gh label create "P1-high" --color "d93f0b" --description "Fix this week"
gh label create "P2-medium" --color "fbca04" --description "Next sprint"
gh label create "P3-low" --color "c5def5" --description "Backlog"
```

---

## Releases

```powershell
# Tag + release avec notes auto-générées
git tag -a v1.2.0 -m "v1.2.0 — description"
git push origin v1.2.0
gh release create v1.2.0 --title "v1.2.0" --generate-notes

# Release avec notes custom
gh release create v1.2.0 --title "v1.2.0 — titre" --notes "$(cat <<'EOF'
## Changes
- feat(web): ...
- fix(api): ...

## Deploy
- Frontend: auto via Vercel
- Backend: manual SSH deploy needed
EOF
)"
```

---

## Raccourcis fréquents

```powershell
gh pr list                              # PRs ouvertes
gh status                               # Vue d'ensemble
gh pr view <number> --web               # Ouvrir dans navigateur
gh pr diff <number>                     # Voir le diff
gh pr comment <number> --body "message" # Commenter
gh search issues "query" --repo Fonira/DeepSight-Main
```

---

## Règles

- **Squash merge** toujours (historique propre sur main)
- **Delete branch** après merge
- Titre PR = Conventional Commits `type(scope): description`
- Body PR = template Summary / Changes / Platforms / Test plan
- `;` pas `&&` (PowerShell Windows)
- Référencer les issues : `Fixes #N` dans le body ou commit
- Conventions commit détaillées → voir `/git-workflow`
- Procédures deploy → voir `/deplo`
