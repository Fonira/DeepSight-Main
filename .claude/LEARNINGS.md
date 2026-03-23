# DeepSight — Apprentissages & Solutions Validées
*Base de connaissances auto-alimentée — NE PAS éditer manuellement sauf cleanup*

---

## RÈGLE ABSOLUE POUR CLAUDE

**Avant de tenter une solution, TOUJOURS consulter ce fichier.**
- Si une approche est dans `À ÉVITER` → vérifier si le contexte correspond EXACTEMENT
  - Si le contexte actuel ≠ contexte documenté → l'approche peut être tentée
  - Si le contexte actuel = contexte documenté → utiliser l'alternative documentée
- Si une solution est dans `SOLUTIONS VALIDÉES` → l'utiliser EN PRIORITÉ
- Après chaque résolution non triviale → enregistrer via `/learn`
- En cas de doute entre 2 approches → vérifier ici d'abord

### Format obligatoire des learnings
Chaque entrée DOIT contenir :
- **QUAND** : conditions précises où le problème survient (environnement, OS, setup)
- **ALORS** : ce qu'il faut faire (ou ne pas faire)
- **PARCE QUE** : explication causale (pas juste "ça marche pas")
- **EXPIRE** : quand réévaluer (date, ou condition comme "si changement de setup")
- **SCOPE** : `projet` | `environnement` | `global`

---

## À ÉVITER — Approches problématiques dans un contexte précis

### [DEPLOY] Git merge/stash sur filesystem Windows monté
- **QUAND** : opérations git (merge, stash, checkout) sur ce repo depuis Windows quand le filesystem est monté via WSL/réseau ET que des .lock files existent
- **ALORS** : ne pas insister, basculer sur VPS SSH ou GitHub CLI
- **PARCE QUE** : le filesystem monté crée des .lock files que git ne peut pas supprimer. Les process git peuvent rester zombies. C'est un problème d'I/O filesystem, pas de git lui-même.
- **EXPIRE** : si changement de setup (ex: repo cloné en natif sur Windows, ou abandon du montage réseau)
- **SCOPE** : `environnement` (spécifique à ce PC avec ce montage)
- **Date**: 2026-03-23
- **⚠️ Ne s'applique PAS** : git merge depuis Linux, VPS, ou un clone local natif → fonctionne normalement

### [DEPLOY] Merge sur le VPS de production directement
- **QUAND** : on veut merger des branches en utilisant le VPS de production comme machine de développement
- **ALORS** : acceptable en urgence, mais préférer GitHub CLI pour les merges
- **PARCE QUE** : mélange les responsabilités (deploy ≠ dev). Risque de laisser le repo prod dans un état sale.
- **EXPIRE** : jamais (bonne pratique permanente)
- **SCOPE** : `global`
- **Date**: 2026-03-23

### [BACKEND] YouTube direct fetch depuis Hetzner VPS
- **QUAND** : appel direct youtube-transcript-api / yt-dlp depuis le VPS Hetzner (IP spécifique)
- **ALORS** : utiliser Supadata API en priorité (Phase 0 de la chaîne)
- **PARCE QUE** : IP Hetzner bannie par YouTube. Rate limiting agressif sur les IPs de datacenters.
- **EXPIRE** : si changement de VPS/IP, ou si proxy Webshare configuré et fonctionnel
- **SCOPE** : `environnement` (spécifique à cette IP Hetzner)
- **Date**: 2026-03-20

---

## SOLUTIONS VALIDÉES — Patterns qui fonctionnent

### [DEPLOY] Merge + Push + Deploy — Workflow fiable
- **QUAND** : besoin de merger une branche feature dans main et déployer
- **ALORS** :
  1. **Merge via GitHub** : `gh pr merge <PR> --merge` (préféré)
  2. **Si merge local nécessaire** : depuis le VPS Hetzner (repo propre)
     ```bash
     ssh VPS "cd /opt/deepsight/repo && git fetch origin && git checkout main && git merge origin/<branch> && git push origin main"
     ```
  3. **Deploy** : rebuild Docker sur VPS
     ```bash
     ssh VPS "cd /opt/deepsight/repo && git pull && docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile ./backend && docker stop repo-backend-1 && docker rm repo-backend-1 && docker run -d --name repo-backend-1 ..."
     ```
- **PARCE QUE** : GitHub CLI contourne tous les problèmes de filesystem local. Le VPS a un clone propre.
- **Ordre de préférence** : GitHub CLI > VPS SSH > Local (dernier recours)
- **SCOPE** : `projet`
- **Date**: 2026-03-23

### [DEPLOY] Résoudre les locks git sur Windows
- **QUAND** : fichiers .lock bloquent les opérations git en local
- **ALORS** : ne pas insister. Basculer sur VPS ou GitHub CLI.
- **Si absolument nécessaire en local** :
  ```bash
  taskkill /F /IM git.exe 2>nul
  del /F .git\index.lock 2>nul
  del /F .git\refs\heads\*.lock 2>nul
  # Attendre 2s puis retenter UNE seule fois
  ```
- **PARCE QUE** : les locks viennent de process git zombies sur le filesystem monté
- **SCOPE** : `environnement`
- **Date**: 2026-03-23

### [BACKEND] Transcripts YouTube fiables
- **QUAND** : extraction de transcripts YouTube
- **ALORS** : chaîne 7 méthodes avec Supadata en priorité (Phase 0). Fallback circuit breaker.
- **PARCE QUE** : aucune méthode seule n'est fiable à 100%. Supadata est payant mais le plus stable.
- **SCOPE** : `projet`
- **Fichiers**: `backend/src/transcripts/youtube.py`
- **Date**: 2026-03-20

### [FRONTEND] Build Vite avec code splitting
- **QUAND** : bundle frontend trop gros
- **ALORS** : lazy loading React Router + dynamic imports pour les pages lourdes
- **PARCE QUE** : réduit le bundle initial de ~60%
- **SCOPE** : `projet`
- **Fichiers**: `frontend/src/App.tsx`, routes config
- **Date**: 2026-03-20

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
- **Apprentissage enregistré**: À ÉVITER Windows git ops + SOLUTION VPS merge
