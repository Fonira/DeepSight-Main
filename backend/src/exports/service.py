"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📄 EXPORT SERVICE — Génération PDF, DOCX, TXT, Markdown, CSV, Excel               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import io
import re
import csv
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

# Imports conditionnels pour les librairies d'export
try:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.style import WD_STYLE_TYPE
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib.units import cm
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from openpyxl.utils import get_column_letter
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False


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
    
    # Formatage durée
    if duration:
        hours, remainder = divmod(duration, 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours:
            duration_str = f"{hours}h{minutes:02d}m{seconds:02d}s"
        else:
            duration_str = f"{minutes}m{seconds:02d}s"
    else:
        duration_str = "N/A"
    
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
    created_at: datetime = None
) -> str:
    """Exporte l'analyse en format Markdown"""
    
    # Formatage durée
    if duration:
        hours, remainder = divmod(duration, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours}h{minutes:02d}m" if hours else f"{minutes}m{seconds:02d}s"
    else:
        duration_str = "N/A"
    
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
    created_at: datetime = None
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
    
    # Formatage durée
    if duration:
        hours, remainder = divmod(duration, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours}h{minutes:02d}m" if hours else f"{minutes}m{seconds:02d}s"
    else:
        duration_str = "N/A"
    
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
# 📄 EXPORT PDF
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_pdf(
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
    """Exporte l'analyse en format PDF"""
    
    if not PDF_AVAILABLE:
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
    
    # Style personnalisé pour le titre
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=HexColor(COLORS["primary"]),
        spaceAfter=20,
        alignment=1  # Center
    )
    
    # Style pour les sous-titres
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor(COLORS["primary"]),
        spaceBefore=15,
        spaceAfter=10
    )
    
    # Style pour le corps
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        spaceAfter=8
    )
    
    # Style pour les infos
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
    
    # Formatage durée
    if duration:
        hours, remainder = divmod(duration, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours}h{minutes:02d}m" if hours else f"{minutes}m{seconds:02d}s"
    else:
        duration_str = "N/A"
    
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
            # Escape les caractères spéciaux pour ReportLab
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
# 📊 EXPORT CSV
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_csv(
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
) -> str:
    """Exporte l'analyse en format CSV (structured data)"""

    # Formatage durée
    if duration:
        hours, remainder = divmod(duration, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours}h{minutes:02d}m" if hours else f"{minutes}m{seconds:02d}s"
    else:
        duration_str = "N/A"

    date_str = created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL)

    # Header
    writer.writerow(["Deep Sight - Export d'analyse"])
    writer.writerow([])

    # Métadonnées
    writer.writerow(["Propriété", "Valeur"])
    writer.writerow(["Titre", title])
    writer.writerow(["Chaîne", channel])
    writer.writerow(["Durée", duration_str])
    writer.writerow(["Catégorie", category])
    writer.writerow(["Mode d'analyse", mode])
    writer.writerow(["URL", video_url])
    writer.writerow(["Date d'analyse", date_str])

    if reliability_score is not None:
        writer.writerow(["Score de fiabilité", f"{reliability_score}/100"])

    writer.writerow([])

    # Synthèse (nettoyée du markdown)
    summary_clean = re.sub(r'^##+ ', '', summary, flags=re.MULTILINE)
    summary_clean = summary_clean.replace('**', '').replace('*', '')
    writer.writerow(["Synthèse"])
    writer.writerow([summary_clean])

    writer.writerow([])

    # Entités
    if entities:
        if entities.get("concepts"):
            writer.writerow(["Concepts clés"])
            for concept in entities["concepts"][:15]:
                writer.writerow([concept])
            writer.writerow([])

        if entities.get("persons"):
            writer.writerow(["Personnes mentionnées"])
            for person in entities["persons"][:15]:
                writer.writerow([person])
            writer.writerow([])

        if entities.get("organizations"):
            writer.writerow(["Organisations"])
            for org in entities["organizations"][:15]:
                writer.writerow([org])

    writer.writerow([])
    writer.writerow(["Généré par Deep Sight - deepsightsynthesis.com"])

    return buffer.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 EXPORT EXCEL (.xlsx)
# ═══════════════════════════════════════════════════════════════════════════════

