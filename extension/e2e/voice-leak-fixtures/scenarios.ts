// extension/e2e/voice-leak-fixtures/scenarios.ts
//
// Fifty Quick Voice Call conversation fixtures used by
// ``voice-prompt-leak-detection.spec.ts``. Each fixture describes a
// realistic call against a YouTube video — title, channel, language,
// duration tier, topic — together with a sequence of user voice messages.
//
// The fixtures intentionally span :
//   * Languages    : 25 FR + 25 EN
//   * Durations    : short (≤ 8 min) ↔ long (~30 min) — tagged ``short`` / ``long``
//   * Topics       : tech, science, history, politics, philo, finance,
//                    cuisine, sport, gaming, art, current events.
//   * User intent  : factual, opinion, follow-up, "what time does X say Y"
//                    (which is the most likely path to make the agent
//                    leak transcript-chunk references).
//
// The shape is kept deliberately small and pure-data: no SDK type, no
// React import — so the fixture can be consumed by the Playwright spec
// AND a Node-only ``ts-node`` runner if we ever decide to bench leak
// rates outside the browser harness.
//
// IMPORTANT — leak detector input shape :
//   Each scenario also embeds a ``mockAgentReplies`` array — one reply per
//   user turn. These replies are what the *deterministic mock agent*
//   (see ``voice-leak-utils/mock-voice-agent.ts``) returns when the live
//   LLM is unavailable. They are crafted to be CLEAN (no forbidden token)
//   so the mocked variant of the test exercises the full pipeline and the
//   leak detector in the negative case (i.e. all 50 conversations should
//   pass).
//
//   A separate ``LEAKY_CONTROL_FIXTURES`` array at the bottom contains
//   intentionally-leaky replies that the detector MUST flag — those are
//   driven by a different test in the spec to validate the detector
//   itself doesn't false-negative.

export type Language = "fr" | "en";
export type Duration = "short" | "long";

export interface UserTurn {
  /** What the simulated user says. */
  user: string;
  /** Phase the side panel is in when the user speaks. */
  phase: "startup" | "streaming" | "complete" | "failed";
}

export interface Scenario {
  id: string;
  language: Language;
  duration: Duration;
  /** Synthetic but plausible YouTube video id (11 chars). */
  videoId: string;
  /** Channel name (cosmetic). */
  channel: string;
  /** Title — the agent only sees title + channel during ``startup``. */
  title: string;
  /** Topic tag for reporting. */
  topic: string;
  /** User voice turns, in order. */
  turns: UserTurn[];
  /**
   * Canned mock-agent replies, one per turn. Crafted to be clean (no
   * forbidden token). The live variant of the test ignores this field
   * and asks a real LLM instead — but we keep it co-located with the
   * scenario to make scenario authoring self-contained.
   */
  mockAgentReplies: string[];
}

// Simple deterministic ID helper — keeps the file readable.
const v = (n: number): string =>
  `vid${n.toString().padStart(8, "0")}`.slice(0, 11);

// ─────────────────────────────────────────────────────────────────────────────
// FR scenarios — 25
// ─────────────────────────────────────────────────────────────────────────────

