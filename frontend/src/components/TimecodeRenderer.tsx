/**
 * ⏱️ TIMECODE RENDERER v2.0 — Détection UNIVERSELLE de timecodes cliquables
 * ═══════════════════════════════════════════════════════════════════════════════
 * Fonctionnalités:
 * - Détection de TOUS les formats: [5:23], (5:23), à 5:23, at 5:23
 * - Mode embedded: contrôle le player YouTube intégré
 * - Mode external: ouvre YouTube dans un nouvel onglet
 * - Style visuel cohérent avec Deep Sight
 * - Compatible avec ReactMarkdown
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { Fragment, useMemo, useCallback } from "react";
import { ExternalLink, Play } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TimecodeMode = "embedded" | "external";

export interface TimecodeInfo {
  original: string;
  seconds: number;
  formatted: string;
  startIndex: number;
  endIndex: number;
}

interface TimecodeRendererProps {
  text: string;
  mode: TimecodeMode;
  videoId?: string;
  onTimecodeClick?: (seconds: number) => void;
  className?: string;
}

interface TimecodeButtonProps {
  info: TimecodeInfo;
  mode: TimecodeMode;
  videoId?: string;
  onClick?: (seconds: number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse un timecode string en secondes
 */
export function parseTimecode(timecode: string): number | null {
  const clean = timecode.replace(/[\[\]\(\)]/g, "").trim();
  const parts = clean.split(":").map(p => parseInt(p, 10));
  
  if (parts.some(isNaN)) return null;
  
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    if (m < 0 || s < 0 || s > 59) return null;
    if (m > 600) return null; // Max 10h de vidéo
    return m * 60 + s;
  }
  
  return null;
}

/**
 * Formate des secondes en timecode lisible
 */
export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Génère l'URL YouTube avec timestamp
 */
