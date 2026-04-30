// frontend/src/components/hub/SummaryCollapsible.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const formatTs = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/** Format une durée en secondes en `MM:SS` ou `HH:MM:SS` selon la longueur. */
const formatDuration = (totalSecs: number): string => {
  if (!Number.isFinite(totalSecs) || totalSecs <= 0) return "";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
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

/**
 * Heuristique légère pour détecter si `short_summary` contient assez de syntaxe
 * markdown (heading, bold, listes) pour valoir un rendu via ReactMarkdown.
 * Si non → on retombe sur le parser inline (parseInlineCitations).
 */
const looksLikeMarkdown = (text: string): boolean => {
  if (!text) return false;
  // Heading ## ou ### en début de ligne
  if (/(^|\n)#{1,3}\s/.test(text)) return true;
  // Bold ** ou italique *
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  // Liste - ou * en début de ligne
  if (/(^|\n)[-*]\s/.test(text)) return true;
  // Liste numérotée
  if (/(^|\n)\d+\.\s/.test(text)) return true;
  // Lien markdown [text](url)
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true;
  return false;
};

/**
 * Composant pill cyan affichant un timestamp cliquable. Utilisé à la fois pour
 * les liens markdown `[02:14](#)` et pour les citations inline `[02:14]` du
 * fallback non-markdown.
 */
interface CitationPillProps {
  secs: number;
  label?: string;
  onClick?: (secs: number) => void;
}
const CitationPill: React.FC<CitationPillProps> = ({
  secs,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={() => onClick?.(secs)}
    className="inline-flex font-mono text-[10px] px-1.5 py-[1px] mx-0.5 rounded-[3px] bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors align-baseline no-underline"
  >
    {formatTs(secs)}
    {label ? (
      <span className="ml-1 text-white/55 normal-case">{label}</span>
    ) : null}
  </button>
);

export const SummaryCollapsible: React.FC<Props> = ({
  context,
  onCitationClick,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const duration = formatDuration(context.video_duration_secs);
  const metaLine = [context.video_channel, duration].filter(Boolean).join(" · ");

  /** Segments parsés à partir de `short_summary` : timecodes inline → pills. */
  const segments = useMemo(
    () => parseInlineCitations(context.short_summary),
    [context.short_summary],
  );
  const hasInlineCits = segments.some((s) => s.type === "cit");
  const useMarkdown = useMemo(
    () => looksLikeMarkdown(context.short_summary),
    [context.short_summary],
  );

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

  /**
   * Components overrides pour ReactMarkdown — convertit les liens markdown
   * dont le texte ressemble à un timecode (`[02:14](#)`) en pills cyan
   * cliquables. Les autres liens restent rendus normalement.
   */
  const markdownComponents = useMemo(
    () => ({
      a: ({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) => {
        const txt = React.Children.toArray(children).join("");
        const secs = typeof txt === "string" ? parseTimecodeToSecs(txt) : null;
        if (secs !== null) {
          return <CitationPill secs={secs} onClick={onCitationClick} />;
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:text-cyan-200 underline"
          >
            {children}
          </a>
        );
      },
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="text-base font-semibold text-white mt-3 mb-2">
          {children}
        </h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-sm font-semibold text-white/90 mt-2.5 mb-1.5">
          {children}
        </h3>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mb-2 text-sm text-white/75 leading-[1.55]">{children}</p>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="text-white font-semibold">{children}</strong>
      ),
      em: ({ children }: { children?: React.ReactNode }) => (
        <em className="text-white/85 italic">{children}</em>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="list-disc pl-5 mb-2 space-y-1 text-sm text-white/75">
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm text-white/75">
          {children}
        </ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="text-sm text-white/75 leading-[1.55]">{children}</li>
      ),
    }),
    [onCitationClick],
  );

  const renderExpandedBody = (): React.ReactNode => {
    if (!context.short_summary || context.short_summary.trim().length === 0) {
      return (
        <p className="italic text-white/45 text-sm">
          Résumé en cours de chargement…
        </p>
      );
    }

    if (useMarkdown) {
      return (
        <>
          <div className="text-sm text-white/75 leading-[1.55]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {context.short_summary}
            </ReactMarkdown>
          </div>
          {context.citations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {context.citations.map((c, i) => (
                <CitationPill
                  key={`cit-${i}`}
                  secs={c.ts}
                  label={c.label}
                  onClick={onCitationClick}
                />
              ))}
            </div>
          )}
        </>
      );
    }

    // Fallback non-markdown : parsing inline timecodes [MM:SS] / (MM:SS) → pills
    return (
      <>
        <p className="mb-2 text-sm text-white/75 leading-[1.55]">
          {hasInlineCits
            ? segments.map((seg, i) =>
                seg.type === "cit" && typeof seg.secs === "number" ? (
                  <CitationPill
                    key={`cit-${i}`}
                    secs={seg.secs}
                    onClick={onCitationClick}
                  />
                ) : (
                  <React.Fragment key={`txt-${i}`}>{seg.value}</React.Fragment>
                ),
              )
            : context.short_summary}
        </p>
        {!hasInlineCits && context.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {context.citations.map((c, i) => (
              <CitationPill
                key={`cit-${i}`}
                secs={c.ts}
                label={c.label}
                onClick={onCitationClick}
              />
            ))}
          </div>
        )}
      </>
    );
  };

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
        {/* Thumbnail miniature 40x40, fallback gradient indigo→violet si null */}
        {context.video_thumbnail_url ? (
          <img
            src={context.video_thumbnail_url}
            alt={context.video_title}
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-lg flex-shrink-0 border border-white/10 bg-gradient-to-br from-indigo-500/40 to-violet-500/40"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[10px] tracking-[.12em] px-2 py-[3px] rounded bg-indigo-500/15 text-indigo-400">
              RÉSUMÉ
            </span>
            {metaLine && (
              <span className="font-mono text-[10px] text-white/35 truncate">
                {metaLine}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-white/85 truncate">
            {context.short_summary || context.video_title}
          </p>
        </div>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/45 flex-shrink-0"
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
            <div className="pt-3">{renderExpandedBody()}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
