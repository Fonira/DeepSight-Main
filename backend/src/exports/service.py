"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📄 EXPORT SERVICE — Génération PDF, DOCX, TXT, Markdown                           ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  v2.0 — Professional PDF exports with branded design                               ║
║  • WeasyPrint for beautiful HTML→PDF rendering                                     ║
║  • Multiple export modes (full, summary, flashcards, study pack)                   ║
║  • Fallback to ReportLab if WeasyPrint unavailable                                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import io
import re
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 IMPORTS — PDF Generator (WeasyPrint)
# ═══════════════════════════════════════════════════════════════════════════════

from .pdf_generator import (
    generate_pdf as generate_pdf_weasyprint,
    is_pdf_available as weasyprint_available,
    PDF_EXPORT_OPTIONS,
    PDFExportType
)

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 IMPORTS — DOCX (python-docx)
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.style import WD_STYLE_TYPE
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 IMPORTS — PDF Fallback (ReportLab)
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib.units import cm
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 STYLES & CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Couleurs Deep Sight (thème océan/steampunk)
COLORS = {
    "primary": "#0D4F4F",      # Teal profond
    "secondary": "#D4A574",    # Cuivre/laiton
    "accent": "#00CED1",       # Cyan
    "text": "#1A1A2E",         # Texte sombre
    "light": "#F5F5F5",        # Fond clair
}

# Template de header pour les exports
HEADER_TEMPLATE = """
╔═══════════════════════════════════════════════════════════════════════════╗
║  🤿 DEEP SIGHT — Analyse Intelligente                                      ║
╚═══════════════════════════════════════════════════════════════════════════╝
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def format_duration(duration: int) -> str:
    """Formate une durée en secondes en string lisible"""
    if not duration:
        return "N/A"
    hours, remainder = divmod(duration, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{seconds:02d}s"
    return f"{minutes}m{seconds:02d}s"


def clean_filename(title: str, timestamp: str) -> str:
    """Génère un nom de fichier sûr"""
    safe_title = re.sub(r'[^\w\s-]', '', title)[:50].strip()
    safe_title = re.sub(r'[-\s]+', '_', safe_title)
    return f"deepsight_{safe_title}_{timestamp}"


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 EXPORT TXT
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_txt(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    created_at: datetime = None
) -> str:
    """Exporte l'analyse en format texte brut"""
    
    duration_str = format_duration(duration)
    date_str = created_at.strftime("%d/%m/%Y %H:%M") if created_at else datetime.now().strftime("%d/%m/%Y %H:%M")
    
    content = f"""{HEADER_TEMPLATE}
═══════════════════════════════════════════════════════════════════════════
📺 VIDÉO ANALYSÉE
═══════════════════════════════════════════════════════════════════════════

Titre    : {title}
Chaîne   : {channel}
Durée    : {duration_str}
Catégorie: {category}
Mode     : {mode}
URL      : {video_url}
Analysé  : {date_str}

═══════════════════════════════════════════════════════════════════════════
📋 SYNTHÈSE
═══════════════════════════════════════════════════════════════════════════

{summary}

═══════════════════════════════════════════════════════════════════════════
                    Généré par Deep Sight — deepsightsynthesis.com
═══════════════════════════════════════════════════════════════════════════
"""
    return content


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 EXPORT MARKDOWN
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_markdown(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    thumbnail_url: str = "",
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None,
    flashcards: List[Dict] = None
) -> str:
    """Exporte l'analyse en format Markdown"""
    
    duration_str = format_duration(duration) if duration else "N/A"
    date_str = created_at.strftime("%d/%m/%Y à %H:%M") if created_at else datetime.now().strftime("%d/%m/%Y à %H:%M")
    
    content = f"""# 🤿 Deep Sight — Analyse

---

## 📺 Vidéo analysée

| Propriété | Valeur |
|-----------|--------|
| **Titre** | {title} |
| **Chaîne** | {channel} |
| **Durée** | {duration_str} |
| **Catégorie** | {category} |
| **Mode d'analyse** | {mode} |
| **Date d'analyse** | {date_str} |

"""

    if video_url:
        content += f"🔗 [Voir la vidéo]({video_url})\n\n"
    
    if thumbnail_url:
        content += f"![Thumbnail]({thumbnail_url})\n\n"
    
    content += "---\n\n## 📋 Synthèse\n\n"
    content += summary + "\n\n"
    
    # Score de fiabilité
    if reliability_score is not None:
        emoji = "✅" if reliability_score >= 70 else "⚖️" if reliability_score >= 50 else "⚠️"
        content += f"---\n\n## 📊 Score de fiabilité\n\n{emoji} **{reliability_score}/100**\n\n"
    
    # Entités extraites
    if entities:
        content += "---\n\n## 🏷️ Entités extraites\n\n"
        
        if entities.get("concepts"):
            content += "### 💡 Concepts clés\n"
            for concept in entities["concepts"][:10]:
                content += f"- {concept}\n"
            content += "\n"
        
        if entities.get("persons"):
            content += "### 👤 Personnes mentionnées\n"
            for person in entities["persons"][:10]:
                content += f"- {person}\n"
            content += "\n"
        
        if entities.get("organizations"):
            content += "### 🏢 Organisations\n"
            for org in entities["organizations"][:10]:
                content += f"- {org}\n"
            content += "\n"
    
    # Flashcards
    if flashcards:
        content += "---\n\n## 📚 Flashcards de révision\n\n"
        for i, card in enumerate(flashcards[:10], 1):
            content += f"### Carte {i}\n"
            content += f"**Q:** {card.get('front', card.get('question', ''))}\n\n"
            content += f"**R:** {card.get('back', card.get('answer', ''))}\n\n"
    
    content += """---

*Généré par [Deep Sight](https://deepsightsynthesis.com) — Analyse intelligente de vidéos YouTube*
"""
    
    return content


