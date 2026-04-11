"""
API Router — Keyword Images (illustrations IA "Le Saviez-Vous").
"""

import hashlib
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from auth.dependencies import get_current_admin

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
