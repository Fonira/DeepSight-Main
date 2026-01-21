"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎙️ TEXT-TO-SPEECH SERVICE                                                        ║
║  Synthèse vocale naturelle et chaleureuse                                          ║
║  ElevenLabs (principal) + OpenAI TTS (fallback)                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import os
import re
import hashlib
import httpx
from typing import Optional, Tuple
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# ElevenLabs - Voix les plus naturelles
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"

# Voix ElevenLabs recommandées pour le français (chaleureuses et naturelles)
ELEVENLABS_VOICES = {
    # Voix françaises natives
    "fr_female_warm": "21m00Tcm4TlvDq8ikWAM",      # Rachel - Chaleureuse
    "fr_male_calm": "29vD33N1CtxCmqQRPOHJ",        # Drew - Calme
    "fr_female_soft": "EXAVITQu4vr4xnSDxMaL",     # Bella - Douce
    "fr_male_narrative": "ErXwobaYiN019PkySvjV",   # Antoni - Narrateur
    # Multilingues de haute qualité
    "multilingual_warm": "pNInz6obpgDQGcFmaJgB",  # Adam - Multilingue chaleureux
    "multilingual_clear": "yoZ06aMxZJJ28mfd3POQ", # Sam - Multilingue clair
}

# Voix par défaut selon la langue
DEFAULT_VOICE_FR = "fr_female_warm"
DEFAULT_VOICE_EN = "multilingual_clear"

# OpenAI TTS - Fallback économique
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"

# Voix OpenAI (toutes en anglais mais fonctionnent en français)
OPENAI_VOICES = {
    "alloy": "alloy",       # Neutre
    "echo": "echo",         # Masculin
    "fable": "fable",       # Expressif
    "onyx": "onyx",         # Profond
    "nova": "nova",         # Féminin chaleureux
    "shimmer": "shimmer",   # Féminin doux
}

DEFAULT_OPENAI_VOICE = "nova"  # La plus chaleureuse

# Cache des audios générés
AUDIO_CACHE_DIR = Path("/tmp/deepsight_tts_cache")
AUDIO_CACHE_DIR.mkdir(exist_ok=True)

# Limites
MAX_TEXT_LENGTH = 5000  # Caractères max par requête (ElevenLabs)
OPENAI_MAX_TEXT = 4000  # Limite stricte OpenAI TTS (4096 - marge)
MAX_CACHE_SIZE_MB = 500  # Taille max du cache


def clean_text_for_tts(text: str) -> str:
    """
    Nettoie le texte pour une meilleure synthèse vocale.
    Retire le markdown, les URLs, et formate les nombres.
    """
    # Retirer les balises markdown
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*([^*]+)\*', r'\1', text)       # *italic*
    text = re.sub(r'`([^`]+)`', r'\1', text)         # `code`
    text = re.sub(r'#{1,6}\s*', '', text)            # # headers
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # [link](url)
    
    # Retirer les URLs
    text = re.sub(r'https?://\S+', '', text)
    
    # Retirer les caractères spéciaux problématiques
    text = re.sub(r'[•►▶◆★☆✓✗→←↑↓]', '', text)
    
    # Remplacer les tirets multiples
    text = re.sub(r'[-–—]{2,}', ', ', text)
    
    # Normaliser les espaces
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Ajouter des pauses naturelles après les points
    text = re.sub(r'\.(\s+)', r'. \1', text)
    
    return text.strip()


def get_cache_key(text: str, voice: str, provider: str) -> str:
    """Génère une clé de cache unique pour le texte et la voix."""
    content = f"{provider}:{voice}:{text}"
    return hashlib.md5(content.encode()).hexdigest()


def get_cached_audio(cache_key: str) -> Optional[bytes]:
    """Récupère l'audio du cache si disponible."""
    cache_file = AUDIO_CACHE_DIR / f"{cache_key}.mp3"
    if cache_file.exists():
        return cache_file.read_bytes()
    return None


def save_to_cache(cache_key: str, audio_data: bytes) -> None:
    """Sauvegarde l'audio dans le cache."""
    cache_file = AUDIO_CACHE_DIR / f"{cache_key}.mp3"
    cache_file.write_bytes(audio_data)


