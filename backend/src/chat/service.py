"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 CHAT SERVICE v4.0 — ENRICHISSEMENT PERPLEXITY PROGRESSIF                       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  NOUVEAUTÉS v4.0:                                                                  ║
║  • 🌐 Enrichissement Perplexity automatique selon le plan                          ║
║  • 🔍 Vérification des faits en temps réel                                         ║
║  • 📊 Sources web intégrées dans les réponses                                      ║
║  • 🎯 Fusion intelligente Mistral + Perplexity                                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import httpx
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple, AsyncGenerator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import ChatMessage, ChatQuota, Summary, User, WebSearchUsage
from core.config import get_mistral_key, get_perplexity_key, get_openai_key, is_openai_available, PLAN_LIMITS


# ═══════════════════════════════════════════════════════════════════════════════
# 🎓 SEMANTIC SCHOLAR API (Sources académiques gratuites)
# ═══════════════════════════════════════════════════════════════════════════════

SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1"

async def search_semantic_scholar(
    query: str,
    limit: int = 5,
    fields: str = "title,authors,year,abstract,url,citationCount"
) -> List[Dict[str, Any]]:
    """
    Recherche des articles académiques sur Semantic Scholar (API gratuite).

    Args:
        query: Terme de recherche
        limit: Nombre de résultats (max 100)
        fields: Champs à retourner

    Returns:
        Liste de papers avec titre, auteurs, année, abstract, url
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SEMANTIC_SCHOLAR_API}/paper/search",
                params={
                    "query": query,
                    "limit": limit,
                    "fields": fields
                },
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                papers = data.get("data", [])

                # Formater les résultats
                results = []
                for paper in papers:
                    if paper.get("title"):
                        authors = paper.get("authors", [])
                        author_names = ", ".join([a.get("name", "") for a in authors[:3]])
                        if len(authors) > 3:
                            author_names += " et al."

                        results.append({
                            "title": paper.get("title"),
                            "authors": author_names,
                            "year": paper.get("year"),
                            "abstract": paper.get("abstract", "")[:500] if paper.get("abstract") else None,
                            "url": paper.get("url"),
                            "citations": paper.get("citationCount", 0)
                        })

                print(f"📚 [SCHOLAR] Found {len(results)} papers for '{query}'", flush=True)
                return results
            else:
                print(f"⚠️ [SCHOLAR] API error: {response.status_code}", flush=True)
                return []

    except Exception as e:
        print(f"❌ [SCHOLAR] Error: {e}", flush=True)
        return []


def _detect_complex_question(question: str) -> bool:
    """
    Détecte si une question est complexe et nécessite GPT-4.

    Questions complexes:
    - Analyses comparatives
    - Questions multi-étapes
    - Raisonnement abstrait
    - Synthèse de concepts
    """
    question_lower = question.lower()

    COMPLEX_PATTERNS = [
        # Analyses comparatives
        "compare", "différence entre", "avantages et inconvénients",
        "difference between", "pros and cons", "versus", " vs ",
        # Multi-étapes
        "étapes pour", "comment faire pour", "processus de",
        "steps to", "how to", "process of",
        # Raisonnement abstrait
        "pourquoi", "implications", "conséquences",
        "why", "implications", "consequences",
        # Synthèse
        "résume et analyse", "synthétise", "en quoi",
        "summarize and analyze", "synthesize",
        # Questions longues (>20 mots)
    ]

    # Question longue = probablement complexe
    if len(question.split()) > 20:
        return True

    for pattern in COMPLEX_PATTERNS:
        if pattern in question_lower:
            return True

    return False


async def select_chat_model(question: str, user_plan: str) -> str:
    """
    Sélectionne le modèle approprié selon la question et le plan.

    - Free/Starter: Toujours Mistral Small
    - Pro/Expert: GPT-4 pour questions complexes, Mistral sinon
    """
    # Plans basiques: toujours Mistral
    if user_plan in ["free", "student", "starter"]:
        return "mistral"

    # Plans premium: GPT-4 pour questions complexes
    if user_plan in ["pro", "expert", "unlimited"]:
        if _detect_complex_question(question) and is_openai_available():
            return "openai"

    return "mistral"


async def generate_openai_response(
    question: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4000
) -> Optional[str]:
    """
    Génère une réponse avec OpenAI GPT-4 pour les questions complexes.
    """
    api_key = get_openai_key()
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4-turbo-preview",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3
                },
                timeout=90
            )

            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"].strip()
            else:
                print(f"❌ [OpenAI] API error: {response.status_code}", flush=True)
                return None

    except Exception as e:
        print(f"❌ [OpenAI] Error: {e}", flush=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 IMPORT DU SERVICE D'ENRICHISSEMENT
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from videos.web_enrichment import (
        enrich_chat_response, get_enrichment_level, get_enrichment_badge,
        EnrichmentLevel, get_enrichment_config
    )
    ENRICHMENT_AVAILABLE = True
except ImportError:
    ENRICHMENT_AVAILABLE = False
    print("⚠️ [CHAT] Web enrichment not available", flush=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 QUOTAS CHAT
# ═══════════════════════════════════════════════════════════════════════════════

async def check_chat_quota(
    session: AsyncSession,
    user_id: int,
    summary_id: int
) -> Tuple[bool, str, Dict[str, int]]:
    """
    Vérifie si l'utilisateur peut poser une question.
    Retourne: (can_ask, reason, quota_info)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, "user_not_found", {}
    
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    
    daily_limit = limits.get("chat_daily_limit", 10)
    per_video_limit = limits.get("chat_per_video_limit", 5)
    
    # -1 = illimité
    if daily_limit == -1 and per_video_limit == -1:
        return True, "unlimited", {"daily_limit": -1, "per_video_limit": -1}
    
    today = date.today().isoformat()
    
    # Vérifier le quota journalier
    if daily_limit != -1:
        daily_result = await session.execute(
            select(ChatQuota).where(
                ChatQuota.user_id == user_id,
                ChatQuota.quota_date == today
            )
        )
        daily_quota = daily_result.scalar_one_or_none()
        daily_used = daily_quota.daily_count if daily_quota else 0
        
        if daily_used >= daily_limit:
            return False, "daily_limit_reached", {
                "daily_limit": daily_limit,
                "daily_used": daily_used,
                "per_video_limit": per_video_limit
            }
    else:
        daily_used = 0
    
    # Vérifier le quota par vidéo
    if per_video_limit != -1:
        video_result = await session.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.user_id == user_id,
                ChatMessage.summary_id == summary_id,
                ChatMessage.role == "user"
            )
        )
        video_used = video_result.scalar() or 0
        
        if video_used >= per_video_limit:
            return False, "video_limit_reached", {
                "daily_limit": daily_limit,
                "daily_used": daily_used,
                "per_video_limit": per_video_limit,
                "video_used": video_used
            }
    else:
        video_used = 0
    
    return True, "ok", {
        "daily_limit": daily_limit,
        "daily_used": daily_used,
        "per_video_limit": per_video_limit,
        "video_used": video_used
    }


