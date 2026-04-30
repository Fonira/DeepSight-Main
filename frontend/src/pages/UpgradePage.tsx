/**
 * UpgradePage v10.0 — Editorial Premium (avril 2026)
 *
 * Refonte design : hierarchie visuelle Free 95% / Pro 100% / Expert 108%,
 * glow violet anime sur Expert, trust signals inline, section ROI,
 * temoignages, FAQ accordeon, B2B contact.
 *
 * Logique metier conservee : Stripe checkout, trial 7j, grandfathering legacy,
 * downgrade modal, cancel subscription, refresh user, analytics PostHog.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Lock,
  Star,
  Gift,
  Shield,
  ShieldCheck,
  Lock as LockIcon,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { DeepSightSpinnerMicro } from "../components/ui";
import {
  billingApi,
  type ApiBillingPlan,
  type BillingCycle,
} from "../services/api";
import { BillingToggle } from "../components/pricing/BillingToggle";
import { ComparisonTable as ComparisonTableV2 } from "../components/pricing/ComparisonTable";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import { ProductJsonLd } from "../components/ProductJsonLd";
import { analytics } from "../services/analytics";
import {
  PLANS_INFO as FALLBACK_PLANS_INFO,
  PLAN_LIMITS as FALLBACK_PLAN_LIMITS,
  PLAN_HIERARCHY,
  DIFFERENTIATORS,
  TESTIMONIALS,
  type PlanId,
} from "../config/planPrivileges";

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTES VISUELLES
// ═════════════════════════════════════════════════════════════════════════════

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap,
  pro: Star,
  expert: Crown,
};

const PLAN_GRADIENTS: Record<string, string> = {
  free: "from-slate-500 to-slate-600",
  pro: "from-blue-500 to-indigo-600",
  expert: "from-violet-500 via-fuchsia-500 to-purple-600",
};

const PLAN_RING: Record<string, string> = {
  free: "ring-1 ring-white/[0.06]",
  pro: "ring-1 ring-blue-500/40",
  expert: "ring-2 ring-violet-500/60",
};

const PLAN_TAGLINES_FR: Record<string, string> = {
  free: "Pour decouvrir",
  pro: "Pour apprendre serieusement",
  expert: "Pour les createurs et chercheurs",
};

const PLAN_TAGLINES_EN: Record<string, string> = {
  free: "To discover",
  pro: "For serious learners",
  expert: "For creators & researchers",
};

const ease = [0.22, 1, 0.36, 1] as const;

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function formatEuro(cents: number): string {
  if (cents === 0) return "0";
  const euros = cents / 100;
  return euros.toFixed(2).replace(".", ",");
}

function getCyclePrice(plan: ApiBillingPlan, cycle: BillingCycle): number {
  return cycle === "yearly"
    ? plan.price_yearly_cents
    : plan.price_monthly_cents;
}

function getMonthlyEquivalent(
  plan: ApiBillingPlan,
  cycle: BillingCycle,
): number {
  if (cycle === "yearly") return plan.price_yearly_cents / 12;
  return plan.price_monthly_cents;
}

function getYearlySavings(plan: ApiBillingPlan): number {
  const monthlyTotal = plan.price_monthly_cents * 12;
  return Math.max(0, monthlyTotal - plan.price_yearly_cents);
}

function limitsToSnakeCase(
  limits: (typeof FALLBACK_PLAN_LIMITS)[PlanId],
): Record<string, unknown> {
  return {
    monthly_analyses: limits.monthlyAnalyses,
    max_video_length_min: limits.maxVideoLengthMin,
    concurrent_analyses: limits.concurrentAnalyses,
    priority_queue: limits.priorityQueue,
    chat_questions_per_video: limits.chatQuestionsPerVideo,
    chat_daily_limit: limits.chatDailyLimit,
    flashcards_enabled: limits.flashcardsEnabled,
    mindmap_enabled: limits.mindmapEnabled,
    web_search_enabled: limits.webSearchEnabled,
    web_search_monthly: limits.webSearchMonthly,
    playlists_enabled: limits.playlistsEnabled,
    max_playlists: limits.maxPlaylists,
    max_playlist_videos: limits.maxPlaylistVideos,
    export_formats: limits.exportFormats,
    export_markdown: limits.exportMarkdown,
    export_pdf: limits.exportPdf,
    history_retention_days: limits.historyRetentionDays,
    allowed_models: limits.allowedModels,
    default_model: limits.defaultModel,
    academic_search: limits.academicSearch,
    academic_papers_per_analysis: limits.academicPapersPerAnalysis,
    bibliography_export: limits.bibliographyExport,
    voice_chat_enabled: limits.voiceChatEnabled,
    voice_monthly_minutes: limits.voiceChatMonthlyMinutes,
    debate_enabled: limits.debateEnabled,
    debate_monthly: limits.debateMonthly,
    deep_research_enabled: limits.deepResearchEnabled,
    factcheck_enabled: limits.factcheckEnabled,
    tts_enabled: limits.ttsEnabled,
  };
}

function buildFallbackPlans(currentUserPlan: string): ApiBillingPlan[] {
  return PLAN_HIERARCHY.map((pid) => {
    const info = FALLBACK_PLANS_INFO[pid];
    const limits = FALLBACK_PLAN_LIMITS[pid];
    const currentIdx = PLAN_HIERARCHY.indexOf(currentUserPlan as PlanId);
    const thisIdx = PLAN_HIERARCHY.indexOf(pid);

    const featuresDisplay: {
      text: string;
      icon: string;
      highlight?: boolean;
    }[] = [];
    featuresDisplay.push({
      text: `${limits.monthlyAnalyses === -1 ? "∞" : limits.monthlyAnalyses} analyses / mois`,
      icon: "📊",
    });
    featuresDisplay.push({
      text:
        limits.maxVideoLengthMin === -1
          ? "Vidéos illimitées"
          : `Vidéos jusqu'à ${limits.maxVideoLengthMin >= 60 ? `${Math.round(limits.maxVideoLengthMin / 60)} h` : `${limits.maxVideoLengthMin} min`}`,
      icon: "⏱️",
    });
    featuresDisplay.push({
      text:
        limits.chatQuestionsPerVideo === -1
          ? "Chat IA illimité"
          : `Chat IA (${limits.chatQuestionsPerVideo} q/vidéo)`,
      icon: "💬",
      highlight: pid === "expert",
    });
    if (limits.mindmapEnabled)
      featuresDisplay.push({ text: "Cartes mentales", icon: "🧠" });
    if (limits.factcheckEnabled)
      featuresDisplay.push({
        text: "Fact-check automatique",
        icon: "🔍",
        highlight: pid === "pro",
      });
    if (limits.webSearchMonthly > 0 || limits.webSearchMonthly === -1) {
      featuresDisplay.push({
        text:
          limits.webSearchMonthly === -1
            ? "Recherche web illimitée"
            : `Recherche web (${limits.webSearchMonthly}/mois)`,
        icon: "🌐",
      });
    }
    if (limits.playlistsEnabled)
      featuresDisplay.push({
        text: `Playlists (${limits.maxPlaylists}×${limits.maxPlaylistVideos})`,
        icon: "📚",
        highlight: true,
      });
    if (limits.voiceChatEnabled)
      featuresDisplay.push({
        text: `Chat vocal (${limits.voiceChatMonthlyMinutes} min/mois)`,
        icon: "🎙️",
        highlight: true,
      });
    if (limits.deepResearchEnabled)
      featuresDisplay.push({
        text: "Deep Research + TTS",
        icon: "🔬",
        highlight: true,
      });
    if (limits.exportPdf)
      featuresDisplay.push({ text: "Export PDF + Markdown", icon: "📄" });
    if (limits.priorityQueue)
      featuresDisplay.push({ text: "File d'attente prioritaire", icon: "⚡" });

    return {
      id: pid,
      name: info.name,
      name_en: info.nameEn,
      description: info.description,
      description_en: info.descriptionEn,
      price_monthly_cents: info.priceMonthly,
      price_yearly_cents: info.priceYearly,
      voice_minutes: limits.voiceChatMonthlyMinutes,
      color: info.color,
      icon: info.icon,
      badge: info.badge
        ? { text: info.badge.text, color: info.badge.color }
        : null,
      popular: info.popular,
      limits: limitsToSnakeCase(limits),
      platform_features: {},
      features_display: featuresDisplay,
      features_locked: [],
      is_current: currentIdx >= 0 && thisIdx === currentIdx,
      is_upgrade: currentIdx >= 0 && thisIdx > currentIdx,
      is_downgrade: currentIdx >= 0 && thisIdx < currentIdx,
    };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═════════════════════════════════════════════════════════════════════════════

const TrustSignals: React.FC<{ lang: "fr" | "en" }> = ({ lang }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
    <span className="inline-flex items-center gap-1.5">
      <span className="text-base">🇫🇷</span>
      {lang === "fr" ? "IA française · Mistral" : "French AI · Mistral"}
    </span>
    <span className="opacity-30">·</span>
    <span className="inline-flex items-center gap-1.5">
      <Shield className="w-3.5 h-3.5 text-emerald-400" />
      {lang === "fr" ? "Données en Europe" : "Data in Europe"}
    </span>
    <span className="opacity-30">·</span>
    <span className="inline-flex items-center gap-1.5">
      <LockIcon className="w-3.5 h-3.5 text-blue-400" />
      {lang === "fr" ? "Paiements Stripe" : "Stripe payments"}
    </span>
    <span className="opacity-30">·</span>
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
      {lang === "fr" ? "Remboursement 14 jours" : "14-day refund"}
    </span>
  </div>
);

interface PlanCardProps {
  plan: ApiBillingPlan;
  cycle: BillingCycle;
  lang: "fr" | "en";
  loading: string | null;
  trialEligible: boolean;
  trialLoading: boolean;
  emphasis: "subdued" | "default" | "highlight";
  onSelect: (plan: ApiBillingPlan) => void;
  onStartTrial: (planId: "pro" | "expert") => void;
  allPlans: ApiBillingPlan[];
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  cycle,
  lang,
  loading,
  trialEligible,
  trialLoading,
  emphasis,
  onSelect,
  onStartTrial,
  allPlans,
}) => {
  const Icon = PLAN_ICONS[plan.id] ?? Zap;
  const gradient = PLAN_GRADIENTS[plan.id] ?? "from-slate-500 to-slate-600";
  const ring = PLAN_RING[plan.id] ?? "ring-1 ring-white/[0.06]";
  const isFree = plan.id === "free";
  const isExpert = plan.id === "expert";
  const isPro = plan.id === "pro";
  const isCurrent = plan.is_current;
  const cyclePrice = getCyclePrice(plan, cycle);
  const monthlyEquivalent = getMonthlyEquivalent(plan, cycle);
  const yearlySavings = getYearlySavings(plan);
  const tagline =
    lang === "fr" ? PLAN_TAGLINES_FR[plan.id] : PLAN_TAGLINES_EN[plan.id];
  const nameDisplay = lang === "fr" ? plan.name : plan.name_en;

  const showTrialPrimaryCTA =
    trialEligible && (isPro || isExpert) && plan.is_upgrade;
  const isLoadingThis = loading === plan.id;

  const getUnlockPlanName = (unlockPlanId: string) => {
    const p = allPlans.find((pl) => pl.id === unlockPlanId);
    if (!p) return unlockPlanId;
    return lang === "fr" ? p.name : p.name_en;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className={`relative ${
        emphasis === "highlight" ? "lg:scale-[1.04] lg:-mt-4" : ""
      } ${emphasis === "subdued" ? "lg:opacity-95" : ""}`}
    >
      {/* Glow background pour Expert */}
      {isExpert && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-purple-500/30 blur-2xl opacity-60"
          style={{ animation: "expert-glow 4s ease-in-out infinite" }}
        />
      )}

      <div
        className={`relative h-full flex flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl ${
          isCurrent ? "border-emerald-500/40" : "border-white/[0.08]"
        } ${ring} transition-all duration-300`}
      >
        {/* Top ribbon : badge ou trial banner */}
        {showTrialPrimaryCTA ? (
          <div
            className={`text-center text-[11px] font-bold tracking-wide py-2 text-white ${
              isExpert
                ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500"
                : "bg-gradient-to-r from-blue-500 to-cyan-500"
            }`}
          >
            <Gift className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            {lang === "fr"
              ? "ESSAI 7 JOURS GRATUIT · SANS CB"
              : "7-DAY FREE TRIAL · NO CARD"}
          </div>
        ) : isCurrent ? (
          <div className="text-center text-[11px] font-bold tracking-wide py-2 bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/20">
            <Check className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            {lang === "fr" ? "VOTRE PLAN ACTUEL" : "YOUR CURRENT PLAN"}
          </div>
        ) : plan.popular ? (
          <div className="text-center text-[11px] font-bold tracking-wide py-2 bg-blue-500/15 text-blue-300 border-b border-blue-500/20">
            <Sparkles className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            {lang === "fr" ? "LE PLUS POPULAIRE" : "MOST POPULAR"}
          </div>
        ) : isExpert ? (
          <div className="text-center text-[11px] font-bold tracking-wide py-2 bg-violet-500/15 text-violet-300 border-b border-violet-500/20">
            <Crown className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
            {lang === "fr"
              ? "RECOMMANDÉ CRÉATEURS"
              : "RECOMMENDED FOR CREATORS"}
          </div>
        ) : (
          <div className="h-[34px]" aria-hidden />
        )}

        <div className="p-6 sm:p-7 flex flex-col flex-1">
          {/* Icon + nom + tagline */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-text-primary leading-tight">
                {nameDisplay}
              </h3>
              <p className="text-[11px] text-text-tertiary leading-tight mt-0.5">
                {tagline}
              </p>
            </div>
          </div>

          {/* Prix */}
          <div className="mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold text-text-primary tabular-nums tracking-tight">
                {cyclePrice === 0 ? "0" : formatEuro(monthlyEquivalent)}
              </span>
              <span className="text-text-tertiary text-sm">
                €/{lang === "fr" ? "mois" : "mo"}
              </span>
            </div>
            {cycle === "yearly" && cyclePrice > 0 && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-text-tertiary">
                  {formatEuro(cyclePrice)} €/{lang === "fr" ? "an" : "yr"}
                </span>
                {yearlySavings > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {lang === "fr" ? "−" : "Save "}
                    {formatEuro(yearlySavings)} €
                  </span>
                )}
              </div>
            )}
            {cyclePrice === 0 && (
              <p className="text-xs text-text-tertiary mt-1">
                {lang === "fr" ? "Sans CB · à vie" : "No card · forever"}
              </p>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary mb-5 leading-relaxed">
            {lang === "fr" ? plan.description : plan.description_en}
          </p>

          {/* Features */}
          <ul className="space-y-2.5 mb-6 flex-1">
            {plan.features_display.map((feat, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2.5 text-[13px] leading-snug ${
                  feat.highlight ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                <span
                  className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    feat.highlight
                      ? isExpert
                        ? "bg-violet-500/20"
                        : "bg-blue-500/20"
                      : "bg-emerald-500/15"
                  }`}
                >
                  <Check
                    className={`w-2.5 h-2.5 ${
                      feat.highlight
                        ? isExpert
                          ? "text-violet-300"
                          : "text-blue-300"
                        : "text-emerald-400"
                    }`}
                    strokeWidth={3}
                  />
                </span>
                <span className={feat.highlight ? "font-medium" : ""}>
                  {feat.text}
                </span>
              </li>
            ))}
            {plan.features_locked.map((feat, idx) => (
              <li
                key={`locked-${idx}`}
                className="flex items-start gap-2.5 text-[13px] leading-snug text-text-muted"
              >
                <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-white/[0.04] flex items-center justify-center">
                  <Lock className="w-2.5 h-2.5 text-text-muted" />
                </span>
                <span>
                  {feat.text}
                  <span className="text-text-tertiary text-[11px] ml-1">
                    — {lang === "fr" ? "Dès" : "From"}{" "}
                    {getUnlockPlanName(feat.unlock_plan)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="space-y-2">
            {showTrialPrimaryCTA ? (
              <>
                <button
                  onClick={() => onStartTrial(plan.id as "pro" | "expert")}
                  disabled={trialLoading || isLoadingThis}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-[0.98] ${
                    isExpert
                      ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:opacity-95"
                      : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:opacity-95"
                  }`}
                >
                  {trialLoading ? (
                    <DeepSightSpinnerMicro onLight />
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      {lang === "fr"
                        ? "Commencer 7 jours gratuits"
                        : "Start 7-day free trial"}
                    </>
                  )}
                </button>
                <button
                  onClick={() => onSelect(plan)}
                  disabled={isLoadingThis}
                  className="w-full py-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors flex items-center justify-center gap-1"
                >
                  {isLoadingThis ? (
                    <DeepSightSpinnerMicro />
                  ) : lang === "fr" ? (
                    <>
                      ou souscrire directement <span aria-hidden>→</span>
                    </>
                  ) : (
                    <>
                      or subscribe directly <span aria-hidden>→</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => onSelect(plan)}
                disabled={isCurrent || isLoadingThis || (isFree && isCurrent)}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-[0.98] ${
                  isCurrent
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default"
                    : plan.is_upgrade
                      ? `bg-gradient-to-r ${gradient} text-white shadow-lg hover:opacity-95`
                      : plan.is_downgrade
                        ? "bg-white/[0.03] text-text-tertiary border border-white/[0.08] hover:bg-white/[0.06]"
                        : "bg-white/[0.04] text-text-secondary border border-white/[0.08] hover:bg-white/[0.07]"
                }`}
              >
                {isLoadingThis ? (
                  <DeepSightSpinnerMicro
                    onLight={plan.is_upgrade || isCurrent}
                  />
                ) : isCurrent ? (
                  <>
                    <Check className="w-4 h-4" />
                    {lang === "fr" ? "Plan actif" : "Active plan"}
                  </>
                ) : plan.is_upgrade ? (
                  <>
                    <ArrowUp className="w-4 h-4" />
                    {lang === "fr"
                      ? `Choisir ${nameDisplay}`
                      : `Choose ${nameDisplay}`}
                  </>
                ) : plan.is_downgrade ? (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    {lang === "fr"
                      ? `Repasser ${nameDisplay}`
                      : `Switch to ${nameDisplay}`}
                  </>
                ) : isFree ? (
                  lang === "fr" ? (
                    "Commencer gratuitement"
                  ) : (
                    "Start for free"
                  )
                ) : lang === "fr" ? (
                  "Choisir"
                ) : (
                  "Choose"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface DowngradeModalProps {
  plan: ApiBillingPlan;
  currentPlan: ApiBillingPlan | undefined;
  lang: "fr" | "en";
  onConfirm: () => void;
  onCancel: () => void;
}

const DowngradeModal: React.FC<DowngradeModalProps> = ({
  plan,
  currentPlan,
  lang,
  onConfirm,
  onCancel,
}) => {
  const currentFeatures =
    currentPlan?.features_display.map((f) => f.text) ?? [];
  const targetFeatures = new Set(plan.features_display.map((f) => f.text));
  const lostFeatures = currentFeatures.filter((f) => !targetFeatures.has(f));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-6 sm:p-7 shadow-2xl"
      >
        <h3 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          {lang === "fr" ? "Confirmer le changement" : "Confirm change"}
        </h3>
        <p className="text-text-secondary text-sm mb-4">
          {lang === "fr"
            ? `Passer au plan ${plan.name} ? Vos avantages actuels restent actifs jusqu'à la fin de la période payée.`
            : `Switch to ${plan.name_en}? Current benefits stay active until period end.`}
        </p>

        {lostFeatures.length > 0 && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-xs font-semibold text-red-400 mb-2">
              {lang === "fr" ? "Vous perdrez :" : "You will lose:"}
            </p>
            <ul className="space-y-1">
              {lostFeatures.map((f, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 text-xs text-red-200/90"
                >
                  <X className="w-3 h-3 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-3 rounded-xl text-sm font-medium text-text-secondary bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors min-h-[44px]"
          >
            {lang === "fr" ? "Annuler" : "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors min-h-[44px]"
          >
            {lang === "fr" ? "Confirmer" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface DifferentiatorsSectionProps {
  lang: "fr" | "en";
}

const DifferentiatorsSection: React.FC<DifferentiatorsSectionProps> = ({
  lang,
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <section ref={ref} className="py-16 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5, ease }}
        className="text-center mb-10"
      >
        <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 mb-4">
          {lang === "fr" ? "Pourquoi DeepSight" : "Why DeepSight"}
        </span>
        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
          {lang === "fr"
            ? "Plus qu'un résumeur. Une plateforme d'analyse."
            : "More than a summarizer. An analysis platform."}
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {DIFFERENTIATORS.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.4, delay: 0.05 * i, ease }}
            className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{d.icon}</span>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                {lang === "fr" ? d.tag.fr : d.tag.en}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-1.5">
              {lang === "fr" ? d.title.fr : d.title.en}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {lang === "fr" ? d.description.fr : d.description.en}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const TestimonialsSection: React.FC<{ lang: "fr" | "en" }> = ({ lang }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <section ref={ref} className="py-16 sm:py-20">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5, ease }}
        className="text-2xl sm:text-3xl font-semibold text-text-primary text-center mb-10 tracking-tight"
      >
        {lang === "fr" ? "Ils ont franchi le pas" : "They made the leap"}
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.4, delay: 0.05 * i, ease }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col"
          >
            <p className="text-sm text-text-secondary leading-relaxed mb-5 italic">
              « {lang === "fr" ? t.text.fr : t.text.en} »
            </p>
            <div className="mt-auto flex items-center gap-3 pt-4 border-t border-white/[0.05]">
              <span className="text-2xl">{t.avatar}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-primary truncate">
                  {t.author}
                </p>
                <p className="text-[11px] text-text-tertiary truncate">
                  {lang === "fr" ? t.role.fr : t.role.en}
                </p>
              </div>
              <span
                className={`ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                  t.plan === "expert"
                    ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                    : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                }`}
              >
                {t.plan}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

interface FaqItem {
  q: { fr: string; en: string };
  a: { fr: string; en: string };
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: {
      fr: "Comment fonctionne l'essai gratuit 7 jours ?",
      en: "How does the 7-day free trial work?",
    },
    a: {
      fr: "Aucune carte bancaire requise pour démarrer. Vous accédez à toutes les fonctionnalités du plan choisi (Pro ou Expert) pendant 7 jours. À la fin, vous décidez de continuer ou non — sans engagement.",
      en: "No card required to start. You get full access to your chosen plan (Pro or Expert) for 7 days. At the end, you choose whether to continue — no commitment.",
    },
  },
  {
    q: {
      fr: "Quelle est la différence entre Pro et Expert ?",
      en: "What's the difference between Pro and Expert?",
    },
    a: {
      fr: "Pro convient à un apprenant régulier (25 analyses/mois, vidéos jusqu'à 1h, fact-check, voice 30 min). Expert s'adresse aux créateurs/chercheurs qui ont besoin de Playlists, Deep Research, voice 120 min, file prioritaire et chat illimité.",
      en: "Pro fits a regular learner (25 analyses/month, videos up to 1h, fact-check, 30 min voice). Expert targets creators/researchers needing Playlists, Deep Research, 120 min voice, priority queue and unlimited chat.",
    },
  },
  {
    q: {
      fr: "Puis-je changer ou annuler à tout moment ?",
      en: "Can I change or cancel anytime?",
    },
    a: {
      fr: "Oui. Upgrade : facturation au prorata, accès immédiat. Downgrade : effectif au renouvellement. Annulation : accès maintenu jusqu'à la fin de la période payée.",
      en: "Yes. Upgrade: prorated billing, instant access. Downgrade: effective at renewal. Cancellation: access kept until paid period ends.",
    },
  },
  {
    q: {
      fr: "L'engagement annuel est-il obligatoire ?",
      en: "Is the annual commitment required?",
    },
    a: {
      fr: "Non. Vous choisissez mensuel ou annuel. L'annuel offre 2 mois gratuits (−17 %). Vous pouvez basculer entre les deux quand vous voulez.",
      en: "No. You pick monthly or yearly. Yearly gets you 2 months free (−17%). You can switch anytime.",
    },
  },
  {
    q: { fr: "Mes données sont-elles en sécurité ?", en: "Is my data secure?" },
    a: {
      fr: "Vos données sont hébergées en Europe (Hetzner Allemagne, RGPD). L'IA est française (Mistral AI). Aucun envoi vers les USA. Paiements sécurisés par Stripe.",
      en: "Your data is hosted in Europe (Hetzner Germany, GDPR). AI is French (Mistral AI). No US transit. Payments secured by Stripe.",
    },
  },
  {
    q: {
      fr: "Que se passe-t-il si j'épuise mon quota ?",
      en: "What if I run out of quota?",
    },
    a: {
      fr: "Vos analyses restent consultables. Vous pouvez attendre le renouvellement mensuel, acheter des packs de crédits, ou passer au plan supérieur (prorata appliqué).",
      en: "Your analyses stay accessible. Wait for monthly renewal, buy credit packs, or upgrade (prorated billing applies).",
    },
  },
];

const FaqSection: React.FC<{ lang: "fr" | "en" }> = ({ lang }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="py-16 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5, ease }}
        className="max-w-3xl mx-auto"
      >
        <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary text-center mb-10 tracking-tight">
          {lang === "fr" ? "Questions fréquentes" : "Frequently asked"}
        </h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
                aria-expanded={isOpen}
              >
                <div className="flex items-start gap-3">
                  <span className="flex-1 text-sm font-medium text-text-primary">
                    {lang === "fr" ? item.q.fr : item.q.en}
                  </span>
                  <ChevronDown
                    className={`flex-shrink-0 w-4 h-4 text-text-tertiary transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.p
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.25, ease }}
                      className="text-sm text-text-secondary leading-relaxed overflow-hidden"
                    >
                      {lang === "fr" ? item.a.fr : item.a.en}
                    </motion.p>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════

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
  const lang = (language as "fr" | "en") || "fr";

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plans, setPlans] = useState<ApiBillingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<ApiBillingPlan | null>(
    null,
  );
  const [trialEligible, setTrialEligible] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const currentPlan = useMemo(() => plans.find((p) => p.is_current), [plans]);

  // Source tracking analytics
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const planParam = params.get("plan");
    if (source) {
      analytics.capture("upgrade_page_viewed", {
        source,
        plan_param: planParam,
      });
      if (source === "voice_call") {
        analytics.capture("voice_call_upgrade_landed", {
          plan_param: planParam,
        });
      }
    }
  }, []);

  // Load plans + subscription status + trial eligibility
  useEffect(() => {
    const load = async () => {
      setPlansLoading(true);
      try {
        await refreshUser(true);
        const [plansResponse, statusResponse] = await Promise.allSettled([
          billingApi.getPlans("web"),
          billingApi.getSubscriptionStatus(),
        ]);

        if (
          plansResponse.status === "fulfilled" &&
          plansResponse.value.plans?.length
        ) {
          setPlans(plansResponse.value.plans);
        } else {
          const userPlan = user?.plan || "free";
          setPlans(buildFallbackPlans(userPlan));
        }

        if (statusResponse.status === "fulfilled") {
          setSubscriptionStatus(statusResponse.value);
        }

        try {
          const eligibility = await billingApi.checkTrialEligibility();
          setTrialEligible(eligibility.eligible);
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("Error loading plans:", err);
        const userPlan = user?.plan || "free";
        setPlans(buildFallbackPlans(userPlan));
      } finally {
        setPlansLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartTrial = async (plan: "pro" | "expert" = "pro") => {
    setTrialLoading(true);
    setError(null);
    try {
      const result = await billingApi.startTrial(plan, cycle);
      if (result.checkout_url) window.location.href = result.checkout_url;
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === "fr"
            ? "Erreur lors du démarrage de l'essai"
            : "Error starting trial"),
      );
    } finally {
      setTrialLoading(false);
    }
  };

  const handleSelectPlan = (plan: ApiBillingPlan) => {
    if (plan.is_current || (plan.price_monthly_cents === 0 && plan.is_current))
      return;
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
      if (
        plan.is_upgrade ||
        !currentPlan ||
        currentPlan.price_monthly_cents === 0
      ) {
        const result = await billingApi.createCheckout(plan.id, cycle);
        if (result.checkout_url) {
          window.location.href = result.checkout_url;
          return;
        }
      } else {
        const result = await billingApi.changePlan(plan.id);
        if (result.success) {
          setSuccess(
            lang === "fr"
              ? "Plan modifié ! Changement effectif au prochain renouvellement."
              : "Plan changed! Takes effect at next renewal.",
          );
          await refreshUser(true);
          try {
            const plansResponse = await billingApi.getPlans("web");
            if (plansResponse.plans?.length) setPlans(plansResponse.plans);
          } catch {
            // ignore
          }
          const status = await billingApi.getSubscriptionStatus();
          setSubscriptionStatus(status);
        }
      }
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === "fr" ? "Erreur lors du changement" : "Error changing plan"),
      );
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !confirm(
        lang === "fr"
          ? "Êtes-vous sûr de vouloir annuler ? Vous garderez vos avantages jusqu'à la fin de la période payée."
          : "Are you sure? You'll keep benefits until paid period ends.",
      )
    )
      return;

    setLoading("cancel");
    try {
      await billingApi.cancelSubscription();
      setSuccess(
        lang === "fr"
          ? "Abonnement annulé. Accès maintenu jusqu'à la fin de la période."
          : "Subscription cancelled. Access kept until period end.",
      );
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err?.message || "Error");
    } finally {
      setLoading(null);
    }
  };

  // Hierarchie visuelle : free=subdued, pro=default ou highlight si pas Expert reco, expert=highlight
  const getEmphasis = (
    plan: ApiBillingPlan,
  ): "subdued" | "default" | "highlight" => {
    if (plan.id === "expert") return "highlight";
    if (plan.id === "free") return "subdued";
    return "default";
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title="Tarifs"
        description="Découvrez les plans DeepSight : Gratuit, Pro (8,99 €/mois) et Expert (19,99 €/mois). Analysez vos vidéos YouTube et TikTok avec l'IA, fact-checking nuancé et voice agent. Essai 7 jours sans CB."
        path="/upgrade"
      />
      <BreadcrumbJsonLd path="/upgrade" />
      <ProductJsonLd />
      <DoodleBackground variant="creative" />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main
        className={`relative z-10 transition-all duration-200 ease-out lg:${sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"}`}
      >
        <div className="px-4 sm:px-6 lg:px-8 pt-16 lg:pt-12 pb-24 lg:pb-12">
          <div className="max-w-6xl mx-auto">
            {/* HERO */}
            <section className="text-center pt-4 pb-12 sm:pb-16">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest text-violet-200 bg-violet-500/10 border border-violet-500/20 mb-5"
              >
                <Sparkles className="w-3 h-3" />
                {lang === "fr"
                  ? "Tarifs DeepSight 2026"
                  : "DeepSight pricing 2026"}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.05 }}
                className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary mb-4"
              >
                {lang === "fr" ? "Investissez dans votre " : "Invest in your "}
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {lang === "fr" ? "compréhension" : "understanding"}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.1 }}
                className="max-w-2xl mx-auto text-sm sm:text-base text-text-secondary mb-3"
              >
                {lang === "fr"
                  ? "Une heure de vidéo analysée en 5 minutes. Des affirmations vérifiées par sources. Des synthèses exportables. Sans engagement."
                  : "An hour of video analyzed in 5 minutes. Claims verified against sources. Exportable summaries. No commitment."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-6 mb-6"
              >
                <TrustSignals lang={lang} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.25 }}
                className="mt-10"
              >
                <BillingToggle value={cycle} onChange={setCycle} />
              </motion.div>
            </section>

            {/* Banner grandfathering legacy */}
            {(user as { is_legacy_pricing?: boolean })?.is_legacy_pricing && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-5 py-4 mb-8 text-sm text-amber-200 max-w-3xl mx-auto"
              >
                <strong className="font-semibold">
                  {lang === "fr"
                    ? "Tarif historique conservé · "
                    : "Legacy price preserved · "}
                </strong>
                {lang === "fr"
                  ? "Vous bénéficiez d'un tarif historique sur votre abonnement actuel. Il reste valable tant que votre abonnement reste actif sans interruption."
                  : "You're on a legacy price for your current subscription. It stays valid as long as your subscription remains active without interruption."}
              </motion.div>
            )}

            {/* Alertes */}
            {subscriptionStatus?.cancel_at_period_end && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-3xl mx-auto">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <span className="text-amber-200 text-sm">
                    {lang === "fr"
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
                  className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/20 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {lang === "fr" ? "Réactiver" : "Reactivate"}
                </button>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 sm:p-5 mb-6 flex items-center gap-2 text-red-200 text-sm max-w-3xl mx-auto"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 mb-6 flex items-center gap-2 text-emerald-200 text-sm max-w-3xl mx-auto"
              >
                <Check className="w-4 h-4 flex-shrink-0" /> {success}
              </motion.div>
            )}

            {/* GRILLE PLANS */}
            {plansLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[560px] rounded-3xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:items-end">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    cycle={cycle}
                    lang={lang}
                    loading={loading}
                    trialEligible={trialEligible}
                    trialLoading={trialLoading}
                    emphasis={getEmphasis(plan)}
                    onSelect={handleSelectPlan}
                    onStartTrial={handleStartTrial}
                    allPlans={plans}
                  />
                ))}
              </div>
            )}

            {/* COMPARAISON DETAILLEE */}
            <section className="pt-16 sm:pt-24">
              <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary text-center mb-2 tracking-tight">
                {lang === "fr" ? "Comparer en détail" : "Compare in detail"}
              </h2>
              <p className="text-sm text-text-tertiary text-center mb-8">
                {lang === "fr"
                  ? "Toutes les fonctionnalités plan par plan."
                  : "All features plan by plan."}
              </p>
              <ComparisonTableV2 cycle={cycle} className="max-w-5xl mx-auto" />
            </section>

            {/* DIFFERENCIATEURS */}
            <DifferentiatorsSection lang={lang} />

            {/* TEMOIGNAGES */}
            <TestimonialsSection lang={lang} />

            {/* FAQ */}
            <FaqSection lang={lang} />

            {/* B2B */}
            <section className="py-12">
              <div className="max-w-3xl mx-auto rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-8 sm:p-10 text-center">
                <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-2 tracking-tight">
                  {lang === "fr"
                    ? "Besoin d'une offre sur-mesure ?"
                    : "Need a custom plan?"}
                </h3>
                <p className="text-sm text-text-secondary mb-6 max-w-xl mx-auto">
                  {lang === "fr"
                    ? "Équipes éducatives, universités, organismes de formation, entreprises — contactez-nous pour un plan adapté à vos volumes et workflows."
                    : "Educational teams, universities, training organizations, companies — contact us for a plan tailored to your volumes and workflows."}
                </p>
                <a
                  href="mailto:contact@deepsightsynthesis.com?subject=Offre%20sur-mesure%20DeepSight"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-white/10 border border-white/15 hover:bg-white/15 transition-all"
                >
                  {lang === "fr" ? "Contactez l'équipe" : "Contact the team"}
                  <span aria-hidden>→</span>
                </a>
              </div>
            </section>

            {/* Cancel subscription (paid users) */}
            {currentPlan &&
              currentPlan.price_monthly_cents > 0 &&
              !subscriptionStatus?.cancel_at_period_end && (
                <div className="text-center py-8">
                  <button
                    onClick={handleCancelSubscription}
                    disabled={loading === "cancel"}
                    className="text-xs sm:text-sm text-text-tertiary hover:text-red-400 transition-colors flex items-center gap-2 mx-auto px-4 py-2"
                  >
                    {loading === "cancel" && <DeepSightSpinnerMicro />}
                    {lang === "fr"
                      ? "Annuler mon abonnement"
                      : "Cancel subscription"}
                  </button>
                </div>
              )}

            {/* Footer contact */}
            <div className="text-center text-xs sm:text-sm text-text-tertiary pb-4">
              {lang === "fr" ? "Une question ? " : "A question? "}
              <a
                href="mailto:contact@deepsightsynthesis.com"
                className="text-violet-300 hover:text-violet-200 hover:underline"
              >
                contact@deepsightsynthesis.com
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Downgrade modal */}
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

      {/* Glow keyframes (Expert pulsation) */}
      <style>{`
        @keyframes expert-glow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
};

export default UpgradePage;
