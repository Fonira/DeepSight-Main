"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎙️ AUDIO UTILS — Helpers partagés pour téléchargement/compression/transcription  ║
║  Utilisé par youtube.py ET tiktok.py                                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Literal, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor

import httpx

from core.config import (
    get_groq_key,
    get_tiktok_cookies_path,
    get_youtube_proxy,  # noqa: F401 -- referenced via globals().get() in _resolve_proxy_for_variant
    get_youtube_proxy_geo_fr,  # noqa: F401 -- referenced via globals().get() in _resolve_proxy_for_variant
    get_youtube_proxy_geo_us,  # noqa: F401 -- referenced via globals().get() in _resolve_proxy_for_variant
    get_youtube_proxy_legacy,  # noqa: F401 -- referenced via globals().get() in _resolve_proxy_for_variant
    get_youtube_proxy_sticky,  # noqa: F401 -- referenced via globals().get() in _resolve_proxy_for_variant
    get_ytdlp_cookies_path,
)
from core.logging import logger


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 PROXY VARIANT RESOLUTION (Sprint D — Proxy V2 resilience)
# ═══════════════════════════════════════════════════════════════════════════════

ProxyVariant = Literal["default", "sticky", "geo_us", "geo_fr", "legacy", "none"]

# Variant → nom du getter dans le module (resolution dynamique a l'appel).
# "none" retourne toujours "" via _GETTER_NONE.
# Pourquoi indexer par nom de symbole et pas par fonction ? Parce que les tests
# monkeypatch `audio_utils.get_youtube_proxy` (rebinding du nom), ce qui ne
# se propage pas a une reference fonctionnelle figee dans un dict global.
_VARIANT_GETTER_NAMES = {
    "default": "get_youtube_proxy",
    "sticky": "get_youtube_proxy_sticky",
    "geo_us": "get_youtube_proxy_geo_us",
    "geo_fr": "get_youtube_proxy_geo_fr",
    "legacy": "get_youtube_proxy_legacy",
    "none": None,  # special-cased dans _resolve_proxy_variant
}


def _resolve_proxy_variant(variant: ProxyVariant) -> str:
    """Look up the proxy URL for the requested variant.

    Fallback gracieux : si le variant est demande mais le setting est None/vide,
    on log un warning et on retombe sur `YOUTUBE_PROXY` (default). Permet de
    deployer le code AVANT que Maxime ait seed les variants en prod sans casser
    les flows existants.

    Args:
        variant: "default" | "sticky" | "geo_us" | "geo_fr" | "legacy" | "none".

    Returns:
        URL proxy a injecter dans `--proxy` (ou "" pour bare).
    """
    if variant == "none":
        return ""

    getter_name = _VARIANT_GETTER_NAMES.get(variant)
    if getter_name is None:
        logger.warning(f"proxy_variant: unknown variant={variant!r}, using 'default'")
        return _resolve_default()

    # Resolution dynamique du symbole pour rester compatible monkeypatch
    getter = globals().get(getter_name)
    if getter is None:
        logger.warning(f"proxy_variant: getter {getter_name} not found in module — using default")
        return _resolve_default()

    url = getter() or ""
    if not url and variant != "default":
        # Tier configure absent en .env → cascade vers default avec warn.
        logger.warning(f"proxy_variant: {variant} requested but setting is None/empty, falling back to default")
        return _resolve_default()
    return url


def _resolve_default() -> str:
    """Helper interne — toujours utilise le getter `get_youtube_proxy` courant."""
    fn = globals().get("get_youtube_proxy")
    if fn is None:
        return ""
    return fn() or ""


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 YT-DLP EXTRA ARGS — proxy + cookies (partagé YouTube + TikTok)
# ═══════════════════════════════════════════════════════════════════════════════


