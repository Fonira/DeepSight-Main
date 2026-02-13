"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📋 VIDEO SCHEMAS V2 — Modèles Pydantic pour l'Analyse Personnalisée Avancée       ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Ce module contient tous les schémas pour l'API v2.1 d'analyse vidéo avec:
- Personnalisation avancée (style, anti-IA, focus thématique)
- Analyse des commentaires YouTube
- Métadonnées enrichies (sponsorship, propagande, intention)
"""

from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 ENUMS — Types énumérés
# ═══════════════════════════════════════════════════════════════════════════════

class WritingStyle(str, Enum):
    """
    Style d'écriture pour la synthèse.

    Détermine le ton et le format de la sortie générée.
    """
    NEUTRAL = "neutral"               # Factuel, objectif, équilibré
    ACADEMIC = "academic"             # Style universitaire, formel, citations
    JOURNALISTIC = "journalistic"     # Style journalistique, dynamique, accrocheur
    CONVERSATIONAL = "conversational" # Accessible, décontracté, engageant
    PROFESSIONAL = "professional"     # Business, corporate, synthétique
    CREATIVE = "creative"             # Narratif, storytelling, immersif
    TECHNICAL = "technical"           # Documentation technique, précis
    PEDAGOGICAL = "pedagogical"       # Éducatif, explicatif, structuré


class SentimentType(str, Enum):
    """Type de sentiment détecté dans un commentaire."""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class CommentCategory(str, Enum):
    """Catégorie d'un commentaire YouTube."""
    CONSTRUCTIVE = "constructive"     # Feedback utile, questions pertinentes
    PRAISE = "praise"                 # Compliments, encouragements
    CRITICISM = "criticism"           # Critique (constructive ou non)
    QUESTION = "question"             # Question à l'auteur
    SPAM = "spam"                     # Spam, pub
    TOXIC = "toxic"                   # Commentaire toxique
    OFF_TOPIC = "off_topic"           # Hors sujet
    INFORMATIVE = "informative"       # Ajoute de l'information


class PropagandaRisk(str, Enum):
    """Niveau de risque de propagande/manipulation."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SponsorshipType(str, Enum):
    """Type de sponsorship détecté."""
    NONE = "none"
    DISCLOSED = "disclosed"           # Sponsorship déclaré
    SUSPECTED = "suspected"           # Potentiel non déclaré
    AFFILIATE = "affiliate"           # Liens affiliés
    PRODUCT_PLACEMENT = "product_placement"


class ExpertiseLevel(str, Enum):
    """Niveau d'expertise du public cible."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"


class SummaryLength(str, Enum):
    """Longueur de la synthèse."""
    SHORT = "short"           # ~200 mots
    STANDARD = "standard"     # ~500 mots
    DETAILED = "detailed"     # ~1000+ mots


class AnalysisMode(str, Enum):
    """Mode d'analyse."""
    ACCESSIBLE = "accessible"  # Grand public, simplifié
    STANDARD = "standard"      # Équilibré, détaillé
    EXPERT = "expert"          # Technique, académique


