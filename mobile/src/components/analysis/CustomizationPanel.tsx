/**
 * CustomizationPanel - Panneau de personnalisation d'analyse
 *
 * Switch Anti-AI Detection proéminent avec haptic feedback,
 * instructions personnalisées et options de style.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Animated,
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
  DEFAULT_CUSTOMIZATION,
  WRITING_STYLE_CONFIG,
  LENGTH_CONFIG,
  CUSTOMIZATION_STORAGE_KEY,
} from '../../types/analysis';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomizationPanelProps {
  onCustomizationChange: (customization: AnalysisCustomization) => void;
  initialCustomization?: Partial<AnalysisCustomization>;
  compact?: boolean;
  language?: 'fr' | 'en';
  disabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  onCustomizationChange,
  initialCustomization = {},
  compact = false,
  language = 'fr',
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [customization, setCustomization] = useState<AnalysisCustomization>({
    ...DEFAULT_CUSTOMIZATION,
    ...initialCustomization,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [isLoaded, setIsLoaded] = useState(false);

  const t = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await storage.getObject<Partial<AnalysisCustomization>>(
          CUSTOMIZATION_STORAGE_KEY
        );
        if (saved) {
          const merged = { ...DEFAULT_CUSTOMIZATION, ...saved, ...initialCustomization };
          setCustomization(merged);
          onCustomizationChange(merged);
        }
      } catch (error) {
        if (__DEV__) { console.error('Failed to load customization:', error); }
      } finally {
        setIsLoaded(true);
      }
    };
    loadPreferences();
  }, []);

  // Save preferences
  const savePreferences = useCallback(async (prefs: AnalysisCustomization) => {
    try {
      const { userPrompt, ...prefsToSave } = prefs;
      await storage.setObject(CUSTOMIZATION_STORAGE_KEY, prefsToSave);
    } catch (error) {
      if (__DEV__) { console.error('Failed to save customization:', error); }
    }
  }, []);

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

  // Toggle Anti-AI with animation
  const toggleAntiAI = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    updateCustomization({ antiAIDetection: !customization.antiAIDetection });
  }, [customization.antiAIDetection, updateCustomization, scaleAnim]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTI-AI SWITCH (72px proéminent)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderAntiAISwitch = () => {
    const isActive = customization.antiAIDetection;

    return (
      <View style={styles.antiAIContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            onPress={toggleAntiAI}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={t('Anti-Détection IA', 'Anti-AI Detection')}
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
                <View
                  style={[
                    styles.antiAIIconContainer,
                    { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.accentPrimary + '20' },
                  ]}
                >
                  <Ionicons
                    name={isActive ? 'shield-checkmark' : 'shield-outline'}
                    size={28}
                    color={isActive ? '#FFFFFF' : colors.accentPrimary}
                  />
                </View>
                <View style={styles.antiAITextContainer}>
                  <Text style={[styles.antiAITitle, { color: isActive ? '#FFFFFF' : colors.textPrimary }]}>
                    {t('Anti-Détection IA', 'Anti-AI Detection')}
                  </Text>
                  <Text style={[styles.antiAISubtitle, { color: isActive ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
                    {t('Humanise le texte pour éviter la détection', 'Humanizes text to avoid detection')}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.antiAIBadge,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : colors.accentPrimary + '20' },
                ]}
              >
                <Text style={[styles.antiAIBadgeText, { color: isActive ? '#FFFFFF' : colors.accentPrimary }]}>
                  {isActive ? 'ON' : 'OFF'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

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
  // USER PROMPT INPUT
  // ═══════════════════════════════════════════════════════════════════════════

  const renderUserPrompt = () => (
    <View style={styles.section}>
      <View style={styles.promptHeader}>
        <Ionicons name="create-outline" size={18} color={colors.accentPrimary} />
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginLeft: Spacing.xs }]}>
          {t('Instructions personnalisées', 'Custom Instructions')}
        </Text>
      </View>
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
          'Ex: "Concentre-toi sur les aspects techniques"...',
          'E.g.: "Focus on technical aspects"...'
        )}
        placeholderTextColor={colors.textMuted}
        value={customization.userPrompt || ''}
        onChangeText={(text) => updateCustomization({ userPrompt: text })}
        multiline
        numberOfLines={3}
        maxLength={500}
        textAlignVertical="top"
        editable={!disabled}
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>
        {(customization.userPrompt || '').length}/500
      </Text>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITING STYLE SELECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  const renderStyleSelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t("Style d'écriture", 'Writing Style')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardDismissMode="on-drag" contentContainerStyle={styles.styleScroll}>
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
            >
              <Ionicons
                name={config.icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={isSelected ? '#FFFFFF' : colors.textSecondary}
              />
              <Text style={[styles.styleLabel, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                {config.label[language]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LENGTH SELECTOR
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
            >
              <Text style={[styles.lengthLabel, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                {config.label[language]}
              </Text>
              <Text style={[styles.lengthDesc, { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}>
                {config.description[language]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderOptions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {t('Options', 'Options')}
      </Text>

      <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
        <View style={styles.optionLeft}>
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
        <View style={styles.optionLeft}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
            {t('Ton personnel (Je/Nous)', 'Personal Tone')}
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
  // COMPACT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.bgSecondary }]}>
        {renderAntiAISwitch()}
        <TouchableOpacity
          style={[styles.advancedToggle, { borderTopColor: colors.border }]}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>
            {t('Plus d\'options', 'More Options')}
          </Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {showAdvanced && (
          <View style={styles.advancedContent}>
            {renderUserPrompt()}
            {renderStyleSelector()}
            {renderLengthSelector()}
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (!isLoaded) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="options" size={20} color={colors.accentPrimary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('Personnalisation', 'Customization')}
        </Text>
      </View>

      {renderUserPrompt()}
      {renderAntiAISwitch()}
      {renderStyleSelector()}
      {renderLengthSelector()}

      <TouchableOpacity
        style={[styles.advancedToggle, { borderTopColor: colors.border }]}
        onPress={() => {
          Haptics.selectionAsync();
          setShowAdvanced(!showAdvanced);
        }}
      >
        <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>
          {t('Options avancées', 'Advanced Options')}
        </Text>
        <Ionicons
          name={showAdvanced ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {showAdvanced && renderOptions()}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  compactContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
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

  // Anti-AI Switch (72px)
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
    borderColor: 'rgba(255,255,255,0.3)',
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

  // User Prompt
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
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

  // Style Selector
  styleScroll: {
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

  // Length Selector
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
  lengthDesc: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },

  // Options
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  optionLeft: {
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
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  advancedToggleText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  advancedContent: {
    marginTop: Spacing.md,
  },

  disabled: {
    opacity: 0.5,
  },
});

export default CustomizationPanel;
