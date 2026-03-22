"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🌐 WEB ENRICHMENT SERVICE v3.0 — Enrichissement Perplexity PRÉ-ANALYSE            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  v3.0: CHANGEMENT MAJEUR                                                           ║
║  - Enrichissement web AVANT l'analyse Mistral (pas après)                          ║
║  - Détection intelligente pour Chat IA (infos post-cutoff 2024)                    ║
║  - Uniquement pour plans Pro et Expert                                             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
import json
import re
from typing import Optional, Dict, Any, List, Tuple
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

from core.config import get_perplexity_key, PLAN_LIMITS


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION D'ENRICHISSEMENT PAR PLAN
# ═══════════════════════════════════════════════════════════════════════════════

class EnrichmentLevel(Enum):
    """Niveaux d'enrichissement Perplexity"""
    NONE = "none"      # Free/Starter: Pas d'enrichissement
    FULL = "full"      # Pro: Enrichissement standard
    DEEP = "deep"      # Expert: Analyse exhaustive
    DEEP_RESEARCH = "deep_research"  # Pro+: Brave massif + Perplexity sonar-pro croisé


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 MODÈLES PERPLEXITY 2024/2025
# ═══════════════════════════════════════════════════════════════════════════════

ENRICHMENT_CONFIG = {
    EnrichmentLevel.NONE: {
        "enabled": False,
        "max_queries": 0,
        "max_sources": 0,
        "features": []
    },
    EnrichmentLevel.FULL: {
        "enabled": True,
        "max_queries": 2,
        "max_sources": 5,
        "max_tokens": 1500,
        "features": ["context", "recent_news", "fact_check"],
        "model": "sonar"
    },
    EnrichmentLevel.DEEP: {
        "enabled": True,
        "max_queries": 3,
        "max_sources": 8,
        "max_tokens": 2500,
        "features": ["context", "recent_news", "fact_check", "expert_opinions", "counter_arguments"],
        "model": "sonar-pro"
    },
    EnrichmentLevel.DEEP_RESEARCH: {
        "enabled": True,
        "max_queries": 1,
        "max_sources": 10,
        "max_tokens": 3000,
        "model": "sonar-pro",
        "features": ["context", "recent_news", "fact_check", "expert_opinions", "counter_arguments", "source_cross_check"],
    }
}


def get_enrichment_level(plan: str) -> EnrichmentLevel:
    """Détermine le niveau d'enrichissement selon le plan"""
    plan_mapping = {
        "free": EnrichmentLevel.NONE,
        "starter": EnrichmentLevel.NONE,  # Starter n'a pas d'enrichissement
        "pro": EnrichmentLevel.FULL,
        "expert": EnrichmentLevel.DEEP,
        "unlimited": EnrichmentLevel.DEEP
    }
    return plan_mapping.get(plan, EnrichmentLevel.NONE)


