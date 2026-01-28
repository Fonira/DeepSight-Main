"""
Academic Sources Aggregator
Combines results from Semantic Scholar, OpenAlex, and arXiv with:
- Parallel querying
- Deduplication by DOI and title similarity
- Relevance scoring
- Tier-based result limiting
"""

import asyncio
from typing import List, Optional, Dict, Set
from difflib import SequenceMatcher
from datetime import datetime
import math

from .schemas import AcademicPaper, AcademicSearchRequest, AcademicSearchResponse
from .semantic_scholar import semantic_scholar_client
from .openalex import openalex_client
from .arxiv_client import arxiv_client

# Source weights for scoring
SOURCE_WEIGHTS = {
    "semantic_scholar": 1.0,
    "openalex": 0.9,
    "arxiv": 0.85
}

# Tier limits for academic papers
TIER_LIMITS = {
    "free": 3,
    "starter": 10,
    "student": 10,
    "pro": 30,
    "expert": 50,
    "team": 50,
    "unlimited": 100
}


def get_tier_limit(plan: str) -> int:
    """Get the paper limit for a user's plan"""
    return TIER_LIMITS.get(plan, TIER_LIMITS["free"])


def normalize_title(title: str) -> str:
    """Normalize title for comparison"""
    # Remove common prefixes and normalize whitespace
    title = title.lower().strip()
    # Remove punctuation and extra whitespace
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
        return 0.5  # Neutral score for unknown years

    current_year = datetime.now().year
    age = current_year - year

    # Exponential decay: recent papers score higher
    # Papers from current year: 1.0
    # Papers 5 years old: ~0.6
    # Papers 10 years old: ~0.35
    decay_rate = 0.1
    return math.exp(-decay_rate * age)


def calculate_citation_score(citation_count: int) -> float:
    """Calculate normalized citation score using logarithmic scale"""
    if citation_count <= 0:
        return 0.0

    # Log scale: 1 citation = 0, 10 = 0.33, 100 = 0.67, 1000 = 1.0
    return min(math.log10(citation_count + 1) / 3, 1.0)


