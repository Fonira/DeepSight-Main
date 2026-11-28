"""Diagnostic des appels vocaux ElevenLabs, à lancer dans le conteneur backend.

    docker exec repo-backend-1 python -m voice.diagnostics
    docker exec repo-backend-1 python -m voice.diagnostics --no-call
    docker exec repo-backend-1 python -m voice.diagnostics --cleanup

Rejoue la création d'un appel comme POST /api/voice/session : outils
autonomes, agent privé, URL signée (web et extension) et jeton LiveKit
(mobile). Passe ensuite un appel de test de quelques secondes, puis supprime
l'agent et ses outils. N'affiche jamais la clé API ni le secret du webhook,
seulement leur longueur.

--cleanup supprime aussi les agents d'appel DeepSight restés sur le compte
(appels jamais raccrochés, webhook absent), plus vieux que --older-than-hours.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

if __name__ == "__main__":
    # En ligne de commande, le rapport suffit : pas de logs JSON, bannière de
    # démarrage de core.config comprise (d'où ce réglage avant les imports).
    logging.getLogger("deepsight").disabled = True

import httpx

from core.config import VOICE_CALL_DISABLED, _settings
from voice.elevenlabs import ElevenLabsAPIError, ElevenLabsClient

# Même repli que POST /api/voice/session quand ni l'utilisateur ni
# ELEVENLABS_VOICE_ID ne fixent la voix.
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
DIAGNOSTIC_AGENT_NAME = "DeepSight diagnostic"
# Noms donnés par /api/voice/session : « DeepSight <agent_type> <8 hex> ».
SESSION_AGENT_NAME = re.compile(r"^DeepSight [a-z_]+ [0-9a-f]{8}$")
CALL_TIMEOUT_SECONDS = 15.0

OK, WARN, FAIL, SKIP = "ok", "warn", "fail", "skip"
_MARKERS = {OK: "[OK]", WARN: "[!!]", FAIL: "[KO]", SKIP: "[--]"}

# Permission ElevenLabs → ligne à cocher dans Developers > API Keys.
_PERMISSION_LABELS = {
    "convai_read": "ElevenAgents en lecture",
    "convai_write": "ElevenAgents en écriture",
    "voices_read": "Voices en lecture",
    "user_read": "User en lecture",
}
_QUOTA_CODES = {"quota_exceeded", "insufficient_credits", "payment_required", "max_character_limit_exceeded"}


@dataclass
class Check:
    label: str
    status: str
    detail: str = ""
    hint: str = ""


def describe_error(exc: BaseException) -> str:
    if isinstance(exc, ElevenLabsAPIError):
        label = f"{exc.status_code} {exc.code}" if exc.code else str(exc.status_code)
        return f"{label} - {exc.message}"
    if isinstance(exc, httpx.HTTPError):
        return f"ElevenLabs injoignable depuis le serveur ({type(exc).__name__})"
    return f"{type(exc).__name__}: {exc}"


def hint_for(error: ElevenLabsAPIError) -> str:
    """Ce qu'il faut corriger, d'après la réponse d'ElevenLabs."""
    code = error.code or ""
    if code == "missing_permissions":
        match = re.search(r"permission ([a-z_]+)", error.message)
        permission = match.group(1) if match else ""
        label = _PERMISSION_LABELS.get(permission, permission or "indiquée dans le message")
        return f"Dans ElevenLabs > Developers > API Keys, modifie la clé : accès {label}."
    if code == "detected_unusual_activity":
        return (
            "ElevenLabs bloque l'usage gratuit depuis un serveur : passe le compte sur un "
            "abonnement payant (Starter suffit)."
        )
    if error.status_code == 402 or code in _QUOTA_CODES:
        return "Le compte ElevenLabs n'a plus de crédits ou de minutes : vérifie l'abonnement."
    if code == "voice_not_found" or (error.status_code == 404 and error.operation == "get_voice"):
        return (
            "Voix introuvable sur ce compte : choisis une voix dans ElevenLabs, mets son ID "
            "dans ELEVENLABS_VOICE_ID, puis recrée le backend."
        )
    if error.status_code in (401, 403):
        return "Clé refusée : recopie-la dans .env.production (sans guillemets ni espaces), puis recrée le backend."
    if error.status_code in (400, 422):
        return "ElevenLabs refuse la configuration envoyée : copie-moi cette ligne."
    if error.status_code == 429:
        return "Trop de requêtes ou d'appels simultanés : réessaie dans une minute."
    if error.status_code >= 500:
        return "Panne côté ElevenLabs : réessaie dans quelques minutes."
    return ""


