"""
ElevenLabs Conversational AI Client — DeepSight Voice Chat
Phase 2 kickstart — API client for agent creation and signed URL generation.

Uses the ElevenLabs Conversational AI API:
https://elevenlabs.io/docs/api-reference/conversational-ai

# HARD-PIN: ElevenLabs only for voice-call (see backend/docs/architecture/tts-policy.md)
# This module is the single entry point for Quick Voice Call agent creation.
# Voice-call routes (`/api/voice/session`, companion, debate) MUST NOT route
# through `tts.providers.get_tts_provider()` (which would let the
# Voxtral/OpenAI fallback chain handle conversational voice — breaking the
# < 200ms latency requirement). Phase 7 of the Mistral-First migration.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx

from core.logging import logger


# ═══════════════════════════════════════════════════════════════════════════════
# HARD-PIN constants — voice-call provider policy (Phase 7 / 2026-05-02)
# ═══════════════════════════════════════════════════════════════════════════════

# The single TTS provider authorised on Quick Voice Call routes. Any change
# requires explicit product validation — see backend/docs/architecture/tts-policy.md.
VOICE_CALL_PROVIDER: str = "elevenlabs"

# Whitelist of ElevenLabs model_ids accepted by the conversational agent
# creator. Mirrors the Pydantic validator in voice/schemas.py — duplicated
# here on purpose so a future contributor cannot bypass the schema by calling
# `create_conversation_agent` directly with a non-ElevenLabs model.
ALLOWED_VOICE_CALL_MODELS: frozenset[str] = frozenset(
    {
        "eleven_flash_v2_5",  # ~150ms first-byte — recommended
        "eleven_turbo_v2_5",  # ~300ms — current default
        "eleven_multilingual_v2",  # higher quality, higher latency
    }
)

# Bounds ElevenLabs accepts for conversation.max_duration_seconds.
MIN_CALL_DURATION_SECONDS: int = 60
MAX_CALL_DURATION_SECONDS: int = 7200

# Vitesse de voix acceptée par les agents ElevenLabs (curseur 0,7–1,2 du
# dashboard). Les presets plus rapides passent par le playback_rate client.
MIN_TTS_SPEED: float = 0.7
MAX_TTS_SPEED: float = 1.2

# Champs de conversation_config.turn que l'on transmet. Le schéma TurnConfig
# n'a plus de champ `mode` : le push-to-talk se fait côté client (micro coupé
# hors appui), le serveur garde sa détection de fin de tour.
_TURN_CONFIG_KEYS: frozenset[str] = frozenset(
    {"turn_timeout", "turn_eagerness", "silence_end_call_timeout", "initial_wait_time"}
)


class ElevenLabsAPIError(Exception):
    """ElevenLabs a refusé une requête : statut HTTP, code et message renvoyés par l'API."""

    def __init__(self, operation: str, status_code: int, code: str | None, message: str) -> None:
        self.operation = operation
        self.status_code = status_code
        self.code = code
        self.message = message
        label = f"{status_code} {code}" if code else str(status_code)
        super().__init__(f"ElevenLabs {operation} failed ({label}): {message}")

    @property
    def is_config_error(self) -> bool:
        """Clé refusée ou permission manquante : un problème de configuration, pas une panne."""
        return self.status_code in (401, 403)


def _error_from_response(response: httpx.Response, operation: str) -> ElevenLabsAPIError:
    """Extrait le code et le message d'une réponse d'erreur ElevenLabs.

    Formats rencontrés : ``{"detail": {"status": ..., "message": ...}}``,
    ``{"detail": [{"loc": [...], "msg": ..., "type": ...}]}`` (validation 422)
    et ``{"detail": "texte"}``. Ces corps ne contiennent pas la clé API.
    """
    code: str | None = None
    message = ""
    try:
        payload: Any = response.json()
    except ValueError:
        payload = None
    detail = payload.get("detail") if isinstance(payload, dict) else None
    if isinstance(detail, dict):
        raw_code = detail.get("status") or detail.get("code")
        code = str(raw_code) if raw_code else None
        message = str(detail.get("message") or detail)
    elif isinstance(detail, list):
        parts: list[str] = []
        for item in detail[:5]:
            if isinstance(item, dict):
                location = ".".join(str(part) for part in item.get("loc", []) if part != "body")
                text = str(item.get("msg", ""))
                parts.append(f"{location}: {text}" if location else text)
                if code is None and item.get("type"):
                    code = str(item["type"])
            else:
                parts.append(str(item))
        message = " ; ".join(parts)
    elif detail is not None:
        message = str(detail)
    elif payload is not None:
        message = str(payload)
    if not message:
        message = response.text or "empty response body"
    return ElevenLabsAPIError(operation, response.status_code, code, message[:500])


