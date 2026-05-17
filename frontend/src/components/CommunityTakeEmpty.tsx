/**
 * DEEP SIGHT — CommunityTakeEmpty
 *
 * Affiché quand `take.disabled` (commentaires off) ou
 * `take.insufficient_data` (<10 commentaires significatifs).
 */

import React from "react";
import { Users, MessageCircleOff } from "lucide-react";
import type { CommunityTake } from "../services/api";

interface Props {
  take: CommunityTake;
  language: "fr" | "en";
}

export const CommunityTakeEmpty: React.FC<Props> = ({ take, language }) => {
  const Icon = take.disabled ? MessageCircleOff : Users;
  const message = take.disabled
    ? language === "fr"
      ? "Les commentaires sont désactivés sur cette vidéo."
      : "Comments are disabled on this video."
    : language === "fr"
      ? `Trop peu de commentaires (${take.comments_analyzed}) pour un verdict fiable.`
      : `Too few comments (${take.comments_analyzed}) for a reliable verdict.`;

  return (
    <section
      className="rounded-xl bg-white/3 border border-white/5 backdrop-blur-xl p-4"
      data-testid="community-take-empty"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-text-muted" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-secondary">
            {language === "fr" ? "Verdict communauté" : "Community verdict"}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{message}</p>
        </div>
      </div>
    </section>
  );
};

export default CommunityTakeEmpty;
