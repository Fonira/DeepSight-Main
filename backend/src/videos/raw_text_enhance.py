"""
🎨 RAW TEXT ENHANCEMENTS v2.0
==============================
- Génération de titre intelligent basé sur le contenu
- Détection du type de source (académique, journalistique, etc.)
- Thumbnail adaptée au contexte
"""

import os
import re
import base64
import logging
import httpx
from typing import Optional, Tuple, Dict
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📚 SOURCE TYPES — Types de documents détectés
# ═══════════════════════════════════════════════════════════════════════════════

class SourceType(str, Enum):
    """Types de sources détectables"""
    ACADEMIC = "academic"           # Cours, thèse, article scientifique
    NEWS = "news"                   # Article de presse, actualité
    TRANSCRIPT = "transcript"       # Transcription de vidéo/podcast
    LEGAL = "legal"                 # Document juridique, contrat
    TECHNICAL = "technical"         # Documentation technique, tutoriel
    BUSINESS = "business"           # Rapport d'entreprise, présentation
    LITERARY = "literary"           # Texte littéraire, essai
    SOCIAL_MEDIA = "social_media"   # Post, thread, commentaire
    GENERAL = "general"             # Texte général non catégorisé


@dataclass
class SourceContext:
    """Contexte détecté de la source"""
    source_type: SourceType
    confidence: float
    detected_origin: Optional[str]  # Ex: "Université Lyon 2", "Le Monde", etc.
    format_hints: list              # Indices sur le format (PDF, web, etc.)
    academic_level: Optional[str]   # Licence, Master, etc. si académique
    
    def to_dict(self) -> Dict:
        return {
            "source_type": self.source_type.value,
            "confidence": self.confidence,
            "detected_origin": self.detected_origin,
            "format_hints": self.format_hints,
            "academic_level": self.academic_level
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 SOURCE DETECTION — Détection intelligente du type de source
# ═══════════════════════════════════════════════════════════════════════════════

# Patterns de détection par type de source
SOURCE_PATTERNS = {
    SourceType.ACADEMIC: {
        "keywords": [
            # Institutions
            "université", "university", "faculté", "faculty", "campus",
            "école", "school", "institut", "college", "laboratoire",
            # Niveaux
            "licence", "bachelor", "master", "doctorat", "phd", "thèse", "thesis",
            "semestre", "semester", "ects", "crédits", "module", "ue ",
            # Contenu académique
            "cours", "enseignement", "pédagogique", "programme", "curriculum",
            "méthodologie", "épistémologie", "bibliographie", "recherche",
            "étudiant", "student", "professeur", "professor", "enseignant",
            # Sciences
            "cognitif", "cognitive", "neuroscience", "psychologie", "sociologie",
            "philosophie", "mathématiques", "physique", "chimie", "biologie"
        ],
        "url_patterns": [
            r"\.edu", r"\.ac\.", r"univ-", r"u-", r"university",
            r"scholar\.google", r"hal\.archives", r"arxiv\.org"
        ],
        "structure_markers": [
            "objectifs pédagogiques", "learning outcomes", "prérequis",
            "compétences visées", "modalités d'évaluation", "références"
        ]
    },
    
    SourceType.NEWS: {
        "keywords": [
            # Médias
            "journal", "presse", "média", "rédaction", "article",
            "AFP", "Reuters", "dépêche", "édition", "rubrique",
            # Journalisme
            "journaliste", "reporter", "correspondant", "envoyé spécial",
            "source", "selon nos informations", "d'après", "révèle",
            # Temporalité
            "aujourd'hui", "hier", "cette semaine", "ce mois",
            "breaking", "urgent", "dernière minute", "actualité"
        ],
        "url_patterns": [
            r"lemonde\.fr", r"lefigaro\.fr", r"liberation\.fr",
            r"nytimes\.com", r"bbc\.", r"guardian\.",
            r"news", r"actu", r"info"
        ],
        "structure_markers": [
            "mise à jour", "publié le", "par notre correspondant",
            "selon une source", "contacté par"
        ]
    },
    
    SourceType.TRANSCRIPT: {
        "keywords": [
            # Formats audio/vidéo
            "transcription", "sous-titres", "podcast", "épisode",
            "vidéo", "youtube", "interview", "émission",
            # Marqueurs de dialogue
            "dit-il", "dit-elle", "explique", "poursuit",
            "intervenant", "présentateur", "invité",
            # Timecodes
            "minute", "seconde", "timestamp"
        ],
        "url_patterns": [
            r"youtube\.com", r"youtu\.be", r"vimeo\.com",
            r"spotify\.com", r"podcast", r"soundcloud"
        ],
        "structure_markers": [
            "[", "]",  # Timecodes style [00:00]
            "...", "euh", "ben", "donc euh"  # Marqueurs d'oral
        ]
    },
    
    SourceType.LEGAL: {
        "keywords": [
            "article", "alinéa", "loi", "décret", "arrêté",
            "tribunal", "cour", "juridiction", "jugement",
            "contrat", "clause", "partie", "signataire",
            "code civil", "code pénal", "jurisprudence"
        ],
        "url_patterns": [
            r"legifrance\.gouv", r"eur-lex\.europa",
            r"justice\.gouv", r"conseil-etat"
        ],
        "structure_markers": [
            "attendu que", "considérant que", "en vertu de",
            "dispositions", "stipulations"
        ]
    },
    
    SourceType.TECHNICAL: {
        "keywords": [
            "documentation", "API", "SDK", "framework",
            "installation", "configuration", "paramètre",
            "fonction", "méthode", "classe", "variable",
            "tutoriel", "guide", "manuel", "howto"
        ],
        "url_patterns": [
            r"github\.com", r"stackoverflow", r"docs\.",
            r"developer\.", r"readme", r"wiki"
        ],
        "structure_markers": [
            "```", "code", "example", "output",
            "import", "def ", "function", "return"
        ]
    },
    
    SourceType.BUSINESS: {
        "keywords": [
            "entreprise", "société", "chiffre d'affaires", "CA",
            "résultat", "bénéfice", "marge", "croissance",
            "stratégie", "marché", "client", "partenaire",
            "rapport annuel", "présentation", "slides"
        ],
        "url_patterns": [
            r"linkedin\.com", r"\.com/investors",
            r"rapport-annuel", r"annual-report"
        ],
        "structure_markers": [
            "Q1", "Q2", "Q3", "Q4", "YoY", "€", "$", "%",
            "objectifs", "KPI", "roadmap"
        ]
    }
}


def detect_source_type(text: str, source_hint: Optional[str] = None) -> SourceContext:
    """
    🔍 Détecte le type de source à partir du contenu et des indices.
    """
    text_lower = text.lower()
    source_lower = (source_hint or "").lower()
    
    scores = {st: 0.0 for st in SourceType}
    detected_origin = None
    format_hints = []
    academic_level = None
    
    # Analyser chaque type de source
    for source_type, patterns in SOURCE_PATTERNS.items():
        score = 0.0
        
        # Keywords (poids: 2 par match)
        keyword_matches = sum(1 for kw in patterns["keywords"] if kw in text_lower)
        score += keyword_matches * 2
        
        # URL patterns (poids: 5 par match)
        if source_hint:
            for pattern in patterns["url_patterns"]:
                if re.search(pattern, source_lower):
                    score += 5
        
        # Structure markers (poids: 3 par match)
        marker_matches = sum(1 for m in patterns["structure_markers"] if m in text_lower)
        score += marker_matches * 3
        
        scores[source_type] = score
    
    # Trouver le meilleur score
    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]
    total_score = sum(scores.values())
    
    # Calculer la confiance
    if total_score > 0:
        confidence = min(0.95, best_score / (total_score + 10) + 0.3)
    else:
        confidence = 0.3
        best_type = SourceType.GENERAL
    
    # Détecter l'origine spécifique
    detected_origin = _detect_origin(text, source_hint, best_type)
    
    # Détecter le niveau académique si pertinent
    if best_type == SourceType.ACADEMIC:
        academic_level = _detect_academic_level(text_lower)
    
    # Détecter les indices de format
    format_hints = _detect_format_hints(text, source_hint)
    
    print(f"📚 [SOURCE] Detected: {best_type.value} (confidence: {confidence:.2f})", flush=True)
    if detected_origin:
        print(f"   Origin: {detected_origin}", flush=True)
    
    return SourceContext(
        source_type=best_type,
        confidence=confidence,
        detected_origin=detected_origin,
        format_hints=format_hints,
        academic_level=academic_level
    )


