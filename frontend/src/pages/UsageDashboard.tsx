/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 USAGE DASHBOARD v4.0 — Mon Compte + Guide d'utilisation                        ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  ✅ Vidéo de présentation                                                          ║
 * ║  ✅ Guide d'utilisation complet                                                    ║
 * ║  ✅ Documentation des modèles IA                                                   ║
 * ║  ✅ Suivi de l'abonnement et crédits                                               ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, Zap, MessageSquare, Globe, TrendingUp, CreditCard, ArrowRight,
  Sparkles, Info, CheckCircle, XCircle, Brain, Search, Play, BookOpen,
  Video, ChevronDown, ChevronRight, Youtube, FileText, Layers, Clock,
  Lightbulb, Download, Share2, History, Settings, HelpCircle, Star,
  Compass, Target, Users, Shield, Wand2, ListChecks, BarChart2, 
  MousePointerClick, Languages, Headphones, FileDown, Link2, Bookmark
} from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 DONNÉES STATIQUES
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_INFO = {
  free: {
    name: { fr: 'Découverte', en: 'Discovery' },
    color: '#888888',
    emoji: '🆓',
    credits: 500,
    features: { analyses: 5, chat: 20, webSearch: false, playlists: false, models: ['mistral-small-latest'] }
  },
  starter: {
    name: { fr: 'Starter', en: 'Starter' },
    color: '#10B981',
    emoji: '⚡',
    credits: 5000,
    features: { analyses: 50, chat: 100, webSearch: false, playlists: false, models: ['mistral-small-latest', 'mistral-medium-latest'] }
  },
  pro: {
    name: { fr: 'Pro', en: 'Pro' },
    color: '#F59E0B',
    emoji: '⭐',
    credits: 25000,
    features: { analyses: 200, chat: 500, webSearch: true, playlists: true, models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'] }
  },
  expert: {
    name: { fr: 'Expert', en: 'Expert' },
    color: '#8B5CF6',
    emoji: '👑',
    credits: 100000,
    features: { analyses: -1, chat: -1, webSearch: true, playlists: true, models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'] }
  }
};

const MISTRAL_MODELS = [
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    emoji: '🟢',
    costs: { analysis: 50, chat: 5 },
    contextWindow: 32000,
    description: { fr: 'Rapide et économique. Idéal pour les analyses courtes et le chat quotidien.', en: 'Fast and economical. Ideal for short analyses and daily chat.' },
    plans: ['free', 'starter', 'pro', 'expert']
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium',
    emoji: '🟡',
    costs: { analysis: 100, chat: 10 },
    contextWindow: 32000,
    description: { fr: 'Équilibre parfait entre vitesse et qualité. Recommandé pour la plupart des usages.', en: 'Perfect balance between speed and quality. Recommended for most uses.' },
    plans: ['starter', 'pro', 'expert']
  },
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    emoji: '🟣',
    costs: { analysis: 250, chat: 25 },
    contextWindow: 128000,
    description: { fr: 'Le plus puissant. Pour les analyses complexes nécessitant une compréhension approfondie.', en: 'The most powerful. For complex analyses requiring deep understanding.' },
    plans: ['pro', 'expert']
  }
];

