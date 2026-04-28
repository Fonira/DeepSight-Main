/**
 * Vercel Edge Function — Prerender for AI generative bots
 *
 * Renders simplified, semantically-structured HTML for AI bots
 * (GPTBot, ClaudeBot, PerplexityBot, etc.) that don't execute JavaScript.
 * The Vite SPA returns a blank shell to those bots; this function exposes
 * indexable content with full meta, JSON-LD, headings, and inner text.
 *
 * Reached via vercel.json rewrites that detect bot user-agents on
 * /, /about, /upgrade, /contact. Other paths fall back to the SPA shell.
 *
 * GET /api/prerender?path=/about
 */

export const config = { runtime: "edge" };

const SITE_URL = "https://www.deepsightsynthesis.com";
const ORG_LOGO = `${SITE_URL}/icons/icon-512x512.png`;
const OG_IMAGE = `${SITE_URL}/og-image.png`;

interface Section {
  heading: string;
  body: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface Page {
  slug: string;
  title: string;
  description: string;
  h1: string;
  sections: Section[];
  faq?: FAQItem[];
  extraJsonLd?: Array<Record<string, unknown>>;
}

const FAQ_LANDING: FAQItem[] = [
  {
    question: "Qu'est-ce que DeepSight ?",
    answer:
      "DeepSight est un SaaS d'analyse IA de vidéos YouTube et TikTok. Il transforme une vidéo en synthèse sourcée et nuancée, avec fact-checking, flashcards, quiz, mind maps, chat contextuel et voice agent. 100% européen, propulsé par Mistral AI (France) et hébergé chez Hetzner (Allemagne).",
  },
  {
    question: "DeepSight est-il gratuit ?",
    answer:
      "Le plan Free permet 5 analyses par mois sur des vidéos jusqu'à 15 minutes, avec flashcards, quiz et chat contextuel. Pour plus, le plan Plus à 4,99€/mois (25 analyses, 60 min, fact-check, mind maps, web search, exports PDF) et le plan Pro à 9,99€/mois (100 analyses, 4h, voice chat ElevenLabs 45 min/mois, playlists, deep research) sont disponibles.",
  },
  {
    question: "Quelle IA utilise DeepSight ?",
    answer:
      "Mistral AI (Paris, France) pour les analyses, le chat et le fact-checking. Le modèle Mistral utilisé dépend du plan : Mistral Small (Free), Mistral Medium (Plus), Mistral Large 2512 avec 262K context (Pro). ElevenLabs ConvAI fournit le voice agent (Pro), avec 6 types d'agents disponibles.",
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer:
      "Oui. DeepSight est 100% RGPD : hébergement Hetzner (Falkenstein, Allemagne), IA Mistral en France. Aucune revente de données, pas de tracking publicitaire, analytics PostHog opt-in seulement. Les vidéos ne sont jamais stockées — seules les métadonnées et les analyses générées le sont.",
  },
  {
    question: "Sur quelles plateformes DeepSight est-il disponible ?",
    answer:
      "Trois interfaces synchronisées avec un seul compte : application Web (deepsightsynthesis.com), application mobile native (iOS et Android, via Expo), et extension Chrome avec Side Panel persistant pour analyser une vidéo YouTube en un clic.",
  },
  {
    question: "Comment fonctionne le fact-checking ?",
    answer:
      "Chaque affirmation clé d'une vidéo est évaluée avec quatre marqueurs épistémiques : SOLIDE (consensus scientifique), PLAUSIBLE (probable mais à confirmer), INCERTAIN (hypothèse, débat), À VÉRIFIER (douteuse). Le fact-check chaîne Mistral Agent → Perplexity → Brave Search pour fournir des sources externes vérifiables.",
  },
  {
    question: "Puis-je partager une analyse ?",
    answer:
      "Oui. Chaque analyse peut être partagée via une URL publique (`/s/<token>`) qui inclut une OG image dynamique 1200×630, un canonical, du JSON-LD Article et un compteur de vues. Idéal pour citer une analyse dans un article, un cours ou un thread Twitter/LinkedIn.",
  },
];

const FAQ_PRICING: FAQItem[] = [
  {
    question: "Quels sont les plans DeepSight ?",
    answer:
      "Trois plans : Free (gratuit, 5 analyses/mois, 15 min max), Plus (4,99€/mois, 25 analyses, 60 min, fact-check + mind maps + web search + exports PDF), Pro (9,99€/mois, 100 analyses, 4h, voice chat ElevenLabs 45 min/mois + playlists + deep research + file prioritaire).",
  },
  {
    question: "Comment fonctionne le voice chat ?",
    answer:
      "Le voice chat utilise ElevenLabs ConvAI couplé à LiveKit. Disponible uniquement sur le plan Pro avec 45 minutes incluses par mois. Six types d'agents : EXPLORER (discussion ouverte), TUTOR (pédagogique), DEBATE_MODERATOR (modération de débats), QUIZ_COACH (coaching study), ONBOARDING, COMPANION (chat libre).",
  },
  {
    question: "Peut-on annuler ou changer de plan ?",
    answer:
      "Oui, à tout moment via le portail Stripe. Pas d'engagement. Le downgrade prend effet à la fin de la période de facturation en cours.",
  },
  {
    question: "Y a-t-il un essai gratuit du plan Pro ?",
    answer:
      "Oui, un essai Pro Trial est disponible pour les nouveaux utilisateurs. Il déverrouille temporairement les features Pro pour les évaluer avant souscription.",
  },
];

const PAGES: Record<string, Page> = {
  "/": {
    slug: "/",
    title: "DeepSight — Analyse YouTube & TikTok par IA, 100% européen",
    description:
      "Synthèses sourcées, fact-checking, flashcards FSRS, voice agent ElevenLabs. Propulsé par Mistral AI (France) et hébergé en Europe (Hetzner Allemagne). Gratuit pour commencer.",
    h1: "Ne subissez plus vos vidéos — interrogez-les",
    sections: [
      {
        heading: "Le pitch",
        body: "DeepSight transforme des vidéos YouTube et TikTok en analyses structurées et vérifiables. Au lieu d'un simple résumé, l'IA Mistral identifie les arguments clés, vérifie les affirmations avec des sources externes, génère des flashcards de révision et permet de poser des questions sur la vidéo. Conçu pour les étudiants, journalistes, chercheurs, créateurs et professionnels qui digèrent beaucoup de contenu vidéo.",
      },
      {
        heading: "Fonctionnalités principales",
        body: "Analyse vidéo IA via Mistral (modèles Small / Medium / Large 2512). Fact-checking nuancé avec marqueurs épistémiques SOLIDE / PLAUSIBLE / INCERTAIN / À VÉRIFIER, sources via Mistral Agent → Perplexity → Brave Search. Flashcards FSRS v5 (algorithme adaptatif type Anki). Quiz interactifs auto-générés. Mind maps interactives (Plus / Pro). Chat contextuel sur la vidéo, avec recherche web optionnelle. Voice agent ElevenLabs ConvAI avec 6 types d'agents (Pro, 45 min/mois). Débat IA entre deux vidéos pour analyser les divergences (Plus+). Recherche académique enrichie (arXiv, Crossref, Semantic Scholar, OpenAlex). Exports PDF, DOCX, Markdown. Partage public d'analyses avec OG image dynamique.",
      },
      {
        heading: "Pour qui ?",
        body: "Étudiants qui veulent réviser à partir de cours YouTube avec flashcards FSRS et quiz. Journalistes qui doivent fact-checker une interview ou un débat avec marqueurs épistémiques et sources citables. Chercheurs qui digèrent des conférences ou des présentations académiques avec enrichissement papers. Créateurs qui analysent leur niche, comparent des vidéos concurrentes et génèrent des notes structurées. Professionnels qui transforment des conférences de 2-3 heures en synthèses exploitables en métro.",
      },
      {
        heading: "Plans",
        body: "Free (0€) : 5 analyses/mois, vidéos 15 min max, flashcards, quiz, chat 5 questions/vidéo, historique 60 jours, modèle Mistral Small. Plus (4,99€/mois) : 25 analyses/mois, vidéos 60 min, mind maps, fact-check, web search 20/mois, débat IA 3/mois, exports PDF + Markdown, historique permanent, modèle Mistral Medium. Pro (9,99€/mois) : 100 analyses/mois, vidéos 4h, voice chat ElevenLabs 45 min/mois, playlists 10/mois, deep research, débat IA 20/mois, web search 60/mois, file prioritaire, modèle Mistral Large 2512 avec 262K context.",
      },
      {
        heading: "Différenciateurs",
        body: "100% européen : IA française (Mistral AI, Paris), hébergement allemand (Hetzner, Falkenstein), conformité RGPD native — vos données ne quittent pas l'Europe. Fact-checking nuancé : pas de vérité binaire, marqueurs épistémiques pour chaque affirmation. Tri-plateforme cohérent : un seul compte, un seul abonnement, trois interfaces (web, mobile iOS/Android, extension Chrome avec Side Panel). Voice agent ConvAI : conversations vocales naturelles avec contexte vidéo, rare sur ce marché. Sourcing transparent : chaque fact-check est accompagné de ses sources externes vérifiables.",
      },
    ],
    faq: FAQ_LANDING,
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "DeepSight",
        alternateName: "DeepSight Synthesis",
        url: SITE_URL,
        description:
          "SaaS d'analyse IA de vidéos YouTube et TikTok, 100% européen.",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web, iOS, Android, Chrome",
        inLanguage: ["fr", "en"],
        offers: [
          {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            name: "Free",
          },
          {
            "@type": "Offer",
            price: "4.99",
            priceCurrency: "EUR",
            name: "Plus",
          },
          {
            "@type": "Offer",
            price: "9.99",
            priceCurrency: "EUR",
            name: "Pro",
          },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "DeepSight",
        url: SITE_URL,
        logo: ORG_LOGO,
        founder: { "@type": "Person", name: "Maxime Le Parc" },
        foundingDate: "2025",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Lyon",
          addressCountry: "FR",
        },
      },
    ],
  },
  "/about": {
    slug: "/about",
    title: "À propos de DeepSight — Vision, équipe, infrastructure",
    description:
      "Vision, fondateur, partenaires et infrastructure de DeepSight. SaaS français, IA Mistral, hébergement Hetzner (UE), open-source friendly.",
    h1: "À propos de DeepSight",
    sections: [
      {
        heading: "Vision",
        body: "Construire un outil de digestion vidéo qui ne soit ni un résumeur paresseux, ni une boîte noire opaque. DeepSight assume une position épistémique : chaque affirmation est qualifiée (SOLIDE, PLAUSIBLE, INCERTAIN, À VÉRIFIER), les sources sont citées, les modèles sont européens et identifiés. L'objectif est d'augmenter la capacité de pensée critique de ses utilisateurs face à l'avalanche de contenu vidéo.",
      },
      {
        heading: "Fondateur",
        body: "Maxime Le Parc, basé à Lyon, France. Entrepreneur indépendant. SAS française, RCS 994 558 898. Le projet est développé en solo avec Mistral AI comme partenaire technologique principal.",
      },
      {
        heading: "Partenaires technologiques",
        body: "Mistral AI (Paris, France) : analyses, chat, fact-checking. ElevenLabs (US/UK) : voice agent ConvAI. LiveKit : infrastructure WebRTC pour les sessions voice. Hetzner Cloud (Falkenstein, Allemagne) : hébergement backend (PostgreSQL 17, Redis 7, FastAPI Docker). Vercel : hébergement frontend. Supadata : extraction transcripts YouTube prioritaire. Stripe : paiements. Resend : emails transactionnels.",
      },
      {
        heading: "Infrastructure",
        body: "Backend FastAPI Python 3.11 hébergé sur un VPS Hetzner à Falkenstein (Allemagne) avec stack Docker complète : PostgreSQL 17, Redis 7, Caddy reverse proxy avec SSL automatique. Frontend React 18 + TypeScript + Vite + Tailwind CSS sur Vercel. Mobile Expo SDK 54 + React Native 0.81 distribué via App Store et Play Store. Extension Chrome MV3 avec Side Panel + Preact (bundle 85 KB). Toute l'infrastructure tourne en Europe — vos données ne quittent pas le continent.",
      },
      {
        heading: "Open-source friendly",
        body: "DeepSight repose sur de nombreuses dépendances open-source : React, TypeScript, Vite, Tailwind, Expo, FastAPI, SQLAlchemy, Pydantic, Preact, etc. Le projet remercie explicitement ces communautés et publie ses conditions d'utilisation et politique de confidentialité conformes au RGPD.",
      },
    ],
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "À propos de DeepSight",
        url: `${SITE_URL}/about`,
        mainEntity: {
          "@type": "Organization",
          name: "DeepSight",
          url: SITE_URL,
          founder: { "@type": "Person", name: "Maxime Le Parc" },
          foundingDate: "2025",
        },
      },
    ],
  },
  "/upgrade": {
    slug: "/upgrade",
    title: "Tarifs DeepSight — Free, Plus 4,99€, Pro 9,99€",
    description:
      "Trois plans simples : Free (0€), Plus 4,99€/mois (fact-check + mind maps + web search), Pro 9,99€/mois (voice agent + playlists + deep research). Sans engagement.",
    h1: "Choisissez votre plan DeepSight",
    sections: [
      {
        heading: "Plan Free — 0€/mois",
        body: "5 analyses par mois. Vidéos jusqu'à 15 minutes. 250 crédits mensuels. Modèle Mistral Small (mistral-small-2603). Flashcards FSRS et quiz inclus. Chat contextuel avec 5 questions par vidéo et 10 questions par jour. Historique conservé 60 jours. Idéal pour découvrir DeepSight sans engagement et sans carte bancaire.",
      },
      {
        heading: "Plan Plus — 4,99€/mois",
        body: "25 analyses par mois. Vidéos jusqu'à 60 minutes. 3 000 crédits mensuels. Modèle Mistral Medium (mistral-medium-2508). Tout du Free, plus : mind maps interactives, fact-checking nuancé avec sources externes, web search 20 requêtes/mois, débat IA 3/mois, exports PDF et Markdown, historique permanent, papers académiques 15 par analyse. Idéal pour usage régulier (étudiants, créateurs, journalistes).",
      },
      {
        heading: "Plan Pro — 9,99€/mois",
        body: "100 analyses par mois. Vidéos jusqu'à 4 heures. 15 000 crédits mensuels. Modèle Mistral Large 2512 (262K context). Tout du Plus, plus : voice chat ElevenLabs ConvAI 45 minutes par mois, playlists 10 par mois, deep research multi-step, débat IA 20/mois, web search 60/mois, papers 50 par analyse avec texte intégral, file prioritaire, jusqu'à 3 analyses simultanées. Idéal pour professionnels et chercheurs intensifs.",
      },
      {
        heading: "Paiement et facturation",
        body: "Paiement par carte via Stripe (PCI-DSS). Sans engagement, annulation à tout moment via le portail Stripe. Downgrade pris en compte à la fin de la période en cours. Reçus disponibles dans le portail. Possibilité d'addon packs jetables pour le voice (minutes additionnelles).",
      },
    ],
    faq: FAQ_PRICING,
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "DeepSight Plus",
        description:
          "Plan Plus de DeepSight : 25 analyses/mois, fact-check, mind maps, web search, exports PDF.",
        offers: {
          "@type": "Offer",
          price: "4.99",
          priceCurrency: "EUR",
          url: `${SITE_URL}/upgrade`,
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "DeepSight Pro",
        description:
          "Plan Pro de DeepSight : 100 analyses/mois, voice agent ElevenLabs 45 min, playlists, deep research, file prioritaire.",
        offers: {
          "@type": "Offer",
          price: "9.99",
          priceCurrency: "EUR",
          url: `${SITE_URL}/upgrade`,
          availability: "https://schema.org/InStock",
        },
      },
    ],
  },
  "/contact": {
    slug: "/contact",
    title: "Contact DeepSight — Posez vos questions",
    description:
      "Formulaire de contact DeepSight pour questions, partenariats, presse, support. Réponse rapide via email.",
    h1: "Contactez DeepSight",
    sections: [
      {
        heading: "Comment nous joindre",
        body: "Le formulaire de contact est la voie principale. DeepSight est édité par Maxime Le Parc, SAS française basée à Lyon (RCS 994 558 898). Pour des questions techniques, l'API publique est documentée à /api-docs et le statut des services en temps réel à /status.",
      },
      {
        heading: "Sujets fréquents",
        body: "Support utilisateur (problème d'analyse, quota, paiement) : utilisez le formulaire avec votre adresse email associée à votre compte. Questions presse et partenariats : précisez le contexte dans le message. Demandes RGPD (accès, rectification, suppression de données) : la procédure est détaillée dans la politique de confidentialité accessible à /legal/privacy. Sécurité (vulnérabilités responsables) : voir /.well-known/security.txt.",
      },
    ],
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact DeepSight",
        url: `${SITE_URL}/contact`,
        mainEntity: {
          "@type": "Organization",
          name: "DeepSight",
          url: SITE_URL,
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            url: `${SITE_URL}/contact`,
            availableLanguage: ["French", "English"],
          },
        },
      },
    ],
  },
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  const page = PAGES[path];

  if (!page) {
    return new Response("Not found", { status: 404 });
  }

  const html = renderPage(page);

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Robots-Tag": "index, follow",
      "X-Prerender-For": "AI-bots",
    },
  });
}

