"""
Academic Sources Router
API endpoints for academic paper search and bibliography export
"""

import asyncio
import json
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from collections import Counter
import httpx

from db.database import get_session, User, Summary, AcademicPaper as AcademicPaperDB
from auth.dependencies import get_current_user, get_verified_user
from core.config import get_plan_limits, get_mistral_key
from billing.plan_config import get_limits

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
    Search for academic papers across OpenAlex, CrossRef, Semantic Scholar, and arXiv.

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

    # Extract keywords from summary (AI-powered topic analysis)
    keywords = await _extract_keywords_from_summary(summary)
    print(f"Extracted keywords for summary {summary_id}: {keywords}", flush=True)

    if not keywords:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "no_keywords",
                "message": "Could not extract keywords from this analysis."
            }
        )

    # 🌍 Translate keywords FR → EN for English-centric academic APIs
    translated = await _translate_keywords_to_english(keywords)
    if translated:
        print(f"Translated keywords: {translated}", flush=True)
        keywords = translated
    else:
        print(f"Using original keywords (translation skipped or failed)", flush=True)

    user_plan = current_user.plan or "free"
    max_papers = request.max_papers if request else None

    # Build search request with top keywords (AI topics first, then structured)
    search_keywords = keywords[:15]
    search_request = AcademicSearchRequest(
        keywords=search_keywords,
        summary_id=str(summary_id),
        limit=max_papers or get_tier_limit(user_plan)
    )

    try:
        # Pass video title for title-based search fallback
        video_title = summary.video_title if summary.video_title else None
        response = await academic_aggregator.search(
            search_request,
            user_plan,
            video_title=video_title
        )

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
    """
    user_plan = current_user.plan or "free"

    if not _can_export_bibliography(user_plan):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plan_required",
                "message": "Bibliography export requires Pro plan or higher.",
                "current_plan": user_plan,
                "required_plan": "pro",
                "action": "upgrade"
            }
        )

    papers = await _get_papers_by_ids(session, current_user.id, request.paper_ids)

    if not papers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "papers_not_found",
                "message": "No papers found with the specified IDs."
            }
        )

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
    """Get available bibliography export formats for the user's plan."""
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

# Common French academic terms → English mapping for fast fallback translation
_FR_EN_TERMS = {
    "intelligence artificielle": "artificial intelligence",
    "apprentissage automatique": "machine learning",
    "apprentissage profond": "deep learning",
    "réseau de neurones": "neural network",
    "réseaux de neurones": "neural networks",
    "cerveau": "brain",
    "neuroscience": "neuroscience",
    "conscience": "consciousness",
    "comportement": "behavior",
    "mémoire": "memory",
    "émotion": "emotion",
    "perception": "perception",
    "cognition": "cognition",
    "psychologie": "psychology",
    "biologie": "biology",
    "génétique": "genetics",
    "évolution": "evolution",
    "écologie": "ecology",
    "environnement": "environment",
    "changement climatique": "climate change",
    "réchauffement climatique": "global warming",
    "énergie renouvelable": "renewable energy",
    "développement durable": "sustainable development",
    "santé": "health",
    "médecine": "medicine",
    "maladie": "disease",
    "traitement": "treatment",
    "vaccin": "vaccine",
    "virus": "virus",
    "bactérie": "bacteria",
    "système immunitaire": "immune system",
    "cellule": "cell",
    "protéine": "protein",
    "molécule": "molecule",
    "chimie": "chemistry",
    "physique": "physics",
    "quantique": "quantum",
    "relativité": "relativity",
    "astronomie": "astronomy",
    "espace": "space",
    "gravité": "gravity",
    "mathématiques": "mathematics",
    "algorithme": "algorithm",
    "données": "data",
    "numérique": "digital",
    "informatique": "computer science",
    "économie": "economics",
    "société": "society",
    "politique": "politics",
    "philosophie": "philosophy",
    "histoire": "history",
    "éducation": "education",
    "langage": "language",
    "communication": "communication",
    "nutrition": "nutrition",
    "alimentation": "nutrition",
    "obésité": "obesity",
    "diabète": "diabetes",
    "cancer": "cancer",
    "dépression": "depression",
    "anxiété": "anxiety",
    "sommeil": "sleep",
    "stress": "stress",
    "addiction": "addiction",
    "drogue": "drug",
    "cannabis": "cannabis",
    "alcool": "alcohol",
    "tabac": "tobacco",
    "dopamine": "dopamine",
    "sérotonine": "serotonin",
    "neurotransmetteur": "neurotransmitter",
    "synapse": "synapse",
    "cortex": "cortex",
    "hippocampe": "hippocampus",
    "amygdale": "amygdala",
    "système nerveux": "nervous system",
    "système endocannabinoïde": "endocannabinoid system",
    "récepteur": "receptor",
}