class Priority(str, Enum):
    """Priorité de traitement."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class PrimaryIntent(str, Enum):
    """Intention principale de publication."""
    INFORM = "informer"
    ENTERTAIN = "divertir"
    SELL = "vendre"
    CONVINCE = "convaincre"
    EDUCATE = "éduquer"
    INSPIRE = "inspirer"


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ CUSTOMIZATION — Options de personnalisation
# ═══════════════════════════════════════════════════════════════════════════════

class AnalysisCustomization(BaseModel):
    """
    Options de personnalisation avancées pour l'analyse.

    Permet un contrôle granulaire sur le style, le format et le contenu
    de la synthèse générée.
    """

    # === Prompt utilisateur ===
    user_prompt: Optional[str] = Field(
        default=None,
        description="Instructions personnalisées (ex: 'Focus sur les aspects techniques')",
        max_length=2000
    )

    # === Style d'écriture ===
    writing_style: WritingStyle = Field(
        default=WritingStyle.NEUTRAL,
        description="Style d'écriture de la synthèse"
    )

    # === Anti-détection IA ===
    anti_ai_detection: bool = Field(
        default=False,
        description="Activer les techniques anti-détection IA (Pro/Expert uniquement)"
    )
    humanize_level: int = Field(
        default=0,
        ge=0,
        le=3,
        description="Niveau d'humanisation: 0=off, 1=subtil, 2=modéré, 3=fort"
    )

    # === Focus thématique ===
    focus_topics: List[str] = Field(
        default_factory=list,
        description="Sujets sur lesquels se concentrer",
        max_length=10
    )
    exclude_topics: List[str] = Field(
        default_factory=list,
        description="Sujets à éviter ou minimiser",
        max_length=10
    )

    # === Public cible ===
    target_audience: Optional[str] = Field(
        default=None,
        description="Public cible (ex: 'étudiants', 'professionnels IT')",
        max_length=100
    )
    expertise_level: ExpertiseLevel = Field(
        default=ExpertiseLevel.INTERMEDIATE,
        description="Niveau d'expertise attendu du lecteur"
    )

    # === Format de sortie ===
    include_quotes: bool = Field(
        default=True,
        description="Inclure des citations directes de la vidéo"
    )
    include_statistics: bool = Field(
        default=True,
        description="Inclure les statistiques et chiffres mentionnés"
    )
    bullet_points_preferred: bool = Field(
        default=False,
        description="Préférer les listes à puces au texte continu"
    )
    max_sections: int = Field(
        default=0,
        ge=0,
        le=20,
        description="Nombre max de sections (0=auto)"
    )

    # === Analyse des commentaires ===
    analyze_comments: bool = Field(
        default=False,
        description="Analyser les commentaires YouTube (Pro/Expert)"
    )
    comments_limit: int = Field(
        default=100,
        ge=10,
        le=500,
        description="Nombre de commentaires à analyser"
    )

    # === Métadonnées enrichies ===
    detect_sponsorship: bool = Field(
        default=True,
        description="Détecter les sponsorships et placements de produits"
    )
    detect_propaganda: bool = Field(
        default=False,
        description="Analyser les risques de propagande/désinformation"
    )
    extract_public_figures: bool = Field(
        default=True,
        description="Extraire les personnalités publiques mentionnées"
    )
    analyze_publication_intent: bool = Field(
        default=False,
        description="Analyser l'intention de publication (Pro/Expert)"
    )

    @field_validator('focus_topics', 'exclude_topics')
    @classmethod
    def validate_topics_length(cls, v: List[str]) -> List[str]:
        """Valide que les listes de topics ne sont pas trop longues."""
        if len(v) > 10:
            raise ValueError("Maximum 10 topics autorisés")
        return [topic.strip().lower() for topic in v if topic.strip()]

    @field_validator('user_prompt')
    @classmethod
    def validate_user_prompt(cls, v: Optional[str]) -> Optional[str]:
        """Nettoie le prompt utilisateur."""
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_prompt": "Focus sur les implications éthiques et les controverses",
                "writing_style": "academic",
                "anti_ai_detection": True,
                "humanize_level": 2,
                "focus_topics": ["éthique", "impact social"],
                "target_audience": "chercheurs",
                "analyze_comments": True,
                "detect_propaganda": True
            }
        }
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 💬 COMMENTAIRES YOUTUBE
# ═══════════════════════════════════════════════════════════════════════════════

class YouTubeComment(BaseModel):
    """Un commentaire YouTube analysé avec métadonnées et sentiment."""

    # Identifiants
    comment_id: str = Field(..., description="ID unique du commentaire")
    author: str = Field(..., description="Nom d'affichage de l'auteur")
    author_channel_id: Optional[str] = Field(
        default=None,
        description="ID de la chaîne de l'auteur"
    )

    # Contenu
    text: str = Field(..., description="Texte du commentaire")

    # Métriques
    like_count: int = Field(default=0, ge=0, description="Nombre de likes")
    reply_count: int = Field(default=0, ge=0, description="Nombre de réponses")
    published_at: Optional[datetime] = Field(
        default=None,
        description="Date de publication"
    )

    # Hiérarchie
    is_reply: bool = Field(default=False, description="Est une réponse à un autre commentaire")
    parent_id: Optional[str] = Field(
        default=None,
        description="ID du commentaire parent si c'est une réponse"
    )

    # Analyse de sentiment
    sentiment: SentimentType = Field(
        default=SentimentType.NEUTRAL,
        description="Sentiment détecté"
    )
    sentiment_score: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Score de sentiment (-1 à 1)"
    )

    # Catégorisation
    category: CommentCategory = Field(
        default=CommentCategory.CONSTRUCTIVE,
        description="Catégorie du commentaire"
    )
    is_constructive: bool = Field(
        default=False,
        description="Le commentaire apporte-t-il de la valeur?"
    )
    relevance_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Pertinence par rapport au contenu vidéo"
    )

    # Contenu extrait
    questions_asked: List[str] = Field(
        default_factory=list,
        description="Questions posées dans le commentaire"
    )
    key_points: List[str] = Field(
        default_factory=list,
        description="Points clés mentionnés"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "comment_id": "UgzX1234567890",
                "author": "Jean Dupont",
                "text": "Excellente analyse ! Mais comment appliquer cela dans un contexte professionnel ?",
                "like_count": 42,
                "sentiment": "positive",
                "sentiment_score": 0.75,
                "category": "question",
                "is_constructive": True,
                "questions_asked": ["Comment appliquer cela dans un contexte professionnel ?"]
            }
        }
    }


class CommentsAnalysis(BaseModel):
    """Analyse complète des commentaires d'une vidéo."""

    # Identifiants
    video_id: str = Field(..., description="ID de la vidéo")

    # Statistiques
    total_comments: int = Field(
        default=0,
        ge=0,
        description="Nombre total de commentaires sur la vidéo"
    )
    analyzed_count: int = Field(
        default=0,
        ge=0,
        description="Nombre de commentaires analysés"
    )

    # Distribution des sentiments
    sentiment_distribution: Dict[str, int] = Field(
        default_factory=lambda: {
            "positive": 0,
            "negative": 0,
            "neutral": 0,
            "mixed": 0
        },
        description="Distribution des sentiments"
    )
    average_sentiment: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="Sentiment moyen (-1 à 1)"
    )

    # Distribution des catégories
    category_distribution: Dict[str, int] = Field(
        default_factory=dict,
        description="Distribution par catégorie"
    )

    # Métriques de qualité
    constructive_ratio: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Ratio de commentaires constructifs"
    )
    engagement_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Score d'engagement (likes, réponses)"
    )
    controversy_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Score de controverse (polarisation des opinions)"
    )

    # Contenu agrégé
    top_questions: List[str] = Field(
        default_factory=list,
        description="Questions les plus fréquentes/pertinentes"
    )
    top_criticisms: List[str] = Field(
        default_factory=list,
        description="Critiques les plus fréquentes"
    )
    top_praises: List[str] = Field(
        default_factory=list,
        description="Éloges les plus fréquents"
    )
    key_insights: List[str] = Field(
        default_factory=list,
        description="Insights clés extraits des commentaires"
    )

    # Commentaires représentatifs
    top_constructive: List[YouTubeComment] = Field(
        default_factory=list,
        description="Commentaires les plus constructifs"
    )
    top_critical: List[YouTubeComment] = Field(
        default_factory=list,
        description="Commentaires les plus critiques"
    )

    # Résumé
    summary: Optional[str] = Field(
        default=None,
        description="Résumé généré de l'analyse des commentaires"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "video_id": "dQw4w9WgXcQ",
                "total_comments": 1523,
                "analyzed_count": 100,
                "average_sentiment": 0.42,
                "constructive_ratio": 0.65,
                "controversy_score": 0.15,
                "top_questions": ["Comment fonctionne cette technologie ?"],
                "summary": "Les commentaires sont globalement positifs avec un fort engagement..."
            }
        }
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 MÉTADONNÉES ENRICHIES
# ═══════════════════════════════════════════════════════════════════════════════

