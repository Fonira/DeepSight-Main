/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 USAGE DASHBOARD v3.0 — Mon Compte                                              ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  ✅ Fonctionne même sans l'API /usage/stats                                        ║
 * ║  ✅ Affiche les infos utilisateur + crédits                                        ║
 * ║  ✅ Documentation complète des modèles IA (Mistral + Perplexity)                   ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Zap, 
  MessageSquare, 
  Globe, 
  Cpu, 
  TrendingUp,
  Calendar,
  CreditCard,
  ArrowRight,
  Sparkles,
  Clock,
  Target,
  Info,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Brain,
  Search,
  BookOpen
} from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 DONNÉES STATIQUES (fonctionnent toujours)
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_INFO = {
  free: {
    name: { fr: 'Découverte', en: 'Discovery' },
    color: '#888888',
    emoji: '🆓',
    credits: 500,
    features: {
      analyses: 5,
      chat: 20,
      webSearch: false,
      playlists: false,
      models: ['mistral-small-latest']
    }
  },
  starter: {
    name: { fr: 'Starter', en: 'Starter' },
    color: '#10B981',
    emoji: '⚡',
    credits: 5000,
    features: {
      analyses: 50,
      chat: 100,
      webSearch: false,
      playlists: false,
      models: ['mistral-small-latest', 'mistral-medium-latest']
    }
  },
  pro: {
    name: { fr: 'Pro', en: 'Pro' },
    color: '#F59E0B',
    emoji: '⭐',
    credits: 25000,
    features: {
      analyses: 200,
      chat: 500,
      webSearch: true,
      playlists: true,
      models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest']
    }
  },
  expert: {
    name: { fr: 'Expert', en: 'Expert' },
    color: '#8B5CF6',
    emoji: '👑',
    credits: 100000,
    features: {
      analyses: -1, // illimité
      chat: -1,
      webSearch: true,
      playlists: true,
      models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest']
    }
  }
};

const MISTRAL_MODELS = [
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    emoji: '🟢',
    speed: 'fast',
    quality: 'good',
    costs: { analysis: 50, chat: 5 },
    contextWindow: 32000,
    description: {
      fr: 'Rapide et économique. Idéal pour les analyses courtes et le chat quotidien.',
      en: 'Fast and economical. Ideal for short analyses and daily chat.'
    },
    plans: ['free', 'starter', 'pro', 'expert']
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium',
    emoji: '🟡',
    speed: 'medium',
    quality: 'very_good',
    costs: { analysis: 100, chat: 10 },
    contextWindow: 32000,
    description: {
      fr: 'Équilibre parfait entre vitesse et qualité. Recommandé pour la plupart des usages.',
      en: 'Perfect balance between speed and quality. Recommended for most uses.'
    },
    plans: ['starter', 'pro', 'expert']
  },
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    emoji: '🟣',
    speed: 'slow',
    quality: 'excellent',
    costs: { analysis: 250, chat: 25 },
    contextWindow: 128000,
    description: {
      fr: 'Le plus puissant. Pour les analyses complexes nécessitant une compréhension approfondie.',
      en: 'The most powerful. For complex analyses requiring deep understanding.'
    },
    plans: ['pro', 'expert']
  }
];