def _detect_origin(text: str, source_hint: str, source_type: SourceType) -> Optional[str]:
    """Détecte l'origine spécifique (institution, média, etc.)"""
    text_lower = text.lower()
    
    # Universités françaises
    universities = {
        "lyon 2": "Université Lumière Lyon 2",
        "lyon 1": "Université Claude Bernard Lyon 1",
        "lyon 3": "Université Jean Moulin Lyon 3",
        "paris 1": "Université Paris 1 Panthéon-Sorbonne",
        "sorbonne": "Sorbonne Université",
        "sciences po": "Sciences Po",
        "hec": "HEC Paris",
        "polytechnique": "École Polytechnique",
        "normale sup": "ENS",
        "centrale": "École Centrale"
    }
    
    for pattern, name in universities.items():
        if pattern in text_lower or (source_hint and pattern in source_hint.lower()):
            return name
    
    # Médias
    media = {
        "le monde": "Le Monde",
        "le figaro": "Le Figaro",
        "libération": "Libération",
        "mediapart": "Mediapart",
        "france info": "France Info",
        "bbc": "BBC",
        "new york times": "New York Times",
        "guardian": "The Guardian"
    }
    
    for pattern, name in media.items():
        if pattern in text_lower:
            return name
    
    return None


def _detect_academic_level(text_lower: str) -> Optional[str]:
    """Détecte le niveau académique"""
    levels = [
        ("doctorat", "Doctorat"),
        ("phd", "PhD"),
        ("thèse", "Doctorat"),
        ("master 2", "Master 2"),
        ("master 1", "Master 1"),
        ("master", "Master"),
        ("licence 3", "Licence 3"),
        ("licence 2", "Licence 2"),
        ("licence 1", "Licence 1"),
        ("licence", "Licence"),
        ("l3", "Licence 3"),
        ("l2", "Licence 2"),
        ("l1", "Licence 1"),
        ("m2", "Master 2"),
        ("m1", "Master 1")
    ]
    
    for pattern, level in levels:
        if pattern in text_lower:
            return level
    return None