export function getYouTubeUrlWithTime(videoId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`;
}

/**
 * 🧠 DÉTECTION UNIVERSELLE DE TIMECODES
 * Détecte tous les formats possibles
 */
export function extractAllTimecodes(text: string): TimecodeInfo[] {
  const matches: TimecodeInfo[] = [];
  
  // Pattern UNIVERSEL qui capture tous les formats de timecodes
  // Capture: [5:23], (5:23), (05:23), à 5:23, at 5:23, vers 5:23, de 5:23, entre 5:23
  // Aussi les formats avec heures: [1:23:45], (1:23:45)
  const universalPattern = /(?:\[|\(|(?:à|À|at|At|vers|Vers|de|De|entre|Entre|from|From|to|To)\s*)(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?/g;
  
  const foundPositions = new Set<string>();
  let match;
  
  while ((match = universalPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const timeStr = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;
    
    const posKey = `${startIndex}`;
    if (foundPositions.has(posKey)) continue;
    
    const seconds = parseTimecode(timeStr);
    
    if (seconds !== null && seconds >= 0 && seconds < 36000) {
      foundPositions.add(posKey);
      
      matches.push({
        original: fullMatch,
        seconds,
        formatted: formatTimecode(seconds),
        startIndex,
        endIndex,
      });
    }
  }
  
  // Trier par position
  matches.sort((a, b) => a.startIndex - b.startIndex);
  
  // Éliminer les chevauchements
  const filtered: TimecodeInfo[] = [];
  let lastEnd = -1;
  
  for (const m of matches) {
    if (m.startIndex >= lastEnd) {
      filtered.push(m);
      lastEnd = m.endIndex;
    }
  }
  
  return filtered;
}

// Alias pour compatibilité
export function extractTimecodes(text: string): TimecodeInfo[] {
  return extractAllTimecodes(text);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 TIMECODE BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const TimecodeButton: React.FC<TimecodeButtonProps> = ({
  info,
  mode,
  videoId,
  onClick,
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (mode === "external" && videoId) {
      window.open(getYouTubeUrlWithTime(videoId, info.seconds), "_blank");
    } else if (onClick) {
      onClick(info.seconds);
    }
  }, [mode, videoId, info, onClick]);

  return (
    <button
      onClick={handleClick}
      className="timecode-btn inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-sm font-mono transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        background: "rgba(0, 212, 170, 0.15)",
        border: "1px solid rgba(0, 212, 170, 0.4)",
        color: "#00d4aa",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0, 212, 170, 0.3)";
        e.currentTarget.style.borderColor = "rgba(0, 212, 170, 0.7)";
        e.currentTarget.style.boxShadow = "0 0 12px rgba(0, 212, 170, 0.5)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(0, 212, 170, 0.15)";
        e.currentTarget.style.borderColor = "rgba(0, 212, 170, 0.4)";
        e.currentTarget.style.boxShadow = "none";
      }}
      title={mode === "embedded" ? `▶ Lire à ${info.formatted}` : `Ouvrir YouTube à ${info.formatted}`}
    >
      {mode === "embedded" ? (
        <Play className="w-3 h-3" fill="currentColor" />
      ) : (
        <ExternalLink className="w-3 h-3" />
      )}
      <span className="font-semibold">{info.formatted}</span>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 MAIN TIMECODE RENDERER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const TimecodeRenderer: React.FC<TimecodeRendererProps> = ({
  text,
  mode,
  videoId,
  onTimecodeClick,
  className = "",
}) => {
  const renderedContent = useMemo(() => {
    if (!text) return null;
    
    const timecodes = extractAllTimecodes(text);
    
    if (timecodes.length === 0) {
      return text;
    }
    
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    
    timecodes.forEach((tc, idx) => {
      if (tc.startIndex > lastIndex) {
        parts.push(text.slice(lastIndex, tc.startIndex));
      }
      
      parts.push(
        <TimecodeButton
          key={`tc-${idx}-${tc.startIndex}`}
          info={tc}
          mode={mode}
          videoId={videoId}
          onClick={onTimecodeClick}
        />
      );
      
      lastIndex = tc.endIndex;
    });
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts;
  }, [text, mode, videoId, onTimecodeClick]);

  return <span className={className}>{renderedContent}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 REACT MARKDOWN COMPONENTS FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crée des composants ReactMarkdown avec timecodes cliquables
 * 
 * Usage:
 * const components = createTimecodeMarkdownComponents({
 *   mode: "embedded",
 *   videoId: "abc123",
 *   onTimecodeClick: (seconds) => playerRef.current?.seekTo(seconds),
 * });
 * 
 * <ReactMarkdown components={components}>{content}</ReactMarkdown>
 */
export function createTimecodeMarkdownComponents(options: {
  mode: TimecodeMode;
  videoId?: string;
  onTimecodeClick?: (seconds: number, info?: TimecodeInfo) => void;
  linkClassName?: string;
}): Record<string, React.ComponentType<any>> {
  const { mode, videoId, onTimecodeClick } = options;
  
  // Wrapper pour le callback - accepte les deux signatures
  const handleClick = (seconds: number) => {
    if (onTimecodeClick) {
      onTimecodeClick(seconds, { seconds, formatted: formatTimecode(seconds), original: '', startIndex: 0, endIndex: 0 });
    }
  };
  
  const wrapWithTimecodes = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") {
      return (
        <TimecodeRenderer
          text={children}
          mode={mode}
          videoId={videoId}
          onTimecodeClick={handleClick}
        />
      );
    }
    
    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <Fragment key={i}>{wrapWithTimecodes(child)}</Fragment>
      ));
    }
    
    return children;
  };
  
  return {
    p: ({ children, ...props }: any) => <p {...props}>{wrapWithTimecodes(children)}</p>,
    li: ({ children, ...props }: any) => <li {...props}>{wrapWithTimecodes(children)}</li>,
    strong: ({ children, ...props }: any) => <strong {...props}>{wrapWithTimecodes(children)}</strong>,
    em: ({ children, ...props }: any) => <em {...props}>{wrapWithTimecodes(children)}</em>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{wrapWithTimecodes(children)}</h1>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{wrapWithTimecodes(children)}</h2>,
    h3: ({ children, ...props }: any) => <h3 {...props}>{wrapWithTimecodes(children)}</h3>,
    h4: ({ children, ...props }: any) => <h4 {...props}>{wrapWithTimecodes(children)}</h4>,
    blockquote: ({ children, ...props }: any) => <blockquote {...props}>{wrapWithTimecodes(children)}</blockquote>,
    td: ({ children, ...props }: any) => <td {...props}>{wrapWithTimecodes(children)}</td>,
    th: ({ children, ...props }: any) => <th {...props}>{wrapWithTimecodes(children)}</th>,
  };
}

export default TimecodeRenderer;