def _extract_site_name(domain: str) -> str:
    """
    Extrait un nom de site lisible à partir d'un domaine.
    Exemples:
        - "www.lemonde.fr" → "Le Monde"
        - "en.wikipedia.org" → "Wikipedia"
        - "nytimes.com" → "NY Times"
    """
    # Nettoyer le domaine
    domain = domain.lower().strip()
    
    # Supprimer www. et sous-domaines communs
    if domain.startswith("www."):
        domain = domain[4:]
    if domain.startswith("en.") or domain.startswith("fr.") or domain.startswith("de."):
        domain = domain[3:]
    if domain.startswith("m."):
        domain = domain[2:]
    
    # Mapping des domaines connus vers des noms lisibles
    SITE_NAMES = {
        # Médias français
        "lemonde.fr": "Le Monde",
        "lefigaro.fr": "Le Figaro",
        "liberation.fr": "Libération",
        "france24.com": "France 24",
        "francetvinfo.fr": "France Info",
        "bfmtv.com": "BFM TV",
        "leparisien.fr": "Le Parisien",
        "20minutes.fr": "20 Minutes",
        "lexpress.fr": "L'Express",
        "lepoint.fr": "Le Point",
        "nouvelobs.com": "L'Obs",
        "mediapart.fr": "Mediapart",
        "huffingtonpost.fr": "HuffPost FR",
        "rfi.fr": "RFI",
        "ouest-france.fr": "Ouest-France",
        "lesechos.fr": "Les Échos",
        "latribune.fr": "La Tribune",
        "courrierinternational.com": "Courrier International",
        
        # Médias internationaux
        "nytimes.com": "NY Times",
        "theguardian.com": "The Guardian",
        "bbc.com": "BBC",
        "bbc.co.uk": "BBC",
        "cnn.com": "CNN",
        "reuters.com": "Reuters",
        "apnews.com": "AP News",
        "washingtonpost.com": "Washington Post",
        "wsj.com": "Wall Street Journal",
        "economist.com": "The Economist",
        "ft.com": "Financial Times",
        "bloomberg.com": "Bloomberg",
        "forbes.com": "Forbes",
        "time.com": "TIME",
        "aljazeera.com": "Al Jazeera",
        "dw.com": "Deutsche Welle",
        "theatlantic.com": "The Atlantic",
        "newyorker.com": "The New Yorker",
        "politico.com": "Politico",
        "vox.com": "Vox",
        "vice.com": "Vice",
        "wired.com": "Wired",
        "arstechnica.com": "Ars Technica",
        "techcrunch.com": "TechCrunch",
        "theverge.com": "The Verge",
        "engadget.com": "Engadget",
        "cnet.com": "CNET",
        
        # Références & Encyclopédies
        "wikipedia.org": "Wikipedia",
        "britannica.com": "Britannica",
        "larousse.fr": "Larousse",
        
        # Sites académiques & scientifiques
        "nature.com": "Nature",
        "science.org": "Science",
        "sciencedirect.com": "ScienceDirect",
        "pubmed.ncbi.nlm.nih.gov": "PubMed",
        "arxiv.org": "arXiv",
        "scholar.google.com": "Google Scholar",
        "researchgate.net": "ResearchGate",
        "jstor.org": "JSTOR",
        "springer.com": "Springer",
        "wiley.com": "Wiley",
        "ncbi.nlm.nih.gov": "NCBI",
        "who.int": "OMS",
        "cdc.gov": "CDC",
        
        # Sites gouvernementaux
        "gouv.fr": "Gouv.fr",
        "service-public.fr": "Service Public",
        "insee.fr": "INSEE",
        "legifrance.gouv.fr": "Légifrance",
        "senat.fr": "Sénat",
        "assemblee-nationale.fr": "Assemblée Nationale",
        "elysee.fr": "Élysée",
        "europa.eu": "Europa",
        "un.org": "ONU",
        
        # Plateformes
        "youtube.com": "YouTube",
        "twitter.com": "Twitter/X",
        "x.com": "X",
        "reddit.com": "Reddit",
        "linkedin.com": "LinkedIn",
        "medium.com": "Medium",
        "quora.com": "Quora",
        "stackoverflow.com": "Stack Overflow",
        "github.com": "GitHub",
        
        # Fact-checking
        "snopes.com": "Snopes",
        "factcheck.org": "FactCheck",
        "politifact.com": "PolitiFact",
        "fullfact.org": "Full Fact",
        "lesdecodeurs.blog.lemonde.fr": "Les Décodeurs",
        
        # Autres
        "imdb.com": "IMDb",
        "rottentomatoes.com": "Rotten Tomatoes",
        "goodreads.com": "Goodreads",
        "amazon.com": "Amazon",
        "amazon.fr": "Amazon FR",
    }
    
    # Vérifier le mapping exact
    if domain in SITE_NAMES:
        return SITE_NAMES[domain]
    
    # Vérifier les sous-domaines (ex: fr.wikipedia.org → wikipedia.org)
    for known_domain, name in SITE_NAMES.items():
        if domain.endswith("." + known_domain) or domain == known_domain:
            return name
    
    # Fallback: Extraire et formater le nom du domaine
    # "example-site.com" → "Example Site"
    base_domain = domain.split(".")[0] if "." in domain else domain
    
    # Supprimer les tirets et capitaliser
    words = base_domain.replace("-", " ").replace("_", " ").split()
    formatted = " ".join(word.capitalize() for word in words)
    
    return formatted if formatted else domain


def get_enrichment_config(plan: str) -> Dict[str, Any]:
    """Retourne la configuration d'enrichissement pour un plan"""
    level = get_enrichment_level(plan)
    return ENRICHMENT_CONFIG[level]


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 DÉTECTION INTELLIGENTE POUR CHAT IA
# ═══════════════════════════════════════════════════════════════════════════════

# Cutoff Mistral: Les modèles Mistral ont été entraînés jusqu'à fin 2024
MISTRAL_CUTOFF_YEAR = 2024

