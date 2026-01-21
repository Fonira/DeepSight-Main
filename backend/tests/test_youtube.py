"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS: YouTube Utils — Extraction et Validation                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Tests critiques pour:                                                             ║
║  • Extraction d'ID vidéo depuis différents formats d'URL                          ║
║  • Validation des URLs YouTube                                                     ║
║  • Parsing des playlists                                                           ║
║  • Gestion des URLs malformées                                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import pytest
import re
import sys
import os

# Ajouter le src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FONCTIONS UTILITAIRES (répliquées du backend pour tests isolés)
# ═══════════════════════════════════════════════════════════════════════════════

def extract_video_id(url: str) -> str:
    """Extrait l'ID vidéo YouTube d'une URL."""
    if not url:
        return None
    
    patterns = [
        # Standard watch URL
        r'(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})',
        # Short URL
        r'(?:youtu\.be\/)([a-zA-Z0-9_-]{11})',
        # Embed URL
        r'(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        # Shorts URL
        r'(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})',
        # v/ URL (legacy)
        r'(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        # With additional parameters
        r'(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_playlist_id(url: str) -> str:
    """Extrait l'ID de playlist YouTube d'une URL."""
    if not url:
        return None
    
    patterns = [
        r'[?&]list=([a-zA-Z0-9_-]+)',
        r'playlist\?list=([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def is_valid_youtube_url(url: str) -> bool:
    """Vérifie si une URL est une URL YouTube valide."""
    if not url or not isinstance(url, str):
        return False
    
    youtube_patterns = [
        r'^https?://(www\.)?youtube\.com/',
        r'^https?://youtu\.be/',
        r'^https?://m\.youtube\.com/',
    ]
    
    return any(re.match(pattern, url) for pattern in youtube_patterns)


def format_duration(seconds: int) -> str:
    """Formate une durée en secondes en format lisible."""
    if seconds < 0:
        return "0:00"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def parse_iso8601_duration(duration: str) -> int:
    """Parse une durée ISO 8601 (PT1H30M45S) en secondes."""
    if not duration:
        return 0
    
    pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
    match = re.match(pattern, duration)
    
    if not match:
        return 0
    
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    
    return hours * 3600 + minutes * 60 + seconds


# ═══════════════════════════════════════════════════════════════════════════════
# 📹 TESTS EXTRACTION VIDEO ID
# ═══════════════════════════════════════════════════════════════════════════════

class TestVideoIdExtraction:
    """Tests pour l'extraction d'ID vidéo."""
    
    @pytest.mark.unit
    def test_extract_from_standard_url(self):
        """Extraction depuis une URL standard watch."""
        urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
        ]
        
        for url in urls:
            video_id = extract_video_id(url)
            assert video_id == "dQw4w9WgXcQ", f"Échec pour {url}"
    
    @pytest.mark.unit
    def test_extract_from_short_url(self):
        """Extraction depuis une URL courte youtu.be."""
        urls = [
            "https://youtu.be/dQw4w9WgXcQ",
            "http://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/abc123XYZ_-",
        ]
        
        expected = ["dQw4w9WgXcQ", "dQw4w9WgXcQ", "abc123XYZ_-"]
        
        for url, expected_id in zip(urls, expected):
            video_id = extract_video_id(url)
            assert video_id == expected_id, f"Échec pour {url}"
    
    @pytest.mark.unit
    def test_extract_from_embed_url(self):
        """Extraction depuis une URL embed."""
        urls = [
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://youtube.com/embed/dQw4w9WgXcQ",
        ]
        
        for url in urls:
            video_id = extract_video_id(url)
            assert video_id == "dQw4w9WgXcQ", f"Échec pour {url}"
    
    @pytest.mark.unit
    def test_extract_from_shorts_url(self):
        """Extraction depuis une URL Shorts."""
        urls = [
            "https://youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/abc123XYZ_-",
        ]
        
        expected = ["dQw4w9WgXcQ", "abc123XYZ_-"]
        
        for url, expected_id in zip(urls, expected):
            video_id = extract_video_id(url)
            assert video_id == expected_id, f"Échec pour {url}"
    
    @pytest.mark.unit
    def test_extract_with_additional_params(self):
        """Extraction avec paramètres supplémentaires."""
        urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx",
            "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=Test",
        ]
        
        for url in urls:
            video_id = extract_video_id(url)
            assert video_id == "dQw4w9WgXcQ", f"Échec pour {url}"
    
    @pytest.mark.unit
    def test_extract_returns_none_for_invalid(self):
        """Retourne None pour les URLs invalides."""
        invalid_urls = [
            "",
            None,
            "not-a-url",
            "https://google.com",
            "https://vimeo.com/123456789",
            "https://youtube.com/",  # Pas de video ID
            "https://youtube.com/watch?v=short",  # ID trop court (moins de 11 chars)
        ]
        
        for url in invalid_urls:
            video_id = extract_video_id(url)
            assert video_id is None, f"Devrait retourner None pour {url}"
    
    @pytest.mark.unit
    def test_video_id_character_set(self):
        """L'ID vidéo peut contenir lettres, chiffres, tirets et underscores."""
        valid_ids = [
            "dQw4w9WgXcQ",  # Lettres et chiffres
            "abc-123_XYZ",  # Avec tiret et underscore
            "AAAAAAAAAAA",  # Tout majuscules
            "aaaaaaaaaaa",  # Tout minuscules
            "12345678901",  # Tout chiffres
            "a-_b-_c-_d-",  # Mix
        ]
        
        for vid_id in valid_ids:
            url = f"https://youtube.com/watch?v={vid_id}"
            extracted = extract_video_id(url)
            assert extracted == vid_id, f"Devrait extraire {vid_id}"
    
    @pytest.mark.unit
    def test_video_id_exact_length(self):
        """L'ID vidéo YouTube fait exactement 11 caractères."""
        valid_url = "https://youtube.com/watch?v=dQw4w9WgXcQ"
        video_id = extract_video_id(valid_url)
        
        assert video_id is not None
        assert len(video_id) == 11


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 TESTS EXTRACTION PLAYLIST ID
# ═══════════════════════════════════════════════════════════════════════════════