def describe_call_error(exc: BaseException) -> str:
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return str(exc) or f"l'agent n'a pas parlé en {CALL_TIMEOUT_SECONDS:.0f} s"
    received = getattr(exc, "rcvd", None)
    if received is not None:
        reason = f" : {received.reason}" if received.reason else ""
        return f"connexion fermée par ElevenLabs (code {received.code}{reason})"
    return f"{type(exc).__name__}: {exc}"


# ── Configuration du conteneur ───────────────────────────────────────────────


def check_api_key(key: str) -> Check:
    label = "Clé API ElevenLabs"
    if not key:
        return Check(
            label,
            FAIL,
            "ELEVENLABS_API_KEY est vide dans le conteneur",
            "Ajoute ELEVENLABS_API_KEY=sk_... dans .env.production, puis recrée le backend.",
        )
    detail = f"présente ({len(key)} caractères)"
    problems = []
    if key != key.strip():
        problems.append("des espaces")
    if key.strip()[:1] in "\"'" or key.strip()[-1:] in "\"'":
        problems.append("des guillemets")
    if problems:
        return Check(
            label,
            FAIL,
            f"{detail}, avec {' et '.join(problems)}",
            "Retire-les dans .env.production (ELEVENLABS_API_KEY=sk_...), puis recrée le backend.",
        )
    if not key.startswith("sk_"):
        return Check(
            label,
            WARN,
            f"{detail}, mais ne commence pas par sk_",
            "Vérifie que c'est bien une clé de Developers > API Keys.",
        )
    return Check(label, OK, detail)


def check_webhook_secret(secret: str) -> Check:
    label = "Secret du webhook post-appel"
    if not secret:
        return Check(
            label,
            WARN,
            "ELEVENLABS_WEBHOOK_SECRET absent",
            "Sans webhook, les minutes ne sont pas décomptées et les agents restent sur le "
            "compte après l'appel. Crée le webhook dans ElevenLabs puis ajoute son secret.",
        )
    return Check(label, OK, f"présent ({len(secret)} caractères)")


def check_kill_switch(disabled: bool) -> Check:
    label = "Interrupteur VOICE_CALL_DISABLED"
    if disabled:
        return Check(label, WARN, "actif : seuls les admins peuvent appeler")
    return Check(label, OK, "inactif")


async def check_public_url(
    http: httpx.AsyncClient,
    label: str,
    url: str,
    reachable: set[int],
    hint: str,
) -> Check:
    """POST sans authentification : un refus de l'API prouve que la route arrive au backend."""
    try:
        response = await http.post(url, json={})
    except httpx.HTTPError as exc:
        return Check(label, FAIL, f"{url} injoignable ({type(exc).__name__})", hint)
    if response.status_code in reachable:
        return Check(label, OK, f"{url} répond ({response.status_code})")
    return Check(label, FAIL, f"{url} répond {response.status_code}", hint)


# ── Compte et appel ElevenLabs ───────────────────────────────────────────────


