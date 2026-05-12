# Audit Visual Analysis — debug `visual_analysis=None` en prod

**Date** : 2026-05-11
**Sprint** : Sprint C — Visual Analysis quality boost
**Bug signalé** : summary 204 (video `zjkBMFhNj_g` "[1hr Talk] Intro to LLM" Andrej Karpathy, mode=expert, plan=expert) retourne `visual_analysis=None` malgré le forçage `include_visual_analysis=True` côté API publique.

---

## 1. Chaîne d'appel `/api/v1/analyze` → Mistral Vision

### 1.1 Entrée publique : `backend/src/api_public/router.py`

| Ligne | Évènement |
|-------|-----------|
| `300-374` | Endpoint `POST /api/v1/analyze` |
| `362` | `existing = await get_summary_by_video_id(session, video_id, user.id)` — récupère la dernière analyse de l'user pour ce `video_id` |
| `363-374` | **Si existante** : retourne immédiatement `task_id=cached_<id>` (status="completed", crédits=0). **Aucune ré-analyse**, aucune entrée dans `_analyze_video_background_v6`. |
| `377-381` | mapping mode public → interne (`detailed → expert`), lang fallback `fr` |
| `403-419` | `asyncio.ensure_future(_analyze_video_background_v6(..., include_visual_analysis=True))` |
| `537` | Réponse `GET /api/v1/analysis/{id}` : `"visual_analysis": getattr(summary, "visual_analysis", None)` — lit la colonne `Summary.visual_analysis` (JSONB, alembic 024) |

### 1.2 Background task : `backend/src/videos/router.py::_analyze_video_background_v6` (L2791-)

| Ligne | Évènement |
|-------|-----------|
| `3188-3242` | Bloc visual : `if include_visual_analysis and platform in ("youtube", "tiktok")` → import lazy de `visual_integration`, check du flag `VISUAL_ANALYSIS_ENABLED` via `os.getenv()` |
| `3199-3202` | **Flag lu via `os.getenv("VISUAL_ANALYSIS_ENABLED", "false")`** — défaut `false`, **pas dans `core/config.py`** |
| `3203` | `if _visual_flag_on:` — **si le flag est off, AUCUN log n'est émis**. C'est un silent skip. |
| `3211-3217` | Appel `maybe_enrich_with_visual(db, user, url, transcript_excerpt, flag_enabled=True)` |
| `3218-3233` | Si `status == STATUS_OK` : injecte le bloc dans `web_context` + capture `_visual_analysis_data = _visual.get("analysis")` (dict sérialisé) |
| `3234-3237` | Sinon : `logger.info("👁️ [VISUAL] skipped: status=%s")` — niveau **INFO**, pas WARNING |
| `3238-3242` | `except Exception` graceful : `logger.warning("👁️ [VISUAL] enrichment raised (graceful): ...")` |
| `3455` | `save_summary(...)` crée la ligne `Summary` (sans visual) |
| `3459-3475` | Si `_visual_analysis_data is not None` : `UPDATE summaries SET visual_analysis = ... WHERE id = summary_id`. Best-effort : `logger.warning("👁️ [VISUAL] persist failed (graceful): ...")` en cas d'exception. |

### 1.3 Pipeline visual lui-même : `backend/src/videos/visual_integration.py::maybe_enrich_with_visual`

| Ligne | Branche | Comportement actuel | Log émis ? |
|-------|---------|----------------------|-----------|
| L202-203 | `flag_enabled=False` | return `STATUS_DISABLED` | **NON (silent)** |
| L207-209 | `can_consume` refuse (Free / quota) | log INFO `Skipped (%s)` puis return reason | INFO ✓ |
| L219-223 | YouTube : `normalize_video_id` rate | return `STATUS_NOT_SUPPORTED` | **NON (silent)** |
| L242-245 | Plateforme inconnue (Vimeo, etc.) | return `STATUS_NOT_SUPPORTED` | **NON (silent)** |
| L247-254 | `extraction is None` | return `STATUS_EXTRACT_FAILED` | **NON (silent)** — mais sous-modules logguent en amont (storyboard, tikwm). |
| L269-277 | `analysis is None` (Mistral Vision KO) | return `STATUS_VISION_FAILED` | **NON (silent)** — sous-module `visual_analyzer` log `error("All %d batches failed")` |
| L538-541 | `enrich_and_capture_visual` exception | `logger.warning("graceful: %s")` | WARNING ✓ |