async def _translate_keywords_to_english(keywords: List[str]) -> List[str]:
    """
    Translate keywords to English for academic API search.
    Uses a 2-level approach:
    1. Fast dictionary lookup for common terms
    2. Mistral AI for complex/unknown terms
    Returns translated keywords or empty list if translation not needed.
    """
    if not keywords:
        return []

    # Quick check: if keywords appear to be already in English, skip
    text_lower = " ".join(keywords).lower()
    french_indicators = {
        "artificielle", "apprentissage", "profond", "réseau", "neurone",
        "cerveau", "données", "modèle", "système", "analyse", "théorie",
        "société", "économie", "philosophie", "psychologie", "biologie",
        "histoire", "politique", "mathématique", "physique", "chimie",
        "environnement", "climatique", "énergie", "santé", "médecine",
        "génétique", "numérique", "quantique", "relativité", "maladie",
        "évolution", "cognitif", "conscience", "comportement", "langage",
        "traitement", "récepteur", "neurotransmetteur", "molécule",
        "cellule", "protéine", "dépression", "addiction", "drogue",
    }

    has_french = any(ind in text_lower for ind in french_indicators)
    has_accents = any(c in text_lower for c in "éèêëàâäùûüôöïîç")

    if not has_french and not has_accents:
        print("Keywords appear English — skipping translation", flush=True)
        return []

    # ── LEVEL 1: Fast dictionary translation ──
    translated = []
    needs_ai_translation = []

    for kw in keywords[:12]:
        kw_lower = kw.lower().strip()

        # Check exact match in dictionary
        if kw_lower in _FR_EN_TERMS:
            translated.append(_FR_EN_TERMS[kw_lower])
            continue

        # Check if it contains a known French term
        found = False
        for fr_term, en_term in _FR_EN_TERMS.items():
            if fr_term in kw_lower:
                translated.append(en_term)
                found = True
                break

        if not found:
            # If the word has no accent and looks like it could be English/Latin, keep it
            if not any(c in kw_lower for c in "éèêëàâäùûüôöïîç") and len(kw) > 2:
                translated.append(kw)  # Keep as-is (might be a proper noun or shared term)
            else:
                needs_ai_translation.append(kw)

    # ── LEVEL 2: Mistral AI for remaining terms ──
    if needs_ai_translation:
        api_key = get_mistral_key()
        if api_key:
            ai_translated = await _mistral_translate(needs_ai_translation, api_key)
            translated.extend(ai_translated)
        else:
            # Last resort: strip accents and hope for the best
            for term in needs_ai_translation:
                cleaned = _strip_accents(term)
                translated.append(cleaned)

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for t in translated:
        t_lower = t.lower().strip()
        if t_lower and t_lower not in seen:
            seen.add(t_lower)
            unique.append(t)

    return unique


async def _mistral_translate(terms: List[str], api_key: str) -> List[str]:
    """Translate terms using Mistral AI"""
    keywords_text = "\n".join(f"- {kw}" for kw in terms)

    prompt = f"""Translate these French academic keywords to English for searching scientific papers.
Return ONLY a JSON array of translated terms. Keep proper nouns unchanged. Use standard academic English terms.

French keywords:
{keywords_text}

Return format: ["term1", "term2", "term3"]
JSON array:"""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistral-small-2603",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500,
                    "temperature": 0.1
                }
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()

            json_match = re.search(r'\[.*?\]', text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                if isinstance(result, list):
                    return [t.strip() for t in result if isinstance(t, str) and t.strip()]

        return []
    except Exception as e:
        print(f"Mistral translation error: {e}", flush=True)
        return []


def _strip_accents(text: str) -> str:
    """Remove French accents from text as last-resort translation"""
    replacements = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'à': 'a', 'â': 'a', 'ä': 'a',
        'ù': 'u', 'û': 'u', 'ü': 'u',
        'ô': 'o', 'ö': 'o',
        'ï': 'i', 'î': 'i',
        'ç': 'c',
    }
    for fr, en in replacements.items():
        text = text.replace(fr, en)
    return text


