"""
CrossRef API Client
https://api.crossref.org/

Largest DOI registration agency — 130M+ scholarly works.
Free API, no key required. Polite pool with email in User-Agent.
Excellent multilingual support and broad coverage (medicine, biology, social sciences, etc.)
"""

import asyncio
from typing import List, Optional
import httpx

from .schemas import AcademicPaper, Author, AcademicSource

# API Configuration
CROSSREF_API_URL = "https://api.crossref.org"
CROSSREF_EMAIL = "contact@deepsight.fr"

# Rate limiting
_last_request_time: float = 0


async def _rate_limit():
    """Ensure minimum delay between requests"""
    global _last_request_time
    current_time = asyncio.get_event_loop().time()
    elapsed = current_time - _last_request_time
    min_delay = 0.2  # Conservative delay
    if elapsed < min_delay:
        await asyncio.sleep(min_delay - elapsed)
    _last_request_time = asyncio.get_event_loop().time()


class CrossRefClient:
    """Client for CrossRef API — the world's largest scholarly metadata database"""

    def __init__(self):
        self.base_url = CROSSREF_API_URL
        self.email = CROSSREF_EMAIL

    def _get_headers(self) -> dict:
        """Get request headers with polite pool email"""
        return {"Accept": "application/json", "User-Agent": f"DeepSight/1.0 (mailto:{self.email})"}

    def _parse_item(self, data: dict, relevance_score: float = 0.0) -> Optional[AcademicPaper]:
        """Parse CrossRef work item to AcademicPaper model"""
        # Extract title
        titles = data.get("title", [])
        title = titles[0] if titles else None
        if not title or title == "Untitled":
            return None

        # Parse authors
        authors = []
        for author_data in data.get("author", []):
            given = author_data.get("given", "")
            family = author_data.get("family", "")
            name = f"{given} {family}".strip()
            if not name:
                continue
            affiliation_list = author_data.get("affiliation", [])
            affiliation = affiliation_list[0].get("name") if affiliation_list else None
            authors.append(Author(name=name, affiliation=affiliation))

        # Extract DOI
        doi = data.get("DOI")

        # Extract year from published-print or published-online or created
        year = None
        for date_field in ["published-print", "published-online", "created"]:
            date_parts = data.get(date_field, {}).get("date-parts", [[]])
            if date_parts and date_parts[0] and len(date_parts[0]) >= 1:
                try:
                    year = int(date_parts[0][0])
                    break
                except (ValueError, TypeError):
                    continue

        # Extract venue/journal
        venue = None
        container = data.get("container-title", [])
        if container:
            venue = container[0]

        # Extract abstract (CrossRef sometimes includes it)
        abstract = data.get("abstract")
        if abstract:
            # Clean HTML tags from abstract
            import re

            abstract = re.sub(r"<[^>]+>", "", abstract).strip()
            if len(abstract) > 2000:
                abstract = abstract[:2000] + "..."

        # Citation count
        citation_count = data.get("is-referenced-by-count", 0) or 0

        # URLs
        url = data.get("URL") or (f"https://doi.org/{doi}" if doi else None)

        # Check for open access links
        pdf_url = None
        links = data.get("link", [])
        for link in links:
            if link.get("content-type") == "application/pdf":
                pdf_url = link.get("URL")
                break

        # Is open access?
        is_oa = False
        license_list = data.get("license", [])
        for lic in license_list:
            if "creativecommons" in (lic.get("URL", "") or "").lower():
                is_oa = True
                break

        # Extract subjects as keywords
        keywords = data.get("subject", [])[:5]

        return AcademicPaper(
            id=f"cr_{doi.replace('/', '_')}" if doi else f"cr_{hash(title) % 10**8}",
            doi=doi,
            title=title,
            authors=authors[:10],  # Limit authors
            year=year,
            venue=venue,
            abstract=abstract,
            citation_count=citation_count,
            url=url,
            pdf_url=pdf_url,
            source=AcademicSource.CROSSREF,
            relevance_score=relevance_score,
            is_open_access=is_oa,
            keywords=keywords,
        )

    async def search(
        self,
        query: str,
        limit: int = 10,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        sort: str = "relevance",
    ) -> List[AcademicPaper]:
        """
        Search for works on CrossRef.

        CrossRef handles multilingual queries well — it searches across titles,
        abstracts, and full-text in multiple languages.

        Args:
            query: Search query string
            limit: Maximum number of results (max 100)
            year_from: Filter papers from this year
            year_to: Filter papers up to this year
            sort: Sort order — "relevance", "published", "cited"

        Returns:
            List of AcademicPaper objects
        """
        await _rate_limit()

        params = {
            "query": query,
            "rows": min(limit, 100),
            "sort": sort if sort != "cited" else "is-referenced-by-count",
            "order": "desc",
            "select": "DOI,title,author,published-print,published-online,created,"
            "container-title,abstract,is-referenced-by-count,URL,link,"
            "license,subject,type",
        }

        # Add date filter
        if year_from or year_to:
            filter_parts = []
            if year_from:
                filter_parts.append(f"from-pub-date:{year_from}")
            if year_to:
                filter_parts.append(f"until-pub-date:{year_to}")
            params["filter"] = ",".join(filter_parts)

        # Filter to scholarly content only
        params.setdefault("filter", "")
        if params["filter"]:
            params["filter"] += ",type:journal-article"
        else:
            params["filter"] = "type:journal-article"

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.get(f"{self.base_url}/works", params=params, headers=self._get_headers())

                if response.status_code == 429:
                    # Rate limited — wait and retry once
                    await asyncio.sleep(2)
                    response = await client.get(f"{self.base_url}/works", params=params, headers=self._get_headers())

                response.raise_for_status()
                data = response.json()

                items = data.get("message", {}).get("items", [])
                total = data.get("message", {}).get("total-results", 0)

                print(f"CrossRef returned {len(items)} items (total: {total})", flush=True)

                papers = []
                for i, item in enumerate(items):
                    # Calculate relevance score based on position and citations
                    position_score = 1 - (i / max(len(items), 1))
                    citation_score = min((item.get("is-referenced-by-count", 0) or 0) / 1000, 1)
                    relevance = 0.5 * position_score + 0.5 * citation_score

                    paper = self._parse_item(item, relevance)
                    if paper:
                        papers.append(paper)

                return papers

        except httpx.HTTPStatusError as e:
            print(f"CrossRef API error: {e.response.status_code}", flush=True)
            return []
        except Exception as e:
            print(f"CrossRef error: {str(e)}", flush=True)
            return []

    async def search_by_doi(self, doi: str) -> Optional[AcademicPaper]:
        """Get a specific work by DOI"""
        await _rate_limit()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(f"{self.base_url}/works/{doi}", headers=self._get_headers())

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                data = response.json()
                item = data.get("message", {})
                return self._parse_item(item, 1.0)

        except Exception as e:
            print(f"CrossRef DOI lookup error: {str(e)}", flush=True)
            return None


# Singleton instance
crossref_client = CrossRefClient()
