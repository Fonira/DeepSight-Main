# Watermark Exports Gratuits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un watermark **"Analysé avec DeepSight"** sur tous les exports des utilisateurs **Free** (TXT, MD, PDF, DOCX, XLSX, CSV) afin de générer un canal de branding viral passif. Les utilisateurs payants (Pro/Expert) reçoivent des exports propres.

**Architecture:** Helper centralisé `add_watermark()` invoqué par les 6 fonctions `export_to_*` dans `service.py`, avec gating par plan (via `normalize_plan_id`) et i18n (FR/EN). Pour le PDF (WeasyPrint), un flag `show_watermark` est propagé du `pdf_generator.py` vers le template Jinja2 qui rend un bloc dédié sur la page de garde et la dernière page. Le frontend ajoute un tooltip plan-aware dans `ExportMenu` indiquant la présence du watermark sur les plans Free + lien upgrade.

**Tech Stack:** FastAPI + Python 3.11, WeasyPrint + Jinja2, python-docx, openpyxl, ReportLab (fallback), pytest + pytest-asyncio ; React 18 + TypeScript + Tailwind ; pas de migration Alembic.

> **Couplage release-train** : ce plan est un **quick win autonome** (cf. `2026-04-29-RELEASE-ORCHESTRATION.md` Sprint A). Il n'introduit aucune migration et utilise `normalize_plan_id` ce qui le rend compatible avec la grille v0 (`free/plus/pro`) ET la grille v2 (`free/pro/expert`). Voir section "Cohérence v0/v2 transition" ci-dessous.

---

## Contexte préalable (à lire impérativement)

### État découvert dans le code (2026-04-29)

#### Backend exports