async def check_account(client: ElevenLabsClient) -> Check:
    label = "Compte ElevenLabs"
    try:
        subscription = await client.get_subscription()
    except ElevenLabsAPIError as exc:
        if exc.code == "missing_permissions":
            return Check(label, WARN, "clé acceptée, abonnement illisible (permission User absente)")
        return Check(label, FAIL, describe_error(exc), hint_for(exc))
    except httpx.HTTPError as exc:
        return Check(label, FAIL, describe_error(exc), "Vérifie l'accès sortant du serveur vers api.elevenlabs.io.")
    tier = str(subscription.get("tier") or "?")
    state = str(subscription.get("status") or "?")
    if tier == "free":
        return Check(
            label,
            WARN,
            f"clé acceptée, abonnement gratuit ({state})",
            "ElevenLabs bloque souvent l'usage gratuit depuis un serveur : Starter suffit pour tester.",
        )
    return Check(label, OK, f"clé acceptée, abonnement {tier} ({state})")


async def check_voice(client: ElevenLabsClient, voice_id: str) -> Check:
    label = "Voix par défaut"
    try:
        voice = await client.get_voice(voice_id)
    except ElevenLabsAPIError as exc:
        if exc.code == "missing_permissions":
            return Check(label, WARN, f"{voice_id} non vérifiée (permission Voices absente)")
        return Check(label, FAIL, f"{voice_id} : {describe_error(exc)}", hint_for(exc))
    except httpx.HTTPError as exc:
        return Check(label, FAIL, describe_error(exc))
    return Check(label, OK, f"{voice.get('name') or '?'} ({voice_id})")


async def probe_call(signed_url: str, timeout: float = CALL_TIMEOUT_SECONDS) -> str:
    """Ouvre la conversation, attend que l'agent prononce son premier message, raccroche."""
    import websockets

    started = time.monotonic()
    conversation_id = ""
    async with websockets.connect(signed_url, open_timeout=10, close_timeout=3, max_size=None) as ws:
        await ws.send(json.dumps({"type": "conversation_initiation_client_data"}))
        while True:
            remaining = timeout - (time.monotonic() - started)
            if remaining <= 0:
                raise TimeoutError(f"l'agent n'a pas parlé en {timeout:.0f} s")
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            if not isinstance(raw, str):
                continue
            event = json.loads(raw)
            kind = event.get("type")
            if kind == "conversation_initiation_metadata":
                metadata = event.get("conversation_initiation_metadata_event") or {}
                conversation_id = str(metadata.get("conversation_id") or "")
            elif kind == "ping":
                ping = event.get("ping_event") or {}
                await ws.send(json.dumps({"type": "pong", "event_id": ping.get("event_id")}))
            elif kind in ("audio", "agent_response"):
                elapsed = time.monotonic() - started
                suffix = f", conversation {conversation_id}" if conversation_id else ""
                return f"l'agent a parlé après {elapsed:.1f} s{suffix}"


