/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 CUSTOMIZATION PANEL — Personnalisation de l'analyse                            ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Anti-AI Detection toggle (humanize text)                                         ║
 * ║  - Writing style selector                                                           ║
 * ║  - Target length                                                                    ║
 * ║  - Formality level                                                                  ║
 * ║  - Vocabulary complexity                                                            ║
 * ║  - Accessibility compliant (ARIA labels, keyboard navigation)                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useCallback, useId } from 'react';
import {
  Shield,
  ShieldCheck,
  FileText,
  Sparkles,
  GraduationCap,
  Briefcase,
  Newspaper,
  Code,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
} from 'lucide-react';
import { WritingStyle, AnalysisCustomization } from '../../types/analysis';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomizationPanelProps {
  onCustomizationChange: (customization: AnalysisCustomization) => void;
  initialCustomization?: Partial<AnalysisCustomization>;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Language for labels */
  language?: 'fr' | 'en';
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Whether to show advanced options by default */
  defaultExpanded?: boolean;
}

const WRITING_STYLE_CONFIG = {
  [WritingStyle.ACADEMIC]: {
    icon: GraduationCap,
    label: { fr: 'Académique', en: 'Academic' },
    description: { fr: 'Formel, citations', en: 'Formal, citations' },
  },
  [WritingStyle.CONVERSATIONAL]: {
    icon: MessageCircle,
    label: { fr: 'Conversationnel', en: 'Conversational' },
    description: { fr: 'Naturel, accessible', en: 'Natural, accessible' },
  },
  [WritingStyle.PROFESSIONAL]: {
    icon: Briefcase,
    label: { fr: 'Professionnel', en: 'Professional' },
    description: { fr: 'Clair, structuré', en: 'Clear, structured' },
  },
  [WritingStyle.CREATIVE]: {
    icon: Sparkles,
    label: { fr: 'Créatif', en: 'Creative' },
    description: { fr: 'Engageant, original', en: 'Engaging, original' },
  },
  [WritingStyle.JOURNALISTIC]: {
    icon: Newspaper,
    label: { fr: 'Journalistique', en: 'Journalistic' },
    description: { fr: 'Factuel, accrocheur', en: 'Factual, catchy' },
  },
  [WritingStyle.TECHNICAL]: {
    icon: Code,
    label: { fr: 'Technique', en: 'Technical' },
    description: { fr: 'Précis, détaillé', en: 'Precise, detailed' },
  },
};

const VOCABULARY_COMPLEXITY_CONFIG = {
  simple: {
    label: { fr: 'Simple', en: 'Simple' },
    description: { fr: 'Vocabulaire courant, accessible à tous', en: 'Common vocabulary, accessible to all' },
  },
  moderate: {
    label: { fr: 'Modéré', en: 'Moderate' },
    description: { fr: 'Équilibre entre accessibilité et précision', en: 'Balance between accessibility and precision' },
  },
  advanced: {
    label: { fr: 'Avancé', en: 'Advanced' },
    description: { fr: 'Terminologie spécialisée, jargon technique', en: 'Specialized terminology, technical jargon' },
  },
};

const LENGTH_CONFIG = {
  short: { fr: 'Court', en: 'Short', desc: { fr: '~500 mots', en: '~500 words' } },
  medium: { fr: 'Moyen', en: 'Medium', desc: { fr: '~1000 mots', en: '~1000 words' } },
  long: { fr: 'Long', en: 'Long', desc: { fr: '~2000 mots', en: '~2000 words' } },
};

