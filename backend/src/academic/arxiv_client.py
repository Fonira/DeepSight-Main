"""
arXiv API Client
https://info.arxiv.org/help/api/

Free API for preprints in Physics, Mathematics, Computer Science, etc.
Uses Atom feed format. Rate limit: 1 request per 3 seconds
"""

import asyncio
import re
import xml.etree.ElementTree as ET
from typing import List, Optional
from datetime import datetime
import httpx

from .schemas import AcademicPaper, Author, AcademicSource

# API Configuration
ARXIV_API_URL = "http://export.arxiv.org/api/query"

# arXiv categories mapping
ARXIV_CATEGORIES = {
    "cs": "Computer Science",
    "math": "Mathematics",
    "physics": "Physics",
    "stat": "Statistics",
    "eess": "Electrical Engineering",
    "econ": "Economics",
    "q-bio": "Quantitative Biology",
    "q-fin": "Quantitative Finance",
}

# Rate limiting: 1 request per 3 seconds
_last_request_time: float = 0


async def _rate_limit():
    """Ensure minimum 3 second delay between requests"""
    global _last_request_time
    current_time = asyncio.get_event_loop().time()
    elapsed = current_time - _last_request_time
    if elapsed < 3.0:
        await asyncio.sleep(3.0 - elapsed)
    _last_request_time = asyncio.get_event_loop().time()


class ArxivClient:
    """Client for arXiv API"""

    def __init__(self):
        self.base_url = ARXIV_API_URL
        self.ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "arxiv": "http://arxiv.org/schemas/atom"
        }

    def _extract_arxiv_id(self, id_url: str) -> str:
        """Extract arXiv ID from URL"""
        # Format: http://arxiv.org/abs/2301.00001v1
        match = re.search(r"arxiv\.org/abs/(.+?)(?:v\d+)?$", id_url)
        if match:
            return match.group(1)
        return id_url.split("/")[-1]

    def _parse_entry(self, entry: ET.Element, relevance_score: float = 0.0) -> AcademicPaper:
        """Parse arXiv Atom entry to AcademicPaper model"""
        ns = self.ns

        # Extract ID
        id_elem = entry.find("atom:id", ns)
        arxiv_id = self._extract_arxiv_id(id_elem.text if id_elem is not None else "")

        # Extract title (clean up whitespace)
        title_elem = entry.find("atom:title", ns)
        title = title_elem.text.strip().replace("\n", " ") if title_elem is not None else "Untitled"
        title = re.sub(r"\s+", " ", title)

        # Extract authors
        authors = []
        for author_elem in entry.findall("atom:author", ns):
            name_elem = author_elem.find("atom:name", ns)
            affil_elem = author_elem.find("arxiv:affiliation", ns)
            if name_elem is not None:
                authors.append(Author(
                    name=name_elem.text.strip() if name_elem.text else "Unknown",
                    affiliation=affil_elem.text.strip() if affil_elem is not None and affil_elem.text else None
                ))

        # Extract abstract (clean up whitespace)
        summary_elem = entry.find("atom:summary", ns)
        abstract = summary_elem.text.strip().replace("\n", " ") if summary_elem is not None else None
        if abstract:
            abstract = re.sub(r"\s+", " ", abstract)

        # Extract publication date and year
        published_elem = entry.find("atom:published", ns)
        year = None
        if published_elem is not None and published_elem.text:
            try:
                year = int(published_elem.text[:4])
            except (ValueError, IndexError):
                pass

        # Extract categories as keywords
        keywords = []
        for category_elem in entry.findall("atom:category", ns):
            term = category_elem.get("term", "")
            if term:
                # Convert category code to readable name
                main_cat = term.split(".")[0]
                readable = ARXIV_CATEGORIES.get(main_cat, term)
                if readable not in keywords:
                    keywords.append(readable)

        # Extract DOI if available
        doi = None
        doi_elem = entry.find("arxiv:doi", ns)
        if doi_elem is not None and doi_elem.text:
            doi = doi_elem.text.strip()

        # Build URLs
        abs_url = f"https://arxiv.org/abs/{arxiv_id}"
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

        # arXiv doesn't provide citation counts
        # We could later integrate with Semantic Scholar to get citations

        return AcademicPaper(
            id=f"arxiv_{arxiv_id}",
            doi=doi,
            title=title,
            authors=authors,
            year=year,
            venue="arXiv",
            abstract=abstract,
            citation_count=0,  # arXiv doesn't provide this
            url=abs_url,
            pdf_url=pdf_url,
            source=AcademicSource.ARXIV,
            relevance_score=relevance_score,
            is_open_access=True,  # All arXiv papers are open access
            keywords=keywords[:5]  # Limit to 5
        )

    async def search(
        self,
        query: str,
        limit: int = 10,
        categories: Optional[List[str]] = None,
        sort_by: str = "relevance"
    ) -> List[AcademicPaper]:
        """
        Search for papers on arXiv

        Args:
            query: Search query string
            limit: Maximum number of results (max 100)
            categories: Filter by arXiv categories (e.g., ["cs.AI", "cs.LG"])
            sort_by: Sort order - "relevance", "lastUpdatedDate", "submittedDate"

        Returns:
            List of AcademicPaper objects
        """
        await _rate_limit()

        # Build search query
        search_query = f"all:{query}"

        # Add category filter if specified
        if categories:
            cat_filter = " OR ".join([f"cat:{cat}" for cat in categories])
            search_query = f"({search_query}) AND ({cat_filter})"

        # Map sort options
        sort_mapping = {
            "relevance": "relevance",
            "lastUpdatedDate": "lastUpdatedDate",
            "submittedDate": "submittedDate"
        }
        sort_order = sort_mapping.get(sort_by, "relevance")

        params = {
            "search_query": search_query,
            "start": 0,
            "max_results": min(limit, 100),
            "sortBy": sort_order,
            "sortOrder": "descending"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    self.base_url,
                    params=params
                )

                response.raise_for_status()

                # Parse XML response
                root = ET.fromstring(response.content)

                papers = []
                entries = root.findall("atom:entry", self.ns)

                for i, entry in enumerate(entries):
                    # Calculate relevance score based on position
                    relevance = 1 - (i / max(len(entries), 1))
                    paper = self._parse_entry(entry, relevance)
                    if paper.title and paper.title != "Untitled":
                        papers.append(paper)

                return papers

        except ET.ParseError as e:
            print(f"arXiv XML parse error: {str(e)}", flush=True)
            return []
        except httpx.HTTPStatusError as e:
            print(f"arXiv API error: {e.response.status_code}", flush=True)
            return []
        except Exception as e:
            print(f"arXiv error: {str(e)}", flush=True)
            return []

    async def get_paper_by_id(self, arxiv_id: str) -> Optional[AcademicPaper]:
        """Get a specific paper by arXiv ID"""
        await _rate_limit()

        # Remove our prefix if present
        if arxiv_id.startswith("arxiv_"):
            arxiv_id = arxiv_id[6:]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    self.base_url,
                    params={"id_list": arxiv_id}
                )

                response.raise_for_status()

                root = ET.fromstring(response.content)
                entries = root.findall("atom:entry", self.ns)

                if entries:
                    return self._parse_entry(entries[0], 1.0)
                return None

        except Exception as e:
            print(f"arXiv ID lookup error: {str(e)}", flush=True)
            return None


# Singleton instance
arxiv_client = ArxivClient()
