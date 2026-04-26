"""
LLM Provider — Centralized AI API calls with automatic fallback chain.

Fallback order:
  1. Requested Mistral model
  2. Other Mistral models (ascending tier)
  3. DeepSeek (last resort, non-EU)

Usage:
    from core.llm_provider import llm_complete, llm_complete_stream

    # Simple call — auto-fallback on 429
    result = await llm_complete(
        messages=[{"role": "system", "content": "..."}, {"role": "user", "content": "..."}],
        model="mistral-small-2603",
        max_tokens=5000,
        temperature=0.3,
    )
    if result:
        print(result.content)
        print(result.model_used)  # actual model that succeeded

    # Streaming call — auto-fallback on 429 before stream starts
    async for chunk in llm_complete_stream(
        messages=[...],
        model="mistral-small-2603",
    ):
        print(chunk, end="")
"""

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from core.config import (
    get_mistral_key,
    get_deepseek_key,
    is_deepseek_available,
    resolve_mistral_model,
)


# =============================================================================
# CONSTANTS
# =============================================================================

MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# Mistral models ordered by tier (ascending) for fallback
MISTRAL_FALLBACK_ORDER = [
    "mistral-small-2603",
    "mistral-medium-2508",
    "mistral-large-2512",
]

# Max retries per model before trying next in fallback chain
MAX_RETRIES_PER_MODEL = 1

# Backoff base (seconds) — exponential: base * 2^attempt
BACKOFF_BASE = 2.0

# Global circuit breaker state per model
_circuit_breakers: Dict[str, "CircuitBreaker"] = {}


# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class LLMResult:
    """Result from an LLM call."""

    content: str
    model_used: str
    provider: str  # "mistral" or "deepseek"
    tokens_input: int = 0
    tokens_output: int = 0
    tokens_total: int = 0
    fallback_used: bool = False
    attempts: int = 1


@dataclass
class CircuitBreaker:
    """Simple circuit breaker per model to avoid hammering a rate-limited model."""

    failures: int = 0
    last_failure: float = 0.0
    cooldown: float = 30.0  # seconds to wait after consecutive failures

    def is_open(self) -> bool:
        """Returns True if circuit is open (model should be skipped)."""
        if self.failures < 3:
            return False
        elapsed = time.time() - self.last_failure
        if elapsed > self.cooldown:
            # Reset after cooldown
            self.failures = 0
            return False
        return True

    def record_failure(self):
        self.failures += 1
        self.last_failure = time.time()
        # Increase cooldown with more failures (max 5 min)
        self.cooldown = min(300, 30 * (2 ** (self.failures - 3)))

    def record_success(self):
        self.failures = 0


def _get_circuit_breaker(model: str) -> CircuitBreaker:
    if model not in _circuit_breakers:
        _circuit_breakers[model] = CircuitBreaker()
    return _circuit_breakers[model]


# =============================================================================
# INTERNAL: Single API call (no fallback)
# =============================================================================


async def _call_api(
    url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 4000,
    temperature: float = 0.3,
    timeout: float = 180,
    stream: bool = False,
    json_mode: bool = False,
) -> httpx.Response:
    """Low-level HTTP call to an OpenAI-compatible chat completions API."""
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": stream,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )


async def _call_api_stream(
    url: str,
    api_key: str,
    model: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 4000,
    temperature: float = 0.3,
    timeout: float = 180,
) -> httpx.Response:
    """Low-level streaming HTTP call. Returns the response for iteration."""
    client = httpx.AsyncClient(timeout=timeout)
    response = await client.send(
        client.build_request(
            "POST",
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": True,
            },
        ),
        stream=True,
    )
    # Attach client to response so it can be closed later
    response._client = client  # type: ignore
    return response


# =============================================================================
# BUILD FALLBACK CHAIN
# =============================================================================


def _build_fallback_chain(
    requested_model: str,
    allowed_models: Optional[List[str]] = None,
) -> List[Dict[str, str]]:
    """
    Build ordered list of (provider, model, url, api_key_getter) to try.

    1. Requested Mistral model
    2. Other Mistral models from MISTRAL_FALLBACK_ORDER (if allowed)
    3. DeepSeek deepseek-chat (if key available)
    """
    chain = []
    seen = set()

    # Resolve aliases
    resolved = resolve_mistral_model(requested_model)

    # 1. Requested model first
    chain.append({"provider": "mistral", "model": resolved, "url": MISTRAL_API_URL})
    seen.add(resolved)

    # 2. Other Mistral models
    for model in MISTRAL_FALLBACK_ORDER:
        if model in seen:
            continue
        # If allowed_models specified, respect it
        if allowed_models and model not in allowed_models:
            continue
        chain.append({"provider": "mistral", "model": model, "url": MISTRAL_API_URL})
        seen.add(model)

    # 3. DeepSeek as last resort
    if is_deepseek_available():
        chain.append({"provider": "deepseek", "model": "deepseek-chat", "url": DEEPSEEK_API_URL})

    return chain


# =============================================================================
# PUBLIC: llm_complete — Non-streaming with auto-fallback
# =============================================================================


