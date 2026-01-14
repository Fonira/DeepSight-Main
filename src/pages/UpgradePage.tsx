/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  💎 UPGRADE PAGE v3.1 — Features réellement implémentées uniquement                 ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { 
  Check, X, Sparkles, Zap, Star, Crown, Loader2, 
  ArrowUp, ArrowDown, AlertCircle, RefreshCw,
  BookOpen, ChevronDown, ChevronUp, Key, 
  Infinity, Database, ListVideo, Headphones
} from 'lucide-react';
import { billingApi } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 CONFIGURATION DES PLANS
// ═══════════════════════════════════════════════════════════════════════════════

type PlanId = 'free' | 'starter' | 'pro' | 'expert';

interface PlanFeature {
  text: { fr: string; en: string };
  included: boolean;
  highlight?: boolean;
}

interface PlanConfig {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;
  popular?: boolean;
  recommended?: boolean;
  order: number;
  gradient: string;
  features: PlanFeature[];
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: { fr: 'Découverte', en: 'Discovery' },
    description: { fr: 'Pour explorer', en: 'To explore' },
    price: 0,
    order: 0,
    gradient: 'from-slate-500 to-slate-600',
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
    order: 1,
    gradient: 'from-blue-500 to-blue-600',
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
    popular: true,
    order: 2,
    gradient: 'from-violet-500 to-purple-600',
    features: [
      { text: { fr: '200 analyses/mois', en: '200 analyses/month' }, included: true },
      { text: { fr: 'Chat illimité', en: 'Unlimited chat' }, included: true, highlight: true },
      { text: { fr: 'Recherche web (100/mois)', en: 'Web search (100/mo)' }, included: true, highlight: true },
      { text: { fr: 'Playlists (10 vidéos)', en: 'Playlists (10 videos)' }, included: true },
      { text: { fr: 'Export PDF + Markdown', en: 'PDF + Markdown export' }, included: true },
      { text: { fr: 'Lecture audio TTS', en: 'TTS audio' }, included: true },
      { text: { fr: 'Accès API', en: 'API access' }, included: false },
    ],
  },
  {
    id: 'expert',
    name: { fr: 'Expert', en: 'Expert' },
    description: { fr: 'Pour les professionnels', en: 'For professionals' },
    price: 14.99,
    recommended: true,
    order: 3,
    gradient: 'from-amber-500 to-orange-500',
    features: [
      { text: { fr: 'Analyses illimitées', en: 'Unlimited analyses' }, included: true, highlight: true },
      { text: { fr: 'Tout Pro inclus', en: 'All Pro features' }, included: true },
      { text: { fr: 'Playlists (50 vidéos)', en: 'Playlists (50 videos)' }, included: true, highlight: true },
      { text: { fr: 'Recherche web (500/mois)', en: 'Web search (500/mo)' }, included: true, highlight: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🌟 AVANTAGES EXPERT (uniquement features implémentées)
// ═══════════════════════════════════════════════════════════════════════════════

interface ExclusiveFeature {
  icon: React.ElementType;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  badge?: { fr: string; en: string };
}

const EXPERT_EXCLUSIVES: ExclusiveFeature[] = [
  {
    icon: Key,
    title: { fr: 'Accès API REST', en: 'REST API Access' },
    description: { fr: 'Intégrez Deep Sight dans vos applications (1000 req/jour)', en: 'Integrate Deep Sight into your apps (1000 req/day)' },
    badge: { fr: 'NOUVEAU', en: 'NEW' },
  },
  {
    icon: Infinity,
    title: { fr: 'Analyses illimitées', en: 'Unlimited Analyses' },
    description: { fr: 'Aucune limite mensuelle sur les analyses', en: 'No monthly limit on analyses' },
  },
  {
    icon: ListVideo,
    title: { fr: 'Playlists étendues', en: 'Extended Playlists' },
    description: { fr: 'Jusqu\'à 50 vidéos par playlist (vs 10 pour Pro)', en: 'Up to 50 videos per playlist (vs 10 for Pro)' },
  },
  {
    icon: Database,
    title: { fr: '500 recherches web/mois', en: '500 Web Searches/mo' },
    description: { fr: '5x plus de recherches Perplexity que Pro', en: '5x more Perplexity searches than Pro' },
  },
  {
    icon: Headphones,
    title: { fr: 'Support prioritaire', en: 'Priority Support' },
    description: { fr: 'Assistance email avec réponse rapide', en: 'Fast email support response' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 MATRICE DE COMPARAISON
// ═══════════════════════════════════════════════════════════════════════════════

interface ComparisonRow {
  category: string;
  feature: { fr: string; en: string };
  free: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
  expert: string | boolean;
  expertHighlight?: boolean;
}

const COMPARISON_MATRIX: ComparisonRow[] = [
  // Limites
  { category: '📊 Limites', feature: { fr: 'Analyses/mois', en: 'Analyses/month' }, free: '5', starter: '50', pro: '200', expert: '∞', expertHighlight: true },
  { category: '📊 Limites', feature: { fr: 'Durée max vidéo', en: 'Max video length' }, free: '1h', starter: '2h', pro: '4h', expert: '∞', expertHighlight: true },
  { category: '📊 Limites', feature: { fr: 'Questions chat/vidéo', en: 'Chat questions/video' }, free: '5', starter: '20', pro: '∞', expert: '∞' },
  { category: '📊 Limites', feature: { fr: 'Historique', en: 'History' }, free: '7 jours', starter: '60 jours', pro: '180 jours', expert: '∞', expertHighlight: true },
  
  // Analyse
  { category: '🔬 Analyse', feature: { fr: 'Synthèse express', en: 'Express summary' }, free: true, starter: true, pro: true, expert: true },
  { category: '🔬 Analyse', feature: { fr: 'Analyse détaillée', en: 'Detailed analysis' }, free: false, starter: true, pro: true, expert: true },
  { category: '🔬 Analyse', feature: { fr: 'Glossaire concepts', en: 'Concepts glossary' }, free: false, starter: true, pro: true, expert: true },
  
  // Chat & Recherche
  { category: '💬 Chat & Recherche', feature: { fr: 'Chat IA', en: 'AI Chat' }, free: true, starter: true, pro: true, expert: true },
  { category: '💬 Chat & Recherche', feature: { fr: 'Recherche web (Perplexity)', en: 'Web search (Perplexity)' }, free: false, starter: '20/mois', pro: '100/mois', expert: '500/mois', expertHighlight: true },
  
  // Playlists
  { category: '📚 Playlists', feature: { fr: 'Analyse de playlists', en: 'Playlist analysis' }, free: false, starter: false, pro: '10 vidéos', expert: '50 vidéos', expertHighlight: true },
  
  // Export
  { category: '📄 Export', feature: { fr: 'Export PDF', en: 'PDF export' }, free: false, starter: true, pro: true, expert: true },
  { category: '📄 Export', feature: { fr: 'Export Markdown', en: 'Markdown export' }, free: false, starter: false, pro: true, expert: true },
  
  // Audio
  { category: '🎧 Audio', feature: { fr: 'Lecture audio TTS', en: 'TTS audio' }, free: false, starter: false, pro: true, expert: true },
  
  // API
  { category: '🔌 API', feature: { fr: 'Accès API REST', en: 'REST API access' }, free: false, starter: false, pro: false, expert: '1000 req/jour', expertHighlight: true },
  
  // Support
  { category: '🛟 Support', feature: { fr: 'Support email', en: 'Email support' }, free: true, starter: true, pro: true, expert: true },
  { category: '🛟 Support', feature: { fr: 'Support prioritaire', en: 'Priority support' }, free: false, starter: false, pro: true, expert: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

interface SubscriptionStatus {
  plan: string;
  has_subscription: boolean;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

export const UpgradePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ plan: PlanId; action: 'upgrade' | 'downgrade' } | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['📊 Limites', '🔌 API']);

  const currentPlan = (user?.plan || 'free') as PlanId;
  const currentPlanConfig = PLANS.find(p => p.id === currentPlan) || PLANS[0];
  const lang = language as 'fr' | 'en';

  useEffect(() => {
    const loadData = async () => {
      try {
        await refreshUser(true);
        const status = await billingApi.getSubscriptionStatus();
        setSubscriptionStatus(status);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, []);

  const categories = [...new Set(COMPARISON_MATRIX.map(r => r.category))];

  const handleChangePlan = async (newPlanId: PlanId) => {
    if (newPlanId === currentPlan) return;
    
    const newPlanConfig = PLANS.find(p => p.id === newPlanId)!;
    const isUpgrade = newPlanConfig.order > currentPlanConfig.order;
    
    if (!isUpgrade && currentPlan !== 'free') {
      setShowConfirmModal({ plan: newPlanId, action: 'downgrade' });
      return;
    }
    
    await executeChangePlan(newPlanId, isUpgrade ? 'upgrade' : 'downgrade');
  };

  const executeChangePlan = async (newPlanId: PlanId, action: 'upgrade' | 'downgrade') => {
    setLoading(newPlanId);
    setError(null);
    setSuccess(null);
    setShowConfirmModal(null);

    try {
      if (action === 'upgrade' || (currentPlan === 'free' && newPlanId !== 'free')) {
        const result = await billingApi.createCheckout(newPlanId);
        if (result.checkout_url) {
          window.location.href = result.checkout_url;
          return;
        }
      } else {
        const result = await billingApi.changePlan(newPlanId);
        if (result.success) {
          setSuccess(language === 'fr' 
            ? 'Plan modifié ! Changement effectif au prochain renouvellement.'
            : 'Plan changed! Takes effect at next renewal.');
          await refreshUser(true);
          const status = await billingApi.getSubscriptionStatus();
          setSubscriptionStatus(status);
        }
      }
    } catch (err: any) {
      setError(err?.message || (language === 'fr' ? 'Erreur lors du changement' : 'Error changing plan'));
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(language === 'fr' 
      ? 'Êtes-vous sûr de vouloir annuler ? Vous garderez vos avantages jusqu\'à la fin de la période payée.'
      : 'Are you sure? You\'ll keep benefits until paid period ends.')) return;
    
    setLoading('cancel');
    try {
      await billingApi.cancelSubscription();
      setSuccess(language === 'fr' 
        ? 'Abonnement annulé. Accès maintenu jusqu\'à la fin de la période.'
        : 'Subscription cancelled. Access kept until period end.');
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  const getPlanIcon = (planId: PlanId) => {
    switch (planId) {
      case 'free': return Zap;
      case 'starter': return Star;
      case 'pro': return Crown;
      case 'expert': return Sparkles;
    }
  };

  const renderValue = (value: string | boolean) => {
    if (value === true) return <Check className="w-5 h-5 text-green-400" />;
    if (value === false) return <X className="w-5 h-5 text-gray-500" />;
    if (value === '∞') return <Infinity className="w-5 h-5 text-amber-400" />;
    return <span className="text-sm text-text-secondary">{value}</span>;
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <header className="text-center mb-10">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
                {language === 'fr' ? 'Choisissez votre plan' : 'Choose your plan'}
              </h1>
              <p className="text-text-secondary max-w-2xl mx-auto">
                {language === 'fr' 
                  ? 'Débloquez des fonctionnalités puissantes pour analyser le contenu vidéo.'
                  : 'Unlock powerful features to analyze video content.'}
              </p>
            </header>

            {/* Alerts */}
            {subscriptionStatus?.cancel_at_period_end && (
              <div className="card p-4 mb-6 border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-300 text-sm">
                    {language === 'fr' 
                      ? `Abonnement annulé. Accès jusqu'au ${new Date(subscriptionStatus.current_period_end!).toLocaleDateString()}`
                      : `Subscription cancelled. Access until ${new Date(subscriptionStatus.current_period_end!).toLocaleDateString()}`}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await billingApi.reactivateSubscription();
                    const status = await billingApi.getSubscriptionStatus();
                    setSubscriptionStatus(status);
                  }}
                  className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  {language === 'fr' ? 'Réactiver' : 'Reactivate'}
                </button>
              </div>
            )}

            {error && (
              <div className="card p-4 mb-6 border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            {success && (
              <div className="card p-4 mb-6 border-green-500/30 bg-green-500/10 text-green-300 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> {success}
              </div>
            )}

            {/* View Toggle */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-bg-tertiary rounded-xl p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'cards' 
                      ? 'bg-accent-primary text-white shadow-lg' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  🃏 {language === 'fr' ? 'Cartes' : 'Cards'}
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === 'table' 
                      ? 'bg-accent-primary text-white shadow-lg' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  📊 {language === 'fr' ? 'Comparaison' : 'Comparison'}
                </button>
              </div>
            </div>

            {/* Cards View */}
            {viewMode === 'cards' && (
              <>
                {/* Plan Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {PLANS.map((plan) => {
                    const Icon = getPlanIcon(plan.id);
                    const isCurrent = plan.id === currentPlan;
                    const isHigher = plan.order > currentPlanConfig.order;
                    const isLower = plan.order < currentPlanConfig.order;
                    const isExpert = plan.id === 'expert';

                    return (
                      <div
                        key={plan.id}
                        className={`card relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                          isCurrent ? 'ring-2 ring-green-500/50' : ''
                        } ${isExpert ? 'ring-2 ring-amber-500/50 shadow-xl shadow-amber-500/10' : ''}`}
                      >
                        {/* Badge */}
                        {plan.popular && !isExpert && (
                          <div className="absolute -top-0 -right-0">
                            <div className="bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                              {language === 'fr' ? 'Populaire' : 'Popular'}
                            </div>
                          </div>
                        )}
                        {isExpert && (
                          <div className="absolute -top-0 -right-0">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {language === 'fr' ? 'Recommandé' : 'Recommended'}
                            </div>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute top-3 left-3">
                            <div className="bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {language === 'fr' ? 'Plan actuel' : 'Current plan'}
                            </div>
                          </div>
                        )}

                        <div className="p-6 pt-10">
                          {/* Icon & Name */}
                          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                            <Icon className="w-8 h-8 text-white" />
                          </div>

                          <h3 className="text-2xl font-bold text-text-primary mb-1">{plan.name[lang]}</h3>
                          <p className="text-sm text-text-tertiary mb-5">{plan.description[lang]}</p>

                          {/* Price */}
                          <div className="mb-6">
                            <span className="text-4xl font-display font-bold text-text-primary">
                              {plan.price === 0 ? '0' : plan.price.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-text-tertiary ml-1">€/{language === 'fr' ? 'mois' : 'mo'}</span>
                          </div>

                          {/* Key Features */}
                          <div className="space-y-3 mb-6 min-h-[180px]">
                            {plan.features.map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-3 text-sm">
                                <div className={`w-6 h-6 rounded-full ${
                                  feature.included 
                                    ? feature.highlight 
                                      ? 'bg-amber-500/20' 
                                      : 'bg-green-500/20' 
                                    : 'bg-gray-500/20'
                                } flex items-center justify-center`}>
                                  {feature.included 
                                    ? <Check className={`w-3.5 h-3.5 ${feature.highlight ? 'text-amber-400' : 'text-green-400'}`} /> 
                                    : <X className="w-3.5 h-3.5 text-gray-500" />}
                                </div>
                                <span className={`${feature.included ? 'text-text-secondary' : 'text-text-muted line-through'} ${feature.highlight ? 'font-medium text-amber-300' : ''}`}>
                                  {feature.text[lang]}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Expert API Badge */}
                          {isExpert && (
                            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
                                <Key className="w-4 h-4" />
                                {language === 'fr' ? '+ Accès API REST' : '+ REST API Access'}
                              </div>
                              <p className="text-xs text-text-tertiary">
                                {language === 'fr' 
                                  ? '1000 requêtes/jour pour vos intégrations'
                                  : '1000 requests/day for your integrations'}
                              </p>
                            </div>
                          )}

                          {/* CTA */}
                          <button
                            onClick={() => handleChangePlan(plan.id)}
                            disabled={isCurrent || loading === plan.id || plan.id === 'free'}
                            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                              isCurrent
                                ? 'bg-green-500/20 text-green-400 cursor-default'
                                : isHigher
                                ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 shadow-lg`
                                : isLower
                                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                                : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                            }`}
                          >
                            {loading === plan.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isCurrent ? (
                              <><Check className="w-5 h-5" /> {language === 'fr' ? 'Plan actuel' : 'Current plan'}</>
                            ) : isHigher ? (
                              <><ArrowUp className="w-5 h-5" /> {language === 'fr' ? `Passer à ${plan.name[lang]}` : `Upgrade to ${plan.name[lang]}`}</>
                            ) : isLower ? (
                              <><ArrowDown className="w-5 h-5" /> {language === 'fr' ? 'Rétrograder' : 'Downgrade'}</>
                            ) : (
                              language === 'fr' ? 'Plan gratuit' : 'Free plan'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expert Benefits Section */}
                <div className="card p-8 mb-12 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold mb-4">
                      <Sparkles className="w-4 h-4" />
                      {language === 'fr' ? 'Avantages Expert' : 'Expert Benefits'}
                    </div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">
                      {language === 'fr' ? 'Pourquoi choisir Expert ?' : 'Why choose Expert?'}
                    </h2>
                    <p className="text-text-secondary max-w-2xl mx-auto">
                      {language === 'fr' 
                        ? 'Le plan Expert offre des limites étendues et un accès API pour les professionnels.'
                        : 'The Expert plan offers extended limits and API access for professionals.'}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
                    {EXPERT_EXCLUSIVES.map((feature, idx) => {
                      const Icon = feature.icon;
                      return (
                        <div key={idx} className="p-5 rounded-xl bg-bg-secondary/50 border border-border-subtle hover:border-amber-500/30 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-amber-400" />
                            </div>
                            {feature.badge && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                {feature.badge[lang]}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-text-primary mb-1 text-sm">{feature.title[lang]}</h3>
                          <p className="text-xs text-text-tertiary">{feature.description[lang]}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* CTA Expert */}
                  {currentPlan !== 'expert' && (
                    <div className="text-center mt-8">
                      <button
                        onClick={() => handleChangePlan('expert')}
                        disabled={loading === 'expert'}
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/25 hover:opacity-90 transition-opacity"
                      >
                        {loading === 'expert' ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            {language === 'fr' ? 'Passer à Expert — 14,99€/mois' : 'Upgrade to Expert — €14.99/mo'}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="card overflow-hidden mb-12">
                {/* Header */}
                <div className="grid grid-cols-5 gap-4 p-5 bg-bg-secondary border-b border-border-primary">
                  <div className="font-semibold text-text-secondary">
                    {language === 'fr' ? 'Fonctionnalités' : 'Features'}
                  </div>
                  {PLANS.map((plan) => {
                    const Icon = getPlanIcon(plan.id);
                    const isCurrent = plan.id === currentPlan;
                    const isExpert = plan.id === 'expert';
                    return (
                      <div key={plan.id} className={`text-center ${isExpert ? 'bg-amber-500/5 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
                        <div className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} items-center justify-center mb-2 shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="font-bold text-text-primary">{plan.name[lang]}</div>
                        <div className="text-sm text-text-tertiary">{plan.price === 0 ? '0€' : `${plan.price.toFixed(2).replace('.', ',')}€`}</div>
                        {isCurrent && (
                          <div className="text-xs text-green-400 mt-1 flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> {language === 'fr' ? 'Actuel' : 'Current'}
                          </div>
                        )}
                        {isExpert && !isCurrent && (
                          <div className="text-xs text-amber-400 mt-1">
                            {language === 'fr' ? '⭐ Recommandé' : '⭐ Recommended'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Features by category */}
                {categories.map((category) => (
                  <div key={category} className="border-b border-border-primary last:border-b-0">
                    <button
                      onClick={() => setExpandedCategories(prev => 
                        prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
                      )}
                      className="w-full grid grid-cols-5 gap-4 p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
                    >
                      <div className="flex items-center gap-2 text-text-primary font-semibold">
                        {category}
                        {expandedCategories.includes(category) 
                          ? <ChevronUp className="w-4 h-4 text-text-tertiary" />
                          : <ChevronDown className="w-4 h-4 text-text-tertiary" />
                        }
                      </div>
                    </button>
                    
                    {expandedCategories.includes(category) && (
                      <div className="divide-y divide-border-primary/30">
                        {COMPARISON_MATRIX.filter(f => f.category === category).map((row, idx) => (
                          <div key={idx} className="grid grid-cols-5 gap-4 p-4 hover:bg-bg-tertiary/30 transition-colors">
                            <div className="text-sm text-text-secondary">{row.feature[lang]}</div>
                            {(['free', 'starter', 'pro', 'expert'] as PlanId[]).map((planId) => (
                              <div key={planId} className={`flex justify-center ${planId === 'expert' && row.expertHighlight ? 'bg-amber-500/10 -mx-2 px-2 rounded' : ''}`}>
                                {renderValue(row[planId])}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* CTA Row */}
                <div className="grid grid-cols-5 gap-4 p-5 bg-bg-secondary">
                  <div />
                  {PLANS.map((plan) => {
                    const isCurrent = plan.id === currentPlan;
                    const isHigher = plan.order > currentPlanConfig.order;
                    return (
                      <div key={plan.id} className="flex justify-center">
                        <button
                          onClick={() => handleChangePlan(plan.id)}
                          disabled={isCurrent || loading === plan.id || plan.id === 'free'}
                          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                            isCurrent ? 'bg-green-500/20 text-green-400'
                            : isHigher ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 shadow-lg`
                            : 'bg-bg-tertiary text-text-muted'
                          }`}
                        >
                          {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" />
                            : isCurrent ? (language === 'fr' ? 'Actuel' : 'Current')
                            : isHigher ? (language === 'fr' ? 'Choisir' : 'Select')
                            : '-'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancel */}
            {currentPlan !== 'free' && !subscriptionStatus?.cancel_at_period_end && (
              <div className="text-center mb-8">
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading === 'cancel'}
                  className="text-sm text-text-tertiary hover:text-red-400 transition-colors flex items-center gap-2 mx-auto"
                >
                  {loading === 'cancel' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {language === 'fr' ? 'Annuler mon abonnement' : 'Cancel subscription'}
                </button>
              </div>
            )}

            {/* FAQ */}
            <div className="card p-6 mb-8">
              <h3 className="font-bold text-lg text-text-primary mb-5 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent-primary" />
                {language === 'fr' ? 'Questions fréquentes' : 'FAQ'}
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? "Comment fonctionne l'API ?" : 'How does the API work?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Générez votre clé API dans Paramètres. Documentation disponible.' : 'Generate your API key in Settings. Documentation available.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? "Comment fonctionne l'upgrade ?" : 'How does upgrade work?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Vous êtes facturé la différence au prorata. Nouveaux avantages instantanés.' : 'You pay the prorated difference. New benefits are instant.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? 'Puis-je annuler ?' : 'Can I cancel?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Oui, à tout moment. Accès maintenu jusqu\'à fin de période payée.' : 'Yes, anytime. Access kept until paid period ends.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? 'Moyens de paiement ?' : 'Payment methods?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Toutes cartes bancaires via Stripe. Paiements sécurisés.' : 'All cards via Stripe. Secure payments.'}</p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="text-center text-sm text-text-tertiary">
              {language === 'fr' ? 'Questions ? ' : 'Questions? '}
              <a href="mailto:contact@deepsightsynthesis.com" className="text-accent-primary hover:underline">
                contact@deepsightsynthesis.com
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              {language === 'fr' ? 'Confirmer le changement' : 'Confirm change'}
            </h3>
            <p className="text-text-secondary text-sm mb-5">
              {language === 'fr' 
                ? `Passer au plan ${PLANS.find(p => p.id === showConfirmModal.plan)?.name[lang]} ? Vos avantages actuels restent actifs jusqu'à la fin de la période.`
                : `Switch to ${PLANS.find(p => p.id === showConfirmModal.plan)?.name[lang]}? Current benefits stay active until period end.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirmModal(null)} className="btn-secondary">
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={() => executeChangePlan(showConfirmModal.plan, showConfirmModal.action)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                {language === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradePage;
