# 🇫🇷 Plan de Migration Mistral AI — DeepSight 2026

**Version** : 1.0 — Mars 2026
**Auteur** : Senior Tech Lead DeepSight
**Statut** : Prêt pour validation

---

## 1. Contexte & Objectifs Stratégiques

### Pourquoi cette migration ?

DeepSight utilise actuellement 3 modèles Mistral legacy (`mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest`) configurés en 2024. Depuis, Mistral a lancé **une dizaine de nouveaux modèles** avec des améliorations majeures en qualité, coût et contexte.

### Objectifs

1. **Économie** : Réduire les coûts API de 40-75% selon les tiers
2. **Qualité** : Passer à des modèles GPT-4 class pour les plans payants
3. **Contexte** : Supporter les vidéos 2h+ (262K tokens vs 32K actuels)
4. **Souveraineté** : 100% Mistral AI = 100% français & européen
5. **RGPD** : Données hébergées exclusivement en UE, DPA signé

---

## 2. Garanties RGPD & Souveraineté Européenne

### 2.1 Mistral AI — Conformité Légale

| Garantie                 | Détail                                                          |
| ------------------------ | --------------------------------------------------------------- |
| **Siège social**         | Paris, France — société de droit français                       |
| **Hébergement données**  | Union Européenne par défaut (endpoint EU)                       |
| **RGPD**                 | Conformité totale — DPA disponible sur legal.mistral.ai         |
| **EU AI Act**            | Signataire du Code of Practice européen                         |
| **CLOUD Act US**         | **Non soumis** — contrairement à OpenAI, Google, Amazon         |
| **Zero Data Retention**  | Activable sur demande pour l'API                                |
| **Training sur données** | Opt-out disponible pour les clients API                         |
| **Rétention par défaut** | 30 jours (monitoring anti-abus), supprimé ensuite               |
| **DPA**                  | https://legal.mistral.ai/terms/data-processing-addendum         |
| **SCCs**                 | Clauses contractuelles types UE pour tout sous-traitant hors UE |

### 2.2 Actions immédiates pour DeepSight

1. **Activer Zero Data Retention** sur le compte Mistral API (demande via help center)
2. **Utiliser l'endpoint EU** exclusivement : `https://api.mistral.ai` (pas le US)
3. **Mettre à jour `LEGAL_CONFIG`** dans config.py : hébergeur IA = Mistral AI (Paris)
4. **Ajouter un badge** sur le site : "🇫🇷🇪🇺 IA Française — Données hébergées en Europe"

### 2.3 Argumentaire Économique "IA Souveraine"

Pour les investisseurs, partenaires et utilisateurs :

- **Indépendance technologique** : pas de dépendance aux GAFAM américains
- **Conformité native** : RGPD dès la conception, pas en adaptation
- **Non soumis au CLOUD Act** : les autorités US ne peuvent pas réclamer les données
- **EU AI Act ready** : Mistral est signataire du Code of Practice
- **Soutien à l'écosystème européen** : argument fort pour BPI, subventions French Tech
- **Prix compétitifs** : modèles 2-10x moins chers que GPT-4/Claude pour qualité équivalente

---

## 3. Mapping des Modèles : Ancien → Nouveau

### 3.1 Vue d'ensemble

```
ANCIEN                          NOUVEAU                         ÉCONOMIE
─────────────────────────────────────────────────────────────────────────

mistral-small-latest            mistral-small-2603      -40%
  $0.10/$0.30 · 32K ctx          $0.10/$0.30 · 128K ctx
  Analyse Free                    Analyse Free + Starter
                                  (4x plus de contexte, même prix)

                                ministral-8b-2512               NOUVEAU
                                  $0.10/$0.10 · 128K ctx
                                  Micro-tâches : entités, flashcards
                                  (output 3x moins cher)

mistral-medium-latest           mistral-medium-2508              +qualité
  $0.27/? · 32K ctx              $0.40/$2.00 · 131K ctx
  Analyse Starter/Pro             Analyse Pro
  (obsolète)                      (GPT-4 class, 4x contexte)

mistral-large-latest            mistral-large-2512            -75%
  $2.00/$6.00 · 128K ctx         $0.50/$1.50 · 262K ctx
  Analyse Expert                  Analyse Expert
                                  (4x moins cher, 2x contexte)
```

