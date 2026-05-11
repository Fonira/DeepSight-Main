"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  👁️ VISUAL ANALYZER — Analyse multimodale frames + transcript via Mistral Vision  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline :                                                                        ║
║  1. Encode frames JPEG en base64                                                   ║
║  2. Découpe en batches de MISTRAL_IMAGES_PER_REQUEST (8) — limite Mistral          ║
║  3. Lance les batches en parallèle (asyncio.gather)                                ║
║  4. Merge les résultats partiels en un VisualAnalysis unifié                       ║
║                                                                                    ║
║  Réutilise core.config.get_mistral_key + images.screenshot_detection.mistral_*    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import base64
import json
import logging
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from core.config import get_mistral_key
from images.screenshot_detection import mistral_vision_request

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIG MODÈLES
# ═══════════════════════════════════════════════════════════════════════════════

# Ordre de préférence : pixtral-large > pixtral-12b > mistral-small (vision)
PRIMARY_MODEL = "pixtral-large-2411"
FALLBACK_MODELS = ["pixtral-12b-2409", "mistral-small-2603"]

# Limite dure côté Mistral (code 3051 si dépassée).
MISTRAL_IMAGES_PER_REQUEST = 8

# Cap global sur le nombre de frames analysées (8 batches × 8 frames).
# Default = mode "expert". Le caller peut passer un cap plus bas pour mode "default" (Pro).
# Au-delà du cap effectif, downsampling uniforme.
MAX_FRAMES_TOTAL_CAP = 64

# Timeout par batch (8 frames ~5-15s normalement).
VISION_TIMEOUT_S = 90.0


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 RESULT TYPE
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class VisualAnalysis:
    """Structure JSON renvoyée par Mistral après analyse visuelle."""

    visual_hook: str = ""
    visual_structure: str = ""  # talking_head|b_roll|gameplay|slides|tutorial|mixed|other
    key_moments: List[Dict[str, Any]] = field(default_factory=list)
    visible_text: str = ""
    visual_seo_indicators: Dict[str, Any] = field(default_factory=dict)
    summary_visual: str = ""

    model_used: str = ""
    frames_analyzed: int = 0
    frames_downsampled: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _format_timestamp(seconds: float) -> str:
    """3.5 → '00:03', 75.2 → '01:15', 3700 → '01:01:40'."""
    seconds = max(0, int(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _encode_frame(path: str) -> Optional[str]:
    """Lit un JPEG et renvoie sa version base64. None si erreur."""
    try:
        return base64.b64encode(Path(path).read_bytes()).decode("ascii")
    except Exception as e:
        logger.warning("[VISUAL_ANALYZER] Failed to encode %s: %s", path, e)
        return None


def _downsample(items: List[Any], target: int) -> List[Any]:
    """Downsample uniforme : garde target items répartis sur la liste source."""
    if len(items) <= target or target <= 0:
        return items
    step = len(items) / target
    return [items[int(i * step)] for i in range(target)]


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 PROMPT
# ═══════════════════════════════════════════════════════════════════════════════


SYSTEM_PROMPT = """Tu es un analyste visuel expert pour DeepSight, un SaaS d'analyse vidéo IA.

Tu reçois une série de frames extraites d'une vidéo à intervalles réguliers (ordre chronologique strict)
et un transcript timestampé. Ton rôle : produire une analyse visuelle structurée qui complète l'analyse
textuelle déjà disponible.

Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire. Schema obligatoire :

{
  "visual_hook": "1-2 phrases sur le hook visuel des 5 premières secondes (couleurs, plan, sujet).",
  "visual_structure": "talking_head | b_roll | gameplay | slides | tutorial | interview | vlog | mixed | other",
  "key_moments": [
    {
      "timestamp_s": 12.5,
      "description": "Brève description visuelle du moment (1 phrase).",
      "type": "hook | transition | reveal | cta | peak | demo"
    }
  ],
  "visible_text": "Tout texte affiché à l'écran (titres, captions burned-in, infographies). Vide si rien.",
  "visual_seo_indicators": {
    "hook_brightness": "low | medium | high",
    "face_visible_in_hook": true,
    "burned_in_subtitles": false,
    "high_motion_intro": true,
    "thumbnail_quality_proxy": "low | medium | high"
  },
  "summary_visual": "Résumé visuel global en 2-3 phrases. Mentionne le style, le rythme, l'atmosphère."
}

Règles :
- Maximum 8 key_moments les plus saillants visuellement (pas un par frame).
- timestamp_s en secondes décimales (ex: 12.5).
- Si tu ne sais pas, mets une chaîne vide ou false plutôt que d'inventer.
- Réponds en français pour les champs descriptifs."""


def _build_user_message(
    frame_paths: List[str],
    frame_timestamps: List[float],
    transcript_excerpt: str,
) -> Optional[List[Dict[str, Any]]]:
    """
    Construit la liste content du message user (mix text + image_url).
    Renvoie None si aucune frame n'a pu être encodée.
    """
    parts: List[Dict[str, Any]] = []

    intro = (
        f"Frames extraites en ordre chronologique ({len(frame_paths)} au total).\n"
        f"Avant chaque image, le timestamp absolu dans la vidéo est indiqué."
    )
    if transcript_excerpt.strip():
        intro += f"\n\nTranscript de référence (extrait):\n{transcript_excerpt[:8000]}"
    parts.append({"type": "text", "text": intro})

    encoded_count = 0
    for path, ts in zip(frame_paths, frame_timestamps):
        b64 = _encode_frame(path)
        if not b64:
            continue
        parts.append({"type": "text", "text": f"--- Frame t={_format_timestamp(ts)} ---"})
        parts.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            }
        )
        encoded_count += 1

    if encoded_count == 0:
        return None
    return parts


