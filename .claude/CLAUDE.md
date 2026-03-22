# DeepSight — Claude Code
> Architecture, stack, API, DB : voir `/CLAUDE.md` (root)

## Comportement

**Exécuter** : Si faisable avec tes outils → fais-le. Jamais "vous pouvez" ou "il faudrait". Enchaîne sans validation sauf actions destructives/push.

**Questionner** : Si ambigu → AskUserQuestion avec choix multiples AVANT de coder. Min 2 questions sur tâches complexes.

**PowerShell** : `;` pas `&&` · `-eq` pas `==` · `curl.exe` pas `curl` · `-ErrorAction Stop` · backtick pour échapper. Voir `/powershell` pour la réf complète.

## Skills

| Skill | Rôle |
|-------|------|
| `/do <tâche>` | Exécute sans proposer |
| `/clarify <tâche>` | Questionne puis exécute |
| `/powershell <tâche>` | PowerShell syntaxe garantie |
| `/tdd <feature>` | Red-Green-Refactor |
| `/test-component <comp>` | Génère des tests |
| `/debug <erreur>` | Debug avec ultrathink |
| `/validate` | Check avant commit |
| `/fix-issue <issue>` | Corrige une issue GitHub |
| `/build-ios` | Build iOS + validation |

## Commandes

```bash
cd backend && pytest               # 526 tests
cd frontend && npm run typecheck && npm run lint && npm run test
cd mobile && npm run typecheck && npm test
cd extension && npm run build && npm run typecheck
```

## Réflexion
`think` → simple · `think hard` → complexe · `think harder` → refactor · `ultrathink` → architecture

## Debug prod
```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker logs repo-backend-1 --tail 100 2>&1 | grep -iE 'error|traceback|exception'"
```
