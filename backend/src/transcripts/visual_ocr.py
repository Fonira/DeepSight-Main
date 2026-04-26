"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  👁️ VISUAL OCR — Extraction de texte depuis les slides TikTok via Pixtral        ║
║                                                                                    ║
║  Pipeline:                                                                         ║
║  1. Télécharger la vidéo TikTok (yt-dlp ou URL directe)                           ║
║  2. Extraire les frames clés avec ffmpeg (détection de changement de scène)       ║
║  3. Envoyer les frames à Pixtral (modèle vision Mistral) pour OCR + compréhension ║
║  4. Assembler le texte extrait en "transcription" exploitable                      ║
║                                                                                    ║
║  Utilisé comme fallback quand l'extraction audio échoue (TikTok slides/images)    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import base64
import logging
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, Tuple

import httpx

from core.config import get_mistral_key

logger = logging.getLogger(__name__)

# Pixtral — modèles vision Mistral avec fallback chain
PIXTRAL_MODELS = ["pixtral-12b-2409", "pixtral-large-2411", "mistral-small-latest"]
PIXTRAL_MODEL = PIXTRAL_MODELS[0]  # Primary
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"

# Limites
MAX_FRAMES = 10  # Max slides à envoyer (coût + context)
FRAME_MAX_SIZE_KB = 300  # Compresser au-delà
PIXTRAL_TIMEOUT = 60  # Timeout appel API

_executor = ThreadPoolExecutor(max_workers=2)


async def extract_text_from_video_frames(
    video_data: bytes,
    video_id: str = "unknown",
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extrait le texte visible depuis les frames d'une vidéo (TikTok slides).

    Args:
        video_data: Bytes de la vidéo téléchargée
        video_id: ID pour les logs

    Returns:
        (full_text, detected_language) ou (None, None)
    """
    mistral_key = get_mistral_key()
    if not mistral_key:
        logger.error("[VISUAL_OCR] MISTRAL_API_KEY not configured")
        return None, None

    # 1. Extraire les frames clés
    frames = await _extract_key_frames(video_data, video_id)
    if not frames:
        logger.warning(f"[VISUAL_OCR] No frames extracted for {video_id}")
        return None, None

    logger.info(f"[VISUAL_OCR] Extracted {len(frames)} key frames for {video_id}")

    # 2. Encoder en base64
    frames_b64 = []
    for frame_bytes in frames[:MAX_FRAMES]:
        b64 = base64.b64encode(frame_bytes).decode("utf-8")
        frames_b64.append(b64)

    # 3. Appeler Pixtral pour OCR + compréhension
    text, lang = await _call_pixtral_ocr(frames_b64, video_id, mistral_key)

    if text and len(text.strip()) >= 20:
        logger.info(f"[VISUAL_OCR] Success for {video_id}: {len(text)} chars, lang={lang}")
        return text, lang

    logger.warning(f"[VISUAL_OCR] No meaningful text extracted for {video_id}")
    return None, None


async def _extract_key_frames(
    video_data: bytes,
    video_id: str,
) -> list[bytes]:
    """
    Extrait les frames clés d'une vidéo en utilisant ffmpeg.
    Détection de changement de scène pour capturer chaque slide.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _extract_frames_sync, video_data, video_id)


