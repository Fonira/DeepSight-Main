/**
 * DEEP SIGHT — TopVoiceCard
 *
 * Une voix représentative anonymisée + son stance + like count.
 * Auteurs déjà pseudonymisés côté backend (cf comments/take_generator.py).
 */

import React from "react";
import { ThumbsUp, ThumbsDown, Minus, HelpCircle, Heart } from "lucide-react";
import type { CommunityTopVoice } from "../services/api";

interface Props {
  voice: CommunityTopVoice;
  language: "fr" | "en";
}

const STANCE_META = {
  agree: {
    Icon: ThumbsUp,
    iconClass: "text-emerald-400",
    labelFr: "D'accord",
    labelEn: "Agree",
  },
  disagree: {
    Icon: ThumbsDown,
    iconClass: "text-rose-400",
    labelFr: "En désaccord",
    labelEn: "Disagree",
  },
  neutral: {
    Icon: Minus,
    iconClass: "text-slate-400",
    labelFr: "Neutre",
    labelEn: "Neutral",
  },
  question: {
    Icon: HelpCircle,
    iconClass: "text-amber-400",
    labelFr: "Question",
    labelEn: "Question",
  },
} as const;

const formatLikes = (n: number, language: "fr" | "en"): string => {
  if (n < 1000) return n.toLocaleString(language === "fr" ? "fr-FR" : "en-US");
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
};

export const TopVoiceCard: React.FC<Props> = ({ voice, language }) => {
  const meta = STANCE_META[voice.stance] ?? STANCE_META.neutral;
  const { Icon } = meta;
  const stanceLabel = language === "fr" ? meta.labelFr : meta.labelEn;

  return (
    <li
      className="rounded-lg bg-white/3 border border-white/5 p-3"
      data-testid="community-top-voice"
    >
      <div className="flex items-start gap-2 mb-1.5">
        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.iconClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
            <span className="font-medium text-text-secondary">
              {voice.author}
            </span>
            <span aria-hidden>·</span>
            <span className={meta.iconClass}>{stanceLabel}</span>
            {voice.like_count > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Heart className="w-3 h-3" />
                  {formatLikes(voice.like_count, language)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-text-primary leading-relaxed pl-5">
        {voice.excerpt}
      </p>
    </li>
  );
};

export default TopVoiceCard;
