"""
Tests pour DELETE /api/auth/account — RGPD Article 17 (suppression sans délai indu).

Couvre la séquence :
1. Vérification mot de passe (skip pour comptes Google)
2. Purge R2 audio summaries par prefix (best-effort, non-blocking)
3. Invalidate session
4. Audit log
5. Cascade DELETE PG

Cas testés :
- A. Compte Google avec 3 summaries → R2 purge appelé 3× avec bons prefixes
- B. R2 lève Exception → cascade PG s'exécute quand même
- C. Compte sans summaries → pas d'appel R2, cascade PG OK
- D. Compte email avec mauvais mot de passe → 401, pas de purge ni cascade
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _google_user(user_id: int = 42, plan: str = "pro") -> MagicMock:
    user = MagicMock()
    user.id = user_id
    user.password_hash = ""  # compte Google → pas de password
    user.google_id = "google_xyz"
    user.plan = plan
    return user


def _email_user(user_id: int = 42, plan: str = "pro") -> MagicMock:
    user = MagicMock()
    user.id = user_id
    user.password_hash = "$2b$12$abcdef..."  # bcrypt hash
    user.google_id = ""
    user.plan = plan
    return user


def _session_with_summary_ids(ids: list[int]) -> AsyncMock:
    session = AsyncMock()
    scalar_result = MagicMock()
    scalar_result.all = MagicMock(return_value=ids)
    session.scalars = AsyncMock(return_value=scalar_result)
    session.delete = AsyncMock()
    session.commit = AsyncMock()
    return session


# ═══════════════════════════════════════════════════════════════════════════════
# Cas A — Compte Google avec summaries → R2 purgé par prefix
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_delete_account_purges_r2_for_each_summary():
    from auth.router import delete_account
    from auth.schemas import DeleteAccountRequest

    user = _google_user(user_id=42)
    session = _session_with_summary_ids([101, 102, 103])

    captured_prefixes: list[str] = []

    async def fake_delete(prefix: str) -> int:
        captured_prefixes.append(prefix)
        return 1

    with patch("storage.r2.delete_objects_by_prefix", side_effect=fake_delete), patch(
        "auth.router.invalidate_user_session", new=AsyncMock()
    ), patch("auth.router.log_audit", new=AsyncMock()):
        result = await delete_account(
            data=DeleteAccountRequest(password=None),
            current_user=user,
            session=session,
        )

    assert captured_prefixes == [
        "audio-summaries/101/",
        "audio-summaries/102/",
        "audio-summaries/103/",
    ]
    session.delete.assert_called_once_with(user)
    session.commit.assert_called_once()
    assert result.success is True


# ═══════════════════════════════════════════════════════════════════════════════
# Cas B — R2 indisponible → cascade PG continue (Article 17 prioritaire)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_delete_account_proceeds_when_r2_fails():
    from auth.router import delete_account
    from auth.schemas import DeleteAccountRequest

    user = _google_user(user_id=42)
    session = _session_with_summary_ids([101])

    async def r2_boom(prefix: str) -> int:
        raise RuntimeError("R2 unreachable")

    invalidate_mock = AsyncMock()
    audit_mock = AsyncMock()

    with patch("storage.r2.delete_objects_by_prefix", side_effect=r2_boom), patch(
        "auth.router.invalidate_user_session", new=invalidate_mock
    ), patch("auth.router.log_audit", new=audit_mock):
        result = await delete_account(
            data=DeleteAccountRequest(password=None),
            current_user=user,
            session=session,
        )

    # Tous les steps post-R2 doivent s'exécuter
    invalidate_mock.assert_awaited_once()
    audit_mock.assert_awaited_once()
    session.delete.assert_called_once_with(user)
    session.commit.assert_called_once()
    assert result.success is True


# ═══════════════════════════════════════════════════════════════════════════════
# Cas C — User sans summaries → aucun appel R2, cascade PG OK
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_delete_account_skips_r2_when_no_summaries():
    from auth.router import delete_account
    from auth.schemas import DeleteAccountRequest

    user = _google_user(user_id=42)
    session = _session_with_summary_ids([])

    captured_calls = 0

    async def fake_delete(prefix: str) -> int:
        nonlocal captured_calls
        captured_calls += 1
        return 0

    with patch("storage.r2.delete_objects_by_prefix", side_effect=fake_delete), patch(
        "auth.router.invalidate_user_session", new=AsyncMock()
    ), patch("auth.router.log_audit", new=AsyncMock()):
        result = await delete_account(
            data=DeleteAccountRequest(password=None),
            current_user=user,
            session=session,
        )

    assert captured_calls == 0
    session.delete.assert_called_once_with(user)
    assert result.success is True


# ═══════════════════════════════════════════════════════════════════════════════
# Cas D — Compte email avec mauvais mot de passe → 401, pas de purge
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_delete_account_wrong_password_blocks_everything():
    from fastapi import HTTPException
    from auth.router import delete_account
    from auth.schemas import DeleteAccountRequest

    user = _email_user(user_id=42)
    session = _session_with_summary_ids([101])

    captured_calls = 0

    async def fake_delete(prefix: str) -> int:
        nonlocal captured_calls
        captured_calls += 1
        return 1

    with patch("storage.r2.delete_objects_by_prefix", side_effect=fake_delete), patch(
        "auth.router.invalidate_user_session", new=AsyncMock()
    ), patch("auth.router.log_audit", new=AsyncMock()), patch(
        "db.database.verify_password", return_value=False
    ):
        with pytest.raises(HTTPException) as excinfo:
            await delete_account(
                data=DeleteAccountRequest(password="wrongpass"),
                current_user=user,
                session=session,
            )

    assert excinfo.value.status_code == 401
    assert captured_calls == 0
    session.delete.assert_not_called()
    session.commit.assert_not_called()