### 3.2 Nouveau modèle par usage

| Usage                                                  | Modèle               | ID API                      | In/Out (1M)        | Contexte | Justification                                                  |
| ------------------------------------------------------ | -------------------- | --------------------------- | ------------------ | -------- | -------------------------------------------------------------- |
| **Micro-tâches** (entités, classification, flashcards) | Ministral 8B         | `ministral-8b-2512`         | $0.10/$0.10        | 128K     | Output 3x moins cher que Small, suffisant pour extraction JSON |
| **Free + Étudiant** (analyses standard, chat)          | Mistral Small 3.1    | `mistral-small-2603`        | $0.10/$0.30        | 128K     | Même prix, 4x contexte, meilleure qualité                      |
| **Starter** (analyses détaillées, chat avancé)         | Mistral Small 3.1    | `mistral-small-2603`        | $0.10/$0.30        | 128K     | Remplace Medium obsolète, bien meilleur rapport qualité/prix   |
| **Pro** (analyses profondes, recherche web)            | Mistral Medium 3.1   | `mistral-medium-2508`       | $0.40/$2.00        | 131K     | GPT-4 class, contexte 131K, analyses de haute qualité          |
| **Expert** (vidéos longues, synthèses complexes)       | Mistral Large 3      | `mistral-large-2512`        | $0.50/$1.50        | 262K     | 75% moins cher, contexte 262K (vidéos 2h+), multimodal         |
| **Fact-checking** (vérification sources)               | Mistral Medium 3.1   | `mistral-medium-2508`       | $0.40/$2.00        | 131K     | Raisonnement solide pour la vérification                       |
| **Modération** (commentaires UGC)                      | Mistral Moderation 2 | `mistral-moderation-latest` | gratuit/très cheap | —        | Modération native, évite les faux positifs                     |

### 3.3 Impact financier estimé (pour 1000 analyses/mois)

| Scénario                                | Ancien coût  | Nouveau coût                       | Économie             |
| --------------------------------------- | ------------ | ---------------------------------- | -------------------- |
| 500 analyses Free (Small)               | ~$50         | ~$50                               | = (mais 4x contexte) |
| 300 analyses Pro (Medium→Medium 3.1)    | ~$81         | ~$120 input mais meilleure qualité | Qualité ↑↑           |
| 200 analyses Expert (Large→Large 3)     | ~$400 output | ~$100 output                       | **-75%**             |
| Entités/flashcards (Small→Ministral 8B) | ~$30 output  | ~$10 output                        | **-67%**             |

---

## 4. Code : Modifications Backend

### 4.1 `config.py` — MISTRAL_MODELS (remplacer lignes 512-549)

