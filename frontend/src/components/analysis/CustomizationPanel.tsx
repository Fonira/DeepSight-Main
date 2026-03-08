/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 CUSTOMIZATION PANEL v4.0 — Refonte Focus + Ton + Longueur + Langue            ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Niveau 1 (visible): Focus, Ton, Longueur, Langue                                 ║
 * ║  Niveau 2 (collapsible): Anti-IA, Instructions personnalisées                     ║
 * ║  Chaque option a une description claire et brève                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Shield,
  ShieldCheck,
  ChevronDown,
  Info,
  Sparkles,
  MessageSquare,
  Target,
  Save,
  RotateCcw,
  Pen,
  Globe,
  Ruler,
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
// 📊 TYPES
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
// 🧱 SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Label de section avec icône, titre et description */
const SectionLabel: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-2.5 mb-3">
    <div className="w-5 h-5 mt-0.5 text-accent-primary flex-shrink-0">{icon}</div>
    <div>
      <span className="text-sm font-medium text-text-primary">{title}</span>
      <p className="text-xs text-text-muted mt-0.5">{description}</p>
    </div>
  </div>
);

/** Bouton de sélection avec emoji + label */
const SelectionButton: React.FC<{
  selected: boolean;
  emoji: string;
  label: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}> = ({ selected, emoji, label, description, disabled, onClick, size = 'md' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    className={`
      flex flex-col items-center gap-1 rounded-xl border-2 transition-all
      ${size === 'sm' ? 'p-2' : 'p-3'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
      ${selected
        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary shadow-md'
        : 'border-border-default bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-hover'
      }
    `}
    title={description}
  >
    <span className={size === 'sm' ? 'text-lg' : 'text-xl'}>{emoji}</span>
    <span className={`font-medium ${size === 'sm' ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
      {label}
    </span>
  </button>
);

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

        // Détection v2/v3 → migration
        if (parsed.writingStyle && !parsed.writingTone) {
          const migrated = migrateCustomization(parsed);
          return { ...migrated, ...initialCustomization };
        }

        return { ...DEFAULT_CUSTOMIZATION, ...parsed, ...initialCustomization };
      }
    } catch {
      /* localStorage read failed */
    }
    return { ...DEFAULT_CUSTOMIZATION, ...initialCustomization };
  };

  const [customization, setCustomization] = useState<AnalysisCustomization>(loadSavedCustomization);
  const [showMore, setShowMore] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const baseId = useId();

  const t = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  const saveToLocalStorage = useCallback((data: AnalysisCustomization) => {
    try {
      localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(data));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      /* localStorage write failed */
    }
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
    localStorage.removeItem(CUSTOMIZATION_STORAGE_KEY);
  }, [onCustomizationChange]);

  useEffect(() => {
    onCustomizationChange(customization);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-bg-tertiary border border-border-default rounded-lg text-sm text-text-secondary">
          <span>{ANALYSIS_FOCUS_CONFIG[customization.analysisFocus].emoji}</span>
          <span>{ANALYSIS_FOCUS_CONFIG[customization.analysisFocus].label[language]}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 bg-bg-tertiary border border-border-default rounded-lg text-sm text-text-secondary">
          <span>{WRITING_TONE_CONFIG[customization.writingTone].emoji}</span>
          <span>{WRITING_TONE_CONFIG[customization.writingTone].label[language]}</span>
        </div>
        {customization.antiAIDetection && (
          <span className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Anti-IA
          </span>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL MODE v4
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-2xl overflow-hidden"
      role="group"
      aria-labelledby={`${baseId}-title`}
    >
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-border-subtle bg-bg-tertiary/50">
        <div className="flex items-center justify-between">
          <h2
            id={`${baseId}-title`}
            className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-accent-primary" />
            {t('Personnalisation', 'Customization')}
          </h2>
          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="text-xs text-green-500 flex items-center gap-1 animate-fade-in">
                <Save className="w-3 h-3" />
                {t('Sauvegardé', 'Saved')}
              </span>
            )}
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={disabled}
              className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors"
              title={t('Réinitialiser', 'Reset')}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 🎯 FOCUS — Quel angle pour l'analyse ? */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <SectionLabel
            icon={<Target className="w-5 h-5" />}
            title={t('Focus de l\'analyse', 'Analysis Focus')}
            description={t(
              'Quel type de résultat voulez-vous obtenir ?',
              'What type of result do you want?'
            )}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(ANALYSIS_FOCUS_CONFIG) as AnalysisFocus[]).map((focus) => {
              const config = ANALYSIS_FOCUS_CONFIG[focus];
              return (
                <SelectionButton
                  key={focus}
                  selected={customization.analysisFocus === focus}
                  emoji={config.emoji}
                  label={config.label[language]}
                  description={config.description[language]}
                  disabled={disabled}
                  onClick={() => updateCustomization({ analysisFocus: focus })}
                />
              );
            })}
          </div>
          {/* Description du focus sélectionné */}
          <p className="text-xs text-text-muted text-center mt-2 px-2">
            {ANALYSIS_FOCUS_CONFIG[customization.analysisFocus].description[language]}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ✍️ TON — Comment l'analyse est rédigée */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <SectionLabel
            icon={<Pen className="w-5 h-5" />}
            title={t('Ton', 'Tone')}
            description={t(
              'Le style de rédaction de l\'analyse',
              'The writing style of the analysis'
            )}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(WRITING_TONE_CONFIG) as WritingTone[]).map((tone) => {
              const config = WRITING_TONE_CONFIG[tone];
              return (
                <SelectionButton
                  key={tone}
                  selected={customization.writingTone === tone}
                  emoji={config.emoji}
                  label={config.label[language]}
                  description={config.description[language]}
                  disabled={disabled}
                  onClick={() => updateCustomization({ writingTone: tone })}
                />
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 📏 LONGUEUR — Taille de l'analyse */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <SectionLabel
            icon={<Ruler className="w-5 h-5" />}
            title={t('Longueur', 'Length')}
            description={t(
              'Combien de détails souhaitez-vous ?',
              'How much detail do you want?'
            )}
          />
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(TARGET_LENGTH_CONFIG) as TargetLength[]).map((length) => {
              const config = TARGET_LENGTH_CONFIG[length];
              const isSelected = customization.targetLength === length;
              return (
                <button
                  key={length}
                  type="button"
                  onClick={() => updateCustomization({ targetLength: length })}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={`
                    flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border-2 transition-all
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
                    ${isSelected
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary shadow-md'
                      : 'border-border-default bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-hover'
                    }
                  `}
                >
                  <span className="text-xs sm:text-sm font-medium">
                    {config.label[language]}
                  </span>
                  <span className={`text-[10px] ${isSelected ? 'text-accent-primary/70' : 'text-text-muted'}`}>
                    {config.wordRange[language]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 🌐 LANGUE — Langue de sortie */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <SectionLabel
            icon={<Globe className="w-5 h-5" />}
            title={t('Langue de l\'analyse', 'Analysis Language')}
            description={t(
              'Par défaut, la langue est détectée automatiquement',
              'By default, the language is auto-detected'
            )}
          />
          <div className="relative">
            <select
              value={customization.outputLanguage}
              onChange={(e) => updateCustomization({ outputLanguage: e.target.value as OutputLanguage })}
              disabled={disabled}
              className={`
                w-full appearance-none px-4 py-3 pr-10 rounded-xl
                bg-bg-tertiary border-2 border-border-default
                text-text-primary text-sm font-medium
                focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary
                transition-all cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {(Object.keys(OUTPUT_LANGUAGE_CONFIG) as OutputLanguage[]).map((lang) => {
                const config = OUTPUT_LANGUAGE_CONFIG[lang];
                return (
                  <option key={lang} value={lang}>
                    {config.flag}  {config.label[language]}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ⚙️ PLUS D'OPTIONS — Collapsible */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="flex items-center justify-between w-full text-sm text-text-secondary hover:text-text-primary transition-colors py-1 group"
            aria-expanded={showMore}
            aria-controls={`${baseId}-more`}
          >
            <span className="font-medium flex items-center gap-2">
              <Info className="w-4 h-4" />
              {t("Plus d'options", 'More Options')}
            </span>
            <div className={`transform transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          <div
            id={`${baseId}-more`}
            className={`
              overflow-hidden transition-all duration-300 ease-in-out
              ${showMore ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}
            `}
          >
            <div className="space-y-5">
              {/* 🛡️ Anti-Détection IA */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary border border-border-default">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center transition-all
                    ${customization.antiAIDetection
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-bg-hover text-text-muted'}
                  `}>
                    {customization.antiAIDetection ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <Shield className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      {t('Anti-Détection IA', 'Anti-AI Detection')}
                    </span>
                    <p className="text-xs text-text-muted">
                      {t(
                        'Rend le texte indétectable par GPTZero, Turnitin, etc.',
                        'Makes text undetectable by GPTZero, Turnitin, etc.'
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
                  className={`
                    relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 flex-shrink-0
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${customization.antiAIDetection ? 'bg-green-500' : 'bg-gray-600'}
                  `}
                >
                  <span className={`
                    inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300
                    ${customization.antiAIDetection ? 'translate-x-6' : 'translate-x-1'}
                  `} />
                </button>
              </div>

              {/* 📝 Instructions personnalisées */}
              <div className="space-y-2">
                <label
                  htmlFor={`${baseId}-prompt`}
                  className="flex items-center gap-2 text-sm font-medium text-text-primary"
                >
                  <MessageSquare className="w-4 h-4 text-accent-primary" />
                  {t('Instructions personnalisées', 'Custom Instructions')}
                  <span className="text-text-muted font-normal">
                    ({t('optionnel', 'optional')})
                  </span>
                </label>
                <p className="text-xs text-text-muted ml-6">
                  {t(
                    'Donnez des consignes spécifiques à l\'IA pour cette analyse',
                    'Give specific instructions to the AI for this analysis'
                  )}
                </p>
                <div className="relative">
                  <textarea
                    id={`${baseId}-prompt`}
                    value={customization.userPrompt}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, MAX_PROMPT_LENGTH);
                      updateCustomization({ userPrompt: value });
                    }}
                    disabled={disabled}
                    placeholder={t(
                      'Ex: "Concentre-toi sur les aspects pratiques" ou "Compare avec d\'autres théories"...',
                      'E.g., "Focus on practical aspects" or "Compare with other theories"...'
                    )}
                    rows={3}
                    maxLength={MAX_PROMPT_LENGTH}
                    className={`
                      w-full px-4 py-3 rounded-xl
                      bg-bg-tertiary border border-border-default
                      text-text-primary placeholder-text-muted
                      focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary
                      resize-none transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    aria-describedby={`${baseId}-prompt-count`}
                  />
                  <span
                    id={`${baseId}-prompt-count`}
                    className={`
                      absolute bottom-2 right-3 text-xs
                      ${customization.userPrompt.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-orange-500' : 'text-text-muted'}
                    `}
                  >
                    {customization.userPrompt.length}/{MAX_PROMPT_LENGTH}
                  </span>
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
