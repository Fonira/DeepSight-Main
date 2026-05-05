"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  👁️ VISUAL ANALYZER — Analyse multimodale frames + transcript via Mistral Vision  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline :                                                                        ║
║  1. Encode frames JPEG en base64                                                   ║
║  2. Construit messages Mistral avec timestamps en texte avant chaque image        ║
║  3. Appelle mistral_vision_request (réutilise fallback chain pixtral→small→Claude)║
║  4. Parse JSON strict ; renvoie VisualAnalysis ou None                            ║
║                                                                                    ║
║  Réutilise core.config.get_mistral_key + images.screenshot_detection.mistral_*    ║
║  Spec: docs/superpowers/specs/2026-05-05-visual-analysis-poc.md (à créer)         ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import base64
import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.config import get_mistral_key
from images.screenshot_detection import mistral_vision_request

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIG MODÈLES
# ═══════════════════════════════════════════════════════════════════════════════

# Ordre de préférence : pixtral-large > pixtral-12b > mistral-small (vision)
# Aligné avec VISION_MODELS_ANALYSIS de screenshot_detection.py.
PRIMARY_MODEL = "pixtral-large-2411"
FALLBACK_MODELS = ["pixtral-12b-2409", "mistral-small-2603"]

# Nombre max de frames envoyées à Mistral en un seul appel.
# Au-delà, on downsample uniformément pour rester sous le seuil.
# 80 frames × ~512 tokens ≈ 40k tokens input → safe pour pixtral-large (32k window).
# pixtral-large = 128k context window, mais le coût grimpe vite.
MAX_FRAMES_PER_CALL = 60

VISION_TIMEOUT_S = 240.0


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 RESULT TYPE
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class VisualAnalysis:
    """Structure JSON renvoyée par Mistral après analyse visuelle."""

    visual_hook: str = ""
    visual_structure: str = ""  # talking_head|b_roll|gameplay|slides|tutorial|mixed|other
    key_moments: List[Dict[str, Any]] = field(default_factory=list)
    # Chaque moment: {timestamp_s: float, description: str, type: hook|transition|reveal|cta|peak}
    visible_text: str = ""
    visual_seo_indicators: Dict[str, Any] = field(default_factory=dict)
    summary_visual: str = ""

    # Métadonnées de l'analyse (non issues du LLM)
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
    log_tag: str = "VISUAL_ANALYZER",
) -> Optional[VisualAnalysis]:
    """
    Pipeline complet : frames → JSON structuré (VisualAnalysis).

    Renvoie None si :
    - Aucune clé Mistral configurée
    - Aucune frame n'a pu être encodée
    - Mistral renvoie 0 réponse exploitable
    - Le JSON parse échoue après plusieurs tentatives

    Le caller est responsable du cleanup des frames après cet appel.
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

    # Downsample si trop de frames pour un seul appel
    downsampled = False
    if len(frame_paths) > MAX_FRAMES_PER_CALL:
        downsampled = True
        sampled_paths = _downsample(frame_paths, MAX_FRAMES_PER_CALL)
        sampled_ts = _downsample(frame_timestamps, MAX_FRAMES_PER_CALL)
        logger.info(
            "[%s] Downsampled %d → %d frames (cap %d)",
            log_tag,
            len(frame_paths),
            len(sampled_paths),
            MAX_FRAMES_PER_CALL,
        )
    else:
        sampled_paths = frame_paths
        sampled_ts = frame_timestamps

    user_content = _build_user_message(sampled_paths, sampled_ts, transcript_excerpt)
    if user_content is None:
        logger.warning("[%s] No frame could be encoded", log_tag)
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
        fallback_models=fallback_models or FALLBACK_MODELS,
    )

    if not raw:
        logger.warning("[%s] Mistral vision returned no content", log_tag)
        return None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        # Tentative de récupération : isole le premier bloc {...}
        logger.warning("[%s] JSON parse failed: %s ; trying brace extraction", log_tag, e)
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                logger.error("[%s] JSON brace extraction also failed. Raw: %s", log_tag, raw[:500])
                return None
        else:
            logger.error("[%s] No JSON object found in response", log_tag)
            return None

    return VisualAnalysis(
        visual_hook=str(data.get("visual_hook", "")).strip(),
        visual_structure=str(data.get("visual_structure", "")).strip(),
        key_moments=list(data.get("key_moments", []) or []),
        visible_text=str(data.get("visible_text", "")).strip(),
        visual_seo_indicators=dict(data.get("visual_seo_indicators", {}) or {}),
        summary_visual=str(data.get("summary_visual", "")).strip(),
        model_used=model,
        frames_analyzed=len(sampled_paths),
        frames_downsampled=downsampled,
    )