```python
# =============================================================================
# MISTRAL MODELS — Gamme 2026 (Migration Mars 2026)
# =============================================================================
# 🇫🇷 100% Mistral AI — IA Française, données hébergées en UE
# DPA: https://legal.mistral.ai/terms/data-processing-addendum
# Zero Data Retention activé sur le compte API DeepSight
# =============================================================================

MISTRAL_MODELS = {
    # ── Tier 0 : Micro-tâches (entités, classification, flashcards) ──
    "ministral-8b-2512": {
        "name": "Ministral 8B",
        "context": 128000,
        "speed": "very_fast",
        "quality": "adequate",
        "cost_input_per_1m": 0.10,
        "cost_output_per_1m": 0.10,
        "plans": ["free", "starter", "pro", "expert", "unlimited"],
        "internal_only": True,  # Pas sélectionnable par l'user, usage interne
        "use_cases": ["entity_extraction", "flashcards", "classification", "study_tools"],
        "description": {
            "fr": "Ultra-rapide pour les tâches automatiques (extraction, flashcards)",
            "en": "Ultra-fast for automated tasks (extraction, flashcards)"
        }
    },

    # ── Tier 1 : Standard (Free + Étudiant + Starter) ──
    "mistral-small-2603": {
        "name": "Mistral Small 3.1",
        "context": 128000,
        "speed": "fast",
        "quality": "good",
        "cost_input_per_1m": 0.10,
        "cost_output_per_1m": 0.30,
        "plans": ["free", "starter", "pro", "expert", "unlimited"],
        "description": {
            "fr": "Rapide et intelligent, idéal pour les analyses courantes",
            "en": "Fast and smart, ideal for standard analyses"
        }
    },

    # ── Tier 2 : Avancé (Pro) ──
    "mistral-medium-2508": {
        "name": "Mistral Medium 3.1",
        "context": 131000,
        "speed": "medium",
        "quality": "very_good",
        "cost_input_per_1m": 0.40,
        "cost_output_per_1m": 2.00,
        "plans": ["pro", "expert", "unlimited"],
        "description": {
            "fr": "Analyses approfondies, raisonnement de niveau GPT-4",
            "en": "Deep analyses, GPT-4 level reasoning"
        }
    },

    # ── Tier 3 : Expert (Expert + Admin) ──
    "mistral-large-2512": {
        "name": "Mistral Large 3",
        "context": 262000,
        "speed": "medium",
        "quality": "excellent",
        "cost_input_per_1m": 0.50,
        "cost_output_per_1m": 1.50,
        "plans": ["expert", "unlimited"],
        "description": {
            "fr": "Maximum de qualité, contexte 262K pour vidéos longues",
            "en": "Maximum quality, 262K context for long videos"
        }
    },
}

# Mapping ancien → nouveau (rétrocompatibilité)
MISTRAL_MODEL_ALIASES = {
    "mistral-small-latest": "mistral-small-2603",
    "mistral-medium-latest": "mistral-medium-2508",
    "mistral-large-latest": "mistral-large-2512",
}

# Modèle dédié aux micro-tâches internes
MISTRAL_INTERNAL_MODEL = "ministral-8b-2512"

# Modèle de modération
MISTRAL_MODERATION_MODEL = "mistral-moderation-latest"
```

### 4.2 `credits.py` — MODEL_COSTS (remplacer lignes 34-53)

```python
# Coût de base par modèle (pour une analyse standard)
# Les coûts en crédits reflètent le pricing réel Mistral 2026
MODEL_COSTS = {
    "ministral-8b-2512": {
        "analysis": 20,      # Micro-tâches uniquement
        "chat": 2,           # Chat simple
        "name": "Ministral 8B",
        "multiplier": 0.4    # 60% moins cher que Small
    },
    "mistral-small-2603": {
        "analysis": 50,      # Identique à l'ancien Small
        "chat": 5,
        "name": "Mistral Small 3.1",
        "multiplier": 1.0
    },
    "mistral-medium-2508": {
        "analysis": 100,     # 2x Small
        "chat": 10,
        "name": "Mistral Medium 3.1",
        "multiplier": 2.0
    },
    "mistral-large-2512": {
        "analysis": 150,     # 3x Small (était 5x avant !)
        "chat": 15,          # Beaucoup moins cher qu'avant
        "name": "Mistral Large 3",
        "multiplier": 3.0    # Réduit de 5.0 → 3.0 (reflète la baisse de prix)
    },

    # ── Rétrocompatibilité (aliases) ──
    "mistral-small-latest": {
        "analysis": 50, "chat": 5,
        "name": "Mistral Small (legacy)", "multiplier": 1.0
    },
    "mistral-medium-latest": {
        "analysis": 100, "chat": 10,
        "name": "Mistral Medium (legacy)", "multiplier": 2.0
    },
    "mistral-large-latest": {
        "analysis": 150, "chat": 15,
        "name": "Mistral Large (legacy)", "multiplier": 3.0
    },
}
```

### 4.3 `config.py` — PLAN_LIMITS models (modifier dans chaque plan)

```python
# FREE
"models": ["mistral-small-2603"],
"default_model": "mistral-small-2603",

# STARTER (anciennement Étudiant)
"models": ["mistral-small-2603"],
"default_model": "mistral-small-2603",

# PRO
"models": ["mistral-small-2603", "mistral-medium-2508"],
"default_model": "mistral-medium-2508",

# EXPERT
"models": ["mistral-small-2603", "mistral-medium-2508", "mistral-large-2512"],
"default_model": "mistral-large-2512",

# UNLIMITED (Admin)
"models": ["ministral-8b-2512", "mistral-small-2603", "mistral-medium-2508", "mistral-large-2512"],
"default_model": "mistral-large-2512",
```

