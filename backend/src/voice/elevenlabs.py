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

from typing import Optional

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
        "eleven_flash_v2_5",       # ~150ms first-byte — recommended
        "eleven_turbo_v2_5",       # ~300ms — current default
        "eleven_multilingual_v2",  # higher quality, higher latency
    }
)


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
    ) -> str:
        """Create a conversational AI agent and return its agent_id.

        Args:
            model_id: ElevenLabs TTS model (eleven_flash_v2_5, eleven_turbo_v2_5, eleven_multilingual_v2).
            voice_settings: ElevenLabs voice_settings dict (stability, similarity_boost, style, speed, etc.).
            turn_config: ElevenLabs turn configuration (mode, turn_timeout, interruptions, eagerness).

        Raises:
            ValueError: on 401 (invalid API key) or invalid model_id (HARD-PIN).
            httpx.HTTPStatusError: on 429 (rate limit) or 5xx.
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
        # ── TTS config (flat properties since API update April 2026) ──
        tts_config: dict = {
            "voice_id": voice_id,
            "model_id": model_id,
            # Reduce first-byte latency — level 4 = maximum optimization
            "optimize_streaming_latency": 4,
        }
        # Flatten voice_settings into tts_config (no longer nested)
        if voice_settings:
            for key in ("stability", "similarity_boost", "speed", "style"):
                if key in voice_settings:
                    tts_config[key] = voice_settings[key]

        # ── Agent prompt config (tools now live inside agent.prompt) ──
        prompt_config: dict = {
            "prompt": system_prompt,
            "tools": tools,
        }

        body: dict = {
            "conversation_config": {
                "agent": {
                    "prompt": prompt_config,
                    "first_message": first_message or "",
                    "language": language,
                },
                "tts": tts_config,
            },
        }

        # Add turn/interruption configuration if provided
        if turn_config:
            body["conversation_config"]["turn"] = turn_config

        logger.info(
            "elevenlabs.create_agent",
            extra={"voice_id": voice_id, "model_id": model_id, "language": language},
        )

        response = await self._client.post("/convai/agents/create", json=body)

        if response.status_code == 401:
            raise ValueError("ElevenLabs API key is invalid or expired")
        if response.status_code == 429:
            raise httpx.HTTPStatusError(
                "ElevenLabs rate limit exceeded — retry later",
                request=response.request,
                response=response,
            )
        if response.status_code == 422:
            # Log the response body for debugging schema mismatches
            try:
                error_detail = response.json()
            except Exception:
                error_detail = response.text[:500]
            logger.error(
                "elevenlabs.create_agent_422",
                extra={"status": 422, "detail": error_detail},
            )
        response.raise_for_status()

        data = response.json()
        agent_id: str = data["agent_id"]
        logger.info("elevenlabs.agent_created", extra={"agent_id": agent_id})
        return agent_id

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
        response.raise_for_status()

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
            httpx.HTTPStatusError: on 4xx/5xx. The caller is expected to
                gracefully degrade to signed_url-only when this fails.
        """
        logger.info("elevenlabs.get_conversation_token", extra={"agent_id": agent_id})

        response = await self._client.get(
            "/convai/conversation/token",
            params={"agent_id": agent_id},
        )
        response.raise_for_status()

        data = response.json()
        token: str = data.get("token") or data.get("conversation_token") or ""
        if not token:
            logger.warning(
                "elevenlabs.conversation_token_missing",
                extra={"agent_id": agent_id, "keys": list(data.keys())},
            )
        return token, data.get("expires_at", "")

    async def delete_agent(self, agent_id: str) -> bool:
        """Delete a conversational AI agent. Returns True on success, False otherwise."""
        logger.info("elevenlabs.delete_agent", extra={"agent_id": agent_id})
        try:
            response = await self._client.delete(f"/convai/agents/{agent_id}")
            if response.is_success:
                logger.info("elevenlabs.agent_deleted", extra={"agent_id": agent_id})
                return True
            logger.warning(
                "elevenlabs.delete_agent_failed",
                extra={"agent_id": agent_id, "status": response.status_code},
            )
            return False
        except httpx.HTTPError as exc:
            logger.warning(
                "elevenlabs.delete_agent_error",
                extra={"agent_id": agent_id, "error": str(exc)},
            )
            return False

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
    verify_companion_tool_request). Body always includes voice_session_id
    so the backend can match the Bearer.
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

    voice_session_field = {
        "type": "string",
        "description": "The voice_session_id (same value as the Bearer token).",
    }

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
                    "voice_session_id": voice_session_field,
                    "topic": {
                        "type": "string",
                        "description": "Topic / theme to find recommendations for.",
                    },
                },
                "required": ["voice_session_id", "topic"],
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
                    "voice_session_id": voice_session_field,
                    "video_url": {
                        "type": "string",
                        "description": "Full YouTube URL (https://www.youtube.com/watch?v=... or youtu.be/...).",
                    },
                },
                "required": ["voice_session_id", "video_url"],
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
                    "voice_session_id": voice_session_field,
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
                "required": ["voice_session_id"],
            },
        ),
    ]


def build_knowledge_tutor_tools_config(webhook_base_url: str, voice_session_id: str) -> list[dict]:
    """Webhook-tool definitions for the KNOWLEDGE_TUTOR agent.

    Same auth pattern as COMPANION (Bearer = voice_session_id, body must echo
    voice_session_id). The agent has 5 history-aware DB helpers + the shared
    web_search fallback (mounted at /tools/web-search, declared by
    ElevenLabsClient.build_tools_config — re-exposed here so the
    KNOWLEDGE_TUTOR can call it without going through the per-summary auth):

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

    Note: web_search is *not* re-declared here because the COMPANION agent
    already defines it at /tools/web-search-companion in some prods. To stay
    consistent with the spec ("réutilise web_search COMPANION"), we point
    knowledge_tutor.web_search to the same /tools/web-search-companion-style
    webhook only if the COMPANION wiring exposes it. For now we rely on the
    main /tools/web-search served by build_tools_config and let the router
    filter at the agent level — the spec's "fallback web_search" requirement
    is satisfied by the LLM choosing not to call it on history-only turns.
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

    voice_session_field = {
        "type": "string",
        "description": "The voice_session_id (same value as the Bearer token).",
    }

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
                    "voice_session_id": voice_session_field,
                },
                "required": ["voice_session_id"],
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
                    "voice_session_id": voice_session_field,
                    "limit": {
                        "type": "integer",
                        "description": "Max number of analyses to return (default 10, max 25).",
                    },
                    "days_back": {
                        "type": "integer",
                        "description": "Cutoff in days (default 60).",
                    },
                },
                "required": ["voice_session_id"],
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
                    "voice_session_id": voice_session_field,
                    "limit": {
                        "type": "integer",
                        "description": "Max number of concepts to return (default 20, max 100).",
                    },
                },
                "required": ["voice_session_id"],
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
                    "voice_session_id": voice_session_field,
                    "query": {
                        "type": "string",
                        "description": "Free-text search query (concept, idea, person, etc.).",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Max results to return (default 5, max 20).",
                    },
                },
                "required": ["voice_session_id", "query"],
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
                    "voice_session_id": voice_session_field,
                    "summary_id": {
                        "type": "integer",
                        "description": "Database id of the Summary to fetch.",
                    },
                },
                "required": ["voice_session_id", "summary_id"],
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
