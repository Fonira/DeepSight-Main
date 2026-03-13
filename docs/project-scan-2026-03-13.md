# DeepSight — Rapport de Scan Projet
**Date** : 13 mars 2026 | **Auteur** : Claude (Senior Tech Lead)

---

## 1. État des Services

| Service | Endpoint | Statut |
|---------|----------|--------|
| **Backend Hetzner** | `https://api.deepsightsynthesis.com/health` | ✅ `{"status":"ok"}` |
| **Frontend Vercel** | `https://www.deepsightsynthesis.com` | ✅ HTTP 200 |
| **Docker: backend** | `repo-backend-1` | ✅ Up 43h (healthy) |
| **Docker: caddy** | `repo-caddy-1` | ✅ Up 46h |
| **Docker: postgres** | `repo-postgres-1` | ✅ Up 5 jours (healthy) |
| **Docker: redis** | `repo-redis-1` | ✅ Up 5 jours (healthy) |

**Verdict** : Tous les services sont opérationnels. Infrastructure stable.

---

## 2. Métriques Base de Données

| Métrique | Valeur |
|----------|--------|
| Utilisateurs totaux | 11 |
| Analyses totales | 40 |
| Nouveaux users (7j) | 0 |
| Analyses (7j) | 12 |

**Note** : Pas de nouveaux inscrits cette semaine, mais 12 analyses réalisées → utilisateurs existants actifs.

---

## 3. Alertes & Erreurs Détectées

### 🟡 Rate Limiting Resend (Emails)
**Gravité** : Moyenne
**Détail** : 16+ erreurs `429 rate_limit_exceeded` de Resend dans la dernière heure. Le job APScheduler d'onboarding emails envoie trop de requêtes simultanées (> 2/sec).

**Impact** : Les emails d'onboarding (J2, J7) ne sont pas envoyés.

**Recommandation** : Ajouter un délai (`asyncio.sleep(0.6)`) entre chaque envoi dans le batch d'emails onboarding, ou utiliser un système de queue avec throttling.

---

## 4. Activité Récente (20 derniers commits)

### Thèmes principaux :
1. **Migration Railway → Hetzner** : Terminée (URLs, DNS, docs)
2. **UI Polish majeur** : Mobile (batches 1-3, anti-AI-slop), Frontend (hero, sidebar, chat), Extension (i18n FR/EN)
3. **Tournesol** : Remplacement des tendances DeepSight par les recommandations Tournesol (privacy)
4. **Fixes critiques** : Dashboard crash, Mistral import fallback, transcript extraction (tuple.get AttributeError)
5. **YouTube proxy** : Support ajouté pour contourner le ban IP Hetzner

### Commits clés :
- `c51da51` fix: plan unlimited affiché Gratuit + proxy CORS Tournesol
- `a7afa53` fix: dashboard crash + Mistral import fallback
- `73301e5` feat: YouTube proxy support
- `d3575cc` feat: Tournesol recommendations
- `683605e` feat(mobile): refonte visuelle Login, Dashboard, Analysis

---

## 5. Dette Technique

### TODO/FIXME trouvés dans le code (6 items) :

| Fichier | Ligne | Description |
|---------|-------|-------------|
| `backend/src/batch/router.py` | 339 | TODO: Intégrer avec le système d'analyse réel |
| `backend/src/videos/streaming.py` | 428 | TODO: Get actual duration (hardcodé à 0) |

**Note** : Dette technique très faible (2 TODO backend). Le codebase est relativement propre.

---

## 6. Problèmes Connus (depuis CLAUDE.md)

### 🔴 Critique
- **Google OAuth Mobile** : `/api/auth/google/token` à implémenter
- **YouTube IP ban Hetzner** : Proxy Webshare en cours de config

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

## 7. Recommandations — Top 5 Actions Prioritaires

| # | Priorité | Action | Justification |
|---|----------|--------|---------------|
| 1 | 🔴 **Critique** | **Fix rate limiting Resend** — Ajouter throttling dans le batch email onboarding | Emails d'onboarding cassés en prod actuellement |
| 2 | 🔴 **Critique** | **Implémenter Google OAuth Mobile** (`/api/auth/google/token`) | Bloque le login mobile via Google |
| 3 | 🟠 **Haute** | **Finaliser proxy YouTube Webshare** | Fallback transcript non fonctionnel sur VPS (IP ban) |
| 4 | 🟠 **Haute** | **Recréer docker-compose.yml** | Risque opérationnel si un container doit être recréé manuellement |
| 5 | 🟡 **Moyenne** | **Redis cache transcripts** | Optimisation coûts Supadata + latence |

---

## 8. Résumé Exécutif

L'infrastructure DeepSight est **stable et opérationnelle** après la migration Railway → Hetzner. Le polish UI sur les 3 plateformes a bien avancé. Le point d'attention immédiat est le **rate limiting Resend** qui bloque les emails d'onboarding en production. Les deux chantiers critiques restants sont l'auth Google mobile et le proxy YouTube.

Prochain scan recommandé : **20 mars 2026**.
