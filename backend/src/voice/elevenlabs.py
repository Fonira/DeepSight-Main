"""
ElevenLabs Conversational AI Client — DeepSight Voice Chat
Phase 2 kickstart — API client for agent creation and signed URL generation.

Uses the ElevenLabs Conversational AI API:
https://elevenlabs.io/docs/api-reference/conversational-ai
"""

from __future__ import annotations

from typing import Optional

import httpx

from core.logging import logger


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
            ValueError: on 401 (invalid API key).
            httpx.HTTPStatusError: on 429 (rate limit) or 5xx.
        """
        tts_config: dict = {
            "voice_id": voice_id,
            "model_id": model_id,
        }
        if voice_settings:
            tts_config["voice_settings"] = voice_settings

        body: dict = {
            "conversation_config": {
                "agent": {
                    "prompt": {"prompt": system_prompt},
                    "first_message": first_message,
                    "language": language,
                },
                "tts": tts_config,
                # Reduce first-byte latency at the cost of slight quality loss
                # Level 4 = maximum optimization, ideal for voice chat
                "optimize_streaming_latency": 4,
            },
            "tools": tools,
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
                "- Si \"interroge-moi\" ou \"quiz\" → utilise get_flashcards.\n"
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

        Each tool calls back into the DeepSight API with the user's JWT.
        """
        auth_header = {"Authorization": f"Bearer {api_token}"}

        return [
            {
                "type": "webhook",
                "name": "search_in_transcript",
                "description": (
                    "Search the video transcript for an exact passage or keyword. "
                    "Returns matching excerpts with timestamps."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/search-transcript",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query (keyword or phrase)",
                        },
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                    },
                    "required": ["query", "summary_id"],
                },
            },
            {
                "type": "webhook",
                "name": "get_analysis_section",
                "description": (
                    "Retrieve a specific section of the video analysis "
                    "(e.g. key_points, arguments, conclusion)."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/analysis-section",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "section": {
                            "type": "string",
                            "description": "Section name (key_points, arguments, conclusion, context, etc.)",
                        },
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                    },
                    "required": ["section", "summary_id"],
                },
            },
            {
                "type": "webhook",
                "name": "get_sources",
                "description": (
                    "Get fact-check sources and reliability information "
                    "for the claims made in the video."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/sources",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "claim": {
                            "type": "string",
                            "description": "The specific claim to verify (optional, returns all if omitted)",
                        },
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                    },
                    "required": ["summary_id"],
                },
            },
            {
                "type": "webhook",
                "name": "get_flashcards",
                "description": (
                    "Get study flashcards generated from the video analysis. "
                    "Use when the user wants to be quizzed or review key concepts."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/flashcards",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                        "count": {
                            "type": "integer",
                            "description": "Number of flashcards to return (default 5)",
                        },
                    },
                    "required": ["summary_id"],
                },
            },
            {
                "type": "webhook",
                "name": "web_search",
                "description": (
                    "Search the web for current information about a topic. "
                    "Use when the user asks about recent events, news, or facts not in the video."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/web-search",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The web search query",
                        },
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                    },
                    "required": ["query", "summary_id"],
                },
            },
            {
                "type": "webhook",
                "name": "deep_research",
                "description": (
                    "Perform in-depth web research combining multiple search queries. "
                    "Use for complex questions requiring comprehensive analysis."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/deep-research",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The research query or topic",
                        },
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                    },
                    "required": ["query", "summary_id"],
                },
            },
            {
                "type": "webhook",
                "name": "check_fact",
                "description": (
                    "Verify a factual claim by searching the web for "
                    "supporting or contradicting evidence."
                ),
                "api_schema": {
                    "url": f"{webhook_base_url}/api/voice/tools/check-fact",
                    "method": "POST",
                    "headers": auth_header,
                },
                "parameters": {
                    "type": "object",
                    "properties": {
                        "claim": {
                            "type": "string",
                            "description": "The factual claim to verify",
                        },
                        "summary_id": {
                            "type": "string",
                            "description": "The analysis / summary ID",
                        },
                    },
                    "required": ["claim", "summary_id"],
                },
            },
        ]


# =========================================================================
# Module-level factory
# =========================================================================


def get_elevenlabs_client() -> ElevenLabsClient:
    """Instantiate an ElevenLabsClient using the project-wide settings."""
    from core.config import get_elevenlabs_key

    api_key = get_elevenlabs_key()
    if not api_key:
        raise ValueError(
            "ELEVENLABS_API_KEY is not configured — "
            "set it in .env or environment variables"
        )
    return ElevenLabsClient(api_key=api_key)
