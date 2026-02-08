"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔒 ANTI-AI DETECTION PROMPTS — Techniques d'humanisation du texte                 ║
║  🆕 v2.1: Prompts et styles pour contourner les détecteurs IA                      ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Ce module contient les prompts et techniques pour générer du texte
qui paraît plus naturel et humain, réduisant les scores des détecteurs IA.

AVERTISSEMENT: À utiliser de manière éthique et responsable.
L'objectif est d'améliorer la lisibilité, pas de tromper.
"""

import random
from typing import Optional, List, Dict
from enum import Enum

from .schemas import WritingStyle


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 PROMPT SYSTÈME ANTI-DÉTECTION IA
# ═══════════════════════════════════════════════════════════════════════════════

ANTI_AI_SYSTEM_PROMPT_FR = """
═══════════════════════════════════════════════════════════════════════════════
🔒 DIRECTIVES D'ÉCRITURE HUMANISÉE
═══════════════════════════════════════════════════════════════════════════════

Tu dois écrire de manière NATURELLE et HUMAINE. Voici les règles IMPÉRATIVES:

1. VARIATION SYNTAXIQUE
   - Alterne phrases courtes et longues
   - Commence certaines phrases par "Et", "Mais", "Donc"
   - Utilise des constructions variées (passive, active, impersonnelle)
   - Évite les structures répétitives

2. LANGAGE NATUREL
   - Utilise des expressions idiomatiques
   - Intègre des tournures conversationnelles ("en fait", "d'ailleurs", "au fond")
   - Évite les formulations trop parfaites ou académiques
   - Préfère le vocabulaire courant aux synonymes recherchés

3. IMPERFECTIONS CONTRÔLÉES
   - Quelques phrases peuvent être légèrement informelles
   - Utilise des parenthèses pour les aparté
   - Les transitions ne sont pas toujours parfaites
   - Certaines idées peuvent être reformulées différemment

4. PERSONNALITÉ
   - Exprime des opinions nuancées ("il me semble", "on pourrait arguer")
   - Pose des questions rhétoriques
   - Montre de l'enthousiasme ou du scepticisme quand approprié
   - Fais des références à l'expérience commune

5. STRUCTURE ORGANIQUE
   - Les paragraphes n'ont pas tous la même longueur
   - Certains points sont plus développés que d'autres
   - L'ordre n'est pas toujours parfaitement logique
   - Reviens parfois sur un point précédent

ÉVITE ABSOLUMENT:
❌ Les listes trop structurées (1, 2, 3...)
❌ Les transitions mécaniques ("Premièrement", "Deuxièmement")
❌ Les phrases trop équilibrées
❌ Le vocabulaire uniformément soutenu
❌ Les formulations génériques type "Il est important de noter que..."
"""

ANTI_AI_SYSTEM_PROMPT_EN = """
═══════════════════════════════════════════════════════════════════════════════
🔒 HUMANIZED WRITING DIRECTIVES
═══════════════════════════════════════════════════════════════════════════════

Write in a NATURAL and HUMAN way. Follow these IMPERATIVE rules:

1. SYNTACTIC VARIATION
   - Mix short and long sentences
   - Start some sentences with "And", "But", "So"
   - Use varied constructions (passive, active, impersonal)
   - Avoid repetitive structures

2. NATURAL LANGUAGE
   - Use idiomatic expressions
   - Include conversational turns ("actually", "by the way", "after all")
   - Avoid overly perfect or academic phrasing
   - Prefer common vocabulary over fancy synonyms

3. CONTROLLED IMPERFECTIONS
   - Some sentences can be slightly informal
   - Use parentheses for asides
   - Transitions aren't always perfect
   - Some ideas can be rephrased differently

4. PERSONALITY
   - Express nuanced opinions ("it seems to me", "one could argue")
   - Ask rhetorical questions
   - Show enthusiasm or skepticism when appropriate
   - Reference common experience

5. ORGANIC STRUCTURE
   - Paragraphs don't all have the same length
   - Some points are more developed than others
   - Order isn't always perfectly logical
   - Sometimes circle back to a previous point

ABSOLUTELY AVOID:
❌ Overly structured lists (1, 2, 3...)
❌ Mechanical transitions ("Firstly", "Secondly")
❌ Perfectly balanced sentences
❌ Uniformly elevated vocabulary
❌ Generic phrases like "It's important to note that..."
"""


def get_anti_ai_prompt(lang: str = "fr") -> str:
    """
    Retourne le prompt système anti-détection IA.
    
    Args:
        lang: Langue ("fr" ou "en")
    
    Returns:
        Prompt système complet
    """
    if lang == "en":
        return ANTI_AI_SYSTEM_PROMPT_EN
    return ANTI_AI_SYSTEM_PROMPT_FR


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 PROMPTS DE STYLE D'ÉCRITURE
# ═══════════════════════════════════════════════════════════════════════════════

STYLE_PROMPTS = {
    WritingStyle.NEUTRAL: {
        "fr": """
