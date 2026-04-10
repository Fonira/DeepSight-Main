/**
 * 💡 SIDEBAR "LE SAVIEZ-VOUS" — Widget fixe côté droit
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sidebar droite fixe visible sur desktop xl+ (1280px+).
 * Affiche des mots/concepts personnalisés depuis l'historique utilisateur.
 * Design glassmorphism DeepSight, timer visuel, centres d'intérêt.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp, X, Lightbulb, BookOpen } from 'lucide-react';
import { useLoadingWord, LoadingWord as LoadingWordType } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../hooks/useAuth';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CATEGORY CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

const CATEGORY_LABELS_FR: Record<string, string> = {
  cognitive_bias: 'Biais cognitif', science: 'Science', philosophy: 'Philosophie',
  culture: 'Culture', misc: 'Divers', history: 'Histoire', technology: 'Technologie',
  person: 'Personne', company: 'Entreprise', concept: 'Concept', event: 'Événement',
  place: 'Lieu', psychology: 'Psychologie', economics: 'Économie',
  art: 'Art & Créativité', nature: 'Nature & Vivant',
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  cognitive_bias: 'Cognitive bias', science: 'Science', philosophy: 'Philosophy',
  culture: 'Culture', misc: 'Miscellaneous', history: 'History', technology: 'Technology',
  person: 'Person', company: 'Company', concept: 'Concept', event: 'Event',
  place: 'Place', psychology: 'Psychology', economics: 'Economics',
  art: 'Art & Creativity', nature: 'Nature & Life',
};

// Pages où la sidebar ne doit PAS s'afficher
const EXCLUDED_PATHS = ['/upgrade', '/admin', '/analytics', '/usage', '/login', '/legal', '/about', '/contact', '/status', '/api-docs', '/payment', '/extension-welcome'];

const REFRESH_INTERVAL_MS = 60_000; // 60 secondes

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 HELPER: Extraire le nom du site depuis une URL
// ═══════════════════════════════════════════════════════════════════════════════

const extractSourceName = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').replace(/\.org$|\.com$|\.fr$|\.net$|\.edu$/, '');
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch { return 'Source'; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const SidebarDidYouKnow: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentWord, nextWord, isLoading, isSidebarVisible, toggleSidebar, userCategories, historyCount } = useLoadingWord();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [displayedWord, setDisplayedWord] = useState<LoadingWordType | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Timer progress
  const [timerProgress, setTimerProgress] = useState(0);
  const timerStartRef = useRef(Date.now());

  // Animation de transition quand le mot change
  useEffect(() => {
    if (currentWord && currentWord.term !== displayedWord?.term) {
      setIsAnimating(true);
      const timeout = setTimeout(() => {
        setDisplayedWord(currentWord);
        setIsExpanded(false);
        setIsAnimating(false);
        // Reset timer
        timerStartRef.current = Date.now();
        setTimerProgress(0);
      }, 200);
      return () => clearTimeout(timeout);
    } else if (currentWord && !displayedWord) {
      setDisplayedWord(currentWord);
      timerStartRef.current = Date.now();
    }
  }, [currentWord, displayedWord]);

  // Timer progress bar (60s)
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const progress = Math.min(100, (elapsed / REFRESH_INTERVAL_MS) * 100);
      setTimerProgress(progress);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Ne pas afficher si non authentifié
  if (!isAuthenticated) return null;

  // Ne pas afficher sur les pages exclues
  const isExcluded = EXCLUDED_PATHS.some(p => location.pathname.startsWith(p));
  if (isExcluded) return null;

  // Ne pas afficher sur la landing page
  if (location.pathname === '/') return null;

  const categoryLabels = language === 'fr' ? CATEGORY_LABELS_FR : CATEGORY_LABELS_EN;

  // Bouton flottant pour rouvrir la sidebar (quand fermée, desktop only)
  if (!isSidebarVisible) {
    return (
      <button
        onClick={toggleSidebar}
        className="hidden xl:flex fixed bottom-6 right-6 z-30 items-center gap-2 px-4 py-2.5 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
        title={language === 'fr' ? 'Ouvrir Le saviez-vous ?' : 'Open Did you know?'}
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.9))',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
        }}
      >
        <Lightbulb className="w-4 h-4 text-white" />
        <span className="text-xs font-medium text-white">
          {language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?'}
        </span>
      </button>
    );
  }

  // Source info
  const getSourceInfo = () => {
    if (!displayedWord) return null;
    if (displayedWord.wikiUrl) {
      return { url: displayedWord.wikiUrl, name: extractSourceName(displayedWord.wikiUrl) };
    }
    const wikiLang = language === 'fr' ? 'fr' : 'en';
    return {
      url: `https://${wikiLang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(displayedWord.term)}`,
      name: 'Wikipedia',
    };
  };

  const sourceInfo = displayedWord ? getSourceInfo() : null;
  const isClickable = displayedWord?.source === 'history' && displayedWord?.summaryId;
  const hasFullDefinition = displayedWord?.definition && displayedWord.definition.length > 80;
  const categoryIcon = displayedWord ? (CATEGORY_ICONS[displayedWord.category] || '📚') : '📚';
  const categoryLabel = displayedWord ? (categoryLabels[displayedWord.category] || displayedWord.category) : '';

  const handleNavigate = () => {
    if (isClickable && displayedWord?.summaryId) {
      navigate(`/dashboard?id=${displayedWord.summaryId}`);
    }
  };

  const handleNext = useCallback(() => {
    timerStartRef.current = Date.now();
    setTimerProgress(0);
    nextWord();
  }, [nextWord]);

  // Top 4 catégories pour "Vos centres d'intérêt"
  const topCategories = userCategories.slice(0, 4);

  return (
    <aside className="hidden xl:flex fixed right-0 top-0 h-screen w-[280px] z-30 flex-col border-l border-white/[0.06] bg-[#0c0c14]/95 backdrop-blur-xl">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}>
            <Lightbulb className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white/90">
            {language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNext}
            className="p-1.5 rounded-md text-white/40 hover:text-cyan-400 hover:bg-white/[0.06] active:scale-90 transition-all"
            title={language === 'fr' ? 'Suivant' : 'Next'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
            title={language === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══ TIMER PROGRESS BAR ═══ */}
      <div className="h-[2px] bg-white/[0.03] relative">
        <div
          className="h-full transition-all duration-500 ease-linear rounded-r"
          style={{
            width: `${timerProgress}%`,
            background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
          }}
        />
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!displayedWord ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-2 text-xs text-white/30">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{language === 'fr' ? 'Chargement...' : 'Loading...'}</span>
            </div>
          </div>
        ) : (
          <div className={`transition-all duration-200 ${isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>

            {/* Category badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                <span>{categoryIcon}</span>
                <span>{categoryLabel}</span>
              </span>
              {displayedWord.source === 'history' && (
                <span className="text-[10px] text-violet-400/80 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {language === 'fr' ? 'De vos analyses' : 'From your analyses'}
                </span>
              )}
            </div>

            {/* Term */}
            <button
              onClick={handleNavigate}
              disabled={!isClickable}
              className={`
                text-left w-full mb-2
                ${isClickable ? 'cursor-pointer group' : 'cursor-default'}
              `}
              title={isClickable ? (language === 'fr' ? 'Voir l\'analyse' : 'View analysis') : undefined}
            >
              <h3 className={`text-base font-semibold leading-snug ${isClickable ? 'text-cyan-300 group-hover:text-cyan-200 transition-colors' : 'text-white/90'}`}>
                <span className="text-violet-400/70">«</span>
                <span className={isClickable ? 'underline decoration-dotted decoration-cyan-500/40 group-hover:decoration-cyan-400' : ''}>
                  {' '}{displayedWord.term}{' '}
                </span>
                <span className="text-violet-400/70">»</span>
                {isClickable && (
                  <span className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400">→</span>
                )}
              </h3>
            </button>

            {/* Video title (if from history) */}
            {displayedWord.source === 'history' && displayedWord.videoTitle && (
              <button
                onClick={handleNavigate}
                className="w-full text-left text-xs text-violet-300/60 hover:text-violet-300/90 transition-colors mb-3 flex items-center gap-1.5 group"
              >
                <span className="text-sm">📹</span>
                <span className="truncate flex-1 underline decoration-dotted decoration-violet-400/30 group-hover:decoration-solid">
                  {displayedWord.videoTitle}
                </span>
              </button>
            )}

            {/* Definition */}
            <div className="text-[13px] text-white/60 leading-relaxed mb-3">
              {isExpanded ? (
                <p className="whitespace-pre-wrap">{displayedWord.definition}</p>
              ) : (
                <p className="line-clamp-3">{displayedWord.shortDefinition}</p>
              )}
            </div>

            {/* Expand/collapse */}
            {hasFullDefinition && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mb-3"
              >
                {isExpanded ? (
                  <><ChevronUp className="w-3 h-3" />{language === 'fr' ? 'Réduire' : 'Show less'}</>
                ) : (
                  <><ChevronDown className="w-3 h-3" />{language === 'fr' ? 'Lire la suite...' : 'Read more...'}</>
                )}
              </button>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              {isClickable && (
                <button
                  onClick={handleNavigate}
                  className="text-xs bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 px-3 py-1.5 rounded-md transition-colors border border-indigo-500/20"
                >
                  {language === 'fr' ? 'Voir l\'analyse' : 'View analysis'}
                </button>
              )}

              {sourceInfo && (
                <a
                  href={sourceInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-white/30 hover:text-cyan-400 transition-colors ml-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{sourceInfo.name}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ CENTRES D'INTÉRÊT (si historique) ═══ */}
      {topCategories.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2 font-medium">
            {language === 'fr' ? 'Vos centres d\'intérêt' : 'Your interests'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topCategories.map(({ category, count }) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]"
                title={`${count} ${language === 'fr' ? 'concepts' : 'concepts'}`}
              >
                <span>{CATEGORY_ICONS[category] || '📚'}</span>
                <span>{categoryLabels[category] || category}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-center">
        <span className="text-[10px] text-white/20">
          📚 {historyCount > 0
            ? `${historyCount} ${language === 'fr' ? 'concepts explorés' : 'concepts explored'}`
            : (language === 'fr' ? '80 concepts disponibles' : '80 concepts available')
          }
        </span>
      </div>

      {/* Decorative gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-indigo-500/50 via-cyan-500/50 to-violet-500/50" />
    </aside>
  );
};

export default SidebarDidYouKnow;