class PublicFigure(BaseModel):
    """Une personnalité publique mentionnée dans la vidéo."""

    name: str = Field(..., description="Nom de la personnalité")
    role: Optional[str] = Field(
        default=None,
        description="Rôle/fonction (ex: 'Physicien', 'CEO')"
    )
    organization: Optional[str] = Field(
        default=None,
        description="Organisation affiliée"
    )
    mentions_count: int = Field(
        default=1,
        ge=1,
        description="Nombre de mentions dans la vidéo"
    )
    context: Optional[str] = Field(
        default=None,
        description="Contexte de la mention"
    )
    wikipedia_url: Optional[str] = Field(
        default=None,
        description="URL Wikipedia si disponible"
    )
    sentiment_towards: SentimentType = Field(
        default=SentimentType.NEUTRAL,
        description="Sentiment exprimé envers cette personne"
    )


class SponsorshipInfo(BaseModel):
    """Information sur un sponsorship détecté."""

    type: SponsorshipType = Field(
        default=SponsorshipType.NONE,
        description="Type de sponsorship"
    )
    brands: List[str] = Field(
        default_factory=list,
        description="Marques/entreprises sponsors"
    )
    disclosed: bool = Field(
        default=True,
        description="Le sponsorship est-il déclaré ?"
    )
    disclosure_timestamp: Optional[int] = Field(
        default=None,
        ge=0,
        description="Timestamp de la déclaration (en secondes)"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confiance dans la détection"
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Citations/segments comme preuves"
    )


