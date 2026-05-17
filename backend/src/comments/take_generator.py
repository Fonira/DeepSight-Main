"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧠 COMMUNITY TAKE GENERATOR — Mistral JSON-mode (Verdict communauté)             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Input  : CommentsBatch (sampled ~150 comments) + contexte vidéo                  ║
║  Output : CommunityTake (signal, sentiment, controversies, summary, top_voices)   ║
║                                                                                    ║
║  Modèle Mistral calqué sur le plan utilisateur :                                  ║
║    free   → mistral-small-2603 (mais Free n'est PAS gated pour appel direct,      ║
║              le gate est dans le router pipeline + UI)                            ║
║    pro    → mistral-medium-2508                                                    ║
║    expert → mistral-large-2512                                                     ║
║                                                                                    ║
║  ⚠️ ARCHITECTURE : appel via core.llm_provider.llm_complete (Mistral API directe   ║
║      Hetzner → 0 byte proxy Decodo). Pas de proxy ici.                            ║
║                                                                                    ║
║  Anti-sycophancy floor : si max(sentiment_distribution) < 0.5 ET signal != "unclear"║
║      → on force signal = "mixed" pour éviter les verdicts simplistes.             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import re

from core.llm_provider import llm_complete
from core.logging import logger

from .schemas import CommentsBatch, CommunityTake

_PLAN_MODEL = {
    "free": "mistral-small-2603",
    "pro": "mistral-medium-2508",
    "expert": "mistral-large-2512",
}

# ═══════════════════════════════════════════════════════════════════════════════
# 📝 PROMPTS (FR / EN)
# ═══════════════════════════════════════════════════════════════════════════════

COMMUNITY_TAKE_SYSTEM_PROMPT_FR = """Tu es un analyste impartial qui synthétise la réaction d'une communauté en ligne aux propos d'un créateur de contenu vidéo (YouTube ou TikTok).

PRINCIPES STRICTS :
1. **Ne pas trancher artificiellement** : si la communauté est divisée, dis "mixte". Ne donne JAMAIS un verdict simpliste pour générer du clic.
2. **Pas de jugement moral** : tu rapportes ce que disent les commentateurs, pas ce que tu en penses.
3. **Anonymisation** : ne cite jamais le pseudo complet. Utilise "Un commentateur populaire", "Une réponse récente avec X likes", ou pseudonyme tronqué "@user***".
4. **Ignore le bruit** : spam, insultes pures, emoji-only, hors-sujet → exclus.
5. **Représentation équitable** : si 30% sont en désaccord, ils méritent une voix dans top_voices.
6. **Pas de prophétie** : ne dis pas "la majorité pense X" si l'échantillon est < 20 voix significatives.

FORMAT DE SORTIE : JSON strict, AUCUN texte hors JSON. Schéma :
{
  "agreement_signal": "agree" | "disagree" | "mixed" | "unclear",
  "sentiment_distribution": {"positive": 0.0-1.0, "neutral": 0.0-1.0, "negative": 0.0-1.0},
  "controversies": ["sujet de désaccord 1", ...],
  "community_summary": "2-3 phrases factuelles en français",
  "top_voices": [
    {"author": "Un commentateur (8.4k likes)", "excerpt": "extrait < 240 chars", "stance": "agree|disagree|neutral|question", "like_count": 8400},
    ...
  ]
}

RÈGLES DE STANCE :
- "agree" : commentaire soutient le propos central du créateur
- "disagree" : commentaire conteste, corrige, ou prend la position opposée
- "neutral" : observation, complément factuel sans prendre position
- "question" : demande de clarification ou point soulevé non résolu
"""

