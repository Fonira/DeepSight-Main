"""
API Router — Images: Keyword Images + Screenshot Detection.

Keyword Images : illustrations IA "Le Saviez-Vous".
Screenshot Detection : détection de captures d'écran YouTube/TikTok → vidéo source.
"""

import base64
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

from auth.dependencies import get_current_admin
from auth.dependencies import require_plan
from core.config import get_mistral_key
from db.database import User

logger = logging.getLogger(__name__)

router = APIRouter()

LOCAL_IMAGE_DIR = Path("/opt/deepsight/keyword-images")


class ImageResponse(BaseModel):
    term: str
    image_url: Optional[str] = None
    status: str


class ImageStatsResponse(BaseModel):
    total: int
    pending: int
    ready: int
    failed: int


class GenerateRequest(BaseModel):
    term: str
    definition: str
    category: str = "misc"


# ─── Public endpoints ────────────────────────────────────────────────────────

@router.get("/keyword/{term}", response_model=ImageResponse)
async def get_keyword_image(term: str):
    """Get image URL for a keyword term."""
    from images.keyword_images import get_image_url

    url = await get_image_url(term)
    return ImageResponse(
        term=term,
        image_url=url,
        status="ready" if url else "not_found",
    )


@router.get("/serve/{filename}")
async def serve_local_image(filename: str):
    """Serve locally-stored keyword images (filesystem fallback when R2 not configured)."""
    # Sanitize filename — only allow hash.webp pattern
    if not filename.endswith(".webp") or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")

    filepath = LOCAL_IMAGE_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "Image not found")

    return FileResponse(
        filepath,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ─── Admin endpoints ────────────────────────────────────────────────────────

@router.post("/generate", response_model=dict)
async def trigger_generate(
    request: GenerateRequest,
    admin=Depends(get_current_admin),
):
    """Admin: manually trigger image generation for a keyword (synchronous)."""
    from images.keyword_images import generate_keyword_image

    url = await generate_keyword_image(
        request.term, request.definition, request.category, premium=False,
    )
    return {
        "term": request.term,
        "image_url": url,
        "status": "ready" if url else "failed",
    }


@router.post("/seed", response_model=dict)
async def trigger_seed(
    count: int = Query(default=20, le=50),
    admin=Depends(get_current_admin),
):
    """Admin: generate images for default concept words. Max 50 at a time."""
    from images.keyword_images import generate_keyword_image

    # Default words to seed (curated concepts for "Le Saviez-Vous")
    SEED_WORDS = [
        {"term": "Effet Dunning-Kruger", "definition": "Biais cognitif où les personnes peu compétentes surestiment leurs capacités, tandis que les experts sous-estiment les leurs.", "category": "cognitive_bias"},
        {"term": "Biais de confirmation", "definition": "Tendance à rechercher et interpréter les informations de manière à confirmer ses croyances préexistantes.", "category": "cognitive_bias"},
        {"term": "Effet de halo", "definition": "Biais cognitif où l'impression positive sur un trait influence le jugement sur d'autres traits non liés.", "category": "cognitive_bias"},
        {"term": "Dissonance cognitive", "definition": "Tension mentale ressentie lorsqu'on maintient simultanément deux croyances contradictoires.", "category": "psychology"},
        {"term": "Rasoir d'Ockham", "definition": "Principe selon lequel l'explication la plus simple est généralement la meilleure.", "category": "philosophy"},
        {"term": "Effet Streisand", "definition": "Phénomène où tenter de cacher une information la rend paradoxalement plus visible.", "category": "culture"},
        {"term": "Paradoxe de Fermi", "definition": "Contradiction entre la haute probabilité d'existence de civilisations extraterrestres et l'absence de preuves.", "category": "science"},
        {"term": "Biais d'ancrage", "definition": "Tendance à s'appuyer excessivement sur la première information reçue pour prendre une décision.", "category": "cognitive_bias"},
        {"term": "Effet Pygmalion", "definition": "Phénomène où les attentes élevées envers quelqu'un améliorent effectivement ses performances.", "category": "psychology"},
        {"term": "Loi de Goodhart", "definition": "Quand une mesure devient un objectif, elle cesse d'être une bonne mesure.", "category": "economics"},
        {"term": "Sophisme du survivant", "definition": "Erreur logique consistant à ne considérer que les succès visibles en ignorant les échecs invisibles.", "category": "cognitive_bias"},
        {"term": "Effet Mandela", "definition": "Phénomène de faux souvenirs partagés par un grand nombre de personnes.", "category": "psychology"},
        {"term": "Paradoxe de Simpson", "definition": "Phénomène statistique où une tendance présente dans des groupes séparés s'inverse quand on les combine.", "category": "science"},
        {"term": "Fenêtre d'Overton", "definition": "Gamme d'idées politiques considérées comme acceptables par le public à un moment donné.", "category": "culture"},
        {"term": "Effet Barnum", "definition": "Tendance à accepter des descriptions vagues comme spécifiquement applicables à soi-même.", "category": "psychology"},
        {"term": "Loi de Conway", "definition": "Les organisations conçoivent des systèmes qui reflètent leur propre structure de communication.", "category": "technology"},
        {"term": "Paradoxe de Moravec", "definition": "En IA, les tâches faciles pour les humains sont difficiles pour les machines, et inversement.", "category": "technology"},
        {"term": "Effet IKEA", "definition": "Tendance à accorder plus de valeur aux choses qu'on a partiellement créées soi-même.", "category": "psychology"},
        {"term": "Tragédie des communs", "definition": "Situation où des individus agissant dans leur intérêt propre épuisent une ressource partagée.", "category": "economics"},
        {"term": "Chambre d'écho", "definition": "Environnement où les opinions sont amplifiées par répétition au sein d'un système fermé.", "category": "culture"},
    ]

    results = []
    generated = 0
    for word in SEED_WORDS[:count]:
        logger.info(f"🌱 Seed: generating '{word['term']}'...")
        url = await generate_keyword_image(
            word["term"], word["definition"], word.get("category", "misc"),
            premium=False,
        )
        status = "ready" if url else "failed"
        results.append({"term": word["term"], "status": status, "image_url": url})
        if url:
            generated += 1

    return {
        "requested": min(count, len(SEED_WORDS)),
        "generated": generated,
        "results": results,
    }


@router.get("/stats", response_model=ImageStatsResponse)
async def get_image_stats(admin=Depends(get_current_admin)):
    """Admin: get image generation statistics."""
    from images.keyword_images import _get_pool

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'ready') as ready,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM keyword_images
            """
        )

    return ImageStatsResponse(
        total=row["total"],
        pending=row["pending"],
        ready=row["ready"],
        failed=row["failed"],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Screenshot Detection endpoints
# ═══════════════════════════════════════════════════════════════════════════════

SUPPORTED_PLATFORMS = ["youtube", "tiktok"]
SUPPORTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class ScreenshotDetectRequest(BaseModel):
    """Body pour POST /detect."""
    image_base64: Optional[str] = None
    image_url: Optional[str] = None

    @field_validator("image_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError("image_url must start with http:// or https://")
        return v


class DetectedVideo(BaseModel):
    """Vidéo détectée dans le screenshot."""
    platform: str
    video_url: Optional[str] = None
    video_title: Optional[str] = None
    channel: Optional[str] = None
    search_query: Optional[str] = None
    confidence: str  # "high" | "medium" | "low"


class ScreenshotDetectResponse(BaseModel):
    """Réponse de POST /detect."""
    detected: bool
    video: Optional[DetectedVideo] = None
    searched_url: Optional[str] = None
    method: str  # "ocr" | "vision" | "none"


class SupportedPlatform(BaseModel):
    name: str
    indicators: List[str]


class ScreenshotSupportedResponse(BaseModel):
    """Réponse de GET /supported."""
    platforms: List[SupportedPlatform]
    max_image_size_mb: int
    supported_formats: List[str]
    capabilities: List[str]


class _ImageData:
    """Objet minimal compatible avec detect_video_screenshot(image=...)."""
    def __init__(self, data: str, mime_type: str) -> None:
        self.data = data
        self.mime_type = mime_type


async def _download_image(url: str) -> tuple[str, str]:
    """Télécharge une image depuis une URL, retourne (base64_data, mime_type).

    Raises HTTPException si le téléchargement échoue ou le fichier est trop gros.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("[SCREENSHOT] Image download failed: %s", exc)
        raise HTTPException(400, f"Could not download image from URL: {exc}")

    content_type = resp.headers.get("content-type", "image/png").split(";")[0].strip()
    if content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(400, f"Unsupported image type: {content_type}")

    if len(resp.content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            400,
            f"Image too large ({len(resp.content) // (1024*1024)}MB). Max {MAX_IMAGE_SIZE_BYTES // (1024*1024)}MB.",
        )

    b64 = base64.b64encode(resp.content).decode("ascii")
    return b64, content_type