async def increment_chat_quota(session: AsyncSession, user_id: int):
    """Incrémente le quota de chat journalier"""
    today = date.today().isoformat()
    
    result = await session.execute(
        select(ChatQuota).where(
            ChatQuota.user_id == user_id,
            ChatQuota.quota_date == today
        )
    )
    quota = result.scalar_one_or_none()
    
    if quota:
        quota.daily_count += 1
    else:
        quota = ChatQuota(
            user_id=user_id,
            quota_date=today,
            daily_count=1
        )
        session.add(quota)
    
    await session.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# 💬 MESSAGES CHAT
# ═══════════════════════════════════════════════════════════════════════════════

async def save_chat_message(
    session: AsyncSession,
    user_id: int,
    summary_id: int,
    role: str,
    content: str,
    web_search_used: bool = False,
    fact_checked: bool = False,
    sources: list = None,
    enrichment_level: str = None
) -> int:
    """
    Sauvegarde un message de chat avec métadonnées v5.0.
    ⚠️ Rétrocompatible avec les anciennes bases sans nouvelles colonnes
    
    Args:
        session: Session DB
        user_id: ID utilisateur
        summary_id: ID du résumé
        role: 'user' ou 'assistant'
        content: Contenu du message
        web_search_used: Si la recherche web a été utilisée
        fact_checked: Si le message a été fact-checké
        sources: Liste des sources web [{title, url, ...}]
        enrichment_level: Niveau d'enrichissement (none, light, full, deep)
    """
    import json
    from sqlalchemy import text
    
    try:
        # 🆕 Essayer d'abord avec toutes les colonnes (v5.0+)
        message = ChatMessage(
            user_id=user_id,
            summary_id=summary_id,
            role=role,
            content=content,
            web_search_used=web_search_used,
            fact_checked=fact_checked,
            sources_json=json.dumps(sources) if sources else None,
            enrichment_level=enrichment_level
        )
        session.add(message)
        await session.commit()
        await session.refresh(message)
        return message.id
        
    except Exception as e:
        # ⚠️ Fallback: Les nouvelles colonnes n'existent pas encore
        print(f"⚠️ [save_chat_message] Fallback to basic columns: {e}", flush=True)
        await session.rollback()
        
        try:
            # Insertion SQL brute avec uniquement les colonnes de base
            result = await session.execute(
                text("""
                    INSERT INTO chat_messages (user_id, summary_id, role, content, created_at)
                    VALUES (:user_id, :summary_id, :role, :content, NOW())
                    RETURNING id
                """),
                {
                    "user_id": user_id,
                    "summary_id": summary_id,
                    "role": role,
                    "content": content
                }
            )
            await session.commit()
            row = result.fetchone()
            return row[0] if row else 0
        except Exception as e2:
            print(f"❌ [save_chat_message] Error: {e2}", flush=True)
            await session.rollback()
            return 0