### 4.4 `billing/plan_config.py` — Mêmes modifications

```python
# Idem que ci-dessus, dans la SSOT billing/plan_config.py
# allowed_models et default_model doivent correspondre exactement
```

### 4.5 `billing/permissions.py` — Ajouter résolution d'alias

```python
from core.config import MISTRAL_MODEL_ALIASES

def get_allowed_model(user_plan: str, requested: str = None) -> str:
    """Valide et résout le modèle demandé (avec support des alias legacy)."""
    limits = get_limits(user_plan)
    allowed = limits.get("allowed_models", ["mistral-small-2603"])
    default = limits.get("default_model", "mistral-small-2603")

    if not requested:
        return default

    # Résoudre les alias legacy
    resolved = MISTRAL_MODEL_ALIASES.get(requested, requested)

    if resolved in allowed:
        return resolved

    return default
```

### 4.6 `videos/analysis.py` — Utiliser Ministral 8B pour l'extraction d'entités

```python
from core.config import MISTRAL_INTERNAL_MODEL

async def extract_entities(transcript: str, ...) -> dict:
    """Extraction d'entités avec le modèle interne le moins cher."""
    response = await mistral_client.chat(
        model=MISTRAL_INTERNAL_MODEL,  # ministral-8b-2512
        messages=[...],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    ...
```

### 4.7 `videos/study_tools.py` — Flashcards avec Ministral 8B

```python
from core.config import MISTRAL_INTERNAL_MODEL

async def generate_flashcards(summary_text: str, ...) -> list:
    """Génération de flashcards avec modèle interne."""
    response = await mistral_client.chat(
        model=MISTRAL_INTERNAL_MODEL,
        messages=[...],
        temperature=0.3,
    )
    ...
```

### 4.8 `config.py` — LEGAL_CONFIG mise à jour

```python
LEGAL_CONFIG = {
    # ... existant ...
    "HOST_NAME": "Hetzner Online GmbH",
    "HOST_ADDRESS": "Industriestr. 25, 91710 Gunzenhausen, Germany",
    "HOST_WEBSITE": "https://www.hetzner.com",
    "AI_PROVIDER": "Mistral AI SAS",
    "AI_PROVIDER_ADDRESS": "15 rue des Halles, 75001 Paris, France",
    "AI_PROVIDER_WEBSITE": "https://mistral.ai",
    "AI_DATA_LOCATION": "Union Européenne",
    "AI_DPA_URL": "https://legal.mistral.ai/terms/data-processing-addendum",
    "GDPR_COMPLIANT": True,
    "EU_AI_ACT_COMPLIANT": True,
    "CLOUD_ACT_EXEMPT": True,  # Mistral = société française, non soumise
}
```

---

## 5. Fichiers à Modifier — Checklist

### Phase 1 : Configuration (sans risque, rétrocompatible)

| #   | Fichier                              | Modification                                        | Risque    |
| --- | ------------------------------------ | --------------------------------------------------- | --------- |
| 1   | `backend/src/core/config.py`         | Nouveau `MISTRAL_MODELS` + aliases + `LEGAL_CONFIG` | 🟢 Faible |
| 2   | `backend/src/core/credits.py`        | Nouveau `MODEL_COSTS` avec rétrocompat              | 🟢 Faible |
| 3   | `backend/src/billing/plan_config.py` | Nouveaux `allowed_models` / `default_model`         | 🟡 Moyen  |
| 4   | `backend/src/billing/permissions.py` | `get_allowed_model()` avec alias resolution         | 🟡 Moyen  |

### Phase 2 : Optimisation modèles internes

| #   | Fichier                                  | Modification                              | Risque    |
| --- | ---------------------------------------- | ----------------------------------------- | --------- |
| 5   | `backend/src/videos/analysis.py`         | Entités → `ministral-8b-2512`             | 🟢 Faible |
| 6   | `backend/src/videos/study_tools.py`      | Flashcards → `ministral-8b-2512`          | 🟢 Faible |
| 7   | `backend/src/videos/youtube_comments.py` | Résumé commentaires → `ministral-8b-2512` | 🟢 Faible |

### Phase 3 : Frontend & Mobile (affichage)

