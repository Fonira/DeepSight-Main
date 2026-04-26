"""
Academic Sources Aggregator
Combines results from OpenAlex, CrossRef, Semantic Scholar, and arXiv with:
- Multi-query strategy (title-based + keyword-based + fallbacks)
- Parallel querying
- Deduplication by DOI and title similarity
- Relevance scoring
- Tier-based result limiting
"""

import asyncio
import os
from typing import List, Optional, Dict, Set
from difflib import SequenceMatcher
from datetime import datetime
import math

from .schemas import AcademicPaper, AcademicSearchRequest, AcademicSearchResponse
from .semantic_scholar import semantic_scholar_client
from .openalex import openalex_client
from .arxiv_client import arxiv_client
from .crossref_client import crossref_client

# Source weights for scoring
SOURCE_WEIGHTS = {"semantic_scholar": 1.0, "openalex": 0.95, "crossref": 0.90, "arxiv": 0.85}

# Tier limits for academic papers
TIER_LIMITS = {
    "free": 5,
    "starter": 30,  # Maps to pro (normalize_plan_id)
    "student": 15,  # Handled by normalize_plan_id → pro
    "etudiant": 15,  # Handled by normalize_plan_id → pro
    "pro": 30,
    "expert": 30,  # Maps to pro (normalize_plan_id)
    "unlimited": 30,  # Maps to pro (normalize_plan_id)
}


def get_tier_limit(plan: str) -> int:
    """Get the paper limit for a user's plan"""
    return TIER_LIMITS.get(plan, TIER_LIMITS["free"])


def normalize_title(title: str) -> str:
    """Normalize title for comparison"""
    title = title.lower().strip()
    title = " ".join(title.split())
    return title


def title_similarity(title1: str, title2: str) -> float:
    """Calculate title similarity using SequenceMatcher"""
    t1 = normalize_title(title1)
    t2 = normalize_title(title2)
    return SequenceMatcher(None, t1, t2).ratio()


def calculate_recency_score(year: Optional[int]) -> float:
    """Calculate recency score with exponential decay"""
    if not year:
        return 0.5

    current_year = datetime.now().year
    age = current_year - year

    # Exponential decay: recent papers score higher
    decay_rate = 0.1
    return math.exp(-decay_rate * max(age, 0))


def calculate_citation_score(citation_count: int) -> float:
    """Calculate normalized citation score using logarithmic scale"""
    if citation_count <= 0:
        return 0.0
    return min(math.log10(citation_count + 1) / 3, 1.0)