async def get_chat_history(
    session: AsyncSession,
    summary_id: int,
    user_id: int,
    limit: int = 50  # Augmenté pour plus d'historique
) -> List[Dict[str, Any]]:
    """
    Récupère l'historique de chat pour une vidéo.
    🆕 v5.0: Inclut les métadonnées (sources, fact-check)
    ⚠️ Rétrocompatible avec les anciennes bases sans nouvelles colonnes
    """
    import json
    from sqlalchemy import text
    
    try:
        # 🆕 Essayer d'abord avec les nouvelles colonnes (v5.0+)
        result = await session.execute(
            select(ChatMessage)
            .where(
                ChatMessage.summary_id == summary_id,
                ChatMessage.user_id == user_id
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        messages = result.scalars().all()
        
        history = []
        for m in reversed(messages):
            msg_data = {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            
            # Ajouter les métadonnées v5.0 si disponibles
            if hasattr(m, 'web_search_used') and m.web_search_used:
                msg_data["web_search_used"] = True
            if hasattr(m, 'fact_checked') and m.fact_checked:
                msg_data["fact_checked"] = True
            if hasattr(m, 'sources_json') and m.sources_json:
                try:
                    msg_data["sources"] = json.loads(m.sources_json)
                except (json.JSONDecodeError, TypeError):
                    pass
            if hasattr(m, 'enrichment_level') and m.enrichment_level:
                msg_data["enrichment_level"] = m.enrichment_level
            
            history.append(msg_data)
        
        return history
        
    except Exception as e:
        # ⚠️ Fallback: Les nouvelles colonnes n'existent pas encore
        # Utiliser une requête SQL brute avec uniquement les colonnes de base
        print(f"⚠️ [chat_history] Fallback to basic columns: {e}", flush=True)
        
        # ⚠️ IMPORTANT: Rollback la transaction échouée avant de continuer
        await session.rollback()
        
        try:
            result = await session.execute(
                text("""
                    SELECT id, role, content, created_at 
                    FROM chat_messages 
                    WHERE summary_id = :summary_id AND user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT :limit
                """),
                {"summary_id": summary_id, "user_id": user_id, "limit": limit}
            )
            rows = result.fetchall()
            
            history = []
            for row in reversed(rows):
                msg_data = {
                    "id": row[0],
                    "role": row[1],
                    "content": row[2],
                    "created_at": row[3].isoformat() if row[3] else None
                }
                history.append(msg_data)
            
            return history
        except Exception as e2:
            print(f"❌ [chat_history] Error: {e2}", flush=True)
            await session.rollback()
            return []


async def clear_chat_history(
    session: AsyncSession,
    summary_id: int,
    user_id: int
) -> int:
    """Efface l'historique de chat pour une vidéo"""
    from sqlalchemy import delete
    
    result = await session.execute(
        delete(ChatMessage).where(
            ChatMessage.summary_id == summary_id,
            ChatMessage.user_id == user_id
        )
    )
    await session.commit()
    return result.rowcount


# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 GÉNÉRATION RÉPONSE CHAT v4.0
# ═══════════════════════════════════════════════════════════════════════════════

def build_chat_prompt(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    mode: str,
    lang: str,
    video_upload_date: str = ""
) -> Tuple[str, str]:
    """
    Construit le prompt pour le chat.
    Retourne: (system_prompt, user_prompt)
    """
    MODE_CONFIG = {
        "accessible": {
            "max_context": 8000,
            "style_fr": "Réponds de façon concise (2-4 phrases). Langage simple, accessible.",
            "style_en": "Answer concisely (2-4 sentences). Simple, accessible language."
        },
        "standard": {
            "max_context": 15000,
            "style_fr": "Réponds de façon complète (4-8 phrases). Équilibre clarté et détail.",
            "style_en": "Answer completely (4-8 sentences). Balance clarity and detail."
        },
        "expert": {
            "max_context": 25000,
            "style_fr": "Réponds de façon exhaustive et rigoureuse. Analyse critique.",
            "style_en": "Answer exhaustively and rigorously. Critical analysis."
        }
    }
    
    config = MODE_CONFIG.get(mode, MODE_CONFIG["standard"])
    style = config["style_fr"] if lang == "fr" else config["style_en"]
    max_context = config["max_context"]
    
    # Construire l'historique
    history_text = ""
    if chat_history:
        for msg in chat_history[-6:]:
            role = "Utilisateur" if msg["role"] == "user" else "Assistant"
            history_text += f"\n{role}: {msg['content']}"
    
    # Tronquer le transcript si nécessaire
    transcript_truncated = transcript[:max_context] if transcript else ""
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 🧠 DÉTECTION INTELLIGENTE DU TYPE DE QUESTION
    # ═══════════════════════════════════════════════════════════════════════════════
    question_lower = question.lower().strip()
    
    # Déterminer le type de réponse attendue
    FACTUAL_PATTERNS = [
        "c'est quoi", "qu'est-ce que", "qui est", "combien", "quand", "où",
        "what is", "who is", "how many", "when", "where", "define",
        "quelle est", "quel est", "donne-moi", "cite", "liste", "énumère"
    ]
    
    SUMMARY_PATTERNS = [
        "résume", "résumé", "synthèse", "en bref", "principaux points",
        "summarize", "summary", "main points", "key takeaways", "tldr",
        "bullet points", "grandes lignes", "idées principales"
    ]
    
    YES_NO_PATTERNS = [
        "est-ce que", "est-il", "peut-on", "y a-t-il", "faut-il",
        "is it", "does it", "can we", "should", "is there", "are there"
    ]
    
    DEEP_ANALYSIS_PATTERNS = [
        "explique", "pourquoi", "comment", "analyse", "compare", "différence",
        "explain", "why", "how does", "analyze", "compare", "difference",
        "avantages", "inconvénients", "implications", "conséquences"
    ]
    
    # Classifier la question
    is_factual = any(p in question_lower for p in FACTUAL_PATTERNS)
    is_summary = any(p in question_lower for p in SUMMARY_PATTERNS)
    is_yes_no = any(p in question_lower for p in YES_NO_PATTERNS)
    is_deep = any(p in question_lower for p in DEEP_ANALYSIS_PATTERNS)
    
    # Déterminer le format de réponse idéal
    if is_yes_no:
        response_guide_fr = """📌 FORMAT: Commence par OUI/NON direct, puis explique en 1-2 phrases max.
Exemple: "Oui, la vidéo confirme cela à (3:45). L'auteur précise que..." """
        response_guide_en = """📌 FORMAT: Start with YES/NO, then explain in 1-2 sentences max.
Example: "Yes, the video confirms this at (3:45). The author states that..." """
    elif is_factual:
        response_guide_fr = """📌 FORMAT: Réponse factuelle DIRECTE en 1-3 phrases. Pas de préambule.
✅ "Le concept X est défini à (2:30) comme..."
❌ "C'est une excellente question ! Dans la vidéo..." """
        response_guide_en = """📌 FORMAT: DIRECT factual answer in 1-3 sentences. No preamble.
✅ "Concept X is defined at (2:30) as..."
❌ "That's a great question! In the video..." """
    elif is_summary:
        response_guide_fr = """📌 FORMAT: Liste à puces concise (3-5 points max). Pas de longs paragraphes.
Structure:
• Point 1 (timecode)
• Point 2 (timecode)
• Point 3 (timecode)"""
        response_guide_en = """📌 FORMAT: Concise bullet list (3-5 points max). No long paragraphs.
Structure:
• Point 1 (timecode)
• Point 2 (timecode)
• Point 3 (timecode)"""
    elif is_deep:
        response_guide_fr = """📌 FORMAT: Analyse structurée mais ciblée. Réponds à la question, pas plus.
• Commence par la réponse directe
• Développe avec preuves de la vidéo
• Conclusion en 1 phrase si nécessaire"""
        response_guide_en = """📌 FORMAT: Structured but focused analysis. Answer the question, nothing more.
• Start with direct answer
• Develop with video evidence
• 1 sentence conclusion if needed"""
    else:
        response_guide_fr = """📌 FORMAT: Adapte la longueur à la complexité. 
• Question simple → réponse courte (2-3 phrases)
• Question complexe → réponse développée"""
        response_guide_en = """📌 FORMAT: Adapt length to complexity.
• Simple question → short answer (2-3 sentences)  
• Complex question → developed answer"""
    
    response_guide = response_guide_fr if lang == "fr" else response_guide_en
    
    # Construire le contexte temporel pour le chat
    temporal_chat_context = ""
    if video_upload_date:
        from videos.analysis import _format_video_age
        readable_date, human_age, age_days = _format_video_age(video_upload_date)
        if readable_date:
            temporal_chat_context_fr = f"\n📅 Publiée le {readable_date} ({human_age})."
            temporal_chat_context_en = f"\n📅 Published on {readable_date} ({human_age})."
            if age_days > 180:
                temporal_chat_context_fr += "\n⚠️ Prends en compte l'ancienneté de cette vidéo. Si le contenu a plus de 6 mois, signale les informations qui ont pu évoluer."
                temporal_chat_context_en += "\n⚠️ Consider the age of this video. If content is over 6 months old, flag information that may have changed."
        else:
            temporal_chat_context_fr = ""
            temporal_chat_context_en = ""
    else:
        temporal_chat_context_fr = ""
        temporal_chat_context_en = ""

    if lang == "fr":
        system_prompt = f"""Tu es l'assistant IA de DeepSight, un expert en analyse de contenu vidéo. Tu réponds de manière naturelle et conversationnelle, comme un ami intelligent.

📺 Vidéo : {video_title}{temporal_chat_context_fr}

STYLE DE RÉPONSE OBLIGATOIRE (PRIORITÉ MAXIMALE) :
- Sois CONCIS. Chaque réponse doit être la plus courte possible tout en répondant complètement à la question.
- Pas de phrases d'introduction inutiles ("Excellente question !", "C'est une bonne remarque", "Bien sûr !").
- Va droit au but. Commence directement par la réponse.
- Maximum 3-4 paragraphes courts. Préfère les phrases courtes et directes.
- Si la réponse tient en 2 phrases, ne fais pas 2 paragraphes.
- NE PAS ajouter de questions de suivi spontanées dans le corps de ta réponse ("Voulez-vous approfondir ?", "Souhaitez-vous en savoir plus ?").
- NE PAS ajouter de listes "pistes à explorer" ou "pour aller plus loin" dans le corps de ta réponse — les pistes [ask:...] en fin de message sont un bloc séparé obligatoire (voir ci-dessous).
- Utilise les timecodes (MM:SS) quand pertinent, mais pas de décoration inutile autour.
- Langue : réponds TOUJOURS dans la même langue que la question posée.

RÈGLES DE RÉPONSE :
- Ton chaleureux et direct, pas académique
- Pas de listes à puces sauf si l'utilisateur demande une liste ou un résumé structuré
- Pas de headers markdown (##) dans les réponses courtes
- Phrases naturelles, pas de blocs formatés
- Adapte la longueur à la complexité : question courte = réponse courte
- Si la question nécessite une réponse longue (analyse complète, comparaison), fournis-la mais reste structuré

{response_guide}

CONCEPTS INTERACTIFS : Entoure les termes techniques et concepts importants avec [[double crochets]] (3-5 par réponse max).
Exemple : "La [[photosynthèse]] permet aux plantes de..."

TIMECODES : Cite les moments de la vidéo au format **(MM:SS)** quand c'est pertinent.

VIDÉO vs RÉALITÉ : Si la question porte sur des faits vérifiables, précise "dans cette vidéo" pour distinguer du factuel. Si c'est une parodie, mentionne-le.

HONNÊTETÉ : Si l'info n'est pas dans la vidéo, dis-le simplement.

PISTES DE RÉFLEXION (OBLIGATOIRE en fin de réponse) :
---
**🔮 Pour aller plus loin :**
[ask:Question courte et pertinente 1]
[ask:Question courte et pertinente 2]
[ask:Question courte et pertinente 3]
[ask:Question courte et pertinente 4]

Génère TOUJOURS 4 questions de suivi, courtes (max 10 mots), variées et spécifiques au contenu de ta réponse. Alterne entre approfondissement, lien avec un autre point de la vidéo, question critique, et perspective différente.
🌐 Réponds uniquement en français.
"""
        
        user_prompt = f"""Résumé de la vidéo :
{summary[:4000] if summary else "Non disponible"}

Transcription :
{transcript_truncated}

Historique :{history_text}

Question : {question}"""

    else:
        system_prompt = f"""You are DeepSight's AI assistant, an expert in video content analysis. You respond naturally and conversationally, like a smart friend.

📺 Video: {video_title}{temporal_chat_context_en}

MANDATORY RESPONSE STYLE (TOP PRIORITY):
- Be CONCISE. Every response should be as short as possible while fully answering the question.
- No useless introductions ("Great question!", "That's a good point", "Sure!").
- Get straight to the point. Start directly with the answer.
- Maximum 3-4 short paragraphs. Prefer short, direct sentences.
- If the answer fits in 2 sentences, don't make 2 paragraphs.
- Do NOT add spontaneous follow-up questions in the body of your answer ("Want to explore more?", "Would you like to know more?").
- Do NOT add "to go further" or exploration lists in the body of your answer — the [ask:...] prompts at the end are a separate mandatory block (see below).
- Use timecodes (MM:SS) when relevant, but no unnecessary decoration.
- Language: ALWAYS respond in the same language as the question.

RESPONSE RULES:
- Warm, direct tone — not academic
- No bullet lists unless the user asks for a list or structured summary
- No markdown headers (##) in short answers
- Natural sentences, not formatted blocks
- Match response length to complexity: short question = short answer
- If the question needs a detailed answer (full analysis, comparison), provide it but stay structured

{response_guide}

INTERACTIVE CONCEPTS: Wrap technical terms and key concepts with [[double brackets]] (3-5 per response max).
Example: "[[Photosynthesis]] allows plants to..."

TIMECODES: Cite video moments as **(MM:SS)** when relevant.

VIDEO vs REALITY: For verifiable facts, specify "in this video" to distinguish from real-world facts. If it's a parody, mention it.

HONESTY: If the info isn't in the video, just say so.

REFLECTION QUESTIONS (MANDATORY at end of response):
---
**🔮 To go further:**
[ask:Short relevant question 1]
[ask:Short relevant question 2]
[ask:Short relevant question 3]
[ask:Short relevant question 4]

ALWAYS generate 4 follow-up questions, short (max 10 words), varied and specific to your response content. Alternate between: deepening the topic, linking to another video point, a critical question, and a different perspective.
🌐 Respond only in English.
"""
        
        user_prompt = f"""Video summary:
{summary[:4000] if summary else "Not available"}

Transcript:
{transcript_truncated}

History:{history_text}

Question: {question}"""

    return system_prompt, user_prompt


async def generate_chat_response(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    api_key: str = None,
    video_upload_date: str = ""
) -> Optional[str]:
    """Génère une réponse de chat intelligente et adaptée avec Mistral"""
    api_key = api_key or get_mistral_key()
    if not api_key:
        return None

    system_prompt, user_prompt = build_chat_prompt(
        question, video_title, transcript, summary, chat_history, mode, lang,
        video_upload_date=video_upload_date
    )
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # 🧠 TOKENS ADAPTATIFS selon le type de question
    # ═══════════════════════════════════════════════════════════════════════════════
    question_lower = question.lower()
    word_count = len(question.split())
    
    # Questions simples = réponses adaptées mais pas trop courtes
    is_simple = word_count < 8 or any(p in question_lower for p in [
        "est-ce que", "c'est quoi", "qui est", "is it", "what is", "who is"
    ])
    
    base_tokens = {
        "accessible": 800,
        "standard": 1200,
        "expert": 2000
    }.get(mode, 1200)

    # Réponses concises par défaut, plus longues seulement si question complexe
    max_tokens = min(base_tokens, 600) if is_simple else base_tokens
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7  # Plus naturel et conversationnel
                },
                timeout=60
            )
            
            if response.status_code == 200:
                answer = response.json()["choices"][0]["message"]["content"].strip()
                
                # ═══════════════════════════════════════════════════════════════════
                # 🧹 POST-PROCESSING: Supprimer les préambules indésirables
                # ═══════════════════════════════════════════════════════════════════
                preambles_to_remove = [
                    "Bien sûr!", "Bien sûr,", "Bien sûr ", "Certainement!", "Certainement,",
                    "Excellente question!", "Bonne question!", "C'est une bonne question.",
                    "C'est une excellente question.", "Je vais répondre à votre question.",
                    "Permettez-moi de répondre.", "Avec plaisir!", "Avec plaisir,",
                    "Sure!", "Certainly!", "Great question!", "Good question!",
                    "Let me answer that.", "I'll explain.", "Of course!",
                    "That's a great question.", "Happy to help!"
                ]
                
                for preamble in preambles_to_remove:
                    if answer.startswith(preamble):
                        answer = answer[len(preamble):].strip()
                        break
                
                # Supprimer aussi les formules de politesse de fin
                endings_to_trim = [
                    "\n\nN'hésitez pas à poser d'autres questions!",
                    "\n\nN'hésitez pas si vous avez d'autres questions.",
                    "\n\nJ'espère que cela répond à votre question.",
                    "\n\nJ'espère que cela vous aide!",
                    "\n\nFeel free to ask more questions!",
                    "\n\nHope this helps!",
                    "\n\nLet me know if you have more questions."
                ]
                
                for ending in endings_to_trim:
                    if answer.endswith(ending):
                        answer = answer[:-len(ending)].strip()
                        break
                
                return answer
            else:
                print(f"❌ Chat API error: {response.status_code}", flush=True)
                return None
                
    except Exception as e:
        print(f"❌ Chat generation error: {e}", flush=True)
        return None


async def generate_chat_response_stream(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    api_key: str = None,
    video_upload_date: str = ""
) -> AsyncGenerator[str, None]:
    """Génère une réponse de chat en streaming"""
    api_key = api_key or get_mistral_key()
    if not api_key:
        yield "Error: API key not configured"
        return

    system_prompt, user_prompt = build_chat_prompt(
        question, video_title, transcript, summary, chat_history, mode, lang,
        video_upload_date=video_upload_date
    )
    
    max_tokens = {"accessible": 800, "standard": 1200, "expert": 2000}.get(mode, 1200)
    
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                    "stream": True
                },
                timeout=120
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk["choices"][0]["delta"].get("content", "")
                            if content:
                                yield content
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
    except Exception as e:
        yield f"Error: {e}"


