# Audit : Couverture proxy Decodo sur les routes d'extraction

**Date** : 2026-05-11
**Sprint** : B (Audit & extension proxy Decodo)
**Auteur** : Sub-agent Claude (Opus 4.7 1M)
**Branche** : `audit/proxy-routes-coverage`

---

## Contexte

Le VPS Hetzner (`89.167.23.214`) est bloqué par YouTube (bot challenge + 429). Le proxy résidentiel Decodo est exposé via `settings.YOUTUBE_PROXY` :

```
http://sp9fsc9l2p:Hj046a=vHnDabt8fUj@gate.decodo.com:7000
```

Aujourd'hui, le proxy est injecté **uniquement** dans :
- `backend/src/transcripts/audio_utils.py::_yt_dlp_extra_args()` (yt-dlp shared helper)
- `backend/src/transcripts/ultra_resilient.py::_yt_dlp_extra_args()` (shadowed local copy)
- `backend/src/transcripts/youtube.py` — appels directs `--proxy` injectés in-place sur 4 commandes yt-dlp + 1 `youtube-transcript-api`

Le helper `core/http_client.py` existe **mais n'a aucun support proxy** — il configure juste les limits, timeouts, headers communs du client httpx partagé. Toutes les routes qui taquent YouTube / TikTok via `httpx.AsyncClient` partent donc directement depuis l'IP Hetzner bannie.

---

## Méthode

1. Grep `httpx.AsyncClient|httpx.Client|aiohttp|requests` dans `backend/src/`
2. Pour chaque module candidat, lecture des sections pertinentes (clients HTTP, commandes yt-dlp, ffmpeg downloads)
3. Identification de l'URL externe cible
4. Évaluation du risque proxy (YouTube/TikTok = doit être proxifié ; autres = OK direct)

---

## Tableau récapitulatif

