"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  ⚙️  Constantes pour le pipeline external_pages                                    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  - TRACKING_PARAMS  : query params à supprimer (utm_*, fbclid, gclid, …)           ║
║  - BLACKLIST_HOSTS  : hôtes à exclure systématiquement (YouTube, TikTok, etc.)     ║
║  - SHORTENER_HOSTS  : raccourcisseurs URL (informationnel — utilisé par PR 2 pour  ║
║                      forcer le HEAD avant scrape)                                  ║
║  - MAX_HOPS         : nombre maximum de redirects HTTP à suivre                    ║
║  - TIMEOUTS         : timeouts http pour HEAD / GET                                ║
║  - PLAN_CAPS        : nombre max d'URLs résolues / page-cards par plan             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from typing import Dict, Set


# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 Tracking parameters — à strip de toutes les URLs
# ═══════════════════════════════════════════════════════════════════════════════
# Couvre les standards les plus répandus :
# - utm_* : Google Analytics / campagnes
# - fbclid : Facebook click ID
# - gclid : Google click ID
# - mc_cid / mc_eid : MailChimp
# - igshid : Instagram
# - ref : referrer générique très souvent tracking
# - _ga, _gl : Google Analytics linker
TRACKING_PARAMS: Set[str] = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_name",
    "utm_brand",
    "utm_social",
    "utm_social-type",
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "msclkid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "_ga",
    "_gl",
    "yclid",
    "twclid",
    "ttclid",  # TikTok
    "spm",  # Aliexpress / Lazada
    "ref",
    "ref_src",
    "ref_url",
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🚫 Blacklist hosts — exclure ces hôtes du pipeline external_pages
# ═══════════════════════════════════════════════════════════════════════════════
# Rationale :
# - YouTube / TikTok : on analyse déjà la vidéo elle-même, pas pertinent.
# - facebook.com / instagram.com / twitter.com / x.com : pages de login souvent,
#   contenu privé, pas adapté au scraping HEAD/GET.
# - réseaux sociaux navigation pure : on ne tire rien d'utile via HEAD.
BLACKLIST_HOSTS: Set[str] = {
    # YouTube
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
    # TikTok
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
    # Sociaux navigation (login wall, contenu privé)
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "instagram.com",
    "www.instagram.com",
    "twitter.com",
    "www.twitter.com",
    "x.com",
    "www.x.com",
    "linkedin.com",
    "www.linkedin.com",
    # Plateformes vidéo concurrentes (on n'analyse pas la vidéo, juste la page)
    "twitch.tv",
    "www.twitch.tv",
    "vimeo.com",
    "www.vimeo.com",
    "dailymotion.com",
    "www.dailymotion.com",
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🔗 URL shorteners — utilisé par PR 2 pour expansion préalable
# ═══════════════════════════════════════════════════════════════════════════════
SHORTENER_HOSTS: Set[str] = {
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "lnkd.in",
    "shor.tn",
    "rebrand.ly",
    "cutt.ly",
    "tiny.cc",
    "rb.gy",
    "shorturl.at",
    "trib.al",
    "amzn.to",
    "fb.me",
    "youtu.be",  # YouTube short — mais déjà blacklisté
}

# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 Limites de résolution
# ═══════════════════════════════════════════════════════════════════════════════
# Au-delà de MAX_HOPS redirects, on considère que l'URL est suspecte ou pirate.
MAX_HOPS: int = 5

# Timeouts (secondes) — courts car on parse beaucoup d'URLs en parallèle.
TIMEOUTS: Dict[str, float] = {
    "head": 5.0,  # HEAD request pour résolution
    "get": 8.0,  # GET request (PR 2 — scraping)
}

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 Plan caps — nombre max d'URLs externes traitées par plan
# ═══════════════════════════════════════════════════════════════════════════════
# Cap *post*-filtrage (après blacklist / dedup). PR 2/3 utiliseront ces caps
# pour limiter le scraping (économise du quota proxy et latence Mistral).
#
# Free=0 : feature gatée Pro+ → l'UI affiche un CTA upgrade côté frontend.
# Les plans legacy ("plus", "starter") sont normalisés vers "pro"/"free"
# via core/plan_limits.normalize_plan_id, donc pas d'entries dédiées ici.
# Tout plan inconnu fallback à 0 via .get(plan, 0) côté orchestrator.
#
# Source de vérité : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §8
PLAN_CAPS: Dict[str, int] = {
    "free": 0,
    "pro": 5,
    "expert": 10,
}