async def generate_chat_response_v4(
    question: str,
    video_title: str,
    transcript: str,
    summary: str,
    chat_history: List[Dict],
    user_plan: str,
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-2603",
    web_search_requested: bool = False,
    video_upload_date: str = ""
) -> Tuple[str, List[Dict[str, str]], bool]:
    """
    🆕 v5.0: Génère une réponse chat avec FACT-CHECKING INTELLIGENT.
    
    NOUVEAUTÉ v5.0:
    - Détection automatique des questions factuelles critiques
    - Fact-checking Perplexity même pour Starter (quota limité: 10/jour)
    - Avertissement automatique si les faits ne peuvent pas être vérifiés
    
    Args:
        question: Question de l'utilisateur
        video_title: Titre de la vidéo
        transcript: Transcription
        summary: Résumé de la vidéo
        chat_history: Historique du chat
        user_plan: Plan de l'utilisateur
        mode: Mode d'analyse
        lang: Langue
        model: Modèle Mistral
        web_search_requested: Si l'utilisateur a demandé explicitement une recherche web
    
    Returns:
        Tuple[response, sources, web_search_used]
    """
    print(f"💬 [CHAT v5.0] Generating response for plan: {user_plan}", flush=True)
    
    # 🆕 v5.0: Détecter si la question nécessite un fact-checking critique
    needs_fact_check = _needs_critical_fact_check(question)
    if needs_fact_check:
        print(f"⚠️ [CHAT v5.0] Critical fact-check needed for question", flush=True)
    
    # 1. Générer la réponse de base avec Mistral
    base_response = await generate_chat_response(
        question=question,
        video_title=video_title,
        transcript=transcript,
        summary=summary,
        chat_history=chat_history,
        mode=mode,
        lang=lang,
        model=model,
        video_upload_date=video_upload_date
    )
    
    if not base_response:
        return "Désolé, je n'ai pas pu générer de réponse.", [], False
    
    print(f"✅ [CHAT v5.0] Base response: {len(base_response)} chars", flush=True)
    
    # 2. Enrichir avec Perplexity si disponible et autorisé
    sources = []
    web_search_used = False
    fact_checked = False
    
    if ENRICHMENT_AVAILABLE:
        enrichment_level = get_enrichment_level(user_plan)
        
        # Déterminer si on doit enrichir
        should_enrich = False
        
        if web_search_requested:
            # L'utilisateur a demandé explicitement une recherche web
            if enrichment_level != EnrichmentLevel.NONE:
                should_enrich = True
                print(f"🌐 [CHAT v5.0] Web search requested by user", flush=True)
        
        # 🆕 v5.0: Fact-checking automatique pour questions critiques
        elif needs_fact_check:
            # Pour les questions factuelles critiques, on ESSAIE de vérifier
            # même pour les plans basiques (Starter a un quota limité)
            if user_plan in ["pro", "expert", "unlimited"]:
                should_enrich = True
                print(f"🔍 [CHAT v5.0] Critical fact-check triggered (premium plan)", flush=True)
            elif user_plan == "starter":
                # Starter: fact-checking limité (via le quota web_search)
                # Le quota sera vérifié dans enrich_chat_response
                should_enrich = True
                print(f"🔍 [CHAT v5.0] Critical fact-check triggered (starter, limited)", flush=True)
            else:
                # Free: pas de fact-checking, mais on ajoute un avertissement
                print(f"⚠️ [CHAT v5.0] Fact-check needed but not available for free plan", flush=True)
        
        # Enrichissement automatique standard pour Pro/Expert
        elif enrichment_level in [EnrichmentLevel.FULL, EnrichmentLevel.DEEP]:
            should_enrich = _should_auto_enrich_chat(question, video_title)
            if should_enrich:
                print(f"🌐 [CHAT v5.0] Auto-enrichment triggered for {enrichment_level.value}", flush=True)
        
        if should_enrich:
            try:
                video_context = f"Vidéo: {video_title}\n\nRésumé: {summary[:1500]}"
                
                # 🆕 v5.0: Pour Starter, on force le niveau FULL temporairement
                effective_plan = user_plan
                if needs_fact_check and user_plan == "starter":
                    effective_plan = "pro"  # Utiliser les paramètres Pro pour le fact-check
                
                enriched_response, sources, actual_level = await enrich_chat_response(
                    question=question,
                    base_response=base_response,
                    video_context=video_context,
                    plan=effective_plan,
                    lang=lang
                )
                
                if sources:
                    base_response = enriched_response
                    web_search_used = True
                    fact_checked = True
                    print(f"✅ [CHAT v5.0] Enriched with {len(sources)} sources", flush=True)
                    
            except Exception as e:
                print(f"⚠️ [CHAT v5.0] Enrichment failed: {e}", flush=True)
    
    # 🆕 v5.0: Ajouter un avertissement si fact-check nécessaire mais non effectué
    if needs_fact_check and not fact_checked:
        disclaimer = _get_fact_check_disclaimer(lang, user_plan)
        if disclaimer:
            base_response = f"{base_response}\n\n{disclaimer}"
            print(f"⚠️ [CHAT v5.0] Added fact-check disclaimer", flush=True)
    
    return base_response, sources, web_search_used