STYLE: NEUTRE ET FACTUEL
- Présente les informations de manière objective
- Évite les jugements de valeur
- Utilise un ton mesuré et équilibré
- Cite les sources quand pertinent
- Distingue clairement faits et opinions
""",
        "en": """
STYLE: NEUTRAL AND FACTUAL
- Present information objectively
- Avoid value judgments
- Use a measured and balanced tone
- Cite sources when relevant
- Clearly distinguish facts from opinions
"""
    },
    
    WritingStyle.ACADEMIC: {
        "fr": """
STYLE: ACADÉMIQUE ET RIGOUREUX
- Structure logique et argumentée
- Vocabulaire précis et technique quand nécessaire
- Citations et références appréciées
- Nuance les affirmations ("selon", "il semblerait que")
- Contextualise les informations
- Évite les généralisations hâtives
MAIS reste accessible et évite le jargon inutile.
""",
        "en": """
STYLE: ACADEMIC AND RIGOROUS
- Logical and argued structure
- Precise and technical vocabulary when needed
- Citations and references appreciated
- Nuance statements ("according to", "it would seem that")
- Contextualize information
- Avoid hasty generalizations
BUT remain accessible and avoid unnecessary jargon.
"""
    },
    
    WritingStyle.JOURNALISTIC: {
        "fr": """