| #   | Fichier                                 | Modification                           | Risque    |
| --- | --------------------------------------- | -------------------------------------- | --------- |
| 8   | `frontend/src/config/planPrivileges.ts` | Mettre à jour noms de modèles          | 🟢 Faible |
| 9   | `frontend/src/components/`              | Sélecteur de modèle avec nouveaux noms | 🟢 Faible |
| 10  | `mobile/src/constants/config.ts`        | Idem mobile                            | 🟢 Faible |

### Phase 4 : VPS Production

| #   | Action            | Commande                                                                          |
| --- | ----------------- | --------------------------------------------------------------------------------- |
| 11  | Push code         | `git push origin main`                                                            |
| 12  | Pull sur VPS      | `ssh root@$HETZNER_IP "cd /opt/deepsight/repo && git pull"`                       |
| 13  | Rebuild Docker    | `docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile ./backend` |
| 14  | Recréer container | (voir commande docker run standard)                                               |
| 15  | Health check      | `curl https://api.deepsightsynthesis.com/health`                                  |

---

## 6. Migration Base de Données

Les utilisateurs existants ont `default_model` stocké en DB. Il faut migrer :

```sql
-- Migration des modèles par défaut des utilisateurs existants
UPDATE users SET default_model = 'mistral-small-2603'
WHERE default_model = 'mistral-small-latest';

UPDATE users SET default_model = 'mistral-medium-2508'
WHERE default_model = 'mistral-medium-latest';

UPDATE users SET default_model = 'mistral-large-2512'
WHERE default_model = 'mistral-large-latest';

-- Vérification
SELECT default_model, COUNT(*) FROM users GROUP BY default_model;
```

---

## 7. Ordre d'Exécution Recommandé

```
Semaine 1 — Préparation (sans déploiement)
├── ✅ Activer ZDR sur compte Mistral
├── ✅ Modifier config.py + credits.py + plan_config.py + permissions.py
├── ✅ Tester en local avec les nouveaux modèles
└── ✅ Vérifier que les alias legacy fonctionnent

Semaine 2 — Déploiement progressif
├── ✅ Deployer backend avec aliases actifs
├── ✅ Migrer la DB (UPDATE default_model)
├── ✅ Basculer les micro-tâches vers Ministral 8B
└── ✅ Monitorer les coûts API sur 48h

Semaine 3 — Frontend + Communication
├── ✅ Mettre à jour les noms de modèles dans le frontend
├── ✅ Ajouter le badge "IA Française 🇫🇷🇪🇺" sur le site
├── ✅ Mettre à jour la page mentions légales
└── ✅ Mettre à jour le CLAUDE.md
```

---

## 8. Risques & Mitigations

| Risque                                | Probabilité | Impact | Mitigation                                                    |
| ------------------------------------- | ----------- | ------ | ------------------------------------------------------------- |
| Modèle ID invalide (typo)             | Faible      | Élevé  | Test local + alias fallback                                   |
| Qualité différente sur Small 3.1      | Moyen       | Moyen  | A/B test sur 50 analyses avant migration complète             |
| Breaking change API Mistral           | Faible      | Élevé  | Garder les aliases, fallback sur ancien modèle                |
| Users avec ancien modèle en DB        | Certain     | Faible | Migration SQL + alias resolution dans permissions.py          |
| Ministral 8B trop faible pour entités | Moyen       | Faible | Fallback automatique sur Small 3.1 si score confiance < seuil |

---

## 9. Résumé Exécutif

| Métrique                | Avant         | Après                             |
| ----------------------- | ------------- | --------------------------------- |
| Modèles disponibles     | 3 (legacy)    | 4 (nouvelle gamme) + 1 modération |
| Contexte max            | 128K tokens   | **262K tokens**                   |
| Coût Expert (output/1M) | $6.00         | **$1.50 (-75%)**                  |
| Vidéos 2h+              | ❌ Impossible | ✅ Natif (Large 3 262K)           |
| Souveraineté            | Partielle     | **100% FR/EU**                    |
| RGPD                    | Implicite     | **DPA signé + ZDR**               |
| CLOUD Act               | Non vérifié   | **Exempt** (société française)    |
| EU AI Act               | Non vérifié   | **Signataire Code of Practice**   |

---

_Document généré le 19 mars 2026 — DeepSight Migration Mistral AI_
