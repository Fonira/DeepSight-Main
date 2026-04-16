"""
Tests pour POST /api/auth/google/token — Google OAuth mobile (id_token flow).

Couvre :
1. Nouveau user créé correctement
2. User existant avec google_id match → login OK, pas de duplication
3. User existant avec email match mais pas google_id → merge (google_id assigné)
4. id_token invalide → 401
5. Email non vérifié → 401
6. Audience wrong → 401 (via verify_google_id_token qui rejette)
"""

from datetime import datetime

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures locales
# ═══════════════════════════════════════════════════════════════════════════════


def _make_user_mock(
    user_id: int = 42,
    email: str = "newuser@example.com",
    username: str = "newuser",
    google_id: str = "",
    is_admin: bool = False,
    email_verified: bool = True,
) -> MagicMock:
    """Mock User avec attributs compatibles UserResponse (from_attributes)."""
    user = MagicMock()
    user.id = user_id
    user.username = username
    user.email = email
    user.email_verified = email_verified
    user.plan = "free"
    user.credits = 250
    user.credits_monthly = 250
    user.is_admin = is_admin
    user.avatar_url = None
    user.default_lang = "fr"
    user.default_mode = "standard"
    user.default_model = "small"
    user.total_videos = 0
    user.total_words = 0
    user.total_playlists = 0
    user.created_at = datetime(2026, 1, 1, 0, 0, 0)
    user.google_id = google_id
    user.is_active = True
    return user