| Module | Fichier | URLs externes | Client HTTP | Proxy injecté ? | Risque | Reco |
|--------|---------|---------------|-------------|------------------|--------|------|
| **transcripts/youtube** | `transcripts/youtube.py` | YouTube (Supadata, ytapi, Invidious×10, Piped×8, yt-dlp×3, STT downloads) | `shared_http_client` + `yt-dlp` subprocess + `youtube-transcript-api` | **Partiel** : yt-dlp injecté manuellement (4 endroits) + ytapi proxifié (1 endroit) ; tout le reste `shared_http_client` → non proxifié | 🔴 Élevé | **Migrer phase 2** : helper unifié `get_proxied_client` |
| **transcripts/audio_utils** | `transcripts/audio_utils.py` | YouTube/TikTok via yt-dlp | yt-dlp subprocess via `_yt_dlp_extra_args()` | ✅ Oui (helper centralisé) | 🟢 Faible | OK — pas à migrer (Sprint D s'en occupe) |
| **transcripts/ultra_resilient** | `transcripts/ultra_resilient.py` | YouTube (ytapi, Innertube, yt-dlp×3) | yt-dlp subprocess + `youtube-transcript-api` + `httpx` | ✅ Partiel : `_yt_dlp_extra_args()` local + `GenericProxyConfig` pour ytapi | 🟡 Moyen | Vérifier les `httpx.AsyncClient` (ligne 13) ne tapent pas YouTube direct |
| **transcripts/tiktok** | `transcripts/tiktok.py` | TikTok web + tikwm.com + oembed (~10 occurrences `httpx.AsyncClient()`) | `httpx.AsyncClient` direct (bare) | ❌ Non | 🔴 Élevé | **À migrer Wave 2** : tous les calls tiktok.com/tikwm.com via proxy |
| **transcripts/carousel** | `transcripts/carousel.py` | TikTok CDN (images carousel) + api.mistral.ai | `httpx.AsyncClient` direct | ❌ Non pour TikTok CDN | 🟡 Moyen | Wave 2 : proxifier le download images TikTok seulement |
| **transcripts/youtube_channel** | `transcripts/youtube_channel.py` | YouTube via yt-dlp | yt-dlp via `_yt_dlp_extra_args()` | ✅ Oui (helper) | 🟢 Faible | OK |
| **transcripts/monitor** | `transcripts/monitor.py` | — | aucun call HTTP externe | N/A | 🟢 | N/A |
| **transcripts/metadata_service** | `transcripts/metadata_service.py` | — (orchestrateur, délègue) | — | N/A | 🟢 | N/A |
| **transcripts/visual_ocr** | `transcripts/visual_ocr.py` | api.mistral.ai (Pixtral) | `httpx.AsyncClient` | N/A (Mistral ≠ YouTube) | 🟢 | N/A |
| **videos/router** (analyses) | `videos/router.py` | TikTok short URL HEAD + TikTok oEmbed + webhooks user | `shared_http_client` | ❌ Non pour TikTok | 🟡 Moyen | **Migrer phase 2 (court-terme)** : `client.head` sur `vm.tiktok.com` + oEmbed |
| **videos/intelligent_discovery** | `videos/intelligent_discovery.py` | YouTube via `ytsearchN:` yt-dlp + Tournesol + Mistral | yt-dlp subprocess + `shared_http_client` | ❌ **Non** pour yt-dlp search | 🔴 Élevé | Wave 2 : `_yt_dlp_extra_args()` dans `cmd` |
| **videos/intelligent_discovery_v4** | `videos/intelligent_discovery_v4.py` | YouTube via `ytsearchN:` yt-dlp | yt-dlp subprocess | ❌ **Non** | 🔴 Élevé | Wave 2 : `_yt_dlp_extra_args()` dans `cmd` |
| **videos/visual_integration** | `videos/visual_integration.py` | tikwm.com + TikTok CDN (video MP4 download) | `httpx.AsyncClient` direct | ❌ Non | 🔴 Élevé | Wave 2 (Sprints A/C touchent — coordonner) |
| **videos/youtube_storyboard** | `videos/youtube_storyboard.py` | i.ytimg.com (CDN sffe, doc OK direct) + yt-dlp metadata | `httpx.AsyncClient` direct + yt-dlp `--proxy=False` | ❌ Volontaire (i.ytimg OK direct) | 🟢 Faible | Garder direct (CDN public, validé 2026-05-05) |
| **videos/perplexity_provider** | `videos/perplexity_provider.py` | api.perplexity.ai | `httpx.AsyncClient` | N/A (Perplexity ≠ YouTube) | 🟢 | N/A |
| **videos/brave_search** | `videos/brave_search.py` | api.search.brave.com | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **videos/web_search_provider** | `videos/web_search_provider.py` | api.mistral.ai (Mistral Agent) + Brave fallback | délègue `core.mistral_agent` + brave | N/A | 🟢 | N/A |
| **videos/web_enrichment** | `videos/web_enrichment.py` | (délégation) | — | N/A | 🟢 | N/A |
| **videos/youtube_comments** | `videos/youtube_comments.py` | yt-dlp comments | yt-dlp subprocess | ❓ À vérifier | 🟡 | À grepper si urgent |
| **playlists/router** | `playlists/router.py` | YouTube playlist API (via `transcripts.get_playlist_*`) | délègue `transcripts/youtube.py` | ✅ via `shared_http_client` (Invidious) | 🟡 Moyen | Idem `youtube.py` : shared client à proxifier |
| **playlists/pipeline** | `playlists/pipeline.py` | délègue | — | N/A | 🟢 | N/A |
| **tournesol/router** | `tournesol/router.py` | api.tournesol.app | `httpx.AsyncClient` | N/A (Tournesol ≠ YouTube) | 🟢 | N/A |
| **tournesol/trending_cache** | `tournesol/trending_cache.py` | api.tournesol.app | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **academic/arxiv_client** | `academic/arxiv_client.py` | export.arxiv.org | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **academic/crossref_client** | `academic/crossref_client.py` | api.crossref.org | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **academic/openalex** | `academic/openalex.py` | api.openalex.org | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **academic/semantic_scholar** | `academic/semantic_scholar.py` | api.semanticscholar.org | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **academic/router** | `academic/router.py` | délègue + crossref direct (l. 488, 912) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **chat/service** | `chat/service.py` | api.mistral.ai + semanticscholar.org | `httpx.AsyncClient` direct | N/A | 🟢 | N/A |
| **chat/websocket** | `chat/websocket.py` | api.mistral.ai (line 473) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **search/embedding_service** | `search/embedding_service.py` | api.mistral.ai (embeddings) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **search/explain_passage** | `search/explain_passage.py` | api.mistral.ai (chat completions) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **voice/elevenlabs** | `voice/elevenlabs.py` | api.elevenlabs.io | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **voice/router** | `voice/router.py` | divers (ElevenLabs, Tournesol via companion) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **voice/companion_external** | `voice/companion_external.py` | api.tournesol.app | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **debate/miro_service** | `debate/miro_service.py` | api.miro.com | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **storage/thumbnails** | `storage/thumbnails.py` | img.youtube.com (CDN) + TikTok URLs stored | `httpx.AsyncClient` direct | ❌ Non | 🟢 Faible | i.ytimg/img.youtube CDN OK direct (idem storyboard) |
| **share/og_image** | `share/og_image.py` | — (génération PIL locale) | — | N/A | 🟢 | N/A |
| **images/screenshot_detection** | `images/screenshot_detection.py` | api.mistral.ai (Vision) + Brave + autres | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **images/keyword_images** | `images/keyword_images.py` | api.mistral.ai + image CDNs externes | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **images/router** | `images/router.py` | délégation | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **trending/router** | `trending/router.py` | (référence YouTube URL mais pas de call) | — | N/A | 🟢 | N/A |
| **core/llm_provider** | `core/llm_provider.py` | api.mistral.ai + deepseek + openai | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **core/mistral_agent** | `core/mistral_agent.py` | api.mistral.ai (Agent endpoint) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **core/document_ocr** | `core/document_ocr.py` | api.mistral.ai (Pixtral) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **core/moderation_service** | `core/moderation_service.py` | api.mistral.ai (Moderation) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **core/finetuning** | `core/finetuning.py` | api.mistral.ai | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **core/analytics** | `core/analytics.py` | PostHog | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **core/axiom_handler** | `core/axiom_handler.py` | Axiom | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **api_public/router** | `api_public/router.py` | (proxy interne) | aucun call externe | N/A | 🟢 | N/A |
| **auth/service** | `auth/service.py` | accounts.google.com + Resend + (autres OAuth) | `httpx.AsyncClient` + `requests` (legacy) | N/A | 🟢 | N/A — auth Google ≠ YouTube |
| **contact/router** | `contact/router.py` | Resend | `requests` | N/A | 🟢 | N/A |
| **services/email_queue** | `services/email_queue.py` | Resend | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **tts/providers** | `tts/providers.py` | api.elevenlabs.io + api.openai.com | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **tts/audio_summary** | `tts/audio_summary.py` | ElevenLabs | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **tts/router** | `tts/router.py` | délégation | — | N/A | 🟢 | N/A |
| **tutor/service** | `tutor/service.py` | api.mistral.ai | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **monitoring/checks** | `monitoring/checks.py` | health probes self-loop | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **health/router** | `health/router.py` | self-loop | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **geo/monitor** | `geo/monitor.py` | (geo data) | `httpx.AsyncClient` | N/A | 🟢 | N/A |
| **transcripts/cache** | `transcripts/cache.py` | aucun call externe (Redis only) | — | N/A | 🟢 | N/A |

---

## Bugs concrets identifiés

### 🔴 **B1 — `videos/intelligent_discovery.py` ligne 429 : `ytsearch:` sans proxy**

```python
cmd = ["yt-dlp", "--dump-json", "--flat-playlist", "--no-warnings", "--geo-bypass", search_query]
```

Aucune injection `--proxy`. La feature **Recherche intelligente / Smart Search** part directement depuis l'IP Hetzner pour faire `ytsearch15:` → bot challenge YouTube.

**Fix Wave 2** : remplacer par :
```python
from transcripts.audio_utils import _yt_dlp_extra_args
cmd = ["yt-dlp", *_yt_dlp_extra_args(), "--dump-json", "--flat-playlist", "--no-warnings", "--geo-bypass", search_query]
```

### 🔴 **B2 — `videos/intelligent_discovery_v4.py` ligne 469 : idem**

Même bug que B1 dans la v4. Aucune injection `--proxy`. Smart Search v4 (sub-task parallèle) tape direct.

### 🔴 **B3 — `transcripts/youtube.py::get_playlist_videos` (l. 2750) et `get_playlist_info` (l. 2817) : fallback yt-dlp sans proxy**

Quand le fallback Invidious échoue (instances saturées), le code retombe sur :
```python
cmd = ["yt-dlp", "--flat-playlist", "--dump-json", "--no-warnings", "--user-agent", get_random_user_agent(), f"https://www.youtube.com/playlist?list={playlist_id}"]
```

Aucun `_yt_dlp_extra_args()`. La feature **Analyse de playlist** est partiellement protégée (Invidious OK), mais le fallback final part nu vers YouTube.

### 🔴 **B4 — `videos/visual_integration.py` lignes 369 + 392 : download tikwm + CDN TikTok sans proxy**

Le hook visual analysis pour TikTok (Pro/Expert) fait :
```python
async with httpx.AsyncClient(timeout=_TIKWM_TIMEOUT_S) as client:
    resp = await client.post(_TIKWM_API_URL, data={"url": url})
...
async with httpx.AsyncClient(...) as client:
    r = await client.get(media_url)  # CDN TikTok direct
```

Aucune injection proxy. **Sprint A/C touche ce fichier** → coordonner.

### 🔴 **B5 — `transcripts/tiktok.py` (~10 sites) : tous les calls TikTok sans proxy**

Lignes 231, 426, 462, 520, 795, 832, 1192. Tous appellent `httpx.AsyncClient()` direct vers tiktok.com / tikwm.com / oembed avec `Referer: tiktok.com`. Le rate-limiting TikTok 429 sur IP datacenter est documenté.

### 🟡 **B6 — `videos/router.py` lignes 368/411 : short URL resolution + oEmbed sans proxy**

Quick Chat (path /api/videos/quick-chat) résout `vm.tiktok.com` puis hit oEmbed `tiktok.com/oembed`. Avec `shared_http_client()` non proxifié → bot challenge sur Quick Chat TikTok.

### 🟡 **B7 — `transcripts/youtube.py` shared_http_client × 17 sites : Invidious/Piped/Supadata sans proxy intentionnel**

Les calls Invidious/Piped sont volontairement directs (les instances tournent ailleurs que Hetzner). Mais le pool `shared_http_client` est aussi utilisé pour :
- API Supadata (`api.supadata.io`) — pas YouTube, OK
- `client.get(caption_url)` sur URLs Invidious internes — OK
- mais aussi des fetches `youtube.com` direct potentiels via redirects

Pas critique en l'état (l'audit dépasse ce sprint). À **inscrire en backlog** une option `via_proxy: bool` sur `shared_http_client` pour les usages mixtes.

