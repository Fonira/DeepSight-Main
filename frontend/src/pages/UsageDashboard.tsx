/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 USAGE DASHBOARD v5.0 — Mon Compte + Guide d'utilisation                        ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  ✅ Données alimentées par planPrivileges.ts (source de vérité unique)             ║
 * ║  ✅ Guide d'utilisation mis à jour (modes: Accessible/Standard/Expert)             ║
 * ║  ✅ Section modèles supprimée (auto-sélection selon le plan)                       ║
 * ║  ✅ Vidéo de présentation                                                          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Zap, MessageSquare, Globe, TrendingUp, CreditCard, ArrowRight,
  Sparkles, CheckCircle, XCircle, Search, Play, BookOpen,
  Video, ChevronDown, ChevronRight, Youtube, FileText, Layers, Clock,
  Lightbulb, Download, History, Settings, Star,
  Compass, Wand2,
  Languages, FileDown, Link2, Bookmark,
  Shield, PenTool,
  type LucideIcon,
} from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  normalizePlanId,
  type PlanId,
} from '../config/planPrivileges';

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 GUIDE D'UTILISATION COMPLET (mis à jour v5.0)
// ═══════════════════════════════════════════════════════════════════════════════

interface GuideItem {
  icon: LucideIcon;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  steps?: { fr: string[]; en: string[] };
  modes?: Array<{ name: { fr: string; en: string }; desc: { fr: string; en: string } }>;
  tips?: { fr: string[]; en: string[] };
  badge?: { fr: string; en: string };
}

