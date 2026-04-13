/**
 * About Page — DeepSight
 * Standalone public page with project vision, partners, open-source credits.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Code2,
  Globe,
  Shield,
  Cpu,
  Database,
  CreditCard,
  Mail,
  Music,
  MapPin,
  User,
  Sparkles,
  BookOpen,
  Search,
  MessageSquare,
  Sun,
} from "lucide-react";
import Layout from "../components/Layout";
import { SEO } from "../components/SEO";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface Partner {
  name: string;
  role: string;
  url: string;
  icon: React.ElementType;
}

const TECH_PARTNERS: Partner[] = [
  {
    name: "Mistral AI",
    role: "Moteur d'analyse",
    url: "https://mistral.ai",
    icon: Cpu,
  },
  {
    name: "Perplexity AI",
    role: "Fact-checking",
    url: "https://perplexity.ai",
    icon: Search,
  },
  {
    name: "Brave Search",
    role: "Recherche complementaire",
    url: "https://search.brave.com",
    icon: Globe,
  },
  {
    name: "Tournesol",
    role: "Recommandations communautaires",
    url: "https://tournesol.app",
    icon: Sun,
  },
];

const INFRA_PARTNERS: Partner[] = [
  {
    name: "Vercel",
    role: "Frontend hosting",
    url: "https://vercel.com",
    icon: Globe,
  },
  {
    name: "Railway",
    role: "Backend hosting",
    url: "https://railway.app",
    icon: Database,
  },
  {
    name: "Cloudflare",
    role: "CDN & storage",
    url: "https://cloudflare.com",
    icon: Shield,
  },
  {
    name: "Stripe",
    role: "Paiements",
    url: "https://stripe.com",
    icon: CreditCard,
  },
];

interface LibRow {
  name: string;
  license: string;
}

const OPEN_SOURCE_LIBS: LibRow[] = [
  { name: "React", license: "MIT" },
  { name: "Vite", license: "MIT" },
  { name: "React Router", license: "MIT" },
  { name: "FastAPI", license: "MIT" },
  { name: "Expo", license: "MIT" },
  { name: "Tailwind CSS", license: "MIT" },
  { name: "Framer Motion", license: "MIT" },
  { name: "TanStack Query", license: "MIT" },
  { name: "Zustand", license: "MIT" },
  { name: "PostgreSQL", license: "PostgreSQL License" },
  { name: "Lucide Icons", license: "ISC" },
  { name: "Recharts", license: "MIT" },
  { name: "React Markdown", license: "MIT" },
];

interface Thanks {
  name: string;
  description: string;
  icon: React.ElementType;
}

const ACKNOWLEDGEMENTS: Thanks[] = [
  {
    name: "Communaute Tournesol",
    description:
      "Pour leur plateforme de recommandations collaboratives et ethiques",
    icon: Sun,
  },
  {
    name: "Mistral AI",
    description:
      "Pour leur IA performante et souveraine, moteur de toutes nos analyses",
    icon: Cpu,
  },
  {
    name: "Communaute open-source",
    description:
      "Pour les outils extraordinaires sur lesquels DeepSight est construit",
    icon: Code2,
  },
  {
    name: "Beta-testeurs DeepSight",
    description:
      "Pour leurs retours precieux qui faconnent le produit chaque jour",
    icon: Heart,
  },
  {
    name: "Claude / Anthropic",
    description:
      "Pour l'assistance au developpement et l'acceleration du projet",
    icon: Sparkles,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const PartnerCard: React.FC<Partner> = ({ name, role, url, icon: Icon }) => (
  <motion.a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    variants={fadeUp}
    className="group flex items-center gap-4 p-4 rounded-xl bg-bg-secondary border border-border-subtle hover:border-accent-primary/40 hover:bg-bg-hover transition-all"
  >
    <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-text-primary">{name}</p>
      <p className="text-xs text-text-muted">{role}</p>
    </div>
    <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-accent-primary transition-colors" />
  </motion.a>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <motion.h2
    variants={fadeUp}
    className="text-2xl font-bold text-text-primary mb-6"
  >
    {children}
  </motion.h2>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-bg-primary">
      <SEO
        title="À propos"
        description="Découvrez DeepSight : IA française d'analyse vidéo YouTube & TikTok. Propulsé par Mistral AI, vos données restent en Europe."
        path="/about"
        keywords="DeepSight, à propos, IA française, Mistral AI, analyse vidéo, YouTube, RGPD, Europe"
      />
      {/* Back navigation */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-lg border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
      </div>

      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-16"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {/* ── Header ── */}
        <motion.header variants={fadeUp} className="text-center space-y-4">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary">
            A propos de DeepSight
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary tracking-tight">
            Analyser, comprendre,
            <br />
            <span className="text-gradient">apprendre autrement</span>
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            DeepSight est un SaaS d'analyse IA de videos YouTube & TikTok.
            Syntheses intelligentes, fact-checking, outils d'etude, chat
            contextuel — propulse par Mistral AI.
          </p>
        </motion.header>

        {/* ── Vision ── */}
        <motion.section variants={stagger}>
          <SectionTitle>Vision du projet</SectionTitle>
          <motion.div
            variants={fadeUp}
            className="p-6 rounded-xl bg-bg-secondary border border-border-subtle space-y-4 text-text-secondary leading-relaxed"
          >
            <p>
              DeepSight est ne d'un constat simple : nous consommons des heures
              de contenu video chaque jour, mais nous n'en retenons qu'une
              infime partie. Notre mission est de transformer cette consommation
              passive en apprentissage actif.
            </p>
            <p>
              Grace a l'intelligence artificielle 100% francaise et europeenne,
              DeepSight extrait, structure et enrichit le contenu des videos
              pour vous permettre d'analyser, reviser et approfondir vos
              connaissances — sur web, mobile et extension Chrome.
            </p>
          </motion.div>
        </motion.section>

        {/* ── Partenaires Technologiques ── */}
        <motion.section variants={stagger}>
          <SectionTitle>Partenaires Technologiques</SectionTitle>
          <motion.div
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {TECH_PARTNERS.map((p) => (
              <PartnerCard key={p.name} {...p} />
            ))}
          </motion.div>
        </motion.section>

        {/* ── Infrastructure ── */}
        <motion.section variants={stagger}>
          <SectionTitle>Infrastructure</SectionTitle>
          <motion.div
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {INFRA_PARTNERS.map((p) => (
              <PartnerCard key={p.name} {...p} />
            ))}
          </motion.div>
        </motion.section>

        {/* ── Open Source ── */}
        <motion.section variants={stagger}>
          <SectionTitle>Bibliotheques Open Source</SectionTitle>
          <motion.div
            variants={fadeUp}
            className="rounded-xl border border-border-subtle overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-secondary">
                  <th className="text-left px-4 py-3 text-text-muted font-semibold text-xs uppercase tracking-wider">
                    Bibliotheque
                  </th>
                  <th className="text-left px-4 py-3 text-text-muted font-semibold text-xs uppercase tracking-wider">
                    Licence
                  </th>
                </tr>
              </thead>
              <tbody>
                {OPEN_SOURCE_LIBS.map((lib, i) => (
                  <tr
                    key={lib.name}
                    className={`border-t border-border-subtle ${i % 2 === 0 ? "bg-bg-primary" : "bg-bg-secondary/50"}`}
                  >
                    <td className="px-4 py-2.5 text-text-primary font-medium">
                      {lib.name}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">
                      {lib.license}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </motion.section>

        {/* ── Remerciements ── */}
        <motion.section variants={stagger}>
          <SectionTitle>Remerciements</SectionTitle>
          <motion.div variants={stagger} className="space-y-3">
            {ACKNOWLEDGEMENTS.map((a) => (
              <motion.div
                key={a.name}
                variants={fadeUp}
                className="flex items-start gap-4 p-4 rounded-xl bg-bg-secondary border border-border-subtle"
              >
                <div className="w-9 h-9 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-primary flex-shrink-0">
                  <a.icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {a.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {a.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── Cree par ── */}
        <motion.section variants={stagger}>
          <SectionTitle>Cree par</SectionTitle>
          <motion.div
            variants={fadeUp}
            className="p-6 rounded-xl bg-bg-secondary border border-border-subtle"
          >
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center text-accent-primary flex-shrink-0">
                <User className="w-8 h-8" />
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">
                    Maxime Le Parc
                  </h3>
                  <p className="text-sm text-accent-primary font-medium">
                    Fondateur & Developpeur
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-text-muted" />
                    Lyon, France
                  </span>
                  <a
                    href="mailto:maxime@deepsightsynthesis.com"
                    className="flex items-center gap-1.5 hover:text-accent-primary transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                    maxime@deepsightsynthesis.com
                  </a>
                </div>
                <p className="text-sm text-text-muted flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  Musicien et developpeur passionne
                </p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ── Footer legal ── */}
        <motion.footer
          variants={fadeUp}
          className="pt-8 border-t border-border-subtle text-center space-y-2 text-xs text-text-muted"
        >
          <p>RCS 994 558 898 R.C.S. Lyon</p>
          <p>
            &copy; {new Date().getFullYear()} DeepSight — Tous droits reserves
          </p>
          <p>Propulse par Mistral AI &middot; Fait avec &hearts; a Lyon</p>
        </motion.footer>
      </motion.div>
    </div>
  );
};

export default AboutPage;
