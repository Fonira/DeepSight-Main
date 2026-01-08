/**
 * 📚 ENRICHED MARKDOWN v12.0 — VERSION SIMPLIFIÉE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 🔧 NOUVELLE APPROCHE v12.0:
 *   - Les [[concepts]] sont NETTOYÉS (retirés) du texte
 *   - Les définitions sont affichées dans ConceptsGlossary séparément
 *   - Plus de parsing complexe = Plus de bugs !
 *   - Seuls les [MM:SS] timecodes restent cliquables inline
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EnrichedMarkdownProps {
  children: string;
  language?: 'fr' | 'en';
  onTimecodeClick?: (seconds: number) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 PRÉ-PROCESSEUR DE TEXTE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Nettoie les marqueurs [[concept]] du texte (version interne)
 * [[Sam Altman]] → Sam Altman
 * [[OpenAI|la société OpenAI]] → la société OpenAI
 */
function _cleanMarkers(text: string): string {
  if (!text) return '';
  
  // Pattern pour [[term]] ou [[term|display]]
  const pattern = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
  
  return text.replace(pattern, (_, term, display) => display || term);
}

/**
 * Convertit les [MM:SS] en marqueurs spéciaux pour le rendu
 */
function markTimecodes(text: string): string {
  if (!text) return '';
  
  // Regex pour [MM:SS] ou [H:MM:SS]
  const timecodeRegex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;
  
  return text.replace(timecodeRegex, (match, p1, p2, p3) => {
    const part1 = parseInt(p1, 10);
    const part2 = parseInt(p2, 10);
    const part3 = p3 ? parseInt(p3, 10) : undefined;
    
    let seconds: number;
    let display: string;
    
    if (part3 !== undefined) {
      // H:MM:SS
      seconds = part1 * 3600 + part2 * 60 + part3;
      display = `${p1}:${p2}:${p3}`;
    } else {
      // MM:SS
      seconds = part1 * 60 + part2;
      display = `${p1}:${p2}`;
    }
    
    // Marqueur spécial qu'on interceptera dans les composants
    return `⏱️${seconds}⏱️${display}⏱️`;
  });
}

/**
 * Pré-traite le texte avant le rendu markdown
 */