def _detect_format_hints(text: str, source_hint: str) -> list:
    """Détecte des indices sur le format original"""
    hints = []
    
    if "http://" in text or "https://" in text:
        hints.append("web_content")
    if re.search(r'\[\d+:\d+\]', text):
        hints.append("timestamped")
    if "pdf" in (source_hint or "").lower():
        hints.append("pdf")
    if len(text.split('\n')) > 50:
        hints.append("structured")
    
    return hints


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 SMART TITLE GENERATION v2.0
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_smart_title(
    text: str, 
    lang: str = "fr",
    source_context: Optional[SourceContext] = None
) -> str:
    """
    🎯 Génère un titre intelligent basé sur le contenu.
    """
    try:
        from mistralai import Mistral
    except ImportError:
        from mistralai.client import Mistral
    
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.warning("No MISTRAL_API_KEY, using fallback title")
        return _extract_fallback_title(text, source_context)
    
    try:
        client = Mistral(api_key=api_key)
        
        # Adapter le prompt selon le type de source
        source_hint = ""
        if source_context:
            if source_context.source_type == SourceType.ACADEMIC:
                source_hint = f"C'est un texte académique{f' de niveau {source_context.academic_level}' if source_context.academic_level else ''}{f' ({source_context.detected_origin})' if source_context.detected_origin else ''}."
            elif source_context.source_type == SourceType.NEWS:
                source_hint = f"C'est un article de presse{f' de {source_context.detected_origin}' if source_context.detected_origin else ''}."
            elif source_context.source_type == SourceType.TRANSCRIPT:
                source_hint = "C'est une transcription audio/vidéo."
            elif source_context.source_type == SourceType.TECHNICAL:
                source_hint = "C'est une documentation technique."
        
        lang_instruction = "en français" if lang == "fr" else "in English"
        
        prompt = f"""Tu es un expert en rédaction de titres. Analyse ce texte et génère UN titre percutant {lang_instruction}.

{source_hint}

RÈGLES STRICTES:
1. Le titre doit capturer le SUJET PRINCIPAL du texte
2. Maximum 60 caractères
3. Pas de guillemets
4. Pas de point final
5. Le titre doit être SPÉCIFIQUE et INFORMATIF

EXEMPLES DE BONS TITRES:
- "Formation Sciences Cognitives Lyon 2" ✓
- "Texte analysé" ✗ (trop générique)
- "Guide pratique du machine learning" ✓
- "Document technique" ✗ (trop vague)

TEXTE:
{text[:4000]}

Réponds UNIQUEMENT avec le titre:"""

        response = await client.chat.complete_async(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.2,
        )
        
        title = response.choices[0].message.content.strip()
        title = _clean_title(title)
        
        # Vérifier que le titre n'est pas générique
        generic_titles = [
            "texte analysé", "document", "analyse", "résumé",
            "article", "text analysis", "document analysis",
            "titre", "title", "sans titre"
        ]
        if title.lower() in generic_titles or len(title) < 5:
            print(f"⚠️ [TITLE] Generic detected: '{title}', using fallback", flush=True)
            return _extract_fallback_title(text, source_context)
        
        print(f"🎯 [TITLE] Generated: {title}", flush=True)
        return title
        
    except Exception as e:
        print(f"❌ [TITLE] Error: {e}", flush=True)
        return _extract_fallback_title(text, source_context)