def _ensure_success(response: httpx.Response, operation: str) -> None:
    """Lève ElevenLabsAPIError (et la journalise) si la réponse n'est pas un 2xx."""
    if 200 <= response.status_code < 300:
        return
    error = _error_from_response(response, operation)
    logger.error(
        "elevenlabs.request_failed",
        operation=operation,
        status=error.status_code,
        code=error.code,
        detail=error.message,
    )
    raise error


class ElevenLabsClient:
    """Async client for the ElevenLabs Conversational AI API."""

    BASE_URL = "https://api.elevenlabs.io/v1"

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"xi-api-key": api_key},
            timeout=30.0,
        )

    async def __aenter__(self) -> "ElevenLabsClient":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Agent lifecycle
    # ------------------------------------------------------------------

    async def create_conversation_agent(
        self,
        system_prompt: str,
        tools: list[dict],
        voice_id: str,
        first_message: Optional[str] = None,
        language: str = "fr",
        model_id: str = "eleven_flash_v2_5",
        voice_settings: Optional[dict] = None,
        turn_config: Optional[dict] = None,
        max_duration_seconds: int | None = None,
        name: str | None = None,
    ) -> str:
        """Create a private conversational AI agent and return its agent_id.

        Les outils webhook sont créés comme outils autonomes (POST /convai/tools)
        puis référencés par ``prompt.tool_ids`` : depuis juillet 2025, ElevenLabs
        refuse les créations d'agent qui contiennent ``prompt.tools``. Si la
        création de l'agent échoue, les outils déjà créés sont supprimés.

        Args:
            tools: webhook tool configs (from the ``build_*_tools_config`` builders).
            model_id: ElevenLabs TTS model (eleven_flash_v2_5, eleven_turbo_v2_5, eleven_multilingual_v2).
            voice_settings: user voice settings; only stability, similarity_boost and
                speed exist on agents (speed clamped to 0.7–1.2).
            turn_config: turn settings; only the keys of ``_TURN_CONFIG_KEYS`` are sent.
            max_duration_seconds: ElevenLabs ends the conversation at this duration
                (``conversation_config.conversation.max_duration_seconds``), clamped to
                the 60–7200 s the API accepts. None keeps ElevenLabs' default (600 s).
            name: agent name shown in the ElevenLabs dashboard.

        Raises:
            ValueError: invalid model_id (HARD-PIN).
            ElevenLabsAPIError: ElevenLabs refused a tool or the agent (status, code, message).
        """
        # HARD-PIN: ElevenLabs only for voice-call (see tts-policy.md)
        # Defence in depth — even if a caller bypasses the Pydantic schema in
        # voice/schemas.py, this guard prevents a non-ElevenLabs model from
        # reaching the ElevenLabs API (which would 4xx anyway, but the explicit
        # error here is clearer and observable).
        if model_id not in ALLOWED_VOICE_CALL_MODELS:
            logger.error(
                "voice_call.hard_pin_violation",
                extra={
                    "rejected_model": model_id,
                    "allowed": sorted(ALLOWED_VOICE_CALL_MODELS),
                },
            )
            raise ValueError(
                f"Voice-call provider is hard-pinned to ElevenLabs. "
                f"model_id={model_id!r} is not allowed. "
                f"See backend/docs/architecture/tts-policy.md."
            )
        # ── TTS config — only the fields of TTSConversationalConfig ──
        # (style, use_speaker_boost and optimize_streaming_latency are not
        # agent settings: style/speaker boost don't exist there, the latency
        # option is a deprecated no-op).
        tts_config: dict = {
            "voice_id": voice_id,
            "model_id": model_id,
        }
        if voice_settings:
            for key in ("stability", "similarity_boost"):
                value = voice_settings.get(key)
                if value is not None:
                    tts_config[key] = min(max(float(value), 0.0), 1.0)
            speed = voice_settings.get("speed")
            if speed is not None:
                tts_config["speed"] = min(max(float(speed), MIN_TTS_SPEED), MAX_TTS_SPEED)

        body: dict = {
            "conversation_config": {
                "agent": {
                    "prompt": {"prompt": system_prompt},
                    "first_message": first_message or "",
                    "language": language,
                },
                "tts": tts_config,
            },
            # Agent privé : une conversation ne démarre qu'avec l'URL signée ou
            # le jeton LiveKit que notre API obtient avec la clé. Sinon l'agent_id
            # renvoyé au client suffisait à ouvrir des appels hors quota.
            "platform_settings": {"auth": {"enable_auth": True}},
        }
        if name:
            body["name"] = name

        if turn_config:
            turn = {key: value for key, value in turn_config.items() if key in _TURN_CONFIG_KEYS}
            if turn:
                body["conversation_config"]["turn"] = turn

        # Hard cap enforced by ElevenLabs: the agent hangs up at the limit, so
        # a call cannot outlast the user's quota even if the client ignores it.
        if max_duration_seconds is not None:
            body["conversation_config"]["conversation"] = {
                "max_duration_seconds": min(
                    max(int(max_duration_seconds), MIN_CALL_DURATION_SECONDS),
                    MAX_CALL_DURATION_SECONDS,
                ),
            }

        logger.info(
            "elevenlabs.create_agent",
            voice_id=voice_id,
            model_id=model_id,
            language=language,
            tools=len(tools),
        )

        tool_ids = await self._create_tools(tools)
        if tool_ids:
            body["conversation_config"]["agent"]["prompt"]["tool_ids"] = tool_ids

        try:
            response = await self._client.post("/convai/agents/create", json=body)
            _ensure_success(response, "create_agent")
            agent_id: str = response.json()["agent_id"]
        except Exception:
            # L'agent n'existe pas : ses outils resteraient orphelins.
            await self._delete_tools(tool_ids)
            raise

        logger.info("elevenlabs.agent_created", agent_id=agent_id, tools=len(tool_ids))
        return agent_id

    # ------------------------------------------------------------------
    # Standalone tools (prompt.tool_ids)
    # ------------------------------------------------------------------

    async def create_tool(self, tool_config: dict) -> str:
        """Create a standalone workspace tool and return its id."""
        operation = f"create_tool:{tool_config.get('name', '?')}"
        response = await self._client.post("/convai/tools", json={"tool_config": tool_config})
        _ensure_success(response, operation)
        tool_id = response.json().get("id")
        if not tool_id:
            raise ElevenLabsAPIError(operation, response.status_code, "missing_id", "response has no tool id")
        return str(tool_id)

    async def delete_tool(self, tool_id: str) -> bool:
        """Delete a standalone tool. A tool that no longer exists counts as deleted."""
        try:
            response = await self._client.delete(f"/convai/tools/{tool_id}")
        except httpx.HTTPError as exc:
            logger.warning("elevenlabs.delete_tool_error", tool_id=tool_id, error=str(exc))
            return False
        if 200 <= response.status_code < 300 or response.status_code == 404:
            return True
        logger.warning("elevenlabs.delete_tool_failed", tool_id=tool_id, status=response.status_code)
        return False

    async def _create_tools(self, tools: list[dict]) -> list[str]:
        """Create the tools in parallel; if one fails, delete the others and re-raise."""
        if not tools:
            return []
        results = await asyncio.gather(*(self.create_tool(tool) for tool in tools), return_exceptions=True)
        created = [result for result in results if isinstance(result, str)]
        failure = next((result for result in results if isinstance(result, BaseException)), None)
        if failure is not None:
            await self._delete_tools(created)
            raise failure
        return created

    async def _delete_tools(self, tool_ids: list[str]) -> None:
        if tool_ids:
            await asyncio.gather(*(self.delete_tool(tool_id) for tool_id in tool_ids))

    async def get_agent_tool_ids(self, agent_id: str) -> list[str]:
        """Tool ids referenced by an agent ([] if the agent can't be read)."""
        try:
            response = await self._client.get(f"/convai/agents/{agent_id}")
        except httpx.HTTPError as exc:
            logger.warning("elevenlabs.get_agent_error", agent_id=agent_id, error=str(exc))
            return []
        if not 200 <= response.status_code < 300:
            return []
        try:
            prompt = response.json()["conversation_config"]["agent"]["prompt"]
        except (ValueError, KeyError, TypeError):
            return []
        tool_ids = prompt.get("tool_ids") if isinstance(prompt, dict) else None
        return [tool_id for tool_id in tool_ids or [] if isinstance(tool_id, str)]

    # ------------------------------------------------------------------
    # Account checks (used by voice.diagnostics)
    # ------------------------------------------------------------------

    async def get_subscription(self) -> dict:
        response = await self._client.get("/user/subscription")
        _ensure_success(response, "get_subscription")
        return response.json()

    async def get_voice(self, voice_id: str) -> dict:
        response = await self._client.get(f"/voices/{voice_id}")
        _ensure_success(response, "get_voice")
        return response.json()

    async def list_agents(self, *, search: str | None = None, cursor: str | None = None, page_size: int = 100) -> dict:
        params: dict[str, Any] = {"page_size": page_size}
        if search:
            params["search"] = search
        if cursor:
            params["cursor"] = cursor
        response = await self._client.get("/convai/agents", params=params)
        _ensure_success(response, "list_agents")
        return response.json()

    async def get_signed_url(self, agent_id: str) -> tuple[str, str]:
        """Get a signed WebSocket URL for a conversation session.

        Returns:
            (signed_url, expires_at_iso)
        """
        logger.info("elevenlabs.get_signed_url", extra={"agent_id": agent_id})

        response = await self._client.get(
            "/convai/conversation/get-signed-url",
            params={"agent_id": agent_id},
        )
        _ensure_success(response, "get_signed_url")

        data = response.json()
        return data["signed_url"], data.get("expires_at", "")

    async def get_conversation_token(self, agent_id: str) -> tuple[str, str]:
        """Get a LiveKit JWT conversation token for WebRTC-based clients.

        Used by the ElevenLabs React Native SDK (and other WebRTC clients),
        which require a LiveKit token instead of the WebSocket signed URL.

        API: GET /v1/convai/conversation/token?agent_id={agent_id}

        Returns:
            (token, expires_at_iso) — token is a LiveKit-compatible JWT.

        Raises:
            ElevenLabsAPIError: on 4xx/5xx. The caller is expected to
                gracefully degrade to signed_url-only when this fails.
        """
        logger.info("elevenlabs.get_conversation_token", extra={"agent_id": agent_id})

        response = await self._client.get(
            "/convai/conversation/token",
            params={"agent_id": agent_id},
        )
        _ensure_success(response, "get_conversation_token")

        data = response.json()
        token: str = data.get("token") or data.get("conversation_token") or ""
        if not token:
            logger.warning(
                "elevenlabs.conversation_token_missing",
                extra={"agent_id": agent_id, "keys": list(data.keys())},
            )
        return token, data.get("expires_at", "")

    async def delete_agent(self, agent_id: str, *, delete_tools: bool = True) -> bool:
        """Delete an agent, then the standalone tools it referenced.

        Returns True when the agent is gone (deleted now, or already absent),
        False otherwise. Tools are only deleted once the agent no longer exists.
        """
        logger.info("elevenlabs.delete_agent", extra={"agent_id": agent_id})
        tool_ids = await self.get_agent_tool_ids(agent_id) if delete_tools else []
        try:
            response = await self._client.delete(f"/convai/agents/{agent_id}")
        except httpx.HTTPError as exc:
            logger.warning(
                "elevenlabs.delete_agent_error",
                extra={"agent_id": agent_id, "error": str(exc)},
            )
            return False
        if not (200 <= response.status_code < 300 or response.status_code == 404):
            logger.warning(
                "elevenlabs.delete_agent_failed",
                extra={"agent_id": agent_id, "status": response.status_code},
            )
            return False
        await self._delete_tools(tool_ids)
        logger.info("elevenlabs.agent_deleted", agent_id=agent_id, tools=len(tool_ids))
        return True

    # ------------------------------------------------------------------
    # Prompt & tool builders (static)
    # ------------------------------------------------------------------

    @staticmethod
    def build_system_prompt(
        video_title: str,
        channel_name: str,
        duration: str,
        context_block: str = "",
        language: str = "fr",
        # Legacy compat — ignored if context_block is provided
        summary_content: str = "",
    ) -> str:
        """Build the system prompt injected into the ElevenLabs agent.

        Args:
            context_block: Rich context assembled by context_builder.build_rich_context().
                           Contains: metadata, full analysis, transcript (adaptive),
                           fact-check, enrichment, academic papers, entities.
            summary_content: DEPRECATED — legacy fallback if context_block is empty.
        """
        # Fallback : si pas de context_block, utiliser l'ancien format
        if not context_block:
            context_block = (
                f"## Vidéo\n"
                f"Titre : {video_title}\n"
                f"Chaîne : {channel_name}\n"
                f"Durée : {duration}\n\n"
                f"## Résumé\n"
                f"{summary_content}"
            )

        if language == "fr":
            return (
                "Tu es l'assistant vocal DeepSight. Tu aides l'utilisateur "
                "à comprendre et explorer en profondeur le contenu d'une vidéo.\n\n"
                "# TON CONTEXTE COMPLET\n"
                "Tu as accès à TOUTES les données suivantes sur la vidéo. "
                "Utilise-les pour répondre avec précision. "
                "Tu connais le transcript, l'analyse, les vérifications de faits, "
                "les recherches complémentaires et les références académiques.\n\n"
                f"{context_block}\n\n"
                "# RÈGLES DE COMPORTEMENT\n"
                "- Réponses courtes (2-4 phrases) sauf si on te demande de détailler\n"
                "- N'invente JAMAIS de contenu. Tu as le transcript et l'analyse — cite-les.\n"
                "- Si on te pose une question factuelle, cherche d'abord dans le transcript et l'analyse ci-dessus.\n"
                "- Utilise search_in_transcript UNIQUEMENT si tu as besoin d'un passage précis non présent dans ton contexte.\n"
                "- Utilise get_sources pour les questions de fiabilité ou de fact-check.\n"
                '- Si "interroge-moi" ou "quiz" → utilise get_flashcards.\n'
                "- Si hors sujet → ramène vers la vidéo.\n"
                "- Ton naturel, expert mais accessible. Tutoie l'utilisateur.\n"
                "- Si le transcript est partiel (vidéo longue), dis-le et propose d'utiliser search_in_transcript.\n"
                "- Cite les timecodes quand c'est pertinent.\n"
                "- Compatible YouTube, TikTok et texte collé."
            )

        # English fallback
        return (
            "You are the DeepSight voice assistant. You help the user "
            "understand and deeply explore video content.\n\n"
            "# YOUR FULL CONTEXT\n"
            "You have access to ALL of the following data about the video. "
            "Use it to answer accurately. "
            "You know the transcript, analysis, fact-checks, "
            "complementary research, and academic references.\n\n"
            f"{context_block}\n\n"
            "# BEHAVIOR RULES\n"
            "- Keep answers short (2-4 sentences) unless asked to elaborate\n"
            "- NEVER make up content. You have the transcript and analysis — cite them.\n"
            "- For factual questions, search your context (transcript + analysis) first.\n"
            "- Use search_in_transcript ONLY if you need a specific passage not in your context.\n"
            "- Use get_sources for reliability or fact-check questions.\n"
            '- If "quiz me" → use get_flashcards.\n'
            "- If off-topic → steer back to the video.\n"
            "- Natural tone, expert but approachable.\n"
            "- If transcript is partial (long video), say so and offer to use search_in_transcript.\n"
            "- Cite timecodes when relevant.\n"
            "- Compatible with YouTube, TikTok, and pasted text."
        )

    @staticmethod
    def build_tools_config(webhook_base_url: str, api_token: str) -> list[dict]:
        """Return the ElevenLabs server-tool definitions (webhook format).

        IMPORTANT: summary_id is injected as a `constant_value` (server-side, not
        provided by the LLM). This is required because the agent has no way to know
        the summary_id from its context, and the backend rejects mismatching tokens.
        """
        auth_headers = {"Authorization": f"Bearer {api_token}"}

        # ElevenLabs schema rule: when constant_value is set, no other field
        # (description, dynamic_variable, is_system_provided) can be set.
        summary_id_const = {"type": "string", "constant_value": str(api_token)}

        def _webhook_tool(
            name: str,
            description: str,
            url_path: str,
            body_schema: dict,
        ) -> dict:
            """Build an ElevenLabs webhook tool in the April 2026 API format."""
            return {
                "type": "webhook",
                "name": name,
                "description": description,
                "api_schema": {
                    "url": f"{webhook_base_url}{url_path}",
                    "method": "POST",
                    "request_headers": auth_headers,
                    "request_body_schema": body_schema,
                },
            }

        return [
            _webhook_tool(
                name="search_in_transcript",
                description=(
                    "Search the video transcript for an exact passage or keyword. "
                    "Returns matching excerpts with timestamps."
                ),
                url_path="/api/voice/tools/search-transcript",
                body_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query (keyword or phrase)",
                        },
                        "summary_id": summary_id_const,
                    },
                    "required": ["query"],
                },
            ),
            _webhook_tool(
                name="get_analysis_section",
                description=(
                    "Retrieve a specific section of the video analysis (e.g. key_points, arguments, conclusion)."
                ),
                url_path="/api/voice/tools/analysis-section",
                body_schema={
                    "type": "object",
                    "properties": {
                        "section": {
                            "type": "string",
                            "description": "Section name (key_points, arguments, conclusion, context, etc.)",
                        },
                        "summary_id": summary_id_const,
                    },
                    "required": ["section"],
                },
            ),
            _webhook_tool(
                name="get_sources",
                description=("Get fact-check sources and reliability information for the claims made in the video."),
                url_path="/api/voice/tools/sources",
                body_schema={
                    "type": "object",
                    "properties": {
                        "claim": {
                            "type": "string",
                            "description": "The specific claim to verify (optional, returns all if omitted)",
                        },
                        "summary_id": summary_id_const,
                    },
                    "required": [],
                },
            ),
            _webhook_tool(
                name="get_flashcards",
                description=(
                    "Get study flashcards generated from the video analysis. "
                    "Use when the user wants to be quizzed or review key concepts."
                ),
                url_path="/api/voice/tools/flashcards",
                body_schema={
                    "type": "object",
                    "properties": {
                        "summary_id": summary_id_const,
                        "count": {
                            "type": "integer",
                            "description": "Number of flashcards to return (default 5)",
                        },
                    },
                    "required": [],
                },
            ),
            _webhook_tool(
                name="web_search",
                description=(
                    "Search the web for current information about a topic. "
                    "Use SYSTEMATICALLY when the user asks about recent events, news, "
                    "facts not in the video, or when you are unsure of an answer. "
                    "Cite sources briefly to the user."
                ),
                url_path="/api/voice/tools/web-search",
                body_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The web search query",
                        },
                        "summary_id": summary_id_const,
                    },
                    "required": ["query"],
                },
            ),
            _webhook_tool(
                name="deep_research",
                description=(
                    "Perform in-depth web research combining multiple search queries. "
                    "Use for complex questions requiring comprehensive analysis."
                ),
                url_path="/api/voice/tools/deep-research",
                body_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The research query or topic",
                        },
                        "summary_id": summary_id_const,
                    },
                    "required": ["query"],
                },
            ),
            _webhook_tool(
                name="check_fact",
                description=("Verify a factual claim by searching the web for supporting or contradicting evidence."),
                url_path="/api/voice/tools/check-fact",
                body_schema={
                    "type": "object",
                    "properties": {
                        "claim": {
                            "type": "string",
                            "description": "The factual claim to verify",
                        },
                        "summary_id": summary_id_const,
                    },
                    "required": ["claim"],
                },
            ),
        ]

    @staticmethod
    def build_debate_tools_config(webhook_base_url: str, api_token: str) -> list[dict]:
        """Return the ElevenLabs webhook-tool definitions for the debate_moderator agent.

        IMPORTANT: debate_id is injected as a `constant_value` (server-side). The LLM
        does not provide it — the backend would reject mismatching tokens otherwise.
        """
        auth_headers = {"Authorization": f"Bearer {api_token}"}

        # ElevenLabs schema rule: constant_value cannot coexist with description/etc.
        debate_id_const = {"type": "string", "constant_value": str(api_token)}

        def _webhook_tool(name: str, description: str, url_path: str, body_schema: dict) -> dict:
            return {
                "type": "webhook",
                "name": name,
                "description": description,
                "api_schema": {
                    "url": f"{webhook_base_url}{url_path}",
                    "method": "POST",
                    "request_headers": auth_headers,
                    "request_body_schema": body_schema,
                },
            }

        return [
            _webhook_tool(
                name="get_debate_overview",
                description="Get the debate topic, both video theses, and the cross-analysis summary. Use at session start or when the user asks for a recap.",
                url_path="/api/voice/tools/debate-overview",
                body_schema={
                    "type": "object",
                    "properties": {"debate_id": debate_id_const},
                    "required": [],
                },
            ),
            _webhook_tool(
                name="get_video_thesis",
                description="Get the full thesis and key arguments of one specific video (video_a or video_b). Use when the user asks about one side.",
                url_path="/api/voice/tools/debate-thesis",
                body_schema={
                    "type": "object",
                    "properties": {
                        "debate_id": debate_id_const,
                        "side": {"type": "string", "description": "Which video: 'video_a' or 'video_b'"},
                    },
                    "required": ["side"],
                },
            ),
            _webhook_tool(
                name="get_argument_comparison",
                description="Compare the arguments of both videos on a specific sub-topic (e.g. 'price', 'audio quality'). Leave topic empty to get all divergence and convergence points.",
                url_path="/api/voice/tools/debate-compare",
                body_schema={
                    "type": "object",
                    "properties": {
                        "debate_id": debate_id_const,
                        "topic": {"type": "string", "description": "Sub-topic to compare (optional)"},
                    },
                    "required": [],
                },
            ),
            _webhook_tool(
                name="search_in_debate_transcript",
                description="Search for a passage or keyword in the transcripts of both videos (or a specific one). Use when the user wants to verify a specific quote.",
                url_path="/api/voice/tools/debate-search",
                body_schema={
                    "type": "object",
                    "properties": {
                        "debate_id": debate_id_const,
                        "query": {"type": "string", "description": "The search query"},
                        "side": {
                            "type": "string",
                            "description": "Which transcript: 'video_a', 'video_b', or 'both' (default)",
                        },
                    },
                    "required": ["query"],
                },
            ),
            _webhook_tool(
                name="get_debate_fact_check",
                description="Get the list of fact-checked claims with their verdicts (confirmed, nuanced, disputed, unverifiable). Use to ground the debate in evidence.",
                url_path="/api/voice/tools/debate-fact-check",
                body_schema={
                    "type": "object",
                    "properties": {"debate_id": debate_id_const},
                    "required": [],
                },
            ),
            _webhook_tool(
                name="web_search",
                description=(
                    "Search the web for current information. Use SYSTEMATICALLY when the user asks "
                    "about recent events, facts not already in the debate, or when you are unsure of a claim. "
                    "Cite sources briefly to the user."
                ),
                url_path="/api/voice/tools/debate-web-search",
                body_schema={
                    "type": "object",
                    "properties": {
                        "debate_id": debate_id_const,
                        "query": {"type": "string", "description": "The web search query"},
                    },
                    "required": ["query"],
                },
            ),
        ]


