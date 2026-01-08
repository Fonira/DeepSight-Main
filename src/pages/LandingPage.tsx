/**
 * DEEP SIGHT v5.0 — Landing Page
 * Design académique sobre pour chercheurs, journalistes et étudiants
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play, ArrowRight, Check, X, Sparkles,
  Youtube, Brain, Shield, MessageSquare, FileText,
  Zap, BookOpen, Search, BarChart3, Globe, Clock,
  ChevronRight, Users, GraduationCap, Newspaper
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import DoodleBackground from "../components/DoodleBackground";

// === Logo Deep Sight avec image et SVG fallback ===
const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [imageError, setImageError] = React.useState(false);
  
  // SVG du logo Deep Sight (œil stylisé avec play button)
  const LogoSVG = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <linearGradient id="logoGradientLanding" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <filter id="glowLanding">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradientLanding)" strokeWidth="3" opacity="0.8" filter="url(#glowLanding)"/>
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#logoGradientLanding)" strokeWidth="2.5" opacity="0.9"/>
      <circle cx="50" cy="50" r="20" fill="none" stroke="url(#logoGradientLanding)" strokeWidth="2"/>
      <polygon points="45,38 45,62 65,50" fill="url(#logoGradientLanding)" filter="url(#glowLanding)"/>
      <circle cx="62" cy="38" r="4" fill="#06B6D4" opacity="0.9"/>
    </svg>
  );

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center group">
        {/* Halo subtil au hover - couleurs métalliques */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
          style={{
            background: 'radial-gradient(circle, rgba(212, 165, 116, 0.3) 0%, rgba(74, 144, 217, 0.2) 50%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        {!imageError ? (
          <img 
            src="/logo.png?v=2" 
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

// === Données des plans ===
const getPlans = (language: string) => [
  {
    id: "free",
    name: "Découverte",
    price: "0",
    period: language === 'fr' ? '/mois' : '/month',
    description: language === 'fr' ? 'Pour explorer la plateforme' : 'To explore the platform',
    features: [
      { text: language === 'fr' ? '5 analyses par mois' : '5 analyses per month', included: true },
      { text: language === 'fr' ? 'Résumés structurés' : 'Structured summaries', included: true },
      { text: language === 'fr' ? 'Chat contextuel limité' : 'Limited contextual chat', included: true },
      { text: 'Fact-checking', included: false },
      { text: language === 'fr' ? 'Export documents' : 'Document export', included: false },
    ],
    cta: language === 'fr' ? 'Commencer gratuitement' : 'Start for free',
    highlighted: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "4.99",
    period: "€",
    description: language === 'fr' ? 'Pour une utilisation régulière' : 'For regular use',
    features: [
      { text: language === 'fr' ? '50 analyses par mois' : '50 analyses per month', included: true },
      { text: language === 'fr' ? 'Résumés avancés' : 'Advanced summaries', included: true },
      { text: language === 'fr' ? 'Chat illimité' : 'Unlimited chat', included: true },
      { text: 'Fact-checking', included: true },
      { text: 'Export PDF & Markdown', included: true },
    ],
    cta: language === 'fr' ? 'Choisir Starter' : 'Choose Starter',
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "9.99",
    period: "€",
    description: language === 'fr' ? 'Pour les professionnels exigeants' : 'For demanding professionals',
    features: [
      { text: language === 'fr' ? '200 analyses par mois' : '200 analyses per month', included: true },
      { text: language === 'fr' ? 'Analyses de playlists' : 'Playlist analysis', included: true },
      { text: language === 'fr' ? 'Recherche web (Perplexity)' : 'Web search (Perplexity)', included: true },
      { text: language === 'fr' ? 'Fact-checking avancé' : 'Advanced fact-checking', included: true },
      { text: language === 'fr' ? 'Tous les exports' : 'All exports', included: true },
    ],
    cta: language === 'fr' ? 'Choisir Pro' : 'Choose Pro',
    highlighted: true,
    badge: language === 'fr' ? 'Recommandé' : 'Recommended',
  },
  {
    id: "expert",
    name: "Expert",
    price: "14.99",
    period: "€",
    description: language === 'fr' ? 'Pour les organisations' : 'For organizations',
    features: [
      { text: language === 'fr' ? 'Analyses illimitées' : 'Unlimited analyses', included: true },
      { text: language === 'fr' ? 'API access' : 'API access', included: true },
      { text: language === 'fr' ? 'Support prioritaire' : 'Priority support', included: true },
      { text: language === 'fr' ? 'Corpus personnalisés' : 'Custom corpus', included: true },
      { text: language === 'fr' ? 'Intégrations avancées' : 'Advanced integrations', included: true },
    ],
    cta: language === 'fr' ? 'Contacter' : 'Contact us',
    highlighted: false,
  },
];

// === Features principales ===
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

// === Audiences cibles ===
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

export const LandingPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const plans = getPlans(language);
  const features = getFeatures(language);
  const audiences = getAudiences(language);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      {/* === Navigation === */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          
          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {language === 'fr' ? 'Connexion' : 'Sign in'}
            </button>
            
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary text-sm"
            >
              {language === 'fr' ? 'Commencer' : 'Get started'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* === Hero Section === */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary-muted border border-accent-primary/20 mb-8 animate-fadeInUp">
            <Sparkles className="w-4 h-4 text-accent-primary" />
            <span className="text-sm font-medium text-accent-primary">
              {language === 'fr' ? 'Analyse vidéo par IA' : 'AI-powered video analysis'}
            </span>
          </div>

          {/* Titre principal */}
          <h1 className="font-display text-display-lg mb-6 animate-fadeInUp stagger-1">
            {language === 'fr' ? (
              <>
                Transformez vos vidéos<br />
                <span className="text-gradient">en connaissances</span>
              </>
            ) : (
              <>
                Transform your videos<br />
                <span className="text-gradient">into knowledge</span>
              </>
            )}
          </h1>

          {/* 🎬 VIDÉO DU LOGO ANIMÉ - En grand au centre */}
          <div className="relative my-12 animate-fadeInUp stagger-2">
            {/* Glow effect derrière la vidéo */}
            <div 
              className="absolute inset-0 rounded-full opacity-40"
              style={{
                background: 'radial-gradient(circle, rgba(74, 144, 217, 0.4) 0%, rgba(212, 165, 116, 0.3) 30%, rgba(123, 75, 160, 0.2) 60%, transparent 80%)',
                filter: 'blur(60px)',
                transform: 'scale(1.2)',
              }}
            />
            
            {/* Vidéo du logo */}
            <div className="relative z-10 flex justify-center">
              <video
                className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 object-contain"
                src="/logo-animation.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{
                  filter: 'drop-shadow(0 0 40px rgba(74, 144, 217, 0.3)) drop-shadow(0 0 30px rgba(212, 165, 116, 0.2))'
                }}
              />
            </div>
          </div>

          {/* Sous-titre */}
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 animate-fadeInUp stagger-3">
            {language === 'fr'
              ? 'Deep Sight analyse, synthétise et vérifie le contenu de vos vidéos YouTube. Conçu pour les chercheurs, journalistes et professionnels exigeants.'
              : 'Deep Sight analyzes, synthesizes and verifies your YouTube video content. Designed for researchers, journalists and demanding professionals.'}
          </p>

          {/* CTA principal */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fadeInUp stagger-4">
            <button
              onClick={() => navigate('/login')}
              className="btn btn-accent px-8 py-3 text-base"
            >
              {language === 'fr' ? 'Essayer gratuitement' : 'Try for free'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn btn-ghost px-6 py-3 text-base"
            >
              {language === 'fr' ? 'En savoir plus' : 'Learn more'}
            </button>
          </div>

          {/* Stats rapides */}
          <div className="flex items-center justify-center gap-8 mt-16 pt-8 border-t border-border-subtle animate-fadeInUp stagger-5">
            <div className="text-center">
              <div className="text-2xl font-display font-semibold text-text-primary">5min</div>
              <div className="text-sm text-text-tertiary">{language === 'fr' ? 'par vidéo' : 'per video'}</div>
            </div>
            <div className="w-px h-10 bg-border-subtle" />
            <div className="text-center">
              <div className="text-2xl font-display font-semibold text-text-primary">98%</div>
              <div className="text-sm text-text-tertiary">{language === 'fr' ? 'précision' : 'accuracy'}</div>
            </div>
            <div className="w-px h-10 bg-border-subtle" />
            <div className="text-center">
              <div className="text-2xl font-display font-semibold text-text-primary">24/7</div>
              <div className="text-sm text-text-tertiary">{language === 'fr' ? 'disponible' : 'available'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* === Demo Preview === */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="card-elevated p-2 rounded-2xl">
            <div className="rounded-xl bg-bg-tertiary aspect-video flex items-center justify-center relative overflow-hidden">
              {/* Placeholder pour démo */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 to-purple-500/5" />
              <div className="text-center z-10">
                <div className="w-20 h-20 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Play className="w-8 h-8 text-accent-primary ml-1" />
                </div>
                <p className="text-text-tertiary text-sm">
                  {language === 'fr' ? 'Aperçu de l\'interface' : 'Interface preview'}
                </p>
              </div>
              {/* Grid décorative */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* === Features === */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-display-sm mb-4">
              {language === 'fr' ? 'Fonctionnalités clés' : 'Key Features'}
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              {language === 'fr'
                ? 'Des outils puissants pour extraire le maximum de valeur de chaque vidéo.'
                : 'Powerful tools to extract maximum value from every video.'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="card p-6 hover:border-accent-primary/30 transition-all group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent-primary-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Pour qui ? === */}
      <section className="py-20 px-6 bg-bg-secondary/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-display-sm mb-4">
              {language === 'fr' ? 'Conçu pour vous' : 'Built for you'}
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              {language === 'fr'
                ? 'Que vous soyez chercheur, journaliste ou professionnel, Deep Sight s\'adapte à vos besoins.'
                : 'Whether you\'re a researcher, journalist or professional, Deep Sight adapts to your needs.'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {audiences.map((audience, index) => (
              <div
                key={audience.title}
                className="text-center p-8"
              >
                <div className="w-16 h-16 rounded-2xl bg-bg-tertiary border border-border-subtle flex items-center justify-center mx-auto mb-6">
                  <audience.icon className="w-7 h-7 text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {audience.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {audience.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Pricing === */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-display-sm mb-4">
              {language === 'fr' ? 'Tarification simple' : 'Simple Pricing'}
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              {language === 'fr'
                ? 'Commencez gratuitement, évoluez selon vos besoins. Sans engagement.'
                : 'Start for free, scale as you need. No commitment.'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`card p-6 relative transition-all ${
                  plan.highlighted
                    ? 'border-accent-primary ring-1 ring-accent-primary/20'
                    : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent-primary text-white text-xs font-medium">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-text-tertiary">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-display font-semibold text-text-primary">
                    {plan.price}
                  </span>
                  <span className="text-text-tertiary text-sm ml-1">
                    {plan.period}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 text-sm ${
                        feature.included ? 'text-text-secondary' : 'text-text-muted line-through'
                      }`}
                    >
                      {feature.included ? (
                        <Check className="w-4 h-4 text-accent-success mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                      )}
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                    plan.highlighted
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA Final === */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card-elevated p-12 rounded-2xl relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 to-purple-500/10" />
            
            <div className="relative z-10">
              <h2 className="font-display text-display-sm mb-4">
                {language === 'fr' ? 'Prêt à commencer ?' : 'Ready to start?'}
              </h2>
              <p className="text-text-secondary mb-8 max-w-lg mx-auto">
                {language === 'fr'
                  ? 'Rejoignez les chercheurs et professionnels qui utilisent Deep Sight pour analyser leurs vidéos.'
                  : 'Join the researchers and professionals who use Deep Sight to analyze their videos.'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="btn btn-accent px-8 py-3 text-base"
              >
                {language === 'fr' ? 'Créer un compte gratuit' : 'Create free account'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* === Footer === */}
      <footer className="py-12 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Logo />
            
            <div className="flex items-center gap-6">
              <a
                href="/legal"
                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
              >
                {language === 'fr' ? 'Mentions légales' : 'Legal'}
              </a>
              <a
                href="mailto:contact@deepsightsynthesis.com"
                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
              >
                Contact
              </a>
            </div>
            
            <p className="text-sm text-text-muted">
              © 2024 Deep Sight — RCS Lyon 994 558 898
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
