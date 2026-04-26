"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  📚 STUDY TOOLS v3.0 — Deep Sight                                            ║
║  ✨ Mode JSON officiel Mistral + Parsing ultra-robuste                       ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import sys
import json
import re
from typing import Dict, Any
from datetime import datetime

# Import configuration
from core.llm_provider import llm_complete

# Message de startup visible
print("", file=sys.stderr, flush=True)
print("🎓📚 ══════════════════════════════════════════════════════", file=sys.stderr, flush=True)
print("🎓📚 STUDY TOOLS v3.0 LOADED - Mode JSON Mistral officiel", file=sys.stderr, flush=True)
print("🎓📚 ══════════════════════════════════════════════════════", file=sys.stderr, flush=True)


def log(msg: str):
    """Log avec flush immédiat sur stderr pour garantir l'affichage."""
    print(msg, file=sys.stderr, flush=True)
    print(msg, flush=True)


def safe_json_parse(text: str, context: str = "JSON") -> Dict[str, Any]:
    """
    Parse JSON de manière ultra-robuste avec 6 méthodes de fallback.
    """
    if not text:
        raise ValueError(f"[{context}] Contenu vide")
    
    original_len = len(text)
    log(f"📝 [{context}] Parsing {original_len} caractères...")
    
    # Preview pour debug
    preview = text[:80].replace('\n', '\\n').replace('\r', '\\r')
    log(f"📝 [{context}] Début: {preview}")
    
    # === Méthode 1: Direct ===
    try:
        result = json.loads(text)
        log(f"✅ [{context}] Parsé directement")
        return result
    except json.JSONDecodeError:
        pass
    
    # === Méthode 2: Strip whitespace ===
    cleaned = text.strip()
    try:
        result = json.loads(cleaned)
        log(f"✅ [{context}] Parsé après strip")
        return result
    except json.JSONDecodeError:
        pass
    
    # === Méthode 3: Supprimer BOM et caractères invisibles ===
    cleaned = cleaned.lstrip('\ufeff\u200b\u200c\u200d\u2060\n\r\t ')
    cleaned = cleaned.rstrip('\n\r\t ')
    try:
        result = json.loads(cleaned)
        log(f"✅ [{context}] Parsé après nettoyage BOM")
        return result
    except json.JSONDecodeError:
        pass
    
    # === Méthode 4: Extraire du markdown ===
    if '```' in cleaned:
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned)
        if match:
            extracted = match.group(1).strip()
            try:
                result = json.loads(extracted)
                log(f"✅ [{context}] Extrait du markdown")
                return result
            except json.JSONDecodeError:
                pass
    
    # === Méthode 5: Trouver { } ===
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end > start:
        json_str = cleaned[start:end+1]
        try:
            result = json.loads(json_str)
            log(f"✅ [{context}] Extrait entre accolades")
            return result
        except json.JSONDecodeError:
            pass
        
        # === Méthode 6: Réparer les accolades manquantes ===
        open_b = json_str.count('{')
        close_b = json_str.count('}')
        open_br = json_str.count('[')
        close_br = json_str.count(']')
        
        repaired = json_str
        if open_br > close_br:
            repaired += ']' * (open_br - close_br)
        if open_b > close_b:
            repaired += '}' * (open_b - close_b)
        
        try:
            result = json.loads(repaired)
            log(f"✅ [{context}] JSON réparé")
            return result
        except json.JSONDecodeError:
            pass
    
    # === Échec total - Afficher le contenu pour debug ===
    log(f"❌ [{context}] ÉCHEC PARSING - Contenu reçu:")
    log(f"--- DÉBUT ({original_len} chars) ---")
    log(text[:500])
    log("--- FIN ---")
    
    raise ValueError("Impossible de parser le JSON")


# ═══════════════════════════════════════════════════════════════════════════════
# PROMPTS OPTIMISÉS POUR JSON
# ═══════════════════════════════════════════════════════════════════════════════

STUDY_CARD_SYSTEM = """Tu es un assistant pédagogique expert. Tu génères UNIQUEMENT du JSON valide, sans texte avant ou après."""

