/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  💎 UPGRADE PAGE v2.0 — Page d'abonnement moderne et intuitive                     ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { 
  Check, X, Sparkles, Zap, Star, Crown, Loader2, 
  ArrowUp, ArrowDown, AlertCircle, RefreshCw,
  Rocket, Shield, MessageSquare, Search, FileText,
  Volume2, Code, HeadphonesIcon, BookOpen, Users,
  ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import { billingApi } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 CONFIGURATION DES PLANS (Source de vérité)
// ═══════════════════════════════════════════════════════════════════════════════

type PlanId = 'free' | 'starter' | 'pro' | 'expert';

interface PlanConfig {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;
  popular?: boolean;
  order: number;
  limits: {
    monthlyAnalyses: number | '∞';
    chatPerVideo: number | '∞';
    playlists: number | '∞' | false;
  };
  features: {
    summaryExpress: boolean;
    summaryDetailed: boolean;
    conceptsGlossary: boolean;
    chatBasic: boolean;
    chatWebSearch: boolean;
    suggestedQuestions: boolean;
    factCheckBasic: boolean;
    factCheckAdvanced: boolean;
    intelligentSearch: boolean;
    playlists: boolean;
    corpus: boolean;
    exportPdf: boolean;
    exportMarkdown: boolean;
    ttsAudio: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    dedicatedSupport: boolean;
  };
}