const defaultCustomization: AnalysisCustomization = {
  writingStyle: WritingStyle.PROFESSIONAL,
  antiAIDetection: false,
  targetLength: 'medium',
  includeExamples: true,
  formalityLevel: 3,
  vocabularyComplexity: 'moderate',
  personalTone: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CUSTOMIZATION PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  onCustomizationChange,
  initialCustomization = {},
  compact = false,
  language = 'fr',
  disabled = false,
  defaultExpanded = false,
}) => {
  const [customization, setCustomization] = useState<AnalysisCustomization>({
    ...defaultCustomization,
    ...initialCustomization,
  });
  const [showAdvanced, setShowAdvanced] = useState(defaultExpanded);

  // Generate unique IDs for accessibility
  const baseId = useId();
  const antiAiId = `${baseId}-anti-ai`;
  const styleId = `${baseId}-style`;
  const lengthId = `${baseId}-length`;
  const formalityId = `${baseId}-formality`;
  const vocabId = `${baseId}-vocab`;

  const t = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  const updateCustomization = useCallback(
    (updates: Partial<AnalysisCustomization>) => {
      const newCustomization = { ...customization, ...updates };
      setCustomization(newCustomization);
      onCustomizationChange(newCustomization);
    },
    [customization, onCustomizationChange]
  );

  const toggleAntiAIDetection = useCallback(() => {
    updateCustomization({ antiAIDetection: !customization.antiAIDetection });
  }, [customization.antiAIDetection, updateCustomization]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 COMPACT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {/* Anti-AI Toggle Button */}
        <button
          type="button"
          onClick={toggleAntiAIDetection}
          disabled={disabled}
          aria-pressed={customization.antiAIDetection}
          aria-label={t('Anti-Détection IA', 'Anti-AI Detection')}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
            transition-all duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${
              customization.antiAIDetection
                ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }
          `}
        >
          {customization.antiAIDetection ? (
            <ShieldCheck className="w-4 h-4" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          <span>{t('Anti-IA', 'Anti-AI')}</span>
        </button>

        {/* Vocabulary Complexity Dropdown */}
        <select
          id={vocabId}
          value={customization.vocabularyComplexity}
          onChange={(e) =>
            updateCustomization({
              vocabularyComplexity: e.target.value as 'simple' | 'moderate' | 'advanced',
            })
          }
          disabled={disabled}
          aria-label={t('Complexité du vocabulaire', 'Vocabulary complexity')}
          className="bg-bg-tertiary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(Object.keys(VOCABULARY_COMPLEXITY_CONFIG) as Array<keyof typeof VOCABULARY_COMPLEXITY_CONFIG>).map(
            (key) => (
              <option key={key} value={key}>
                {VOCABULARY_COMPLEXITY_CONFIG[key].label[language]}
              </option>
            )
          )}
        </select>

        {/* Writing Style Dropdown */}
        <select
          id={styleId}
          value={customization.writingStyle}
          onChange={(e) =>
            updateCustomization({ writingStyle: e.target.value as WritingStyle })
          }
          disabled={disabled}
          aria-label={t("Style d'écriture", 'Writing style')}
          className="bg-bg-tertiary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {Object.entries(WRITING_STYLE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label[language]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 FULL MODE
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="bg-bg-secondary border border-border-default rounded-xl p-4 sm:p-5 space-y-4 sm:space-y-5"
      role="group"
      aria-labelledby={`${baseId}-title`}
    >
      <h2
        id={`${baseId}-title`}
        className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2"
      >
        <FileText className="w-5 h-5 text-accent-primary" />
        {t("Personnalisation de l'analyse", 'Analysis Customization')}
      </h2>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 🛡️ ANTI-AI DETECTION TOGGLE */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <button
          id={antiAiId}
          type="button"
          onClick={toggleAntiAIDetection}
          disabled={disabled}
          aria-pressed={customization.antiAIDetection}
          aria-describedby={`${antiAiId}-desc`}
          className={`
            w-full py-4 px-5 rounded-xl font-semibold text-base
            transition-all duration-300 transform
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'}
            shadow-lg hover:shadow-xl
            flex items-center justify-center gap-3
            ${
              customization.antiAIDetection
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white ring-4 ring-green-400/30'
                : 'bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-500 hover:to-emerald-600'
            }
          `}
        >
          {customization.antiAIDetection ? (
            <ShieldCheck className="w-6 h-6" />
          ) : (
            <Shield className="w-6 h-6" />
          )}
          <span>
            {customization.antiAIDetection
              ? t('✓ Anti-Détection IA Activé', '✓ Anti-AI Detection Enabled')
              : t('Anti-Détection IA', 'Anti-AI Detection')}
          </span>
        </button>
        <p
          id={`${antiAiId}-desc`}
          className="text-sm text-text-secondary text-center flex items-center justify-center gap-1.5"
        >
          <Info className="w-4 h-4 text-text-muted" />
          {t(
            'Humanise le texte pour éviter la détection par les outils anti-IA',
            'Humanizes text to avoid detection by anti-AI tools'
          )}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ✍️ WRITING STYLE SELECTOR */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <label
          htmlFor={styleId}
          className="block text-sm font-medium text-text-primary"
        >
          {t("Style d'écriture", 'Writing Style')}
        </label>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2"
          role="radiogroup"
          aria-labelledby={styleId}
        >
          {Object.entries(WRITING_STYLE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = customization.writingStyle === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => updateCustomization({ writingStyle: key as WritingStyle })}
                className={`
                  flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-3 rounded-lg border-2 transition-all min-h-[60px] sm:min-h-[80px]
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                  ${
                    isSelected
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-default bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-hover'
                  }
                `}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-medium text-center leading-tight">{config.label[language]}</span>
                <span className="text-[10px] sm:text-xs text-text-muted text-center hidden sm:block">{config.description[language]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 📏 VOCABULARY COMPLEXITY SELECTOR */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <label
          htmlFor={vocabId}
          className="block text-sm font-medium text-text-primary flex items-center gap-2"
        >
          {t('Complexité du vocabulaire', 'Vocabulary Complexity')}
          <button
            type="button"
            className="text-text-muted hover:text-text-secondary"
            aria-label={t('Aide sur la complexité', 'Help about complexity')}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </label>
        <div
          className="flex flex-col sm:flex-row gap-2"
          role="radiogroup"
          aria-labelledby={vocabId}
        >
          {(Object.keys(VOCABULARY_COMPLEXITY_CONFIG) as Array<keyof typeof VOCABULARY_COMPLEXITY_CONFIG>).map(
            (key) => {
              const config = VOCABULARY_COMPLEXITY_CONFIG[key];
              const isSelected = customization.vocabularyComplexity === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-describedby={`${vocabId}-${key}-desc`}
                  disabled={disabled}
                  onClick={() => updateCustomization({ vocabularyComplexity: key })}
                  className={`
                    flex-1 py-2.5 px-3 rounded-lg font-medium transition-all text-sm
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${
                      isSelected
                        ? 'bg-accent-primary text-white shadow-md'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }
                  `}
                >
                  {config.label[language]}
                </button>
              );
            }
          )}
        </div>
        <p className="text-xs text-text-muted">
          {VOCABULARY_COMPLEXITY_CONFIG[customization.vocabularyComplexity].description[language]}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 📐 TARGET LENGTH */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <label
          htmlFor={lengthId}
          className="block text-sm font-medium text-text-primary"
        >
          {t('Longueur cible', 'Target Length')}
        </label>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-labelledby={lengthId}
        >
          {(Object.keys(LENGTH_CONFIG) as Array<keyof typeof LENGTH_CONFIG>).map((key) => {
            const config = LENGTH_CONFIG[key];
            const isSelected = customization.targetLength === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => updateCustomization({ targetLength: key })}
                className={`
                  flex-1 flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-lg font-medium transition-all
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${
                    isSelected
                      ? 'bg-accent-primary text-white shadow-md'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }
                `}
              >
                <span className="text-sm">{config[language]}</span>
                <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-text-muted'}`}>
                  {config.desc[language]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 🎚️ FORMALITY LEVEL SLIDER */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <label
          htmlFor={formalityId}
          className="flex items-center justify-between text-sm font-medium text-text-primary"
        >
          <span>{t('Niveau de formalité', 'Formality Level')}</span>
          <span className="text-accent-primary font-semibold tabular-nums">
            {customization.formalityLevel}/5
          </span>
        </label>
        <input
          id={formalityId}
          type="range"
          min="1"
          max="5"
          step="1"
          value={customization.formalityLevel}
          onChange={(e) =>
            updateCustomization({
              formalityLevel: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
            })
          }
          disabled={disabled}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={customization.formalityLevel}
          className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-text-muted">
          <span>{t('Décontracté', 'Casual')}</span>
          <span>{t('Très formel', 'Very Formal')}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ⚙️ ADVANCED OPTIONS (collapsible) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-sm text-text-secondary hover:text-text-primary transition-colors"
          aria-expanded={showAdvanced}
          aria-controls={`${baseId}-advanced`}
        >
          <span className="font-medium">
            {t('Options avancées', 'Advanced Options')}
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showAdvanced && (
          <div
            id={`${baseId}-advanced`}
            className="mt-4 space-y-3 animate-fadeIn"
          >
            {/* Include Examples */}
            <label
              className={`flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default transition-colors
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg-hover'}
              `}
            >
              <input
                type="checkbox"
                checked={customization.includeExamples}
                onChange={(e) =>
                  updateCustomization({ includeExamples: e.target.checked })
                }
                disabled={disabled}
                className="w-5 h-5 text-accent-primary rounded focus:ring-accent-primary focus:ring-offset-0 border-border-default bg-bg-primary"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-text-primary">
                  {t('Inclure des exemples', 'Include Examples')}
                </span>
                <p className="text-xs text-text-muted">
                  {t(
                    'Ajoute des exemples concrets pour illustrer les concepts',
                    'Adds concrete examples to illustrate concepts'
                  )}
                </p>
              </div>
            </label>

            {/* Personal Tone */}
            <label
              className={`flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default transition-colors
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg-hover'}
              `}
            >
              <input
                type="checkbox"
                checked={customization.personalTone}
                onChange={(e) =>
                  updateCustomization({ personalTone: e.target.checked })
                }
                disabled={disabled}
                className="w-5 h-5 text-accent-primary rounded focus:ring-accent-primary focus:ring-offset-0 border-border-default bg-bg-primary"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-text-primary">
                  {t('Ton personnel', 'Personal Tone')}
                </span>
                <p className="text-xs text-text-muted">
                  {t(
                    'Utilise un style plus direct et engageant',
                    'Uses a more direct and engaging style'
                  )}
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomizationPanel;