const PERPLEXITY_INFO = {
  name: 'Perplexity Web Search',
  emoji: '🔍',
  cost: 30,
  description: { fr: 'Recherche web en temps réel pour enrichir les analyses.', en: 'Real-time web search to enrich analyses.' },
  plans: ['pro', 'expert']
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 GUIDE D'UTILISATION COMPLET
// ═══════════════════════════════════════════════════════════════════════════════

const USER_GUIDE = {
  sections: [
    {
      id: 'getting-started',
      icon: Compass,
      title: { fr: 'Démarrage rapide', en: 'Getting Started' },
      color: 'emerald',
      items: [
        {
          icon: Youtube,
          title: { fr: 'Analyser une vidéo YouTube', en: 'Analyze a YouTube video' },
          description: {
            fr: 'Collez simplement l\'URL d\'une vidéo YouTube dans la barre d\'analyse. Deep Sight extraira automatiquement la transcription et générera un résumé intelligent.',
            en: 'Simply paste a YouTube video URL into the analysis bar. Deep Sight will automatically extract the transcript and generate a smart summary.'
          },
          steps: {
            fr: ['Copiez l\'URL de la vidéo YouTube', 'Collez-la dans la barre "Analyser une vidéo"', 'Choisissez le mode d\'analyse', 'Cliquez sur Analyser'],
            en: ['Copy the YouTube video URL', 'Paste it in the "Analyze a video" bar', 'Choose the analysis mode', 'Click Analyze']
          }
        },
        {
          icon: Layers,
          title: { fr: 'Choisir le mode d\'analyse', en: 'Choose analysis mode' },
          description: {
            fr: 'Deep Sight propose 3 modes d\'analyse adaptés à vos besoins : Express pour un aperçu rapide, Standard pour une analyse équilibrée, et Approfondi pour une étude complète.',
            en: 'Deep Sight offers 3 analysis modes tailored to your needs: Express for a quick overview, Standard for a balanced analysis, and Deep for a complete study.'
          },
          modes: [
            { name: { fr: 'Express (30s)', en: 'Express (30s)' }, desc: { fr: 'Résumé ultra-concis, points clés uniquement', en: 'Ultra-concise summary, key points only' } },
            { name: { fr: 'Standard (2-4 min)', en: 'Standard (2-4 min)' }, desc: { fr: 'Analyse équilibrée avec contexte', en: 'Balanced analysis with context' } },
            { name: { fr: 'Approfondi (5-10 min)', en: 'Deep (5-10 min)' }, desc: { fr: 'Étude complète et détaillée', en: 'Complete and detailed study' } }
          ]
        }
      ]
    },
    {
      id: 'features',
      icon: Wand2,
      title: { fr: 'Fonctionnalités principales', en: 'Main Features' },
      color: 'blue',
      items: [
        {
          icon: MessageSquare,
          title: { fr: 'Chat IA contextuel', en: 'Contextual AI Chat' },
          description: {
            fr: 'Après l\'analyse, posez des questions sur le contenu de la vidéo. L\'IA a accès à toute la transcription et peut répondre précisément à vos interrogations.',
            en: 'After analysis, ask questions about the video content. The AI has access to the entire transcript and can accurately answer your questions.'
          },
          tips: {
            fr: ['Posez des questions spécifiques pour des réponses précises', 'Demandez des clarifications sur des points complexes', 'Explorez les concepts mentionnés dans la vidéo'],
            en: ['Ask specific questions for precise answers', 'Request clarification on complex points', 'Explore concepts mentioned in the video']
          }
        },
        {
          icon: Clock,
          title: { fr: 'Timestamps cliquables', en: 'Clickable timestamps' },
          description: {
            fr: 'Chaque point du résumé est lié à un moment précis de la vidéo. Cliquez sur un timestamp pour accéder directement au passage correspondant.',
            en: 'Each point in the summary is linked to a specific moment in the video. Click on a timestamp to go directly to the corresponding passage.'
          }
        },
        {
          icon: BookOpen,
          title: { fr: 'Concepts Wikipedia', en: 'Wikipedia Concepts' },
          description: {
            fr: 'Les termes importants sont automatiquement identifiés et liés à Wikipedia. Survolez un concept pour voir sa définition, cliquez pour en savoir plus.',
            en: 'Important terms are automatically identified and linked to Wikipedia. Hover over a concept to see its definition, click to learn more.'
          }
        },
        {
          icon: Search,
          title: { fr: 'Enrichissement Perplexity', en: 'Perplexity Enrichment' },
          description: {
            fr: 'Pour les abonnés Pro et Expert, activez la recherche web pour vérifier les faits, ajouter du contexte actualisé et obtenir des sources supplémentaires.',
            en: 'For Pro and Expert subscribers, enable web search to fact-check, add current context, and get additional sources.'
          },
          badge: { fr: 'Pro/Expert', en: 'Pro/Expert' }
        },
        {
          icon: Layers,
          title: { fr: 'Analyse de playlists', en: 'Playlist Analysis' },
          description: {
            fr: 'Analysez plusieurs vidéos en une seule fois. Deep Sight créera un corpus thématique avec des synthèses croisées et des connexions entre les contenus.',
            en: 'Analyze multiple videos at once. Deep Sight will create a thematic corpus with cross-syntheses and connections between contents.'
          },
          badge: { fr: 'Pro/Expert', en: 'Pro/Expert' }
        },
        {
          icon: Star,
          title: { fr: 'Score Tournesol', en: 'Tournesol Score' },
          description: {
            fr: 'Visualisez le score éthique Tournesol des vidéos analysées. Ce score collaboratif évalue la qualité et la fiabilité du contenu.',
            en: 'View the Tournesol ethical score of analyzed videos. This collaborative score evaluates the quality and reliability of the content.'
          }
        }
      ]
    },
    {
      id: 'export',
      icon: Download,
      title: { fr: 'Export et partage', en: 'Export and Share' },
      color: 'purple',
      items: [
        {
          icon: FileDown,
          title: { fr: 'Exporter en PDF', en: 'Export to PDF' },
          description: {
            fr: 'Téléchargez vos analyses au format PDF avec tous les détails, timestamps et concepts. Idéal pour archiver ou partager.',
            en: 'Download your analyses in PDF format with all details, timestamps and concepts. Ideal for archiving or sharing.'
          }
        },
        {
          icon: FileText,
          title: { fr: 'Copier en Markdown', en: 'Copy as Markdown' },
          description: {
            fr: 'Copiez le résumé au format Markdown pour l\'intégrer facilement dans vos notes (Notion, Obsidian, etc.).',
            en: 'Copy the summary in Markdown format to easily integrate it into your notes (Notion, Obsidian, etc.).'
          }
        },
        {
          icon: Link2,
          title: { fr: 'Partager un lien', en: 'Share a link' },
          description: {
            fr: 'Générez un lien de partage pour permettre à d\'autres de voir votre analyse (fonctionnalité à venir).',
            en: 'Generate a share link to allow others to view your analysis (feature coming soon).'
          },
          badge: { fr: 'Bientôt', en: 'Coming soon' }
        }
      ]
    },
    {
      id: 'history',
      icon: History,
      title: { fr: 'Historique et organisation', en: 'History and Organization' },
      color: 'amber',
      items: [
        {
          icon: History,
          title: { fr: 'Historique des analyses', en: 'Analysis History' },
          description: {
            fr: 'Retrouvez toutes vos analyses passées dans l\'onglet Historique. Recherchez, filtrez et ré-accédez à vos résumés à tout moment.',
            en: 'Find all your past analyses in the History tab. Search, filter and re-access your summaries at any time.'
          }
        },
        {
          icon: Bookmark,
          title: { fr: 'Favoris', en: 'Favorites' },
          description: {
            fr: 'Marquez vos analyses importantes comme favoris pour les retrouver facilement.',
            en: 'Mark your important analyses as favorites to find them easily.'
          }
        },
        {
          icon: Compass,
          title: { fr: 'Découverte intelligente', en: 'Smart Discovery' },
          description: {
            fr: 'Utilisez la fonction Découverte pour trouver des vidéos pertinentes sur un sujet. Deep Sight suggère du contenu de qualité basé sur vos intérêts.',
            en: 'Use the Discovery feature to find relevant videos on a topic. Deep Sight suggests quality content based on your interests.'
          }
        }
      ]
    },
    {
      id: 'settings',
      icon: Settings,
      title: { fr: 'Personnalisation', en: 'Customization' },
      color: 'slate',
      items: [
        {
          icon: Languages,
          title: { fr: 'Langue de l\'interface', en: 'Interface Language' },
          description: {
            fr: 'Changez la langue de l\'interface (Français/Anglais) dans les Paramètres. Les résumés sont générés dans la langue de la vidéo par défaut.',
            en: 'Change the interface language (French/English) in Settings. Summaries are generated in the video language by default.'
          }
        },
        {
          icon: Headphones,
          title: { fr: 'Mode d\'analyse par défaut', en: 'Default Analysis Mode' },
          description: {
            fr: 'Définissez votre mode d\'analyse préféré (Express, Standard, Approfondi) dans les Paramètres pour gagner du temps.',
            en: 'Set your preferred analysis mode (Express, Standard, Deep) in Settings to save time.'
          }
        }
      ]
    }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔢 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(num: number, language: string = 'fr'): string {
  if (num === -1) return '∞';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, title, value, subtitle, color = 'blue', progress, maxValue }: { 
  icon: React.ElementType; title: string; value: string | number; subtitle?: string; color?: string; progress?: number; maxValue?: number;
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
      <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${colors.icon}`} />
      </div>
      <h3 className="text-sm text-text-secondary mb-1">{title}</h3>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {subtitle && <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>}
      {progress !== undefined && maxValue !== undefined && maxValue > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div className={`h-full ${colors.progress} transition-all duration-500`} style={{ width: `${Math.min(100, (progress / maxValue) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ModelCard({ model, available, language }: { model: typeof MISTRAL_MODELS[0]; available: boolean; language: string }) {
  return (
    <div className={`card p-5 ${!available ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{model.emoji}</span>
        <div>
          <h3 className="font-semibold text-text-primary">{model.name}</h3>
          {!available && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">{language === 'fr' ? 'Plan supérieur' : 'Higher plan'}</span>}
        </div>
      </div>
      <p className="text-sm text-text-secondary mb-3">{model.description[language as 'fr' | 'en']}</p>
      <div className="flex gap-4 text-xs text-text-tertiary">
        <span>Analyse: <strong className="text-text-primary">{model.costs.analysis}</strong> crédits</span>
        <span>Chat: <strong className="text-text-primary">{model.costs.chat}</strong> crédits</span>
      </div>
      <div className="mt-2 text-xs text-text-tertiary flex items-center gap-1">
        {model.contextWindow >= 100000 ? '🎯 Précis' : '⚡ Rapide'} • {(model.contextWindow / 1000)}k tokens
      </div>
    </div>
  );
}

function FeatureItem({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-bg-tertiary/50">
      {enabled ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-text-tertiary" />}
      <span className={enabled ? 'text-text-primary' : 'text-text-tertiary'}>{label}</span>
    </div>
  );
}

// Section du guide avec accordéon
function GuideSection({ section, language, isOpen, onToggle }: { 
  section: typeof USER_GUIDE.sections[0]; language: string; isOpen: boolean; onToggle: () => void;
}) {
  const Icon = section.icon;
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    amber: 'bg-amber-500/10 text-amber-500',
    slate: 'bg-slate-500/10 text-slate-400',
  };

  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between hover:bg-bg-tertiary/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colorMap[section.color]} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-text-primary">{section.title[language as 'fr' | 'en']}</h3>
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5 text-text-tertiary" /> : <ChevronRight className="w-5 h-5 text-text-tertiary" />}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {section.items.map((item, idx) => {
            const ItemIcon = item.icon;
            return (
              <div key={idx} className="p-4 rounded-xl bg-bg-tertiary/50 border border-border-subtle">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-bg-primary flex items-center justify-center flex-shrink-0">
                    <ItemIcon className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-text-primary">{item.title[language as 'fr' | 'en']}</h4>
                      {item.badge && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                          {item.badge[language as 'fr' | 'en']}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{item.description[language as 'fr' | 'en']}</p>
                    
                    {/* Steps */}
                    {item.steps && (
                      <div className="mt-3 space-y-1">
                        {item.steps[language as 'fr' | 'en'].map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                            <span className="text-text-secondary">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Modes */}
                    {item.modes && (
                      <div className="mt-3 grid gap-2">
                        {item.modes.map((mode, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-bg-primary">
                            <span className="font-medium text-text-primary">{mode.name[language as 'fr' | 'en']}</span>
                            <span className="text-text-tertiary">—</span>
                            <span className="text-text-secondary">{mode.desc[language as 'fr' | 'en']}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Tips */}
                    {item.tips && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-500 text-sm font-medium mb-2">
                          <Lightbulb className="w-4 h-4" />
                          {language === 'fr' ? 'Conseils' : 'Tips'}
                        </div>
                        <ul className="space-y-1">
                          {item.tips[language as 'fr' | 'en'].map((tip, i) => (
                            <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏠 PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export function UsageDashboard() {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<string[]>(['getting-started']);

  const currentPlan = (user?.plan || 'free') as keyof typeof PLAN_INFO;
  const planInfo = PLAN_INFO[currentPlan] || PLAN_INFO.free;
  const userCredits = user?.credits || 0;

  const toggleSection = (id: string) => {
    setOpenSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

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
            {language === 'fr' ? 'Gérez votre abonnement et suivez votre utilisation' : 'Manage your subscription and track your usage'}
          </p>
        </div>

        {/* Plan actuel */}
        <div className="card mb-8 p-6" style={{ borderLeftColor: planInfo.color, borderLeftWidth: 4 }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-text-tertiary mb-1">{language === 'fr' ? 'Plan actuel' : 'Current plan'}</div>
              <div className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <span>{planInfo.emoji}</span>
                <span>{planInfo.name[language as 'fr' | 'en']}</span>
              </div>
              {user?.email && <div className="text-xs text-text-muted mt-1">{user.email}</div>}
            </div>
            <button onClick={() => navigate('/upgrade')} className="btn btn-primary flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {language === 'fr' ? 'Gérer l\'abonnement' : 'Manage subscription'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Zap} title={language === 'fr' ? 'Crédits disponibles' : 'Available credits'} value={formatNumber(userCredits, language)} subtitle={`/ ${formatNumber(planInfo.credits, language)} ${language === 'fr' ? 'mensuels' : 'monthly'}`} color="green" progress={userCredits} maxValue={planInfo.credits} />
          <StatCard icon={TrendingUp} title={language === 'fr' ? 'Analyses/mois' : 'Analyses/month'} value={planInfo.features.analyses === -1 ? '∞' : planInfo.features.analyses} subtitle={language === 'fr' ? 'selon votre plan' : 'based on your plan'} color="blue" />
          <StatCard icon={MessageSquare} title={language === 'fr' ? 'Chat IA/jour' : 'AI Chat/day'} value={planInfo.features.chat === -1 ? '∞' : planInfo.features.chat} subtitle={language === 'fr' ? 'messages quotidiens' : 'daily messages'} color="purple" />
          <StatCard icon={Globe} title={language === 'fr' ? 'Recherche web' : 'Web search'} value={planInfo.features.webSearch ? (language === 'fr' ? 'Activé' : 'Enabled') : (language === 'fr' ? 'Non disponible' : 'Not available')} subtitle={planInfo.features.webSearch ? 'Perplexity AI' : (language === 'fr' ? 'Plan Pro requis' : 'Pro plan required')} color={planInfo.features.webSearch ? 'amber' : 'rose'} />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* 🎬 VIDÉO DE PRÉSENTATION */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-accent-primary" />
            {language === 'fr' ? 'Vidéo de présentation' : 'Introduction Video'}
          </h2>

          <div className="card overflow-hidden">
            {/* Placeholder pour la vidéo - à remplacer par l'URL YouTube */}
            <div className="aspect-video bg-gradient-to-br from-bg-tertiary to-bg-secondary relative flex items-center justify-center">
              {/* Remplacer ce div par un iframe YouTube quand la vidéo sera prête */}
              {/* <iframe 
                src="https://www.youtube.com/embed/VIDEO_ID" 
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              /> */}
              
              {/* Placeholder actuel */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-accent-primary/20 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-accent-primary/30 transition-colors group">
                  <Play className="w-10 h-10 text-accent-primary group-hover:scale-110 transition-transform" fill="currentColor" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">
                  {language === 'fr' ? 'Découvrez Deep Sight en 3 minutes' : 'Discover Deep Sight in 3 minutes'}
                </h3>
                <p className="text-text-secondary max-w-md mx-auto">
                  {language === 'fr' 
                    ? 'Apprenez à utiliser toutes les fonctionnalités de Deep Sight pour analyser vos vidéos YouTube efficacement.'
                    : 'Learn how to use all Deep Sight features to effectively analyze your YouTube videos.'}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-tertiary text-text-tertiary text-sm">
                  <Clock className="w-4 h-4" />
                  {language === 'fr' ? 'Vidéo à venir prochainement' : 'Video coming soon'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* 📚 GUIDE D'UTILISATION COMPLET */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent-primary" />
            {language === 'fr' ? 'Guide d\'utilisation complet' : 'Complete User Guide'}
          </h2>

          <div className="space-y-3">
            {USER_GUIDE.sections.map(section => (
              <GuideSection
                key={section.id}
                section={section}
                language={language}
                isOpen={openSections.includes(section.id)}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </div>
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
                <strong className="text-text-primary">💰 {language === 'fr' ? 'Système de crédits' : 'Credit System'}:</strong>{' '}
                {language === 'fr' 
                  ? 'Chaque action consomme des crédits selon le modèle choisi. Les vidéos longues (>60 min) coûtent 2× plus.'
                  : 'Each action uses credits based on the chosen model. Long videos (>60 min) cost 2× more.'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MISTRAL_MODELS.map(model => (
              <ModelCard key={model.id} model={model} available={model.plans.includes(currentPlan)} language={language} />
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
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl flex-shrink-0">🔍</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-text-primary">{PERPLEXITY_INFO.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">+{PERPLEXITY_INFO.cost} crédits</span>
                  {!planInfo.features.webSearch && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-500">
                      {language === 'fr' ? 'Plan Pro requis' : 'Pro plan required'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">{PERPLEXITY_INFO.description[language as 'fr' | 'en']}</p>
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
            <FeatureItem enabled={planInfo.features.playlists} label={language === 'fr' ? 'Analyse de playlists' : 'Playlist analysis'} />
            <FeatureItem enabled={planInfo.features.webSearch} label={language === 'fr' ? 'Recherche web Perplexity' : 'Perplexity web search'} />
            <FeatureItem enabled={planInfo.features.models.includes('mistral-medium-latest')} label="Mistral Medium" />
            <FeatureItem enabled={planInfo.features.models.includes('mistral-large-latest')} label="Mistral Large" />
          </div>

          {currentPlan === 'free' && (
            <div className="mt-6 pt-4 border-t border-border-subtle">
              <button onClick={() => navigate('/upgrade')} className="btn btn-primary w-full flex items-center justify-center gap-2">
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

export default UsageDashboard;
