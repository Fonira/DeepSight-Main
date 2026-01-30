/**
 * 🔮 SMART INPUT BAR v4.1 - FIX PLAYLIST URL
 * Barre d'entrée ultra-intelligente avec détection automatique
 *
 * ✨ FIX v4.1:
 * - Ajout pattern youtube.com/playlist?list= pour playlists
 * - Meilleure détection des URLs de playlists
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Link2, FileText, Search, ChevronDown,
  Globe, Sparkles, Info, ArrowRight, Wand2
} from 'lucide-react';
import { DeepSightSpinner, DeepSightSpinnerMicro, DeepSightSpinnerSmall } from './ui';

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

// 🔧 FIX: Ajout des patterns de playlists YouTube
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
    icon: Search,
    label: { fr: '🔍 Recherche', en: '🔍 Search' },
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    hoverBorder: 'hover:border-violet-500/50',
    focusBorder: 'focus-within:border-violet-500/60',
    gradient: 'from-violet-500 to-purple-600',
    placeholder: { fr: 'Recherchez un sujet: "IA", "climat", "économie"...', en: 'Search a topic: "AI", "climate", "economy"...' },
  },
  url: {
    icon: Link2,
    label: { fr: 'URL YouTube', en: 'YouTube URL' },
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    hoverBorder: 'hover:border-red-500/50',
    focusBorder: 'focus-within:border-red-500/60',
    gradient: 'from-red-500 to-rose-600',
    placeholder: { fr: 'https://youtube.com/watch?v=... ou playlist?list=...', en: 'https://youtube.com/watch?v=... or playlist?list=...' },
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
    placeholder: { fr: 'Collez votre texte ici (article, transcription, notes...)', en: 'Paste your text here (article, transcript, notes...)' },
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const detectInputMode = (input: string): InputMode => {
  if (!input || input.trim().length === 0) return 'search';

  const trimmed = input.trim();

  // 🔧 FIX: Check YouTube URL first (inclut playlists)
  for (const pattern of YOUTUBE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'url';
    }
  }

  // Non-YouTube URLs → treat as search query
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  const config = MODE_CONFIG[value.mode];
  const ModeIcon = config.icon;

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
  const canSubmit = inputVal.trim().length > 0 && !loading && !disabled;
  const isTextMode = value.mode === 'text';
  const isSearchMode = value.mode === 'search';
  const charCount = inputVal.length;

  // Credit info
  const creditCost = value.mode === 'search' ? 0 : 1;
  const hasEnoughCredits = creditCost === 0 || userCredits >= creditCost;

  return (
    <div className="space-y-3">
      {/* Main Input Area */}
      <div className={`relative rounded-xl border-2 transition-all duration-300 bg-bg-secondary/50 backdrop-blur-sm ${config.borderColor} ${config.focusBorder}`}>

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
              <ModeIcon className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">
                {config.label[language]}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showModeSelector ? 'rotate-180' : ''}`} />
            </button>

            {/* Mode Dropdown */}
            {showModeSelector && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-bg-elevated border border-border-default rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2">
                  {MODE_ORDER.map((mode) => {
                    const modeConf = MODE_CONFIG[mode];
                    const Icon = modeConf.icon;
                    const isActive = value.mode === mode;

                    return (
                      <button
                        key={mode}
                        onClick={() => selectMode(mode)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          isActive
                            ? `${modeConf.bgColor} ${modeConf.textColor}`
                            : 'hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">{modeConf.label[language]}</div>
                          <div className="text-xs opacity-70">
                            {mode === 'url' && (language === 'fr' ? 'Vidéo ou playlist YouTube' : 'YouTube video or playlist')}
                            {mode === 'text' && (language === 'fr' ? 'Article, notes...' : 'Article, notes...')}
                            {mode === 'search' && (language === 'fr' ? 'Découverte intelligente 🆓' : 'Smart discovery 🆓')}
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

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || !hasEnoughCredits}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all ${
              canSubmit && hasEnoughCredits
                ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg hover:shadow-xl hover:scale-105`
                : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
            }`}
          >
            {loading ? (
              <DeepSightSpinnerMicro />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Bottom Bar - Context Info */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle bg-bg-tertiary/30 text-xs">

          {/* Left: Mode hint */}
          <div className="flex items-center gap-2 text-text-muted">
            {autoDetected && (
              <>
                <Wand2 className="w-3 h-3" />
                <span>{language === 'fr' ? 'Détection auto' : 'Auto-detect'}</span>
              </>
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
              <span>{charCount.toLocaleString()} {language === 'fr' ? 'caractères' : 'chars'}</span>
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
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-text-muted" />
              <div className="flex gap-1">
                {SEARCH_LANGUAGES.map((lang) => {
                  const isSelected = (value.searchLanguages || ['fr', 'en']).includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLanguage(lang.code)}
                      className={`px-2 py-1 rounded-md text-sm transition-all ${
                        isSelected
                          ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/50'
                          : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
                      }`}
                      title={lang.name}
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