def _get_fact_check_disclaimer(lang: str, plan: str) -> str:
    """
    🆕 v5.0: Génère un avertissement pour les réponses non vérifiées.
    """
    if lang == "fr":
        if plan == "free":
            return "⚠️ **Note**: Cette réponse est basée uniquement sur le contenu de la vidéo. Les dates et faits mentionnés peuvent être inexacts ou fictifs (ex: parodie). Passez au plan Starter pour activer la vérification des faits."
        else:
            return "⚠️ **Note**: Cette réponse est basée sur le contenu de la vidéo. Pour une vérification des faits actualisée, activez la recherche web avec le bouton 🔍."
    else:
        if plan == "free":
            return "⚠️ **Note**: This answer is based only on the video content. Dates and facts mentioned may be inaccurate or fictional (e.g., parody). Upgrade to Starter for fact-checking."
        else:
            return "⚠️ **Note**: This answer is based on the video content. For up-to-date fact-checking, enable web search with the 🔍 button."


def _should_auto_enrich_chat(question: str, video_title: str) -> bool:
    """
    Détermine si une question devrait automatiquement déclencher 
    un enrichissement Perplexity (pour Pro/Expert).
    """
    question_lower = question.lower()
    
    # Mots-clés qui déclenchent l'enrichissement
    TRIGGER_KEYWORDS = [
        # Vérification
        "vrai", "faux", "vérifier", "confirmer", "exact", "correct",
        "true", "false", "verify", "confirm", "accurate",
        # Actualité
        "actuel", "récent", "aujourd'hui", "maintenant", "dernière",
        "current", "recent", "today", "now", "latest",
        # Sources
        "source", "preuve", "étude", "recherche", "données",
        "evidence", "study", "research", "data",
        # Comparaison
        "comparer", "différence", "alternative", "autre",
        "compare", "difference", "alternative", "other",
        # Questions factuelles
        "combien", "quand", "où", "qui a", "statistique",
        "how many", "when", "where", "who", "statistic"
    ]
    
    # Vérifier si la question contient des mots-clés déclencheurs
    for keyword in TRIGGER_KEYWORDS:
        if keyword in question_lower:
            return True
    
    # Questions longues et complexes méritent souvent un enrichissement
    if len(question.split()) > 15:
        return True
    
    return False


