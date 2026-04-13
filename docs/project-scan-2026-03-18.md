# DeepSight — Project Scan 🔍

**Date** : 18 mars 2026
**Auteur** : Claude (Senior Tech Lead — scan automatique)

---

## 1. État des services

| Service             | URL                                 | Statut                          |
| ------------------- | ----------------------------------- | ------------------------------- |
| **Backend Hetzner** | `api.deepsightsynthesis.com/health` | ✅ `200 OK` — `{"status":"ok"}` |
| **Frontend Vercel** | `www.deepsightsynthesis.com`        | ✅ `200 OK`                     |
| **Backend Railway** | (décommissionné)                    | ⚪ Migré vers Hetzner           |

**Verdict** : Tous les services de production sont opérationnels.

---

## 2. Activité récente (derniers commits)

| Commit    | Description                                          | Zone        |
| --------- | ---------------------------------------------------- | ----------- |
| `ada4a1a` | Fix 178 tests mobile — 9 suites green                | 🧪 Mobile   |
| `0178dfe` | Fix all frontend (400) + backend (526) tests         | 🧪 All      |
| `a549c6b` | Audit UX complet v6.2.0 — 20 fichiers, 6 axes        | 🎨 Frontend |
| `c19eb1f` | 4 tests intégration chat                             | 🧪 Backend  |
| `072ee4e` | 5 tests Stripe webhooks                              | 🧪 Backend  |
| `a996d54` | 9 tests analyse vidéo                                | 🧪 Backend  |
| `8ada08c` | 9 tests auth flows                                   | 🧪 Backend  |
| `a8e7e1a` | Update docker-compose.yml prod                       | 🏗️ Infra    |
| `175d093` | Perf v6.1 — parallel category+web, adaptive timeouts | ⚡ Backend  |
| `f9b4fda` | Throttle Resend + Redis lock multi-worker            | 🐛 Backend  |

**Zones actives** : La majorité de l'activité est concentrée sur les **tests** (couverture massive ajoutée) et l'**audit UX**. La stabilité backend s'est considérablement améliorée.

---

## 3. Déploiements Vercel

| Date   | Commit                                                       | Branche | État     |
| ------ | ------------------------------------------------------------ | ------- | -------- |
| 8 mars | `chore: migrate all API URLs from Railway to Hetzner`        | main    | ✅ READY |
| 7 mars | `feat(mobile): refonte visuelle impactante`                  | main    | ✅ READY |
| 7 mars | `feat(ui-polish): complete PLAN-UI-POLISH-2026 sections 4-5` | main    | ✅ READY |
| 7 mars | `fix(frontend): polish mobile web responsive`                | main    | ✅ READY |
| 6 mars | `fix(frontend): fix Google OAuth on mobile`                  | main    | ✅ READY |

**20/20 déploiements** en statut `READY` — aucun échec détecté. Le dernier deploy production (main) date du **8 mars** avec la migration des URLs Railway → Hetzner.

---

## 4. Dette technique (TODO/FIXME)

| Fichier                           | Ligne | Commentaire                                                          |
| --------------------------------- | ----- | -------------------------------------------------------------------- |
| `backend/src/videos/streaming.py` | 428   | `TODO: Get actual duration` — duration hardcodée à 0                 |
| `backend/src/batch/router.py`     | 339   | `TODO: Intégrer avec le système d'analyse réel` — batch non connecté |

**Bilan** : Seulement **2 TODO techniques** dans le code — dette technique très faible. Le codebase est propre.

---

## 5. Tâches en attente (depuis CLAUDE.md)

### 🔴 Critique

- **Google OAuth Mobile** : `/api/auth/google/token` non implémenté côté backend
- **YouTube IP ban Hetzner** : VPS bloquée par YouTube, Supadata = méthode principale, proxy Webshare en cours

### 🟡 Backend

- Configurer proxy YouTube (Webshare) pour fallback transcript
- Redis cache pour transcripts
- Rate limiting IP pour requêtes non authentifiées
- Optimiser requêtes N+1 dans /history
- Recréer docker-compose.yml fonctionnel

### 🟡 Frontend/Mobile

- Finaliser UI Playlists
- Composant Mind Map
- TTS audio player

### 🟢 Extension

- Soumettre sur Chrome Web Store
- Tester auth sync cross-domaine en production

---

## 6. Recommandations — Top 5 Priorités

### 🔴 1. Implémenter Google OAuth Mobile (CRITIQUE)

**Impact** : Bloque l'inscription/connexion des utilisateurs mobiles via Google
**Effort** : ~2-3h
**Action** : Créer endpoint `POST /api/auth/google/token` qui accepte le `id_token` d'expo-auth-session et retourne access/refresh tokens

### 🔴 2. Stabiliser l'extraction YouTube (CRITIQUE)

**Impact** : Core feature — sans transcripts, pas d'analyse
**Effort** : ~2h
**Action** : Finaliser la config proxy Webshare pour `yt-dlp` en fallback quand Supadata échoue. Ajouter Redis cache des transcripts (économie crédits Supadata)

### 🟡 3. Soumettre l'Extension Chrome (HAUTE)

**Impact** : Canal d'acquisition principal (l'hameçon)
**Effort** : ~4h (review Google, screenshots, description)
**Action** : Préparer les assets Chrome Web Store, tester auth sync prod, soumettre

### 🟡 4. Finaliser UI Playlists (HAUTE)

**Impact** : Feature Pro payante, différenciateur
**Effort** : ~6-8h
**Action** : Compléter le frontend + connecter au backend existant

### 🟢 5. Docker-compose.yml de production (MOYENNE)

**Impact** : Facilite le déploiement et la maintenance
**Effort** : ~1h
**Action** : Formaliser les `docker run` actuels en un `docker-compose.yml` fonctionnel

---

## 7. Métriques clés

| Métrique                    | Valeur                   |
| --------------------------- | ------------------------ |
| Tests backend               | 526 ✅                   |
| Tests frontend              | 400 ✅                   |
| Tests mobile                | 178 ✅                   |
| TODO/FIXME code             | 2 (très faible)          |
| Déploiements Vercel réussis | 20/20                    |
| Uptime services             | 100% (au moment du scan) |

---

## 8. Résumé exécutif

Le projet DeepSight est dans un **état sain**. La migration Railway → Hetzner est **terminée**, tous les services sont **opérationnels**, et la couverture de tests est **excellente** (1104 tests au total). La dette technique est quasi nulle avec seulement 2 TODO dans le code.

Les deux blocages critiques restants sont le **Google OAuth mobile** et la **stabilité de l'extraction YouTube** (dépendance au proxy). L'extension Chrome, prête techniquement, attend sa soumission sur le Web Store — c'est le levier d'acquisition prioritaire.

_Prochain scan recommandé : 25 mars 2026_