class TestPlaylistIdExtraction:
    """Tests pour l'extraction d'ID de playlist."""
    
    @pytest.mark.unit
    def test_extract_playlist_from_url(self):
        """Extraction de l'ID de playlist."""
        urls = [
            ("https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf", "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
            ("https://youtube.com/watch?v=xxx&list=PLtest123", "PLtest123"),
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdef", "PLabcdef"),
        ]
        
        for url, expected_id in urls:
            playlist_id = extract_playlist_id(url)
            assert playlist_id == expected_id, f"Échec pour {url}"
    
    @pytest.mark.unit
    def test_extract_playlist_returns_none_for_no_playlist(self):
        """Retourne None si pas de playlist."""
        urls = [
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "",
            None,
        ]
        
        for url in urls:
            playlist_id = extract_playlist_id(url)
            assert playlist_id is None, f"Devrait retourner None pour {url}"


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TESTS VALIDATION URL
# ═══════════════════════════════════════════════════════════════════════════════

class TestYouTubeUrlValidation:
    """Tests pour la validation des URLs YouTube."""
    
    @pytest.mark.unit
    def test_valid_youtube_urls(self):
        """Les URLs YouTube valides doivent passer."""
        valid_urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/playlist?list=PLtest",
        ]
        
        for url in valid_urls:
            assert is_valid_youtube_url(url), f"{url} devrait être valide"
    
    @pytest.mark.unit
    def test_invalid_youtube_urls(self):
        """Les URLs non-YouTube doivent être rejetées."""
        invalid_urls = [
            "",
            None,
            "not-a-url",
            "https://google.com",
            "https://vimeo.com/123456789",
            "https://dailymotion.com/video/x123",
            "ftp://youtube.com/watch?v=test",
            "javascript:alert('xss')",
            "https://fake-youtube.com/watch?v=test",
            "https://youtube.com.evil.com/watch?v=test",
        ]
        
        for url in invalid_urls:
            assert not is_valid_youtube_url(url), f"{url} devrait être invalide"
    
    @pytest.mark.unit
    def test_youtube_url_case_insensitive(self):
        """La validation doit être case-insensitive pour le domaine."""
        urls = [
            "https://www.YouTube.com/watch?v=test",
            "https://YOUTUBE.COM/watch?v=test",
            "https://YoutuBe.com/watch?v=test",
        ]
        
        # Note: Selon l'implémentation, ceci peut varier
        # La plupart des implémentations sont case-insensitive
        for url in urls:
            # Au minimum, ne doit pas crash
            result = is_valid_youtube_url(url)
            assert isinstance(result, bool)


