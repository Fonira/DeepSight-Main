/**
 * DEEP SIGHT v8.0 — Premium Landing Page
 * Inspired by Linear/Vercel — gradient mesh hero, scroll animations, glassmorphism
 */

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight, Check, X, Sparkles,
  Brain, Shield, MessageSquare, FileText,
  Zap, ChevronRight, Users, GraduationCap, Newspaper,
  Star, Crown, Rocket
} from "lucide-react";
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from "../hooks/useAuth";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const ease = [0.4, 0, 0.2, 1] as const;

const ScrollReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className, delay = 0 }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, ease, delay }}
    >
      {children}
    </motion.div>
  );
};

const StaggerReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.1 },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
    }}
  >
    {children}
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [imageError, setImageError] = React.useState(false);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
        {!imageError ? (
          <img
            src="/deep-sight-logo.png"
            alt="Deep Sight"
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <defs>
              <linearGradient id="landingLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="var(--bg-tertiary)" />
            <path
              d="M16 6 L18 13 L25 14 L19 17 L25 20 L18 21 L16 28 L14 21 L7 20 L13 17 L7 14 L14 13 Z"
              fill="url(#landingLogoGrad)"
              opacity="0.9"
            />
          </svg>
        )}
      </div>
      <span className="font-semibold text-sm tracking-tight text-text-primary">
        Deep Sight
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

type PlanId = 'free' | 'starter' | 'pro' | 'expert';

