/**
 * 🔮 SMART INPUT BAR v4.2 - UX FIXES
 * Barre d'entrée ultra-intelligente avec détection automatique
 *
 * ✨ FIX v4.2:
 * - Bordure URL : neutre par défaut, rouge seulement après submit invalide, verte si URL YouTube valide
 * - Tooltip descriptif sur le sélecteur de langues
 * - Label "Langue de l'analyse" visible au-dessus des drapeaux
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Link2, FileText, Search, ChevronDown,
  Globe, Sparkles, Info, ArrowRight, Wand2, Play
} from 'lucide-react';
import { DeepSightSpinnerMicro } from './ui';

// ═══════════════════════════════════════════════════════════════════
// 🎬 PLATFORM ICONS — YouTube & TikTok inline SVGs
// ═══════════════════════════════════════════════════════════════════

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/>
  </svg>
);

const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.11v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.24 8.24 0 0 0 4.83 1.56V7.09a4.84 4.84 0 0 1-1.07-.4z"/>
  </svg>
);

/** Renders the correct icon for a given mode */
const ModeIconRenderer: React.FC<{ mode: InputMode; className?: string }> = ({ mode, className = 'w-4 h-4' }) => {
  switch (mode) {
    case 'search':
      return <YouTubeIcon className={className} />;
    case 'url':
      return (
        <span className="flex items-center gap-0.5">
          <YouTubeIcon className={className} />
          <TikTokIcon className={className} />
        </span>
      );
    case 'text':
      return <FileText className={className} />;
    default:
      return <Search className={className} />;
  }
};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type InputMode = 'url' | 'text' | 'search';

export interface SmartInputValue {
  mode: InputMode;
  url?: string;
  rawText?: string;
  textTitle?: string;
  textSource?: string;
  searchQuery?: string;
  searchLanguages?: string[];
}

interface SmartInputBarProps {
  value: SmartInputValue;
  onChange: (value: SmartInputValue) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  userCredits?: number;
  language?: 'fr' | 'en';
  placeholder?: string;
  showLanguageSelector?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// 🔧 FIX: Ajout des patterns de playlists YouTube + 🎵 TikTok
const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?v=/i,
  /youtu\.be\//i,
  /youtube\.com\/embed\//i,
  /youtube\.com\/shorts\//i,
  /youtube\.com\/live\//i,
  // 🆕 PATTERNS PLAYLISTS
  /youtube\.com\/playlist\?list=/i,
  /youtube\.com\/watch\?.*list=/i,  // vidéo avec playlist
  /[?&]list=[A-Za-z0-9_-]+/i,       // paramètre list= dans l'URL
];

// 🎵 Patterns TikTok
const TIKTOK_PATTERNS = [
  /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
  /vm\.tiktok\.com\/[\w-]+/i,
  /m\.tiktok\.com\/v\/\d+/i,
  /tiktok\.com\/t\/[\w-]+/i,
  /tiktok\.com\/video\/\d+/i,
];

// Tous les patterns vidéo supportés (YouTube + TikTok)
const ALL_VIDEO_PATTERNS = [...YOUTUBE_PATTERNS, ...TIKTOK_PATTERNS];

const SEARCH_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
];

// Ordre des modes dans le dropdown (search en premier)
const MODE_ORDER: InputMode[] = ['search', 'url', 'text'];

const MODE_CONFIG = {
  search: {
    icon: null, // Custom YouTube icon rendered inline
    label: { fr: 'Recherche YouTube', en: 'YouTube Search' },
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-violet-500/30',
    hoverBorder: 'hover:border-violet-500/50',
    focusBorder: 'focus-within:border-violet-500/60',
    gradient: 'from-red-600 to-red-500',
    placeholder: { fr: 'Recherchez un sujet: "IA", "climat", "économie"...', en: 'Search a topic: "AI", "climate", "economy"...' },
  },
  url: {
    icon: null, // Custom YouTube+TikTok icons rendered inline
    label: { fr: 'URL Vidéo', en: 'Video URL' },
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    // Bordure dynamique gérée via getDynamicBorderClasses()
    borderColor: 'border-border-default',
    hoverBorder: 'hover:border-border-hover',
    focusBorder: 'focus-within:border-accent-primary/60',
    gradient: 'from-emerald-500 to-green-600',
    placeholder: { fr: 'YouTube, TikTok... collez votre lien ici', en: 'YouTube, TikTok... paste your link here' },
  },
  text: {
    icon: FileText,
    label: { fr: 'Texte', en: 'Text' },
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    hoverBorder: 'hover:border-blue-500/50',
    focusBorder: 'focus-within:border-blue-500/60',
    gradient: 'from-blue-500 to-cyan-600',
    placeholder: { fr: 'Collez votre texte ici (min. 100 caractères)', en: 'Paste your text here (min. 100 characters)' },
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const detectInputMode = (input: string): InputMode => {
  if (!input || input.trim().length === 0) return 'search';

  const trimmed = input.trim();

  // 🔧 FIX: Check YouTube/TikTok URL first (inclut playlists)
  for (const pattern of ALL_VIDEO_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'url';
    }
  }

  // Non-video URLs → treat as search query
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'search';
  }

  // Long text (>200 chars) → text mode
  if (trimmed.length > 200) {
    return 'text';
  }

  // Short text → search mode
  return 'search';
};

