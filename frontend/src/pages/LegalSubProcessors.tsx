import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { SEO } from "../components/SEO";
import { useLanguage } from "../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-processors registry — RGPD Article 28 / Art. 30
//
// To add a new sub-processor: add an entry below + sign their DPA + notify
// users via in-app banner or email. Keep the list ordered by criticality
// (auth > payments > AI > storage > observability).
//
// ⚠️ Source de vérité backend : backend/src/core/subprocessors.py
// (DECLARED_SUBPROCESSORS). Les noms doivent être identiques — un test
// (backend/tests/test_subprocessors.py) échoue sinon. Tout fournisseur absent
// de cette liste a ses clés API neutralisées au démarrage du backend.
// ─────────────────────────────────────────────────────────────────────────────

interface SubProcessor {
  name: string;
  purposeFr: string;
  purposeEn: string;
  region: string;
  /** "eu" : données traitées dans l'UE. "outside_eu" : transfert encadré (DPF ou CCT). */
  transfer: "eu" | "outside_eu";
  dpaUrl: string;
}

const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "OVHcloud",
    purposeFr: "Hébergement du serveur (site web, API, base de données, Redis)",
    purposeEn: "Server hosting (website, API, database, Redis)",
    region: "France 🇫🇷",
    transfer: "eu",
    dpaUrl:
      "https://www.ovhcloud.com/fr/personal-data-protection/legal-privacy-security/",
  },
  {
    name: "Stripe",
    purposeFr: "Paiements, facturation, gestion des abonnements",
    purposeEn: "Payments, invoicing, subscription management",
    region: "Irlande 🇮🇪 (EU)",
    transfer: "outside_eu",
    dpaUrl: "https://stripe.com/legal/dpa",
  },
  {
    name: "Mistral AI",
    purposeFr: "Modèles IA (analyses vidéo, chat, agents)",
    purposeEn: "AI models (video analyses, chat, agents)",
    region: "France 🇫🇷",
    transfer: "eu",
    dpaUrl: "https://mistral.ai/terms#data-processing-agreement",
  },
  {
    name: "Google Cloud",
    purposeFr: "OAuth (connexion Google)",
    purposeEn: "OAuth (Google sign-in)",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://cloud.google.com/terms/data-processing-addendum",
  },
  {
    name: "Resend",
    purposeFr: "Emails transactionnels (vérification, reset, etc.)",
    purposeEn: "Transactional emails (verification, reset, etc.)",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://resend.com/legal/dpa",
  },
  {
    name: "ElevenLabs",
    purposeFr: "Synthèse vocale (audio des synthèses, appels vocaux) et transcription de secours",
    purposeEn: "Text-to-speech (summary audio, voice calls) and fallback transcription",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://elevenlabs.io/dpa",
  },
  {
    name: "Supadata",
    purposeFr: "Récupération de transcriptions YouTube",
    purposeEn: "YouTube transcript retrieval",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://supadata.ai/privacy",
  },
  {
    name: "Perplexity AI",
    purposeFr: "Enrichissement web (recherche pour le chat)",
    purposeEn: "Web enrichment (chat web search)",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://www.perplexity.ai/hub/legal/privacy-policy",
  },
  {
    name: "Brave Search",
    purposeFr: "Recherche web (fact-checking)",
    purposeEn: "Web search (fact-checking)",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://brave.com/privacy/browser/",
  },
  {
    name: "Cloudflare R2",
    purposeFr: "Stockage des miniatures et audios, sauvegardes redondantes",
    purposeEn: "Thumbnail and audio storage, redundant backups",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
  {
    name: "AWS S3",
    purposeFr: "Sauvegardes primaires de la base de données",
    purposeEn: "Primary database backups",
    region: "EU (eu-west-3) 🇪🇺",
    transfer: "eu",
    dpaUrl: "https://aws.amazon.com/service-terms/",
  },
  {
    name: "Sentry",
    purposeFr: "Monitoring d'erreurs (rapports anonymisés)",
    purposeEn: "Error monitoring (anonymized reports)",
    region: "USA 🇺🇸",
    transfer: "outside_eu",
    dpaUrl: "https://sentry.io/legal/dpa/",
  },
  {
    name: "PostHog",
    purposeFr: "Analytics produit (consentement utilisateur requis)",
    purposeEn: "Product analytics (user consent required)",
    region: "EU (eu.i.posthog.com) 🇪🇺",
    transfer: "eu",
    dpaUrl: "https://posthog.com/dpa",
  },
];

