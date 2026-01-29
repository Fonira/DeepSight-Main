"""
Schemas for Academic Sources Module
"""

from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime


class AcademicSource(str, Enum):
    """Source of academic paper"""
    SEMANTIC_SCHOLAR = "semantic_scholar"
    OPENALEX = "openalex"
    ARXIV = "arxiv"


class BibliographyFormat(str, Enum):
    """Supported bibliography export formats"""
    BIBTEX = "bibtex"
    RIS = "ris"
    APA = "apa"
    MLA = "mla"
    CHICAGO = "chicago"
    HARVARD = "harvard"


class Author(BaseModel):
    """Author information"""
    name: str
    affiliation: Optional[str] = None
    author_id: Optional[str] = None


class AcademicPaper(BaseModel):
    """Academic paper data model"""
    id: str
    doi: Optional[str] = None
    title: str
    authors: List[Author] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    citation_count: int = 0
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    source: AcademicSource
    relevance_score: float = 0.0
    is_open_access: bool = False
    keywords: List[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


class AcademicSearchRequest(BaseModel):
    """Request model for academic search"""
    keywords: List[str] = Field(..., min_length=1, description="Keywords to search for")
    summary_id: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=100)
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    include_preprints: bool = True
    fields_of_study: Optional[List[str]] = None


class AcademicSearchResponse(BaseModel):
    """Response model for academic search"""
    papers: List[AcademicPaper]
    total_found: int
    query_keywords: List[str]
    sources_queried: List[str]
    cached: bool = False
    tier_limit_reached: bool = False
    tier_limit: Optional[int] = None


class AcademicEnrichRequest(BaseModel):
    """Request to enrich a summary with academic sources"""
    summary_id: str
    max_papers: Optional[int] = None


class BibliographyExportRequest(BaseModel):
    """Request model for bibliography export"""
    paper_ids: List[str] = Field(..., min_length=1)
    format: BibliographyFormat = BibliographyFormat.BIBTEX
    summary_id: Optional[str] = None


class BibliographyExportResponse(BaseModel):
    """Response model for bibliography export"""
    content: str
    format: BibliographyFormat
    paper_count: int
    filename: str


class CachedAcademicPaper(BaseModel):
    """Database model for cached academic papers"""
    id: Optional[int] = None
    external_id: str
    summary_id: int
    doi: Optional[str] = None
    title: str
    authors_json: str
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    citation_count: int = 0
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    source: str
    relevance_score: float = 0.0
    created_at: Optional[datetime] = None
