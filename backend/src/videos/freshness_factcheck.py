"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🕐 FRESHNESS & FACT-CHECK LITE v1.0 — Deep Sight                                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 📅 Indicateur de fraîcheur vidéo (alerte si données potentiellement obsolètes)  ║
║  • 🔍 Fact-check LITE gratuit (sans Perplexity, pour Free/Starter)                 ║
║  • ⚠️ Détection des affirmations à risque                                          ║
║  • 📊 Score de confiance basé sur heuristiques                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from enum import Enum
from dataclasses import dataclass, field


# ═══════════════════════════════════════════════════════════════════════════════
# 📅 FRESHNESS INDICATOR — Indicateur de fraîcheur vidéo
# ═══════════════════════════════════════════════════════════════════════════════

class FreshnessLevel(Enum):
    """Niveaux de fraîcheur d'une vidéo"""
    FRESH = "fresh"           # < 3 mois
    RECENT = "recent"         # 3-6 mois
    AGING = "aging"           # 6-12 mois
    OLD = "old"               # 1-2 ans
    OUTDATED = "outdated"     # > 2 ans


@dataclass
class FreshnessResult:
    """Résultat de l'analyse de fraîcheur"""
    level: FreshnessLevel
    age_days: int
    warning_message: Optional[str] = None
    warning_level: str = "none"  # none, info, warning, critical
    is_fast_changing_topic: bool = False
    topic_category: Optional[str] = None
    recommendations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level.value,
            "age_days": self.age_days,
            "warning_message": self.warning_message,
            "warning_level": self.warning_level,
            "is_fast_changing_topic": self.is_fast_changing_topic,
            "topic_category": self.topic_category,
            "recommendations": self.recommendations
        }


# Sujets qui évoluent rapidement (besoin de données récentes)
FAST_CHANGING_TOPICS = {
    # Technologie & IA
    "tech": {
        "keywords": [
            "ia", "ai", "intelligence artificielle", "artificial intelligence",
            "chatgpt", "gpt", "claude", "llm", "machine learning", "deep learning",
            "openai", "anthropic", "google ai", "gemini", "mistral",
            "blockchain", "crypto", "bitcoin", "ethereum", "nft", "web3",
            "startup", "tech", "silicon valley", "innovation"
        ],
        "max_fresh_days": 90,
        "category_name": "Technologie/IA"
    },
    # Actualités & Politique
    "news": {
        "keywords": [
            "élection", "election", "vote", "président", "president",
            "gouvernement", "government", "politique", "political",
            "ukraine", "russia", "guerre", "war", "gaza", "israel", "palestine",
            "conflit", "conflict", "crise", "crisis", "actualité", "news"
        ],
        "max_fresh_days": 30,
        "category_name": "Actualités/Politique"
    },
    # Finance & Économie
    "finance": {
        "keywords": [
            "bourse", "stock", "cac40", "nasdaq", "dow jones", "s&p",
            "inflation", "taux", "interest rate", "fed", "bce", "ecb",
            "économie", "economy", "recession", "croissance", "growth",
            "immobilier", "real estate", "prix", "price"
        ],
        "max_fresh_days": 60,
        "category_name": "Finance/Économie"
    },
    # Santé
    "health": {
        "keywords": [
            "covid", "coronavirus", "vaccin", "vaccine", "pandemic",
            "traitement", "treatment", "médicament", "drug", "fda", "oms", "who",
            "étude clinique", "clinical trial", "santé publique", "public health"
        ],
        "max_fresh_days": 90,
        "category_name": "Santé"
    },
    # Science (plus tolérant mais attention aux découvertes récentes)
    "science": {
        "keywords": [
            "découverte", "discovery", "étude récente", "recent study",
            "2024", "2025", "nouveau", "new", "breakthrough"
        ],
        "max_fresh_days": 180,
        "category_name": "Science"
    }
}


