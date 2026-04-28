import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
  /** Override la langue pour hreflang (défaut: fr) */
  lang?: "fr" | "en";
  /** Mots-clés SEO spécifiques à la page */
  keywords?: string;
  /** Désactiver l'indexation (pour les pages protégées) */
  noindex?: boolean;
}

const SITE_NAME = "DeepSight";
const BASE_URL = "https://www.deepsightsynthesis.com";
const DEFAULT_DESCRIPTION =
  "Analysez et synthétisez vos vidéos YouTube et TikTok avec l'IA. Résumés intelligents, fact-checking, outils d'étude et chat contextuel.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const DEFAULT_KEYWORDS =
  "youtube, analyse, IA, résumé, synthèse, fact-checking, flashcards, quiz, TikTok, intelligence artificielle, Mistral AI";

export const SEO = ({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  image = DEFAULT_IMAGE,
  type = "website",
  lang = "fr",
  keywords = DEFAULT_KEYWORDS,
  noindex = false,
}: SEOProps) => {
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Analyse YouTube & TikTok par IA`;
  const canonicalUrl = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Indexation */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Hreflang — pas de variante /en/* publique pour l'instant.
          La balise EN sera réintroduite quand les routes /en/* existeront. */}
      <link rel="alternate" hrefLang="fr" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={lang === "fr" ? "fr_FR" : "en_US"} />
      <meta
        property="og:locale:alternate"
        content={lang === "fr" ? "en_US" : "fr_FR"}
      />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};
