"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📄 EXPORT ROUTER — Endpoints d'export des analyses                                ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import io

from db.database import get_session, User
from auth.dependencies import get_current_user
from videos.service import get_summary_by_id

from .service import export_summary, get_available_formats

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ExportRequest(BaseModel):
    """Requête d'export"""
    summary_id: int
    format: str = "md"  # txt, md, csv, docx, pdf, xlsx


# ═══════════════════════════════════════════════════════════════════════════════
# 📄 ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/formats")
async def list_formats():
    """Liste les formats d'export disponibles"""
    return {"formats": get_available_formats()}


@router.post("/")
async def export_analysis(
    request: ExportRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Exporte une analyse dans le format demandé.
    Retourne le fichier en téléchargement.
    """
    # Vérifier le format
    available = get_available_formats()
    if request.format not in available:
        raise HTTPException(
            status_code=400,
            detail=f"Format not available. Choose from: {', '.join(available)}"
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
        created_at=summary.created_at
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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Export via GET (pour liens directs de téléchargement).
    GET /api/exports/123/pdf → télécharge le PDF
    """
    request = ExportRequest(summary_id=summary_id, format=format)
    return await export_analysis(request, current_user, session)