# ═══════════════════════════════════════════════════════════════════════════════
# 📄 EXPORT DOCX
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_docx(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None,
    flashcards: List[Dict] = None
) -> Optional[bytes]:
    """Exporte l'analyse en format DOCX"""
    
    if not DOCX_AVAILABLE:
        return None
    
    doc = Document()
    
    # Titre principal
    title_para = doc.add_heading("🤿 Deep Sight — Analyse", 0)
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Sous-titre
    subtitle = doc.add_paragraph()
    subtitle.add_run("Analyse intelligente de vidéos YouTube").italic = True
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph()
    
    # Section vidéo
    doc.add_heading("📺 Vidéo analysée", level=1)
    
    duration_str = format_duration(duration)
    date_str = created_at.strftime("%d/%m/%Y à %H:%M") if created_at else datetime.now().strftime("%d/%m/%Y à %H:%M")
    
    # Tableau d'infos
    table = doc.add_table(rows=6, cols=2)
    table.style = 'Table Grid'
    
    info = [
        ("Titre", title),
        ("Chaîne", channel),
        ("Durée", duration_str),
        ("Catégorie", category),
        ("Mode", mode),
        ("Analysé le", date_str)
    ]
    
    for i, (label, value) in enumerate(info):
        cells = table.rows[i].cells
        cells[0].text = label
        cells[0].paragraphs[0].runs[0].bold = True
        cells[1].text = value
    
    if video_url:
        p = doc.add_paragraph()
        p.add_run("🔗 URL: ").bold = True
        p.add_run(video_url)
    
    doc.add_paragraph()
    
    # Section synthèse
    doc.add_heading("📋 Synthèse", level=1)
    
    # Nettoyer et ajouter le contenu
    for paragraph in summary.split('\n\n'):
        if paragraph.strip():
            # Détecter les headers markdown
            if paragraph.startswith('## '):
                doc.add_heading(paragraph[3:].strip(), level=2)
            elif paragraph.startswith('### '):
                doc.add_heading(paragraph[4:].strip(), level=3)
            else:
                p = doc.add_paragraph(paragraph.strip())
    
    # Score de fiabilité
    if reliability_score is not None:
        doc.add_paragraph()
        doc.add_heading("📊 Score de fiabilité", level=1)
        emoji = "✅" if reliability_score >= 70 else "⚖️" if reliability_score >= 50 else "⚠️"
        p = doc.add_paragraph()
        p.add_run(f"{emoji} {reliability_score}/100").bold = True
    
    # Entités
    if entities:
        doc.add_paragraph()
        doc.add_heading("🏷️ Entités extraites", level=1)
        
        if entities.get("concepts"):
            doc.add_heading("Concepts clés", level=2)
            for concept in entities["concepts"][:10]:
                doc.add_paragraph(concept, style='List Bullet')
        
        if entities.get("persons"):
            doc.add_heading("Personnes", level=2)
            for person in entities["persons"][:10]:
                doc.add_paragraph(person, style='List Bullet')
    
    # Flashcards
    if flashcards:
        doc.add_paragraph()
        doc.add_heading("📚 Flashcards de révision", level=1)
        for i, card in enumerate(flashcards[:10], 1):
            doc.add_heading(f"Carte {i}", level=2)
            p = doc.add_paragraph()
            p.add_run("Question: ").bold = True
            p.add_run(card.get('front', card.get('question', '')))
            p = doc.add_paragraph()
            p.add_run("Réponse: ").bold = True
            p.add_run(card.get('back', card.get('answer', '')))
    
    # Footer
    doc.add_paragraph()
    footer = doc.add_paragraph()
    footer.add_run("Généré par Deep Sight — deepsightsynthesis.com").italic = True
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Sauvegarder en bytes
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 📄 EXPORT PDF (ReportLab Fallback)
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_pdf_reportlab(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None
) -> Optional[bytes]:
    """Export PDF de fallback avec ReportLab (moins stylé)"""
    
    if not REPORTLAB_AVAILABLE:
        return None
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=HexColor(COLORS["primary"]),
        spaceAfter=20,
        alignment=1
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor(COLORS["primary"]),
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        spaceAfter=8
    )
    
    info_style = ParagraphStyle(
        'InfoStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=HexColor("#666666")
    )
    
    # Contenu
    story = []
    
    # Titre
    story.append(Paragraph("🤿 Deep Sight — Analyse", title_style))
    story.append(Spacer(1, 20))
    
    # Infos vidéo
    story.append(Paragraph("📺 Vidéo analysée", heading_style))
    
    duration_str = format_duration(duration)
    date_str = created_at.strftime("%d/%m/%Y à %H:%M") if created_at else datetime.now().strftime("%d/%m/%Y à %H:%M")
    
    info_text = f"""
    <b>Titre:</b> {title}<br/>
    <b>Chaîne:</b> {channel}<br/>
    <b>Durée:</b> {duration_str}<br/>
    <b>Catégorie:</b> {category}<br/>
    <b>Mode:</b> {mode}<br/>
    <b>Analysé le:</b> {date_str}
    """
    story.append(Paragraph(info_text, info_style))
    
    if video_url:
        story.append(Paragraph(f"<b>URL:</b> {video_url}", info_style))
    
    story.append(Spacer(1, 20))
    
    # Synthèse
    story.append(Paragraph("📋 Synthèse", heading_style))
    
    # Nettoyer le markdown pour PDF
    summary_clean = summary.replace('**', '')
    summary_clean = re.sub(r'^##+ ', '', summary_clean, flags=re.MULTILINE)
    
    for paragraph in summary_clean.split('\n\n'):
        if paragraph.strip():
            safe_text = paragraph.strip().replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(safe_text, body_style))
    
    # Score de fiabilité
    if reliability_score is not None:
        story.append(Spacer(1, 15))
        story.append(Paragraph("📊 Score de fiabilité", heading_style))
        emoji = "✅" if reliability_score >= 70 else "⚖️" if reliability_score >= 50 else "⚠️"
        story.append(Paragraph(f"<b>{emoji} {reliability_score}/100</b>", body_style))
    
    # Footer
    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor("#999999"),
        alignment=1
    )
    story.append(Paragraph("Généré par Deep Sight — deepsightsynthesis.com", footer_style))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 📄 EXPORT PDF (Main - tries WeasyPrint first, then ReportLab)
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_pdf(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    thumbnail_url: str = "",
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None,
    flashcards: List[Dict] = None,
    sources: List[Dict] = None,
    export_type: str = "full"
) -> Optional[bytes]:
    """
    Exporte l'analyse en format PDF.
    Utilise WeasyPrint si disponible, sinon ReportLab en fallback.
    
    Args:
        export_type: "full" | "summary" | "flashcards" | "study"
    """
    
    # Try WeasyPrint first (beautiful HTML→PDF)
    if weasyprint_available():
        pdf = generate_pdf_weasyprint(
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
            sources=sources,
            export_type=export_type
        )
        if pdf:
            return pdf
        print("⚠️ WeasyPrint failed, falling back to ReportLab", flush=True)
    
    # Fallback to ReportLab
    if REPORTLAB_AVAILABLE:
        return export_to_pdf_reportlab(
            title=title,
            channel=channel,
            category=category,
            mode=mode,
            summary=summary,
            video_url=video_url,
            duration=duration,
            entities=entities,
            reliability_score=reliability_score,
            created_at=created_at
        )
    
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTION PRINCIPALE D'EXPORT
# ═══════════════════════════════════════════════════════════════════════════════

