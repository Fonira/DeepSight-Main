"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📄 EXPORT ROUTER — Endpoints d'export des analyses                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  v2.0 — Enhanced PDF exports with multiple modes                                   ║
║  • Full analysis PDF (all sections)                                                ║
║  • Summary-only PDF (compact)                                                      ║
║  • PDF with flashcards                                                             ║
║  • Study pack PDF (flashcards + quiz)                                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
import io

logger = logging.getLogger(__name__)

from db.database import get_session, User, Summary
from auth.dependencies import get_current_user
from videos.service import get_summary_by_id

from .service import (
    export_summary,
    get_available_formats,
    get_pdf_export_options,
    export_to_audio,
    get_audio_file_path,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ExportRequest(BaseModel):
    """Requête d'export"""
    summary_id: int
    format: str = "md"  # txt, md, csv, docx, pdf, xlsx
    pdf_type: Optional[str] = Field(
        default="full",
        description="Type d'export PDF: full, summary, flashcards, study"
    )
    include_flashcards: bool = Field(
        default=False,
        description="Inclure les flashcards (génère si absent)"
    )


class FormatInfo(BaseModel):
    """Info sur un format d'export"""
    format: str
    name: str
    description: str
    available: bool


class PDFOptionInfo(BaseModel):
    """Info sur une option d'export PDF"""
    type: str
    name: str
    description: str
    icon: str


class FormatsResponse(BaseModel):
    """Réponse listant les formats disponibles"""
    formats: List[str]
    pdf_options: List[PDFOptionInfo]


# ═══════════════════════════════════════════════════════════════════════════════
# 📄 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/formats", response_model=FormatsResponse)
async def list_formats():
    """
    Liste les formats d'export disponibles et les options PDF.
    
    Returns:
        formats: Liste des formats (txt, md, docx, pdf)
        pdf_options: Options d'export PDF avec descriptions
    """
    pdf_options = [
        PDFOptionInfo(
            type=opt["type"],
            name=opt["name"],
            description=opt["description"],
            icon=opt["icon"]
        )
        for opt in get_pdf_export_options()
    ]
    
    return FormatsResponse(
        formats=get_available_formats(),
        pdf_options=pdf_options
    )


@router.post("/")
async def export_analysis(
    request: ExportRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Exporte une analyse dans le format demandé.
    
    Formats supportés:
    - **txt**: Texte brut
    - **md**: Markdown (avec tables et metadata)
    - **docx**: Document Word
    - **pdf**: PDF professionnel (avec options: full, summary, flashcards, study)
    
    Pour les exports PDF, utilisez pdf_type pour choisir le contenu:
    - **full**: Synthèse complète avec concepts, timestamps, entités
    - **summary**: Résumé condensé uniquement
    - **flashcards**: Synthèse + cartes de révision
    - **study**: Pack étude complet (synthèse + flashcards + quiz)
    """
    # Vérifier le format
    available = get_available_formats()
    if request.format not in available:
        raise HTTPException(
            status_code=400,
            detail=f"Format not available. Choose from: {', '.join(available)}"
        )
    
    # Vérifier le type PDF
    valid_pdf_types = ["full", "summary", "flashcards", "study"]
    if request.format == "pdf" and request.pdf_type not in valid_pdf_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid PDF type. Choose from: {', '.join(valid_pdf_types)}"
        )
    
    # Récupérer le résumé
    summary = await get_summary_by_id(session, request.summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # Parser les entités si présentes
    entities = None
    if summary.entities_extracted:
        try:
            entities = json.loads(summary.entities_extracted)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse entities_extracted for summary {request.summary_id}: {e}")

    # Récupérer les flashcards si nécessaire
    flashcards = None
    if request.include_flashcards or request.pdf_type in ["flashcards", "study"]:
        flashcards = await _get_or_generate_flashcards(session, summary, current_user)
    
    # Sources (si disponibles dans le fact-checking)
    sources = None
    if summary.fact_check_result:
        try:
            fact_check = json.loads(summary.fact_check_result)
            if isinstance(fact_check, dict) and "sources" in fact_check:
                sources = fact_check["sources"]
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse fact_check_result for summary {request.summary_id}: {e}")
    
    # Générer l'export
    content, filename, mimetype = export_summary(
        format=request.format,
        title=summary.video_title,
        channel=summary.video_channel,
        category=summary.category,
        mode=summary.mode,
        summary=summary.summary_content,
        video_url=summary.video_url,
        duration=summary.video_duration,
        thumbnail_url=summary.thumbnail_url,
        entities=entities,
        reliability_score=summary.reliability_score,
        created_at=summary.created_at,
        flashcards=flashcards,
        sources=sources,
        pdf_export_type=request.pdf_type or "full"
    )
    
    if content is None:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate {request.format} export"
        )
    
    # Retourner le fichier
    if isinstance(content, str):
        content = content.encode('utf-8')
    
    return Response(
        content=content,
        media_type=mimetype,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/{summary_id}/{format}")
async def export_analysis_get(
    summary_id: int,
    format: str,
    pdf_type: str = Query(default="full", description="PDF export type"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Export via GET (pour liens directs de téléchargement).
    
    GET /api/exports/123/pdf?pdf_type=full → PDF complet
    GET /api/exports/123/pdf?pdf_type=flashcards → PDF avec flashcards
    """
    request = ExportRequest(
        summary_id=summary_id, 
        format=format,
        pdf_type=pdf_type,
        include_flashcards=(pdf_type in ["flashcards", "study"])
    )
    return await export_analysis(request, current_user, session)


@router.get("/pdf-options")
async def get_pdf_options():
    """
    Retourne les options d'export PDF disponibles.
    Utile pour le frontend pour afficher les choix.
    """
    return {
        "options": get_pdf_export_options(),
        "default": "full"
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_or_generate_flashcards(
    session: AsyncSession, 
    summary: Summary,
    user: User
) -> Optional[List[dict]]:
    """
    Récupère les flashcards existantes ou en génère de nouvelles.
    
    Note: Pour une v2, on pourrait stocker les flashcards en DB.
    Pour l'instant, on génère à la volée si besoin.
    """
    # Try to extract from summary content (if embedded)
    # Some summaries include flashcards in markdown format
    flashcards = _extract_flashcards_from_summary(summary.summary_content)
    
    if flashcards:
        return flashcards
    
    # Generate simple flashcards from key concepts
    if summary.entities_extracted:
        try:
            entities = json.loads(summary.entities_extracted)
            if entities.get("concepts"):
                return _generate_simple_flashcards(
                    entities["concepts"][:10],
                    summary.summary_content
                )
        except Exception as e:
            logger.error(f"Failed to generate flashcards from entities: {e}")
    
    return None


def _extract_flashcards_from_summary(summary: str) -> Optional[List[dict]]:
    """Tente d'extraire des flashcards depuis le contenu du résumé"""
    import re
    
    flashcards = []
    
    # Pattern 1: Q: ... A: ... format
    qa_pattern = r'(?:Q:|Question:)\s*(.+?)\n(?:A:|Answer:|Réponse:)\s*(.+?)(?=\n(?:Q:|Question:)|\Z)'
    matches = re.findall(qa_pattern, summary, re.DOTALL | re.IGNORECASE)
    
    for q, a in matches:
        flashcards.append({
            "front": q.strip(),
            "back": a.strip()
        })
    
    # Pattern 2: **Term**: Definition
    term_pattern = r'\*\*([^*]+)\*\*:\s*([^\n]+)'
    term_matches = re.findall(term_pattern, summary)
    
    for term, definition in term_matches[:5]:  # Limit to avoid noise
        if len(definition) > 20:  # Only substantial definitions
            flashcards.append({
                "front": f"Qu'est-ce que {term}?",
                "back": definition.strip()
            })
    
    return flashcards if flashcards else None


def _generate_simple_flashcards(concepts: List[str], summary: str) -> List[dict]:
    """Génère des flashcards simples à partir des concepts clés"""
    flashcards = []
    
    for concept in concepts[:8]:
        # Find relevant sentence in summary
        context = _find_concept_context(concept, summary)
        
        if context:
            flashcards.append({
                "front": f"Qu'est-ce que {concept}?",
                "back": context
            })
        else:
            flashcards.append({
                "front": concept,
                "back": f"Concept clé mentionné dans la vidéo."
            })
    
    return flashcards


def _find_concept_context(concept: str, summary: str) -> Optional[str]:
    """Trouve le contexte d'un concept dans le résumé"""
    import re

    # Look for sentence containing the concept
    sentences = re.split(r'[.!?]\s+', summary)

    concept_lower = concept.lower()
    for sentence in sentences:
        if concept_lower in sentence.lower() and len(sentence) > 30:
            # Clean up the sentence
            clean = sentence.strip()
            if len(clean) > 200:
                clean = clean[:200] + "..."
            return clean

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔊 AUDIO EXPORT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class AudioExportRequest(BaseModel):
    """Requête d'export audio"""
    voice_id: Optional[str] = None
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    audio_mode: str = Field(
        default="full",
        description="'full' = synthèse complète, 'condensed' = résumé ~2 min"
    )


@router.post("/{summary_id}/audio")
async def export_analysis_audio(
    summary_id: int,
    request: AudioExportRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Export an analysis as audio (MP3) via ElevenLabs TTS.
    Requires Pro plan or higher (tts feature).
    """
    from core.config import PLAN_LIMITS

    # Feature gating: check if tts is blocked for user's plan
    plan = current_user.plan or "free"
    blocked = PLAN_LIMITS.get(plan, PLAN_LIMITS.get("free", {})).get("blocked_features", [])
    if "tts" in blocked:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "feature_locked",
                "message": "L'export audio nécessite un plan Pro ou supérieur",
                "current_plan": plan,
                "required_plan": "pro",
                "action": "upgrade",
            }
        )

    # Get the summary
    summary = await get_summary_by_id(session, summary_id, current_user.id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    if not summary.summary_content:
        raise HTTPException(status_code=400, detail="Analysis has no content to export as audio")

    # Generate audio
    result = await export_to_audio(
        title=summary.video_title or "Vidéo",
        channel=summary.video_channel or "",
        summary=summary.summary_content,
        mode=summary.mode or "standard",
        voice_id=request.voice_id or "",
        speed=request.speed,
        condensed=(request.audio_mode == "condensed"),
    )

    if not result:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate audio export. ElevenLabs may be unavailable."
        )

    return {
        "status": "success",
        "data": {
            "audio_url": f"/api/exports/audio/{result['file_id']}",
            "file_id": result["file_id"],
            "duration_estimate": result["duration_estimate"],
        }
    }


@router.get("/audio/{file_id}")
async def stream_audio_file(
    file_id: str,
    request: Request,
):
    """
    Stream a generated audio file. Supports Range requests for seeking.
    No JWT required — the UUID file_id is the security token.
    """

    file_path = get_audio_file_path(file_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Audio file not found or expired")

    import os
    file_size = os.path.getsize(file_path)

    # Check for Range header (for seeking in audio player)
    range_header = None
    if request and hasattr(request, 'headers'):
        range_header = request.headers.get("range")

    if range_header and range_header.startswith("bytes="):
        # Parse range: "bytes=start-end" or "bytes=start-"
        range_spec = range_header[6:]
        parts = range_spec.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1

        # Clamp values
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        content_length = end - start + 1

        with open(file_path, "rb") as f:
            f.seek(start)
            data = f.read(content_length)

        return Response(
            content=data,
            status_code=206,
            media_type="audio/mpeg",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Cache-Control": "public, max-age=3600",
            }
        )

    # No Range header — return full file
    with open(file_path, "rb") as f:
        data = f.read()

    return Response(
        content=data,
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Disposition": f'inline; filename="{file_id}.mp3"',
            "Cache-Control": "public, max-age=3600",
        }
    )
