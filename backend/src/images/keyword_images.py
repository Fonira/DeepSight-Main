"""
Pipeline de génération d'images IA pour "Le Saviez-Vous".
2 étapes : Mistral (directeur artistique) → Image gen (tiered).

Backends image (par priorité) :
1. Mistral Agent API (FLUX 1.1 Pro Ultra) — défaut, meilleure qualité, stack unifiée
2. DALL-E 3 via OpenAI (~$0.04/image) — fallback premium
3. FLUX Schnell via Together AI (~$0.003/image) — fallback free
"""

import hashlib
import io
import json
import logging
import time
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image

from core.config import (
    get_mistral_key,
    get_openai_key,
    get_together_key,
    get_mistral_image_agent_id,
    get_gemini_key,
)
from storage.r2 import upload_to_r2
from images.fun_scoring import calculate_fun_score

logger = logging.getLogger(__name__)

# ─── Style constants ─────────────────────────────────────────────────────────

DEEPSIGHT_STYLE_SUFFIX = (
    "Editorial still-life photograph. Pure black background (#0a0a0f). "
    "Single warm gold rim light from left (#C8903A). Sharp focus, shallow depth of field. "
    "Clean minimal composition. No text, no people, no watermarks."
)

# Premium model (paying users)
IMAGE_MODEL_PREMIUM = "dall-e-3"
# Free model (FLUX Schnell via Together AI)
IMAGE_MODEL_FREE = "black-forest-labs/FLUX.1-schnell-Free"

ART_DIRECTOR_MODEL = "mistral-small-2503"

# ─── Tuteur Doodle constants (sprint 2026-05-18) ─────────────────────────────
# Style suffix pour générer des doodles ligne single-color cohérents avec le
# DoodleBackground frontend (#c084fc violet-400). Fond transparent (RGBA).
TUTOR_DOODLE_STYLE_SUFFIX = (
    "Single continuous line doodle illustration. Minimal abstract symbolic icon. "
    "Monochrome line art, no fill, no shading, no background. "
    "Stroke color must be #c084fc (violet-400). Transparent background (alpha=0). "
    "Centered composition, ~20% padding around the icon. "
    "No text, no people, no watermarks. Style: hand-drawn doodle, single weight stroke."
)

# Modèle Gemini 3 Pro Image (Nano Banana Pro) — Google AI Studio
IMAGE_MODEL_GEMINI_DOODLE = "gemini-3-pro-image-preview"


def _is_image_gen_available() -> bool:
    """Check if ANY image generation backend is available."""
    return bool(get_mistral_image_agent_id()) or bool(get_openai_key()) or bool(get_together_key())


ART_DIRECTOR_PROMPT = """Tu es un directeur artistique brillant et espiègle, mélange entre Magritte et un mémeur intellectuel.

PROCESSUS OBLIGATOIRE — Raisonne étape par étape :

1. DÉCONSTRUCTION — Analyse le concept :
   - Quel est le MÉCANISME fondamental ?
   - Quelle est l'IRONIE ou le PARADOXE au cœur ?
   - Quel OBJET du quotidien INCARNE ce mécanisme sans le nommer ?

2. ASSOCIATIONS LATÉRALES — Cherche les connexions :
   - Étymologie → objet lié ?
   - Analogie physique → quel phénomène naturel fait pareil ?
   - Culture pop → quel objet iconique évoque ça ?
   - Inversion → que verrait-on si le concept était INVERSÉ ?

3. SÉLECTION DU CLIN D'ŒIL :
   - Le spectateur dit "ah!" APRÈS avoir lu la définition
   - L'image seule doit être belle/intrigante SANS contexte
   - JAMAIS illustrer littéralement (pas de cerveau pour "biais cognitif")
   - JAMAIS de personne faisant l'action
   - TOUJOURS un objet/scène silencieux, photographiable, 1-2 éléments max

4. DESCRIPTION VISUELLE — OBLIGATOIREMENT EN ANGLAIS (le générateur d'images ne comprend que l'anglais)
   - Décris la scène en anglais simple et précis
   - Ex: "A single magnifying glass resting on a dark wooden table..."

CRITICAL: The "visual_prompt" field MUST be written in English. Non-English prompts will fail.

Réponds UNIQUEMENT avec ce JSON strict, sans markdown ni commentaires :
{"mechanism":"...","lateral_connections":["..."],"chosen_wink":"...","visual_prompt":"... (ENGLISH ONLY)"}"""


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _term_hash(term: str, style: str = "photo") -> str:
    """SHA-256 hash of normalized term for deduplication.

    Backward-compat: `style='photo'` (legacy "Le Saviez-Vous") produces the
    original hash without prefix, so existing rows in `keyword_images` stay
    valid. Other styles (e.g. 'tutor_doodle') prepend the style to the payload,
    allowing the same concept to coexist in multiple visual treatments.
    """
    if style == "photo":
        # Legacy path: don't change existing hashes
        return hashlib.sha256(term.lower().strip().encode("utf-8")).hexdigest()
    payload = f"{style}:{term.lower().strip()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ─── Stage 1: Mistral Art Director ────────────────────────────────────────────


