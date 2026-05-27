/**
 * 🛡️ TRUST CENTER — Page publique compliance & sécurité
 * ═══════════════════════════════════════════════════════════════════════════════
 * URL : /trust
 * Promesse : "Vos données restent en Europe. Voici les preuves."
 * Conformité : RGPD, NIS2, DORA, AI Act
 * ⚠️ Page en review légale — à ne pas considérer comme document contractuel
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Lock,
  Server,
  Eye,
  FileText,
  Mail,
  AlertTriangle,
  ExternalLink,
  Globe,
  ScanEye,
  Scale,
  HelpCircle,
} from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { DPOContactForm } from "../components/DPOContactForm";
import TrustFAQ from "../components/TrustFAQ";

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 DONNÉES TRUST CENTER
// ═══════════════════════════════════════════════════════════════════════════════

const TRUST_INFO = {
  company: {
    name: "Maxime Leparc",
    type: "Entrepreneur Individuel",
    tradeName: "Deep Sight",
    siret: "994 558 898 00015",
    address: "15 rue Clément Mulat, 69350 La Mulatière, France",
  },
  dpo: {
    current: "dpo@deepsightsynthesis.com",
    legacy: "maximeleparc3@gmail.com",
    sla: "5 jours ouvrés (1 mois max conformément à l'Art 12 RGPD)",
  },
  links: {
    architectureRepo: "https://github.com/Fonira/deepsight-architecture",
    statusPage: "https://status.deepsightsynthesis.com",
    subprocessors: "/trust/subprocessors",
    cnil: "https://www.cnil.fr",
    sccEu: "https://eur-lex.europa.eu/eli/dec_impl/2021/914",
    aiAct: "https://eur-lex.europa.eu/eli/reg/2024/1689",
  },
  lastUpdate: "6 mai 2026 — FAQ B2B ajoutée",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 TYPAGE
// ═══════════════════════════════════════════════════════════════════════════════

interface DataFlowRow {
  component: string;
  provider: string;
  location: string;
  dataType: string;
}

interface DocumentRow {
  name: string;
  format: string;
  status: "available" | "coming-soon" | "on-request";
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 DONNÉES STATIQUES
// ═══════════════════════════════════════════════════════════════════════════════

const DATA_FLOW: DataFlowRow[] = [
  {
    component: "Backend FastAPI",
    provider: "Hetzner Online GmbH",
    location: "Falkenstein, Allemagne",
    dataType: "Toutes (analyses, comptes)",
  },
  {
    component: "Modèle LLM principal",
    provider: "Mistral AI",
    location: "France (région EU-West)",
    dataType: "Inputs / outputs analyses",
  },
  {
    component: "Base PostgreSQL 17",
    provider: "Self-hosted",
    location: "Hetzner — Allemagne",
    dataType: "Toutes (données utilisateur)",
  },
  {
    component: "Cache Redis 7",
    provider: "Self-hosted",
    location: "Hetzner — Allemagne",
    dataType: "Sessions, queues",
  },
  {
    component: "Stockage objets",
    provider: "Cloudflare R2",
    location: "Région UE",
    dataType: "Exports utilisateur",
  },
  {
    component: "Email transactionnel",
    provider: "Resend",
    location: "UE",
    dataType: "Email + métadonnées",
  },
  {
    component: "Paiements",
    provider: "Stripe Payments Europe",
    location: "Irlande (EEE)",
    dataType: "PII billing",
  },
  {
    component: "Monitoring erreurs",
    provider: "Sentry SaaS EU",
    location: "Frankfurt, Allemagne",
    dataType: "Stack traces (PII redaction active)",
  },
];

const LEGAL_DOCUMENTS: DocumentRow[] = [
  {
    name: "DPA — Data Processing Agreement",
    format: "PDF signable",
    status: "on-request",
    description:
      "Clauses contractuelles type EU 2021/914, modules 2 et 3. Pré-rempli avec Deep Sight comme processeur.",
  },
  {
    name: "Annexe sécurité (Annexe II SCC)",
    format: "PDF",
    status: "on-request",
    description:
      "Mesures techniques et organisationnelles détaillées : chiffrement, contrôle d'accès, journalisation.",
  },
  {
    name: "Politique de confidentialité",
    format: "HTML",
    status: "available",
    description: "Conforme RGPD Art 13/14. Disponible publiquement.",
  },
  {
    name: "CGU / CGV",
    format: "HTML",
    status: "available",
    description: "Conditions générales d'utilisation et de vente.",
  },
  {
    name: "Certifications & audits",
    format: "—",
    status: "coming-soon",
    description:
      "ISO 27001 visée Q4 2026, SOC 2 Type II visée Q2 2027 — non encore obtenues.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

type IconColor =
  | "amber"
  | "blue"
  | "green"
  | "purple"
  | "pink"
  | "cyan"
  | "orange"
  | "indigo";

const ICON_COLOR_BG: Record<IconColor, string> = {
  amber: "bg-amber-500/20",
  blue: "bg-blue-500/20",
  green: "bg-green-500/20",
  purple: "bg-purple-500/20",
  pink: "bg-pink-500/20",
  cyan: "bg-cyan-500/20",
  orange: "bg-orange-500/20",
  indigo: "bg-indigo-500/20",
};

const SectionTitle: React.FC<{
  icon: React.ReactNode;
  title: string;
  num: number;
  iconColor?: IconColor;
}> = ({ icon, title, num, iconColor = "amber" }) => (
  <div className="flex items-center gap-3 mb-6">
    <div
      className={`p-2 ${ICON_COLOR_BG[iconColor]} rounded-lg flex-shrink-0`}
      aria-hidden="true"
    >
      {icon}
    </div>
    <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-baseline gap-3">
      <span className="text-text-muted text-sm font-mono">
        {num.toString().padStart(2, "0")}.
      </span>
      {title}
    </h2>
  </div>
);

const DocumentStatusBadge: React.FC<{ status: DocumentRow["status"] }> = ({
  status,
}) => {
  switch (status) {
    case "available":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30">
          Disponible
        </span>
      );
    case "on-request":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
          Sur demande
        </span>
      );
    case "coming-soon":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
          Roadmap
        </span>
      );
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

const TrustPage: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dpaMailto = `mailto:${TRUST_INFO.dpo.current}?subject=${encodeURIComponent("Demande DPA — Deep Sight")}`;

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title="Trust Center — Sécurité & Conformité"
        description="Trust Center DeepSight : architecture compliance-first, données hébergées en Europe (Hetzner Allemagne, Mistral France), conformité RGPD, NIS2, DORA, AI Act."
        path="/trust"
        keywords="DeepSight, trust center, RGPD, GDPR, NIS2, DORA, AI Act, compliance, sécurité, sous-traitants, DPA, Sentry EU, Mistral AI, Hetzner"
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
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-3 text-text-primary">
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-accent-primary" />
                  </div>
                  Trust Center
                </h1>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Retour au Dashboard
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
                  Ce Trust Center est un document de transparence en cours de
                  finalisation par notre conseil juridique data privacy. Les
                  engagements opérationnels (architecture, hébergement,
                  sous-traitants) sont exacts et vérifiables. Les clauses
                  contractuelles formelles (DPA, SCC) sont en cours de revue —
                  contacter{" "}
                  <a
                    href={dpaMailto}
                    className="underline hover:text-amber-200"
                  >
                    {TRUST_INFO.dpo.current}
                  </a>{" "}
                  pour obtenir la version validée.
                </p>
              </div>
            </div>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 1. HERO */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <div className="bg-white/5 rounded-2xl p-6 sm:p-8 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl" aria-hidden="true">
                    🇫🇷🇪🇺
                  </span>
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-300">
                    Compliance-first by design
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3 leading-tight">
                  Vos données restent en Europe.
                  <br />
                  Voici les preuves.
                </h2>
                <p className="text-text-secondary text-base sm:text-lg max-w-3xl">
                  Deep Sight est conçu pour les organisations soumises au RGPD,
                  à NIS2, à DORA et aux exigences sectorielles strictes (banque,
                  assurance, juridique). Backend allemand, IA française,
                  monitoring Frankfurt — aucune donnée utilisateur identifiable
                  ne quitte l'Espace Économique Européen.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={dpaMailto}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary-hover text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    Demander le DPA
                  </a>
                  <Link
                    to={TRUST_INFO.links.subprocessors}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-colors text-sm border border-white/10"
                  >
                    <Globe className="w-4 h-4" />
                    Voir la liste des sous-traitants
                  </Link>
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 2. ARCHITECTURE DATA FLOW */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={1}
                icon={<Server className="w-5 h-5 text-amber-400" />}
                title="Architecture & flux de données"
              />
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10">
                  <p className="text-text-primary text-sm leading-relaxed">
                    <strong className="text-white">
                      Une seule règle, sans exception :
                    </strong>{" "}
                    aucune donnée utilisateur identifiable ne quitte l'EEE. Les
                    composants ci-dessous décrivent le flux complet de la
                    donnée, du clic utilisateur à la persistance.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-text-primary">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="text-left py-3 px-4 text-white font-medium">
                          Composant
                        </th>
                        <th className="text-left py-3 px-4 text-white font-medium">
                          Fournisseur
                        </th>
                        <th className="text-left py-3 px-4 text-white font-medium">
                          Localisation
                        </th>
                        <th className="text-left py-3 px-4 text-white font-medium">
                          Type de donnée
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {DATA_FLOW.map((row) => (
                        <tr key={row.component} className="hover:bg-white/5">
                          <td className="py-3 px-4 font-medium text-white">
                            {row.component}
                          </td>
                          <td className="py-3 px-4">{row.provider}</td>
                          <td className="py-3 px-4 text-green-300">
                            {row.location}
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-xs">
                            {row.dataType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-green-500/5 border-t border-white/10">
                  <p className="text-green-200 text-xs flex items-center gap-2">
                    <Shield className="w-4 h-4" aria-hidden="true" />
                    Sentry EU SaaS (Frankfurt) : migration confirmée. Aucun
                    composant US dans le flux.
                  </p>
                </div>
                <div className="p-4 border-t border-white/10">
                  <a
                    href={TRUST_INFO.links.architectureRepo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Architecture détaillée — repo GitHub public
                  </a>
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 3. SUBPROCESSORS */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={2}
                icon={<Globe className="w-5 h-5 text-blue-400" />}
                title="Liste des sous-traitants"
                iconColor="blue"
              />
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <p className="text-text-primary text-sm mb-4">
                  La liste exhaustive et tenue à jour de nos sous-traitants
                  (article 28 RGPD) est publiée à une URL canonique dédiée.
                  Chaque ajout déclenche une notification 30 jours avant
                  activation pour les clients Expert, avec droit d'objection.
                </p>
                <Link
                  to={TRUST_INFO.links.subprocessors}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/30 rounded-lg text-sm font-medium transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Voir la liste complète (8 sous-traitants)
                </Link>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 4. DOCUMENTS LÉGAUX */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={3}
                icon={<FileText className="w-5 h-5 text-purple-400" />}
                title="Documents légaux"
                iconColor="purple"
              />
              <div className="space-y-3">
                {LEGAL_DOCUMENTS.map((doc) => (
                  <div
                    key={doc.name}
                    className="bg-white/5 rounded-lg p-5 border border-white/10"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                      <div>
                        <h3 className="text-white font-medium">{doc.name}</h3>
                        <p className="text-xs text-text-muted mt-1">
                          Format : {doc.format}
                        </p>
                      </div>
                      <DocumentStatusBadge status={doc.status} />
                    </div>
                    <p className="text-sm text-text-secondary mb-3">
                      {doc.description}
                    </p>
                    {doc.status === "on-request" && (
                      <a
                        href={dpaMailto}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-xs font-medium transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Demander par email
                      </a>
                    )}
                    {doc.status === "available" && doc.name.includes("CGU") && (
                      <Link
                        to="/legal#cgu"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/30 rounded text-xs font-medium transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Lire les CGU
                      </Link>
                    )}
                    {doc.status === "available" &&
                      doc.name.includes("confidentialité") && (
                        <Link
                          to="/legal#privacy"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/30 rounded text-xs font-medium transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Lire la politique
                        </Link>
                      )}
                  </div>
                ))}
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 5. MESURES TECHNIQUES */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={4}
                icon={<Lock className="w-5 h-5 text-green-400" />}
                title="Mesures techniques de sécurité"
                iconColor="green"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Chiffrement
                  </h3>
                  <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
                    <li>
                      <strong className="text-white">En transit :</strong> TLS
                      1.3 (Caddy + auto-SSL Let's Encrypt) sur tous les
                      endpoints publics. HSTS strict avec preload.
                    </li>
                    <li>
                      <strong className="text-white">Au repos :</strong>{" "}
                      PostgreSQL avec encryption disque (LUKS Hetzner) ;
                      transcripts vidéo chiffrés AES-256.
                    </li>
                    <li>
                      Secrets via variables d'environnement chiffrées, jamais
                      versionnés (Gitleaks pre-commit).
                    </li>
                  </ul>
                </div>

                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <ScanEye className="w-4 h-4 text-amber-400" />
                    Anonymisation & minimisation
                  </h3>
                  <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
                    <li>Aucun fingerprinting browser non strictement requis</li>
                    <li>
                      PII redaction automatique dans les logs (pre-commit hook)
                    </li>
                    <li>
                      IP analytics anonymisée (last octet zeroed) après 24 h
                    </li>
                    <li>Pas de cookie publicitaire, pas de tracker tiers</li>
                  </ul>
                </div>

                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Cycle de vie des données
                  </h3>
                  <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
                    <li>Transcripts vidéo : TTL 24 h dans Redis post-analyse</li>
                    <li>Analyses : conservées tant que le compte est actif</li>
                    <li>
                      Suppression de compte : effacement hard sous 30 jours
                      (RGPD Art 17)
                    </li>
                    <li>
                      Backups : retention 30 jours, suppression automatique
                    </li>
                  </ul>
                </div>

                <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    Accès & authentification
                  </h3>
                  <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
                    <li>
                      JWT 15 min + refresh token 7 jours rotatif
                    </li>
                    <li>
                      Pas d'accès admin programmé sur les comptes utilisateurs
                      (audit log obligatoire si support exceptionnel)
                    </li>
                    <li>
                      2FA TOTP planifié sur les plans Pro et Expert (roadmap)
                    </li>
                    <li>
                      Principe du moindre privilège — chaque service a un compte
                      dédié
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 6. GDPR Article 22 */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={5}
                icon={<Scale className="w-5 h-5 text-cyan-400" />}
                title="GDPR Art 22 — décisions automatisées"
                iconColor="cyan"
              />
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
                <p className="text-text-primary text-sm">
                  <strong className="text-white">Position Deep Sight :</strong>{" "}
                  nos analyses IA constituent une{" "}
                  <em>assistance à la décision</em>, pas une « décision
                  exclusivement automatisée produisant des effets juridiques »
                  au sens de l'Article 22 RGPD. Aucune décision impactant un
                  individu n'est prise par DeepSight sans intervention humaine.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <p className="text-cyan-200 font-medium text-sm mb-1">
                      Droit à la révision humaine
                    </p>
                    <p className="text-xs text-text-secondary">
                      Sur demande, un membre de l'équipe Deep Sight reverra
                      toute analyse IA contestée. SLA : 5 jours ouvrés.
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <p className="text-cyan-200 font-medium text-sm mb-1">
                      Droit d'opposition
                    </p>
                    <p className="text-xs text-text-secondary">
                      Opt-out possible à tout moment depuis le portail compte.
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <p className="text-cyan-200 font-medium text-sm mb-1">
                      Droit à l'explication
                    </p>
                    <p className="text-xs text-text-secondary">
                      Modèles utilisés (Mistral small/medium/large) documentés
                      publiquement. Pipeline d'analyse ouvert.
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <p className="text-cyan-200 font-medium text-sm mb-1">
                      Pas de scoring individuel
                    </p>
                    <p className="text-xs text-text-secondary">
                      Aucun credit scoring, profilage publicitaire ou
                      classification individuelle.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 7. CONFORMITÉ SECTORIELLE */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={6}
                icon={<Shield className="w-5 h-5 text-pink-400" />}
                title="Conformité sectorielle"
                iconColor="pink"
              />
              <div className="space-y-3">
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-2">
                    Banque & Assurance — DORA
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Questionnaire ICT third-party risk management standardisé{" "}
                    <span className="text-purple-300">
                      en préparation pour Q3 2026
                    </span>
                    . Disponible sur demande pour les RFP en cours.
                  </p>
                </div>
                <div className="bg-amber-500/5 rounded-lg p-5 border border-amber-500/20">
                  <h3 className="text-amber-200 font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle
                      className="w-4 h-4 text-amber-400"
                      aria-hidden="true"
                    />
                    Santé — HDS
                  </h3>
                  <p className="text-sm text-amber-100">
                    <strong>
                      Deep Sight n'est pas certifié Hébergeur de Données de
                      Santé (HDS).
                    </strong>{" "}
                    Si vous traitez des données de santé identifiantes,
                    n'utilisez pas Deep Sight pour ces données. Aucune
                    exception.
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-2">
                    AI Act européen
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Deep Sight n'est <strong>pas</strong> un système d'IA à haut
                    risque au sens de l'Annexe III du{" "}
                    <a
                      href={TRUST_INFO.links.aiAct}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary hover:underline inline-flex items-center gap-1"
                    >
                      Règlement (UE) 2024/1689{" "}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    . Notice de transparence systèmes IA visible dans l'UI
                    (badge « Analyse IA » sur chaque sortie générée).
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <h3 className="text-white font-medium mb-2">
                    Certifications visées
                  </h3>
                  <p className="text-sm text-text-secondary">
                    <strong className="text-white">ISO/IEC 27001</strong> —
                    audit prévu Q4 2026 ·{" "}
                    <strong className="text-white">SOC 2 Type II</strong> —
                    audit prévu Q2 2027. Aucune certification n'est annoncée
                    avant obtention effective auprès d'un registrar accrédité.
                  </p>
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 8. STATUS & INCIDENTS */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={7}
                icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
                title="Status & incidents"
                iconColor="orange"
              />
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <ul className="space-y-2 text-sm text-text-secondary mb-4">
                  <li>• Uptime monitoring 24/7 (Uptime Kuma + alertes)</li>
                  <li>• SLA cible : 99,5 % mensuel sur l'API</li>
                  <li>
                    • Incidents publiés sous 4 h ouvrées sur la page status
                  </li>
                  <li>• Post-mortems publics pour tout incident majeur</li>
                </ul>
                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20 mb-3">
                  <p className="text-xs text-orange-200">
                    <strong>Page status en cours d'activation :</strong>{" "}
                    {TRUST_INFO.links.statusPage} sera publiquement visible dans
                    les prochains jours.
                  </p>
                </div>
                <a
                  href={TRUST_INFO.links.statusPage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/30 rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Voir la page status (à venir)
                </a>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 9. TRANSPARENCY REPORT */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12">
              <SectionTitle
                num={8}
                icon={<FileText className="w-5 h-5 text-indigo-400" />}
                title="Transparency report annuel"
                iconColor="indigo"
              />
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <p className="text-text-primary text-sm mb-3">
                  Publication prévue chaque 1<sup>er</sup> janvier à partir de
                  2027 :
                </p>
                <ul className="space-y-2 text-sm text-text-secondary list-disc list-inside ml-2">
                  <li>
                    Nombre de demandes RGPD reçues (accès, rectification,
                    effacement, portabilité)
                  </li>
                  <li>
                    Nombre de réquisitions judiciaires reçues et leur traitement
                  </li>
                  <li>Sous-traitants ajoutés ou retirés sur l'année</li>
                  <li>Incidents de sécurité notifiés à la CNIL</li>
                </ul>
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 9. CONTACT DPO */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-8">
              <SectionTitle
                num={9}
                icon={<Mail className="w-5 h-5 text-amber-400" />}
                title="Contact DPO"
              />
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">
                    Délégué à la protection des données
                  </p>
                  <p>
                    <a
                      href={`mailto:${TRUST_INFO.dpo.current}`}
                      className="text-lg text-accent-primary hover:underline font-medium"
                    >
                      {TRUST_INFO.dpo.current}
                    </a>{" "}
                    <span className="inline-flex items-center px-2 py-0.5 ml-2 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Actif
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">
                    Contact administratif (fallback)
                  </p>
                  <a
                    href={`mailto:${TRUST_INFO.dpo.legacy}`}
                    className="text-text-secondary hover:underline text-sm font-mono"
                  >
                    {TRUST_INFO.dpo.legacy}
                  </a>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">
                    SLA de réponse
                  </p>
                  <p className="text-text-primary text-sm">
                    {TRUST_INFO.dpo.sla}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-1">
                    Adresse postale (responsable du traitement)
                  </p>
                  <p className="text-text-primary text-sm">
                    {TRUST_INFO.company.name} — {TRUST_INFO.company.type}
                    <br />
                    {TRUST_INFO.company.tradeName} (nom commercial)
                    <br />
                    {TRUST_INFO.company.address}
                    <br />
                    SIRET : {TRUST_INFO.company.siret}
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <p className="text-xs text-text-secondary">
                    Vous pouvez introduire une réclamation auprès de la CNIL :{" "}
                    <a
                      href={TRUST_INFO.links.cnil}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary hover:underline"
                    >
                      www.cnil.fr
                    </a>
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <DPOContactForm />
              </div>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* 10. FAQ — Questions fréquentes décideurs B2B régulés      */}
            {/* ────────────────────────────────────────────────────────── */}
            <section className="mb-12" aria-labelledby="trust-faq-heading">
              <SectionTitle
                num={10}
                icon={<HelpCircle className="w-5 h-5 text-blue-400" />}
                title="FAQ — Compliance, sécurité, AI Act"
                iconColor="blue"
              />
              <TrustFAQ />
            </section>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-border-subtle text-center text-text-muted text-sm">
              <p>Dernière mise à jour : {TRUST_INFO.lastUpdate}</p>
              <p className="mt-2">
                Pour toute question compliance, contactez{" "}
                <a
                  href={`mailto:${TRUST_INFO.dpo.current}`}
                  className="text-accent-primary hover:underline"
                >
                  {TRUST_INFO.dpo.current}
                </a>
              </p>
              <p className="mt-2 text-xs">
                <Link to="/legal" className="hover:text-accent-primary">
                  Mentions légales
                </Link>{" "}
                ·{" "}
                <Link to="/legal#cgu" className="hover:text-accent-primary">
                  CGU
                </Link>{" "}
                ·{" "}
                <Link to="/legal#privacy" className="hover:text-accent-primary">
                  Politique de confidentialité
                </Link>{" "}
                ·{" "}
                <Link
                  to={TRUST_INFO.links.subprocessors}
                  className="hover:text-accent-primary"
                >
                  Sous-traitants
                </Link>
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrustPage;