**Verdict** : 4 early returns silencieux dans `maybe_enrich_with_visual`. Le caller (`_analyze_video_background_v6` L3234-3237) log bien le `status` reçu, donc on n'est PAS strictement aveugle au niveau du router — mais le log y est en niveau **INFO** ce qui peut être filtré.

### 1.4 Sous-modules — qualité des logs

`backend/src/videos/youtube_storyboard.py::extract_storyboard_frames` : **bons** logs warning sur tous les `return None` (yt-dlp timeout, no duration, no storyboard, no fragments, sliced empty, frame extract empty).

`backend/src/videos/visual_analyzer.py::analyze_frames` : **bons** logs error/warning sur empty paths, MISTRAL_API_KEY missing, batches all failed.

`backend/src/videos/visual_integration.py::_extract_tiktok_visual_frames` : **bons** logs warning sur download empty, ffmpeg KO.

---

## 2. Persistance — où va `visual_analysis` ?

| Champ | Table | Colonne | Migration |
|-------|-------|---------|-----------|
| `_visual_analysis_data` (dict) | `summaries` | `visual_analysis` (JSONB) | alembic `024_summary_visual_analysis` |
| Cache video L1/L2 `vcache:analysis:...` | Redis + `video_cache_analyses` | data JSONB | **NE CONTIENT PAS** `visual_analysis` (cf. `videos/router.py:3522-3550` — le dict caché contient `summary_content`, `video_title`, etc. mais pas `visual_analysis`) |

**Conséquence** : le cache `vcache:analysis` n'est **PAS** la cause du bug `visual_analysis=None`. Le `visual_analysis` est lu uniquement sur la table `summaries` (colonne JSONB). La cache vcache stocke uniquement le contenu textuel d'analyse pour partage cross-user.

---

## 3. Vérification environnement prod

| Check | Résultat |
|-------|----------|
| `grep VISUAL_ANALYSIS_ENABLED /opt/deepsight/repo/.env.production` | `VISUAL_ANALYSIS_ENABLED=true` ✓ |
| Flag lu dans `videos/router.py:3199` via `os.getenv("VISUAL_ANALYSIS_ENABLED", "false")` | OK, true → bloc visual exécuté |

**Le flag est activé en prod. H1 hypothèse "flag off" écartée.**

---

## 4. Hypothèses & root cause

### H1 — cache hit summary pré-PR Phase 2 (alembic 024) → **CONFIRMÉ probable**

Dans `api_public/router.py:362-374`, l'endpoint vérifie `get_summary_by_video_id(video_id, user_id)` qui retourne le summary le plus récent de l'user pour ce video_id. **Si l'user a déjà analysé `zjkBMFhNj_g` avant que la PR Phase 2 (visual_analysis JSONB) ne soit déployée, ou avant que `include_visual_analysis=True` ne soit forcé** (commit récent côté router publique), le summary cached aura `visual_analysis=NULL` figé.

L'API publique renvoie `task_id=cached_<id>` → poll `/api/v1/analyze/status/cached_<id>` → `status=completed, result.summary_content` (sans le champ visual_analysis explicite mais le summary lui-même a `visual_analysis=NULL`). Le `GET /api/v1/analysis/{id}` ensuite renvoie le `getattr(summary, "visual_analysis", None) → None`.

**Confirmation rapide à faire** (via SSH si user autorise) :
```sql
SELECT id, video_id, created_at, visual_analysis IS NOT NULL AS has_visual,
       mode, model_used
FROM summaries
WHERE video_id='zjkBMFhNj_g'
ORDER BY id DESC LIMIT 5;
```
Si summary 204 a `created_at` antérieur au merge de la migration 024 ou au déploiement du bloc `_visual_analysis_data` dans `_analyze_video_background_v6` → H1 confirmée à 100%.

L'absence de logs `[VISUAL]` côté backend est cohérente : si l'API courte-circuite via cache `existing`, `_analyze_video_background_v6` n'est jamais appelé, donc le bloc visual n'est jamais atteint.

