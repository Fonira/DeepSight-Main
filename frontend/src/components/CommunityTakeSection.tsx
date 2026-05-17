/**
 * DEEP SIGHT — CommunityTakeSection
 *
 * Verdict communauté : synthèse Mistral du scrape commentaires YouTube/TikTok.
 * Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md §7.1
 *
 * Gating :
 *  - free  → <CommunityTakeUpgradeCTA />
 *  - pro   → vue complète (3 voix, 3 controversies, pas de SentimentBar)
 *  - expert → +SentimentBar +5 voix +5 controversies
 *
 * Empty states : `take=null` (rien à afficher, silent), `take.disabled`
 * (commentaires off) ou `take.insufficient_data` → <CommunityTakeEmpty />.
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  MessageCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  HelpCircle,
} from "lucide-react";
import type { CommunityTake } from "../services/api";
import { canAccess } from "../config/planPrivileges";
import { CommunityTakeEmpty } from "./CommunityTakeEmpty";
import { CommunityTakeUpgradeCTA } from "./CommunityTakeUpgradeCTA";
import { SentimentBar } from "./SentimentBar";
import { TopVoiceCard } from "./TopVoiceCard";

interface CommunityTakeSectionProps {
  take: CommunityTake | null | undefined;
  userPlan: string | undefined | null;
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

// Static class lookup pour éviter le purge Tailwind sur classes dynamiques.
const SIGNAL_META = {
  agree: {
    Icon: ThumbsUp,
    labelFr: "Plutôt d'accord",
    labelEn: "Mostly agree",
    badgeClass:
      "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  disagree: {
    Icon: ThumbsDown,
    labelFr: "Plutôt en désaccord",
    labelEn: "Mostly disagree",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  },
  mixed: {
    Icon: Minus,
    labelFr: "Communauté divisée",
    labelEn: "Mixed reactions",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  unclear: {
    Icon: HelpCircle,
    labelFr: "Signal incertain",
    labelEn: "Unclear signal",
    badgeClass: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  },
} as const;

export const CommunityTakeSection: React.FC<CommunityTakeSectionProps> = ({
  take,
  userPlan,
  language,
  onUpgradeClick,
}) => {
  const plan = (userPlan || "free").toLowerCase();
  const isAllowed = canAccess(plan, "community_take", "web");

  // Free plan → CTA upgrade (afficher même si pas de take, pour discoverability).
  if (!isAllowed) {
    return (
      <CommunityTakeUpgradeCTA
        language={language}
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  // Pas encore généré → rien d'affiché (pipeline asynchrone, can be missing).
  if (take === null || take === undefined) return null;

  // Désactivé ou trop peu de données → empty card explicite.
  if (take.disabled || take.insufficient_data) {
    return <CommunityTakeEmpty take={take} language={language} />;
  }

  const meta = SIGNAL_META[take.agreement_signal] ?? SIGNAL_META.unclear;
  const { Icon } = meta;
  const signalLabel = language === "fr" ? meta.labelFr : meta.labelEn;
  const isExpert = plan === "expert";
  const maxVoices = isExpert ? 5 : 3;
  const maxControversies = isExpert ? 5 : 3;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-white/5 border border-violet-500/20 backdrop-blur-xl p-5"
      data-testid="community-take-section"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">
            {language === "fr" ? "Verdict communauté" : "Community verdict"}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {language === "fr"
              ? `Analyse de ${take.comments_analyzed} commentaires`
              : `Analysis of ${take.comments_analyzed} comments`}
          </p>
        </div>
        <span
          data-testid="community-signal-badge"
          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border ${meta.badgeClass}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {signalLabel}
        </span>
      </div>

      {/* Community summary */}
      <p className="text-sm text-text-primary leading-relaxed mb-4">
        {take.community_summary}
      </p>

      {/* Sentiment distribution (Expert only) */}
      {isExpert && (
        <div className="mb-4">
          <SentimentBar
            dist={take.sentiment_distribution}
            language={language}
          />
        </div>
      )}

      {/* Controversies */}
      {take.controversies && take.controversies.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {language === "fr"
              ? "Points de désaccord"
              : "Points of disagreement"}
          </h4>
          <ul className="space-y-1.5">
            {take.controversies.slice(0, maxControversies).map((c, i) => (
              <li
                key={i}
                className="text-sm text-text-secondary leading-relaxed pl-3 border-l border-amber-400/30"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top voices */}
      {take.top_voices && take.top_voices.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-violet-400" />
            {language === "fr" ? "Voix représentatives" : "Representative voices"}
          </h4>
          <ul className="space-y-2.5">
            {take.top_voices.slice(0, maxVoices).map((voice, i) => (
              <TopVoiceCard
                key={`${voice.author}-${i}`}
                voice={voice}
                language={language}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Footer meta */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-text-muted">
        <span>
          {language === "fr" ? "Généré par" : "Generated by"} {take.model_used || "Mistral"}
        </span>
        {take.is_truncated && (
          <span className="text-amber-400">
            {language === "fr" ? "Échantillon partiel" : "Partial sample"}
          </span>
        )}
      </div>
    </motion.section>
  );
};

export default CommunityTakeSection;
