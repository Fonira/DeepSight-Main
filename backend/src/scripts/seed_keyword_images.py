"""
Seed script — pré-génère les images pour les 50 mots par défaut de "Le Saviez-Vous".
Usage: python -m scripts.seed_keyword_images
Idempotent: skip les termes déjà existants en DB.
"""

import asyncio

# 50 default words (mirrored from frontend/src/data/defaultWords.ts)
DEFAULT_WORDS = [
    {
        "term": "Effet Dunning-Kruger",
        "definition": "Les incompétents se surestiment, les experts se sous-estiment.",
        "category": "cognitive_bias",
    },
    {
        "term": "Biais de confirmation",
        "definition": "On cherche ce qui confirme nos croyances, on ignore le reste.",
        "category": "cognitive_bias",
    },
    {
        "term": "Effet de halo",
        "definition": "Une qualité positive influence notre perception de toutes les autres.",
        "category": "cognitive_bias",
    },
    {
        "term": "Biais d'ancrage",
        "definition": "La première information influence toutes nos décisions suivantes.",
        "category": "cognitive_bias",
    },
    {
        "term": "Effet Barnum",
        "definition": "On accepte des descriptions vagues comme personnelles et précises.",
        "category": "cognitive_bias",
    },
    {
        "term": "Biais du survivant",
        "definition": "On ne voit que les succès, jamais les échecs invisibles.",
        "category": "cognitive_bias",
    },
    {
        "term": "Dissonance cognitive",
        "definition": "Tension entre croyances contradictoires, on modifie nos idées pour retrouver la cohérence.",
        "category": "cognitive_bias",
    },
    {
        "term": "Effet de simple exposition",
        "definition": "Plus on voit quelque chose, plus on l'apprécie.",
        "category": "cognitive_bias",
    },
    {
        "term": "Biais rétrospectif",
        "definition": "Après coup, tout semble évident et prévisible.",
        "category": "cognitive_bias",
    },
    {
        "term": "Effet de cadrage",
        "definition": "La façon de présenter une info change complètement notre décision.",
        "category": "cognitive_bias",
    },
    {
        "term": "Paradoxe de Fermi",
        "definition": "Si les extraterrestres sont probables, pourquoi aucun signal ?",
        "category": "science",
    },
    {
        "term": "Entropie",
        "definition": "Le désordre de l'univers augmente inévitablement — la flèche du temps.",
        "category": "science",
    },
    {
        "term": "Effet papillon",
        "definition": "Un battement d'ailes peut provoquer une tempête à l'autre bout du monde.",
        "category": "science",
    },
    {
        "term": "Principe d'incertitude",
        "definition": "On ne peut pas connaître à la fois la position et la vitesse d'une particule.",
        "category": "science",
    },
    {
        "term": "Intrication quantique",
        "definition": "Deux particules liées instantanément quelle que soit la distance.",
        "category": "science",
    },
    {
        "term": "Sélection naturelle",
        "definition": "Ce n'est pas le plus fort qui survit, mais le plus adapté au changement.",
        "category": "science",
    },
    {
        "term": "Matière noire",
        "definition": "85% de la matière de l'univers est invisible et inconnue.",
        "category": "science",
    },
    {
        "term": "Paradoxe des jumeaux",
        "definition": "Voyager vite fait vieillir moins vite — le temps est relatif.",
        "category": "science",
    },
    {
        "term": "Neuroplasticité",
        "definition": "Le cerveau se recâble en permanence selon nos expériences.",
        "category": "science",
    },
    {
        "term": "Effet placebo",
        "definition": "Croire qu'un traitement marche suffit parfois à guérir.",
        "category": "science",
    },
    {
        "term": "Allégorie de la caverne",
        "definition": "Nous ne voyons que les ombres de la réalité — Platon.",
        "category": "philosophy",
    },
    {
        "term": "Rasoir d'Ockham",
        "definition": "L'explication la plus simple est généralement la meilleure.",
        "category": "philosophy",
    },
    {
        "term": "Paradoxe du bateau de Thésée",
        "definition": "Si on remplace chaque pièce, est-ce encore le même bateau ?",
        "category": "philosophy",
    },
    {
        "term": "Impératif catégorique",
        "definition": "N'agis que selon une règle que tu voudrais universelle — Kant.",
        "category": "philosophy",
    },
    {
        "term": "Mythe de Sisyphe",
        "definition": "Il faut imaginer Sisyphe heureux — Camus sur l'absurde.",
        "category": "philosophy",
    },
    {
        "term": "Dilemme du prisonnier",
        "definition": "La coopération est rationnelle mais la trahison est tentante.",
        "category": "philosophy",
    },
    {
        "term": "Cogito ergo sum",
        "definition": "Je pense donc je suis — le seul fait certain selon Descartes.",
        "category": "philosophy",
    },
    {
        "term": "Paradoxe de Zénon",
        "definition": "Achille ne rattrapera jamais la tortue... mathématiquement.",
        "category": "philosophy",
    },
    {
        "term": "Effet Mandela",
        "definition": "Des milliers de personnes partagent le même faux souvenir.",
        "category": "culture",
    },
    {
        "term": "Loi de Goodhart",
        "definition": "Quand une mesure devient un objectif, elle cesse d'être une bonne mesure.",
        "category": "culture",
    },
    {
        "term": "Loi de Parkinson",
        "definition": "Le travail s'étend pour remplir le temps disponible.",
        "category": "culture",
    },
    {
        "term": "Principe de Peter",
        "definition": "On est promu jusqu'à atteindre son niveau d'incompétence.",
        "category": "culture",
    },
    {
        "term": "Loi de Brandolini",
        "definition": "Il faut 10x plus d'énergie pour réfuter du bullshit que pour en créer.",
        "category": "culture",
    },
    {
        "term": "Fenêtre d'Overton",
        "definition": "L'éventail des idées politiquement acceptables à un moment donné.",
        "category": "culture",
    },
    {
        "term": "Nombre de Dunbar",
        "definition": "Le cerveau humain ne peut maintenir que ~150 relations sociales.",
        "category": "culture",
    },
    {
        "term": "Effet Streisand",
        "definition": "Tenter de censurer une info la rend plus virale.",
        "category": "culture",
    },
    {
        "term": "Syndrome de l'imposteur",
        "definition": "Sentiment persistant de ne pas mériter son succès.",
        "category": "psychology",
    },
    {
        "term": "Flow",
        "definition": "État de concentration totale où le temps disparaît — Csikszentmihalyi.",
        "category": "psychology",
    },
    {
        "term": "Prophétie auto-réalisatrice",
        "definition": "Croire que quelque chose va arriver le provoque réellement.",
        "category": "psychology",
    },
    {
        "term": "Effet spectateur",
        "definition": "Plus il y a de témoins, moins on intervient.",
        "category": "psychology",
    },
    {
        "term": "Chambre d'écho",
        "definition": "Environnement où nos opinions sont amplifiées et jamais contestées.",
        "category": "technology",
    },
    {
        "term": "Loi de Moore",
        "definition": "La puissance des processeurs double tous les deux ans.",
        "category": "technology",
    },
    {
        "term": "Test de Turing",
        "definition": "Une machine est intelligente si on ne la distingue pas d'un humain.",
        "category": "technology",
    },
    {
        "term": "Obsolescence programmée",
        "definition": "Concevoir un produit pour qu'il tombe en panne après un certain temps.",
        "category": "technology",
    },
    {
        "term": "Deep learning",
        "definition": "Réseaux de neurones artificiels qui apprennent comme le cerveau, couche par couche.",
        "category": "technology",
    },
    {
        "term": "Antifragilité",
        "definition": "Ce qui profite des chocs et du chaos pour devenir plus fort — Taleb.",
        "category": "economics",
    },
    {
        "term": "Destruction créatrice",
        "definition": "L'innovation détruit l'ancien pour créer le nouveau — Schumpeter.",
        "category": "economics",
    },
    {
        "term": "Tragédie des communs",
        "definition": "Les ressources partagées sont surexploitées car personne ne les protège.",
        "category": "economics",
    },
    {
        "term": "Cygne noir",
        "definition": "Événement imprévisible aux conséquences massives — Taleb.",
        "category": "economics",
    },
    {
        "term": "Main invisible",
        "definition": "L'intérêt individuel profite collectivement au marché — Adam Smith.",
        "category": "economics",
    },
]