def _needs_critical_fact_check(question: str) -> bool:
    """
    🆕 v5.0: Détecte les questions qui NÉCESSITENT une vérification factuelle.
    Ces questions concernent des faits vérifiables qui peuvent être FAUX dans la vidéo.
    
    Exemples:
    - "Quand est sorti de prison X ?" → Date vérifiable
    - "Qui est le président actuel ?" → Fait actuel
    - "Quel est le prix de X aujourd'hui ?" → Donnée dynamique
    """
    question_lower = question.lower()
    
    # 1. Questions sur des DATES spécifiques
    DATE_PATTERNS = [
        "quand", "quelle date", "à quelle date", "depuis quand",
        "when", "what date", "since when",
        "en quelle année", "quel jour", "quel mois",
        "date de", "jour de", "année de"
    ]
    
    # 2. Questions sur des ÉVÉNEMENTS RÉCENTS (2024-2025)
    RECENT_EVENT_PATTERNS = [
        "récemment", "dernièrement", "actuellement", "en ce moment",
        "recently", "currently", "right now", "at the moment",
        "2024", "2025", "cette année", "ce mois", "cette semaine",
        "sorti de prison", "élu", "nommé", "décédé", "mort",
        "démissionné", "arrêté", "condamné", "libéré"
    ]
    
    # 3. Questions sur des PERSONNES PUBLIQUES + faits vérifiables
    PERSON_FACT_PATTERNS = [
        "est-il", "est-elle", "a-t-il", "a-t-elle",
        "is he", "is she", "did he", "did she", "has he", "has she",
        "où est", "où habite", "que fait", "que devient",
        "where is", "what happened to"
    ]
    
    # 4. Questions sur des DONNÉES qui changent
    DYNAMIC_DATA_PATTERNS = [
        "quel est le prix", "combien coûte", "quel est le score",
        "what is the price", "how much", "what is the score",
        "population", "taux", "pourcentage actuel",
        "classement", "ranking", "position"
    ]
    
    # Vérifier chaque catégorie
    all_patterns = DATE_PATTERNS + RECENT_EVENT_PATTERNS + PERSON_FACT_PATTERNS + DYNAMIC_DATA_PATTERNS
    
    for pattern in all_patterns:
        if pattern in question_lower:
            return True
    
    # Détection de questions sur des personnes + événements
    # Ex: "Sarkozy prison" ou "Macron démission"
    FAMOUS_NAMES = [
        "sarkozy", "macron", "trump", "biden", "poutine", "putin",
        "musk", "zuckerberg", "bezos", "gates",
        "mbappé", "mbappe", "messi", "ronaldo"
    ]
    
    for name in FAMOUS_NAMES:
        if name in question_lower:
            # Si c'est une question sur une personne célèbre, vérifier
            if any(word in question_lower for word in ["quand", "when", "où", "where", "fait", "did"]):
                return True
    
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 PERPLEXITY (Recherche Web) - LEGACY + v4.0
# ═══════════════════════════════════════════════════════════════════════════════