def _parse_json_safe(raw: str, log_tag: str, batch_idx: int) -> Optional[Dict[str, Any]]:
    """Parse JSON strict avec fallback brace extraction. None si tout échoue."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("[%s] batch %d JSON parse failed: %s ; trying brace extraction", log_tag, batch_idx, e)
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                logger.error("[%s] batch %d brace extraction failed. Raw: %s", log_tag, batch_idx, raw[:300])
                return None
        logger.error("[%s] batch %d no JSON object found", log_tag, batch_idx)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🧩 BATCH ANALYSIS — un appel Mistral pour ≤8 frames
# ═══════════════════════════════════════════════════════════════════════════════


async def _analyze_single_batch(
    api_key: str,
    batch_paths: List[str],
    batch_ts: List[float],
    transcript_excerpt: str,
    model: str,
    fallback_models: List[str],
    log_tag: str,
    batch_idx: int,
) -> Optional[Dict[str, Any]]:
    """Analyse un batch de ≤8 frames. Renvoie le dict JSON parsé ou None."""
    user_content = _build_user_message(batch_paths, batch_ts, transcript_excerpt)
    if user_content is None:
        logger.warning("[%s] batch %d: no frame could be encoded", log_tag, batch_idx)
        return None

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    raw = await mistral_vision_request(
        api_key=api_key,
        messages=messages,
        model=model,
        max_tokens=2048,
        temperature=0.1,
        response_format={"type": "json_object"},
        timeout=VISION_TIMEOUT_S,
        fallback_models=fallback_models,
    )

    if not raw:
        logger.warning("[%s] batch %d: vision returned no content", log_tag, batch_idx)
        return None

    return _parse_json_safe(raw, log_tag, batch_idx)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔀 MERGE — combine N résultats partiels en un seul VisualAnalysis
# ═══════════════════════════════════════════════════════════════════════════════


def _merge_batch_results(
    results: List[Dict[str, Any]],
    model: str,
    frames_count: int,
    downsampled: bool,
) -> VisualAnalysis:
    """
    Merge N dicts JSON partiels en un VisualAnalysis unifié.

    Stratégie :
    - visual_hook : du premier batch (premières frames de la vidéo)
    - visual_structure : vote majoritaire entre batches
    - key_moments : concat global, dédup par timestamp arrondi, trié, top 8
    - visible_text : concat des textes uniques séparés par " | "
    - visual_seo_indicators : du premier batch (le hook est ce qui compte le plus)
    - summary_visual : 1er + milieu (si plus de 2 batches) pour rester concis
    """
    if not results:
        return VisualAnalysis(
            model_used=model,
            frames_analyzed=frames_count,
            frames_downsampled=downsampled,
        )

    visual_hook = str(results[0].get("visual_hook", "")).strip()

    structures = [str(r.get("visual_structure", "")).strip() for r in results if r.get("visual_structure")]
    visual_structure = Counter(structures).most_common(1)[0][0] if structures else ""

    all_moments: List[Dict[str, Any]] = []
    seen_ts: set = set()
    for r in results:
        for m in r.get("key_moments", []) or []:
            ts = m.get("timestamp_s")
            if not isinstance(ts, (int, float)):
                continue
            ts_key = round(float(ts))
            if ts_key in seen_ts:
                continue
            seen_ts.add(ts_key)
            all_moments.append(m)
    all_moments.sort(key=lambda m: float(m.get("timestamp_s", 0) or 0))
    key_moments = all_moments[:8]

    seen_text: set = set()
    text_parts: List[str] = []
    for r in results:
        t = str(r.get("visible_text", "")).strip()
        if t and t not in seen_text:
            seen_text.add(t)
            text_parts.append(t)
    visible_text = " | ".join(text_parts)

    visual_seo_indicators = dict(results[0].get("visual_seo_indicators", {}) or {})

    summaries = [str(r.get("summary_visual", "")).strip() for r in results if r.get("summary_visual")]
    if len(summaries) <= 2:
        summary_visual = " ".join(summaries)
    else:
        mid = len(summaries) // 2
        summary_visual = f"{summaries[0]} {summaries[mid]}"

    return VisualAnalysis(
        visual_hook=visual_hook,
        visual_structure=visual_structure,
        key_moments=key_moments,
        visible_text=visible_text,
        visual_seo_indicators=visual_seo_indicators,
        summary_visual=summary_visual,
        model_used=model,
        frames_analyzed=frames_count,
        frames_downsampled=downsampled,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 API PUBLIQUE
# ═══════════════════════════════════════════════════════════════════════════════


async def analyze_frames(
    frame_paths: List[str],
    frame_timestamps: List[float],
    transcript_excerpt: str = "",
    *,
    model: str = PRIMARY_MODEL,
    fallback_models: Optional[List[str]] = None,
    max_frames_cap: int = MAX_FRAMES_TOTAL_CAP,
    log_tag: str = "VISUAL_ANALYZER",
) -> Optional[VisualAnalysis]:
    """
    Pipeline complet : frames → JSON structuré (VisualAnalysis).

    Découpe les frames en batches de ≤MISTRAL_IMAGES_PER_REQUEST, lance les batches
    en parallèle, merge les résultats partiels.

    `max_frames_cap` : limite haute du nombre de frames effectivement envoyées à
    Mistral (downsampling uniforme au-delà). Default 64 (Expert) ; passer 24 pour
    mode Pro / "default". Doit rester ≤ MAX_FRAMES_TOTAL_CAP (cap dur batches × 8).

    Renvoie None si :
    - Aucune clé Mistral configurée
    - Aucun batch n'a réussi
    """
    if not frame_paths:
        logger.warning("[%s] Empty frame_paths", log_tag)
        return None
    if len(frame_paths) != len(frame_timestamps):
        logger.warning(
            "[%s] frame_paths/timestamps length mismatch (%d vs %d)",
            log_tag,
            len(frame_paths),
            len(frame_timestamps),
        )
        return None

    api_key = get_mistral_key()
    if not api_key:
        logger.error("[%s] MISTRAL_API_KEY missing — abort", log_tag)
        return None

    effective_fallbacks = fallback_models if fallback_models is not None else FALLBACK_MODELS

    # Clamp le cap demandé à la limite dure (8 batches × 8 frames Mistral)
    effective_cap = max(1, min(max_frames_cap, MAX_FRAMES_TOTAL_CAP))

    downsampled = False
    if len(frame_paths) > effective_cap:
        downsampled = True
        sampled_paths = _downsample(frame_paths, effective_cap)
        sampled_ts = _downsample(frame_timestamps, effective_cap)
        logger.info(
            "[%s] Downsampled %d → %d frames (cap %d)",
            log_tag,
            len(frame_paths),
            len(sampled_paths),
            effective_cap,
        )
    else:
        sampled_paths = list(frame_paths)
        sampled_ts = list(frame_timestamps)

    batches: List[Tuple[List[str], List[float]]] = []
    for i in range(0, len(sampled_paths), MISTRAL_IMAGES_PER_REQUEST):
        b_paths = sampled_paths[i : i + MISTRAL_IMAGES_PER_REQUEST]
        b_ts = sampled_ts[i : i + MISTRAL_IMAGES_PER_REQUEST]
        batches.append((b_paths, b_ts))

    logger.info(
        "[%s] Analyzing %d frames in %d parallel batches (≤%d frames each)",
        log_tag,
        len(sampled_paths),
        len(batches),
        MISTRAL_IMAGES_PER_REQUEST,
    )

    tasks = [
        _analyze_single_batch(
            api_key=api_key,
            batch_paths=b_paths,
            batch_ts=b_ts,
            transcript_excerpt=transcript_excerpt,
            model=model,
            fallback_models=effective_fallbacks,
            log_tag=log_tag,
            batch_idx=idx,
        )
        for idx, (b_paths, b_ts) in enumerate(batches)
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    successful: List[Dict[str, Any]] = []
    for idx, r in enumerate(raw_results):
        if isinstance(r, Exception):
            logger.warning("[%s] batch %d raised: %s", log_tag, idx, r)
            continue
        if r:
            successful.append(r)

    if not successful:
        logger.error("[%s] All %d batches failed", log_tag, len(batches))
        return None

    logger.info("[%s] %d/%d batches succeeded", log_tag, len(successful), len(batches))

    return _merge_batch_results(
        results=successful,
        model=model,
        frames_count=len(sampled_paths),
        downsampled=downsampled,
    )
