"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📊 METADATA ENRICHED SERVICE — Métadonnées enrichies et analyse contextuelle      ║
║  🆕 v2.1: Détection sponsorship, propagande, figures publiques, intentions         ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import json
import httpx
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

from core.config import get_mistral_key, get_perplexity_key

from .schemas import (
    VideoMetadataEnriched, PublicFigure, SponsorshipInfo, SponsorshipType,
    PropagandaAnalysis, PropagandaRisk, PublicationIntent, SentimentType
)

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 CONFIGURATION & PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════

# Patterns de détection de sponsorship
SPONSORSHIP_PATTERNS = {
    "disclosed": [
        r"(?:cette?\s+vid[ée]o\s+est?\s+)?sponsor(?:is[ée]e?\s+par|ed\s+by)",
        r"partenariat\s+avec|partnership\s+with",
        r"en\s+collaboration\s+avec|in\s+collaboration\s+with",
        r"merci\s+[àa]\s+.+?\s+(?:pour|de)\s+(?:ce\s+)?sponsor",
        r"thanks?\s+to\s+.+?\s+for\s+sponsor",
        r"#(?:pub|ad|sponsored|partenariat)"
    ],
    "affiliate": [
        r"lien(?:s)?\s+(?:d['''])?affili[ée]",
        r"affiliate\s+link",
        r"code\s+promo|promo\s+code",
        r"(?:mon|my)\s+code\s+",
        r"r[ée]duction\s+avec\s+(?:le\s+)?code"
    ],
    "product_placement": [
        r"j[''']utilise|i\s+use",
        r"(?:mon|my)\s+(?:setup|équipement|material)",
        r"(?:que\s+)?je\s+recommande|that\s+i\s+recommend"
    ]
}

# Marques connues pour détection
KNOWN_BRANDS = [
    "NordVPN", "Surfshark", "ExpressVPN", "Squarespace", "Skillshare",
    "Audible", "Brilliant", "Curiosity Stream", "HelloFresh", "Ridge",
    "Honey", "Raid Shadow Legends", "Dollar Shave Club", "BetterHelp",
    "Athletic Greens", "AG1", "Manscaped", "Keeps", "Roman"
]

# Techniques de propagande
PROPAGANDA_TECHNIQUES = {
    "emotional_manipulation": [
        r"(?:vous|tu)\s+(?:devez|dois)\s+(?:absolument|vraiment)",
        r"(?:they|on)\s+don[''']t\s+want\s+you\s+to\s+know",
        r"(?:la\s+)?v[ée]rit[ée]\s+(?:qu[''']on\s+)?(?:nous\s+)?cache",
        r"(?:wake\s+up|r[ée]veillez[\s-]vous)",
        r"(?:shocking|choquant|scandaleux)"
    ],
    "cherry_picking": [
        r"(?:la\s+)?seule?\s+(?:preuve|evidence)",
        r"(?:un\s+)?exemple\s+parfait",
        r"(?:this|ce)\s+(?:one|seul)\s+(?:case|cas)"
    ],
    "false_dichotomy": [
        r"soit\s+.+?\s+soit|either\s+.+?\s+or",
        r"(?:il\s+n[''']y\s+a\s+)?que\s+deux\s+(?:options|choix)",
        r"you[''']re\s+(?:either|with\s+us\s+or)"
    ],
    "appeal_to_authority": [
        r"(?:les?\s+)?experts?\s+(?:disent|affirment|say)",
        r"(?:selon|according\s+to)\s+(?:les?\s+)?(?:scientifiques?|scientists?)",
        r"(?:Nobel|Harvard|MIT|Stanford)\s+"
    ],
    "loaded_language": [
        r"(?:r[ée]gime|dictature|tyrannie|genocide|holocaust)",
        r"(?:moutons?|sheep|slaves?|esclaves?)",
        r"(?:lavage\s+de\s+cerveau|brainwash)"
    ],
    "ad_hominem": [
        r"(?:idiot|stupide|moron|fou|crazy)",
        r"(?:ils?|they)\s+(?:sont|are)\s+(?:corrompus?|corrupt)",
        r"(?:pay[ée]s?\s+par|paid\s+by)"
    ],
    "strawman": [
        r"(?:ils?|they)\s+(?:pr[ée]tendent|claim)\s+que",
        r"(?:selon\s+eux|according\s+to\s+them)"
    ]
}