async def _extract_keywords_from_summary(summary: Summary) -> List[str]:
    """Extract searchable keywords from a summary using AI topic analysis.

    Strategy: Use Mistral AI to identify the video's MAIN RESEARCH TOPICS,
    then combine with structured extraction for maximum coverage.

    Priority order:
    1. 🧠 AI-extracted main topics from summary content (most relevant!)
    2. [[concepts]] marked in summary_content
    3. Video title words
    4. Category + tags
    5. Extracted entities
    6. TF analysis of content (frequency-based)

    Target: 20-25 diverse, academically-relevant keywords.
    """
    keywords_prioritized: List[str] = []  # AI topics go first
    keywords_structured: List[str] = []   # Structured extraction

    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "must", "can", "and", "or", "but", "if",
        "then", "else", "when", "where", "why", "how", "all", "each", "every",
        "both", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "about", "into", "through", "during", "before", "after", "above", "below",
        "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
        "further", "once", "here", "there", "that", "these", "those", "what", "which",
        "who", "whom", "this", "am", "as", "at", "by", "for", "it", "its",
        "of", "to", "with", "you", "your", "we", "our", "they", "their", "them",
        "he", "him", "his", "she", "her", "hers", "me", "my", "mine", "us",
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "pour",
        "dans", "sur", "avec", "par", "en", "au", "aux", "ce", "cette", "ces",
        "qui", "que", "dont", "où", "est", "sont", "être", "avoir", "fait",
        "faire", "plus", "comme", "tout", "tous", "toute", "toutes", "même",
        "aussi", "bien", "très", "pas", "ne", "sans", "sous", "après", "avant",
        "nous", "vous", "ils", "elles", "leur", "leurs", "lui", "elle", "se",
        "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes",
        "vidéo", "video", "chaîne", "partie", "épisode", "episode",
        "youtube", "abonnez", "commentaire", "lien", "description",
    }

    # ── 1. 🧠 AI TOPIC EXTRACTION (highest priority) ──────────────────────
    # Use Mistral to analyze summary content and extract main research topics
    content_for_ai = ""
    if summary.summary_content:
        # Clean the summary: remove [[markers]], trim to ~3000 chars for efficiency
        clean = re.sub(r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]', r'\1', summary.summary_content)
        content_for_ai = clean[:3000]

    if not content_for_ai and summary.full_digest:
        content_for_ai = summary.full_digest[:3000]

    if content_for_ai:
        ai_topics = await _extract_topics_with_ai(
            content=content_for_ai,
            video_title=summary.video_title or "",
            category=summary.category or "",
        )
        if ai_topics:
            keywords_prioritized.extend(ai_topics)
            print(f"AI-extracted {len(ai_topics)} topics: {ai_topics}", flush=True)

    # ── 2. 🎯 Extract [[concepts]] markers ──────────────────────────────
    if summary.summary_content:
        concept_pattern = r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]'
        concept_matches = re.findall(concept_pattern, summary.summary_content)
        for term in concept_matches:
            term = term.strip()
            if term and len(term) > 2:
                keywords_structured.append(term)

    # ── 3. Extract from video title ─────────────────────────────────────
    if summary.video_title:
        # Multi-word capitalized phrases (proper nouns, names)
        capitalized = re.findall(r'\b[A-Z][a-zéèêëàâäùûüôöïîç]+(?:\s+[A-Z][a-zéèêëàâäùûüôöïîç]+)*\b', summary.video_title)
        for term in capitalized:
            if term.lower() not in stop_words and len(term) > 2:
                keywords_structured.append(term)

        # Individual significant words from title
        words = summary.video_title.lower().split()
        for word in words:
            clean_word = "".join(c for c in word if c.isalnum() or c in "éèêëàâäùûüôöïîç-")
            if clean_word and len(clean_word) > 3 and clean_word not in stop_words:
                keywords_structured.append(clean_word)

    # ── 4. Category as keyword ──────────────────────────────────────────
    if summary.category and summary.category.lower() not in stop_words:
        keywords_structured.append(summary.category)

    # ── 5. From tags (more generous — up to 10) ────────────────────────
    if summary.tags:
        try:
            if isinstance(summary.tags, str):
                tags = json.loads(summary.tags) if summary.tags.startswith("[") else summary.tags.split(",")
                keywords_structured.extend([t.strip() for t in tags[:10] if t.strip()])
        except (json.JSONDecodeError, AttributeError, ValueError):
            pass

    # ── 6. From entities (more generous — up to 8 per category) ────────
    if summary.entities_extracted:
        try:
            entities = json.loads(summary.entities_extracted)
            if isinstance(entities, list):
                keywords_structured.extend(entities[:10])
            elif isinstance(entities, dict):
                for key in ["concepts", "topics", "keywords", "persons", "organizations", "theories", "methods"]:
                    if key in entities and isinstance(entities[key], list):
                        keywords_structured.extend(entities[key][:8])
        except (json.JSONDecodeError, ValueError):
            pass

    # ── 7. TF analysis from content (always run, not just fallback) ────
    if summary.summary_content:
        clean_content = re.sub(r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]', r'\1', summary.summary_content)

        # Extract multi-word terms (2-3 word phrases that appear together)
        bigrams = re.findall(
            r'\b([a-zA-ZéèêëàâäùûüôöïîçÉÈÊËÀÂÄÙÛÜÔÖÏÎÇ]{3,}\s+[a-zA-ZéèêëàâäùûüôöïîçÉÈÊËÀÂÄÙÛÜÔÖÏÎÇ]{3,})\b',
            clean_content.lower()
        )
        bigram_freq = Counter(
            bg for bg in bigrams
            if not all(w in stop_words for w in bg.split())
        )
        for bigram, count in bigram_freq.most_common(8):
            if count >= 2:  # Must appear at least twice
                keywords_structured.append(bigram)

        # Single words (high frequency)
        words = re.findall(r'\b[a-zA-ZéèêëàâäùûüôöïîçÉÈÊËÀÂÄÙÛÜÔÖÏÎÇ]{4,}\b', clean_content.lower())
        word_freq = Counter(w for w in words if w not in stop_words)
        for word, count in word_freq.most_common(12):
            if count >= 2:
                keywords_structured.append(word)

    # ── MERGE: AI topics first, then structured extraction ─────────────
    # AI topics are the most relevant → they go first
    all_keywords = keywords_prioritized + keywords_structured

    # Deduplicate while preserving priority order
    seen = set()
    unique_keywords = []
    for kw in all_keywords:
        if isinstance(kw, str):
            kw_lower = kw.lower().strip()
            if kw_lower and kw_lower not in seen and len(kw_lower) > 2 and kw_lower not in stop_words:
                seen.add(kw_lower)
                unique_keywords.append(kw)
                if len(unique_keywords) >= 25:
                    break

    print(f"Extracted {len(unique_keywords)} keywords (AI:{len(keywords_prioritized)} + struct:{len(keywords_structured)}): {unique_keywords}", flush=True)
    return unique_keywords


