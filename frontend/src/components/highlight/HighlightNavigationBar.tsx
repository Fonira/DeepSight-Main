import React, { useEffect } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { useSemanticHighlight } from "./useSemanticHighlight";

export const HighlightNavigationBar: React.FC = () => {
  const ctx = useSemanticHighlight();

  // Keyboard shortcuts F3 / Shift+F3 for next/prev (browser standard)
  useEffect(() => {
    if (!ctx || ctx.matches.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        if (e.shiftKey) {
          ctx.prev();
        } else {
          ctx.next();
        }
      }
      if (e.key === "Escape" && ctx.query) {
        e.preventDefault();
        ctx.close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx]);

  if (!ctx || ctx.matches.length === 0) return null;

  const total = ctx.matches.length;
  const current = ctx.currentIndex + 1;

  return (
    <nav
      role="navigation"
      aria-label="Résultats de recherche"
      className="sticky top-[56px] z-40 mx-auto w-full max-w-3xl px-4"
    >
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121a]/95 border border-amber-500/30 backdrop-blur-xl shadow-lg">
        <span
          className="text-sm font-mono text-amber-300 tabular-nums"
          aria-live="polite"
        >
          {current}/{total}
        </span>
        <span className="flex-1 truncate text-xs text-white/55">
          « {ctx.query} »
        </span>
        <button
          type="button"
          onClick={ctx.prev}
          aria-label="Match précédent"
          aria-keyshortcuts="Shift+F3"
          className="p-1.5 rounded-md text-white/65 hover:bg-white/5 hover:text-white"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={ctx.next}
          aria-label="Match suivant"
          aria-keyshortcuts="F3"
          className="p-1.5 rounded-md text-white/65 hover:bg-white/5 hover:text-white"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={ctx.close}
          aria-label="Fermer la recherche"
          aria-keyshortcuts="Escape"
          className="p-1.5 rounded-md text-white/65 hover:bg-white/5 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
