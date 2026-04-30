// frontend/src/components/hub/SummaryCollapsible.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { HubSummaryContext } from "./types";

interface Props {
  context: HubSummaryContext;
  onCitationClick?: (timestampSecs: number) => void;
}

const formatTs = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const SummaryCollapsible: React.FC<Props> = ({ context, onCitationClick }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-4 my-3 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-[14px]">
      <button
        type="button"
        aria-label="Résumé"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 text-left"
      >
        <span className="font-mono text-[10px] tracking-[.12em] px-2 py-[3px] rounded bg-indigo-500/15 text-indigo-400">
          RÉSUMÉ
        </span>
        <span className="flex-1 text-sm font-medium text-white/85 truncate">
          {context.short_summary}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/45"
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
            <div className="pt-3 text-sm text-white/65 leading-[1.55]">
              <p className="mb-2">{context.short_summary}</p>
              {context.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {context.citations.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onCitationClick?.(c.ts)}
                      className="font-mono text-[10px] px-1.5 py-[1px] rounded-[3px] bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                    >
                      {formatTs(c.ts)}
                      <span className="ml-1 text-white/55 normal-case">
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
