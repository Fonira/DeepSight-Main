"""Tests du helper watermark - gating Free vs payant + i18n FR/EN + 6 formats."""
import pytest
from exports.watermark import add_watermark, PAID_PLANS


# --- Constantes attendues ----------------------------------------------------

EXPECTED_FR_TEXT = "Analysé avec DeepSight"
EXPECTED_FR_TAGLINE = "IA souveraine européenne"
EXPECTED_EN_TEXT = "Analyzed with DeepSight"
EXPECTED_EN_TAGLINE = "European sovereign AI"
EXPECTED_URL = "www.deepsightsynthesis.com"


# --- Set PAID_PLANS ----------------------------------------------------------

def test_paid_plans_contains_v0_and_v2_during_transition():
    """PAID_PLANS doit couvrir 'plus' (v0), 'pro' (v0+v2), 'expert' (v2) pendant la transition."""
    assert "plus" in PAID_PLANS
    assert "pro" in PAID_PLANS
    assert "expert" in PAID_PLANS
    assert "free" not in PAID_PLANS


# --- Gating Free vs payant ---------------------------------------------------

@pytest.mark.parametrize("paid_plan", ["plus", "pro", "expert"])
@pytest.mark.parametrize("fmt", ["txt", "md", "csv"])
def test_watermark_not_applied_for_paid_plans_text(paid_plan: str, fmt: str):
    """Aucun watermark sur les plans payants, formats texte."""
    original = "Contenu test"
    result = add_watermark(original, fmt, user_plan=paid_plan, user_language="fr")
    assert result == original


@pytest.mark.parametrize("paid_plan", ["plus", "pro", "expert"])
@pytest.mark.parametrize("fmt", ["docx", "xlsx", "pdf"])
def test_watermark_not_applied_for_paid_plans_binary(paid_plan: str, fmt: str):
    """Plans payants : binary returns marker dict avec needs_watermark=False."""
    result = add_watermark("placeholder", fmt, user_plan=paid_plan, user_language="fr")
    assert isinstance(result, dict)
    assert result["needs_watermark"] is False


@pytest.mark.parametrize("fmt", ["txt", "csv"])
def test_watermark_applied_for_free_plan_text(fmt: str):
    """Watermark present sur formats texte (txt/csv) pour Free."""
    original = "Contenu test"
    result = add_watermark(original, fmt, user_plan="free", user_language="fr")
    assert result != original
    assert EXPECTED_FR_TEXT in result
    assert EXPECTED_URL in result


def test_watermark_applied_for_free_plan_md():
    """MD : watermark present mais format different (lien markdown casse 'Analyse avec DeepSight')."""
    original = "Contenu test"
    result = add_watermark(original, "md", user_plan="free", user_language="fr")
    assert result != original
    # Lien markdown contient DeepSight
    assert "[DeepSight](https://www.deepsightsynthesis.com)" in result
    # Tagline complete contient les autres mots-cles
    assert "IA souveraine européenne" in result
    assert "Analysé avec" in result


def test_watermark_applied_for_unknown_plan_defaults_to_free():
    """Plan inconnu -> fallback Free -> watermark applique."""
    result = add_watermark("X", "txt", user_plan="bogus_plan", user_language="fr")
    assert EXPECTED_FR_TEXT in result


def test_watermark_applied_for_empty_plan():
    """Plan vide ou None -> fallback Free."""
    result_empty = add_watermark("X", "txt", user_plan="", user_language="fr")
    result_none = add_watermark("X", "txt", user_plan=None, user_language="fr")
    assert EXPECTED_FR_TEXT in result_empty
    assert EXPECTED_FR_TEXT in result_none


# --- i18n FR / EN ------------------------------------------------------------

def test_watermark_french_default():
    """Langue FR par defaut."""
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
    """Langue inconnue (es, de, etc.) -> fallback FR."""
    result = add_watermark("X", "txt", user_plan="free", user_language="es")
    assert EXPECTED_FR_TEXT in result


# --- Format-specific shape ---------------------------------------------------

def test_watermark_txt_format():
    """TXT : separateur '---' + ligne plain."""
    result = add_watermark("Hello", "txt", user_plan="free", user_language="fr")
    assert "Hello" in result
    assert "---" in result


def test_watermark_md_format():
    """MD : separateur '---' + lien markdown."""
    result = add_watermark("Hello", "md", user_plan="free", user_language="fr")
    assert "Hello" in result
    assert "---" in result
    assert "[DeepSight](https://www.deepsightsynthesis.com)" in result
    # Italic
    assert "*" in result.split("Hello", 1)[1]


def test_watermark_csv_format():
    """CSV : commentaire derniere ligne prefixe par '#'."""
    result = add_watermark("a,b,c", "csv", user_plan="free", user_language="fr")
    assert "a,b,c" in result
    last_line = result.strip().split("\n")[-1]
    assert last_line.startswith("#")
    assert EXPECTED_FR_TEXT in last_line


# --- Format binaires (DOCX/XLSX/PDF) -- passthrough --------------------------

def test_watermark_docx_returns_marker_dict():
    """DOCX : helper retourne dict {needs_watermark, text, url} pour que service.py l'injecte via python-docx."""
    result = add_watermark("placeholder", "docx", user_plan="free", user_language="fr")
    assert isinstance(result, dict)
    assert result["needs_watermark"] is True
    assert EXPECTED_FR_TEXT in result["text"]
    assert result["url"] == EXPECTED_URL


def test_watermark_docx_no_marker_for_paid():
    """DOCX : payant -> dict avec needs_watermark=False."""
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


# --- Normalize via plan_config ----------------------------------------------

def test_watermark_normalize_legacy_aliases():
    """Plans legacy (etudiant, starter, student, equipe, team, unlimited) sont mappes via normalize_plan_id."""
    # 'etudiant' -> 'plus' (in PAID_PLANS) -> no watermark
    result_etudiant = add_watermark("X", "txt", user_plan="etudiant", user_language="fr")
    assert result_etudiant == "X"
    # 'team' -> 'pro' (in PAID_PLANS) -> no watermark
    result_team = add_watermark("X", "txt", user_plan="team", user_language="fr")
    assert result_team == "X"
    # 'unlimited' -> 'pro' -> no watermark
    result_unlim = add_watermark("X", "txt", user_plan="unlimited", user_language="fr")
    assert result_unlim == "X"