export default function LegalSubProcessors() {
  const { language } = useLanguage();
  const t = (fr: string, en: string) => (language === "fr" ? fr : en);

  return (
    <>
      <SEO
        title={t("Sous-traitants RGPD", "GDPR Sub-processors")}
        description={t(
          "Liste des sous-traitants utilisés par DeepSight pour traiter vos données.",
          "List of sub-processors used by DeepSight to process your data.",
        )}
      />
      <div className="min-h-screen bg-bg-primary p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-4xl"
        >
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-text-primary">
              {t("Sous-traitants", "Sub-processors")}
            </h1>
            <p className="mt-3 text-text-secondary">
              {t(
                "DeepSight collabore avec les sous-traitants ci-dessous pour fournir le service. Conformément au RGPD (article 28), nous tenons à jour cette liste publique.",
                "DeepSight relies on the sub-processors below to deliver the service. In line with GDPR Article 28, we keep this public list up to date.",
              )}
            </p>
            <p className="mt-2 text-sm text-text-tertiary">
              {t("Dernière mise à jour : ", "Last updated: ")}
              <time dateTime="2026-11-26">2026-11-26</time>
            </p>
          </header>

          <div className="overflow-x-auto rounded-lg border border-white/5 bg-bg-secondary/50">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-bg-secondary text-xs uppercase tracking-wider text-text-tertiary">
                <tr>
                  <th className="px-4 py-3">{t("Nom", "Name")}</th>
                  <th className="px-4 py-3">{t("Finalité", "Purpose")}</th>
                  <th className="px-4 py-3">{t("Région", "Region")}</th>
                  <th className="px-4 py-3">
                    {t("Encadrement", "Safeguard")}
                  </th>
                  <th className="px-4 py-3">DPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {SUB_PROCESSORS.map((sp) => (
                  <tr
                    key={sp.name}
                    className="transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {sp.name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {t(sp.purposeFr, sp.purposeEn)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {sp.region}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {sp.transfer === "eu"
                        ? t("Données dans l'UE", "Data in the EU")
                        : t("Hors UE : DPF ou CCT", "Outside EU: DPF or SCCs")}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={sp.dpaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent-primary hover:underline"
                      >
                        {t("Voir", "View")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-10 space-y-4 text-text-secondary">
            <h2 className="text-2xl font-semibold text-text-primary">
              {t("Notifications de changement", "Change notifications")}
            </h2>
            <p>
              {t(
                "Tout ajout ou retrait d'un sous-traitant est notifié aux utilisateurs au moins 30 jours avant son entrée en vigueur, soit par email, soit via une bannière dans l'application.",
                "Any addition or removal of a sub-processor is communicated to users at least 30 days before it takes effect, either by email or via an in-app banner.",
              )}
            </p>

            <h2 className="text-2xl font-semibold text-text-primary">
              {t("Transferts hors Union européenne", "Transfers outside the EU")}
            </h2>
            <p>
              {t(
                "Lorsqu'un sous-traitant traite des données hors de l'UE, le transfert est encadré soit par la décision d'adéquation « EU-U.S. Data Privacy Framework » (DPF) si le fournisseur y est certifié, soit par les clauses contractuelles types (CCT) de la Commission européenne intégrées à son DPA. Nous privilégions les fournisseurs européens : les analyses et le chat reposent exclusivement sur Mistral AI (France).",
                "When a sub-processor handles data outside the EU, the transfer relies either on the EU-U.S. Data Privacy Framework (DPF) adequacy decision when the provider is certified, or on the European Commission's Standard Contractual Clauses (SCCs) included in its DPA. We favour European providers: analyses and chat run exclusively on Mistral AI (France).",
              )}
            </p>

            <h2 className="text-2xl font-semibold text-text-primary">
              {t("Hébergement des données", "Data hosting")}
            </h2>
            <p>
              {t(
                "Les données utilisateur (compte, analyses, conversations) sont stockées sur un serveur OVHcloud en France. Les sauvegardes sont répliquées sur AWS S3 (UE) et Cloudflare R2 (USA, en redondance).",
                "User data (account, analyses, conversations) is stored on an OVHcloud server in France. Backups are replicated to AWS S3 (EU) and Cloudflare R2 (USA, for redundancy).",
              )}
            </p>

            <h2 className="text-2xl font-semibold text-text-primary">
              {t("Vos droits", "Your rights")}
            </h2>
            <p>
              {t(
                "Vous pouvez exercer vos droits RGPD (accès, rectification, portabilité, effacement) directement depuis ",
                "You can exercise your GDPR rights (access, rectification, portability, erasure) directly from ",
              )}
              <a
                href="/account"
                className="text-accent-primary hover:underline"
              >
                {t("votre compte", "your account")}
              </a>
              {t(" ou en écrivant à ", " or by writing to ")}
              <a
                href="mailto:legal@deepsightsynthesis.com"
                className="text-accent-primary hover:underline"
              >
                legal@deepsightsynthesis.com
              </a>
              .
            </p>
          </section>

          <footer className="mt-12 border-t border-white/5 pt-6 text-sm text-text-tertiary">
            <a href="/legal/privacy" className="hover:underline">
              ←{" "}
              {t(
                "Retour à la politique de confidentialité",
                "Back to Privacy Policy",
              )}
            </a>
          </footer>
        </motion.div>
      </div>
    </>
  );
}
