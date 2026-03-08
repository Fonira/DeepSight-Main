"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📋 VIDEO SCHEMAS — Modèles Pydantic pour les vidéos                               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUÊTES (Input)
# ═══════════════════════════════════════════════════════════════════════════════

class GuestAnalyzeRequest(BaseModel):
    """Requête pour analyse demo guest (sans authentification)"""
    url: str = Field(..., description="URL de la vidéo YouTube")


class GuestAnalyzeResponse(BaseModel):
    """Réponse de l'analyse guest (éphémère, non sauvegardée)"""
    video_title: str
    video_channel: str
    video_duration: int
    thumbnail_url: str
    summary_content: str
    category: str
    word_count: int
    mode: str = "accessible"
    lang: str = "fr"
    remaining_analyses: int = 0


class AnalyzeVideoRequest(BaseModel):
    """Requête pour analyser une vidéo YouTube ou TikTok"""
    url: str = Field(..., description="URL de la vidéo YouTube ou TikTok")
    mode: str = Field(default="standard", description="Mode d'analyse: accessible, standard, expert")
    category: Optional[str] = Field(default=None, description="Catégorie forcée (auto-détection si None)")
    lang: str = Field(default="fr", description="Langue de la synthèse: fr, en")
    model: Optional[str] = Field(default=None, description="Modèle Mistral à utiliser")
    deep_research: bool = Field(default=False, description="🆕 Recherche approfondie (Expert only)")
    force_refresh: bool = Field(default=False, description="🆕 Ignorer le cache et forcer une nouvelle analyse")


class AnalyzeVideoV2Request(BaseModel):
    """
    🆕 v2.0: Requête d'analyse avec customization complète.

    Permet un contrôle fin de tous les paramètres d'analyse.
    Supporte YouTube et TikTok.
    """
    url: str = Field(..., description="URL de la vidéo YouTube ou TikTok")

    # Mode et langue
    mode: str = Field(default="standard", description="Mode: accessible, standard, expert")
    lang: str = Field(default="fr", description="Langue: fr, en, es, de, it, pt")

    # Modèle IA
    model: Optional[str] = Field(default=None, description="Modèle: mistral-small-latest, mistral-medium-latest, mistral-large-latest")

    # Catégorie
    category: Optional[str] = Field(default=None, description="Catégorie forcée (None = auto-détection)")

    # 🆕 Options de customization (objet complet)
    customization: Optional[Dict[str, Any]] = Field(default=None, description="Options de customization avancées")

    # 🆕 Champs de personnalisation top-level (envoyés par le frontend v4)
    user_prompt: Optional[str] = Field(default=None, description="Instructions personnalisées de l'utilisateur", max_length=2000)
    anti_ai_detection: bool = Field(default=False, description="Activer les techniques anti-détection IA")
    writing_style: Optional[str] = Field(default=None, description="Style d'écriture: default, human, academic, casual")
    target_length: Optional[str] = Field(default=None, description="Longueur cible: short, medium, long, auto")

    # Options d'analyse
    deep_research: bool = Field(default=False, description="Recherche web approfondie (Pro/Expert)")
    include_entities: bool = Field(default=True, description="Extraire les entités (personnes, concepts)")
    include_timestamps: bool = Field(default=True, description="Inclure les timestamps dans l'analyse")
    include_reliability: bool = Field(default=True, description="Calculer le score de fiabilité")

    # Options de sortie
    summary_length: str = Field(default="standard", description="Longueur: short, standard, detailed")
    highlight_key_points: bool = Field(default=True, description="Mettre en évidence les points clés")
    generate_toc: bool = Field(default=False, description="Générer une table des matières")

    # Cache et performance
    force_refresh: bool = Field(default=False, description="Ignorer le cache")
    priority: str = Field(default="normal", description="Priorité: low, normal, high (Pro/Expert)")

    # Webhook (pour notifications externes)
    webhook_url: Optional[str] = Field(default=None, description="URL de callback quand l'analyse est terminée")

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "mode": "standard",
                "lang": "fr",
                "deep_research": False,
                "customization": {
                    "focus_topics": ["technologie", "innovation"],
                    "exclude_topics": [],
                    "tone": "neutral",
                    "audience": "general"
                },
                "summary_length": "standard",
                "highlight_key_points": True
            }
        }


