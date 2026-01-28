"""
Bibliography Export Service
Exports academic papers to various citation formats:
- BibTeX (.bib)
- RIS (.ris)
- APA 7th edition
- MLA 9th edition
- Chicago
- Harvard
"""

import re
from typing import List
from datetime import datetime

from .schemas import AcademicPaper, BibliographyFormat, Author


def _sanitize_bibtex(text: str) -> str:
    """Escape special characters for BibTeX"""
    if not text:
        return ""
    # Escape special LaTeX characters
    replacements = {
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    for char, escaped in replacements.items():
        text = text.replace(char, escaped)
    return text


def _generate_bibtex_key(paper: AcademicPaper) -> str:
    """Generate a unique BibTeX citation key"""
    # Use first author's last name + year
    key_parts = []

    if paper.authors:
        first_author = paper.authors[0].name
        # Extract last name
        last_name = first_author.split()[-1] if first_author else "unknown"
        # Remove non-alphanumeric
        last_name = re.sub(r"[^a-zA-Z]", "", last_name)
        key_parts.append(last_name.lower())
    else:
        key_parts.append("anon")

    if paper.year:
        key_parts.append(str(paper.year))
    else:
        key_parts.append("nd")

    # Add first word of title for uniqueness
    if paper.title:
        first_word = re.sub(r"[^a-zA-Z]", "", paper.title.split()[0])
        key_parts.append(first_word.lower()[:5])

    return "_".join(key_parts)


def _format_authors_bibtex(authors: List[Author]) -> str:
    """Format authors for BibTeX (Last, First and Last, First)"""
    if not authors:
        return "Unknown"

    formatted = []
    for author in authors:
        parts = author.name.split()
        if len(parts) >= 2:
            # Last, First Middle
            formatted.append(f"{parts[-1]}, {' '.join(parts[:-1])}")
        else:
            formatted.append(author.name)

    return " and ".join(formatted)


def _format_authors_ris(authors: List[Author]) -> List[str]:
    """Format authors for RIS (each author on AU line)"""
    if not authors:
        return ["AU  - Unknown"]

    return [f"AU  - {author.name}" for author in authors]


def _format_authors_apa(authors: List[Author]) -> str:
    """Format authors for APA 7th edition"""
    if not authors:
        return "Unknown Author"

    formatted = []
    for i, author in enumerate(authors):
        parts = author.name.split()
        if len(parts) >= 2:
            # Last, F. M.
            initials = " ".join([p[0] + "." for p in parts[:-1]])
            formatted.append(f"{parts[-1]}, {initials}")
        else:
            formatted.append(author.name)

        # APA uses different separators
        if i == len(authors) - 2:
            # Before last author
            pass
        elif i < len(authors) - 1:
            # Not last author
            pass

    if len(formatted) == 1:
        return formatted[0]
    elif len(formatted) == 2:
        return f"{formatted[0]}, & {formatted[1]}"
    elif len(formatted) <= 20:
        return ", ".join(formatted[:-1]) + f", & {formatted[-1]}"
    else:
        # More than 20 authors: first 19, ..., last
        return ", ".join(formatted[:19]) + ", ... " + formatted[-1]


def _format_authors_mla(authors: List[Author]) -> str:
    """Format authors for MLA 9th edition"""
    if not authors:
        return "Unknown Author"

    if len(authors) == 1:
        parts = authors[0].name.split()
        if len(parts) >= 2:
            return f"{parts[-1]}, {' '.join(parts[:-1])}"
        return authors[0].name
    elif len(authors) == 2:
        first = authors[0].name.split()
        if len(first) >= 2:
            first_formatted = f"{first[-1]}, {' '.join(first[:-1])}"
        else:
            first_formatted = authors[0].name
        return f"{first_formatted}, and {authors[1].name}"
    else:
        first = authors[0].name.split()
        if len(first) >= 2:
            first_formatted = f"{first[-1]}, {' '.join(first[:-1])}"
        else:
            first_formatted = authors[0].name
        return f"{first_formatted}, et al."


def _format_authors_chicago(authors: List[Author]) -> str:
    """Format authors for Chicago style"""
    if not authors:
        return "Unknown Author"

    formatted = []
    for i, author in enumerate(authors):
        parts = author.name.split()
        if i == 0 and len(parts) >= 2:
            # First author: Last, First
            formatted.append(f"{parts[-1]}, {' '.join(parts[:-1])}")
        else:
            # Subsequent authors: First Last
            formatted.append(author.name)

    if len(formatted) <= 3:
        if len(formatted) == 1:
            return formatted[0]
        return ", ".join(formatted[:-1]) + ", and " + formatted[-1]
    else:
        return formatted[0] + ", et al."


def _format_authors_harvard(authors: List[Author]) -> str:
    """Format authors for Harvard style"""
    if not authors:
        return "Unknown Author"

    formatted = []
    for author in authors:
        parts = author.name.split()
        if len(parts) >= 2:
            # Last, F.M.
            initials = "".join([p[0] + "." for p in parts[:-1]])
            formatted.append(f"{parts[-1]}, {initials}")
        else:
            formatted.append(author.name)

    if len(formatted) <= 3:
        if len(formatted) == 1:
            return formatted[0]
        return ", ".join(formatted[:-1]) + " and " + formatted[-1]
    else:
        return formatted[0] + " et al."


class BibliographyExporter:
    """Exports papers to various bibliography formats"""

    def export(
        self,
        papers: List[AcademicPaper],
        format: BibliographyFormat
    ) -> str:
        """
        Export papers to specified format

        Args:
            papers: List of papers to export
            format: Target bibliography format

        Returns:
            Formatted bibliography string
        """
        exporters = {
            BibliographyFormat.BIBTEX: self._to_bibtex,
            BibliographyFormat.RIS: self._to_ris,
            BibliographyFormat.APA: self._to_apa,
            BibliographyFormat.MLA: self._to_mla,
            BibliographyFormat.CHICAGO: self._to_chicago,
            BibliographyFormat.HARVARD: self._to_harvard,
        }

        exporter = exporters.get(format, self._to_bibtex)
        return exporter(papers)

    def _to_bibtex(self, papers: List[AcademicPaper]) -> str:
        """Export to BibTeX format"""
        entries = []

        for paper in papers:
            key = _generate_bibtex_key(paper)
            authors = _format_authors_bibtex(paper.authors)

            entry_type = "article"
            if paper.source == "arxiv":
                entry_type = "misc"

            lines = [f"@{entry_type}{{{key},"]
            lines.append(f"  author = {{{_sanitize_bibtex(authors)}}},")
            lines.append(f"  title = {{{_sanitize_bibtex(paper.title)}}},")

            if paper.year:
                lines.append(f"  year = {{{paper.year}}},")

            if paper.venue:
                if entry_type == "article":
                    lines.append(f"  journal = {{{_sanitize_bibtex(paper.venue)}}},")
                else:
                    lines.append(f"  howpublished = {{{_sanitize_bibtex(paper.venue)}}},")

            if paper.doi:
                lines.append(f"  doi = {{{paper.doi}}},")

            if paper.url:
                lines.append(f"  url = {{{paper.url}}},")

            if paper.abstract:
                # Truncate long abstracts
                abstract = paper.abstract[:500] + "..." if len(paper.abstract) > 500 else paper.abstract
                lines.append(f"  abstract = {{{_sanitize_bibtex(abstract)}}},")

            lines.append("}")
            entries.append("\n".join(lines))

        return "\n\n".join(entries)

    def _to_ris(self, papers: List[AcademicPaper]) -> str:
        """Export to RIS format"""
        entries = []

        for paper in papers:
            lines = []

            # Type
            if paper.source == "arxiv":
                lines.append("TY  - UNPB")  # Unpublished work
            else:
                lines.append("TY  - JOUR")  # Journal article

            # Authors
            lines.extend(_format_authors_ris(paper.authors))

            # Title
            lines.append(f"TI  - {paper.title}")

            # Year
            if paper.year:
                lines.append(f"PY  - {paper.year}")

            # Journal/Venue
            if paper.venue:
                lines.append(f"JO  - {paper.venue}")

            # DOI
            if paper.doi:
                lines.append(f"DO  - {paper.doi}")

            # URL
            if paper.url:
                lines.append(f"UR  - {paper.url}")

            # Abstract
            if paper.abstract:
                lines.append(f"AB  - {paper.abstract}")

            # Keywords
            for kw in paper.keywords:
                lines.append(f"KW  - {kw}")

            # End of record
            lines.append("ER  - ")

            entries.append("\n".join(lines))

        return "\n\n".join(entries)

    def _to_apa(self, papers: List[AcademicPaper]) -> str:
        """Export to APA 7th edition format"""
        citations = []

        for paper in papers:
            parts = []

            # Authors
            authors = _format_authors_apa(paper.authors)
            parts.append(authors)

            # Year
            year = f"({paper.year})" if paper.year else "(n.d.)"
            parts.append(year + ".")

            # Title
            title = paper.title
            if not title.endswith("."):
                title += "."
            parts.append(title)

            # Venue/Journal (italicized - represented with asterisks for plain text)
            if paper.venue:
                parts.append(f"*{paper.venue}*.")

            # DOI or URL
            if paper.doi:
                parts.append(f"https://doi.org/{paper.doi}")
            elif paper.url:
                parts.append(paper.url)

            citations.append(" ".join(parts))

        return "\n\n".join(citations)

    def _to_mla(self, papers: List[AcademicPaper]) -> str:
        """Export to MLA 9th edition format"""
        citations = []

        for paper in papers:
            parts = []

            # Authors
            authors = _format_authors_mla(paper.authors)
            parts.append(authors + ".")

            # Title in quotes
            title = f'"{paper.title}."'
            parts.append(title)

            # Container/Journal (italicized)
            if paper.venue:
                parts.append(f"*{paper.venue}*,")

            # Year
            if paper.year:
                parts.append(f"{paper.year}.")

            # DOI or URL
            if paper.doi:
                parts.append(f"doi:{paper.doi}.")
            elif paper.url:
                parts.append(f"{paper.url}.")

            citations.append(" ".join(parts))

        return "\n\n".join(citations)

    def _to_chicago(self, papers: List[AcademicPaper]) -> str:
        """Export to Chicago style format"""
        citations = []

        for paper in papers:
            parts = []

            # Authors
            authors = _format_authors_chicago(paper.authors)
            parts.append(authors + ".")

            # Title in quotes
            title = f'"{paper.title}."'
            parts.append(title)

            # Journal (italicized)
            if paper.venue:
                parts.append(f"*{paper.venue}*")

            # Year
            if paper.year:
                parts.append(f"({paper.year}).")

            # DOI or URL
            if paper.doi:
                parts.append(f"https://doi.org/{paper.doi}.")
            elif paper.url:
                parts.append(f"{paper.url}.")

            citations.append(" ".join(parts))

        return "\n\n".join(citations)

    def _to_harvard(self, papers: List[AcademicPaper]) -> str:
        """Export to Harvard style format"""
        citations = []

        for paper in papers:
            parts = []

            # Authors
            authors = _format_authors_harvard(paper.authors)
            parts.append(authors)

            # Year in parentheses
            year = f"({paper.year})" if paper.year else "(n.d.)"
            parts.append(year)

            # Title
            title = f"'{paper.title}',"
            parts.append(title)

            # Journal (italicized)
            if paper.venue:
                parts.append(f"*{paper.venue}*.")

            # Available at URL
            if paper.doi:
                parts.append(f"Available at: https://doi.org/{paper.doi}")
            elif paper.url:
                parts.append(f"Available at: {paper.url}")

            # Accessed date
            today = datetime.now().strftime("%d %B %Y")
            parts.append(f"(Accessed: {today}).")

            citations.append(" ".join(parts))

        return "\n\n".join(citations)

    def get_filename(self, format: BibliographyFormat) -> str:
        """Get appropriate filename for export format"""
        extensions = {
            BibliographyFormat.BIBTEX: "bibliography.bib",
            BibliographyFormat.RIS: "bibliography.ris",
            BibliographyFormat.APA: "bibliography_apa.txt",
            BibliographyFormat.MLA: "bibliography_mla.txt",
            BibliographyFormat.CHICAGO: "bibliography_chicago.txt",
            BibliographyFormat.HARVARD: "bibliography_harvard.txt",
        }
        return extensions.get(format, "bibliography.txt")


# Singleton instance
bibliography_exporter = BibliographyExporter()
