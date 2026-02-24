/**
 * UpgradePage v5.0 — Dynamique depuis l'API
 *
 * Fetch GET /api/billing/plans?platform=web au mount.
 * Fallback sur planPrivileges.ts en cas d'erreur.
 * Rien n'est hardcodé : tout vient de l'API.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, Sparkles, Zap, Crown,
  ArrowUp, ArrowDown, AlertCircle, RefreshCw,
  BookOpen, ChevronDown, ChevronUp, Lock,
  Infinity as InfinityIcon, GraduationCap, Users, Star,
  Gift, Clock,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { DeepSightSpinnerMicro } from '../components/ui';
import { billingApi, type ApiBillingPlan } from '../services/api';
import { SEO } from '../components/SEO';
import {
  PLANS_INFO as FALLBACK_PLANS_INFO,
  PLAN_LIMITS as FALLBACK_PLAN_LIMITS,
  PLAN_HIERARCHY,
  type PlanId,
} from '../config/planPrivileges';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_ICON_MAP: Record<string, React.ElementType> = {
  free: Zap,
  etudiant: Star,
  student: Star,
  starter: GraduationCap,
  pro: Crown,
};

const PLAN_GRADIENT_MAP: Record<string, string> = {
  free: 'from-gray-500 to-gray-600',
  etudiant: 'from-emerald-500 to-green-600',
  student: 'from-emerald-500 to-green-600',
  starter: 'from-blue-500 to-blue-600',
  pro: 'from-violet-500 to-purple-600',
};

function formatPriceFr(cents: number): string {
  if (cents === 0) return '0';
  const euros = cents / 100;
  return euros.toFixed(2).replace('.', ',');
}

function getPlanIcon(planId: string): React.ElementType {
  return PLAN_ICON_MAP[planId] || Zap;
}

function getPlanGradient(planId: string): string {
  return PLAN_GRADIENT_MAP[planId] || 'from-gray-500 to-gray-600';
}

/** Build fallback plans from planPrivileges.ts when API is unavailable */
function buildFallbackPlans(currentUserPlan: string): ApiBillingPlan[] {
  return PLAN_HIERARCHY.map((pid) => {
    const info = FALLBACK_PLANS_INFO[pid];
    const limits = FALLBACK_PLAN_LIMITS[pid];
    const currentIdx = PLAN_HIERARCHY.indexOf(currentUserPlan as PlanId);
    const thisIdx = PLAN_HIERARCHY.indexOf(pid);

    const featuresDisplay: { text: string; icon: string; highlight?: boolean }[] = [];
    featuresDisplay.push({ text: `${limits.monthlyAnalyses === -1 ? '∞' : limits.monthlyAnalyses} analyses/mois`, icon: '📊' });
    featuresDisplay.push({ text: `Vidéos ${limits.maxVideoLengthMin === -1 ? 'illimitées' : `≤ ${limits.maxVideoLengthMin} min`}`, icon: '⏱️' });
    featuresDisplay.push({
      text: limits.chatQuestionsPerVideo === -1 ? 'Chat illimité' : `Chat (${limits.chatQuestionsPerVideo} q/vidéo)`,
      icon: '💬',
    });
    if (limits.flashcardsEnabled) featuresDisplay.push({ text: 'Flashcards & Cartes mentales', icon: '🧠', highlight: pid === 'etudiant' });
    if (limits.playlistsEnabled) featuresDisplay.push({ text: `Playlists (${limits.maxPlaylistVideos} vidéos)`, icon: '📚', highlight: true });
    if (limits.webSearchMonthly > 0 || limits.webSearchMonthly === -1) {
      featuresDisplay.push({
        text: limits.webSearchMonthly === -1 ? 'Recherche web ∞' : `Recherche web (${limits.webSearchMonthly}/mois)`,
        icon: '🔍',
        highlight: limits.webSearchMonthly >= 100,
      });
    }
    if (limits.exportPdf) featuresDisplay.push({ text: 'Export PDF', icon: '📄' });

    return {
      id: pid,
      name: info.name,
      name_en: info.nameEn,
      description: info.description,
      description_en: info.descriptionEn,
      price_monthly_cents: info.priceMonthly,
      color: info.color,
      icon: info.icon,
      badge: info.badge ? { text: info.badge.text, color: info.badge.color } : null,
      popular: info.popular,
      limits: limits as unknown as Record<string, unknown>,
      platform_features: {},
      features_display: featuresDisplay,
      features_locked: [],
      is_current: currentIdx >= 0 && thisIdx === currentIdx,
      is_upgrade: currentIdx >= 0 && thisIdx > currentIdx,
      is_downgrade: currentIdx >= 0 && thisIdx < currentIdx,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

const SkeletonCard: React.FC = () => (
  <div className="card p-4 animate-pulse">
    <div className="w-12 h-12 rounded-xl bg-white/5 mb-4" />
    <div className="h-5 w-24 bg-white/5 rounded mb-2" />
    <div className="h-3 w-36 bg-white/5 rounded mb-4" />
    <div className="h-8 w-20 bg-white/5 rounded mb-4" />
    <div className="space-y-2 mb-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-white/5" />
          <div className="h-3 flex-1 bg-white/5 rounded" />
        </div>
      ))}
    </div>
    <div className="h-11 w-full bg-white/5 rounded-xl" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface PlanCardProps {
  plan: ApiBillingPlan;
  lang: 'fr' | 'en';
  loading: string | null;
  onSelect: (plan: ApiBillingPlan) => void;
  trialEligible: boolean;
  trialLoading: boolean;
  onStartTrial: () => void;
  allPlans: ApiBillingPlan[];
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan, lang, loading, onSelect, trialEligible, trialLoading, onStartTrial, allPlans,
}) => {
  const Icon = getPlanIcon(plan.id);
  const gradient = getPlanGradient(plan.id);
  const isCurrent = plan.is_current;
  const isUpgrade = plan.is_upgrade;
  const isDowngrade = plan.is_downgrade;
  const isFree = plan.price_monthly_cents === 0;
  const nameDisplay = lang === 'fr' ? plan.name : plan.name_en;
  const priceDisplay = formatPriceFr(plan.price_monthly_cents);

  // Find unlock plan names for features_locked
  const getUnlockPlanName = (unlockPlanId: string) => {
    const p = allPlans.find((pl) => pl.id === unlockPlanId);
    if (!p) return unlockPlanId;
    return lang === 'fr' ? p.name : p.name_en;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`card relative overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex flex-col ${
        isCurrent ? 'ring-2 ring-green-500/50' : ''
      } ${plan.popular ? 'ring-2 ring-violet-500/50 shadow-xl shadow-violet-500/10' : ''}`}
      style={plan.popular ? { animation: 'glow-pulse 3s ease-in-out infinite' } : undefined}
    >
      {/* Badge */}
      {plan.badge && !isCurrent && (
        <div className="absolute -top-0 -right-0 z-10">
          <div
            className="text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl"
            style={{ backgroundColor: plan.badge.color }}
          >
            {plan.badge.text}
          </div>
        </div>
      )}
      {plan.popular && !isCurrent && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
      )}
      {isCurrent && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-green-500/20 text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-2.5 h-2.5" />
            {lang === 'fr' ? 'Actuel' : 'Current'}
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4 pt-7 sm:pt-8 flex flex-col flex-1">
        {/* Icon & Name */}
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 sm:mb-4 shadow-lg`}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-0.5">{nameDisplay}</h3>
        <p className="text-xs text-text-tertiary mb-2 sm:mb-3">
          {lang === 'fr' ? plan.description : plan.description_en}
        </p>

        {/* Price */}
        <div className="mb-3 sm:mb-4">
          <span className="text-2xl sm:text-3xl font-bold text-text-primary">{priceDisplay}</span>
          <span className="text-text-tertiary text-xs sm:text-sm ml-1">
            €/{lang === 'fr' ? 'mois' : 'mo'}
          </span>
        </div>

        {/* Features Display */}
        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 flex-1">
          {plan.features_display.map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[11px] sm:text-xs">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                  feat.highlight ? 'bg-amber-500/20' : 'bg-green-500/20'
                }`}
              >
                <Check className={`w-2.5 h-2.5 ${feat.highlight ? 'text-amber-400' : 'text-green-400'}`} />
              </div>
              <span className={`${feat.highlight ? 'font-medium text-amber-300' : 'text-text-secondary'}`}>
                {feat.text}
              </span>
            </div>
          ))}

          {/* Features Locked */}
          {plan.features_locked.map((feat, idx) => (
            <div key={`locked-${idx}`} className="flex items-center gap-2 text-[11px] sm:text-xs">
              <div className="w-4 h-4 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-2.5 h-2.5 text-gray-500" />
              </div>
              <span className="text-text-muted">
                {feat.text}
                <span className="text-text-tertiary ml-1 text-[10px]">
                  — {lang === 'fr' ? 'Dès' : 'From'} {getUnlockPlanName(feat.unlock_plan)}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto">
          {trialEligible && plan.id === 'pro' && plan.is_upgrade ? (
            <button
              onClick={onStartTrial}
              disabled={trialLoading}
              className="w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-lg min-h-[44px] active:scale-95"
            >
              {trialLoading ? (
                <DeepSightSpinnerMicro />
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  {lang === 'fr' ? '7 jours gratuits' : '7-day free trial'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => onSelect(plan)}
              disabled={isCurrent || loading === plan.id || (isFree && isCurrent)}
              className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-95 ${
                isCurrent
                  ? 'bg-green-500/20 text-green-400 cursor-default'
                  : isUpgrade
                    ? `bg-gradient-to-r ${gradient} text-white hover:opacity-90 shadow-lg`
                    : isDowngrade
                      ? 'bg-transparent text-gray-400 hover:text-gray-300 border border-white/10'
                      : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              }`}
            >
              {loading === plan.id ? (
                <DeepSightSpinnerMicro />
              ) : isCurrent ? (
                <>
                  <Check className="w-4 h-4" />
                  {lang === 'fr' ? 'Plan actuel ✓' : 'Current plan ✓'}
                </>
              ) : isUpgrade ? (
                <>
                  <ArrowUp className="w-4 h-4" />
                  {lang === 'fr' ? `Choisir ${nameDisplay}` : `Choose ${nameDisplay}`}
                </>
              ) : isDowngrade ? (
                <>
                  <ArrowDown className="w-4 h-4" />
                  Downgrade
                </>
              ) : (
                lang === 'fr' ? 'Gratuit' : 'Free'
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON TABLE
// ═══════════════════════════════════════════════════════════════════════════════

interface ComparisonTableProps {
  plans: ApiBillingPlan[];
  lang: 'fr' | 'en';
  loading: string | null;
  onSelect: (plan: ApiBillingPlan) => void;
}

/** Build comparison rows from API plan limits */
interface ComparisonCategory {
  name: string;
  rows: { label: string; values: (string | boolean)[] }[];
}

function buildComparisonData(plans: ApiBillingPlan[], lang: 'fr' | 'en'): ComparisonCategory[] {
  const fmt = (v: unknown): string | boolean => {
    if (v === true) return true;
    if (v === false) return false;
    if (v === -1) return '∞';
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.join(', ');
    return String(v ?? '-');
  };

  const fmtMin = (v: unknown): string | boolean => {
    if (v === -1) return '∞';
    if (typeof v === 'number') {
      if (v >= 60) return `${Math.floor(v / 60)}h`;
      return `${v} min`;
    }
    return '-';
  };

  const categories: ComparisonCategory[] = [
    {
      name: lang === 'fr' ? '📊 Analyses' : '📊 Analyses',
      rows: [
        { label: lang === 'fr' ? 'Analyses/mois' : 'Analyses/month', values: plans.map(p => fmt(p.limits.monthly_analyses)) },
        { label: lang === 'fr' ? 'Durée max vidéo' : 'Max video length', values: plans.map(p => fmtMin(p.limits.max_video_length_min)) },
        { label: lang === 'fr' ? 'Analyses simultanées' : 'Concurrent analyses', values: plans.map(p => fmt(p.limits.concurrent_analyses)) },
        { label: lang === 'fr' ? 'File prioritaire' : 'Priority queue', values: plans.map(p => fmt(p.limits.priority_queue)) },
      ],
    },
    {
      name: lang === 'fr' ? '💬 Chat IA' : '💬 AI Chat',
      rows: [
        { label: lang === 'fr' ? 'Questions/vidéo' : 'Questions/video', values: plans.map(p => fmt(p.limits.chat_questions_per_video)) },
        { label: lang === 'fr' ? 'Messages/jour' : 'Messages/day', values: plans.map(p => fmt(p.limits.chat_daily_limit)) },
      ],
    },
    {
      name: lang === 'fr' ? '🎓 Outils d\'étude' : '🎓 Study tools',
      rows: [
        { label: 'Flashcards', values: plans.map(p => fmt(p.limits.flashcards_enabled)) },
        { label: lang === 'fr' ? 'Cartes mentales' : 'Mind maps', values: plans.map(p => fmt(p.limits.mindmap_enabled)) },
      ],
    },
    {
      name: lang === 'fr' ? '🔍 Recherche web' : '🔍 Web search',
      rows: [
        { label: lang === 'fr' ? 'Recherches/mois' : 'Searches/month', values: plans.map(p => fmt(p.limits.web_search_monthly)) },
      ],
    },
    {
      name: lang === 'fr' ? '📚 Playlists' : '📚 Playlists',
      rows: [
        { label: lang === 'fr' ? 'Playlists' : 'Playlists', values: plans.map(p => fmt(p.limits.playlists_enabled)) },
        { label: lang === 'fr' ? 'Vidéos/playlist' : 'Videos/playlist', values: plans.map(p => p.limits.playlists_enabled ? fmt(p.limits.max_playlist_videos) : false) },
      ],
    },
    {
      name: lang === 'fr' ? '📄 Export' : '📄 Export',
      rows: [
        { label: 'Markdown', values: plans.map(p => fmt(p.limits.export_markdown)) },
        { label: 'PDF', values: plans.map(p => fmt(p.limits.export_pdf)) },
      ],
    },
    {
      name: lang === 'fr' ? '🗂️ Historique' : '🗂️ History',
      rows: [
        {
          label: lang === 'fr' ? 'Rétention' : 'Retention',
          values: plans.map(p => {
            const d = p.limits.history_retention_days;
            if (d === -1) return '∞';
            return `${d} ${lang === 'fr' ? 'jours' : 'days'}`;
          }),
        },
      ],
    },
  ];

  return categories;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ plans, lang, loading, onSelect }) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const categories = useMemo(() => buildComparisonData(plans, lang), [plans, lang]);

  // Expand all categories by default
  useEffect(() => {
    setExpanded(categories.map((c) => c.name));
  }, [categories]);

  const toggleCategory = (name: string) => {
    setExpanded((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const renderCellValue = (value: string | boolean) => {
    if (value === true) return <Check className="w-5 h-5 text-green-400" />;
    if (value === false) return <X className="w-5 h-5 text-gray-500" />;
    if (value === '∞') return <InfinityIcon className="w-5 h-5 text-violet-400" />;
    if (value === '0') return <X className="w-5 h-5 text-gray-500" />;
    return <span className="text-sm text-text-secondary">{value}</span>;
  };

  const colCount = plans.length + 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="card overflow-hidden mb-12 overflow-x-auto"
    >
      {/* Header */}
      <div
        className="grid gap-2 p-4 bg-bg-secondary border-b border-border-primary min-w-[900px]"
        style={{ gridTemplateColumns: `1.5fr repeat(${plans.length}, 1fr)` }}
      >
        <div className="font-semibold text-text-secondary text-sm">
          {lang === 'fr' ? 'Fonctionnalités' : 'Features'}
        </div>
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.id);
          const gradient = getPlanGradient(plan.id);
          return (
            <div
              key={plan.id}
              className={`text-center ${plan.is_current ? 'bg-green-500/5 -mx-1 px-1 py-2 rounded-lg' : ''} ${plan.popular ? 'bg-violet-500/5 -mx-1 px-1 py-2 rounded-lg' : ''}`}
            >
              <div className={`inline-flex w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} items-center justify-center mb-1 shadow-lg`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="font-bold text-text-primary text-xs">{lang === 'fr' ? plan.name : plan.name_en}</div>
              <div className="text-[10px] text-text-tertiary">
                {plan.price_monthly_cents === 0 ? '0€' : `${formatPriceFr(plan.price_monthly_cents)}€`}
              </div>
              {plan.is_current && (
                <div className="text-[10px] text-green-400 mt-1 flex items-center justify-center gap-1">
                  <Check className="w-2.5 h-2.5" /> {lang === 'fr' ? 'Actuel' : 'Current'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Categories */}
      {categories.map((cat) => (
        <div key={cat.name} className="border-b border-border-primary last:border-b-0 min-w-[900px]">
          <button
            onClick={() => toggleCategory(cat.name)}
            className="w-full p-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors flex items-center gap-2"
          >
            <span className="font-semibold text-text-primary text-sm">{cat.name}</span>
            {expanded.includes(cat.name) ? (
              <ChevronUp className="w-4 h-4 text-text-tertiary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            )}
          </button>

          <AnimatePresence>
            {expanded.includes(cat.name) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-border-primary/30">
                  {cat.rows.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid gap-2 p-3 hover:bg-bg-tertiary/30 transition-colors"
                      style={{ gridTemplateColumns: `1.5fr repeat(${plans.length}, 1fr)` }}
                    >
                      <div className="text-xs text-text-secondary flex items-center">{row.label}</div>
                      {row.values.map((val, vi) => (
                        <div
                          key={vi}
                          className={`flex justify-center items-center ${plans[vi]?.is_current ? 'bg-green-500/5 -mx-1 px-1 rounded' : ''}`}
                        >
                          {renderCellValue(val)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* CTA Row */}
      <div
        className="grid gap-2 p-4 bg-bg-secondary min-w-[900px]"
        style={{ gridTemplateColumns: `1.5fr repeat(${plans.length}, 1fr)` }}
      >
        <div />
        {plans.map((plan) => {
          const gradient = getPlanGradient(plan.id);
          return (
            <div key={plan.id} className="flex justify-center">
              <button
                onClick={() => onSelect(plan)}
                disabled={plan.is_current || loading === plan.id || (plan.price_monthly_cents === 0 && plan.is_current)}
                className={`px-3 py-1.5 rounded-lg font-medium text-[10px] transition-all ${
                  plan.is_current
                    ? 'bg-green-500/20 text-green-400'
                    : plan.is_upgrade
                      ? `bg-gradient-to-r ${gradient} text-white hover:opacity-90 shadow-lg`
                      : plan.is_downgrade
                        ? 'bg-bg-tertiary text-text-muted'
                        : 'bg-bg-tertiary text-text-muted'
                }`}
              >
                {loading === plan.id ? (
                  <DeepSightSpinnerMicro />
                ) : plan.is_current ? (
                  lang === 'fr' ? 'Actuel' : 'Current'
                ) : plan.is_upgrade ? (
                  lang === 'fr' ? 'Choisir' : 'Select'
                ) : plan.is_downgrade ? (
                  'Downgrade'
                ) : (
                  '-'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNGRADE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface DowngradeModalProps {
  plan: ApiBillingPlan;
  currentPlan: ApiBillingPlan | undefined;
  lang: 'fr' | 'en';
  onConfirm: () => void;
  onCancel: () => void;
}

const DowngradeModal: React.FC<DowngradeModalProps> = ({ plan, currentPlan, lang, onConfirm, onCancel }) => {
  // Show features lost: features in current plan's display that are NOT in the target plan
  const currentFeatures = currentPlan?.features_display.map((f) => f.text) ?? [];
  const targetFeatures = new Set(plan.features_display.map((f) => f.text));
  const lostFeatures = currentFeatures.filter((f) => !targetFeatures.has(f));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="card p-4 sm:p-6 w-full sm:max-w-md shadow-2xl rounded-t-2xl sm:rounded-2xl"
      >
        <h3 className="text-base sm:text-lg font-bold text-text-primary mb-2 sm:mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          {lang === 'fr' ? 'Confirmer le downgrade' : 'Confirm downgrade'}
        </h3>
        <p className="text-text-secondary text-xs sm:text-sm mb-3">
          {lang === 'fr'
            ? `Passer au plan ${plan.name} ? Vos avantages actuels restent actifs jusqu'à la fin de la période.`
            : `Switch to ${plan.name_en}? Current benefits stay active until period end.`}
        </p>

        {lostFeatures.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs font-semibold text-red-400 mb-2">
              {lang === 'fr' ? 'Vous perdrez :' : 'You will lose:'}
            </p>
            <ul className="space-y-1">
              {lostFeatures.map((f, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-red-300">
                  <X className="w-3 h-3 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          <button onClick={onCancel} className="btn-secondary min-h-[44px] active:scale-95">
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors min-h-[44px] active:scale-95"
          >
            {lang === 'fr' ? 'Confirmer le downgrade' : 'Confirm downgrade'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
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
  const { language } = useTranslation();
  const lang = (language as 'fr' | 'en') || 'fr';

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plans, setPlans] = useState<ApiBillingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<ApiBillingPlan | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [trialEligible, setTrialEligible] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);

  const currentPlan = useMemo(() => plans.find((p) => p.is_current), [plans]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setPlansLoading(true);
      try {
        await refreshUser(true);

        // Load plans from API
        const [plansResponse, statusResponse] = await Promise.allSettled([
          billingApi.getPlans('web'),
          billingApi.getSubscriptionStatus(),
        ]);

        if (plansResponse.status === 'fulfilled' && plansResponse.value.plans?.length) {
          setPlans(plansResponse.value.plans);
        } else {
          // Fallback to planPrivileges.ts
          const userPlan = user?.plan || 'free';
          setPlans(buildFallbackPlans(userPlan));
        }

        if (statusResponse.status === 'fulfilled') {
          setSubscriptionStatus(statusResponse.value);
        }

        // Check trial eligibility
        try {
          const eligibility = await billingApi.checkTrialEligibility();
          setTrialEligible(eligibility.eligible);
        } catch {
          // Trial eligibility check not available
        }
      } catch (err) {
        console.error('Error loading plans:', err);
        const userPlan = user?.plan || 'free';
        setPlans(buildFallbackPlans(userPlan));
      } finally {
        setPlansLoading(false);
      }
    };
    load();
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleStartTrial = async () => {
    setTrialLoading(true);
    setError(null);
    try {
      const result = await billingApi.startProTrial();
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err: any) {
      setError(err?.message || (lang === 'fr' ? 'Erreur lors du démarrage de l\'essai' : 'Error starting trial'));
    } finally {
      setTrialLoading(false);
    }
  };

  const handleSelectPlan = (plan: ApiBillingPlan) => {
    if (plan.is_current || (plan.price_monthly_cents === 0 && plan.is_current)) return;

    if (plan.is_downgrade) {
      setDowngradeTarget(plan);
      return;
    }

    executePlanChange(plan);
  };

  const executePlanChange = async (plan: ApiBillingPlan) => {
    setLoading(plan.id);
    setError(null);
    setSuccess(null);
    setDowngradeTarget(null);

    try {
      if (plan.is_upgrade || (!currentPlan || currentPlan.price_monthly_cents === 0)) {
        // Upgrade → Stripe checkout
        const result = await billingApi.createCheckout(plan.id);
        if (result.checkout_url) {
          window.location.href = result.checkout_url;
          return;
        }
      } else {
        // Downgrade → portal or changePlan
        const result = await billingApi.changePlan(plan.id);
        if (result.success) {
          setSuccess(
            lang === 'fr'
              ? 'Plan modifié ! Changement effectif au prochain renouvellement.'
              : 'Plan changed! Takes effect at next renewal.'
          );
          await refreshUser(true);
          // Reload plans to get updated is_current flags
          try {
            const plansResponse = await billingApi.getPlans('web');
            if (plansResponse.plans?.length) setPlans(plansResponse.plans);
          } catch {
            // ignore
          }
          const status = await billingApi.getSubscriptionStatus();
          setSubscriptionStatus(status);
        }
      }
    } catch (err: any) {
      setError(err?.message || (lang === 'fr' ? 'Erreur lors du changement' : 'Error changing plan'));
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !confirm(
        lang === 'fr'
          ? 'Êtes-vous sûr de vouloir annuler ? Vous garderez vos avantages jusqu\'à la fin de la période payée.'
          : 'Are you sure? You\'ll keep benefits until paid period ends.'
      )
    )
      return;

    setLoading('cancel');
    try {
      await billingApi.cancelSubscription();
      setSuccess(
        lang === 'fr'
          ? 'Abonnement annulé. Accès maintenu jusqu\'à la fin de la période.'
          : 'Subscription cancelled. Access kept until period end.'
      );
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title="Tarifs"
        description="Découvrez les plans Deep Sight : Gratuit, Starter, Étudiant, Pro. Analysez vos vidéos YouTube avec l'IA."
        path="/upgrade"
      />
      <DoodleBackground variant="creative" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <header className="text-center mb-8 sm:mb-10">
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-semibold text-2xl sm:text-3xl md:text-4xl text-text-primary mb-2 sm:mb-3 px-2"
              >
                {lang === 'fr' ? 'Choisissez votre plan' : 'Choose your plan'}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto px-4"
              >
                {lang === 'fr'
                  ? 'Débloquez des fonctionnalités puissantes pour analyser le contenu vidéo.'
                  : 'Unlock powerful features to analyze video content.'}
              </motion.p>
            </header>

            {/* Alerts */}
            {subscriptionStatus?.cancel_at_period_end && (
              <div className="card p-3 sm:p-4 mb-4 sm:mb-6 border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />
                  <span className="text-amber-300 text-xs sm:text-sm">
                    {lang === 'fr'
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
                  className="text-xs sm:text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-amber-500/10 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  {lang === 'fr' ? 'Réactiver' : 'Reactivate'}
                </button>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-3 sm:p-4 mb-4 sm:mb-6 border-red-500/30 bg-red-500/10 text-red-300 text-xs sm:text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-3 sm:p-4 mb-4 sm:mb-6 border-green-500/30 bg-green-500/10 text-green-300 text-xs sm:text-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4 flex-shrink-0" /> {success}
              </motion.div>
            )}

            {/* Pro Trial Banner */}
            {trialEligible && currentPlan?.price_monthly_cents === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 sm:p-6 mb-6 sm:mb-8 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-violet-500/30 overflow-hidden relative"
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl hidden sm:block" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-500/20 rounded-full blur-3xl hidden sm:block" />
                <div className="relative flex flex-col items-center gap-4 sm:gap-6 md:flex-row">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
                      <Gift className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
                      <Sparkles className="w-3 h-3" />
                      {lang === 'fr' ? 'Offre limitée' : 'Limited offer'}
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold text-text-primary mb-2">
                      {lang === 'fr' ? 'Essayez Pro gratuitement pendant 7 jours' : 'Try Pro free for 7 days'}
                    </h2>
                    <p className="text-text-secondary text-xs sm:text-base mb-4 max-w-xl">
                      {lang === 'fr'
                        ? 'Accédez à toutes les fonctionnalités Pro. Sans engagement.'
                        : 'Access all Pro features. No commitment.'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 justify-center md:justify-start">
                      {[
                        { icon: Crown, text: lang === 'fr' ? '200 analyses' : '200 analyses' },
                        { icon: InfinityIcon, text: lang === 'fr' ? 'Chat illimité' : 'Unlimited chat' },
                        { icon: Clock, text: lang === 'fr' ? '7 jours gratuits' : '7 days free' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-bg-tertiary/50 text-text-secondary text-[10px] sm:text-xs">
                          <item.icon className="w-3 h-3 text-violet-400" />
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-full md:w-auto">
                    <button
                      onClick={handleStartTrial}
                      disabled={trialLoading}
                      className="w-full md:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm sm:text-lg shadow-xl shadow-violet-500/30 hover:opacity-90 transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-95"
                    >
                      {trialLoading ? (
                        <DeepSightSpinnerMicro />
                      ) : (
                        <>
                          <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
                          {lang === 'fr' ? 'Commencer l\'essai' : 'Start free trial'}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-text-tertiary mt-2 text-center">
                      {lang === 'fr' ? 'Annulez à tout moment' : 'Cancel anytime'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* View Toggle */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="inline-flex bg-bg-tertiary rounded-xl p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[44px] active:scale-95 ${
                    viewMode === 'cards'
                      ? 'bg-accent-primary text-white shadow-lg'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {lang === 'fr' ? '🃏 Cartes' : '🃏 Cards'}
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[44px] active:scale-95 hidden sm:block ${
                    viewMode === 'table'
                      ? 'bg-accent-primary text-white shadow-lg'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {lang === 'fr' ? '📊 Comparaison' : '📊 Comparison'}
                </button>
              </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {viewMode === 'cards' ? (
                <motion.div
                  key="cards"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Plan Cards */}
                  {plansLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 sm:mb-12">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <SkeletonCard key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 sm:mb-12">
                      {plans.map((plan, idx) => (
                        <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08, duration: 0.4 }}
                        >
                          <PlanCard
                            plan={plan}
                            lang={lang}
                            loading={loading}
                            onSelect={handleSelectPlan}
                            trialEligible={trialEligible}
                            trialLoading={trialLoading}
                            onStartTrial={handleStartTrial}
                            allPlans={plans}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  {!plansLoading && (
                    <ComparisonTable
                      plans={plans}
                      lang={lang}
                      loading={loading}
                      onSelect={handleSelectPlan}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cancel subscription */}
            {currentPlan && currentPlan.price_monthly_cents > 0 && !subscriptionStatus?.cancel_at_period_end && (
              <div className="text-center mb-6 sm:mb-8">
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading === 'cancel'}
                  className="text-xs sm:text-sm text-text-tertiary hover:text-red-400 transition-colors flex items-center gap-2 mx-auto min-h-[44px] px-4 py-2 active:scale-95"
                >
                  {loading === 'cancel' && <DeepSightSpinnerMicro />}
                  {lang === 'fr' ? 'Annuler mon abonnement' : 'Cancel subscription'}
                </button>
              </div>
            )}

            {/* FAQ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="card p-4 sm:p-6 mb-6 sm:mb-8"
            >
              <h3 className="font-bold text-base sm:text-lg text-text-primary mb-4 sm:mb-5 flex items-center gap-2">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-accent-primary" />
                {lang === 'fr' ? 'Questions fréquentes' : 'FAQ'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{lang === 'fr' ? "Comment fonctionne l'essai gratuit ?" : 'How does the free trial work?'}</p>
                  <p className="text-text-secondary">{lang === 'fr' ? '7 jours Pro gratuits. Annulez à tout moment.' : '7 days Pro free. Cancel anytime.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{lang === 'fr' ? "Comment fonctionne l'upgrade ?" : 'How does upgrade work?'}</p>
                  <p className="text-text-secondary">{lang === 'fr' ? 'Vous êtes facturé la différence au prorata. Nouveaux avantages instantanés.' : 'You pay the prorated difference. New benefits are instant.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{lang === 'fr' ? 'Puis-je annuler ?' : 'Can I cancel?'}</p>
                  <p className="text-text-secondary">{lang === 'fr' ? "Oui, à tout moment. Accès maintenu jusqu'à fin de période payée." : 'Yes, anytime. Access kept until paid period ends.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{lang === 'fr' ? 'Moyens de paiement ?' : 'Payment methods?'}</p>
                  <p className="text-text-secondary">{lang === 'fr' ? 'Toutes cartes bancaires via Stripe. Paiements sécurisés.' : 'All cards via Stripe. Secure payments.'}</p>
                </div>
              </div>
            </motion.div>

            {/* Contact */}
            <div className="text-center text-xs sm:text-sm text-text-tertiary pb-4">
              {lang === 'fr' ? 'Questions ? ' : 'Questions? '}
              <a href="mailto:contact@deepsightsynthesis.com" className="text-accent-primary hover:underline">
                contact@deepsightsynthesis.com
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Downgrade Confirmation Modal */}
      <AnimatePresence>
        {downgradeTarget && (
          <DowngradeModal
            plan={downgradeTarget}
            currentPlan={currentPlan}
            lang={lang}
            onConfirm={() => executePlanChange(downgradeTarget)}
            onCancel={() => setDowngradeTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Glow pulse animation for popular plan */}
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.15); }
          50% { box-shadow: 0 0 30px rgba(139, 92, 246, 0.3); }
        }
      `}</style>
    </div>
  );
};

export default UpgradePage;