class PropagandaAnalysis(BaseModel):
    """Analyse des risques de propagande et manipulation."""

    risk_level: PropagandaRisk = Field(
        default=PropagandaRisk.NONE,
        description="Niveau de risque global"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confiance dans l'analyse"
    )

    # Techniques de manipulation détectées
    emotional_manipulation: bool = Field(
        default=False,
        description="Appel excessif aux émotions"
    )
    cherry_picking: bool = Field(
        default=False,
        description="Sélection biaisée des faits"
    )
    false_dichotomy: bool = Field(
        default=False,
        description="Faux dilemme présenté"
    )
    appeal_to_authority: bool = Field(
        default=False,
        description="Argument d'autorité fallacieux"
    )
    loaded_language: bool = Field(
        default=False,
        description="Langage chargé émotionnellement"
    )
    ad_hominem: bool = Field(
        default=False,
        description="Attaques personnelles"
    )
    strawman: bool = Field(
        default=False,
        description="Homme de paille (déformation des arguments)"
    )

    # Détails
    detected_techniques: List[str] = Field(
        default_factory=list,
        description="Liste des techniques détectées"
    )
    problematic_segments: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Segments problématiques avec timestamps"
    )

    # Recommandation
    recommendation: str = Field(
        default="",
        description="Recommandation pour le spectateur"
    )

    @model_validator(mode='after')
    def compute_detected_techniques(self) -> 'PropagandaAnalysis':
        """Construit la liste des techniques détectées."""
        techniques = []
        if self.emotional_manipulation:
            techniques.append("manipulation_émotionnelle")
        if self.cherry_picking:
            techniques.append("cherry_picking")
        if self.false_dichotomy:
            techniques.append("faux_dilemme")
        if self.appeal_to_authority:
            techniques.append("argument_autorité")
        if self.loaded_language:
            techniques.append("langage_chargé")
        if self.ad_hominem:
            techniques.append("ad_hominem")
        if self.strawman:
            techniques.append("homme_de_paille")

        if techniques and not self.detected_techniques:
            self.detected_techniques = techniques
        return self


class PublicationIntent(BaseModel):
    """Analyse de l'intention de publication d'une vidéo."""

    # Intention principale
    primary_intent: PrimaryIntent = Field(
        default=PrimaryIntent.INFORM,
        description="Intention principale de la vidéo"
    )
    secondary_intents: List[PrimaryIntent] = Field(
        default_factory=list,
        description="Intentions secondaires"
    )

    # Scores par catégorie
    educational_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Score éducatif"
    )
    entertainment_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Score divertissement"
    )
    commercial_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Score commercial"
    )
    persuasion_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Score de persuasion"
    )

    # Audience cible détectée
    target_audience: Optional[str] = Field(
        default=None,
        description="Audience cible détectée"
    )
    expertise_level_required: ExpertiseLevel = Field(
        default=ExpertiseLevel.INTERMEDIATE,
        description="Niveau d'expertise requis"
    )

    # Analyse
    call_to_actions: List[str] = Field(
        default_factory=list,
        description="Appels à l'action détectés"
    )
    monetization_detected: bool = Field(
        default=False,
        description="Monétisation détectée"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confiance dans l'analyse"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "primary_intent": "éduquer",
                "educational_score": 0.85,
                "commercial_score": 0.15,
                "target_audience": "étudiants universitaires",
                "call_to_actions": ["Abonnez-vous", "Visitez notre site"],
                "confidence": 0.78
            }
        }
    }


