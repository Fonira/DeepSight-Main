# DeepSight — Apprentissages & Solutions Validées
*Base de connaissances auto-alimentée — NE PAS éditer manuellement sauf cleanup*

---

## RÈGLE ABSOLUE POUR CLAUDE

**Avant de tenter une solution, TOUJOURS consulter ce fichier.**
- Si une approche est dans `BLACKLIST` → NE JAMAIS la retenter, même partiellement
- Si une solution est dans `SOLUTIONS VALIDÉES` → l'utiliser EN PRIORITÉ
- Après chaque résolution non triviale → enregistrer via `/learn`
- En cas de doute entre 2 approches → vérifier ici d'abord

---

## BLACKLIST — Approches qui NE FONCTIONNENT PAS

### [DEPLOY] Git merge/stash depuis Windows avec filesystem monté
- **Date**: 2026-03-23
- **Contexte**: Merge branche feature dans main + push + deploy
- **Approches tentées (TOUTES échouées)** :
  1. `git stash` sur Windows → échoue (permissions lock sur .lock files)
  2. `git checkout -- <file>` sur Windows → échoue (filesystem monté, locks)
  3. Windows-MCP pour supprimer les locks → ne résout pas le problème de fond
  4. PowerShell direct sur PC MSI → git bloqué (process git zombie)
  5. Tuer les process git + retry → timeout, instable
- **Pourquoi ça échoue** : Le filesystem Windows monté (WSL/réseau) crée des .lock files que git ne peut pas gérer. Les process git peuvent rester zombies.
- **Ne jamais retenter** : toute opération git merge/stash/checkout sur ce repo depuis Windows quand il y a des locks

### [DEPLOY] Merge sur le VPS de production directement
- **Date**: 2026-03-23
- **Contexte**: Alternative tentée pendant le debug deploy
- **Pourquoi c'est risqué** : Le VPS ne devrait servir qu'au déploiement, pas aux merges. Ça mélange les responsabilités. Acceptable en urgence mais pas en workflow normal.

### [BACKEND] YouTube direct fetch depuis Hetzner VPS
- **Date**: 2026-03-20
- **Contexte**: Extraction de transcripts YouTube
- **Approche tentée**: Appel direct youtube-transcript-api / yt-dlp depuis le VPS
- **Pourquoi ça échoue**: IP Hetzner bannie par YouTube. Rate limiting agressif.
- **Solution alternative**: Supadata API en priorité (voir SOLUTIONS VALIDÉES)

---

## SOLUTIONS VALIDÉES — Patterns qui fonctionnent

### [DEPLOY] Merge + Push + Deploy — Workflow fiable
- **Date**: 2026-03-23
- **Problème**: Merger une branche feature dans main et déployer
- **Solution en 3 étapes** :
  1. **Merge via GitHub** : `gh pr merge <PR> --merge` (ou créer PR + merge si pas de PR)
  2. **Si merge local nécessaire** : le faire depuis le VPS Hetzner (repo propre, pas de locks)
     ```bash
     ssh VPS "cd /opt/deepsight/repo && git fetch origin && git checkout main && git merge origin/<branch> && git push origin main"
     ```
  3. **Deploy** : rebuild Docker sur VPS
     ```bash
     ssh VPS "cd /opt/deepsight/repo && git pull && docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile ./backend && docker stop repo-backend-1 && docker rm repo-backend-1 && docker run -d --name repo-backend-1 ..."
     ```
- **Ordre de préférence** : GitHub CLI > VPS SSH > Local (dernier recours)
- **Fichiers**: `deploy/hetzner/Dockerfile`, `deploy/hetzner/docker-compose.yml`

### [DEPLOY] Résoudre les locks git sur Windows
- **Date**: 2026-03-23
- **Problème**: Fichiers .lock qui bloquent les opérations git
- **Solution rapide** : Ne pas insister. Basculer immédiatement sur VPS ou GitHub CLI.
- **Si absolument nécessaire en local** :
  ```bash
  # Tuer tous les process git
  taskkill /F /IM git.exe 2>nul
  # Supprimer les locks
  del /F .git\index.lock 2>nul
  del /F .git\refs\heads\*.lock 2>nul
  # Attendre 2s puis retenter UNE seule fois
  ```

### [BACKEND] Transcripts YouTube fiables
- **Date**: 2026-03-20
- **Problème**: Extraction transcripts depuis VPS Hetzner (IP bannie YouTube)
- **Solution**: Chaîne 7 méthodes avec Supadata en priorité (Phase 0). Fallback circuit breaker.
- **Fichiers**: `backend/src/transcripts/youtube.py`

### [FRONTEND] Build Vite avec code splitting
- **Date**: 2026-03-20
- **Problème**: Bundle trop gros
- **Solution**: Lazy loading React Router + dynamic imports pour les pages lourdes
- **Fichiers**: `frontend/src/App.tsx`, routes config

---

## PATTERNS RÉCURRENTS — Erreurs fréquentes et leurs fixes

### Git locks sur Windows (filesystem monté)
- **Symptôme**: `fatal: Unable to create '.git/index.lock': File exists`
- **Cause**: Process git zombie ou filesystem monté avec locks
- **Fix**: Ne pas insister en local → utiliser VPS SSH ou GitHub CLI
- **Temps perdu si ignoré**: ~15 min de tentatives inutiles

### TypeScript "Cannot find module" après ajout de nouveau fichier
- **Cause**: Cache TypeScript pas invalidé
- **Fix**: `npm run typecheck` (pas besoin de restart le dev server)

### Docker container qui ne démarre pas après rebuild
- **Cause**: Ancien container pas supprimé (conflit de nom)
- **Fix**: `docker stop <name> && docker rm <name>` avant `docker run`

---

## PRÉFÉRENCES TECHNIQUES — Ce qui marche le mieux pour CE projet

- **State management**: Zustand + Immer (pas Redux, pas Context seul)
- **Data fetching**: TanStack Query v5 (pas useEffect + fetch)
- **Animations web**: Framer Motion (pas CSS animations pour complexe)
- **Animations mobile**: Reanimated 4 (pas Animated API)
- **Lists mobile**: FlashList (pas FlatList pour > 50 items)
- **Tests**: getDefaultProps pattern pour React components
- **API calls**: httpx async (backend), fetch via api.ts centralisé (frontend/mobile)
- **Modèle IA**: Mistral (pas OpenAI sauf fallback STT)
- **Deploy**: GitHub CLI > VPS SSH > Local Windows (dernier recours)
- **Git ops complexes**: Toujours depuis environnement propre (VPS ou GitHub), jamais Windows monté

---

## MÉTRIQUES D'APPRENTISSAGE

| Date | Problème | Tentatives avant solution | Tentatives avec learnings |
|------|----------|--------------------------|--------------------------|
| 2026-03-23 | Deploy merge + push | 7 tentatives (~20 min) | 1 tentative directe |

---

## HISTORIQUE DES SESSIONS

### 2026-03-23 — Deploy branche security-audit
- **Tâche**: Merge feature branch + deploy backend
- **Problème rencontré**: Locks git Windows, stash impossible, process zombies
- **Solution finale**: Merge depuis VPS Hetzner via SSH
- **Apprentissage enregistré**: BLACKLIST Windows git ops + SOLUTION VPS merge

