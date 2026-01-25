"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧠 ANALYSIS SERVICE v3.0 — Génération de synthèses avec Mistral AI                ║
║  🆕 v3.0: Support du contexte web pré-analyse (Perplexity)                         ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import httpx
import json
import re
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

from core.config import get_mistral_key, get_perplexity_key, MISTRAL_MODELS, VERSION

# ═══════════════════════════════════════════════════════════════════════════════
# 📋 RÈGLES ÉPISTÉMIQUES (Raisonnement Bayésien)
# ═══════════════════════════════════════════════════════════════════════════════

EPISTEMIC_RULES_FR = """
═══════════════════════════════════════════════════════════════════════════════
⚠️ IMPÉRATIF ÉPISTÉMIQUE — À APPLIQUER À CHAQUE AFFIRMATION
═══════════════════════════════════════════════════════════════════════════════

Tu es un analyste critique qui distingue SYSTÉMATIQUEMENT :
• FAIT VÉRIFIÉ : Information factuelle vérifiable (date, chiffre, événement)
• OPINION : Point de vue subjectif de l'auteur (signalé par "Selon X...", "L'auteur affirme...")
• HYPOTHÈSE : Proposition non prouvée mais argumentée
• SPÉCULATION : Conjecture sans preuve solide

RÈGLES D'OR :
1. Ne jamais présenter une opinion comme un fait
2. Toujours attribuer les affirmations ("Selon l'auteur...", "L'intervenant affirme...")
3. Signaler les affirmations extraordinaires ou non étayées
4. Utiliser le conditionnel pour les hypothèses

MARQUEURS À UTILISER :
✅ SOLIDE — Fait vérifié, consensus scientifique
⚖️ PLAUSIBLE — Argument cohérent mais preuves limitées
❓ INCERTAIN — Intéressant mais non démontré
⚠️ À VÉRIFIER — Affirmation forte sans source
"""

EPISTEMIC_RULES_EN = """
═══════════════════════════════════════════════════════════════════════════════
⚠️ EPISTEMIC IMPERATIVE — APPLY TO EVERY CLAIM
═══════════════════════════════════════════════════════════════════════════════

You are a critical analyst who SYSTEMATICALLY distinguishes:
• VERIFIED FACT: Verifiable factual information (date, number, event)
• OPINION: Author's subjective viewpoint (signaled by "According to X...", "The author claims...")
• HYPOTHESIS: Unproven but argued proposition
• SPECULATION: Conjecture without solid evidence

GOLDEN RULES:
1. Never present an opinion as a fact
2. Always attribute claims ("According to the author...", "The speaker states...")
3. Flag extraordinary or unsupported claims
4. Use conditional for hypotheses

MARKERS TO USE:
✅ SOLID — Verified fact, scientific consensus
⚖️ PLAUSIBLE — Coherent argument but limited evidence
❓ UNCERTAIN — Interesting but undemonstrated
⚠️ TO VERIFY — Strong claim without source
"""