const PERPLEXITY_INFO = {
  name: 'Perplexity Web Search',
  emoji: '🔍',
  cost: 30,
  description: {
    fr: 'Recherche web en temps réel pour enrichir les analyses avec des informations actualisées, vérifier les faits et ajouter du contexte.',
    en: 'Real-time web search to enrich analyses with up-to-date information, fact-check and add context.'
  },
  features: {
    fr: ['Vérification des faits', 'Sources actualisées', 'Contexte enrichi', 'Citations web'],
    en: ['Fact checking', 'Updated sources', 'Enriched context', 'Web citations']
  },
  plans: ['pro', 'expert']
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔢 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(num: number, language: string = 'fr'): string {
  if (num === -1) return '∞';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 10000) return (num / 1000).toFixed(1) + 'k';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  color = 'blue',
  progress,
  maxValue,
}: { 
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  progress?: number;
  maxValue?: number;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; progress: string }> = {
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-500', progress: 'bg-blue-500' },
    green: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', progress: 'bg-emerald-500' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-500', progress: 'bg-purple-500' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-500', progress: 'bg-amber-500' },
    rose: { bg: 'bg-rose-500/10', icon: 'text-rose-500', progress: 'bg-rose-500' },
  };
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
      </div>
      <h3 className="text-sm text-text-secondary mb-1">{title}</h3>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {subtitle && <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>}
      {progress !== undefined && maxValue !== undefined && maxValue > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div 
              className={`h-full ${colors.progress} transition-all duration-500`}
              style={{ width: `${Math.min(100, (progress / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ModelCard({ model, available, language }: { model: typeof MISTRAL_MODELS[0]; available: boolean; language: string }) {
  const speedLabels = {
    fast: { fr: 'Rapide', en: 'Fast', color: 'text-emerald-500' },
    medium: { fr: 'Équilibré', en: 'Balanced', color: 'text-amber-500' },
    slow: { fr: 'Précis', en: 'Thorough', color: 'text-purple-500' },
  };
  const speedInfo = speedLabels[model.speed as keyof typeof speedLabels];

  return (
    <div className={`card p-4 ${!available ? 'opacity-50' : 'hover:border-accent-primary'} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{model.emoji}</span>
          <span className="font-semibold text-text-primary">{model.name}</span>
        </div>
        {!available && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
            {language === 'fr' ? 'Plan supérieur' : 'Higher plan'}
          </span>
        )}
      </div>
      
      <p className="text-sm text-text-secondary mb-3">
        {model.description[language as 'fr' | 'en']}
      </p>
      
      <div className="p-2 rounded-lg bg-bg-tertiary border border-border-subtle mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-tertiary">{language === 'fr' ? 'Analyse vidéo' : 'Video analysis'}</span>
          <span className="text-emerald-500 font-mono">{model.costs.analysis} crédits</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-text-tertiary">{language === 'fr' ? 'Message chat' : 'Chat message'}</span>
          <span className="text-emerald-500 font-mono">{model.costs.chat} crédits</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-xs">
        <span className={speedInfo.color}>
          <Clock className="w-3 h-3 inline mr-1" />
          {speedInfo[language as 'fr' | 'en']}
        </span>
        <span className="text-text-muted">
          {Math.round(model.contextWindow / 1000)}k tokens
        </span>
      </div>
    </div>
  );
}