def _yt_dlp_extra_args(
    *,
    include_proxy: bool = True,
    use_tiktok_cookies: bool = False,
    proxy_variant: ProxyVariant = "default",
) -> list:
    """Common yt-dlp flags for IP-banned environments: proxy + cookies.

    Both are no-ops when their env vars are unset, so this is safe to call
    from every yt-dlp wrapper unconditionally (YouTube ET TikTok).

    `include_proxy=False` permet de skipper l'injection `--proxy` pour les
    appels qui ne font que du metadata fetch (`yt-dlp -j --skip-download`) :
    le CDN i.ytimg.com et l'API watch?v= acceptent les requêtes directes depuis
    l'IP du backend, et un proxy datacenter mal configuré ferait échouer la
    requête (407 Proxy Authentication Required) alors qu'elle marcherait sans.

    `use_tiktok_cookies=True` swap YTDLP_COOKIES_PATH pour TIKTOK_COOKIES_PATH
    afin que les sessions YouTube et TikTok restent ségrégées (domaines et
    fenêtres de refresh différents, cookies TikTok plus volatiles).

    HARD-STOP : si `should_bypass_proxy()` retourne True (PROXY_DISABLED=true OU
    MTD > 950 MB), on skip `--proxy` même quand include_proxy=True. Dégradation
    gracieuse : la requête peut échouer côté YouTube (IP-ban) mais on ne bloque
    JAMAIS la requête côté backend.

    `proxy_variant` (Sprint D) selectionne le tier proxy a utiliser :
      - "default" : `YOUTUBE_PROXY` (rotating Decodo, comportement historique)
      - "sticky"  : `YOUTUBE_PROXY_STICKY` (sticky session ~10min)
      - "geo_us" / "geo_fr" : `YOUTUBE_PROXY_GEO_{US,FR}` (geo-targeted)
      - "legacy"  : `YOUTUBE_PROXY_LEGACY` (fallback multi-provider)
      - "none"    : skip `--proxy` (bare request, last-resort)
    Fallback gracieux : si le variant pointe sur un setting None/vide,
    cascade automatique vers `default` avec warning (`_resolve_proxy_variant`).
    """
    from middleware.proxy_telemetry import should_bypass_proxy  # local import — évite cycle

    extra = []
    if include_proxy and proxy_variant != "none" and not should_bypass_proxy():
        proxy = _resolve_proxy_variant(proxy_variant)
        if proxy:
            extra.extend(["--proxy", proxy])
    cookies = get_tiktok_cookies_path() if use_tiktok_cookies else get_ytdlp_cookies_path()
    if cookies and os.path.exists(cookies):
        extra.extend(["--cookies", cookies])
    return extra


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

GROQ_MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB max pour Groq
GROQ_TRANSCRIBE_TIMEOUT = 360  # 6 minutes max

executor = ThreadPoolExecutor(max_workers=2)

# MIME types pour les fichiers audio
AUDIO_MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".opus": "audio/opus",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
}