# =========================================================================
# Module-level factory
# =========================================================================


def build_companion_tools_config(webhook_base_url: str, voice_session_id: str) -> list[dict]:
    """Webhook-tool definitions for the COMPANION agent (free voice call).

    Bearer token = voice_session.id (verified server-side by
    verify_companion_tool_request). voice_session_id is injected as a
    ``constant_value`` (server-side, not provided by the LLM) — same pattern
    as ``build_tools_config`` for ``summary_id``. Without this, the LLM has
    no way to know the session id from its context and the backend would
    reject every tool call with 401 token_mismatch.
    """
    auth_headers = {"Authorization": f"Bearer {voice_session_id}"}
    base = webhook_base_url.rstrip("/")

    def _tool(name: str, description: str, path: str, body_schema: dict) -> dict:
        return {
            "type": "webhook",
            "name": name,
            "description": description,
            "api_schema": {
                "url": f"{base}{path}",
                "method": "POST",
                "request_headers": auth_headers,
                "request_body_schema": body_schema,
            },
        }

    # ElevenLabs schema rule: when constant_value is set, no other field
    # (description, dynamic_variable, is_system_provided) can be set, and the
    # field MUST stay out of "required" because the server injects it.
    voice_session_const = {"type": "string", "constant_value": str(voice_session_id)}

    return [
        _tool(
            name="get_more_recos",
            description=(
                "Fetch up to 3 fresh video recommendations on a given topic when the "
                "user asks for more, refines their interest, or rejects the initial "
                "recommendations. Chains 4 sources with fallback (history+similarity, "
                "tournesol, youtube, trending)."
            ),
            path="/api/voice/tools/companion-recos",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "topic": {
                        "type": "string",
                        "description": "Topic / theme to find recommendations for.",
                    },
                },
                "required": ["topic"],
            },
        ),
        _tool(
            name="start_analysis",
            description=(
                "Queue a YouTube video analysis from the call. Use when the user shares "
                "a URL they want analysed. The actual analysis runs in the background — "
                "tell the user it will be ready in ~2 min and they can call back then."
            ),
            path="/api/voice/tools/start-analysis",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "video_url": {
                        "type": "string",
                        "description": "Full YouTube URL (https://www.youtube.com/watch?v=... or youtu.be/...).",
                    },
                },
                "required": ["video_url"],
            },
        ),
        _tool(
            name="transfer_to_video",
            description=(
                "Transfer the current call to an EXPLORER session on a specific video "
                "from the user's history. Use when the user wants to discuss a precise "
                "video in detail (e.g. 'parlons de ma vidéo sur l'IA'). Provide either "
                "summary_id (preferred), video_id, or query (free-text title). Tell the "
                "user 'Je te bascule sur cette vidéo, deux secondes' before invoking. "
                "If the response status is 'ready', stop talking — the client handles "
                "the transition. If 'not_found' or 'quota_exceeded', read the message "
                "field aloud and propose an alternative."
            ),
            path="/api/voice/tools/transfer-to-video",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "summary_id": {
                        "type": "integer",
                        "description": "Direct lookup by summary_id (preferred when known).",
                    },
                    "video_id": {
                        "type": "string",
                        "description": "YouTube/TikTok video ID.",
                    },
                    "query": {
                        "type": "string",
                        "description": "Free-text fuzzy match on video_title or video_channel.",
                    },
                },
                "required": [],
            },
        ),
    ]


