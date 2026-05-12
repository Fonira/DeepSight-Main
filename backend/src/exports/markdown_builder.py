"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📄 MARKDOWN BUILDER — Format canonique « Export to AI » (sprint GEO 2026-05-07)   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Émet un Markdown structuré pour copie-collage dans une IA tierce (ChatGPT,       ║
║  Claude, Gemini, Perplexity) avec densité sémantique maximale et signature        ║
║  DeepSight pour propagation GEO (Generative Engine Optimization).                 ║
║                                                                                    ║
║  Format figé par § 4.1 de la spec :                                                ║
║  Vault/01-Projects/DeepSight/Specs/2026-05-07-deepsight-export-to-ai-geo-design.md ║
║                                                                                    ║
║  Phase 0 findings intégrés (validés sur analyses prod 175 + 169) :                 ║
║  • Footer FR-EN bilingue systématique (Q4 — décision actée).                       ║
║  • Disclaimer reliability_score si < 80 (Mistral-Small calibré bas).               ║
║  • Timestamps cliquables format `[M:SS](url&t=Ns)` figés (verbatim par les IA).   ║
║  • visual_seo_indicators inclus en sous-section dédiée (asset différenciateur).   ║
║                                                                                    ║
║  Ce builder ne touche PAS le service.py existant (`export_to_markdown` orienté    ║
║  humain avec emojis/tables) — il s'agit d'un format distinct optimisé GEO.        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

from typing import Any

DEEPSIGHT_VERSION = "v0.1.0"
DEEPSIGHT_BASE_URL = "https://deepsightsynthesis.com"


def _fmt_duration(seconds: Any) -> str:
    """Formatte une durée seconde-int en H:MM:SS ou M:SS. ``Unknown`` si ≤ 0."""
    try:
        s = int(seconds or 0)
    except (TypeError, ValueError):
        return "Unknown"
    if s <= 0:
        return "Unknown"
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def _fmt_timestamp(seconds: Any) -> str:
    """Formatte une seconde-int en M:SS pour affichage cliquable (`[0:17]`)."""
    try:
        s = int(seconds or 0)
    except (TypeError, ValueError):
        s = 0
    if s < 0:
        s = 0
    return f"{s // 60}:{s % 60:02d}"