def export_to_excel(
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
    """Exporte l'analyse en format Excel (.xlsx)"""

    if not EXCEL_AVAILABLE:
        return None

    wb = Workbook()
    ws = wb.active
    ws.title = "Analyse Deep Sight"

    # Styles
    header_font = Font(name='Arial', size=16, bold=True, color="0D4F4F")
    subheader_font = Font(name='Arial', size=12, bold=True, color="0D4F4F")
    label_font = Font(name='Arial', size=10, bold=True)
    value_font = Font(name='Arial', size=10)
    header_fill = PatternFill(start_color="E8F4F4", end_color="E8F4F4", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CCCCCC'),
        right=Side(style='thin', color='CCCCCC'),
        top=Side(style='thin', color='CCCCCC'),
        bottom=Side(style='thin', color='CCCCCC')
    )

    # Formatage durée
    if duration:
        hours, remainder = divmod(duration, 3600)
        minutes, seconds = divmod(remainder, 60)
        duration_str = f"{hours}h{minutes:02d}m" if hours else f"{minutes}m{seconds:02d}s"
    else:
        duration_str = "N/A"

    date_str = created_at.strftime("%d/%m/%Y %H:%M") if created_at else datetime.now().strftime("%d/%m/%Y %H:%M")

    row = 1

    # Titre principal
    ws.merge_cells('A1:D1')
    cell = ws['A1']
    cell.value = "🤿 Deep Sight — Analyse"
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 30
    row = 3

    # Section Vidéo
    ws.merge_cells(f'A{row}:D{row}')
    cell = ws[f'A{row}']
    cell.value = "📺 Vidéo analysée"
    cell.font = subheader_font
    cell.fill = header_fill
    row += 1

    # Données de la vidéo
    video_data = [
        ("Titre", title),
        ("Chaîne", channel),
        ("Durée", duration_str),
        ("Catégorie", category),
        ("Mode d'analyse", mode),
        ("URL", video_url),
        ("Date d'analyse", date_str),
    ]

    if reliability_score is not None:
        emoji = "✅" if reliability_score >= 70 else "⚖️" if reliability_score >= 50 else "⚠️"
        video_data.append(("Score de fiabilité", f"{emoji} {reliability_score}/100"))

    for label, value in video_data:
        ws[f'A{row}'] = label
        ws[f'A{row}'].font = label_font
        ws[f'A{row}'].border = thin_border
        ws.merge_cells(f'B{row}:D{row}')
        ws[f'B{row}'] = value
        ws[f'B{row}'].font = value_font
        ws[f'B{row}'].border = thin_border
        row += 1

    row += 1

    # Section Synthèse
    ws.merge_cells(f'A{row}:D{row}')
    cell = ws[f'A{row}']
    cell.value = "📋 Synthèse"
    cell.font = subheader_font
    cell.fill = header_fill
    row += 1

    # Contenu de la synthèse (nettoyé)
    summary_clean = re.sub(r'^##+ ', '', summary, flags=re.MULTILINE)
    summary_clean = summary_clean.replace('**', '').replace('*', '')

    ws.merge_cells(f'A{row}:D{row}')
    cell = ws[f'A{row}']
    cell.value = summary_clean[:32000]  # Excel cell limit
    cell.font = value_font
    cell.alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[row].height = min(400, max(50, len(summary_clean) // 5))
    row += 2

    # Section Entités
    if entities:
        ws.merge_cells(f'A{row}:D{row}')
        cell = ws[f'A{row}']
        cell.value = "🏷️ Entités extraites"
        cell.font = subheader_font
        cell.fill = header_fill
        row += 1

        col_offset = 0
        if entities.get("concepts"):
            ws[f'A{row}'] = "Concepts clés"
            ws[f'A{row}'].font = label_font
            for i, concept in enumerate(entities["concepts"][:15]):
                ws[f'A{row + 1 + i}'] = concept
                ws[f'A{row + 1 + i}'].font = value_font

        if entities.get("persons"):
            ws[f'B{row}'] = "Personnes"
            ws[f'B{row}'].font = label_font
            for i, person in enumerate(entities["persons"][:15]):
                ws[f'B{row + 1 + i}'] = person
                ws[f'B{row + 1 + i}'].font = value_font

        if entities.get("organizations"):
            ws[f'C{row}'] = "Organisations"
            ws[f'C{row}'].font = label_font
            for i, org in enumerate(entities["organizations"][:15]):
                ws[f'C{row + 1 + i}'] = org
                ws[f'C{row + 1 + i}'].font = value_font

        row += 17

    # Footer
    ws.merge_cells(f'A{row}:D{row}')
    cell = ws[f'A{row}']
    cell.value = "Généré par Deep Sight — deepsightsynthesis.com"
    cell.font = Font(name='Arial', size=8, italic=True, color='999999')
    cell.alignment = Alignment(horizontal='center')

    # Ajuster largeur des colonnes
    ws.column_dimensions['A'].width = 20
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 25
    ws.column_dimensions['D'].width = 25

    # Sauvegarder en bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


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
    created_at: datetime = None
) -> tuple[Optional[bytes | str], str, str]:
    """
    Exporte un résumé dans le format demandé.
    
    Returns:
        Tuple (content, filename, mimetype)
    """
    
    # Générer un nom de fichier safe
    safe_title = re.sub(r'[^\w\s-]', '', title)[:50].strip()
    safe_title = re.sub(r'[-\s]+', '_', safe_title)
    timestamp = datetime.now().strftime("%Y%m%d")
    
    if format == "txt":
        content = export_to_txt(
            title, channel, category, mode, summary,
            video_url, duration, created_at
        )
        return content, f"deepsight_{safe_title}_{timestamp}.txt", "text/plain"
    
    elif format == "md":
        content = export_to_markdown(
            title, channel, category, mode, summary,
            video_url, duration, thumbnail_url, entities,
            reliability_score, created_at
        )
        return content, f"deepsight_{safe_title}_{timestamp}.md", "text/markdown"
    
    elif format == "docx":
        if not DOCX_AVAILABLE:
            return None, "", ""
        content = export_to_docx(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at
        )
        return content, f"deepsight_{safe_title}_{timestamp}.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    elif format == "pdf":
        if not PDF_AVAILABLE:
            return None, "", ""
        content = export_to_pdf(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at
        )
        return content, f"deepsight_{safe_title}_{timestamp}.pdf", "application/pdf"

    elif format == "csv":
        content = export_to_csv(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at
        )
        return content, f"deepsight_{safe_title}_{timestamp}.csv", "text/csv"

    elif format == "xlsx":
        if not EXCEL_AVAILABLE:
            return None, "", ""
        content = export_to_excel(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at
        )
        return content, f"deepsight_{safe_title}_{timestamp}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    else:
        return None, "", ""


def get_available_formats() -> list[str]:
    """Retourne la liste des formats d'export disponibles"""
    formats = ["txt", "md", "csv"]  # CSV is always available (stdlib)
    if DOCX_AVAILABLE:
        formats.append("docx")
    if PDF_AVAILABLE:
        formats.append("pdf")
    if EXCEL_AVAILABLE:
        formats.append("xlsx")
    return formats