class AnalyzeV2Response(BaseModel):
    """Réponse de l'endpoint /analyze/v2"""
    task_id: str
    status: str
    progress: int = 0
    message: Optional[str] = None
    estimated_duration_seconds: Optional[int] = None
    cost: int = 1

    # Infos vidéo (si disponibles immédiatement)
    video_info: Optional[Dict[str, Any]] = None

    # Options appliquées
    applied_options: Optional[Dict[str, Any]] = None

    # Erreur si échec immédiat
    error: Optional[str] = None


class AnalyzePlaylistRequest(BaseModel):
    """Requête pour analyser une playlist YouTube"""
    url: str = Field(..., description="URL de la playlist YouTube")
    mode: str = Field(default="standard")
    category: Optional[str] = None
    lang: str = Field(default="fr")
    max_videos: Optional[int] = Field(default=50, description="Nombre max de vidéos à analyser")
    generate_meta_analysis: bool = Field(default=True, description="Générer une méta-analyse")


class ExportRequest(BaseModel):
    """Requête pour exporter une analyse"""
    format: str = Field(..., description="Format d'export: txt, md, json, docx, pdf")


class UpdateSummaryRequest(BaseModel):
    """Requête pour mettre à jour un résumé"""
    is_favorite: Optional[bool] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 RÉPONSES (Output)
# ═══════════════════════════════════════════════════════════════════════════════

class VideoInfoResponse(BaseModel):
    """Informations de base sur une vidéo"""
    video_id: str
    title: str
    channel: str
    duration: int  # En secondes
    thumbnail_url: str
    upload_date: Optional[str] = None
    platform: str = Field(default="youtube", description="Plateforme source: youtube, tiktok")


class EntitiesResponse(BaseModel):
    """Entités extraites d'une vidéo"""
    concepts: List[str] = []
    persons: List[str] = []
    organizations: List[str] = []
    products: List[str] = []


class FactCheckResponse(BaseModel):
    """Résultat du fact-checking"""
    reliability_score: float = Field(ge=0, le=100)
    summary: str
    sources_cited: int
    potential_biases: List[str] = []


class SummaryResponse(BaseModel):
    """Réponse complète d'une analyse de vidéo"""
    id: int
    video_id: str
    video_title: str
    video_channel: str
    video_duration: int
    video_url: str
    thumbnail_url: str
    platform: str = Field(default="youtube", description="Plateforme source: youtube, tiktok")

    category: str
    category_confidence: Optional[float] = None
    lang: str
    mode: str
    model_used: str
    
    summary_content: str
    word_count: int
    reliability_score: Optional[float] = None
    
    entities: Optional[Dict[str, List[str]]] = None
    fact_check: Optional[str] = None
    tags: Optional[str] = None
    
    is_favorite: bool = False
    notes: Optional[str] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class SummaryListItem(BaseModel):
    """Item dans la liste des résumés (version légère)"""
    id: int
    video_id: str
    video_title: str
    video_channel: str
    video_duration: int
    thumbnail_url: str
    platform: str = Field(default="youtube", description="Plateforme source: youtube, tiktok")
    category: str
    mode: str
    word_count: int
    reliability_score: Optional[float] = None
    is_favorite: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class HistoryResponse(BaseModel):
    """Réponse paginée de l'historique"""
    items: List[SummaryListItem]
    total: int
    page: int
    per_page: int
    pages: int


class CategoryResponse(BaseModel):
    """Réponse des catégories disponibles"""
    categories: Dict[str, Dict[str, str]]