async def _stage1_art_director(term: str, definition: str, category: str | None) -> dict:
    """Ask Mistral to invent a visual metaphor for the term."""
    try:
        from mistralai.client import Mistral
    except ImportError:
        from mistralai import Mistral

    client = Mistral(api_key=get_mistral_key())

    user_msg = (
        f"Concept : « {term} »\n"
        f"Définition : {definition}\n"
        f"Catégorie : {category or 'misc'}\n\n"
        "Trouve un clin d'œil visuel indirect pour illustrer ce concept."
    )

    response = await client.chat.complete_async(
        model=ART_DIRECTOR_MODEL,
        messages=[
            {"role": "system", "content": ART_DIRECTOR_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.9,
        max_tokens=500,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    data = json.loads(raw)

    if "visual_prompt" not in data:
        raise ValueError(f"Mistral response missing 'visual_prompt': {raw[:200]}")

    logger.info(f"🎨 Art director for '{term}': wink='{data.get('chosen_wink', '?')}'")
    return data


# ─── Stage 2a: DALL-E 3 (Premium) ────────────────────────────────────────────


async def _stage2_dalle3(visual_prompt: str) -> tuple[bytes, str]:
    """Call OpenAI DALL-E 3 to generate the image. Returns (raw_bytes, model_used)."""
    openai_key = get_openai_key()
    full_prompt = f"{visual_prompt}. {DEEPSIGHT_STYLE_SUFFIX}"

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {openai_key}"},
            json={
                "model": IMAGE_MODEL_PREMIUM,
                "prompt": full_prompt,
                "n": 1,
                "size": "1024x1024",
                "quality": "standard",
            },
        )
        resp.raise_for_status()
        result = resp.json()

    image_url = result["data"][0]["url"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()

    logger.info(f"🖼️ Image generated (DALL-E 3): {len(img_resp.content)} bytes")
    return img_resp.content, IMAGE_MODEL_PREMIUM


# ─── Stage 2b: FLUX Schnell (Free) ──────────────────────────────────────────


async def _stage2_flux_schnell(visual_prompt: str) -> tuple[bytes, str]:
    """Call Together AI FLUX Schnell to generate the image. Returns (raw_bytes, model_used)."""
    together_key = get_together_key()
    full_prompt = f"{visual_prompt}. {DEEPSIGHT_STYLE_SUFFIX}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.together.xyz/v1/images/generations",
            headers={
                "Authorization": f"Bearer {together_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": IMAGE_MODEL_FREE,
                "prompt": full_prompt,
                "n": 1,
                "width": 1024,
                "height": 1024,
                "steps": 4,
                "response_format": "b64_json",
            },
        )
        resp.raise_for_status()
        result = resp.json()

    import base64

    image_bytes = base64.b64decode(result["data"][0]["b64_json"])

    logger.info(f"🖼️ Image generated (FLUX Schnell): {len(image_bytes)} bytes")
    return image_bytes, IMAGE_MODEL_FREE


# ─── Stage 2c: Mistral Agent (FLUX Pro Ultra via Agents API) ────────────────


async def _stage2_mistral_agent(visual_prompt: str) -> tuple[bytes, str]:
    """Generate image via Mistral Agent with built-in image_generation tool.
    The agent uses FLUX 1.1 Pro Ultra (Black Forest Labs) internally.
    Returns (raw_bytes, model_used)."""
    try:
        from mistralai.client import Mistral
    except ImportError:
        from mistralai import Mistral

    client = Mistral(api_key=get_mistral_key())
    agent_id = get_mistral_image_agent_id()

    if not agent_id:
        raise RuntimeError("MISTRAL_IMAGE_AGENT_ID not configured")

    # Combine the visual prompt with DeepSight style instructions
    full_prompt = f"Generate an image for this concept: {visual_prompt}. Style requirements: {DEEPSIGHT_STYLE_SUFFIX}"

    # Start a conversation with the agent — the agent will invoke image_generation
    response = client.beta.conversations.start(
        agent_id=agent_id,
        inputs=full_prompt,
    )

    # Extract the generated image file_id from the response
    # The agent returns outputs containing ToolFileChunk objects with file_id
    file_id: Optional[str] = None
    for entry in response.outputs:
        if hasattr(entry, "content") and entry.content:
            for chunk in entry.content:
                # ToolFileChunk has a file_id attribute
                if hasattr(chunk, "file_id") and chunk.file_id:
                    file_id = chunk.file_id
                    break
        if file_id:
            break

    if not file_id:
        # Log what we got for debugging
        output_types = [
            type(chunk).__name__
            for entry in response.outputs
            if hasattr(entry, "content") and entry.content
            for chunk in entry.content
        ]
        logger.warning(f"⚠️ Mistral Agent response chunk types: {output_types}")
        raise RuntimeError(f"Mistral Agent did not return an image file. Got {len(response.outputs)} output entries.")

    # Download the generated image from Mistral Files API
    file_bytes = client.files.download(file_id=file_id).read()

    logger.info(f"🖼️ Image generated (Mistral Agent / FLUX Pro Ultra): {len(file_bytes)} bytes, file_id={file_id}")
    return file_bytes, "mistral-agent-flux-pro-ultra"


# ─── Stage 2: Router (picks model based on premium flag) ────────────────────


async def _stage2_generate_image(visual_prompt: str, premium: bool = False) -> tuple[bytes, str]:
    """Route to the appropriate image generation backend.

    Priority order:
    1. Mistral Agent (FLUX Pro Ultra) — best quality, unified stack (all users)
    2. DALL-E 3 via OpenAI — premium fallback (paying users)
    3. FLUX Schnell via Together AI — free fallback
    4. DALL-E 3 via OpenAI — last resort (any user)

    Each backend is tried in order; if unavailable (no API key/agent_id), skip to next.
    """
    # Priority 1: Mistral Agent (all users — best quality + unified stack)
    if get_mistral_image_agent_id():
        try:
            return await _stage2_mistral_agent(visual_prompt)
        except Exception as e:
            logger.warning(f"⚠️ Mistral Agent image gen failed, trying fallbacks: {e}")

    # Priority 2: DALL-E 3 (premium users)
    if premium and get_openai_key():
        return await _stage2_dalle3(visual_prompt)

    # Priority 3: FLUX Schnell (free users)
    if get_together_key():
        return await _stage2_flux_schnell(visual_prompt)

    # Priority 4: DALL-E 3 (last resort for any user)
    if get_openai_key():
        logger.warning("⚠️ Falling back to DALL-E 3 (no Mistral Agent, no Together key)")
        return await _stage2_dalle3(visual_prompt)

    raise RuntimeError(
        "No image generation backend available. Configure MISTRAL_IMAGE_AGENT_ID, OPENAI_API_KEY, or TOGETHER_API_KEY."
    )


# ─── Post-processing ─────────────────────────────────────────────────────────


def _post_process(image_bytes: bytes) -> bytes:
    """Resize to 512x512 and convert to WebP."""
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed (RGBA, P, LA → RGB)
    if img.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", img.size, (10, 10, 15))  # #0a0a0f
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resize to 512x512 (cover crop)
    img = img.resize((512, 512), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WebP", quality=85, method=4)
    return buf.getvalue()


# ─── Upload & Save ────────────────────────────────────────────────────────────

LOCAL_IMAGE_DIR = Path("/opt/deepsight/keyword-images")


async def _upload_and_save(
    webp_bytes: bytes,
    term: str,
    thash: str,
    category: str | None,
    metaphor_data: dict,
    prompt_used: str,
    fun_score: float,
    generation_time_ms: int,
    model: str,
    pool,
) -> str:
    """Upload to R2 (or local filesystem fallback) and INSERT into keyword_images."""
    from storage.r2 import is_r2_available

    r2_key = f"keyword-images/{thash}.webp"

    if is_r2_available():
        image_url = await upload_to_r2(webp_bytes, r2_key)
    else:
        # Fallback: save to local filesystem, serve via /api/images/serve/
        LOCAL_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        filepath = LOCAL_IMAGE_DIR / f"{thash}.webp"
        filepath.write_bytes(webp_bytes)
        image_url = f"/api/images/serve/{thash}.webp"
        logger.info(f"📁 Local save: {filepath} ({len(webp_bytes)} bytes)")

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO keyword_images
                (term, term_hash, category, prompt_used, metaphor_data,
                 image_url, r2_key, status, model, generation_time_ms, fun_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8, $9, $10)
            ON CONFLICT (term_hash) DO UPDATE SET
                prompt_used = EXCLUDED.prompt_used,
                metaphor_data = EXCLUDED.metaphor_data,
                image_url = EXCLUDED.image_url,
                r2_key = EXCLUDED.r2_key,
                status = 'ready',
                model = EXCLUDED.model,
                generation_time_ms = EXCLUDED.generation_time_ms,
                fun_score = EXCLUDED.fun_score,
                error_message = NULL,
                updated_at = NOW()
            """,
            term,
            thash,
            category,
            prompt_used,
            json.dumps(metaphor_data, ensure_ascii=False),
            image_url,
            r2_key,
            model,
            generation_time_ms,
            fun_score,
        )

    logger.info(f"✅ Keyword image saved: '{term}' → {r2_key}")
    return image_url


# ─── Main orchestrator ────────────────────────────────────────────────────────


async def generate_keyword_image(
    term: str,
    definition: str,
    category: str | None = None,
    premium: bool = False,
    pool=None,
) -> Optional[str]:
    """Full pipeline: Mistral → Image gen → post-process → R2 → DB.
    premium=True uses DALL-E 3 (paying users), False uses FLUX Schnell (free).
    Returns image_url on success, None on failure."""
    if not get_mistral_key():
        logger.warning("⚠️ MISTRAL_API_KEY not configured, skipping image generation")
        return None
    if not _is_image_gen_available():
        logger.warning("⚠️ No image generation backend available, skipping")
        return None

    thash = _term_hash(term)
    fun_score = calculate_fun_score(term, category)
    start = time.time()

    try:
        # Stage 1: Art Director
        metaphor = await _stage1_art_director(term, definition, category)
        visual_prompt = metaphor["visual_prompt"]

        # Stage 2: Image Generation (tiered)
        raw_image, model_used = await _stage2_generate_image(visual_prompt, premium=premium)

        # Post-process
        webp_bytes = _post_process(raw_image)
        elapsed_ms = int((time.time() - start) * 1000)

        # Upload & Save
        if pool is None:
            pool = await _get_pool()

        image_url = await _upload_and_save(
            webp_bytes,
            term,
            thash,
            category,
            metaphor,
            visual_prompt,
            fun_score,
            elapsed_ms,
            model_used,
            pool,
        )
        return image_url

    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        logger.error(f"❌ Image generation failed for '{term}': {e}")
        # Record failure in DB
        try:
            if pool is None:
                pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO keyword_images (term, term_hash, category, status, fun_score, error_message, generation_time_ms)
                    VALUES ($1, $2, $3, 'failed', $4, $5, $6)
                    ON CONFLICT (term_hash) DO UPDATE SET
                        status = 'failed',
                        retry_count = keyword_images.retry_count + 1,
                        error_message = EXCLUDED.error_message,
                        generation_time_ms = EXCLUDED.generation_time_ms,
                        updated_at = NOW()
                    """,
                    term,
                    thash,
                    category,
                    fun_score,
                    str(e)[:500],
                    elapsed_ms,
                )
        except Exception:
            pass
        return None


# ─── DB pool helper ───────────────────────────────────────────────────────────

_pool = None


async def _get_pool():
    """Get or create asyncpg connection pool."""
    global _pool
    if _pool is None:
        import os
        import asyncpg

        db_url = os.environ.get("DATABASE_URL", "")
        if not db_url:
            raise RuntimeError("DATABASE_URL not set — keyword images require PostgreSQL")
        # Normalize URL scheme for asyncpg (needs postgresql://, not postgres://)
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        # Strip SQLAlchemy driver suffix if present
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        # Strip SSL params (asyncpg handles SSL differently)
        if "?" in db_url:
            base, params = db_url.split("?", 1)
            param_list = [p for p in params.split("&") if not p.startswith("sslmode=") and not p.startswith("ssl=")]
            db_url = base + ("?" + "&".join(param_list) if param_list else "")
        ssl_ctx = "require" if ".proxy.rlwy.net" in db_url else None
        _pool = await asyncpg.create_pool(db_url, min_size=1, max_size=3, ssl=ssl_ctx)
    return _pool


# ─── Lookup ───────────────────────────────────────────────────────────────────


async def get_image_url(term: str, pool=None) -> Optional[str]:
    """Lookup image URL for a term by hash."""
    if pool is None:
        pool = await _get_pool()
    thash = _term_hash(term)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT image_url FROM keyword_images WHERE term_hash = $1 AND status = 'ready'",
            thash,
        )
    return row["image_url"] if row else None


async def batch_get_image_urls(terms: list[str], pool=None) -> dict[str, str]:
    """Batch lookup image URLs for multiple terms. Returns {term_hash: image_url}."""
    if not terms:
        return {}
    if pool is None:
        pool = await _get_pool()

    hashes = [_term_hash(t) for t in terms]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT term_hash, image_url FROM keyword_images WHERE term_hash = ANY($1) AND status = 'ready'",
            hashes,
        )
    return {row["term_hash"]: row["image_url"] for row in rows}


