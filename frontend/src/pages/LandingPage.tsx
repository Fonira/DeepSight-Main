/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🚀 DEEP SIGHT LANDING PAGE v6.0 — Optimisée Conversion                             ║
 * ║  Design académique + Pricing aligné avec UpgradePage                                ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play, ArrowRight, Check, X, Sparkles,
  Youtube, Brain, Shield, MessageSquare, FileText,
  Zap, BookOpen, Search, BarChart3, Globe, Clock,
  ChevronRight, Users, GraduationCap, Newspaper,
  Star, Crown, Rocket, TrendingUp
} from "lucide-react";
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import DoodleBackground from "../components/DoodleBackground";
import { DeepSightSpinnerHero } from "../components/ui";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [imageError, setImageError] = React.useState(false);
  
  // New compass/star logo SVG fallback (simplified version of the cosmic logo)
  const LogoSVG = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <linearGradient id="logoGradientLanding" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="25%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#FF00FF" />
          <stop offset="75%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="cosmicBgLanding" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="100%" stopColor="#0a0a0b" />
        </radialGradient>
        <filter id="glowLanding">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Background */}
      <circle cx="50" cy="50" r="48" fill="url(#cosmicBgLanding)" />
      {/* Outer ring */}
      <circle cx="50" cy="50" r="42" fill="none" stroke="url(#logoGradientLanding)" strokeWidth="1.5" opacity="0.6" />
      {/* Inner rings */}
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#logoGradientLanding)" strokeWidth="1" opacity="0.5" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="url(#logoGradientLanding)" strokeWidth="1" opacity="0.4" />
      {/* 8-pointed star */}
      <path
        d="M50 8 L54 38 L84 42 L58 50 L84 58 L54 62 L50 92 L46 62 L16 58 L42 50 L16 42 L46 38 Z"
        fill="url(#logoGradientLanding)"
        filter="url(#glowLanding)"
        opacity="0.9"
      />
      {/* Center point */}
      <circle cx="50" cy="50" r="4" fill="#0a0a0b" />
    </svg>
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center group">
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
          style={{
            background: 'radial-gradient(circle, rgba(212, 165, 116, 0.3) 0%, rgba(74, 144, 217, 0.2) 50%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        {!imageError ? (
          <img 
            src="/logo.png?v=4" 
            alt="Deep Sight" 
            className="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-110"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(212, 165, 116, 0.4)) drop-shadow(0 0 6px rgba(74, 144, 217, 0.3))' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full relative z-10">
            <LogoSVG />
          </div>
        )}
      </div>
      <span className="font-display text-xl font-semibold tracking-tight bg-gradient-to-r from-amber-200 via-blue-300 to-purple-400 bg-clip-text text-transparent">
        Deep Sight
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 PLANS CONFIGURATION — ALIGNÉ AVEC planPrivileges.ts et UpgradePage
// ═══════════════════════════════════════════════════════════════════════════════

type PlanId = 'free' | 'starter' | 'pro' | 'expert';