class TaskStatusResponse(BaseModel):
    """Status d'une tâche en cours (analyse longue)"""
    task_id: str
    status: str  # pending, processing, completed, failed
    progress: int = 0  # 0-100
    message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    platform: Optional[str] = Field(default=None, description="Plateforme source: youtube, tiktok")


class PlaylistAnalysisResponse(BaseModel):
    """Réponse d'une analyse de playlist"""
    id: int
    playlist_id: str
    playlist_title: str
    playlist_url: str
    num_videos: int
    num_processed: int
    status: str
    meta_analysis: Optional[str] = None
    summaries: List[SummaryListItem] = []
    total_duration: int = 0
    total_words: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 INTELLIGENT DISCOVERY — Recherche intelligente de vidéos
# ═══════════════════════════════════════════════════════════════════════════════

from enum import Enum


class InputType(str, Enum):
    """Type d'entrée pour l'analyse hybride"""
    URL = "url"
    RAW_TEXT = "raw_text"
    SEARCH = "search"


class ContentTypeEnum(str, Enum):
    """Type de contenu recherché"""
    DOCUMENTARY = "documentary"
    INTERVIEW = "interview"
    LECTURE = "lecture"
    EXPLAINER = "explainer"
    NEWS = "news"
    PODCAST = "podcast"
    TUTORIAL = "tutorial"
    ANY = "any"


class HybridAnalyzeRequest(BaseModel):
    """
    Requête d'analyse hybride unifiée.
    Supporte: URL YouTube, texte brut, ou recherche intelligente.
    """
    # Type d'entrée (auto-détecté si non spécifié)
    input_type: Optional[InputType] = None
    
    # Pour URL mode
    url: Optional[str] = Field(default=None, description="URL YouTube")
    
    # Pour RAW_TEXT mode
    raw_text: Optional[str] = Field(default=None, description="Texte brut à analyser (100-500k caractères)")
    text_title: Optional[str] = Field(default=None, description="Titre du texte (optionnel)")
    text_source: Optional[str] = Field(default=None, description="Source du texte (optionnel)")
    
    # Pour SEARCH mode
    search_query: Optional[str] = Field(default=None, description="Requête de recherche")
    search_languages: List[str] = Field(default=["fr", "en"], description="Langues de recherche")
    auto_select_best: bool = Field(default=False, description="Sélectionner automatiquement la meilleure vidéo")
    
    # Options communes
    mode: str = Field(default="standard", description="Mode d'analyse: accessible, standard, expert")
    category: Optional[str] = Field(default=None, description="Catégorie forcée")
    lang: str = Field(default="fr", description="Langue de synthèse")
    model: Optional[str] = Field(default=None, description="Modèle Mistral")
    deep_research: bool = Field(default=False, description="Recherche approfondie (Expert)")
    
    def detect_input_type(self) -> InputType:
        """Détecte automatiquement le type d'entrée"""
        if self.input_type:
            return self.input_type

        # URL YouTube ou TikTok ?
        if self.url:
            if "youtube.com" in self.url or "youtu.be" in self.url:
                return InputType.URL
            if "tiktok.com" in self.url or "vm.tiktok.com" in self.url:
                return InputType.URL
        
        # Texte brut ?
        if self.raw_text and len(self.raw_text) > 100:
            return InputType.RAW_TEXT
        
        # Recherche ?
        if self.search_query:
            return InputType.SEARCH
        
        # Fallback: traiter comme recherche si rien d'autre
        if self.url or self.raw_text:
            # URL non-YouTube ou texte court = recherche
            return InputType.SEARCH
        
        raise ValueError("Impossible de déterminer le type d'entrée")


class SmartDiscoveryRequest(BaseModel):
    """Requête de découverte intelligente de vidéos v4.0"""
    query: str = Field(..., description="Requête de recherche")
    languages: List[str] = Field(default=["fr", "en"], description="Langues cibles (max 6)")
    max_results: int = Field(default=30, ge=1, le=50, description="Nombre max de résultats (augmenté à 50)")
    min_quality: float = Field(default=25.0, ge=0, le=100, description="Score qualité minimum")
    target_duration: str = Field(default="default", description="Durée cible: short, medium, long, default")
    content_types: List[ContentTypeEnum] = Field(
        default=[ContentTypeEnum.ANY],
        description="Types de contenu recherchés"
    )