# ═══════════════════════════════════════════════════════════════════════════════
# TUTEUR DOODLE PIPELINE (sprint 2026-05-18)
#
# Pipeline parallèle au pipeline "Le Saviez-Vous" pour le carrousel concepts
# illustrés de la page Tuteur fullscreen (`/hub?fsChat=tutor`). Différences clés :
#   • Modèle d'image : Gemini 3 Pro Image (Nano Banana Pro) avec fallback DALL-E 3
#   • Style : doodle ligne monochrome violet #c084fc, fond transparent
#   • Output : 200×200 WebP lossless (préserve RGBA)
#   • Pas d'art director Mistral (économie 1 LLM call par doodle, prompt templated)
#   • Storage : R2 préfixe `tutor-concepts/{hash}.webp`
#   • DB : même table `keyword_images` avec `style='tutor_doodle'` (term_hash discrimine)
# ═══════════════════════════════════════════════════════════════════════════════


def _build_doodle_prompt(term: str, definition: str | None) -> str:
    """Build a deterministic English visual prompt for the doodle backend.

    Pédagogiquement, les concepts Tuteur sont courts (1-3 mots) — un prompt
    templated single-noun donne de bons doodles consistants sans nécessiter
    le Mistral art-director (qui coûte 1 LLM call par image dans le pipeline
    photo). Économie : ~$0.0008/image (mistral-small) × 300/jour = ~$0.24/jour.
    """
    short_def = (definition or "").strip()[:160] if definition else ""
    if short_def:
        return (
            f"Symbolic doodle icon representing the abstract concept of "
            f'"{term}". Brief meaning: {short_def}. '
            f"Choose ONE simple visual metaphor (not the literal word)."
        )
    return (
        f"Symbolic doodle icon representing the abstract concept of "
        f'"{term}". Choose ONE simple visual metaphor (not the literal word).'
    )


