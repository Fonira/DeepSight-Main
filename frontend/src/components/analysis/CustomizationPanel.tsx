/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 CUSTOMIZATION PANEL v2.0 — Analyse Personnalisée Avancée                       ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Features:                                                                          ║
 * ║  - Zone de texte pour prompt utilisateur (2000 chars max)                          ║
 * ║  - Bouton Anti-Détection IA TRÈS VISIBLE avec animation                            ║
 * ║  - Options avancées dépliables (style, longueur, checkboxes)                       ║
 * ║  - Dark mode compatible                                                             ║
 * ║  - Responsive design (mobile-friendly)                                              ║
 * ║  - Accessibilité (ARIA labels, focus states)                                       ║
 * ║  - Sauvegarde des préférences en localStorage                                      ║
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
  FileText,
  Target,
  Settings,
  Save,
  RotateCcw,
} from 'lucide-react';
import {
  AnalysisCustomization,
  WritingStyle,
  TargetLength,
  WRITING_STYLE_CONFIG,
  TARGET_LENGTH_CONFIG,
  DEFAULT_CUSTOMIZATION,
  CUSTOMIZATION_STORAGE_KEY,
} from '../../types/analysis';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomizationPanelProps {
  /** Callback quand la customization change */
  onCustomizationChange: (customization: AnalysisCustomization) => void;
  /** Valeurs initiales */
  initialCustomization?: Partial<AnalysisCustomization>;
  /** Langue de l'interface */
  language?: 'fr' | 'en';
  /** Désactiver le panel */
  disabled?: boolean;
  /** Mode compact (inline) */
  compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_PROMPT_LENGTH = 2000;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CUSTOMIZATION PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  onCustomizationChange,
  initialCustomization = {},
  language = 'fr',
  disabled = false,
  compact = false,
}) => {
  // Load from localStorage or use defaults
  const loadSavedCustomization = (): AnalysisCustomization => {
    try {
      const saved = localStorage.getItem(CUSTOMIZATION_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(saved), ...initialCustomization };
      }
    } catch {
      /* localStorage read failed */
    }
    return { ...DEFAULT_CUSTOMIZATION, ...initialCustomization };
  };

  const [customization, setCustomization] = useState<AnalysisCustomization>(loadSavedCustomization);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Generate unique IDs for accessibility
  const baseId = useId();

  // Translation helper
  const t = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  // Save to localStorage
  const saveToLocalStorage = useCallback((data: AnalysisCustomization) => {
    try {
      localStorage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(data));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {
      /* localStorage write failed */
    }
  }, []);

  // Update customization
  const updateCustomization = useCallback(
    (updates: Partial<AnalysisCustomization>) => {
      const newCustomization = { ...customization, ...updates };
      setCustomization(newCustomization);
      onCustomizationChange(newCustomization);
      saveToLocalStorage(newCustomization);
    },
    [customization, onCustomizationChange, saveToLocalStorage]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    onCustomizationChange(DEFAULT_CUSTOMIZATION);
    localStorage.removeItem(CUSTOMIZATION_STORAGE_KEY);
  }, [onCustomizationChange]);

  // Notify parent on mount
  useEffect(() => {
    onCustomizationChange(customization);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 COMPACT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {/* Anti-AI Toggle Compact */}
        <button
          type="button"
          onClick={() => updateCustomization({ antiAIDetection: !customization.antiAIDetection })}
          disabled={disabled}
          aria-pressed={customization.antiAIDetection}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
            transition-all duration-300 transform
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}
            ${
              customization.antiAIDetection
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border-default'
            }
          `}
        >
          {customization.antiAIDetection ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <Shield className="w-5 h-5" />
          )}
          <span>{t('Anti-IA', 'Anti-AI')}</span>
          {customization.antiAIDetection && (
            <span className="ml-1 text-xs opacity-80">✓</span>
          )}
        </button>

        {/* Style Quick Select */}
        <select
          value={customization.writingStyle}
          onChange={(e) => updateCustomization({ writingStyle: e.target.value as WritingStyle })}
          disabled={disabled}
          className="bg-bg-tertiary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer disabled:opacity-50"
        >
          {(Object.keys(WRITING_STYLE_CONFIG) as WritingStyle[]).map((style) => (
            <option key={style} value={style}>
              {WRITING_STYLE_CONFIG[style].emoji} {WRITING_STYLE_CONFIG[style].label[language]}
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
            {t('Personnalisation Avancée', 'Advanced Customization')}
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

      <div className="p-4 sm:p-5 space-y-5">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 📝 USER PROMPT TEXTAREA */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
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
                'Ex: "Concentre-toi sur les aspects pratiques" ou "Ajoute des exemples concrets"...',
                'E.g., "Focus on practical aspects" or "Add concrete examples"...'
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 🛡️ ANTI-AI DETECTION TOGGLE — TRÈS VISIBLE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => updateCustomization({ antiAIDetection: !customization.antiAIDetection })}
            disabled={disabled}
            aria-pressed={customization.antiAIDetection}
            aria-describedby={`${baseId}-antiai-desc`}
            className={`
              w-full py-4 sm:py-5 px-5 sm:px-6 rounded-xl font-bold text-base sm:text-lg
              transition-all duration-300 transform
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer'}
              flex items-center justify-center gap-3
              relative overflow-hidden
              ${
                customization.antiAIDetection
                  ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 text-white shadow-xl shadow-green-500/40 ring-4 ring-green-400/30'
                  : 'bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 text-white shadow-lg shadow-green-600/30 hover:shadow-xl hover:shadow-green-500/40'
              }
            `}
          >
            {/* Animated background effect */}
            <div
              className={`
                absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0
                transition-transform duration-1000
                ${customization.antiAIDetection ? 'animate-shimmer' : 'translate-x-[-200%]'}
              `}
              style={{ backgroundSize: '200% 100%' }}
            />
            
            {/* Icon with animation */}
            <div className={`relative ${customization.antiAIDetection ? 'animate-pulse-subtle' : ''}`}>
              {customization.antiAIDetection ? (
                <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
              ) : (
                <Shield className="w-7 h-7 sm:w-8 sm:h-8" />
              )}
            </div>
            
            {/* Text */}
            <span className="relative">
              {customization.antiAIDetection
                ? t('✓ Anti-Détection IA Activé', '✓ Anti-AI Detection Enabled')
                : t('🛡️ Activer Anti-Détection IA', '🛡️ Enable Anti-AI Detection')}
            </span>
          </button>
          
          <p
            id={`${baseId}-antiai-desc`}
            className={`
              text-sm text-center flex items-center justify-center gap-2 px-2
              transition-colors duration-300
              ${customization.antiAIDetection ? 'text-green-400' : 'text-text-secondary'}
            `}
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              {customization.antiAIDetection
                ? t(
                    'Le texte sera humanisé pour éviter la détection par GPTZero, Turnitin, etc.',
                    'Text will be humanized to avoid detection by GPTZero, Turnitin, etc.'
                  )
                : t(
                    'Humanise le texte pour le rendre indétectable par les outils anti-IA',
                    'Humanizes text to make it undetectable by anti-AI tools'
                  )}
            </span>
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ⚙️ ADVANCED OPTIONS — COLLAPSIBLE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-sm text-text-secondary hover:text-text-primary transition-colors py-2 group"
            aria-expanded={showAdvanced}
            aria-controls={`${baseId}-advanced`}
          >
            <span className="font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('Options avancées', 'Advanced Options')}
            </span>
            <div className={`transform transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>

          {/* Advanced Options Content */}
          <div
            id={`${baseId}-advanced`}
            className={`
              overflow-hidden transition-all duration-300 ease-in-out
              ${showAdvanced ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'}
            `}
          >
            <div className="space-y-5">
              {/* ─────────────────────────────────────────────────────────────── */}
              {/* ✍️ WRITING STYLE SELECTOR */}
              {/* ─────────────────────────────────────────────────────────────── */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <FileText className="w-4 h-4 text-accent-primary" />
                  {t("Style d'écriture", 'Writing Style')}
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(WRITING_STYLE_CONFIG) as WritingStyle[]).map((style) => {
                    const config = WRITING_STYLE_CONFIG[style];
                    const isSelected = customization.writingStyle === style;
                    
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => updateCustomization({ writingStyle: style })}
                        disabled={disabled}
                        aria-pressed={isSelected}
                        className={`
                          flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
                          ${
                            isSelected
                              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary shadow-md'
                              : 'border-border-default bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-hover'
                          }
                        `}
                      >
                        <span className="text-xl">{config.emoji}</span>
                        <span className="text-xs sm:text-sm font-medium">
                          {config.label[language]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Description of selected style */}
                <p className="text-xs text-text-muted text-center px-2">
                  {WRITING_STYLE_CONFIG[customization.writingStyle].description[language]}
                </p>
              </div>

              {/* ─────────────────────────────────────────────────────────────── */}
              {/* 📏 TARGET LENGTH */}
              {/* ─────────────────────────────────────────────────────────────── */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Target className="w-4 h-4 text-accent-primary" />
                  {t('Longueur cible', 'Target Length')}
                </label>
                
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
                          flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border transition-all
                          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          ${
                            isSelected
                              ? 'border-accent-primary bg-accent-primary text-white shadow-md'
                              : 'border-border-default bg-bg-tertiary text-text-secondary hover:border-border-hover hover:bg-bg-hover'
                          }
                        `}
                      >
                        <span className="text-xs sm:text-sm font-medium">
                          {config.label[language]}
                        </span>
                        <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-text-muted'}`}>
                          {config.wordRange[language]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────── */}
              {/* ☑️ CHECKBOXES: commentaires, metadata, intention */}
              {/* ─────────────────────────────────────────────────────────────── */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-text-primary">
                  {t('Options additionnelles', 'Additional Options')}
                </label>
                
                <div className="space-y-2">
                  {/* Commentaires */}
                  <label
                    className={`
                      flex items-start gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default
                      transition-all cursor-pointer hover:bg-bg-hover
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={customization.includeComments}
                      onChange={(e) => updateCustomization({ includeComments: e.target.checked })}
                      disabled={disabled}
                      className="mt-0.5 w-5 h-5 text-accent-primary rounded focus:ring-accent-primary focus:ring-offset-0 border-border-default bg-bg-primary cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-primary">
                        {t('Inclure des commentaires', 'Include Comments')}
                      </span>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t(
                          'Ajoute des annotations et remarques explicatives',
                          'Adds explanatory annotations and remarks'
                        )}
                      </p>
                    </div>
                  </label>

                  {/* Metadata */}
                  <label
                    className={`
                      flex items-start gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default
                      transition-all cursor-pointer hover:bg-bg-hover
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={customization.includeMetadata}
                      onChange={(e) => updateCustomization({ includeMetadata: e.target.checked })}
                      disabled={disabled}
                      className="mt-0.5 w-5 h-5 text-accent-primary rounded focus:ring-accent-primary focus:ring-offset-0 border-border-default bg-bg-primary cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-primary">
                        {t('Inclure les métadonnées', 'Include Metadata')}
                      </span>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t(
                          'Affiche les infos de la vidéo (durée, chaîne, date...)',
                          'Shows video info (duration, channel, date...)'
                        )}
                      </p>
                    </div>
                  </label>

                  {/* Intention */}
                  <label
                    className={`
                      flex items-start gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default
                      transition-all cursor-pointer hover:bg-bg-hover
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={customization.includeIntention}
                      onChange={(e) => updateCustomization({ includeIntention: e.target.checked })}
                      disabled={disabled}
                      className="mt-0.5 w-5 h-5 text-accent-primary rounded focus:ring-accent-primary focus:ring-offset-0 border-border-default bg-bg-primary cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-primary">
                        {t("Analyser l'intention", 'Analyze Intention')}
                      </span>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t(
                          "Décrypte l'objectif et le message de l'auteur",
                          "Deciphers the author's goal and message"
                        )}
                      </p>
                    </div>
                  </label>
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