COMMUNITY_TAKE_SYSTEM_PROMPT_EN = """You are an impartial analyst who synthesizes the online community's reaction to a video creator's statements (YouTube or TikTok).

STRICT PRINCIPLES:
1. **Do not artificially decide**: if the community is divided, say "mixed". NEVER give a simplistic verdict to generate clicks.
2. **No moral judgment**: report what commenters say, not what you think.
3. **Anonymization**: never cite a full username. Use "A popular commenter", "A recent reply with X likes", or truncated pseudonym "@user***".
4. **Ignore noise**: spam, pure insults, emoji-only, off-topic → exclude.
5. **Fair representation**: if 30% disagree, they deserve a voice in top_voices.
6. **No prophecy**: do not say "the majority thinks X" if the sample is < 20 significant voices.

OUTPUT FORMAT: strict JSON, NO text outside JSON. Schema:
{
  "agreement_signal": "agree" | "disagree" | "mixed" | "unclear",
  "sentiment_distribution": {"positive": 0.0-1.0, "neutral": 0.0-1.0, "negative": 0.0-1.0},
  "controversies": ["disagreement topic 1", ...],
  "community_summary": "2-3 factual sentences in English",
  "top_voices": [
    {"author": "A commenter (8.4k likes)", "excerpt": "excerpt < 240 chars", "stance": "agree|disagree|neutral|question", "like_count": 8400},
    ...
  ]
}

STANCE RULES:
- "agree": comment supports the creator's central point
- "disagree": comment contests, corrects, or takes the opposite position
- "neutral": observation, factual complement without taking a position
- "question": request for clarification or unresolved point
"""

# ═══════════════════════════════════════════════════════════════════════════════
# 🧰 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def _pseudonymize(author: str | None) -> str:
    """Tronque un pseudo : "JeanDupont" → "J***". Cas vide → "anon"."""
    if not author:
        return "anon"
    a = author.strip()
    if not a:
        return "anon"
    return a[:1] + "***"


def _build_user_prompt(
    batch: CommentsBatch,
    *,
    video_title: str,
    video_topic_hint: str,
    creator_stance: str,
    lang: str,
) -> str:
    """Construit le user prompt structuré pour Mistral."""
    if lang == "en":
        header = (
            f'VIDEO: "{video_title}"\n'
            f"PLATFORM: {batch.platform}\n"
            f"TOPIC (from analysis): {video_topic_hint[:500] if video_topic_hint else '(not provided)'}\n"
            f"CREATOR POSITION (from analysis): {creator_stance[:300] if creator_stance else '(not provided)'}\n\n"
            f"SAMPLED COMMENTS ({len(batch.sampled)} of {batch.total_seen} raw):\n"
        )
        footer = "\n\nGenerate the JSON CommunityTake."
    else:
        header = (
            f'VIDEO : "{video_title}"\n'
            f"PLATEFORME : {batch.platform}\n"
            f"SUJET (extrait de l'analyse) : {video_topic_hint[:500] if video_topic_hint else '(non fourni)'}\n"
            f"POSITION DU CRÉATEUR (extrait de l'analyse) : "
            f"{creator_stance[:300] if creator_stance else '(non fournie)'}\n\n"
            f"COMMENTAIRES ÉCHANTILLONNÉS ({len(batch.sampled)} sur {batch.total_seen} bruts) :\n"
        )
        footer = "\n\nGénère le JSON CommunityTake."

    lines = []
    for c in batch.sampled:
        text = (c.text or "")[:400].replace("\n", " ").strip()
        pseudo_safe = _pseudonymize(c.author)
        lines.append(f"[{c.like_count}♥] @{pseudo_safe}: {text}")

    return header + "\n".join(lines) + footer


def _strip_code_fences(content: str) -> str:
    """Retire les ```json ... ``` markdown fences éventuelles."""
    s = (content or "").strip()
    # ```json\n...\n``` ou ```...```
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _normalize_sentiment(sd: dict | None) -> dict[str, float]:
    """Normalise sentiment_distribution → somme = 1.0 et 3 clés présentes."""
    base = {"positive": 0.0, "neutral": 0.0, "negative": 0.0}
    if not isinstance(sd, dict):
        return {"positive": 0.0, "neutral": 1.0, "negative": 0.0}
    for k in base:
        try:
            base[k] = max(0.0, float(sd.get(k, 0.0)))
        except (TypeError, ValueError):
            base[k] = 0.0
    total = sum(base.values())
    if total <= 0:
        return {"positive": 0.0, "neutral": 1.0, "negative": 0.0}
    return {k: round(v / total, 3) for k, v in base.items()}