| Fichier                                                 | Ce qu'on y trouve aujourd'hui                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/exports/service.py:203`                    | `export_to_txt(...)` — texte brut. Pas de gating plan. Inclut déjà la ligne `Généré par Deep Sight — deepsightsynthesis.com` ligne 238 (mention brand origin, **pas** un watermark).                                                                           |
| `backend/src/exports/service.py:249`                    | `export_to_markdown(...)` — Markdown. Inclut déjà `*Généré par [Deep Sight](https://deepsightsynthesis.com) — Analyse intelligente de vidéos YouTube*` ligne 331.                                                                                              |
| `backend/src/exports/service.py:342`                    | `export_to_docx(...)` — DOCX via python-docx. Inclut déjà footer `Généré par Deep Sight — deepsightsynthesis.com` ligne 462.                                                                                                                                   |
| `backend/src/exports/service.py:477`                    | `export_to_pdf_reportlab(...)` — fallback PDF si WeasyPrint absent. Inclut déjà footer `Généré par Deep Sight — deepsightsynthesis.com` ligne 583.                                                                                                             |
| `backend/src/exports/service.py:596`                    | `export_to_pdf(...)` — entry point PDF. Tente WeasyPrint en premier, fallback ReportLab.                                                                                                                                                                       |
| `backend/src/exports/service.py:665`                    | `export_to_csv(...)` — CSV. Inclut déjà ligne `Généré par Deep Sight - deepsightsynthesis.com` ligne 739.                                                                                                                                                      |
| `backend/src/exports/service.py:749`                    | `export_to_excel(...)` — XLSX via openpyxl. Inclut déjà cellule `Généré par Deep Sight — deepsightsynthesis.com` ligne 899.                                                                                                                                    |
| `backend/src/exports/service.py:921`                    | `export_summary(format, ...)` — dispatcher. **AUCUN paramètre `user_plan` ni `user_language` actuellement.**                                                                                                                                                   |
| `backend/src/exports/pdf_generator.py:174`              | `PDFGenerator.generate()` — produit le HTML+CSS via Jinja2 puis WeasyPrint.                                                                                                                                                                                    |
| `backend/src/exports/pdf_generator.py:263`              | `_prepare_template_data()` — construit le dict passé à Jinja2. **Aucun champ `show_watermark` ni `user_plan` actuellement.**                                                                                                                                   |
| `backend/src/exports/pdf_generator.py:362`              | `generate_pdf(...)` — fonction de convenance, point d'entrée appelé depuis `service.py:622`.                                                                                                                                                                   |
| `backend/src/exports/templates/pdf_template.html:19-25` | `@bottom-center` rule CSS : `content: "DeepSight — deepsightsynthesis.com"` sur **toutes les pages SAUF cover** (cover supprime via `@page:first` lignes 35-43). C'est une **mention brand standard**, **PAS** un watermark Free vs Pro. **Ne pas confondre.** |
| `backend/src/exports/templates/pdf_template.html:1048`  | Dernière ligne du body : `Analyse intelligente propulsée par IA — deepsightsynthesis.com` — note signature finale.                                                                                                                                             |
| `backend/src/exports/router.py:100-185`                 | `POST /api/exports/` — endpoint principal. Récupère `current_user` mais **ne passe PAS `user.plan` ni `user.default_lang` à `export_summary()`**.                                                                                                              |
| `backend/src/exports/router.py:188-208`                 | `GET /api/exports/{summary_id}/{format}` — wrapper GET, redirige vers POST. Même comportement.                                                                                                                                                                 |
| `backend/src/exports/router.py:336-349`                 | Audio gating Pro+ via `PLAN_LIMITS["blocked_features"]`. **Précédent du gating plan-based** : on s'inspire de cette structure mais on inverse la logique (Free → ajout watermark, pas blocage).                                                                |

#### Backend modèle utilisateur

| Fichier                          | Champ                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `backend/src/db/database.py:126` | `User.plan = Column(String(20), default="free")` — plan id texte, valide v0 ou v2 selon merge. |
| `backend/src/db/database.py:144` | `User.default_lang = Column(String(5), default="fr")` — langue préférée (FR/EN).               |

> ⚠️ **Subtilité** : la spec d'origine mentionne `user.language` mais le champ réel s'appelle `default_lang` (5 chars, default "fr"). Toutes les références dans ce plan utilisent **`default_lang`**.

#### Backend plan_config (gating helper)

| Fichier                                    | Élément clé                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/billing/plan_config.py:22-32` | `PlanId` enum actuel = `FREE / PLUS / PRO` (grille v0). Devient `FREE / PRO / EXPERT` après merge pricing-v2.                                                  |
| `backend/src/billing/plan_config.py:36-44` | `PLAN_ALIASES` dict : `{etudiant→plus, starter→plus, student→plus, expert→pro, equipe→pro, team→pro, unlimited→pro}` — les anciens plan IDs sont mappés.       |
| `backend/src/billing/plan_config.py:47-58` | `normalize_plan_id(plan_id: str) -> str` — résout les aliases, fallback `"free"` si invalide. **C'est le point d'entrée à utiliser pour le gating watermark.** |

#### Frontend

| Fichier                                                 | État                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/analysis/ExportMenu.tsx:38-39` | `userPlan = user?.plan \|\| "free"`, `canExportAudio = userPlan !== "free"`. Pattern de plan-aware menu déjà en place pour audio. **À étendre pour le tooltip watermark sur les autres formats.** |
| `frontend/src/i18n/fr.json` + `en.json`                 | Locale catalogues existants. **Aucun namespace `export.watermark.*` actuellement.**                                                                                                               |

#### Tests

| Fichier                     | État                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| `backend/tests/`            | **Aucun fichier `test_exports*.py`** présent. Création ex-nihilo nécessaire. |
| `backend/tests/conftest.py` | Fixtures pytest existantes (db session, async client). À réutiliser.         |

### Cohérence v0/v2 transition (CRITIQUE)

Le code SSOT actuel utilise les plan IDs **v0** : `free / plus / pro`. Le plan parallèle `2026-04-29-pricing-v2-stripe-grandfathering.md` migre vers la grille **v2** : `free / pro / expert`. Le mapping est :

```
v0 free  → v2 free   (no change)
v0 plus  → v2 pro    (4.99€ → 8.99€)
v0 pro   → v2 expert (9.99€ → 19.99€)
```

Pendant la fenêtre de transition (avant que pricing-v2 soit mergé), `normalize_plan_id` se comporte différemment :

| user.plan in DB | Pré-pricing-v2 (`normalize_plan_id` actuel) | Post-pricing-v2 (`normalize_plan_id` après merge) |
| --------------- | ------------------------------------------- | ------------------------------------------------- |
| `"free"`        | `"free"`                                    | `"free"`                                          |
| `"plus"`        | `"plus"` (passe car PlanId valide)          | `"pro"` (alias legacy → v2)                       |
| `"pro"`         | `"pro"` (passe car PlanId valide)           | `"expert"` (alias legacy → v2)                    |
| `"expert"`      | `"pro"` (mappé via PLAN_ALIASES)            | `"expert"` (PlanId v2 valide)                     |

**Solution** : utiliser un set de plans payants qui couvre les **deux états SSOT**. Pendant la transition :

```python
PAID_PLANS = {"plus", "pro", "expert"}
```

- **Avant pricing-v2 mergé** : un user `plus` (payant 4,99 €) → `normalize → "plus"` → `in PAID_PLANS` → ✅ pas de watermark.
- **Avant pricing-v2 mergé** : un user `pro` (payant 9,99 €) → `normalize → "pro"` → `in PAID_PLANS` → ✅ pas de watermark.
- **Après pricing-v2 mergé** : un user `plus` legacy (DB pas encore migrée) → `normalize → "pro"` → `in PAID_PLANS` → ✅ pas de watermark.
- **Après pricing-v2 mergé + migration 011** : `users.plan` migré vers v2, donc plus aucun `"plus"` en DB → la valeur `"plus"` dans le set devient morte mais inoffensive.

Quand pricing-v2 sera mergé ET la migration 011 appliquée en prod (cf. RELEASE-ORCHESTRATION.md Sprint B), retirer `"plus"` du set deviendra possible. C'est la **D3** de la self-review.

### Hypothèses business locked

| #   | Décision                                                                                                                                                                                                                                                                                 | Source                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| H1  | Watermark uniquement sur Free. Plus/Pro/Expert = exports propres                                                                                                                                                                                                                         | Spec                         |
| H2  | Texte FR par défaut : `"Analysé avec DeepSight — IA souveraine européenne"` + URL `www.deepsightsynthesis.com`                                                                                                                                                                           | Spec                         |
| H3  | Texte EN si `user.default_lang == "en"` : `"Analyzed with DeepSight — European sovereign AI"` + URL identique                                                                                                                                                                            | Spec                         |
| H4  | Format PDF : note **paragraphe italique gris discret** (sans titre) sur cover ET dernière page. Texte seul, pas de logo SVG (cf. D1)                                                                                                                                                     | RELEASE-ORCHESTRATION WM-5   |
| H5  | Helper unique `add_watermark(content, format, user_plan, user_language)` centralise gating + i18n + format-spécifique                                                                                                                                                                    | Architecture                 |
| H6  | Plans payants au sens watermark = `PAID_PLANS = {"plus", "pro", "expert"}` (transition v0→v2)                                                                                                                                                                                            | Cohérence v0/v2              |
| H7  | La mention brand standard existante (`"Généré par Deep Sight — deepsightsynthesis.com"` ligne 238/331/462/583/739/899 service.py + footer @bottom-center pdf_template.html) RESTE en place sur **toutes les exports** (Free et payants). C'est l'origine brand, pas le watermark gating. | Différenciation conceptuelle |
| H8  | Le watermark gating Free ajoute un **second** marqueur, distinct, plus explicite (`"Analysé avec DeepSight — IA souveraine européenne"`), placé en plus de la mention brand existante.                                                                                                   | Architecture                 |

### Choix architectural assumé

Pour minimiser la dette, on **ajoute** un watermark distinct au lieu de transformer la mention brand existante. Si on transformait la mention brand existante en watermark gating, les payants n'auraient plus AUCUNE référence à DeepSight dans leurs fichiers — ce qui dégrade le branding sortant. Donc on garde la mention origin (toujours présente) ET on ajoute le watermark gating Free (présent uniquement Free).

---

## File Structure

| Fichier                                           | Action | Responsabilité                                                                                                                                                                             |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/src/exports/watermark.py`                | Create | Helper unique `add_watermark(content, format, user_plan, user_language)` + constants `PAID_PLANS` + textes i18n FR/EN                                                                      |
| `backend/src/exports/service.py`                  | Modify | Toutes les fonctions `export_to_*` reçoivent `user_plan` + `user_language` (default `"free"` / `"fr"`), appellent helper. `export_summary` propage.                                        |
| `backend/src/exports/pdf_generator.py`            | Modify | `PDFGenerator.generate()` + `generate_pdf()` reçoivent `user_plan` + `user_language` ; `_prepare_template_data` ajoute `show_watermark`, `watermark_text`, `watermark_url` au dict Jinja2  |
| `backend/src/exports/templates/pdf_template.html` | Modify | Ajout 2 blocs `{% if show_watermark %}` : un sur la cover (au-dessus du `cover-footer`) et un sur la dernière page (au-dessus de la note signature ligne 1048). Style italic gris discret. |
| `backend/src/exports/router.py`                   | Modify | `POST /api/exports/` et `GET /api/exports/{summary_id}/{format}` passent `user_plan=current_user.plan` + `user_language=current_user.default_lang` à `export_summary()`                    |
| `frontend/src/components/analysis/ExportMenu.tsx` | Modify | Ajout tooltip plan-aware sous les items pdf/md/txt si `userPlan === "free"` : "Les exports gratuits incluent un watermark — passez Pro pour le retirer" + lien `/upgrade`                  |
| `frontend/src/i18n/fr.json`                       | Modify | Ajout namespace `export.watermark.notice_free` + `export.watermark.upgrade_link`                                                                                                           |
| `frontend/src/i18n/en.json`                       | Modify | Idem en anglais                                                                                                                                                                            |
| `backend/tests/test_exports_watermark.py`         | Create | pytest couvrant 6 formats × 3 plans (Free / Plus / Pro) × 2 langues (FR / EN) — vérifie présence/absence du watermark via `normalize_plan_id`                                              |

---

## Task 1 : Helper `watermark.py` (TDD)

**Files:**

- Create: `backend/src/exports/watermark.py`
- Create: `backend/tests/test_exports_watermark.py`

> ⚠️ **TDD strict** : on écrit le test en premier (qui échoue), puis l'implémentation, puis on revérifie.

- [ ] **Étape 1 : Écrire le test qui échoue**

`backend/tests/test_exports_watermark.py` :

```python
"""Tests du helper watermark — gating Free vs payant + i18n FR/EN + 6 formats."""
import pytest
from exports.watermark import add_watermark, PAID_PLANS


# ─── Constantes attendues ────────────────────────────────────────────────────

EXPECTED_FR_TEXT = "Analysé avec DeepSight"
EXPECTED_FR_TAGLINE = "IA souveraine européenne"
EXPECTED_EN_TEXT = "Analyzed with DeepSight"
EXPECTED_EN_TAGLINE = "European sovereign AI"
EXPECTED_URL = "www.deepsightsynthesis.com"


# ─── Set PAID_PLANS ──────────────────────────────────────────────────────────

def test_paid_plans_contains_v0_and_v2_during_transition():
    """PAID_PLANS doit couvrir 'plus' (v0), 'pro' (v0+v2), 'expert' (v2) pendant la transition."""
    assert "plus" in PAID_PLANS
    assert "pro" in PAID_PLANS
    assert "expert" in PAID_PLANS
    assert "free" not in PAID_PLANS


# ─── Gating Free vs payant ───────────────────────────────────────────────────

@pytest.mark.parametrize("paid_plan", ["plus", "pro", "expert"])
@pytest.mark.parametrize("fmt", ["txt", "md", "docx", "pdf", "csv", "xlsx"])
def test_watermark_not_applied_for_paid_plans(paid_plan: str, fmt: str):
    """Aucun watermark sur les plans payants, tous formats."""
    original = "Contenu test"
    result = add_watermark(original, fmt, user_plan=paid_plan, user_language="fr")
    assert result == original


@pytest.mark.parametrize("fmt", ["txt", "md", "docx", "pdf", "csv", "xlsx"])
def test_watermark_applied_for_free_plan(fmt: str):
    """Watermark présent sur tous les formats pour Free."""
    original = "Contenu test"
    result = add_watermark(original, fmt, user_plan="free", user_language="fr")
    assert result != original
    assert EXPECTED_FR_TEXT in result
    assert EXPECTED_URL in result


def test_watermark_applied_for_unknown_plan_defaults_to_free():
    """Plan inconnu → fallback Free → watermark appliqué."""
    result = add_watermark("X", "txt", user_plan="bogus_plan", user_language="fr")
    assert EXPECTED_FR_TEXT in result


def test_watermark_applied_for_empty_plan():
    """Plan vide ou None → fallback Free."""
    result_empty = add_watermark("X", "txt", user_plan="", user_language="fr")
    result_none = add_watermark("X", "txt", user_plan=None, user_language="fr")
    assert EXPECTED_FR_TEXT in result_empty
    assert EXPECTED_FR_TEXT in result_none


# ─── i18n FR / EN ────────────────────────────────────────────────────────────

def test_watermark_french_default():
    """Langue FR par défaut."""
    result = add_watermark("X", "txt", user_plan="free", user_language="fr")
    assert EXPECTED_FR_TEXT in result
    assert EXPECTED_FR_TAGLINE in result
    assert EXPECTED_EN_TEXT not in result


def test_watermark_english():
    """Langue EN si user_language='en'."""
    result = add_watermark("X", "txt", user_plan="free", user_language="en")
    assert EXPECTED_EN_TEXT in result
    assert EXPECTED_EN_TAGLINE in result
    assert EXPECTED_FR_TEXT not in result


def test_watermark_unknown_language_defaults_to_fr():
    """Langue inconnue (es, de, etc.) → fallback FR."""
    result = add_watermark("X", "txt", user_plan="free", user_language="es")
    assert EXPECTED_FR_TEXT in result


# ─── Format-specific shape ───────────────────────────────────────────────────

def test_watermark_txt_format():
    """TXT : séparateur '---' + ligne plain."""
    result = add_watermark("Hello", "txt", user_plan="free", user_language="fr")
    assert "Hello" in result
    assert "---" in result
    # No markdown
    assert "[" not in result.split("Hello")[1]
    assert "(" not in result.split("Hello")[1]


def test_watermark_md_format():
    """MD : séparateur '---' + lien markdown."""
    result = add_watermark("Hello", "md", user_plan="free", user_language="fr")
    assert "Hello" in result
    assert "---" in result
    assert "[DeepSight](https://www.deepsightsynthesis.com)" in result
    # Italic
    assert "*" in result.split("Hello")[1]


def test_watermark_csv_format():
    """CSV : commentaire dernière ligne préfixé par '#'."""
    result = add_watermark("a,b,c", "csv", user_plan="free", user_language="fr")
    assert "a,b,c" in result
    last_line = result.strip().split("\n")[-1]
    assert last_line.startswith("#")
    assert EXPECTED_FR_TEXT in last_line


# ─── Format binaires (DOCX/XLSX/PDF) — passthrough ──────────────────────────

def test_watermark_docx_returns_marker_dict():
    """DOCX : helper retourne dict {needs_watermark, text, url} pour que service.py l'injecte via python-docx."""
    result = add_watermark("placeholder", "docx", user_plan="free", user_language="fr")
    assert isinstance(result, dict)
    assert result["needs_watermark"] is True
    assert EXPECTED_FR_TEXT in result["text"]
    assert result["url"] == EXPECTED_URL


def test_watermark_docx_no_marker_for_paid():
    """DOCX : payant → dict avec needs_watermark=False."""
    result = add_watermark("placeholder", "docx", user_plan="pro", user_language="fr")
    assert isinstance(result, dict)
    assert result["needs_watermark"] is False


def test_watermark_xlsx_returns_marker_dict():
    """XLSX : idem DOCX, dict marqueur."""
    result = add_watermark("placeholder", "xlsx", user_plan="free", user_language="fr")
    assert isinstance(result, dict)
    assert result["needs_watermark"] is True
    assert EXPECTED_FR_TEXT in result["text"]


def test_watermark_pdf_returns_marker_dict():
    """PDF : idem, dict pour propagation au template Jinja2."""
    result = add_watermark("placeholder", "pdf", user_plan="free", user_language="fr")
    assert isinstance(result, dict)
    assert result["needs_watermark"] is True
    assert EXPECTED_FR_TEXT in result["text"]
    assert result["url"] == EXPECTED_URL


# ─── Normalize via plan_config ───────────────────────────────────────────────

def test_watermark_normalize_legacy_aliases():
    """Plans legacy (etudiant, starter, student, equipe, team, unlimited) sont mappés via normalize_plan_id."""
    # 'etudiant' → 'plus' (in PAID_PLANS) → no watermark
    result_etudiant = add_watermark("X", "txt", user_plan="etudiant", user_language="fr")
    assert result_etudiant == "X"
    # 'team' → 'pro' (in PAID_PLANS) → no watermark
    result_team = add_watermark("X", "txt", user_plan="team", user_language="fr")
    assert result_team == "X"
    # 'unlimited' → 'pro' → no watermark
    result_unlim = add_watermark("X", "txt", user_plan="unlimited", user_language="fr")
    assert result_unlim == "X"
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_exports_watermark.py -v
```

Expected: FAIL avec `ModuleNotFoundError: No module named 'exports.watermark'`.

- [ ] **Étape 3 : Implémenter le helper minimal**

`backend/src/exports/watermark.py` :

```python
"""
DeepSight — Watermark helper for free-plan exports.

Centralise le gating Free vs payant + i18n FR/EN + dispatch par format.

Pour les formats texte (txt/md/csv) : retourne directement le contenu modifié.
Pour les formats binaires (docx/xlsx/pdf) : retourne un dict marqueur que le
caller utilisera pour injecter le watermark via la lib appropriée
(python-docx / openpyxl / Jinja2 template).
"""
from __future__ import annotations

from typing import Optional, Union

from billing.plan_config import normalize_plan_id


# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Pendant la transition v0 → v2 (cf. plan pricing-v2 séparé), les plans payants
# couvrent les trois IDs possibles. Quand pricing-v2 sera mergé ET la migration
# 011 appliquée en prod, retirer "plus" de la set.
PAID_PLANS: frozenset[str] = frozenset({"plus", "pro", "expert"})

WATERMARK_URL = "www.deepsightsynthesis.com"
WATERMARK_URL_HTTPS = "https://www.deepsightsynthesis.com"

# Texte i18n
WATERMARK_TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "tagline": "Analysé avec DeepSight — IA souveraine européenne",
        "short": "Analysé avec DeepSight",
        "name": "DeepSight",
        "language_label": "français",
    },
    "en": {
        "tagline": "Analyzed with DeepSight — European sovereign AI",
        "short": "Analyzed with DeepSight",
        "name": "DeepSight",
        "language_label": "english",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# CORE
# ═══════════════════════════════════════════════════════════════════════════════


def _resolve_language(user_language: Optional[str]) -> str:
    """Résout la langue : fr par défaut, en si 'en', sinon fallback fr."""
    if not user_language:
        return "fr"
    lang = user_language.lower().strip()
    if lang in WATERMARK_TEXTS:
        return lang
    return "fr"


def _should_apply_watermark(user_plan: Optional[str]) -> bool:
    """Détermine si le watermark doit être appliqué.

    Règle : watermark si plan normalisé NOT in PAID_PLANS (donc Free + plans inconnus).
    """
    if not user_plan:
        return True  # Free fallback
    normalized = normalize_plan_id(user_plan)
    return normalized not in PAID_PLANS


def add_watermark(
    content: Union[str, bytes, dict],
    format: str,
    user_plan: Optional[str],
    user_language: str = "fr",
) -> Union[str, dict]:
    """
    Ajoute un watermark de branding sur un export en plan Free.

    Pour les formats texte (txt, md, csv), retourne le contenu modifié directement.
    Pour les formats binaires (docx, xlsx, pdf), retourne un dict marqueur :

        {
            "needs_watermark": bool,
            "text": str,           # Texte tagline (ex: "Analysé avec DeepSight — IA souveraine européenne")
            "short": str,          # Texte court (ex: "Analysé avec DeepSight")
            "url": str,            # "www.deepsightsynthesis.com"
            "url_https": str,      # "https://www.deepsightsynthesis.com"
            "language": str,       # "fr" | "en"
        }

    Le caller utilisera ce dict pour injecter le watermark via la lib appropriée
    (python-docx footer, openpyxl cell, Jinja2 template var).

    Args:
        content: contenu original (texte ou marqueur dict pour binaires)
        format: "txt" | "md" | "csv" | "docx" | "xlsx" | "pdf"
        user_plan: plan id (free, plus, pro, expert, etudiant, team, ...) — sera normalisé
        user_language: "fr" | "en" (défaut: "fr"), tout autre code → fallback "fr"

    Returns:
        Le contenu modifié (str) pour txt/md/csv, ou un dict marqueur pour docx/xlsx/pdf.
    """
    apply = _should_apply_watermark(user_plan)
    lang = _resolve_language(user_language)
    texts = WATERMARK_TEXTS[lang]

    # Format binaire : dict marqueur (toujours retourné — needs_watermark décide)
    if format in ("docx", "xlsx", "pdf"):
        return {
            "needs_watermark": apply,
            "text": texts["tagline"],
            "short": texts["short"],
            "url": WATERMARK_URL,
            "url_https": WATERMARK_URL_HTTPS,
            "language": lang,
        }

    # Pas de watermark pour les payants → contenu inchangé
    if not apply:
        return content

    # Format texte : injection du marqueur en fin de contenu
    if format == "txt":
        return (
            f"{content}\n\n"
            f"---\n"
            f"{texts['tagline']} ({WATERMARK_URL})\n"
        )

    if format == "md":
        return (
            f"{content}\n\n"
            f"---\n"
            f"*{texts['short']} avec [DeepSight]({WATERMARK_URL_HTTPS}) — "
            f"{texts['tagline'].split('— ', 1)[1] if '— ' in texts['tagline'] else texts['tagline']}*\n"
        ) if False else (  # Variante plus directe :
            f"{content}\n\n"
            f"---\n"
            f"*{texts['tagline'].replace('DeepSight', f'[DeepSight]({WATERMARK_URL_HTTPS})')}*\n"
        )

    if format == "csv":
        # Commentaire en dernière ligne (les parsers CSV standards ignorent les '#')
        return (
            f"{content.rstrip()}\n"
            f"# {texts['tagline']} ({WATERMARK_URL})\n"
        )

    # Format inconnu : passthrough sans modification (sécurité)
    return content
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_exports_watermark.py -v
```

Expected: tous les tests `test_*` PASSENT (≥ 17 tests).

> ⚠️ Si certains tests échouent sur le format MD (lien markdown), ajuster la chaîne dans `add_watermark` pour matcher exactement `[DeepSight](https://www.deepsightsynthesis.com)`.

- [ ] **Étape 5 : Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/exports/watermark.py backend/tests/test_exports_watermark.py
git commit -m "feat(exports): add watermark helper for free-plan exports

- Centralised gating (Free vs paid plans via normalize_plan_id)
- i18n FR (default) + EN, fallback FR for unknown languages
- Dispatch by format: text formats return modified content, binary formats return marker dict
- PAID_PLANS = {plus, pro, expert} during v0→v2 transition (remove 'plus' post pricing-v2 merge)
- pytest TDD: 17+ tests covering 6 formats × 3 plans × 2 languages"
```

---

## Task 2 : PDF — propagation `show_watermark` au template Jinja2

**Files:**

- Modify: `backend/src/exports/pdf_generator.py:174-261` (signature `generate()`) + `:263-343` (`_prepare_template_data()`) + `:362-405` (`generate_pdf()`)
- Modify: `backend/src/exports/templates/pdf_template.html` (2 blocs `{% if show_watermark %}`)

- [ ] **Étape 1 : Étendre la signature de `PDFGenerator.generate()` et `generate_pdf()`**

Édit `backend/src/exports/pdf_generator.py` :

```python
# Dans PDFGenerator.generate(), ajouter user_plan + user_language à la signature
    def generate(
        self,
        title: str,
        channel: str,
        category: str,
        mode: str,
        summary: str,
        video_url: str = "",
        duration: int = 0,
        thumbnail_url: str = "",
        entities: Optional[Dict] = None,
        reliability_score: Optional[float] = None,
        created_at: Optional[datetime] = None,
        flashcards: Optional[List[Dict]] = None,
        quiz: Optional[List[Dict]] = None,
        sources: Optional[List[Dict]] = None,
        export_type: PDFExportType = PDFExportType.FULL,
        user_plan: Optional[str] = None,         # ← NEW
        user_language: str = "fr",                # ← NEW
    ) -> Optional[bytes]:
```

Et dans le bloc `try:` interne, propager au `_prepare_template_data` :

```python
            template_data = self._prepare_template_data(
                title=title,
                # ... (champs existants inchangés)
                export_type=export_type,
                user_plan=user_plan,            # ← NEW
                user_language=user_language,    # ← NEW
            )
```

- [ ] **Étape 2 : Étendre `_prepare_template_data()` pour calculer le marqueur watermark**

Au début de `_prepare_template_data()`, importer le helper :

```python
        from .watermark import add_watermark
```

Et avant le `return {...}`, calculer le marqueur :

```python
        # Watermark gating (Free vs payant)
        watermark_marker = add_watermark(
            content="placeholder",
            format="pdf",
            user_plan=user_plan,
            user_language=user_language,
        )
        # add_watermark pour 'pdf' retourne toujours un dict (needs_watermark, text, url, ...)
        show_watermark = watermark_marker["needs_watermark"]
        watermark_text = watermark_marker["text"]
        watermark_url = watermark_marker["url"]
```

Ajouter au dict retourné :

```python
            # Watermark gating
            "show_watermark": show_watermark,
            "watermark_text": watermark_text,
            "watermark_url": watermark_url,
```

Et étendre la signature de `_prepare_template_data` :

```python
    def _prepare_template_data(
        self,
        title: str,
        # ... (existant)
        export_type: PDFExportType,
        user_plan: Optional[str] = None,         # ← NEW
        user_language: str = "fr",                # ← NEW
    ) -> Dict[str, Any]:
```

- [ ] **Étape 3 : Étendre `generate_pdf()` (fonction de convenance)**

À la fin de `pdf_generator.py`, modifier `generate_pdf()` :

```python
def generate_pdf(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    export_type: str = "full",
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
    **kwargs,
) -> Optional[bytes]:
    """..."""
    generator = get_pdf_generator()
    type_map = {
        # ... (existant)
    }
    pdf_export_type = type_map.get(export_type, PDFExportType.FULL)

    return generator.generate(
        title=title,
        channel=channel,
        category=category,
        mode=mode,
        summary=summary,
        export_type=pdf_export_type,
        user_plan=user_plan,                  # ← NEW
        user_language=user_language,          # ← NEW
        **kwargs,
    )
```

- [ ] **Étape 4 : Ajouter les blocs `{% if show_watermark %}` au template Jinja2**

Édit `backend/src/exports/templates/pdf_template.html`.

**Bloc 1 — sur la cover** : juste avant la fermeture du `<div class="cover-footer">` (autour de la ligne 803-810). Ajouter au-dessus :

```html
{% if show_watermark %}
<div class="cover-watermark">
  <em>{{ watermark_text }} — {{ watermark_url }}</em>
</div>
{% endif %}
```

**Bloc 2 — sur la dernière page** : juste avant la ligne 1048 (`Analyse intelligente propulsée par IA — deepsightsynthesis.com`). Ajouter au-dessus :

```html
{% if show_watermark %}
<div class="last-page-watermark">
  <em>{{ watermark_text }} — {{ watermark_url }}</em>
</div>
{% endif %}
```

**Bloc 3 — CSS** : ajouter dans la section style (sous les autres rules `cover-*`, ~ligne 200) :

```css
.cover-watermark {
  margin-top: 1.2cm;
  text-align: center;
  font-size: 8pt;
  color: #94a3b8;
  font-style: italic;
  letter-spacing: 0.3px;
}

.last-page-watermark {
  margin-top: 0.8cm;
  text-align: center;
  font-size: 8pt;
  color: #94a3b8;
  font-style: italic;
  letter-spacing: 0.3px;
  page-break-before: avoid;
}
```

- [ ] **Étape 5 : Test manuel rapide (smoke test)**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -c "
from src.exports.pdf_generator import generate_pdf
pdf = generate_pdf(
    title='Test',
    channel='Test Channel',
    category='Tech',
    mode='Standard',
    summary='# Test\n\nContenu de test.',
    user_plan='free',
    user_language='fr',
)
with open('/tmp/test_free.pdf', 'wb') as f:
    f.write(pdf)
print('OK', len(pdf), 'bytes')
"
```

Expected: fichier `/tmp/test_free.pdf` généré, contient (ouvrir et chercher) le texte `Analysé avec DeepSight — IA souveraine européenne`.

Refaire avec `user_plan='pro'` → vérifier que la chaîne `Analysé avec DeepSight` n'apparaît PAS (la mention brand standard `DeepSight — deepsightsynthesis.com` peut rester via @bottom-center).

- [ ] **Étape 6 : Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/exports/pdf_generator.py backend/src/exports/templates/pdf_template.html
git commit -m "feat(exports/pdf): propagate user_plan + show_watermark to Jinja2 template

- Extend PDFGenerator.generate() and generate_pdf() with user_plan + user_language
- _prepare_template_data() calls add_watermark() and forwards show_watermark/text/url
- pdf_template.html: 2 conditional blocks (cover + last page) + CSS italic gris discret
- Free users: visible watermark on cover and last page
- Paid users: clean PDF (existing brand origin @bottom-center stays untouched)"
```

---

## Task 3 : Adapter chaque format `service.py` (TXT, MD, DOCX, XLSX, CSV, PDF dispatcher)

**Files:**

- Modify: `backend/src/exports/service.py:203-241` (`export_to_txt`)
- Modify: `backend/src/exports/service.py:249-334` (`export_to_markdown`)
- Modify: `backend/src/exports/service.py:342-469` (`export_to_docx`)
- Modify: `backend/src/exports/service.py:477-588` (`export_to_pdf_reportlab`)
- Modify: `backend/src/exports/service.py:596-657` (`export_to_pdf` dispatcher)
- Modify: `backend/src/exports/service.py:665-741` (`export_to_csv`)
- Modify: `backend/src/exports/service.py:749-913` (`export_to_excel`)
- Modify: `backend/src/exports/service.py:921-1010+` (`export_summary` dispatcher)

> **Stratégie** : ajouter `user_plan: Optional[str] = None` et `user_language: str = "fr"` à TOUTES les signatures, propager via `export_summary`. Pour les formats texte, appel direct `add_watermark`. Pour les formats binaires (DOCX/XLSX), récupérer le dict marqueur et injecter via la lib appropriée. Pour PDF, propager au `generate_pdf()` (Task 2 fait le travail au niveau du template).

- [ ] **Étape 1 : Étendre `export_to_txt`**

Au début du fichier (sous les imports existants), ajouter :

```python
from .watermark import add_watermark
```

Modifier la signature et la fin :

```python
def export_to_txt(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    created_at: datetime = None,
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> str:
    """Exporte l'analyse en format texte brut"""
    # ... (corps existant inchangé jusqu'au return)

    content = f"""..."""  # (existant)

    # Watermark plan-aware (Free seulement)
    return add_watermark(content, "txt", user_plan, user_language)
```

- [ ] **Étape 2 : Étendre `export_to_markdown`**

```python
def export_to_markdown(
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    thumbnail_url: str = "",
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None,
    flashcards: List[Dict] = None,
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> str:
    """Exporte l'analyse en format Markdown"""
    # ... (corps existant)

    # En fin de fonction, juste avant `return content` :
    return add_watermark(content, "md", user_plan, user_language)
```

- [ ] **Étape 3 : Étendre `export_to_docx`**

```python
def export_to_docx(
    title: str,
    # ... (existant)
    flashcards: List[Dict] = None,
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> Optional[bytes]:
    """Exporte l'analyse en format DOCX"""
    if not DOCX_AVAILABLE:
        return None
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()
    # ... (corps existant inchangé jusqu'à la fin)

    # Footer existant (mention brand) — RESTE :
    footer = doc.add_paragraph()
    footer.add_run("Généré par Deep Sight — deepsightsynthesis.com").italic = True
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # ─── NEW : Watermark gating Free ───
    marker = add_watermark("placeholder", "docx", user_plan, user_language)
    if marker["needs_watermark"]:
        wm = doc.add_paragraph()
        run = wm.add_run(f"{marker['text']} — {marker['url']}")
        run.italic = True
        run.font.size = None  # Garde taille par défaut
        wm.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Sauvegarder
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
```

- [ ] **Étape 4 : Étendre `export_to_pdf_reportlab`**

```python
def export_to_pdf_reportlab(
    title: str,
    # ... (existant)
    created_at: datetime = None,
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> Optional[bytes]:
    """Export PDF de fallback avec ReportLab (moins stylé)"""
    # ... (corps existant)

    # Footer mention brand existant — RESTE
    story.append(Paragraph("Généré par Deep Sight — deepsightsynthesis.com", footer_style))

    # ─── NEW : Watermark gating Free ───
    marker = add_watermark("placeholder", "pdf", user_plan, user_language)
    if marker["needs_watermark"]:
        watermark_style = ParagraphStyle(
            "Watermark",
            parent=styles["Normal"],
            fontSize=8,
            textColor=HexColor("#94a3b8"),
            alignment=1,
            fontName="Helvetica-Oblique",
        )
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(f"{marker['text']} — {marker['url']}", watermark_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
```

- [ ] **Étape 5 : Étendre `export_to_pdf` (dispatcher WeasyPrint/ReportLab)**

```python
def export_to_pdf(
    title: str,
    # ... (existant)
    export_type: str = "full",
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> Optional[bytes]:
    """Exporte l'analyse en format PDF (WeasyPrint, fallback ReportLab)."""

    if weasyprint_available():
        pdf = generate_pdf_weasyprint(
            title=title,
            # ... (existant)
            export_type=export_type,
            user_plan=user_plan,              # ← NEW
            user_language=user_language,      # ← NEW
        )
        if pdf:
            return pdf
        print("⚠️ WeasyPrint failed, falling back to ReportLab", flush=True)

    if REPORTLAB_AVAILABLE:
        return export_to_pdf_reportlab(
            title=title,
            # ... (existant)
            user_plan=user_plan,              # ← NEW
            user_language=user_language,      # ← NEW
        )

    return None
```

> ⚠️ Vérifier que `generate_pdf_weasyprint` est bien la fonction importée depuis `pdf_generator.py` (alias possible). Si oui, l'appel propage automatiquement vers `generate_pdf()` modifié en Task 2.

- [ ] **Étape 6 : Étendre `export_to_csv`**

```python
def export_to_csv(
    title: str,
    # ... (existant)
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> str:
    """Exporte l'analyse en format CSV (structured data)"""
    # ... (corps existant inchangé jusqu'à la fin)

    writer.writerow([])
    writer.writerow(["Généré par Deep Sight - deepsightsynthesis.com"])

    csv_content = buffer.getvalue()
    return add_watermark(csv_content, "csv", user_plan, user_language)
```

- [ ] **Étape 7 : Étendre `export_to_excel`**

```python
def export_to_excel(
    title: str,
    # ... (existant)
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> Optional[bytes]:
    """Exporte l'analyse en format Excel (.xlsx)"""
    if not EXCEL_AVAILABLE:
        return None
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

    # ... (corps existant)

    # Footer existant (mention brand) — RESTE
    ws.merge_cells(f"A{row}:D{row}")
    cell = ws[f"A{row}"]
    cell.value = "Généré par Deep Sight — deepsightsynthesis.com"
    cell.font = Font(name="Arial", size=8, italic=True, color="999999")
    cell.alignment = Alignment(horizontal="center")

    # ─── NEW : Watermark gating Free (cellule supplémentaire en dessous) ───
    marker = add_watermark("placeholder", "xlsx", user_plan, user_language)
    if marker["needs_watermark"]:
        row += 1
        ws.merge_cells(f"A{row}:D{row}")
        wm_cell = ws[f"A{row}"]
        wm_cell.value = f"{marker['text']} — {marker['url']}"
        wm_cell.font = Font(name="Arial", size=8, italic=True, color="94A3B8")
        wm_cell.alignment = Alignment(horizontal="center")

    # ... (column widths existant)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
```

- [ ] **Étape 8 : Étendre `export_summary` (dispatcher)**

```python
def export_summary(
    format: str,
    title: str,
    channel: str,
    category: str,
    mode: str,
    summary: str,
    video_url: str = "",
    duration: int = 0,
    thumbnail_url: str = "",
    entities: Dict = None,
    reliability_score: float = None,
    created_at: datetime = None,
    flashcards: List[Dict] = None,
    sources: List[Dict] = None,
    pdf_export_type: str = "full",
    user_plan: Optional[str] = None,         # ← NEW
    user_language: str = "fr",                # ← NEW
) -> Tuple[Optional[bytes | str], str, str]:
    """Exporte un résumé dans le format demandé."""
    timestamp = datetime.now().strftime("%Y%m%d")
    base_filename = clean_filename(title, timestamp)

    if format == "txt":
        content = export_to_txt(
            title, channel, category, mode, summary,
            video_url, duration, created_at,
            user_plan=user_plan,
            user_language=user_language,
        )
        return content, f"{base_filename}.txt", "text/plain"

    elif format == "md":
        content = export_to_markdown(
            title, channel, category, mode, summary,
            video_url, duration, thumbnail_url,
            entities, reliability_score, created_at, flashcards,
            user_plan=user_plan,
            user_language=user_language,
        )
        return content, f"{base_filename}.md", "text/markdown"

    elif format == "docx":
        if not DOCX_AVAILABLE:
            return None, "", ""
        content = export_to_docx(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at, flashcards,
            user_plan=user_plan,
            user_language=user_language,
        )
        return content, f"{base_filename}.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    elif format == "pdf":
        content = export_to_pdf(
            title=title, channel=channel, category=category, mode=mode, summary=summary,
            video_url=video_url, duration=duration, thumbnail_url=thumbnail_url,
            entities=entities, reliability_score=reliability_score, created_at=created_at,
            flashcards=flashcards, sources=sources, export_type=pdf_export_type,
            user_plan=user_plan,
            user_language=user_language,
        )
        return content, f"{base_filename}.pdf", "application/pdf"

    elif format == "csv":
        content = export_to_csv(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at,
            user_plan=user_plan,
            user_language=user_language,
        )
        return content, f"{base_filename}.csv", "text/csv"

    elif format == "xlsx":
        if not EXCEL_AVAILABLE:
            return None, "", ""
        content = export_to_excel(
            title, channel, category, mode, summary,
            video_url, duration, entities, reliability_score, created_at,
            user_plan=user_plan,
            user_language=user_language,
        )
        return content, f"{base_filename}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    return None, "", ""
```

- [ ] **Étape 9 : Lancer la suite de tests pour vérifier non-régression**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_exports_watermark.py -v
```

Expected: tous les tests existants continuent de passer (les fonctions `export_to_*` n'étaient pas testées auparavant, donc pas de régression possible côté tests).

- [ ] **Étape 10 : Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/exports/service.py
git commit -m "feat(exports): inject watermark in all 6 export formats for free plan

- export_to_txt/md/csv: append watermark via add_watermark helper (text formats)
- export_to_docx: extra italic centered paragraph below brand footer (free only)
- export_to_excel: extra italic centered cell below brand footer (free only)
- export_to_pdf + export_to_pdf_reportlab: propagate user_plan to generator (Jinja2 template handles render)
- export_summary dispatcher: forwards user_plan + user_language to all format handlers
- Existing brand mention 'Généré par Deep Sight — deepsightsynthesis.com' stays on all plans (origin)
- Watermark 'Analysé avec DeepSight — IA souveraine européenne' visible only on free plan"
```

---

## Task 4 : Router — passer `user.plan` + `user.default_lang`

**Files:**

- Modify: `backend/src/exports/router.py:158-174` (appel `export_summary`)

- [ ] **Étape 1 : Propager `current_user.plan` et `current_user.default_lang`**

Dans `export_analysis()` (router.py:100), modifier l'appel à `export_summary` :

```python
    # Générer l'export
    content, filename, mimetype = export_summary(
        format=request.format,
        title=summary.video_title,
        channel=summary.video_channel,
        category=summary.category,
        mode=summary.mode,
        summary=summary.summary_content,
        video_url=summary.video_url,
        duration=summary.video_duration,
        thumbnail_url=summary.thumbnail_url,
        entities=entities,
        reliability_score=summary.reliability_score,
        created_at=summary.created_at,
        flashcards=flashcards,
        sources=sources,
        pdf_export_type=request.pdf_type or "full",
        user_plan=current_user.plan,                  # ← NEW
        user_language=current_user.default_lang or "fr",  # ← NEW
    )
```

> **Note** : `export_analysis_get` (router.py:188) appelle déjà `export_analysis` en interne, donc pas de modification supplémentaire à faire.

- [ ] **Étape 2 : Test d'intégration manuel (smoke test via curl)**

```bash
# Lancer le backend en local
cd C:/Users/33667/DeepSight-Main/backend
source venv/bin/activate  # ou Set-Location dans PowerShell + activate.ps1
cd src && uvicorn main:app --reload --port 8000 &

# Avec un token user free, tester l'export TXT
curl -H "Authorization: Bearer $TOKEN_FREE" \
  http://localhost:8000/api/exports/<summary_id>/txt -o /tmp/free.txt

# Vérifier la présence du watermark
grep -i "Analysé avec DeepSight" /tmp/free.txt
# Expected: ligne trouvée

# Avec un token user pro, tester
curl -H "Authorization: Bearer $TOKEN_PRO" \
  http://localhost:8000/api/exports/<summary_id>/txt -o /tmp/pro.txt

# Vérifier l'absence du watermark
grep -i "Analysé avec DeepSight" /tmp/pro.txt
# Expected: AUCUNE ligne trouvée
```

- [ ] **Étape 3 : Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/src/exports/router.py
git commit -m "feat(exports/router): forward user.plan and user.default_lang to export_summary

- Now Free users get watermark, Pro/Expert get clean exports
- i18n: user.default_lang drives FR/EN watermark text"
```

---

## Task 5 : Frontend `ExportMenu` tooltip + i18n

**Files:**

- Modify: `frontend/src/components/analysis/ExportMenu.tsx:103-157` (items dropdown)
- Modify: `frontend/src/i18n/fr.json`
- Modify: `frontend/src/i18n/en.json`

- [ ] **Étape 1 : Ajouter les clés i18n FR**

`frontend/src/i18n/fr.json` (ajouter sous le namespace `export` ou créer si absent) :

```json
{
  "export": {
    "watermark": {
      "notice_free": "Les exports gratuits incluent un watermark — passez Pro pour le retirer",
      "upgrade_link": "Passer Pro"
    }
  }
}
```

- [ ] **Étape 2 : Ajouter les clés i18n EN**

`frontend/src/i18n/en.json` :

```json
{
  "export": {
    "watermark": {
      "notice_free": "Free exports include a watermark — upgrade to Pro to remove it",
      "upgrade_link": "Upgrade to Pro"
    }
  }
}
```

- [ ] **Étape 3 : Modifier `ExportMenu.tsx` pour afficher le tooltip plan-aware**

Édit `frontend/src/components/analysis/ExportMenu.tsx`. Importer `useTranslation` (le projet utilise probablement `react-i18next` ou un custom hook — vérifier l'usage dans un autre composant comme `ChatPanel.tsx`).

Si `LanguageContext` est utilisé (cf. `frontend/src/contexts/LanguageContext.tsx` mentionné dans le CLAUDE.md), pattern :

```typescript
import { useLanguage } from "../../contexts/LanguageContext";
// ...

const { t } = useLanguage();
```

Sinon adapter pour le hook réellement utilisé.

Ajouter une note sous les 3 items pdf/md/txt dans le dropdown si `userPlan === "free"`. Le composant `Dropdown` accepte un sous-ensemble d'items typés `DropdownItem` — on ajoute un item `divider` puis un item info non-cliquable :

```typescript
  const items: DropdownItem[] = [
    {
      id: "pdf",
      label: "PDF",
      description: "Export professionnel mis en page",
      icon: loadingFormat === "pdf" ? <DeepSightSpinnerMicro /> : <FileText className="w-4 h-4" />,
      disabled: loadingFormat !== null,
    },
    {
      id: "md",
      label: "Markdown",
      description: "Format éditable",
      icon: loadingFormat === "md" ? <DeepSightSpinnerMicro /> : <FileCode className="w-4 h-4" />,
      disabled: loadingFormat !== null,
    },
    {
      id: "txt",
      label: "Texte brut",
      description: "Copier-coller universel",
      icon: loadingFormat === "txt" ? <DeepSightSpinnerMicro /> : <AlignLeft className="w-4 h-4" />,
      disabled: loadingFormat !== null,
    },
    // ─── NEW : notice watermark si Free ─────────────────────────────────
    ...(userPlan === "free"
      ? [
          { id: "divider-watermark", label: "", divider: true },
          {
            id: "watermark-notice",
            label: t("export.watermark.notice_free"),
            description: t("export.watermark.upgrade_link"),
            icon: <Lock className="w-4 h-4" />,
            disabled: true,
            // L'utilisateur doit cliquer sur l'item pour naviguer vers /upgrade — gérer dans onSelect
          },
        ]
      : []),
    // ─── existant : audio ─────────────────────────────────────────────
    { id: "divider-audio", label: "", divider: true },
    {
      id: "audio",
      label: canExportAudio ? "Audio" : "Audio (Pro+)",
      description: canExportAudio ? "Écouter l'analyse" : "Disponible à partir du plan Pro",
      icon:
        loadingFormat === "audio" ? <DeepSightSpinnerMicro /> : canExportAudio ? <Headphones className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
      disabled: loadingFormat !== null || !canExportAudio,
    },
  ];
```

Et étendre `onSelect` dans `<Dropdown>` :

```typescript
        onSelect={(id) => {
          if (id === "watermark-notice") {
            window.location.href = "/upgrade";
            return;
          }
          handleExport(id as ExportFormat);
        }}
```

> **Note importante** : si le projet n'a pas de hook `useLanguage` exposé tel quel, simplement hardcoder les chaînes FR (la spec indique FR par défaut) et laisser une TODO pour l'i18n EN dans la review. Vérifier d'abord avec `grep -rn "useLanguage\|useTranslation" frontend/src/components/analysis/` pour voir le pattern utilisé.

- [ ] **Étape 4 : Vérifier compilation TypeScript et lint**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
npm run lint -- src/components/analysis/ExportMenu.tsx
```

Expected: 0 erreur sur le fichier modifié.

- [ ] **Étape 5 : Test visuel rapide (dev server)**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run dev
```

Ouvrir http://localhost:5173 → login user Free → ouvrir une analyse → cliquer sur "Exporter" → vérifier la présence de la mention sous les options PDF/MD/TXT. Refaire avec user Pro → vérifier l'absence.

- [ ] **Étape 6 : Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add frontend/src/components/analysis/ExportMenu.tsx frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat(frontend/exports): add plan-aware watermark notice in ExportMenu

- Free users see info row 'Free exports include a watermark — upgrade to Pro to remove it'
- Click on notice navigates to /upgrade
- i18n FR + EN keys: export.watermark.notice_free, export.watermark.upgrade_link
- Pro/Expert users see no notice (clean menu)"
```

---

## Task 6 : Tests pytest exhaustifs (intégration end-to-end)

**Files:**

- Modify: `backend/tests/test_exports_watermark.py` (ajouter section integration)

> Les tests unitaires du Task 1 couvrent le helper. Ici on teste l'intégration via les fonctions `export_to_*` réelles, garantissant que l'injection fonctionne bien dans tous les formats avec une vraie payload.

- [ ] **Étape 1 : Ajouter une section integration au fichier de tests**

Ajouter à la fin de `backend/tests/test_exports_watermark.py` :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — appel réel à export_to_*
# ═══════════════════════════════════════════════════════════════════════════════
from datetime import datetime

from exports.service import (
    export_to_txt,
    export_to_markdown,
    export_to_docx,
    export_to_csv,
    export_to_excel,
    export_summary,
    DOCX_AVAILABLE,
    EXCEL_AVAILABLE,
)


SAMPLE_KWARGS = dict(
    title="Test Video",
    channel="Test Channel",
    category="Tech",
    mode="Standard",
    summary="# Test\n\nContenu de synthèse de test.",
    video_url="https://youtube.com/watch?v=test",
    duration=600,
    created_at=datetime(2026, 4, 29, 12, 0, 0),
)


# ─── TXT ─────────────────────────────────────────────────────────────────────

def test_integration_txt_free_has_watermark():
    out = export_to_txt(**SAMPLE_KWARGS, user_plan="free", user_language="fr")
    assert "Analysé avec DeepSight" in out
    assert "IA souveraine européenne" in out
    # Mention brand origin existante reste
    assert "deepsightsynthesis.com" in out


def test_integration_txt_pro_no_watermark():
    out = export_to_txt(**SAMPLE_KWARGS, user_plan="pro", user_language="fr")
    assert "Analysé avec DeepSight" not in out
    # Mention brand origin existante reste
    assert "deepsightsynthesis.com" in out


def test_integration_txt_expert_no_watermark():
    out = export_to_txt(**SAMPLE_KWARGS, user_plan="expert", user_language="fr")
    assert "Analysé avec DeepSight" not in out


def test_integration_txt_plus_no_watermark_during_v0_v2_transition():
    """v0 'plus' = payant, doit pas avoir de watermark pendant la transition."""
    out = export_to_txt(**SAMPLE_KWARGS, user_plan="plus", user_language="fr")
    assert "Analysé avec DeepSight" not in out


# ─── MD ──────────────────────────────────────────────────────────────────────

def test_integration_md_free_has_watermark_link():
    out = export_to_markdown(**SAMPLE_KWARGS, user_plan="free", user_language="fr")
    assert "Analysé avec DeepSight" in out
    assert "[DeepSight](https://www.deepsightsynthesis.com)" in out


def test_integration_md_pro_no_watermark():
    out = export_to_markdown(**SAMPLE_KWARGS, user_plan="pro", user_language="fr")
    assert "Analysé avec DeepSight" not in out


def test_integration_md_english():
    out = export_to_markdown(**SAMPLE_KWARGS, user_plan="free", user_language="en")
    assert "Analyzed with DeepSight" in out
    assert "European sovereign AI" in out


# ─── DOCX ────────────────────────────────────────────────────────────────────

@pytest.mark.skipif(not DOCX_AVAILABLE, reason="python-docx not installed")
def test_integration_docx_free_has_watermark_paragraph():
    """DOCX Free contient un paragraphe avec le texte watermark."""
    from docx import Document
    import io

    blob = export_to_docx(**SAMPLE_KWARGS, user_plan="free", user_language="fr")
    assert blob is not None
    doc = Document(io.BytesIO(blob))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Analysé avec DeepSight" in full_text
    assert "IA souveraine européenne" in full_text


@pytest.mark.skipif(not DOCX_AVAILABLE, reason="python-docx not installed")
def test_integration_docx_pro_no_watermark_paragraph():
    from docx import Document
    import io

    blob = export_to_docx(**SAMPLE_KWARGS, user_plan="pro", user_language="fr")
    doc = Document(io.BytesIO(blob))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Analysé avec DeepSight" not in full_text
    # Mention brand existante reste
    assert "Généré par Deep Sight" in full_text


# ─── CSV ─────────────────────────────────────────────────────────────────────

def test_integration_csv_free_has_watermark_comment():
    out = export_to_csv(**SAMPLE_KWARGS, user_plan="free", user_language="fr")
    last_line = out.strip().split("\n")[-1]
    assert last_line.startswith("#")
    assert "Analysé avec DeepSight" in last_line


def test_integration_csv_pro_no_watermark_comment():
    out = export_to_csv(**SAMPLE_KWARGS, user_plan="pro", user_language="fr")
    last_line = out.strip().split("\n")[-1]
    assert "Analysé avec DeepSight" not in last_line


# ─── XLSX ────────────────────────────────────────────────────────────────────

@pytest.mark.skipif(not EXCEL_AVAILABLE, reason="openpyxl not installed")
def test_integration_xlsx_free_has_watermark_cell():
    from openpyxl import load_workbook
    import io

    blob = export_to_excel(**SAMPLE_KWARGS, user_plan="free", user_language="fr")
    assert blob is not None
    wb = load_workbook(io.BytesIO(blob))
    ws = wb.active
    all_values = []
    for row in ws.iter_rows(values_only=True):
        for v in row:
            if v:
                all_values.append(str(v))
    full_text = " ".join(all_values)
    assert "Analysé avec DeepSight" in full_text


@pytest.mark.skipif(not EXCEL_AVAILABLE, reason="openpyxl not installed")
def test_integration_xlsx_pro_no_watermark_cell():
    from openpyxl import load_workbook
    import io

    blob = export_to_excel(**SAMPLE_KWARGS, user_plan="pro", user_language="fr")
    wb = load_workbook(io.BytesIO(blob))
    ws = wb.active
    all_values = []
    for row in ws.iter_rows(values_only=True):
        for v in row:
            if v:
                all_values.append(str(v))
    full_text = " ".join(all_values)
    assert "Analysé avec DeepSight" not in full_text
    assert "Deep Sight" in full_text  # Brand mention existante reste


# ─── PDF (smoke — vérifie générerat sans crash) ──────────────────────────────

def test_integration_pdf_free_smoke():
    """Smoke test : PDF Free généré sans crash, taille > 1KB."""
    content, filename, mimetype = export_summary(
        format="pdf",
        **SAMPLE_KWARGS,
        user_plan="free",
        user_language="fr",
    )
    assert content is not None
    assert len(content) > 1024  # PDF non trivial
    assert filename.endswith(".pdf")
    assert mimetype == "application/pdf"


def test_integration_pdf_pro_smoke():
    content, filename, mimetype = export_summary(
        format="pdf",
        **SAMPLE_KWARGS,
        user_plan="pro",
        user_language="fr",
    )
    assert content is not None
    assert len(content) > 1024


# ─── export_summary dispatcher ───────────────────────────────────────────────

@pytest.mark.parametrize("fmt", ["txt", "md", "csv"])
def test_integration_export_summary_free_has_watermark(fmt: str):
    """Le dispatcher principal applique le watermark pour Free sur les formats texte."""
    content, _, _ = export_summary(
        format=fmt,
        **SAMPLE_KWARGS,
        user_plan="free",
        user_language="fr",
    )
    assert isinstance(content, str)
    assert "Analysé avec DeepSight" in content


@pytest.mark.parametrize("fmt", ["txt", "md", "csv"])
def test_integration_export_summary_pro_no_watermark(fmt: str):
    """Le dispatcher principal n'applique PAS le watermark pour Pro sur les formats texte."""
    content, _, _ = export_summary(
        format=fmt,
        **SAMPLE_KWARGS,
        user_plan="pro",
        user_language="fr",
    )
    assert isinstance(content, str)
    assert "Analysé avec DeepSight" not in content
```

- [ ] **Étape 2 : Lancer la suite complète**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_exports_watermark.py -v
```

Expected: tous les tests passent (20+ unitaires + 18+ intégration ≈ 38+ tests).

> ⚠️ Si certains tests intégration échouent à cause de WeasyPrint indisponible en CI, ajouter `@pytest.mark.skipif(not weasyprint_available(), ...)` aux tests PDF correspondants.

- [ ] **Étape 3 : Commit**

```bash
cd C:/Users/33667/DeepSight-Main
git add backend/tests/test_exports_watermark.py
git commit -m "test(exports): add integration tests for watermark across all 6 formats

- TXT/MD/CSV: assert text injection in real export functions
- DOCX: parse generated bytes with python-docx, scan paragraphs
- XLSX: parse generated bytes with openpyxl, scan all cells
- PDF: smoke test (assert generation success + size > 1KB)
- export_summary dispatcher: parametrized over 3 text formats × free/pro
- 20+ unit tests + 18+ integration tests = 38+ total"
```

---

## Task 7 : Verification finale + non-régression payants

**Files:**

- (vérification, pas de modification)

> Vérification finale : s'assurer qu'AUCUNE mention "Analysé avec DeepSight" ou "IA souveraine européenne" n'apparaît dans les exports payants — quel que soit le format.

- [ ] **Étape 1 : Script de vérification cross-format pour user Pro**

Créer un script ad-hoc temporaire (ne pas committer) :

```bash
cd C:/Users/33667/DeepSight-Main/backend
cat > /tmp/verify_paid_no_watermark.py << 'EOF'
"""Vérification non-régression : aucune mention watermark dans exports payants."""
import sys
import asyncio
from datetime import datetime

# Ajouter src au PYTHONPATH
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from exports.service import export_summary

KWARGS = dict(
    title="Test",
    channel="Test",
    category="Tech",
    mode="Standard",
    summary="Test contenu.",
    video_url="https://youtube.com/watch?v=x",
    duration=300,
    created_at=datetime.now(),
    user_language="fr",
)

WATERMARK_TOKENS = [
    "Analysé avec DeepSight",
    "IA souveraine européenne",
    "Analyzed with DeepSight",
    "European sovereign AI",
]

PAID_PLANS_TO_CHECK = ["plus", "pro", "expert"]
FORMATS = ["txt", "md", "csv"]  # text formats only — binary scanned separately

errors = []
for plan in PAID_PLANS_TO_CHECK:
    for fmt in FORMATS:
        content, _, _ = export_summary(format=fmt, user_plan=plan, **KWARGS)
        if not isinstance(content, str):
            continue
        for token in WATERMARK_TOKENS:
            if token in content:
                errors.append(f"BUG: plan={plan} fmt={fmt} contains '{token}'")

if errors:
    for e in errors:
        print(e)
    sys.exit(1)
else:
    print(f"OK: {len(PAID_PLANS_TO_CHECK)} plans × {len(FORMATS)} formats = {len(PAID_PLANS_TO_CHECK) * len(FORMATS)} combinaisons sans watermark")
EOF

cd C:/Users/33667/DeepSight-Main/backend
python /tmp/verify_paid_no_watermark.py
```

Expected: `OK: 3 plans × 3 formats = 9 combinaisons sans watermark`.

- [ ] **Étape 2 : Vérifier qu'aucun fichier de production n'a été modifié hors scope**

```bash
cd C:/Users/33667/DeepSight-Main
git diff main --stat
```

Expected: seulement les fichiers listés dans la File Structure ci-dessus.

- [ ] **Étape 3 : Lancer la suite de tests backend complète (non-régression cross-module)**

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/ -v --maxfail=10
```

Expected: 774 + N nouveaux tests passent, 0 échec.

- [ ] **Étape 4 : Lancer typecheck + lint frontend**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
npm run lint -- src/components/analysis/ExportMenu.tsx
```

Expected: 0 erreur.

- [ ] **Étape 5 : Pas de commit ici** — ce task est purement vérification.

---

## Self-Review (décisions à confirmer avant exécution)

### D1 — Watermark PDF : texte seul ou logo SVG ?

**Default** : **Texte seul** (paragraphe italique gris discret, pas de logo SVG).

**Pourquoi** : zéro nouvel asset à gérer (path, font embed, base64 inline), zéro complication de rendu WeasyPrint, parfaitement lisible et cohérent avec le ton "discret" voulu pour ne pas dégrader l'expérience Free. Cohérent avec RELEASE-ORCHESTRATION WM-1 et WM-5.

**Alternative** : intégrer un petit logo DeepSight SVG via `<img>` dans le template Jinja2. Possible plus tard en V2 si besoin de plus de présence visuelle.

### D2 — Watermark sur les analyses publiques `/a/[id]` (pages partagées) ?

**Default** : **OUI** — propager le `owner_plan` (le plan du propriétaire de l'analyse) au lieu du plan du visiteur.

**Action concrète si OUI** : dans le router gérant le partage public (à identifier — probablement `backend/src/videos/router.py` ou un router `share/`), passer `user_plan=summary.user.plan` au lieu de `user_plan=current_user.plan` lors de l'export depuis une page publique. C'est **hors scope** de ce plan dans une première itération — à faire en V2 quand on identifiera les flows de partage public concernés.

**Pourquoi NOT NOW** : le partage public dans le scope de la spec exécutée n'est pas mappé (pas trouvé `/a/[id]` dans le grep router.py rapidement). Ne pas surcharger ce sprint Quick Win. La règle simple "watermark si visiteur Free" est cohérente même côté pages publiques (un visiteur Free verra le watermark de TOUTE manière même si l'auteur est Pro).

**À confirmer utilisateur** : laisser cette propagation V2, ou bien écrire le hook owner_plan dès maintenant ?

### D3 — Retirer `"plus"` de `PAID_PLANS` post-merge pricing-v2 ?

**Default** : **OUI**, mais pas dans ce plan. Créer une issue séparée `[chore] watermark: drop "plus" from PAID_PLANS post pricing-v2 migration`.

**Pourquoi** : pendant la transition v0→v2 (cf. plan pricing-v2), il existe potentiellement des users `users.plan == "plus"` en DB jusqu'à l'application de la migration 011 en prod. Une fois la migration appliquée, `users.plan` est déjà migré (`plus → pro`, `pro → expert`), donc plus aucun `"plus"` en DB. À ce moment, `"plus"` dans `PAID_PLANS` devient inerte mais conceptuellement dépassé.

**Action V2** : après merge + déploiement de pricing-v2, modifier `PAID_PLANS = frozenset({"pro", "expert"})` en une PR de cleanup.

### D4 — Branche git pour ce sprint Quick Win ?

**Default** : `feature/watermark-exports-free` (cf. RELEASE-ORCHESTRATION recommandation Sprint A).

**Note** : la branche actuelle de la session est `feature/audit-kimi-plans-2026-04-29` (cf. brief). Confirmer avec l'utilisateur s'il faut créer un worktree dédié `feature/watermark-exports-free` (recommandé pour isolation), ou poursuivre sur la branche existante.

### D5 — Watermark customisable selon persona (étudiant, journaliste, chercheur) ?

**Default** : **NON V1**. Texte unique : `"Analysé avec DeepSight — IA souveraine européenne"` / `"Analyzed with DeepSight — European sovereign AI"`.

**Pourquoi** : la base d'utilisateurs Free est petite et hétérogène. Customiser par persona (étudiant → "Mon cours analysé par DeepSight", journaliste → "Fact-check DeepSight", chercheur → "Sources analysées par DeepSight") demande :

1. Un champ `User.persona` (n'existe pas — le plan dashboard-onboarding propose de l'ajouter mais n'est pas encore mergé)
2. 3+ chaînes traduites par persona × FR/EN = 6+ textes à maintenir
3. Un mécanisme de fallback si `persona = null`

**Action V2** : si le plan `dashboard-onboarding-empty-states` ajoute `User.persona`, on pourra évaluer sa valeur. À ce moment, lookup persona-aware dans `WATERMARK_TEXTS` deviendra trivial.

---

## Execution Handoff

**Plan complet et sauvegardé à** : `C:\Users\33667\DeepSight-Main\docs\superpowers\plans\2026-04-29-watermark-exports-gratuits.md`.

**Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Je dispatche un subagent Opus 4.7 frais par task (7 tasks), je review entre chaque, fast iteration. Idéal pour ce plan car les tasks sont relativement indépendantes (sauf Task 1 → Task 2/3 qui dépend de `watermark.py`).

**2. Inline Execution** — Exécuter dans cette session avec `superpowers:executing-plans`, batch + checkpoints. Plus rapide mais moins de garde-fous.

**Quelle approche ?**

---

_Plan rédigé 2026-04-29 — DeepSight audit Kimi Phase 6 (watermark exports gratuits)._
_Estimé total : 7 tasks ≈ 4-6 h dev + 1 h review/QA. Sprint A quick win autonome._