class VideoMetadataEnriched(BaseModel):
    """Métadonnées enrichies d'une vidéo YouTube."""

    # Identifiants
    video_id: str = Field(..., description="ID de la vidéo YouTube")

    # Infos de base
    title: str = Field(..., description="Titre de la vidéo")
    channel: str = Field(..., description="Nom de la chaîne")
    channel_id: Optional[str] = Field(
        default=None,
        description="ID de la chaîne"
    )
    description: Optional[str] = Field(
        default=None,
        description="Description de la vidéo"
    )

    # Métriques
    duration: int = Field(default=0, ge=0, description="Durée en secondes")
    view_count: int = Field(default=0, ge=0, description="Nombre de vues")
    like_count: int = Field(default=0, ge=0, description="Nombre de likes")
    comment_count: int = Field(default=0, ge=0, description="Nombre de commentaires")
    published_at: Optional[datetime] = Field(
        default=None,
        description="Date de publication"
    )

    # Analyse enrichie
    public_figures: List[PublicFigure] = Field(
        default_factory=list,
        description="Personnalités publiques mentionnées"
    )
    sponsorship: Optional[SponsorshipInfo] = Field(
        default=None,
        description="Informations de sponsorship"
    )
    propaganda_analysis: Optional[PropagandaAnalysis] = Field(
        default=None,
        description="Analyse de propagande"
    )
    publication_intent: Optional[PublicationIntent] = Field(
        default=None,
        description="Intention de publication"
    )

    # Tags et catégories
    detected_topics: List[str] = Field(
        default_factory=list,
        description="Sujets détectés"
    )
    youtube_category: Optional[str] = Field(
        default=None,
        description="Catégorie YouTube"
    )
    deepsight_category: Optional[str] = Field(
        default=None,
        description="Catégorie DeepSight"
    )

    # Qualité et fiabilité
    channel_credibility_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Score de crédibilité de la chaîne"
    )
    content_quality_indicators: Dict[str, Any] = Field(
        default_factory=dict,
        description="Indicateurs de qualité du contenu"
    )

    # Timestamps des sections
    chapters: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Chapitres de la vidéo avec timestamps"
    )

    # Liens et sources
    external_links: List[str] = Field(
        default_factory=list,
        description="Liens externes mentionnés"
    )
    sources_mentioned: List[str] = Field(
        default_factory=list,
        description="Sources citées dans la vidéo"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "video_id": "dQw4w9WgXcQ",
                "title": "Comment l'IA transforme la recherche",
                "channel": "Science & Vie",
                "duration": 1245,
                "view_count": 125000,
                "detected_topics": ["intelligence artificielle", "recherche"],
                "deepsight_category": "science_technology"
            }
        }
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUÊTE V2 — Analyse avec personnalisation complète
# ═══════════════════════════════════════════════════════════════════════════════

