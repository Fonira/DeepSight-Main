"""
Academic Sources Router
API endpoints for academic paper search and bibliography export
"""

import asyncio
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from db.database import get_session, User, Summary, AcademicPaper as AcademicPaperDB
from auth.dependencies import get_current_user, get_verified_user
from core.config import get_plan_limits

from .schemas import (
    AcademicPaper,
    AcademicSearchRequest,
    AcademicSearchResponse,
    AcademicEnrichRequest,
    BibliographyExportRequest,
    BibliographyExportResponse,
    BibliographyFormat,
    Author,
    AcademicSource,
)
from .aggregator import academic_aggregator, get_tier_limit
from .bibliography import bibliography_exporter

router = APIRouter(prefix="/api/academic", tags=["academic"])


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 SEARCH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/search", response_model=AcademicSearchResponse)
async def search_academic_papers(
    request: AcademicSearchRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Search for academic papers across Semantic Scholar, OpenAlex, and arXiv.

    Results are deduplicated, scored by relevance, and limited based on user's plan.
    """
    try:
        user_plan = current_user.plan or "free"
        print(f"Starting academic search for user plan: {user_plan}, keywords: {request.keywords}", flush=True)

        # Search all sources
        response = await academic_aggregator.search(request, user_plan)

        print(f"Academic search completed: {response.total_found} papers found from {len(response.sources_queried)} sources", flush=True)
        return response

    except asyncio.TimeoutError:
        print(f"Academic search timeout after 90s", flush=True)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "academic_search_timeout",
                "message": "Search took too long. Please try again with more specific keywords."
            }
        )
    except Exception as e:
        print(f"Academic search error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "academic_search_failed",
                "message": "Failed to search academic sources. Please try again."
            }
        )


@router.post("/enrich/{summary_id}", response_model=AcademicSearchResponse)
async def enrich_summary_with_academic_sources(
    summary_id: int,
    request: Optional[AcademicEnrichRequest] = None,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Enrich a video analysis with relevant academic sources.

    Extracts keywords from the summary's concepts and searches for related papers.
    Results are cached in the database for future retrieval.
    """
    # Verify summary ownership
    result = await session.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == current_user.id
        )
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "summary_not_found",
                "message": "Analysis not found or access denied."
            }
        )

    # Extract keywords from summary
    keywords = _extract_keywords_from_summary(summary)
    print(f"Extracted keywords for summary {summary_id}: {keywords}", flush=True)

    if not keywords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "no_keywords",
                "message": "Could not extract keywords from this analysis."
            }
        )

    user_plan = current_user.plan or "free"
    max_papers = request.max_papers if request else None

    # Search for papers
    search_request = AcademicSearchRequest(
        keywords=keywords,
        summary_id=str(summary_id),
        limit=max_papers or get_tier_limit(user_plan)
    )

    try:
        response = await academic_aggregator.search(search_request, user_plan)

        # Cache papers in database
        await _cache_papers(session, summary_id, response.papers)

        print(f"Enrichment completed: {response.total_found} papers found and cached for summary {summary_id}", flush=True)
        return response

    except asyncio.TimeoutError:
        print(f"Academic enrichment timeout for summary {summary_id}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "academic_search_timeout",
                "message": "Search took too long. The analysis may have too many keywords. Please try again."
            }
        )


