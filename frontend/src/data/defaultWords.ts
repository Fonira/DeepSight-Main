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
    definition_fr:
      "Biais cognitif où les personnes peu compétentes dans un domaine surestiment leurs capacités, tandis que les experts ont tendance à sous-estimer les leurs. Plus on en sait, plus on réalise l'étendue de ce qu'on ignore.",
    definition_en:
      "Cognitive bias where people with limited competence in a domain overestimate their abilities, while experts tend to underestimate theirs. The more you know, the more you realize the extent of what you don't know.",
    short_fr: "Les incompétents se surestiment, les experts se sous-estiment.",
    short_en: "The incompetent overestimate themselves, experts underestimate.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Dunning-Kruger",
  },
  {
    term: "Biais de confirmation",
    term_en: "Confirmation Bias",
    definition_fr:
      "Tendance à rechercher, interpréter et mémoriser les informations qui confirment nos croyances préexistantes, tout en ignorant celles qui les contredisent.",
    definition_en:
      "Tendency to search for, interpret, and remember information that confirms our pre-existing beliefs, while ignoring information that contradicts them.",
    short_fr: "On cherche ce qui confirme nos croyances, on ignore le reste.",
    short_en: "We seek what confirms our beliefs, ignore the rest.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_de_confirmation",
  },
  {
    term: "Effet de halo",
    term_en: "Halo Effect",
    definition_fr:
      "Biais cognitif où notre impression globale d'une personne influence notre jugement sur ses caractéristiques spécifiques. Une personne attirante sera souvent perçue comme plus intelligente.",
    definition_en:
      "Cognitive bias where our overall impression of a person influences our judgment of their specific characteristics. An attractive person is often perceived as more intelligent.",
    short_fr:
      "Une qualité positive influence notre perception de toutes les autres.",
    short_en: "One positive quality influences our perception of all others.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_halo",
  },
  {
    term: "Biais d'ancrage",
    term_en: "Anchoring Bias",
    definition_fr:
      "Tendance à se fier excessivement à la première information reçue (l'ancre) pour prendre des décisions ultérieures. C'est pourquoi les négociateurs font toujours la première offre.",
    definition_en:
      "Tendency to rely too heavily on the first piece of information received (the anchor) when making subsequent decisions.",
    short_fr:
      "La première information influence toutes nos décisions suivantes.",
    short_en: "The first information influences all our subsequent decisions.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_d%27ancrage",
  },
  {
    term: "Biais du survivant",
    term_en: "Survivorship Bias",
    definition_fr:
      "Erreur logique consistant à se concentrer sur les personnes ou choses qui ont 'survécu' à un processus de sélection, en ignorant ceux qui n'ont pas réussi.",
    definition_en:
      "Logical error of concentrating on people or things that 'survived' a selection process, while ignoring those who didn't make it.",
    short_fr: "On ne voit que les succès, jamais les échecs silencieux.",
    short_en: "We only see successes, never the silent failures.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_des_survivants",
  },
  {
    term: "Effet Barnum",
    term_en: "Barnum Effect",
    definition_fr:
      "Tendance à accepter des descriptions vagues et générales de la personnalité comme s'appliquant spécifiquement à soi. C'est le principe exploité par les horoscopes.",
    definition_en:
      "Tendency to accept vague and general personality descriptions as uniquely applicable to oneself. This is the principle exploited by horoscopes.",
    short_fr:
      "On croit que les descriptions vagues nous concernent personnellement.",
    short_en: "We believe vague descriptions apply specifically to us.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Barnum",
  },
  {
    term: "Biais rétrospectif",
    term_en: "Hindsight Bias",
    definition_fr:
      "Tendance à croire, après qu'un événement s'est produit, qu'on l'avait prédit ou qu'il était prévisible. 'Je le savais depuis le début' est rarement vrai.",
    definition_en:
      "Tendency to believe, after an event has occurred, that one predicted it or that it was predictable.",
    short_fr: "Après coup, tout semble évident et prévisible.",
    short_en: "In hindsight, everything seems obvious and predictable.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_r%C3%A9trospectif",
  },
  {
    term: "Dissonance cognitive",
    term_en: "Cognitive Dissonance",
    definition_fr:
      "Tension mentale ressentie lorsqu'on a des croyances, idées ou valeurs contradictoires. Pour réduire cet inconfort, on modifie souvent nos croyances plutôt que nos comportements.",
    definition_en:
      "Mental tension experienced when holding contradictory beliefs, ideas, or values. To reduce this discomfort, we often change our beliefs rather than our behaviors.",
    short_fr:
      "Inconfort mental quand nos croyances et actions se contredisent.",
    short_en: "Mental discomfort when our beliefs and actions contradict.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Dissonance_cognitive",
  },
  {
    term: "Effet de récence",
    term_en: "Recency Effect",
    definition_fr:
      "Tendance à mieux se souvenir des dernières informations reçues. C'est pourquoi les dernières impressions comptent autant que les premières.",
    definition_en:
      "Tendency to better remember the most recent information received. This is why last impressions matter as much as first impressions.",
    short_fr: "On se souvient mieux des dernières informations reçues.",
    short_en: "We remember the most recent information better.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_r%C3%A9cence",
  },
  {
    term: "Effet de simple exposition",
    term_en: "Mere Exposure Effect",
    definition_fr:
      "Phénomène psychologique où les gens développent une préférence pour les choses simplement parce qu'ils y sont familiarisés. Plus on voit quelque chose, plus on l'apprécie.",
    definition_en:
      "Psychological phenomenon where people develop a preference for things merely because they are familiar with them.",
    short_fr: "La répétition engendre l'appréciation.",
    short_en: "Repetition breeds appreciation.",
    category: "cognitive_bias",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_simple_exposition",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔬 SCIENCE & TECHNOLOGIE (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Entropie",
    term_en: "Entropy",
    definition_fr:
      "Mesure du désordre dans un système. La deuxième loi de la thermodynamique stipule que l'entropie de l'univers augmente toujours.",
    definition_en:
      "Measure of disorder in a system. The second law of thermodynamics states that the entropy of the universe always increases.",
    short_fr: "Le désordre augmente toujours dans l'univers.",
    short_en: "Disorder always increases in the universe.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Entropie_(thermodynamique)",
  },
  {
    term: "Effet papillon",
    term_en: "Butterfly Effect",
    definition_fr:
      "Concept selon lequel de petites variations dans les conditions initiales d'un système peuvent engendrer des effets considérables.",
    definition_en:
      "Concept that small variations in a system's initial conditions can lead to considerable effects.",
    short_fr: "De petites causes peuvent avoir d'immenses conséquences.",
    short_en: "Small causes can have immense consequences.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_papillon",
  },
  {
    term: "Paradoxe de Fermi",
    term_en: "Fermi Paradox",
    definition_fr:
      "Contradiction apparente entre l'absence de preuves de civilisations extraterrestres et les estimations élevées de leur probabilité. Où sont les autres ?",
    definition_en:
      "Apparent contradiction between the lack of evidence for extraterrestrial civilizations and the high estimates of their probability.",
    short_fr: "L'univers est immense, alors où sont les extraterrestres ?",
    short_en: "The universe is vast, so where are the aliens?",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Paradoxe_de_Fermi",
  },
  {
    term: "Plasticité neuronale",
    term_en: "Neuroplasticity",
    definition_fr:
      "Capacité du cerveau à se réorganiser en formant de nouvelles connexions neuronales tout au long de la vie.",
    definition_en:
      "The brain's ability to reorganize itself by forming new neural connections throughout life.",
    short_fr: "Le cerveau peut se recâbler toute la vie.",
    short_en: "The brain can rewire itself throughout life.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Plasticit%C3%A9_neuronale",
  },
  {
    term: "Horizon des événements",
    term_en: "Event Horizon",
    definition_fr:
      "Frontière d'un trou noir au-delà de laquelle rien, pas même la lumière, ne peut s'échapper.",
    definition_en:
      "Boundary of a black hole beyond which nothing, not even light, can escape.",
    short_fr: "La limite d'un trou noir d'où rien ne peut s'échapper.",
    short_en: "A black hole's boundary from which nothing can escape.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Horizon_des_%C3%A9v%C3%A9nements",
  },
  {
    term: "Principe d'incertitude",
    term_en: "Uncertainty Principle",
    definition_fr:
      "Principe fondamental de la mécanique quantique : il est impossible de connaître simultanément avec précision la position et la vitesse d'une particule.",
    definition_en:
      "Fundamental principle of quantum mechanics: it's impossible to simultaneously know with precision both the position and velocity of a particle.",
    short_fr: "On ne peut pas tout mesurer précisément en même temps.",
    short_en: "We cannot measure everything precisely at once.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Principe_d%27incertitude",
  },
  {
    term: "Émergence",
    term_en: "Emergence",
    definition_fr:
      "Phénomène où des propriétés complexes apparaissent à partir d'interactions simples. La conscience émerge des neurones, une fourmilière de fourmis individuelles.",
    definition_en:
      "Phenomenon where complex properties arise from simple interactions. Consciousness emerges from neurons, an ant colony from individual ants.",
    short_fr: "Des règles simples créent des comportements complexes.",
    short_en: "Simple rules create complex behaviors.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/%C3%89mergence",
  },
  {
    term: "Effet Doppler",
    term_en: "Doppler Effect",
    definition_fr:
      "Changement de fréquence d'une onde perçue lorsque la source et l'observateur sont en mouvement relatif.",
    definition_en:
      "Change in frequency of a wave when the source and observer are in relative motion.",
    short_fr: "Le son change selon que la source s'approche ou s'éloigne.",
    short_en: "Sound changes as the source approaches or recedes.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Doppler",
  },
  {
    term: "Apoptose",
    term_en: "Apoptosis",
    definition_fr:
      "Mort cellulaire programmée, essentielle au développement et à la santé. Vos doigts se sont formés grâce à la mort programmée des cellules entre eux.",
    definition_en:
      "Programmed cell death, essential for development and health. Your fingers formed through the programmed death of cells between them.",
    short_fr: "La mort cellulaire programmée qui nous maintient en vie.",
    short_en: "Programmed cell death that keeps us alive.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Apoptose",
  },
  {
    term: "Singularité technologique",
    term_en: "Technological Singularity",
    definition_fr:
      "Point hypothétique où l'intelligence artificielle dépassera l'intelligence humaine, créant un changement imprévisible de la civilisation.",
    definition_en:
      "Hypothetical point where artificial intelligence surpasses human intelligence, creating an unpredictable change in civilization.",
    short_fr: "Le moment où l'IA dépassera l'intelligence humaine.",
    short_en: "The moment AI surpasses human intelligence.",
    category: "science",
    wiki_url: "https://fr.wikipedia.org/wiki/Singularit%C3%A9_technologique",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎭 PHILOSOPHIE & CONCEPTS (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Rasoir d'Occam",
    term_en: "Occam's Razor",
    definition_fr:
      "Principe de parcimonie selon lequel l'explication la plus simple est généralement la meilleure.",
    definition_en:
      "Principle of parsimony stating that the simplest explanation is generally the best.",
    short_fr: "L'explication la plus simple est souvent la meilleure.",
    short_en: "The simplest explanation is often the best.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Rasoir_d%27Occam",
  },
  {
    term: "Allégorie de la caverne",
    term_en: "Allegory of the Cave",
    definition_fr:
      "Métaphore de Platon illustrant la différence entre l'apparence et la réalité. Des prisonniers enchaînés ne voient que des ombres sur un mur.",
    definition_en:
      "Plato's metaphor illustrating the difference between appearance and reality. Chained prisoners only see shadows on a wall.",
    short_fr:
      "Ce que nous percevons n'est peut-être qu'une ombre de la réalité.",
    short_en: "What we perceive may only be a shadow of reality.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/All%C3%A9gorie_de_la_caverne",
  },
  {
    term: "Absurde",
    term_en: "Absurdism",
    definition_fr:
      "Concept philosophique de Camus : le conflit entre notre désir de sens et l'indifférence de l'univers.",
    definition_en:
      "Camus' philosophical concept: the conflict between our desire for meaning and the universe's indifference.",
    short_fr:
      "Le conflit entre notre quête de sens et l'indifférence cosmique.",
    short_en:
      "The conflict between our search for meaning and cosmic indifference.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Absurde",
  },
  {
    term: "Solipsisme",
    term_en: "Solipsism",
    definition_fr:
      "Position philosophique selon laquelle seule notre propre conscience est certaine d'exister. Tout le reste pourrait n'être qu'une projection.",
    definition_en:
      "Philosophical position that only one's own consciousness is certain to exist. Everything else could be just a projection.",
    short_fr:
      "Seule ma conscience existe certainement, le reste est incertain.",
    short_en: "Only my consciousness certainly exists, the rest is uncertain.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Solipsisme",
  },
  {
    term: "Amor fati",
    term_en: "Amor Fati",
    definition_fr:
      "Expression latine signifiant 'amour du destin', concept stoïcien repris par Nietzsche. Accepter et embrasser tout ce qui arrive.",
    definition_en:
      "Latin expression meaning 'love of fate', a Stoic concept adopted by Nietzsche. Accept and embrace everything that happens.",
    short_fr: "Aimer son destin, même ses épreuves.",
    short_en: "Love your fate, even its hardships.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Amor_fati",
  },
  {
    term: "Mauvaise foi",
    term_en: "Bad Faith",
    definition_fr:
      "Concept sartrien désignant l'auto-tromperie où l'on se ment à soi-même pour éviter l'angoisse de la liberté.",
    definition_en:
      "Sartrean concept describing self-deception where one lies to oneself to avoid the anxiety of freedom.",
    short_fr: "Se mentir à soi-même pour fuir sa liberté.",
    short_en: "Lying to oneself to escape one's freedom.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Mauvaise_foi_(philosophie)",
  },
  {
    term: "Paradoxe du bateau de Thésée",
    term_en: "Ship of Theseus Paradox",
    definition_fr:
      "Si l'on remplace progressivement toutes les pièces d'un bateau, est-ce toujours le même bateau ? Ce paradoxe interroge l'identité.",
    definition_en:
      "If you gradually replace all parts of a ship, is it still the same ship? This paradox questions identity.",
    short_fr: "Si tout change, l'identité persiste-t-elle ?",
    short_en: "If everything changes, does identity persist?",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Bateau_de_Th%C3%A9s%C3%A9e",
  },
  {
    term: "Éternel retour",
    term_en: "Eternal Return",
    definition_fr:
      "Concept nietzschéen : imaginez que vous devez revivre votre vie exactement de la même façon pour l'éternité.",
    definition_en:
      "Nietzschean concept: imagine you must relive your life exactly the same way for eternity.",
    short_fr: "Vivez comme si chaque moment devait se répéter éternellement.",
    short_en: "Live as if each moment would repeat eternally.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/%C3%89ternel_retour",
  },
  {
    term: "Qualia",
    term_en: "Qualia",
    definition_fr:
      "Expériences subjectives et conscientes - le 'ressenti' du rouge, le goût du chocolat. Impossible à décrire à quelqu'un qui ne l'a jamais vécu.",
    definition_en:
      "Subjective conscious experiences - the 'feel' of red, the taste of chocolate. Impossible to describe to someone who has never experienced it.",
    short_fr: "L'expérience subjective impossible à communiquer.",
    short_en: "Subjective experience impossible to communicate.",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Qualia",
  },
  {
    term: "Libre arbitre",
    term_en: "Free Will",
    definition_fr:
      "Capacité présumée de faire des choix sans être entièrement déterminé par des causes antérieures. Un débat millénaire non résolu.",
    definition_en:
      "Presumed capacity to make choices without being entirely determined by prior causes. A millennia-old debate that remains unresolved.",
    short_fr: "Nos choix sont-ils vraiment libres ou prédéterminés ?",
    short_en: "Are our choices truly free or predetermined?",
    category: "philosophy",
    wiki_url: "https://fr.wikipedia.org/wiki/Libre_arbitre",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🌍 CULTURE & SOCIÉTÉ (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Effet Streisand",
    term_en: "Streisand Effect",
    definition_fr:
      "Phénomène où la tentative de cacher ou censurer une information la rend paradoxalement beaucoup plus visible.",
    definition_en:
      "Phenomenon where attempting to hide or censor information paradoxically makes it much more visible.",
    short_fr: "Censurer une info la rend plus visible.",
    short_en: "Censoring information makes it more visible.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Streisand",
  },
  {
    term: "Fenêtre d'Overton",
    term_en: "Overton Window",
    definition_fr:
      "Spectre des idées considérées comme acceptables dans le discours public. Les idées évoluent de 'impensable' à 'politique'.",
    definition_en:
      "Spectrum of ideas considered acceptable in public discourse. Ideas evolve from 'unthinkable' to 'policy'.",
    short_fr: "Le spectre de ce qui est dicible en public.",
    short_en: "The spectrum of what's sayable in public.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Fen%C3%AAtre_d%27Overton",
  },
  {
    term: "Effet de meute",
    term_en: "Bandwagon Effect",
    definition_fr:
      "Tendance à adopter des comportements simplement parce que d'autres le font. Plus une idée est populaire, plus elle attire d'adhérents.",
    definition_en:
      "Tendency to adopt behaviors simply because others do. The more popular an idea, the more followers it attracts.",
    short_fr: "On suit la foule sans réfléchir.",
    short_en: "We follow the crowd without thinking.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_mode",
  },
  {
    term: "Pensée de groupe",
    term_en: "Groupthink",
    definition_fr:
      "Phénomène où le désir de conformité dans un groupe conduit à des décisions irrationnelles. Les membres évitent les conflits en supprimant les opinions divergentes.",
    definition_en:
      "Phenomenon where the desire for conformity in a group leads to irrational decisions. Members avoid conflict by suppressing dissenting opinions.",
    short_fr: "Le groupe étouffe la pensée critique individuelle.",
    short_en: "The group stifles individual critical thinking.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Pens%C3%A9e_de_groupe",
  },
  {
    term: "Capital culturel",
    term_en: "Cultural Capital",
    definition_fr:
      "Concept de Bourdieu désignant les connaissances et comportements qui confèrent un statut social.",
    definition_en:
      "Bourdieu's concept describing knowledge and behaviors that confer social status.",
    short_fr: "Les connaissances et codes culturels comme richesse sociale.",
    short_en: "Cultural knowledge and codes as social wealth.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Capital_culturel",
  },
  {
    term: "Prophétie autoréalisatrice",
    term_en: "Self-Fulfilling Prophecy",
    definition_fr:
      "Prédiction qui, par son simple énoncé, cause sa propre réalisation. Si une banque est perçue comme fragile, les clients retirent leur argent.",
    definition_en:
      "A prediction that, by being stated, causes its own fulfillment. If a bank is perceived as weak, customers withdraw their money.",
    short_fr: "Une croyance peut créer la réalité qu'elle prédit.",
    short_en: "A belief can create the reality it predicts.",
    category: "culture",
    wiki_url:
      "https://fr.wikipedia.org/wiki/Proph%C3%A9tie_autor%C3%A9alisatrice",
  },
  {
    term: "Chambre d'écho",
    term_en: "Echo Chamber",
    definition_fr:
      "Environnement où les opinions sont amplifiées par répétition au sein d'un système fermé. Les réseaux sociaux créent des bulles.",
    definition_en:
      "Environment where opinions are amplified through repetition within a closed system. Social networks create bubbles.",
    short_fr: "On n'entend que des opinions qui confirment les nôtres.",
    short_en: "We only hear opinions that confirm our own.",
    category: "culture",
    wiki_url:
      "https://fr.wikipedia.org/wiki/Chambre_d%27%C3%A9cho_(m%C3%A9dias)",
  },
  {
    term: "Tragédie des communs",
    term_en: "Tragedy of the Commons",
    definition_fr:
      "Situation où des individus agissant dans leur intérêt propre épuisent une ressource partagée, au détriment de tous.",
    definition_en:
      "Situation where individuals acting in their own interest deplete a shared resource, to everyone's detriment.",
    short_fr: "L'intérêt individuel épuise les ressources communes.",
    short_en: "Individual interest depletes common resources.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Trag%C3%A9die_des_biens_communs",
  },
  {
    term: "Loi de Goodhart",
    term_en: "Goodhart's Law",
    definition_fr:
      "Quand une mesure devient un objectif, elle cesse d'être une bonne mesure. Si les écoles sont jugées sur les notes, elles optimisent les notes, pas l'apprentissage.",
    definition_en:
      "When a measure becomes a target, it ceases to be a good measure. If schools are judged on grades, they optimize for grades, not learning.",
    short_fr: "Quand on vise l'indicateur, il perd son sens.",
    short_en: "When targeting the indicator, it loses its meaning.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Loi_de_Goodhart",
  },
  {
    term: "Normalisation de la déviance",
    term_en: "Normalization of Deviance",
    definition_fr:
      "Processus où des pratiques non conformes deviennent acceptables avec le temps. Les petites violations répétées redéfinissent ce qui est 'normal'.",
    definition_en:
      "Process where non-conforming practices become acceptable over time. Small repeated violations redefine what's 'normal'.",
    short_fr: "Les petites violations répétées deviennent la norme.",
    short_en: "Small repeated violations become the norm.",
    category: "culture",
    wiki_url: "https://fr.wikipedia.org/wiki/Normalisation_de_la_d%C3%A9viance",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎲 DIVERS FASCINANTS (10 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Pareidolie",
    term_en: "Pareidolia",
    definition_fr:
      "Tendance du cerveau à percevoir des formes familières (visages) dans des motifs aléatoires. C'est pourquoi on voit des visages dans les nuages.",
    definition_en:
      "Brain's tendency to perceive familiar shapes (faces) in random patterns. This is why we see faces in clouds.",
    short_fr: "Voir des visages partout, même là où il n'y en a pas.",
    short_en: "Seeing faces everywhere, even where there are none.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Par%C3%A9idolie",
  },
  {
    term: "Effet Zeigarnik",
    term_en: "Zeigarnik Effect",
    definition_fr:
      "Tendance à mieux se souvenir des tâches inachevées que des tâches terminées. C'est pourquoi les cliffhangers fonctionnent.",
    definition_en:
      "Tendency to remember unfinished tasks better than completed ones. This is why cliffhangers work.",
    short_fr: "Les tâches inachevées restent en mémoire.",
    short_en: "Unfinished tasks stay in memory.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Zeigarnik",
  },
  {
    term: "Sérendipité",
    term_en: "Serendipity",
    definition_fr:
      "Découverte heureuse faite par hasard. La pénicilline, le micro-ondes et le Post-it sont des inventions sérendipiteuses.",
    definition_en:
      "A fortunate discovery made by chance. Penicillin, the microwave, and Post-it notes are serendipitous inventions.",
    short_fr: "Faire une découverte heureuse par hasard.",
    short_en: "Making a fortunate discovery by chance.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/S%C3%A9rendipit%C3%A9",
  },
  {
    term: "Hypnagogique",
    term_en: "Hypnagogic",
    definition_fr:
      "État de conscience transitoire entre l'éveil et le sommeil. Cet état s'accompagne souvent d'hallucinations et d'insights créatifs.",
    definition_en:
      "Transitional state of consciousness between wakefulness and sleep. Often accompanied by hallucinations and creative insights.",
    short_fr: "L'état créatif entre l'éveil et le sommeil.",
    short_en: "The creative state between waking and sleeping.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Hypnagogie",
  },
  {
    term: "Apophénie",
    term_en: "Apophenia",
    definition_fr:
      "Tendance à percevoir des connexions significatives entre des phénomènes non liés. Base des théories conspirationnistes.",
    definition_en:
      "Tendency to perceive meaningful connections between unrelated phenomena. Basis of conspiracy theories.",
    short_fr: "Voir des connexions là où il n'y en a pas.",
    short_en: "Seeing connections where there are none.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Apoph%C3%A9nie",
  },
  {
    term: "Jamais-vu",
    term_en: "Jamais Vu",
    definition_fr:
      "Contraire du déjà-vu : sentiment d'étrangeté face à une situation familière. Répétez un mot 30 fois : il deviendra méconnaissable.",
    definition_en:
      "Opposite of déjà vu: feeling of strangeness towards a familiar situation. Repeat a word 30 times: it becomes unrecognizable.",
    short_fr: "Quand le familier devient soudain étrange.",
    short_en: "When the familiar suddenly becomes strange.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Jamais-vu",
  },
  {
    term: "Flow",
    term_en: "Flow State",
    definition_fr:
      "État mental d'immersion totale dans une activité, avec concentration intense et perte de la notion du temps.",
    definition_en:
      "Mental state of complete immersion in an activity, with intense focus and loss of time awareness.",
    short_fr: "L'état d'immersion totale où le temps disparaît.",
    short_en: "The state of total immersion where time disappears.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Flow_(psychologie)",
  },
  {
    term: "Effet Pygmalion",
    term_en: "Pygmalion Effect",
    definition_fr:
      "Les attentes élevées des autres améliorent nos performances. Les élèves dont les professeurs croient qu'ils sont brillants obtiennent de meilleurs résultats.",
    definition_en:
      "High expectations from others improve our performance. Students whose teachers believe they are brilliant achieve better results.",
    short_fr: "Les attentes des autres façonnent nos performances.",
    short_en: "Others' expectations shape our performance.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Pygmalion",
  },
  {
    term: "Syndrome de l'imposteur",
    term_en: "Impostor Syndrome",
    definition_fr:
      "Sentiment persistant de ne pas mériter son succès, accompagné de la peur d'être 'démasqué'. Paradoxalement, il touche souvent les plus compétents.",
    definition_en:
      "Persistent feeling of not deserving one's success, accompanied by fear of being 'found out'. Paradoxically, it often affects the most competent.",
    short_fr: "Croire qu'on ne mérite pas son succès.",
    short_en: "Believing you don't deserve your success.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Syndrome_de_l%27imposteur",
  },
  {
    term: "Effet IKEA",
    term_en: "IKEA Effect",
    definition_fr:
      "Tendance à surévaluer les produits qu'on a partiellement créés soi-même. On aime davantage le meuble qu'on a monté.",
    definition_en:
      "Tendency to overvalue products we partially created ourselves. We like the furniture we assembled more.",
    short_fr: "On aime plus ce qu'on a créé soi-même.",
    short_en: "We value what we created ourselves more.",
    category: "misc",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_IKEA",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🧩 PSYCHOLOGIE (5 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Effet de projecteur",
    term_en: "Spotlight Effect",
    definition_fr:
      "Tendance à surestimer l'attention que les autres portent à notre apparence et à nos actions. En réalité, les gens nous remarquent bien moins qu'on ne le croit.",
    definition_en:
      "Tendency to overestimate how much others notice our appearance and actions. In reality, people notice us far less than we think.",
    short_fr: "On surestime l'attention des autres sur nous.",
    short_en: "We overestimate how much others notice us.",
    category: "psychology",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_projecteur",
  },
  {
    term: "Biais de négativité",
    term_en: "Negativity Bias",
    definition_fr:
      "Tendance psychologique à accorder plus de poids aux expériences négatives qu'aux positives. Un seul commentaire négatif peut annuler dix compliments.",
    definition_en:
      "Psychological tendency to give more weight to negative experiences than positive ones. A single negative comment can outweigh ten compliments.",
    short_fr: "Le négatif nous marque plus que le positif.",
    short_en: "The negative affects us more than the positive.",
    category: "psychology",
    wiki_url: "https://fr.wikipedia.org/wiki/Biais_de_n%C3%A9gativit%C3%A9",
  },
  {
    term: "Effet Pratfall",
    term_en: "Pratfall Effect",
    definition_fr:
      "Phénomène où une personne perçue comme compétente devient plus sympathique après avoir commis une maladresse. L'imperfection humanise.",
    definition_en:
      "Phenomenon where a person perceived as competent becomes more likeable after making a blunder. Imperfection humanizes.",
    short_fr: "Une maladresse rend les gens compétents plus sympathiques.",
    short_en: "A blunder makes competent people more likeable.",
    category: "psychology",
    wiki_url: "https://en.wikipedia.org/wiki/Pratfall_effect",
  },
  {
    term: "Fenêtre de tolérance",
    term_en: "Window of Tolerance",
    definition_fr:
      "Zone optimale d'activation émotionnelle dans laquelle on peut fonctionner efficacement. En dehors, on bascule en hyperactivation (anxiété) ou hypoactivation (shutdown).",
    definition_en:
      "Optimal zone of emotional arousal where we can function effectively. Outside it, we shift to hyperarousal (anxiety) or hypoarousal (shutdown).",
    short_fr: "La zone émotionnelle où l'on fonctionne le mieux.",
    short_en: "The emotional zone where we function best.",
    category: "psychology",
    wiki_url: "https://en.wikipedia.org/wiki/Window_of_tolerance",
  },
  {
    term: "Effet de simple mesure",
    term_en: "Mere Measurement Effect",
    definition_fr:
      "Le simple fait de demander à quelqu'un s'il va faire quelque chose augmente la probabilité qu'il le fasse. Mesurer un comportement le modifie.",
    definition_en:
      "Simply asking someone if they will do something increases the probability they'll do it. Measuring behavior changes it.",
    short_fr: "Poser la question influence le comportement.",
    short_en: "Asking the question influences behavior.",
    category: "psychology",
    wiki_url: "https://en.wikipedia.org/wiki/Mere_measurement_effect",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 💰 ÉCONOMIE & STRATÉGIE (5 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Destruction créatrice",
    term_en: "Creative Destruction",
    definition_fr:
      "Concept de Schumpeter : le progrès économique détruit les anciennes structures pour en créer de nouvelles. L'automobile a tué le cheval, le smartphone a tué le GPS.",
    definition_en:
      "Schumpeter's concept: economic progress destroys old structures to create new ones. The car killed the horse, the smartphone killed the GPS.",
    short_fr: "L'innovation détruit l'ancien pour construire le nouveau.",
    short_en: "Innovation destroys the old to build the new.",
    category: "economics",
    wiki_url: "https://fr.wikipedia.org/wiki/Destruction_cr%C3%A9atrice",
  },
  {
    term: "Coût irrécupérable",
    term_en: "Sunk Cost Fallacy",
    definition_fr:
      "Erreur consistant à poursuivre un investissement à cause de ce qu'on a déjà dépensé, plutôt que de juger objectivement les bénéfices futurs.",
    definition_en:
      "Error of continuing an investment because of what's already been spent, rather than objectively judging future benefits.",
    short_fr: "On s'entête parce qu'on a déjà trop investi.",
    short_en: "We persist because we've already invested too much.",
    category: "economics",
    wiki_url: "https://fr.wikipedia.org/wiki/Co%C3%BBt_irr%C3%A9cup%C3%A9rable",
  },
  {
    term: "Paradoxe de l'abondance",
    term_en: "Paradox of Choice",
    definition_fr:
      "Avoir trop de choix provoque de l'anxiété et de l'insatisfaction. Plus les options sont nombreuses, plus il est difficile de décider et d'être satisfait.",
    definition_en:
      "Having too many choices causes anxiety and dissatisfaction. The more options available, the harder it is to decide and be satisfied.",
    short_fr: "Trop de choix paralyse et rend insatisfait.",
    short_en: "Too many choices paralyze and dissatisfy.",
    category: "economics",
    wiki_url: "https://fr.wikipedia.org/wiki/Paradoxe_du_choix",
  },
  {
    term: "Effet de réseau",
    term_en: "Network Effect",
    definition_fr:
      "Phénomène où la valeur d'un produit augmente avec le nombre d'utilisateurs. Le téléphone est inutile seul, indispensable à des milliards.",
    definition_en:
      "Phenomenon where a product's value increases with the number of users. A phone is useless alone, indispensable with billions.",
    short_fr: "Plus il y a d'utilisateurs, plus le produit a de valeur.",
    short_en: "The more users, the more valuable the product.",
    category: "economics",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_de_r%C3%A9seau",
  },
  {
    term: "Asymétrie d'information",
    term_en: "Information Asymmetry",
    definition_fr:
      "Situation où une partie d'une transaction possède plus d'informations que l'autre. Le vendeur de voitures d'occasion en sait plus que l'acheteur.",
    definition_en:
      "Situation where one party in a transaction has more information than the other. A used car seller knows more than the buyer.",
    short_fr: "Quand l'un sait plus que l'autre dans un échange.",
    short_en: "When one party knows more than the other in a deal.",
    category: "economics",
    wiki_url: "https://fr.wikipedia.org/wiki/Asym%C3%A9trie_d%27information",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📜 HISTOIRE & CIVILISATION (5 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Effet Lindy",
    term_en: "Lindy Effect",
    definition_fr:
      "Plus une idée ou une technologie a survécu longtemps, plus son espérance de vie future est élevée. Un livre lu depuis 500 ans sera probablement lu dans 500 ans.",
    definition_en:
      "The longer an idea or technology has survived, the higher its future life expectancy. A book read for 500 years will likely be read in 500 years.",
    short_fr: "Ce qui dure depuis longtemps durera encore longtemps.",
    short_en: "What has lasted long will likely last longer.",
    category: "history",
    wiki_url: "https://en.wikipedia.org/wiki/Lindy_effect",
  },
  {
    term: "Effet Mandela",
    term_en: "Mandela Effect",
    definition_fr:
      "Phénomène de faux souvenirs collectifs, où un grand nombre de personnes partagent le même souvenir erroné d'un événement ou d'un détail.",
    definition_en:
      "Phenomenon of collective false memories, where many people share the same incorrect memory of an event or detail.",
    short_fr: "Des souvenirs collectifs... qui sont faux.",
    short_en: "Collective memories... that are false.",
    category: "history",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Mandela",
  },
  {
    term: "Loi de Brandolini",
    term_en: "Brandolini's Law",
    definition_fr:
      "La quantité d'énergie nécessaire pour réfuter une bêtise est d'un ordre de grandeur supérieur à celle nécessaire pour la produire. Aussi appelée 'loi de l'asymétrie du bullshit'.",
    definition_en:
      "The energy needed to refute nonsense is an order of magnitude greater than that needed to produce it. Also called the 'bullshit asymmetry principle'.",
    short_fr: "Il est plus facile de dire une bêtise que de la réfuter.",
    short_en: "It's easier to produce nonsense than to refute it.",
    category: "history",
    wiki_url: "https://fr.wikipedia.org/wiki/Loi_de_Brandolini",
  },
  {
    term: "Érosion normative",
    term_en: "Normative Erosion",
    definition_fr:
      "Processus graduel par lequel les normes sociales ou institutionnelles perdent leur force contraignante. Chaque petite transgression tolérée abaisse le seuil d'acceptabilité.",
    definition_en:
      "Gradual process by which social or institutional norms lose their binding force. Each tolerated small transgression lowers the acceptability threshold.",
    short_fr:
      "Les normes s'affaiblissent quand on tolère les petites transgressions.",
    short_en: "Norms weaken when small transgressions are tolerated.",
    category: "history",
    wiki_url: "https://en.wikipedia.org/wiki/Norm_(philosophy)",
  },
  {
    term: "Spirale du silence",
    term_en: "Spiral of Silence",
    definition_fr:
      "Théorie selon laquelle les individus taisent leurs opinions quand ils les perçoivent comme minoritaires, renforçant l'apparente domination de l'opinion majoritaire.",
    definition_en:
      "Theory that individuals silence their opinions when they perceive them as minority views, reinforcing the apparent dominance of the majority opinion.",
    short_fr: "On se tait quand on se croit en minorité.",
    short_en: "We stay silent when we think we're in the minority.",
    category: "history",
    wiki_url: "https://fr.wikipedia.org/wiki/Spirale_du_silence",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ⚡ TECHNOLOGIE & NUMÉRIQUE (5 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Loi de Moore",
    term_en: "Moore's Law",
    definition_fr:
      "Observation selon laquelle le nombre de transistors dans un circuit intégré double environ tous les deux ans, entraînant une croissance exponentielle de la puissance de calcul.",
    definition_en:
      "Observation that the number of transistors in an integrated circuit doubles approximately every two years, leading to exponential growth in computing power.",
    short_fr: "La puissance des ordinateurs double tous les deux ans.",
    short_en: "Computing power doubles every two years.",
    category: "technology",
    wiki_url: "https://fr.wikipedia.org/wiki/Loi_de_Moore",
  },
  {
    term: "Effet de bulle de filtre",
    term_en: "Filter Bubble",
    definition_fr:
      "Phénomène où les algorithmes de personnalisation enferment l'utilisateur dans une bulle informationnelle, ne lui montrant que du contenu conforme à ses préférences existantes.",
    definition_en:
      "Phenomenon where personalization algorithms trap users in an information bubble, showing only content aligned with their existing preferences.",
    short_fr: "Les algorithmes nous enferment dans nos propres opinions.",
    short_en: "Algorithms trap us in our own opinions.",
    category: "technology",
    wiki_url: "https://fr.wikipedia.org/wiki/Bulle_de_filtre",
  },
  {
    term: "Loi de Metcalfe",
    term_en: "Metcalfe's Law",
    definition_fr:
      "La valeur d'un réseau de télécommunications est proportionnelle au carré du nombre de ses utilisateurs connectés. Chaque nouvel utilisateur enrichit le réseau pour tous les autres.",
    definition_en:
      "The value of a telecommunications network is proportional to the square of the number of connected users. Each new user enriches the network for everyone else.",
    short_fr: "La valeur d'un réseau croît au carré de ses utilisateurs.",
    short_en: "A network's value grows as the square of its users.",
    category: "technology",
    wiki_url: "https://fr.wikipedia.org/wiki/Loi_de_Metcalfe",
  },
  {
    term: "Vallée de l'étrange",
    term_en: "Uncanny Valley",
    definition_fr:
      "Réaction de malaise provoquée par des robots ou avatars qui ressemblent presque parfaitement à des humains, sans y parvenir tout à fait.",
    definition_en:
      "Feeling of unease caused by robots or avatars that look almost perfectly human, but not quite.",
    short_fr:
      "Plus un robot ressemble à un humain, plus il nous met mal à l'aise.",
    short_en: "The more a robot looks human, the more uneasy we feel.",
    category: "technology",
    wiki_url: "https://fr.wikipedia.org/wiki/Vall%C3%A9e_d%C3%A9rangeante",
  },
  {
    term: "Obsolescence programmée",
    term_en: "Planned Obsolescence",
    definition_fr:
      "Stratégie de conception visant à limiter délibérément la durée de vie d'un produit pour forcer le renouvellement. Une pratique controversée de l'industrie technologique.",
    definition_en:
      "Design strategy aimed at deliberately limiting a product's lifespan to force renewal. A controversial practice in the tech industry.",
    short_fr: "Les produits sont conçus pour tomber en panne.",
    short_en: "Products are designed to break down.",
    category: "technology",
    wiki_url: "https://fr.wikipedia.org/wiki/Obsolescence_programm%C3%A9e",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 ART & CRÉATIVITÉ (5 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Wabi-sabi",
    term_en: "Wabi-Sabi",
    definition_fr:
      "Esthétique japonaise qui trouve la beauté dans l'imperfection, l'impermanence et l'incomplétude. Un bol fissuré réparé à l'or (kintsugi) incarne cette philosophie.",
    definition_en:
      "Japanese aesthetics that finds beauty in imperfection, impermanence, and incompleteness. A cracked bowl repaired with gold (kintsugi) embodies this philosophy.",
    short_fr: "La beauté dans l'imperfection et l'éphémère.",
    short_en: "Beauty in imperfection and the ephemeral.",
    category: "art",
    wiki_url: "https://fr.wikipedia.org/wiki/Wabi-sabi",
  },
  {
    term: "Synesthésie",
    term_en: "Synesthesia",
    definition_fr:
      "Condition neurologique où la stimulation d'un sens provoque automatiquement une perception dans un autre sens. Certaines personnes 'voient' les sons ou 'goûtent' les mots.",
    definition_en:
      "Neurological condition where stimulation of one sense automatically triggers a perception in another. Some people 'see' sounds or 'taste' words.",
    short_fr: "Quand les sens se mélangent : voir les sons, goûter les mots.",
    short_en: "When senses mix: seeing sounds, tasting words.",
    category: "art",
    wiki_url: "https://fr.wikipedia.org/wiki/Synesth%C3%A9sie",
  },
  {
    term: "Horror vacui",
    term_en: "Horror Vacui",
    definition_fr:
      "Peur du vide en art et en design. Tendance à remplir chaque espace disponible de détails, ornements ou informations. L'opposé du minimalisme.",
    definition_en:
      "Fear of empty space in art and design. Tendency to fill every available space with details, ornaments, or information. The opposite of minimalism.",
    short_fr: "La peur du vide pousse à tout remplir.",
    short_en: "Fear of emptiness drives us to fill everything.",
    category: "art",
    wiki_url: "https://fr.wikipedia.org/wiki/Horror_vacui",
  },
  {
    term: "Catharsis",
    term_en: "Catharsis",
    definition_fr:
      "Purification émotionnelle à travers l'art, décrite par Aristote. Le fait de vivre des émotions intenses à travers la fiction nous libère et nous apaise.",
    definition_en:
      "Emotional purification through art, described by Aristotle. Experiencing intense emotions through fiction liberates and soothes us.",
    short_fr:
      "L'art nous libère en nous faisant ressentir des émotions intenses.",
    short_en: "Art liberates us by making us feel intense emotions.",
    category: "art",
    wiki_url: "https://fr.wikipedia.org/wiki/Catharsis",
  },
  {
    term: "Anamorphose",
    term_en: "Anamorphosis",
    definition_fr:
      "Image déformée qui ne se révèle correctement que vue sous un angle précis ou à travers un dispositif optique. Un jeu entre illusion et réalité.",
    definition_en:
      "Distorted image that only appears correct when viewed from a specific angle or through an optical device. A play between illusion and reality.",
    short_fr: "Une image qui change selon l'angle de vue.",
    short_en: "An image that changes depending on the viewing angle.",
    category: "art",
    wiki_url: "https://fr.wikipedia.org/wiki/Anamorphose",
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🌿 NATURE & VIVANT (5 mots)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    term: "Biomimétisme",
    term_en: "Biomimicry",
    definition_fr:
      "Démarche d'innovation qui s'inspire des formes, processus et écosystèmes naturels pour résoudre des problèmes humains. Le velcro imite les crochets de la bardane.",
    definition_en:
      "Innovation approach inspired by natural forms, processes, and ecosystems to solve human problems. Velcro imitates burdock hooks.",
    short_fr: "S'inspirer de la nature pour innover.",
    short_en: "Drawing inspiration from nature to innovate.",
    category: "nature",
    wiki_url: "https://fr.wikipedia.org/wiki/Biomim%C3%A9tisme",
  },
  {
    term: "Symbiose",
    term_en: "Symbiosis",
    definition_fr:
      "Association durable entre deux organismes d'espèces différentes, bénéfique pour les deux. Le lichen est une symbiose entre un champignon et une algue.",
    definition_en:
      "Lasting association between two organisms of different species, beneficial for both. Lichen is a symbiosis between a fungus and an alga.",
    short_fr: "Deux espèces qui vivent ensemble pour leur bénéfice mutuel.",
    short_en: "Two species living together for mutual benefit.",
    category: "nature",
    wiki_url: "https://fr.wikipedia.org/wiki/Symbiose",
  },
  {
    term: "Intelligence collective",
    term_en: "Swarm Intelligence",
    definition_fr:
      "Capacité d'un groupe d'agents simples à résoudre des problèmes complexes sans coordination centrale. Les fourmis, les abeilles et les bancs de poissons en sont des exemples.",
    definition_en:
      "Ability of simple agents to solve complex problems without central coordination. Ants, bees, and schools of fish are examples.",
    short_fr:
      "Des individus simples créent ensemble une intelligence complexe.",
    short_en: "Simple individuals together create complex intelligence.",
    category: "nature",
    wiki_url: "https://fr.wikipedia.org/wiki/Intelligence_collective",
  },
  {
    term: "Effet Allee",
    term_en: "Allee Effect",
    definition_fr:
      "Phénomène écologique où la survie d'une espèce diminue quand la population devient trop petite. En dessous d'un seuil critique, l'extinction s'accélère.",
    definition_en:
      "Ecological phenomenon where a species' survival decreases when the population becomes too small. Below a critical threshold, extinction accelerates.",
    short_fr: "Trop peu d'individus accélère l'extinction d'une espèce.",
    short_en: "Too few individuals accelerate a species' extinction.",
    category: "nature",
    wiki_url: "https://fr.wikipedia.org/wiki/Effet_Allee",
  },
  {
    term: "Panspermie",
    term_en: "Panspermia",
    definition_fr:
      "Hypothèse selon laquelle la vie sur Terre proviendrait de micro-organismes extraterrestres transportés par des météorites ou de la poussière cosmique.",
    definition_en:
      "Hypothesis that life on Earth originated from extraterrestrial microorganisms transported by meteorites or cosmic dust.",
    short_fr: "La vie sur Terre viendrait peut-être de l'espace.",
    short_en: "Life on Earth may have come from space.",
    category: "nature",
    wiki_url: "https://fr.wikipedia.org/wiki/Panspermie",
  },
];

/**
 * Retourne un mot aléatoire, en excluant certains termes si spécifié
 */
export function getRandomWord(excludeTerms: string[] = []): WordData {
  const available =
    excludeTerms.length > 0
      ? DEFAULT_WORDS.filter(
          (w) =>
            !excludeTerms.includes(w.term) && !excludeTerms.includes(w.term_en),
        )
      : DEFAULT_WORDS;

  return available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
}

/**
 * Retourne un mot aléatoire biaisé vers une catégorie spécifique
 * 70% de chance de retourner un mot de la catégorie donnée, 30% random
 */
export function getWordByCategory(
  category: string,
  excludeTerms: string[] = [],
): WordData {
  const roll = Math.random();
  if (roll < 0.7) {
    const categoryWords = DEFAULT_WORDS.filter(
      (w) =>
        w.category === category &&
        !excludeTerms.includes(w.term) &&
        !excludeTerms.includes(w.term_en),
    );
    if (categoryWords.length > 0) {
      return categoryWords[Math.floor(Math.random() * categoryWords.length)];
    }
  }
  return getRandomWord(excludeTerms);
}

/**
 * Retourne les catégories disponibles
 */
export function getCategories(): string[] {
  return [...new Set(DEFAULT_WORDS.map((w) => w.category))];
}
