#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — diagnostic des transcriptions Supadata depuis le container API
#
# Usage (sur le serveur, en deploy) :
#   /opt/deepsight/repo/deploy/vps/scripts/diag-transcripts.sh [ID_VIDEO_YOUTUBE]
#
# Rejoue les appels Supadata de l'API avec le même client Python (httpx), avec et
# sans l'en-tête User-Agent « navigateur » qu'envoie le client partagé du backend,
# puis affiche les dernières lignes Supadata des logs. N'affiche jamais la clé.
# Coût : 1 crédit Supadata par appel réussi (3 au maximum).
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

VIDEO_ID="${1:-zGhrYMRAoCs}"
CONTAINER="${CONTAINER:-repo-backend-1}"

docker exec -i -e VIDEO_ID="$VIDEO_ID" "$CONTAINER" python - <<'PY'
import os
import time

import httpx

key = os.environ.get("SUPADATA_API_KEY", "")
vid = os.environ["VIDEO_ID"]
print(f"Clé Supadata chargée : {'oui' if key else 'NON'} ({len(key)} caractères)")

chrome = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}
tests = [
    ("YT  + UA navigateur", "https://api.supadata.ai/v1/youtube/transcript", {"videoId": vid, "lang": "fr"}, chrome),
    ("YT  + UA httpx     ", "https://api.supadata.ai/v1/youtube/transcript", {"videoId": vid, "lang": "fr"}, {}),
    ("UNI + UA navigateur", "https://api.supadata.ai/v1/transcript", {"url": f"https://www.youtube.com/watch?v={vid}"}, chrome),
]
for name, url, params, headers in tests:
    start = time.monotonic()
    try:
        response = httpx.get(url, params=params, headers={**headers, "x-api-key": key}, timeout=30)
        print(f"{name} : HTTP {response.status_code} en {time.monotonic() - start:.1f}s : {response.text[:100]!r}")
    except Exception as exc:  # diagnostic : on veut voir toute erreur
        print(f"{name} : {type(exc).__name__} après {time.monotonic() - start:.1f}s")
PY

echo "--- Dernières lignes Supadata des logs de l'API (15 min) ---"
docker logs "$CONTAINER" --since 15m 2>&1 | grep -E "SUPADATA|PHASE" | tail -15