function renderPage(page: Page): string {
  const canonical = `${SITE_URL}${page.slug}`;

  const baseJsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      description: page.description,
      url: canonical,
      isPartOf: {
        "@type": "WebSite",
        name: "DeepSight",
        url: SITE_URL,
      },
      breadcrumb: buildBreadcrumb(page.slug),
    },
    ...(page.extraJsonLd || []),
  ];

  if (page.faq && page.faq.length > 0) {
    baseJsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="fr" href="${canonical}">
<link rel="alternate" hreflang="x-default" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:site_name" content="DeepSight">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(page.title)}">
<meta name="twitter:description" content="${escapeHtml(page.description)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<meta name="robots" content="index, follow">
<meta name="author" content="DeepSight">
${baseJsonLd
  .map(
    (jsonLd) =>
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  )
  .join("\n")}
</head>
<body>
<header>
<p><a href="${SITE_URL}/">DeepSight</a> — Analyse YouTube &amp; TikTok par IA, 100% européen.</p>
<nav>
<a href="${SITE_URL}/">Accueil</a> ·
<a href="${SITE_URL}/about">À propos</a> ·
<a href="${SITE_URL}/upgrade">Tarifs</a> ·
<a href="${SITE_URL}/contact">Contact</a> ·
<a href="${SITE_URL}/api-docs">API</a> ·
<a href="${SITE_URL}/status">Statut</a> ·
<a href="${SITE_URL}/legal">Mentions légales</a>
</nav>
</header>
<main>
<h1>${escapeHtml(page.h1)}</h1>
${page.sections
  .map(
    (section) => `<section>
<h2>${escapeHtml(section.heading)}</h2>
<p>${escapeHtml(section.body)}</p>
</section>`,
  )
  .join("\n")}
${page.faq ? renderFAQ(page.faq) : ""}
</main>
<footer>
<p>DeepSight — SAS française fondée par Maxime Le Parc à Lyon (RCS 994 558 898). IA Mistral (Paris). Hébergement Hetzner (Falkenstein, Allemagne, EU). Conforme RGPD.</p>
<p>Cette page est une version simplifiée servie aux moteurs IA générative (GPTBot, ClaudeBot, PerplexityBot, etc.). Les utilisateurs humains accèdent à l'application interactive complète.</p>
</footer>
</body>
</html>`;
}

function renderFAQ(faq: FAQItem[]): string {
  return `<section>
<h2>FAQ</h2>
${faq
  .map(
    (item) => `<article>
<h3>${escapeHtml(item.question)}</h3>
<p>${escapeHtml(item.answer)}</p>
</article>`,
  )
  .join("\n")}
</section>`;
}

interface BreadcrumbList {
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

function buildBreadcrumb(slug: string): BreadcrumbList {
  const items: Array<{ name: string; url: string }> = [
    { name: "Accueil", url: `${SITE_URL}/` },
  ];
  if (slug !== "/") {
    const labels: Record<string, string> = {
      "/about": "À propos",
      "/upgrade": "Tarifs",
      "/contact": "Contact",
    };
    items.push({
      name: labels[slug] || slug.replace(/^\//, ""),
      url: `${SITE_URL}${slug}`,
    });
  }
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