STUDY_CARD_USER = """Génère une fiche de révision JSON pour cette vidéo.

VIDÉO: {title}
CHAÎNE: {channel}
RÉSUMÉ: {summary}

RÈGLES IMPORTANTES POUR LES FLASHCARDS:
- Chaque flashcard DOIT avoir une QUESTION complète en "front" (pas un mot seul ou un concept)
- La question doit commencer par "Qu'est-ce que", "Comment", "Pourquoi", "Quel", "Quelle", etc.
- Le "back" contient la réponse détaillée
- Génère au moins 8 flashcards variées

RÈGLES POUR LE QUIZ:
- Génère au moins 5 questions QCM
- 4 options par question, une seule correcte
- Chaque question doit tester la compréhension, pas la mémorisation

Retourne EXACTEMENT ce format JSON:
{{
  "title": "Titre de la fiche",
  "difficulty": "intermediaire",
  "duration_to_study": "15 min",
  "key_points": [
    {{"point": "Point clé 1", "explanation": "Explication détaillée", "importance": "essentiel"}},
    {{"point": "Point clé 2", "explanation": "Explication détaillée", "importance": "important"}}
  ],
  "flashcards": [
    {{"front": "Qu'est-ce que [concept] et pourquoi est-il important ?", "back": "Réponse détaillée avec explication", "category": "Compréhension"}},
    {{"front": "Comment fonctionne [mécanisme] expliqué dans la vidéo ?", "back": "Explication du fonctionnement", "category": "Mécanismes"}},
    {{"front": "Quelle est la différence entre [A] et [B] ?", "back": "A se distingue de B par...", "category": "Comparaison"}}
  ],
  "quiz": [
    {{"question": "Question QCM?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_index": 0, "explanation": "Explication de la réponse"}}
  ],
  "summary_sentence": "Résumé en une phrase",
  "related_topics": ["Sujet connexe 1", "Sujet connexe 2"],
  "study_tips": ["Conseil d'étude 1", "Conseil d'étude 2"]
}}"""

CONCEPT_MAP_SYSTEM = """Tu es un expert en cartographie conceptuelle. Tu génères UNIQUEMENT du JSON valide avec du code Mermaid."""

CONCEPT_MAP_USER = """Génère un mindmap JSON avec code Mermaid pour cette vidéo.

VIDÉO: {title}
CHAÎNE: {channel}
RÉSUMÉ: {summary}

Retourne EXACTEMENT ce format JSON:
{{
  "mermaid_code": "mindmap\\n  root((Titre Principal))\\n    Branche1\\n      SousConcept1\\n      SousConcept2\\n    Branche2\\n      SousConcept3\\n    Branche3\\n      SousConcept4",
  "concepts": [
    {{"name": "Concept central", "type": "central", "description": "Description brève", "related_to": []}},
    {{"name": "Concept secondaire", "type": "primary", "description": "Description", "related_to": ["Concept central"]}}
  ],
  "hierarchy_depth": 3,
  "total_concepts": 8,
  "learning_path": ["Étape 1: Comprendre X", "Étape 2: Maîtriser Y", "Étape 3: Appliquer Z"]
}}"""


# ═══════════════════════════════════════════════════════════════════════════════
# FONCTIONS DE GÉNÉRATION
# ═══════════════════════════════════════════════════════════════════════════════

async def call_mistral_json(
    system_prompt: str,
    user_prompt: str,
    model: str = "mistral-small-2603",
    max_tokens: int = 2500,
    temperature: float = 0.1
) -> str:
    """
    Appelle l'API Mistral avec fallback automatique (Mistral → DeepSeek).
    Note: JSON mode n'est pas garanti via le fallback DeepSeek,
    mais le prompt demande du JSON donc ça marche en pratique.
    Retourne le contenu brut de la réponse.
    """
    log(f"🤖 Appel Mistral [{model}] max_tokens={max_tokens}...")

    result = await llm_complete(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=120,
    )

    if result:
        fallback_info = f" [fallback: {result.provider}:{result.model_used}]" if result.fallback_used else ""
        log(f"🤖 Contenu reçu: {len(result.content)} caractères{fallback_info}")
        return result.content

    raise Exception("Erreur Mistral: tous les providers LLM ont échoué")