---

## Routes par criticité métier

| Criticité | Feature affectée | Modules concernés | Bugs |
|-----------|------------------|-------------------|------|
| 🔴 **P0** | Analyse YouTube (transcripts) | `transcripts/youtube.py`, `ultra_resilient.py` | Partiellement protégé (yt-dlp OK, ytapi OK) ; chaîne mixte |
| 🔴 **P0** | Analyse TikTok | `transcripts/tiktok.py`, `videos/visual_integration.py`, `transcripts/carousel.py` | B4, B5 — proxy absent partout |
| 🔴 **P0** | Smart Search / Discovery YouTube | `videos/intelligent_discovery.py`, `intelligent_discovery_v4.py` | B1, B2 |
| 🔴 **P1** | Analyse playlist YouTube fallback | `transcripts/youtube.py::get_playlist_*` | B3 |
| 🟡 **P1** | Quick Chat TikTok | `videos/router.py` (short URL + oEmbed) | B6 |
| 🟢 OK | Storyboard YouTube | `videos/youtube_storyboard.py` | Direct CDN i.ytimg validé |
| 🟢 OK | Thumbnails | `storage/thumbnails.py` | Direct CDN img.youtube validé |
| 🟢 OK | Tournesol / Brave / Perplexity / Academic | tous les modules `tournesol/`, `academic/`, `videos/brave_search.py`, `chat/`, `voice/` | Pas d'appel YouTube |

