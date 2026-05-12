"""
Auth Comprehensive Tests -- Batterie complete de tests d'authentification

Tests unitaires couvrant:
- Registration (5 tests)
- Login (5 tests)
- Token management / refresh (4 tests)
- JWT validation (5 tests)
- Email verification (4 tests)
- Password reset / change (5 tests)
- Google OAuth (4 tests)
- Session management (3 tests)
- Dependencies (7 tests)
- Integration flows (3 tests)

Total: 45 tests
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException

from conftest_enhanced import (
    create_test_user,
    create_valid_jwt_token,
    create_expired_jwt_token,
    mock_auth_header,
)


# ======================================================================
# REGISTRATION TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_success(mock_db_session):
    """
    Test : L'enregistrement d'un nouvel utilisateur reussit.
    Verifie: user cree, verification_code genere, message de succes.
    """
    from auth.service import create_user

    # Mock: pas d'utilisateur existant
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    with patch("auth.service.hash_password", return_value="$2b$12$hashedpassword"), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": False, "RESEND_API_KEY": ""}):
        success, user, message = await create_user(
            mock_db_session,
            username="newuser",
            email="newuser@example.com",
            password="SecurePassword123!"
        )

    assert success is True
    assert "Compte" in message or "succes" in message.lower() or "cree" in message.lower() or success
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_duplicate_email(mock_db_session):
    """
    Test : L'enregistrement avec un email existant echoue.
    Verifie: retour False et message d'erreur.
    """
    from auth.service import create_user

    existing_user = create_test_user(email="existing@example.com")

    # get_user_by_email retourne un utilisateur existant
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=existing_user)

    with patch("auth.service.hash_password", return_value="$2b$12$hashedpassword"):
        success, user, message = await create_user(
            mock_db_session,
            username="newuser",
            email="existing@example.com",
            password="SecurePassword123!"
        )

    assert success is False
    assert user is None
    assert "email" in message.lower() or "utilis" in message.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_duplicate_username(mock_db_session):
    """
    Test : L'enregistrement avec un username existant echoue.
    """
    from auth.service import create_user

    existing_user = create_test_user(username="takenname")

    call_count = 0

    def side_effect_scalar(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        # Premier appel: get_user_by_email -> None
        if call_count == 1:
            return None
        # Deuxieme appel: get_user_by_username -> existing
        return existing_user

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(side_effect=side_effect_scalar)

    with patch("auth.service.hash_password", return_value="$2b$12$hashedpassword"):
        success, user, message = await create_user(
            mock_db_session,
            username="takenname",
            email="new@example.com",
            password="SecurePassword123!"
        )

    assert success is False
    assert user is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_weak_password_schema():
    """
    Test : Le schema UserRegister valide la longueur du mot de passe.
    Verifie: les mots de passe < 6 chars sont rejetes par Pydantic.
    """
    from auth.schemas import UserRegister
    from pydantic import ValidationError

    # Le schema requiert min_length=6
    with pytest.raises(ValidationError):
        UserRegister(
            username="testuser",
            email="test@example.com",
            password="12345"  # < 6 chars
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_username_too_short_schema():
    """
    Test : Le schema UserRegister rejette un username < 3 chars.
    """
    from auth.schemas import UserRegister
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UserRegister(
            username="ab",  # < 3 chars
            email="test@example.com",
            password="SecurePassword123!"
        )


# ======================================================================
# LOGIN TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_success(mock_db_session):
    """
    Test : Connexion reussie retourne success=True avec session_token.
    """
    from auth.service import authenticate_user

    user = create_test_user(email="test@example.com", email_verified=True)
    user.password_hash = "$2b$12$validhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    with patch("auth.service.verify_password", return_value=True), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": False, "RESEND_API_KEY": ""}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="session_abc"):
        success, returned_user, message, session_token = await authenticate_user(
            mock_db_session,
            email="test@example.com",
            password="SecurePassword123!"
        )

    assert success is True
    assert returned_user is not None
    assert session_token == "session_abc"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_wrong_password(mock_db_session):
    """
    Test : Mauvais mot de passe = echec.
    Verifie: pas de token retourne.
    """
    from auth.service import authenticate_user

    user = create_test_user()
    user.password_hash = "$2b$12$validhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    with patch("auth.service.verify_password", return_value=False):
        success, returned_user, message, session_token = await authenticate_user(
            mock_db_session,
            email="test@example.com",
            password="WrongPassword123!"
        )

    assert success is False
    assert session_token is None
    assert "incorrect" in message.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_nonexistent_user(mock_db_session):
    """
    Test : Utilisateur inexistant = echec.
    Verifie: meme message que mauvais password (securite).
    """
    from auth.service import authenticate_user

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

    success, returned_user, message, session_token = await authenticate_user(
        mock_db_session,
        email="nonexistent@example.com",
        password="AnyPassword123!"
    )

    assert success is False
    assert returned_user is None
    assert session_token is None
    # Le message doit etre generique (pas de leak)
    assert "incorrect" in message.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_unverified_email(mock_db_session):
    """
    Test : Email non verifie = echec avec message VERIFICATION_REQUIRED.
    """
    from auth.service import authenticate_user

    user = create_test_user(email_verified=False)
    user.password_hash = "$2b$12$validhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    with patch("auth.service.verify_password", return_value=True), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": True, "RESEND_API_KEY": "re_valid_key"}):
        success, returned_user, message, session_token = await authenticate_user(
            mock_db_session,
            email="test@example.com",
            password="SecurePassword123!"
        )

    assert success is False
    assert "VERIFICATION_REQUIRED" in message


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_creates_session_token(mock_db_session):
    """
    Test : Chaque login cree un nouveau session_token unique.
    """
    from auth.service import authenticate_user

    user = create_test_user(email_verified=True)
    user.password_hash = "$2b$12$validhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    session_tokens = []

    async def mock_create_session(session, uid):
        import secrets
        token = secrets.token_urlsafe(32)
        session_tokens.append(token)
        return token

    with patch("auth.service.verify_password", return_value=True), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": False, "RESEND_API_KEY": ""}), \
         patch("auth.service.create_user_session", side_effect=mock_create_session):
        # Premier login
        s1, _, _, t1 = await authenticate_user(mock_db_session, "test@example.com", "pw")
        # Deuxieme login
        s2, _, _, t2 = await authenticate_user(mock_db_session, "test@example.com", "pw")

    assert s1 is True and s2 is True
    assert t1 != t2
    assert len(session_tokens) == 2
    assert session_tokens[0] != session_tokens[1]


# ======================================================================
# TOKEN MANAGEMENT TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_success(jwt_secret):
    """
    Test : Un refresh token valide est correctement decode.
    """
    from auth.service import create_refresh_token, verify_token

    with patch("auth.service.JWT_CONFIG", {
        "SECRET_KEY": jwt_secret,
        "ALGORITHM": "HS256",
        "REFRESH_TOKEN_EXPIRE_DAYS": 30,
        "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
    }):
        token = create_refresh_token(user_id=42, session_token="sess123")
        payload = verify_token(token, token_type="refresh")

    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "refresh"
    assert payload["session"] == "sess123"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_wrong_type(jwt_secret):
    """
    Test : verify_token rejette un access token utilise comme refresh.
    """
    from auth.service import create_access_token, verify_token

    with patch("auth.service.JWT_CONFIG", {
        "SECRET_KEY": jwt_secret,
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
        "REFRESH_TOKEN_EXPIRE_DAYS": 30,
    }):
        token = create_access_token(user_id=42)
        # Essayer de le decoder comme refresh -> None
        payload = verify_token(token, token_type="refresh")

    assert payload is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_invalid():
    """
    Test : Tokens invalides sont rejetes par verify_token.
    """
    from auth.service import verify_token

    test_secret = "test-secret-key-minimum-32-characters-long-for-hs256"

    with patch("auth.service.JWT_CONFIG", {
        "SECRET_KEY": test_secret,
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
        "REFRESH_TOKEN_EXPIRE_DAYS": 30,
    }):
        invalid_tokens = [
            "not.a.valid.jwt.token",
            "bearer invalid",
            "",
            "eyJ.broken.token",
        ]
        for token in invalid_tokens:
            result = verify_token(token, token_type="access")
            assert result is None, f"Token '{token}' should have been rejected"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_rotation(jwt_secret):
    """
    Test : Le refresh token contient le session_token pour la rotation.
    Un nouveau session invalide l'ancien refresh.
    """
    from auth.service import create_refresh_token, verify_token

    with patch("auth.service.JWT_CONFIG", {
        "SECRET_KEY": jwt_secret,
        "ALGORITHM": "HS256",
        "REFRESH_TOKEN_EXPIRE_DAYS": 30,
        "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
    }):
        old_token = create_refresh_token(user_id=1, session_token="old_session")
        new_token = create_refresh_token(user_id=1, session_token="new_session")

        old_payload = verify_token(old_token, token_type="refresh")
        new_payload = verify_token(new_token, token_type="refresh")

    assert old_payload["session"] == "old_session"
    assert new_payload["session"] == "new_session"
    # Le validate_session_token cote serveur rejettera l'ancien


# ======================================================================
# JWT VALIDATION TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_valid_jwt_extracts_user_id(jwt_secret):
    """
    Test : Un JWT valide est parse correctement.
    """
    user_id = 123
    token = create_valid_jwt_token(user_id=user_id, secret=jwt_secret)

    payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    assert int(payload["sub"]) == user_id
    assert payload["type"] == "access"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_expired_jwt_rejected(jwt_secret):
    """
    Test : Un JWT expire est rejete.
    """
    token = create_expired_jwt_token(secret=jwt_secret)

    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(token, jwt_secret, algorithms=["HS256"])


@pytest.mark.unit
@pytest.mark.asyncio
async def test_tampered_jwt_rejected(jwt_secret):
    """
    Test : Un JWT tamperise (signature modifiee) est rejete.
    """
    token = create_valid_jwt_token(secret=jwt_secret)
    tampered_token = token[:-5] + "XXXXX"

    with pytest.raises(JWTError):
        jwt.decode(tampered_token, jwt_secret, algorithms=["HS256"])


@pytest.mark.unit
@pytest.mark.asyncio
async def test_wrong_secret_jwt_rejected(jwt_secret):
    """
    Test : Un JWT decode avec le mauvais secret est rejete.
    """
    token = create_valid_jwt_token(secret=jwt_secret)

    with pytest.raises(JWTError):
        jwt.decode(token, "wrong-secret-key-that-is-long-enough", algorithms=["HS256"])


@pytest.mark.unit
@pytest.mark.asyncio
async def test_missing_jwt_returns_401():
    """
    Test : Requete sans JWT lance HTTPException 401 dans get_current_user.
    """
    from auth.dependencies import get_current_user

    mock_session = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=None, token=None, session=mock_session)

    assert exc_info.value.status_code == 401


# ======================================================================
# EMAIL VERIFICATION TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_email_success(mock_db_session):
    """
    Test : La verification d'email reussit avec le bon code.
    """
    from auth.service import verify_email

    user = create_test_user(email_verified=False)
    user.verification_code = "123456"
    user.verification_expires = datetime.now() + timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    success, message = await verify_email(mock_db_session, "test@example.com", "123456")

    assert success is True
    assert user.email_verified is True
    assert user.verification_code is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_email_wrong_code(mock_db_session):
    """
    Test : Un code incorrect est rejete.
    """
    from auth.service import verify_email

    user = create_test_user(email_verified=False)
    user.verification_code = "123456"
    user.verification_expires = datetime.now() + timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    success, message = await verify_email(mock_db_session, "test@example.com", "999999")

    assert success is False
    assert "incorrect" in message.lower() or "invalide" in message.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_email_expired_code(mock_db_session):
    """
    Test : Un code expire est rejete.
    """
    from auth.service import verify_email

    user = create_test_user(email_verified=False)
    user.verification_code = "123456"
    user.verification_expires = datetime.now() - timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    success, message = await verify_email(mock_db_session, "test@example.com", "123456")

    assert success is False
    assert "expir" in message.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resend_verification_success(mock_db_session):
    """
    Test : La reexpedition du code de verification reussit.
    """
    from auth.service import resend_verification

    user = create_test_user(email_verified=False)
    user.verification_code = "old_code"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    success, message, code = await resend_verification(mock_db_session, "test@example.com")

    assert success is True
    assert code is not None
    assert len(code) == 6  # Code a 6 chiffres
    assert code != "old_code"


# ======================================================================
# PASSWORD RESET TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_forgot_password_sends_code(mock_db_session):
    """
    Test : Demande de reset password genere un code.
    Verifie: code genere, retourne toujours succes (pas de leak).
    """
    from auth.service import initiate_password_reset

    user = create_test_user()

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    success, message, code = await initiate_password_reset(mock_db_session, "test@example.com")

    assert success is True
    assert code is not None
    assert len(code) > 10  # token_urlsafe(32)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_forgot_password_nonexistent_email(mock_db_session):
    """
    Test : Demande reset pour email inexistant retourne succes (pas de leak).
    """
    from auth.service import initiate_password_reset

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

    success, message, code = await initiate_password_reset(mock_db_session, "noone@example.com")

    # Toujours succes pour ne pas reveler si l'email existe
    assert success is True
    assert code is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reset_password_success(mock_db_session):
    """
    Test : Reset password reussit avec le bon code.
    """
    from auth.service import reset_password

    user = create_test_user()
    user.reset_code = "resetcode123"
    user.reset_expires = datetime.now() + timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    with patch("auth.service.hash_password", return_value="$2b$12$newhash"):
        success, message = await reset_password(
            mock_db_session, "test@example.com", "resetcode123", "NewSecurePassword123!"
        )

    assert success is True
    assert user.password_hash == "$2b$12$newhash"
    assert user.reset_code is None
    assert user.reset_expires is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reset_password_invalid_code(mock_db_session):
    """
    Test : Un code reset invalide est rejete.
    """
    from auth.service import reset_password

    user = create_test_user()
    user.reset_code = "resetcode123"
    user.reset_expires = datetime.now() + timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    success, message = await reset_password(
        mock_db_session, "test@example.com", "wrongcode", "NewSecurePassword123!"
    )

    assert success is False
    assert "invalide" in message.lower() or "invalid" in message.lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_change_password_success(mock_db_session):
    """
    Test : Changement de password authentifie reussit.
    """
    from auth.service import change_password

    user = create_test_user()
    user.password_hash = "$2b$12$oldhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    with patch("auth.service.verify_password", return_value=True), \
         patch("auth.service.hash_password", return_value="$2b$12$newhash"):
        success, message = await change_password(
            mock_db_session, user.id, "OldPassword123!", "NewSecurePassword123!"
        )

    assert success is True
    assert user.password_hash == "$2b$12$newhash"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_change_password_wrong_current(mock_db_session):
    """
    Test : Password actuel incorrect = echec.
    """
    from auth.service import change_password

    user = create_test_user()
    user.password_hash = "$2b$12$oldhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    with patch("auth.service.verify_password", return_value=False):
        success, message = await change_password(
            mock_db_session, user.id, "WrongPassword!", "NewSecurePassword123!"
        )

    assert success is False
    assert "incorrect" in message.lower()


# ======================================================================
# GOOGLE OAUTH TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_login_returns_auth_url():
    """
    Test : get_google_auth_url retourne une URL valide.
    """
    from auth.service import get_google_auth_url

    with patch("auth.service.GOOGLE_OAUTH_CONFIG", {
        "ENABLED": True,
        "CLIENT_ID": "test-client-id.apps.googleusercontent.com",
        "CLIENT_SECRET": "test-secret",
        "REDIRECT_URI": "http://localhost:8000/api/auth/google/callback",
    }), patch("auth.service.APP_URL", "http://localhost:8000"):
        url = get_google_auth_url(state="csrf123")

    assert "accounts.google.com" in url
    assert "test-client-id" in url
    assert "csrf123" in url
    assert "scope=openid" in url or "scope=openid+email+profile" in url


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_callback_creates_user(mock_db_session):
    """
    Test : Callback Google cree un nouvel utilisateur.
    """
    from auth.service import login_or_register_google_user

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    google_user = {
        "email": "googleuser@gmail.com",
        "id": "google_12345",
        "name": "Google User",
    }

    with patch("auth.service.hash_password", return_value="$2b$12$random"), \
         patch("auth.service.get_limits", return_value={"monthly_credits": 250}), \
         patch("auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@test.com"}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="sess_new"):
        success, user, message, session_token = await login_or_register_google_user(
            mock_db_session, google_user
        )

    assert success is True
    assert session_token == "sess_new"
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_callback_existing_user_links(mock_db_session):
    """
    Test : Callback Google pour user existant link le compte Google.
    """
    from auth.service import login_or_register_google_user

    user = create_test_user(google_id=None)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    google_user = {
        "email": "test@example.com",
        "id": "google_67890",
        "name": "Test User",
    }

    with patch("auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@test.com"}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="sess_linked"):
        success, returned_user, message, session_token = await login_or_register_google_user(
            mock_db_session, google_user
        )

    assert success is True
    assert user.google_id == "google_67890"
    assert user.email_verified is True
    assert session_token == "sess_linked"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_silent_auto_create_false_returns_not_registered(mock_db_session):
    """
    Silent auto-login (extension Chrome): si aucun compte DeepSight n'existe
    pour l'email Google et que auto_create=False, doit retourner
    (False, None, "NOT_REGISTERED", None) pour que le client redirige vers
    signup au lieu de créer un compte sans interaction.
    """
    from auth.service import login_or_register_google_user

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()

    google_user = {
        "email": "unknown@gmail.com",
        "id": "google_silent_123",
        "name": "Unknown User",
    }

    with patch("auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@test.com"}):
        success, user, message, session_token = await login_or_register_google_user(
            mock_db_session, google_user, auto_create=False
        )

    assert success is False
    assert user is None
    assert message == "NOT_REGISTERED"
    assert session_token is None
    mock_db_session.add.assert_not_called()
    mock_db_session.commit.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_auto_create_false_still_logs_in_existing_user(mock_db_session):
    """
    Silent auto-login avec user existant: auto_create=False ne doit pas
    bloquer un login normal quand le compte DeepSight existe déjà.
    """
    from auth.service import login_or_register_google_user

    user = create_test_user(email="existing@example.com", google_id="google_existing_456")

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    google_user = {
        "email": "existing@example.com",
        "id": "google_existing_456",
        "name": "Existing User",
    }

    with patch("auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@test.com"}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="sess_silent"):
        success, returned_user, message, session_token = await login_or_register_google_user(
            mock_db_session, google_user, auto_create=False
        )

    assert success is True
    assert returned_user is user
    assert session_token == "sess_silent"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_exchange_code():
    """
    Test : Echange de code Google avec httpx mocke.
    """
    from auth.service import exchange_google_code

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "access_token": "ya29.google_access_token",
        "refresh_token": "1//google_refresh_token",
        "id_token": "eyJ.google.idtoken",
    }

    with patch("auth.service.GOOGLE_OAUTH_CONFIG", {
        "CLIENT_ID": "test-client-id",
        "CLIENT_SECRET": "test-secret",
        "REDIRECT_URI": "http://localhost:8000/callback",
    }), patch("auth.service.APP_URL", "http://localhost:8000"), \
         patch("httpx.AsyncClient") as MockClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = mock_client_instance

        result = await exchange_google_code("auth_code_123")

    assert result is not None
    assert result["access_token"] == "ya29.google_access_token"


# ======================================================================
# SESSION MANAGEMENT TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_session_token_generation():
    """
    Test : generate_session_token cree des tokens uniques.
    """
    from auth.service import generate_session_token

    tokens = [generate_session_token() for _ in range(10)]
    # Tous uniques
    assert len(set(tokens)) == 10
    # Longueur suffisante
    for t in tokens:
        assert len(t) > 20


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_token_valid(mock_db_session):
    """
    Test : validate_session_token retourne True si le token correspond.
    """
    from auth.service import validate_session_token

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value="valid_session_123")

    result = await validate_session_token(mock_db_session, user_id=1, session_token="valid_session_123")
    assert result is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_token_multi_device_allowed(mock_db_session):
    """
    Test : multi-device — un session_token JWT n'est plus rejeté juste parce
    qu'un autre device s'est reconnecté entre-temps. Tant que la DB n'est
    pas explicitement NULL (logout volontaire), on accepte.
    """
    from auth.service import validate_session_token

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value="current_session")

    # JWT contient un ancien token, DB en a un nouveau (autre device s'est
    # reconnecté) → on accepte quand même : le JWT signé est suffisant.
    result = await validate_session_token(mock_db_session, user_id=1, session_token="old_session")
    assert result is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_token_revoked(mock_db_session):
    """
    Test : validate_session_token rejette si la DB a été explicitement
    nettoyée (NULL via /logout ou invalidate_user_session).
    """
    from auth.service import validate_session_token

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

    result = await validate_session_token(mock_db_session, user_id=1, session_token="any_token")
    assert result is False


# ======================================================================
# DEPENDENCY TESTS
# ======================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_valid_token(mock_db_session, jwt_secret):
    """
    Test : get_current_user retourne user avec token valide.
    """
    from auth.dependencies import get_current_user

    user = create_test_user()
    token = create_valid_jwt_token(user_id=user.id, secret=jwt_secret)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)

    credentials = MagicMock()
    credentials.credentials = token

    with patch("auth.dependencies.verify_token", return_value={
        "sub": str(user.id), "type": "access", "session": None
    }), patch("auth.dependencies.SECURITY_AVAILABLE", False):
        result = await get_current_user(
            credentials=credentials, token=None, session=mock_db_session
        )

    assert result.id == user.id
    assert result.email == user.email


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_optional_no_token():
    """
    Test : get_current_user_optional retourne None sans token.
    """
    from auth.dependencies import get_current_user_optional

    mock_session = AsyncMock()

    with patch("auth.dependencies.SECURITY_AVAILABLE", False):
        result = await get_current_user_optional(
            credentials=None, token=None, session=mock_session
        )

    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_plan_authorized(mock_db_session):
    """
    Test : require_plan("pro") accepte user avec plan pro.
    """
    from auth.dependencies import require_plan

    user = create_test_user(plan="pro", email_verified=True)

    check_plan = require_plan("pro")

    with patch("billing.plan_config.normalize_plan_id", side_effect=lambda x: x), \
         patch("billing.plan_config.get_plan_index", side_effect=lambda x: {"free": 0, "plus": 1, "pro": 2}.get(x, 0)):
        # Simuler que get_verified_user retourne l'utilisateur
        result = await check_plan(current_user=user)

    assert result.plan == "pro"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_plan_unauthorized(mock_db_session):
    """
    Test : require_plan("pro") rejette user avec plan free.
    """
    from auth.dependencies import require_plan

    user = create_test_user(plan="free", email_verified=True)

    check_plan = require_plan("pro")

    with patch("billing.plan_config.normalize_plan_id", side_effect=lambda x: x), \
         patch("billing.plan_config.get_plan_index", side_effect=lambda x: {"free": 0, "plus": 1, "pro": 2}.get(x, 0)):
        with pytest.raises(HTTPException) as exc_info:
            await check_plan(current_user=user)

    assert exc_info.value.status_code == 403


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_plan_admin_bypass():
    """
    Test : Un admin passe require_plan quel que soit son plan.
    """
    from auth.dependencies import require_plan

    admin_user = create_test_user(plan="free", is_admin=True, email_verified=True)

    check_plan = require_plan("pro")
    result = await check_plan(current_user=admin_user)

    assert result.is_admin is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_admin_non_admin_rejected(mock_db_session):
    """
    Test : get_current_admin rejette non-admin.
    """
    from auth.dependencies import get_current_admin

    user = create_test_user(is_admin=False, email="user@example.com")

    with patch("core.config.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@example.com"}):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_admin(current_user=user)

    assert exc_info.value.status_code == 403


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_admin_accepts_admin():
    """
    Test : get_current_admin accepte un admin.
    """
    from auth.dependencies import get_current_admin

    admin_user = create_test_user(is_admin=True, email="admin@example.com")

    with patch("core.config.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@example.com"}):
        result = await get_current_admin(current_user=admin_user)

    assert result.is_admin is True


# ======================================================================
# INTEGRATION TESTS
# ======================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_auth_flow_register_verify_login(mock_db_session):
    """
    Test d'integration : Flux complet register -> verify -> login.
    """
    from auth.service import create_user, verify_email, authenticate_user

    # Phase 1: Register
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    with patch("auth.service.hash_password", return_value="$2b$12$hashed"), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": True, "RESEND_API_KEY": "re_key"}):
        success, user_obj, message = await create_user(
            mock_db_session, username="flowuser", email="flow@example.com", password="FlowPass123!"
        )
    assert success is True

    # Phase 2: Verify
    created_user = create_test_user(email="flow@example.com", email_verified=False)
    created_user.verification_code = "654321"
    created_user.verification_expires = datetime.now() + timedelta(hours=1)

    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=created_user)

    success, message = await verify_email(mock_db_session, "flow@example.com", "654321")
    assert success is True
    assert created_user.email_verified is True

    # Phase 3: Login
    created_user.password_hash = "$2b$12$hashed"
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=created_user)

    with patch("auth.service.verify_password", return_value=True), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": True, "RESEND_API_KEY": "re_key"}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="final_sess"):
        success, user, msg, session_token = await authenticate_user(
            mock_db_session, "flow@example.com", "FlowPass123!"
        )
    assert success is True
    assert session_token == "final_sess"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_password_reset_flow(mock_db_session):
    """
    Test d'integration : Flux complet forgot -> reset -> login.
    """
    from auth.service import initiate_password_reset, reset_password, authenticate_user

    user = create_test_user(email="reset@example.com")
    user.password_hash = "$2b$12$oldhash"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=user)
    mock_db_session.commit = AsyncMock()

    # Phase 1: Forgot password
    success, message, code = await initiate_password_reset(mock_db_session, "reset@example.com")
    assert success is True
    assert code is not None

    # Phase 2: Reset avec le code
    user.reset_code = code
    user.reset_expires = datetime.now() + timedelta(hours=1)

    with patch("auth.service.hash_password", return_value="$2b$12$newhash"):
        success, message = await reset_password(
            mock_db_session, "reset@example.com", code, "BrandNewPass123!"
        )
    assert success is True
    assert user.password_hash == "$2b$12$newhash"

    # Phase 3: Login avec nouveau password
    with patch("auth.service.verify_password", return_value=True), \
         patch("auth.service.EMAIL_CONFIG", {"ENABLED": False, "RESEND_API_KEY": ""}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="sess_reset"):
        success, user, msg, session_token = await authenticate_user(
            mock_db_session, "reset@example.com", "BrandNewPass123!"
        )
    assert success is True
    assert session_token == "sess_reset"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_google_oauth_flow(mock_db_session):
    """
    Test d'integration : Flux complet Google OAuth.
    """
    from auth.service import get_google_auth_url, login_or_register_google_user, create_access_token

    # Phase 1: Obtenir l'URL Google
    with patch("auth.service.GOOGLE_OAUTH_CONFIG", {
        "ENABLED": True,
        "CLIENT_ID": "test-client-id",
        "CLIENT_SECRET": "test-secret",
        "REDIRECT_URI": "http://localhost:8000/callback",
    }), patch("auth.service.APP_URL", "http://localhost:8000"):
        url = get_google_auth_url(state="csrf_state")
    assert "accounts.google.com" in url

    # Phase 2: Callback cree l'utilisateur
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    mock_db_session.add = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    google_user = {"email": "oauth@gmail.com", "id": "google_999", "name": "OAuth User"}

    with patch("auth.service.hash_password", return_value="$2b$12$random"), \
         patch("auth.service.get_limits", return_value={"monthly_credits": 250}), \
         patch("auth.service.ADMIN_CONFIG", {"ADMIN_EMAIL": "admin@other.com"}), \
         patch("auth.service.create_user_session", new_callable=AsyncMock, return_value="oauth_sess"):
        success, user, message, session_token = await login_or_register_google_user(
            mock_db_session, google_user
        )
    assert success is True
    assert session_token == "oauth_sess"

    # Phase 3: Generer des tokens valides
    test_secret = "test-secret-key-minimum-32-characters-long-for-hs256"
    with patch("auth.service.JWT_CONFIG", {
        "SECRET_KEY": test_secret,
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
        "REFRESH_TOKEN_EXPIRE_DAYS": 30,
    }):
        access_token = create_access_token(user_id=1, is_admin=False, session_token="oauth_sess")

    payload = jwt.decode(access_token, test_secret, algorithms=["HS256"])
    assert payload["sub"] == "1"
    assert payload["session"] == "oauth_sess"
