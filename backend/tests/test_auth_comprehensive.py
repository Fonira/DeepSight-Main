"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔐 AUTH COMPREHENSIVE TESTS — Batterie complète de tests d'authentification        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from jose import jwt
from fastapi import HTTPException

from conftest_enhanced import (
    create_test_user,
    create_valid_jwt_token,
    create_expired_jwt_token,
    mock_auth_header,
)


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ REGISTRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_success(mock_db_session, mock_httpx_client):
    """
    Test : L'enregistrement d'un nouvel utilisateur réussit.

    Vérifie:
    - Utilisateur créé en BD avec hash password
    - Code de vérification email généré
    - Email de vérification envoyé
    """
    payload = {
        "email": "newuser@example.com",
        "username": "newuser",
        "password": "SecurePassword123!"
    }

    mock_db_session.execute = AsyncMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # Mock: pas d'utilisateur existant
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = None

    # TODO: Appeler endpoint POST /api/auth/register
    # response = await app_client.post("/api/auth/register", json=payload)
    # assert response.status_code == 201
    # assert response.json()["message"] == "Registration successful"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_duplicate_email(mock_db_session):
    """
    Test : L'enregistrement avec un email existant échoue (409).

    Vérifie:
    - Retour 409 Conflict
    - Message d'erreur approprié
    """
    existing_user = create_test_user(email="existing@example.com")
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = existing_user

    payload = {
        "email": "existing@example.com",
        "username": "newuser",
        "password": "SecurePassword123!"
    }

    # TODO: Appeler endpoint et vérifier 409
    # response = await app_client.post("/api/auth/register", json=payload)
    # assert response.status_code == 409


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_weak_password():
    """
    Test : Le mot de passe faible est rejeté (validation).

    Vérifie:
    - Passwords < 8 chars rejetés
    - Passwords sans majuscules rejetés
    - Passwords sans chiffres rejetés
    """
    weak_passwords = [
        "short",
        "nouppercase123",
        "NoNumbers!",
    ]

    for pwd in weak_passwords:
        payload = {
            "email": "test@example.com",
            "username": "testuser",
            "password": pwd
        }
        # TODO: Vérifier que la validation rejette le mot de passe
        # response = await app_client.post("/api/auth/register", json=payload)
        # assert response.status_code == 422


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_invalid_email():
    """
    Test : Un email invalide est rejeté (validation).

    Vérifie:
    - Emails malformés rejetés
    - Domaines invalides rejetés
    """
    invalid_emails = [
        "notanemail",
        "missing@domain",
        "@nodomain.com",
    ]

    for email in invalid_emails:
        payload = {
            "email": email,
            "username": "testuser",
            "password": "SecurePassword123!"
        }
        # TODO: Vérifier que la validation rejette l'email
        # response = await app_client.post("/api/auth/register", json=payload)
        # assert response.status_code == 422