# ═══════════════════════════════════════════════════════════════════════════════
# 📂 CATÉGORIES ET TEMPLATES v2.0 — Détection Améliorée
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORIES = {
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎙️ INTERVIEWS & PODCASTS
    # ═══════════════════════════════════════════════════════════════════════════
    "interview": {
        "name": {"fr": "🎙️ Interview/Podcast", "en": "🎙️ Interview/Podcast"},
        "keywords": [
            # Termes directs
            "interview", "podcast", "entretien", "invité", "guest", "talk", "discussion",
            # Formats d'émission
            "live", "épisode", "episode", "émission", "show", "thinkerview", "quotidien",
            "brut", "clique", "konbini", "hugodecrypte", "mcfly et carlito",
            # Structure interview
            "nous recevons", "aujourd'hui avec nous", "bienvenue à", "welcome",
            "on accueille", "notre invité", "joining us", "sit down with"
        ],
        "min_words": 1500,
        "max_words": 5000,
        "template_focus": "dialogue_structure"  # Focus sur les échanges Q/R
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📽️ DOCUMENTAIRES & REPORTAGES
    # ═══════════════════════════════════════════════════════════════════════════
    "documentary": {
        "name": {"fr": "📽️ Documentaire", "en": "📽️ Documentary"},
        "keywords": [
            # Termes directs
            "documentaire", "documentary", "reportage", "enquête", "investigation",
            # Format narratif
            "histoire de", "story of", "l'affaire", "the case of", "true story",
            "au coeur de", "inside", "dans les coulisses", "behind the scenes",
            # Chaînes documentaires
            "arte", "national geographic", "netflix documentary", "bbc documentary",
            "france 5", "histoire", "discovery"
        ],
        "min_words": 1800,
        "max_words": 6000,
        "template_focus": "narrative_arc"  # Focus sur l'arc narratif
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎓 TUTORIELS & HOW-TO
    # ═══════════════════════════════════════════════════════════════════════════
    "tutorial": {
        "name": {"fr": "🎓 Tutoriel", "en": "🎓 Tutorial"},
        "keywords": [
            # Termes directs
            "tutoriel", "tutorial", "guide", "how to", "comment", "apprendre", "learn",
            # Actions pratiques
            "étape par étape", "step by step", "pas à pas", "tuto", "débutant",
            "beginner", "facile", "easy", "créer", "create", "faire", "make",
            # Domaines spécifiques
            "coding", "programmation", "diy", "bricolage", "cuisine", "cooking",
            "photoshop", "premiere", "excel", "python", "javascript"
        ],
        "min_words": 1000,
        "max_words": 3500,
        "template_focus": "actionable_steps"  # Focus sur les étapes pratiques
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🔬 SCIENCE & VULGARISATION
    # ═══════════════════════════════════════════════════════════════════════════
    "science": {
        "name": {"fr": "🔬 Science", "en": "🔬 Science"},
        "keywords": [
            # Termes scientifiques généraux
            "science", "scientifique", "recherche", "étude", "study", "research",
            "expérience", "experiment", "théorie", "theory", "découverte", "discovery",
            "hypothèse", "hypothesis", "démonstration", "preuve", "proof",
            # Disciplines - Physique & Cosmologie
            "physique", "physics", "cosmologie", "cosmology", "astrophysique", "astrophysics",
            "univers", "universe", "cosmos", "big bang", "relativité", "relativity",
            "quantique", "quantum", "mécanique quantique", "quantum mechanics",
            "trou noir", "black hole", "gravité", "gravity", "masse", "mass",
            "énergie noire", "dark energy", "matière noire", "dark matter",
            "modèle", "model", "équation", "equation", "constante", "constant",
            # Disciplines - Autres
            "chimie", "chemistry", "biologie", "biology", "astronomie", "astronomy", 
            "médecine", "medicine", "neuroscience", "neurologie", "génétique", "genetics",
            "évolution", "evolution", "écologie", "ecology", "géologie", "geology",
            # Termes épistémiques
            "falsifiable", "réfutable", "peer review", "publication", "consensus",
            "Nobel", "chercheur", "researcher", "laboratoire", "laboratory",
            # Chaînes scientifiques connues
            "e-penser", "scilabus", "dirty biology", "veritasium", "kurzgesagt",
            "vsauce", "smarter every day", "science étonnante", "scienceclic"
        ],
        "min_words": 1200,
        "max_words": 4500,
        "template_focus": "evidence_based"  # Focus sur les preuves et méthodologie
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📰 ACTUALITÉS & NEWS
    # ═══════════════════════════════════════════════════════════════════════════
    "news": {
        "name": {"fr": "📰 Actualités", "en": "📰 News"},
        "keywords": [
            # Termes d'actualité
            "actualité", "news", "breaking", "journalisme", "info", "report",
            "dernières nouvelles", "breaking news", "flash info", "journal",
            # Contexte temporel
            "aujourd'hui", "today", "cette semaine", "this week", "récent", "recent",
            "2024", "2025", "ce matin", "hier", "yesterday",
            # Médias
            "bfm", "cnews", "lci", "france info", "cnn", "bbc news", "reuters"
        ],
        "min_words": 800,
        "max_words": 2500,
        "template_focus": "5w1h"  # Focus sur Qui/Quoi/Où/Quand/Pourquoi/Comment
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎓 CONFÉRENCES & PRÉSENTATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    "conference": {
        "name": {"fr": "🎓 Conférence", "en": "🎓 Conference"},
        "keywords": [
            # Termes directs
            "conférence", "conference", "ted", "tedx", "talk", "keynote", "présentation",
            "presentation", "speech", "discours", "lecture",
            # Contexte académique
            "colloque", "symposium", "summit", "forum", "séminaire", "seminar",
            "université", "university", "académie", "academy"
        ],
        "min_words": 1400,
        "max_words": 4500,
        "template_focus": "thesis_arguments"  # Focus sur thèse centrale et arguments
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ⚖️ DÉBATS & CONTROVERSES
    # ═══════════════════════════════════════════════════════════════════════════
    "debate": {
        "name": {"fr": "⚖️ Débat", "en": "⚖️ Debate"},
        "keywords": [
            # Termes directs
            "débat", "debate", "controverse", "opposition", "versus", "vs",
            "face à face", "confrontation", "clash", "polémique", "controversy",
            # Structure de débat
            "pour ou contre", "pros and cons", "d'un côté... de l'autre",
            "on one hand... on the other", "disagreement", "désaccord"
        ],
        "min_words": 1500,
        "max_words": 5000,
        "template_focus": "balanced_perspectives"  # Focus sur les deux côtés
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 💰 FINANCE & ÉCONOMIE
    # ═══════════════════════════════════════════════════════════════════════════
    "finance": {
        "name": {"fr": "💰 Finance", "en": "💰 Finance"},
        "keywords": [
            # Termes financiers
            "finance", "investissement", "investment", "bourse", "stock", "trading",
            "économie", "economy", "crypto", "bitcoin", "ethereum", "nft",
            # Concepts spécifiques
            "portefeuille", "portfolio", "rendement", "return", "dividende", "dividend",
            "action", "obligation", "bond", "etf", "marché", "market",
            # Immobilier
            "immobilier", "real estate", "scpi", "location", "rental"
        ],
        "min_words": 1200,
        "max_words": 4000,
        "template_focus": "risk_return"  # Focus sur risques et opportunités
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 💻 TECH & IA
    # ═══════════════════════════════════════════════════════════════════════════
    "tech": {
        "name": {"fr": "💻 Tech", "en": "💻 Tech"},
        "keywords": [
            # Termes tech
            "tech", "technology", "digital", "software", "hardware", "ai", "ia",
            "intelligence artificielle", "artificial intelligence", "machine learning",
            # Produits
            "apple", "google", "microsoft", "meta", "openai", "chatgpt", "claude",
            "iphone", "android", "startup", "licorne", "unicorn",
            # Concepts
            "algorithme", "algorithm", "data", "données", "cloud", "cybersécurité"
        ],
        "min_words": 1200,
        "max_words": 4000,
        "template_focus": "implications"  # Focus sur implications et tendances
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🏥 SANTÉ & BIEN-ÊTRE
    # ═══════════════════════════════════════════════════════════════════════════
    "health": {
        "name": {"fr": "🏥 Santé", "en": "🏥 Health"},
        "keywords": [
            # Termes médicaux
            "santé", "health", "médical", "medical", "bien-être", "wellness",
            "maladie", "disease", "traitement", "treatment", "symptôme", "symptom",
            # Prévention
            "nutrition", "régime", "diet", "exercice", "exercise", "sommeil", "sleep",
            "mental", "psychologie", "psychology", "stress", "anxiété", "anxiety",
            # Sources fiables
            "oms", "who", "médecin", "doctor", "hôpital", "hospital", "étude clinique"
        ],
        "min_words": 1200,
        "max_words": 4000,
        "template_focus": "evidence_caution"  # Focus sur preuves + avertissements
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🌍 GÉOPOLITIQUE & SOCIÉTÉ
    # ═══════════════════════════════════════════════════════════════════════════
    "geopolitics": {
        "name": {"fr": "🌍 Géopolitique", "en": "🌍 Geopolitics"},
        "keywords": [
            # Termes géopolitiques
            "géopolitique", "geopolitics", "relations internationales", "international relations",
            "diplomatie", "diplomacy", "conflit", "conflict", "guerre", "war",
            # Entités
            "onu", "un", "otan", "nato", "union européenne", "european union",
            "états-unis", "usa", "chine", "china", "russie", "russia",
            # Concepts
            "souveraineté", "sovereignty", "sanctions", "embargo", "traité", "treaty"
        ],
        "min_words": 1400,
        "max_words": 5000,
        "template_focus": "stakeholders"  # Focus sur les acteurs et enjeux
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🎨 CULTURE & ARTS
    # ═══════════════════════════════════════════════════════════════════════════
    "culture": {
        "name": {"fr": "🎨 Culture", "en": "🎨 Culture"},
        "keywords": [
            # Arts
            "culture", "art", "musique", "music", "cinéma", "cinema", "film",
            "littérature", "literature", "théâtre", "theatre", "peinture", "painting",
            # Critique
            "critique", "review", "analyse", "analysis", "chef d'oeuvre", "masterpiece",
            "artiste", "artist", "réalisateur", "director", "auteur", "author"
        ],
        "min_words": 1000,
        "max_words": 3500,
        "template_focus": "artistic_analysis"  # Focus sur l'analyse artistique
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 📋 GÉNÉRAL (Fallback)
    # ═══════════════════════════════════════════════════════════════════════════
    "general": {
        "name": {"fr": "📋 Général", "en": "📋 General"},
        "keywords": [],
        "min_words": 1000,
        "max_words": 3500,
        "template_focus": "balanced"
    }
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🏷️ CHAÎNES CONNUES PAR CATÉGORIE (pour améliorer la détection)
# ═══════════════════════════════════════════════════════════════════════════════

KNOWN_CHANNELS = {
    "science": [
        # Français - Science & Vulgarisation
        "e-penser", "scilabus", "dirty biology", "science étonnante", "le blob",
        "balade mentale", "astronogeek", "nota bene", "science4all", "monsieur phi",
        "hygiène mentale", "defakator", "le sense of wonder", "scienceclic",
        "biomécanique", "science de comptoir", "string theory", "les chroniques de la science",
        "l'esprit sorcier", "scienticfiz", "c'est pas sorcier", "florence porcel",
        "espace des sciences", "palais de la découverte", "science&vie tv",
        # Jean-Pierre Petit et autres physiciens
        "jean-pierre petit", "jp petit", "janus cosmological model",
        "etienne klein", "aurélien barrau", "thibault damour",
        # Anglais
        "veritasium", "kurzgesagt", "vsauce", "smarter every day", "numberphile",
        "minutephysics", "3blue1brown", "pbs space time", "physics girl",
        "scishow", "tom scott", "real engineering", "mark rober", "primer",
        "up and atom", "sabine hossenfelder", "sean carroll", "pbs eons",
        "sixty symbols", "periodic videos", "computerphile", "lex fridman science",
    ],
    "interview": [
        # Français
        "thinkerview", "blast", "mediapart", "le média", "clique", "quotidien",
        "brut", "konbini", "hugodecrypte", "mcfly et carlito", "popcorn",
        "first team", "osmose podcast", "generation do it yourself", "gdiy",
        "les grandes gueules", "on n'est pas couché", "la grande librairie",
        # Anglais
        "joe rogan", "lex fridman", "jordan peterson", "tim ferriss", 
        "naval ravikant", "diary of a ceo", "impact theory", "london real",
        "h3 podcast", "hot ones", "the breakfast club", "conan o'brien",
    ],
    "tech": [
        # Français
        "underscore", "micode", "léo duff", "guillaume slash", "nowtech",
        "tech lead fr", "cookie connecté", "parfaitement web",
        # Anglais
        "linus tech tips", "mkbhd", "the verge", "wired", "cnet",
        "fireship", "tech lead", "traversy media", "joma tech",
        "dave2d", "unbox therapy", "austin evans", "jayztwocents",
    ],
    "finance": [
        # Français
        "xavier delmas", "finary", "matthieu louvet", "grand angle",
        "les investisseurs 4.0", "objectif libre", "revenus et dividendes",
        # Anglais
        "invest with queenie", "andrei jikh", "graham stephan",
        "meet kevin", "mark tilbury", "ali abdaal money",
    ],
    "documentary": [
        "arte", "france 5", "national geographic", "bbc documentary",
        "netflix documentary", "envoyé spécial", "cash investigation",
        "complément d'enquête", "infrarouge", "documentaire société",
        "vice", "vox", "frontline pbs", "history channel",
    ],
    "geopolitics": [
        "le dessous des cartes", "géopoliticus", "mappingtheworld",
        "tldr news", "caspian report", "visual politik", "polymatter",
        "real life lore", "wendover productions", "half as interesting",
    ],
    "tutorial": [
        # Français
        "grafikart", "pierre giraud", "openclassrooms", "formation informatique",
        # Anglais
        "traversy media", "freecodecamp", "the coding train", "web dev simplified",
        "fireship", "net ninja", "programming with mosh", "sentdex",
    ],
    "health": [
        "primum non nocere", "nutrition facts", "what i've learned",
        "docteur jimmy mohamed", "michel cymes", "dans ton corps",
        "andrew huberman", "dr berg", "medlife crisis",
    ],
    "news": [
        "bfmtv", "cnews", "france info", "lci", "france 24",
        "bbc news", "cnn", "reuters", "al jazeera", "dw news",
        "euronews", "sky news", "abc news",
    ],
    "culture": [
        # Français
        "arte cinéma", "blow up arte", "le fossoyeur de films", "inthepanda",
        "captain popcorn", "durendal", "les chroniques du mea",
        # Anglais
        "every frame a painting", "nerdwriter", "lindsay ellis",
        "lessons from the screenplay", "channel criswell",
    ],
    "debate": [
        "c dans l'air", "28 minutes arte", "l'heure des pros",
        "bfm story", "punchline", "face à l'info",
    ],
}

# Catégories YouTube natives → nos catégories
YOUTUBE_CATEGORY_MAPPING = {
    "Science & Technology": "science",
    "Education": "science",  # Souvent de la vulgarisation
    "News & Politics": "geopolitics",
    "People & Blogs": "interview",  # Souvent des podcasts
    "Entertainment": "general",
    "Music": "culture",
    "Film & Animation": "culture",
    "Gaming": "tech",
    "Howto & Style": "tutorial",
    "Sports": "general",
    "Nonprofits & Activism": "geopolitics",
    "Autos & Vehicles": "tech",
    "Pets & Animals": "documentary",
    "Travel & Events": "documentary",
    "Comedy": "general",
}


def detect_category(
    title: str, 
    description: str = "", 
    transcript: str = "",
    channel: str = "",
    tags: List[str] = None,
    youtube_categories: List[str] = None
) -> Tuple[str, float]:
    """
    🆕 v3.0: Détection INTELLIGENTE de catégorie avec métadonnées complètes.
    
    Utilise dans l'ordre de priorité:
    1. Nom de la chaîne (chaînes connues = très haute confiance)
    2. Tags YouTube (bonne indication du contenu)
    3. Catégorie YouTube native (mapping)
    4. Titre (pondération x5)
    5. Description (pondération x2)
    6. Transcript (premiers 5000 mots)
    
    Retourne: (category_id, confidence)
    """
    tags = tags or []
    youtube_categories = youtube_categories or []
    
    # Normaliser les textes
    title_lower = title.lower() if title else ""
    desc_lower = description.lower() if description else ""
    channel_lower = channel.lower() if channel else ""
    tags_lower = [t.lower() for t in tags]
    transcript_lower = transcript[:8000].lower() if transcript else ""
    
    print(f"🏷️ [CATEGORY DETECTION v3.0]", flush=True)
    print(f"   📺 Channel: {channel}", flush=True)
    print(f"   🎬 Title: {title[:60]}...", flush=True)
    print(f"   🏷️ Tags: {tags[:5]}...", flush=True)
    print(f"   📂 YT Categories: {youtube_categories}", flush=True)
    
    # ═══════════════════════════════════════════════════════════════════════
    # 1. CHAÎNE CONNUE (PRIORITÉ MAXIMALE)
    # ═══════════════════════════════════════════════════════════════════════
    for cat_id, channels in KNOWN_CHANNELS.items():
        for known_channel in channels:
            if known_channel in channel_lower:
                print(f"   ✅ MATCH: Known channel '{known_channel}' → {cat_id} (confidence: 0.95)", flush=True)
                return cat_id, 0.95
    
    # ═══════════════════════════════════════════════════════════════════════
    # 2. CATÉGORIE YOUTUBE NATIVE (HAUTE CONFIANCE)
    # ═══════════════════════════════════════════════════════════════════════
    for yt_cat in youtube_categories:
        if yt_cat in YOUTUBE_CATEGORY_MAPPING:
            mapped_cat = YOUTUBE_CATEGORY_MAPPING[yt_cat]
            if mapped_cat != "general":
                print(f"   ✅ MATCH: YouTube category '{yt_cat}' → {mapped_cat} (confidence: 0.85)", flush=True)
                return mapped_cat, 0.85
    
    # ═══════════════════════════════════════════════════════════════════════
    # 3. ANALYSE PAR MOTS-CLÉS PONDÉRÉS
    # ═══════════════════════════════════════════════════════════════════════
    scores = {}
    
    for cat_id, cat_info in CATEGORIES.items():
        if cat_id == "general":
            continue
        
        score = 0
        matches = []
        
        for kw in cat_info["keywords"]:
            kw_lower = kw.lower()
            
            # Bonus chaîne (x10)
            if kw_lower in channel_lower:
                score += 10
                matches.append(f"channel:{kw}")
            
            # Bonus tags (x8) - très fiable
            if any(kw_lower in tag for tag in tags_lower):
                score += 8
                matches.append(f"tag:{kw}")
            
            # Bonus titre (x5)
            if kw_lower in title_lower:
                score += 5
                matches.append(f"title:{kw}")
            
            # Bonus description (x2)
            if kw_lower in desc_lower:
                count = desc_lower.count(kw_lower)
                score += min(count * 2, 6)  # Max 6 points
                if count > 0:
                    matches.append(f"desc:{kw}x{count}")
            
            # Transcript (x1)
            if kw_lower in transcript_lower:
                count = transcript_lower.count(kw_lower)
                score += min(count, 5)  # Max 5 points
        
        if score > 0:
            scores[cat_id] = {"score": score, "matches": matches[:10]}
    
    # ═══════════════════════════════════════════════════════════════════════
    # 4. SÉLECTION DU MEILLEUR
    # ═══════════════════════════════════════════════════════════════════════
    if not scores:
        print(f"   ⚠️ No matches found → general (confidence: 0.50)", flush=True)
        return "general", 0.50
    
    # Trier par score
    sorted_cats = sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)
    best_cat = sorted_cats[0][0]
    best_score = sorted_cats[0][1]["score"]
    best_matches = sorted_cats[0][1]["matches"]
    
    # Log des top 3
    print(f"   📊 Top categories:", flush=True)
    for cat, info in sorted_cats[:3]:
        print(f"      - {cat}: score={info['score']} matches={info['matches'][:5]}", flush=True)
    
    # Calculer la confiance
    if len(sorted_cats) > 1:
        second_score = sorted_cats[1][1]["score"]
        gap = (best_score - second_score) / max(best_score, 1)
        confidence = min(0.92, 0.55 + (gap * 0.25) + (min(best_score, 30) * 0.01))
    else:
        confidence = min(0.90, 0.60 + (min(best_score, 25) * 0.012))
    
    print(f"   ✅ SELECTED: {best_cat} (confidence: {confidence:.2f})", flush=True)
    
    return best_cat, confidence


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 GÉNÉRATION DES PROMPTS
# ═══════════════════════════════════════════════════════════════════════════════

def get_mode_instructions(mode: str, lang: str) -> str:
    """Retourne les instructions spécifiques au mode d'analyse"""
    
    if lang == "fr":
        instructions = {
            "accessible": """
╔══════════════════════════════════════════════════════════════════════════════╗
║  📖 MODE ACCESSIBLE — Le Vulgarisateur Brillant                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎭 PERSONA : Tu es un professeur charismatique qui rend TOUT fascinant.
   Tu simplifies sans jamais trahir. Tu enthousiasmes sans jamais mentir.

🎯 OBJECTIF : Une synthèse qu'on a ENVIE de lire et qu'on RETIENT
   → L'essentiel en 60 secondes de lecture
   → Des "Aha moments" qui marquent l'esprit
   → Zéro jargon inutile, 100% impact

✨ STYLE "SEXY BUT SMART" :
   • Accroche percutante dès la première phrase
   • Analogies mémorables ("C'est comme si...")
   • Phrases courtes et punchy (max 20 mots)
   • Emojis stratégiques pour scanner rapidement

📐 STRUCTURE ÉPURÉE :
   🎯 L'ESSENTIEL (2-3 phrases choc)
   📝 LES POINTS CLÉS (3-5 max, avec timecodes)
   💡 LE TAKEAWAY (1 phrase mémorable)
""",
            "standard": """
╔══════════════════════════════════════════════════════════════════════════════╗
║  📊 MODE STANDARD — L'Analyste Équilibré                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎭 PERSONA : Journaliste d'investigation + Fact-checker + Pédagogue
   Tu cherches la vérité. Tu donnes au lecteur les outils pour juger lui-même.

🎯 OBJECTIF : Synthèse complète avec ÉVALUATION CRITIQUE
   → Couvrir TOUS les points importants
   → Distinguer fait / opinion / hypothèse
   → Révéler ce qui est dit ET ce qui est omis

✨ STYLE "ÉLÉGANT & RIGOUREUX" :
   • Structure claire avec hiérarchie visuelle
   • Transitions fluides entre les sections
   • Citations stratégiques avec timecodes
   • Tableaux pour les comparaisons

🧠 CADRE BAYÉSIEN EXPLICITE :
   ✅ SOLIDE — Evidence forte, consensus large
   ⚖️ PLAUSIBLE — Arguments cohérents mais preuves limitées
   ❓ INCERTAIN — Intéressant mais non étayé
   ⚠️ DOUTEUX — Contredit le consensus, biais évidents

📐 STRUCTURE RECOMMANDÉE :
   ## 🎯 Synthèse Express (30 secondes)
   ## 📝 Analyse Détaillée (par thème, avec crédibilité)
   ## 🔍 Regard Critique (forces, faiblesses, questions)
   ## 💡 À Retenir (takeaways actionnables)
   ## ⏱️ Index Temporel (moments clés)
""",
            "expert": """
╔══════════════════════════════════════════════════════════════════════════════╗
║  🔬 MODE EXPERT — L'Analyste Bayésien Exhaustif                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎭 PERSONA : Chercheur senior en épistémologie + Critical thinker
   Tu produis des analyses de niveau académique. Rigueur maximale.

🎯 OBJECTIF : Décorticage EXHAUSTIF avec RIGUEUR ÉPISTÉMIQUE
   → AUCUNE idée, argument ou nuance omis
   → CHAQUE affirmation évaluée selon cadre bayésien formel
   → Structure argumentative entièrement mise à nu
   → Les NON-DITS sont aussi importants que les dits

🧠 CADRE BAYÉSIEN FORMEL :
   Pour chaque claim significatif :
   │ PRIOR P(H) : Probabilité avant cette vidéo
   │ LIKELIHOOD : Ces preuves si hypothèse vraie ?
   │ POSTERIOR : Révision de croyance justifiée
   │ ↑↑ Fort | ↑ Modéré | → Neutre | ↓ Contre-indicatif

🔬 ANALYSE RHÉTORIQUE & LOGIQUE :
   • Structure argumentative : prémisses → inférences → conclusions
   • Sophismes : ad hominem, homme de paille, pente glissante, faux dilemme
   • Biais cognitifs : confirmation, ancrage, survivant, Dunning-Kruger

📐 STRUCTURE OBLIGATOIRE :
   ## 🎯 Executive Summary
   ## 📊 Cartographie Argumentative
   ## 🔬 Analyse Détaillée (avec évaluation bayésienne)
   ## ⚖️ Évaluation Épistémique
   ## 🆚 Mise en Perspective
   ## ❓ Questions Non Résolues
   ## 📍 Index Temporel Complet
"""
        }
    else:
        instructions = {
            "accessible": """
╔══════════════════════════════════════════════════════════════════════════════╗
║  📖 ACCESSIBLE MODE — The Brilliant Popularizer                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎭 PERSONA: You are a charismatic professor who makes EVERYTHING fascinating.
   You simplify without ever betraying. You inspire without ever lying.

🎯 OBJECTIVE: A synthesis that people WANT to read and REMEMBER
   → The essentials in 60 seconds of reading
   → "Aha moments" that stick in the mind
   → Zero useless jargon, 100% impact

✨ "SEXY BUT SMART" STYLE:
   • Punchy hook from the first sentence
   • Memorable analogies ("It's like...")
   • Short, punchy sentences (max 20 words)
   • Strategic emojis for quick scanning

📐 CLEAN STRUCTURE:
   🎯 THE ESSENTIALS (2-3 impactful sentences)
   📝 KEY POINTS (3-5 max, with timecodes)
   💡 THE TAKEAWAY (1 memorable sentence)
""",
            "standard": """
╔══════════════════════════════════════════════════════════════════════════════╗
║  📊 STANDARD MODE — The Balanced Analyst                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎭 PERSONA: Investigative journalist + Fact-checker + Educator
   You seek the truth. You give the reader tools to judge for themselves.

🎯 OBJECTIVE: Complete synthesis with CRITICAL EVALUATION
   → Cover ALL important points
   → Distinguish fact / opinion / hypothesis
   → Reveal what is said AND what is omitted

✨ "ELEGANT & RIGOROUS" STYLE:
   • Clear structure with visual hierarchy
   • Smooth transitions between sections
   • Strategic quotes with timecodes
   • Tables for comparisons

🧠 EXPLICIT BAYESIAN FRAMEWORK:
   ✅ SOLID — Strong evidence, broad consensus
   ⚖️ PLAUSIBLE — Coherent arguments but limited evidence
   ❓ UNCERTAIN — Interesting but unsubstantiated
   ⚠️ DOUBTFUL — Contradicts consensus, obvious biases

📐 RECOMMENDED STRUCTURE:
   ## 🎯 Express Summary (30 seconds)
   ## 📝 Detailed Analysis (by theme, with credibility)
   ## 🔍 Critical Review (strengths, weaknesses, questions)
   ## 💡 Takeaways (actionable)
   ## ⏱️ Temporal Index (key moments)
""",
            "expert": """
╔══════════════════════════════════════════════════════════════════════════════╗
║  🔬 EXPERT MODE — The Exhaustive Bayesian Analyst                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎭 PERSONA: Senior researcher in epistemology + Critical thinker
   You produce academic-level analyses. Maximum rigor.

🎯 OBJECTIVE: EXHAUSTIVE deconstruction with EPISTEMIC RIGOR
   → NO idea, argument or nuance omitted
   → EACH claim evaluated according to formal Bayesian framework
   → Argumentative structure entirely laid bare
   → What is NOT SAID is as important as what is said

🧠 FORMAL BAYESIAN FRAMEWORK:
   For each significant claim:
   │ PRIOR P(H): Probability before this video
   │ LIKELIHOOD: This evidence if hypothesis true?
   │ POSTERIOR: Justified belief revision
   │ ↑↑ Strong | ↑ Moderate | → Neutral | ↓ Counter-indicative

🔬 RHETORICAL & LOGICAL ANALYSIS:
   • Argumentative structure: premises → inferences → conclusions
   • Fallacies: ad hominem, straw man, slippery slope, false dilemma
   • Cognitive biases: confirmation, anchoring, survivorship, Dunning-Kruger

📐 MANDATORY STRUCTURE:
   ## 🎯 Executive Summary
   ## 📊 Argumentative Mapping
   ## 🔬 Detailed Analysis (with Bayesian evaluation)
   ## ⚖️ Epistemic Evaluation
   ## 🆚 Contextualization
   ## ❓ Unresolved Questions
   ## 📍 Complete Temporal Index
"""
        }
    
    return instructions.get(mode, instructions["standard"])


def get_category_specific_instructions(category: str, lang: str) -> str:
    """
    🆕 v2.0: Instructions spécifiques selon le type de contenu.
    Adapte la structure et le focus du résumé au type de vidéo.
    """
    if lang == "fr":
        instructions = {
            "interview": """
📌 FOCUS INTERVIEW/PODCAST :
• Structure Q&R : Identifie les questions clés et les réponses marquantes
• Profil de l'invité : Qui est-il ? Quelle expertise apporte-t-il ?
• Citations impactantes : Extrais 2-3 citations mémorables avec timecodes
• Révélations : Qu'apprend-on de nouveau ou de surprenant ?
• Points de vue : Distingue les faits des opinions personnelles de l'invité
• Dynamique : Note les moments de tension, d'humour ou d'émotion
""",
            "documentary": """
📌 FOCUS DOCUMENTAIRE :
• Arc narratif : Situation initiale → Développement → Conclusion
• Protagonistes : Qui sont les acteurs clés de l'histoire ?
• Contexte historique/social : Situe les événements
• Preuves visuelles : Quelles images/documents marquants ?
• Parti pris : Le documentaire est-il neutre ou orienté ?
• Impact : Quelles conséquences ou leçons à retenir ?
""",
            "tutorial": """
📌 FOCUS TUTORIEL :
• Objectif : Que va-t-on apprendre exactement ?
• Prérequis : Niveau requis, matériel nécessaire
• Étapes clés : Liste numérotée des actions principales avec timecodes
• Astuces : Tips et raccourcis mentionnés
• Pièges à éviter : Erreurs courantes signalées
• Résultat attendu : À quoi s'attendre à la fin
""",
            "science": """
📌 FOCUS SCIENCE :
• Hypothèse/Question : Quel problème scientifique est abordé ?
• Méthodologie : Comment les conclusions sont-elles obtenues ?
• Résultats clés : Chiffres et données importantes
• Niveau de preuve : Étude unique, méta-analyse, consensus ?
• Limites : Quelles sont les réserves ou incertitudes ?
• Implications : Applications pratiques ou théoriques
""",
            "news": """
📌 FOCUS ACTUALITÉS (5W1H) :
• QUI ? Les acteurs principaux
• QUOI ? L'événement précis
• OÙ ? La localisation
• QUAND ? La chronologie
• POURQUOI ? Les causes et contexte
• COMMENT ? Le déroulement
• Sources : D'où viennent les informations ?
• Suivi : Quelles suites possibles ?
""",
            "conference": """
📌 FOCUS CONFÉRENCE :
• Thèse centrale : Quel est le message principal ?
• Arguments : Les 3-5 arguments clés qui soutiennent la thèse
• Preuves : Données, exemples, études citées
• Appel à l'action : Que demande le conférencier ?
• Public cible : À qui s'adresse ce message ?
• Credibilité : Quelle est l'expertise du conférencier ?
""",
            "debate": """
📌 FOCUS DÉBAT :
• Sujet du débat : Question centrale posée
• Position A : Arguments du premier camp
• Position B : Arguments du second camp
• Points d'accord : Y a-t-il des consensus ?
• Points de friction : Où les positions divergent-elles ?
• Évaluation : Quels arguments sont les plus solides ?
• Nuance : Existe-t-il une troisième voie ?
""",
            "finance": """
📌 FOCUS FINANCE :
• Opportunité/Risque : Quel est le sujet financier abordé ?
• Analyse : Arguments pour et contre
• Chiffres clés : Performances, ratios, projections
• Horizon temporel : Court terme, moyen terme, long terme ?
• Profil de risque : Pour quel type d'investisseur ?
• Avertissement : Distingue conseil général vs recommandation personnalisée
• Conflits d'intérêts : L'auteur a-t-il des intérêts ?
""",
            "tech": """
📌 FOCUS TECH :
• Innovation : Quelle est la technologie/produit présenté ?
• Fonctionnement : Comment ça marche (simplifié) ?
• Avantages : Quels problèmes résout-elle ?
• Limites : Quels sont les inconvénients ou risques ?
• Comparaison : Par rapport aux alternatives existantes ?
• Disponibilité : Quand et pour qui ?
• Implications sociétales : Impact potentiel sur la société
""",
            "health": """
📌 FOCUS SANTÉ :
• Sujet médical : Quelle condition/traitement est abordé ?
• Niveau de preuve : Étude, consensus médical, témoignage ?
• Bénéfices : Quels effets positifs documentés ?
• Risques : Effets secondaires ou contre-indications ?
• Population concernée : Pour qui est-ce pertinent ?
• Avertissement : Rappeler de consulter un professionnel de santé
• Sources : Études ou experts cités
""",
            "geopolitics": """
📌 FOCUS GÉOPOLITIQUE :
• Contexte : Situation historique et actuelle
• Acteurs : Pays, organisations, personnalités impliquées
• Enjeux : Intérêts en jeu pour chaque partie
• Dynamiques : Alliances, tensions, rapports de force
• Scénarios : Évolutions possibles
• Sources : Origine des informations et fiabilité
""",
            "culture": """
📌 FOCUS CULTURE :
• Œuvre/Artiste : Présentation du sujet
• Contexte de création : Époque, influences, circonstances
• Analyse : Thèmes, techniques, symbolisme
• Réception : Critique, public, impact
• Héritage : Influence sur la culture
"""
        }
        return instructions.get(category, "")
    else:
        # English versions (simplified)
        return ""


def get_transcript_limit(duration: int, mode: str) -> int:
    """
    🆕 v3.1: Calcule la limite de transcription dynamique selon la durée et le mode.

    Pour les vidéos longues, on augmente la limite pour capturer l'intégralité du contenu.
    """
    # Limites de base par mode
    base_limits = {
        "accessible": 60000,
        "standard": 100000,
        "expert": 150000
    }
    base = base_limits.get(mode, 100000)

    # Augmenter pour les vidéos longues (> 30 min)
    if duration > 1800:  # > 30 min
        multiplier = min(2.0, 1.0 + (duration - 1800) / 7200)  # Max x2 pour 2h+
        base = int(base * multiplier)

    # Augmenter encore pour les vidéos très longues (> 2h)
    if duration > 7200:  # > 2h
        multiplier = min(1.5, 1.0 + (duration - 7200) / 14400)  # Max x1.5 supplémentaire
        base = int(base * multiplier)

    # Limite maximale absolue: 300k chars (environ 60-75k mots)
    return min(base, 300000)


def build_analysis_prompt(
    title: str,
    transcript: str,
    category: str,
    lang: str,
    mode: str,
    duration: int = 0,
    channel: str = "",
    description: str = ""
) -> Tuple[str, str]:
    """
    Construit le prompt système et utilisateur pour l'analyse.
    🆕 v3.1: Limite de transcription dynamique pour vidéos longues.
    Retourne: (system_prompt, user_prompt)
    """
    epistemic_rules = EPISTEMIC_RULES_FR if lang == "fr" else EPISTEMIC_RULES_EN
    mode_instructions = get_mode_instructions(mode, lang)
    category_instructions = get_category_specific_instructions(category, lang)

    # 🆕 v3.1: Limite dynamique de transcription
    transcript_limit = get_transcript_limit(duration, mode)

    # Déterminer la longueur cible
    cat_info = CATEGORIES.get(category, CATEGORIES["general"])
    min_words, max_words = cat_info["min_words"], cat_info["max_words"]

    # Ajustements selon le mode
    if mode == "accessible":
        min_words, max_words = int(min_words * 0.7), int(max_words * 0.75)
    elif mode == "expert":
        min_words, max_words = int(min_words * 1.8), int(max_words * 2.0)
    
    # Ajustements selon la durée
    if duration > 3600:
        min_words, max_words = int(min_words * 1.3), int(max_words * 1.3)
    if duration > 7200:
        min_words, max_words = int(min_words * 1.5), int(max_words * 1.5)
    
    if lang == "fr":
        system_prompt = f"""Tu es Deep Sight, expert en analyse critique et synthèse de contenu vidéo.

🌐 IMPÉRATIF LINGUISTIQUE: Tu DOIS répondre UNIQUEMENT en français impeccable.
• Utilise un français académique, élégant et bien structuré
• Évite les anglicismes (préfère "apprentissage automatique" à "machine learning")
• Formule des phrases professionnelles et fluides
• Les citations de la vidéo peuvent rester en langue originale si pertinent

{epistemic_rules}

{mode_instructions}

{category_instructions}

═══════════════════════════════════════════════════════════════════════════════
⏱️ TIMECODES CLIQUABLES — MINIMUM 3-5 DANS CHAQUE RÉSUMÉ !
═══════════════════════════════════════════════════════════════════════════════
🎯 Tu DOIS inclure 3 à 5 timecodes [MM:SS] avec CROCHETS dans ta synthèse !
✅ FORMAT STRICT : Utilise [MM:SS] avec des CROCHETS (pas de parenthèses)
✅ EXEMPLES : "L'idée clé arrive à [4:32]" ou "Il explique [7:15] que..."
✅ Pour les longues vidéos : "La partie sur X [12:45] puis Y [25:30]"
❌ INTERDIT : "[XX:XX]" inventé, format (MM:SS) avec parenthèses

═══════════════════════════════════════════════════════════════════════════════
📚 CONCEPTS WIKIPEDIA CLIQUABLES — OBLIGATOIRE !
═══════════════════════════════════════════════════════════════════════════════
⚠️ RÈGLE ABSOLUE : Tu DOIS entourer 5-10 termes importants avec [[double crochets]].
C'est une fonctionnalité ESSENTIELLE de Deep Sight. Sans [[concepts]], la réponse est incomplète.

✅ TERMES À MARQUER OBLIGATOIREMENT :
• Noms de personnes : [[Peter Thiel]], [[Elon Musk]], [[Albert Einstein]]
• Entreprises/Organisations : [[Palantir]], [[Silicon Valley]], [[CIA]], [[ARTE]]
• Concepts techniques : [[intelligence artificielle]], [[Big Data]], [[algorithme]]
• Termes spécifiques : [[surveillance de masse]], [[capitalisme]], [[géopolitique]]

✅ EXEMPLES DE PHRASES CORRECTES :
• "[[Palantir]], fondée par [[Peter Thiel]], collabore avec la [[CIA]]..."
• "Le documentaire explore les enjeux de la [[surveillance de masse]]..."
• "Cette approche utilise l'[[apprentissage automatique]] et le [[Big Data]]..."

❌ NE PAS MARQUER : les mots courants (vidéo, personne, chose, fait, temps)

📊 QUANTITÉ MINIMALE : 5 concepts [[marqués]] par synthèse. Maximum 10.

📊 LONGUEUR CIBLE : {min_words}-{max_words} mots

🌐 RÉPONDS ENTIÈREMENT EN FRANÇAIS IMPECCABLE.
"""
        
        user_prompt = f"""Analyse cette vidéo YouTube :

📺 TITRE : {title}
📺 CHAÎNE : {channel}
⏱️ DURÉE : {duration // 60} minutes
📁 CATÉGORIE : {category}

📝 TRANSCRIPTION :
{transcript[:transcript_limit]}

Génère une synthèse {mode} complète avec timecodes."""

    else:
        system_prompt = f"""You are Deep Sight, expert in critical analysis and video content synthesis.

{epistemic_rules}

{mode_instructions}

═══════════════════════════════════════════════════════════════════════════════
MANDATORY CLICKABLE TIMECODES — MINIMUM 3-5 IN EACH SUMMARY!
═══════════════════════════════════════════════════════════════════════════════
Include exact timecodes from transcript in format [MM:SS] with SQUARE BRACKETS.
Example: "The key idea appears at [4:32]" or "He explains at [7:15] that..."

═══════════════════════════════════════════════════════════════════════════════
📚 WIKIPEDIA CONCEPTS — MANDATORY!
═══════════════════════════════════════════════════════════════════════════════
⚠️ ABSOLUTE RULE: You MUST wrap 5-10 important terms with [[double brackets]].
This is an ESSENTIAL feature of Deep Sight. Without [[concepts]], the response is incomplete.

✅ TERMS TO MARK (REQUIRED):
• People names: [[Peter Thiel]], [[Elon Musk]], [[Albert Einstein]]
• Companies/Organizations: [[Palantir]], [[Silicon Valley]], [[CIA]], [[NASA]]
• Technical concepts: [[artificial intelligence]], [[Big Data]], [[algorithm]]
• Specific terms: [[mass surveillance]], [[capitalism]], [[geopolitics]]

✅ CORRECT SENTENCE EXAMPLES:
• "[[Palantir]], founded by [[Peter Thiel]], collaborates with the [[CIA]]..."
• "The documentary explores [[mass surveillance]] issues..."
• "This approach uses [[machine learning]] and [[Big Data]]..."

❌ DO NOT MARK: common words (video, person, thing, fact, time)

📊 MINIMUM QUANTITY: 5 [[marked]] concepts per summary. Maximum 10.

TARGET LENGTH: {min_words}-{max_words} words

RESPOND ENTIRELY IN ENGLISH.
"""
        
        user_prompt = f"""Analyze this YouTube video:

📺 TITLE: {title}
📺 CHANNEL: {channel}
⏱️ DURATION: {duration // 60} minutes
📁 CATEGORY: {category}

📝 TRANSCRIPT:
{transcript[:transcript_limit]}

Generate a complete {mode} synthesis with timecodes."""

    return system_prompt, user_prompt


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 APPELS API MISTRAL
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_summary(
    title: str,
    transcript: str,
    category: str,
    lang: str,
    mode: str,
    model: str = "mistral-small-latest",
    duration: int = 0,
    channel: str = "",
    description: str = "",
    api_key: str = None,
    web_context: str = None  # 🆕 v3.0: Contexte web pré-analyse
) -> Optional[str]:
    """
    Génère un résumé avec Mistral AI.
    
    🆕 v3.0: Peut recevoir un web_context (de Perplexity) à intégrer dans l'analyse.
    """
    api_key = api_key or get_mistral_key()
    if not api_key:
        print("❌ Mistral API key not configured", flush=True)
        return None
    
    print(f"🧠 Generating summary with {model}...", flush=True)
    print(f"   Title: {title[:60]}...", flush=True)
    print(f"   Category: {category}, Mode: {mode}, Lang: {lang}", flush=True)
    if web_context:
        print(f"   📡 Web context provided: {len(web_context)} chars", flush=True)
    
    system_prompt, user_prompt = build_analysis_prompt(
        title=title,
        transcript=transcript,
        category=category,
        lang=lang,
        mode=mode,
        duration=duration,
        channel=channel,
        description=description
    )
    
    # 🆕 v3.0: Injecter le contexte web dans le prompt utilisateur
    if web_context:
        web_context_formatted = f"""

═══════════════════════════════════════════════════════════════════════════════
📡 CONTEXTE WEB ACTUEL (Recherche Perplexity - {datetime.now().strftime('%Y-%m-%d')})
═══════════════════════════════════════════════════════════════════════════════

{web_context}

═══════════════════════════════════════════════════════════════════════════════
⚠️ INSTRUCTION IMPORTANTE: 
   - Utilise ce contexte web pour ENRICHIR ton analyse
   - Compare les informations de la vidéo avec les données actuelles
   - Signale explicitement les informations qui ont pu ÉVOLUER depuis la vidéo
   - Ajoute une section "📡 Mise à jour" si des infos ont changé
═══════════════════════════════════════════════════════════════════════════════
"""
        user_prompt = user_prompt + web_context_formatted
    
    # 🆕 v3.1: Tokens dynamiques selon mode ET durée de la vidéo
    base_tokens = {
        "accessible": 2500,
        "standard": 5000,
        "expert": 10000
    }.get(mode, 5000)

    # Augmenter les tokens pour les vidéos longues
    if duration > 1800:  # > 30 min
        duration_multiplier = min(2.0, 1.0 + (duration - 1800) / 7200)
        base_tokens = int(base_tokens * duration_multiplier)

    # Vidéos très longues (> 2h) → encore plus de tokens
    if duration > 7200:
        base_tokens = int(base_tokens * 1.3)

    # Limites maximales par mode
    max_token_limits = {
        "accessible": 4000,
        "standard": 12000,
        "expert": 20000
    }
    max_tokens = min(base_tokens, max_token_limits.get(mode, 12000))

    # Augmenter si contexte web (plus de contenu à analyser)
    if web_context:
        max_tokens = int(max_tokens * 1.2)  # +20%
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3
                },
                timeout=180  # 3 minutes pour les longues analyses
            )
            
            if response.status_code == 200:
                data = response.json()
                summary = data["choices"][0]["message"]["content"].strip()
                word_count = len(summary.split())
                print(f"✅ Summary generated: {word_count} words", flush=True)
                return summary
            else:
                print(f"❌ Mistral API error: {response.status_code}", flush=True)
                print(f"   Response: {response.text}", flush=True)
                return None
                
    except Exception as e:
        print(f"❌ Summary generation error: {e}", flush=True)
        return None


async def extract_entities(
    summary: str,
    api_key: str = None,
    lang: str = "fr"
) -> Optional[Dict[str, List[str]]]:
    """
    Extrait les entités (personnes, concepts, organisations) d'un résumé.
    """
    api_key = api_key or get_mistral_key()
    if not api_key or not summary:
        return None
    
    prompt = """Analyse ce résumé et extrait les entités principales en JSON.
Format STRICT (JSON uniquement, sans markdown):
{
    "concepts": ["concept1", "concept2"],
    "persons": ["personne1", "personne2"],
    "organizations": ["org1", "org2"],
    "products": ["produit1", "produit2"]
}

Résumé:
""" if lang == "fr" else """Analyze this summary and extract main entities as JSON.
STRICT format (JSON only, no markdown):
{
    "concepts": ["concept1", "concept2"],
    "persons": ["person1", "person2"],
    "organizations": ["org1", "org2"],
    "products": ["product1", "product2"]
}

Summary:
"""
    
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
                    "messages": [{"role": "user", "content": f"{prompt}\n\n{summary[:3000]}"}],
                    "temperature": 0.1,
                    "max_tokens": 500
                },
                timeout=30
            )
            
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                # Nettoyer le JSON
                content = content.strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                content = content.strip()
                
                return json.loads(content)
    except Exception as e:
        print(f"⚠️ Entity extraction error: {e}", flush=True)
    
    return None


async def calculate_reliability_score(
    summary: str,
    entities: Optional[Dict] = None,
    api_key: str = None,
    lang: str = "fr"
) -> float:
    """
    Calcule un score de fiabilité basé sur les marqueurs épistémiques.
    Score de 0 à 100.
    """
    if not summary:
        return 50.0
    
    # Analyse simple basée sur les marqueurs
    text = summary.lower()
    
    # Marqueurs positifs (augmentent la fiabilité)
    positive_markers = [
        "étude", "recherche", "données", "preuve", "démontré",
        "study", "research", "data", "evidence", "demonstrated",
        "selon", "d'après", "according to", "✅"
    ]
    
    # Marqueurs négatifs (diminuent la fiabilité)
    negative_markers = [
        "opinion", "je pense", "hypothèse", "spéculation",
        "pourrait", "peut-être", "possibly", "might",
        "⚠️", "❓", "non vérifié", "unverified"
    ]
    
    # Calculer le score
    positive_count = sum(1 for m in positive_markers if m in text)
    negative_count = sum(1 for m in negative_markers if m in text)
    
    # Score de base à 60
    score = 60.0
    score += positive_count * 3  # +3 par marqueur positif
    score -= negative_count * 5  # -5 par marqueur négatif
    
    # Bonus si des sources sont citées
    if entities and entities.get("persons"):
        score += min(10, len(entities["persons"]) * 2)
    
    # Limiter entre 20 et 95
    return max(20.0, min(95.0, score))
