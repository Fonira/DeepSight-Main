/**
 * 📚 ENRICHED MARKDOWN v13.0 — Premium Rendering
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Features:
 *   - Full markdown (GFM) support
 *   - Clickable [MM:SS] timecodes with play icon
 *   - Epistemic markers (SOLIDE, PLAUSIBLE, INCERTAIN, A VERIFIER) → callout badges
 *   - [[concepts]] cleaned to plain text
 *   - Auto-emoji headers based on section keywords
 *   - Professional typography & dark-first design
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EnrichedMarkdownProps {
  children: string;
  language?: "fr" | "en";
  onTimecodeClick?: (seconds: number) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ EPISTEMIC MARKERS
// ═══════════════════════════════════════════════════════════════════════════════

const EPISTEMIC_MARKERS: Record<
  string,
  {
    color: string;
    bg: string;
    borderColor: string;
    label: string;
    emoji: string;
  }
> = {
  SOLIDE: {
    color: "#22C55E",
    bg: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.25)",
    label: "Établi",
    emoji: "✅",
  },
  PLAUSIBLE: {
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.10)",
    borderColor: "rgba(59,130,246,0.25)",
    label: "Probable",
    emoji: "🔵",
  },
  INCERTAIN: {
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.25)",
    label: "Incertain",
    emoji: "🟡",
  },
  "A VERIFIER": {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.25)",
    label: "À vérifier",
    emoji: "🔴",
  },
  "À VÉRIFIER": {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.25)",
    label: "À vérifier",
    emoji: "🔴",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 SECTION EMOJIS
// ═══════════════════════════════════════════════════════════════════════════════

const SECTION_EMOJIS: Record<string, string> = {
  résumé: "📝",
  summary: "📝",
  synthèse: "📝",
  introduction: "🎬",
  contexte: "🌍",
  context: "🌍",
  analyse: "🔬",
  analysis: "🔬",
  "points clés": "🎯",
  "key points": "🎯",
  "points forts": "💪",
  strengths: "💪",
  "points faibles": "⚠️",
  weaknesses: "⚠️",
  limites: "⚠️",
  conclusion: "🏁",
  recommandations: "💡",
  recommendations: "💡",
  sources: "📚",
  références: "📚",
  references: "📚",
  "fact-check": "🔍",
  vérification: "🔍",
  arguments: "⚖️",
  méthodologie: "🧪",
  methodology: "🧪",
  données: "📊",
  data: "📊",
  statistiques: "📊",
  opinion: "💬",
  avis: "💬",
  biais: "🎭",
  bias: "🎭",
  nuances: "🎨",
  perspectives: "👁️",
  timeline: "📅",
  chronologie: "📅",
  définitions: "📖",
  glossaire: "📖",
};

const getHeaderEmoji = (text: string): string => {
  const lower = (typeof text === "string" ? text : "").toLowerCase().trim();
  for (const [keyword, emoji] of Object.entries(SECTION_EMOJIS)) {
    if (lower.includes(keyword)) return emoji;
  }
  return "📌";
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 PRÉ-PROCESSEUR
// ═══════════════════════════════════════════════════════════════════════════════

function _cleanMarkers(text: string): string {
  if (!text) return "";
  return text.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_, term, display) => display || term,
  );
}

function markTimecodes(text: string): string {
  if (!text) return "";
  return text.replace(
    /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g,
    (_match, p1, p2, p3) => {
      const part1 = parseInt(p1, 10);
      const part2 = parseInt(p2, 10);
      const part3 = p3 ? parseInt(p3, 10) : undefined;
      const seconds =
        part3 !== undefined
          ? part1 * 3600 + part2 * 60 + part3
          : part1 * 60 + part2;
      const display = part3 !== undefined ? `${p1}:${p2}:${p3}` : `${p1}:${p2}`;
      return `⏱️${seconds}⏱️${display}⏱️`;
    },
  );
}

/**
 * Mark epistemic markers with special tokens for inline rendering
 */
function markEpistemics(text: string): string {
  if (!text) return "";
  // Match [SOLIDE], [PLAUSIBLE], [INCERTAIN], [A VERIFIER], [À VÉRIFIER]
  return text.replace(
    /\[(SOLIDE|PLAUSIBLE|INCERTAIN|A VERIFIER|À VÉRIFIER)\]/gi,
    (_match, marker) => {
      return `🏷️EP_${marker.toUpperCase()}🏷️`;
    },
  );
}

