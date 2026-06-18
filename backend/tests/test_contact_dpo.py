"""
DPO contact endpoint tests — happy path, honeypot, rate limit, validation.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


VALID_PAYLOAD = {
    "email": "user@example.com",
    "subject": "art_17_erasure",
    "message": "Je demande la suppression de toutes mes données personnelles.",
    "website": "",
}


def _make_request_mock(ip: str = "1.2.3.4") -> MagicMock:
    req = MagicMock()
    req.headers = {}
    req.client = MagicMock()
    req.client.host = ip
    return req


def _make_session_mock() -> AsyncMock:
    session = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_dpo_contact_success_calls_email_service():
    """Happy path → 202 Accepted + email queued + audit logged."""
    from contact.dpo_router import submit_dpo_contact, DPOContactRequest, DPOSubject, _requests

    _requests.clear()

    payload = DPOContactRequest(**VALID_PAYLOAD)
    req = _make_request_mock(ip="10.0.0.1")
    session = _make_session_mock()

    with patch("contact.dpo_router.email_service.send_email", new=AsyncMock(return_value=True)) as mock_send, patch(
        "contact.dpo_router.log_audit", new=AsyncMock()
    ) as mock_audit:
        result = await submit_dpo_contact(payload, req, session)

    assert result.success is True
    assert "30 jours" in result.message
    mock_send.assert_awaited_once()
    call_kwargs = mock_send.await_args.kwargs
    assert call_kwargs["to"] == "dpo@deepsightsynthesis.com"
    assert "[DPO Request]" in call_kwargs["subject"]
    assert "Art. 17" in call_kwargs["subject"]
    mock_audit.assert_awaited_once()
    audit_kwargs = mock_audit.await_args.kwargs
    assert audit_kwargs["action"] == "dpo.contact_request"
    assert audit_kwargs["details"]["subject"] == DPOSubject.ART_17_ERASURE.value
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_dpo_contact_honeypot_silent_no_email():
    """Honeypot filled → 202 success but NO email + NO audit."""
    from contact.dpo_router import submit_dpo_contact, DPOContactRequest, _requests

    _requests.clear()

    payload = DPOContactRequest(**{**VALID_PAYLOAD, "website": "https://spam.example.com"})
    req = _make_request_mock(ip="10.0.0.2")
    session = _make_session_mock()

    with patch("contact.dpo_router.email_service.send_email", new=AsyncMock(return_value=True)) as mock_send, patch(
        "contact.dpo_router.log_audit", new=AsyncMock()
    ) as mock_audit:
        result = await submit_dpo_contact(payload, req, session)

    assert result.success is True
    mock_send.assert_not_awaited()
    mock_audit.assert_not_awaited()


@pytest.mark.asyncio
async def test_dpo_contact_rate_limit_blocks_4th_request():
    """4 calls in <10 min same IP → 4th raises 429."""
    from fastapi import HTTPException

    from contact.dpo_router import submit_dpo_contact, DPOContactRequest, _requests

    _requests.clear()

    payload = DPOContactRequest(**VALID_PAYLOAD)
    req = _make_request_mock(ip="10.0.0.3")
    session = _make_session_mock()

    with patch("contact.dpo_router.email_service.send_email", new=AsyncMock(return_value=True)), patch(
        "contact.dpo_router.log_audit", new=AsyncMock()
    ):
        for i in range(3):
            result = await submit_dpo_contact(payload, req, session)
            assert result.success is True, f"call {i + 1} should pass"

        with pytest.raises(HTTPException) as excinfo:
            await submit_dpo_contact(payload, req, session)

    assert excinfo.value.status_code == 429
    assert "10 minutes" in excinfo.value.detail


@pytest.mark.asyncio
async def test_dpo_contact_email_service_failure_returns_503():
    """If email_service returns False → 503 Service Unavailable."""
    from fastapi import HTTPException

    from contact.dpo_router import submit_dpo_contact, DPOContactRequest, _requests

    _requests.clear()

    payload = DPOContactRequest(**VALID_PAYLOAD)
    req = _make_request_mock(ip="10.0.0.4")
    session = _make_session_mock()

    with patch("contact.dpo_router.email_service.send_email", new=AsyncMock(return_value=False)), patch(
        "contact.dpo_router.log_audit", new=AsyncMock()
    ):
        with pytest.raises(HTTPException) as excinfo:
            await submit_dpo_contact(payload, req, session)

    assert excinfo.value.status_code == 503


@pytest.mark.asyncio
async def test_dpo_contact_uses_x_forwarded_for_when_present():
    """X-Forwarded-For header → first IP used for rate-limit bucket."""
    from contact.dpo_router import submit_dpo_contact, DPOContactRequest, _requests, _client_ip

    _requests.clear()

    payload = DPOContactRequest(**VALID_PAYLOAD)
    req = MagicMock()
    req.headers = {"X-Forwarded-For": "203.0.113.42, 10.0.0.5"}
    req.client = MagicMock()
    req.client.host = "10.0.0.5"
    session = _make_session_mock()

    assert _client_ip(req) == "203.0.113.42"

    with patch("contact.dpo_router.email_service.send_email", new=AsyncMock(return_value=True)), patch(
        "contact.dpo_router.log_audit", new=AsyncMock()
    ):
        result = await submit_dpo_contact(payload, req, session)

    assert result.success is True
    assert "203.0.113.42" in _requests