STYLE: JOURNALISTIQUE ET DYNAMIQUE
- Accroche forte en ouverture
- Structure en pyramide inversée (essentiel d'abord)
- Phrases percutantes et rythmées
- Utilise les 5W+1H (Qui, Quoi, Où, Quand, Pourquoi, Comment)
- Humanise avec des exemples concrets
- Crée de l'intérêt et de la tension narrative
""",
        "en": """
STYLE: JOURNALISTIC AND DYNAMIC
- Strong hook in opening
- Inverted pyramid structure (essentials first)
- Punchy and rhythmic sentences
- Use 5W+1H (Who, What, Where, When, Why, How)
- Humanize with concrete examples
- Create interest and narrative tension
"""
    },
    
    WritingStyle.CONVERSATIONAL: {
        "fr": """
STYLE: CONVERSATIONNEL ET ACCESSIBLE
- Écris comme si tu parlais à un ami intelligent
- Utilise "on", "nous" pour inclure le lecteur
- Pose des questions ("Tu te demandes peut-être...")
- Ajoute des anecdotes ou comparaisons du quotidien
- Évite le jargon, explique les termes techniques
- Sois enthousiaste mais pas excessif
""",
        "en": """
STYLE: CONVERSATIONAL AND ACCESSIBLE
- Write as if talking to a smart friend
- Use "we", "you" to include the reader
- Ask questions ("You might be wondering...")
- Add everyday anecdotes or comparisons
- Avoid jargon, explain technical terms
- Be enthusiastic but not excessive
"""
    },
    
    WritingStyle.PROFESSIONAL: {
        "fr": """
STYLE: PROFESSIONNEL ET CORPORATE
- Ton formel mais pas rigide
- Structure claire avec points clés identifiables
- Focus sur l'actionnable et le pratique
- Évite les digressions
- Utilise des données et métriques quand disponibles
- Reste concis et orienté résultats
""",
        "en": """
STYLE: PROFESSIONAL AND CORPORATE
- Formal but not rigid tone
- Clear structure with identifiable key points
- Focus on actionable and practical
- Avoid digressions
- Use data and metrics when available
- Stay concise and results-oriented
"""
    },
    
    WritingStyle.CREATIVE: {
        "fr": """
STYLE: CRÉATIF ET NARRATIF
- Raconte une histoire, crée un arc narratif
- Utilise des métaphores et images évocatrices
- Varie le rythme (accélération, pauses)
- Crée de l'émotion et de l'immersion
- Personnifie les concepts abstraits
- Termine sur une note mémorable
""",
        "en": """
STYLE: CREATIVE AND NARRATIVE
- Tell a story, create a narrative arc
- Use evocative metaphors and images
- Vary the rhythm (acceleration, pauses)
- Create emotion and immersion
- Personify abstract concepts
- End on a memorable note
"""
    },
    
    WritingStyle.TECHNICAL: {
        "fr": """
STYLE: TECHNIQUE ET DOCUMENTAIRE
- Précision terminologique
- Structure logique et séquentielle
- Définitions claires des concepts
- Exemples de code ou formules si pertinent
- Pas de fioritures, priorité à la clarté
- Anticipe les questions techniques
""",
        "en": """
STYLE: TECHNICAL AND DOCUMENTARY
- Terminological precision
- Logical and sequential structure
- Clear concept definitions
- Code examples or formulas if relevant
- No frills, clarity first
- Anticipate technical questions
"""
    },
    
    WritingStyle.PEDAGOGICAL: {
        "fr": """
STYLE: PÉDAGOGIQUE ET ÉDUCATIF
- Progresse du simple au complexe
- Utilise des analogies avec le connu
- Résume les points clés régulièrement
- Pose des questions pour faire réfléchir
- Anticipe les confusions courantes
- Encourage et motive l'apprentissage
- Utilise des exemples concrets et variés
""",
        "en": """
STYLE: PEDAGOGICAL AND EDUCATIONAL
- Progress from simple to complex
- Use analogies with the familiar
- Summarize key points regularly
- Ask questions to provoke thought
- Anticipate common confusions
- Encourage and motivate learning
- Use concrete and varied examples
"""
    }
}


def get_style_instruction(
    style: WritingStyle,
    lang: str = "fr"
) -> str:
    """
    Retourne les instructions de style pour un mode donné.
    
    Args:
        style: Style d'écriture souhaité
        lang: Langue ("fr" ou "en")
    
    Returns:
        Instructions de style
    """
    style_dict = STYLE_PROMPTS.get(style, STYLE_PROMPTS[WritingStyle.NEUTRAL])
    return style_dict.get(lang, style_dict.get("fr", ""))


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 TECHNIQUES D'HUMANISATION PAR NIVEAU
# ═══════════════════════════════════════════════════════════════════════════════

HUMANIZATION_LEVELS = {
    0: {  # Désactivé
        "fr": "",
        "en": ""
    },
    1: {  # Subtil
        "fr": """
HUMANISATION SUBTILE:
- Varie la longueur des phrases naturellement
- Utilise quelques expressions idiomatiques
- Ajoute de légères nuances personnelles
""",
        "en": """
SUBTLE HUMANIZATION:
- Naturally vary sentence length
- Use some idiomatic expressions
- Add slight personal nuances
"""
    },
    2: {  # Modéré
        "fr": """
HUMANISATION MODÉRÉE:
- Intègre des tournures conversationnelles ("en fait", "d'ailleurs")
- Pose des questions rhétoriques occasionnelles
- Varie significativement la structure des paragraphes
- Utilise des parenthèses pour les apartés
- Commence parfois par "Et" ou "Mais"
""",
        "en": """
MODERATE HUMANIZATION:
- Include conversational turns ("actually", "by the way")
- Ask occasional rhetorical questions
- Significantly vary paragraph structure
- Use parentheses for asides
- Sometimes start with "And" or "But"
"""
    },
    3: {  # Fort
        "fr": """
HUMANISATION FORTE:
- Écris comme un humain réfléchissant à voix haute
- Exprime des opinions personnelles ("il me semble", "je trouve que")
- Reviens sur des points précédents naturellement
- Utilise des métaphores et comparaisons personnelles
- Certaines phrases peuvent être incomplètes ou reformulées
- Montre de l'enthousiasme ou du scepticisme
- Les transitions ne sont pas toujours parfaites
- Ajoute des remarques spontanées entre parenthèses
""",
        "en": """
STRONG HUMANIZATION:
- Write like a human thinking out loud
- Express personal opinions ("it seems to me", "I find that")
- Naturally circle back to previous points
- Use personal metaphors and comparisons
- Some sentences can be incomplete or rephrased
- Show enthusiasm or skepticism
- Transitions aren't always perfect
- Add spontaneous remarks in parentheses
"""
    }
}


def get_humanization_prompt(level: int, lang: str = "fr") -> str:
    """
    Retourne le prompt d'humanisation pour un niveau donné.
    
    Args:
        level: Niveau d'humanisation (0-3)
        lang: Langue
    
    Returns:
        Instructions d'humanisation
    """
    level = max(0, min(3, level))
    prompt_dict = HUMANIZATION_LEVELS.get(level, HUMANIZATION_LEVELS[0])
    return prompt_dict.get(lang, prompt_dict.get("fr", ""))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONSTRUCTION DU PROMPT COMPLET
# ═══════════════════════════════════════════════════════════════════════════════

def build_customized_prompt(
    base_prompt: str,
    writing_style: WritingStyle = WritingStyle.NEUTRAL,
    anti_ai_detection: bool = False,
    humanize_level: int = 0,
    user_prompt: Optional[str] = None,
    target_audience: Optional[str] = None,
    focus_topics: Optional[List[str]] = None,
    exclude_topics: Optional[List[str]] = None,
    lang: str = "fr"
) -> str:
    """
    Construit un prompt personnalisé avec toutes les options.
    
    Args:
        base_prompt: Prompt de base pour l'analyse
        writing_style: Style d'écriture
        anti_ai_detection: Activer l'anti-détection IA
        humanize_level: Niveau d'humanisation (0-3)
        user_prompt: Instructions personnalisées de l'utilisateur
        target_audience: Public cible
        focus_topics: Sujets à mettre en avant
        exclude_topics: Sujets à éviter
        lang: Langue
    
    Returns:
        Prompt complet et personnalisé
    """
    sections = []
    
    # 1. Prompt anti-IA (si activé)
    if anti_ai_detection:
        sections.append(get_anti_ai_prompt(lang))
    
    # 2. Instructions de style
    style_instruction = get_style_instruction(writing_style, lang)
    if style_instruction:
        sections.append(style_instruction)
    
    # 3. Humanisation
    if humanize_level > 0:
        human_prompt = get_humanization_prompt(humanize_level, lang)
        if human_prompt:
            sections.append(human_prompt)
    
    # 4. Public cible
    if target_audience:
        if lang == "en":
            sections.append(f"\nTARGET AUDIENCE: {target_audience}\nAdapt vocabulary and explanations accordingly.")
        else:
            sections.append(f"\nPUBLIC CIBLE: {target_audience}\nAdapte le vocabulaire et les explications en conséquence.")
    
    # 5. Sujets focus
    if focus_topics:
        topics_str = ", ".join(focus_topics)
        if lang == "en":
            sections.append(f"\nFOCUS TOPICS: {topics_str}\nGive special attention to these subjects.")
        else:
            sections.append(f"\nSUJETS À DÉVELOPPER: {topics_str}\nAccorde une attention particulière à ces sujets.")
    
    # 6. Sujets à éviter
    if exclude_topics:
        topics_str = ", ".join(exclude_topics)
        if lang == "en":
            sections.append(f"\nTOPICS TO MINIMIZE: {topics_str}\nMention briefly or skip these subjects.")
        else:
            sections.append(f"\nSUJETS À MINIMISER: {topics_str}\nMentionne brièvement ou évite ces sujets.")
    
    # 7. Instructions utilisateur (priorité haute)
    if user_prompt:
        if lang == "en":
            sections.append(f"\n⭐ USER INSTRUCTIONS (PRIORITY):\n{user_prompt}")
        else:
            sections.append(f"\n⭐ INSTRUCTIONS UTILISATEUR (PRIORITÉ):\n{user_prompt}")
    
    # 8. Prompt de base
    sections.append("\n" + "═" * 80 + "\n")
    sections.append(base_prompt)
    
    return "\n".join(sections)


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 VARIATIONS DE PHRASES POUR DIVERSITÉ
# ═══════════════════════════════════════════════════════════════════════════════

SENTENCE_STARTERS = {
    "fr": [
        "Il est intéressant de noter que",
        "On constate que",
        "Force est de reconnaître que",
        "Il apparaît que",
        "Fait notable,",
        "Point crucial:",
        "En creusant un peu,",
        "À y regarder de plus près,",
        "Ce qui frappe, c'est",
        "On ne peut ignorer que",
        "D'un autre côté,",
        "Paradoxalement,",
        "Sans surprise,",
        "Contre toute attente,"
    ],
    "en": [
        "Interestingly,",
        "It's worth noting that",
        "One can observe that",
        "Notably,",
        "Crucially,",
        "Upon closer inspection,",
        "Digging deeper,",
        "What stands out is",
        "On the other hand,",
        "Paradoxically,",
        "Unsurprisingly,",
        "Against expectations,"
    ]
}

TRANSITIONS = {
    "fr": [
        "Cela dit,",
        "En revanche,",
        "Par ailleurs,",
        "D'ailleurs,",
        "En parallèle,",
        "Dans le même ordre d'idées,",
        "Qui plus est,",
        "Ajoutons que",
        "Il faut aussi considérer que",
        "Sans oublier que"
    ],
    "en": [
        "That said,",
        "However,",
        "Furthermore,",
        "Additionally,",
        "Meanwhile,",
        "Along the same lines,",
        "Moreover,",
        "Let's also consider that",
        "Not to mention that"
    ]
}


def get_random_starter(lang: str = "fr") -> str:
    """Retourne un début de phrase aléatoire."""
    starters = SENTENCE_STARTERS.get(lang, SENTENCE_STARTERS["fr"])
    return random.choice(starters)


def get_random_transition(lang: str = "fr") -> str:
    """Retourne une transition aléatoire."""
    transitions = TRANSITIONS.get(lang, TRANSITIONS["fr"])
    return random.choice(transitions)
