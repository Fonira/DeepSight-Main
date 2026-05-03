import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useSemanticHighlight } from "./useSemanticHighlight";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const IntraAnalysisSearchBar: React.FC<Props> = ({ open, onClose }) => {
  const ctx = useSemanticHighlight();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open || !ctx) return null;

  return (
    <div
      role="search"
      aria-label="Recherche dans l'analyse"
      className="fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-xl px-4"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#12121a]/95 border border-white/15 backdrop-blur-xl shadow-2xl">
        <Search className="w-4 h-4 text-white/55" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={ctx.query}
          onChange={(e) => ctx.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              ctx.close();
              onClose();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) {
                ctx.prev();
              } else {
                ctx.next();
              }
            }
          }}
          placeholder="Rechercher dans l'analyse…"
          aria-label="Rechercher dans l'analyse"
          className="flex-1 bg-transparent text-white placeholder-white/35 outline-none text-sm"
        />
        {ctx.loading && (
          <span className="text-[11px] font-mono text-white/45">…</span>
        )}
        {!ctx.loading && ctx.matches.length > 0 && (
          <span className="text-[11px] font-mono text-amber-300 tabular-nums">
            {ctx.currentIndex + 1}/{ctx.matches.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            ctx.close();
            onClose();
          }}
          aria-label="Fermer"
          className="p-1.5 rounded-md text-white/55 hover:bg-white/5 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
