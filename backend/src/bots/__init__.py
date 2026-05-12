"""Bots prospection B2B — Telegram + Luffa.

Module dédié à la qualification de leads gérants de mini-apps via deux bots
conversationnels indépendants partageant un même `ConversationEngine`.

Voir docs/bots-prospection-archi.md pour l'architecture complète.
"""

from .config import bot_settings

__all__ = ["bot_settings"]