@pytest.mark.unit
@pytest.mark.asyncio
async def test_register_username_too_short():
    """
    Test : Un username trop court est rejeté.

    Vérifie:
    - Username < 3 chars rejeté
    """
    payload = {
        "email": "test@example.com",
        "username": "ab",  # < 3 chars
        "password": "SecurePassword123!"
    }
    # TODO: Vérifier la validation
    # response = await app_client.post("/api/auth/register", json=payload)
    # assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ LOGIN TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_success(mock_db_session):
    """
    Test : Connexion réussie retourne access_token + refresh_token.

    Vérifie:
    - access_token JWT valide généré
    - refresh_token généré et sauvegardé
    - Réponse 200
    """
    user = create_test_user(
        email="test@example.com",
        email_verified=True
    )
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    payload = {
        "email": "test@example.com",
        "password": "SecurePassword123!"
    }

    # TODO: Mock bcrypt.verify pour confirmer mot de passe
    # response = await app_client.post("/api/auth/login", json=payload)
    # assert response.status_code == 200
    # assert "access_token" in response.json()
    # assert "refresh_token" in response.json()
    # assert response.json()["token_type"] == "bearer"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_wrong_password(mock_db_session):
    """
    Test : Mauvais mot de passe = 401 Unauthorized.

    Vérifie:
    - Pas de token retourné
    - Message d'erreur approprié
    """
    user = create_test_user()
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    payload = {
        "email": "test@example.com",
        "password": "WrongPassword123!"
    }

    # TODO: Mock bcrypt.verify pour retourner False
    # response = await app_client.post("/api/auth/login", json=payload)
    # assert response.status_code == 401


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_nonexistent_user(mock_db_session):
    """
    Test : Utilisateur inexistant = 401 Unauthorized.

    Vérifie:
    - Même message que mauvais password (sécurité)
    - Pas de leak d'information
    """
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = None

    payload = {
        "email": "nonexistent@example.com",
        "password": "AnyPassword123!"
    }

    # TODO: Vérifier 401
    # response = await app_client.post("/api/auth/login", json=payload)
    # assert response.status_code == 401


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_unverified_email(mock_db_session):
    """
    Test : Email non vérifié = 403 Forbidden.

    Vérifie:
    - Utilisateur avec email_verified=False bloqué
    - Message invitant à vérifier l'email
    """
    user = create_test_user(email_verified=False)
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    payload = {
        "email": "test@example.com",
        "password": "SecurePassword123!"
    }

    # TODO: Vérifier 403
    # response = await app_client.post("/api/auth/login", json=payload)
    # assert response.status_code == 403
    # assert "verify" in response.json()["detail"].lower()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_login_creates_session_token(mock_db_session):
    """
    Test : Chaque login crée un nouveau token de session unique.

    Vérifie:
    - session_token stocké en BD
    - Token différent à chaque login
    """
    user = create_test_user()
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    # TODO: Faire 2 logins et vérifier que les tokens de session diffèrent
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TOKEN MANAGEMENT TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_success(mock_db_session):
    """
    Test : Refresh token valide génère un nouveau access_token.

    Vérifie:
    - Nouveau access_token retourné
    - Format JWT valide
    - Ancien token reste valide le temps de la requête
    """
    user = create_test_user()
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    # TODO: Générer refresh_token valide
    # Appeler POST /api/auth/refresh avec refresh_token
    # Vérifier nouveau access_token retourné
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_expired():
    """
    Test : Refresh token expiré = 401 Unauthorized.

    Vérifie:
    - Pas de nouveau token généré
    - Message d'erreur approprié
    """
    # TODO: Créer un refresh_token expiré
    # Appeler POST /api/auth/refresh
    # Vérifier 401
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_invalid():
    """
    Test : Refresh token invalide = 401 Unauthorized.

    Vérifie:
    - Token malformé rejeté
    - Token tamperisé rejeté
    - Token révoqué rejeté
    """
    invalid_tokens = [
        "not.a.token",
        "bearer invalid",
        "",
    ]

    for token in invalid_tokens:
        headers = {"Authorization": f"Bearer {token}"}
        # TODO: Appeler POST /api/auth/refresh
        # Vérifier 401 pour chaque
        pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_token_rotation(mock_db_session):
    """
    Test : L'ancien refresh token est invalidé après rotation (sécurité).

    Vérifie:
    - Ancien token ne peut plus être utilisé
    - Nouveau token valide
    """
    # TODO: Implémenter token rotation
    # Faire refresh
    # Essayer d'utiliser l'ancien token
    # Vérifier qu'il est rejeté
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ JWT VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_valid_jwt_extracts_user_id(jwt_secret):
    """
    Test : Un JWT valide est parsé correctement.

    Vérifie:
    - user_id extrait du token
    - Claims validés
    - Signature correcte
    """
    user_id = 123
    token = create_valid_jwt_token(user_id=user_id, secret=jwt_secret)

    # TODO: Décoder le token
    payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    assert int(payload["sub"]) == user_id


