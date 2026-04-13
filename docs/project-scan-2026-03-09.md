# DeepSight — Rapport de Scan Projet

**Date** : 9 mars 2026
**Auteur** : Claude (Senior Tech Lead — scan automatique)

---

## État des Services

| Service                         | Endpoint                                                 | Statut           |
| ------------------------------- | -------------------------------------------------------- | ---------------- |
| Backend Railway                 | `deep-sight-backend-v3-production.up.railway.app/health` | ✅ OK            |
| Backend Hetzner (reverse proxy) | `api.deepsightsynthesis.com/health`                      | ✅ OK            |
| Frontend Vercel                 | `www.deepsightsynthesis.com`                             | ✅ OK (HTTP 200) |

**Verdict** : Tous les services sont opérationnels. L'infrastructure tri-couche (Railway + Hetzner proxy + Vercel) fonctionne correctement.

---

## Activité Récente (dernières 24h — 8 mars 2026)

Sprint intensif frontend + backend avec **10 commits** en une soirée :

| Commit    | Type     | Description                                                                                  |
| --------- | -------- | -------------------------------------------------------------------------------------------- |
| `97dfc91` | fix      | Retrait options non fonctionnelles (vue compacte, réduire animations) dans Settings          |
| `58fe595` | **feat** | **3 analyses gratuites pour guests + compteur + CTA conversion** — feature d'acquisition clé |
| `b45b0bf` | **feat** | **Supadata prioritaire dans la chaîne de transcription + STT Shorts only**                   |
| `a9bc605` | fix      | Messages d'erreur user-friendly pour la démo guest                                           |
| `bf8a57a` | fix      | Bouton "Le saviez-vous?" remonté au-dessus de la BottomNav                                   |
| `22d1123` | chore    | Mobile : migration URL backend vers `api.deepsightsynthesis.com`                             |
| `521af1f` | fix      | Hamburger menu mobile sur History                                                            |
| `3b8108d` | fix      | Hamburger menu mobile sur MyAccount, Settings, AdminPage                                     |
| `04f83c5` | fix      | Responsive mobile + playlists plan-gating + widget position                                  |
| `0225a73` | feat     | AnalysisHub — panel intelligent à 4 onglets                                                  |

**Zones actives** : Frontend (responsive mobile, UX), Backend (transcripts, guest mode), Mobile (migration URL).

---

## Dette Technique

### TODO/FIXME identifiés (3)

| Fichier                           | Ligne | Commentaire                                     |
| --------------------------------- | ----- | ----------------------------------------------- |
| `backend/src/batch/router.py`     | 339   | `TODO: Intégrer avec le système d'analyse réel` |
| `backend/src/videos/streaming.py` | 428   | `TODO: Get actual duration`                     |

**Verdict** : Dette technique faible. Seulement 2 vrais TODO dans le codebase. Le projet est bien maintenu.

---

## Tâches en Attente (depuis CLAUDE.md)

### 🔴 Critique

- **Google OAuth Mobile** : `/api/auth/google/token` à implémenter côté backend pour échange de token mobile

### 🟡 Backend

- Redis cache pour transcripts
- Rate limiting IP pour requêtes non authentifiées
- Optimiser requêtes N+1 dans `/history`

### 🟡 Frontend/Mobile

- Finaliser UI Playlists
- Composant Mind Map
- TTS audio player

### 🟢 Extension

- Soumettre sur Chrome Web Store
- Tester auth sync cross-domaine en production

---

## Recommandations — Top 5 Actions Prioritaires

### 1. 🔴 CRITIQUE — Implémenter Google OAuth Mobile

**Pourquoi** : Bloquant pour le lancement mobile (App Store/Play Store). Sans ça, les utilisateurs Android/iOS ne peuvent pas se connecter via Google.
**Effort** : ~2-4h
**Fichiers** : `backend/src/auth/router.py`, `mobile/src/contexts/AuthContext.tsx`

### 2. 🟠 HAUTE — Soumettre l'Extension Chrome

**Pourquoi** : L'extension est l'hameçon d'acquisition (stratégie tri-plateforme). Chaque jour sans soumission = acquisition manquée.
**Effort** : ~2h (review manifest, screenshots, description, soumission)
**Fichiers** : `extension/dist/`, Chrome Web Store Developer Dashboard

### 3. 🟠 HAUTE — Finaliser le mode Guest (post-commit `58fe595`)

**Pourquoi** : Le mode guest 3 analyses gratuites est fraîchement déployé. Vérifier le funnel complet : landing → analyse → CTA inscription → conversion.
**Effort** : ~1-2h de QA + ajustements
**Impact** : Conversion directe

### 4. 🟡 MOYENNE — Redis Cache pour Transcripts

**Pourquoi** : Supadata est désormais prioritaire (commit `b45b0bf`). Un cache Redis réduirait les coûts API et accélérerait les re-analyses.
**Effort** : ~3-4h
**Fichiers** : `backend/src/transcripts/youtube.py`, infra Railway (Redis addon)

### 5. 🟡 MOYENNE — Rate Limiting IP

**Pourquoi** : Le mode guest sans auth ouvre la porte à l'abus. Un rate limiting par IP protégerait les crédits Mistral/Supadata.
**Effort** : ~2h
**Fichiers** : `backend/src/main.py` (middleware slowapi)

---

## Métriques Projet

| Métrique                | Valeur                    |
| ----------------------- | ------------------------- |
| Services opérationnels  | 3/3 ✅                    |
| TODO/FIXME dans le code | 2 (faible)                |
| Commits dernières 24h   | 10                        |
| Zones actives           | Frontend, Backend, Mobile |
| Bloquants critiques     | 1 (Google OAuth Mobile)   |

---

_Prochain scan recommandé : après implémentation du Google OAuth Mobile et soumission de l'extension Chrome._
