"""
Tests for Sprint D — Proxy V2 advanced (tiered resilience).

Couvre :
  - `ProxyResilienceManager` : circuit breaker state, tier upgrade, reset window.
  - `_yt_dlp_extra_args(proxy_variant=...)` : selection du variant + fallback gracieux
    si le setting est None.
  - `_resolve_proxy_variant(...)` : mapping variant → setting + cascade vers default.
"""

import os
import sys
import time
import pytest


sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


# ═════════════════════════════════════════════════════════════════════════
# 🛡️ ProxyResilienceManager
# ═════════════════════════════════════════════════════════════════════════


class TestProxyResilienceManager:
    """Circuit breaker state + tier selection."""

    def _make(self, threshold=3, window_s=60, reset_s=300):
        from core.proxy_resilience import ProxyResilienceManager

        return ProxyResilienceManager(threshold=threshold, window_s=window_s, reset_s=reset_s)

    def test_initial_tier_is_default(self):
        mgr = self._make()
        assert mgr.select_proxy_variant(platform="youtube") == "default"

    def test_tier_upgrade_after_threshold_errors(self):
        """Apres > threshold erreurs sur 'default', on bascule sur 'sticky'."""
        mgr = self._make(threshold=3, window_s=60)
        for _ in range(4):
            mgr.report_error("default", "429")
        assert mgr.select_proxy_variant(platform="youtube") == "sticky"

    def test_tier_cascade_through_all(self):
        """Si tous les tiers cumulent des erreurs, on tombe sur 'none' (last resort)."""
        mgr = self._make(threshold=2, window_s=60)
        for tier in ("default", "sticky", "geo_us", "geo_fr", "legacy"):
            for _ in range(3):
                mgr.report_error(tier, "blocked")
        assert mgr.select_proxy_variant(platform="tiktok") == "none"

    def test_geo_hint_us_selects_geo_us(self):
        """Tier 3 — geo_us choisi par defaut, geo_fr saute (hint != fr)."""
        mgr = self._make(threshold=2, window_s=60)
        # Sature default + sticky
        for _ in range(3):
            mgr.report_error("default", "429")
            mgr.report_error("sticky", "blocked")
        # Sans hint → geo_us
        assert mgr.select_proxy_variant(platform="youtube") == "geo_us"
        # Avec hint='us' → geo_us (idem)
        assert mgr.select_proxy_variant(platform="youtube", geo_hint="us") == "geo_us"

    def test_geo_hint_fr_selects_geo_fr(self):
        """Tier 3 — hint='fr' selectionne geo_fr (geo_us saute)."""
        mgr = self._make(threshold=2, window_s=60)
        for _ in range(3):
            mgr.report_error("default", "429")
            mgr.report_error("sticky", "blocked")
        assert mgr.select_proxy_variant(platform="tiktok", geo_hint="fr") == "geo_fr"

    def test_error_window_pruning(self, monkeypatch):
        """Erreurs hors fenetre glissante sont ignorees."""
        import core.proxy_resilience as pr

        mgr = self._make(threshold=3, window_s=10)

        # On falsifie time.monotonic pour simuler le passage du temps.
        fake_time = [1000.0]

        def fake_monotonic():
            return fake_time[0]

        monkeypatch.setattr(pr.time, "monotonic", fake_monotonic)

        # 4 erreurs a t=1000 → seuil depasse, bascule sticky
        for _ in range(4):
            mgr.report_error("default", "429")
        assert mgr.select_proxy_variant(platform="youtube") == "sticky"

        # On avance de 20s (au-dela de window_s=10) — les anciennes erreurs sont oubliees
        fake_time[0] += 20
        assert mgr.select_proxy_variant(platform="youtube") == "default"

    def test_partial_reset_on_success(self):
        """report_success pop la plus ancienne erreur (anti-thrashing)."""
        mgr = self._make(threshold=3, window_s=60)
        for _ in range(4):
            mgr.report_error("default", "429")
        # Maintenant 4 erreurs → on bascule sticky
        assert mgr.select_proxy_variant(platform="youtube") == "sticky"

        # 1 success → 3 erreurs restantes (seuil = 3, donc <= seuil → default)
        mgr.report_success("default")
        assert mgr.select_proxy_variant(platform="youtube") == "default"

    def test_full_reset_after_reset_s(self, monkeypatch):
        """Apres reset_s sans erreur ET avec success enregistre, le tier est reset."""
        import core.proxy_resilience as pr

        mgr = self._make(threshold=2, window_s=600, reset_s=120)
        fake_time = [1000.0]

        def fake_monotonic():
            return fake_time[0]

        monkeypatch.setattr(pr.time, "monotonic", fake_monotonic)

        # 3 erreurs → seuil depasse
        for _ in range(3):
            mgr.report_error("default", "blocked")
        assert mgr.select_proxy_variant(platform="youtube") == "sticky"

        # On avance 5s puis success
        fake_time[0] += 5
        mgr.report_success("default")  # pop 1, reste 2 erreurs

        # Toujours sticky tant qu'on n'a pas attendu reset_s
        # 2 erreurs <= threshold=2 → default
        assert mgr.select_proxy_variant(platform="youtube") == "default"

        # On avance 150s (reset_s=120 depasse) — les erreurs anciennes sont nettoyees
        fake_time[0] += 150
        assert mgr.select_proxy_variant(platform="youtube") == "default"
        state = mgr.get_state()
        assert state["default"]["errors_in_window"] == 0

    def test_report_error_unknown_variant_is_silent(self):
        """Robustesse : un variant inconnu ne crashe pas."""
        mgr = self._make()
        mgr.report_error("nonexistent_tier", "other")  # ne doit pas raise
        assert mgr.select_proxy_variant(platform="youtube") == "default"

    def test_report_success_unknown_variant_is_silent(self):
        """Robustesse : success sur variant inconnu ne crashe pas."""
        mgr = self._make()
        mgr.report_success("nonexistent_tier")  # ne doit pas raise

    def test_get_state_snapshot(self):
        """`get_state` retourne un snapshot exploitable pour debug/metrics."""
        mgr = self._make(threshold=5, window_s=60)
        mgr.report_error("default", "429")
        mgr.report_error("sticky", "blocked")
        mgr.report_error("sticky", "blocked")

        state = mgr.get_state()
        assert state["default"]["errors_in_window"] == 1
        assert state["sticky"]["errors_in_window"] == 2
        assert state["geo_us"]["errors_in_window"] == 0
        # All tiers tracked
        assert set(state.keys()) == {"default", "sticky", "geo_us", "geo_fr", "legacy", "none"}

    def test_singleton_returns_same_instance(self):
        """`instance()` retourne le meme objet a chaque appel."""
        from core.proxy_resilience import ProxyResilienceManager

        ProxyResilienceManager.reset_instance()
        a = ProxyResilienceManager.instance()
        b = ProxyResilienceManager.instance()
        assert a is b
        ProxyResilienceManager.reset_instance()