async def _stage2_gemini_doodle(visual_prompt: str) -> tuple[bytes, str]:
    """Call Google Gemini 3 Pro Image to generate a doodle.

    Uses the Generative Language REST API directly (no SDK). Returns
    (raw_bytes, model_used). Raises if API key absent or response malformed.
    """
    api_key = get_gemini_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not configured")

    full_prompt = f"{visual_prompt}. {TUTOR_DOODLE_STYLE_SUFFIX}"

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{IMAGE_MODEL_GEMINI_DOODLE}:generateContent?key={api_key}"
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            url,
            json={
                "contents": [{"parts": [{"text": full_prompt}]}],
                "generationConfig": {"responseModalities": ["IMAGE"]},
            },
        )
        resp.raise_for_status()
        result = resp.json()

    candidates = result.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {result}")
    parts = candidates[0].get("content", {}).get("parts", [])
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and "data" in inline:
            import base64

            image_bytes = base64.b64decode(inline["data"])
            logger.info(f"🖼️ Doodle generated (Gemini 3 Pro Image): {len(image_bytes)} bytes")
            return image_bytes, IMAGE_MODEL_GEMINI_DOODLE
    raise RuntimeError(f"Gemini response missing inlineData: {result}")


async def _stage2_generate_doodle(visual_prompt: str) -> tuple[bytes, str]:
    """Doodle generation chain. Gemini first, DALL-E 3 fallback.

    Skips FLUX Schnell — Schnell doesn't reliably honor transparent backgrounds
    nor minimal line art instructions. DALL-E 3 fallback uses the same prompt
    suffix but may return RGB; post_process_doodle handles both cases.
    """
    if get_gemini_key():
        try:
            return await _stage2_gemini_doodle(visual_prompt)
        except Exception as e:
            logger.warning(f"⚠️ Gemini doodle failed, trying DALL-E 3 fallback: {e}")

    if get_openai_key():
        return await _stage2_dalle3(f"{visual_prompt}. {TUTOR_DOODLE_STYLE_SUFFIX}")

    raise RuntimeError("No doodle backend available (need GEMINI_API_KEY or OPENAI_API_KEY)")