async def _extract_topics_with_ai(
    content: str,
    video_title: str = "",
    category: str = "",
) -> List[str]:
    """Use Mistral AI to extract main research topics from the video summary.

    This is the core of topic-based academic search: instead of just extracting
    individual concept names, we ask the AI to identify the RESEARCH DOMAINS
    and SCIENTIFIC TOPICS that this video covers.

    Returns: List of 8-15 academic-oriented topic terms in English.
    """
    api_key = get_mistral_key()
    if not api_key:
        print("No Mistral key — skipping AI topic extraction", flush=True)
        return []

    # Build context
    context_parts = []
    if video_title:
        context_parts.append(f"Video title: {video_title}")
    if category:
        context_parts.append(f"Category: {category}")
    context_parts.append(f"Summary excerpt:\n{content[:2500]}")

    context = "\n".join(context_parts)

    prompt = f"""You are an academic research assistant. Analyze this video summary and extract the main RESEARCH TOPICS and SCIENTIFIC DOMAINS that would help find relevant academic papers.

{context}

Instructions:
1. Identify the 8-15 most important research topics covered in this content
2. Include both SPECIFIC topics (e.g. "endocannabinoid system", "dopamine receptors") and BROADER domains (e.g. "neuropharmacology", "cognitive neuroscience")
3. Use standard ENGLISH academic terminology (translate from French if needed)
4. Include related scientific fields that would have relevant papers
5. Focus on terms that would yield results on academic databases like OpenAlex, CrossRef, PubMed
6. Do NOT include generic terms like "research", "study", "analysis", "science"

Return ONLY a JSON array of topic strings, nothing else.
Example: ["endocannabinoid system", "THC neurotoxicity", "cannabinoid receptors", "prefrontal cortex development", "adolescent brain development", "neuropharmacology", "substance abuse", "synaptic plasticity", "cognitive impairment", "cannabis use disorder"]

JSON array:"""

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistral-small-2603",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 600,
                    "temperature": 0.2
                }
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()

            # Parse JSON array from response
            json_match = re.search(r'\[.*?\]', text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                if isinstance(result, list):
                    topics = [t.strip() for t in result if isinstance(t, str) and t.strip() and len(t.strip()) > 2]
                    return topics[:15]

        return []
    except Exception as e:
        print(f"AI topic extraction error: {e}", flush=True)
        return []


async def _cache_papers(
    session: AsyncSession,
    summary_id: int,
    papers: List[AcademicPaper]
):
    """Cache papers in the database"""
    await session.execute(
        delete(AcademicPaperDB).where(AcademicPaperDB.summary_id == summary_id)
    )

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
    """Check if plan allows bibliography export using config system."""
    return get_limits(plan).get("bibliography_export", False)