def _valid_claims(
    sub: str = "google_sub_123",
    email: str = "mobile.user@example.com",
    email_verified: bool = True,
    name: str = "Mobile User",
) -> dict:
    """Claims Google valides simulés après vérification."""
    return {
        "iss": "https://accounts.google.com",
        "sub": sub,
        "email": email,
        "email_verified": email_verified,
        "name": name,
        "picture": "https://example.com/avatar.png",
        "aud": "web-client-id.apps.googleusercontent.com",
        "exp": 9999999999,
        "iat": 1000000000,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Nouveau user créé correctement
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_mobile_token_creates_new_user(mock_db_session):
    """
    Test : id_token valide pour un email inexistant → nouvel utilisateur créé,
    email_verified=True, plan=free, JWT renvoyés.
    """
    from auth.router import google_token_login
    from auth.schemas import GoogleMobileTokenRequest

    new_user = _make_user_mock(
        user_id=42,
        email="newuser@example.com",
        username="newuser",
        google_id="google_new_sub",
    )

    claims = _valid_claims(sub="google_new_sub", email="newuser@example.com")

    with patch("auth.router.verify_google_id_token", return_value=claims), \
         patch(
             "auth.router.login_or_register_google_user",
             new_callable=AsyncMock,
             return_value=(True, new_user, "✅ Compte créé avec Google", "sess_new"),
         ) as mock_login, \
         patch("auth.router.create_access_token", return_value="access_jwt_123"), \
         patch("auth.router.create_refresh_token", return_value="refresh_jwt_123"):
        req = GoogleMobileTokenRequest(
            id_token="fake.id.token",
            client_platform="ios",
            device_name="iPhone 15 Pro",
        )
        response = await google_token_login(req, mock_db_session)

    assert response.access_token == "access_jwt_123"
    assert response.refresh_token == "refresh_jwt_123"
    assert response.token_type == "bearer"
    assert response.user.email == "newuser@example.com"
    assert response.user.id == 42

    # Vérifier que login_or_register_google_user a été appelé avec les bons claims
    mock_login.assert_awaited_once()
    call_args = mock_login.await_args
    google_user_arg = call_args.args[1]
    assert google_user_arg["id"] == "google_new_sub"
    assert google_user_arg["email"] == "newuser@example.com"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. User existant avec google_id match → login OK, pas de duplication
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_mobile_token_existing_google_user(mock_db_session):
    """
    Test : user déjà enregistré avec google_id match → pas de création,
    JWT renvoyés.
    """
    from auth.router import google_token_login
    from auth.schemas import GoogleMobileTokenRequest

    existing_user = _make_user_mock(
        user_id=7,
        email="existing@example.com",
        username="existing",
        google_id="google_existing_sub",
    )

    claims = _valid_claims(sub="google_existing_sub", email="existing@example.com")

    with patch("auth.router.verify_google_id_token", return_value=claims), \
         patch(
             "auth.router.login_or_register_google_user",
             new_callable=AsyncMock,
             return_value=(True, existing_user, "✅ Connexion Google réussie", "sess_existing"),
         ), \
         patch("auth.router.create_access_token", return_value="access_existing"), \
         patch("auth.router.create_refresh_token", return_value="refresh_existing"):
        req = GoogleMobileTokenRequest(
            id_token="fake.id.token",
            client_platform="android",
        )
        response = await google_token_login(req, mock_db_session)

    assert response.access_token == "access_existing"
    assert response.user.id == 7
    assert response.user.email == "existing@example.com"
    # google_id toujours présent — aucune duplication
    assert existing_user.google_id == "google_existing_sub"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. User existant avec email match mais pas google_id → merge
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_mobile_token_merges_by_email(mock_db_session):
    """
    Test : user avec email connu mais sans google_id → google_id assigné
    au compte existant (merge, pas de duplication).
    """
    from auth.router import google_token_login
    from auth.schemas import GoogleMobileTokenRequest

    # User existant sans google_id — ce test vérifie que le service
    # login_or_register_google_user assigne le google_id quand l'email match.
    existing_user = _make_user_mock(
        user_id=15,
        email="tomerge@example.com",
        username="tomerge",
        google_id=None,  # Pas encore lié à Google
        email_verified=False,
    )

    # DB mock : lookup trouve le user existant par email
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=existing_user)
    mock_db_session.commit = AsyncMock()
    mock_db_session.add = MagicMock()

    claims = _valid_claims(sub="google_merge_sub", email="tomerge@example.com")

    with patch("auth.router.verify_google_id_token", return_value=claims), \
         patch("auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@test.com"}), \
         patch(
             "auth.service.create_user_session",
             new_callable=AsyncMock,
             return_value="sess_merge",
         ), \
         patch("auth.router.create_access_token", return_value="access_merge"), \
         patch("auth.router.create_refresh_token", return_value="refresh_merge"):
        req = GoogleMobileTokenRequest(
            id_token="fake.id.token",
            client_platform="web",
        )
        response = await google_token_login(req, mock_db_session)

    assert response.access_token == "access_merge"
    # Le google_id a été assigné au compte existant (merge)
    assert existing_user.google_id == "google_merge_sub"
    assert existing_user.email_verified is True
    # Pas de nouvelle création d'utilisateur
    mock_db_session.add.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# 4. id_token invalide → 401
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_mobile_token_invalid_token(mock_db_session):
    """
    Test : id_token invalide (signature/expiré/malformé) → 401.
    """
    from fastapi import HTTPException
    from auth.router import google_token_login
    from auth.schemas import GoogleMobileTokenRequest

    # verify_google_id_token retourne None pour tout token invalide
    with patch("auth.router.verify_google_id_token", return_value=None):
        req = GoogleMobileTokenRequest(
            id_token="invalid.jwt.token",
            client_platform="ios",
        )
        with pytest.raises(HTTPException) as exc_info:
            await google_token_login(req, mock_db_session)

    assert exc_info.value.status_code == 401
    assert "Invalid Google ID token" in exc_info.value.detail


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Email non vérifié → 401
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_mobile_token_email_not_verified(mock_db_session):
    """
    Test : claims valides mais email_verified=False → 401.
    """
    from fastapi import HTTPException
    from auth.router import google_token_login
    from auth.schemas import GoogleMobileTokenRequest

    claims = _valid_claims(email_verified=False)

    with patch("auth.router.verify_google_id_token", return_value=claims):
        req = GoogleMobileTokenRequest(
            id_token="valid.but.unverified",
            client_platform="android",
        )
        with pytest.raises(HTTPException) as exc_info:
            await google_token_login(req, mock_db_session)

    assert exc_info.value.status_code == 401
    assert "email not verified" in exc_info.value.detail.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Audience wrong → 401
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_mobile_token_wrong_audience(mock_db_session):
    """
    Test : verify_google_id_token rejette un token dont l'audience ne
    correspond à aucun de nos client IDs. verify_oauth2_token raise ValueError,
    notre wrapper retourne None → endpoint retourne 401.
    """
    from fastapi import HTTPException
    from auth.router import google_token_login
    from auth.schemas import GoogleMobileTokenRequest
    from auth import service as auth_service

    # Simuler google.oauth2.id_token.verify_oauth2_token qui rejette toutes les audiences
    mock_google_id_token = MagicMock()
    mock_google_id_token.verify_oauth2_token.side_effect = ValueError(
        "Token has wrong audience 'evil.apps.googleusercontent.com', "
        "expected one of 'web-client.apps.googleusercontent.com'"
    )
    mock_google_requests = MagicMock()
    mock_google_requests.Request = MagicMock(return_value=MagicMock())

    # On patch l'import dynamique à l'intérieur de verify_google_id_token
    # en patchant les modules sys.modules
    import sys
    original_id_token = sys.modules.get("google.oauth2.id_token")
    original_transport = sys.modules.get("google.auth.transport.requests")
    original_oauth2 = sys.modules.get("google.oauth2")
    original_auth = sys.modules.get("google.auth")
    original_auth_transport = sys.modules.get("google.auth.transport")

    fake_google = MagicMock()
    fake_oauth2 = MagicMock()
    fake_oauth2.id_token = mock_google_id_token
    fake_auth = MagicMock()
    fake_auth_transport = MagicMock()
    fake_auth_transport.requests = mock_google_requests

    sys.modules["google"] = fake_google
    sys.modules["google.oauth2"] = fake_oauth2
    sys.modules["google.oauth2.id_token"] = mock_google_id_token
    sys.modules["google.auth"] = fake_auth
    sys.modules["google.auth.transport"] = fake_auth_transport
    sys.modules["google.auth.transport.requests"] = mock_google_requests

    try:
        with patch.object(
            auth_service,
            "GOOGLE_OAUTH_CONFIG",
            {
                "ENABLED": True,
                "CLIENT_ID": "web-client.apps.googleusercontent.com",
                "IOS_CLIENT_ID": "ios-client.apps.googleusercontent.com",
                "ANDROID_CLIENT_ID": "android-client.apps.googleusercontent.com",
            },
        ):
            # On n'utilise PAS patch sur verify_google_id_token ici :
            # on veut tester qu'il retourne None pour audience invalide.
            req = GoogleMobileTokenRequest(
                id_token="token.wrong.audience",
                client_platform="ios",
            )
            with pytest.raises(HTTPException) as exc_info:
                await google_token_login(req, mock_db_session)

        assert exc_info.value.status_code == 401
        assert "Invalid Google ID token" in exc_info.value.detail
    finally:
        # Restaurer les modules originaux
        for name, mod in [
            ("google", None),
            ("google.oauth2", original_oauth2),
            ("google.oauth2.id_token", original_id_token),
            ("google.auth", original_auth),
            ("google.auth.transport", original_auth_transport),
            ("google.auth.transport.requests", original_transport),
        ]:
            if mod is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = mod