class AcademicAggregator:
    """Aggregates and scores academic papers from multiple sources"""

    def __init__(self):
        self.semantic_scholar = semantic_scholar_client
        self.openalex = openalex_client
        self.arxiv = arxiv_client

    async def search(
        self,
        request: AcademicSearchRequest,
        user_plan: str = "free"
    ) -> AcademicSearchResponse:
        """
        Search all academic sources and return aggregated, deduplicated results

        Args:
            request: Search request with keywords and filters
            user_plan: User's subscription plan for tier limiting

        Returns:
            AcademicSearchResponse with deduplicated and scored papers
        """
        # Build query from keywords
        query = " ".join(request.keywords)

        # Query all sources in parallel with overall timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(
                    self._search_semantic_scholar(query, request),
                    self._search_openalex(query, request),
                    self._search_arxiv(query, request),
                    return_exceptions=True
                ),
                timeout=90.0  # 90 seconds overall timeout
            )
        except asyncio.TimeoutError:
            print("Academic search timeout - returning partial results", flush=True)
            results = [[], [], []]  # Empty results if timeout

        # Collect papers from successful queries
        all_papers: List[AcademicPaper] = []
        sources_queried = []

        for i, result in enumerate(results):
            source_name = ["semantic_scholar", "openalex", "arxiv"][i]
            if isinstance(result, Exception):
                print(f"Error querying {source_name}: {result}", flush=True)
                continue
            sources_queried.append(source_name)
            all_papers.extend(result)

        # Deduplicate papers
        deduplicated = self._deduplicate(all_papers)

        # Score and sort papers
        scored = self._score_papers(deduplicated, request.keywords)

        # Sort by final score
        scored.sort(key=lambda p: p.relevance_score, reverse=True)

        # Apply tier limit
        tier_limit = get_tier_limit(user_plan)
        tier_limit_reached = len(scored) > tier_limit
        limited_papers = scored[:tier_limit]

        return AcademicSearchResponse(
            papers=limited_papers,
            total_found=len(scored),
            query_keywords=request.keywords,
            sources_queried=sources_queried,
            cached=False,
            tier_limit_reached=tier_limit_reached,
            tier_limit=tier_limit if tier_limit_reached else None
        )

    async def _search_semantic_scholar(
        self,
        query: str,
        request: AcademicSearchRequest
    ) -> List[AcademicPaper]:
        """Search Semantic Scholar"""
        try:
            return await self.semantic_scholar.search(
                query=query,
                limit=min(request.limit * 2, 50),  # Get more for deduplication
                year_from=request.year_from,
                year_to=request.year_to,
                fields_of_study=request.fields_of_study
            )
        except Exception as e:
            print(f"Semantic Scholar search error: {e}", flush=True)
            return []

    async def _search_openalex(
        self,
        query: str,
        request: AcademicSearchRequest
    ) -> List[AcademicPaper]:
        """Search OpenAlex"""
        try:
            return await self.openalex.search(
                query=query,
                limit=min(request.limit * 2, 50),
                year_from=request.year_from,
                year_to=request.year_to
            )
        except Exception as e:
            print(f"OpenAlex search error: {e}", flush=True)
            return []

    async def _search_arxiv(
        self,
        query: str,
        request: AcademicSearchRequest
    ) -> List[AcademicPaper]:
        """Search arXiv (if preprints included)"""
        if not request.include_preprints:
            return []

        try:
            return await self.arxiv.search(
                query=query,
                limit=min(request.limit * 2, 30)  # arXiv has slower rate limit
            )
        except Exception as e:
            print(f"arXiv search error: {e}", flush=True)
            return []

    def _deduplicate(self, papers: List[AcademicPaper]) -> List[AcademicPaper]:
        """
        Deduplicate papers by DOI and title similarity
        Keeps the version with the most information
        """
        seen_dois: Set[str] = set()
        unique_papers: List[AcademicPaper] = []
        title_groups: Dict[str, List[AcademicPaper]] = {}

        for paper in papers:
            # Check DOI first (exact match)
            if paper.doi:
                doi_normalized = paper.doi.lower().strip()
                if doi_normalized in seen_dois:
                    continue
                seen_dois.add(doi_normalized)

            # Group by normalized title for similarity check
            norm_title = normalize_title(paper.title)
            title_groups.setdefault(norm_title, []).append(paper)

        # Process title groups
        for papers_group in title_groups.values():
            if len(papers_group) == 1:
                unique_papers.append(papers_group[0])
            else:
                # Find similar titles within group
                processed: Set[int] = set()
                for i, p1 in enumerate(papers_group):
                    if i in processed:
                        continue

                    similar = [p1]
                    for j, p2 in enumerate(papers_group[i + 1:], start=i + 1):
                        if j not in processed:
                            if title_similarity(p1.title, p2.title) > 0.85:
                                similar.append(p2)
                                processed.add(j)

                    # Keep the best version (most citations, has abstract, etc.)
                    best = max(similar, key=lambda p: (
                        p.citation_count,
                        len(p.abstract or ""),
                        1 if p.pdf_url else 0,
                        SOURCE_WEIGHTS.get(p.source, 0.5)
                    ))
                    unique_papers.append(best)

        return unique_papers

    def _score_papers(
        self,
        papers: List[AcademicPaper],
        keywords: List[str]
    ) -> List[AcademicPaper]:
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
            # Source relevance (from API)
            source_relevance = paper.relevance_score

            # Citation score (log scale)
            citation_score = calculate_citation_score(paper.citation_count)

            # Recency score
            recency_score = calculate_recency_score(paper.year)

            # Keyword match score
            keyword_score = self._calculate_keyword_match(paper, keywords_lower)

            # Source weight
            source_weight = SOURCE_WEIGHTS.get(paper.source, 0.8)

            # Combined score with weights
            final_score = (
                0.30 * source_relevance +
                0.25 * citation_score +
                0.20 * recency_score +
                0.20 * keyword_score +
                0.05 * source_weight
            )

            paper.relevance_score = round(final_score, 4)

        return papers

    def _calculate_keyword_match(
        self,
        paper: AcademicPaper,
        keywords_lower: List[str]
    ) -> float:
        """Calculate how well paper matches search keywords"""
        if not keywords_lower:
            return 0.5

        # Combine searchable text
        text = " ".join([
            paper.title.lower(),
            (paper.abstract or "").lower(),
            " ".join(paper.keywords).lower()
        ])

        # Count keyword matches
        matches = sum(1 for kw in keywords_lower if kw in text)

        # Normalize by number of keywords
        return matches / len(keywords_lower)


# Singleton instance
academic_aggregator = AcademicAggregator()
