# Marqueurs épistémiques (SOLID / PLAUSIBLE / UNCERTAIN / À VÉRIFIER)

_Phase 4 de la migration "Mistral-First" — 2026-05-02_

## Contexte

DeepSight produit des analyses sourcées et nuancées. Pour le tier **Expert** (plan
Expert v2 19.99 €/mois), le résumé final intègre des marqueurs épistémiques
explicites qui qualifient chaque affirmation :

- `[SOLID]` : affirmation directement supportée par la transcription, sans extrapolation
- `[PLAUSIBLE]` : extrapolation raisonnable mais non strictement prouvée
- `[UNCERTAIN]` : interprétation possible mais ambiguë / contestée
- `[À VÉRIFIER]` : claim qui mériterait une vérification externe

Le but : améliorer la **transparence épistémique** du résumé. Magistral, modèle de
raisonnement chain-of-thought de Mistral, justifie nativement ses étapes de
raisonnement et améliore donc la cohérence des marqueurs apposés.

## Modèle utilisé selon le plan

| Plan code-side | Plan v2 affiché    | Tier de durée | Modèle synthèse (flag OFF) | Modèle synthèse (flag ON)            |
| -------------- | ------------------ | ------------- | -------------------------- | ------------------------------------ |
| `free`         | Free (0 €)         | tous          | `mistral-small-2603`       | `mistral-small-2603` (inchangé)      |
| `plus`         | Pro (8.99 €)       | tous          | `mistral-medium-2508`      | `mistral-medium-2508` (inchangé)     |
| `pro`          | Expert (19.99 €)   | tous          | `mistral-large-2512`       | **`magistral-medium-2509`** (Magistral) |

> **Note de mapping legacy** : dans `videos/duration_router.get_optimal_model()`,
> le paramètre `user_plan="expert"` (Pricing v2) est normalisé vers le code interne
> `"pro"`. Le check Magistral est donc effectué AVANT normalisation, sur le
> `raw_plan` original, pour distinguer Expert v2 de Pro legacy.

## Modèle Magistral retenu

- Nom officiel : `magistral-medium-2509` (Magistral Medium 1.2, v25.09)
- Status : Premier (frontier-class multimodal reasoning)
- Source officielle : https://docs.mistral.ai/getting-started/models/models_overview/
- Vérifié le : 2026-05-02
- Hébergement : Mistral AI SAS — UE — DPA actif sur le compte DeepSight

## Stratégie de routage

**Option A retenue** : override Expert-only **hors** chaîne de fallback.

```python
# Dans videos/duration_router.get_optimal_model()
if (
    task == "synthesis"
    and MAGISTRAL_EPISTEMIC_ENABLED
    and raw_plan in MAGISTRAL_EPISTEMIC_TIERS
):
    return MAGISTRAL_EPISTEMIC_MODEL, default_max_tokens
```

- **Pourquoi pas modifier `MISTRAL_FALLBACK_ORDER`** : Magistral est plus coûteux
  et plus lent que `mistral-large-2512`. L'inclure dans la chaîne ferait baisser
  des plans non-Expert dessus en cas de 429 sur les autres modèles. On veut
  un usage **strictement opt-in Expert**.
- **Comportement en cas d'échec Magistral** : `llm_complete()` voit un 429/5xx
  et tombe automatiquement sur la chaîne existante :
  `mistral-large-2512 → mistral-medium-2508 → mistral-small-2603 → deepseek-chat`.
  Aucun code supplémentaire requis.

## Activation Magistral

Le flag est **désactivé par défaut**. Les variables sont lues depuis
`core/config.py` (env-driven via `os.getenv`) :

```bash
# .env.production
MAGISTRAL_EPISTEMIC_ENABLED=true
MAGISTRAL_EPISTEMIC_MODEL=magistral-medium-2509   # optionnel, valeur par défaut
MAGISTRAL_EPISTEMIC_TIERS=expert                  # optionnel, valeur par défaut
```

**Procédure d'activation** :

1. Validation qualité manuelle préalable sur **10 vidéos diverses** (FR + EN, courte +
   longue, factuel + opinion) — comparer marqueurs Magistral vs `mistral-large-2512`
2. Mettre `MAGISTRAL_EPISTEMIC_ENABLED=true` dans `/opt/deepsight/repo/.env.production`
3. Recharger le container backend : `docker exec repo-backend-1 kill -HUP 1`
   (reload uvicorn workers) ou full restart `docker restart repo-backend-1`
4. Vérifier les logs : un événement structuré `magistral_epistemic_override` doit
   apparaître à chaque synthèse Expert

## Rollback

Setter `MAGISTRAL_EPISTEMIC_ENABLED=false` dans `.env.production` puis recharger
le container → rollback instantané sans `git revert`.

```bash
ssh root@89.167.23.214
sed -i 's/^MAGISTRAL_EPISTEMIC_ENABLED=.*/MAGISTRAL_EPISTEMIC_ENABLED=false/' /opt/deepsight/repo/.env.production
docker restart repo-backend-1
```

## Tests

Suite : `backend/tests/test_magistral_epistemic_routing.py`

| Test                                              | Vérifie                                                      |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `test_expert_tier_uses_magistral_when_enabled`    | Flag ON + plan="expert" → Magistral                          |
| `test_expert_tier_falls_back_to_large_when_disabled` | Flag OFF + plan="expert" → `mistral-large-2512`              |
| `test_pro_tier_unchanged_when_flag_on`            | Flag ON + plan="plus" (Pro v2) → `mistral-medium-2508`       |
| `test_free_tier_unchanged_when_flag_on`           | Flag ON + plan="free" → `mistral-small-2603`                 |
| `test_default_flag_is_off`                        | Garantie : `MAGISTRAL_EPISTEMIC_ENABLED is False` par défaut |
| `test_expert_tier_only_for_synthesis_task`        | Flag ON + task="chunk_analysis" → JAMAIS Magistral (coût)    |

## Observabilité

Quand le flag est ON et qu'une synthèse Expert utilise Magistral, un log
structuré est émis :

```json
{
  "event": "magistral_epistemic_override",
  "tier": "long",
  "raw_plan": "expert",
  "task": "synthesis",
  "model": "magistral-medium-2509",
  "max_tokens": 6000,
  "transcript_words": 18000,
  "reason": "expert_tier_epistemic_markers_enabled"
}
```

Filtre Sentry / Hetzner pour suivre l'adoption :
`docker logs repo-backend-1 --tail 1000 | grep magistral_epistemic_override`

## Liens

- Plan complet : `docs/superpowers/plans/2026-05-02-mistral-first-migration.md`
- Spec : `01-Projects/DeepSight/Specs/2026-05-02-mistral-first-migration-design.md` (vault Obsidian)
- Doc officielle Mistral : https://docs.mistral.ai/capabilities/reasoning/
