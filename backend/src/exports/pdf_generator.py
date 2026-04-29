"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📄 PDF GENERATOR — Professional PDF Export with WeasyPrint                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Beautiful HTML→PDF conversion with:                                               ║
║  • DeepSight branded design                                                        ║
║  • Table of contents                                                               ║
║  • Multiple export modes (full, summary-only, with flashcards)                     ║
║  • Professional typography & layout                                                ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import re
import json
from io import BytesIO
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any
from enum import Enum

# Try WeasyPrint first (beautiful HTML-based PDFs)
# Catches both ImportError (not installed) and OSError (missing system libs like pango/cairo on Railway)
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration

    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    WEASYPRINT_AVAILABLE = False
    HTML = None
    CSS = None
    FontConfiguration = None
    print(f"⚠️ WeasyPrint unavailable ({type(e).__name__}: {e}). PDF exports will use fallback.", flush=True)

# Jinja2 for HTML templates
try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape

    JINJA2_AVAILABLE = True
except ImportError:
    JINJA2_AVAILABLE = False

# Markdown processing
try:
    import markdown
    from markdown.extensions import fenced_code, tables, toc

    MARKDOWN_AVAILABLE = True
except ImportError:
    MARKDOWN_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 EXPORT TYPES
# ═══════════════════════════════════════════════════════════════════════════════


class PDFExportType(str, Enum):
    """Types d'export PDF disponibles"""

    FULL = "full"  # Tout: synthèse + concepts + timestamps + entités + sources
    SUMMARY_ONLY = "summary"  # Synthèse uniquement (compact)
    WITH_FLASHCARDS = "flashcards"  # Synthèse + Flashcards de révision
    STUDY_PACK = "study"  # Synthèse + Flashcards + Quiz (étude complète)


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 THEME CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DEEP_SIGHT_THEME = {
    "primary": "#2563EB",
    "primary_light": "#3B82F6",
    "secondary": "#6366F1",
    "accent": "#06B6D4",
    "text": "#1E293B",
    "text_light": "#64748B",
    "background": "#FFFFFF",
    "surface": "#F1F5F9",
    "border": "#E2E8F0",
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════


def format_duration(seconds: int) -> str:
    """Formate une durée en format lisible"""
    if not seconds:
        return "N/A"
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h{minutes:02d}m"
    return f"{minutes}m{secs:02d}s"


def markdown_to_html(text: str) -> str:
    """Convertit le markdown en HTML"""
    if not text:
        return ""

    if MARKDOWN_AVAILABLE:
        md = markdown.Markdown(extensions=["fenced_code", "tables", "nl2br"], output_format="html5")
        return md.convert(text)

    # Fallback: basic conversion
    html = text
    # Headers
    html = re.sub(r"^### (.+)$", r"<h3>\1</h3>", html, flags=re.MULTILINE)
    html = re.sub(r"^## (.+)$", r"<h2>\1</h2>", html, flags=re.MULTILINE)
    html = re.sub(r"^# (.+)$", r"<h1>\1</h1>", html, flags=re.MULTILINE)
    # Bold & Italic
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"\*(.+?)\*", r"<em>\1</em>", html)
    # Lists
    html = re.sub(r"^[-*] (.+)$", r"<li>\1</li>", html, flags=re.MULTILINE)
    # Paragraphs
    paragraphs = html.split("\n\n")
    html = "".join(f"<p>{p}</p>" if not p.startswith("<") else p for p in paragraphs if p.strip())
    return html


def extract_timestamps_from_summary(summary: str) -> List[Dict[str, str]]:
    """Extrait les timestamps du résumé (format [HH:MM:SS] ou [MM:SS])"""
    timestamps = []
    pattern = r"\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?)(?=\[|\n\n|$)"
    matches = re.findall(pattern, summary, re.DOTALL)

    for time, text in matches:
        timestamps.append(
            {
                "time": time,
                "text": text.strip()[:200],  # Limit text length
            }
        )

    return timestamps


def get_reliability_info(score: float) -> Dict[str, str]:
    """Retourne les infos de fiabilité (classe CSS et label)"""
    if score >= 70:
        return {"class": "high", "label": "Score de fiabilité élevé"}
    elif score >= 50:
        return {"class": "medium", "label": "Score de fiabilité modéré"}
    else:
        return {"class": "low", "label": "Fiabilité à vérifier"}