function FeatureItem({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${enabled ? 'text-text-secondary' : 'text-text-muted'}`}>
      {enabled ? (
        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-text-muted flex-shrink-0" />
      )}
      <span className={!enabled ? 'line-through' : ''}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function UsageDashboard() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rafraîchir les données utilisateur au montage
    const loadData = async () => {
      setLoading(true);
      try {
        await refreshUser(true);
      } catch (err) {
        console.error('Error refreshing user:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary" />
          <p className="text-text-secondary">
            {language === 'fr' ? 'Chargement...' : 'Loading...'}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Récupérer les infos du plan
  const currentPlan = (user?.plan || 'free') as keyof typeof PLAN_INFO;
  const planInfo = PLAN_INFO[currentPlan] || PLAN_INFO.free;
  const userCredits = user?.credits || 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-accent-primary" />
            <h1 className="text-2xl font-bold text-text-primary">
              {language === 'fr' ? 'Mon compte' : 'My Account'}
            </h1>
          </div>
          <p className="text-text-secondary">
            {language === 'fr' 
              ? 'Gérez votre abonnement et suivez votre utilisation' 
              : 'Manage your subscription and track your usage'}
          </p>
        </div>

        {/* Plan actuel */}
        <div 
          className="card mb-8 p-6"
          style={{ borderLeftColor: planInfo.color, borderLeftWidth: 4 }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-text-tertiary mb-1">
                {language === 'fr' ? 'Plan actuel' : 'Current plan'}
              </div>
              <div className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <span>{planInfo.emoji}</span>
                <span>{planInfo.name[language as 'fr' | 'en']}</span>
              </div>
              {user?.email && (
                <div className="text-xs text-text-muted mt-1">
                  {user.email}
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/upgrade')}
              className="btn btn-primary flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {language === 'fr' ? 'Gérer l\'abonnement' : 'Manage subscription'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Zap}
            title={language === 'fr' ? 'Crédits disponibles' : 'Available credits'}
            value={formatNumber(userCredits, language)}
            subtitle={`/ ${formatNumber(planInfo.credits, language)} ${language === 'fr' ? 'mensuels' : 'monthly'}`}
            color="green"
            progress={userCredits}
            maxValue={planInfo.credits}
          />
          
          <StatCard
            icon={TrendingUp}
            title={language === 'fr' ? 'Analyses/mois' : 'Analyses/month'}
            value={planInfo.features.analyses === -1 ? '∞' : planInfo.features.analyses}
            subtitle={language === 'fr' ? 'selon votre plan' : 'based on your plan'}
            color="blue"
          />
          
          <StatCard
            icon={MessageSquare}
            title={language === 'fr' ? 'Chat IA/jour' : 'AI Chat/day'}
            value={planInfo.features.chat === -1 ? '∞' : planInfo.features.chat}
            subtitle={language === 'fr' ? 'messages quotidiens' : 'daily messages'}
            color="purple"
          />
          
          <StatCard
            icon={Globe}
            title={language === 'fr' ? 'Recherche web' : 'Web search'}
            value={planInfo.features.webSearch 
              ? (language === 'fr' ? 'Activé' : 'Enabled')
              : (language === 'fr' ? 'Non disponible' : 'Not available')
            }
            subtitle={planInfo.features.webSearch 
              ? 'Perplexity AI'
              : (language === 'fr' ? 'Plan Pro requis' : 'Pro plan required')
            }
            color={planInfo.features.webSearch ? 'amber' : 'rose'}
          />
        </div>

        {/* Section Modèles IA Mistral */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent-primary" />
            {language === 'fr' ? 'Modèles Mistral IA' : 'Mistral AI Models'}
          </h2>

          <div className="card mb-4 p-4 border-l-4 border-l-blue-500">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p className="mb-2">
                  <strong className="text-text-primary">
                    {language === 'fr' ? '💰 Système de crédits' : '💰 Credit System'}:
                  </strong>{' '}
                  {language === 'fr' 
                    ? 'Chaque action consomme des crédits selon le modèle choisi. Les vidéos longues (>60 min) coûtent 2× plus.'
                    : 'Each action uses credits based on the chosen model. Long videos (>60 min) cost 2× more.'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MISTRAL_MODELS.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                available={model.plans.includes(currentPlan)}
                language={language}
              />
            ))}
          </div>
        </div>

        {/* Section Perplexity */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-500" />
            {language === 'fr' ? 'Recherche Web Perplexity' : 'Perplexity Web Search'}
          </h2>

          <div className={`card p-5 ${!planInfo.features.webSearch ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl flex-shrink-0">
                🔍
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-text-primary">{PERPLEXITY_INFO.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                    +{PERPLEXITY_INFO.cost} crédits
                  </span>
                  {!planInfo.features.webSearch && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-500">
                      {language === 'fr' ? 'Plan Pro requis' : 'Pro plan required'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  {PERPLEXITY_INFO.description[language as 'fr' | 'en']}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PERPLEXITY_INFO.features[language as 'fr' | 'en'].map((feature, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-bg-tertiary text-text-tertiary">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fonctionnalités du plan */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-primary" />
            {language === 'fr' ? 'Fonctionnalités de votre plan' : 'Your plan features'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureItem
              enabled={planInfo.features.playlists}
              label={language === 'fr' ? 'Analyse de playlists' : 'Playlist analysis'}
            />
            <FeatureItem
              enabled={planInfo.features.webSearch}
              label={language === 'fr' ? 'Recherche web Perplexity' : 'Perplexity web search'}
            />
            <FeatureItem
              enabled={planInfo.features.models.includes('mistral-medium-latest')}
              label="Mistral Medium"
            />
            <FeatureItem
              enabled={planInfo.features.models.includes('mistral-large-latest')}
              label="Mistral Large"
            />
          </div>

          {currentPlan === 'free' && (
            <div className="mt-6 pt-4 border-t border-border-subtle">
              <button
                onClick={() => navigate('/upgrade')}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {language === 'fr' ? 'Passer à un plan supérieur' : 'Upgrade your plan'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export { UsageDashboard };