def _clean_title(title: str) -> str:
    """Nettoie un titre généré"""
    title = title.strip()
    title = title.strip('"\'«»""''')
    title = title.rstrip('.')
    
    # Supprimer préfixes courants
    prefixes = ["titre:", "title:", "le titre est:", "voici le titre:", "voici:"]
    for prefix in prefixes:
        if title.lower().startswith(prefix):
            title = title[len(prefix):].strip()
    
    if len(title) > 70:
        title = title[:67]
        last_space = title.rfind(' ')
        if last_space > 40:
            title = title[:last_space]
        title += "..."
    
    return title


def _extract_fallback_title(text: str, source_context: Optional[SourceContext] = None) -> str:
    """Extrait un titre de secours intelligent depuis le texte."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    if lines:
        for line in lines[:10]:
            if 10 < len(line) < 80:
                if not line.startswith(('-', '*', '•', '1.', '2.')):
                    if not line.startswith(('http://', 'https://')):
                        return _clean_title(line)
    
    # Si source académique, générer un titre contextuel
    if source_context:
        if source_context.source_type == SourceType.ACADEMIC:
            if source_context.detected_origin:
                if source_context.academic_level:
                    return f"{source_context.academic_level} - {source_context.detected_origin}"
                return f"Formation {source_context.detected_origin}"
            if source_context.academic_level:
                return f"Cours de {source_context.academic_level}"
            return "Formation universitaire"
        elif source_context.source_type == SourceType.NEWS:
            if source_context.detected_origin:
                return f"Article - {source_context.detected_origin}"
            return "Article d'actualité"
        elif source_context.source_type == SourceType.TRANSCRIPT:
            return "Transcription audio/vidéo"
        elif source_context.source_type == SourceType.TECHNICAL:
            return "Documentation technique"
        elif source_context.source_type == SourceType.LEGAL:
            return "Document juridique"
        elif source_context.source_type == SourceType.BUSINESS:
            return "Document d'entreprise"
    
    # Dernier recours: premiers mots significatifs
    words = [w for w in text.split()[:15] if len(w) > 3]
    if words:
        fallback = " ".join(words[:8])
        if len(fallback) > 50:
            fallback = fallback[:47] + "..."
        return fallback
    
    return "Document importé"


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 TEMPLATE ADAPTATION
# ═══════════════════════════════════════════════════════════════════════════════

def get_source_specific_instructions(source_context: SourceContext, lang: str = "fr") -> str:
    """
    Génère des instructions spécifiques selon le type de source.
    """
    if lang == "fr":
        instructions = {
            SourceType.ACADEMIC: f"""