class PlaylistFromSearchRequest(BaseModel):
    """Créer une playlist à partir d'une recherche"""
    query: str = Field(..., description="Requête de recherche")
    num_videos: int = Field(default=5, ge=2, le=20, description="Nombre de vidéos")
    languages: List[str] = Field(default=["fr", "en"])
    mode: str = Field(default="standard")
    lang: str = Field(default="fr")
    model: Optional[str] = None


class VideoCandidateResponse(BaseModel):
    """Candidat vidéo dans les résultats de découverte v4.0"""
    video_id: str
    title: str
    channel: str
    channel_id: str = ""
    description: str = ""
    thumbnail_url: str = ""
    duration: int = 0
    view_count: int = 0
    like_count: int = 0
    published_at: Optional[str] = None
    platform: str = Field(default="youtube", description="Plateforme source: youtube, tiktok")
    
    # 🌻 Tournesol
    is_tournesol_pick: bool = False
    tournesol_score: float = 0.0
    
    # Scores
    academic_score: float = 0.0
    engagement_score: float = 0.0
    freshness_score: float = 0.0
    duration_score: float = 0.0
    clickbait_penalty: float = 0.0
    quality_score: float = 0.0
    
    # 🆕 v4.0: Métadonnées enrichies
    matched_query_terms: List[str] = []
    detected_sources: int = 0
    content_type: str = "unknown"
    language: str = "unknown"  # 🆕 Langue détectée de la vidéo


class DiscoveryResponse(BaseModel):
    """Réponse de découverte intelligente"""
    query: str
    reformulated_queries: List[str]
    candidates: List[VideoCandidateResponse]
    total_searched: int
    languages_searched: List[str]
    search_duration_ms: int
    tournesol_available: bool


class RawTextAnalysisResponse(BaseModel):
    """Réponse d'analyse de texte brut"""
    task_id: str
    status: str
    message: str
    text_id: str
    char_count: int
    word_count: int
    estimated_duration: int  # En secondes


class HybridAnalysisResponse(BaseModel):
    """Réponse unifiée pour l'analyse hybride"""
    input_type: InputType
    
    # Pour URL et RAW_TEXT: analyse lancée
    task_id: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    
    # Pour SEARCH: candidats à choisir
    discovery: Optional[DiscoveryResponse] = None
    
    # Si auto_select_best et SEARCH
    selected_video: Optional[VideoCandidateResponse] = None
    
    # Résultat direct si en cache
    result: Optional[Dict[str, Any]] = None


class ExtensionKeyPoint(BaseModel):
    """Un point clé condensé pour l'extension Chrome."""
    type: str = Field(..., description="Type: strong, weak, insight, data")
    icon: str = Field(..., description="Emoji icon: ✅, ⚠️, 💡, 📊")
    text: str = Field(..., description="Texte condensé (max 80 chars)")


class ExtensionSummary(BaseModel):
    """Résumé condensé pour l'extension Chrome."""
    verdict: str = Field(..., description="Verdict court de l'analyse")
    confidence_score: int = Field(ge=0, le=100, description="Score de confiance 0-100")
    category: str = Field(..., description="Catégorie détectée")
    key_points: List[ExtensionKeyPoint] = Field(default_factory=list, description="3-6 points clés")
    tags: List[str] = Field(default_factory=list, description="Tags thématiques")
    video_title: str = Field(..., description="Titre de la vidéo")
    full_analysis_url: str = Field(..., description="URL vers l'analyse complète")


class ExtensionSummaryResponse(BaseModel):
    """Réponse condensée pour l'extension Chrome (format=extension)."""
    extension_summary: ExtensionSummary


