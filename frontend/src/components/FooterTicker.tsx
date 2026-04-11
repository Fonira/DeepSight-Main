/**
 * FooterTicker — Marquee horizontal de termes dans le footer (desktop only).
 * Scroll CSS lent (40s/cycle). Pause au hover. Termes seulement, pas de définitions.
 */

import React, { useMemo } from 'react';
import { useLoadingWord } from '../contexts/LoadingWordContext';

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

export const FooterTicker: React.FC = () => {
  const { getRecentTerms } = useLoadingWord();

  const terms = useMemo(() => getRecentTerms(12), [getRecentTerms]);

  if (terms.length < 3) return null;

  // Duplicate for seamless loop
  const allTerms = [...terms, ...terms];

  return (
    <div className="hidden lg:block overflow-hidden py-2 group">
      <div
        className="flex whitespace-nowrap group-hover:[animation-play-state:paused]"
        style={{
          animation: `footer-ticker-scroll ${terms.length * 4}s linear infinite`,
        }}
      >
        {allTerms.map((term, i) => (
          <React.Fragment key={`${term.term}-${i}`}>
            {term.wikiUrl ? (
              <a
                href={term.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-text-muted/40 hover:text-text-muted/70 transition-colors cursor-pointer mx-3 flex-shrink-0"
              >
                <span>{CAT_ICONS[term.category] || '📚'}</span>
                <span>{term.term}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted/40 mx-3 flex-shrink-0">
                <span>{CAT_ICONS[term.category] || '📚'}</span>
                <span>{term.term}</span>
              </span>
            )}
            <span className="text-accent-primary/20 text-[8px] mx-1 flex-shrink-0">·</span>
          </React.Fragment>
        ))}
      </div>

      <style>{`
        @keyframes footer-ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default FooterTicker;