@router.get("/papers/{summary_id}", response_model=AcademicSearchResponse)
async def get_cached_papers(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get cached academic papers for a summary.

    Returns papers that were previously found and cached.
    """
    # Verify summary ownership
    result = await session.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == current_user.id
        )
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "summary_not_found",
                "message": "Analysis not found or access denied."
            }
        )

    # Fetch cached papers
    result = await session.execute(
        select(AcademicPaperDB).where(
            AcademicPaperDB.summary_id == summary_id
        ).order_by(AcademicPaperDB.relevance_score.desc())
    )
    cached_papers = result.scalars().all()

    # Convert to response model
    papers = [_db_to_model(p) for p in cached_papers]

    user_plan = current_user.plan or "free"
    tier_limit = get_tier_limit(user_plan)

    return AcademicSearchResponse(
        papers=papers[:tier_limit],
        total_found=len(papers),
        query_keywords=[],
        sources_queried=[],
        cached=True,
        tier_limit_reached=len(papers) > tier_limit,
        tier_limit=tier_limit if len(papers) > tier_limit else None
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 BIBLIOGRAPHY EXPORT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/export", response_model=BibliographyExportResponse)
async def export_bibliography(
    request: BibliographyExportRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Export selected papers as bibliography in various formats.

    Available formats: BibTeX, RIS, APA, MLA, Chicago, Harvard

    Requires at least 'starter' plan for basic formats,
    'pro' plan for all formats.
    """
    user_plan = current_user.plan or "free"
    plan_limits = get_plan_limits(user_plan)

    # Check if bibliography export is enabled for this plan
    if not _can_export_bibliography(user_plan):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_required",
                "message": "Bibliography export requires Starter plan or higher.",
                "current_plan": user_plan,
                "required_plan": "starter",
                "action": "upgrade"
            }
        )

    # Fetch papers by IDs
    papers = await _get_papers_by_ids(session, current_user.id, request.paper_ids)

    if not papers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "papers_not_found",
                "message": "No papers found with the specified IDs."
            }
        )

    # Export to requested format
    content = bibliography_exporter.export(papers, request.format)
    filename = bibliography_exporter.get_filename(request.format)

    return BibliographyExportResponse(
        content=content,
        format=request.format,
        paper_count=len(papers),
        filename=filename
    )


