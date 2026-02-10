/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎨 CUSTOMIZATION PANEL V2 — Personnalisation avancée de l'analyse                 ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Custom user prompt TextInput                                                     ║
 * ║  - Anti-AI Detection toggle (72px prominent button with haptic feedback)            ║
 * ║  - Writing style selector                                                          ║
 * ║  - Target length                                                                   ║
 * ║  - Formality level                                                                 ║
 * ║  - Vocabulary complexity                                                           ║
 * ║  - AsyncStorage for preference persistence                                          ║
 * ║  - Accessibility compliant                                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing, Typography, Shadows } from '../../constants/theme';
import { storage } from '../../utils/storage';
import {
  AnalysisCustomization,
  WritingStyle,
  TargetLength,
  VocabularyComplexity,
  FormalityLevel,
  DEFAULT_CUSTOMIZATION,
  WRITING_STYLE_CONFIG,
  VOCABULARY_CONFIG,
  LENGTH_CONFIG,
  CUSTOMIZATION_STORAGE_KEY,
} from '../../types/analysis';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES & PROPS
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomizationPanelProps {
  /** Callback when customization changes */
  onCustomizationChange: (customization: AnalysisCustomization) => void;
  /** Initial customization values */
  initialCustomization?: Partial<AnalysisCustomization>;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Language for labels */
  language?: 'fr' | 'en';
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Whether to show advanced options */
  showAdvanced?: boolean;
  /** Whether to persist preferences to storage */
  persistPreferences?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CUSTOMIZATION PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  onCustomizationChange,
  initialCustomization = {},
  compact = false,
  language = 'fr',
  disabled = false,
  showAdvanced = true,
  persistPreferences = true,
}) => {
  const { colors, isDark } = useTheme();
  const [customization, setCustomization] = useState<AnalysisCustomization>({
    ...DEFAULT_CUSTOMIZATION,
    ...initialCustomization,
  });
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [isLoaded, setIsLoaded] = useState(false);

  // Translation helper
  const t = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  // Load saved preferences from AsyncStorage
  useEffect(() => {
    const loadPreferences = async () => {
      if (!persistPreferences) {
        setIsLoaded(true);
        return;
      }

      try {
        const saved = await storage.getObject<Partial<AnalysisCustomization>>(
          CUSTOMIZATION_STORAGE_KEY
        );
        if (saved) {
          const merged = {
            ...DEFAULT_CUSTOMIZATION,
            ...saved,
            ...initialCustomization,
          };
          setCustomization(merged);
          onCustomizationChange(merged);
        }
      } catch (error) {
        console.error('Failed to load customization preferences:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, [persistPreferences, initialCustomization, onCustomizationChange]);

  // Save preferences to AsyncStorage
  const savePreferences = useCallback(
    async (prefs: AnalysisCustomization) => {
      if (!persistPreferences) return;

      try {
        // Don't save userPrompt to storage (it's per-analysis)
        const { userPrompt, ...prefsToSave } = prefs;
        await storage.setObject(CUSTOMIZATION_STORAGE_KEY, prefsToSave);
      } catch (error) {
        console.error('Failed to save customization preferences:', error);
      }
    },
    [persistPreferences]
  );

  // Update customization
  const updateCustomization = useCallback(
    (updates: Partial<AnalysisCustomization>) => {
      const newCustomization = { ...customization, ...updates };
      setCustomization(newCustomization);
      onCustomizationChange(newCustomization);
      savePreferences(newCustomization);
    },
    [customization, onCustomizationChange, savePreferences]
  );

  // Toggle Anti-AI Detection with animation and haptic
  const toggleAntiAIDetection = useCallback(() => {
    // Strong haptic feedback for this important toggle
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    updateCustomization({ antiAIDetection: !customization.antiAIDetection });
  }, [customization.antiAIDetection, updateCustomization, scaleAnim]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 USER PROMPT INPUT
  // ═══════════════════════════════════════════════════════════════════════════

  const renderUserPromptInput = () => (
    <View style={styles.section}>
      <View style={styles.promptHeader}>
        <Ionicons name="create-outline" size={18} color={colors.accentPrimary} />
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: Spacing.xs }]}>
          {t('Instructions personnalisées', 'Custom Instructions')}
        </Text>
      </View>
      <Text style={[styles.promptHint, { color: colors.textMuted }]}>
        {t(
          'Ajoutez des instructions spécifiques pour personnaliser votre analyse',
          'Add specific instructions to customize your analysis'
        )}
      </Text>
      <TextInput
        style={[
          styles.promptInput,
          {
            backgroundColor: colors.bgTertiary,
            color: colors.textPrimary,
            borderColor: customization.userPrompt ? colors.accentPrimary : colors.border,
          },
        ]}
        placeholder={t(
          'Ex: "Concentre-toi sur les aspects techniques" ou "Résume pour un débutant"...',
          'E.g.: "Focus on technical aspects" or "Summarize for a beginner"...'
        )}
        placeholderTextColor={colors.textMuted}
        value={customization.userPrompt || ''}
        onChangeText={(text) => updateCustomization({ userPrompt: text })}
        multiline
        numberOfLines={3}
        maxLength={500}
        textAlignVertical="top"
        editable={!disabled}
        accessibilityLabel={t('Instructions personnalisées', 'Custom instructions')}
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>
        {(customization.userPrompt || '').length}/500
      </Text>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ ANTI-AI DETECTION BUTTON (72px prominent)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderAntiAIButton = () => {
    const isActive = customization.antiAIDetection;

    return (
      <View style={styles.antiAIContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            onPress={toggleAntiAIDetection}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={t('Anti-Détection IA', 'Anti-AI Detection')}
            accessibilityHint={t(
              'Active ou désactive la réécriture humanisée pour éviter la détection par les outils IA',
              'Toggle humanized rewriting to avoid AI detection tools'
            )}
          >
            <LinearGradient
              colors={isActive ? ['#10B981', '#059669'] : [colors.bgTertiary, colors.bgSecondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.antiAIButton,
                isActive && styles.antiAIButtonActive,
                !isActive && { borderWidth: 1, borderColor: colors.border },
                disabled && styles.disabled,
              ]}
            >
              <View style={styles.antiAIContent}>
                <View style={[
                  styles.antiAIIconContainer,
                  {
                    backgroundColor: isActive
                      ? 'rgba(255, 255, 255, 0.2)'
                      : colors.accentPrimary + '20',
                  },
                ]}>
                  <Ionicons
                    name={isActive ? 'shield-checkmark' : 'shield-outline'}
                    size={28}
                    color={isActive ? '#FFFFFF' : colors.accentPrimary}
                  />
                </View>
                <View style={styles.antiAITextContainer}>
                  <Text style={[
                    styles.antiAITitle,
                    { color: isActive ? '#FFFFFF' : colors.textPrimary },
                  ]}>
                    {t('Anti-Détection IA', 'Anti-AI Detection')}
                  </Text>
                  <Text style={[
                    styles.antiAISubtitle,
                    { color: isActive ? 'rgba(255, 255, 255, 0.85)' : colors.textSecondary },
                  ]}>
                    {t(
                      'Humanise le texte pour éviter la détection',
                      'Humanizes text to avoid detection'
                    )}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.antiAIBadge,
                {
                  backgroundColor: isActive
                    ? 'rgba(255, 255, 255, 0.3)'
                    : colors.accentPrimary + '20',
                },
              ]}>
                <Text style={[
                  styles.antiAIBadgeText,
                  { color: isActive ? '#FFFFFF' : colors.accentPrimary },
                ]}>
                  {isActive ? 'ON' : 'OFF'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Info tooltip */}
        <View style={[styles.antiAIInfo, { backgroundColor: colors.bgTertiary }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.antiAIInfoText, { color: colors.textMuted }]}>
            {t(
              'Réécrit le texte avec des variations naturelles pour le rendre indétectable par GPTZero, Turnitin, etc.',
              'Rewrites text with natural variations to make it undetectable by GPTZero, Turnitin, etc.'
            )}
          </Text>
        </View>
      </View>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 WRITING STYLE SELECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  const renderWritingStyleSelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t("Style d'écriture", 'Writing Style')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.styleScrollContent}
      >
        {Object.entries(WRITING_STYLE_CONFIG).map(([key, config]) => {
          const isSelected = customization.writingStyle === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => {
                Haptics.selectionAsync();
                updateCustomization({ writingStyle: key as WritingStyle });
              }}
              disabled={disabled}
              style={[
                styles.styleOption,
                {
                  backgroundColor: isSelected ? colors.accentPrimary : colors.bgTertiary,
                  borderColor: isSelected ? colors.accentPrimary : colors.border,
                },
                disabled && styles.disabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons
                name={config.icon as any}
                size={20}
                color={isSelected ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.styleLabel,
                  { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                ]}
              >
                {config.label[language]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 📏 TARGET LENGTH SELECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  const renderLengthSelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t('Longueur cible', 'Target Length')}
      </Text>
      <View style={styles.lengthContainer}>
        {(Object.keys(LENGTH_CONFIG) as TargetLength[]).map((length) => {
          const isSelected = customization.targetLength === length;
          const config = LENGTH_CONFIG[length];
          return (
            <TouchableOpacity
              key={length}
              onPress={() => {
                Haptics.selectionAsync();
                updateCustomization({ targetLength: length });
              }}
              disabled={disabled}
              style={[
                styles.lengthOption,
                {
                  backgroundColor: isSelected ? colors.accentPrimary : colors.bgTertiary,
                  borderColor: isSelected ? colors.accentPrimary : colors.border,
                },
                disabled && styles.disabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.lengthLabel,
                  { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                ]}
              >
                {config.label[language]}
              </Text>
              <Text
                style={[
                  styles.lengthDescription,
                  { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textMuted },
                ]}
              >
                {config.description[language]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎚️ FORMALITY SLIDER
  // ═══════════════════════════════════════════════════════════════════════════

  const renderFormalitySlider = () => (
    <View style={styles.section}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t('Niveau de formalité', 'Formality Level')}
        </Text>
        <Text style={[styles.sliderValue, { color: colors.accentPrimary }]}>
          {customization.formalityLevel}/5
        </Text>
      </View>
      <View style={styles.sliderTrack}>
        {([1, 2, 3, 4, 5] as FormalityLevel[]).map((level) => (
          <TouchableOpacity
            key={level}
            onPress={() => {
              Haptics.selectionAsync();
              updateCustomization({ formalityLevel: level });
            }}
            disabled={disabled}
            style={[
              styles.sliderDot,
              {
                backgroundColor:
                  level <= customization.formalityLevel
                    ? colors.accentPrimary
                    : colors.bgTertiary,
                borderWidth: level === customization.formalityLevel ? 2 : 0,
                borderColor: colors.accentPrimary,
              },
            ]}
            accessibilityRole="adjustable"
            accessibilityValue={{ now: customization.formalityLevel, min: 1, max: 5 }}
          />
        ))}
      </View>
      <View style={styles.sliderLabels}>
        <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>
          {t('Décontracté', 'Casual')}
        </Text>
        <Text style={[styles.sliderLabel, { color: colors.textMuted }]}>
          {t('Formel', 'Formal')}
        </Text>
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 📚 VOCABULARY COMPLEXITY
  // ═══════════════════════════════════════════════════════════════════════════

  const renderVocabularySelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t('Complexité du vocabulaire', 'Vocabulary Complexity')}
      </Text>
      <View style={styles.vocabularyContainer}>
        {(Object.keys(VOCABULARY_CONFIG) as VocabularyComplexity[]).map((level) => {
          const isSelected = customization.vocabularyComplexity === level;
          const config = VOCABULARY_CONFIG[level];
          return (
            <TouchableOpacity
              key={level}
              onPress={() => {
                Haptics.selectionAsync();
                updateCustomization({ vocabularyComplexity: level });
              }}
              disabled={disabled}
              style={[
                styles.vocabularyOption,
                {
                  backgroundColor: isSelected ? colors.accentPrimary : colors.bgTertiary,
                  borderColor: isSelected ? colors.accentPrimary : colors.border,
                },
                disabled && styles.disabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.vocabularyLabel,
                  { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                ]}
              >
                {config.label[language]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚙️ ADDITIONAL OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderAdditionalOptions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t('Options supplémentaires', 'Additional Options')}
      </Text>

      <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
        <View style={styles.optionTextContainer}>
          <Ionicons name="bulb-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
            {t('Inclure des exemples', 'Include Examples')}
          </Text>
        </View>
        <Switch
          value={customization.includeExamples}
          onValueChange={(value) => {
            Haptics.selectionAsync();
            updateCustomization({ includeExamples: value });
          }}
          disabled={disabled}
          trackColor={{ false: colors.bgTertiary, true: colors.accentPrimary }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={styles.optionRow}>
        <View style={styles.optionTextContainer}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
            {t('Ton personnel (Je/Nous)', 'Personal Tone (I/We)')}
          </Text>
        </View>
        <Switch
          value={customization.personalTone}
          onValueChange={(value) => {
            Haptics.selectionAsync();
            updateCustomization({ personalTone: value });
          }}
          disabled={disabled}
          trackColor={{ false: colors.bgTertiary, true: colors.accentPrimary }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 COMPACT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.bgSecondary }]}>
        {renderAntiAIButton()}
        <View style={styles.compactOptions}>
          <TouchableOpacity
            style={[styles.compactOption, { backgroundColor: colors.bgTertiary }]}
            onPress={() => setAdvancedExpanded(!advancedExpanded)}
          >
            <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.compactOptionText, { color: colors.textPrimary }]}>
              {WRITING_STYLE_CONFIG[customization.writingStyle].label[language]}
            </Text>
            <Ionicons
              name={advancedExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        {advancedExpanded && (
          <View style={[styles.compactExpandedOptions, { borderTopColor: colors.border }]}>
            {renderUserPromptInput()}
            {renderWritingStyleSelector()}
            {renderLengthSelector()}
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 FULL MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (!isLoaded) {
    return null; // Don't render until preferences are loaded
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Ionicons name="options" size={20} color={colors.accentPrimary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('Personnalisation avancée', 'Advanced Customization')}
          </Text>
        </View>

        {/* User Prompt Input */}
        {renderUserPromptInput()}

        {/* Prominent Anti-AI Button */}
        {renderAntiAIButton()}

        {/* Writing Style */}
        {renderWritingStyleSelector()}

        {/* Target Length */}
        {renderLengthSelector()}

        {/* Advanced Options Toggle */}
        {showAdvanced && (
          <>
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => {
                Haptics.selectionAsync();
                setAdvancedExpanded(!advancedExpanded);
              }}
            >
              <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>
                {t('Options avancées', 'Advanced Options')}
              </Text>
              <Ionicons
                name={advancedExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {advancedExpanded && (
              <>
                {renderFormalitySlider()}
                {renderVocabularySelector()}
                {renderAdditionalOptions()}
              </>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },

  // User Prompt Input
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  promptHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.sm,
  },
  promptInput: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    minHeight: 80,
    maxHeight: 120,
  },
  charCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Anti-AI Button (72px height)
  antiAIContainer: {
    marginBottom: Spacing.lg,
  },
  antiAIButton: {
    height: 72,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    ...Shadows.lg,
  },
  antiAIButtonActive: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  antiAIContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  antiAIIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  antiAITextContainer: {
    flex: 1,
  },
  antiAITitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyBold,
  },
  antiAISubtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  antiAIBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  antiAIBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyBold,
  },
  antiAIInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  antiAIInfoText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    flex: 1,
    lineHeight: 16,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
  },

  // Writing Style
  styleScrollContent: {
    paddingRight: Spacing.md,
    gap: Spacing.sm,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    marginRight: Spacing.sm,
  },
  styleLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },

  // Length
  lengthContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  lengthOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  lengthLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  lengthDescription: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },

  // Formality Slider
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sliderValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyBold,
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: Spacing.lg,
  },
  sliderDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sliderLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },

  // Vocabulary
  vocabularyContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  vocabularyOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  vocabularyLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },

  // Additional Options
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  optionTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },

  // Advanced Toggle
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  advancedToggleText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },

  // Compact Mode
  compactContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  compactOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  compactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  compactOptionText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  compactExpandedOptions: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },

  // Disabled state
  disabled: {
    opacity: 0.5,
  },
});

export default CustomizationPanel;