# ═══════════════════════════════════════════════════════════════════════════════
# 📄 MAIN PDF GENERATOR CLASS
# ═══════════════════════════════════════════════════════════════════════════════


class PDFGenerator:
    """
    Générateur de PDF professionnel pour Deep Sight.
    Utilise WeasyPrint pour un rendu HTML→PDF de qualité.
    """

    def __init__(self):
        self.template_dir = Path(__file__).parent / "templates"
        self.jinja_env = None

        if JINJA2_AVAILABLE:
            self.jinja_env = Environment(
                loader=FileSystemLoader(str(self.template_dir)), autoescape=select_autoescape(["html", "xml"])
            )

    def generate(
        self,
        title: str,
        channel: str,
        category: str,
        mode: str,
        summary: str,
        video_url: str = "",
        duration: int = 0,
        thumbnail_url: str = "",
        entities: Optional[Dict] = None,
        reliability_score: Optional[float] = None,
        created_at: Optional[datetime] = None,
        flashcards: Optional[List[Dict]] = None,
        quiz: Optional[List[Dict]] = None,
        sources: Optional[List[Dict]] = None,
        export_type: PDFExportType = PDFExportType.FULL,
        user_plan: Optional[str] = None,
        user_language: str = "fr",
    ) -> Optional[bytes]:
        """
        Génère un PDF professionnel.

        Args:
            title: Titre de la vidéo
            channel: Nom de la chaîne
            category: Catégorie de la vidéo
            mode: Mode d'analyse utilisé
            summary: Contenu de la synthèse (markdown)
            video_url: URL de la vidéo
            duration: Durée en secondes
            thumbnail_url: URL de la miniature
            entities: Entités extraites (concepts, persons, organizations)
            reliability_score: Score de fiabilité (0-100)
            created_at: Date de création
            flashcards: Liste des flashcards [{front, back}]
            quiz: Liste des questions quiz
            sources: Liste des sources [{title, url}]
            export_type: Type d'export (full, summary, flashcards, study)

        Returns:
            bytes: Contenu PDF ou None si échec
        """
        if not WEASYPRINT_AVAILABLE:
            print("❌ WeasyPrint not available for PDF generation", flush=True)
            return None

        if not self.jinja_env:
            print("❌ Jinja2 not available for template rendering", flush=True)
            return None

        try:
            # Préparer les données du template
            template_data = self._prepare_template_data(
                title=title,
                channel=channel,
                category=category,
                mode=mode,
                summary=summary,
                video_url=video_url,
                duration=duration,
                thumbnail_url=thumbnail_url,
                entities=entities,
                reliability_score=reliability_score,
                created_at=created_at,
                flashcards=flashcards,
                quiz=quiz,
                sources=sources,
                export_type=export_type,
                user_plan=user_plan,
                user_language=user_language,
            )

            # Charger et rendre le template
            template = self.jinja_env.get_template("pdf_template.html")
            html_content = template.render(**template_data)

            # Configuration des fonts
            font_config = FontConfiguration()

            # Générer le PDF
            html = HTML(string=html_content, base_url=str(self.template_dir))
            pdf_bytes = html.write_pdf(font_config=font_config)

            return pdf_bytes

        except Exception as e:
            print(f"❌ PDF generation error: {e}", flush=True)
            import traceback

            traceback.print_exc()
            return None

    def _prepare_template_data(
        self,
        title: str,
        channel: str,
        category: str,
        mode: str,
        summary: str,
        video_url: str,
        duration: int,
        thumbnail_url: str,
        entities: Optional[Dict],
        reliability_score: Optional[float],
        created_at: Optional[datetime],
        flashcards: Optional[List[Dict]],
        quiz: Optional[List[Dict]],
        sources: Optional[List[Dict]],
        export_type: PDFExportType,
        user_plan: Optional[str] = None,
        user_language: str = "fr",
    ) -> Dict[str, Any]:
        """Prépare toutes les données pour le template"""

        # Watermark gating (Free vs payant) — utilise add_watermark helper
        from .watermark import add_watermark

        watermark_marker = add_watermark(
            content="placeholder",
            format="pdf",
            user_plan=user_plan,
            user_language=user_language,
        )
        # add_watermark pour 'pdf' retourne toujours un dict marqueur
        show_watermark = watermark_marker["needs_watermark"]
        watermark_text = watermark_marker["text"]
        watermark_url = watermark_marker["url"]

        # Date formatting
        date_str = (created_at or datetime.now()).strftime("%d %B %Y à %H:%M")

        # Duration formatting
        duration_formatted = format_duration(duration)

        # Convert summary markdown to HTML
        summary_html = markdown_to_html(summary)

        # Extract timestamps from summary
        timestamps = extract_timestamps_from_summary(summary)

        # Reliability info
        reliability_class = ""
        reliability_label = ""
        if reliability_score is not None:
            rel_info = get_reliability_info(reliability_score)
            reliability_class = rel_info["class"]
            reliability_label = rel_info["label"]

        # Determine what to show based on export type
        show_toc = export_type in [PDFExportType.FULL, PDFExportType.STUDY_PACK]
        show_concepts = export_type in [PDFExportType.FULL, PDFExportType.STUDY_PACK]
        show_timestamps = export_type in [PDFExportType.FULL, PDFExportType.STUDY_PACK]
        show_flashcards = export_type in [PDFExportType.WITH_FLASHCARDS, PDFExportType.STUDY_PACK]
        show_quiz = export_type == PDFExportType.STUDY_PACK

        return {
            # Basic info
            "title": title,
            "channel": channel,
            "category": category or "Non classé",
            "mode": mode or "Standard",
            "date": date_str,
            "duration": duration,
            "duration_formatted": duration_formatted,
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            # Content
            "summary_html": summary_html,
            "timestamps": timestamps if show_timestamps else None,
            # Entities
            "entities": entities if show_concepts else None,
            # Reliability
            "reliability_score": reliability_score,
            "reliability_class": reliability_class,
            "reliability_label": reliability_label,
            # Study materials
            "flashcards": flashcards if show_flashcards else None,
            "quiz": quiz if show_quiz else None,
            # Sources
            "sources": sources,
            # Display flags
            "show_toc": show_toc,
            "show_concepts": show_concepts,
            "show_timestamps": show_timestamps,
            "show_flashcards": show_flashcards,
            "show_quiz": show_quiz,
            # Watermark gating (Free uniquement)
            "show_watermark": show_watermark,
            "watermark_text": watermark_text,
            "watermark_url": watermark_url,
            # Theme
            "theme": DEEP_SIGHT_THEME,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

# Singleton instance
_pdf_generator: Optional[PDFGenerator] = None


def get_pdf_generator() -> PDFGenerator:
    """Retourne l'instance singleton du générateur PDF"""
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = PDFGenerator()
    return _pdf_generator


def generate_pdf(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    export_type: str = "full",
    user_plan: Optional[str] = None,
    user_language: str = "fr",
    **kwargs,
) -> Optional[bytes]:
    """
    Fonction de convenance pour générer un PDF.

    Args:
        title, channel, category, mode, summary: Données de base
        export_type: "full" | "summary" | "flashcards" | "study"
        user_plan: plan id (free, plus, pro, expert, ...) — controle l'affichage du watermark
        user_language: "fr" | "en" — langue du watermark
        **kwargs: Données additionnelles (entities, flashcards, etc.)

    Returns:
        bytes: Contenu PDF
    """
    generator = get_pdf_generator()

    # Map string to enum
    type_map = {
        "full": PDFExportType.FULL,
        "summary": PDFExportType.SUMMARY_ONLY,
        "flashcards": PDFExportType.WITH_FLASHCARDS,
        "study": PDFExportType.STUDY_PACK,
    }
    pdf_type = type_map.get(export_type, PDFExportType.FULL)

    return generator.generate(
        title=title,
        channel=channel,
        category=category,
        mode=mode,
        summary=summary,
        export_type=pdf_type,
        user_plan=user_plan,
        user_language=user_language,
        **kwargs,
    )


def is_pdf_available() -> bool:
    """Vérifie si la génération PDF est disponible"""
    return WEASYPRINT_AVAILABLE and JINJA2_AVAILABLE


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 EXPORT TYPES INFO
# ═══════════════════════════════════════════════════════════════════════════════

PDF_EXPORT_OPTIONS = [
    {
        "type": "full",
        "name": "PDF Complet",
        "description": "Synthèse complète avec concepts, timestamps et entités",
        "icon": "📄",
    },
    {"type": "summary", "name": "Résumé uniquement", "description": "Synthèse condensée, format compact", "icon": "📝"},
    {"type": "flashcards", "name": "Avec Flashcards", "description": "Synthèse + cartes de révision", "icon": "📚"},
    {"type": "study", "name": "Pack Étude", "description": "Synthèse + Flashcards + Quiz (complet)", "icon": "🎓"},
]