def _post_process_doodle(image_bytes: bytes) -> bytes:
    """Resize to 200x200, KEEP transparency. Save as lossless WebP.

    Diff vs `_post_process()` (photo path):
      • Keeps RGBA (no compositing on dark background)
      • 200×200 instead of 512×512 (carousel cards are small)
      • lossless=True (preserve sharp line art doodle edges)
    """
    img = Image.open(io.BytesIO(image_bytes))

    # Force RGBA so transparency is preserved if present, alpha=255 otherwise
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    img = img.resize((200, 200), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WebP", quality=95, lossless=True, method=4)
    return buf.getvalue()


async def _upload_and_save_doodle(
    webp_bytes: bytes,
    term: str,
    thash: str,
    category: str | None,
    prompt_used: str,
    fun_score: float,
    generation_time_ms: int,
    model: str,
    pool,
) -> str:
    """Upload doodle to R2 (or local filesystem fallback) and UPSERT into
    `keyword_images` with `style='tutor_doodle'`."""
    from storage.r2 import is_r2_available

    r2_key = f"tutor-concepts/{thash}.webp"

    if is_r2_available():
        image_url = await upload_to_r2(webp_bytes, r2_key)
    else:
        # Local fallback (dev / R2 unconfigured) — mirror the photo path
        LOCAL_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        filepath = LOCAL_IMAGE_DIR / f"doodle_{thash}.webp"
        filepath.write_bytes(webp_bytes)
        image_url = f"/api/images/serve/doodle_{thash}.webp"
        logger.info(f"📁 Local doodle save: {filepath} ({len(webp_bytes)} bytes)")

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO keyword_images
                (term, term_hash, category, prompt_used,
                 image_url, r2_key, status, model, generation_time_ms,
                 fun_score, style)
            VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7, $8, $9, 'tutor_doodle')
            ON CONFLICT (term_hash) DO UPDATE SET
                prompt_used = EXCLUDED.prompt_used,
                image_url = EXCLUDED.image_url,
                r2_key = EXCLUDED.r2_key,
                status = 'ready',
                model = EXCLUDED.model,
                generation_time_ms = EXCLUDED.generation_time_ms,
                fun_score = EXCLUDED.fun_score,
                style = 'tutor_doodle',
                error_message = NULL,
                updated_at = NOW()
            """,
            term,
            thash,
            category,
            prompt_used,
            image_url,
            r2_key,
            model,
            generation_time_ms,
            fun_score,
        )

    logger.info(f"✅ Tutor doodle saved: '{term}' → {r2_key}")
    return image_url


async def generate_doodle_image(
    term: str,
    definition: str,
    category: str | None = None,
    pool=None,
) -> Optional[str]:
    """Full doodle pipeline: prompt → Gemini → post-process RGBA → R2 → DB.

    Standalone orchestrator (does NOT touch `generate_keyword_image()`'s photo
    path — zero risk of regression on "Le Saviez-Vous"). Returns image_url on
    success, None on failure.
    """
    if not get_gemini_key() and not get_openai_key():
        logger.warning("⚠️ No doodle backend available (need GEMINI or OPENAI key)")
        return None

    thash = _term_hash(term, style="tutor_doodle")
    fun_score = calculate_fun_score(term, category)
    start = time.time()

    try:
        visual_prompt = _build_doodle_prompt(term, definition)
        raw_image, model_used = await _stage2_generate_doodle(visual_prompt)
        webp_bytes = _post_process_doodle(raw_image)
        elapsed_ms = int((time.time() - start) * 1000)

        if pool is None:
            pool = await _get_pool()

        return await _upload_and_save_doodle(
            webp_bytes,
            term,
            thash,
            category,
            visual_prompt,
            fun_score,
            elapsed_ms,
            model_used,
            pool,
        )
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        logger.error(f"❌ Doodle generation failed for '{term}': {e}")
        try:
            if pool is None:
                pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO keyword_images
                        (term, term_hash, category, status, fun_score,
                         error_message, generation_time_ms, style)
                    VALUES ($1, $2, $3, 'failed', $4, $5, $6, 'tutor_doodle')
                    ON CONFLICT (term_hash) DO UPDATE SET
                        status = 'failed',
                        retry_count = keyword_images.retry_count + 1,
                        error_message = EXCLUDED.error_message,
                        generation_time_ms = EXCLUDED.generation_time_ms,
                        style = 'tutor_doodle',
                        updated_at = NOW()
                    """,
                    term,
                    thash,
                    category,
                    fun_score,
                    str(e)[:500],
                    elapsed_ms,
                )
        except Exception:
            pass
        return None