function preprocessText(text: string): string {
  let processed = text;
  processed = _cleanMarkers(processed);
  processed = markEpistemics(processed);
  processed = markTimecodes(processed);
  return processed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

function createComponents(onTimecodeClick?: (seconds: number) => void) {
  // Parse timecodes + epistemic markers in text
  const parseInlineTokens = (text: string): React.ReactNode[] => {
    if (typeof text !== "string") return [text];

    // Split on both timecodes and epistemic tokens
    const parts = text.split(/(⏱️\d+⏱️[\d:]+⏱️|🏷️EP_[A-ZÀ-Ü ]+🏷️)/g);

    return parts.map((part, i) => {
      // Timecode
      const tcMatch = part.match(/⏱️(\d+)⏱️([\d:]+)⏱️/);
      if (tcMatch) {
        const seconds = parseInt(tcMatch[1], 10);
        const display = tcMatch[2];
        return (
          <button
            key={i}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTimecodeClick?.(seconds);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 10px",
              margin: "0 3px",
              borderRadius: "6px",
              background: "rgba(96, 165, 250, 0.12)",
              color: "#60a5fa",
              fontFamily: "ui-monospace, monospace",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid rgba(96, 165, 250, 0.25)",
              cursor: onTimecodeClick ? "pointer" : "default",
              transition: "all 0.2s ease",
              verticalAlign: "middle",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(96, 165, 250, 0.25)";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(96, 165, 250, 0.12)";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title={`▶ Aller à ${display}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {display}
          </button>
        );
      }

      // Epistemic marker
      const epMatch = part.match(/🏷️EP_([A-ZÀ-Ü ]+)🏷️/);
      if (epMatch) {
        const markerKey = epMatch[1];
        const config = EPISTEMIC_MARKERS[markerKey];
        if (config) {
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 12px",
                margin: "0 3px",
                borderRadius: "6px",
                background: config.bg,
                border: `1px solid ${config.borderColor}`,
                borderLeft: `3px solid ${config.color}`,
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.3px",
                textTransform: "uppercase" as const,
                verticalAlign: "middle",
                color: config.color,
              }}
            >
              <span style={{ fontSize: "13px" }}>{config.emoji}</span>
              {config.label}
            </span>
          );
        }
      }

      return part;
    });
  };

  const enrichChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") return parseInlineTokens(children);
    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <React.Fragment key={i}>{enrichChildren(child)}</React.Fragment>
      ));
    }
    return children;
  };

  // Get text content from children for emoji detection
  const getTextContent = (children: React.ReactNode): string => {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(getTextContent).join("");
    if (
      React.isValidElement<{ children?: React.ReactNode }>(children) &&
      children.props?.children
    ) {
      return getTextContent(children.props.children);
    }
    return "";
  };

  return {
    p: ({ children, ...props }: any) => (
      <p
        {...props}
        style={{ margin: "0.75em 0", lineHeight: 1.75, color: "#e2e8f0" }}
      >
        {enrichChildren(children)}
      </p>
    ),

    // Headers with auto-emojis
    h1: ({ children, ...props }: any) => {
      const emoji = getHeaderEmoji(getTextContent(children));
      return (
        <h1
          {...props}
          style={{
            fontSize: "1.5em",
            fontWeight: 700,
            margin: "1.2em 0 0.6em",
            color: "#f1f5f9",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "0.4em",
            lineHeight: 1.3,
          }}
        >
          {emoji}
          {"  "}
          {enrichChildren(children)}
        </h1>
      );
    },
    h2: ({ children, ...props }: any) => {
      const emoji = getHeaderEmoji(getTextContent(children));
      return (
        <h2
          {...props}
          style={{
            fontSize: "1.3em",
            fontWeight: 700,
            margin: "1em 0 0.5em",
            color: "#f1f5f9",
            lineHeight: 1.3,
          }}
        >
          {emoji}
          {"  "}
          {enrichChildren(children)}
        </h2>
      );
    },
    h3: ({ children, ...props }: any) => (
      <h3
        {...props}
        style={{
          fontSize: "1.1em",
          fontWeight: 600,
          margin: "0.8em 0 0.4em",
          color: "#a5b4fc",
          lineHeight: 1.3,
        }}
      >
        {enrichChildren(children)}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4
        {...props}
        style={{
          fontSize: "1em",
          fontWeight: 600,
          margin: "0.6em 0 0.3em",
          color: "#cbd5e1",
        }}
      >
        {enrichChildren(children)}
      </h4>
    ),

    // Lists
    ul: ({ children, ...props }: any) => (
      <ul
        {...props}
        style={{
          margin: "0.5em 0",
          paddingLeft: "1.5em",
          listStyleType: "disc",
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol {...props} style={{ margin: "0.5em 0", paddingLeft: "1.5em" }}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li
        {...props}
        style={{ margin: "0.3em 0", lineHeight: 1.7, color: "#e2e8f0" }}
      >
        {enrichChildren(children)}
      </li>
    ),

    // Emphasis
    strong: ({ children, ...props }: any) => (
      <strong {...props} style={{ fontWeight: 700, color: "#f0f0ff" }}>
        {enrichChildren(children)}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em {...props} style={{ fontStyle: "italic", color: "#94a3b8" }}>
        {enrichChildren(children)}
      </em>
    ),

    // Blockquote — violet accent
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        {...props}
        style={{
          margin: "0.8em 0",
          padding: "0.6em 1em",
          borderLeft: "3px solid #8b5cf6",
          background: "rgba(139, 92, 246, 0.06)",
          borderRadius: "0 6px 6px 0",
          fontStyle: "italic",
          color: "#94a3b8",
        }}
      >
        {enrichChildren(children)}
      </blockquote>
    ),

    // Code
    code: ({ inline, children, ...props }: any) => {
      if (inline) {
        return (
          <code
            {...props}
            style={{
              padding: "0.15em 0.4em",
              background: "rgba(139, 92, 246, 0.12)",
              borderRadius: 5,
              fontSize: "0.9em",
              fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
              color: "#a78bfa",
            }}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          {...props}
          style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}
        >
          {children}
        </code>
      );
    },

    // Links
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
        style={{
          color: "#60a5fa",
          textDecoration: "none",
          borderBottom: "1px solid rgba(96, 165, 250, 0.3)",
        }}
      >
        {enrichChildren(children)}
      </a>
    ),

    // Table
    table: ({ children, ...props }: any) => (
      <div style={{ overflowX: "auto", margin: "1em 0" }}>
        <table {...props} style={{ borderCollapse: "collapse", width: "100%" }}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th
        {...props}
        style={{
          padding: "0.5em 1em",
          background: "rgba(139, 92, 246, 0.08)",
          borderBottom: "2px solid rgba(139, 92, 246, 0.2)",
          textAlign: "left",
          fontWeight: 600,
        }}
      >
        {enrichChildren(children)}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td
        {...props}
        style={{
          padding: "0.5em 1em",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {enrichChildren(children)}
      </td>
    ),

    // HR
    hr: (props: any) => (
      <hr
        {...props}
        style={{
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          margin: "1.5em 0",
        }}
      />
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const EnrichedMarkdown: React.FC<EnrichedMarkdownProps> = memo(
  ({ children = "", onTimecodeClick, className = "" }) => {
    const processedText = useMemo(() => {
      if (!children || typeof children !== "string") return "";
      return preprocessText(children);
    }, [children]);

    const components = useMemo(
      () => createComponents(onTimecodeClick),
      [onTimecodeClick],
    );

    if (!processedText) return null;

    return (
      <div
        className={`enriched-markdown ${className}`}
        style={{ color: "#e2e8f0", fontSize: 15, lineHeight: 1.75 }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {processedText}
        </ReactMarkdown>
      </div>
    );
  },
);

EnrichedMarkdown.displayName = "EnrichedMarkdown";
export default EnrichedMarkdown;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const CONCEPT_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
const TIMECODE_REGEX = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

export const cleanConceptMarkers = (text: string): string => {
  if (!text) return "";
  return text.replace(CONCEPT_REGEX, (_, term, display) => display || term);
};

export const cleanTimecodeMarkers = (text: string): string => {
  if (!text) return "";
  return text.replace(TIMECODE_REGEX, (match) => match.slice(1, -1));
};

export const extractConcepts = (text: string): string[] => {
  if (!text) return [];
  const terms: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CONCEPT_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    terms.push(match[1].trim());
  }
  return [...new Set(terms)];
};