async def generate_speech_elevenlabs(
    text: str,
    voice_id: str,
    language: str = "fr"
) -> Optional[bytes]:
    """
    Génère de la parole avec ElevenLabs (meilleure qualité).
    
    Args:
        text: Texte à convertir
        voice_id: ID de la voix ElevenLabs
        language: Code langue (fr, en)
    
    Returns:
        Audio MP3 en bytes ou None si erreur
    """
    if not ELEVENLABS_API_KEY:
        print("🎙️ ElevenLabs: API key not configured", flush=True)
        return None
    
    try:
        url = f"{ELEVENLABS_API_URL}/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        }
        
        # Configuration optimisée pour une voix chaleureuse
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",  # Meilleur pour le français
            "voice_settings": {
                "stability": 0.5,          # Équilibre stabilité/expressivité
                "similarity_boost": 0.75,  # Fidélité à la voix originale
                "style": 0.4,              # Expressivité modérée
                "use_speaker_boost": True  # Améliore la clarté
            }
        }
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                print(f"🎙️ ElevenLabs: Audio generated ({len(response.content)} bytes)", flush=True)
                return response.content
            else:
                print(f"🎙️ ElevenLabs error: {response.status_code} - {response.text}", flush=True)
                return None
                
    except Exception as e:
        print(f"🎙️ ElevenLabs exception: {e}", flush=True)
        return None


async def generate_speech_openai(
    text: str,
    voice: str = "nova",
    model: str = "tts-1"
) -> Optional[bytes]:
    """
    Génère de la parole avec OpenAI TTS (fallback économique).
    
    Args:
        text: Texte à convertir (sera tronqué si > 4000 chars)
        voice: Nom de la voix (alloy, echo, fable, onyx, nova, shimmer)
        model: Modèle (tts-1 ou tts-1-hd)
    
    Returns:
        Audio MP3 en bytes ou None si erreur
    """
    if not OPENAI_API_KEY:
        print("🎙️ OpenAI TTS: API key not configured", flush=True)
        return None
    
    # Tronquer le texte si trop long (limite OpenAI: 4096 chars)
    if len(text) > OPENAI_MAX_TEXT:
        # Trouver un bon point de coupure (fin de phrase)
        truncated = text[:OPENAI_MAX_TEXT]
        last_period = truncated.rfind('. ')
        if last_period > OPENAI_MAX_TEXT * 0.7:  # Si on trouve un point dans les 30% derniers
            truncated = truncated[:last_period + 1]
        text = truncated + " (suite abrégée)"
        print(f"🎙️ OpenAI TTS: Text truncated from {len(text)} to {len(truncated)} chars", flush=True)
    
    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": model,
            "input": text,
            "voice": voice,
            "response_format": "mp3",
            "speed": 1.0  # Vitesse normale
        }
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(OPENAI_TTS_URL, headers=headers, json=payload)
            
            if response.status_code == 200:
                print(f"🎙️ OpenAI TTS: Audio generated ({len(response.content)} bytes)", flush=True)
                return response.content
            else:
                print(f"🎙️ OpenAI TTS error: {response.status_code} - {response.text}", flush=True)
                return None
                
    except Exception as e:
        print(f"🎙️ OpenAI TTS exception: {e}", flush=True)
        return None


async def generate_speech(
    text: str,
    language: str = "fr",
    voice_preference: str = "warm",
    use_cache: bool = True
) -> Tuple[Optional[bytes], str]:
    """
    Génère de la parole avec fallback automatique.
    
    ElevenLabs (principal) → OpenAI TTS (fallback)
    
    Args:
        text: Texte à convertir en parole
        language: Code langue (fr, en)
        voice_preference: Style de voix (warm, calm, clear, narrative)
        use_cache: Utiliser le cache
    
    Returns:
        Tuple (audio_bytes, provider_used) ou (None, error_message)
    """
    # Nettoyer le texte
    cleaned_text = clean_text_for_tts(text)
    
    # Vérifier la longueur
    if len(cleaned_text) > MAX_TEXT_LENGTH:
        cleaned_text = cleaned_text[:MAX_TEXT_LENGTH] + "..."
    
    if not cleaned_text.strip():
        return None, "empty_text"
    
    # Sélectionner la voix ElevenLabs
    if language == "fr":
        voice_map = {
            "warm": "fr_female_warm",
            "calm": "fr_male_calm", 
            "soft": "fr_female_soft",
            "narrative": "fr_male_narrative",
        }
    else:
        voice_map = {
            "warm": "multilingual_warm",
            "calm": "multilingual_warm",
            "soft": "multilingual_clear",
            "narrative": "multilingual_clear",
        }
    
    elevenlabs_voice_key = voice_map.get(voice_preference, "warm")
    elevenlabs_voice_id = ELEVENLABS_VOICES.get(elevenlabs_voice_key, ELEVENLABS_VOICES["multilingual_warm"])
    
    # Vérifier le cache
    cache_key = get_cache_key(cleaned_text, elevenlabs_voice_key, "elevenlabs")
    if use_cache:
        cached = get_cached_audio(cache_key)
        if cached:
            print("🎙️ Cache hit", flush=True)
            return cached, "cache"
    
    # Essayer ElevenLabs d'abord (meilleure qualité)
    audio = await generate_speech_elevenlabs(cleaned_text, elevenlabs_voice_id, language)
    if audio:
        if use_cache:
            save_to_cache(cache_key, audio)
        return audio, "elevenlabs"
    
    # Fallback sur OpenAI TTS
    print("🎙️ Fallback to OpenAI TTS", flush=True)
    openai_voice = "nova" if voice_preference in ["warm", "soft"] else "onyx"
    
    cache_key_openai = get_cache_key(cleaned_text, openai_voice, "openai")
    if use_cache:
        cached = get_cached_audio(cache_key_openai)
        if cached:
            return cached, "cache"
    
    audio = await generate_speech_openai(cleaned_text, openai_voice)
    if audio:
        if use_cache:
            save_to_cache(cache_key_openai, audio)
        return audio, "openai"
    
    return None, "all_providers_failed"