interface PlanConfig {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
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
    gradient: 'from-slate-500 to-slate-600',
    iconBg: 'bg-slate-500',
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
    gradient: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-500',
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
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-500',
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
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-500',
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
// 🎯 FEATURES PRINCIPALES
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
// 👥 AUDIENCES CIBLES
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
// 📊 STATS HERO
// ═══════════════════════════════════════════════════════════════════════════════

const stats = [
  { value: '5min', label: { fr: 'par vidéo', en: 'per video' } },
  { value: '98%', label: { fr: 'précision', en: 'accuracy' } },
  { value: '24/7', label: { fr: 'disponible', en: 'available' } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 LANDING PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const { user, isLoading } = useAuth();
  const lang = language as 'fr' | 'en';

  const features = getFeatures(language);
  const audiences = getAudiences(language);

  // Redirect si déjà connecté
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Background */}
      <DoodleBackground density={0.3} opacity={0.15} />

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80 border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Logo />

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate('/login')}
              className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors hidden sm:block"
            >
              {language === 'fr' ? 'Connexion' : 'Sign in'}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary text-xs sm:text-sm px-3 sm:px-5 py-2"
            >
              <span className="hidden sm:inline">{language === 'fr' ? 'Commencer' : 'Get Started'}</span>
              <span className="sm:hidden">{language === 'fr' ? 'Essayer' : 'Start'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* HERO SECTION */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-accent-primary/10 border border-accent-primary/20 mb-6 sm:mb-8">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-primary" />
            <span className="text-xs sm:text-sm text-accent-primary font-medium">
              {language === 'fr' ? 'Analyse vidéo par IA' : 'AI Video Analysis'}
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-display-lg mb-4 sm:mb-6 leading-tight">
            {language === 'fr' ? 'Transformez vos vidéos' : 'Transform your videos'}
            <br />
            <span className="text-accent-primary">
              {language === 'fr' ? 'en connaissances' : 'into knowledge'}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-sm sm:text-base md:text-lg text-text-secondary max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
            {language === 'fr'
              ? 'Deep Sight analyse, synthétise et vérifie le contenu de vos vidéos YouTube. Conçu pour les chercheurs, journalistes et professionnels exigeants.'
              : 'Deep Sight analyzes, synthesizes and verifies your YouTube video content. Built for demanding researchers, journalists and professionals.'}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-12">
            <button
              onClick={() => navigate('/login')}
              className="btn btn-accent w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base shadow-lg shadow-accent-primary/25"
            >
              {language === 'fr' ? 'Essayer gratuitement' : 'Try for free'}
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <a
              href="#features"
              className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              {language === 'fr' ? 'En savoir plus' : 'Learn more'}
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 sm:gap-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="font-display text-xl sm:text-2xl font-semibold text-text-primary">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-text-tertiary">
                  {stat.label[lang]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* DEMO / HERO SPINNER SECTION — ✨ DeepSight Spinner XXL */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="py-8 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="card-elevated rounded-xl sm:rounded-2xl overflow-hidden py-12 sm:py-20 bg-gradient-to-br from-bg-tertiary via-bg-secondary to-bg-tertiary flex flex-col items-center justify-center border border-border-subtle relative">
            {/* ✨ DeepSight Hero Spinner — Logo animé impressionnant */}
            <div className="relative">
              <DeepSightSpinnerHero className="drop-shadow-2xl" />
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-radial from-accent-primary/20 via-purple-500/10 to-transparent blur-3xl -z-10 scale-150" />
            </div>
            <p className="text-center text-sm sm:text-base text-text-secondary mt-6 sm:mt-8 font-medium">
              {language === 'fr' ? 'L\'IA qui analyse vos vidéos' : 'AI that analyzes your videos'}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* FEATURES SECTION */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="font-display text-2xl sm:text-3xl md:text-display-sm mb-3 sm:mb-4">
              {language === 'fr' ? 'Fonctionnalités clés' : 'Key Features'}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto px-2">
              {language === 'fr'
                ? 'Des outils puissants pour extraire le maximum de valeur de chaque vidéo.'
                : 'Powerful tools to extract maximum value from every video.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="card p-4 sm:p-6 hover:border-accent-primary/30 transition-all"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1.5 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* AUDIENCES SECTION */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-bg-secondary/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="font-display text-2xl sm:text-3xl md:text-display-sm mb-3 sm:mb-4">
              {language === 'fr' ? 'Conçu pour vous' : 'Built for you'}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto px-2">
              {language === 'fr'
                ? 'Que vous soyez chercheur, journaliste ou professionnel, Deep Sight s\'adapte à vos besoins.'
                : 'Whether you\'re a researcher, journalist or professional, Deep Sight adapts to your needs.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {audiences.map((audience) => (
              <div key={audience.title} className="text-center p-4 sm:p-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-bg-tertiary border border-border-subtle flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <audience.icon className="w-5 h-5 sm:w-7 sm:h-7 text-accent-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2 sm:mb-3">
                  {audience.title}
                </h3>
                <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                  {audience.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* PRICING SECTION — STYLE UPGRADE PAGE */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="font-display text-2xl sm:text-3xl md:text-display-sm mb-3 sm:mb-4">
              {language === 'fr' ? 'Tarification simple' : 'Simple Pricing'}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto px-2">
              {language === 'fr'
                ? 'Commencez gratuitement, évoluez selon vos besoins. Sans engagement.'
                : 'Start for free, scale as you need. No commitment.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isPopular = plan.popular;
              const isRecommended = plan.recommended;

              return (
                <div
                  key={plan.id}
                  className={`card p-4 sm:p-6 relative transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isPopular
                      ? 'border-violet-500/50 ring-1 ring-violet-500/20 shadow-lg shadow-violet-500/10'
                      : isRecommended
                      ? 'border-amber-500/50 ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10'
                      : ''
                  }`}
                >
                  {/* Badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-500 text-white text-xs font-medium whitespace-nowrap">
                      {language === 'fr' ? 'Populaire' : 'Popular'}
                    </div>
                  )}
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-medium whitespace-nowrap">
                      {language === 'fr' ? 'Recommandé' : 'Recommended'}
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${plan.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary text-sm sm:text-base">
                        {plan.name[lang]}
                      </h3>
                      <p className="text-xs text-text-tertiary truncate">
                        {plan.description[lang]}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4 sm:mb-6">
                    <span className="text-2xl sm:text-3xl font-display font-semibold text-text-primary">
                      {plan.price === 0 ? '0' : plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-text-tertiary text-xs sm:text-sm ml-1">
                      €/{language === 'fr' ? 'mois' : 'month'}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 sm:gap-3 text-xs sm:text-sm ${
                          feature.included
                            ? feature.highlight
                              ? 'text-accent-primary font-medium'
                              : 'text-text-secondary'
                            : 'text-text-muted line-through'
                        }`}
                      >
                        {feature.included ? (
                          <Check className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0 ${
                            feature.highlight ? 'text-accent-primary' : 'text-accent-success'
                          }`} />
                        ) : (
                          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-muted mt-0.5 flex-shrink-0" />
                        )}
                        <span>{feature.text[lang]}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm transition-all min-h-[44px] active:scale-95 ${
                      isPopular
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-lg'
                        : isRecommended
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 shadow-lg'
                        : 'btn-secondary'
                    }`}
                  >
                    {plan.price === 0
                      ? (language === 'fr' ? 'Commencer gratuitement' : 'Start for free')
                      : (language === 'fr' ? `Choisir ${plan.name.fr}` : `Choose ${plan.name.en}`)}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Garantie */}
          <p className="text-center text-xs sm:text-sm text-text-tertiary mt-6 sm:mt-8 px-2">
            {language === 'fr'
              ? '✓ Sans engagement • ✓ Annulation facile • ✓ Paiement sécurisé Stripe'
              : '✓ No commitment • ✓ Easy cancellation • ✓ Secure Stripe payment'}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* CTA FINAL */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card-elevated p-6 sm:p-12 rounded-xl sm:rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 to-purple-500/10" />

            <div className="relative z-10">
              <h2 className="font-display text-xl sm:text-2xl md:text-display-sm mb-3 sm:mb-4">
                {language === 'fr' ? 'Prêt à commencer ?' : 'Ready to start?'}
              </h2>
              <p className="text-text-secondary text-sm sm:text-base mb-6 sm:mb-8 max-w-lg mx-auto px-2">
                {language === 'fr'
                  ? 'Rejoignez les chercheurs et professionnels qui utilisent Deep Sight pour analyser leurs vidéos.'
                  : 'Join the researchers and professionals who use Deep Sight to analyze their videos.'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="btn btn-accent w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base min-h-[44px] active:scale-95"
              >
                {language === 'fr' ? 'Créer un compte gratuit' : 'Create free account'}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between">
            <Logo />

            <div className="flex items-center gap-4 sm:gap-6">
              <a
                href="/legal"
                className="text-xs sm:text-sm text-text-tertiary hover:text-text-primary transition-colors min-h-[44px] flex items-center"
              >
                {language === 'fr' ? 'Mentions légales' : 'Legal'}
              </a>
              <a
                href="mailto:contact@deepsightsynthesis.com"
                className="text-xs sm:text-sm text-text-tertiary hover:text-text-primary transition-colors min-h-[44px] flex items-center"
              >
                Contact
              </a>
            </div>

            <p className="text-xs sm:text-sm text-text-muted text-center">
              © 2024 Deep Sight — RCS Lyon 994 558 898
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