class AnalyzeRequestV2(BaseModel):
    """
    Requête d'analyse v2.1 avec TOUTES les options de personnalisation.

    C'est la version la plus complète de l'API d'analyse DeepSight.
    """

    # URL de la vidéo (obligatoire)
    url: str = Field(..., description="URL de la vidéo YouTube")

    # Mode et langue
    mode: AnalysisMode = Field(
        default=AnalysisMode.STANDARD,
        description="Mode d'analyse"
    )
    lang: str = Field(
        default="fr",
        pattern=r"^(fr|en|es|de|it|pt)$",
        description="Langue de synthèse: fr, en, es, de, it, pt"
    )

    # Modèle IA
    model: Optional[str] = Field(
        default=None,
        description="Modèle IA: mistral-small-latest, mistral-medium-latest, mistral-large-latest"
    )

    # Catégorie
    category: Optional[str] = Field(
        default=None,
        description="Catégorie forcée (None = auto-détection)"
    )

    # Personnalisation avancée
    customization: Optional[AnalysisCustomization] = Field(
        default=None,
        description="Options de personnalisation avancées"
    )

    # Options d'analyse
    deep_research: bool = Field(
        default=False,
        description="Recherche web approfondie (Pro/Expert)"
    )
    include_entities: bool = Field(
        default=True,
        description="Extraire les entités (personnes, concepts, organisations)"
    )
    include_timestamps: bool = Field(
        default=True,
        description="Inclure les timestamps dans l'analyse"
    )
    include_reliability: bool = Field(
        default=True,
        description="Calculer le score de fiabilité"
    )

    # Options de sortie
    summary_length: SummaryLength = Field(
        default=SummaryLength.STANDARD,
        description="Longueur de la synthèse"
    )
    highlight_key_points: bool = Field(
        default=True,
        description="Mettre en évidence les points clés"
    )
    generate_toc: bool = Field(
        default=False,
        description="Générer une table des matières"
    )

    # Cache et performance
    force_refresh: bool = Field(
        default=False,
        description="Ignorer le cache"
    )
    priority: Priority = Field(
        default=Priority.NORMAL,
        description="Priorité de traitement"
    )

    # Webhook
    webhook_url: Optional[str] = Field(
        default=None,
        description="URL de callback quand l'analyse est terminée"
    )

    @field_validator('url')
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        """Valide que l'URL est une URL YouTube valide."""
        v = v.strip()
        if not any(domain in v for domain in ['youtube.com', 'youtu.be']):
            raise ValueError("L'URL doit être une URL YouTube valide")
        return v

    @field_validator('model')
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        """Valide le modèle IA."""
        if v is None:
            return None
        valid_models = [
            'mistral-small-latest',
            'mistral-medium-latest',
            'mistral-large-latest'
        ]
        if v not in valid_models:
            raise ValueError(f"Modèle invalide. Valeurs acceptées: {', '.join(valid_models)}")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "mode": "expert",
                "lang": "fr",
                "customization": {
                    "user_prompt": "Focus sur les aspects scientifiques et les sources citées",
                    "writing_style": "academic",
                    "anti_ai_detection": True,
                    "humanize_level": 2,
                    "analyze_comments": True,
                    "detect_propaganda": True,
                    "analyze_publication_intent": True
                },
                "deep_research": True,
                "summary_length": "detailed"
            }
        }
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 RÉPONSE V2 — Résultat enrichi
# ═══════════════════════════════════════════════════════════════════════════════

class AnalyzeResponseV2(BaseModel):
    """Réponse enrichie de l'analyse v2.1."""

    # Status de la tâche
    task_id: str = Field(..., description="ID unique de la tâche")
    status: str = Field(
        ...,
        description="Status: pending, processing, completed, failed"
    )
    progress: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Progression 0-100%"
    )
    message: Optional[str] = Field(
        default=None,
        description="Message de status"
    )
    estimated_duration_seconds: Optional[int] = Field(
        default=None,
        ge=0,
        description="Durée estimée restante"
    )
    cost: int = Field(
        default=1,
        ge=0,
        description="Coût en crédits"
    )

    # Infos vidéo enrichies
    video_info: Optional[VideoMetadataEnriched] = Field(
        default=None,
        description="Métadonnées enrichies de la vidéo"
    )

    # Options appliquées
    applied_customization: Optional[AnalysisCustomization] = Field(
        default=None,
        description="Options de personnalisation appliquées"
    )

    # Résultats partiels
    comments_analysis: Optional[CommentsAnalysis] = Field(
        default=None,
        description="Analyse des commentaires (si demandée)"
    )

    # Erreur
    error: Optional[str] = Field(
        default=None,
        description="Message d'erreur si échec"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "task_id": "abc123-def456",
                "status": "processing",
                "progress": 45,
                "message": "Analyse du contenu en cours...",
                "estimated_duration_seconds": 30,
                "cost": 2
            }
        }
    }