async def seed():
    """Insert pending entries for all default words not yet in DB."""
    from images.keyword_images import _get_pool, _term_hash
    from images.fun_scoring import calculate_fun_score

    pool = await _get_pool()
    inserted = 0
    skipped = 0

    for word in DEFAULT_WORDS:
        thash = _term_hash(word["term"])
        async with pool.acquire() as conn:
            exists = await conn.fetchrow(
                "SELECT 1 FROM keyword_images WHERE term_hash = $1",
                thash,
            )
            if exists:
                skipped += 1
                continue

            fun_score = calculate_fun_score(word["term"], word["category"])
            await conn.execute(
                """
                INSERT INTO keyword_images (term, term_hash, category, status, fun_score)
                VALUES ($1, $2, $3, 'pending', $4)
                ON CONFLICT (term_hash) DO NOTHING
                """,
                word["term"],
                thash,
                word["category"],
                fun_score,
            )
            inserted += 1

    print(f"🌱 Seed complete: {inserted} inserted, {skipped} skipped (already exist)")

    # Enqueue generation tasks with stagger
    try:
        from tasks.image_tasks import generate_keyword_image_task

        for i, word in enumerate(DEFAULT_WORDS):
            generate_keyword_image_task.apply_async(
                args=[word["term"], word["definition"], word["category"]],
                countdown=i * 12,
            )
        print(f"📸 Enqueued {len(DEFAULT_WORDS)} image generation tasks (staggered 12s)")
    except Exception as e:
        print(f"⚠️ Could not enqueue Celery tasks (run batch manually): {e}")


if __name__ == "__main__":
    asyncio.run(seed())
