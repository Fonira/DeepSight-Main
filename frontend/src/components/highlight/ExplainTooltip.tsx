import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageSquare, ExternalLink, X } from "lucide-react";
import { searchApi, type WithinMatch } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { PLAN_FEATURES, normalizePlanId } from "../../config/planPrivileges";
import { ExplainUpsellModal } from "./ExplainUpsellModal";

interface Props {
  open: boolean;
  match: WithinMatch | null;
  query: string;
  summaryId: number;
  /** Anchor element rectangle (from getBoundingClientRect) for positioning */
  anchorRect: DOMRect | null;
  onClose: () => void;
  onCiteInChat: (passage: string) => void;
  onSeekTimecode?: (seconds: number) => void;
  onJumpToTab?: (tab: WithinMatch["tab"]) => void;
}

export const ExplainTooltip: React.FC<Props> = ({
  open,
  match,
  query,
  summaryId,
  anchorRect,
  onClose,
  onCiteInChat,
  onJumpToTab,
}) => {
  const { user } = useAuth();
  const plan = normalizePlanId(user?.plan);
  const tooltipAllowed = PLAN_FEATURES[plan].semanticSearchTooltip;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node))
        onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  // Open upsell instead of fetching for free users
  useEffect(() => {
    if (open && match && !tooltipAllowed) setUpsellOpen(true);
  }, [open, match, tooltipAllowed]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["explain-passage", summaryId, match?.passage_id, query],
    queryFn: () => {
      if (!match) return Promise.reject(new Error("no match"));
      return searchApi.explainPassage(
        summaryId,
        match.text,
        query,
        match.source_type,
      );
    },
    enabled: open && !!match && tooltipAllowed,
    staleTime: 60 * 60 * 1000, // 1h cache
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  if (!open || !match) {
    return upsellOpen && match ? (
      <ExplainUpsellModal
        open
        passageText={(match as WithinMatch).text}
        onClose={() => {
          setUpsellOpen(false);
          onClose();
        }}
      />
    ) : null;
  }

  if (!tooltipAllowed) {
    return (
      <ExplainUpsellModal
        open={upsellOpen}
        passageText={match.text}
        onClose={() => {
          setUpsellOpen(false);
          onClose();
        }}
      />
    );
  }

  // Position : prefer above anchor, fallback below
  const margin = 8;
  const tooltipMaxWidth = 360;
  const top = anchorRect
    ? anchorRect.top - margin - 220 < 0
      ? anchorRect.bottom + margin
      : anchorRect.top - margin - 220
    : 100;
  const left = anchorRect
    ? Math.max(
        8,
        Math.min(window.innerWidth - tooltipMaxWidth - 8, anchorRect.left),
      )
    : 100;

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        role="tooltip"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.15 }}
        style={{ top, left, maxWidth: tooltipMaxWidth }}
        className="fixed z-[55] rounded-xl bg-[#12121a] border border-white/15 shadow-2xl backdrop-blur-xl p-3 w-[min(90vw,360px)]"
      >
        <div className="flex items-start justify-between mb-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300">
            <Sparkles className="w-3 h-3" />
            IA · Pourquoi ce passage matche
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-0.5 rounded hover:bg-white/5"
          >
            <X className="w-3.5 h-3.5 text-white/55" />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-1.5">
            <div className="h-2.5 bg-white/10 rounded animate-pulse w-full" />
            <div className="h-2.5 bg-white/10 rounded animate-pulse w-4/5" />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-300">
            Impossible de générer l'explication.
          </p>
        )}

        {data && (
          <p className="text-sm text-white/85 leading-relaxed">
            {data.explanation}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              onCiteInChat(`Explique-moi ce passage : ${match.text}`);
              onClose();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/85 hover:bg-white/10"
          >
            <MessageSquare className="w-3 h-3" /> Citer dans chat
          </button>
          {onJumpToTab && match.tab !== "synthesis" && (
            <button
              type="button"
              onClick={() => {
                onJumpToTab(match.tab);
                onClose();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/85 hover:bg-white/10"
            >
              <ExternalLink className="w-3 h-3" />
              Voir dans {match.tab}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