def _apply_anti_sycophancy_floor(data: dict) -> dict:
    """Force signal=mixed si aucun sentiment dominant (max < 0.5).

    Anti-pattern : Mistral renvoie parfois "agree" même quand la communauté est
    clairement divisée (max sentiment ≈ 40-49%). On force "mixed" dans ce cas.
    Ne s'applique pas si signal="unclear" (déjà honnête).
    """
    sig = data.get("agreement_signal")
    sd = data.get("sentiment_distribution") or {}
    if sig in ("agree", "disagree") and isinstance(sd, dict) and sd:
        try:
            mx = max(float(v) for v in sd.values())
        except (TypeError, ValueError):
            mx = 1.0
        if mx < 0.5:
            data["agreement_signal"] = "mixed"
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════


async def generate_community_take(
    *,
    batch: CommentsBatch,
    plan: str,
    video_title: str,
    video_topic_hint: str = "",
    creator_stance: str = "",
    lang: str = "fr",
) -> CommunityTake | None:
    """Génère le verdict communauté Mistral à partir d'un batch sampled.

    Args:
        batch: CommentsBatch déjà sampled (Top + Random).
        plan: "free"/"pro"/"expert" — détermine le modèle Mistral.
        video_title: Titre vidéo.
        video_topic_hint: Extrait analyse (catégorie + transcript[:300]).
        creator_stance: Position éventuelle du créateur (extrait du résumé).
        lang: "fr" ou "en" (défaut "fr").

    Returns:
        CommunityTake ou None si :
        - batch.sampled est vide
        - llm_complete retourne None (Mistral down)
        - JSON parse échoue
    """
    if not batch or not batch.sampled:
        return None

    model = _PLAN_MODEL.get(plan, "mistral-small-2603")
    sys_prompt = COMMUNITY_TAKE_SYSTEM_PROMPT_EN if lang == "en" else COMMUNITY_TAKE_SYSTEM_PROMPT_FR
    user_prompt = _build_user_prompt(
        batch,
        video_title=video_title,
        video_topic_hint=video_topic_hint,
        creator_stance=creator_stance,
        lang=lang,
    )

    # Best-effort moderation (sur extrait limité, ne bloque jamais).
    try:
        from core.moderation_service import moderate_text

        _flagged = await moderate_text(user_prompt[:2000])
        if _flagged and _flagged.flagged_categories:
            logger.warning(
                f"[COMMUNITY_TAKE] Moderation flagged categories: {_flagged.flagged_categories} — "
                "continuing with pseudonymized prompt anyway"
            )
    except Exception:
        # Modération down → on continue, fail-open
        pass

    result = await llm_complete(
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        max_tokens=1500,
        temperature=0.3,
        json_mode=True,
    )

    if not result or not result.content:
        logger.warning("[COMMUNITY_TAKE] llm_complete returned no content")
        return None

    cleaned = _strip_code_fences(result.content)
    try:
        data = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(
            f"[COMMUNITY_TAKE] JSON parse failed: {e} — content[:300]={cleaned[:300]}"
        )
        return None

    if not isinstance(data, dict):
        logger.error(f"[COMMUNITY_TAKE] JSON did not decode to dict (type={type(data).__name__})")
        return None

    # Normalisation pré-validation Pydantic
    data["sentiment_distribution"] = _normalize_sentiment(data.get("sentiment_distribution"))
    data = _apply_anti_sycophancy_floor(data)

    # Force les champs runtime (ne pas faire confiance au LLM pour ces 2)
    data["comments_analyzed"] = len(batch.sampled)
    data["model_used"] = result.model_used

    # Drop les champs surprises (Mistral aime ajouter des clés)
    allowed = {
        "agreement_signal",
        "sentiment_distribution",
        "controversies",
        "community_summary",
        "top_voices",
        "comments_analyzed",
        "model_used",
        "generated_at",
        "is_truncated",
        "disabled",
        "insufficient_data",
    }
    filtered = {k: v for k, v in data.items() if k in allowed}

    # Validation Pydantic (gère type/length constraints)
    try:
        take = CommunityTake(**filtered)
    except Exception as e:
        logger.error(f"[COMMUNITY_TAKE] Pydantic validation failed: {e} — data={filtered}")
        return None

    return take


__all__ = [
    "COMMUNITY_TAKE_SYSTEM_PROMPT_FR",
    "COMMUNITY_TAKE_SYSTEM_PROMPT_EN",
    "generate_community_take",
]