def needs_web_search_for_chat(question: str, video_title: str = "", video_date: str = "") -> Tuple[bool, str]:
    """
    🧠 Détecte si une question de chat nécessite une recherche web.
    
    Critères de déclenchement:
    1. Questions sur des événements récents/actuels
    2. Questions demandant des infos post-cutoff Mistral (2024)
    3. Questions de vérification de faits
    4. Questions sur des données qui changent (prix, stats, positions)
    
    Returns:
        Tuple[should_search: bool, reason: str]
    """
    question_lower = question.lower()
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📅 MOTS-CLÉS TEMPORELS (indiquent besoin d'infos récentes)
    # ═══════════════════════════════════════════════════════════════════════════
    TEMPORAL_KEYWORDS = [
        # Français
        "aujourd'hui", "maintenant", "actuellement", "en ce moment",
        "récemment", "dernièrement", "cette année", "ce mois", "cette semaine",
        "en 2025", "en 2026", "après 2024", "depuis 2024", "depuis 2025",
        "dernière mise à jour", "dernières nouvelles", "actualité",
        "qu'est-ce qui s'est passé", "que s'est-il passé",
        # Anglais
        "today", "now", "currently", "at the moment", 
        "recently", "lately", "this year", "this month", "this week",
        "in 2025", "in 2026", "after 2024", "since 2024", "since 2025",
        "latest update", "latest news", "current",
        "what happened", "what's happening"
    ]
    
    for keyword in TEMPORAL_KEYWORDS:
        if keyword in question_lower:
            return True, f"temporal_keyword:{keyword}"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🔍 QUESTIONS DE VÉRIFICATION
    # ═══════════════════════════════════════════════════════════════════════════
    VERIFICATION_PATTERNS = [
        # Français
        "est-ce vrai", "est-ce que c'est vrai", "c'est vrai",
        "est-ce exact", "est-ce correct", "vérifier", "confirmer",
        "est-ce toujours", "est-ce encore", "existe encore",
        "est-il toujours", "est-elle toujours", "sont-ils toujours",
        # Anglais
        "is it true", "is this true", "is that true",
        "is it correct", "verify", "confirm", "fact check",
        "is it still", "is he still", "is she still", "are they still",
        "does it still", "do they still"
    ]
    
    for pattern in VERIFICATION_PATTERNS:
        if pattern in question_lower:
            return True, f"verification:{pattern}"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📊 DONNÉES DYNAMIQUES (changent fréquemment)
    # ═══════════════════════════════════════════════════════════════════════════
    DYNAMIC_DATA_KEYWORDS = [
        # Français
        "prix actuel", "cours actuel", "valeur actuelle",
        "combien coûte", "quel est le prix",
        "derniers chiffres", "dernières statistiques", "dernières données",
        "qui est le président", "qui est le ceo", "qui dirige",
        "qui a gagné", "résultat", "score",
        "où en est", "quel est le statut", "état actuel",
        # Anglais
        "current price", "current value", "how much does",
        "latest figures", "latest statistics", "latest data",
        "who is the president", "who is the ceo", "who leads",
        "who won", "result", "score",
        "status of", "current status", "current state"
    ]
    
    for keyword in DYNAMIC_DATA_KEYWORDS:
        if keyword in question_lower:
            return True, f"dynamic_data:{keyword}"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📰 SUJETS À ÉVOLUTION RAPIDE
    # ═══════════════════════════════════════════════════════════════════════════
    FAST_CHANGING_TOPICS = [
        "ukraine", "gaza", "israel", "palestine", "guerre", "war",
        "crypto", "bitcoin", "ethereum", "nft",
        "ia", "ai", "chatgpt", "openai", "anthropic", "claude",
        "tesla", "spacex", "elon musk",
        "élection", "election", "vote",
        "bourse", "stock", "nasdaq", "cac40",
        "covid", "pandemic", "virus",
        "climate", "climat", "cop28", "cop29"
    ]
    
    for topic in FAST_CHANGING_TOPICS:
        if topic in question_lower:
            # Vérifier si c'est une question factuelle, pas juste une mention
            factual_indicators = ["?", "combien", "quand", "où", "qui", "quel", 
                                  "how", "when", "where", "who", "what", "which"]
            if any(ind in question_lower for ind in factual_indicators):
                return True, f"fast_changing_topic:{topic}"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎯 QUESTIONS EXPLICITES DE MISE À JOUR
    # ═══════════════════════════════════════════════════════════════════════════
    UPDATE_PATTERNS = [
        "mise à jour", "update", "nouveauté", "new",
        "a changé", "has changed", "ont changé", "have changed",
        "évolué", "evolved", "progression", "progress"
    ]
    
    for pattern in UPDATE_PATTERNS:
        if pattern in question_lower:
            return True, f"update_request:{pattern}"
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📅 VIDÉO ANCIENNE + SUJET ÉVOLUTIF → recherche automatique
    # ═══════════════════════════════════════════════════════════════════════════
    if video_date:
        from videos.analysis import _format_video_age
        _, _, age_days = _format_video_age(video_date)

        if age_days > 0:
            # Catégories à évolution rapide
            FAST_EVOLVING_KEYWORDS = [
                "tech", "science", "politi", "financ", "santé", "health",
                "économi", "econom", "crypto", "ia", "ai", "climat", "climate",
                "médecin", "medic", "cyber", "startup", "législat", "regulat"
            ]
            title_lower = video_title.lower()
            is_fast_evolving = any(kw in title_lower or kw in question_lower for kw in FAST_EVOLVING_KEYWORDS)

            if age_days > 730:  # > 2 ans
                return True, f"old_video:{age_days}d_always_recommend"
            elif age_days > 180 and is_fast_evolving:  # > 6 mois + sujet évolutif
                return True, f"old_video:{age_days}d_fast_evolving_topic"

    # Par défaut: pas besoin de recherche web
    return False, "no_trigger_detected"


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 PROMPTS D'ENRICHISSEMENT PRÉ-ANALYSE
# ═══════════════════════════════════════════════════════════════════════════════

def build_pre_analysis_prompt(
    level: EnrichmentLevel,
    video_title: str,
    video_channel: str,
    category: str,
    transcript_excerpt: str,
    lang: str = "fr",
    upload_date: str = ""
) -> str:
    """
    🆕 v3.0: Construit le prompt pour enrichir AVANT l'analyse Mistral.
    Le but est de fournir du contexte actuel à Mistral.
    """
    
    # Construire le contexte temporel pour Perplexity
    from videos.analysis import _format_video_age
    temporal_hint_fr = ""
    temporal_hint_en = ""
    if upload_date:
        readable_date, human_age, age_days = _format_video_age(upload_date)
        if readable_date:
            temporal_hint_fr = f"\n📅 Vidéo publiée le {readable_date} ({human_age}). Vérifie si les informations ont évolué depuis."
            temporal_hint_en = f"\n📅 Video published on {readable_date} ({human_age}). Check if information has changed since then."

    if level == EnrichmentLevel.FULL:
        if lang == "fr":
            return f"""Tu es un assistant de recherche. Une vidéo YouTube va être analysée et tu dois fournir du CONTEXTE ACTUEL pour enrichir l'analyse.

📺 Vidéo: {video_title}
📺 Chaîne: {video_channel}
📁 Catégorie: {category}{temporal_hint_fr}

📝 Extrait du contenu:
{transcript_excerpt[:2000]}

🎯 MISSION: Recherche les informations web ACTUELLES et RÉCENTES liées à ce sujet.

📋 FORMAT DE RÉPONSE (pour enrichir une analyse IA):

## 📰 Contexte Actuel (2024-2025)
[Développements récents sur ce sujet, actualités des 6 derniers mois]

## 🔍 Points à Vérifier
[2-3 affirmations du contenu qui méritent vérification avec le statut actuel]

## 📊 Données Actualisées
[Chiffres, statistiques ou informations qui ont pu changer depuis la vidéo]

## 🔗 Sources Fiables
[3-5 sources de référence sur ce sujet]

Réponds en français, sois factuel et cite tes sources. Max 400 mots."""

        else:
            return f"""You are a research assistant. A YouTube video will be analyzed and you must provide CURRENT CONTEXT to enrich the analysis.

📺 Video: {video_title}
📺 Channel: {video_channel}
📁 Category: {category}{temporal_hint_en}

📝 Content excerpt:
{transcript_excerpt[:2000]}

🎯 MISSION: Search for CURRENT and RECENT web information related to this topic.

📋 RESPONSE FORMAT (to enrich an AI analysis):

## 📰 Current Context (2024-2025)
[Recent developments on this topic, news from the last 6 months]

## 🔍 Points to Verify
[2-3 claims from the content that deserve verification with current status]

## 📊 Updated Data
[Numbers, statistics or information that may have changed since the video]

## 🔗 Reliable Sources
[3-5 reference sources on this topic]

Be factual and cite your sources. Max 400 words."""

    elif level == EnrichmentLevel.DEEP:
        if lang == "fr":
            return f"""Tu es un expert en recherche et fact-checking. Une vidéo YouTube va être analysée en profondeur et tu dois fournir un CONTEXTE EXHAUSTIF.

📺 Vidéo: {video_title}
📺 Chaîne: {video_channel}
📁 Catégorie: {category}{temporal_hint_fr}

📝 Extrait du contenu:
{transcript_excerpt[:3000]}

🎯 MISSION: Recherche approfondie pour contextualiser et fact-checker ce contenu.

📋 FORMAT DE RÉPONSE DÉTAILLÉ:

## 📰 Contexte Actuel Complet
[Tous les développements récents pertinents, timeline des événements]

## 🔬 Fact-Checking Préliminaire
Pour chaque affirmation importante détectée:
- **[Affirmation]** → Statut actuel et sources

## 📊 Données et Statistiques Actuelles
[Tous les chiffres actualisés pertinents avec sources]

## ⚖️ Points de Vue Alternatifs
[Perspectives différentes, critiques, contre-arguments existants]

## 👥 Experts et Références
[Qui sont les experts reconnus sur ce sujet, que disent-ils]

## 🔗 Sources de Référence
[5-8 sources fiables avec brève description]

## ⚠️ Alertes et Précautions
[Informations sensibles, biais potentiels, points de vigilance]

Réponds en français, sois exhaustif mais structuré. Max 700 mots."""

        else:
            return f"""You are an expert in research and fact-checking. A YouTube video will be analyzed in depth and you must provide COMPREHENSIVE CONTEXT.

📺 Video: {video_title}
📺 Channel: {video_channel}
📁 Category: {category}{temporal_hint_en}

📝 Content excerpt:
{transcript_excerpt[:3000]}

🎯 MISSION: In-depth research to contextualize and fact-check this content.

📋 DETAILED RESPONSE FORMAT:

## 📰 Complete Current Context
[All relevant recent developments, timeline of events]

## 🔬 Preliminary Fact-Checking
For each important claim detected:
- **[Claim]** → Current status and sources

## 📊 Current Data and Statistics
[All relevant updated figures with sources]

## ⚖️ Alternative Viewpoints
[Different perspectives, criticisms, existing counter-arguments]

## 👥 Experts and References
[Who are the recognized experts on this topic, what do they say]

## 🔗 Reference Sources
[5-8 reliable sources with brief description]

## ⚠️ Alerts and Precautions
[Sensitive information, potential biases, points of vigilance]

Be comprehensive but structured. Max 700 words."""

    return ""


def build_chat_enrichment_prompt(
    question: str,
    video_context: str,
    trigger_reason: str,
    lang: str = "fr"
) -> str:
    """
    🆕 v3.0: Prompt pour enrichir une réponse de chat avec des infos actuelles.
    """
    if lang == "fr":
        return f"""Une question a été posée sur une vidéo YouTube et nécessite des informations web actuelles.

📺 Contexte vidéo: {video_context[:1000]}

❓ Question de l'utilisateur: {question}

🔍 Raison de la recherche: {trigger_reason}

🎯 MISSION: Recherche les informations ACTUELLES (2024-2025) pour répondre à cette question.

📋 FORMAT DE RÉPONSE:

## 📰 Informations Actuelles
[Réponse factuelle basée sur des sources web récentes]

## 🔗 Sources
[2-3 sources avec URLs si disponibles]

## ⚠️ Note
[Précision importante si les infos ont changé depuis la vidéo]

Réponds en français, sois concis et factuel. Max 250 mots."""

    else:
        return f"""A question was asked about a YouTube video and requires current web information.

📺 Video context: {video_context[:1000]}

❓ User question: {question}

🔍 Search reason: {trigger_reason}

🎯 MISSION: Search for CURRENT information (2024-2025) to answer this question.

📋 RESPONSE FORMAT:

## 📰 Current Information
[Factual answer based on recent web sources]

## 🔗 Sources
[2-3 sources with URLs if available]

## ⚠️ Note
[Important clarification if info has changed since the video]

Be concise and factual. Max 250 words."""


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 DATACLASS POUR LES RÉSULTATS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class EnrichmentResult:
    """Résultat d'un enrichissement Perplexity"""
    success: bool
    content: str
    sources: List[Dict[str, str]]
    level: EnrichmentLevel
    tokens_used: int = 0
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 APPEL API PERPLEXITY
# ═══════════════════════════════════════════════════════════════════════════════

async def call_perplexity(
    prompt: str,
    level: EnrichmentLevel
) -> EnrichmentResult:
    """
    Appelle l'API Perplexity avec le bon modèle selon le niveau.
    """
    api_key = get_perplexity_key()
    if not api_key:
        print("❌ [PERPLEXITY] API key not configured", flush=True)
        return EnrichmentResult(
            success=False,
            content="",
            sources=[],
            level=level,
            error="API key not configured"
        )
    
    config = ENRICHMENT_CONFIG.get(level, ENRICHMENT_CONFIG[EnrichmentLevel.FULL])
    model = config.get("model", "sonar")
    max_tokens = config.get("max_tokens", 1500)
    
    print(f"🌐 [PERPLEXITY] Calling API: model={model}, level={level.value}", flush=True)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.2
                },
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                sources = []
                
                # Extraire les citations si disponibles
                citations = data.get("citations", [])
                
                if citations:
                    for i, url in enumerate(citations[:config.get("max_sources", 5)]):
                        if isinstance(url, str):
                            try:
                                # Extraire le nom de domaine proprement
                                domain = url.split("/")[2] if "/" in url else url[:30]
                                # Nettoyer le domaine pour un affichage lisible
                                site_name = _extract_site_name(domain)
                            except (IndexError, AttributeError):
                                domain = "source"
                                site_name = f"Source {i+1}"
                            sources.append({
                                "title": site_name,
                                "url": url,
                                "domain": domain
                            })
                        elif isinstance(url, dict):
                            # Si c'est un dict, utiliser le titre ou extraire du domaine
                            url_str = url.get("url", "")
                            title = url.get("title", "")
                            if not title and url_str:
                                try:
                                    domain = url_str.split("/")[2]
                                    title = _extract_site_name(domain)
                                except (IndexError, AttributeError):
                                    title = f"Source {i+1}"
                            sources.append({
                                "title": title or f"Source {i+1}",
                                "url": url_str,
                                "snippet": url.get("snippet", "")[:200]
                            })
                
                tokens_used = len(prompt.split()) + len(content.split())
                
                print(f"✅ [PERPLEXITY] Success: {len(content)} chars, {len(sources)} sources", flush=True)
                
                return EnrichmentResult(
                    success=True,
                    content=content,
                    sources=sources,
                    level=level,
                    tokens_used=tokens_used
                )
            else:
                error_msg = f"API error: {response.status_code}"
                print(f"❌ [PERPLEXITY] {error_msg}", flush=True)
                
                return EnrichmentResult(
                    success=False,
                    content="",
                    sources=[],
                    level=level,
                    error=error_msg
                )
                
    except httpx.TimeoutException:
        print(f"❌ [PERPLEXITY] Timeout after 60s", flush=True)
        return EnrichmentResult(
            success=False,
            content="",
            sources=[],
            level=level,
            error="Request timeout"
        )
    except Exception as e:
        error_msg = str(e)
        print(f"❌ [PERPLEXITY] Exception: {error_msg}", flush=True)
        return EnrichmentResult(
            success=False,
            content="",
            sources=[],
            level=level,
            error=error_msg
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTIONS D'ENRICHISSEMENT PRINCIPALES v3.0
# ═══════════════════════════════════════════════════════════════════════════════

async def get_pre_analysis_context(
    video_title: str,
    video_channel: str,
    category: str,
    transcript: str,
    plan: str,
    lang: str = "fr",
    upload_date: str = ""
) -> Tuple[Optional[str], List[Dict[str, str]], EnrichmentLevel]:
    """
    🆕 v3.0: Récupère le contexte web AVANT l'analyse Mistral.
    
    Ce contexte sera injecté dans le prompt Mistral pour enrichir l'analyse.
    
    Returns:
        Tuple[web_context, sources, level]
        - web_context: Texte à ajouter au prompt Mistral (ou None si pas d'enrichissement)
        - sources: Liste des sources utilisées
        - level: Niveau d'enrichissement appliqué
    """
    level = get_enrichment_level(plan)
    
    print(f"🌐 [PRE-ANALYSIS] Plan={plan}, Level={level.value}", flush=True)
    
    # Seuls Pro et Expert ont l'enrichissement
    if level == EnrichmentLevel.NONE:
        print(f"⏭️ [PRE-ANALYSIS] Skipped (plan={plan})", flush=True)
        return None, [], level
    
    # Construire le prompt
    prompt = build_pre_analysis_prompt(
        level=level,
        video_title=video_title,
        video_channel=video_channel,
        category=category,
        transcript_excerpt=transcript[:3000],
        lang=lang,
        upload_date=upload_date
    )
    
    if not prompt:
        return None, [], level
    
    # Appeler Perplexity
    result = await call_perplexity(prompt, level)
    
    if not result.success:
        print(f"⚠️ [PRE-ANALYSIS] Failed: {result.error}", flush=True)
        return None, [], level
    
    print(f"✅ [PRE-ANALYSIS] Got {len(result.content)} chars of context", flush=True)
    
    return result.content, result.sources, level


async def enrich_chat_if_needed(
    question: str,
    video_title: str,
    video_context: str,
    plan: str,
    lang: str = "fr",
    video_date: str = ""
) -> Tuple[Optional[str], List[Dict[str, str]], bool]:
    """
    🆕 v3.0: Enrichit une réponse chat SI la question le nécessite.

    Détecte automatiquement si la question nécessite des infos post-cutoff.

    Returns:
        Tuple[enrichment_text, sources, was_enriched]
    """
    level = get_enrichment_level(plan)

    # Seuls Pro et Expert ont l'enrichissement
    if level == EnrichmentLevel.NONE:
        return None, [], False

    # Détecter si la question nécessite une recherche web
    needs_search, reason = needs_web_search_for_chat(question, video_title, video_date=video_date)
    
    if not needs_search:
        print(f"⏭️ [CHAT ENRICHMENT] Not needed: {reason}", flush=True)
        return None, [], False
    
    print(f"🔍 [CHAT ENRICHMENT] Triggered: {reason}", flush=True)
    
    # Construire et exécuter le prompt
    prompt = build_chat_enrichment_prompt(
        question=question,
        video_context=video_context,
        trigger_reason=reason,
        lang=lang
    )
    
    result = await call_perplexity(prompt, level)
    
    if not result.success:
        print(f"⚠️ [CHAT ENRICHMENT] Failed: {result.error}", flush=True)
        return None, [], False
    
    print(f"✅ [CHAT ENRICHMENT] Got {len(result.content)} chars", flush=True)
    
    return result.content, result.sources, True


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

def format_web_context_for_mistral(web_context: str, lang: str = "fr") -> str:
    """
    Formate le contexte web pour l'injecter dans le prompt Mistral.
    """
    if not web_context:
        return ""
    
    if lang == "fr":
        return f"""
═══════════════════════════════════════════════════════════════════════════════
📡 CONTEXTE WEB ACTUEL (Recherche Perplexity - {datetime.now().strftime('%Y-%m-%d')})
═══════════════════════════════════════════════════════════════════════════════

{web_context}

═══════════════════════════════════════════════════════════════════════════════
⚠️ INSTRUCTION: Utilise ce contexte web pour enrichir ton analyse.
   Compare les informations de la vidéo avec les données actuelles ci-dessus.
   Signale les informations qui ont pu évoluer depuis la vidéo.
═══════════════════════════════════════════════════════════════════════════════
"""
    else:
        return f"""
═══════════════════════════════════════════════════════════════════════════════
📡 CURRENT WEB CONTEXT (Perplexity Search - {datetime.now().strftime('%Y-%m-%d')})
═══════════════════════════════════════════════════════════════════════════════

{web_context}

═══════════════════════════════════════════════════════════════════════════════
⚠️ INSTRUCTION: Use this web context to enrich your analysis.
   Compare video information with the current data above.
   Flag any information that may have changed since the video.
═══════════════════════════════════════════════════════════════════════════════
"""


def format_sources_markdown(sources: List[Dict[str, str]], lang: str = "fr") -> str:
    """Formate les sources en markdown"""
    if not sources:
        return ""
    
    header = "📚 Sources" if lang == "fr" else "📚 Sources"
    lines = [f"\n### {header}\n"]
    
    for i, source in enumerate(sources[:5], 1):
        title = source.get("title", "Source")
        url = source.get("url", "")
        if url:
            lines.append(f"{i}. [{title}]({url})")
        else:
            lines.append(f"{i}. {title}")
    
    return "\n".join(lines)



def get_enrichment_badge(level: EnrichmentLevel, lang: str = "fr") -> str:
    """Retourne un badge visuel pour le niveau d'enrichissement"""
    badges = {
        EnrichmentLevel.NONE: "",
        EnrichmentLevel.FULL: "🌐 Enrichi Web" if lang == "fr" else "🌐 Web Enriched",
        EnrichmentLevel.DEEP: "🔬 Analyse Approfondie" if lang == "fr" else "🔬 Deep Analysis",
        EnrichmentLevel.DEEP_RESEARCH: "🔬🦁 Recherche Croisée" if lang == "fr" else "🔬🦁 Cross-Referenced Research",
    }
    return badges.get(level, "")


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 v5.0: ENRICHISSEMENT CHAT AVEC FUSION INTELLIGENTE
# ═══════════════════════════════════════════════════════════════════════════════

async def enrich_chat_response(
    question: str,
    base_response: str,
    video_context: str,
    plan: str,
    lang: str = "fr"
) -> Tuple[str, List[Dict[str, str]], EnrichmentLevel]:
    """
    🆕 v5.0: Enrichit une réponse chat avec Perplexity et FUSIONNE intelligemment.
    
    Différence avec enrich_chat_if_needed:
    - Prend en entrée la réponse de base de Mistral
    - Fusionne la réponse Perplexity avec la réponse originale
    - Retourne une réponse enrichie cohérente
    
    Args:
        question: Question de l'utilisateur
        base_response: Réponse générée par Mistral (basée sur la vidéo)
        video_context: Contexte de la vidéo (titre + résumé)
        plan: Plan de l'utilisateur (détermine le niveau d'enrichissement)
        lang: Langue de réponse
    
    Returns:
        Tuple[enriched_response, sources, level]
    """
    level = get_enrichment_level(plan)
    
    # Pas d'enrichissement pour NONE
    if level == EnrichmentLevel.NONE:
        return base_response, [], level
    
    print(f"🔍 [ENRICH CHAT v5.0] Starting enrichment for plan={plan}, level={level.value}", flush=True)
    
    # Construire le prompt de fact-checking
    if lang == "fr":
        prompt = f"""🎯 MISSION: Vérifier et compléter cette réponse avec des informations ACTUELLES et FIABLES.

📺 CONTEXTE VIDÉO:
{video_context[:1000]}

❓ QUESTION: {question}

📝 RÉPONSE ACTUELLE (basée sur la vidéo):
{base_response[:1500]}

🔍 TES TÂCHES:
1. VÉRIFIER les faits mentionnés (dates, événements, chiffres)
2. CORRIGER si la réponse contient des erreurs (la vidéo peut être une parodie ou obsolète)
3. COMPLÉTER avec les informations actuelles (2024-2025)

📋 FORMAT DE RÉPONSE:
Donne une réponse CORRIGÉE et MISE À JOUR qui:
- Indique clairement ce qui est DANS LA VIDÉO vs ce qui est RÉEL/ACTUEL
- Cite tes sources pour les faits vérifiés
- Est concise (max 300 mots)

Si la réponse originale est correcte, confirme-le. Sinon, corrige avec les faits réels."""
    else:
        prompt = f"""🎯 MISSION: Verify and complete this response with CURRENT and RELIABLE information.

📺 VIDEO CONTEXT:
{video_context[:1000]}

❓ QUESTION: {question}

📝 CURRENT RESPONSE (based on video):
{base_response[:1500]}

🔍 YOUR TASKS:
1. VERIFY facts mentioned (dates, events, figures)
2. CORRECT if the response contains errors (video may be parody or outdated)
3. COMPLETE with current information (2024-2025)

📋 RESPONSE FORMAT:
Give a CORRECTED and UPDATED response that:
- Clearly indicates what's IN THE VIDEO vs what's REAL/CURRENT
- Cites sources for verified facts
- Is concise (max 300 words)

If original response is correct, confirm it. Otherwise, correct with real facts."""
    
    # Appeler Perplexity
    result = await call_perplexity(prompt, level)
    
    if not result.success:
        print(f"⚠️ [ENRICH CHAT v5.0] Perplexity call failed: {result.error}", flush=True)
        return base_response, [], level
    
    print(f"✅ [ENRICH CHAT v5.0] Got enrichment: {len(result.content)} chars, {len(result.sources)} sources", flush=True)
    
    # Formater la réponse enrichie
    enriched_response = result.content
    
    # Ajouter les sources si disponibles
    if result.sources:
        sources_text = format_sources_markdown(result.sources, lang)
        if sources_text:
            enriched_response = f"{enriched_response}\n\n{sources_text}"
    
    return enriched_response, result.sources, level



# ═══════════════════════════════════════════════════════════════════════════════
# 🔬 DEEP RESEARCH: Synthèse croisée Brave + Perplexity sonar-pro
# ═══════════════════════════════════════════════════════════════════════════════

async def get_deep_research_context(
    video_title: str,
    video_channel: str,
    transcript_excerpt: str,
    brave_results_text: str,
    brave_sources: "List[Dict[str, str]]",
    lang: str = "fr"
) -> "Tuple[Optional[str], List[Dict[str, str]]]": 
    api_key = get_perplexity_key()
    if not api_key:
        print("❌ [DEEP_RESEARCH] No Perplexity API key", flush=True)
        return None, brave_sources

    brave_context = brave_results_text[:4000] if brave_results_text else ""
    sources_summary = ""
    if brave_sources:
        sources_summary = chr(10).join(
            f"- {s.get(chr(39) + 'title' + chr(39), 'Source')}: {s.get(chr(39) + 'snippet' + chr(39), '')[:150]}"
            for s in brave_sources[:20]
        )

    if lang == "fr":
        prompt = f"""Tu es un expert en recherche et fact-checking. Tu reçois le transcript d'une vidéo YouTube ET des résultats Brave Search.

📺 Vidéo: {video_title}
📺 Chaîne: {video_channel}

📝 EXTRAIT DU TRANSCRIPT:
{transcript_excerpt[:3000]}

🦁 RÉSULTATS BRAVE SEARCH:
{brave_context}

📚 SOURCES:
{sources_summary}

🎯 MISSION: Analyse croisée. Vérifie les affirmations, identifie contradictions, ajoute contexte manquant, données actualisées, contre-arguments, note fiabilité /10.

📋 FORMAT:
## 🔍 Vérification Croisée
## ✅ Faits Confirmés  
## ⚠️ Points Contestés
## 📊 Données Actualisées
## ⚖️ Perspectives Alternatives
## 📈 Score de Fiabilité: X/10

Factuel, sources citées. Max 800 mots."""
    else:
        prompt = f"""You are a research and fact-checking expert. Cross-reference YouTube video transcript with Brave Search results.

📺 Video: {video_title} | Channel: {video_channel}
📝 TRANSCRIPT: {transcript_excerpt[:3000]}
🦁 BRAVE RESULTS: {brave_context}
📚 SOURCES: {sources_summary}

🎯 Verify claims, find contradictions, add context, update data, counter-arguments, reliability /10. Max 800 words."""

    print(f"🔬 [DEEP_RESEARCH] Calling Perplexity sonar-pro...", flush=True)
    result = await call_perplexity(prompt, EnrichmentLevel.DEEP_RESEARCH)

    if not result.success:
        print(f"⚠️ [DEEP_RESEARCH] Failed: {result.error}", flush=True)
        return None, brave_sources

    all_sources = list(brave_sources) if brave_sources else []
    seen_urls = {s.get("url", "") for s in all_sources}
    for ps in result.sources:
        if ps.get("url", "") not in seen_urls:
            all_sources.append(ps)
            seen_urls.add(ps.get("url", ""))

    context_text = (
        "═══ 🔬🦁 RECHERCHE CROISÉE APPROFONDIE ═══" + chr(10)
        + f"Synthèse de {len(all_sources)} sources web croisées." + chr(10) * 2
        + f"{result.content}" + chr(10) * 2
        + f"📚 {len(all_sources)} sources analysées et croisées."
    )

    print(f"✅ [DEEP_RESEARCH] Done: {len(result.content)} chars, {len(all_sources)} sources", flush=True)
    return context_text, all_sources
