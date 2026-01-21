# Fix Google OAuth pour Mobile - Instructions Backend

## Problème Actuel

Le backend reçoit le `redirect_uri` mobile (ex: `exp://192.168.1.x:8081/--/auth/callback`) mais après le callback Google, il retourne une page HTML au lieu de rediriger vers l'app mobile avec les tokens.

## Solution

Modifier le endpoint `/api/auth/google/callback` (GET) pour:
1. Vérifier si la requête vient d'un mobile (via le paramètre `state`)
2. Si oui, rediriger vers le `redirect_uri` mobile avec les tokens

## Code à Ajouter

### 1. Modifier `/api/auth/google/login` (GET)

Encoder le `redirect_uri` mobile dans le paramètre `state`:

```python
import json
import base64
from urllib.parse import urlencode

@router.get("/auth/google/login")
async def google_login(redirect_uri: str = None, platform: str = None):
    # Créer le state avec les infos de redirection
    state_data = {
        "random": secrets.token_urlsafe(16),
        "redirect_uri": redirect_uri,
        "platform": platform
    }
    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()

    # Construire l'URL Google OAuth
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/api/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account"
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"auth_url": auth_url}
```

### 2. Modifier `/api/auth/google/callback` (GET)

Décoder le `state` et rediriger vers mobile si nécessaire:

```python
from fastapi.responses import RedirectResponse
import json
import base64

@router.get("/auth/google/callback")
async def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    # Décoder le state
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state).decode())
        mobile_redirect_uri = state_data.get("redirect_uri")
        platform = state_data.get("platform")
    except:
        mobile_redirect_uri = None
        platform = None

    try:
        # Échanger le code contre des tokens Google
        token_response = await exchange_code_for_tokens(code)

        # Obtenir les infos utilisateur de Google
        user_info = await get_google_user_info(token_response["access_token"])

        # Créer ou trouver l'utilisateur
        user = await get_or_create_user(db, user_info)

        # Générer les tokens de session
        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        # Si c'est une requête mobile, rediriger avec les tokens
        if platform == "mobile" and mobile_redirect_uri:
            redirect_url = f"{mobile_redirect_uri}?access_token={access_token}&refresh_token={refresh_token}"
            return RedirectResponse(url=redirect_url)

        # Sinon, comportement web normal (stocker dans cookie/session et rediriger vers frontend)
        # ... votre code web existant ...

    except Exception as e:
        if platform == "mobile" and mobile_redirect_uri:
            return RedirectResponse(url=f"{mobile_redirect_uri}?error={str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
```

## Résumé des Changements

1. **`/api/auth/google/login`**: Encoder `redirect_uri` et `platform` dans le `state`
2. **`/api/auth/google/callback`**: Décoder le `state` et rediriger vers mobile avec tokens

## Test

Après modification, testez avec:
```bash
curl "https://your-backend/api/auth/google/login?redirect_uri=exp://test&platform=mobile"
```

Puis suivez le flux OAuth. Le callback devrait rediriger vers `exp://test?access_token=xxx&refresh_token=xxx`