# ═════════════════════════════════════════════════════════════════════════
# 🔧 _resolve_proxy_variant + _yt_dlp_extra_args
# ═════════════════════════════════════════════════════════════════════════


class TestResolveProxyVariant:
    """Mapping variant → setting + fallback gracieux."""

    def test_default_returns_main_proxy(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://default:1080")
        assert audio_utils._resolve_proxy_variant("default") == "http://default:1080"

    def test_sticky_returns_sticky_setting(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy_sticky", lambda: "http://sticky:10001")
        assert audio_utils._resolve_proxy_variant("sticky") == "http://sticky:10001"

    def test_geo_us_returns_geo_setting(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy_geo_us", lambda: "http://geo-us:7000")
        assert audio_utils._resolve_proxy_variant("geo_us") == "http://geo-us:7000"

    def test_none_returns_empty(self):
        from transcripts import audio_utils

        assert audio_utils._resolve_proxy_variant("none") == ""

    def test_fallback_to_default_when_variant_unset(self, monkeypatch):
        """Si sticky est None, on retombe sur default (avec warning)."""
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://default:7000")
        monkeypatch.setattr(audio_utils, "get_youtube_proxy_sticky", lambda: None)
        # Setting absent → cascade vers default
        assert audio_utils._resolve_proxy_variant("sticky") == "http://default:7000"

    def test_fallback_to_default_for_legacy_when_unset(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://default")
        monkeypatch.setattr(audio_utils, "get_youtube_proxy_legacy", lambda: "")
        assert audio_utils._resolve_proxy_variant("legacy") == "http://default"


class TestYtDlpExtraArgsWithVariant:
    """Signature etendue : _yt_dlp_extra_args(proxy_variant=...)."""

    def test_default_variant_uses_youtube_proxy(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://default:7000")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        args = audio_utils._yt_dlp_extra_args()  # variant = default
        assert args == ["--proxy", "http://default:7000"]

    def test_sticky_variant_uses_sticky_setting(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy_sticky", lambda: "http://sticky:10001")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        args = audio_utils._yt_dlp_extra_args(proxy_variant="sticky")
        assert args == ["--proxy", "http://sticky:10001"]

    def test_none_variant_skips_proxy(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://default:7000")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        args = audio_utils._yt_dlp_extra_args(proxy_variant="none")
        assert args == []  # ni proxy ni cookies

    def test_geo_fr_variant_with_cookies(self, monkeypatch, tmp_path):
        from transcripts import audio_utils

        cookies_file = tmp_path / "cookies.txt"
        cookies_file.write_text("# cookies")

        monkeypatch.setattr(audio_utils, "get_youtube_proxy_geo_fr", lambda: "http://geo-fr:7000")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: str(cookies_file))

        args = audio_utils._yt_dlp_extra_args(proxy_variant="geo_fr")
        assert args == ["--proxy", "http://geo-fr:7000", "--cookies", str(cookies_file)]

    def test_include_proxy_false_skips_variant_resolution(self, monkeypatch):
        """Backward-compat : include_proxy=False ne charge meme pas le variant."""
        from transcripts import audio_utils

        # Setter qui leve si appele — verification que _resolve n'est pas execute
        called = {"n": 0}

        def _spy():
            called["n"] += 1
            return "http://should-not-be-used"

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", _spy)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        args = audio_utils._yt_dlp_extra_args(include_proxy=False, proxy_variant="default")
        assert args == []
        assert called["n"] == 0  # _resolve n'a pas ete appele

    def test_use_tiktok_cookies_with_variant(self, monkeypatch, tmp_path):
        """use_tiktok_cookies + proxy_variant coexistent."""
        from transcripts import audio_utils

        cookies_file = tmp_path / "tiktok-cookies.txt"
        cookies_file.write_text("# tiktok")

        monkeypatch.setattr(audio_utils, "get_youtube_proxy_sticky", lambda: "http://sticky:10001")
        monkeypatch.setattr(audio_utils, "get_tiktok_cookies_path", lambda: str(cookies_file))
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        args = audio_utils._yt_dlp_extra_args(
            use_tiktok_cookies=True, proxy_variant="sticky"
        )
        assert args == ["--proxy", "http://sticky:10001", "--cookies", str(cookies_file)]

    def test_variant_fallback_when_setting_empty(self, monkeypatch):
        """Variant demande mais setting vide → cascade vers YOUTUBE_PROXY."""
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://default")
        monkeypatch.setattr(audio_utils, "get_youtube_proxy_legacy", lambda: None)
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        # legacy n'est pas configure → fallback vers default
        args = audio_utils._yt_dlp_extra_args(proxy_variant="legacy")
        assert args == ["--proxy", "http://default"]

    def test_backward_compat_no_variant_arg(self, monkeypatch):
        """Appel sans proxy_variant garde le comportement legacy (default)."""
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://legacy-call")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        # Aucun nouvel argument — comportement strictement equivalent au Sprint A
        args = audio_utils._yt_dlp_extra_args(include_proxy=True, use_tiktok_cookies=False)
        assert args == ["--proxy", "http://legacy-call"]
