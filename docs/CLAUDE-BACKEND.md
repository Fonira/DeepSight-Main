# CLAUDE.md - Deep Sight Backend

## 🎯 Identité du projet

**Deep Sight API** - Backend FastAPI pour l'analyse intelligente et sourcée de vidéos YouTube.

- **URL Production**: Railway (https://api.deepsightsynthesis.com)
- **Frontend**: Vercel (React/TypeScript)
- **Version actuelle**: 5.5.1

## 🏗️ Stack technique

| Technologie | Usage |
|-------------|-------|
| Python 3.11+ | Runtime |
| FastAPI | Framework API async |
| SQLAlchemy 2.0 | ORM async (asyncpg) |
| PostgreSQL | Base de données production |
| Pydantic V2 | Validation & schémas |
| JWT (PyJWT) | Authentification stateless |
| Mistral AI | Analyse & synthèse IA |
| Perplexity AI | Fact-checking & web search |
| Stripe | Paiements & abonnements |
| Resend | Emails transactionnels |
| Sentry | Error tracking |
| Redis (optionnel) | Cache & rate limiting |

## 📁 Architecture des dossiers

```
src/
├── main.py                 # Point d'entrée FastAPI + routers
├── core/
│   ├── config.py           # Settings, plans, quotas, API keys
│   ├── security.py         # Hashing, JWT utils
│   ├── credits.py          # Gestion des crédits utilisateurs
│   ├── cache.py            # Cache Redis/mémoire
│   ├── logging.py          # Configuration logging structuré
│   └── middleware.py       # Middlewares custom
├── db/
│   ├── database.py         # SQLAlchemy engine + modèles (15 tables)
│   └── optimizations.py    # Queries optimisées, indexes
├── auth/
│   ├── router.py           # Endpoints auth (/register, /login, /me)
│   ├── service.py          # Logique métier auth
│   ├── dependencies.py     # get_current_user, require_plan
│   ├── schemas.py          # Pydantic models auth
│   └── email.py            # Templates email Resend
├── videos/
│   ├── router.py           # Endpoints vidéos (/analyze, /history)
│   ├── service.py          # CRUD summaries
│   ├── analysis.py         # Prompts Mistral analyse critique ⭐
│   ├── intelligent_discovery.py # Recherche vidéos intelligente
│   ├── web_enrichment.py   # Enrichissement Perplexity
│   ├── streaming.py        # SSE pour analyse temps réel
│   ├── export.py           # Export PDF/DOCX/MD
│   └── schemas.py          # Pydantic models vidéos
├── transcripts/
│   └── youtube.py          # Extraction transcripts multi-fallback
├── chat/
│   ├── router.py           # Endpoints chat (/ask, /ask/stream)
│   ├── service.py          # Chat Mistral contextuel
│   └── websocket.py        # WebSocket chat (optionnel)
├── billing/
│   └── router.py           # Stripe checkout & webhooks
├── playlists/
│   └── router.py           # Analyse playlists (Pro)
├── admin/
│   └── router.py           # Panel administration
├── middleware/
│   ├── rate_limiter.py     # Limitation de requêtes
│   └── performance.py      # Métriques & timing
└── tasks/
    ├── celery_app.py       # Celery config (optionnel)
    └── analysis_tasks.py   # Tâches asynchrones
```

## 🔑 Fichiers critiques

| Fichier | Importance | Description |
|---------|------------|-------------|
| `core/config.py` | ⭐⭐⭐ | Plans, quotas, toutes les settings |
| `db/database.py` | ⭐⭐⭐ | Modèles SQLAlchemy (15 tables) |
| `auth/dependencies.py` | ⭐⭐⭐ | Dépendances auth FastAPI |
| `videos/analysis.py` | ⭐⭐⭐ | Prompts IA analyse critique |
| `transcripts/youtube.py` | ⭐⭐ | Extraction YouTube multi-fallback |
| `billing/router.py` | ⭐⭐ | Intégration Stripe complète |

## ⚡ Commandes essentielles

```bash
# Installation
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Développement local
cd src
uvicorn main:app --reload --port 8000

# Tests
pytest -v

# Linting
ruff check src/
mypy src/

# Migrations (si Alembic configuré)
alembic upgrade head
```

## 🔐 Authentification

### Flow JWT
```
1. POST /api/auth/register → Crée user + envoie email vérification
2. POST /api/auth/login → Retourne access_token (15min) + refresh_token (7j)
3. Requêtes → Header: Authorization: Bearer {access_token}
4. POST /api/auth/refresh → Nouveau access_token
5. OAuth Google disponible via /api/auth/google/login
```

### Dépendances FastAPI
```python
from auth.dependencies import get_current_user, require_plan

# Endpoint protégé
@router.get("/protected")
async def protected_route(user: User = Depends(get_current_user)):
    return {"user_id": user.id}

# Endpoint réservé Pro+
@router.get("/pro-only")
async def pro_route(user: User = Depends(require_plan("pro"))):
    return {"message": "Bienvenue Pro!"}
```

## 💳 Système de crédits & Limites (v3.1)

| Plan | Crédits/mois | Analyses/jour | Chat/vidéo | Playlists |
|------|--------------|---------------|------------|-----------|
| Free | 500 | 5 | 5 | ❌ |
| Starter | 5,000 | 20 | 20 | ❌ |
| Pro | 25,000 | 50 | ∞ | ✅ (10 vidéos) |
| Expert | 100,000 | 200 | ∞ | ✅ (50 vidéos) |
| Unlimited | ∞ | ∞ | ∞ | ✅ (100 vidéos) |

### Features bloquées par plan

| Feature | Free | Starter | Pro | Expert |
|---------|------|---------|-----|--------|
| playlists | ❌ | ❌ | ✅ | ✅ |
| export_csv | ❌ | ✅ | ✅ | ✅ |
| export_excel | ❌ | ✅ | ✅ | ✅ |
| tts | ❌ | ✅ | ✅ | ✅ |
| batch_api | ❌ | ❌ | ❌ | ✅ |
| deep_research | ❌ | ❌ | ❌ | ✅ |

### Module `core/plan_limits.py` (NEW)

```python
from core.plan_limits import (
    check_daily_analysis_limit,  # Vérifie quota quotidien
    check_feature_access,        # Vérifie accès feature
    get_user_limits_status,      # Status complet pour UI
    increment_daily_usage,       # Incrémente compteur
)
```

### Dépendances d'accès

```python
from auth.dependencies import check_daily_limit, require_feature

# Vérifier limite quotidienne avant analyse
@router.post("/analyze")
async def analyze(user: User = Depends(check_daily_limit)):
    ...

# Bloquer feature par plan
@router.post("/export/csv")
async def export_csv(user: User = Depends(require_feature("export_csv"))):
    ...
```

**Coûts en crédits**:
- Analyse standard: 1 crédit
- Analyse longue (>30min): 2 crédits
- Playlist: 1 crédit/vidéo

## 🤖 Analyse IA Sourcée et Nuancée

### Modes d'analyse
```python
ANALYSIS_MODES = {
    "accessible": "Grand public, vulgarisation",
    "standard": "Équilibré, détaillé",
    "expert": "Technique, académique"
}
```

### Marqueurs épistémiques
```
✅ SOLIDE - Fait établi, consensus scientifique
⚖️ PLAUSIBLE - Probable mais à confirmer
❓ INCERTAIN - Hypothèse, débat en cours
⚠️ À VÉRIFIER - Affirmation douteuse
```

### Structure du résumé généré
```markdown
## 🎯 Points clés
- [00:02:15] Point avec timecode

## 📊 Analyse détaillée
### Section 1
Contenu avec marqueurs épistémiques...

## 🔍 Concepts clés
- **Concept**: Définition Wikipedia enrichie

## ⚠️ Limites et biais potentiels
- Biais identifiés dans la source
```

## 🎬 Extraction YouTube

Système multi-fallback pour robustesse:

```python
# Ordre de priorité
1. youtube-transcript-api  # Rapide, rate-limited
2. yt-dlp                  # Fiable, plus lent
3. Supadata API            # Backup payant, très fiable
```

## 📡 Endpoints principaux

### Auth & Limits
```
POST /api/auth/register           # Création compte
POST /api/auth/login              # Connexion → tokens
POST /api/auth/refresh            # Renouveler access token
GET  /api/auth/me                 # Profil utilisateur
GET  /api/auth/quota              # Quotas utilisateur
GET  /api/auth/limits             # 🆕 Status complet limites (v3.1)
PUT  /api/auth/preferences        # Modifier préférences
```

#### `GET /api/auth/limits` Response (v3.1)
```json
{
  "plan": "starter",
  "plan_info": { "name": "STARTER", "daily_analyses": 20, "price": 499 },
  "daily_analyses": {
    "limit": 20,
    "used": 5,
    "remaining": 15,
    "percent_used": 25,
    "is_unlimited": false
  },
  "credits": { "current": 4500, "monthly_allowance": 5000 },
  "blocked_features": ["playlists", "batch_api", "deep_research"],
  "upgrade_prompt": "Passez à Pro pour les playlists!",
  "next_plan": "pro",
  "next_plan_info": { "name": "PRO", "daily_analyses": 50, "price": 999 }
}
```

### Videos
```
POST /api/videos/analyze          # Lancer analyse → task_id
GET  /api/videos/status/{task_id} # Polling status
GET  /api/videos/history          # Historique paginé
GET  /api/videos/summary/{id}     # Détails résumé
POST /api/videos/discover         # Découverte intelligente
```

### Chat
```
POST /api/chat/ask                # Question → réponse
POST /api/chat/ask/stream         # Question → SSE stream
GET  /api/chat/history/{summary}  # Historique conversation
```

### Billing
```
POST /api/billing/checkout        # Créer session Stripe
POST /api/billing/webhook         # Webhook Stripe
GET  /api/billing/portal          # Portail client
```

## 🗄️ Modèles de base de données

Tables principales (SQLAlchemy async):

```python
# Users & Auth
User                # id, email, hashed_password, plan, credits...
RefreshToken        # token, user_id, expires_at
VerificationCode    # code, user_id, type, expires_at

# Content
Summary             # id, user_id, video_id, content, analysis_mode...
ChatMessage         # id, summary_id, role, content, timestamp
Playlist            # id, user_id, youtube_playlist_id, videos...

# Billing
Transaction         # id, user_id, type, amount, stripe_id...
Subscription        # id, user_id, stripe_subscription_id, status...

# System
AdminLog            # id, admin_id, action, target, timestamp
Notification        # id, user_id, type, content, read...
```

## 🔧 Configuration environnement

```env
# Base de données
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/deepsight

# JWT
JWT_SECRET_KEY=your-secret-key-minimum-32-characters
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# APIs IA
MISTRAL_API_KEY=your-mistral-key
PERPLEXITY_API_KEY=your-perplexity-key  # Optionnel

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Frontend
FRONTEND_URL=https://deepsightsynthesis.com
ALLOWED_ORIGINS=https://deepsightsynthesis.com,http://localhost:5173

# Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@deepsightsynthesis.com

# Admin
ADMIN_EMAIL=maxime@deepsightsynthesis.com
ADMIN_PASSWORD=secure-password
```

## 🚀 Déploiement Railway

```json
// railway.json
{
  "deploy": {
    "startCommand": "cd src && uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health"
  }
}
```

```
// Procfile
web: cd src && uvicorn main:app --host 0.0.0.0 --port $PORT
```

## 🐛 Debug & Troubleshooting

| Problème | Cause | Solution |
|----------|-------|----------|
| 500 sur /analyze | Mistral API down | Vérifier MISTRAL_API_KEY, retry |
| Transcript vide | YouTube rate limit | Fallback yt-dlp activé auto |
| 401 Unauthorized | Token expiré | Client doit refresh |
| Stripe webhook fail | Signature invalide | Vérifier STRIPE_WEBHOOK_SECRET |

### Logs structurés
```python
from core.logging import logger

logger.info("Analysis started", extra={
    "user_id": user.id,
    "video_id": video_id,
    "mode": analysis_mode
})
```

## 📝 TODOs connus

- [ ] Implémenter cache Redis pour transcripts
- [ ] Ajouter rate limiting par IP (non-auth)
- [ ] Optimiser requêtes N+1 dans /history
- [ ] Ajouter tests d'intégration Stripe
- [ ] Migrer vers Celery pour tâches longues

## 🤖 Instructions pour Claude Code

### Priorités lors des modifications
1. **Async everywhere**: Toujours utiliser `async/await` pour I/O
2. **Type hints**: Typer toutes les fonctions
3. **Pydantic**: Valider toutes les entrées/sorties
4. **Error handling**: Exceptions métier explicites

### Patterns à suivre
```python
# Service layer pattern
async def get_user_summary(db: AsyncSession, user_id: int, summary_id: int) -> Summary:
    """Récupère un résumé avec vérification ownership."""
    result = await db.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == user_id
        )
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(404, "Summary not found")
    return summary
```

### À éviter absolument
- Requêtes synchrones (`requests.get` → utiliser `httpx`)
- `time.sleep()` → utiliser `asyncio.sleep()`
- Secrets hardcodés → toujours via `config.py`
- SQL brut sans paramétrage → SQLAlchemy ORM
- `print()` → utiliser le logger structuré
