// frontend/src/components/hub/SummaryCollapsible.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { HubSummaryContext } from "./types";

interface Props {
  context: HubSummaryContext;
  onCitationClick?: (timestampSecs: number) => void;
  /**
   * Hub-first : si `true`, le bloc résumé est rendu déjà déroulé et son wrapper
   * est centré à l'écran via `scrollIntoView` au mount. Utilisé quand l'URL
   * porte `?open_summary=1` (ex : redirect post-analyse).
   */
  defaultOpen?: boolean;
}

const formatTs = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/** Parse `MM:SS` ou `HH:MM:SS` en secondes. Retourne null si format invalide. */
const parseTimecodeToSecs = (raw: string): number | null => {
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

/** Match `[12:34]`, `[1:23:45]`, `(02:14)` ou `(1:23:45)`. */
const TIMECODE_REGEX =
  /\[(\d{1,2}:\d{2}(?::\d{2})?)\]|\((\d{1,2}:\d{2}(?::\d{2})?)\)/g;

interface ParsedSegment {
  type: "text" | "cit";
  value: string;
  /** Secondes parsées (pour type === "cit"). */
  secs?: number;
}

/** Découpe le texte en segments texte + citations inline. */
const parseInlineCitations = (text: string): ParsedSegment[] => {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;
  TIMECODE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TIMECODE_REGEX.exec(text)) !== null) {
    const raw = match[1] ?? match[2];
    const secs = raw ? parseTimecodeToSecs(raw) : null;
    if (secs === null) continue;
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    segments.push({ type: "cit", value: raw, secs });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
};

export const SummaryCollapsible: React.FC<Props> = ({
  context,
  onCitationClick,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  /** Segments parsés à partir de `short_summary` : timecodes inline → pills. */
  const segments = useMemo(
    () => parseInlineCitations(context.short_summary),
    [context.short_summary],
  );
  const hasInlineCits = segments.some((s) => s.type === "cit");

  // Hub-first : quand on arrive avec `?open_summary=1`, scroller le bloc résumé
  // au centre de l'écran après mount (le panneau est déjà déroulé via
  // `useState(defaultOpen)`). On ne le fait qu'une fois.
  useEffect(() => {
    if (!defaultOpen) return;
    const node = wrapperRef.current;
    if (!node || typeof node.scrollIntoView !== "function") return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="mx-4 my-3 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-[14px]"
    >
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
              <p className="mb-2">
                {hasInlineCits
                  ? segments.map((seg, i) =>
                      seg.type === "cit" && typeof seg.secs === "number" ? (
                        <button
                          key={`cit-${i}`}
                          type="button"
                          onClick={() => onCitationClick?.(seg.secs as number)}
                          className="inline-flex font-mono text-[10px] px-1.5 py-[1px] mx-0.5 rounded-[3px] bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors align-baseline"
                        >
                          {seg.value}
                        </button>
                      ) : (
                        <React.Fragment key={`txt-${i}`}>
                          {seg.value}
                        </React.Fragment>
                      ),
                    )
                  : context.short_summary}
              </p>
              {!hasInlineCits && context.citations.length > 0 && (
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
