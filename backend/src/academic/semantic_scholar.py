"""
Semantic Scholar API Client
https://api.semanticscholar.org/

Rate limits:
- Without API key: 100 requests per 5 minutes
- With API key: 1 request per second (apply at https://www.semanticscholar.org/product/api)
"""

import asyncio
import os
from typing import List, Optional
import httpx
from datetime import datetime

from .schemas import AcademicPaper, Author, AcademicSource

# API Configuration
SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1"
SEMANTIC_SCHOLAR_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY", "")

# Rate limiting: max 100 requests per 5 minutes without key
_last_request_time: float = 0
_request_count: int = 0
_window_start: float = 0


async def _rate_limit():
    """Simple rate limiting for Semantic Scholar API"""
    global _last_request_time, _request_count, _window_start

    current_time = asyncio.get_event_loop().time()

    # Reset window every 5 minutes
    if current_time - _window_start > 300:
        _window_start = current_time
        _request_count = 0

    # Check rate limit
    if _request_count >= 95:  # Leave some margin
        wait_time = 300 - (current_time - _window_start)
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        _window_start = asyncio.get_event_loop().time()
        _request_count = 0

    # Minimum delay between requests (100ms)
    elapsed = current_time - _last_request_time
    if elapsed < 0.1:
        await asyncio.sleep(0.1 - elapsed)

    _last_request_time = asyncio.get_event_loop().time()
    _request_count += 1


class SemanticScholarClient:
    """Client for Semantic Scholar API"""

    def __init__(self):
        self.base_url = SEMANTIC_SCHOLAR_API_URL
        self.api_key = SEMANTIC_SCHOLAR_API_KEY
        self.fields = "paperId,title,authors,year,venue,abstract,citationCount,url,openAccessPdf,externalIds,fieldsOfStudy"

    def _get_headers(self) -> dict:
        """Get request headers with optional API key"""
        headers = {
            "Accept": "application/json",
            "User-Agent": "DeepSight/1.0 (academic-research)"
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    def _parse_paper(self, data: dict, relevance_score: float = 0.0) -> AcademicPaper:
        """Parse Semantic Scholar paper response to AcademicPaper model"""
        authors = []
        for author_data in data.get("authors", []):
            authors.append(Author(
                name=author_data.get("name", "Unknown"),
                author_id=author_data.get("authorId")
            ))

        # Extract DOI from external IDs
        external_ids = data.get("externalIds") or {}
        doi = external_ids.get("DOI")

        # Get PDF URL if available
        open_access_pdf = data.get("openAccessPdf") or {}
        pdf_url = open_access_pdf.get("url")

        # Extract keywords from fields of study
        fields_of_study = data.get("fieldsOfStudy") or []

        return AcademicPaper(
            id=f"ss_{data.get('paperId', '')}",
            doi=doi,
            title=data.get("title", "Untitled"),
            authors=authors,
            year=data.get("year"),
            venue=data.get("venue"),
            abstract=data.get("abstract"),
            citation_count=data.get("citationCount", 0) or 0,
            url=data.get("url") or f"https://www.semanticscholar.org/paper/{data.get('paperId', '')}",
            pdf_url=pdf_url,
            source=AcademicSource.SEMANTIC_SCHOLAR,
            relevance_score=relevance_score,
            is_open_access=pdf_url is not None,
            keywords=fields_of_study
        )

    async def search(
        self,
        query: str,
        limit: int = 10,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        fields_of_study: Optional[List[str]] = None
    ) -> List[AcademicPaper]:
        """
        Search for papers on Semantic Scholar

        Args:
            query: Search query string
            limit: Maximum number of results (max 100)
            year_from: Filter papers from this year
            year_to: Filter papers up to this year
            fields_of_study: Filter by fields (e.g., ["Computer Science", "Medicine"])

        Returns:
            List of AcademicPaper objects
        """
        await _rate_limit()

        params = {
            "query": query,
            "limit": min(limit, 100),
            "fields": self.fields
        }

        # Add year filter if specified
        if year_from or year_to:
            year_filter = ""
            if year_from and year_to:
                year_filter = f"{year_from}-{year_to}"
            elif year_from:
                year_filter = f"{year_from}-"
            elif year_to:
                year_filter = f"-{year_to}"
            params["year"] = year_filter

        # Add fields of study filter
        if fields_of_study:
            params["fieldsOfStudy"] = ",".join(fields_of_study)

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(
                    f"{self.base_url}/paper/search",
                    params=params,
                    headers=self._get_headers()
                )

                if response.status_code == 429:
                    # Rate limited, wait and retry once
                    await asyncio.sleep(60)
                    response = await client.get(
                        f"{self.base_url}/paper/search",
                        params=params,
                        headers=self._get_headers()
                    )

                response.raise_for_status()
                data = response.json()

                papers = []
                for i, paper_data in enumerate(data.get("data", [])):
                    # Calculate relevance score based on position and citations
                    position_score = 1 - (i / max(len(data.get("data", [])), 1))
                    citation_score = min(paper_data.get("citationCount", 0) / 1000, 1)
                    relevance = 0.6 * position_score + 0.4 * citation_score

                    papers.append(self._parse_paper(paper_data, relevance))

                return papers

        except httpx.HTTPStatusError as e:
            print(f"Semantic Scholar API error: {e.response.status_code}", flush=True)
            return []
        except Exception as e:
            print(f"Semantic Scholar error: {str(e)}", flush=True)
            return []

    async def get_paper_by_doi(self, doi: str) -> Optional[AcademicPaper]:
        """Get a specific paper by DOI"""
        await _rate_limit()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/paper/DOI:{doi}",
                    params={"fields": self.fields},
                    headers=self._get_headers()
                )

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                data = response.json()
                return self._parse_paper(data, 1.0)

        except Exception as e:
            print(f"Semantic Scholar DOI lookup error: {str(e)}", flush=True)
            return None

    async def get_recommendations(
        self,
        paper_id: str,
        limit: int = 10
    ) -> List[AcademicPaper]:
        """Get paper recommendations based on a seed paper"""
        await _rate_limit()

        # Remove our prefix if present
        if paper_id.startswith("ss_"):
            paper_id = paper_id[3:]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/recommendations/v1/papers/",
                    params={
                        "positivePaperIds": paper_id,
                        "limit": min(limit, 100),
                        "fields": self.fields
                    },
                    headers=self._get_headers()
                )

                response.raise_for_status()
                data = response.json()

                papers = []
                for i, paper_data in enumerate(data.get("recommendedPapers", [])):
                    relevance = 1 - (i / max(len(data.get("recommendedPapers", [])), 1))
                    papers.append(self._parse_paper(paper_data, relevance))

                return papers

        except Exception as e:
            print(f"Semantic Scholar recommendations error: {str(e)}", flush=True)
            return []


# Singleton instance
semantic_scholar_client = SemanticScholarClient()