async def generate_speech_with_provider(
    text: str,
    language: str = "fr",
    voice_preference: str = "warm",
    provider: str = "auto",
    use_cache: bool = True
) -> Tuple[Optional[bytes], str]:
    """
    Génère de la parole avec choix explicite du provider.
    
    Providers disponibles:
    - "auto": ElevenLabs puis OpenAI en fallback (défaut)
    - "openai": OpenAI TTS directement (voix nova/onyx)
    - "elevenlabs": ElevenLabs uniquement (sans fallback)
    
    Args:
        text: Texte à convertir
        language: Code langue (fr, en)
        voice_preference: Style de voix (warm, calm, soft, narrative)
        provider: "auto", "openai", ou "elevenlabs"
        use_cache: Utiliser le cache
    
    Returns:
        Tuple (audio_bytes, provider_used) ou (None, error_message)
    """
    # Nettoyer le texte
    cleaned_text = clean_text_for_tts(text)
    
    if len(cleaned_text) > MAX_TEXT_LENGTH:
        cleaned_text = cleaned_text[:MAX_TEXT_LENGTH] + "..."
    
    if not cleaned_text.strip():
        return None, "empty_text"
    
    # Mode OpenAI direct (premium)
    if provider == "openai":
        # Mapping voix OpenAI
        openai_voice_map = {
            "warm": "nova",
            "calm": "onyx",
            "soft": "shimmer",
            "narrative": "fable"
        }
        openai_voice = openai_voice_map.get(voice_preference, "nova")
        
        cache_key = get_cache_key(cleaned_text, openai_voice, "openai")
        if use_cache:
            cached = get_cached_audio(cache_key)
            if cached:
                return cached, "cache"
        
        audio = await generate_speech_openai(cleaned_text, openai_voice)
        if audio:
            if use_cache:
                save_to_cache(cache_key, audio)
            return audio, "openai"
        return None, "openai_failed"
    
    # Mode ElevenLabs direct
    elif provider == "elevenlabs":
        if language == "fr":
            voice_map = {
                "warm": "fr_female_warm",
                "calm": "fr_male_calm",
                "soft": "fr_female_soft",
                "narrative": "fr_male_narrative",
            }
        else:
            voice_map = {
                "warm": "multilingual_warm",
                "calm": "multilingual_warm",
                "soft": "multilingual_clear",
                "narrative": "multilingual_clear",
            }
        
        voice_key = voice_map.get(voice_preference, "warm")
        voice_id = ELEVENLABS_VOICES.get(voice_key, ELEVENLABS_VOICES["multilingual_warm"])
        
        cache_key = get_cache_key(cleaned_text, voice_key, "elevenlabs")
        if use_cache:
            cached = get_cached_audio(cache_key)
            if cached:
                return cached, "cache"
        
        audio = await generate_speech_elevenlabs(cleaned_text, voice_id, language)
        if audio:
            if use_cache:
                save_to_cache(cache_key, audio)
            return audio, "elevenlabs"
        return None, "elevenlabs_failed"
    
    # Mode auto (défaut) - ElevenLabs avec fallback OpenAI
    else:
        return await generate_speech(text, language, voice_preference, use_cache)


def estimate_duration(text: str) -> float:
    """
    Estime la durée de l'audio en secondes.
    Moyenne: ~150 mots/minute = 2.5 mots/seconde
    """
    words = len(text.split())
    return words / 2.5


def estimate_cost(text: str, provider: str = "elevenlabs") -> float:
    """
    Estime le coût de génération.
    
    ElevenLabs: ~$0.30/1000 caractères
    OpenAI TTS-1: ~$0.015/1000 caractères
    """
    chars = len(text)
    if provider == "elevenlabs":
        return (chars / 1000) * 0.30
    else:
        return (chars / 1000) * 0.015