def build_knowledge_tutor_tools_config(webhook_base_url: str, voice_session_id: str) -> list[dict]:
    """Webhook-tool definitions for the KNOWLEDGE_TUTOR agent.

    Same auth pattern as COMPANION: Bearer = voice_session_id, and the body
    echoes voice_session_id via a ``constant_value`` (server-injected, not
    asked of the LLM — see ``build_tools_config`` for the same pattern with
    ``summary_id``). Without this, the LLM has no way to know the session id
    from its context and the backend would reject every tool call with 401
    token_mismatch — making the tutor say "I have no access to your history".

    The agent has 5 history-aware DB helpers + the shared web_search fallback
    (mounted at /tools/web-search, declared by ElevenLabsClient.build_tools_config
    — re-exposed here so the KNOWLEDGE_TUTOR can call it without going through
    the per-summary auth):

        1. get_tutor_memory_snapshot — adaptive mind-map. PRIMARY orientation
           tool, called first at session start (replaces get_user_history +
           get_concept_keys for the initial pivot).
        2. get_user_history — last N analyses (richer per-item shape, includes
           ``key_topics`` extracted from ``## ``-headings).
        3. get_concept_keys — top concepts aggregated across history.
        4. search_history — semantic search across summaries / flashcards /
           quizzes / chats / transcripts.
        5. get_summary_detail — full detail of one analysis to ground a
           correction or quote a precise passage.
    """
    auth_headers = {"Authorization": f"Bearer {voice_session_id}"}
    base = webhook_base_url.rstrip("/")

    def _tool(name: str, description: str, path: str, body_schema: dict) -> dict:
        return {
            "type": "webhook",
            "name": name,
            "description": description,
            "api_schema": {
                "url": f"{base}{path}",
                "method": "POST",
                "request_headers": auth_headers,
                "request_body_schema": body_schema,
            },
        }

    # ElevenLabs schema rule: when constant_value is set, no other field
    # (description, dynamic_variable, is_system_provided) can be set, and the
    # field MUST stay out of "required" because the server injects it.
    voice_session_const = {"type": "string", "constant_value": str(voice_session_id)}

    return [
        _tool(
            name="get_tutor_memory_snapshot",
            description=(
                "Return an adaptive mind-map of the user's whole analysis history "
                "(top categories, top concepts, and a slice of recent analyses with "
                "their key topics). Compression scales automatically with the total "
                "analysis count. CALL THIS FIRST at the start of every session to "
                "orient yourself — replaces the legacy "
                "get_concept_keys + get_user_history startup pair."
            ),
            path="/api/voice/tools/knowledge-tutor-memory",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                },
                "required": [],
            },
        ),
        _tool(
            name="get_user_history",
            description=(
                "Return the user's last N video analyses (title, platform, channel, "
                "date, key concepts). Call this AT THE START of every session to "
                "know the user's recent learning path."
            ),
            path="/api/voice/tools/knowledge-tutor-history",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "limit": {
                        "type": "integer",
                        "description": "Max number of analyses to return (default 10, max 25).",
                    },
                    "days_back": {
                        "type": "integer",
                        "description": "Cutoff in days (default 60).",
                    },
                },
                "required": [],
            },
        ),
        _tool(
            name="get_concept_keys",
            description=(
                "Return the top concepts/keywords aggregated across the user's history. "
                "Primary source to propose a revision topic. Call AT THE START of every "
                "session right after get_user_history."
            ),
            path="/api/voice/tools/knowledge-tutor-concepts",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "limit": {
                        "type": "integer",
                        "description": "Max number of concepts to return (default 20, max 100).",
                    },
                },
                "required": [],
            },
        ),
        _tool(
            name="search_history",
            description=(
                "Semantic search across the user's whole DeepSight history (summaries, "
                "flashcards, quizzes, chats, transcripts). Use when the user mentions a "
                "specific subject and you want to find which analyses cover it."
            ),
            path="/api/voice/tools/knowledge-tutor-search",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "query": {
                        "type": "string",
                        "description": "Free-text search query (concept, idea, person, etc.).",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Max results to return (default 5, max 20).",
                    },
                },
                "required": ["query"],
            },
        ),
        _tool(
            name="get_summary_detail",
            description=(
                "Return the full detail of a specific analysis owned by the user "
                "(title, digest, key points, fact-check). Use to ground a correction "
                "or quote a precise passage."
            ),
            path="/api/voice/tools/knowledge-tutor-summary",
            body_schema={
                "type": "object",
                "properties": {
                    "voice_session_id": voice_session_const,
                    "summary_id": {
                        "type": "integer",
                        "description": "Database id of the Summary to fetch.",
                    },
                },
                "required": ["summary_id"],
            },
        ),
    ]


def get_elevenlabs_client() -> ElevenLabsClient:
    """Instantiate an ElevenLabsClient using the project-wide settings."""
    from core.config import get_elevenlabs_key

    api_key = get_elevenlabs_key()
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY is not configured — set it in .env or environment variables")
    return ElevenLabsClient(api_key=api_key)