async def get_doodle_url(term: str, pool=None) -> Optional[str]:
    """Lookup doodle URL for a term (style='tutor_doodle')."""
    if pool is None:
        pool = await _get_pool()
    thash = _term_hash(term, style="tutor_doodle")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT image_url FROM keyword_images WHERE term_hash = $1 AND style = 'tutor_doodle' AND status = 'ready'",
            thash,
        )
    return row["image_url"] if row else None


async def batch_get_doodle_urls(terms: list[str], pool=None) -> dict[str, str]:
    """Batch lookup doodle URLs for multiple terms. Returns {term_hash: image_url}.

    Hashes are computed with `style='tutor_doodle'`, so they discriminate from
    legacy photo hashes for the same concept term.
    """
    if not terms:
        return {}
    if pool is None:
        pool = await _get_pool()

    hashes = [_term_hash(t, style="tutor_doodle") for t in terms]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT term_hash, image_url FROM keyword_images "
            "WHERE term_hash = ANY($1) AND style = 'tutor_doodle' AND status = 'ready'",
            hashes,
        )
    return {row["term_hash"]: row["image_url"] for row in rows}


# ─── Enqueue from summary ────────────────────────────────────────────────────


async def enqueue_images_for_summary(summary_id: int, pool=None) -> int:
    """Extract concepts from a summary and enqueue image generation for new ones.
    Returns count of enqueued tasks."""
    if not _is_image_gen_available():
        return 0

    if pool is None:
        pool = await _get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT entities_extracted FROM summaries WHERE id = $1",
            summary_id,
        )

    if not row or not row["entities_extracted"]:
        return 0

    try:
        entities = (
            json.loads(row["entities_extracted"])
            if isinstance(row["entities_extracted"], str)
            else row["entities_extracted"]
        )
    except (json.JSONDecodeError, TypeError):
        return 0

    # Extract concepts — handles two formats:
    # 1. {"concepts": ["str1", "str2"], "persons": [...]} (from extract_entities)
    # 2. [{"term": "...", "definition": "...", "category": "..."}] (from other sources)
    concepts: list[dict] = []
    if isinstance(entities, dict):
        for key in ("concepts", "keywords", "entities"):
            if key in entities and isinstance(entities[key], list):
                for ent in entities[key]:
                    if isinstance(ent, str) and len(ent) >= 2:
                        concepts.append({"term": ent, "definition": "", "category": "concept"})
                    elif isinstance(ent, dict) and "term" in ent:
                        concepts.append(ent)
                break
        # Also include persons as potential image targets
        for key in ("persons",):
            if key in entities and isinstance(entities[key], list):
                for ent in entities[key]:
                    if isinstance(ent, str) and len(ent) >= 2:
                        concepts.append({"term": ent, "definition": "", "category": "person"})
    elif isinstance(entities, list):
        for ent in entities:
            if isinstance(ent, str) and len(ent) >= 2:
                concepts.append({"term": ent, "definition": "", "category": "concept"})
            elif isinstance(ent, dict) and "term" in ent:
                concepts.append(ent)

    if not concepts:
        return 0

    # Filter out concepts that already have images
    hashes = [_term_hash(c["term"]) for c in concepts]
    async with pool.acquire() as conn:
        existing = await conn.fetch(
            "SELECT term_hash FROM keyword_images WHERE term_hash = ANY($1)",
            hashes,
        )
    existing_set = {r["term_hash"] for r in existing}

    enqueued = 0
    for concept in concepts:
        thash = _term_hash(concept["term"])
        if thash in existing_set:
            continue

        # Insert as pending
        concept.get("definition", concept.get("short_definition", ""))
        category = concept.get("category", "misc")
        fun_score = calculate_fun_score(concept["term"], category)
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO keyword_images (term, term_hash, category, status, fun_score)
                VALUES ($1, $2, $3, 'pending', $4)
                ON CONFLICT (term_hash) DO NOTHING
                """,
                concept["term"],
                thash,
                category,
                fun_score,
            )
        enqueued += 1

    logger.info(f"📋 Enqueued {enqueued} keyword images for summary {summary_id}")
    return enqueued


# ─── Hourly generation (APScheduler) ─────────────────────────────────────────


async def generate_hourly_image():
    """Pick 1 keyword without image and generate it. Called hourly by APScheduler."""
    pool = await _get_pool()

    async with pool.acquire() as conn:
        # 1. Chercher un keyword pending (du seed ou enqueue)
        row = await conn.fetchrow(
            """SELECT term, category FROM keyword_images
               WHERE status = 'pending'
               ORDER BY fun_score DESC NULLS LAST
               LIMIT 1"""
        )

    if not row:
        logger.info("⏭️ Hourly image: no pending keywords, skipping")
        return

    term = row["term"]
    category = row.get("category", "misc")
    definition = f"Concept: {term}"

    logger.info(f"⏰ Hourly image generation: '{term}'")
    result = await generate_keyword_image(term, definition, category, premium=False, pool=pool)

    if result:
        logger.info(f"✅ Hourly image done: '{term}' → {result}")
    else:
        logger.warning(f"❌ Hourly image failed: '{term}'")
