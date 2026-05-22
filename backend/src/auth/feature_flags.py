"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🚩 AUTH V2 — Feature flag bucketing + cutover helpers                              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Wave 1 Step 4 (2026-05-21) — décide si un utilisateur passe par le flow Auth V2   ║
║  (multi-device UserSession + sliding/absolute TTL + single-use rotation) ou reste  ║
║  sur le flow legacy V1 (User.session_token unique).                                ║
║                                                                                    ║
║  Trois mécanismes combinés :                                                       ║
║  1. AUTH_V2_ENABLED — kill switch global. Si False, tout reste sur V1.             ║
║  2. AUTH_V2_BUCKET_PERCENT — % d'utilisateurs dans le bucket V2 (0-100).            ║
║     Hash déterministe(user_id) % 100 < pct → bucket V2.                            ║
║  3. AUTH_V2_CUTOVER_DATE — date à partir de laquelle les tokens fraichement         ║
║     émis sont V2. Les tokens émis avant cutover restent en V1 pendant la grace      ║
║     period (30j par défaut).                                                       ║
║                                                                                    ║
║  Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4.5.      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

import core.config as _core_config


def is_user_in_auth_v2_bucket(user_id: int) -> bool:
    """Bucketing déterministe : hash(user_id) % 100 < AUTH_V2_BUCKET_PERCENT.

    Permet rollout progressif sans redeploy :
        - AUTH_V2_ENABLED=false   → False pour tout le monde (V1 only)
        - AUTH_V2_BUCKET_PERCENT=0   → False pour tout le monde
        - AUTH_V2_BUCKET_PERCENT=10  → ~10% des users sont in-bucket
        - AUTH_V2_BUCKET_PERCENT=50  → ~50% des users sont in-bucket
        - AUTH_V2_BUCKET_PERCENT=100 → True pour tout le monde

    Le hash SHA-256 du `user_id` (en string) garantit que :
        - Un même user obtient toujours la même réponse (stabilité ; pas de flip-flop
          entre requêtes successives).
        - La distribution sur les buckets est ~uniforme (anti-skew sur les IDs
          séquentiels en DB).

    Lecture dynamique de la config via `_core_config.AUTH_V2_*` (pas un import figé
    au top du module) pour que les tests qui font `monkeypatch.setattr` ou
    `importlib.reload` voient bien la nouvelle valeur — pattern déjà appliqué dans
    `auth/dependencies.py:_jwt_config()` pour la même raison.

    Args:
        user_id: ID numérique de l'utilisateur.

    Returns:
        True si l'utilisateur est dans le bucket V2, False sinon.
    """
    if not _core_config.AUTH_V2_ENABLED:
        return False

    pct = max(0, min(100, _core_config.AUTH_V2_BUCKET_PERCENT))
    if pct == 100:
        return True
    if pct == 0:
        return False

    # Hash déterministe — SHA-256 sur la repr string de user_id. On prend les
    # 16 premiers hex chars (= 64 bits) puis on mod 100 ; largement assez
    # d'entropie pour une distribution uniforme.
    digest = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()
    bucket = int(digest[:16], 16) % 100
    return bucket < pct


def _parse_cutover_date(raw: str) -> Optional[datetime]:
    """Parse `AUTH_V2_CUTOVER_DATE` en datetime UTC tz-aware.

    Accepte :
        - "2026-05-22"            (date seule, interprétée comme 00:00 UTC)
        - "2026-05-22T00:00:00"   (datetime ISO sans tz, interprété UTC)
        - "2026-05-22T00:00:00Z"  (UTC explicite)
        - "2026-05-22T00:00:00+00:00"

    Returns None si raw est vide OU non parseable (log silencieux — pas de raise
    pour éviter de bloquer le boot si l'env est mal configurée).
    """
    if not raw:
        return None
    raw = raw.strip()
    # `fromisoformat` accepte "+00:00" mais pas le "Z" suffix en Python <3.11.
    # On normalise.
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    # Si naive, on l'interprète UTC (le seul cas valide pour un cutover global).
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def get_cutover_date() -> Optional[datetime]:
    """Retourne la `AUTH_V2_CUTOVER_DATE` parsée, ou None si non configurée."""
    return _parse_cutover_date(_core_config.AUTH_V2_CUTOVER_DATE)


def is_token_pre_cutover(iat: Optional[float]) -> bool:
    """Renvoie True si le token a été émis AVANT le cutover V2.

    Utilisé pour décider du flow legacy (V1) vs V2 sur un token donné. La
    sémantique est :
        - iat None ou cutover non configurée → False (pas pre-cutover ; on
          tombera sur le flow décidé par le bucket).
        - iat < cutover → True (flow legacy V1).
        - iat >= cutover → False (flow V2).

    Args:
        iat: claim `iat` du JWT (timestamp Unix epoch, float).

    Returns:
        True si pre-cutover, False sinon (ou si cutover non configurée).
    """
    if iat is None:
        return False
    cutover = get_cutover_date()
    if cutover is None:
        return False
    try:
        iat_dt = datetime.fromtimestamp(float(iat), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return False
    return iat_dt < cutover


def is_in_grace_period(now: Optional[datetime] = None) -> bool:
    """Renvoie True si on est dans la grace period post-cutover.

    Grace period = `AUTH_V2_GRACE_PERIOD_DAYS` jours après `AUTH_V2_CUTOVER_DATE`.
    Pendant cette fenêtre, les tokens V1 pre-cutover sont encore acceptés en
    parallèle des tokens V2. Au-delà, les V1 sont rejetés (force re-login).

    Args:
        now: optionnel — datetime tz-aware pour les tests. Défaut = now UTC.

    Returns:
        True si on est dans la fenêtre [cutover, cutover + grace_days].
        False si cutover non configurée OU si la grace est expirée.
    """
    cutover = get_cutover_date()
    if cutover is None:
        # Pas de cutover défini → pas de grace period applicable.
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    grace_end = cutover + timedelta(days=_core_config.AUTH_V2_GRACE_PERIOD_DAYS)
    return cutover <= now <= grace_end


def should_use_v2_for_token(user_id: int, iat: Optional[float]) -> bool:
    """Décide si un token donné (user + iat) doit être validé via le flow V2.

    Logique combinée bucket + cutover :

    1. AUTH_V2_ENABLED=false ou bucket=0%        → V1 (legacy)
    2. AUTH_V2_BUCKET_PERCENT=100                 → V2 systématique
    3. User dans le bucket :
       a. iat < cutover ET dans grace period     → V1 (legacy ; token pré-existant)
       b. iat >= cutover OU pas de cutover       → V2
       c. iat < cutover ET grace expirée         → V2 (force renewal côté V1 = reject implicite plus haut)
    4. User PAS dans le bucket                    → V1

    Args:
        user_id: ID de l'utilisateur (extrait du JWT.sub).
        iat: claim `iat` du JWT (timestamp Unix).

    Returns:
        True si le token doit être validé via le flow V2 (validate_session_v2).
        False si flow legacy V1 (validate_session_token).
    """
    if not is_user_in_auth_v2_bucket(user_id):
        return False

    # User dans le bucket V2. Si on a un cutover ET le token est pré-cutover ET
    # on est encore dans la grace period → on laisse le flow V1 finir tranquille.
    if is_token_pre_cutover(iat) and is_in_grace_period():
        return False

    return True