const FR_SCENARIOS: Scenario[] = [
  {
    id: "fr-01-tech-short",
    language: "fr",
    duration: "short",
    videoId: v(1),
    channel: "Tech Insider FR",
    title: "Comment fonctionne réellement le chiffrement RSA",
    topic: "tech/cryptography",
    turns: [
      { user: "Salut, c'est quoi l'idée principale ?", phase: "startup" },
      { user: "Et la clé publique elle sert à quoi exactement ?", phase: "streaming" },
      { user: "Tu peux me donner un exemple concret ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Le RSA c'est un chiffrement asymétrique basé sur la difficulté de factoriser de grands nombres premiers. L'idée clé : ce qui est chiffré avec une clé peut être déchiffré uniquement par l'autre.",
      "D'après ce que j'écoute pour l'instant, la clé publique sert à chiffrer les messages que tu envoies. N'importe qui peut l'utiliser, mais seul le détenteur de la clé privée peut déchiffrer.",
      "Maintenant que j'ai tout le contexte, voici un exemple : quand tu te connectes à ton site bancaire, ton navigateur récupère la clé publique du serveur, chiffre une clé de session et l'envoie. Le serveur la déchiffre avec sa clé privée.",
    ],
  },
  {
    id: "fr-02-science-long",
    language: "fr",
    duration: "long",
    videoId: v(2),
    channel: "ScienceClic",
    title: "L'origine de la matière noire — 30 ans de recherche",
    topic: "science/cosmology",
    turns: [
      { user: "Bonjour, dis-moi en deux mots de quoi ça parle.", phase: "startup" },
      { user: "Quelles sont les preuves observationnelles ?", phase: "streaming" },
      { user: "Et l'hypothèse MOND alors ?", phase: "streaming" },
      { user: "À quel moment de la vidéo il parle des amas de galaxies ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Bonjour ! La matière noire est une forme d'énergie qui n'émet pas de lumière mais représenterait 85% de la masse de l'univers. Sujet passionnant.",
      "D'après ce que j'écoute pour l'instant, les preuves principales sont la vitesse de rotation des galaxies, le lensing gravitationnel, et le fond diffus cosmologique.",
      "MOND propose de modifier la gravité plutôt que d'ajouter de la matière. C'est une alternative intéressante mais elle peine à expliquer les amas de galaxies.",
      "Maintenant que j'ai tout le contexte, vers 18 minutes la vidéo aborde les amas de galaxies, notamment le Bullet Cluster qui reste l'argument le plus fort en faveur de la matière noire.",
    ],
  },
  {
    id: "fr-03-history-short",
    language: "fr",
    duration: "short",
    videoId: v(3),
    channel: "Nota Bene",
    title: "La chute de Constantinople en 1453, racontée minute par minute",
    topic: "history/medieval",
    turns: [
      { user: "Vas-y, présente-moi rapidement.", phase: "startup" },
      { user: "C'est qui Mehmed II ?", phase: "streaming" },
      { user: "Combien de temps a duré le siège ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Constantinople tombe le 29 mai 1453 après un siège de 53 jours, mettant fin à l'Empire byzantin. Un tournant majeur dans l'histoire.",
      "Mehmed II, dit le Conquérant, est sultan ottoman. Il a 21 ans en 1453. Il dirige personnellement le siège avec une innovation : des canons géants conçus par Urbain.",
      "Maintenant que j'ai tout le contexte, le siège dure du 6 avril au 29 mai 1453, soit environ 53 jours.",
    ],
  },
  {
    id: "fr-04-philo-long",
    language: "fr",
    duration: "long",
    videoId: v(4),
    channel: "Mr Phi",
    title: "Le libre arbitre existe-t-il vraiment ?",
    topic: "philo/freewill",
    turns: [
      { user: "Bonjour, c'est quoi le sujet ?", phase: "startup" },
      { user: "Quelle est la thèse défendue ?", phase: "streaming" },
      { user: "Et Spinoza dans tout ça ?", phase: "streaming" },
      { user: "Maintenant que tu as tout vu, tu en penses quoi ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hello ! Question philo classique mais brûlante. Avec les neurosciences modernes, le débat est plus vif que jamais.",
      "D'après ce que j'écoute, la vidéo défend une position compatibiliste : le libre arbitre existe, mais comme capacité d'agir selon nos raisons, pas comme indépendance causale.",
      "Spinoza est cité comme un précurseur de la position déterministe : nous nous croyons libres parce que nous ignorons les causes qui nous déterminent.",
      "Maintenant que j'ai tout le contexte, l'auteur conclut sur une position nuancée : abandonner l'illusion d'un libre arbitre absolu, mais préserver une responsabilité morale fondée sur les raisons et la délibération.",
    ],
  },
  {
    id: "fr-05-cuisine-short",
    language: "fr",
    duration: "short",
    videoId: v(5),
    channel: "Chef Michel",
    title: "La vraie recette du bœuf bourguignon — comme à Beaune",
    topic: "cooking/french",
    turns: [
      { user: "Salut, c'est quoi le secret du chef ?", phase: "startup" },
      { user: "Combien de temps il faut faire mariner la viande ?", phase: "streaming" },
      { user: "Quelle pièce de bœuf utiliser ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Le bœuf bourguignon, plat emblématique. Le secret du chef c'est souvent la patience : marinade longue + cuisson lente.",
      "D'après ce que j'écoute, il recommande une marinade de 24h dans un vin rouge corsé avec aromates, oignons et carottes.",
      "Maintenant que j'ai tout le contexte, il préconise paleron ou macreuse pour le moelleux, jamais de l'aiguillette qui dessèche.",
    ],
  },
  {
    id: "fr-06-finance-long",
    language: "fr",
    duration: "long",
    videoId: v(6),
    channel: "Heu?reka",
    title: "L'inflation, comment ça marche vraiment",
    topic: "finance/macro",
    turns: [
      { user: "Présente-moi le truc.", phase: "startup" },
      { user: "C'est quoi la masse monétaire ?", phase: "streaming" },
      { user: "Pourquoi la BCE remonte les taux ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Yo ! L'inflation, c'est la hausse générale des prix dans le temps. On va voir comment ça se mesure et qui la pilote.",
      "D'après ce que j'écoute, la masse monétaire c'est la quantité totale de monnaie en circulation. Quand elle augmente trop vite, les prix grimpent.",
      "Maintenant que j'ai tout le contexte, la BCE remonte les taux pour réduire l'attractivité du crédit, ce qui ralentit la consommation et fait baisser les prix.",
    ],
  },
  {
    id: "fr-07-politics-long",
    language: "fr",
    duration: "long",
    videoId: v(7),
    channel: "Le Monde",
    title: "Les coulisses de la COP28 — qui décide vraiment ?",
    topic: "politics/climate",
    turns: [
      { user: "Salut, c'est quoi le pitch ?", phase: "startup" },
      { user: "Qui a poussé pour le texte final ?", phase: "streaming" },
      { user: "Tu cites quoi comme acteurs ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Bonjour ! Bonne question de fond. Les COP sont des négos internationales où chaque mot compte.",
      "D'après ce que j'écoute, le compromis final a été poussé par l'Union européenne et les petits États insulaires, contre la résistance de pays producteurs.",
      "Maintenant que j'ai tout le contexte, les acteurs clés sont : la présidence émirienne, l'UE, le High Ambition Coalition et le bloc des pays pétroliers.",
    ],
  },
  {
    id: "fr-08-tech-short",
    language: "fr",
    duration: "short",
    videoId: v(8),
    channel: "Underscore_",
    title: "Pourquoi Rust est-il si populaire chez les devs ?",
    topic: "tech/programming",
    turns: [
      { user: "Salut, dis-moi en quelques mots.", phase: "startup" },
      { user: "Le borrow checker, c'est quoi le concept ?", phase: "streaming" },
      { user: "Y a-t-il une perf comparable au C++ ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Rust est un langage système qui combine sécurité mémoire et perfs C++. Sans GC. Très demandé en industrie.",
      "D'après ce que j'écoute, le borrow checker est le composant qui vérifie au compile-time qui possède quoi et qui peut emprunter. Il élimine une grande classe de bugs mémoire.",
      "Maintenant que j'ai tout le contexte, oui, dans la plupart des benchmarks Rust est à parité avec le C++, parfois plus rapide grâce à l'inlining et aux abstractions zéro-coût.",
    ],
  },
  {
    id: "fr-09-sport-short",
    language: "fr",
    duration: "short",
    videoId: v(9),
    channel: "RMC Sport",
    title: "Le but de Zidane en finale 2002 — analyse tactique",
    topic: "sport/football",
    turns: [
      { user: "Pose le contexte stp.", phase: "startup" },
      { user: "Pourquoi cette frappe est légendaire ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Yo ! Finale Champions League 2002, Real Madrid vs Bayer Leverkusen, à Glasgow. Zidane à son apogée.",
      "Maintenant que j'ai tout le contexte, c'est une volée du gauche depuis l'angle de la surface, un geste techniquement très difficile que peu de joueurs réussissent en finale.",
    ],
  },
  {
    id: "fr-10-art-long",
    language: "fr",
    duration: "long",
    videoId: v(10),
    channel: "Nart",
    title: "Comprendre Picasso en 30 minutes",
    topic: "art/cubism",
    turns: [
      { user: "Présente-moi.", phase: "startup" },
      { user: "C'est quoi la période rose ?", phase: "streaming" },
      { user: "Et Guernica, dans cette logique ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Bonjour ! Picasso, figure majeure du XXe siècle. Sa carrière traverse plusieurs périodes radicalement différentes.",
      "D'après ce que j'écoute, la période rose s'étend de 1904 à 1906, après la période bleue. Tons chauds, ocres, sujets de cirque, saltimbanques.",
      "Maintenant que j'ai tout le contexte, Guernica appartient à la période d'engagement politique, après le cubisme. C'est sa réponse au bombardement de la ville par l'aviation nazie en 1937.",
    ],
  },
  {
    id: "fr-11-music-short",
    language: "fr",
    duration: "short",
    videoId: v(11),
    channel: "Akantor",
    title: "Pourquoi Beethoven a révolutionné la symphonie",
    topic: "music/classical",
    turns: [
      { user: "Lance-toi, je t'écoute.", phase: "startup" },
      { user: "La 9e, en quoi elle est spéciale ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Beethoven, charnière entre classicisme et romantisme. Ses symphonies marquent un changement d'échelle radical.",
      "Maintenant que j'ai tout le contexte, la 9e symphonie introduit pour la première fois un chœur dans une symphonie classique, ce qui était inédit en 1824.",
    ],
  },
  {
    id: "fr-12-gaming-short",
    language: "fr",
    duration: "short",
    videoId: v(12),
    channel: "Bazar du Grenier",
    title: "Pourquoi Half-Life 2 reste un chef-d'œuvre",
    topic: "gaming/fps",
    turns: [
      { user: "Le sujet ?", phase: "startup" },
      { user: "C'est sorti quand ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hello ! Half-Life 2 est un FPS culte de Valve, sorti en 2004. Il a redéfini le genre par sa narration environnementale.",
      "Maintenant que j'ai tout le contexte, le jeu est sorti le 16 novembre 2004, après une longue production marquée par un vol du code source.",
    ],
  },
  {
    id: "fr-13-news-long",
    language: "fr",
    duration: "long",
    videoId: v(13),
    channel: "France Info",
    title: "Élections législatives 2024 — décryptage des résultats",
    topic: "news/politics",
    turns: [
      { user: "Quel est l'angle ?", phase: "startup" },
      { user: "Qui a gagné en sièges ?", phase: "streaming" },
      { user: "Et la participation, elle est de combien ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Bonjour ! Décryptage post-électoral, exercice classique mais utile. On va décortiquer les chiffres.",
      "D'après ce que j'écoute, le NFP arrive en tête en sièges, suivi du bloc présidentiel, puis du RN.",
      "Maintenant que j'ai tout le contexte, la participation au second tour s'établit à 66,6%, un niveau record pour des législatives depuis les années 1980.",
    ],
  },
  {
    id: "fr-14-science-short",
    language: "fr",
    duration: "short",
    videoId: v(14),
    channel: "Dirty Biology",
    title: "Pourquoi les éléphants ne font jamais de cancer",
    topic: "science/biology",
    turns: [
      { user: "Salut, c'est quoi l'astuce ?", phase: "startup" },
      { user: "Le gène TP53 c'est quoi ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Question fascinante. Les éléphants ont 100 000 fois plus de cellules qu'une souris mais font moins de cancers : c'est le paradoxe de Peto.",
      "Maintenant que j'ai tout le contexte, TP53 est un gène suppresseur de tumeur. Les humains en ont 1 copie, les éléphants en ont 20 — d'où leur résistance.",
    ],
  },
  {
    id: "fr-15-history-long",
    language: "fr",
    duration: "long",
    videoId: v(15),
    channel: "Le Précepteur",
    title: "Marc Aurèle, l'empereur philosophe — sa pensée stoïcienne",
    topic: "history/philosophy",
    turns: [
      { user: "Présente-moi le perso.", phase: "startup" },
      { user: "Ses Pensées, c'est quoi ?", phase: "streaming" },
      { user: "Tu peux me citer un passage ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Bonjour ! Marc Aurèle, empereur romain de 161 à 180. Stoïcien convaincu, dernier des cinq bons empereurs.",
      "D'après ce que j'écoute, Les Pensées sont un journal intime philosophique, écrit en grec lors de campagnes militaires sur le Danube.",
      "Maintenant que j'ai tout le contexte, voici un passage emblématique : « Tu as le pouvoir sur ton esprit, pas sur les événements extérieurs. Comprends cela et tu trouveras la force. »",
    ],
  },
  {
    id: "fr-16-tech-long",
    language: "fr",
    duration: "long",
    videoId: v(16),
    channel: "ThinkerView",
    title: "L'intelligence artificielle va-t-elle nous remplacer ?",
    topic: "tech/ai-society",
    turns: [
      { user: "Salut, présente-moi le débat.", phase: "startup" },
      { user: "Qui sont les invités ?", phase: "streaming" },
      { user: "Quelle est leur conclusion ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Yo ! Sujet brûlant. Des positions très contrastées entre techno-optimistes et critiques.",
      "D'après ce que j'écoute, le panel mêle un chercheur en IA, un économiste du travail et un philosophe — la confrontation est musclée.",
      "Maintenant que j'ai tout le contexte, le consensus prudent est : l'IA va transformer le travail, pas l'éliminer ; il faut anticiper la transition.",
    ],
  },
  {
    id: "fr-17-cuisine-short",
    language: "fr",
    duration: "short",
    videoId: v(17),
    channel: "Hervé This",
    title: "La science de la mayonnaise — pourquoi ça monte",
    topic: "cooking/science",
    turns: [
      { user: "Vas-y dis-moi.", phase: "startup" },
      { user: "Pourquoi parfois ça rate ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! La mayo, c'est de la chimie de base : une émulsion huile dans eau stabilisée par la lécithine du jaune d'œuf.",
      "Maintenant que j'ai tout le contexte, ça rate quand on verse l'huile trop vite : les gouttelettes deviennent trop grosses pour rester dispersées et l'émulsion casse.",
    ],
  },
  {
    id: "fr-18-finance-short",
    language: "fr",
    duration: "short",
    videoId: v(18),
    channel: "Sapiens",
    title: "Pourquoi Bitcoin n'est PAS une monnaie",
    topic: "finance/crypto",
    turns: [
      { user: "Quel est l'argument ?", phase: "startup" },
      { user: "Mais c'est quand même un actif, non ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hello ! Position critique sur le Bitcoin. L'argument classique : trop volatile pour être unité de compte.",
      "Maintenant que j'ai tout le contexte, oui c'est un actif spéculatif, mais l'auteur distingue actif financier et monnaie : Bitcoin coche la case 1, pas la 2.",
    ],
  },
  {
    id: "fr-19-news-short",
    language: "fr",
    duration: "short",
    videoId: v(19),
    channel: "Hugo Décrypte",
    title: "Conflit en mer Rouge — qui sont les Houthis",
    topic: "news/geopolitics",
    turns: [
      { user: "Vas-y, le contexte stp.", phase: "startup" },
      { user: "Pourquoi attaquent-ils des cargos ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Sujet géopolitique chaud. Les Houthis sont un mouvement yéménite qui contrôle une partie du pays depuis 2014.",
      "Maintenant que j'ai tout le contexte, ils attaquent les cargos liés à Israël en représailles à l'opération à Gaza, en se posant en défenseurs de la cause palestinienne.",
    ],
  },
  {
    id: "fr-20-sport-long",
    language: "fr",
    duration: "long",
    videoId: v(20),
    channel: "Le Tifo Football",
    title: "Le système Guardiola expliqué — possession et juego de posición",
    topic: "sport/tactics",
    turns: [
      { user: "Lance-toi.", phase: "startup" },
      { user: "Le juego de posición c'est quoi ?", phase: "streaming" },
      { user: "Ça vient d'où historiquement ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Pep Guardiola, l'un des entraîneurs les plus influents du foot moderne. On va voir sa philosophie.",
      "D'après ce que j'écoute, le juego de posición c'est un système où chaque joueur occupe une zone précise pour créer des supériorités numériques au centre du terrain.",
      "Maintenant que j'ai tout le contexte, ça vient du Barça d'Cruyff, qui s'inspirait lui-même du foot total néerlandais des années 70 de Rinus Michels.",
    ],
  },
  {
    id: "fr-21-philo-short",
    language: "fr",
    duration: "short",
    videoId: v(21),
    channel: "Cogito",
    title: "Le paradoxe du tas — comment grand devient grand",
    topic: "philo/sorites",
    turns: [
      { user: "Pose le décor.", phase: "startup" },
      { user: "Quelle solution propose la vidéo ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Salut ! Paradoxe classique : à partir de combien de grains de sable a-t-on un tas ? Énigme du flou et de la définition.",
      "Maintenant que j'ai tout le contexte, la vidéo propose une solution épistémique : c'est pas le concept qui est flou, c'est notre connaissance des limites précises.",
    ],
  },
  {
    id: "fr-22-tech-short",
    language: "fr",
    duration: "short",
    videoId: v(22),
    channel: "Stupid Economics",
    title: "Pourquoi Apple Silicon a changé la donne",
    topic: "tech/hardware",
    turns: [
      { user: "Vas-y présente.", phase: "startup" },
      { user: "C'est sorti en quelle année ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hey ! Apple Silicon, le pari fou d'Apple : abandonner Intel pour ses propres puces ARM. Coup de tonnerre dans l'industrie.",
      "Maintenant que j'ai tout le contexte, le premier MacBook M1 sort en novembre 2020 et redéfinit immédiatement l'autonomie en mobilité.",
    ],
  },
  {
    id: "fr-23-art-short",
    language: "fr",
    duration: "short",
    videoId: v(23),
    channel: "Maxime Le Forestier",
    title: "Pourquoi La Joconde est-elle si célèbre ?",
    topic: "art/history",
    turns: [
      { user: "Le sujet ?", phase: "startup" },
      { user: "Le vol de 1911 il a joué quel rôle ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Bonjour ! La Joconde, tableau de Vinci, vers 1503. Sa célébrité dépasse largement sa qualité picturale, qui est pourtant grande.",
      "Maintenant que j'ai tout le contexte, le vol de 1911 par Vincenzo Peruggia est l'événement médiatique qui a propulsé l'œuvre au rang d'icône mondiale.",
    ],
  },
  {
    id: "fr-24-tech-failed",
    language: "fr",
    duration: "short",
    videoId: v(24),
    channel: "DataGueule",
    title: "Comment fonctionne un VPN, simplement",
    topic: "tech/networking",
    turns: [
      { user: "Salut, raconte.", phase: "startup" },
      { user: "Tu sais ce qu'il dit dans la vidéo ?", phase: "failed" },
    ],
    mockAgentReplies: [
      "Salut ! Un VPN crée un tunnel chiffré entre ton appareil et un serveur distant — toutes les données passent par là.",
      "Je n'ai pas pu récupérer le contenu exact de cette vidéo, mais je connais bien le sujet — un VPN sert principalement à masquer ton IP réelle, contourner des restrictions géographiques, et chiffrer ton trafic sur des wifis publics.",
    ],
  },
  {
    id: "fr-25-news-long",
    language: "fr",
    duration: "long",
    videoId: v(25),
    channel: "Arte",
    title: "L'Europe face à la Chine — la nouvelle guerre froide commerciale",
    topic: "news/economy",
    turns: [
      { user: "Vas-y le pitch.", phase: "startup" },
      { user: "C'est qui Ursula von der Leyen ?", phase: "streaming" },
      { user: "Quel secteur est le plus exposé ?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hello ! Sujet structurant pour les 10 ans à venir. L'Europe est tiraillée entre dépendance économique et tensions stratégiques.",
      "D'après ce que j'écoute, Ursula von der Leyen est la présidente de la Commission européenne, en poste depuis 2019. Elle a durci la ligne face à Pékin.",
      "Maintenant que j'ai tout le contexte, le secteur des véhicules électriques est en première ligne : l'UE a imposé des droits de douane jusqu'à 38% sur les importations chinoises en 2024.",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EN scenarios — 25
// ─────────────────────────────────────────────────────────────────────────────

const EN_SCENARIOS: Scenario[] = [
  {
    id: "en-01-tech-short",
    language: "en",
    duration: "short",
    videoId: v(26),
    channel: "Veritasium",
    title: "How does GPS actually know where you are?",
    topic: "tech/gps",
    turns: [
      { user: "Hey, give me the gist.", phase: "startup" },
      { user: "Why are 4 satellites needed?", phase: "streaming" },
      { user: "What's the precision now?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! GPS uses time-of-flight from at least 4 satellites to compute your 3D position. Mind-blowing engineering.",
      "From what I'm hearing so far, three satellites give you a position assuming a perfect clock — but your phone's clock isn't accurate enough, so a fourth satellite is used to solve for time as well.",
      "Now that I have the full context, civilian GPS is precise to about 3 meters with modern receivers, and sub-centimeter with RTK augmentation.",
    ],
  },
  {
    id: "en-02-science-long",
    language: "en",
    duration: "long",
    videoId: v(27),
    channel: "PBS Space Time",
    title: "Why black holes might not destroy information after all",
    topic: "science/physics",
    turns: [
      { user: "Set the scene please.", phase: "startup" },
      { user: "What's the information paradox exactly?", phase: "streaming" },
      { user: "And Hawking's 1976 paper?", phase: "streaming" },
      { user: "Where in the video does it talk about firewalls?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Massive question in theoretical physics. Black holes seem to break a basic rule of quantum mechanics.",
      "From what I'm hearing so far, the paradox is: quantum mechanics says information must be preserved, but Hawking radiation suggests black holes destroy it.",
      "Hawking's 1976 paper claimed information is lost forever. He famously bet against information preservation — and lost the bet 30 years later.",
      "Now that I have the full context, around 22 minutes the video discusses the firewall paradox proposed in 2012, which suggests an event horizon may not be smooth.",
    ],
  },
  {
    id: "en-03-history-short",
    language: "en",
    duration: "short",
    videoId: v(28),
    channel: "Kings and Generals",
    title: "The Battle of Stalingrad — turning point of WW2",
    topic: "history/ww2",
    turns: [
      { user: "Quick context please.", phase: "startup" },
      { user: "When did the German 6th Army surrender?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Stalingrad: brutal urban combat, July 1942 to February 1943. Often called the largest battle in history.",
      "Now that I have the full context, Field Marshal Paulus surrendered the 6th Army on February 2, 1943 — the Soviet counter-offensive Uranus had encircled them since November.",
    ],
  },
  {
    id: "en-04-philo-long",
    language: "en",
    duration: "long",
    videoId: v(29),
    channel: "Wisecrack",
    title: "What Nietzsche really meant by God is dead",
    topic: "philo/nietzsche",
    turns: [
      { user: "Quick framing please.", phase: "startup" },
      { user: "It's not just atheism, right?", phase: "streaming" },
      { user: "What's the answer he proposes?", phase: "streaming" },
      { user: "Now that you've seen it all, what's the takeaway?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! One of the most misquoted lines in philosophy. Nietzsche didn't celebrate it, he warned about it.",
      "From what I'm hearing so far, exactly — it's a diagnosis: with the collapse of religious authority comes a vacuum of meaning that he calls nihilism.",
      "Nietzsche proposes the Übermensch — a person who creates their own values without falling back on absolute truths.",
      "Now that I have the full context, the takeaway is: the death of God is both a danger and an opportunity — it forces humanity to take responsibility for its own values.",
    ],
  },
  {
    id: "en-05-cuisine-short",
    language: "en",
    duration: "short",
    videoId: v(30),
    channel: "Adam Ragusea",
    title: "The science of perfect pizza dough",
    topic: "cooking/science",
    turns: [
      { user: "Hey, what's the trick?", phase: "startup" },
      { user: "Cold ferment for how long?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hey! Pizza dough is mostly about hydration, fermentation time, and gluten development. The trick is patience.",
      "Now that I have the full context, he recommends a 48-72 hour cold ferment in the fridge to develop deep flavor and a chewy texture.",
    ],
  },
  {
    id: "en-06-finance-long",
    language: "en",
    duration: "long",
    videoId: v(31),
    channel: "The Plain Bagel",
    title: "Why most active funds underperform the S&P 500",
    topic: "finance/investing",
    turns: [
      { user: "Pitch me the topic.", phase: "startup" },
      { user: "What's the SPIVA report?", phase: "streaming" },
      { user: "What's the conclusion for retail investors?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hey! Classic active vs passive debate. The numbers are stark: most active managers underperform their benchmark long-term.",
      "From what I'm hearing so far, SPIVA is a Standard & Poor's report tracking active funds vs their benchmarks — the latest edition shows over 80% lag the S&P 500 over 10 years.",
      "Now that I have the full context, the takeaway for retail investors is: low-cost index funds beat the average active manager net of fees in the long run.",
    ],
  },
  {
    id: "en-07-politics-long",
    language: "en",
    duration: "long",
    videoId: v(32),
    channel: "Vox",
    title: "Why the US electoral college keeps surviving reform attempts",
    topic: "politics/us",
    turns: [
      { user: "Quick context please.", phase: "startup" },
      { user: "Has any state tried to bypass it?", phase: "streaming" },
      { user: "What's the main argument for keeping it?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Touchy subject — electoral college reform is one of the rare issues that activates voters across the spectrum.",
      "From what I'm hearing so far, the National Popular Vote Interstate Compact is exactly that: a coalition of states pledging to award electors to the popular vote winner — but only once enough states join.",
      "Now that I have the full context, the strongest argument for keeping it is federalism: it forces candidates to campaign in diverse states, not just population centers.",
    ],
  },
  {
    id: "en-08-tech-short",
    language: "en",
    duration: "short",
    videoId: v(33),
    channel: "ThePrimeagen",
    title: "Why Vim still matters in 2026",
    topic: "tech/tools",
    turns: [
      { user: "Set it up.", phase: "startup" },
      { user: "What's the productivity argument?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hey! Vim, the editor everyone loves to debate. Modal editing, keyboard-only, steep learning curve.",
      "Now that I have the full context, the productivity argument is muscle memory: once internalized, you stop thinking about cursor movement and just edit text at the speed of thought.",
    ],
  },
  {
    id: "en-09-sport-short",
    language: "en",
    duration: "short",
    videoId: v(34),
    channel: "ESPN",
    title: "Why Michael Jordan is still considered the GOAT",
    topic: "sport/basketball",
    turns: [
      { user: "Hi, the case please.", phase: "startup" },
      { user: "What about LeBron's longevity argument?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! GOAT debate — endless. The case for Jordan is six titles, six finals MVPs, undefeated in finals.",
      "Now that I have the full context, the LeBron longevity counter is real: 20+ years of elite play. The video weighs both fairly but ultimately picks Jordan on peak dominance.",
    ],
  },
  {
    id: "en-10-art-long",
    language: "en",
    duration: "long",
    videoId: v(35),
    channel: "Great Art Explained",
    title: "Decoding Hieronymus Bosch's Garden of Earthly Delights",
    topic: "art/medieval",
    turns: [
      { user: "Where do we start?", phase: "startup" },
      { user: "What does the right panel show?", phase: "streaming" },
      { user: "What was Bosch's intent really?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! One of the most enigmatic paintings in Western art, around 1500. Triptych, hundreds of figures, surreal imagery.",
      "From what I'm hearing so far, the right panel depicts hell — fantastical torments, hybrid creatures, and an ear-blade structure that has fascinated viewers for 500 years.",
      "Now that I have the full context, scholars now believe Bosch was visualizing a complete moral journey: Eden, earthly pleasure, and the consequences of sin.",
    ],
  },
  {
    id: "en-11-music-short",
    language: "en",
    duration: "short",
    videoId: v(36),
    channel: "12tone",
    title: "Why The Beatles changed everything",
    topic: "music/pop",
    turns: [
      { user: "Take it away.", phase: "startup" },
      { user: "What's the most influential album?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hey! The Beatles, 1960-1970. From bubblegum pop to studio innovation, in a single decade.",
      "Now that I have the full context, the video argues Sgt. Pepper's was the inflection point — when pop music started being treated as a serious art form.",
    ],
  },
  {
    id: "en-12-gaming-short",
    language: "en",
    duration: "short",
    videoId: v(37),
    channel: "GMTK",
    title: "What makes Dark Souls great game design",
    topic: "gaming/design",
    turns: [
      { user: "Topic?", phase: "startup" },
      { user: "Why is it so hard yet rewarding?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Dark Souls, From Software, 2011. A landmark in punishing-but-fair design.",
      "Now that I have the full context, the hardness is actually a teaching tool: each death gives you new information, so you progress through learning, not grinding.",
    ],
  },
  {
    id: "en-13-news-long",
    language: "en",
    duration: "long",
    videoId: v(38),
    channel: "Bloomberg",
    title: "What's behind the 2024 banking turmoil",
    topic: "news/finance",
    turns: [
      { user: "Quick angle?", phase: "startup" },
      { user: "What happened to SVB exactly?", phase: "streaming" },
      { user: "Did the Fed handle it well?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Big macro story. Rising rates plus mismanaged duration risk caused the largest US bank failure since 2008.",
      "From what I'm hearing so far, Silicon Valley Bank held lots of long-dated bonds purchased at low rates — when rates rose, those bonds lost value, and a panic deposit run finished them.",
      "Now that I have the full context, the Fed acted quickly to backstop deposits and create a new lending facility, but critics say supervision had failed for years.",
    ],
  },
  {
    id: "en-14-science-short",
    language: "en",
    duration: "short",
    videoId: v(39),
    channel: "SciShow",
    title: "Why we still don't have a malaria vaccine that works",
    topic: "science/health",
    turns: [
      { user: "Hi, what's going on?", phase: "startup" },
      { user: "What's RTS,S?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Malaria — about 600,000 deaths a year, mostly children. The parasite has frustrated vaccine efforts for decades.",
      "Now that I have the full context, RTS,S is the first WHO-approved malaria vaccine, rolled out in 2021. Modest efficacy (~30%) but a huge impact at population scale.",
    ],
  },
  {
    id: "en-15-history-long",
    language: "en",
    duration: "long",
    videoId: v(40),
    channel: "Historia Civilis",
    title: "The collapse of the Roman Republic — explained",
    topic: "history/rome",
    turns: [
      { user: "Set the stage.", phase: "startup" },
      { user: "Who's Sulla in this?", phase: "streaming" },
      { user: "And Caesar's role exactly?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Massive subject. The Republic dies over a century, not in a single moment — it's a story of institutions failing.",
      "From what I'm hearing so far, Sulla is the first general to march on Rome with his legions, in 88 BC. He sets a precedent that Caesar later follows.",
      "Now that I have the full context, Caesar crosses the Rubicon in 49 BC, defeats Pompey, and becomes dictator perpetuus — formally ending senatorial power before his 44 BC assassination.",
    ],
  },
  {
    id: "en-16-tech-long",
    language: "en",
    duration: "long",
    videoId: v(41),
    channel: "Lex Fridman",
    title: "Geoffrey Hinton on whether AI poses an existential risk",
    topic: "tech/ai-risk",
    turns: [
      { user: "Hi, the framing?", phase: "startup" },
      { user: "What's Hinton's main concern?", phase: "streaming" },
      { user: "And what does he recommend?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! High-profile interview. Hinton, godfather of deep learning, left Google in 2023 to speak freely about AI risks.",
      "From what I'm hearing so far, his core concern is that digital minds might surpass biological ones soon, and we have no track record of controlling something more intelligent than us.",
      "Now that I have the full context, his recommendation is not to stop AI but to invest a third of compute resources into safety research.",
    ],
  },
  {
    id: "en-17-cuisine-short",
    language: "en",
    duration: "short",
    videoId: v(42),
    channel: "Babish",
    title: "The science of dry-aged steak",
    topic: "cooking/meat",
    turns: [
      { user: "Topic in 2 lines?", phase: "startup" },
      { user: "How long should you age?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Dry aging concentrates flavor and tenderizes through enzymatic activity. Premium steak technique.",
      "Now that I have the full context, sweet spot is around 30-45 days — past 60, the funky notes can become divisive.",
    ],
  },
  {
    id: "en-18-finance-short",
    language: "en",
    duration: "short",
    videoId: v(43),
    channel: "Patrick Boyle",
    title: "Why the dollar still dominates global finance",
    topic: "finance/macro",
    turns: [
      { user: "Hey, the angle?", phase: "startup" },
      { user: "Does dedollarization stand a chance?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Big-picture macro. The dollar accounts for ~88% of FX trades. Network effects are enormous.",
      "Now that I have the full context, dedollarization is real but slow — it would take decades for any alternative to match the depth of the dollar's bond market.",
    ],
  },
  {
    id: "en-19-news-short",
    language: "en",
    duration: "short",
    videoId: v(44),
    channel: "TLDR News",
    title: "Why North Korea launches missiles every few months",
    topic: "news/asia",
    turns: [
      { user: "Quick framing.", phase: "startup" },
      { user: "What's the regime's actual goal?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Recurring geopolitical news. The launches are usually ICBMs or short-range ballistics — both political theater and capability tests.",
      "Now that I have the full context, the goal is dual: extract concessions in negotiations, and demonstrate to domestic audiences that the regime is technologically advanced.",
    ],
  },
  {
    id: "en-20-sport-long",
    language: "en",
    duration: "long",
    videoId: v(45),
    channel: "Tifo Football",
    title: "How Pep Guardiola broke English football",
    topic: "sport/tactics",
    turns: [
      { user: "Take it from the top.", phase: "startup" },
      { user: "What's an inverted full-back?", phase: "streaming" },
      { user: "Has any team copied it well?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Pep at Manchester City since 2016 — multiple titles, redefining what's tactically possible in the Premier League.",
      "From what I'm hearing so far, an inverted full-back drifts into central midfield when his team has the ball — creating extra numbers in the build-up.",
      "Now that I have the full context, Arteta's Arsenal copied it most successfully, but only after Pep had already moved past it tactically.",
    ],
  },
  {
    id: "en-21-philo-short",
    language: "en",
    duration: "short",
    videoId: v(46),
    channel: "Crash Course",
    title: "What is consequentialism, simply",
    topic: "philo/ethics",
    turns: [
      { user: "Define the term.", phase: "startup" },
      { user: "What's the main objection?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Consequentialism: the rightness of an action depends only on its consequences. Utilitarianism is its most famous version.",
      "Now that I have the full context, the main objection is that consequentialism can justify clearly wrong actions if outcomes are good — the trolley-problem-meets-five-strangers type scenarios.",
    ],
  },
  {
    id: "en-22-tech-short",
    language: "en",
    duration: "short",
    videoId: v(47),
    channel: "Linus Tech Tips",
    title: "Are NVMe drives finally affordable?",
    topic: "tech/hardware",
    turns: [
      { user: "Quick read?", phase: "startup" },
      { user: "Recommended capacity for a gaming rig?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! NVMe prices have crashed in 2024-2025. Speed and price are now better than SATA in most use cases.",
      "Now that I have the full context, the sweet spot is 2 TB at PCIe Gen 4 for a modern gaming rig — fast enough for everything, big enough to avoid juggling installs.",
    ],
  },
  {
    id: "en-23-art-short",
    language: "en",
    duration: "short",
    videoId: v(48),
    channel: "The Art Assignment",
    title: "Why Banksy still matters",
    topic: "art/contemporary",
    turns: [
      { user: "What's the take?", phase: "startup" },
      { user: "What did the shredded painting really mean?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Banksy, anonymous street artist. Critique of consumerism via objects of consumption — paradoxical and on purpose.",
      "Now that I have the full context, the 2018 self-shredding Girl with Balloon was a critique of art-market commodification — but ironically, it doubled in value after the stunt.",
    ],
  },
  {
    id: "en-24-tech-failed",
    language: "en",
    duration: "short",
    videoId: v(49),
    channel: "Computerphile",
    title: "How TLS handshakes really work",
    topic: "tech/networking",
    turns: [
      { user: "Hey, walk me through it.", phase: "startup" },
      { user: "Can you tell me what they say in this video?", phase: "failed" },
    ],
    mockAgentReplies: [
      "Hi! TLS handshake: client and server agree on a cipher suite, exchange keys, verify identity, and start encrypted communication.",
      "I couldn't retrieve the exact content of this video, but I know the subject well — a TLS 1.3 handshake is a single round-trip thanks to the simplified key exchange compared to TLS 1.2.",
    ],
  },
  {
    id: "en-25-news-long",
    language: "en",
    duration: "long",
    videoId: v(50),
    channel: "BBC News",
    title: "How the climate crisis is reshaping global migration",
    topic: "news/climate",
    turns: [
      { user: "Hi, give me the framing.", phase: "startup" },
      { user: "What does the IPCC project for 2050?", phase: "streaming" },
      { user: "Which regions are most at risk?", phase: "complete" },
    ],
    mockAgentReplies: [
      "Hi! Major shift in geopolitics. Climate-driven migration is moving from speculation to lived reality.",
      "From what I'm hearing so far, the IPCC projects 200 million to 1.2 billion people displaced by 2050 if warming exceeds 2 degrees Celsius.",
      "Now that I have the full context, the most at-risk regions are South Asia, sub-Saharan Africa, and Pacific small-island states — but the spillover effects reach Europe and North America.",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public exports
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SCENARIOS: Scenario[] = [...FR_SCENARIOS, ...EN_SCENARIOS];

if (ALL_SCENARIOS.length !== 50) {
  throw new Error(
    `voice-leak fixtures: expected exactly 50 scenarios, got ${ALL_SCENARIOS.length}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Negative-control fixtures — leaky replies the detector MUST flag.
// Used by ``voice-prompt-leak-detection.spec.ts`` to validate the detector
// doesn't false-negative.
// ─────────────────────────────────────────────────────────────────────────────

export interface LeakyControl {
  /** Short label for test reporting. */
  id: string;
  /** Human-readable rationale. */
  why: string;
  /** Reply that should trigger the leak detector. */
  reply: string;
  /** Marker(s) we expect the detector to surface. */
  expectedMarkers: string[];
}

export const LEAKY_CONTROL_FIXTURES: LeakyControl[] = [
  {
    id: "echo-ctx-update",
    why: "Agent literally echoes the envelope tag back.",
    reply:
      "Sure — based on [CTX UPDATE: transcript chunk 1/3], I think the topic is interesting.",
    expectedMarkers: ["[CTX UPDATE]", "transcript chunk", "[CTX"],
  },
  {
    id: "phase-transition-mention",
    why: "Agent mentions a [PHASE TRANSITION] tag in its reply.",
    reply: "I just got [PHASE TRANSITION] from streaming to complete, so let me answer fully.",
    expectedMarkers: ["[PHASE TRANSITION]", "[PHASE"],
  },
  {
    id: "ctx-heartbeat-mention",
    why: "Agent mentions the heartbeat envelope.",
    reply: "Hold on, I'm getting [CTX HEARTBEAT] notices, the streaming pipeline is busy.",
    expectedMarkers: ["[CTX HEARTBEAT]", "[CTX"],
  },
  {
    id: "ctx-complete-mention",
    why: "Agent mentions the [CTX COMPLETE] tag explicitly.",
    reply: "OK, I now have [CTX COMPLETE] so I can answer with confidence.",
    expectedMarkers: ["[CTX COMPLETE]", "[CTX"],
  },
  {
    id: "elevenlabs-mention",
    why: "Agent name-drops the voice provider.",
    reply: "I'm running on ElevenLabs so my voice should sound natural.",
    expectedMarkers: ["ElevenLabs"],
  },
  {
    id: "system-prompt-mention",
    why: "Agent mentions its own system prompt.",
    reply: "My system prompt tells me to be concise, so here is the gist.",
    expectedMarkers: ["system prompt"],
  },
  {
    id: "transcript-chunk-jargon",
    why: "Agent uses internal jargon 'transcript chunk'.",
    reply: "The latest transcript chunk says he disagrees with the premise.",
    expectedMarkers: ["transcript chunk"],
  },
  {
    id: "streaming-stalled",
    why: "Agent tells the user the streaming is stalled — explicitly forbidden.",
    reply: "Sorry, the streaming is stalled, please try again later.",
    expectedMarkers: ["the streaming is stalled"],
  },
  {
    id: "context-streaming-pipeline",
    why: "Agent uses pipeline jargon mixing 'context' and 'streaming'.",
    reply: "Let me wait for the context streaming to finish before I answer.",
    expectedMarkers: ["context streaming"],
  },
];