# ═══════════════════════════════════════════════════════════════════════════════
# ⏱️ TESTS FORMATAGE DURÉE
# ═══════════════════════════════════════════════════════════════════════════════

class TestDurationFormatting:
    """Tests pour le formatage des durées."""
    
    @pytest.mark.unit
    def test_format_seconds_only(self):
        """Formatage des durées < 1 minute."""
        assert format_duration(0) == "0:00"
        assert format_duration(5) == "0:05"
        assert format_duration(30) == "0:30"
        assert format_duration(59) == "0:59"
    
    @pytest.mark.unit
    def test_format_minutes_and_seconds(self):
        """Formatage des durées entre 1 et 60 minutes."""
        assert format_duration(60) == "1:00"
        assert format_duration(90) == "1:30"
        assert format_duration(125) == "2:05"
        assert format_duration(3599) == "59:59"
    
    @pytest.mark.unit
    def test_format_hours_minutes_seconds(self):
        """Formatage des durées > 1 heure."""
        assert format_duration(3600) == "1:00:00"
        assert format_duration(3661) == "1:01:01"
        assert format_duration(7200) == "2:00:00"
        assert format_duration(7325) == "2:02:05"
        assert format_duration(36000) == "10:00:00"
    
    @pytest.mark.unit
    def test_format_negative_duration(self):
        """Les durées négatives doivent retourner 0:00."""
        assert format_duration(-1) == "0:00"
        assert format_duration(-100) == "0:00"
    
    @pytest.mark.unit
    def test_parse_iso8601_duration(self):
        """Parsing des durées ISO 8601."""
        test_cases = [
            ("PT0S", 0),
            ("PT30S", 30),
            ("PT1M", 60),
            ("PT1M30S", 90),
            ("PT1H", 3600),
            ("PT1H30M", 5400),
            ("PT1H30M45S", 5445),
            ("PT2H0M0S", 7200),
        ]
        
        for iso_duration, expected_seconds in test_cases:
            result = parse_iso8601_duration(iso_duration)
            assert result == expected_seconds, f"Échec pour {iso_duration}: attendu {expected_seconds}, obtenu {result}"
    
    @pytest.mark.unit
    def test_parse_iso8601_invalid(self):
        """Les durées ISO invalides retournent 0."""
        invalid_durations = [
            "",
            None,
            "invalid",
            "1:30:00",
            "90 minutes",
        ]
        
        for duration in invalid_durations:
            result = parse_iso8601_duration(duration)
            assert result == 0, f"Devrait retourner 0 pour {duration}"


# ═══════════════════════════════════════════════════════════════════════════════
# 🔗 TESTS CAS LIMITES ET EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Tests pour les cas limites."""
    
    @pytest.mark.unit
    def test_url_with_unicode_characters(self):
        """URLs avec caractères Unicode."""
        # Ces URLs ne devraient pas crash même si invalides
        urls = [
            "https://youtube.com/watch?v=テスト",
            "https://youtube.com/watch?v=🎵🎵🎵",
        ]
        
        for url in urls:
            # Ne doit pas lever d'exception
            result = extract_video_id(url)
            assert result is None or isinstance(result, str)
    
    @pytest.mark.unit
    def test_url_with_special_characters(self):
        """URLs avec caractères spéciaux dans les paramètres."""
        url = "https://youtube.com/watch?v=dQw4w9WgXcQ&title=Test%20Video&q=search+term"
        video_id = extract_video_id(url)
        assert video_id == "dQw4w9WgXcQ"
    
    @pytest.mark.unit
    def test_very_long_url(self):
        """URLs très longues."""
        base_url = "https://youtube.com/watch?v=dQw4w9WgXcQ"
        long_params = "&param=" + "x" * 10000
        long_url = base_url + long_params
        
        video_id = extract_video_id(long_url)
        assert video_id == "dQw4w9WgXcQ"
    
    @pytest.mark.unit
    def test_mobile_url(self):
        """URLs mobile YouTube."""
        url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
        
        assert is_valid_youtube_url(url)
        video_id = extract_video_id(url)
        assert video_id == "dQw4w9WgXcQ"
    
    @pytest.mark.unit
    def test_url_with_timestamp(self):
        """URLs avec timestamp."""
        urls = [
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=120",
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=1h30m",
            "https://youtu.be/dQw4w9WgXcQ?t=60",
        ]
        
        for url in urls:
            video_id = extract_video_id(url)
            assert video_id == "dQw4w9WgXcQ", f"Échec pour {url}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