async def check_call_flow(
    client: ElevenLabsClient,
    *,
    voice_id: str,
    app_url: str,
    call: bool,
    call_probe: Callable[[str], Awaitable[str]],
) -> list[Check]:
    """Agent privé + outils, URL signée, jeton LiveKit, appel de test, puis suppression."""
    checks: list[Check] = []
    tools = ElevenLabsClient.build_tools_config(webhook_base_url=app_url, api_token="0")
    agent_label = "Création d'un agent privé avec ses outils"
    try:
        agent_id = await client.create_conversation_agent(
            system_prompt="Tu es l'agent de test du diagnostic DeepSight. Réponds en une phrase.",
            tools=tools,
            voice_id=voice_id,
            first_message="Bonjour, ceci est un test des appels DeepSight.",
            language="fr",
            model_id="eleven_turbo_v2_5",
            voice_settings={"stability": 0.5, "similarity_boost": 0.75, "speed": 1.0},
            turn_config={"turn_timeout": 7, "turn_eagerness": "normal"},
            max_duration_seconds=60,
            name=DIAGNOSTIC_AGENT_NAME,
        )
    except ElevenLabsAPIError as exc:
        checks.append(Check(agent_label, FAIL, describe_error(exc), hint_for(exc)))
        return checks
    except httpx.HTTPError as exc:
        checks.append(Check(agent_label, FAIL, describe_error(exc)))
        return checks
    checks.append(Check(agent_label, OK, f"{len(tools)} outils"))

    try:
        signed_url: str | None = None
        try:
            signed_url, _ = await client.get_signed_url(agent_id)
            checks.append(Check("URL signée (web et extension)", OK, "obtenue"))
        except Exception as exc:  # noqa: BLE001 — le rapport doit aller au bout
            hint = hint_for(exc) if isinstance(exc, ElevenLabsAPIError) else ""
            checks.append(Check("URL signée (web et extension)", FAIL, describe_error(exc), hint))

        try:
            token, _ = await client.get_conversation_token(agent_id)
            if token:
                checks.append(Check("Jeton LiveKit (mobile)", OK, "obtenu"))
            else:
                checks.append(Check("Jeton LiveKit (mobile)", FAIL, "réponse sans jeton"))
        except Exception as exc:  # noqa: BLE001 — le rapport doit aller au bout
            hint = hint_for(exc) if isinstance(exc, ElevenLabsAPIError) else ""
            checks.append(Check("Jeton LiveKit (mobile)", FAIL, describe_error(exc), hint))

        if not call:
            checks.append(Check("Appel de test", SKIP, "désactivé (--no-call)"))
        elif signed_url:
            try:
                checks.append(Check("Appel de test", OK, await call_probe(signed_url)))
            except Exception as exc:  # noqa: BLE001 — le rapport doit aller au bout
                checks.append(
                    Check(
                        "Appel de test",
                        FAIL,
                        describe_call_error(exc),
                        "Copie-moi cette ligne : elle donne la raison côté ElevenLabs.",
                    )
                )
        else:
            checks.append(Check("Appel de test", SKIP, "pas d'URL signée"))
    finally:
        deleted = await client.delete_agent(agent_id)
        if deleted:
            checks.append(Check("Suppression de l'agent de test et de ses outils", OK))
        else:
            checks.append(
                Check(
                    "Suppression de l'agent de test et de ses outils",
                    WARN,
                    f"agent {agent_id} à supprimer dans le dashboard ElevenLabs",
                )
            )
    return checks


async def cleanup_session_agents(client: ElevenLabsClient, older_than_hours: float) -> Check:
    """Supprime les agents d'appel DeepSight plus vieux que la limite (avec leurs outils)."""
    label = f"Nettoyage des agents DeepSight de plus de {older_than_hours:g} h"
    cutoff = time.time() - older_than_hours * 3600
    to_delete: list[str] = []
    recent = 0
    cursor: str | None = None
    try:
        for _ in range(20):  # 20 pages de 100 agents au plus
            page = await client.list_agents(search="DeepSight", cursor=cursor)
            for agent in page.get("agents") or []:
                name = str(agent.get("name") or "")
                if not (SESSION_AGENT_NAME.match(name) or name == DIAGNOSTIC_AGENT_NAME):
                    continue
                created = agent.get("created_at_unix_secs") or 0
                if created and created < cutoff:
                    to_delete.append(str(agent["agent_id"]))
                else:
                    recent += 1
            cursor = page.get("next_cursor")
            if not page.get("has_more") or not cursor:
                break
    except (ElevenLabsAPIError, httpx.HTTPError) as exc:
        hint = hint_for(exc) if isinstance(exc, ElevenLabsAPIError) else ""
        return Check(label, FAIL, describe_error(exc), hint)

    failed = 0
    for agent_id in to_delete:
        if not await client.delete_agent(agent_id):
            failed += 1
    detail = f"{len(to_delete) - failed} supprimé(s), {recent} récent(s) gardé(s)"
    if failed:
        return Check(label, WARN, f"{detail}, {failed} échec(s)")
    return Check(label, OK, detail)


# ── Orchestration ────────────────────────────────────────────────────────────


def _default_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=10.0, follow_redirects=False)