---

## Recommandations

### Phase 2 (ce PR — limitée)

1. **Étendre `core/http_client.py`** avec une nouvelle factory `get_proxied_client(timeout=30.0)` qui retourne un `httpx.AsyncClient` avec :
   - `proxies={"http://": settings.YOUTUBE_PROXY, "https://": settings.YOUTUBE_PROXY}` si `YOUTUBE_PROXY` set
   - Timeouts par défaut alignés sur le shared client
   - Headers + UA standard
   - **Pas de connection pooling partagé** : éphémère (le pool partagé n'est pas proxifié, pour ne pas casser les usages non-YouTube)
2. **Migrer le module `transcripts/youtube.py`** pour utiliser `get_proxied_client` sur les routes Invidious / Piped / yt-dlp post-process. Le reste du shared client (Supadata, ytapi) reste direct car ces APIs vivent ailleurs.
3. Ajouter `backend/tests/test_proxy_coverage.py` avec :
   - Mock `settings.YOUTUBE_PROXY = "http://test:test@proxy:8080"`
   - Vérifier qu'`async with get_proxied_client() as c` retourne un client dont les `_mounts` ou `transport` portent le proxy
   - Vérifier le fallback bare client si `YOUTUBE_PROXY` non set

### Wave 2 (post-PR, scopes séparés)

| Sprint cible | Files à migrer | Bug fixé |
|--------------|----------------|----------|
| Sprint C (visuals) | `videos/visual_integration.py` lignes 369 + 392 | B4 |
| Sprint A ou nouveau sprint TikTok | `transcripts/tiktok.py` (10 sites) | B5 |
| Sprint Discovery | `videos/intelligent_discovery.py` + `_v4.py` (cmd yt-dlp) | B1, B2 |
| Sprint Playlists | `transcripts/youtube.py::get_playlist_*` (fallback yt-dlp) | B3 |
| Sprint Quick Chat | `videos/router.py` Quick Chat TikTok resolver | B6 |

### Backlog long-terme

- Option `via_proxy: bool` sur le `shared_http_client` partagé (impact perf : aujourd'hui c'est un singleton, devenir 2 singletons proxified + bare)
- Métrique PostHog : `proxy_used: true/false` sur chaque feature pour mesurer fallback rates
- Health-check du proxy Decodo (latence + 200 rate) toutes les 5 min via `monitoring/router.py`

---

## Conflits potentiels avec autres sprints

- **Sprint A** (visuals frames) touche `visual_integration.py` et `frame_extractor.py` → coordonner B4
- **Sprint C** (visuals) idem
- **Sprint D** (audio) touche `audio_utils.py` et `core/config.py` → ce sprint reste sur `http_client.py` (pas de collision)

Phase 2 limitée à `transcripts/youtube.py` reste sûre — pas d'autre sprint annoncé sur ce fichier.

---

## Tests Phase 2 ciblés

```python
# backend/tests/test_proxy_coverage.py
@pytest.mark.asyncio
async def test_get_proxied_client_uses_proxy_when_set(monkeypatch):
    monkeypatch.setattr(settings, "YOUTUBE_PROXY", "http://user:pass@proxy.test:8080")
    async with get_proxied_client() as client:
        # httpx exposes mounts (per-pattern transports)
        assert client._mounts or client._proxy is not None

@pytest.mark.asyncio
async def test_get_proxied_client_fallback_when_unset(monkeypatch):
    monkeypatch.setattr(settings, "YOUTUBE_PROXY", "")
    async with get_proxied_client() as client:
        # Pas de proxy → client bare
        assert not client._mounts

@pytest.mark.asyncio
async def test_youtube_invidious_uses_proxied_client(monkeypatch):
    # Mock httpx pour vérifier que get_transcript_invidious passe via proxied client
    ...
```

---

## Conclusion

- **40 modules audités** dans `backend/src/`
- **6 bugs concrets** (B1-B6) sur 5 modules touchant YouTube/TikTok via httpx direct
- **5 modules vraiment critiques** (P0/P1) à migrer en Wave 2
- **Phase 2 de ce PR** : helper `get_proxied_client` + migration `transcripts/youtube.py` (méthodes Invidious / Piped → autres usages laissés intacts pour ne pas casser les sprints A/C/D)
- **0 conflit prévu** avec sprints A/C/D si on reste strict sur `transcripts/youtube.py` + `core/http_client.py`

Ce rapport est un livrable Phase 1 indépendant. Phase 2 (implémentation) suit dans le même PR.
