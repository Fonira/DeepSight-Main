"""
🔧 CORE MODULE — Configuration et sécurité
"""

from .config import *

# Import sécurité avec fallback
try:
    from .security import (
        check_can_analyze, reserve_credits, consume_reserved_credits,
        release_reserved_credits, check_rate_limit, get_credit_cost,
        get_user_credits_info, blacklist_token, is_token_blacklisted,
        check_chat_quota, check_web_search_quota, check_playlist_access
    )
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