function preprocessText(text: string): string {
  let processed = text;
  
  // 1. Nettoyer les [[concepts]]
  processed = _cleanMarkers(processed);
  
  // 2. Marquer les timecodes
  processed = markTimecodes(processed);
  
  return processed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANTS REACT-MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

function createComponents(onTimecodeClick?: (seconds: number) => void) {
  // Parser les timecodes dans le texte
  const parseTimecodes = (text: string): React.ReactNode[] => {
    if (typeof text !== 'string') return [text];
    
    const parts = text.split(/(⏱️\d+⏱️[\d:]+⏱️)/g);
    
    return parts.map((part, i) => {
      const match = part.match(/⏱️(\d+)⏱️([\d:]+)⏱️/);
      if (match) {
        const seconds = parseInt(match[1], 10);
        const display = match[2];
        
        return (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTimecodeClick?.(seconds); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 10px',
              margin: '0 3px',
              borderRadius: '6px',
              background: 'rgba(251, 191, 36, 0.15)',
              color: '#fbbf24',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid rgba(251, 191, 36, 0.3)',
              cursor: onTimecodeClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              verticalAlign: 'middle',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.3)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.15)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={`▶ Aller à ${display}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            {display}
          </button>
        );
      }
      return part;
    });
  };

  // Enrichir les children avec timecodes
  const enrichChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      return parseTimecodes(children);
    }
    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <React.Fragment key={i}>{enrichChildren(child)}</React.Fragment>
      ));
    }
    return children;
  };

  return {
    // Paragraphes avec timecodes
    p: ({ children, ...props }: any) => (
      <p {...props} style={{ margin: '0.75em 0', lineHeight: 1.7 }}>
        {enrichChildren(children)}
      </p>
    ),
    
    // Headers
    h1: ({ children, ...props }: any) => (
      <h1 {...props} style={{ fontSize: '1.5em', fontWeight: 700, margin: '1em 0 0.5em', color: '#f1f5f9' }}>
        {enrichChildren(children)}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 {...props} style={{ fontSize: '1.3em', fontWeight: 700, margin: '1em 0 0.5em', color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3em' }}>
        {enrichChildren(children)}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 {...props} style={{ fontSize: '1.1em', fontWeight: 600, margin: '0.8em 0 0.4em', color: '#e2e8f0' }}>
        {enrichChildren(children)}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 {...props} style={{ fontSize: '1em', fontWeight: 600, margin: '0.6em 0 0.3em', color: '#cbd5e1' }}>
        {enrichChildren(children)}
      </h4>
    ),
    
    // Listes
    ul: ({ children, ...props }: any) => (
      <ul {...props} style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol {...props} style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => (
      <li {...props} style={{ margin: '0.3em 0', lineHeight: 1.6 }}>
        {enrichChildren(children)}
      </li>
    ),
    
    // Styles
    strong: ({ children, ...props }: any) => (
      <strong {...props} style={{ fontWeight: 700, color: '#f8fafc' }}>
        {enrichChildren(children)}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em {...props} style={{ fontStyle: 'italic', color: '#94a3b8' }}>
        {enrichChildren(children)}
      </em>
    ),
    
    // Blockquote
    blockquote: ({ children, ...props }: any) => (
      <blockquote {...props} style={{ 
        margin: '0.8em 0', 
        padding: '0.5em 1em', 
        borderLeft: '3px solid #3b82f6', 
        background: 'rgba(59, 130, 246, 0.1)', 
        borderRadius: '0 6px 6px 0', 
        fontStyle: 'italic', 
        color: '#94a3b8' 
      }}>
        {enrichChildren(children)}
      </blockquote>
    ),
    
    // Code
    code: ({ inline, children, ...props }: any) => {
      if (inline) {
        return (
          <code {...props} style={{ 
            padding: '0.15em 0.4em', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: 4, 
            fontSize: '0.9em', 
            fontFamily: 'ui-monospace, monospace' 
          }}>
            {children}
          </code>
        );
      }
      return (
        <code {...props} style={{ fontFamily: 'ui-monospace, monospace' }}>
          {children}
        </code>
      );
    },
    
    // Liens
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
        style={{
          color: '#60a5fa',
          textDecoration: 'none',
          borderBottom: '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        {enrichChildren(children)}
      </a>
    ),
    
    // Table
    table: ({ children, ...props }: any) => (
      <div style={{ overflowX: 'auto', margin: '1em 0' }}>
        <table {...props} style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th {...props} style={{ 
        padding: '0.5em 1em', 
        background: 'rgba(59, 130, 246, 0.2)', 
        borderBottom: '2px solid rgba(59, 130, 246, 0.3)', 
        textAlign: 'left', 
        fontWeight: 600 
      }}>
        {enrichChildren(children)}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td {...props} style={{ padding: '0.5em 1em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {enrichChildren(children)}
      </td>
    ),
    
    // HR
    hr: (props: any) => (
      <hr {...props} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1.5em 0' }} />
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const EnrichedMarkdown: React.FC<EnrichedMarkdownProps> = memo(({
  children = '',
  language = 'fr',
  onTimecodeClick,
  className = '',
}) => {
  // Pré-traiter le texte
  const processedText = useMemo(() => {
    if (!children || typeof children !== 'string') return '';
    return preprocessText(children);
  }, [children]);
  
  // Créer les composants custom
  const components = useMemo(
    () => createComponents(onTimecodeClick),
    [onTimecodeClick]
  );
  
  if (!processedText) return null;
  
  return (
    <div 
      className={`enriched-markdown ${className}`} 
      style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 1.7 }}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        components={components}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
});

EnrichedMarkdown.displayName = 'EnrichedMarkdown';
export default EnrichedMarkdown;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const CONCEPT_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
const TIMECODE_REGEX = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

export const cleanConceptMarkers = (text: string): string => {
  if (!text) return '';
  return text.replace(CONCEPT_REGEX, (_, term, display) => display || term);
};

export const cleanTimecodeMarkers = (text: string): string => {
  if (!text) return '';
  return text.replace(TIMECODE_REGEX, (match) => match.slice(1, -1));
};

export const extractConcepts = (text: string): string[] => {
  if (!text) return [];
  const terms: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CONCEPT_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    terms.push(match[1].trim());
  }
  return [...new Set(terms)];
};