📚 CONTEXTE: Texte académique/universitaire{f' ({source_context.detected_origin})' if source_context.detected_origin else ''}{f' - Niveau {source_context.academic_level}' if source_context.academic_level else ''}
INSTRUCTIONS SPÉCIALES:
- Structure le résumé avec: Objectifs pédagogiques, Contenu principal, Compétences visées
- Mets en évidence les concepts clés et définitions
- Identifie les prérequis éventuels
- Signale les références bibliographiques mentionnées
- Utilise un ton formel et précis""",
            
            SourceType.NEWS: f"""
📰 CONTEXTE: Article de presse/actualité{f' ({source_context.detected_origin})' if source_context.detected_origin else ''}
INSTRUCTIONS SPÉCIALES:
- Réponds aux questions: Qui? Quoi? Où? Quand? Pourquoi?
- Distingue clairement les faits des analyses/opinions
- Identifie les sources citées
- Contextualise l'information
- Note la date si disponible""",
            
            SourceType.TRANSCRIPT: """
🎙️ CONTEXTE: Transcription audio/vidéo
INSTRUCTIONS SPÉCIALES:
- Identifie les intervenants si possible
- Structure en thèmes abordés chronologiquement
- Extrais les citations marquantes
- Distingue les faits des opinions
- Note les moments clés""",
            
            SourceType.LEGAL: """
⚖️ CONTEXTE: Document juridique
INSTRUCTIONS SPÉCIALES:
- Identifie les parties concernées
- Résume les dispositions principales
- Note les obligations et droits
- Signale les dates et délais
- Utilise un vocabulaire juridique précis""",
            
            SourceType.TECHNICAL: """
💻 CONTEXTE: Documentation technique
INSTRUCTIONS SPÉCIALES:
- Identifie l'objectif/problème résolu
- Liste les prérequis techniques
- Structure en étapes si tutoriel
- Note les exemples importants
- Signale les bonnes pratiques""",
            
            SourceType.BUSINESS: """
📊 CONTEXTE: Document business/entreprise
INSTRUCTIONS SPÉCIALES:
- Identifie les chiffres clés
- Résume la stratégie présentée
- Note les objectifs et KPIs
- Identifie risques et opportunités
- Structure: Situation, Actions, Perspectives"""
        }
    else:
        instructions = {
            SourceType.ACADEMIC: """
📚 CONTEXT: Academic text
SPECIAL INSTRUCTIONS:
- Structure: Learning objectives, Main content, Target skills
- Highlight key concepts and definitions
- Identify prerequisites
- Note bibliographic references
- Use formal tone""",
            
            SourceType.NEWS: """
📰 CONTEXT: Press article
SPECIAL INSTRUCTIONS:
- Answer: Who? What? Where? When? Why?
- Distinguish facts from opinions
- Identify cited sources
- Contextualize information""",
            
            SourceType.TRANSCRIPT: """
