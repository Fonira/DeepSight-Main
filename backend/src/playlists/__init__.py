"""
📚 PLAYLIST MODULE v5.0 — Pipeline parallèle + chunking adaptatif
═══════════════════════════════════════════════════════════════════════════════
- Analyse de playlists YouTube (1-100 vidéos)
- Analyse de corpus (URLs individuelles)
- 🆕 v5.0: Traitement parallèle (3 vidéos simultanées)
- 🆕 v5.0: Chunking adaptatif pour vidéos longues (1h30-4h+)
- 🆕 v5.0: Méta-analyse multi-pass (thèmes → connexions → synthèse)
- Chat intelligent sur corpus
- Modes: accessible | standard | expert
"""

from .router import router

__all__ = ["router"]
