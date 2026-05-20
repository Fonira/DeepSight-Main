"""
Tests pour POST /api/auth/apple/token — Sign in with Apple (id_token flow).

Couvre :
1. Nouveau user créé correctement (first sign-in avec email + full_name)
2. User existant avec apple_sub match → login OK, pas de duplication
3. User existant avec email match mais pas apple_sub → merge (apple_sub assigné)
4. id_token invalide → 401
5. Apple OAuth desactive → 400
6. Apple sub manquant dans claims → 401
7. Login subsequent sans email (Apple n'envoie email qu'au premier sign-in)
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
    apple_sub: str = "",
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
    user.apple_sub = apple_sub
    user.google_id = google_id
    user.is_active = True
    return user


def _valid_apple_claims(
    sub: str = "001234.abc.5678",
    email: str = "tim@privaterelay.appleid.com",
    email_verified: bool = True,
) -> dict:
    """Claims Apple valides simulés après vérification."""
    return {
        "iss": "https://appleid.apple.com",
        "sub": sub,
        "email": email,
        "email_verified": email_verified,
        "is_private_email": email.endswith("@privaterelay.appleid.com"),
        "aud": "com.deepsightsynthesis.signin",
        "exp": 9999999999,
        "iat": 1000000000,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Nouveau user créé correctement (first sign-in)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_creates_new_user(mock_db_session):
    """
    Test : id_token valide pour un apple_sub inexistant + email/name fournis (first
    sign-in) → nouvel utilisateur créé, plan=free, JWT renvoyés.
    """
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    new_user = _make_user_mock(
        user_id=42,
        email="tim@example.com",
        username="tim",
        apple_sub="001234.abc.5678",
    )
    claims = _valid_apple_claims(sub="001234.abc.5678", email="tim@example.com")

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": True, "CLIENT_ID": "com.deepsightsynthesis.signin"},
    ), patch(
        "auth.router.verify_apple_id_token",
        new_callable=AsyncMock,
        return_value=claims,
    ), patch(
        "auth.router.login_or_register_apple_user",
        new_callable=AsyncMock,
        return_value=(True, new_user, "✅ Compte créé avec Apple", "sess_new"),
    ) as mock_login, patch(
        "auth.router.create_access_token", return_value="access_jwt_apple"
    ), patch(
        "auth.router.create_refresh_token", return_value="refresh_jwt_apple"
    ):
        req = AppleMobileTokenRequest(
            id_token="fake.apple.idtoken",
            client_platform="ios",
            email="tim@example.com",
            full_name="Tim Cook",
            device_name="iPhone 15 Pro",
        )
        response = await apple_token_login(req, mock_db_session)

    assert response.access_token == "access_jwt_apple"
    assert response.refresh_token == "refresh_jwt_apple"
    assert response.token_type == "bearer"
    assert response.user.email == "tim@example.com"
    assert response.user.id == 42

    mock_login.assert_awaited_once()
    call_kwargs = mock_login.await_args.kwargs
    assert call_kwargs["apple_sub"] == "001234.abc.5678"
    assert call_kwargs["email"] == "tim@example.com"
    assert call_kwargs["full_name"] == "Tim Cook"
    assert call_kwargs["auto_create"] is True


# ═══════════════════════════════════════════════════════════════════════════════
# 2. User existant avec apple_sub match → login OK, pas de duplication
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_existing_user_by_sub(mock_db_session):
    """
    Test : user déjà enregistré avec apple_sub match → pas de création,
    JWT renvoyés, comportement idempotent.
    """
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    existing_user = _make_user_mock(
        user_id=7,
        email="existing@example.com",
        username="existing",
        apple_sub="001234.existing.0000",
    )
    claims = _valid_apple_claims(sub="001234.existing.0000", email="existing@example.com")

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": True, "CLIENT_ID": "com.deepsightsynthesis.signin"},
    ), patch(
        "auth.router.verify_apple_id_token",
        new_callable=AsyncMock,
        return_value=claims,
    ), patch(
        "auth.router.login_or_register_apple_user",
        new_callable=AsyncMock,
        return_value=(True, existing_user, "✅ Connexion Apple réussie", "sess_existing"),
    ), patch(
        "auth.router.create_access_token", return_value="access_existing_apple"
    ), patch(
        "auth.router.create_refresh_token", return_value="refresh_existing_apple"
    ):
        req = AppleMobileTokenRequest(
            id_token="fake.apple.idtoken",
            client_platform="ios",
        )
        response = await apple_token_login(req, mock_db_session)

    assert response.access_token == "access_existing_apple"
    assert response.user.id == 7
    assert existing_user.apple_sub == "001234.existing.0000"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. User existant par email mais pas par apple_sub → merge
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_merges_existing_email_account(mock_db_session):
    """
    Test : user existant par email (créé via Google ou email/password) sans
    apple_sub → apple_sub assigné au compte existant, pas de duplication.
    """
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    existing_user = _make_user_mock(
        user_id=15,
        email="mergedup@example.com",
        username="mergedup",
        apple_sub=None,
        google_id="google_existing",
        email_verified=True,
    )

    # Le service login_or_register_apple_user va appeler session.execute deux fois :
    # (1) lookup par apple_sub → None, (2) lookup par email → existing_user
    sub_lookup = MagicMock()
    sub_lookup.scalar_one_or_none = MagicMock(return_value=None)
    email_lookup = MagicMock()
    email_lookup.scalar_one_or_none = MagicMock(return_value=existing_user)
    mock_db_session.execute = AsyncMock(side_effect=[sub_lookup, email_lookup, sub_lookup])
    mock_db_session.commit = AsyncMock()
    mock_db_session.add = MagicMock()

    claims = _valid_apple_claims(sub="001234.merge.aaaa", email="mergedup@example.com")

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": True, "CLIENT_ID": "com.deepsightsynthesis.signin"},
    ), patch(
        "auth.router.verify_apple_id_token",
        new_callable=AsyncMock,
        return_value=claims,
    ), patch(
        "auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@test.com"}
    ), patch(
        "auth.service.create_user_session",
        new_callable=AsyncMock,
        return_value="sess_merge_apple",
    ), patch(
        "auth.router.create_access_token", return_value="access_merge_apple"
    ), patch(
        "auth.router.create_refresh_token", return_value="refresh_merge_apple"
    ):
        req = AppleMobileTokenRequest(
            id_token="fake.apple.idtoken",
            client_platform="web",
        )
        response = await apple_token_login(req, mock_db_session)

    assert response.access_token == "access_merge_apple"
    assert existing_user.apple_sub == "001234.merge.aaaa"
    # Pas de création
    mock_db_session.add.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# 4. id_token invalide → 401
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_invalid_token(mock_db_session):
    """
    Test : id_token invalide (signature/expiré/malformé) → 401.
    """
    from fastapi import HTTPException
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": True, "CLIENT_ID": "com.deepsightsynthesis.signin"},
    ), patch(
        "auth.router.verify_apple_id_token",
        new_callable=AsyncMock,
        return_value=None,
    ):
        req = AppleMobileTokenRequest(
            id_token="invalid.apple.token",
            client_platform="ios",
        )
        with pytest.raises(HTTPException) as exc_info:
            await apple_token_login(req, mock_db_session)

    assert exc_info.value.status_code == 401
    assert "Invalid Apple ID token" in exc_info.value.detail


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Apple OAuth désactivé → 400
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_disabled(mock_db_session):
    """
    Test : si APPLE_OAUTH_ENABLED=false → 400 avant verification.
    """
    from fastapi import HTTPException
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": False, "CLIENT_ID": ""},
    ):
        req = AppleMobileTokenRequest(
            id_token="any.token.here",
            client_platform="ios",
        )
        with pytest.raises(HTTPException) as exc_info:
            await apple_token_login(req, mock_db_session)

    assert exc_info.value.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Sub manquant dans claims → 401
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_missing_sub_claim(mock_db_session):
    """
    Test : id_token verifié mais 'sub' absent des claims → 401.
    """
    from fastapi import HTTPException
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    broken_claims = _valid_apple_claims()
    broken_claims.pop("sub")

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": True, "CLIENT_ID": "com.deepsightsynthesis.signin"},
    ), patch(
        "auth.router.verify_apple_id_token",
        new_callable=AsyncMock,
        return_value=broken_claims,
    ):
        req = AppleMobileTokenRequest(
            id_token="valid.but.broken",
            client_platform="ios",
        )
        with pytest.raises(HTTPException) as exc_info:
            await apple_token_login(req, mock_db_session)

    assert exc_info.value.status_code == 401
    assert "payload" in exc_info.value.detail.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Login subsequent sans email (Apple ne renvoie email qu'au 1er sign-in)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_apple_token_subsequent_login_no_email(mock_db_session):
    """
    Test : Apple ne renvoie email QUE sur le premier sign-in. Les logins
    subsequents arrivent avec claims sans email — le lookup doit fonctionner par
    apple_sub seul.
    """
    from auth.router import apple_token_login
    from auth.schemas import AppleMobileTokenRequest

    existing_user = _make_user_mock(
        user_id=99,
        email="returning@example.com",
        username="returning",
        apple_sub="001234.returning.zzzz",
    )

    # Claims sans email (login subsequent)
    claims_no_email = {
        "iss": "https://appleid.apple.com",
        "sub": "001234.returning.zzzz",
        "aud": "com.deepsightsynthesis.signin",
        "exp": 9999999999,
    }

    with patch(
        "auth.router.APPLE_OAUTH_CONFIG",
        {"ENABLED": True, "CLIENT_ID": "com.deepsightsynthesis.signin"},
    ), patch(
        "auth.router.verify_apple_id_token",
        new_callable=AsyncMock,
        return_value=claims_no_email,
    ), patch(
        "auth.router.login_or_register_apple_user",
        new_callable=AsyncMock,
        return_value=(True, existing_user, "✅ Connexion Apple réussie", "sess_returning"),
    ) as mock_login, patch(
        "auth.router.create_access_token", return_value="access_returning"
    ), patch(
        "auth.router.create_refresh_token", return_value="refresh_returning"
    ):
        req = AppleMobileTokenRequest(
            id_token="fake.apple.token",
            client_platform="ios",
            # PAS d'email/full_name (Apple ne les fournit pas en login subsequent)
        )
        response = await apple_token_login(req, mock_db_session)

    assert response.access_token == "access_returning"
    assert response.user.id == 99
    # Vérifier que le service a été appelé avec email=None — le lookup par sub seul doit suffire
    call_kwargs = mock_login.await_args.kwargs
    assert call_kwargs["apple_sub"] == "001234.returning.zzzz"
    assert call_kwargs["email"] is None