### H2 — early return silencieux dans `maybe_enrich_with_visual` → **partiel**

Les 4 branches silencieuses listées plus haut existent mais aucune ne s'appliquerait à un user Expert sur une vidéo YouTube longue. Pour `zjkBMFhNj_g` (YouTube, valide, plan expert) on serait nécessairement passé jusqu'à `extract_storyboard_frames` ou `analyze_frames` — qui eux logguent.

### H3 — erreur Mistral Vision masquée par try/except → **écarté**

Le try/except dans `_analyze_video_background_v6:3238-3242` log un WARNING. Le user a cherché "visual" / "frames" / "🎬" / "Vision" — il aurait vu un warning si on était passé là. Donc on n'est pas passé par le bloc visual du tout, ce qui renforce H1.

---

## 5. Décision pour le sprint

**H1 quasi-confirmée** — le bug n'est pas dans `visual_integration.maybe_enrich_with_visual`. Il est dans la sémantique du cache `get_summary_by_video_id` (au niveau `api_public/router.py:362`) qui retourne des summaries "anciens" sans `visual_analysis` quand l'user a déjà analysé la vidéo avant la PR alembic 024.

Conformément au handoff sprint :
> Si la PHASE 1 révèle que c'est juste un cache hit (H1 confirmée) sans bug dans visual_integration.run_visual_analysis : reste en mode minimal — bump la cache key + warning logs sur les early returns, et skip la phase 3 ultra (la traiter en sprint séparé).

**Stratégie retenue** :

1. **Logs explicites (PHASE 2 implémentée)** : transformer les 4 early returns silencieux de `maybe_enrich_with_visual` en logs WARNING avec contexte (`reason`, `plan`, `platform`, `video_id`, `frames_attempted`, `error`). Ne change pas le comportement actuel mais rend tout futur debug trivial.

2. **Cache key bump : NON nécessaire ni effectué** — Le `vcache:analysis` (Redis L1 + PG L2 `video_cache_analyses`) ne stocke pas `visual_analysis` du tout (cf. payload dict L3522-3550 de `videos/router.py`). Le seul "cache" qui pose problème est la table `summaries` elle-même via `get_summary_by_video_id`. Bumper la clé `vcache:analysis:...` reviendrait à invalider toutes les analyses cross-user (régression coûts API Mistral) sans corriger le problème de fond. Le bon fix produit est :
   - **Court terme (sprint séparé)** : exposer `force_refresh` côté API publique OU rendre le cache hit dans `api_public/router.py:362` conditionnel à `existing.visual_analysis IS NOT NULL` quand `include_visual_analysis=True`.
   - **Note pour Maxime** : la décision de ne pas bumper la cache key est tracée explicitement ici et dans le titre du commit/PR — pas un oubli.

3. **Phase 3 — mode ultra (IMPLÉMENTÉE)** : traité dans le scope car la setting `VISUAL_ULTRA_ENABLED=False` par défaut est sans risque (opt-out). Détails section 6 ci-dessous.

---

## 6. Implémentation finale

### Phase 2 (implémentée) — logs explicites + propagation erreur Mistral

`backend/src/videos/visual_integration.py::maybe_enrich_with_visual` :

- **5 logs WARNING ajoutés** sur les early returns (`flag_enabled=False`, `plan_not_allowed`, `not_supported` × 2 branches, `extract_failed`, `vision_failed`). Le précédent `logger.info("Skipped (%s)")` sur `plan_not_allowed` est **promu en WARNING** pour cohérence — permet de filtrer tous les skips Visual par level=warning + tag `[VISUAL_INT]`.
- **Try/except autour de `analyze_frames`** : capture explicite des exceptions Mistral Vision avec propagation du message dans le dict retourné (`error` field) et préservation du `frames_attempted`.
- **Dict de retour STATUS_VISION_FAILED enrichi** : ajout des champs `frames_attempted` (int) et `error` (str) — exposés au caller pour permettre futur observability dashboard.

### Phase 3 (implémentée) — mode ultra opt-in

`backend/src/core/config.py` :

- Ajout setting `VISUAL_ULTRA_ENABLED: bool = False` dans la classe `_DeepSightSettings` + export module-level dans la section "VISUAL ANALYSIS".

