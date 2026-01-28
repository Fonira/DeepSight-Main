"""
OpenAlex API Client
https://docs.openalex.org/

Free API with polite pool (faster rate limits when you provide email)
No API key required, but email in User-Agent gives better rate limits
"""

import asyncio
from typing import List, Optional
import httpx
from urllib.parse import quote

from .schemas import AcademicPaper, Author, AcademicSource

# API Configuration
OPENALEX_API_URL = "https://api.openalex.org"
OPENALEX_EMAIL = "contact@deepsight.fr"  # For polite pool

# Rate limiting
_last_request_time: float = 0


async def _rate_limit():
    """Ensure minimum delay between requests"""
    global _last_request_time
    current_time = asyncio.get_event_loop().time()
    elapsed = current_time - _last_request_time
    # OpenAlex allows 10 req/sec with email, 1 req/sec without
    min_delay = 0.15  # Be conservative
    if elapsed < min_delay:
        await asyncio.sleep(min_delay - elapsed)
    _last_request_time = asyncio.get_event_loop().time()


class OpenAlexClient:
    """Client for OpenAlex API"""

    def __init__(self):
        self.base_url = OPENALEX_API_URL
        self.email = OPENALEX_EMAIL

    def _get_headers(self) -> dict:
        """Get request headers with polite pool email"""
        return {
            "Accept": "application/json",
            "User-Agent": f"DeepSight/1.0 (mailto:{self.email})"
        }

    def _parse_paper(self, data: dict, relevance_score: float = 0.0) -> AcademicPaper:
        """Parse OpenAlex work response to AcademicPaper model"""
        # Parse authors
        authors = []
        for authorship in data.get("authorships", []):
            author_data = authorship.get("author", {})
            institution = None
            institutions = authorship.get("institutions", [])
            if institutions:
                institution = institutions[0].get("display_name")
            authors.append(Author(
                name=author_data.get("display_name", "Unknown"),
                author_id=author_data.get("id"),
                affiliation=institution
            ))

        # Extract DOI
        doi = data.get("doi")
        if doi and doi.startswith("https://doi.org/"):
            doi = doi.replace("https://doi.org/", "")

        # Get best open access URL
        pdf_url = None
        open_access = data.get("open_access", {})
        if open_access.get("is_oa"):
            pdf_url = open_access.get("oa_url")

        # Fallback to best OA location
        if not pdf_url:
            locations = data.get("locations", [])
            for loc in locations:
                if loc.get("is_oa") and loc.get("pdf_url"):
                    pdf_url = loc.get("pdf_url")
                    break

        # Extract concepts as keywords
        keywords = []
        for concept in data.get("concepts", [])[:5]:  # Top 5 concepts
            if concept.get("display_name"):
                keywords.append(concept["display_name"])

        # Get venue from primary location
        venue = None
        primary_location = data.get("primary_location", {})
        if primary_location:
            source = primary_location.get("source", {})
            if source:
                venue = source.get("display_name")

        # Extract year from publication date
        year = data.get("publication_year")

        return AcademicPaper(
            id=f"oa_{data.get('id', '').split('/')[-1]}",
            doi=doi,
            title=data.get("title") or data.get("display_name", "Untitled"),
            authors=authors,
            year=year,
            venue=venue,
            abstract=self._reconstruct_abstract(data.get("abstract_inverted_index")),
            citation_count=data.get("cited_by_count", 0) or 0,
            url=data.get("id"),  # OpenAlex URL
            pdf_url=pdf_url,
            source=AcademicSource.OPENALEX,
            relevance_score=relevance_score,
            is_open_access=open_access.get("is_oa", False),
            keywords=keywords
        )

    def _reconstruct_abstract(self, inverted_index: Optional[dict]) -> Optional[str]:
        """Reconstruct abstract from OpenAlex inverted index format"""
        if not inverted_index:
            return None

        # OpenAlex stores abstract as inverted index: {"word": [positions]}
        words = {}
        for word, positions in inverted_index.items():
            for pos in positions:
                words[pos] = word

        if not words:
            return None

        # Reconstruct in order
        max_pos = max(words.keys())
        abstract_words = [words.get(i, "") for i in range(max_pos + 1)]
        return " ".join(abstract_words)

    async def search(
        self,
        query: str,
        limit: int = 10,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        open_access_only: bool = False
    ) -> List[AcademicPaper]:
        """
        Search for works on OpenAlex

        Args:
            query: Search query string
            limit: Maximum number of results (max 200)
            year_from: Filter papers from this year
            year_to: Filter papers up to this year
            open_access_only: Only return open access papers

        Returns:
            List of AcademicPaper objects
        """
        await _rate_limit()

        # Build filter string
        filters = []
        if year_from:
            filters.append(f"publication_year:>={year_from}")
        if year_to:
            filters.append(f"publication_year:<={year_to}")
        if open_access_only:
            filters.append("is_oa:true")

        params = {
            "search": query,
            "per_page": min(limit, 200),
            "sort": "relevance_score:desc"
        }

        if filters:
            params["filter"] = ",".join(filters)

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    f"{self.base_url}/works",
                    params=params,
                    headers=self._get_headers()
                )

                response.raise_for_status()
                data = response.json()

                papers = []
                results = data.get("results", [])
                for i, work_data in enumerate(results):
                    # Calculate relevance score
                    position_score = 1 - (i / max(len(results), 1))
                    citation_score = min(work_data.get("cited_by_count", 0) / 1000, 1)
                    relevance = 0.5 * position_score + 0.5 * citation_score

                    paper = self._parse_paper(work_data, relevance)
                    if paper.title and paper.title != "Untitled":
                        papers.append(paper)

                return papers

        except httpx.HTTPStatusError as e:
            print(f"OpenAlex API error: {e.response.status_code}", flush=True)
            return []
        except Exception as e:
            print(f"OpenAlex error: {str(e)}", flush=True)
            return []

    async def get_work_by_doi(self, doi: str) -> Optional[AcademicPaper]:
        """Get a specific work by DOI"""
        await _rate_limit()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/works/doi:{quote(doi, safe='')}",
                    headers=self._get_headers()
                )

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                data = response.json()
                return self._parse_paper(data, 1.0)

        except Exception as e:
            print(f"OpenAlex DOI lookup error: {str(e)}", flush=True)
            return None

    async def search_by_concepts(
        self,
        concepts: List[str],
        limit: int = 10
    ) -> List[AcademicPaper]:
        """Search for works related to specific concepts"""
        # OpenAlex concept search uses the filter parameter
        query = " ".join(concepts)
        return await self.search(query, limit)


# Singleton instance
openalex_client = OpenAlexClient()
