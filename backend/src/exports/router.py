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
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
import io

from db.database import get_session, User, Summary
from auth.dependencies import get_current_user
from videos.service import get_summary_by_id

from .service import (
    export_summary, 
    get_available_formats, 
    get_pdf_export_options
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ExportRequest(BaseModel):
    """Requête d'export"""
    summary_id: int
    format: str = "md"  # txt, md, docx, pdf
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
        except:
            pass
    
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
        except:
            pass
    
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
        except:
            pass
    
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