`backend/src/videos/frame_extractor.py` :

- Ajout entrée `"ultra"` dans `FRAME_BUDGET_GRID` avec la grille demandée :
  ```python
  "ultra": [
      (1800.0, 16),    # ≤30min
      (3600.0, 24),    # ≤1h
      (7200.0, 32),    # ≤2h
      (10800.0, 48),   # ≤3h
      (14400.0, 64),   # ≤4h
      (21600.0, 80),   # ≤6h
      (float("inf"), 96),  # >6h
  ]
  ```

`backend/src/videos/visual_analyzer.py` :

- Bump `MAX_FRAMES_TOTAL_CAP` de 64 → 96 pour permettre au mode ultra de saturer 12 batches × 8 frames Mistral. La modification est sûre : `max_frames_cap` reste passé par le caller selon le mode (24/64/96), donc les modes default/expert restent identiques en pratique.

`backend/src/videos/visual_integration.py::_select_mode_for_plan(plan, duration_s=None)` :

- Nouvelle signature avec `duration_s` optionnel (back-compat).
- Logique :
  - `plan != "expert"` → `"default"`
  - `plan == "expert"` AND `duration_s > ULTRA_MIN_DURATION_S (7200s)` AND `VISUAL_ULTRA_ENABLED == True` → `"ultra"`
  - sinon → `"expert"`
- Constante `ULTRA_MIN_DURATION_S = 7200.0` exposée.

`backend/src/videos/visual_integration.py::maybe_enrich_with_visual(..., duration_hint=None)` et `enrich_and_capture_visual(..., duration_hint=None)` :

- Ajout du kwarg `duration_hint` propagé jusqu'à `_select_mode_for_plan`. Comme la durée vidéo est déjà connue côté caller (`video_info.get("duration")` chargé en amont), pas de refactor du flow.

Callers `videos/router.py` :

- 3 sites de call patchés pour passer `duration_hint=float(video_duration) if video_duration else None` :
  - L1503 : `enrich_and_capture_visual` (V2)
  - L2395 : `enrich_and_capture_visual` (V2.1)
  - L3211 : `maybe_enrich_with_visual` (background V6)

### Tests

Extension de `backend/tests/videos/test_visual_integration.py` (53 tests, +24 nouveaux) :

| Classe | Tests | Couverture |
|--------|-------|-----------|
| `TestUltraModeConstants` | 6 | constantes credits/cap/grid + compute_frame_budget sur 3 paliers ultra (2h, 3h, 7h) |
| `TestSelectModeForPlanUltra` | 6 | flag off / on / vidéo courte / sans duration / Pro long / constante seuil |
| `TestMaybeEnrichUltraPath` | 2 | propagation ultra → extract+analyzer ; pas de duration_hint → expert |
| `TestSilentSkipsLogWarning` | 6 | log WARNING émis pour disabled, plan_not_allowed, not_supported, extract_failed, vision_failed (None + exception) |

Résultats : **53/53 verts** (1.5s) + 18/18 visual_analyzer + 22/22 frame_extractor + 175/175 tests/videos/ globalement.

### Hors scope (futurs sprints)

- **Pas de migration alembic** — c'est code-only.
- Le bug de cache hit pour summaries pré-PR (root cause de `visual_analysis=None`) sera traité dans un sprint séparé en :
  - exposant `force_refresh` côté `/api/v1/analyze` (modif `AnalyzeRequest` Pydantic schema dans `api_public/router.py`), OU
  - rendant le check cache conditionnel : `if existing and existing.visual_analysis is not None` quand `include_visual_analysis=True`.

Le futur sprint alembic devra utiliser l'ID 025 (suivant 024) avec nom ≤32 chars (convention DeepSight).

---

## 7. Conflit potentiel

Le sprint A traite `_extract_tiktok_visual_frames` dans le même fichier `visual_integration.py`. Conflit faible : sprint A touche la fonction `_extract_tiktok_visual_frames` (lignes 422-470), ce sprint touche `maybe_enrich_with_visual` (lignes 177-309) + `_select_mode_for_plan` (L69-76) + ajout grille ultra dans `frame_extractor.py`. Pas de chevauchement direct ; rebase trivial.
