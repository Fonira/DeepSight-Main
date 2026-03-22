/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 CUSTOMIZATION PANEL v5.0 — Design Premium Glassmorphism                       ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Design: pill selectors, glassmorphism, gradients subtils, animations fluides      ║
 * ║  L1: Focus (pills) + Ton (pills) + Longueur (slider-like) + Langue (inline)       ║
 * ║  L2: Anti-IA toggle + Instructions custom                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Shield,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  MessageSquare,
  RotateCcw,
  Globe,
} from 'lucide-react';
import {
  AnalysisCustomization,
  AnalysisFocus,
  WritingTone,
  TargetLength,
  OutputLanguage,
  ANALYSIS_FOCUS_CONFIG,
  WRITING_TONE_CONFIG,
  TARGET_LENGTH_CONFIG,
  OUTPUT_LANGUAGE_CONFIG,
  DEFAULT_CUSTOMIZATION,
  CUSTOMIZATION_STORAGE_KEY,
  migrateCustomization,
} from '../../types/analysis';

// ═══════════════════════════════════════════════════════════════════════════════

interface CustomizationPanelProps {
  onCustomizationChange: (customization: AnalysisCustomization) => void;
  initialCustomization?: Partial<AnalysisCustomization>;
  language?: 'fr' | 'en';
  disabled?: boolean;
  compact?: boolean;
}

const MAX_PROMPT_LENGTH = 2000;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 PILL SELECTOR — Composant réutilisable
// ═══════════════════════════════════════════════════════════════════════════════

