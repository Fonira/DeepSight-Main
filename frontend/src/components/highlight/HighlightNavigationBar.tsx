import React, { useEffect } from "react";
import { createPortal } from "react-dom";
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

  // Portal to <body> with `position: fixed` so the bar stays visible
  // regardless of any ancestor with `overflow: hidden` / `h-screen` /
  // flex stacking that would otherwise clip a `sticky` element. Bug
  // observed in HubPage where the bar was rendered inside an
  // `h-screen overflow-hidden flex flex-col` container and the sticky
  // positioning resolved to y=623 (off-screen).
  if (typeof document === "undefined") return null;
  return createPortal(
    <nav
      role="navigation"
      aria-label="Résultats de recherche"
      className="fixed left-1/2 -translate-x-1/2 top-[64px] z-50 w-full max-w-3xl px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121a]/95 border border-amber-500/30 backdrop-blur-xl shadow-lg">
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
    </nav>,
    document.body,
  );
};
