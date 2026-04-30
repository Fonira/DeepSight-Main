import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.deepsightsynthesis.com";

/**
 * Schéma TypeScript du JSON-LD Product Schema.org émis par ce composant.
 * Volontairement strict pour que les tests valident la grille tarifaire.
 */
interface ProductOffer {
  "@type": "Offer";
  name: string;
  price: string;
  priceCurrency: "EUR";
  description: string;
  priceSpecification: {
    "@type": "UnitPriceSpecification";
    price: string;
    priceCurrency: "EUR";
    unitText: "MONTH";
  };
}

interface AggregateRating {
  "@type": "AggregateRating";
  ratingValue: string;
  reviewCount: string;
  bestRating: string;
  worstRating: string;
}

interface ProductJsonLdShape {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  brand: { "@type": "Brand"; name: string };
  url: string;
  offers: ProductOffer[];
  aggregateRating?: AggregateRating;
}

/**
 * Construit le JSON-LD Product+Offers correspondant à la grille pricing v2 publique
 * (Gratuit, Pro 8,99 €/mois, Expert 19,99 €/mois).
 *
 * Inclut un aggregateRating (4.8 / 127) pour permettre l'affichage d'étoiles
 * dans les rich snippets Google. Décision validée Maxime 2026-04-29 (audit Kimi
 * Phase 0, méta-décision PR-5).
 *
 * Exporté pour permettre des tests purs (sans render React).
 */
export const buildProductJsonLd = (): ProductJsonLdShape => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "DeepSight",
  description:
    "Plateforme SaaS d'analyse de vidéos YouTube et TikTok par IA. Synthèses sourcées, fact-checking nuancé, flashcards FSRS, chat contextuel, voice agent.",
  brand: { "@type": "Brand", name: "DeepSight" },
  url: `${SITE_URL}/upgrade`,
  offers: [
    {
      "@type": "Offer",
      name: "Gratuit",
      price: "0",
      priceCurrency: "EUR",
      description:
        "5 analyses/mois, vidéos jusqu'à 15 min, flashcards, quiz, chat contextuel.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "0",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "8.99",
      priceCurrency: "EUR",
      description:
        "30 analyses/mois, vidéos jusqu'à 2 h, mind maps, fact-check, web search, exports PDF.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "8.99",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
    {
      "@type": "Offer",
      name: "Expert",
      price: "19.99",
      priceCurrency: "EUR",
      description:
        "100 analyses/mois, vidéos jusqu'à 4 h, voice agent ElevenLabs, playlists illimitées, deep research, priority queue.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "19.99",
        priceCurrency: "EUR",
        unitText: "MONTH",
      },
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "127",
    bestRating: "5",
    worstRating: "1",
  },
});

/**
 * Émet le JSON-LD Product+Offers dans le `<head>` via Helmet.
 *
 * Usage :
 *   <ProductJsonLd />
 *
 * Pattern aligné sur BreadcrumbJsonLd.tsx.
 */
export const ProductJsonLd = () => {
  const jsonLd = buildProductJsonLd();
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
};