const USER_GUIDE: { sections: Array<{ id: string; icon: LucideIcon; title: { fr: string; en: string }; color: string; items: GuideItem[] }> } = {
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
            fr: 'Collez simplement l\'URL d\'une vidéo YouTube dans la barre d\'analyse. Deep Sight extraira automatiquement la transcription et générera un résumé intelligent avec analyse épistémique bayésienne.',
            en: 'Simply paste a YouTube video URL into the analysis bar. Deep Sight will automatically extract the transcript and generate a smart summary with Bayesian epistemic analysis.'
          },
          steps: {
            fr: ['Copiez l\'URL de la vidéo YouTube', 'Collez-la dans la barre d\'analyse', 'Choisissez le mode d\'analyse (Accessible, Standard ou Expert)', 'Cliquez sur Analyser — la catégorie et le modèle IA sont détectés automatiquement'],
            en: ['Copy the YouTube video URL', 'Paste it in the analysis bar', 'Choose the analysis mode (Accessible, Standard or Expert)', 'Click Analyze — the category and AI model are auto-detected']
          }
        },
        {
          icon: Layers,
          title: { fr: 'Choisir le mode d\'analyse', en: 'Choose analysis mode' },
          description: {
            fr: 'Deep Sight propose 3 modes d\'analyse adaptés à vos besoins. Le modèle IA est automatiquement sélectionné selon votre plan d\'abonnement.',
            en: 'Deep Sight offers 3 analysis modes tailored to your needs. The AI model is automatically selected based on your subscription plan.'
          },
          modes: [
            { name: { fr: 'Accessible', en: 'Accessible' }, desc: { fr: 'Grand public, simplifié et clair', en: 'General public, simplified and clear' } },
            { name: { fr: 'Standard', en: 'Standard' }, desc: { fr: 'Analyse équilibrée avec contexte détaillé', en: 'Balanced analysis with detailed context' } },
            { name: { fr: 'Expert', en: 'Expert' }, desc: { fr: 'Analyse technique et académique approfondie', en: 'In-depth technical and academic analysis' } }
          ]
        },
        {
          icon: FileText,
          title: { fr: 'Analyser un texte brut', en: 'Analyze raw text' },
          description: {
            fr: 'Vous pouvez aussi coller directement un texte (article, notes, transcription) pour le faire analyser. Minimum 100 caractères requis.',
            en: 'You can also paste raw text (article, notes, transcript) to have it analyzed. Minimum 100 characters required.'
          },
          steps: {
            fr: ['Sélectionnez le mode "Texte" dans la barre d\'analyse', 'Collez votre texte (min. 100 caractères)', 'Ajoutez un titre et une source si vous le souhaitez', 'Cliquez sur Analyser'],
            en: ['Select "Text" mode in the analysis bar', 'Paste your text (min. 100 characters)', 'Add a title and source if you wish', 'Click Analyze']
          }
        }
      ]
    },
    {
      id: 'customization',
      icon: PenTool,
      title: { fr: 'Personnalisation', en: 'Customization' },
      color: 'blue',
      items: [
        {
          icon: PenTool,
          title: { fr: 'Style d\'écriture', en: 'Writing style' },
          description: {
            fr: 'Choisissez parmi 6 styles d\'écriture pour adapter le résumé à vos besoins : Standard, Humanisé, Académique, Casual, Humour, ou Doux.',
            en: 'Choose from 6 writing styles to adapt the summary to your needs: Default, Human, Academic, Casual, Humorous, or Soft.'
          }
        },
        {
          icon: Shield,
          title: { fr: 'Anti-détection IA', en: 'Anti-AI detection' },
          description: {
            fr: 'Activez cette option pour que le résumé soit rédigé de manière plus naturelle et moins détectable par les outils de détection d\'IA. Idéal pour les travaux académiques.',
            en: 'Enable this option for a more naturally written summary that is less detectable by AI detection tools. Ideal for academic work.'
          }
        },
        {
          icon: Sparkles,
          title: { fr: 'Instructions personnalisées', en: 'Custom instructions' },
          description: {
            fr: 'Ajoutez vos propres instructions pour orienter l\'analyse selon vos besoins spécifiques. Par exemple : "Concentre-toi sur les arguments économiques" ou "Extrais les dates clés".',
            en: 'Add your own instructions to guide the analysis according to your specific needs. For example: "Focus on economic arguments" or "Extract key dates".'
          }
        }
      ]
    },
    {
      id: 'features',
      icon: Wand2,
      title: { fr: 'Fonctionnalités principales', en: 'Main Features' },
      color: 'purple',
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
          title: { fr: 'Concepts enrichis', en: 'Enriched Concepts' },
          description: {
            fr: 'Les termes importants sont automatiquement identifiés et liés à Wikipedia. Survolez un concept pour voir sa définition, cliquez pour en savoir plus.',
            en: 'Important terms are automatically identified and linked to Wikipedia. Hover over a concept to see its definition, click to learn more.'
          }
        },
        {
          icon: Search,
          title: { fr: 'Fact-checking Perplexity', en: 'Perplexity Fact-checking' },
          description: {
            fr: 'À partir du plan Starter, activez la recherche web pour vérifier les faits, ajouter du contexte actualisé et obtenir des sources supplémentaires.',
            en: 'Starting from the Starter plan, enable web search to fact-check, add current context, and get additional sources.'
          },
          badge: { fr: 'Starter+', en: 'Starter+' }
        },
        {
          icon: Layers,
          title: { fr: 'Analyse de playlists', en: 'Playlist Analysis' },
          description: {
            fr: 'Analysez plusieurs vidéos en une seule fois. Deep Sight créera un corpus thématique avec des synthèses croisées et des connexions entre les contenus.',
            en: 'Analyze multiple videos at once. Deep Sight will create a thematic corpus with cross-syntheses and connections between contents.'
          },
          badge: { fr: 'Pro+', en: 'Pro+' }
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
      color: 'amber',
      items: [
        {
          icon: FileDown,
          title: { fr: 'Exporter en PDF', en: 'Export to PDF' },
          description: {
            fr: 'Téléchargez vos analyses au format PDF avec tous les détails, timestamps et concepts. Disponible à partir du plan Pro.',
            en: 'Download your analyses in PDF format with all details, timestamps and concepts. Available from the Pro plan.'
          },
          badge: { fr: 'Pro+', en: 'Pro+' }
        },
        {
          icon: FileText,
          title: { fr: 'Copier en Markdown', en: 'Copy as Markdown' },
          description: {
            fr: 'Copiez le résumé au format Markdown pour l\'intégrer facilement dans vos notes (Notion, Obsidian, etc.). Disponible dès le plan Étudiant.',
            en: 'Copy the summary in Markdown format to easily integrate it into your notes (Notion, Obsidian, etc.). Available from the Student plan.'
          },
          badge: { fr: 'Étudiant+', en: 'Student+' }
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
      title: { fr: 'Historique et découverte', en: 'History and Discovery' },
      color: 'slate',
      items: [
        {
          icon: History,
          title: { fr: 'Historique des analyses', en: 'Analysis History' },
          description: {
            fr: 'Retrouvez toutes vos analyses passées dans l\'onglet Historique. Recherchez, filtrez et ré-accédez à vos résumés à tout moment. La durée de rétention dépend de votre plan.',
            en: 'Find all your past analyses in the History tab. Search, filter and re-access your summaries at any time. Retention duration depends on your plan.'
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
            fr: 'Utilisez la fonction Découverte pour trouver des vidéos pertinentes sur un sujet. Deep Sight suggère du contenu de qualité classé par pertinence académique. Gratuit et sans crédits !',
            en: 'Use the Discovery feature to find relevant videos on a topic. Deep Sight suggests quality content ranked by academic relevance. Free and no credits needed!'
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

  // Normaliser le plan user vers les vrais plans (gère student→etudiant, team→equipe, etc.)
  const planId: PlanId = normalizePlanId(user?.plan);
  const planInfo = PLANS_INFO[planId];
  const limits = PLAN_LIMITS[planId];
  const features = PLAN_FEATURES[planId];

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
                <span>{planInfo.icon === 'GraduationCap' ? '🎓' : planInfo.icon === 'Crown' ? '👑' : planInfo.icon === 'Users' ? '👥' : '⚡'}</span>
                <span>{language === 'fr' ? planInfo.name : planInfo.nameEn}</span>
              </div>
              {planInfo.priceMonthly > 0 && (
                <div className="text-sm text-text-secondary mt-0.5">
                  {(planInfo.priceMonthly / 100).toFixed(2)}€/{language === 'fr' ? 'mois' : 'month'}
                </div>
              )}
              {user?.email && <div className="text-xs text-text-muted mt-1">{user.email}</div>}
            </div>
            <button onClick={() => navigate('/upgrade')} className="btn btn-primary flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {language === 'fr' ? 'Gérer l\'abonnement' : 'Manage subscription'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid — Données réelles depuis planPrivileges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={TrendingUp}
            title={language === 'fr' ? 'Analyses/mois' : 'Analyses/month'}
            value={user?.analysis_count ?? 0}
            subtitle={`/ ${formatNumber(limits.monthlyAnalyses, language)} ${language === 'fr' ? 'max' : 'max'}`}
            color="blue"
            progress={user?.analysis_count ?? 0}
            maxValue={limits.monthlyAnalyses === -1 ? 1000 : limits.monthlyAnalyses}
          />
          <StatCard
            icon={MessageSquare}
            title={language === 'fr' ? 'Chat IA/jour' : 'AI Chat/day'}
            value={limits.chatDailyLimit === -1 ? '∞' : limits.chatDailyLimit}
            subtitle={`${limits.chatQuestionsPerVideo === -1 ? '∞' : limits.chatQuestionsPerVideo} ${language === 'fr' ? 'par vidéo' : 'per video'}`}
            color="purple"
          />
          <StatCard
            icon={Globe}
            title={language === 'fr' ? 'Recherche web' : 'Web search'}
            value={limits.webSearchEnabled ? (limits.webSearchMonthly === -1 ? '∞' : formatNumber(limits.webSearchMonthly, language)) : (language === 'fr' ? 'Non' : 'No')}
            subtitle={limits.webSearchEnabled ? (language === 'fr' ? 'Perplexity AI' : 'Perplexity AI') : (language === 'fr' ? `Plan Starter requis` : 'Starter plan required')}
            color={limits.webSearchEnabled ? 'amber' : 'rose'}
          />
          <StatCard
            icon={Clock}
            title={language === 'fr' ? 'Durée max vidéo' : 'Max video length'}
            value={limits.maxVideoLengthMin === -1 ? '∞' : `${limits.maxVideoLengthMin} min`}
            subtitle={limits.historyRetentionDays === -1 ? (language === 'fr' ? 'Historique permanent' : 'Permanent history') : `${limits.historyRetentionDays}j ${language === 'fr' ? 'd\'historique' : 'history'}`}
            color="green"
          />
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
            <div className="aspect-video bg-gradient-to-br from-bg-tertiary to-bg-secondary relative flex items-center justify-center">
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

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* ✅ FONCTIONNALITÉS DE VOTRE PLAN — depuis planPrivileges.ts */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-primary" />
            {language === 'fr' ? 'Fonctionnalités de votre plan' : 'Your plan features'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureItem enabled={features.flashcards} label={language === 'fr' ? 'Flashcards automatiques' : 'Auto flashcards'} />
            <FeatureItem enabled={features.mindmap} label={language === 'fr' ? 'Cartes conceptuelles' : 'Mind maps'} />
            <FeatureItem enabled={features.webSearch} label={language === 'fr' ? 'Fact-checking Perplexity' : 'Perplexity fact-checking'} />
            <FeatureItem enabled={features.playlists} label={language === 'fr' ? 'Analyse de playlists' : 'Playlist analysis'} />
            <FeatureItem enabled={features.exportPdf} label={language === 'fr' ? 'Export PDF' : 'PDF export'} />
            <FeatureItem enabled={features.exportMarkdown} label={language === 'fr' ? 'Export Markdown' : 'Markdown export'} />
            <FeatureItem enabled={features.ttsAudio} label={language === 'fr' ? 'Lecture audio (TTS)' : 'Audio playback (TTS)'} />
            <FeatureItem enabled={features.apiAccess} label={language === 'fr' ? 'Accès API' : 'API access'} />
            <FeatureItem enabled={features.prioritySupport} label={language === 'fr' ? 'Support prioritaire' : 'Priority support'} />
            <FeatureItem enabled={limits.concurrentAnalyses > 1} label={language === 'fr' ? `Analyses simultanées (${limits.concurrentAnalyses})` : `Concurrent analyses (${limits.concurrentAnalyses})`} />
          </div>

          {planId === 'free' && (
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