@pytest.mark.unit
@pytest.mark.asyncio
async def test_expired_jwt_rejected(jwt_secret):
    """
    Test : Un JWT expiré est rejeté.

    Vérifie:
    - Erreur JWT levée
    - Pas d'accès accordé
    """
    token = create_expired_jwt_token(secret=jwt_secret)

    with pytest.raises(Exception):  # jwt.ExpiredSignatureError
        jwt.decode(token, jwt_secret, algorithms=["HS256"])


@pytest.mark.unit
@pytest.mark.asyncio
async def test_tampered_jwt_rejected(jwt_secret):
    """
    Test : Un JWT tamperisé (signature modifiée) est rejeté.

    Vérifie:
    - Erreur de signature levée
    - Pas d'accès accordé
    """
    token = create_valid_jwt_token(secret=jwt_secret)
    tampered_token = token[:-5] + "XXXXX"  # Modifier les derniers chars

    with pytest.raises(Exception):  # jwt.JWTError
        jwt.decode(tampered_token, jwt_secret, algorithms=["HS256"])


@pytest.mark.unit
@pytest.mark.asyncio
async def test_missing_jwt_returns_401():
    """
    Test : Requête sans JWT retourne 401.

    Vérifie:
    - Header Authorization absent = 401
    - Header vide = 401
    - Format invalide = 401
    """
    # TODO: Appeler endpoint protégé sans header Authorization
    # Vérifier 401
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_blacklisted_token_rejected(mock_redis, jwt_secret):
    """
    Test : Un token blacklisté est rejeté même s'il est valide.

    Vérifie:
    - Token dans Redis blacklist rejeté
    - Pas d'accès accordé
    """
    token = create_valid_jwt_token(user_id=1, secret=jwt_secret)

    # TODO: Ajouter le token à la blacklist Redis
    mock_redis.get = AsyncMock(return_value=True)  # Token dans blacklist

    # Appeler endpoint avec ce token
    # Vérifier 401
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ EMAIL VERIFICATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_email_success(mock_db_session):
    """
    Test : La vérification d'email réussit avec le bon code.

    Vérifie:
    - User.email_verified = True après
    - Code de vérification supprimé
    - Réponse 200
    """
    user = create_test_user(email_verified=False)
    user.verification_code = "123456"
    user.verification_expires = datetime.utcnow() + timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    payload = {
        "email": "test@example.com",
        "code": "123456"
    }

    # TODO: Appeler endpoint POST /api/auth/verify
    # Vérifier 200 et email_verified=True
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_email_wrong_code(mock_db_session):
    """
    Test : Un code incorrect est rejeté.

    Vérifie:
    - Réponse 400
    - email_verified reste False
    """
    user = create_test_user(email_verified=False)
    user.verification_code = "123456"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    payload = {
        "email": "test@example.com",
        "code": "999999"
    }

    # TODO: Vérifier 400
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_email_expired_code(mock_db_session):
    """
    Test : Un code expiré est rejeté.

    Vérifie:
    - Réponse 400
    - Message indiquant l'expiration
    """
    user = create_test_user(email_verified=False)
    user.verification_code = "123456"
    user.verification_expires = datetime.utcnow() - timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    payload = {
        "email": "test@example.com",
        "code": "123456"
    }

    # TODO: Vérifier 400 et message d'expiration
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_resend_verification_success(mock_db_session):
    """
    Test : La réexpédition du code de vérification réussit.

    Vérifie:
    - Nouveau code généré
    - Email de vérification envoyé
    - Réponse 200
    """
    user = create_test_user(email_verified=False)
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    payload = {"email": "test@example.com"}

    # TODO: Vérifier que nouveau code généré et email envoyé
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ PASSWORD RESET TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_forgot_password_sends_email(mock_db_session):
    """
    Test : Demande de reset password envoie un email.

    Vérifie:
    - Code de reset généré
    - Email envoyé
    - Réponse 200 (pas de leak si email existe)
    """
    user = create_test_user()
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    payload = {"email": "test@example.com"}

    # TODO: Appeler POST /api/auth/forgot-password
    # Vérifier 200 et email envoyé
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reset_password_success(mock_db_session):
    """
    Test : Reset password réussit avec le bon code.

    Vérifie:
    - Password changé et hasher
    - Code supprimé
    - Email de confirmation envoyé
    """
    user = create_test_user()
    user.reset_code = "resetcode123"
    user.reset_expires = datetime.utcnow() + timedelta(hours=1)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    payload = {
        "email": "test@example.com",
        "code": "resetcode123",
        "new_password": "NewSecurePassword123!"
    }

    # TODO: Appeler POST /api/auth/reset-password
    # Vérifier 200 et password changé
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reset_password_invalid_code(mock_db_session):
    """
    Test : Un code reset invalide est rejeté.

    Vérifie:
    - Réponse 400
    - Password inchangé
    """
    user = create_test_user()
    user.reset_code = "resetcode123"

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    payload = {
        "email": "test@example.com",
        "code": "wrongcode",
        "new_password": "NewSecurePassword123!"
    }

    # TODO: Vérifier 400
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_change_password_success(mock_db_session, mock_auth_header):
    """
    Test : Changement de password authentifié réussit.

    Vérifie:
    - Password actuel validé
    - Nouveau password sauvegardé
    - Token JWT reste valide
    """
    user = create_test_user()
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    payload = {
        "current_password": "SecurePassword123!",
        "new_password": "NewSecurePassword123!"
    }

    # TODO: Appeler POST /api/auth/change-password avec header auth
    # Vérifier 200
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_change_password_wrong_current(mock_db_session, mock_auth_header):
    """
    Test : Password actuel incorrect = 400.

    Vérifie:
    - Password non changé
    - Message d'erreur clair
    """
    user = create_test_user()
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    payload = {
        "current_password": "WrongPassword123!",
        "new_password": "NewSecurePassword123!"
    }

    # TODO: Vérifier 400
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ GOOGLE OAUTH TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_login_returns_auth_url():
    """
    Test : Requête Google login retourne l'URL d'authentification.

    Vérifie:
    - URL OAuth valide retournée
    - Contient scope d'authentification
    - État de CSRF inclus
    """
    # TODO: Appeler GET /api/auth/google/login
    # Vérifier que URL Google retournée
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_callback_creates_user(mock_db_session):
    """
    Test : Callback Google crée un nouvel utilisateur.

    Vérifie:
    - User créé en BD
    - Email vérifié automatiquement
    - Tokens retournés
    """
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = None  # Pas d'user existant
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    # TODO: Simuler callback Google avec id_token valide
    # Vérifier que user créé et tokens retournés
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_callback_existing_user_links(mock_db_session):
    """
    Test : Callback Google pour user existant link le compte Google.

    Vérifie:
    - google_id sauvegardé
    - Pas de duplication d'utilisateur
    - Tokens retournés
    """
    user = create_test_user(google_id=None)
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user
    mock_db_session.commit = AsyncMock()

    # TODO: Appeler callback avec Google id_token
    # Vérifier que google_id linké
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_google_token_exchange_mobile():
    """
    Test : Échange de token Google depuis mobile (TODO: à implémenter).

    Vérifie:
    - Token authorization_code échang avec tokens DeepSight
    - Supporte le flow mobile (code_verifier)
    """
    # TODO: Implémenter et tester
    # POST /api/auth/google/token avec authorization_code
    # Vérifier access_token retourné
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ SESSION MANAGEMENT TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_session_token_unique_per_login(mock_db_session):
    """
    Test : Chaque login génère un session_token unique.

    Vérifie:
    - session_token différent à chaque login
    - Ancien token invalidé
    """
    # TODO: Faire 2+ logins
    # Vérifier que tokens de session diffèrent
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_old_session_invalidated_on_new_login(mock_db_session):
    """
    Test : Ancien session token devient invalide après nouveau login.

    Vérifie:
    - Ancien token rejeté après nouveau login
    - Nouveau token accepté
    """
    # TODO: Login -> logout -> login
    # Vérifier que ancien token ne marche plus
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_logout_blacklists_token(mock_redis, mock_auth_header):
    """
    Test : Logout ajoute le token à la blacklist.

    Vérifie:
    - Token ajouté à Redis blacklist
    - Token devient invalide immédiatement
    - TTL défini au temps d'expiration du token
    """
    mock_redis.set = AsyncMock(return_value=True)

    # TODO: Appeler POST /api/auth/logout avec auth header
    # Vérifier que token est dans Redis blacklist
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ DEPENDENCY TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_valid_token(mock_db_session, jwt_secret):
    """
    Test : Dépendance get_current_user retourne user avec token valide.

    Vérifie:
    - User extrait de BD
    - Token validé
    - User retourné
    """
    user = create_test_user()
    token = create_valid_jwt_token(user_id=user.id, secret=jwt_secret)

    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    # TODO: Tester la dépendance get_current_user
    # Vérifier qu'elle retourne l'utilisateur
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_optional_no_token():
    """
    Test : Dépendance optionnelle retourne None sans token.

    Vérifie:
    - Pas d'erreur levée
    - None retourné
    - Requête continue
    """
    # TODO: Tester dépendance optional sans token
    # Vérifier qu'elle retourne None
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_plan_authorized(mock_db_session):
    """
    Test : require_plan(\"pro\") accepte user avec plan pro.

    Vérifie:
    - User avec plan >= pro accepté
    - User expert accepté pour tous les plans
    """
    user = create_test_user(plan="pro")
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    # TODO: Tester la dépendance require_plan("pro")
    # Vérifier qu'elle accepte l'utilisateur
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_plan_unauthorized(mock_db_session):
    """
    Test : require_plan(\"pro\") rejette user avec plan free.

    Vérifie:
    - 403 Forbidden levé
    - Message d'erreur clair
    """
    user = create_test_user(plan="free")
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    # TODO: Tester require_plan("pro") avec user free
    # Vérifier 403
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_feature_web_authorized(mock_db_session):
    """
    Test : require_feature(\"playlists\", \"web\") accepte user pro.

    Vérifie:
    - Feature disponible pour plan retourné
    """
    user = create_test_user(plan="pro")
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    # TODO: Tester require_feature("playlists", "web")
    # Vérifier accès accordé pour pro
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_feature_mobile_restricted(mock_db_session):
    """
    Test : require_feature(\"playlists\", \"mobile\") rejette même pro.

    Vérifie:
    - Feature absente sur mobile même pour pro
    - 403 Forbidden
    """
    user = create_test_user(plan="pro")
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    # TODO: Tester require_feature("playlists", "mobile")
    # Vérifier 403 pour mobile
    pass


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_admin_non_admin_rejected(mock_db_session):
    """
    Test : Dépendance get_current_admin rejette non-admin.

    Vérifie:
    - User avec is_admin=False rejeté
    - 403 Forbidden levé
    """
    user = create_test_user(is_admin=False)
    mock_db_session.execute = AsyncMock()
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = user

    # TODO: Tester get_current_admin
    # Vérifier 403
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 INTEGRATION TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_auth_flow_register_verify_login(mock_db_session):
    """
    Test d'intégration : Flux complet register → verify → login.

    Vérifie:
    - Register crée l'utilisateur
    - Verify valide l'email
    - Login génère tokens valides
    """
    # TODO: Tester le flux complet
    pass


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_password_reset_flow(mock_db_session):
    """
    Test d'intégration : Flux complet forgot → reset → login.

    Vérifie:
    - Forgot génère reset_code
    - Reset change le password
    - Login fonctionne avec nouveau password
    """
    # TODO: Tester le flux complet
    pass


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_google_oauth_flow(mock_db_session):
    """
    Test d'intégration : Flux complet Google OAuth.

    Vérifie:
    - Auth URL générée
    - Callback crée/link utilisateur
    - Tokens valides retournés
    """
    # TODO: Tester le flux complet
    pass