async def run(
    *,
    call: bool = True,
    cleanup: bool = False,
    older_than_hours: float = 3.0,
    client_factory: Callable[[str], ElevenLabsClient] = ElevenLabsClient,
    http_factory: Callable[[], httpx.AsyncClient] = _default_http_client,
    call_probe: Callable[[str], Awaitable[str]] = probe_call,
) -> list[Check]:
    checks: list[Check] = []
    key = _settings.ELEVENLABS_API_KEY or ""
    key_check = check_api_key(key)
    checks.append(key_check)
    checks.append(check_webhook_secret(_settings.ELEVENLABS_WEBHOOK_SECRET or ""))
    checks.append(check_kill_switch(VOICE_CALL_DISABLED))

    app_url = (_settings.APP_URL or "").rstrip("/")
    api_url = (_settings.API_PUBLIC_URL or app_url).rstrip("/")
    async with http_factory() as http:
        checks.append(
            await check_public_url(
                http,
                "Outils de l'agent (APP_URL)",
                f"{app_url}/api/voice/tools/search-transcript",
                {401, 403, 422, 429},
                "Les outils appellent APP_URL/api/voice/tools/... : APP_URL doit être "
                "https://api.deepsightsynthesis.com dans .env.production.",
            )
        )
        checks.append(
            await check_public_url(
                http,
                "URL du webhook post-appel",
                f"{api_url}/api/voice/webhook",
                {400, 401, 503},
                "ElevenLabs doit pouvoir joindre /api/voice/webhook : vérifie Caddy et le DNS.",
            )
        )

    if key_check.status == FAIL:
        checks.append(Check("Appel ElevenLabs", SKIP, "pas de clé utilisable"))
        return checks

    async with client_factory(key) as client:
        account = await check_account(client)
        checks.append(account)
        if account.status == FAIL:
            checks.append(Check("Appel ElevenLabs", SKIP, "la clé est refusée"))
            return checks
        voice_id = _settings.ELEVENLABS_VOICE_ID or DEFAULT_VOICE_ID
        checks.append(await check_voice(client, voice_id))
        checks.extend(
            await check_call_flow(client, voice_id=voice_id, app_url=app_url, call=call, call_probe=call_probe)
        )
        if cleanup:
            checks.append(await cleanup_session_agents(client, older_than_hours))
    return checks


def render(checks: list[Check]) -> str:
    lines = ["DeepSight - diagnostic des appels vocaux ElevenLabs", "=" * 52]
    for check in checks:
        line = f"{_MARKERS[check.status]} {check.label}"
        if check.detail:
            line += f" : {check.detail}"
        lines.append(line)
        if check.hint:
            lines.append(f"     -> {check.hint}")
    failures = sum(check.status == FAIL for check in checks)
    warnings = sum(check.status == WARN for check in checks)
    lines.append("")
    if failures:
        lines.append(f"Bilan : {failures} erreur(s) bloquante(s), {warnings} avertissement(s).")
    else:
        lines.append(f"Bilan : les appels vocaux peuvent démarrer ({warnings} avertissement(s)).")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m voice.diagnostics",
        description="Vérifie la configuration ElevenLabs des appels vocaux DeepSight.",
    )
    parser.add_argument("--no-call", action="store_true", help="ne pas passer l'appel de test")
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="supprimer les agents d'appel DeepSight restés sur le compte",
    )
    parser.add_argument(
        "--older-than-hours",
        type=float,
        default=3.0,
        help="âge minimum des agents supprimés par --cleanup (3 h par défaut)",
    )
    args = parser.parse_args(argv)

    logging.getLogger("deepsight").disabled = True
    checks = asyncio.run(run(call=not args.no_call, cleanup=args.cleanup, older_than_hours=args.older_than_hours))
    print(render(checks), flush=True)
    return 1 if any(check.status == FAIL for check in checks) else 0


if __name__ == "__main__":
    sys.exit(main())
