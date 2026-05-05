/**
 * DebateSummaryCard — Carte résumé d'un débat (pour la liste / historique)
 */

import React from "react";
import { motion } from "framer-motion";
import { Swords, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { DebateListItem, DebateStatus } from "../../types/debate";
import { DeepSightSpinnerMicro } from "../ui/DeepSightSpinner";
import { ThumbnailImage } from "../ThumbnailImage";

interface DebateSummaryCardProps {
  debate: DebateListItem;
  onClick: (id: number) => void;
}

const SpinnerBadgeIcon = () => <DeepSightSpinnerMicro />;

const STATUS_BADGE: Record<
  DebateStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: "En attente",
    className: "bg-white/10 text-white/50",
    icon: Clock,
  },
  searching: {
    label: "Recherche…",
    className: "bg-indigo-500/15 text-indigo-400",
    icon: SpinnerBadgeIcon,
  },
  analyzing_b: {
    label: "Analyse…",
    className: "bg-indigo-500/15 text-indigo-400",
    icon: SpinnerBadgeIcon,
  },
  comparing: {
    label: "Comparaison…",
    className: "bg-violet-500/15 text-violet-400",
    icon: SpinnerBadgeIcon,
  },
  fact_checking: {
    label: "Vérification…",
    className: "bg-cyan-500/15 text-cyan-400",
    icon: SpinnerBadgeIcon,
  },
  completed: {
    label: "Terminé",
    className: "bg-emerald-500/15 text-emerald-400",
    icon: CheckCircle2,
  },
  failed: {
    label: "Échec",
    className: "bg-red-500/15 text-red-400",
    icon: XCircle,
  },
  adding_perspective: {
    label: "Ajout perspective…",
    className: "bg-violet-500/15 text-violet-400",
    icon: SpinnerBadgeIcon,
  },
};

export const DebateSummaryCard: React.FC<DebateSummaryCardProps> = ({
  debate,
  onClick,
}) => {
  const badge = STATUS_BADGE[debate.status];
  const BadgeIcon = badge.icon;
  const isLoading = [
    "searching",
    "analyzing_b",
    "comparing",
    "fact_checking",
  ].includes(debate.status);

  const formattedDate = new Date(debate.created_at).toLocaleDateString(
    "fr-FR",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <motion.button
      onClick={() => onClick(debate.id)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 hover:bg-white/[0.07] hover:border-white/15 transition-colors group"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnails stacked */}
        <div className="relative w-16 h-16 shrink-0">
          <div className="absolute top-0 left-0 w-12 h-12 rounded-lg overflow-hidden border border-indigo-500/30">
            <ThumbnailImage
              thumbnailUrl={debate.video_a_thumbnail || undefined}
              videoId=""
              title={debate.video_a_title || ""}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute bottom-0 right-0 w-12 h-12 rounded-lg overflow-hidden border border-violet-500/30">
            <ThumbnailImage
              thumbnailUrl={debate.video_b_thumbnail || undefined}
              videoId=""
              title={debate.video_b_title || ""}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center z-10 border border-white/20">
            <Swords className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
            >
              <BadgeIcon
                className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`}
              />
              {badge.label}
            </span>
            <span className="text-[10px] text-text-tertiary">
              {formattedDate}
            </span>
          </div>
          <p className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
            {debate.detected_topic}
          </p>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {debate.video_a_title} vs {debate.video_b_title}
          </p>
        </div>
      </div>
    </motion.button>
  );
};