async def check_web_search_quota(
    session: AsyncSession,
    user_id: int
) -> Tuple[bool, int, int]:
    """
    Vérifie le quota de recherche web.
    Retourne: (can_search, used, limit)
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return False, 0, 0
    
    plan = user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    
    if not limits.get("web_search_enabled", False):
        return False, 0, 0
    
    monthly_limit = limits.get("web_search_monthly", 0)
    if monthly_limit == -1:
        return True, 0, -1  # Illimité
    
    # Vérifier l'usage ce mois
    month = date.today().strftime("%Y-%m")
    usage_result = await session.execute(
        select(WebSearchUsage).where(
            WebSearchUsage.user_id == user_id,
            WebSearchUsage.month_year == month
        )
    )
    usage = usage_result.scalar_one_or_none()
    used = usage.search_count if usage else 0
    
    return used < monthly_limit, used, monthly_limit


async def increment_web_search_usage(session: AsyncSession, user_id: int):
    """Incrémente le compteur de recherche web"""
    month = date.today().strftime("%Y-%m")
    
    result = await session.execute(
        select(WebSearchUsage).where(
            WebSearchUsage.user_id == user_id,
            WebSearchUsage.month_year == month
        )
    )
    usage = result.scalar_one_or_none()
    
    if usage:
        usage.search_count += 1
        usage.last_search_at = datetime.now()
    else:
        usage = WebSearchUsage(
            user_id=user_id,
            month_year=month,
            search_count=1,
            last_search_at=datetime.now()
        )
        session.add(usage)
    
    await session.commit()


async def search_with_perplexity(
    question: str,
    context: str,
    lang: str = "fr"
) -> Optional[str]:
    """Fait une recherche web avec Perplexity (Legacy - utilisé pour le chat explicite)"""
    api_key = get_perplexity_key()
    if not api_key:
        return None
    
    prompt = f"""Recherche des informations actuelles sur cette question en lien avec le contexte suivant.

