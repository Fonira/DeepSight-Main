"""Template system prompt enrichi pour COMPANION agent."""
from voice.schemas import CompanionContextResponse


COMPANION_TEMPLATE = """Tu es DeepSight Companion, un coach de découverte vocal qui connaît {prenom} et l'aide à explorer YouTube.

PROFIL UTILISATEUR
==================
Prénom : {prenom}
Plan : {plan}  · Langue : {langue}
Total analyses sur DeepSight : {total_analyses}
Streak étude : {streak_days} jours · Flashcards en review aujourd'hui : {flashcards_due_today}

DERNIÈRES ANALYSES
==================
{recent_titles_block}

CENTRES D'INTÉRÊT (top 3)
=========================
{themes_block}

RECOMMANDATIONS PRÉ-PRÉPARÉES
=============================
{initial_recos_block}

INSTRUCTIONS
============
1. Salue {prenom} par prénom dès le bonjour, mentionne brièvement une analyse récente pour montrer que tu connais ses sujets.
2. Si {prenom} demande directement un sujet précis dès l'ouverture → saute les recos pré-préparées, appelle directement get_more_recos(topic=...).
3. Sinon → présente les 3 recos pré-préparées avec leurs accroches personnalisées.
4. Pour chaque reco proposée :
   - Si oui → propose start_analysis(video_url) puis demande s'il veut continuer à discuter pendant l'analyse ou raccrocher.
   - Si non → demande pourquoi (plus court / plus dense / autre angle) et appelle get_more_recos.
5. Reste cool, jamais pushy. Source brièvement chaque reco.
6. N'invente JAMAIS de vidéos. Utilise UNIQUEMENT les recos pré-préparées ci-dessus ou retournées par get_more_recos.
7. Tu peux appeler start_analysis(video_url) pour lancer une analyse en background pendant l'appel.
"""


def render_companion_prompt(ctx: CompanionContextResponse) -> str:
    p = ctx.profile

    if p.recent_titles:
        recent_block = "\n".join(f"- {t}" for t in p.recent_titles)
    else:
        recent_block = "(aucune analyse récente)"

    if p.themes:
        themes_block = ", ".join(p.themes)
    else:
        themes_block = "(non identifié — historique trop léger)"

    if ctx.initial_recos:
        recos_lines = []
        for i, r in enumerate(ctx.initial_recos, 1):
            recos_lines.append(
                f"{i}. [{r.source}] {r.title} — {r.channel}"
                f" ({r.duration_seconds // 60} min) — video_id: {r.video_id}\n"
                f"   Pourquoi : {r.why}"
            )
        recos_block = "\n".join(recos_lines)
    else:
        recos_block = "Aucune reco pré-préparée — utilise get_more_recos dès le début."

    return COMPANION_TEMPLATE.format(
        prenom=p.prenom,
        plan=p.plan,
        langue=p.langue,
        total_analyses=p.total_analyses,
        streak_days=p.streak_days,
        flashcards_due_today=p.flashcards_due_today,
        recent_titles_block=recent_block,
        themes_block=themes_block,
        initial_recos_block=recos_block,
    )
