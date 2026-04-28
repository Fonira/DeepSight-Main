import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.deepsightsynthesis.com";

/**
 * Map d'un path vers son label affiché dans le breadcrumb.
 * Inclure ici toute nouvelle route publique pour qu'elle soit lisible
 * par les LLMs et Google via le JSON-LD BreadcrumbList.
 */
const LABELS: Record<string, string> = {
  "/about": "À propos",
  "/upgrade": "Tarifs",
  "/contact": "Contact",
  "/api-docs": "Documentation API",
  "/status": "Statut des services",
  "/legal": "Mentions légales",
  "/legal/cgu": "Conditions générales d'utilisation",
  "/legal/cgv": "Conditions générales de vente",
  "/legal/privacy": "Politique de confidentialité",
};

interface BreadcrumbJsonLdProps {
  /** Path absolu de la page courante, ex: "/about" ou "/legal/cgu" */
  path: string;
  /** Override du label final (utile pour pages dynamiques type /s/:token) */
  label?: string;
}

/**
 * Émet un JSON-LD BreadcrumbList Schema.org dans le `<head>` via Helmet.
 * Construit la hiérarchie automatiquement à partir des segments du path.
 *
 * Usage :
 *   <BreadcrumbJsonLd path="/about" />
 *   <BreadcrumbJsonLd path="/legal/cgu" />
 *   <BreadcrumbJsonLd path={`/s/${token}`} label={videoTitle} />
 */
export const BreadcrumbJsonLd = ({ path, label }: BreadcrumbJsonLdProps) => {
  const items: Array<{ name: string; url: string }> = [
    { name: "Accueil", url: `${SITE_URL}/` },
  ];

  if (path !== "/") {
    const segments = path.split("/").filter(Boolean);
    let current = "";
    segments.forEach((segment, index) => {
      current += "/" + segment;
      const isLast = index === segments.length - 1;
      const itemLabel = isLast && label ? label : LABELS[current] || segment;
      items.push({ name: itemLabel, url: `${SITE_URL}${current}` });
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
};
