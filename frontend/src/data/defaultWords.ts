/**
 * 🧠 DEFAULT_WORDS — Liste de 50 mots fascinants pour le widget "Le Saviez-Vous"
 * Fallback local quand l'API backend n'est pas disponible
 * Catégories: cognitive_bias, science, philosophy, culture, misc
 */

export interface WordData {
  term: string;
  term_en: string;
  definition_fr: string;
  definition_en: string;
  short_fr: string;
  short_en: string;
  category: string;
  wiki_url?: string;
}

export const DEFAULT_WORDS: WordData[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // 🧠 BIAIS COGNITIFS (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Effet Dunning-Kruger",
    term_en: "Dunning-Kruger Effect",
    definition_fr: "Biais cognitif où les personnes peu compétentes dans un domaine surestiment leurs capacités, tandis que les experts ont tendance à sous-estimer les leurs. Plus on en sait, plus on réalise l'étendue de ce qu'on ignore.",
    definition_en: "Cognitive bias where people with limited competence in a domain overestimate their abilities, while experts tend to underestimate theirs. The more you know, the more you realize the extent of what you don't know.",
    short_fr: "Les incompétents se surestiment, les experts se sous-estiment.",
    short_en: "The incompetent overestimate themselves, experts underestimate.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Dunning-Kruger"
  },
  {
    term: "Biais de confirmation",
    term_en: "Confirmation Bias",
    definition_fr: "Tendance à rechercher, interpréter et mémoriser les informations qui confirment nos croyances préexistantes, tout en ignorant celles qui les contredisent.",
    definition_en: "Tendency to search for, interpret, and remember information that confirms our pre-existing beliefs, while ignoring information that contradicts them.",
    short_fr: "On cherche ce qui confirme nos croyances, on ignore le reste.",
    short_en: "We seek what confirms our beliefs, ignore the rest.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_de_confirmation"
  },
  {
    term: "Effet de halo",
    term_en: "Halo Effect",
    definition_fr: "Biais cognitif où notre impression globale d'une personne influence notre jugement sur ses caractéristiques spécifiques. Une personne attirante sera souvent perçue comme plus intelligente.",
    definition_en: "Cognitive bias where our overall impression of a person influences our judgment of their specific characteristics. An attractive person is often perceived as more intelligent.",
    short_fr: "Une qualité positive influence notre perception de toutes les autres.",
    short_en: "One positive quality influences our perception of all others.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_halo"
  },
  {
    term: "Biais d'ancrage",
    term_en: "Anchoring Bias",
    definition_fr: "Tendance à se fier excessivement à la première information reçue (l'ancre) pour prendre des décisions ultérieures. C'est pourquoi les négociateurs font toujours la première offre.",
    definition_en: "Tendency to rely too heavily on the first piece of information received (the anchor) when making subsequent decisions.",
    short_fr: "La première information influence toutes nos décisions suivantes.",
    short_en: "The first information influences all our subsequent decisions.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_d%27ancrage"
  },
  {
    term: "Biais du survivant",
    term_en: "Survivorship Bias",
    definition_fr: "Erreur logique consistant à se concentrer sur les personnes ou choses qui ont 'survécu' à un processus de sélection, en ignorant ceux qui n'ont pas réussi.",
    definition_en: "Logical error of concentrating on people or things that 'survived' a selection process, while ignoring those who didn't make it.",
    short_fr: "On ne voit que les succès, jamais les échecs silencieux.",
    short_en: "We only see successes, never the silent failures.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_des_survivants"
  },
  {
    term: "Effet Barnum",
    term_en: "Barnum Effect",
    definition_fr: "Tendance à accepter des descriptions vagues et générales de la personnalité comme s'appliquant spécifiquement à soi. C'est le principe exploité par les horoscopes.",
    definition_en: "Tendency to accept vague and general personality descriptions as uniquely applicable to oneself. This is the principle exploited by horoscopes.",
    short_fr: "On croit que les descriptions vagues nous concernent personnellement.",
    short_en: "We believe vague descriptions apply specifically to us.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Barnum"
  },
  {
    term: "Biais rétrospectif",
    term_en: "Hindsight Bias",
    definition_fr: "Tendance à croire, après qu'un événement s'est produit, qu'on l'avait prédit ou qu'il était prévisible. 'Je le savais depuis le début' est rarement vrai.",
    definition_en: "Tendency to believe, after an event has occurred, that one predicted it or that it was predictable.",
    short_fr: "Après coup, tout semble évident et prévisible.",
    short_en: "In hindsight, everything seems obvious and predictable.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_r%C3%A9trospectif"
  },
  {
    term: "Dissonance cognitive",
    term_en: "Cognitive Dissonance",
    definition_fr: "Tension mentale ressentie lorsqu'on a des croyances, idées ou valeurs contradictoires. Pour réduire cet inconfort, on modifie souvent nos croyances plutôt que nos comportements.",
    definition_en: "Mental tension experienced when holding contradictory beliefs, ideas, or values. To reduce this discomfort, we often change our beliefs rather than our behaviors.",
    short_fr: "Inconfort mental quand nos croyances et actions se contredisent.",
    short_en: "Mental discomfort when our beliefs and actions contradict.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Dissonance_cognitive"
  },
  {
    term: "Effet de récence",
    term_en: "Recency Effect",
    definition_fr: "Tendance à mieux se souvenir des dernières informations reçues. C'est pourquoi les dernières impressions comptent autant que les premières.",
    definition_en: "Tendency to better remember the most recent information received. This is why last impressions matter as much as first impressions.",
    short_fr: "On se souvient mieux des dernières informations reçues.",
    short_en: "We remember the most recent information better.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_r%C3%A9cence"
  },
  {
    term: "Effet de simple exposition",
    term_en: "Mere Exposure Effect",
    definition_fr: "Phénomène psychologique où les gens développent une préférence pour les choses simplement parce qu'ils y sont familiarisés. Plus on voit quelque chose, plus on l'apprécie.",
    definition_en: "Psychological phenomenon where people develop a preference for things merely because they are familiar with them.",
    short_fr: "La répétition engendre l'appréciation.",
    short_en: "Repetition breeds appreciation.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_simple_exposition"
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔬 SCIENCE & TECHNOLOGIE (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Entropie",
    term_en: "Entropy",
    definition_fr: "Mesure du désordre dans un système. La deuxième loi de la thermodynamique stipule que l'entropie de l'univers augmente toujours.",
    definition_en: "Measure of disorder in a system. The second law of thermodynamics states that the entropy of the universe always increases.",
    short_fr: "Le désordre augmente toujours dans l'univers.",
    short_en: "Disorder always increases in the universe.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Entropie_(thermodynamique)"
  },
  {
    term: "Effet papillon",
    term_en: "Butterfly Effect",
    definition_fr: "Concept selon lequel de petites variations dans les conditions initiales d'un système peuvent engendrer des effets considérables.",
    definition_en: "Concept that small variations in a system's initial conditions can lead to considerable effects.",
    short_fr: "De petites causes peuvent avoir d'immenses conséquences.",
    short_en: "Small causes can have immense consequences.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_papillon"
  },
  {
    term: "Paradoxe de Fermi",
    term_en: "Fermi Paradox",
    definition_fr: "Contradiction apparente entre l'absence de preuves de civilisations extraterrestres et les estimations élevées de leur probabilité. Où sont les autres ?",
    definition_en: "Apparent contradiction between the lack of evidence for extraterrestrial civilizations and the high estimates of their probability.",
    short_fr: "L'univers est immense, alors où sont les extraterrestres ?",
    short_en: "The universe is vast, so where are the aliens?",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Paradoxe_de_Fermi"
  },
  {
    term: "Plasticité neuronale",
    term_en: "Neuroplasticity",
    definition_fr: "Capacité du cerveau à se réorganiser en formant de nouvelles connexions neuronales tout au long de la vie.",
    definition_en: "The brain's ability to reorganize itself by forming new neural connections throughout life.",
    short_fr: "Le cerveau peut se recâbler toute la vie.",
    short_en: "The brain can rewire itself throughout life.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Plasticit%C3%A9_neuronale"
  },
  {
    term: "Horizon des événements",
    term_en: "Event Horizon",
    definition_fr: "Frontière d'un trou noir au-delà de laquelle rien, pas même la lumière, ne peut s'échapper.",
    definition_en: "Boundary of a black hole beyond which nothing, not even light, can escape.",
    short_fr: "La limite d'un trou noir d'où rien ne peut s'échapper.",
    short_en: "A black hole's boundary from which nothing can escape.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Horizon_des_%C3%A9v%C3%A9nements"
  },
  {
    term: "Principe d'incertitude",
    term_en: "Uncertainty Principle",
    definition_fr: "Principe fondamental de la mécanique quantique : il est impossible de connaître simultanément avec précision la position et la vitesse d'une particule.",
    definition_en: "Fundamental principle of quantum mechanics: it's impossible to simultaneously know with precision both the position and velocity of a particle.",
    short_fr: "On ne peut pas tout mesurer précisément en même temps.",
    short_en: "We cannot measure everything precisely at once.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Principe_d%27incertitude"
  },
  {
    term: "Émergence",
    term_en: "Emergence",
    definition_fr: "Phénomène où des propriétés complexes apparaissent à partir d'interactions simples. La conscience émerge des neurones, une fourmilière de fourmis individuelles.",
    definition_en: "Phenomenon where complex properties arise from simple interactions. Consciousness emerges from neurons, an ant colony from individual ants.",
    short_fr: "Des règles simples créent des comportements complexes.",
    short_en: "Simple rules create complex behaviors.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/%C3%89mergence"
  },
  {
    term: "Effet Doppler",
    term_en: "Doppler Effect",
    definition_fr: "Changement de fréquence d'une onde perçue lorsque la source et l'observateur sont en mouvement relatif.",
    definition_en: "Change in frequency of a wave when the source and observer are in relative motion.",
    short_fr: "Le son change selon que la source s'approche ou s'éloigne.",
    short_en: "Sound changes as the source approaches or recedes.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Doppler"
  },
  {
    term: "Apoptose",
    term_en: "Apoptosis",
    definition_fr: "Mort cellulaire programmée, essentielle au développement et à la santé. Vos doigts se sont formés grâce à la mort programmée des cellules entre eux.",
    definition_en: "Programmed cell death, essential for development and health. Your fingers formed through the programmed death of cells between them.",
    short_fr: "La mort cellulaire programmée qui nous maintient en vie.",
    short_en: "Programmed cell death that keeps us alive.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Apoptose"
  },
  {
    term: "Singularité technologique",
    term_en: "Technological Singularity",
    definition_fr: "Point hypothétique où l'intelligence artificielle dépassera l'intelligence humaine, créant un changement imprévisible de la civilisation.",
    definition_en: "Hypothetical point where artificial intelligence surpasses human intelligence, creating an unpredictable change in civilization.",
    short_fr: "Le moment où l'IA dépassera l'intelligence humaine.",
    short_en: "The moment AI surpasses human intelligence.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Singularit%C3%A9_technologique"
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎭 PHILOSOPHIE & CONCEPTS (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Rasoir d'Occam",
    term_en: "Occam's Razor",
    definition_fr: "Principe de parcimonie selon lequel l'explication la plus simple est généralement la meilleure.",
    definition_en: "Principle of parsimony stating that the simplest explanation is generally the best.",
    short_fr: "L'explication la plus simple est souvent la meilleure.",
    short_en: "The simplest explanation is often the best.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Rasoir_d%27Occam"
  },
  {
    term: "Allégorie de la caverne",
    term_en: "Allegory of the Cave",
    definition_fr: "Métaphore de Platon illustrant la différence entre l'apparence et la réalité. Des prisonniers enchaînés ne voient que des ombres sur un mur.",
    definition_en: "Plato's metaphor illustrating the difference between appearance and reality. Chained prisoners only see shadows on a wall.",
    short_fr: "Ce que nous percevons n'est peut-être qu'une ombre de la réalité.",
    short_en: "What we perceive may only be a shadow of reality.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/All%C3%A9gorie_de_la_caverne"
  },
  {
    term: "Absurde",
    term_en: "Absurdism",
    definition_fr: "Concept philosophique de Camus : le conflit entre notre désir de sens et l'indifférence de l'univers.",
    definition_en: "Camus' philosophical concept: the conflict between our desire for meaning and the universe's indifference.",
    short_fr: "Le conflit entre notre quête de sens et l'indifférence cosmique.",
    short_en: "The conflict between our search for meaning and cosmic indifference.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Absurde"
  },
  {
    term: "Solipsisme",
    term_en: "Solipsism",
    definition_fr: "Position philosophique selon laquelle seule notre propre conscience est certaine d'exister. Tout le reste pourrait n'être qu'une projection.",
    definition_en: "Philosophical position that only one's own consciousness is certain to exist. Everything else could be just a projection.",
    short_fr: "Seule ma conscience existe certainement, le reste est incertain.",
    short_en: "Only my consciousness certainly exists, the rest is uncertain.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Solipsisme"
  },
  {
    term: "Amor fati",
    term_en: "Amor Fati",
    definition_fr: "Expression latine signifiant 'amour du destin', concept stoïcien repris par Nietzsche. Accepter et embrasser tout ce qui arrive.",
    definition_en: "Latin expression meaning 'love of fate', a Stoic concept adopted by Nietzsche. Accept and embrace everything that happens.",
    short_fr: "Aimer son destin, même ses épreuves.",
    short_en: "Love your fate, even its hardships.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Amor_fati"
  },
  {
    term: "Mauvaise foi",
    term_en: "Bad Faith",
    definition_fr: "Concept sartrien désignant l'auto-tromperie où l'on se ment à soi-même pour éviter l'angoisse de la liberté.",
    definition_en: "Sartrean concept describing self-deception where one lies to oneself to avoid the anxiety of freedom.",
    short_fr: "Se mentir à soi-même pour fuir sa liberté.",
    short_en: "Lying to oneself to escape one's freedom.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Mauvaise_foi_(philosophie)"
  },
  {
    term: "Paradoxe du bateau de Thésée",
    term_en: "Ship of Theseus Paradox",
    definition_fr: "Si l'on remplace progressivement toutes les pièces d'un bateau, est-ce toujours le même bateau ? Ce paradoxe interroge l'identité.",
    definition_en: "If you gradually replace all parts of a ship, is it still the same ship? This paradox questions identity.",
    short_fr: "Si tout change, l'identité persiste-t-elle ?",
    short_en: "If everything changes, does identity persist?",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Bateau_de_Th%C3%A9s%C3%A9e"
  },
  {
    term: "Éternel retour",
    term_en: "Eternal Return",
    definition_fr: "Concept nietzschéen : imaginez que vous devez revivre votre vie exactement de la même façon pour l'éternité.",
    definition_en: "Nietzschean concept: imagine you must relive your life exactly the same way for eternity.",
    short_fr: "Vivez comme si chaque moment devait se répéter éternellement.",
    short_en: "Live as if each moment would repeat eternally.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/%C3%89ternel_retour"
  },
  {
    term: "Qualia",
    term_en: "Qualia",
    definition_fr: "Expériences subjectives et conscientes - le 'ressenti' du rouge, le goût du chocolat. Impossible à décrire à quelqu'un qui ne l'a jamais vécu.",
    definition_en: "Subjective conscious experiences - the 'feel' of red, the taste of chocolate. Impossible to describe to someone who has never experienced it.",
    short_fr: "L'expérience subjective impossible à communiquer.",
    short_en: "Subjective experience impossible to communicate.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Qualia"
  },
  {
    term: "Libre arbitre",
    term_en: "Free Will",
    definition_fr: "Capacité présumée de faire des choix sans être entièrement déterminé par des causes antérieures. Un débat millénaire non résolu.",
    definition_en: "Presumed capacity to make choices without being entirely determined by prior causes. A millennia-old debate that remains unresolved.",
    short_fr: "Nos choix sont-ils vraiment libres ou prédéterminés ?",
    short_en: "Are our choices truly free or predetermined?",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Libre_arbitre"
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🌍 CULTURE & SOCIÉTÉ (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Effet Streisand",
    term_en: "Streisand Effect",
    definition_fr: "Phénomène où la tentative de cacher ou censurer une information la rend paradoxalement beaucoup plus visible.",
    definition_en: "Phenomenon where attempting to hide or censor information paradoxically makes it much more visible.",
    short_fr: "Censurer une info la rend plus visible.",
    short_en: "Censoring information makes it more visible.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Streisand"
  },
  {
    term: "Fenêtre d'Overton",
    term_en: "Overton Window",
    definition_fr: "Spectre des idées considérées comme acceptables dans le discours public. Les idées évoluent de 'impensable' à 'politique'.",
    definition_en: "Spectrum of ideas considered acceptable in public discourse. Ideas evolve from 'unthinkable' to 'policy'.",
    short_fr: "Le spectre de ce qui est dicible en public.",
    short_en: "The spectrum of what's sayable in public.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Fen%C3%AAtre_d%27Overton"
  },
  {
    term: "Effet de meute",
    term_en: "Bandwagon Effect",
    definition_fr: "Tendance à adopter des comportements simplement parce que d'autres le font. Plus une idée est populaire, plus elle attire d'adhérents.",
    definition_en: "Tendency to adopt behaviors simply because others do. The more popular an idea, the more followers it attracts.",
    short_fr: "On suit la foule sans réfléchir.",
    short_en: "We follow the crowd without thinking.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_mode"
  },
  {
    term: "Pensée de groupe",
    term_en: "Groupthink",
    definition_fr: "Phénomène où le désir de conformité dans un groupe conduit à des décisions irrationnelles. Les membres évitent les conflits en supprimant les opinions divergentes.",
    definition_en: "Phenomenon where the desire for conformity in a group leads to irrational decisions. Members avoid conflict by suppressing dissenting opinions.",
    short_fr: "Le groupe étouffe la pensée critique individuelle.",
    short_en: "The group stifles individual critical thinking.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Pens%C3%A9e_de_groupe"
  },
  {
    term: "Capital culturel",
    term_en: "Cultural Capital",
    definition_fr: "Concept de Bourdieu désignant les connaissances et comportements qui confèrent un statut social.",
    definition_en: "Bourdieu's concept describing knowledge and behaviors that confer social status.",
    short_fr: "Les connaissances et codes culturels comme richesse sociale.",
    short_en: "Cultural knowledge and codes as social wealth.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Capital_culturel"
  },
  {
    term: "Prophétie autoréalisatrice",
    term_en: "Self-Fulfilling Prophecy",
    definition_fr: "Prédiction qui, par son simple énoncé, cause sa propre réalisation. Si une banque est perçue comme fragile, les clients retirent leur argent.",
    definition_en: "A prediction that, by being stated, causes its own fulfillment. If a bank is perceived as weak, customers withdraw their money.",
    short_fr: "Une croyance peut créer la réalité qu'elle prédit.",
    short_en: "A belief can create the reality it predicts.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Proph%C3%A9tie_autor%C3%A9alisatrice"
  },
  {
    term: "Chambre d'écho",
    term_en: "Echo Chamber",
    definition_fr: "Environnement où les opinions sont amplifiées par répétition au sein d'un système fermé. Les réseaux sociaux créent des bulles.",
    definition_en: "Environment where opinions are amplified through repetition within a closed system. Social networks create bubbles.",
    short_fr: "On n'entend que des opinions qui confirment les nôtres.",
    short_en: "We only hear opinions that confirm our own.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Chambre_d%27%C3%A9cho_(m%C3%A9dias)"
  },
  {
    term: "Tragédie des communs",
    term_en: "Tragedy of the Commons",
    definition_fr: "Situation où des individus agissant dans leur intérêt propre épuisent une ressource partagée, au détriment de tous.",
    definition_en: "Situation where individuals acting in their own interest deplete a shared resource, to everyone's detriment.",
    short_fr: "L'intérêt individuel épuise les ressources communes.",
    short_en: "Individual interest depletes common resources.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Trag%C3%A9die_des_biens_communs"
  },
  {
    term: "Loi de Goodhart",
    term_en: "Goodhart's Law",
    definition_fr: "Quand une mesure devient un objectif, elle cesse d'être une bonne mesure. Si les écoles sont jugées sur les notes, elles optimisent les notes, pas l'apprentissage.",
    definition_en: "When a measure becomes a target, it ceases to be a good measure. If schools are judged on grades, they optimize for grades, not learning.",
    short_fr: "Quand on vise l'indicateur, il perd son sens.",
    short_en: "When targeting the indicator, it loses its meaning.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Loi_de_Goodhart"
  },
  {
    term: "Normalisation de la déviance",
    term_en: "Normalization of Deviance",
    definition_fr: "Processus où des pratiques non conformes deviennent acceptables avec le temps. Les petites violations répétées redéfinissent ce qui est 'normal'.",
    definition_en: "Process where non-conforming practices become acceptable over time. Small repeated violations redefine what's 'normal'.",
    short_fr: "Les petites violations répétées deviennent la norme.",
    short_en: "Small repeated violations become the norm.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Normalisation_de_la_d%C3%A9viance"
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎲 DIVERS FASCINANTS (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Pareidolie",
    term_en: "Pareidolia",
    definition_fr: "Tendance du cerveau à percevoir des formes familières (visages) dans des motifs aléatoires. C'est pourquoi on voit des visages dans les nuages.",
    definition_en: "Brain's tendency to perceive familiar shapes (faces) in random patterns. This is why we see faces in clouds.",
    short_fr: "Voir des visages partout, même là où il n'y en a pas.",
    short_en: "Seeing faces everywhere, even where there are none.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Par%C3%A9idolie"
  },
  {
    term: "Effet Zeigarnik",
    term_en: "Zeigarnik Effect",
    definition_fr: "Tendance à mieux se souvenir des tâches inachevées que des tâches terminées. C'est pourquoi les cliffhangers fonctionnent.",
    definition_en: "Tendency to remember unfinished tasks better than completed ones. This is why cliffhangers work.",
    short_fr: "Les tâches inachevées restent en mémoire.",
    short_en: "Unfinished tasks stay in memory.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Zeigarnik"
  },
  {
    term: "Sérendipité",
    term_en: "Serendipity",
    definition_fr: "Découverte heureuse faite par hasard. La pénicilline, le micro-ondes et le Post-it sont des inventions sérendipiteuses.",
    definition_en: "A fortunate discovery made by chance. Penicillin, the microwave, and Post-it notes are serendipitous inventions.",
    short_fr: "Faire une découverte heureuse par hasard.",
    short_en: "Making a fortunate discovery by chance.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/S%C3%A9rendipit%C3%A9"
  },
  {
    term: "Hypnagogique",
    term_en: "Hypnagogic",
    definition_fr: "État de conscience transitoire entre l'éveil et le sommeil. Cet état s'accompagne souvent d'hallucinations et d'insights créatifs.",
    definition_en: "Transitional state of consciousness between wakefulness and sleep. Often accompanied by hallucinations and creative insights.",
    short_fr: "L'état créatif entre l'éveil et le sommeil.",
    short_en: "The creative state between waking and sleeping.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Hypnagogie"
  },
  {
    term: "Apophénie",
    term_en: "Apophenia",
    definition_fr: "Tendance à percevoir des connexions significatives entre des phénomènes non liés. Base des théories conspirationnistes.",
    definition_en: "Tendency to perceive meaningful connections between unrelated phenomena. Basis of conspiracy theories.",
    short_fr: "Voir des connexions là où il n'y en a pas.",
    short_en: "Seeing connections where there are none.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Apoph%C3%A9nie"
  },
  {
    term: "Jamais-vu",
    term_en: "Jamais Vu",
    definition_fr: "Contraire du déjà-vu : sentiment d'étrangeté face à une situation familière. Répétez un mot 30 fois : il deviendra méconnaissable.",
    definition_en: "Opposite of déjà vu: feeling of strangeness towards a familiar situation. Repeat a word 30 times: it becomes unrecognizable.",
    short_fr: "Quand le familier devient soudain étrange.",
    short_en: "When the familiar suddenly becomes strange.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Jamais-vu"
  },
  {
    term: "Flow",
    term_en: "Flow State",
    definition_fr: "État mental d'immersion totale dans une activité, avec concentration intense et perte de la notion du temps.",
    definition_en: "Mental state of complete immersion in an activity, with intense focus and loss of time awareness.",
    short_fr: "L'état d'immersion totale où le temps disparaît.",
    short_en: "The state of total immersion where time disappears.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Flow_(psychologie)"
  },
  {
    term: "Effet Pygmalion",
    term_en: "Pygmalion Effect",
    definition_fr: "Les attentes élevées des autres améliorent nos performances. Les élèves dont les professeurs croient qu'ils sont brillants obtiennent de meilleurs résultats.",
    definition_en: "High expectations from others improve our performance. Students whose teachers believe they are brilliant achieve better results.",
    short_fr: "Les attentes des autres façonnent nos performances.",
    short_en: "Others' expectations shape our performance.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Pygmalion"
  },
  {
    term: "Syndrome de l'imposteur",
    term_en: "Impostor Syndrome",
    definition_fr: "Sentiment persistant de ne pas mériter son succès, accompagné de la peur d'être 'démasqué'. Paradoxalement, il touche souvent les plus compétents.",
    definition_en: "Persistent feeling of not deserving one's success, accompanied by fear of being 'found out'. Paradoxically, it often affects the most competent.",
    short_fr: "Croire qu'on ne mérite pas son succès.",
    short_en: "Believing you don't deserve your success.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Syndrome_de_l%27imposteur"
  },
  {
    term: "Effet IKEA",
    term_en: "IKEA Effect",
    definition_fr: "Tendance à surévaluer les produits qu'on a partiellement créés soi-même. On aime davantage le meuble qu'on a monté.",
    definition_en: "Tendency to overvalue products we partially created ourselves. We like the furniture we assembled more.",
    short_fr: "On aime plus ce qu'on a créé soi-même.",
    short_en: "We value what we created ourselves more.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_IKEA"
  }
];

/**
 * Retourne un mot aléatoire, en excluant certains termes si spécifié
 */
export function getRandomWord(excludeTerms: string[] = []): WordData {
  const available = excludeTerms.length > 0
    ? DEFAULT_WORDS.filter(w => !excludeTerms.includes(w.term) && !excludeTerms.includes(w.term_en))
    : DEFAULT_WORDS;

  return available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
}

/**
 * Retourne les catégories disponibles
 */
export function getCategories(): string[] {
  return [...new Set(DEFAULT_WORDS.map(w => w.category))];
}