class CreditEstimation(BaseModel):
    """Estimation du coût en crédits"""
    base_cost: int = 1
    model_multiplier: float = 1.0
    total_cost: int = 1
    user_credits: int = 0
    sufficient: bool = True
    message: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 V2.1 — ANALYSE PERSONNALISÉE AVANCÉE
# ═══════════════════════════════════════════════════════════════════════════════

class WritingStyle(str, Enum):
    """Style d'écriture pour la synthèse"""
    NEUTRAL = "neutral"           # Factuel, objectif
    ACADEMIC = "academic"         # Style universitaire, formel
    JOURNALISTIC = "journalistic" # Style journalistique, dynamique
    CONVERSATIONAL = "conversational"  # Accessible, décontracté
    PROFESSIONAL = "professional"  # Business, corporate
    CREATIVE = "creative"         # Narratif, storytelling
    TECHNICAL = "technical"       # Documentation technique
    PEDAGOGICAL = "pedagogical"   # Éducatif, explicatif


class SentimentType(str, Enum):
    """Type de sentiment d'un commentaire"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class CommentCategory(str, Enum):
    """Catégorie d'un commentaire YouTube"""
    CONSTRUCTIVE = "constructive"     # Feedback utile, questions pertinentes
    PRAISE = "praise"                 # Compliments, encouragements
    CRITICISM = "criticism"           # Critique (constructive ou non)
    QUESTION = "question"             # Question à l'auteur
    SPAM = "spam"                     # Spam, pub
    TOXIC = "toxic"                   # Commentaire toxique
    OFF_TOPIC = "off_topic"           # Hors sujet
    INFORMATIVE = "informative"       # Ajoute de l'information


class PropagandaRisk(str, Enum):
    """Niveau de risque de propagande"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SponsorshipType(str, Enum):
    """Type de sponsorship détecté"""
    NONE = "none"
    DISCLOSED = "disclosed"           # Sponsorship déclaré
    SUSPECTED = "suspected"           # Potentiel non déclaré
    AFFILIATE = "affiliate"           # Liens affiliés
    PRODUCT_PLACEMENT = "product_placement"


class AnalysisCustomization(BaseModel):
    """
    🆕 Options de personnalisation avancées pour l'analyse.
    
    Permet un contrôle granulaire sur le style, le format et le contenu.
    """
    # === Prompt utilisateur ===
    user_prompt: Optional[str] = Field(
        default=None,
        description="Instructions personnalisées de l'utilisateur (ex: 'Focus sur les aspects techniques')",
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
        description="🔒 Activer les techniques anti-détection IA (Pro/Expert uniquement)"
    )
    humanize_level: int = Field(
        default=0,
        ge=0,
        le=3,
        description="Niveau d'humanisation: 0=off, 1=subtil, 2=modéré, 3=fort"
    )
    
    # === Focus thématique ===
    focus_topics: List[str] = Field(
        default=[],
        description="Sujets sur lesquels se concentrer",
        max_length=10
    )
    exclude_topics: List[str] = Field(
        default=[],
        description="Sujets à éviter ou minimiser",
        max_length=10
    )
    
    # === Public cible ===
    target_audience: Optional[str] = Field(
        default=None,
        description="Public cible (ex: 'étudiants', 'professionnels IT', 'grand public')"
    )
    expertise_level: str = Field(
        default="intermediate",
        description="Niveau d'expertise attendu: beginner, intermediate, expert"
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
        description="🆕 Analyser les commentaires YouTube (Pro/Expert)"
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
        description="🆕 Analyser les risques de propagande/désinformation"
    )
    extract_public_figures: bool = Field(
        default=True,
        description="Extraire les personnalités publiques mentionnées"
    )
    analyze_publication_intent: bool = Field(
        default=False,
        description="🆕 Analyser l'intention de publication (Pro/Expert)"
    )

    class Config:
        json_schema_extra = {
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


# ═══════════════════════════════════════════════════════════════════════════════
# 💬 COMMENTAIRES YOUTUBE
# ═══════════════════════════════════════════════════════════════════════════════

class YouTubeComment(BaseModel):
    """Un commentaire YouTube analysé"""
    comment_id: str
    author: str
    author_channel_id: Optional[str] = None
    text: str
    like_count: int = 0
    reply_count: int = 0
    published_at: Optional[datetime] = None
    is_reply: bool = False
    parent_id: Optional[str] = None
    
    # Analyse
    sentiment: SentimentType = SentimentType.NEUTRAL
    sentiment_score: float = Field(default=0.0, ge=-1.0, le=1.0)
    category: CommentCategory = CommentCategory.CONSTRUCTIVE
    is_constructive: bool = False
    relevance_score: float = Field(default=0.0, ge=0.0, le=1.0)
    
    # Contenu extrait
    questions_asked: List[str] = []
    key_points: List[str] = []


class CommentsAnalysis(BaseModel):
    """Analyse complète des commentaires d'une vidéo"""
    video_id: str
    total_comments: int
    analyzed_count: int
    
    # Distribution des sentiments
    sentiment_distribution: Dict[str, int] = {
        "positive": 0,
        "negative": 0,
        "neutral": 0,
        "mixed": 0
    }
    average_sentiment: float = 0.0
    
    # Distribution des catégories
    category_distribution: Dict[str, int] = {}
    
    # Métriques
    constructive_ratio: float = 0.0
    engagement_score: float = 0.0
    controversy_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Score de controverse (polarisation)")
    
    # Contenu agrégé
    top_questions: List[str] = []
    top_criticisms: List[str] = []
    top_praises: List[str] = []
    key_insights: List[str] = []
    
    # Commentaires représentatifs
    top_constructive: List[YouTubeComment] = []
    top_critical: List[YouTubeComment] = []
    
    # Résumé généré
    summary: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 MÉTADONNÉES ENRICHIES
