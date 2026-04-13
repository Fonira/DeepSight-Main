# 📊 DeepSight — Rapport de Scan Projet

**Date** : 20 mars 2026
**Généré automatiquement par le Senior Tech Lead IA**

---

## 1. État des Services

| Service                  | URL                                         | Statut                   |
| ------------------------ | ------------------------------------------- | ------------------------ |
| **Backend Hetzner**      | `https://api.deepsightsynthesis.com/health` | ✅ `{"status":"ok"}`     |
| **Frontend Vercel**      | `https://www.deepsightsynthesis.com`        | ✅ HTTP 200              |
| **Container backend**    | `repo-backend-1`                            | ✅ Up 13h (healthy)      |
| **Container Caddy**      | `repo-caddy-1`                              | ✅ Up 8 jours            |
| **Container PostgreSQL** | `repo-postgres-1`                           | ✅ Up 11 jours (healthy) |
| **Container Redis**      | `repo-redis-1`                              | ✅ Up 11 jours (healthy) |

**Verdict** : Infrastructure 100% opérationnelle. Tous les containers sont healthy.

---

## 2. Alertes Détectées

### ⚠️ Rate Limiting Resend (Emails)

- **56 erreurs 429** dans les dernières 24h
- Cause : le scheduler APScheduler déclenche l'envoi d'emails d'onboarding avec plusieurs workers simultanés, dépassant la limite de 5 req/s de Resend
- Impact : emails d'onboarding J+2 et J+7 potentiellement non envoyés
- **Priorité** : HAUTE — Ajouter un mécanisme de throttling/retry avec backoff exponentiel dans le batch d'emails

---

## 3. Activité Récente (Derniers Commits)

| Commit    | Description                                                     | Âge |
| --------- | --------------------------------------------------------------- | --- |
| `2e7c899` | feat: Quick Chat button sur DashboardPage                       | 14h |
| `269cdf9` | fix: erreur f-string dans le chat router                        | 14h |
| `5bfefb2` | feat: Quick Chat mode — chat IA direct depuis URL sans analyse  | 15h |
| `1b3cfad` | feat: suggestions follow-up cliquables (4 boutons) dans Chat IA | 16h |
| `9c61da2` | feat: ChatPage v4 — sidebar + watermark + gradient              | 16h |
| `a560e89` | feat: refonte ChatPage type Claude                              | —   |
| `2c0c47c` | feat: refonte Chat IA interface épurée                          | —   |
| `2a1e7e5` | fix: increase concept limits (15→30) + overflow batch           | —   |
| `1100b21` | fix: missing FactCheckLite import                               | —   |
| `464d23f` | feat: Tournesol logo across all pages                           | —   |

### Zones d'activité récente

- **Frontend** : Refonte majeure du Chat IA (ChatPage v4, interface style Claude), Quick Chat mode
- **Backend** : Quick Chat endpoint, fix chat router, augmentation limites concepts
- **Mobile** : Refonte visuelle (Login, Dashboard, Analysis), fix tab bar
- **Infra** : Migration complète des URLs Railway → Hetzner

---

## 4. Déploiements Vercel (Frontend)

| Date    | Commit                               | Branche | Statut   |
| ------- | ------------------------------------ | ------- | -------- |
| 20 mars | Migration API URLs Railway → Hetzner | `main`  | ✅ READY |
| 19 mars | Refonte visuelle mobile              | `main`  | ✅ READY |
| 19 mars | UI Polish plan complet sections 4-5  | `main`  | ✅ READY |
| 19 mars | Polish mobile responsive             | `main`  | ✅ READY |

**Tous les déploiements récents sont en production et fonctionnels.**

---

## 5. Dette Technique (TODO/FIXME)

| Fichier                           | Ligne | Commentaire                                     |
| --------------------------------- | ----- | ----------------------------------------------- |
| `backend/src/batch/router.py`     | 339   | `TODO: Intégrer avec le système d'analyse réel` |
| `backend/src/videos/streaming.py` | 428   | `TODO: Get actual duration`                     |

**Verdict** : Seulement 2 TODO trouvés dans le code — dette technique très faible. La base de code est bien maintenue.

---

## 6. Known Issues (depuis CLAUDE.md)

### 🔴 Critique

- **Google OAuth Mobile** : `/api/auth/google/token` pas encore implémenté côté backend
- **YouTube IP ban Hetzner** : IP VPS bloquée par YouTube → Supadata = méthode principale, proxy Webshare en cours

### 🟡 Moyenne

- Configurer proxy YouTube (Webshare) pour fallback transcript
- Redis cache pour transcripts
- Rate limiting IP pour requêtes non authentifiées
- Optimiser requêtes N+1 dans `/history`
- Recréer un `docker-compose.yml` fonctionnel
- Finaliser UI Playlists
- Composant Mind Map
- TTS audio player

### 🟢 Faible

- Soumettre extension sur Chrome Web Store
- Tester auth sync cross-domaine extension en production

---

## 7. Recommandations — Top 5 Priorités

| #   | Priorité    | Action                                                                                                                 | Impact                                   |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | 🔴 CRITIQUE | **Fixer le rate limiting Resend** : ajouter throttle (max 4 req/s) + retry backoff dans le batch d'emails d'onboarding | 56 erreurs/jour, emails perdus           |
| 2   | 🔴 CRITIQUE | **Implémenter Google OAuth Mobile** (`/api/auth/google/token`)                                                         | Bloquant pour le login mobile via Google |
| 3   | 🟡 HAUTE    | **Configurer proxy Webshare** pour fallback YouTube transcripts sur Hetzner                                            | Résilience extraction transcripts        |
| 4   | 🟡 HAUTE    | **Recréer docker-compose.yml** pour simplifier les redéploiements backend                                              | Maintenabilité infra                     |
| 5   | 🟡 MOYENNE  | **Ajouter Redis cache transcripts** pour réduire les appels API Supadata                                               | Performance + coûts                      |

---

## 8. Métriques Clés

- **Commits récents** : 20 commits analysés, forte activité sur Chat IA et UX
- **Tests** : 400/400 frontend, 526/526 backend, 178/178 mobile (dernière passe)
- **Containers** : 4/4 healthy
- **Erreurs 24h** : 56 (toutes liées au rate limiting Resend, pas de crash)
- **Uptime backend** : Stable (13h depuis dernier restart, healthy)

---

_Prochain scan recommandé : 27 mars 2026_