function PillSelector<T extends string>({
  options,
  value,
  onChange,
  disabled,
  language,
  variant = 'default',
}: {
  options: { key: T; emoji: string; label: { fr: string; en: string }; description?: { fr: string; en: string } }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  language: 'fr' | 'en';
  variant?: 'default' | 'compact';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            disabled={disabled}
            aria-pressed={isSelected}
            title={opt.description?.[language]}
            className={`
              inline-flex items-center gap-1.5 rounded-full transition-all duration-200
              ${variant === 'compact' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              ${isSelected
                ? 'bg-bg-hover text-white ring-1 ring-accent-primary/30 shadow-md'
                : 'bg-bg-tertiary text-text-tertiary hover:bg-bg-hover hover:text-text-secondary'
              }
            `}
          >
            <span>{opt.emoji}</span>
            <span className="font-medium">{opt.label[language]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  onCustomizationChange,
  initialCustomization = {},
  language = 'fr',
  disabled = false,
  compact = false,
}) => {
  const loadSavedCustomization = (): AnalysisCustomization => {
    try {
      const saved = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.writingStyle && !parsed.writingTone) {
          const migrated = migrateCustomization(parsed);
          return { ...migrated, ...initialCustomization };
        }
        return { ...DEFAULT_CUSTOMIZATION, ...parsed, ...initialCustomization };
      }
    } catch { /* */ }
    return { ...DEFAULT_CUSTOMIZATION, ...initialCustomization };
  };

  const [customization, setCustomization] = useState<AnalysisCustomization>(loadSavedCustomization);
  const [showMore, setShowMore] = useState(false);

  const baseId = useId();
  const t = useCallback((fr: string, en: string) => (language === 'fr' ? fr : en), [language]);

  const saveToLocalStorage = useCallback((data: AnalysisCustomization) => {
    try { localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
  }, []);

  const updateCustomization = useCallback(
    (updates: Partial<AnalysisCustomization>) => {
      const newCustomization = { ...customization, ...updates };
      setCustomization(newCustomization);
      onCustomizationChange(newCustomization);
      saveToLocalStorage(newCustomization);
    },
    [customization, onCustomizationChange, saveToLocalStorage]
  );

  const resetToDefaults = useCallback(() => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    onCustomizationChange(DEFAULT_CUSTOMIZATION);
    try { localStorage.removeItem(CUSTOMIZATION_STORAGE_KEY); } catch { /* Safari private */ }
  }, [onCustomizationChange]);

  useEffect(() => {
    onCustomizationChange(customization);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Prepare pill options ───
  const focusOptions = (Object.keys(ANALYSIS_FOCUS_CONFIG) as AnalysisFocus[]).map((k) => ({
    key: k,
    ...ANALYSIS_FOCUS_CONFIG[k],
  }));
  const toneOptions = (Object.keys(WRITING_TONE_CONFIG) as WritingTone[]).map((k) => ({
    key: k,
    ...WRITING_TONE_CONFIG[k],
  }));
  const lengthOptions = (Object.keys(TARGET_LENGTH_CONFIG) as TargetLength[]).map((k) => ({
    key: k,
    emoji: k === 'short' ? '📄' : k === 'medium' ? '📑' : k === 'long' ? '📚' : '✨',
    label: TARGET_LENGTH_CONFIG[k].label,
    description: { fr: TARGET_LENGTH_CONFIG[k].wordRange.fr, en: TARGET_LENGTH_CONFIG[k].wordRange.en },
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-bg-tertiary text-text-tertiary rounded-full text-xs">
          {ANALYSIS_FOCUS_CONFIG[customization.analysisFocus].emoji} {ANALYSIS_FOCUS_CONFIG[customization.analysisFocus].label[language]}
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-bg-tertiary text-text-tertiary rounded-full text-xs">
          {WRITING_TONE_CONFIG[customization.writingTone].emoji} {WRITING_TONE_CONFIG[customization.writingTone].label[language]}
        </span>
        {customization.antiAIDetection && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-full text-xs">
            <ShieldCheck className="w-3 h-3" /> Anti-IA
          </span>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL MODE v5 — Premium glassmorphism design
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      role="group"
      aria-labelledby={`${baseId}-title`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Gradient accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(6,182,212,0.4), transparent)' }}
      />

      <div className="p-5 sm:p-6 space-y-5">
        {/* ─── Header Row ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white/80">
              {t('Paramètres', 'Settings')}
            </span>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={disabled}
            className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
            title={t('Réinitialiser', 'Reset')}
          >
            <RotateCcw className="w-3 h-3" />
            {t('Reset', 'Reset')}
          </button>
        </div>

        {/* ─── FOCUS ─── */}
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {t('Focus', 'Focus')}
            </span>
            <span className="text-[11px] text-white/30">
              {t('— Quel résultat voulez-vous ?', '— What result do you want?')}
            </span>
          </div>
          <PillSelector
            options={focusOptions}
            value={customization.analysisFocus}
            onChange={(v) => updateCustomization({ analysisFocus: v })}
            disabled={disabled}
            language={language}
          />
          <p className="text-[11px] text-white/25 pl-1">
            {ANALYSIS_FOCUS_CONFIG[customization.analysisFocus].description[language]}
          </p>
        </div>

        {/* ─── TON ─── */}
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {t('Ton', 'Tone')}
            </span>
            <span className="text-[11px] text-white/30">
              {t('— Style de rédaction', '— Writing style')}
            </span>
          </div>
          <PillSelector
            options={toneOptions}
            value={customization.writingTone}
            onChange={(v) => updateCustomization({ writingTone: v })}
            disabled={disabled}
            language={language}
          />
        </div>

        {/* ─── LONGUEUR + LANGUE (inline row) ─── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Longueur */}
          <div className="flex-1 space-y-2.5">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {t('Longueur', 'Length')}
            </span>
            <PillSelector
              options={lengthOptions}
              value={customization.targetLength}
              onChange={(v) => updateCustomization({ targetLength: v })}
              disabled={disabled}
              language={language}
              variant="compact"
            />
          </div>

          {/* Langue */}
          <div className="sm:w-48 space-y-2.5">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              {t('Langue', 'Language')}
            </span>
            <div className="relative">
              <select
                value={customization.outputLanguage}
                onChange={(e) => updateCustomization({ outputLanguage: e.target.value as OutputLanguage })}
                disabled={disabled}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-full text-xs font-medium
                  bg-bg-tertiary text-text-secondary border border-border-default
                  focus:outline-none focus:ring-1 focus:ring-accent-primary/40
                  transition-all cursor-pointer disabled:opacity-40"
              >
                {(Object.keys(OUTPUT_LANGUAGE_CONFIG) as OutputLanguage[]).map((lang) => {
                  const config = OUTPUT_LANGUAGE_CONFIG[lang];
                  return (
                    <option key={lang} value={lang} className="bg-[#1a1a2e] text-white">
                      {config.flag}  {config.label[language]}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/30 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ─── MORE OPTIONS ─── */}
        <div className="pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors py-1"
            aria-expanded={showMore}
            aria-controls={`${baseId}-more`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`} />
            <span className="font-medium">
              {t("Plus d'options", 'More options')}
            </span>
          </button>

          <div
            id={`${baseId}-more`}
            className={`overflow-hidden transition-all duration-300 ease-in-out ${showMore ? 'max-h-[400px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
          >
            <div className="space-y-4">
              {/* Anti-IA */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-bg-tertiary border border-border-default">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${customization.antiAIDetection ? 'bg-emerald-500/15 text-emerald-400' : 'bg-bg-hover text-text-muted'}`}>
                    {customization.antiAIDetection ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white/70">Anti-Détection IA</span>
                    <p className="text-[11px] text-white/30 max-w-[280px]">
                      {t(
                        'Rédige de façon naturelle pour passer les détecteurs (GPTZero, Turnitin, Compilatio). Idéal pour réutiliser le texte dans vos travaux.',
                        'Writes naturally to bypass AI detectors (GPTZero, Turnitin, Compilatio). Ideal for reusing text in your assignments.'
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={customization.antiAIDetection}
                  onClick={() => updateCustomization({ antiAIDetection: !customization.antiAIDetection })}
                  disabled={disabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    ${customization.antiAIDetection ? 'bg-emerald-500/80' : 'bg-white/10'}
                  `}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
                    ${customization.antiAIDetection ? 'translate-x-6' : 'translate-x-1'}
                  `} />
                </button>
              </div>

              {/* Instructions personnalisées */}
              <div className="space-y-2">
                <label
                  htmlFor={`${baseId}-prompt`}
                  className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-wider"
                >
                  <MessageSquare className="w-3 h-3" />
                  {t('Instructions personnalisées', 'Custom instructions')}
                  <span className="font-normal normal-case text-white/25">
                    ({t('optionnel', 'optional')})
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    id={`${baseId}-prompt`}
                    value={customization.userPrompt}
                    onChange={(e) => updateCustomization({ userPrompt: e.target.value.slice(0, MAX_PROMPT_LENGTH) })}
                    disabled={disabled}
                    placeholder={t(
                      '"Concentre-toi sur les aspects pratiques" ou "Compare avec d\'autres théories"...',
                      '"Focus on practical aspects" or "Compare with other theories"...'
                    )}
                    rows={2}
                    maxLength={MAX_PROMPT_LENGTH}
                    className="w-full px-4 py-3 rounded-xl text-sm
                      bg-white/[0.03] border border-white/[0.06] text-white/80 placeholder-white/20
                      focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/20
                      resize-none transition-all disabled:opacity-40"
                  />
                  {customization.userPrompt.length > 0 && (
                    <span className={`absolute bottom-2 right-3 text-[10px] ${customization.userPrompt.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-orange-400' : 'text-white/20'}`}>
                      {customization.userPrompt.length}/{MAX_PROMPT_LENGTH}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizationPanel;