# ═══════════════════════════════════════════════════════════════════════════════

class PublicFigure(BaseModel):
    """Une personnalité publique mentionnée"""
    name: str
    role: Optional[str] = None  # Ex: "Physicien", "Politicien", "CEO"
    organization: Optional[str] = None
    mentions_count: int = 1
    context: Optional[str] = None  # Contexte de la mention
    wikipedia_url: Optional[str] = None
    sentiment_towards: SentimentType = SentimentType.NEUTRAL


class SponsorshipInfo(BaseModel):
    """Information sur un sponsorship détecté"""
    type: SponsorshipType = SponsorshipType.NONE
    brands: List[str] = []
    disclosed: bool = True
    disclosure_timestamp: Optional[int] = None  # En secondes
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence: List[str] = []  # Citations/segments


class PropagandaAnalysis(BaseModel):
    """Analyse des risques de propagande"""
    risk_level: PropagandaRisk = PropagandaRisk.NONE
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    
    # Indicateurs détectés
    emotional_manipulation: bool = False
    cherry_picking: bool = False
    false_dichotomy: bool = False
    appeal_to_authority: bool = False
    loaded_language: bool = False
    ad_hominem: bool = False
    strawman: bool = False
    
    # Détails
    detected_techniques: List[str] = []
    problematic_segments: List[Dict[str, Any]] = []
    
    # Recommandation
    recommendation: str = ""


class PublicationIntent(BaseModel):
    """Analyse de l'intention de publication"""
    primary_intent: str = "informer"  # informer, divertir, vendre, convaincre, éduquer
    secondary_intents: List[str] = []
    
    # Scores
    educational_score: float = Field(default=0.0, ge=0.0, le=1.0)
    entertainment_score: float = Field(default=0.0, ge=0.0, le=1.0)
    commercial_score: float = Field(default=0.0, ge=0.0, le=1.0)
    persuasion_score: float = Field(default=0.0, ge=0.0, le=1.0)
    
    # Audience cible détectée
    target_audience: Optional[str] = None
    expertise_level_required: str = "general"
    
    # Analyse
    call_to_actions: List[str] = []
    monetization_detected: bool = False
    confidence: float = 0.0


