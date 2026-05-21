"""PyJWT Apple Sign-in compat tests.

Wave 1 Step 5 (2026-05-21) — Migration python-jose → PyJWT[crypto].
Couvre spécifiquement le chemin critique Apple Sign-in qui utilisait
`jose.jwk.construct(dict)` et qui est désormais migré vers
`jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(dict))`.

Approche : on génère une RSA keypair localement, on construit un JWT signé
RS256 avec les claims Apple typiques (sub, email, aud, iss, exp), on expose
la clé publique sous forme JWK, et on vérifie que :

  1. Le decode PyJWT avec une RSAPublicKey construite via
     `RSAAlgorithm.from_jwk(json.dumps(jwk))` accepte le JWT et renvoie
     les claims attendus.
  2. Le decode avec audience mismatch lève une JWTError (= PyJWTError) —
     compatibilité du except clause existant dans `verify_apple_id_token`.
  3. Le decode avec issuer mismatch lève aussi une JWTError.
  4. Le decode d'un JWT expiré lève `ExpiredSignatureError` (sous-classe de
     PyJWTError → catché par `except JWTError`).
  5. `get_unverified_header()` extrait `kid` correctement avant verification.

Pourquoi pas test E2E `verify_apple_id_token` : la fonction fetch un JWKS
distant via httpx — mocker tout le httpx + asyncio est lourd, et le bug
le plus probable de la migration est exactement le from_jwk → decode
chemin, qui est ce que ce test exerce directement.
"""

