"""
Academic Sources Module for DeepSight
Provides scholarly paper search and bibliography export from:
- OpenAlex (free, 200M+ works)
- CrossRef (free, 130M+ works)
- Semantic Scholar (API key recommended)
- arXiv (preprints, STEM)
"""

from .schemas import (
    AcademicPaper,
    AcademicSearchRequest,
    AcademicSearchResponse,
    BibliographyExportRequest,
    BibliographyFormat,
)
from .aggregator import AcademicAggregator
from .bibliography import BibliographyExporter

__all__ = [
    "AcademicPaper",
    "AcademicSearchRequest",
    "AcademicSearchResponse",
    "BibliographyExportRequest",
    "BibliographyFormat",
    "AcademicAggregator",
    "BibliographyExporter",
]