def format_seconds_to_timestamp(seconds: float) -> str:
    """Convertit des secondes en timestamp HH:MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 COMPRESSION AUDIO
# ═══════════════════════════════════════════════════════════════════════════════


async def compress_audio(audio_data: bytes, audio_ext: str, source_name: str = "AUDIO") -> Tuple[Optional[bytes], str]:
    """
    Compresse l'audio avec ffmpeg si trop volumineux pour Groq (>25MB).
    Retourne (audio_bytes, extension) ou (None, ext) si échec.
    """
    if len(audio_data) <= GROQ_MAX_FILE_SIZE:
        return audio_data, audio_ext

    print(
        f"  🎙️ [{source_name}] Compressing audio ({len(audio_data) / 1024 / 1024:.1f}MB > {GROQ_MAX_FILE_SIZE / 1024 / 1024:.0f}MB)...",
        flush=True,
    )

    try:
        with tempfile.NamedTemporaryFile(suffix=audio_ext, delete=False) as tmp_in:
            tmp_in.write(audio_data)
            tmp_in_path = tmp_in.name

        tmp_out_path = tmp_in_path + "_compressed.mp3"

        cmd = ["ffmpeg", "-i", tmp_in_path, "-b:a", "32k", "-ac", "1", "-ar", "16000", "-y", tmp_out_path]
        subprocess.run(cmd, capture_output=True, timeout=120)

        if Path(tmp_out_path).exists():
            compressed = Path(tmp_out_path).read_bytes()
            print(
                f"  ✅ [{source_name}] Compressed: {len(audio_data) / 1024 / 1024:.1f}MB → {len(compressed) / 1024 / 1024:.1f}MB",
                flush=True,
            )
            Path(tmp_in_path).unlink(missing_ok=True)
            Path(tmp_out_path).unlink(missing_ok=True)
            return compressed, ".mp3"

        Path(tmp_in_path).unlink(missing_ok=True)
        Path(tmp_out_path).unlink(missing_ok=True)

    except Exception as e:
        print(f"  ⚠️ [{source_name}] Compression failed: {e}", flush=True)

    return audio_data, audio_ext


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TRANSCRIPTION GROQ WHISPER
# ═══════════════════════════════════════════════════════════════════════════════


async def transcribe_audio_groq(
    audio_data: bytes, audio_ext: str = ".mp3", source_name: str = "AUDIO"
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Transcrit un fichier audio via Groq Whisper API.

    Args:
        audio_data: Bytes du fichier audio
        audio_ext: Extension du fichier (.mp3, .m4a, etc.)
        source_name: Nom pour les logs (ex: "TIKTOK", "YOUTUBE")

    Returns:
        (full_text, timestamped_text, detected_language) ou (None, None, None)
    """
    groq_key = get_groq_key()
    if not groq_key:
        print(f"  ❌ [{source_name}] GROQ_API_KEY not configured!", flush=True)
        return None, None, None

    # Compresser si nécessaire
    audio_data, audio_ext = await compress_audio(audio_data, audio_ext, source_name)

    if len(audio_data) > GROQ_MAX_FILE_SIZE:
        print(
            f"  ❌ [{source_name}] Audio still too large after compression: {len(audio_data) / 1024 / 1024:.1f}MB",
            flush=True,
        )
        return None, None, None

    print(f"  🎙️ [{source_name}] Sending {len(audio_data) / 1024 / 1024:.1f}MB to Groq Whisper...", flush=True)

    try:
        mime_type = AUDIO_MIME_TYPES.get(audio_ext, "audio/mpeg")

        async with httpx.AsyncClient() as client:
            files = {"file": (f"audio{audio_ext}", audio_data, mime_type)}
            data = {"model": "whisper-large-v3", "response_format": "verbose_json"}

            start_time = time.time()
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files=files,
                data=data,
                timeout=GROQ_TRANSCRIBE_TIMEOUT,
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [{source_name}] Groq response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()
                full_text = result.get("text", "")
                segments = result.get("segments", [])
                detected_lang = result.get("language", "fr")

                if full_text:
                    # Construire le texte avec timestamps
                    if segments:
                        timestamped_parts = []
                        last_ts = -30
                        for seg in segments:
                            text = seg.get("text", "").strip()
                            start = seg.get("start", 0)
                            if not text:
                                continue
                            if start - last_ts >= 30:
                                ts = format_seconds_to_timestamp(start)
                                timestamped_parts.append(f"\n[{ts}] {text}")
                                last_ts = start
                            else:
                                timestamped_parts.append(f" {text}")
                        timestamped = "".join(timestamped_parts).strip()
                    else:
                        timestamped = full_text

                    print(
                        f"  ✅ [{source_name}] Transcription OK: {len(full_text)} chars, lang={detected_lang}",
                        flush=True,
                    )
                    return full_text, timestamped, detected_lang
            else:
                print(f"  ❌ [{source_name}] Groq error {response.status_code}: {response.text[:200]}", flush=True)

    except Exception as e:
        print(f"  ❌ [{source_name}] Transcription error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎙️ TRANSCRIPTION VOXTRAL STT (MISTRAL AI — PRIORITAIRE)
# v7.2 — Supporte 3h audio, 13 langues, timestamps segment-level
# ═══════════════════════════════════════════════════════════════════════════════

VOXTRAL_STT_URL = "https://api.mistral.ai/v1/audio/transcriptions"
# v7.3 — Switch to transcribe-only model (faster + cheaper than chat-tuned voxtral-mini-latest)
# Official doc: https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02
VOXTRAL_STT_MODEL = "voxtral-mini-2602"


async def transcribe_audio_voxtral(
    audio_data: bytes,
    audio_ext: str = ".mp3",
    source_name: str = "AUDIO",
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Transcrit un fichier audio via Voxtral STT (Mistral AI).

    Avantages vs Groq Whisper:
    - Pas de limite 25MB
    - Supporte jusqu'à 3h d'audio
    - Même clé API que Mistral LLM (inclus dans Scale tier)

    Returns:
        (full_text, timestamped_text, detected_language) ou (None, None, None)
    """
    from core.config import get_mistral_key

    mistral_key = get_mistral_key()
    if not mistral_key:
        print(f"  ⏭️ [{source_name}] VOXTRAL-STT: No Mistral API key", flush=True)
        return None, None, None

    print(f"  🎙️ [{source_name}] Sending {len(audio_data) / 1024 / 1024:.1f}MB to Voxtral STT...", flush=True)

    try:
        mime_type = AUDIO_MIME_TYPES.get(audio_ext, "audio/mpeg")

        async with httpx.AsyncClient() as client:
            files = {"file": (f"audio{audio_ext}", audio_data, mime_type)}
            data = {
                "model": VOXTRAL_STT_MODEL,
                "timestamp_granularities": "segment",
            }

            start_time = time.time()
            response = await client.post(
                VOXTRAL_STT_URL,
                headers={"Authorization": f"Bearer {mistral_key}"},
                files=files,
                data=data,
                timeout=360,
            )
            elapsed = time.time() - start_time
            print(f"  🎙️ [{source_name}] Voxtral response in {elapsed:.1f}s: {response.status_code}", flush=True)

            if response.status_code == 200:
                result = response.json()
                full_text = result.get("text", "")
                segments = result.get("segments", [])
                detected_lang = result.get("language", "fr")

                if full_text:
                    if segments:
                        timestamped_parts = []
                        last_ts = -30
                        for seg in segments:
                            text = seg.get("text", "").strip()
                            start = seg.get("start", 0)
                            if not text:
                                continue
                            if start - last_ts >= 30:
                                ts = format_seconds_to_timestamp(start)
                                timestamped_parts.append(f"\n[{ts}] {text}")
                                last_ts = start
                            else:
                                timestamped_parts.append(f" {text}")
                        timestamped = "".join(timestamped_parts).strip()
                    else:
                        timestamped = full_text

                    print(
                        f"  ✅ [{source_name}] Voxtral STT OK: {len(full_text)} chars, lang={detected_lang}", flush=True
                    )
                    return full_text, timestamped, detected_lang
            else:
                print(
                    f"  ❌ [{source_name}] Voxtral STT error {response.status_code}: {response.text[:200]}", flush=True
                )

    except Exception as e:
        print(f"  ❌ [{source_name}] Voxtral STT error: {e}", flush=True)

    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 TÉLÉCHARGEMENT AUDIO VIA YT-DLP (générique — YouTube, TikTok, etc.)
# ═══════════════════════════════════════════════════════════════════════════════


async def download_audio_ytdlp(
    url: str, source_name: str = "AUDIO", timeout: int = 240, extra_args: Optional[list] = None
) -> Tuple[Optional[bytes], str]:
    """
    Télécharge l'audio d'une URL via yt-dlp (supporte YouTube, TikTok, Instagram, etc.)

    Args:
        url: URL de la vidéo
        source_name: Nom pour les logs
        timeout: Timeout en secondes
        extra_args: Arguments yt-dlp supplémentaires

    Returns:
        (audio_bytes, extension) ou (None, ".mp3")
    """
    print(f"  📥 [{source_name}] Downloading audio via yt-dlp...", flush=True)

    try:
        loop = asyncio.get_event_loop()

        def _download():
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = f"{tmpdir}/audio.mp3"

                cmd = [
                    "yt-dlp",
                    *_yt_dlp_extra_args(),
                    "-x",
                    "--audio-format",
                    "mp3",
                    "--audio-quality",
                    "9",  # Qualité basse = petit fichier
                    "-o",
                    audio_path,
                    "--no-warnings",
                    "--no-playlist",
                    "--retries",
                    "3",
                ]

                if extra_args:
                    cmd.extend(extra_args)

                cmd.append(url)

                result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

                if result.returncode != 0:
                    print(f"  ⚠️ [{source_name}] yt-dlp failed: {result.stderr[:150]}", flush=True)
                    return None, ".mp3"

                # Chercher le fichier audio produit
                for f in Path(tmpdir).iterdir():
                    if f.suffix in [".mp3", ".m4a", ".webm", ".opus", ".wav", ".ogg"]:
                        data = f.read_bytes()
                        print(
                            f"  ✅ [{source_name}] Audio downloaded: {len(data) / 1024 / 1024:.1f}MB ({f.suffix})",
                            flush=True,
                        )
                        return data, f.suffix

                return None, ".mp3"

        result = await asyncio.wait_for(loop.run_in_executor(executor, _download), timeout=timeout)
        # 📡 Proxy telemetry — track bytes_in = taille du fichier téléchargé (compressé).
        # No-op si proxy pas configuré (dev local). Best-effort, jamais bloquant.
        try:
            data, _ = result
            if data:
                from middleware.proxy_telemetry import record_proxy_usage

                await record_proxy_usage(provider="ytdlp_audio", bytes_in=len(data))
        except Exception:  # noqa: BLE001 — best-effort
            pass
        return result

    except asyncio.TimeoutError:
        print(f"  ⚠️ [{source_name}] Download timeout ({timeout}s)", flush=True)
    except Exception as e:
        print(f"  ⚠️ [{source_name}] Download error: {e}", flush=True)

    return None, ".mp3"