async def generate_study_card(
    title: str,
    channel: str,
    summary: str,
    transcript: str = "",
    lang: str = "fr",
    model: str = "mistral-small-2603"
) -> Dict[str, Any]:
    """
    Génère une fiche de révision complète.
    """
    log("")
    log("🎓 ═══════════════════════════════════════════════════")
    log("🎓 GÉNÉRATION FICHE DE RÉVISION")
    log(f"🎓 Titre: {title[:50]}...")
    log("🎓 ═══════════════════════════════════════════════════")
    
    # Préparer le prompt
    summary_short = (summary or "")[:2500]
    user_prompt = STUDY_CARD_USER.format(
        title=title,
        channel=channel,
        summary=summary_short
    )
    
    try:
        # Appeler Mistral avec mode JSON
        content = await call_mistral_json(
            system_prompt=STUDY_CARD_SYSTEM,
            user_prompt=user_prompt,
            model=model,
            max_tokens=3000,
            temperature=0.1
        )
        
        # Parser le JSON
        study_card = safe_json_parse(content, "STUDY_CARD")
        
        # Ajouter métadonnées
        study_card["generated_at"] = datetime.utcnow().isoformat()
        study_card["source_video"] = title
        study_card["source_channel"] = channel
        study_card["lang"] = lang
        
        log(f"✅ Fiche générée: {len(study_card.get('key_points', []))} points clés")
        
        return study_card
        
    except Exception as e:
        log(f"❌ ERREUR generate_study_card: {type(e).__name__}: {e}")
        raise


async def generate_concept_map(
    title: str,
    channel: str,
    summary: str,
    lang: str = "fr",
    model: str = "mistral-small-2603"
) -> Dict[str, Any]:
    """
    Génère un arbre pédagogique (mindmap) au format Mermaid.
    """
    log("")
    log("🌳 ═══════════════════════════════════════════════════")
    log("🌳 GÉNÉRATION ARBRE PÉDAGOGIQUE")
    log(f"🌳 Titre: {title[:50]}...")
    log("🌳 ═══════════════════════════════════════════════════")
    
    # Préparer le prompt
    summary_short = (summary or "")[:3000]
    user_prompt = CONCEPT_MAP_USER.format(
        title=title,
        channel=channel,
        summary=summary_short
    )
    
    try:
        # Appeler Mistral avec mode JSON
        content = await call_mistral_json(
            system_prompt=CONCEPT_MAP_SYSTEM,
            user_prompt=user_prompt,
            model=model,
            max_tokens=2000,
            temperature=0.2
        )
        
        # Parser le JSON
        concept_map = safe_json_parse(content, "CONCEPT_MAP")
        
        # Nettoyer le code Mermaid
        mermaid = concept_map.get("mermaid_code", "")
        if mermaid:
            mermaid = mermaid.replace("\\n", "\n")
            if not mermaid.strip().startswith("mindmap"):
                mermaid = "mindmap\n" + mermaid
            concept_map["mermaid_code"] = mermaid
        
        # Ajouter métadonnées
        concept_map["generated_at"] = datetime.utcnow().isoformat()
        concept_map["source_video"] = title
        concept_map["lang"] = lang
        
        log(f"✅ Mindmap générée: {concept_map.get('total_concepts', 0)} concepts")
        
        return concept_map
        
    except Exception as e:
        log(f"❌ ERREUR generate_concept_map: {type(e).__name__}: {e}")
        raise


async def generate_study_materials(
    title: str,
    channel: str,
    summary: str,
    transcript: str = "",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    include_card: bool = True,
    include_map: bool = True
) -> Dict[str, Any]:
    """
    Génère tous les outils d'étude en une fois.
    """
    log(f"📚 Génération complète pour: {title[:40]}...")
    
    result = {
        "generated_at": datetime.utcnow().isoformat(),
        "source": {"title": title, "channel": channel},
        "lang": lang
    }
    
    if include_card:
        try:
            result["study_card"] = await generate_study_card(
                title=title,
                channel=channel,
                summary=summary,
                transcript=transcript,
                lang=lang,
                model=model
            )
        except Exception as e:
            log(f"⚠️ Erreur fiche: {e}")
            result["study_card_error"] = str(e)
    
    if include_map:
        try:
            result["concept_map"] = await generate_concept_map(
                title=title,
                channel=channel,
                summary=summary,
                lang=lang,
                model=model
            )
        except Exception as e:
            log(f"⚠️ Erreur mindmap: {e}")
            result["concept_map_error"] = str(e)
    
    return result