class AcademicAggregator:
    """Aggregates and scores academic papers from multiple sources.

    Strategy: Multi-query approach for maximum coverage.
    1. Primary query: translated keywords (focused, top 5)
    2. Secondary query: broader keywords (top 8)
    3. Title query: video title as natural language search
    4. Sources prioritized: OpenAlex + CrossRef (always), Semantic Scholar (if API key), arXiv (preprints)
    """

    def __init__(self):
        self.semantic_scholar = semantic_scholar_client
        self.openalex = openalex_client
        self.arxiv = arxiv_client
        self.crossref = crossref_client

    def _has_semantic_scholar_key(self) -> bool:
        """Check if Semantic Scholar API key is available"""
        return bool(os.environ.get("SEMANTIC_SCHOLAR_API_KEY", ""))

    def _build_query(self, keywords: List[str], max_keywords: int = 5) -> str:
        """Build an optimized search query from keywords.

        Strategy:
        - Use top N keywords (most relevant first)
        - Quote multi-word terms to keep them as phrases
        - Keep total query concise for API compatibility
        """
        top_keywords = keywords[:max_keywords]
        parts = []
        for kw in top_keywords:
            kw = kw.strip()
            if not kw:
                continue
            if " " in kw:
                parts.append(f'"{kw}"')
            else:
                parts.append(kw)
        return " ".join(parts)

    def _build_simple_query(self, keywords: List[str], max_keywords: int = 5) -> str:
        """Build a simple space-separated query (no quotes) for APIs that handle it better."""
        top_keywords = keywords[:max_keywords]
        return " ".join(kw.strip() for kw in top_keywords if kw.strip())

    async def search(
        self, request: AcademicSearchRequest, user_plan: str = "free", video_title: Optional[str] = None
    ) -> AcademicSearchResponse:
        """
        Search all academic sources with multi-query fallback strategy.

        Args:
            request: Search request with keywords and filters
            user_plan: User's subscription plan for tier limiting
            video_title: Optional video title for title-based search

        Returns:
            AcademicSearchResponse with deduplicated and scored papers
        """
        keywords = request.keywords
        # Build multiple query formulations from AI-enriched keywords
        focused_query = self._build_query(keywords, max_keywords=6)
        broad_query = self._build_query(keywords, max_keywords=10)
        simple_query = self._build_simple_query(keywords, max_keywords=8)

        # Title-based query (often the best for broad searches)
        title_query = None
        if video_title:
            # Clean the title: remove channel names, episode numbers, etc.
            import re

            clean_title = re.sub(r"\s*[|\-–—]\s*.*$", "", video_title)  # Remove "| Channel Name"
            clean_title = re.sub(r"#\d+", "", clean_title)  # Remove #123
            clean_title = re.sub(r"\s+", " ", clean_title).strip()
            if len(clean_title) > 10:
                title_query = clean_title

        print("Academic search queries:", flush=True)
        print(f"  Focused: {focused_query}", flush=True)
        print(f"  Broad: {broad_query}", flush=True)
        print(f"  Simple: {simple_query}", flush=True)
        print(f"  Title: {title_query}", flush=True)

        use_ss = self._has_semantic_scholar_key()
        if not use_ss:
            print("Semantic Scholar: SKIPPED (no API key → would get 429)", flush=True)

        # ═══════════════════════════════════════════════════════════════
        # PHASE 1: Primary search — OpenAlex + CrossRef (always reliable)
        # ═══════════════════════════════════════════════════════════════
        primary_tasks = [
            self._search_openalex(focused_query, request),
            self._search_crossref(focused_query, request),
        ]
        if use_ss:
            primary_tasks.append(self._search_semantic_scholar(focused_query, request))

        all_papers: List[AcademicPaper] = []
        sources_queried: List[str] = []

        try:
            results = await asyncio.wait_for(asyncio.gather(*primary_tasks, return_exceptions=True), timeout=30.0)
        except asyncio.TimeoutError:
            print("Phase 1 timeout — continuing with partial results", flush=True)
            results = []

        source_names_phase1 = ["openalex", "crossref"]
        if use_ss:
            source_names_phase1.append("semantic_scholar")

        for i, result in enumerate(results):
            source_name = source_names_phase1[i] if i < len(source_names_phase1) else "unknown"
            if isinstance(result, Exception):
                print(f"  {source_name}: ERROR — {result}", flush=True)
                continue
            if isinstance(result, list):
                print(f"  {source_name}: {len(result)} papers", flush=True)
                sources_queried.append(source_name)
                all_papers.extend(result)

        # ═══════════════════════════════════════════════════════════════
        # PHASE 2: If few results, try with title query + arXiv
        # ═══════════════════════════════════════════════════════════════
        if len(all_papers) < 5:
            print(f"Phase 1 returned only {len(all_papers)} papers — launching Phase 2", flush=True)

            phase2_tasks = []
            phase2_names = []

            # Try title-based search on OpenAlex + CrossRef
            if title_query:
                phase2_tasks.append(self._search_openalex(title_query, request))
                phase2_names.append("openalex_title")
                phase2_tasks.append(self._search_crossref(title_query, request))
                phase2_names.append("crossref_title")

            # Also try broader keyword query
            if broad_query != focused_query:
                phase2_tasks.append(self._search_openalex(broad_query, request))
                phase2_names.append("openalex_broad")
                phase2_tasks.append(self._search_crossref(broad_query, request))
                phase2_names.append("crossref_broad")

            # arXiv (preprints, good for STEM)
            if request.include_preprints:
                arxiv_query = simple_query or focused_query
                phase2_tasks.append(self._search_arxiv(arxiv_query, request))
                phase2_names.append("arxiv")

            if phase2_tasks:
                try:
                    results2 = await asyncio.wait_for(
                        asyncio.gather(*phase2_tasks, return_exceptions=True), timeout=30.0
                    )
                except asyncio.TimeoutError:
                    print("Phase 2 timeout", flush=True)
                    results2 = []

                for i, result in enumerate(results2):
                    source_name = phase2_names[i] if i < len(phase2_names) else "unknown"
                    if isinstance(result, Exception):
                        print(f"  {source_name}: ERROR — {result}", flush=True)
                        continue
                    if isinstance(result, list):
                        print(f"  {source_name}: {len(result)} papers", flush=True)
                        base_source = source_name.split("_")[0]
                        if base_source not in sources_queried:
                            sources_queried.append(base_source)
                        all_papers.extend(result)

        # ═══════════════════════════════════════════════════════════════
        # PHASE 3: Last resort — simple query without quotes
        # ═══════════════════════════════════════════════════════════════
        if len(all_papers) < 3 and simple_query:
            print(f"Still only {len(all_papers)} papers — Phase 3 last resort with simple query", flush=True)
            try:
                results3 = await asyncio.wait_for(
                    asyncio.gather(
                        self._search_openalex(simple_query, request),
                        self._search_crossref(simple_query, request),
                        return_exceptions=True,
                    ),
                    timeout=20.0,
                )
                for result in results3:
                    if isinstance(result, list):
                        all_papers.extend(result)
                        print(f"  Phase 3 added {len(result)} papers", flush=True)
            except asyncio.TimeoutError:
                print("Phase 3 timeout", flush=True)

        print(f"Total papers before deduplication: {len(all_papers)}", flush=True)

        # Deduplicate papers
        deduplicated = self._deduplicate(all_papers)
        print(f"Papers after deduplication: {len(deduplicated)}", flush=True)

        # Score and sort papers
        scored = self._score_papers(deduplicated, keywords)
        scored.sort(key=lambda p: p.relevance_score, reverse=True)

        # Apply tier limit
        tier_limit = get_tier_limit(user_plan)
        tier_limit_reached = len(scored) > tier_limit
        limited_papers = scored[:tier_limit]

        print(f"Final: {len(limited_papers)} papers (tier limit: {tier_limit}, sources: {sources_queried})", flush=True)

        return AcademicSearchResponse(
            papers=limited_papers,
            total_found=len(scored),
            query_keywords=keywords,
            sources_queried=sources_queried,
            cached=False,
            tier_limit_reached=tier_limit_reached,
            tier_limit=tier_limit if tier_limit_reached else None,
        )

    async def _search_semantic_scholar(self, query: str, request: AcademicSearchRequest) -> List[AcademicPaper]:
        """Search Semantic Scholar"""
        try:
            print(f"  → Semantic Scholar: {query[:60]}...", flush=True)
            results = await self.semantic_scholar.search(
                query=query,
                limit=min(request.limit * 2, 40),
                year_from=request.year_from,
                year_to=request.year_to,
                fields_of_study=request.fields_of_study,
            )
            return results
        except Exception as e:
            print(f"  Semantic Scholar error: {e}", flush=True)
            return []

    async def _search_openalex(self, query: str, request: AcademicSearchRequest) -> List[AcademicPaper]:
        """Search OpenAlex"""
        try:
            print(f"  → OpenAlex: {query[:60]}...", flush=True)
            results = await self.openalex.search(
                query=query, limit=min(request.limit * 2, 50), year_from=request.year_from, year_to=request.year_to
            )
            return results
        except Exception as e:
            print(f"  OpenAlex error: {e}", flush=True)
            return []

    async def _search_crossref(self, query: str, request: AcademicSearchRequest) -> List[AcademicPaper]:
        """Search CrossRef"""
        try:
            print(f"  → CrossRef: {query[:60]}...", flush=True)
            results = await self.crossref.search(
                query=query, limit=min(request.limit * 2, 40), year_from=request.year_from, year_to=request.year_to
            )
            return results
        except Exception as e:
            print(f"  CrossRef error: {e}", flush=True)
            return []

    async def _search_arxiv(self, query: str, request: AcademicSearchRequest) -> List[AcademicPaper]:
        """Search arXiv (if preprints included)"""
        if not request.include_preprints:
            return []

        try:
            print(f"  → arXiv: {query[:60]}...", flush=True)
            results = await self.arxiv.search(query=query, limit=min(request.limit * 2, 20))
            return results
        except Exception as e:
            print(f"  arXiv error: {e}", flush=True)
            return []

    def _deduplicate(self, papers: List[AcademicPaper]) -> List[AcademicPaper]:
        """
        Deduplicate papers by DOI and title similarity.
        Keeps the version with the most information.
        """
        seen_dois: Set[str] = set()
        unique_papers: List[AcademicPaper] = []
        seen_titles: Dict[str, AcademicPaper] = {}

        for paper in papers:
            # Check DOI first (exact match)
            if paper.doi:
                doi_normalized = paper.doi.lower().strip()
                if doi_normalized in seen_dois:
                    continue
                seen_dois.add(doi_normalized)

            # Check title similarity
            norm_title = normalize_title(paper.title)

            # Quick exact title match
            if norm_title in seen_titles:
                existing = seen_titles[norm_title]
                # Keep the one with more info
                if self._paper_quality(paper) > self._paper_quality(existing):
                    unique_papers.remove(existing)
                    unique_papers.append(paper)
                    seen_titles[norm_title] = paper
                continue

            # Fuzzy title match against existing
            is_duplicate = False
            for existing_title, existing_paper in seen_titles.items():
                if title_similarity(norm_title, existing_title) > 0.85:
                    is_duplicate = True
                    if self._paper_quality(paper) > self._paper_quality(existing_paper):
                        unique_papers.remove(existing_paper)
                        unique_papers.append(paper)
                        # Update seen_titles
                        del seen_titles[existing_title]
                        seen_titles[norm_title] = paper
                    break

            if not is_duplicate:
                unique_papers.append(paper)
                seen_titles[norm_title] = paper

        return unique_papers

    def _paper_quality(self, paper: AcademicPaper) -> float:
        """Score paper quality for deduplication — higher = more info"""
        score = 0.0
        score += paper.citation_count * 0.001
        score += len(paper.abstract or "") * 0.001
        score += 1.0 if paper.pdf_url else 0.0
        score += 0.5 if paper.doi else 0.0
        score += 0.5 if paper.year else 0.0
        score += SOURCE_WEIGHTS.get(paper.source, 0.5)
        return score

    def _score_papers(self, papers: List[AcademicPaper], keywords: List[str]) -> List[AcademicPaper]:
        """
        Calculate final relevance score for each paper based on:
        - Original source relevance
        - Citation count
        - Recency
        - Keyword match
        - Source weight
        """
        keywords_lower = [k.lower() for k in keywords]

        for paper in papers:
            source_relevance = paper.relevance_score
            citation_score = calculate_citation_score(paper.citation_count)
            recency_score = calculate_recency_score(paper.year)
            keyword_score = self._calculate_keyword_match(paper, keywords_lower)
            source_weight = SOURCE_WEIGHTS.get(paper.source, 0.8)

            # Combined score with weights
            final_score = (
                0.30 * source_relevance
                + 0.25 * citation_score
                + 0.20 * recency_score
                + 0.20 * keyword_score
                + 0.05 * source_weight
            )

            paper.relevance_score = round(final_score, 4)

        return papers

    def _calculate_keyword_match(self, paper: AcademicPaper, keywords_lower: List[str]) -> float:
        """Calculate how well paper matches search keywords"""
        if not keywords_lower:
            return 0.5

        text = " ".join([paper.title.lower(), (paper.abstract or "").lower(), " ".join(paper.keywords).lower()])

        matches = sum(1 for kw in keywords_lower if kw in text)
        return matches / len(keywords_lower)


# Singleton instance
academic_aggregator = AcademicAggregator()