🎙️ CONTEXT: Audio/Video transcript
SPECIAL INSTRUCTIONS:
- Identify speakers
- Structure by topics chronologically
- Extract notable quotes
- Note key moments"""
        }
    
    return instructions.get(source_context.source_type, "")


# ═══════════════════════════════════════════════════════════════════════════════
# 🖼️ THUMBNAIL GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def _get_placeholder_thumbnail(category: str, source_type: Optional[SourceType] = None) -> str:
    """Retourne un placeholder SVG élégant."""
    if source_type:
        source_colors = {
            SourceType.ACADEMIC: ("#4A90D9", "#1E3A5F", "🎓"),
            SourceType.NEWS: ("#E74C3C", "#7B1E1E", "📰"),
            SourceType.TRANSCRIPT: ("#9B59B6", "#4A235A", "🎙️"),
            SourceType.LEGAL: ("#34495E", "#1C2833", "⚖️"),
            SourceType.TECHNICAL: ("#6C5CE7", "#2D1B69", "💻"),
            SourceType.BUSINESS: ("#27AE60", "#145A32", "📊"),
            SourceType.LITERARY: ("#E91E63", "#880E4F", "📖"),
        }
        if source_type in source_colors:
            c1, c2, icon = source_colors[source_type]
            label = source_type.value.upper()
        else:
            c1, c2, icon = ("#6366F1", "#312E81", "📄")
            label = "TEXTE"
    else:
        colors = {
            "science": ("#4A90D9", "#1E3A5F", "🔬"),
            "tech": ("#6C5CE7", "#2D1B69", "💻"),
            "politics": ("#E74C3C", "#7B1E1E", "🏛️"),
            "economy": ("#27AE60", "#145A32", "📊"),
            "health": ("#1ABC9C", "#0E6655", "🏥"),
            "education": ("#F39C12", "#7D5006", "📚"),
            "culture": ("#E91E63", "#880E4F", "🎨"),
            "environment": ("#2ECC71", "#186A3B", "🌿"),
            "tutorial": ("#3498DB", "#1B4F72", "📝"),
            "interview": ("#9B59B6", "#4A235A", "🎙️"),
        }
        c1, c2, icon = colors.get(category, ("#6366F1", "#312E81", "📄"))
        label = category.upper() if category else "TEXTE"
    
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" stop-color="{c1}"/><stop offset="100%" stop-color="{c2}"/>
</linearGradient></defs>
<rect width="320" height="180" fill="url(#g)"/>
<circle cx="160" cy="75" r="35" fill="rgba(255,255,255,0.15)"/>
<text x="160" y="88" font-size="32" fill="white" text-anchor="middle">{icon}</text>
<text x="160" y="145" font-size="13" fill="rgba(255,255,255,0.9)" text-anchor="middle" font-weight="bold">{label}</text>
</svg>'''
    
    svg_b64 = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
    return f"data:image/svg+xml;base64,{svg_b64}"


async def generate_thumbnail(
    title: str,
    category: str,
    source_type: Optional[SourceType] = None,
    lang: str = "fr"
) -> str:
    """🖼️ Génère une thumbnail (placeholder SVG)."""
    return _get_placeholder_thumbnail(category, source_type)


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 MAIN ENHANCEMENT FUNCTION v2.0
# ═══════════════════════════════════════════════════════════════════════════════

async def enhance_raw_text(
    text: str,
    provided_title: Optional[str],
    category: str,
    lang: str = "fr",
    source_hint: Optional[str] = None
) -> Tuple[str, str, SourceContext]:
    """
    🚀 Améliore un texte brut avec:
    - Titre intelligent basé sur le contenu
    - Détection du type de source
    - Thumbnail adaptée
    
    Returns:
        Tuple[title, thumbnail_url, source_context]
    """
    # 1. Détecter le type de source
    source_context = detect_source_type(text, source_hint)
    
    # 2. Générer le titre si non fourni ou générique
    generic_titles = ["texte analysé", "text analysis", ""]
    if provided_title and provided_title.strip().lower() not in generic_titles:
        title = provided_title.strip()
        print(f"📝 [RAW_TEXT] Using provided title: {title}", flush=True)
    else:
        title = await generate_smart_title(text, lang, source_context)
        print(f"🎯 [RAW_TEXT] Generated title: {title}", flush=True)
    
    # 3. Générer la thumbnail
    thumbnail_url = await generate_thumbnail(
        title=title,
        category=category,
        source_type=source_context.source_type,
        lang=lang
    )
    
    print(f"🖼️ [RAW_TEXT] Thumbnail: {len(thumbnail_url)} chars", flush=True)
    
    return title, thumbnail_url, source_context


# ═══════════════════════════════════════════════════════════════════════════════
# 🎁 EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    "SourceType",
    "SourceContext",
    "detect_source_type",
    "generate_smart_title",
    "generate_thumbnail",
    "enhance_raw_text",
    "get_source_specific_instructions",
]