async def llm_complete(
    messages: List[Dict[str, str]],
    model: str = "mistral-small-2603",
    max_tokens: int = 4000,
    temperature: float = 0.3,
    timeout: float = 180,
    allowed_models: Optional[List[str]] = None,
    disable_fallback: bool = False,
    json_mode: bool = False,
) -> Optional[LLMResult]:
    """
    Call an LLM with automatic fallback on 429/5xx errors.

    Args:
        messages: Chat messages (system + user)
        model: Preferred model
        max_tokens: Max response tokens
        temperature: Sampling temperature
        timeout: Request timeout in seconds
        allowed_models: Restrict fallback to these Mistral models only
        disable_fallback: If True, only try the requested model
        json_mode: If True, request JSON-only output (sets response_format=json_object)

    Returns:
        LLMResult with content and metadata, or None on total failure
    """
    mistral_key = get_mistral_key()
    deepseek_key = get_deepseek_key()

    if not mistral_key:
        print("❌ [LLM] No MISTRAL_API_KEY configured", flush=True)
        return None

    chain = _build_fallback_chain(model, allowed_models)
    if disable_fallback:
        chain = chain[:1]

    total_attempts = 0

    for i, entry in enumerate(chain):
        provider = entry["provider"]
        current_model = entry["model"]
        url = entry["url"]
        api_key = mistral_key if provider == "mistral" else deepseek_key
        is_fallback = i > 0

        if not api_key:
            continue

        # Check circuit breaker
        cb = _get_circuit_breaker(f"{provider}:{current_model}")
        if cb.is_open():
            print(f"⚡ [LLM] Circuit breaker OPEN for {provider}:{current_model}, skipping", flush=True)
            continue

        for attempt in range(MAX_RETRIES_PER_MODEL):
            total_attempts += 1
            try:
                if is_fallback and attempt == 0:
                    print(f"🔄 [LLM] Fallback → {provider}:{current_model}", flush=True)

                response = await _call_api(
                    url=url,
                    api_key=api_key,
                    model=current_model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    timeout=timeout,
                    json_mode=json_mode,
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    usage = data.get("usage", {})

                    cb.record_success()

                    if is_fallback:
                        print(f"✅ [LLM] Fallback {provider}:{current_model} succeeded", flush=True)

                    return LLMResult(
                        content=content,
                        model_used=current_model,
                        provider=provider,
                        tokens_input=usage.get("prompt_tokens", 0),
                        tokens_output=usage.get("completion_tokens", 0),
                        tokens_total=usage.get("total_tokens", 0),
                        fallback_used=is_fallback,
                        attempts=total_attempts,
                    )

                elif response.status_code == 429:
                    cb.record_failure()
                    wait_time = BACKOFF_BASE * (2**attempt)
                    print(
                        f"⏳ [LLM] {provider}:{current_model} 429 "
                        f"(attempt {attempt + 1}/{MAX_RETRIES_PER_MODEL}), "
                        f"retry in {wait_time:.0f}s...",
                        flush=True,
                    )
                    if attempt < MAX_RETRIES_PER_MODEL - 1:
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        # Move to next model in chain
                        print(f"❌ [LLM] {provider}:{current_model} 429 exhausted, trying next...", flush=True)
                        break

                elif response.status_code >= 500:
                    cb.record_failure()
                    print(
                        f"❌ [LLM] {provider}:{current_model} server error {response.status_code}",
                        flush=True,
                    )
                    break  # Skip retries on 5xx, go to next model

                else:
                    # 4xx other than 429 — don't retry, don't fallback
                    print(
                        f"❌ [LLM] {provider}:{current_model} error {response.status_code}: {response.text[:200]}",
                        flush=True,
                    )
                    return None

            except httpx.TimeoutException:
                cb.record_failure()
                print(
                    f"❌ [LLM] {provider}:{current_model} timeout after {timeout}s (attempt {attempt + 1})",
                    flush=True,
                )
                if attempt < MAX_RETRIES_PER_MODEL - 1:
                    continue
                break

            except Exception as e:
                print(f"❌ [LLM] {provider}:{current_model} exception: {e}", flush=True)
                break

    print(f"❌ [LLM] All models exhausted after {total_attempts} attempts", flush=True)
    return None


# =============================================================================
# PUBLIC: llm_complete_stream — Streaming with auto-fallback
# =============================================================================


async def llm_complete_stream(
    messages: List[Dict[str, str]],
    model: str = "mistral-small-2603",
    max_tokens: int = 4000,
    temperature: float = 0.3,
    timeout: float = 180,
    allowed_models: Optional[List[str]] = None,
    disable_fallback: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response with auto-fallback.
    Fallback happens BEFORE streaming starts (on connection error / 429).
    Once streaming begins on a model, that model is committed.

    Yields:
        Content chunks as strings
    """
    mistral_key = get_mistral_key()
    deepseek_key = get_deepseek_key()

    if not mistral_key:
        yield "Error: No MISTRAL_API_KEY configured"
        return

    chain = _build_fallback_chain(model, allowed_models)
    if disable_fallback:
        chain = chain[:1]

    for i, entry in enumerate(chain):
        provider = entry["provider"]
        current_model = entry["model"]
        url = entry["url"]
        api_key = mistral_key if provider == "mistral" else deepseek_key
        is_fallback = i > 0

        if not api_key:
            continue

        cb = _get_circuit_breaker(f"{provider}:{current_model}")
        if cb.is_open():
            continue

        try:
            if is_fallback:
                print(f"🔄 [LLM-STREAM] Fallback → {provider}:{current_model}", flush=True)

            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": current_model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "stream": True,
                    },
                ) as response:
                    if response.status_code == 429:
                        cb.record_failure()
                        print(
                            f"⏳ [LLM-STREAM] {provider}:{current_model} 429, trying next...",
                            flush=True,
                        )
                        await response.aread()  # consume body
                        continue  # try next model

                    if response.status_code >= 500:
                        cb.record_failure()
                        print(
                            f"❌ [LLM-STREAM] {provider}:{current_model} {response.status_code}",
                            flush=True,
                        )
                        await response.aread()
                        continue

                    if response.status_code != 200:
                        body = await response.aread()
                        print(
                            f"❌ [LLM-STREAM] {provider}:{current_model} {response.status_code}: {body.decode()[:200]}",
                            flush=True,
                        )
                        yield f"Error: API returned {response.status_code}"
                        return

                    # Success — stream chunks
                    cb.record_success()
                    if is_fallback:
                        print(f"✅ [LLM-STREAM] Streaming from fallback {provider}:{current_model}", flush=True)

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                return
                            try:
                                chunk = json.loads(data)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue
                    return  # Stream completed successfully

        except httpx.TimeoutException:
            cb.record_failure()
            print(f"❌ [LLM-STREAM] {provider}:{current_model} timeout", flush=True)
            continue

        except Exception as e:
            print(f"❌ [LLM-STREAM] {provider}:{current_model} error: {e}", flush=True)
            continue

    yield "Error: AI service temporarily unavailable, please retry"


# =============================================================================
# PUBLIC: llm_complete_batch — Batch processing (50% cheaper, async)
# =============================================================================


async def llm_complete_batch(
    items: List[Dict[str, any]],
    model: str = "mistral-small-2603",
    max_tokens: int = 4000,
    temperature: float = 0.3,
    max_wait: float = 600.0,
    on_progress: Optional[callable] = None,
) -> List[Optional[LLMResult]]:
    """
    Submit multiple LLM calls as a single Mistral Batch job (50% cost reduction).

    Each item in `items` must have:
        - "id": str — unique identifier to match results
        - "messages": List[Dict] — chat messages (system + user)
        - Optionally "max_tokens", "temperature" to override defaults

    Returns:
        List of LLMResult (one per item, in same order). None for failed items.

    Usage:
        items = [
            {"id": "video_1", "messages": [{"role": "system", "content": "..."}, ...]},
            {"id": "video_2", "messages": [{"role": "user", "content": "..."}]},
        ]
        results = await llm_complete_batch(items, model="mistral-small-2603")
        for item, result in zip(items, results):
            if result:
                print(f"{item['id']}: {result.content[:100]}")
    """
    if not items:
        return []

    try:
        from core.mistral_batch import BatchRequest, submit_and_wait
    except ImportError:
        print("❌ [LLM-BATCH] mistral_batch module not available", flush=True)
        return [None] * len(items)

    # Convert items to BatchRequests
    batch_requests = []
    for item in items:
        batch_requests.append(
            BatchRequest(
                custom_id=item["id"],
                messages=item["messages"],
                model=model,
                max_tokens=item.get("max_tokens", max_tokens),
                temperature=item.get("temperature", temperature),
            )
        )

    print(
        f"📦 [LLM-BATCH] Submitting {len(batch_requests)} requests (model={model}, max_wait={max_wait}s)",
        flush=True,
    )

    # Submit and wait
    batch_results = await submit_and_wait(
        batch_requests,
        max_wait=max_wait,
        on_progress=on_progress,
    )

    # Build a map of custom_id → BatchResult
    result_map = {r.custom_id: r for r in batch_results}

    # Return in same order as input items
    output: List[Optional[LLMResult]] = []
    for item in items:
        br = result_map.get(item["id"])
        if br and br.success:
            output.append(
                LLMResult(
                    content=br.content,
                    model_used=model,
                    provider="mistral_batch",
                    tokens_input=br.tokens_input,
                    tokens_output=br.tokens_output,
                    tokens_total=br.tokens_total,
                    fallback_used=False,
                    attempts=1,
                )
            )
        else:
            error = br.error if br else "No result returned"
            print(f"⚠️ [LLM-BATCH] Item {item['id']} failed: {error}", flush=True)
            output.append(None)

    success_count = sum(1 for r in output if r is not None)
    total_tokens = sum(r.tokens_total for r in output if r is not None)
    print(
        f"✅ [LLM-BATCH] Complete: {success_count}/{len(items)} success, "
        f"{total_tokens:,} tokens (50% discount applied by Mistral)",
        flush=True,
    )

    return output