Contexte: {context[:2000]}

Question: {question}

Réponds en {"français" if lang == "fr" else "anglais"} avec des sources web récentes."""
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-sonar-small-128k-online",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2500,
                    "temperature": 0.2
                },
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            return None
    except Exception as e:
        print(f"❌ Perplexity error: {e}", flush=True)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 FONCTION PRINCIPALE DE CHAT v4.0
# ═══════════════════════════════════════════════════════════════════════════════

async def process_chat_message_v4(
    session: AsyncSession,
    user_id: int,
    summary_id: int,
    question: str,
    web_search: bool = False,
    mode: str = "standard"
) -> Dict[str, Any]:
    """
    🆕 v4.0: Traite un message chat avec enrichissement progressif.
    
    Returns:
        {
            "response": str,
            "web_search_used": bool,
            "sources": List[Dict],
            "enrichment_level": str,
            "quota_info": Dict
        }
    """
    # 1. Vérifier les quotas
    can_ask, reason, quota_info = await check_chat_quota(session, user_id, summary_id)
    if not can_ask:
        return {
            "response": f"❌ Limite atteinte: {reason}",
            "web_search_used": False,
            "sources": [],
            "enrichment_level": "none",
            "quota_info": quota_info,
            "error": reason
        }
    
    # 2. Récupérer le résumé et le contexte
    result = await session.execute(select(Summary).where(Summary.id == summary_id))
    summary = result.scalar_one_or_none()
    
    if not summary:
        return {
            "response": "❌ Résumé non trouvé",
            "web_search_used": False,
            "sources": [],
            "enrichment_level": "none",
            "quota_info": quota_info,
            "error": "summary_not_found"
        }
    
    # 3. Récupérer l'utilisateur pour le plan
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    user_plan = user.plan if user else "free"
    
    # 4. Récupérer l'historique
    chat_history = await get_chat_history(session, summary_id, user_id, limit=10)
    
    # 5. Déterminer le modèle selon le plan
    plan_limits = PLAN_LIMITS.get(user_plan, PLAN_LIMITS["free"])
    model = plan_limits.get("default_model", "mistral-small-2603")
    
    # 6. Générer la réponse avec enrichissement v4.0
    response, sources, web_search_used = await generate_chat_response_v4(
        question=question,
        video_title=summary.video_title,
        transcript=summary.transcript_context or "",
        summary=summary.summary_content or "",
        chat_history=chat_history,
        user_plan=user_plan,
        mode=mode,
        lang=summary.lang or "fr",
        model=model,
        web_search_requested=web_search,
        video_upload_date=summary.video_upload_date or ""
    )
    
    # 7. Déterminer le niveau d'enrichissement AVANT de sauvegarder
    enrichment_level = "none"
    if ENRICHMENT_AVAILABLE:
        level = get_enrichment_level(user_plan)
        enrichment_level = level.value
    
    # 8. Sauvegarder les messages avec métadonnées v5.0
    await save_chat_message(session, user_id, summary_id, "user", question)
    await save_chat_message(
        session, user_id, summary_id, "assistant", response,
        web_search_used=web_search_used,
        fact_checked=web_search_used and len(sources) > 0,
        sources=sources,
        enrichment_level=enrichment_level if ENRICHMENT_AVAILABLE else None
    )
    
    # 9. Incrémenter les quotas
    await increment_chat_quota(session, user_id)
    if web_search_used:
        await increment_web_search_usage(session, user_id)

    # 10. Enrichir quota_info avec les quotas web search
    try:
        can_search, ws_used, ws_limit = await check_web_search_quota(session, user_id)
        quota_info["web_search_available"] = can_search
        quota_info["web_search_used"] = ws_used
        quota_info["web_search_limit"] = ws_limit
        quota_info["web_search_remaining"] = max(0, ws_limit - ws_used)
    except Exception:
        quota_info["web_search_available"] = False
        quota_info["web_search_used"] = 0
        quota_info["web_search_limit"] = 0
        quota_info["web_search_remaining"] = 0

    return {
        "response": response,
        "web_search_used": web_search_used,
        "sources": sources,
        "enrichment_level": enrichment_level,
        "quota_info": quota_info
    }