# Mots-clés d'intention de publication
INTENT_KEYWORDS = {
    "educational": ["apprendre", "learn", "comprendre", "understand", "expliquer", "explain",
                   "tutoriel", "tutorial", "cours", "course", "formation", "training"],
    "entertainment": ["fun", "drôle", "funny", "amusant", "challenge", "défi", "réaction",
                     "reaction", "gaming", "jeu", "vlog", "prank"],
    "commercial": ["acheter", "buy", "vente", "sale", "offre", "offer", "promo", "discount",
                  "lien", "link", "code", "abonnement", "subscription"],
    "persuasion": ["croire", "believe", "vérité", "truth", "prouver", "prove", "révéler",
                  "reveal", "devoir", "must", "important", "crucial", "urgent"]
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 RÉCUPÉRATION DES MÉTADONNÉES
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_video_metadata(video_id: str) -> Dict[str, Any]:
    """
    Récupère les métadonnées complètes d'une vidéo YouTube.
    
    Utilise yt-dlp pour une extraction sans API key.
    """
    import subprocess
    import json
    
    try:
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            f"https://www.youtube.com/watch?v={video_id}"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return {
                "video_id": video_id,
                "title": data.get("title", ""),
                "channel": data.get("uploader", ""),
                "channel_id": data.get("uploader_id", ""),
                "description": data.get("description", ""),
                "duration": data.get("duration", 0),
                "view_count": data.get("view_count", 0),
                "like_count": data.get("like_count", 0),
                "comment_count": data.get("comment_count", 0),
                "published_at": data.get("upload_date"),
                "tags": data.get("tags", []),
                "categories": data.get("categories", []),
                "chapters": data.get("chapters", []),
                "thumbnail_url": data.get("thumbnail", "")
            }
    except Exception as e:
        print(f"❌ [METADATA] Error fetching metadata: {e}", flush=True)
    
    return {"video_id": video_id}


# ═══════════════════════════════════════════════════════════════════════════════
# 💰 DÉTECTION DE SPONSORSHIP
# ═══════════════════════════════════════════════════════════════════════════════

def detect_sponsorship(
    title: str,
    description: str,
    transcript: str = ""
) -> SponsorshipInfo:
    """
    Détecte les sponsorships dans une vidéo.
    
    Analyse le titre, la description et optionnellement le transcript.
    """
    full_text = f"{title}\n{description}\n{transcript}".lower()
    
    detected_type = SponsorshipType.NONE
    brands_found = []
    evidence = []
    disclosed = False
    confidence = 0.0
    
    # Chercher les marques connues
    for brand in KNOWN_BRANDS:
        if brand.lower() in full_text:
            brands_found.append(brand)
    
    # Vérifier les patterns de sponsorship déclaré
    for pattern in SPONSORSHIP_PATTERNS["disclosed"]:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            detected_type = SponsorshipType.DISCLOSED
            disclosed = True
            evidence.append(match.group(0))
            confidence = max(confidence, 0.9)
    
    # Vérifier les liens affiliés
    if detected_type == SponsorshipType.NONE:
        for pattern in SPONSORSHIP_PATTERNS["affiliate"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                detected_type = SponsorshipType.AFFILIATE
                evidence.append(match.group(0))
                confidence = max(confidence, 0.7)
    
    # Vérifier les placements de produits
    if detected_type == SponsorshipType.NONE and brands_found:
        for pattern in SPONSORSHIP_PATTERNS["product_placement"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                detected_type = SponsorshipType.PRODUCT_PLACEMENT
                evidence.append(match.group(0))
                confidence = max(confidence, 0.5)
    
    # Si des marques sont trouvées mais pas de disclosure explicite
    if brands_found and detected_type == SponsorshipType.NONE:
        detected_type = SponsorshipType.SUSPECTED
        confidence = 0.4
    
    return SponsorshipInfo(
        type=detected_type,
        brands=brands_found[:10],
        disclosed=disclosed,
        confidence=confidence,
        evidence=evidence[:5]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ⚠️ DÉTECTION DE RISQUES DE PROPAGANDE
# ═══════════════════════════════════════════════════════════════════════════════

def detect_propaganda_risk(
    title: str,
    description: str,
    transcript: str = "",
    channel: str = ""
) -> PropagandaAnalysis:
    """
    Analyse les risques de propagande et manipulation.
    
    Détecte les techniques rhétoriques manipulatrices.
    """
    full_text = f"{title}\n{description}\n{transcript}".lower()
    
    detected_techniques = []
    problematic_segments = []
    
    # Analyse pour chaque technique
    technique_flags = {
        "emotional_manipulation": False,
        "cherry_picking": False,
        "false_dichotomy": False,
        "appeal_to_authority": False,
        "loaded_language": False,
        "ad_hominem": False,
        "strawman": False
    }
    
    for technique, patterns in PROPAGANDA_TECHNIQUES.items():
        for pattern in patterns:
            matches = re.finditer(pattern, full_text, re.IGNORECASE)
            for match in matches:
                technique_flags[technique] = True
                detected_techniques.append(technique.replace("_", " ").title())
                
                # Extraire le contexte
                start = max(0, match.start() - 50)
                end = min(len(full_text), match.end() + 50)
                context = full_text[start:end]
                
                problematic_segments.append({
                    "technique": technique,
                    "match": match.group(0),
                    "context": f"...{context}..."
                })
    
    # Calculer le score de risque
    technique_count = sum(1 for v in technique_flags.values() if v)
    
    if technique_count == 0:
        risk_level = PropagandaRisk.NONE
        confidence = 0.9
    elif technique_count == 1:
        risk_level = PropagandaRisk.LOW
        confidence = 0.6
    elif technique_count <= 3:
        risk_level = PropagandaRisk.MEDIUM
        confidence = 0.7
    elif technique_count <= 5:
        risk_level = PropagandaRisk.HIGH
        confidence = 0.8
    else:
        risk_level = PropagandaRisk.CRITICAL
        confidence = 0.85
    
    # Générer une recommandation
    recommendations = {
        PropagandaRisk.NONE: "Aucun indicateur de manipulation détecté.",
        PropagandaRisk.LOW: "Quelques éléments rhétoriques à noter, vérifier les sources.",
        PropagandaRisk.MEDIUM: "Plusieurs techniques persuasives détectées, croiser avec d'autres sources.",
        PropagandaRisk.HIGH: "Contenu potentiellement manipulateur, haute vigilance recommandée.",
        PropagandaRisk.CRITICAL: "Multiples techniques de manipulation, traiter avec extrême prudence."
    }
    
    return PropagandaAnalysis(
        risk_level=risk_level,
        confidence=confidence,
        emotional_manipulation=technique_flags["emotional_manipulation"],
        cherry_picking=technique_flags["cherry_picking"],
        false_dichotomy=technique_flags["false_dichotomy"],
        appeal_to_authority=technique_flags["appeal_to_authority"],
        loaded_language=technique_flags["loaded_language"],
        ad_hominem=technique_flags["ad_hominem"],
        strawman=technique_flags["strawman"],
        detected_techniques=list(set(detected_techniques))[:10],
        problematic_segments=problematic_segments[:10],
        recommendation=recommendations[risk_level]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 👤 EXTRACTION DES PERSONNALITÉS PUBLIQUES
# ═══════════════════════════════════════════════════════════════════════════════

async def extract_public_figures(
    title: str,
    description: str,
    transcript: str = "",
    lang: str = "fr",
    use_ai: bool = True
) -> List[PublicFigure]:
    """
    Extrait les personnalités publiques mentionnées.
    
    Utilise l'IA pour identifier et catégoriser les personnes.
    """
    figures = []
    
    if not use_ai:
        # Extraction basique par patterns
        # Chercher les noms propres (deux mots commençant par majuscule)
        name_pattern = r'\b([A-Z][a-zéèêëàâäôöûüç]+(?:\s+[A-Z][a-zéèêëàâäôöûüç]+)+)\b'
        
        full_text = f"{title} {description} {transcript}"
        names = re.findall(name_pattern, full_text)
        
        # Compter les occurrences
        name_counts = {}
        for name in names:
            if len(name) > 5:  # Ignorer les noms très courts
                name_counts[name] = name_counts.get(name, 0) + 1
        
        # Créer les objets PublicFigure
        for name, count in sorted(name_counts.items(), key=lambda x: -x[1])[:10]:
            figures.append(PublicFigure(
                name=name,
                mentions_count=count
            ))
        
        return figures
    
    # Extraction avec IA
    api_key = get_mistral_key()
    if not api_key:
        return figures
    
    # Préparer le texte (limité)
    text_sample = f"Titre: {title}\n\nDescription: {description[:500]}\n\nTranscript: {transcript[:2000]}"
    
    prompt = f"""Analyse ce contenu et identifie les personnalités publiques mentionnées.

CONTENU:
{text_sample}

Pour chaque personne, indique:
- Son nom complet
- Son rôle/profession
- L'organisation associée (si mentionnée)
- Le contexte de la mention

Réponds en JSON:
{{
    "figures": [
        {{"name": "Nom Complet", "role": "Profession", "organization": "Org", "context": "Contexte bref"}}
    ]
}}

Réponds UNIQUEMENT avec le JSON."""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 800
                },
                timeout=20.0
            )
            response.raise_for_status()
            
            content = response.json()["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r"```json?\n?", "", content)
                content = content.replace("```", "")
            
            data = json.loads(content)
            
            for fig in data.get("figures", [])[:15]:
                figures.append(PublicFigure(
                    name=fig.get("name", ""),
                    role=fig.get("role"),
                    organization=fig.get("organization"),
                    context=fig.get("context")
                ))
                
    except Exception as e:
        print(f"⚠️ [FIGURES] AI extraction failed: {e}", flush=True)
    
    return figures


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ANALYSE DE L'INTENTION DE PUBLICATION
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_publication_intent(
    title: str,
    description: str,
    transcript: str = "",
    tags: List[str] = None,
    category: str = ""
) -> PublicationIntent:
    """
    Analyse l'intention de publication de la vidéo.
    
    Détermine si le contenu vise à éduquer, divertir, vendre ou convaincre.
    """
    full_text = f"{title} {description} {transcript}".lower()
    tags_text = " ".join(tags or []).lower()
    
    # Calculer les scores
    scores = {
        "educational": 0.0,
        "entertainment": 0.0,
        "commercial": 0.0,
        "persuasion": 0.0
    }
    
    for intent, keywords in INTENT_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in full_text or kw in tags_text)
        scores[intent] = min(1.0, matches / len(keywords) * 2)
    
    # Ajuster selon la catégorie
    category_boosts = {
        "tutorial": {"educational": 0.3},
        "science": {"educational": 0.3},
        "entertainment": {"entertainment": 0.3},
        "news": {"persuasion": 0.1, "educational": 0.1},
        "review": {"commercial": 0.2}
    }
    
    if category in category_boosts:
        for intent, boost in category_boosts[category].items():
            scores[intent] = min(1.0, scores[intent] + boost)
    
    # Détecter les call-to-action
    cta_patterns = [
        r"(?:abonne[z-]?(?:toi|vous)|subscribe)",
        r"(?:like|aime[z]?)\s+(?:la|cette|this)\s+vid[ée]o",
        r"(?:partage[z]?|share)",
        r"(?:commente[z]?|comment\s+below)",
        r"(?:active[z]?\s+la\s+cloche|hit\s+the\s+bell)",
        r"(?:lien|link)\s+(?:dans|in)\s+(?:la\s+)?description",
        r"(?:clique[z]?|click)\s+(?:ici|here)"
    ]
    
    call_to_actions = []
    for pattern in cta_patterns:
        if re.search(pattern, full_text, re.IGNORECASE):
            call_to_actions.append(pattern.replace(r"(?:", "").replace(")", "").split("|")[0])
    
    # Déterminer l'intention principale
    primary_intent = max(scores, key=scores.get)
    
    # Intentions secondaires (score > 0.3)
    secondary_intents = [k for k, v in scores.items() if v > 0.3 and k != primary_intent]
    
    # Mapper les noms
    intent_names = {
        "educational": "éduquer",
        "entertainment": "divertir",
        "commercial": "vendre",
        "persuasion": "convaincre"
    }
    
    # Détecter la monétisation
    monetization_indicators = [
        r"#(?:pub|ad|sponsored)",
        r"lien(?:s)?\s+affili",
        r"code\s+promo",
        r"super\s+(?:chat|sticker)",
        r"patreon|tipeee|utip"
    ]
    monetization = any(re.search(p, full_text, re.IGNORECASE) for p in monetization_indicators)
    
    # Confidence basée sur la distinction des scores
    max_score = max(scores.values())
    second_max = sorted(scores.values())[-2]
    confidence = max_score - second_max + 0.3
    confidence = min(1.0, max(0.3, confidence))
    
    return PublicationIntent(
        primary_intent=intent_names.get(primary_intent, primary_intent),
        secondary_intents=[intent_names.get(i, i) for i in secondary_intents],
        educational_score=scores["educational"],
        entertainment_score=scores["entertainment"],
        commercial_score=scores["commercial"],
        persuasion_score=scores["persuasion"],
        call_to_actions=list(set(call_to_actions))[:5],
        monetization_detected=monetization,
        confidence=confidence
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 ANALYSE COMPLÈTE DES MÉTADONNÉES
# ═══════════════════════════════════════════════════════════════════════════════

async def get_enriched_metadata(
    video_id: str,
    title: str = "",
    description: str = "",
    transcript: str = "",
    channel: str = "",
    tags: List[str] = None,
    category: str = "",
    analyze_propaganda: bool = False,
    analyze_intent: bool = False,
    extract_figures: bool = True,
    lang: str = "fr"
) -> VideoMetadataEnriched:
    """
    Génère des métadonnées enrichies complètes pour une vidéo.
    
    Args:
        video_id: ID de la vidéo YouTube
        title: Titre de la vidéo
        description: Description de la vidéo
        transcript: Transcription (optionnelle)
        channel: Nom de la chaîne
        tags: Tags de la vidéo
        category: Catégorie DeepSight
        analyze_propaganda: Activer l'analyse de propagande
        analyze_intent: Activer l'analyse d'intention
        extract_figures: Extraire les personnalités
        lang: Langue
    
    Returns:
        VideoMetadataEnriched avec toutes les analyses
    """
    print(f"📊 [METADATA] Enriching metadata for {video_id}...", flush=True)
    
    # Récupérer les métadonnées de base si nécessaire
    if not title:
        base_metadata = await fetch_video_metadata(video_id)
        title = base_metadata.get("title", "")
        description = base_metadata.get("description", "")
        channel = base_metadata.get("channel", "")
        tags = base_metadata.get("tags", [])
    
    # Détection de sponsorship
    sponsorship = detect_sponsorship(title, description, transcript)
    
    # Analyse de propagande (optionnelle)
    propaganda = None
    if analyze_propaganda:
        propaganda = detect_propaganda_risk(title, description, transcript, channel)
    
    # Extraction des personnalités (optionnelle)
    figures = []
    if extract_figures:
        figures = await extract_public_figures(title, description, transcript, lang)
    
    # Analyse d'intention (optionnelle)
    intent = None
    if analyze_intent:
        intent = analyze_publication_intent(title, description, transcript, tags, category)
    
    # Extraire les liens externes
    url_pattern = r'https?://(?:www\.)?([^\s<>"{}|\\^\[\]`]+)'
    external_links = re.findall(url_pattern, description)[:20]
    
    # Extraire les sources mentionnées
    source_patterns = [
        r"source[s]?\s*:\s*([^\n]+)",
        r"r[ée]f[ée]rence[s]?\s*:\s*([^\n]+)",
        r"(?:selon|d[''']apr[èe]s)\s+([^,\.]+)"
    ]
    sources = []
    for pattern in source_patterns:
        matches = re.findall(pattern, description, re.IGNORECASE)
        sources.extend(matches)
    
    # Construire l'objet enrichi
    enriched = VideoMetadataEnriched(
        video_id=video_id,
        title=title,
        channel=channel,
        public_figures=figures,
        sponsorship=sponsorship,
        propaganda_analysis=propaganda,
        publication_intent=intent,
        detected_topics=tags[:20] if tags else [],
        deepsight_category=category,
        external_links=external_links,
        sources_mentioned=list(set(sources))[:10]
    )
    
    print(f"✅ [METADATA] Enrichment complete: "
          f"sponsorship={sponsorship.type.value}, "
          f"figures={len(figures)}, "
          f"propaganda={'analyzed' if propaganda else 'skipped'}", flush=True)
    
    return enriched
