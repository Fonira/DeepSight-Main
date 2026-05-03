# Web Search Provider Policy

**Statut** : Phase 5 du plan Mistral-First migration (2026-05-02)
**Source de vérité** : `backend/src/videos/web_search_provider.py`
**Flag** : `core.config.MISTRAL_AGENT_PRIMARY` (default `False`)

---

## Objectif

Centraliser la logique de priorité entre les trois providers de recherche web utilisés par DeepSight :

1. **Mistral Agent** — Agents API + Conversations API, modèle `mistral-small-2603`. Web search natif, 1 appel.
2. **Perplexity** — `sonar` (Pro) / `sonar-pro` (Expert / Deep Research). Citations natives, 1 appel.
3. **Brave Search** — last-resort. Brave Search API + synthèse Mistral derrière (2 appels).

L'objectif final est de réduire la dépendance au stack non-EU (Perplexity) et d'unifier la facturation chez Mistral, tout en conservant un filet de sécurité Perplexity → Brave si Mistral Agent dégrade.

---

## Chaîne par défaut (`MISTRAL_AGENT_PRIMARY = False`)

```
1. Perplexity Sonar (sonar / sonar-pro selon le plan)
2. Mistral Agent  (fallback)
3. Brave Search   (last-resort)
```

C'est le comportement historique avant la Phase 5. Aucun changement au runtime tant que le flag n'est pas activé — le merge de la phase est sans risque.

## Chaîne avec `MISTRAL_AGENT_PRIMARY = True`

```
1. Mistral Agent  (mistral-small-2603 via Agents API)
2. Perplexity Sonar (fallback)
3. Brave Search   (last-resort)
```

Brave reste **toujours** en last-resort, indépendamment de la valeur du flag.

---

## Contrat des providers

Tous les providers passent par `web_search_and_synthesize()` qui les enchaîne. Chaque tentative doit retourner :

- `WebSearchResult(success=True, provider=..., content=..., sources=[...])` en cas de succès
- `None` ou `WebSearchResult(success=False, ...)` pour déclencher le fallback

Une **exception** dans un provider est rattrapée et compte comme un échec ; le suivant prend le relais. Brave intervient uniquement après l'échec des deux premiers.

---

## Activation

Le flag `MISTRAL_AGENT_PRIMARY` est défini dans `backend/src/core/config.py`. Il vit en code (pas en env var) pour rester un changement explicite, traçable et testable. Bascule attendue :

1. Maxime exécute un benchmark qualité de **20 requêtes typiques** comparant la chaîne flag-OFF (Perplexity primary) vs flag-ON (Mistral Agent primary). Critères : pertinence, fraîcheur, fiabilité des sources, coût total.
2. Si Mistral Agent ≥ Perplexity sur ≥ 80 % des requêtes → bascule flag = `True`, suivi métrique pendant 7 jours.
3. Rollback en flippant le flag ; aucune migration de données nécessaire.

---

## Métriques

Chaque succès de la chaîne émet un event PostHog côté serveur :

```
event: web_search_provider_used
properties:
  provider: "agent" | "perplexity" | "brave"
  plan:     "free" | "pro" | "expert" | "unknown"
  purpose:  "enrichment" | "fact_check" | "chat" | "debate" | "deep_research"
  flag_mistral_agent_primary: bool
```

Helper : `core.analytics.track_event()`. Best-effort, pas de blocage si PostHog est down. Capture activée uniquement si `POSTHOG_API_KEY` est configuré.

**Dashboard à monter** dans PostHog :

- Taux de succès par provider sur 7 jours.
- Taux de fallback Perplexity→Mistral (ou Mistral→Perplexity selon le flag).
- Taux d'arrivée jusqu'à Brave (signal d'alarme : doit rester < 5 %).

---

## Tests

- `backend/tests/test_websearch_provider_priority.py` : 7 tests couvrant les deux ordres et la chaîne de fallback.
- `backend/tests/test_analytics_helper.py` : 3 tests sur le helper PostHog (no-op, exception swallow, async dispatch).
- `backend/tests/videos/test_perplexity_provider.py` : 16 tests sur le provider Perplexity et l'intégration dans la chaîne historique.

Aucun test ne dépend d'une clé API réelle ; toute dépendance externe est mockée.

---

## Historique

- **2026-05-02** — Phase 5 du plan Mistral-First : ajout du flag et de la métrique.
- Pré-Phase 5 — La chaîne avait déjà été migrée à `[mistral_agent, perplexity, brave]` sans flag. La Phase 5 introduit le flag pour pouvoir revenir à `[perplexity, mistral_agent, brave]` (comportement par défaut prudent jusqu'au benchmark).
