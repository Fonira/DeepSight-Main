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

class AnalyzeVideoRequest(BaseModel):
    """Requête pour analyser une vidéo YouTube"""
    url: str = Field(..., description="URL de la vidéo YouTube")
    mode: str = Field(default="standard", description="Mode d'analyse: accessible, standard, expert")
    category: Optional[str] = Field(default=None, description="Catégorie forcée (auto-détection si None)")
    lang: str = Field(default="fr", description="Langue de la synthèse: fr, en")
    model: Optional[str] = Field(default=None, description="Modèle Mistral à utiliser")
    deep_research: bool = Field(default=False, description="🆕 Recherche approfondie (Expert only)")
    force_refresh: bool = Field(default=False, description="🆕 Ignorer le cache et forcer une nouvelle analyse")


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
        
        # URL YouTube ?
        if self.url:
            if "youtube.com" in self.url or "youtu.be" in self.url:
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


class CreditEstimation(BaseModel):
    """Estimation du coût en crédits"""
    base_cost: int = 1
    model_multiplier: float = 1.0
    total_cost: int = 1
    user_credits: int = 0
    sufficient: bool = True
    message: str = ""