def export_summary(
    format: str,
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    thumbnail_url: str = "",
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None,
    flashcards: List[Dict] = None,
    sources: List[Dict] = None,
    pdf_export_type: str = "full"
) -> Tuple[Optional[bytes | str], str, str]:
    """
    Exporte un résumé dans le format demandé.
    
    Args:
        format: txt, md, docx, pdf
        pdf_export_type: full, summary, flashcards, study (pour PDF uniquement)
    
    Returns:
        Tuple (content, filename, mimetype)
    """
    
    # Générer un nom de fichier safe
    timestamp = datetime.now().strftime("%Y%m%d")
    base_filename = clean_filename(title, timestamp)
    
    if format == "txt":
        content = export_to_txt(
            title, channel, category, mode, summary,
            video_url, duration, created_at
        )
        return content, f"{base_filename}.txt", "text/plain"
    
    elif format == "md":
        content = export_to_markdown(
            title, channel, category, mode, summary,
            video_url, duration, thumbnail_url, entities,
            reliability_score, created_at, flashcards
        )
        return content, f"{base_filename}.md", "text/markdown"
    
    elif format == "docx":
        if not DOCX_AVAILABLE:
            return None, "", ""
        content = export_to_docx(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, 
            created_at, flashcards
        )
        return content, f"{base_filename}.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    elif format == "pdf":
        content = export_to_pdf(
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
            sources=sources,
            export_type=pdf_export_type
        )
        if content is None:
            return None, "", ""
        
        # Ajouter le type dans le nom de fichier
        type_suffix = "" if pdf_export_type == "full" else f"_{pdf_export_type}"
        return content, f"{base_filename}{type_suffix}.pdf", "application/pdf"
    
    else:
        return None, "", ""


def get_available_formats() -> List[str]:
    """Retourne la liste des formats d'export disponibles"""
    formats = ["txt", "md"]
    if DOCX_AVAILABLE:
        formats.append("docx")
    if weasyprint_available() or REPORTLAB_AVAILABLE:
        formats.append("pdf")
    return formats


def get_pdf_export_options() -> List[Dict]:
    """Retourne les options d'export PDF disponibles"""
    return PDF_EXPORT_OPTIONS
