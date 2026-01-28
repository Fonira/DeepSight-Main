"""
Academic Sources Module for DeepSight
Provides scholarly paper search and bibliography export from:
- Semantic Scholar
- OpenAlex
- arXiv
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
