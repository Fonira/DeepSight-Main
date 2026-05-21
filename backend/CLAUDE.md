# Backend DeepSight — Contexte Claude

## Stack

FastAPI + Python 3.11, SQLAlchemy 2.0 async, PostgreSQL 17, Redis 7, Alembic migrations.
Entry point : `src/main.py` (15+ routers inclus).

## Architecture src/

Chaque module = 1 dossier avec `router.py` + `schemas.py` + `service.py` (parfois fusionnés).

| Module         | Rôle                                                        | Fichiers clés                                                                       |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `core/`        | Config, sécurité, crédits, cache, LLM provider, logging     | `config.py` (SSOT plans/quotas), `llm_provider.py`, `plan_limits.py`, `security.py` |
| `db/`          | Models SQLAlchemy (25 tables), session async                | `database.py` (tous les models), `optimizations.py`                                 |
| `auth/`        | JWT + Google OAuth + sessions + email verif                 | `dependencies.py` (`get_current_user`, `require_plan`), `router.py`                 |
| `videos/`      | Analyse v6 principale, streaming, discovery                 | `router.py` (3959 lines — le plus gros fichier)                                     |
| `chat/`        | Chat v4.0 Mistral + enrichissement Perplexity               | `router.py`                                                                         |
| `billing/`     | Stripe checkout, webhooks, portal, API keys                 | `router.py` (1636 lines)                                                            |
| `transcripts/` | Extraction YouTube 7 méthodes multi-fallback                | `youtube.py` (2339 lines)                                                           |
| `playlists/`   | Analyse playlist + corpus + chat                            | `router.py`                                                                         |
| `study/`       | Flashcards, quiz, mind maps, spaced repetition              | `router.py`                                                                         |
| `debate/`      | AI Debate — confrontation perspectives vidéo                | `router.py`                                                                         |
| `academic/`    | Papers search (arXiv, Crossref, Semantic Scholar, OpenAlex) | `router.py`                                                                         |
| `exports/`     | PDF (ReportLab/WeasyPrint), DOCX, XLSX, MD                  | `router.py`                                                                         |
| `tournesol/`   | Proxy API Tournesol (contournement CORS)                    | `router.py`                                                                         |
| `history/`     | Historique paginé + recherche sémantique                    | `router.py`                                                                         |
| `admin/`       | Stats, users, backup, logs                                  | `router.py`                                                                         |
| `tts/`         | Text-to-speech (ElevenLabs)                                 | `router.py`                                                                         |
| `voice/`       | Voice chat                                                  | `router.py`                                                                         |
| `middleware/`  | Rate limiting, CORS, request logging                        | —                                                                                   |
| `services/`    | Services partagés (email, notifications)                    | —                                                                                   |

## Conventions obligatoires

- **Toujours async** : `async def` + `await` pour tout I/O
- **Type hints** : tous paramètres et retours typés
- **Pydantic v2** : `BaseModel` pour tous les schémas requête/réponse
- **httpx** (pas `requests`) pour les appels HTTP
- **logger** structuré (`from core.logging import ...`) — jamais `print()`
- **Secrets** : tout via `core/config.py` → `settings.XXX`, jamais hardcodé

## Auth pattern

```python
from auth.dependencies import get_current_user, require_plan
# Route protégée
@router.get("/endpoint")
async def my_endpoint(user: User = Depends(get_current_user)):
    ...
# Route nécessitant un plan minimum
@router.get("/pro-endpoint")
async def pro_endpoint(user: User = Depends(require_plan("pro"))):
    ...
```

## Auth JWT — TTLs & blocklist (Sprint C, 2026-05-21)

| Aspect | Valeur | Override env |
|---|---|---|
| Access token TTL | **60 min** | `ACCESS_TOKEN_TTL_MIN` |
| Refresh token TTL | **30 jours** | `REFRESH_TOKEN_TTL_DAYS` |
| Lib JWT | `PyJWT[crypto]` (Wave 1 Step 5, 2026-05-21 — migrée depuis python-jose pour CVE-2024-33664 + CVE-2024-33663) | — |
| Blocklist | Redis `auth:blocklist:{sha256(token)[:32]}` avec TTL=exp | `REDIS_URL` (fallback in-RAM si absent) |

Avant Sprint C : 7 j / 365 j + blocklist in-RAM (perdue à chaque `docker run`).
Pour révoquer un token côté code : `await blacklist_token(token, expiry_seconds=...)`.
Pour vérifier : `await is_token_blacklisted(token)` — fail-open + audit log
(`audit_logs.action="auth_blocklist_fail_open"`) si Redis indispo.

Cf. audit complet : `01-Projects/DeepSight/Sessions/2026-05-21-audit-auth-sprint-c.md`.

## Feature gating (SSOT)

```python
from core.plan_limits import is_feature_available
# Vérifier si un user peut utiliser une feature
if not is_feature_available(user.plan, "web_search", platform="web"):
    raise HTTPException(403, "Upgrade required")
```

## DB session pattern

```python
from db.database import get_db
@router.get("/endpoint")
async def my_endpoint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Summary).where(...))
```

## Tests

`pytest` avec `pytest-asyncio`. Fixtures dans `backend/tests/conftest.py`.
Commande : `cd backend && python -m pytest tests/ -v`

## Déploiement

Push → SSH VPS → `cd /opt/deepsight/repo && git pull` → rebuild Docker si besoin.
Dockerfile : `deploy/hetzner/Dockerfile`.