interface PlanConfig {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;
  icon: React.ElementType;
  color: string;
  popular?: boolean;
  recommended?: boolean;
  features: Array<{
    text: { fr: string; en: string };
    included: boolean;
    highlight?: boolean;
  }>;
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: { fr: 'Découverte', en: 'Discovery' },
    description: { fr: 'Pour explorer', en: 'To explore' },
    price: 0,
    icon: Zap,
    color: 'text-text-tertiary',
    features: [
      { text: { fr: '5 analyses/mois', en: '5 analyses/month' }, included: true },
      { text: { fr: 'Synthèse express', en: 'Express summary' }, included: true },
      { text: { fr: 'Chat basique (5 questions)', en: 'Basic chat (5 questions)' }, included: true },
      { text: { fr: 'Analyse détaillée', en: 'Detailed analysis' }, included: false },
      { text: { fr: 'Recherche web', en: 'Web search' }, included: false },
      { text: { fr: 'Export PDF', en: 'PDF export' }, included: false },
    ],
  },
  {
    id: 'starter',
    name: { fr: 'Starter', en: 'Starter' },
    description: { fr: 'Pour les réguliers', en: 'For regular users' },
    price: 4.99,
    icon: Star,
    color: 'text-blue-400',
    features: [
      { text: { fr: '50 analyses/mois', en: '50 analyses/month' }, included: true },
      { text: { fr: 'Analyse détaillée', en: 'Detailed analysis' }, included: true },
      { text: { fr: 'Chat (20 questions/vidéo)', en: 'Chat (20 questions/video)' }, included: true },
      { text: { fr: 'Export PDF', en: 'PDF export' }, included: true },
      { text: { fr: 'Recherche web (20/mois)', en: 'Web search (20/mo)' }, included: true, highlight: true },
      { text: { fr: 'Playlists & corpus', en: 'Playlists & corpus' }, included: false },
    ],
  },
  {
    id: 'pro',
    name: { fr: 'Pro', en: 'Pro' },
    description: { fr: 'Pour les power users', en: 'For power users' },
    price: 9.99,
    icon: Crown,
    color: 'text-violet-400',
    popular: true,
    features: [
      { text: { fr: '200 analyses/mois', en: '200 analyses/month' }, included: true },
      { text: { fr: 'Chat illimité', en: 'Unlimited chat' }, included: true, highlight: true },
      { text: { fr: 'Recherche web (100/mois)', en: 'Web search (100/mo)' }, included: true, highlight: true },
      { text: { fr: 'Playlists (10 vidéos)', en: 'Playlists (10 videos)' }, included: true },
      { text: { fr: 'Export PDF + Markdown', en: 'PDF + Markdown export' }, included: true },
      { text: { fr: 'Lecture audio TTS', en: 'TTS audio' }, included: true },
    ],
  },
  {
    id: 'expert',
    name: { fr: 'Expert', en: 'Expert' },
    description: { fr: 'Pour les professionnels', en: 'For professionals' },
    price: 14.99,
    icon: Rocket,
    color: 'text-amber-400',
    recommended: true,
    features: [
      { text: { fr: 'Analyses illimitées', en: 'Unlimited analyses' }, included: true, highlight: true },
      { text: { fr: 'Tout Pro inclus', en: 'All Pro features' }, included: true },
      { text: { fr: 'Playlists (50 vidéos)', en: 'Playlists (50 videos)' }, included: true, highlight: true },
      { text: { fr: 'Recherche web (500/mois)', en: 'Web search (500/mo)' }, included: true, highlight: true },
      { text: { fr: '+ Accès API REST', en: '+ REST API Access' }, included: true, highlight: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

const getFeatures = (language: string) => [
  {
    icon: Brain,
    title: language === 'fr' ? 'Analyse intelligente' : 'Smart Analysis',
    description: language === 'fr'
      ? 'IA avancée qui comprend le contexte, identifie les arguments clés et structure l\'information.'
      : 'Advanced AI that understands context, identifies key arguments and structures information.',
  },
  {
    icon: Shield,
    title: language === 'fr' ? 'Fact-checking intégré' : 'Built-in Fact-checking',
    description: language === 'fr'
      ? 'Vérification automatique des affirmations avec recherche web et sources citées.'
      : 'Automatic claim verification with web search and cited sources.',
  },
  {
    icon: MessageSquare,
    title: language === 'fr' ? 'Chat contextuel' : 'Contextual Chat',
    description: language === 'fr'
      ? 'Posez des questions sur le contenu analysé et obtenez des réponses précises avec timecodes.'
      : 'Ask questions about analyzed content and get precise answers with timestamps.',
  },
  {
    icon: FileText,
    title: language === 'fr' ? 'Export professionnel' : 'Professional Export',
    description: language === 'fr'
      ? 'Exportez vos analyses en PDF, Markdown ou texte pour vos recherches et publications.'
      : 'Export your analyses as PDF, Markdown or text for your research and publications.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIENCES
// ═══════════════════════════════════════════════════════════════════════════════

const getAudiences = (language: string) => [
  {
    icon: GraduationCap,
    title: language === 'fr' ? 'Chercheurs & Étudiants' : 'Researchers & Students',
    description: language === 'fr'
      ? 'Analysez des conférences, cours et documentaires pour vos travaux académiques.'
      : 'Analyze lectures, courses and documentaries for your academic work.',
  },
  {
    icon: Newspaper,
    title: language === 'fr' ? 'Journalistes' : 'Journalists',
    description: language === 'fr'
      ? 'Vérifiez les faits, extrayez les citations clés et gagnez du temps sur vos enquêtes.'
      : 'Verify facts, extract key quotes and save time on your investigations.',
  },
  {
    icon: Users,
    title: language === 'fr' ? 'Professionnels' : 'Professionals',
    description: language === 'fr'
      ? 'Synthétisez webinaires, présentations et contenus de formation efficacement.'
      : 'Synthesize webinars, presentations and training content efficiently.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

const stats = [
  { value: '5min', label: { fr: 'par vidéo', en: 'per video' } },
  { value: '98%', label: { fr: 'précision', en: 'accuracy' } },
  { value: '24/7', label: { fr: 'disponible', en: 'available' } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { user, isLoading } = useAuth();
  const lang = language as 'fr' | 'en';

  const features = getFeatures(language);
  const audiences = getAudiences(language);

  // Redirect if logged in
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Gradient mesh background */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent-primary/[0.07] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-violet-500/[0.05] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[100px]" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/70 border-b border-border-subtle/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo />

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors hidden sm:block"
            >
              {language === 'fr' ? 'Connexion' : 'Sign in'}
            </button>
            <motion.button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="hidden sm:inline">{language === 'fr' ? 'Commencer' : 'Get Started'}</span>
              <span className="sm:hidden">{language === 'fr' ? 'Essayer' : 'Start'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative py-20 sm:py-32 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
            <span className="text-xs text-accent-primary font-medium">
              {language === 'fr' ? 'Analyse vidéo par IA' : 'AI Video Analysis'}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-6"
          >
            <span className="text-text-primary">
              {language === 'fr' ? 'Transformez vos vidéos' : 'Transform your videos'}
            </span>
            <br />
            <span className="bg-gradient-to-r from-accent-primary via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              {language === 'fr' ? 'en connaissances' : 'into knowledge'}
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.3 }}
            className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {language === 'fr'
              ? 'Deep Sight analyse, synthétise et vérifie le contenu de vos vidéos YouTube. Conçu pour les chercheurs, journalistes et professionnels exigeants.'
              : 'Deep Sight analyzes, synthesizes and verifies your YouTube video content. Built for demanding researchers, journalists and professionals.'}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
          >
            <motion.button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg bg-accent-primary text-white font-medium hover:bg-accent-primary-hover transition-colors shadow-lg shadow-accent-primary/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {language === 'fr' ? 'Essayer gratuitement' : 'Try for free'}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <a
              href="#features"
              className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 text-sm"
            >
              {language === 'fr' ? 'En savoir plus' : 'Learn more'}
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease, delay: 0.6 }}
            className="flex items-center justify-center gap-10 sm:gap-16"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-xl sm:text-2xl font-semibold text-text-primary tabular-nums">
                  {stat.value}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {stat.label[lang]}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── DEMO VISUAL ─── */}
      <section className="py-8 sm:py-16 px-4 sm:px-6">
        <ScrollReveal className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-border-subtle bg-bg-secondary/60 backdrop-blur-sm">
            {/* Gradient top bar */}
            <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/50 to-transparent" />

            <div className="py-16 sm:py-24 flex flex-col items-center justify-center relative">
              {/* Animated logo visual */}
              <motion.div
                className="relative w-20 h-20 sm:w-24 sm:h-24 mb-6"
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute inset-0 rounded-full border border-accent-primary/20" />
                <div className="absolute inset-2 rounded-full border border-violet-500/15" />
                <div className="absolute inset-4 rounded-full border border-cyan-500/10" />
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-accent-primary via-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-accent-primary/30">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                </motion.div>
              </motion.div>

              {/* Glow */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 bg-accent-primary/10 rounded-full blur-[60px]" />
              </div>

              <p className="text-sm text-text-secondary font-medium relative z-10">
                {language === 'fr' ? 'L\'IA qui analyse vos vidéos' : 'AI that analyzes your videos'}
              </p>
            </div>

            {/* Gradient bottom bar */}
            <div className="h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          </div>
        </ScrollReveal>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === 'fr' ? 'Fonctionnalités clés' : 'Key Features'}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto">
              {language === 'fr'
                ? 'Des outils puissants pour extraire le maximum de valeur de chaque vidéo.'
                : 'Powerful tools to extract maximum value from every video.'}
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="group p-5 rounded-xl border border-border-subtle bg-bg-secondary/40 backdrop-blur-sm hover:border-accent-primary/30 hover:bg-bg-secondary/70 transition-all duration-200">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center mb-4 group-hover:bg-accent-primary/15 transition-colors">
                    <feature.icon className="w-5 h-5 text-accent-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-text-tertiary text-xs leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ─── AUDIENCES ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === 'fr' ? 'Conçu pour vous' : 'Built for you'}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto">
              {language === 'fr'
                ? 'Que vous soyez chercheur, journaliste ou professionnel, Deep Sight s\'adapte à vos besoins.'
                : 'Whether you\'re a researcher, journalist or professional, Deep Sight adapts to your needs.'}
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {audiences.map((audience) => (
              <StaggerItem key={audience.title} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-bg-tertiary border border-border-subtle flex items-center justify-center mx-auto mb-5">
                  <audience.icon className="w-6 h-6 text-accent-primary" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {audience.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto">
                  {audience.description}
                </p>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
              {language === 'fr' ? 'Tarification simple' : 'Simple Pricing'}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto">
              {language === 'fr'
                ? 'Commencez gratuitement, évoluez selon vos besoins. Sans engagement.'
                : 'Start for free, scale as you need. No commitment.'}
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isPopular = plan.popular;
              const isRecommended = plan.recommended;


              return (
                <StaggerItem key={plan.id}>
                  <div
                    className={`relative p-5 rounded-xl border transition-all h-full flex flex-col ${
                      isPopular
                        ? 'border-violet-500/40 bg-violet-500/[0.04] shadow-lg shadow-violet-500/10'
                        : isRecommended
                        ? 'border-amber-500/40 bg-amber-500/[0.04] shadow-lg shadow-amber-500/10'
                        : 'border-border-subtle bg-bg-secondary/40 hover:border-border-default'
                    }`}
                  >
                    {/* Badge */}
                    {isPopular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-violet-500 text-white text-[0.6875rem] font-medium">
                        {language === 'fr' ? 'Populaire' : 'Popular'}
                      </div>
                    )}
                    {isRecommended && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[0.6875rem] font-medium">
                        {language === 'fr' ? 'Recommandé' : 'Recommended'}
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className={`w-8 h-8 rounded-lg ${
                        isPopular ? 'bg-violet-500/15' :
                        isRecommended ? 'bg-amber-500/15' :
                        'bg-bg-tertiary'
                      } flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${plan.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary text-sm">
                          {plan.name[lang]}
                        </h3>
                        <p className="text-[0.6875rem] text-text-tertiary">
                          {plan.description[lang]}
                        </p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5">
                      <span className="text-2xl font-semibold text-text-primary tabular-nums">
                        {plan.price === 0 ? '0' : plan.price.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-text-tertiary text-xs ml-1">
                        €/{language === 'fr' ? 'mois' : 'month'}
                      </span>
                    </div>

                    {/* Features */}
                    <div className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 text-xs ${
                            feature.included
                              ? feature.highlight
                                ? 'text-accent-primary'
                                : 'text-text-secondary'
                              : 'text-text-muted line-through'
                          }`}
                        >
                          {feature.included ? (
                            <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                              feature.highlight ? 'text-accent-primary' : 'text-emerald-400'
                            }`} />
                          ) : (
                            <X className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                          )}
                          <span>{feature.text[lang]}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <motion.button
                      onClick={() => navigate('/login')}
                      className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                        isPopular
                          ? 'bg-violet-500 text-white hover:bg-violet-600'
                          : isRecommended
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle'
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {plan.price === 0
                        ? (language === 'fr' ? 'Commencer gratuitement' : 'Start for free')
                        : (language === 'fr' ? `Choisir ${plan.name.fr}` : `Choose ${plan.name.en}`)}
                    </motion.button>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>

          {/* Guarantee */}
          <ScrollReveal delay={0.2} className="text-center mt-8">
            <p className="text-xs text-text-tertiary">
              {language === 'fr'
                ? 'Sans engagement · Annulation facile · Paiement sécurisé Stripe'
                : 'No commitment · Easy cancellation · Secure Stripe payment'}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <ScrollReveal className="max-w-3xl mx-auto">
          <div className="relative p-8 sm:p-14 rounded-2xl border border-border-subtle bg-bg-secondary/50 backdrop-blur-sm text-center overflow-hidden">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/[0.06] via-transparent to-violet-500/[0.06]" />

            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-3">
                {language === 'fr' ? 'Prêt à commencer ?' : 'Ready to start?'}
              </h2>
              <p className="text-text-secondary text-sm sm:text-base mb-8 max-w-md mx-auto">
                {language === 'fr'
                  ? 'Rejoignez les chercheurs et professionnels qui utilisent Deep Sight pour analyser leurs vidéos.'
                  : 'Join the researchers and professionals who use Deep Sight to analyze their videos.'}
              </p>
              <motion.button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-accent-primary text-white font-medium hover:bg-accent-primary-hover transition-colors shadow-lg shadow-accent-primary/25"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {language === 'fr' ? 'Créer un compte gratuit' : 'Create free account'}
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-10 px-4 sm:px-6 border-t border-border-subtle/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-5 md:flex-row md:justify-between">
            <Logo />

            <div className="flex items-center gap-6">
              <a
                href="/legal"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {language === 'fr' ? 'Mentions légales' : 'Legal'}
              </a>
              <a
                href="mailto:contact@deepsightsynthesis.com"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Contact
              </a>
            </div>

            <p className="text-xs text-text-muted">
              © 2024 Deep Sight — RCS Lyon 994 558 898
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
