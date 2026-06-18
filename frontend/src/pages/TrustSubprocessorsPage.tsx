/**
 * 🌍 TRUST CENTER — Sous-traitants (Subprocessor list)
 * ═══════════════════════════════════════════════════════════════════════════════
 * URL : /trust/subprocessors
 * Article 28 RGPD — liste tenue à jour des sous-traitants
 * ⚠️ Page en review légale — engagements opérationnels exacts mais clauses
 *    contractuelles formelles (DPA, SCC) en cours de validation par avocat.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Globe,
  Shield,
  AlertTriangle,
  ExternalLink,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 TYPAGE
// ═══════════════════════════════════════════════════════════════════════════════

interface Subprocessor {
  name: string;
  service: string;
  location: string;
  isEea: boolean;
  addedOn: string;
  privacyUrl: string;
  termsUrl: string;
  certifications?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 DONNÉES SOUS-TRAITANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Hetzner Online GmbH",
    service: "Hébergement backend, base PostgreSQL, cache Redis",
    location: "Falkenstein, Allemagne",
    isEea: true,
    addedOn: "2026-01-08",
    privacyUrl: "https://www.hetzner.com/legal/privacy-policy",
    termsUrl: "https://www.hetzner.com/legal/terms-and-conditions",
    certifications: "ISO 27001",
  },
  {
    name: "Mistral AI",
    service: "Modèles LLM (analyses, chat, embeddings)",
    location: "Paris, France",
    isEea: true,
    addedOn: "2026-01-08",
    privacyUrl: "https://mistral.ai/terms/#privacy-policy",
    termsUrl: "https://mistral.ai/terms",
    certifications: "RGPD conforme — modèles hébergés UE",
  },
  {
    name: "Cloudflare R2 (Cloudflare Inc.)",
    service: "Stockage objets — exports utilisateur",
    location: "Région UE (configuration EU jurisdiction)",
    isEea: true,
    addedOn: "2026-02-15",
    privacyUrl: "https://www.cloudflare.com/privacypolicy/",
    termsUrl: "https://www.cloudflare.com/terms/",
    certifications: "ISO 27001, SOC 2 Type II",
  },
  {
    name: "Resend (Resend, Inc.)",
    service: "Email transactionnel (vérifications, notifications)",
    location: "UE (région EU sélectionnée)",
    isEea: true,
    addedOn: "2026-01-15",
    privacyUrl: "https://resend.com/legal/privacy-policy",
    termsUrl: "https://resend.com/legal/terms-of-service",
    certifications: "SOC 2 Type II",
  },
  {
    name: "Stripe Payments Europe Ltd",
    service: "Traitement des paiements et facturation",
    location: "Dublin, Irlande (EEE)",
    isEea: true,
    addedOn: "2026-01-08",
    privacyUrl: "https://stripe.com/privacy",
    termsUrl: "https://stripe.com/legal",
    certifications: "PCI-DSS Level 1, ISO 27001, SOC 2",
  },
  {
    name: "Sentry (Functional Software, Inc. — instance EU SaaS)",
    service: "Monitoring erreurs (stack traces avec PII redaction)",
    location: "Frankfurt, Allemagne (instance sentry.io EU)",
    isEea: true,
    addedOn: "2026-04-25",
    privacyUrl: "https://sentry.io/privacy/",
    termsUrl: "https://sentry.io/terms/",
    certifications: "ISO 27001, SOC 2 Type II",
  },
  {
    name: "GitHub, Inc. (Microsoft)",
    service: "Hébergement code source (repo public + repos privés)",
    location: "USA (clauses contractuelles types EU)",
    isEea: false,
    addedOn: "2026-01-08",
    privacyUrl: "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement",
    termsUrl: "https://docs.github.com/site-policy/github-terms/github-terms-of-service",
    certifications: "ISO 27001, SOC 2 Type II — DPF certifié",
  },
  {
    name: "Vercel Inc.",
    service: "Hébergement frontend statique (CDN mondial)",
    location: "USA (CDN mondial, cache statique uniquement)",
    isEea: false,
    addedOn: "2026-01-08",
    privacyUrl: "https://vercel.com/legal/privacy-policy",
    termsUrl: "https://vercel.com/legal/terms",
    certifications: "ISO 27001, SOC 2 Type II — DPF certifié",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 SOUS-COMPOSANT — Badge localisation
// ═══════════════════════════════════════════════════════════════════════════════

const LocationBadge: React.FC<{ isEea: boolean }> = ({ isEea }) =>
  isEea ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30 whitespace-nowrap">
      <span aria-hidden="true">🇪🇺</span> EEE
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
      <span aria-hidden="true">🇺🇸</span> SCC
    </span>
  );

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

const TrustSubprocessorsPage: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dpoMailto =
    "mailto:maximeleparc3@gmail.com?subject=" +
    encodeURIComponent("Demande Trust Center — Sous-traitants");

  const eeaCount = SUBPROCESSORS.filter((s) => s.isEea).length;
  const totalCount = SUBPROCESSORS.length;

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title="Sous-traitants — Trust Center"
        description="Liste exhaustive des sous-traitants Deep Sight (article 28 RGPD) : 8 sous-traitants, 6 dans l'EEE, 2 sous clauses contractuelles types EU."
        path="/trust/subprocessors"
        keywords="DeepSight, sous-traitants, processeurs, RGPD article 28, SCC, EEE, Hetzner, Mistral, Cloudflare, Stripe, Resend, Sentry"
      />
      <DoodleBackground variant="academic" />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main
        id="main-content"
        className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"}`}
      >
        <div className="min-h-screen pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <nav
              className="mb-4 text-sm text-text-muted flex items-center gap-2"
              aria-label="Fil d'Ariane"
            >
              <Link to="/trust" className="hover:text-accent-primary">
                Trust Center
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-text-secondary">Sous-traitants</span>
            </nav>

            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-3 text-text-primary">
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-accent-primary" />
                  </div>
                  Sous-traitants Deep Sight
                </h1>
                <Link
                  to="/trust"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-text-primary font-medium rounded-lg transition-colors text-sm border border-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Trust Center
                </Link>
              </div>
            </header>

            {/* ⚠️ Bandeau review légale */}
            <div
              role="status"
              className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3"
            >
              <AlertTriangle
                className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="text-sm text-amber-100">
                <p className="font-medium text-amber-300 mb-1">
                  Page en review légale
                </p>
                <p>
                  Cette liste reflète exactement les sous-traitants en
                  production. La rédaction formelle au sens de l'article 28
                  RGPD est en cours de validation par notre conseil juridique.
                  Pour obtenir la version contractuelle signée (DPA + SCC),
                  contacter{" "}
                  <a href={dpoMailto} className="underline hover:text-amber-200">
                    maximeleparc3@gmail.com
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Intro & engagements */}
            <section className="mb-6 bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">
                Engagements article 28 RGPD
              </h2>
              <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-white">Notification 30 jours</strong>{" "}
                  avant l'activation de tout nouveau sous-traitant.
                </li>
                <li>
                  <strong className="text-white">Droit d'objection</strong> pour
                  les clients du plan Expert (résiliation possible si désaccord
                  sur un nouveau sous-traitant).
                </li>
                <li>
                  <strong className="text-white">
                    {eeaCount}/{totalCount} sous-traitants
                  </strong>{" "}
                  hébergent les données dans l'EEE. Les{" "}
                  {totalCount - eeaCount} restants (GitHub code source, Vercel
                  CDN frontend) opèrent sous clauses contractuelles types EU
                  2021/914 et leurs cas d'usage ne traitent pas de données
                  utilisateur identifiables côté serveur.
                </li>
                <li>
                  <strong className="text-white">Aucune donnée vidéo</strong>{" "}
                  utilisateur ni transcript n'est partagé hors EEE.
                </li>
              </ul>
            </section>

            {/* Tableau sous-traitants */}
            <section className="mb-6">
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-text-primary">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th
                          scope="col"
                          className="text-left py-3 px-4 text-white font-medium"
                        >
                          Nom
                        </th>
                        <th
                          scope="col"
                          className="text-left py-3 px-4 text-white font-medium"
                        >
                          Service
                        </th>
                        <th
                          scope="col"
                          className="text-left py-3 px-4 text-white font-medium"
                        >
                          Localisation
                        </th>
                        <th
                          scope="col"
                          className="text-left py-3 px-4 text-white font-medium hidden sm:table-cell"
                        >
                          Date d'ajout
                        </th>
                        <th
                          scope="col"
                          className="text-left py-3 px-4 text-white font-medium"
                        >
                          Liens
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {SUBPROCESSORS.map((sp) => (
                        <tr
                          key={sp.name}
                          className="hover:bg-white/5 align-top"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">
                              {sp.name}
                            </div>
                            {sp.certifications && (
                              <div className="text-xs text-green-300 mt-1 flex items-center gap-1">
                                <Shield className="w-3 h-3" aria-hidden="true" />
                                {sp.certifications}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-xs">
                            {sp.service}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <LocationBadge isEea={sp.isEea} />
                              <div className="text-xs text-text-muted">
                                {sp.location}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell text-xs text-text-muted font-mono">
                            {sp.addedOn}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <a
                                href={sp.privacyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent-primary hover:underline inline-flex items-center gap-1"
                              >
                                Privacy
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <a
                                href={sp.termsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent-primary hover:underline inline-flex items-center gap-1"
                              >
                                CGU
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* CTA contact */}
            <section className="mb-6 bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">
                Une question ou un signalement ?
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Pour toute demande relative aux sous-traitants, à la signature
                d'un DPA ou à un audit RFP, contactez le DPO Deep Sight.
              </p>
              <a
                href={dpoMailto}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary-hover text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                Contacter le DPO
              </a>
            </section>

            {/* Footer */}
            <footer className="mt-8 pt-6 border-t border-border-subtle text-center text-text-muted text-sm">
              <p>Liste mise à jour le 6 mai 2026</p>
              <p className="mt-2 text-xs">
                <Link to="/trust" className="hover:text-accent-primary">
                  Trust Center
                </Link>{" "}
                ·{" "}
                <Link to="/legal" className="hover:text-accent-primary">
                  Mentions légales
                </Link>{" "}
                ·{" "}
                <Link
                  to="/legal#privacy"
                  className="hover:text-accent-primary"
                >
                  Politique de confidentialité
                </Link>
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrustSubprocessorsPage;
