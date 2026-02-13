from .router import router
from .service import (
    get_summary_by_id,
    get_user_history,
    create_task,
    get_task,
    update_task_status
)
from .analysis import CATEGORIES, detect_category
from .schemas import (
    AnalyzeVideoRequest, SummaryResponse, 
    HistoryResponse, TaskStatusResponse,
    # v2.1 schemas
    WritingStyle, AnalysisCustomization, AnalyzeRequestV2,
    YouTubeComment, CommentsAnalysis,
    VideoMetadataEnriched, PublicationIntent
)

# v2.1 modules
try:
    from .youtube_comments import analyze_comments, fetch_youtube_comments
    from .metadata_enriched import get_enriched_metadata, detect_sponsorship, detect_propaganda_risk
    from .anti_ai_prompts import build_customized_prompt, get_anti_ai_prompt, get_style_instruction
except ImportError:
    pass  # Modules optionnels