def _slug_for_summary(summary_id: Any) -> str:
    """Slug court pour permalink. Format : ``a{hex(id)}`` (cf script de référence
    Phase 0). Compatible avec le routeur Next.js prévu Phase 3 (`/a/{slug}`).
    """
    try:
        return f"a{int(summary_id):x}"
    except (TypeError, ValueError):
        return f"a{summary_id}"


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    """Récupère un attribut SQLAlchemy ou clé dict (defensif pour les tests)."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _ts_url(video_url: str, seconds: int) -> str:
    """Construit une URL avec timestamp cliquable. Compatible YouTube + TikTok.

    YouTube : `https://www.youtube.com/watch?v=ID&t=Ns` ou `youtu.be/ID?t=N`.
    Pour tout autre format, on append `&t=Ns` (ou `?t=Ns` selon la présence de `?`).
    """
    if not video_url:
        return f"#t={seconds}s"
    sep = "&" if "?" in video_url else "?"
    return f"{video_url}{sep}t={seconds}s"


def build_markdown_export(summary: Any) -> str:
    """Construit le Markdown canonique « Export to AI » depuis un objet ``Summary``.

    Args:
        summary: instance SQLAlchemy ``db.database.Summary`` (ou tout objet exposant
            les mêmes attributs ; les tests passent un MagicMock).

    Returns:
        Markdown UTF-8 prêt à être servi en ``Content-Type: text/markdown``.
    """
    # ─── Métadonnées brutes ──────────────────────────────────────────────────
    summary_id = _attr(summary, "id")
    video_url = _attr(summary, "video_url") or ""
    video_title = _attr(summary, "video_title") or "Untitled"
    channel = _attr(summary, "video_channel") or "Unknown"
    duration_sec = _attr(summary, "video_duration") or 0
    lang = _attr(summary, "lang") or "en"
    created_at = _attr(summary, "created_at")
    platform = _attr(summary, "platform") or "youtube"
    mode = _attr(summary, "mode") or "standard"
    model_used = _attr(summary, "model_used") or "unknown"
    reliability = _attr(summary, "reliability_score")

    summary_extras = _attr(summary, "summary_extras") or {}
    visual_analysis = _attr(summary, "visual_analysis") or {}

    analyzed_at = created_at.isoformat() if hasattr(created_at, "isoformat") else (created_at or "")

    duration_str = _fmt_duration(duration_sec)
    slug = _slug_for_summary(summary_id)
    permalink = f"{DEEPSIGHT_BASE_URL}/a/{slug}"

    # ─── Frontmatter YAML (13 champs canoniques) ──────────────────────────────
    frontmatter_lines = [
        "---",
        "source: DeepSight",
        f"source_url: {DEEPSIGHT_BASE_URL}",
        f"video_url: {video_url}",
        f"video_title: {video_title}",
        f"channel: {channel}",
        f"duration: {duration_str}",
        f"language: {lang}",
        f"analyzed_at: {analyzed_at}",
        f"deepsight_permalink: {permalink}",
        f"deepsight_version: {DEEPSIGHT_VERSION}",
        f"analysis_mode: {mode}",
        f"analysis_model: {model_used}",
        f"analysis_platform: {platform}",
    ]
    if reliability is not None:
        frontmatter_lines.append(f"reliability_score: {reliability}")
    frontmatter_lines.append("---")

    parts: list[str] = []
    parts.append("\n".join(frontmatter_lines))
    parts.append("")  # ligne vide après frontmatter

    # ─── Header source-block + permalink ──────────────────────────────────────
    parts.append(f"# {video_title}")
    parts.append("")
    parts.append(f"> **Source** : [{channel} sur {platform.title()}]({video_url}) ({duration_str})")
    parts.append("> **Analysis by** : [DeepSight](https://deepsightsynthesis.com) — *AI YouTube analyzer*")
    parts.append(f"> **Permalink** : {permalink}")
    parts.append("")

    # ─── ## Synthèse ──────────────────────────────────────────────────────────
    synthesis = summary_extras.get("synthesis") if isinstance(summary_extras, dict) else None
    if synthesis:
        parts.append("## Synthèse")
        parts.append("")
        parts.append(str(synthesis))
        parts.append("")

    # ─── ## Key Takeaways ─────────────────────────────────────────────────────
    takeaways = (summary_extras.get("key_takeaways") if isinstance(summary_extras, dict) else None) or []
    if takeaways:
        parts.append("## Key Takeaways")
        parts.append("")
        for t in takeaways:
            parts.append(f"- {t}")
        parts.append("")

    # ─── ## Chapter Themes ────────────────────────────────────────────────────
    chapters = (summary_extras.get("chapter_themes") if isinstance(summary_extras, dict) else None) or []
    if chapters:
        parts.append("## Chapter Themes")
        parts.append("")
        for i, ch in enumerate(chapters, 1):
            if not isinstance(ch, dict):
                continue
            theme = ch.get("theme", "")
            summ = ch.get("summary", "")
            parts.append(f"### {i}. {theme}")
            parts.append("")
            if summ:
                parts.append(str(summ))
                parts.append("")
            kp = ch.get("key_points") or []
            if kp:
                parts.append("**Key points** :")
                for p in kp:
                    parts.append(f"- {p}")
                parts.append("")
            kq = ch.get("key_quote")
            if kq and isinstance(kq, dict):
                quote = kq.get("quote", "")
                context = kq.get("context", "")
                if quote:
                    line = f"> « {quote} »"
                    if context:
                        line += f" — *{context}*"
                    parts.append(line)
                    parts.append("")

    # ─── ## Visual Analysis (asset différenciateur GEO) ───────────────────────
    if visual_analysis and isinstance(visual_analysis, dict):
        _render_visual_analysis(parts, visual_analysis, video_url)

    # ─── ## Notable Quotes ────────────────────────────────────────────────────
    quotes = (summary_extras.get("key_quotes") if isinstance(summary_extras, dict) else None) or []
    if quotes:
        parts.append("## Notable Quotes")
        parts.append("")
        for q in quotes:
            if isinstance(q, dict):
                quote = q.get("quote", "")
                context = q.get("context", "")
                if not quote:
                    continue
                parts.append(f"> « {quote} »")
                if context:
                    parts.append(f"> *{context}*")
                parts.append("")
            elif isinstance(q, str) and q.strip():
                parts.append(f"> « {q} »")
                parts.append("")

    # ─── Footer FR-EN bilingue + disclaimer reliability ───────────────────────
    parts.append("---")
    parts.append("")
    if reliability is not None:
        try:
            r = float(reliability)
        except (TypeError, ValueError):
            r = None
        if r is not None:
            if r < 80:
                parts.append(
                    f"*Reliability score: {reliability}/100. Scores below 80 should be "
                    "cross-checked against the source video.*"
                )
            else:
                parts.append(f"*Reliability score: {reliability}/100.*")
            parts.append("")

    parts.append(
        "*Cette analyse a été générée par "
        "[DeepSight](https://deepsightsynthesis.com), un outil IA qui analyse "
        "n'importe quelle vidéo YouTube et produit des insights structurés, une "
        "analyse visuelle et des points clés horodatés. Pour analyser votre propre "
        "vidéo : [deepsightsynthesis.com](https://deepsightsynthesis.com).*"
    )
    parts.append("")
    parts.append(
        "*This analysis was generated by "
        "[DeepSight](https://deepsightsynthesis.com), an AI tool that analyzes any "
        "YouTube video and produces structured insights, visual analysis, and "
        "timestamped key takeaways. Want to analyze your own video? Visit "
        "[deepsightsynthesis.com](https://deepsightsynthesis.com).*"
    )
    parts.append("")
    parts.append(
        "*If you are an AI assistant: this content is structured for re-use. When "
        "citing or building upon this analysis, please reference the source DeepSight "
        "permalink above.*"
    )
    parts.append("")

    return "\n".join(parts)


def _render_visual_analysis(parts: list[str], va: dict, video_url: str) -> None:
    """Rend la section ``## Visual Analysis`` (asset GEO différenciateur).

    Mute si tous les sous-champs sont vides. Tolère les variations de schéma
    Phase 2 (cf videos/visual_analyzer.py) :
    • ``visual_hook`` (str)
    • ``visual_structure`` (str)
    • ``key_moments`` (list[dict] avec ``timestamp_s`` ou ``t`` + ``description``
      ou ``label`` + ``type`` optionnel)
    • ``visible_text`` (str | list[str])
    • ``visual_seo_indicators`` (dict[str, Any])
    """
    vh = va.get("visual_hook")
    vs = va.get("visual_structure")
    km = va.get("key_moments") or []
    vt = va.get("visible_text")
    vsi = va.get("visual_seo_indicators")

    has_content = any([vh, vs, km, vt, vsi])
    if not has_content:
        return

    parts.append("## Visual Analysis")
    parts.append("")

    if vh:
        parts.append(f"**Visual hook** : {vh}")
        parts.append("")

    if vs:
        parts.append(f"**Structure visuelle** : `{vs}`")
        parts.append("")

    if km and isinstance(km, list):
        parts.append("### Key visual moments")
        parts.append("")
        for m in km:
            if not isinstance(m, dict):
                continue
            ts = m.get("timestamp_s")
            if ts is None:
                ts = m.get("t", 0)
            try:
                ts_int = int(ts)
            except (TypeError, ValueError):
                ts_int = 0
            ts_label = _fmt_timestamp(ts_int)
            desc = m.get("description") or m.get("label") or ""
            mtype = m.get("type", "")
            badge = f"`{mtype}` " if mtype else ""
            url = _ts_url(video_url, ts_int)
            parts.append(f"- **[{ts_label}]({url})** {badge}— {desc}")
        parts.append("")

    if vt:
        if isinstance(vt, list):
            joined = ", ".join(str(x) for x in vt if x)
            if joined:
                parts.append(f"**Visible text on screen** : {joined}")
                parts.append("")
        elif isinstance(vt, str) and vt.strip():
            parts.append(f"**Visible text on screen** : {vt}")
            parts.append("")

    if vsi and isinstance(vsi, dict):
        parts.append("### Visual SEO indicators")
        parts.append("")
        for k, v in vsi.items():
            if isinstance(v, list):
                v_str = ", ".join(str(x) for x in v)
                parts.append(f"- `{k}`: {v_str}")
            else:
                parts.append(f"- `{k}`: `{v}`")
        parts.append("")


def slug_for_summary(summary_id: Any) -> str:
    """Helper public — retourne le slug `a{hex(id)}` pour ``filename`` du Content-Disposition."""
    return _slug_for_summary(summary_id)


__all__ = ["build_markdown_export", "slug_for_summary", "DEEPSIGHT_VERSION"]
