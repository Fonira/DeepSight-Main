// frontend/src/components/hub/HubToolbox.tsx
//
// Tableau de bord collapsible affiché sous le résumé dans le Hub.
// Regroupe les accès rapides aux outils d'analyse complète : synthèse
// détaillée, fact-check, mind map (via /dashboard?id=X&legacy=1), mode
// étude (quiz + flashcards via /study/:summaryId), et le partage du lien
// Hub vers la conversation courante.

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Layers,
  Brain,
  Share2,
  Target,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  summaryId: number;
  videoTitle: string;
}

interface ToolDef {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subtitle: string;
  onClick: () => void | Promise<void>;
  iconClass: string;
  bgClass: string;
}

export const HubToolbox: React.FC<Props> = ({ summaryId, videoTitle }) => {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const navigate = useNavigate();

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/hub?conv=${summaryId}`;
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({ title: videoTitle, url });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
      }
    } catch {
      // Cancelled by user — silent.
    }
  }, [summaryId, videoTitle]);

  const tools: ToolDef[] = [
    {
      icon: Layers,
      label: "Analyse complète",
      subtitle: "Synthèse · fact-check · mind map",
      onClick: () => navigate(`/dashboard?id=${summaryId}&legacy=1`),
      iconClass: "text-cyan-300",
      bgClass: "bg-cyan-500/15",
    },
    {
      icon: Brain,
      label: "Mode étude",
      subtitle: "Quiz · flashcards",
      onClick: () => navigate(`/study/${summaryId}`),
      iconClass: "text-amber-300",
      bgClass: "bg-amber-500/15",
    },
    {
      icon: shared ? Check : Share2,
      label: shared ? "Lien copié" : "Partager",
      subtitle: shared ? "Hub URL en presse-papier" : "Copier le lien Hub",
      onClick: handleShare,
      iconClass: shared ? "text-emerald-300" : "text-violet-300",
      bgClass: shared ? "bg-emerald-500/15" : "bg-violet-500/15",
    },
  ];

  return (
    <div className="mx-4 mb-3 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-[14px]">
      <button
        type="button"
        aria-label="Tableau de bord"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="w-10 h-10 rounded-lg flex-shrink-0 grid place-items-center bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-white/10">
          <Target className="w-4 h-4 text-emerald-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[10px] tracking-[.12em] px-2 py-[3px] rounded bg-emerald-500/15 text-emerald-300">
              TABLEAU DE BORD
            </span>
            <span className="font-mono text-[10px] text-white/45 truncate">
              {tools.length} outils
            </span>
          </div>
          <p className="text-sm font-medium text-white/95 truncate">
            Outils & analyse complète
          </p>
        </div>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/55 flex-shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {tools.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={tool.onClick}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left group"
                  >
                    <div
                      className={
                        "w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 transition-transform group-hover:scale-105 " +
                        tool.bgClass
                      }
                    >
                      <Icon className={"w-4 h-4 " + tool.iconClass} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/95 font-medium leading-tight">
                        {tool.label}
                      </p>
                      <p className="text-[11px] text-white/60 mt-0.5 leading-tight truncate">
                        {tool.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