const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: { fr: 'Découverte', en: 'Discovery' },
    description: { fr: 'Pour explorer', en: 'To explore' },
    price: 0,
    order: 0,
    limits: { monthlyAnalyses: 5, chatPerVideo: 5, playlists: false },
    features: {
      summaryExpress: true,
      summaryDetailed: false,
      conceptsGlossary: false,
      chatBasic: true,
      chatWebSearch: false,
      suggestedQuestions: false,
      factCheckBasic: false,
      factCheckAdvanced: false,
      intelligentSearch: false,
      playlists: false,
      corpus: false,
      exportPdf: false,
      exportMarkdown: false,
      ttsAudio: false,
      apiAccess: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },
  {
    id: 'starter',
    name: { fr: 'Starter', en: 'Starter' },
    description: { fr: 'Pour les réguliers', en: 'For regular users' },
    price: 4.99,
    order: 1,
    limits: { monthlyAnalyses: 50, chatPerVideo: 20, playlists: false },
    features: {
      summaryExpress: true,
      summaryDetailed: true,
      conceptsGlossary: true,
      chatBasic: true,
      chatWebSearch: false,
      suggestedQuestions: true,
      factCheckBasic: true,
      factCheckAdvanced: false,
      intelligentSearch: true,
      playlists: false,
      corpus: false,
      exportPdf: true,
      exportMarkdown: false,
      ttsAudio: false,
      apiAccess: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },
  {
    id: 'pro',
    name: { fr: 'Pro', en: 'Pro' },
    description: { fr: 'Pour les power users', en: 'For power users' },
    price: 9.99,
    popular: true,
    order: 2,
    limits: { monthlyAnalyses: 200, chatPerVideo: '∞', playlists: 10 },
    features: {
      summaryExpress: true,
      summaryDetailed: true,
      conceptsGlossary: true,
      chatBasic: true,
      chatWebSearch: true,
      suggestedQuestions: true,
      factCheckBasic: true,
      factCheckAdvanced: true,
      intelligentSearch: true,
      playlists: true,
      corpus: false,
      exportPdf: true,
      exportMarkdown: true,
      ttsAudio: true,
      apiAccess: false,
      prioritySupport: true,
      dedicatedSupport: false,
    },
  },
  {
    id: 'expert',
    name: { fr: 'Expert', en: 'Expert' },
    description: { fr: 'Pour les organisations', en: 'For organizations' },
    price: 14.99,
    order: 3,
    limits: { monthlyAnalyses: '∞', chatPerVideo: '∞', playlists: 50 },
    features: {
      summaryExpress: true,
      summaryDetailed: true,
      conceptsGlossary: true,
      chatBasic: true,
      chatWebSearch: true,
      suggestedQuestions: true,
      factCheckBasic: true,
      factCheckAdvanced: true,
      intelligentSearch: true,
      playlists: true,
      corpus: true,
      exportPdf: true,
      exportMarkdown: true,
      ttsAudio: true,
      apiAccess: true,
      prioritySupport: true,
      dedicatedSupport: true,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 MATRICE DES FONCTIONNALITÉS POUR COMPARAISON
// ═══════════════════════════════════════════════════════════════════════════════

interface FeatureRow {
  id: string;
  category: string;
  name: { fr: string; en: string };
  free: boolean | string;
  starter: boolean | string;
  pro: boolean | string;
  expert: boolean | string;
}

const FEATURE_MATRIX: FeatureRow[] = [
  // Analyses
  { id: 'analyses', category: '📊 Analyses', name: { fr: 'Analyses mensuelles', en: 'Monthly analyses' }, free: '5', starter: '50', pro: '200', expert: '∞' },
  { id: 'summary_express', category: '📊 Analyses', name: { fr: 'Synthèse express', en: 'Express summary' }, free: true, starter: true, pro: true, expert: true },
  { id: 'summary_detailed', category: '📊 Analyses', name: { fr: 'Analyse détaillée', en: 'Detailed analysis' }, free: false, starter: true, pro: true, expert: true },
  { id: 'concepts', category: '📊 Analyses', name: { fr: 'Glossaire concepts', en: 'Concepts glossary' }, free: false, starter: true, pro: true, expert: true },
  
  // Chat
  { id: 'chat', category: '💬 Chat IA', name: { fr: 'Questions/vidéo', en: 'Questions/video' }, free: '5', starter: '20', pro: '∞', expert: '∞' },
  { id: 'web_search', category: '💬 Chat IA', name: { fr: 'Recherche web (Perplexity)', en: 'Web search (Perplexity)' }, free: false, starter: false, pro: true, expert: true },
  { id: 'suggestions', category: '💬 Chat IA', name: { fr: 'Questions suggérées', en: 'Suggested questions' }, free: false, starter: true, pro: true, expert: true },
  
  // Fact-checking
  { id: 'factcheck', category: '🔍 Vérification', name: { fr: 'Fact-checking basique', en: 'Basic fact-checking' }, free: false, starter: true, pro: true, expert: true },
  { id: 'factcheck_adv', category: '🔍 Vérification', name: { fr: 'Fact-checking avancé', en: 'Advanced fact-checking' }, free: false, starter: false, pro: true, expert: true },
  
  // Recherche & Playlists
  { id: 'search', category: '🎯 Recherche', name: { fr: 'Recherche intelligente', en: 'Intelligent search' }, free: false, starter: true, pro: true, expert: true },
  { id: 'playlists', category: '🎯 Recherche', name: { fr: 'Playlists & corpus', en: 'Playlists & corpus' }, free: false, starter: false, pro: '10 vidéos', expert: '50 vidéos' },
  { id: 'corpus', category: '🎯 Recherche', name: { fr: 'Corpus personnalisés', en: 'Custom corpus' }, free: false, starter: false, pro: false, expert: true },
  
  // Export
  { id: 'export_pdf', category: '📄 Export', name: { fr: 'Export PDF', en: 'PDF export' }, free: false, starter: true, pro: true, expert: true },
  { id: 'export_md', category: '📄 Export', name: { fr: 'Export Markdown & TXT', en: 'Markdown & TXT export' }, free: false, starter: false, pro: true, expert: true },
  
  // Audio
  { id: 'tts', category: '🎧 Audio', name: { fr: 'Lecture audio TTS', en: 'TTS audio' }, free: false, starter: false, pro: true, expert: true },
  
  // Avancé
  { id: 'api', category: '⚡ Avancé', name: { fr: 'Accès API', en: 'API access' }, free: false, starter: false, pro: false, expert: true },
  { id: 'support', category: '⚡ Avancé', name: { fr: 'Support prioritaire', en: 'Priority support' }, free: false, starter: false, pro: true, expert: true },
  { id: 'dedicated', category: '⚡ Avancé', name: { fr: 'Support dédié + Formation', en: 'Dedicated support + Training' }, free: false, starter: false, pro: false, expert: true },
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
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ plan: PlanId; action: 'upgrade' | 'downgrade' } | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['📊 Analyses', '💬 Chat IA']);

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
      const response = await billingApi.changePlan(newPlanId);
      
      if (response.action === 'checkout_required' && response.checkout_url) {
        window.location.href = response.checkout_url;
        return;
      }
      
      setSuccess(response.message);
      await refreshUser(true);
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err.message || (language === 'fr' ? 'Une erreur est survenue.' : 'An error occurred.'));
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(language === 'fr' 
      ? 'Êtes-vous sûr de vouloir annuler votre abonnement ?' 
      : 'Are you sure you want to cancel your subscription?')) return;
    
    setLoading('cancel');
    try {
      await billingApi.cancelSubscription();
      setSuccess(language === 'fr' ? 'Abonnement annulé' : 'Subscription cancelled');
      await refreshUser(true);
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const getPlanIcon = (id: PlanId) => {
    const icons = { free: Zap, starter: Star, pro: Crown, expert: Sparkles };
    return icons[id];
  };

  const getPlanGradient = (id: PlanId) => {
    const gradients = {
      free: 'from-slate-500 to-slate-600',
      starter: 'from-blue-500 to-indigo-600',
      pro: 'from-violet-500 to-purple-600',
      expert: 'from-amber-500 to-orange-600',
    };
    return gradients[id];
  };

  const renderValue = (value: boolean | string) => {
    if (value === true) return <Check className="w-5 h-5 text-green-400" />;
    if (value === false) return <X className="w-5 h-5 text-gray-600" />;
    return <span className="text-sm font-semibold text-accent-primary">{value}</span>;
  };

  const categories = [...new Set(FEATURE_MATRIX.map(f => f.category))];

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <DoodleBackground />
        
        <div className="relative z-10 p-6 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-text-primary mb-3">
              {language === 'fr' ? 'Choisissez votre plan' : 'Choose your plan'}
            </h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              {language === 'fr' 
                ? 'Débloquez des fonctionnalités puissantes pour analyser le contenu vidéo.'
                : 'Unlock powerful features to analyze video content.'}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-400 flex-1">{success}</p>
              <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-bg-secondary rounded-xl p-1.5 flex gap-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'cards' ? 'bg-accent-primary text-white shadow-lg' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {language === 'fr' ? '🎴 Cartes' : '🎴 Cards'}
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'table' ? 'bg-accent-primary text-white shadow-lg' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {language === 'fr' ? '📊 Comparaison' : '📊 Comparison'}
              </button>
            </div>
          </div>

          {/* Card View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
              {PLANS.map((plan) => {
                const Icon = getPlanIcon(plan.id);
                const isCurrent = plan.id === currentPlan;
                const isHigher = plan.order > currentPlanConfig.order;
                const isLower = plan.order < currentPlanConfig.order;

                return (
                  <div
                    key={plan.id}
                    className={`relative card p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                      plan.popular ? 'ring-2 ring-accent-primary shadow-lg shadow-accent-primary/20' : ''
                    } ${isCurrent ? 'ring-2 ring-green-500 shadow-lg shadow-green-500/20' : ''}`}
                  >
                    {/* Badges */}
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-accent-primary to-purple-500 text-white text-xs font-bold rounded-full shadow-lg">
                        ⭐ {language === 'fr' ? 'Recommandé' : 'Recommended'}
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {language === 'fr' ? 'Plan actuel' : 'Current'}
                      </div>
                    )}

                    {/* Icon & Name */}
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getPlanGradient(plan.id)} flex items-center justify-center mb-5 shadow-lg`}>
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
                    <div className="space-y-3 mb-6 min-h-[200px]">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        </div>
                        <span className="text-text-secondary">
                          {plan.limits.monthlyAnalyses === '∞' 
                            ? (language === 'fr' ? 'Analyses illimitées' : 'Unlimited analyses')
                            : `${plan.limits.monthlyAnalyses} ${language === 'fr' ? 'analyses/mois' : 'analyses/mo'}`}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full ${plan.features.summaryDetailed ? 'bg-green-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                          {plan.features.summaryDetailed ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <span className={plan.features.summaryDetailed ? 'text-text-secondary' : 'text-text-muted'}>
                          {language === 'fr' ? 'Analyse détaillée' : 'Detailed analysis'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full ${plan.features.chatWebSearch ? 'bg-green-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                          {plan.features.chatWebSearch ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <span className={plan.features.chatWebSearch ? 'text-text-secondary' : 'text-text-muted'}>
                          {language === 'fr' ? 'Recherche web (Perplexity)' : 'Web search (Perplexity)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full ${plan.features.playlists ? 'bg-green-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                          {plan.features.playlists ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <span className={plan.features.playlists ? 'text-text-secondary' : 'text-text-muted'}>
                          {language === 'fr' ? 'Playlists & corpus' : 'Playlists & corpus'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full ${plan.features.exportPdf ? 'bg-green-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                          {plan.features.exportPdf ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <span className={plan.features.exportPdf ? 'text-text-secondary' : 'text-text-muted'}>
                          {language === 'fr' ? 'Export PDF' : 'PDF export'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full ${plan.features.ttsAudio ? 'bg-green-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                          {plan.features.ttsAudio ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <span className={plan.features.ttsAudio ? 'text-text-secondary' : 'text-text-muted'}>
                          {language === 'fr' ? 'Lecture audio TTS' : 'TTS audio'}
                        </span>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={isCurrent || loading === plan.id || plan.id === 'free'}
                      className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : isHigher
                          ? `bg-gradient-to-r ${getPlanGradient(plan.id)} text-white hover:opacity-90 shadow-lg`
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
                        <><ArrowUp className="w-5 h-5" /> {language === 'fr' ? 'Passer à' : 'Upgrade to'} {plan.name[lang]}</>
                      ) : isLower ? (
                        <><ArrowDown className="w-5 h-5" /> {language === 'fr' ? 'Rétrograder' : 'Downgrade'}</>
                      ) : (
                        language === 'fr' ? 'Plan gratuit' : 'Free plan'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
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
                  return (
                    <div key={plan.id} className="text-center">
                      <div className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanGradient(plan.id)} items-center justify-center mb-2 shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="font-bold text-text-primary">{plan.name[lang]}</div>
                      <div className="text-sm text-text-tertiary">{plan.price === 0 ? '0€' : `${plan.price.toFixed(2).replace('.', ',')}€`}</div>
                      {isCurrent && (
                        <div className="text-xs text-green-400 mt-1 flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" /> {language === 'fr' ? 'Actuel' : 'Current'}
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
                      {FEATURE_MATRIX.filter(f => f.category === category).map((feature) => (
                        <div key={feature.id} className="grid grid-cols-5 gap-4 p-4 hover:bg-bg-tertiary/30 transition-colors">
                          <div className="text-sm text-text-secondary">{feature.name[lang]}</div>
                          {(['free', 'starter', 'pro', 'expert'] as PlanId[]).map((planId) => (
                            <div key={planId} className="flex justify-center">
                              {renderValue(feature[planId])}
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
                          : isHigher ? 'bg-accent-primary text-white hover:bg-accent-primary/90 shadow-lg'
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
                <p className="font-semibold text-text-primary">{language === 'fr' ? "Comment fonctionne l'upgrade ?" : 'How does upgrade work?'}</p>
                <p className="text-text-secondary">{language === 'fr' ? 'Vous êtes facturé la différence au prorata. Nouveaux avantages instantanés.' : 'You pay the prorated difference. New benefits are instant.'}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-text-primary">{language === 'fr' ? 'Comment fonctionne le downgrade ?' : 'How does downgrade work?'}</p>
                <p className="text-text-secondary">{language === 'fr' ? 'Vous gardez vos avantages jusqu\'à la fin de la période. Changement au renouvellement.' : 'Keep benefits until period end. Change at renewal.'}</p>
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
