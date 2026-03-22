# DeepSight — Claude Code Configuration
*Mis à jour : 22 Mars 2026*

> Architecture, stack, conventions et API : voir `/CLAUDE.md` (root).
> Ce fichier contient uniquement les règles spécifiques à Claude Code.

---

## Autonomie d'exécution

- **TOUJOURS exécuter** quand les outils le permettent — ne jamais juste expliquer
- Si faisable avec Edit, Bash, Write → **le faire directement**
- Ne jamais dire "vous pouvez faire X" ou "il faudrait Y" — fais-le
- "fais-le toi-même" = signal que tu aurais dû agir dès le départ
- Enchaîner les étapes sans validation intermédiaire (sauf actions destructives/push)

## Questionnement proactif

- **TOUJOURS poser des questions** quand les exigences sont ambiguës ou multi-interprétables
- Utiliser **AskUserQuestion** avec des choix multiples pour clarifier AVANT de coder
- Ne jamais deviner le scope ou le comportement attendu — demander
- Questions précises avec options concrètes, jamais de questions ouvertes vagues
- Minimum 2 questions sur les tâches complexes

## PowerShell — syntaxe stricte

- `;` pour chaîner (pas `&&`) — cible PS 5.1 par défaut
- `-eq`, `-ne`, `-and`, `-or` (pas `==`, `!=`, `&&`, `||`)
- `curl.exe` (pas `curl`) pour le vrai curl Windows
- Guillemets sur les chemins avec espaces
- `-ErrorAction Stop` dans les try/catch
- Backtick (`` ` ``) pour échapper, pas backslash
- Voir `/powershell` pour la référence complète

## Skills disponibles

| Skill | Usage |
|-------|-------|
| `/do <tâche>` | Mode exécution autonome — fait tout sans proposer |
| `/clarify <tâche>` | Questionnement structuré avant implémentation |
| `/powershell <tâche>` | Commandes PowerShell avec syntaxe garantie |
| `/tdd <feature>` | Workflow TDD Red-Green-Refactor |
| `/test-component <composant>` | Génère des tests complets |
| `/debug <erreur>` | Debug approfondi avec ultrathink |
| `/validate` | Validation complète avant commit/PR |
| `/fix-issue <issue>` | Corrige une issue GitHub |
| `/build-ios` | Build iOS avec validation préalable |

## Commandes rapides

```bash
# Backend
cd backend && pytest                    # 526 tests
cd backend/src && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run typecheck && npm run lint && npm run test

# Mobile
cd mobile && npm run typecheck && npm test

# Extension
cd extension && npm run build && npm run typecheck
```

## Modes de réflexion
- `think` : Modifications simples
- `think hard` : Logique complexe, bugs subtils
- `think harder` : Refactoring majeur
- `ultrathink` : Architecture, décisions critiques

## Workflow Git
```bash
git checkout -b feature/nom-feature
git add <fichiers spécifiques>
git commit -m "type(scope): description"
# Types: feat, fix, refactor, test, docs, chore
```

## Debug — réflexe sur erreur signalée
```bash
# Logs backend
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  "docker logs repo-backend-1 --tail 100 2>&1 | grep -i -E 'error|traceback|exception|critical|failed'"

# Health check
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  "docker exec repo-backend-1 curl -s http://localhost:8080/health"
```