def _compute_confidence(result: Dict[str, Any]) -> str:
    """Calcule un niveau de confiance à partir du résultat OCR/Vision."""
    has_url = bool(result.get("video_url"))
    has_title = bool(result.get("video_title"))
    has_channel = bool(result.get("channel"))

    if has_url:
        return "high"
    if has_title and has_channel:
        return "medium"
    return "low"


@router.post("/detect", response_model=ScreenshotDetectResponse)
async def detect_screenshot(
    body: ScreenshotDetectRequest,
    user: User = Depends(require_plan("plus")),
) -> ScreenshotDetectResponse:
    """Détecte une vidéo YouTube/TikTok depuis une capture d'écran.

    Accepte une image en base64 ou via URL.
    Pipeline : OCR Mistral → fallback Vision → recherche vidéo.
    Nécessite le plan Plus minimum.
    """
    from images.screenshot_detection import (
        detect_video_screenshot,
        detect_video_screenshot_vision,
        is_garbage_query,
        search_video_from_screenshot,
    )

    if not body.image_base64 and not body.image_url:
        raise HTTPException(422, "Provide either image_base64 or image_url")

    api_key = get_mistral_key()
    if not api_key:
        raise HTTPException(503, "Screenshot detection temporarily unavailable")

    # --- Resolve image data ---
    if body.image_url:
        b64_data, mime_type = await _download_image(body.image_url)
    else:
        b64_data = body.image_base64  # type: ignore[assignment]
        mime_type = "image/png"  # default; OCR handles data-uri prefix

    image = _ImageData(data=b64_data, mime_type=mime_type)

    # --- Step 1 : OCR detection ---
    method = "ocr"
    result = await detect_video_screenshot(image, api_key)

    # --- Step 2 : Vision fallback si OCR échoue ou garbage ---
    if result is None or (
        result.get("search_query") and is_garbage_query(result["search_query"])
    ):
        platform_hint = (result or {}).get("platform", "youtube")
        vision_result = await detect_video_screenshot_vision(image, api_key, platform_hint)
        if vision_result:
            result = vision_result
            method = "vision"

    if not result:
        return ScreenshotDetectResponse(detected=False, method="none")

    # --- Step 3 : Recherche vidéo si pas d'URL directe ---
    searched_url: Optional[str] = None
    if not result.get("video_url") and result.get("search_query"):
        searched_url = await search_video_from_screenshot(
            result["search_query"], result["platform"],
        )

    confidence = _compute_confidence(result)

    video = DetectedVideo(
        platform=result["platform"],
        video_url=result.get("video_url"),
        video_title=result.get("video_title"),
        channel=result.get("channel"),
        search_query=result.get("search_query"),
        confidence=confidence,
    )

    logger.info(
        "[SCREENSHOT] User %s detected %s video (confidence=%s, method=%s)",
        user.id, result["platform"], confidence, method,
    )

    return ScreenshotDetectResponse(
        detected=True,
        video=video,
        searched_url=searched_url,
        method=method,
    )


@router.get("/supported", response_model=ScreenshotSupportedResponse)
async def screenshot_supported() -> ScreenshotSupportedResponse:
    """Retourne les plateformes et capacités de détection de screenshots."""
    return ScreenshotSupportedResponse(
        platforms=[
            SupportedPlatform(
                name="youtube",
                indicators=["youtube.com", "youtu.be", "youtube shorts"],
            ),
            SupportedPlatform(
                name="tiktok",
                indicators=["tiktok.com", "vm.tiktok.com"],
            ),
        ],
        max_image_size_mb=MAX_IMAGE_SIZE_BYTES // (1024 * 1024),
        supported_formats=SUPPORTED_MIME_TYPES,
        capabilities=[
            "ocr_text_extraction",
            "vision_fallback",
            "url_detection",
            "platform_identification",
            "video_search",
        ],
    )