@router.get("/formats")
async def get_available_formats(
    current_user: User = Depends(get_current_user)
):
    """
    Get available bibliography export formats for the user's plan.
    """
    user_plan = current_user.plan or "free"

    all_formats = [
        {"id": "bibtex", "name": "BibTeX", "extension": ".bib"},
        {"id": "ris", "name": "RIS", "extension": ".ris"},
        {"id": "apa", "name": "APA 7th Edition", "extension": ".txt"},
        {"id": "mla", "name": "MLA 9th Edition", "extension": ".txt"},
        {"id": "chicago", "name": "Chicago", "extension": ".txt"},
        {"id": "harvard", "name": "Harvard", "extension": ".txt"},
    ]

    can_export = _can_export_bibliography(user_plan)

    return {
        "formats": all_formats if can_export else [],
        "can_export": can_export,
        "user_plan": user_plan
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_keywords_from_summary(summary: Summary) -> List[str]:
    """Extract searchable keywords from a summary"""
    import re
    from collections import Counter

    keywords = []

    # Enhanced stop words list
    stop_words = {
        # English
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "can", "and", "or", "but", "if",
        "then", "else", "when", "where", "why", "how", "all", "each", "every",
        "both", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "about", "into", "through", "during", "before", "after", "above", "below",
        "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
        "further", "once", "here", "there", "all", "any", "both", "each", "more",
        "most", "other", "some", "such", "that", "these", "those", "what", "which",
        "who", "whom", "this", "those", "am", "as", "at", "by", "for", "it", "its",
        "of", "to", "with", "you", "your", "we", "our", "they", "their", "them",
        "he", "him", "his", "she", "her", "hers", "me", "my", "mine", "us",
        # French
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "pour",
        "dans", "sur", "avec", "par", "en", "au", "aux", "ce", "cette", "ces",
        "qui", "que", "dont", "où", "est", "sont", "être", "avoir", "fait",
        "faire", "plus", "comme", "tout", "tous", "toute", "toutes", "même",
        "aussi", "bien", "très", "pas", "ne", "sans", "sous", "après", "avant",
        "nous", "vous", "ils", "elles", "leur", "leurs", "lui", "elle", "se",
        "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes"
    }

    # 1. Extract from video title (prioritize capitalized terms)
    if summary.video_title:
        # Extract capitalized terms (likely proper nouns/important concepts)
        capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', summary.video_title)
        for term in capitalized:
            if term.lower() not in stop_words and len(term) > 2:
                keywords.append(term)

        # Extract other meaningful words
        words = summary.video_title.lower().split()
        for word in words:
            clean_word = "".join(c for c in word if c.isalnum())
            if clean_word and len(clean_word) > 3 and clean_word not in stop_words:
                keywords.append(clean_word)

    # 2. Extract from summary content (most important source!)
    if summary.summary_content:
        content = summary.summary_content

        # Extract capitalized terms (concepts, names, etc.)
        capitalized = re.findall(r'\b[A-Z][A-Z]+\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', content)
        for term in capitalized[:10]:  # Limit to top 10
            if term.lower() not in stop_words and len(term) > 2:
                keywords.append(term)

        # Extract frequently used terms (TF analysis)
        words = re.findall(r'\b[a-zA-Z]{4,}\b', content.lower())
        word_freq = Counter(w for w in words if w not in stop_words)

        # Add top 10 most frequent words
        for word, _ in word_freq.most_common(10):
            if len(word) > 3:
                keywords.append(word)

    # 3. From entities if available
    if summary.entities_extracted:
        try:
            entities = json.loads(summary.entities_extracted)
            if isinstance(entities, list):
                keywords.extend(entities[:5])
            elif isinstance(entities, dict):
                for key in ["concepts", "topics", "keywords", "persons", "organizations"]:
                    if key in entities and isinstance(entities[key], list):
                        keywords.extend(entities[key][:5])
        except (json.JSONDecodeError, ValueError):
            pass

    # 4. From tags
    if summary.tags:
        try:
            if isinstance(summary.tags, str):
                tags = json.loads(summary.tags) if summary.tags.startswith("[") else summary.tags.split(",")
                keywords.extend([t.strip() for t in tags[:5]])
        except (json.JSONDecodeError, AttributeError, ValueError):
            pass

    # Deduplicate and limit
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if isinstance(kw, str):
            kw_lower = kw.lower().strip()
            # Skip if too short, already seen, or is a stop word
            if kw_lower and kw_lower not in seen and len(kw_lower) > 2 and kw_lower not in stop_words:
                seen.add(kw_lower)
                unique_keywords.append(kw)
                if len(unique_keywords) >= 15:  # Increased from 10 to 15
                    break

    print(f"Extracted {len(unique_keywords)} keywords: {unique_keywords[:10]}...", flush=True)
    return unique_keywords


async def _cache_papers(
    session: AsyncSession,
    summary_id: int,
    papers: List[AcademicPaper]
):
    """Cache papers in the database"""
    # Delete existing cached papers for this summary
    await session.execute(
        delete(AcademicPaperDB).where(AcademicPaperDB.summary_id == summary_id)
    )

    # Insert new papers
    for paper in papers:
        db_paper = AcademicPaperDB(
            summary_id=summary_id,
            external_id=paper.id,
            doi=paper.doi,
            title=paper.title,
            authors_json=json.dumps([{"name": a.name, "affiliation": a.affiliation} for a in paper.authors]),
            year=paper.year,
            venue=paper.venue,
            abstract=paper.abstract,
            citation_count=paper.citation_count,
            url=paper.url,
            pdf_url=paper.pdf_url,
            source=paper.source,
            relevance_score=paper.relevance_score,
            is_open_access=paper.is_open_access,
            keywords_json=json.dumps(paper.keywords)
        )
        session.add(db_paper)

    await session.commit()


def _db_to_model(db_paper: AcademicPaperDB) -> AcademicPaper:
    """Convert database model to Pydantic model"""
    authors = []
    if db_paper.authors_json:
        try:
            authors_data = json.loads(db_paper.authors_json)
            authors = [Author(name=a.get("name", "Unknown"), affiliation=a.get("affiliation")) for a in authors_data]
        except json.JSONDecodeError:
            pass

    keywords = []
    if db_paper.keywords_json:
        try:
            keywords = json.loads(db_paper.keywords_json)
        except json.JSONDecodeError:
            pass

    return AcademicPaper(
        id=db_paper.external_id,
        doi=db_paper.doi,
        title=db_paper.title,
        authors=authors,
        year=db_paper.year,
        venue=db_paper.venue,
        abstract=db_paper.abstract,
        citation_count=db_paper.citation_count,
        url=db_paper.url,
        pdf_url=db_paper.pdf_url,
        source=db_paper.source,
        relevance_score=db_paper.relevance_score,
        is_open_access=db_paper.is_open_access,
        keywords=keywords
    )


async def _get_papers_by_ids(
    session: AsyncSession,
    user_id: int,
    paper_ids: List[str]
) -> List[AcademicPaper]:
    """Get papers by external IDs, verifying user ownership"""
    # Get all papers for user's summaries
    result = await session.execute(
        select(AcademicPaperDB)
        .join(Summary)
        .where(
            Summary.user_id == user_id,
            AcademicPaperDB.external_id.in_(paper_ids)
        )
    )
    db_papers = result.scalars().all()

    return [_db_to_model(p) for p in db_papers]


def _can_export_bibliography(plan: str) -> bool:
    """Check if plan allows bibliography export"""
    allowed_plans = ["starter", "student", "pro", "expert", "team", "unlimited"]
    return plan in allowed_plans