def _extract_frames_sync(video_data: bytes, video_id: str) -> list[bytes]:
    """Extraction synchrone des frames via ffmpeg."""
    frames = []

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = Path(tmpdir) / "input.mp4"
        video_path.write_bytes(video_data)

        output_pattern = str(Path(tmpdir) / "frame_%03d.jpg")

        # Méthode 1: Détection de changement de scène (idéal pour slides)
        cmd = [
            "ffmpeg",
            "-i",
            str(video_path),
            "-vf",
            "select=gt(scene\\,0.25),scale=1024:-1",
            "-vsync",
            "vfr",
            "-q:v",
            "4",
            "-frames:v",
            str(MAX_FRAMES),
            output_pattern,
            "-y",
            "-loglevel",
            "error",
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                logger.warning(f"[VISUAL_OCR] ffmpeg scene detection failed: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            logger.warning(f"[VISUAL_OCR] ffmpeg timeout for {video_id}")
        except FileNotFoundError:
            logger.error("[VISUAL_OCR] ffmpeg not found!")
            return []

        # Collecter les frames générées
        frame_files = sorted(Path(tmpdir).glob("frame_*.jpg"))

        # Si la détection de scène n'a rien trouvé, fallback: 1 frame/2s
        if len(frame_files) < 2:
            output_pattern2 = str(Path(tmpdir) / "fallback_%03d.jpg")
            cmd2 = [
                "ffmpeg",
                "-i",
                str(video_path),
                "-vf",
                "fps=0.5,scale=1024:-1",
                "-q:v",
                "4",
                "-frames:v",
                str(MAX_FRAMES),
                output_pattern2,
                "-y",
                "-loglevel",
                "error",
            ]
            try:
                subprocess.run(cmd2, capture_output=True, text=True, timeout=30)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass
            frame_files = sorted(Path(tmpdir).glob("fallback_*.jpg"))

        for f in frame_files[:MAX_FRAMES]:
            try:
                data = f.read_bytes()
                if len(data) > 0:
                    frames.append(data)
            except Exception:
                continue

    logger.info(f"[VISUAL_OCR] {len(frames)} frames extracted for {video_id}")
    return frames


async def _call_pixtral_ocr(
    frames_b64: list[str],
    video_id: str,
    mistral_key: str,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Appelle Pixtral via l'API Mistral Chat Completions pour extraire
    le texte et comprendre le contenu des slides.
    """
    # Construire le message multimodal (images + instruction)
    content = []
    for i, b64 in enumerate(frames_b64):
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            }
        )

    content.append(
        {
            "type": "text",
            "text": (
                "Ces images sont les slides d'un TikTok (carrousel d'images). "
                "Pour chaque slide, extrais TOUT le texte visible exactement comme écrit. "
                "Puis donne une synthèse du message global de ce TikTok.\n\n"
                "Format de réponse:\n"
                "SLIDE 1:\n[texte exact de la slide]\n\n"
                "SLIDE 2:\n[texte exact de la slide]\n\n"
                "...\n\n"
                "SYNTHÈSE:\n[résumé du message global en 2-3 phrases]\n\n"
                "Réponds dans la langue du texte sur les slides."
            ),
        }
    )

    # Fallback chain: essayer chaque modèle en séquence
    for model in PIXTRAL_MODELS:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.1,
            "max_tokens": 4000,
        }

        try:
            async with httpx.AsyncClient(timeout=PIXTRAL_TIMEOUT) as client:
                response = await client.post(
                    MISTRAL_CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {mistral_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                if response.status_code == 429:
                    logger.warning(f"[VISUAL_OCR] {model} rate-limited, trying next...")
                    continue
                if response.status_code != 200:
                    logger.error(f"[VISUAL_OCR] {model} API error {response.status_code}: {response.text[:300]}")
                    continue

                result = response.json()
                text = result["choices"][0]["message"]["content"]

                lang = _detect_lang_simple(text)

                logger.info(f"[VISUAL_OCR] {model} response for {video_id}: {len(text)} chars, detected_lang={lang}")
                return text, lang

        except httpx.TimeoutException:
            logger.error(f"[VISUAL_OCR] {model} timeout for {video_id}")
            continue
        except Exception as e:
            logger.error(f"[VISUAL_OCR] {model} error for {video_id}: {e}")
            continue

    logger.error(f"[VISUAL_OCR] All models exhausted for {video_id}")
    return None, None


def _detect_lang_simple(text: str) -> str:
    """Détection basique de la langue du texte extrait."""
    lower = text.lower()
    # Heuristique simple basée sur des mots fréquents
    fr_markers = ["le ", "la ", "les ", "de ", "des ", "un ", "une ", "est ", "dans ", "pour "]
    en_markers = ["the ", "is ", "and ", "for ", "with ", "this ", "that ", "are ", "from "]

    fr_count = sum(1 for m in fr_markers if m in lower)
    en_count = sum(1 for m in en_markers if m in lower)

    if fr_count > en_count:
        return "fr"
    elif en_count > fr_count:
        return "en"
    return "fr"  # Default