class VideoMetadataEnriched(BaseModel):
    """Métadonnées enrichies d'une vidéo"""
    video_id: str
    
    # Infos de base
    title: str
    channel: str
    channel_id: Optional[str] = None
    duration: int = 0
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    published_at: Optional[datetime] = None
    
    # Analyse enrichie
    public_figures: List[PublicFigure] = []
    sponsorship: SponsorshipInfo = SponsorshipInfo()
    propaganda_analysis: Optional[PropagandaAnalysis] = None
    publication_intent: Optional[PublicationIntent] = None
    
    # Tags et catégories
    detected_topics: List[str] = []
    youtube_category: Optional[str] = None
    deepsight_category: Optional[str] = None
    
    # Qualité et fiabilité
    channel_credibility_score: Optional[float] = None
    content_quality_indicators: Dict[str, Any] = {}
    
    # Timestamps des sections
    chapters: List[Dict[str, Any]] = []
    
    # Liens externes mentionnés
    external_links: List[str] = []
    sources_mentioned: List[str] = []


# ═══════════════════════════════════════════════════════════════════════════════
# 🆕 REQUÊTE V2.1 AVEC CUSTOMIZATION COMPLÈTE
# ═══════════════════════════════════════════════════════════════════════════════

class AnalyzeRequestV2(BaseModel):
    """
    🆕 v2.1: Requête d'analyse avec TOUTES les options de personnalisation.

    C'est la version la plus complète de l'API d'analyse.
    Supporte YouTube et TikTok.
    """
    url: str = Field(..., description="URL de la vidéo YouTube ou TikTok")
    
    # Mode et langue
    mode: str = Field(default="standard", description="Mode: accessible, standard, expert")
    lang: str = Field(default="fr", description="Langue: fr, en, es, de, it, pt")
    
    # Modèle IA
    model: Optional[str] = Field(default=None, description="Modèle IA à utiliser")
    
    # Catégorie
    category: Optional[str] = Field(default=None, description="Catégorie forcée (None = auto-détection)")
    
    # 🆕 Customization avancée
    customization: Optional[AnalysisCustomization] = Field(
        default=None,
        description="Options de personnalisation avancées"
    )
    
    # Options d'analyse
    deep_research: bool = Field(default=False, description="Recherche web approfondie (Pro/Expert)")
    include_entities: bool = Field(default=True, description="Extraire les entités")
    include_timestamps: bool = Field(default=True, description="Inclure les timestamps")
    include_reliability: bool = Field(default=True, description="Calculer le score de fiabilité")
    
    # Options de sortie
    summary_length: str = Field(default="standard", description="Longueur: short, standard, detailed")
    highlight_key_points: bool = Field(default=True, description="Mettre en évidence les points clés")
    generate_toc: bool = Field(default=False, description="Générer une table des matières")
    
    # Cache et performance
    force_refresh: bool = Field(default=False, description="Ignorer le cache")
    priority: str = Field(default="normal", description="Priorité: low, normal, high")
    
    # Webhook
    webhook_url: Optional[str] = Field(default=None, description="URL de callback")
    
    class Config:
        json_schema_extra = {
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


class AnalyzeResponseV2(BaseModel):
    """Réponse enrichie de l'analyse v2.1"""
    task_id: str
    status: str
    progress: int = 0
    message: Optional[str] = None
    estimated_duration_seconds: Optional[int] = None
    cost: int = 1
    
    # Infos vidéo
    video_info: Optional[VideoMetadataEnriched] = None
    
    # Options appliquées
    applied_customization: Optional[AnalysisCustomization] = None
    
    # Résultats partiels (si disponibles)
    comments_analysis: Optional[CommentsAnalysis] = None
    
    # Erreur
    error: Optional[str] = None