def analyze_freshness(
    video_date: str,
    video_title: str,
    video_description: str = "",
    transcript_excerpt: str = ""
) -> FreshnessResult:
    """
    🕐 Analyse la fraîcheur d'une vidéo et génère des avertissements appropriés.
    
    Args:
        video_date: Date de publication (ISO format ou "YYYY-MM-DD")
        video_title: Titre de la vidéo
        video_description: Description (optionnel)
        transcript_excerpt: Extrait de la transcription (optionnel)
    
    Returns:
        FreshnessResult avec niveau, avertissements et recommandations
    """
    
    # Parser la date
    try:
        if "T" in video_date:
            pub_date = datetime.fromisoformat(video_date.replace("Z", "+00:00"))
        else:
            pub_date = datetime.strptime(video_date[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        # Si date invalide, supposer récent
        pub_date = datetime.now() - timedelta(days=30)
    
    # Calculer l'âge en jours
    age_days = (datetime.now() - pub_date.replace(tzinfo=None)).days
    
    # Déterminer le niveau de fraîcheur de base
    if age_days < 90:
        base_level = FreshnessLevel.FRESH
    elif age_days < 180:
        base_level = FreshnessLevel.RECENT
    elif age_days < 365:
        base_level = FreshnessLevel.AGING
    elif age_days < 730:
        base_level = FreshnessLevel.OLD
    else:
        base_level = FreshnessLevel.OUTDATED
    
    # Analyser le contenu pour détecter les sujets à évolution rapide
    content = f"{video_title} {video_description} {transcript_excerpt}".lower()
    
    detected_topic = None
    is_fast_changing = False
    max_fresh_days = 365  # Par défaut 1 an
    
    for topic_id, topic_config in FAST_CHANGING_TOPICS.items():
        for keyword in topic_config["keywords"]:
            if keyword in content:
                detected_topic = topic_config["category_name"]
                is_fast_changing = True
                max_fresh_days = min(max_fresh_days, topic_config["max_fresh_days"])
                break
        if detected_topic:
            break
    
    # Générer les avertissements et recommandations
    warning_message = None
    warning_level = "none"
    recommendations = []
    
    if is_fast_changing and age_days > max_fresh_days:
        # Sujet à évolution rapide ET vidéo trop ancienne
        warning_level = "critical" if age_days > max_fresh_days * 2 else "warning"
        
        if warning_level == "critical":
            warning_message = f"⚠️ ATTENTION : Cette vidéo sur {detected_topic} date de {age_days} jours. Les informations sont probablement obsolètes."
            recommendations = [
                f"Vérifiez les informations avec des sources datant de moins de {max_fresh_days} jours",
                "Les chiffres, statistiques et faits mentionnés ont pu changer significativement",
                "Utilisez le chat pour demander une vérification des points clés"
            ]
        else:
            warning_message = f"📅 Cette vidéo sur {detected_topic} a {age_days} jours. Certaines informations peuvent avoir évolué."
            recommendations = [
                "Les données chiffrées méritent une vérification",
                "Posez des questions dans le chat pour obtenir des mises à jour"
            ]
    
    elif age_days > 365:
        # Vidéo de plus d'un an (tous sujets)
        warning_level = "info"
        years = age_days // 365
        warning_message = f"📅 Vidéo publiée il y a {years} an{'s' if years > 1 else ''}. Vérifiez l'actualité des informations."
        recommendations = [
            "Les positions, rôles et statuts mentionnés ont pu changer",
            "Les statistiques et chiffres peuvent être obsolètes"
        ]
    
    elif age_days > 180 and not is_fast_changing:
        # Vidéo de 6+ mois sur sujet stable
        warning_level = "info"
        warning_message = f"📅 Vidéo de {age_days // 30} mois. Les informations factuelles sont généralement fiables."
    
    return FreshnessResult(
        level=base_level,
        age_days=age_days,
        warning_message=warning_message,
        warning_level=warning_level,
        is_fast_changing_topic=is_fast_changing,
        topic_category=detected_topic,
        recommendations=recommendations
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 FACT-CHECK LITE — Vérification basique sans API payante
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ClaimAnalysis:
    """Analyse d'une affirmation"""
    claim: str
    claim_type: str  # statistic, fact, opinion, prediction
    confidence: int  # 0-100
    risk_level: str  # low, medium, high
    verification_hint: Optional[str] = None
    suggested_search: Optional[str] = None


@dataclass
class FactCheckLiteResult:
    """Résultat du fact-check LITE"""
    overall_confidence: int  # 0-100
    risk_summary: str
    claims_analyzed: int
    high_risk_claims: List[ClaimAnalysis]
    medium_risk_claims: List[ClaimAnalysis]
    verification_suggestions: List[str]
    disclaimers: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_confidence": self.overall_confidence,
            "risk_summary": self.risk_summary,
            "claims_analyzed": self.claims_analyzed,
            "high_risk_claims": [
                {
                    "claim": c.claim[:200],
                    "claim_type": c.claim_type,
                    "confidence": c.confidence,
                    "risk_level": c.risk_level,
                    "verification_hint": c.verification_hint,
                    "suggested_search": c.suggested_search
                }
                for c in self.high_risk_claims
            ],
            "medium_risk_claims": [
                {
                    "claim": c.claim[:200],
                    "claim_type": c.claim_type,
                    "confidence": c.confidence,
                    "risk_level": c.risk_level,
                    "verification_hint": c.verification_hint
                }
                for c in self.medium_risk_claims[:5]  # Limiter à 5
            ],
            "verification_suggestions": self.verification_suggestions,
            "disclaimers": self.disclaimers
        }


# Patterns pour détecter les types d'affirmations
CLAIM_PATTERNS = {
    # Statistiques et chiffres
    "statistics": [
        r'\b(\d+(?:[.,]\d+)?)\s*(%|pour\s*cent|percent)',
        r'\b(\d+(?:[.,]\d+)?)\s*(millions?|milliards?|billions?|trillions?)',
        r'(un|une|le|la)\s+sur\s+(\d+)',
        r'(\d+)\s*fois\s+(plus|moins)',
        r'(augment|diminu|croît|baisse|hausse).*?(\d+)',
    ],
    # Affirmations temporelles (dates, événements)
    "temporal": [
        r'(en|depuis|avant|après)\s+(\d{4})',
        r'(il y a|ago)\s+(\d+)\s+(ans?|années?|mois|years?|months?)',
        r'(récemment|dernièrement|recently|lately)',
        r'(le|la|les)\s+(premier|dernière?|first|last)',
    ],
    # Opinions présentées comme faits
    "opinion_markers": [
        r'\b(évidemment|obviously|clairement|clearly)\b',
        r'\b(tout le monde sait|everyone knows)\b',
        r'\b(il est (évident|clair)|it\'s (obvious|clear))\b',
        r'\b(sans aucun doute|undoubtedly|sans conteste)\b',
        r'\b(c\'est (un fait|prouvé)|it\'s (a fact|proven))\b',
    ],
    # Prédictions
    "predictions": [
        r'\b(va|will|going to)\s+(devenir|become|être|be)\b',
        r'\b(dans les prochains?|in the next)\s+(\d+)',
        r'\b(d\'ici|by)\s+(\d{4})',
        r'\b(prédit|prévoit|predicts|forecasts)\b',
    ],
    # Sources vagues
    "vague_sources": [
        r'\b(des études|studies|recherches|research)\s+(montrent|show|prouvent|prove)\b',
        r'\b(on dit que|they say|il paraît|apparently)\b',
        r'\b(selon (des|les) experts?|according to experts?)\b',
        r'\b(la science (dit|montre)|science (says|shows))\b',
    ],
    # Affirmations extraordinaires
    "extraordinary": [
        r'\b(révolution|revolutionary|breakthrough)\b',
        r'\b(jamais vu|never seen|sans précédent|unprecedented)\b',
        r'\b(100%|totally|complètement|entièrement)\s+(efficace|effective|sûr|safe)\b',
        r'\b(guérit?|cure[sd]?|élimine|eliminates)\s+(tout|all|le)\b',
    ]
}

# Mots-clés de fiabilité (augmentent la confiance)
RELIABILITY_BOOSTERS = [
    r'\b(selon|according to)\s+(l\'|the\s+)?(INSEE|Eurostat|OMS|WHO|ONU|UN|FMI|IMF|BCE|ECB)\b',
    r'\b(étude|study)\s+(publiée?|published)\s+(dans|in)\s+(Nature|Science|Lancet|NEJM)\b',
    r'\b(rapport|report)\s+(officiel|official)\b',
    r'\b(source|données?|data)\s*:\s*\w+',
    r'\bhttps?://\S+\b',
]

# Mots-clés qui réduisent la confiance
RELIABILITY_REDUCERS = [
    r'\b(je pense|I think|à mon avis|in my opinion)\b',
    r'\b(peut-être|maybe|perhaps|possibly)\b',
    r'\b(certains disent|some say|on raconte)\b',
    r'\b(rumeur|rumor|buzz)\b',
    r'\b(théorie du complot|conspiracy)\b',
]


def analyze_claims_lite(
    text: str,
    video_title: str = "",
    lang: str = "fr"
) -> FactCheckLiteResult:
    """
    🔍 Analyse les affirmations dans un texte sans API externe.
    Utilise des heuristiques et patterns pour identifier les claims à risque.
    
    Args:
        text: Texte à analyser (résumé ou transcription)
        video_title: Titre pour contexte
        lang: Langue (fr/en)
    
    Returns:
        FactCheckLiteResult avec analyse des affirmations
    """
    
    full_text = f"{video_title}\n{text}".lower()
    claims_found = []
    
    # Détecter les patterns
    for claim_type, patterns in CLAIM_PATTERNS.items():
        for pattern in patterns:
            matches = re.finditer(pattern, full_text, re.IGNORECASE)
            for match in matches:
                # Extraire le contexte autour du match
                start = max(0, match.start() - 100)
                end = min(len(full_text), match.end() + 100)
                context = full_text[start:end].strip()
                
                # Calculer le risque et la confiance
                confidence, risk_level = _calculate_claim_risk(
                    context, claim_type, full_text
                )
                
                # Générer des suggestions de vérification
                verification_hint = _get_verification_hint(claim_type, match.group(), lang)
                suggested_search = _get_search_suggestion(match.group(), claim_type, lang)
                
                claims_found.append(ClaimAnalysis(
                    claim=context,
                    claim_type=claim_type,
                    confidence=confidence,
                    risk_level=risk_level,
                    verification_hint=verification_hint,
                    suggested_search=suggested_search
                ))
    
    # Dédupliquer et trier par risque
    unique_claims = _deduplicate_claims(claims_found)
    high_risk = [c for c in unique_claims if c.risk_level == "high"]
    medium_risk = [c for c in unique_claims if c.risk_level == "medium"]
    
    # Calculer le score global
    overall_confidence = _calculate_overall_confidence(full_text, unique_claims)
    
    # Générer le résumé
    risk_summary = _generate_risk_summary(overall_confidence, high_risk, medium_risk, lang)
    
    # Suggestions de vérification
    suggestions = _generate_verification_suggestions(high_risk, medium_risk, lang)
    
    # Disclaimers
    disclaimers = [
        "Cette analyse est basée sur des heuristiques, pas sur une vérification factuelle complète.",
        "Les scores de confiance sont indicatifs et ne garantissent pas l'exactitude.",
        "Pour une vérification approfondie, utilisez le plan Pro avec recherche web Perplexity."
    ] if lang == "fr" else [
        "This analysis is based on heuristics, not complete fact-checking.",
        "Confidence scores are indicative and don't guarantee accuracy.",
        "For thorough verification, use Pro plan with Perplexity web search."
    ]
    
    return FactCheckLiteResult(
        overall_confidence=overall_confidence,
        risk_summary=risk_summary,
        claims_analyzed=len(unique_claims),
        high_risk_claims=high_risk[:10],  # Limiter
        medium_risk_claims=medium_risk[:10],
        verification_suggestions=suggestions,
        disclaimers=disclaimers
    )


def _calculate_claim_risk(
    context: str,
    claim_type: str,
    full_text: str
) -> Tuple[int, str]:
    """Calcule le risque et la confiance d'une affirmation"""
    
    base_confidence = 70  # Confiance de base
    
    # Ajustements selon le type
    type_adjustments = {
        "statistics": -10,  # Chiffres = besoin de vérification
        "temporal": -5,
        "opinion_markers": -25,  # Opinions = basse confiance
        "predictions": -20,
        "vague_sources": -30,  # Sources vagues = très risqué
        "extraordinary": -35,  # Affirmations extraordinaires
    }
    
    confidence = base_confidence + type_adjustments.get(claim_type, 0)
    
    # Boosters (augmentent la confiance)
    for pattern in RELIABILITY_BOOSTERS:
        if re.search(pattern, context, re.IGNORECASE):
            confidence += 15
    
    # Reducers (diminuent la confiance)
    for pattern in RELIABILITY_REDUCERS:
        if re.search(pattern, context, re.IGNORECASE):
            confidence -= 10
    
    # Clamp entre 10 et 95
    confidence = max(10, min(95, confidence))
    
    # Déterminer le niveau de risque
    if confidence < 40:
        risk_level = "high"
    elif confidence < 65:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    return confidence, risk_level


def _get_verification_hint(claim_type: str, match_text: str, lang: str) -> str:
    """Génère un conseil de vérification selon le type"""
    
    hints_fr = {
        "statistics": "Vérifiez ce chiffre sur INSEE, Eurostat ou la source primaire",
        "temporal": "Confirmez cette date/période avec une source officielle",
        "opinion_markers": "Ceci semble être une opinion, pas un fait établi",
        "predictions": "Les prédictions sont par nature incertaines",
        "vague_sources": "Source vague - recherchez la source primaire",
        "extraordinary": "Affirmation forte - exige des preuves solides",
    }
    
    hints_en = {
        "statistics": "Verify this figure on official statistical sources",
        "temporal": "Confirm this date/period with an official source",
        "opinion_markers": "This appears to be an opinion, not an established fact",
        "predictions": "Predictions are inherently uncertain",
        "vague_sources": "Vague source - search for the primary source",
        "extraordinary": "Strong claim - requires solid evidence",
    }
    
    hints = hints_fr if lang == "fr" else hints_en
    return hints.get(claim_type, "Vérification recommandée" if lang == "fr" else "Verification recommended")


def _get_search_suggestion(match_text: str, claim_type: str, lang: str) -> Optional[str]:
    """Génère une suggestion de recherche Google"""
    
    # Extraire les nombres et mots-clés importants
    numbers = re.findall(r'\d+(?:[.,]\d+)?', match_text)
    
    if numbers and claim_type == "statistics":
        return f"statistique {numbers[0]} site:insee.fr OR site:eurostat.ec.europa.eu"
    
    return None


def _deduplicate_claims(claims: List[ClaimAnalysis]) -> List[ClaimAnalysis]:
    """Déduplique les claims similaires"""
    seen = set()
    unique = []
    
    for claim in claims:
        # Simplifier pour comparaison
        key = claim.claim[:50].lower()
        if key not in seen:
            seen.add(key)
            unique.append(claim)
    
    return unique


def _calculate_overall_confidence(text: str, claims: List[ClaimAnalysis]) -> int:
    """Calcule un score de confiance global"""
    
    if not claims:
        return 75  # Par défaut si pas de claims détectés
    
    # Moyenne pondérée par risque
    weights = {"high": 3, "medium": 1.5, "low": 0.5}
    total_weight = 0
    weighted_sum = 0
    
    for claim in claims:
        weight = weights.get(claim.risk_level, 1)
        weighted_sum += claim.confidence * weight
        total_weight += weight
    
    if total_weight == 0:
        return 75
    
    base_score = weighted_sum / total_weight
    
    # Pénalité si beaucoup de claims à risque
    high_risk_count = sum(1 for c in claims if c.risk_level == "high")
    if high_risk_count > 5:
        base_score -= 10
    elif high_risk_count > 2:
        base_score -= 5
    
    return max(20, min(90, int(base_score)))


def _generate_risk_summary(
    confidence: int,
    high_risk: List[ClaimAnalysis],
    medium_risk: List[ClaimAnalysis],
    lang: str
) -> str:
    """Génère un résumé du niveau de risque"""
    
    high_count = len(high_risk)
    medium_count = len(medium_risk)
    
    if lang == "fr":
        if confidence >= 75:
            return f"✅ Fiabilité correcte. {high_count} point(s) à vérifier."
        elif confidence >= 50:
            return f"⚖️ Fiabilité moyenne. {high_count} affirmation(s) à risque, {medium_count} à surveiller."
        else:
            return f"⚠️ Prudence recommandée. {high_count} affirmation(s) potentiellement douteuses détectées."
    else:
        if confidence >= 75:
            return f"✅ Reasonable reliability. {high_count} point(s) to verify."
        elif confidence >= 50:
            return f"⚖️ Medium reliability. {high_count} risky claim(s), {medium_count} to watch."
        else:
            return f"⚠️ Caution advised. {high_count} potentially dubious claim(s) detected."


def _generate_verification_suggestions(
    high_risk: List[ClaimAnalysis],
    medium_risk: List[ClaimAnalysis],
    lang: str
) -> List[str]:
    """Génère des suggestions de vérification"""
    
    suggestions = []
    
    # Statistiques
    has_stats = any(c.claim_type == "statistics" for c in high_risk + medium_risk)
    if has_stats:
        suggestions.append(
            "Vérifiez les statistiques citées sur INSEE, Eurostat ou les sources officielles" 
            if lang == "fr" else 
            "Verify cited statistics on official sources like national statistics offices"
        )
    
    # Sources vagues
    has_vague = any(c.claim_type == "vague_sources" for c in high_risk)
    if has_vague:
        suggestions.append(
            "Plusieurs sources sont vagues - recherchez les études/rapports originaux"
            if lang == "fr" else
            "Several sources are vague - look for original studies/reports"
        )
    
    # Affirmations extraordinaires
    has_extraordinary = any(c.claim_type == "extraordinary" for c in high_risk)
    if has_extraordinary:
        suggestions.append(
            "Des affirmations extraordinaires nécessitent des preuves extraordinaires"
            if lang == "fr" else
            "Extraordinary claims require extraordinary evidence"
        )
    
    # Suggestion générale
    if not suggestions:
        suggestions.append(
            "Croisez les informations avec d'autres sources pour plus de fiabilité"
            if lang == "fr" else
            "Cross-reference information with other sources for better reliability"
        )
    
    return suggestions[:5]  # Max 5 suggestions


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION COMBINÉE — Fraîcheur + Fact-Check
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_content_reliability(
    video_date: str,
    video_title: str,
    summary_content: str,
    video_description: str = "",
    lang: str = "fr"
) -> Dict[str, Any]:
    """
    🎯 Analyse complète : fraîcheur + fact-check LITE.
    
    Cette fonction est le point d'entrée principal pour les plans Free/Starter.
    
    Returns:
        Dict avec freshness et fact_check_lite
    """
    
    # Analyse de fraîcheur
    freshness = analyze_freshness(
        video_date=video_date,
        video_title=video_title,
        video_description=video_description,
        transcript_excerpt=summary_content[:2000]
    )
    
    # Fact-check LITE
    fact_check = analyze_claims_lite(
        text=summary_content,
        video_title=video_title,
        lang=lang
    )
    
    return {
        "freshness": freshness.to_dict(),
        "fact_check_lite": fact_check.to_dict(),
        "analysis_type": "lite",
        "analyzed_at": datetime.utcnow().isoformat()
    }
