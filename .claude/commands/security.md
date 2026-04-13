---
description: "Règles de sécurité transversales DeepSight : JWT, CORS, secrets, Stripe webhooks, CSP, validation d'entrées, rate limiting."
---

# Sécurité DeepSight — Règles Transversales

## Principe fondamental

**Zero Trust côté client.** Tout ce qui vient du client (browser, app mobile, extension) est considéré non fiable. La vérification des droits, des plans, et des données se fait TOUJOURS côté backend.

---

## 1. JWT — Authentification

### Configuration sécurisée

```python
# app/auth/jwt.py
from datetime import datetime, timedelta, timezone
import jwt
import os

JWT_SECRET = os.environ["SECRET_KEY"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
REFRESH_TOKEN_EXPIRE = timedelta(days=30)

def create_access_token(user_id: str, plan: str) -> str:
    payload = {
        "sub": user_id, "plan": plan, "type": "access",
        "exp": datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
```

### Stockage par plateforme

- Web → httpOnly cookie (pas localStorage — XSS-proof)
- Mobile (Expo) → expo-secure-store (chiffré par l'OS)
- Extension Chrome → chrome.storage.local (jamais localStorage)

---

## 2. CORS — Configuration stricte

```python
ALLOWED_ORIGINS = [o.strip() for o in os.environ["CORS_ORIGINS"].split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=3600,
)
```

**Règle :** `allow_origins=["*"]` est interdit en production.

---

## 3. Secrets — Gestion

- **Jamais de secret dans le code** — uniquement dans les variables d'env
- **Jamais dans les logs** — masquer les tokens, clés, mots de passe
- **Rotation après exposition** — révoquer immédiatement si exposé
- **`.env` dans `.gitignore`**

---

## 4. Stripe Webhooks — Vérification signature

```python
@router.post("/api/v1/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.environ["STRIPE_WEBHOOK_SECRET"]
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    await process_stripe_event(event)
    return {"status": "ok"}
```

Idempotence via Redis : `stripe_event:{event_id}` avec TTL 7 jours.

---

## 5. Validation des entrées — Pydantic

```python
class AnalysisCreateRequest(BaseModel):
    video_url: HttpUrl
    mode: str = Field(default="standard", pattern="^(accessible|standard|expert)$")
    language: str = Field(default="fr", pattern="^(fr|en|es|de|it)$")
```

---

## 6. Rate Limiting

Limites par plan (requêtes/minute) : decouverte=10, etudiant=30, starter=60, pro=120, equipe=300.
Implémenté via Redis avec fenêtre glissante 1 min.

---

## 7. CSP Extension Chrome

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://api.deepsightsynthesis.com https://eu.posthog.com"
}
```

Interdit en MV3 : `eval()`, scripts inline, `unsafe-inline`.

---

## 8. Checklist sécurité avant déploiement

### Backend

- SECRET_KEY >= 32 bytes aléatoires
- CORS_ORIGINS liste uniquement les domaines production
- Webhook Stripe vérifie la signature
- Endpoints sensibles protégés par `Depends(get_current_user)`
- `is_feature_available()` côté backend (jamais uniquement client)
- Rate limiting actif
- Validation Pydantic sur toutes les entrées

### Frontend

- Tokens en httpOnly cookie (pas localStorage)
- Variables `NEXT_PUBLIC_*` sans secret

### Extension Chrome

- Tokens dans `chrome.storage.local`
- CSP dans manifest.json
- Fetch backend depuis service worker uniquement

### Mobile

- Tokens dans `expo-secure-store`
- Variables sensibles dans `.env` non commité