const getInputValue = (value: SmartInputValue): string => {
  switch (value.mode) {
    case 'url': return value.url || '';
    case 'text': return value.rawText || '';
    case 'search': return value.searchQuery || '';
    default: return '';
  }
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

// Helper : teste si une URL est une URL vidéo valide (YouTube ou TikTok)
const isValidVideoUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) return false;
  return ALL_VIDEO_PATTERNS.some(pattern => pattern.test(url.trim()));
};

// 🎵 Helper : détecte si c'est TikTok
const isTikTokUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) return false;
  return TIKTOK_PATTERNS.some(pattern => pattern.test(url.trim()));
};

// Backward compat
const isValidYouTubeUrl = isValidVideoUrl;

const SmartInputBar: React.FC<SmartInputBarProps> = ({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  userCredits = 0,
  language = 'fr',
  showLanguageSelector = true,
}) => {
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [autoDetected, setAutoDetected] = useState(true);
  // État de soumission : la bordure rouge n'apparaît qu'après une tentative invalide
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  const config = MODE_CONFIG[value.mode];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(56, textareaRef.current.scrollHeight), 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Close mode selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeSelectorRef.current && !modeSelectorRef.current.contains(e.target as Node)) {
        setShowModeSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change with auto-detection
  const handleInputChange = useCallback((text: string) => {
    if (autoDetected) {
      const detectedMode = detectInputMode(text);
      const newValue: SmartInputValue = {
        ...value,
        mode: detectedMode,
        searchLanguages: value.searchLanguages || ['fr', 'en'],
      };

      switch (detectedMode) {
        case 'url':
          newValue.url = text;
          newValue.rawText = undefined;
          newValue.searchQuery = undefined;
          break;
        case 'text':
          newValue.rawText = text;
          newValue.url = undefined;
          newValue.searchQuery = undefined;
          break;
        case 'search':
          newValue.searchQuery = text;
          newValue.url = undefined;
          newValue.rawText = undefined;
          break;
      }

      onChange(newValue);
    } else {
      // Manual mode - keep current mode
      const newValue = { ...value };
      switch (value.mode) {
        case 'url': newValue.url = text; break;
        case 'text': newValue.rawText = text; break;
        case 'search': newValue.searchQuery = text; break;
      }
      onChange(newValue);
    }
  }, [value, onChange, autoDetected]);

  // Manual mode selection
  const selectMode = useCallback((mode: InputMode) => {
    setAutoDetected(false);
    setShowModeSelector(false);

    const currentText = getInputValue(value);
    const newValue: SmartInputValue = {
      mode,
      searchLanguages: value.searchLanguages || ['fr', 'en'],
    };

    switch (mode) {
      case 'url': newValue.url = currentText; break;
      case 'text':
        newValue.rawText = currentText;
        newValue.textTitle = value.textTitle;
        newValue.textSource = value.textSource;
        break;
      case 'search': newValue.searchQuery = currentText; break;
    }

    onChange(newValue);
  }, [value, onChange]);

  // Toggle language selection
  const toggleLanguage = useCallback((code: string) => {
    const current = value.searchLanguages || ['fr', 'en'];
    const updated = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];

    if (updated.length === 0) return; // At least one language required

    onChange({ ...value, searchLanguages: updated });
  }, [value, onChange]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    setHasAttemptedSubmit(true);
    const inputVal = getInputValue(value);
    if (!inputVal.trim() || loading || disabled) return;
    onSubmit();
  }, [value, loading, disabled, onSubmit]);

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Computed values
  const inputVal = getInputValue(value);
  const isTextMode = value.mode === 'text';
  const isSearchMode = value.mode === 'search';
  const isUrlMode = value.mode === 'url';
  const charCount = inputVal.length;

  // Bordure dynamique pour le mode URL : neutre → vert/cyan (URL valide) → rouge (soumis + invalide)
  const getDynamicBorderClasses = (): string => {
    if (!isUrlMode) {
      return `${config.borderColor} ${config.hoverBorder} ${config.focusBorder}`;
    }
    const urlValid = isValidVideoUrl(inputVal);
    if (urlValid) {
      // 🎵 Cyan pour TikTok, vert pour YouTube
      if (isTikTokUrl(inputVal)) {
        return 'border-cyan-500/40 hover:border-cyan-500/60 focus-within:border-cyan-500/70';
      }
      return 'border-green-500/40 hover:border-green-500/60 focus-within:border-green-500/70';
    }
    if (hasAttemptedSubmit && inputVal.trim().length > 0) {
      return 'border-red-500/40 hover:border-red-500/60 focus-within:border-red-500/70';
    }
    return 'border-border-default hover:border-border-hover focus-within:border-accent-primary/60';
  };
  const TEXT_MIN_CHARS = 100;
  const textTooShort = isTextMode && charCount > 0 && charCount < TEXT_MIN_CHARS;
  const canSubmit = inputVal.trim().length > 0 && !loading && !disabled && !textTooShort;

  // Credit info
  const creditCost = value.mode === 'search' ? 0 : 1;
  const hasEnoughCredits = creditCost === 0 || userCredits >= creditCost;

  return (
    <div className="space-y-3">
      {/* Main Input Area */}
      <div className={`relative rounded-xl border-2 transition-all duration-300 bg-bg-secondary/50 backdrop-blur-sm ${getDynamicBorderClasses()}`}>

        {/* Mode Badge + Input */}
        <div className="flex items-start gap-3 p-4">

          {/* Mode Selector */}
          <div className="relative" ref={modeSelectorRef}>
            <button
              type="button"
              onClick={() => setShowModeSelector(!showModeSelector)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${config.bgColor} ${config.textColor} hover:opacity-80`}
              disabled={disabled}
            >
              <ModeIconRenderer mode={value.mode} className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">
                {config.label[language]}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showModeSelector ? 'rotate-180' : ''}`} />
            </button>

            {/* Mode Dropdown */}
            {showModeSelector && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-bg-elevated border border-border-default rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2">
                  {MODE_ORDER.map((m) => {
                    const modeConf = MODE_CONFIG[m];
                    const isActive = value.mode === m;

                    return (
                      <button
                        key={m}
                        onClick={() => selectMode(m)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          isActive
                            ? `${modeConf.bgColor} ${modeConf.textColor}`
                            : 'hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <ModeIconRenderer mode={m} className="w-4 h-4" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{modeConf.label[language]}</div>
                          <div className="text-xs opacity-70">
                            {m === 'url' && (language === 'fr' ? 'Vidéo YouTube, TikTok ou playlist' : 'YouTube, TikTok video or playlist')}
                            {m === 'text' && (language === 'fr' ? 'Article, notes...' : 'Article, notes...')}
                            {m === 'search' && (language === 'fr' ? 'Trouvez des vidéos par sujet 🆓' : 'Find videos by topic 🆓')}
                          </div>
                        </div>
                        {isActive && <Sparkles className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>

                {/* Auto-detect toggle */}
                <div className="border-t border-border-subtle px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDetected}
                      onChange={(e) => setAutoDetected(e.target.checked)}
                      className="rounded border-border-default text-accent-primary focus:ring-accent-primary"
                    />
                    <span className="text-xs text-text-secondary">
                      {language === 'fr' ? 'Détection auto' : 'Auto-detect'}
                    </span>
                    <Wand2 className="w-3 h-3 text-text-muted" />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputVal}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder[language]}
              disabled={disabled || loading}
              className="w-full bg-transparent border-none outline-none resize-none text-text-primary placeholder:text-text-muted text-base leading-relaxed"
              style={{ minHeight: '24px' }}
              rows={1}
            />
          </div>

          {/* Submit Button — Visible & Explicit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || !hasEnoughCredits}
            className={`flex items-center justify-center gap-2 px-5 h-12 rounded-xl transition-all duration-200 font-semibold text-sm whitespace-nowrap ${
              canSubmit && hasEnoughCredits
                ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg shadow-accent-primary/20 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]`
                : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
            }`}
          >
            {loading ? (
              <DeepSightSpinnerMicro />
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span className="hidden sm:inline">
                  {isSearchMode
                    ? (language === 'fr' ? 'Rechercher' : 'Search')
                    : (language === 'fr' ? 'Analyser' : 'Analyze')
                  }
                </span>
              </>
            )}
          </button>
        </div>

        {/* Bottom Bar - Context Info */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle bg-bg-tertiary/30 text-xs">

          {/* Left: Mode hint + platform badge */}
          <div className="flex items-center gap-2 text-text-muted">
            {autoDetected && (
              <>
                <Wand2 className="w-3 h-3" />
                <span>{language === 'fr' ? 'Détection auto' : 'Auto-detect'}</span>
              </>
            )}

            {/* 🎵 Platform badge quand URL valide */}
            {isUrlMode && isValidVideoUrl(inputVal) && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                isTikTokUrl(inputVal)
                  ? 'bg-cyan-500/15 text-cyan-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}>
                {isTikTokUrl(inputVal) ? '🎵 TikTok' : '▶ YouTube'}
                {' — '}{language === 'fr' ? 'URL valide' : 'Valid URL'}
              </span>
            )}

            {isSearchMode && (
              <span className={`ml-2 px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}>
                {language === 'fr' ? '🆓 Gratuit' : '🆓 Free'}
              </span>
            )}
          </div>

          {/* Right: Stats */}
          <div className="flex items-center gap-3 text-text-muted">
            {isTextMode && charCount > 0 && (
              <span className={textTooShort ? 'text-amber-400' : ''}>
                {charCount.toLocaleString()}/{TEXT_MIN_CHARS} {language === 'fr' ? 'car. min' : 'min chars'}
                {textTooShort && (
                  <span className="ml-1">
                    ({language === 'fr' ? `encore ${TEXT_MIN_CHARS - charCount}` : `${TEXT_MIN_CHARS - charCount} more`})
                  </span>
                )}
              </span>
            )}

            {creditCost > 0 && (
              <span className={hasEnoughCredits ? '' : 'text-red-400'}>
                {creditCost} crédit{creditCost > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Options */}
      {(isTextMode || (isSearchMode && showLanguageSelector)) && (
        <div className="flex flex-wrap items-center gap-3 px-1">

          {/* Text Mode: Title & Source */}
          {isTextMode && (
            <>
              <input
                type="text"
                value={value.textTitle || ''}
                onChange={(e) => onChange({ ...value, textTitle: e.target.value })}
                placeholder={language === 'fr' ? 'Titre (optionnel)' : 'Title (optional)'}
                className="flex-1 min-w-[150px] px-3 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500/50 focus:outline-none"
              />
              <input
                type="text"
                value={value.textSource || ''}
                onChange={(e) => onChange({ ...value, textSource: e.target.value })}
                placeholder={language === 'fr' ? 'Source (optionnel)' : 'Source (optional)'}
                className="flex-1 min-w-[150px] px-3 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500/50 focus:outline-none"
              />
            </>
          )}

          {/* Search Mode: Language Selector */}
          {isSearchMode && showLanguageSelector && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {language === 'fr' ? 'Langue de l\'analyse' : 'Analysis language'}
              </span>
              <div className="flex gap-1">
                {SEARCH_LANGUAGES.map((lang) => {
                  const isSelected = (value.searchLanguages || ['fr', 'en']).includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLanguage(lang.code)}
                      className={`min-w-[44px] min-h-[44px] px-2 py-1 rounded-md text-sm transition-all ${
                        isSelected
                          ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/50'
                          : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
                      }`}
                      title={language === 'fr' ? `Langue de l'analyse : ${lang.name}` : `Analysis language: ${lang.name}`}
                      aria-label={language === 'fr' ? `Analyser en ${lang.name}` : `Analyze in ${lang.name}`}
                      aria-pressed={isSelected}
                    >
                      {lang.flag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Mode Info Banner */}
      {isSearchMode && inputVal.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg text-sm text-violet-300">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            {language === 'fr'
              ? 'La recherche utilise Invidious (sans clé API). Les meilleures vidéos seront classées par qualité académique.'
              : 'Search uses Invidious (no API key). Best videos will be ranked by academic quality.'}
          </span>
        </div>
      )}
    </div>
  );
};

export default SmartInputBar;