import json
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm
from jwt.exceptions import PyJWTError as JWTError, ExpiredSignatureError, InvalidAudienceError, InvalidIssuerError


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures — RSA keypair + JWK + signed JWT
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def rsa_keypair():
    """Génère une paire RSA-2048 fraîche (équivalent format Apple JWKS)."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture
def rsa_jwk(rsa_keypair):
    """Convertit la clé publique en JWK dict (format identique à Apple JWKS)."""
    _, public_key = rsa_keypair
    # PyJWT a une méthode utilitaire pour générer le JWK depuis la clé publique
    jwk_json = RSAAlgorithm.to_jwk(public_key)
    jwk_dict = json.loads(jwk_json)
    # Apple JWKS ajoute toujours kid, alg, use, kty — on simule ce shape
    jwk_dict.setdefault("kid", "test-kid-2026-05-21")
    jwk_dict.setdefault("alg", "RS256")
    jwk_dict.setdefault("use", "sig")
    return jwk_dict


@pytest.fixture
def apple_audience():
    return "com.deepsight.app"


@pytest.fixture
def apple_issuer():
    return "https://appleid.apple.com"


@pytest.fixture
def signed_apple_jwt(rsa_keypair, apple_audience, apple_issuer):
    """Génère un JWT RS256 signé avec les claims Apple typiques."""
    private_key, _ = rsa_keypair
    now = datetime.now(timezone.utc)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    payload = {
        "sub": "001234.abcdef.5678",
        "email": "user@privaterelay.appleid.com",
        "email_verified": "true",
        "is_private_email": "true",
        "aud": apple_audience,
        "iss": apple_issuer,
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
    }
    headers = {"kid": "test-kid-2026-05-21", "alg": "RS256"}
    return jwt.encode(payload, private_pem, algorithm="RS256", headers=headers)


@pytest.fixture
def expired_apple_jwt(rsa_keypair, apple_audience, apple_issuer):
    """JWT déjà expiré (exp -1h)."""
    private_key, _ = rsa_keypair
    now = datetime.now(timezone.utc)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    payload = {
        "sub": "001234.abcdef.5678",
        "aud": apple_audience,
        "iss": apple_issuer,
        "exp": int((now - timedelta(hours=1)).timestamp()),
        "iat": int((now - timedelta(hours=2)).timestamp()),
    }
    headers = {"kid": "test-kid-2026-05-21", "alg": "RS256"}
    return jwt.encode(payload, private_pem, algorithm="RS256", headers=headers)


# ═══════════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════════


def test_from_jwk_constructs_rsa_public_key(rsa_jwk):
    """`RSAAlgorithm.from_jwk(json.dumps(jwk))` retourne une clé exploitable."""
    public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_jwk))
    # Doit être une RSAPublicKey de cryptography, pas un dict ou None
    assert hasattr(public_key, "public_numbers"), (
        "RSAAlgorithm.from_jwk doit retourner une RSAPublicKey, pas un wrapper opaque"
    )


def test_decode_with_jwk_key_returns_claims(signed_apple_jwt, rsa_jwk, apple_audience, apple_issuer):
    """Le decode PyJWT avec key construite via from_jwk renvoie les claims Apple."""
    public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_jwk))
    claims = jwt.decode(
        signed_apple_jwt,
        public_key,
        algorithms=["RS256"],
        audience=apple_audience,
        issuer=apple_issuer,
    )
    assert claims["sub"] == "001234.abcdef.5678"
    assert claims["email"] == "user@privaterelay.appleid.com"
    assert claims["aud"] == apple_audience
    assert claims["iss"] == apple_issuer


def test_decode_with_audience_mismatch_raises_jwterror(signed_apple_jwt, rsa_jwk, apple_issuer):
    """Audience mismatch → InvalidAudienceError (sous-classe de PyJWTError = JWTError alias)."""
    public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_jwk))
    with pytest.raises(JWTError):
        jwt.decode(
            signed_apple_jwt,
            public_key,
            algorithms=["RS256"],
            audience="com.wrong.audience",
            issuer=apple_issuer,
        )
    # Vérification supplémentaire : la sous-classe précise est InvalidAudienceError
    with pytest.raises(InvalidAudienceError):
        jwt.decode(
            signed_apple_jwt,
            public_key,
            algorithms=["RS256"],
            audience="com.wrong.audience",
            issuer=apple_issuer,
        )


def test_decode_with_issuer_mismatch_raises_jwterror(signed_apple_jwt, rsa_jwk, apple_audience):
    """Issuer mismatch → InvalidIssuerError (sous-classe de PyJWTError)."""
    public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_jwk))
    with pytest.raises(JWTError):
        jwt.decode(
            signed_apple_jwt,
            public_key,
            algorithms=["RS256"],
            audience=apple_audience,
            issuer="https://wrong.issuer.example",
        )
    with pytest.raises(InvalidIssuerError):
        jwt.decode(
            signed_apple_jwt,
            public_key,
            algorithms=["RS256"],
            audience=apple_audience,
            issuer="https://wrong.issuer.example",
        )


def test_decode_expired_jwt_raises_jwterror(expired_apple_jwt, rsa_jwk, apple_audience, apple_issuer):
    """JWT expiré → ExpiredSignatureError (sous-classe d'InvalidTokenError → PyJWTError)."""
    public_key = RSAAlgorithm.from_jwk(json.dumps(rsa_jwk))
    with pytest.raises(JWTError):
        jwt.decode(
            expired_apple_jwt,
            public_key,
            algorithms=["RS256"],
            audience=apple_audience,
            issuer=apple_issuer,
        )
    with pytest.raises(ExpiredSignatureError):
        jwt.decode(
            expired_apple_jwt,
            public_key,
            algorithms=["RS256"],
            audience=apple_audience,
            issuer=apple_issuer,
        )


def test_get_unverified_header_extracts_kid(signed_apple_jwt):
    """`jwt.get_unverified_header()` extrait `kid` sans valider la signature.

    C'est l'étape #1 du flow Apple : on a besoin de `kid` pour sélectionner
    la bonne clé JWK dans la JWKS, AVANT de pouvoir vérifier la signature.
    """
    header = jwt.get_unverified_header(signed_apple_jwt)
    assert header["kid"] == "test-kid-2026-05-21"
    assert header["alg"] == "RS256"


def test_get_unverified_header_malformed_jwt_raises_jwterror():
    """Un JWT mal formé → JWTError (catché dans verify_apple_id_token)."""
    with pytest.raises(JWTError):
        jwt.get_unverified_header("not.a.jwt")


def test_apple_jwk_dict_with_extra_fields_still_constructs(rsa_jwk):
    """Apple ajoute parfois des champs au JWK (`use`, `alg`, `kid`) — from_jwk doit les tolérer."""
    # On enrichit le JWK comme le ferait Apple
    enriched = {**rsa_jwk, "extra_field_apple_may_add": "ignored"}
    # Doit toujours construire la clé sans erreur (champs non-reconnus ignorés)
    public_key = RSAAlgorithm.from_jwk(json.dumps(enriched))
    assert hasattr(public_key, "public_numbers")


def test_pyjwt_error_alias_is_pyjwt_exception_base():
    """Sanity check : `JWTError` alias = `jwt.PyJWTError` (= base de TOUTES exceptions PyJWT).

    Garantit que les `except JWTError` existants dans auth.service catchent
    bien TOUS les cas d'erreur PyJWT, identique au comportement legacy avec
    `from jose import JWTError`.
    """
    assert JWTError is jwt.PyJWTError
    # Toutes les exceptions PyJWT héritent de PyJWTError
    assert issubclass(jwt.ExpiredSignatureError, JWTError)
    assert issubclass(jwt.InvalidTokenError, JWTError)
    assert issubclass(jwt.InvalidSignatureError, JWTError)
    assert issubclass(InvalidAudienceError, JWTError)
    assert issubclass(InvalidIssuerError, JWTError)
