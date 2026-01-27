import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { validateYouTubeUrl, URLValidationResult } from '../utils/formatters';
import { sanitizeUrlInput, sanitizeTextInput, sanitizeSearchQuery } from '../utils/sanitize';

type InputMode = 'url' | 'text' | 'search';

interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
}

interface AnalysisMode {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
}

interface SmartInputBarProps {
  onSubmit: (data: {
    inputType: InputMode;
    value: string;
    category: string;
    mode: string;
    language?: string;
    title?: string;
    source?: string;
    deepResearch?: boolean;
  }) => void;
  isLoading?: boolean;
  creditCost?: number;
  creditsRemaining?: number;
  userPlan?: string;
}

const CATEGORIES: Category[] = [
  { id: 'auto', name: 'Auto', nameEn: 'Auto', icon: 'sparkles' },
  { id: 'interview', name: 'Interview', nameEn: 'Interview', icon: 'mic' },
  { id: 'tech', name: 'Tech', nameEn: 'Tech', icon: 'hardware-chip' },
  { id: 'science', name: 'Science', nameEn: 'Science', icon: 'flask' },
  { id: 'education', name: 'Éducation', nameEn: 'Education', icon: 'school' },
  { id: 'finance', name: 'Finance', nameEn: 'Finance', icon: 'cash' },
  { id: 'gaming', name: 'Gaming', nameEn: 'Gaming', icon: 'game-controller' },
  { id: 'culture', name: 'Culture', nameEn: 'Culture', icon: 'color-palette' },
  { id: 'news', name: 'Actualités', nameEn: 'News', icon: 'newspaper' },
  { id: 'health', name: 'Santé', nameEn: 'Health', icon: 'fitness' },
];

const ANALYSIS_MODES: AnalysisMode[] = [
  {
    id: 'accessible',
    name: 'Accessible',
    nameEn: 'Accessible',
    description: 'Synthèse simple et claire',
    descriptionEn: 'Simple and clear summary',
  },
  {
    id: 'standard',
    name: 'Standard',
    nameEn: 'Standard',
    description: 'Analyse équilibrée (recommandé)',
    descriptionEn: 'Balanced analysis (recommended)',
  },
  {
    id: 'expert',
    name: 'Expert',
    nameEn: 'Expert',
    description: 'Analyse technique approfondie',
    descriptionEn: 'In-depth technical analysis',
  },
];

const SEARCH_LANGUAGES = [
  { id: 'fr', name: 'Français', flag: '🇫🇷' },
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'es', name: 'Español', flag: '🇪🇸' },
  { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { id: 'it', name: 'Italiano', flag: '🇮🇹' },
  { id: 'pt', name: 'Português', flag: '🇧🇷' },
];

const SmartInputBarComponent: React.FC<SmartInputBarProps> = ({
  onSubmit,
  isLoading = false,
  creditCost,
  creditsRemaining,
  userPlan = 'free',
}) => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('auto');
  const [selectedMode, setSelectedMode] = useState('standard');
  const [searchLanguage, setSearchLanguage] = useState('fr');
  const [textTitle, setTextTitle] = useState('');
  const [textSource, setTextSource] = useState('');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [urlValidation, setUrlValidation] = useState<URLValidationResult | null>(null);

  // Check if user has access to deep research (Pro+ plans)
  const hasDeepResearchAccess = ['pro', 'expert', 'team'].includes(userPlan.toLowerCase());

  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  const colors = isDark ? Colors : Colors.light;

  const detectInputType = useCallback((value: string): InputMode => {
    const trimmed = value.trim();
    if (
      trimmed.includes('youtube.com') ||
      trimmed.includes('youtu.be') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://')
    ) {
      return 'url';
    }
    if (trimmed.length > 100) {
      return 'text';
    }
    return inputMode;
  }, [inputMode]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    // Real-time URL validation
    if (inputMode === 'url' && value.trim().length > 0) {
      const validation = validateYouTubeUrl(value);
      setUrlValidation(validation);
    } else {
      setUrlValidation(null);
    }

    // Auto-detect mode for longer inputs
    if (value.length > 50) {
      const detected = detectInputType(value);
      if (detected !== inputMode && detected !== 'search') {
        setInputMode(detected);
      }
    }
  }, [detectInputType, inputMode]);

  const handleModeChange = useCallback((mode: InputMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputMode(mode);
    setInputValue('');
    setUrlValidation(null);
  }, []);

  const handleCategorySelect = useCallback((categoryId: string) => {
    Haptics.selectionAsync();
    setSelectedCategory(categoryId);
  }, []);

  const handleAnalysisModeSelect = useCallback((modeId: string) => {
    Haptics.selectionAsync();
    setSelectedMode(modeId);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;

    // Sanitize input based on mode
    let sanitizedValue: string;
    switch (inputMode) {
      case 'url':
        sanitizedValue = sanitizeUrlInput(inputValue);
        break;
      case 'text':
        sanitizedValue = sanitizeTextInput(inputValue);
        break;
      case 'search':
        sanitizedValue = sanitizeSearchQuery(inputValue);
        break;
      default:
        sanitizedValue = inputValue.trim();
    }

    // Don't submit if sanitization removed everything (e.g., dangerous URL)
    if (!sanitizedValue) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    // Animate button
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

    onSubmit({
      inputType: inputMode,
      value: sanitizedValue,
      category: selectedCategory,
      mode: selectedMode,
      language: inputMode === 'search' ? searchLanguage : undefined,
      title: inputMode === 'text' ? sanitizeTextInput(textTitle) : undefined,
      source: inputMode === 'text' ? sanitizeTextInput(textSource) : undefined,
      deepResearch: deepResearch && hasDeepResearchAccess,
    });
  }, [inputValue, inputMode, selectedCategory, selectedMode, searchLanguage, textTitle, textSource, isLoading, onSubmit, scaleAnim, deepResearch, hasDeepResearchAccess]);

  const getPlaceholder = useCallback(() => {
    switch (inputMode) {
      case 'url':
        return isEn
          ? 'Paste a YouTube URL or playlist link...'
          : 'Collez une URL YouTube ou un lien de playlist...';
      case 'text':
        return isEn
          ? 'Paste or type the text to analyze...'
          : 'Collez ou tapez le texte à analyser...';
      case 'search':
        return isEn
          ? 'Search for videos to analyze...'
          : 'Recherchez des vidéos à analyser...';
    }
  }, [inputMode, isEn]);

  const getIcon = useCallback(() => {
    switch (inputMode) {
      case 'url':
        return 'link';
      case 'text':
        return 'document-text';
      case 'search':
        return 'search';
    }
  }, [inputMode]);

  const canSubmit = inputValue.trim().length > 0 && !isLoading;

  return (
    <View style={styles.container}>
      {/* Mode Tabs */}
      <View style={[styles.modeTabs, { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary }]}>
        {(['url', 'text', 'search'] as InputMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeTab,
              inputMode === mode && styles.modeTabActive,
              inputMode === mode && { backgroundColor: Colors.accentPrimary },
            ]}
            onPress={() => handleModeChange(mode)}
          >
            <Ionicons
              name={mode === 'url' ? 'link' : mode === 'text' ? 'document-text' : 'search'}
              size={16}
              color={inputMode === mode ? '#fff' : isDark ? Colors.textSecondary : Colors.light.textSecondary}
            />
            <Text
              style={[
                styles.modeTabText,
                { color: inputMode === mode ? '#fff' : isDark ? Colors.textSecondary : Colors.light.textSecondary },
              ]}
            >
              {mode === 'url' ? 'URL' : mode === 'text' ? (isEn ? 'Text' : 'Texte') : (isEn ? 'Search' : 'Recherche')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Language Selector */}
      {inputMode === 'search' && (
        <View style={styles.languageSelector}>
          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary }]}
            onPress={() => setShowLanguageSelector(!showLanguageSelector)}
          >
            <Text style={styles.languageFlag}>
              {SEARCH_LANGUAGES.find((l) => l.id === searchLanguage)?.flag}
            </Text>
            <Text style={[styles.languageText, { color: isDark ? Colors.textPrimary : Colors.light.textPrimary }]}>
              {SEARCH_LANGUAGES.find((l) => l.id === searchLanguage)?.name}
            </Text>
            <Ionicons name="chevron-down" size={16} color={isDark ? Colors.textSecondary : Colors.light.textSecondary} />
          </TouchableOpacity>

          {showLanguageSelector && (
            <View style={[styles.languageDropdown, { backgroundColor: isDark ? Colors.bgElevated : Colors.light.bgPrimary }]}>
              {SEARCH_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.id}
                  style={[styles.languageOption, searchLanguage === lang.id && styles.languageOptionActive]}
                  onPress={() => {
                    setSearchLanguage(lang.id);
                    setShowLanguageSelector(false);
                  }}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <Text style={[styles.languageText, { color: isDark ? Colors.textPrimary : Colors.light.textPrimary }]}>
                    {lang.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Text Mode: Title and Source */}
      {inputMode === 'text' && (
        <View style={styles.textMetaContainer}>
          <TextInput
            style={[
              styles.textMetaInput,
              {
                backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary,
                color: isDark ? Colors.textPrimary : Colors.light.textPrimary,
              },
            ]}
            placeholder={isEn ? 'Title (optional)' : 'Titre (optionnel)'}
            placeholderTextColor={isDark ? Colors.textMuted : Colors.light.textSecondary}
            value={textTitle}
            onChangeText={setTextTitle}
          />
          <TextInput
            style={[
              styles.textMetaInput,
              {
                backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary,
                color: isDark ? Colors.textPrimary : Colors.light.textPrimary,
              },
            ]}
            placeholder={isEn ? 'Source (optional)' : 'Source (optionnel)'}
            placeholderTextColor={isDark ? Colors.textMuted : Colors.light.textSecondary}
            value={textSource}
            onChangeText={setTextSource}
          />
        </View>
      )}

      {/* Main Input */}
      <View style={[styles.inputContainer, { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary }]}>
        <Ionicons
          name={getIcon()}
          size={20}
          color={isDark ? Colors.textMuted : Colors.light.textSecondary}
          style={styles.inputIcon}
        />
        <TextInput
          style={[
            styles.input,
            inputMode === 'text' && styles.inputMultiline,
            { color: isDark ? Colors.textPrimary : Colors.light.textPrimary },
          ]}
          placeholder={getPlaceholder()}
          placeholderTextColor={isDark ? Colors.textMuted : Colors.light.textSecondary}
          value={inputValue}
          onChangeText={handleInputChange}
          multiline={inputMode === 'text'}
          numberOfLines={inputMode === 'text' ? 4 : 1}
          autoCapitalize="none"
          autoCorrect={inputMode === 'text'}
          keyboardType={inputMode === 'url' ? 'url' : 'default'}
        />
        {inputValue.length > 0 && (
          <TouchableOpacity onPress={() => { setInputValue(''); setUrlValidation(null); }} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={isDark ? Colors.textMuted : Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* URL Validation Indicator */}
      {inputMode === 'url' && urlValidation && inputValue.trim().length > 0 && (
        <View style={styles.validationIndicator}>
          <Ionicons
            name={urlValidation.isValid ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={urlValidation.isValid ? Colors.accentSuccess : Colors.accentError}
          />
          <Text style={[
            styles.validationText,
            { color: urlValidation.isValid ? Colors.accentSuccess : Colors.accentError }
          ]}>
            {urlValidation.isValid
              ? (isEn ? 'Valid YouTube URL' : 'URL YouTube valide')
              + (urlValidation.urlType === 'shorts' ? (isEn ? ' (Shorts)' : ' (Shorts)') : '')
              : (urlValidation.error || (isEn ? 'Invalid URL format' : 'Format d\'URL invalide'))
            }
          </Text>
        </View>
      )}

      {/* Category Selector */}
      <View style={styles.selectorSection}>
        <Text style={[styles.selectorLabel, { color: isDark ? Colors.textSecondary : Colors.light.textSecondary }]}>
          {isEn ? 'Category' : 'Catégorie'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.chip,
                { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary },
                selectedCategory === category.id && styles.chipActive,
              ]}
              onPress={() => handleCategorySelect(category.id)}
            >
              <Ionicons
                name={category.icon as any}
                size={14}
                color={selectedCategory === category.id ? '#fff' : isDark ? Colors.textSecondary : Colors.light.textSecondary}
              />
              <Text
                style={[
                  styles.chipText,
                  {
                    color: selectedCategory === category.id ? '#fff' : isDark ? Colors.textSecondary : Colors.light.textSecondary,
                  },
                ]}
              >
                {isEn ? category.nameEn : category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Analysis Mode Selector */}
      <View style={styles.selectorSection}>
        <Text style={[styles.selectorLabel, { color: isDark ? Colors.textSecondary : Colors.light.textSecondary }]}>
          {isEn ? 'Analysis Mode' : "Mode d'analyse"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {ANALYSIS_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.modeChip,
                { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary },
                selectedMode === mode.id && styles.chipActive,
              ]}
              onPress={() => handleAnalysisModeSelect(mode.id)}
            >
              <Text
                style={[
                  styles.modeChipTitle,
                  {
                    color: selectedMode === mode.id ? '#fff' : isDark ? Colors.textPrimary : Colors.light.textPrimary,
                  },
                ]}
              >
                {isEn ? mode.nameEn : mode.name}
              </Text>
              <Text
                style={[
                  styles.modeChipDescription,
                  {
                    color: selectedMode === mode.id ? 'rgba(255,255,255,0.8)' : isDark ? Colors.textMuted : Colors.light.textSecondary,
                  },
                ]}
              >
                {isEn ? mode.descriptionEn : mode.description}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Deep Research Toggle */}
      <View style={styles.deepResearchContainer}>
        <TouchableOpacity
          style={[
            styles.deepResearchToggle,
            { backgroundColor: isDark ? Colors.bgTertiary : Colors.light.bgSecondary },
            deepResearch && hasDeepResearchAccess && { backgroundColor: Colors.accentPrimary + '20', borderColor: Colors.accentPrimary, borderWidth: 1 },
            !hasDeepResearchAccess && { opacity: 0.5 },
          ]}
          onPress={() => {
            if (hasDeepResearchAccess) {
              Haptics.selectionAsync();
              setDeepResearch(!deepResearch);
            }
          }}
          disabled={!hasDeepResearchAccess}
        >
          <Ionicons
            name={deepResearch && hasDeepResearchAccess ? 'checkbox' : 'square-outline'}
            size={18}
            color={deepResearch && hasDeepResearchAccess ? Colors.accentPrimary : isDark ? Colors.textSecondary : Colors.light.textSecondary}
          />
          <View style={styles.deepResearchText}>
            <Text style={[
              styles.deepResearchLabel,
              { color: deepResearch && hasDeepResearchAccess ? Colors.accentPrimary : isDark ? Colors.textPrimary : Colors.light.textPrimary },
            ]}>
              {isEn ? 'Deep Research' : 'Recherche approfondie'}
            </Text>
            <Text style={[styles.deepResearchDesc, { color: isDark ? Colors.textMuted : Colors.light.textSecondary }]}>
              {hasDeepResearchAccess
                ? (isEn ? 'Enhanced analysis with web search' : 'Analyse améliorée avec recherche web')
                : (isEn ? 'Pro+ feature' : 'Fonctionnalité Pro+')
              }
            </Text>
          </View>
          {!hasDeepResearchAccess && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO+</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Credit Cost Preview */}
      {creditCost !== undefined && (
        <View style={styles.creditPreview}>
          <Ionicons name="flash" size={14} color={Colors.accentSecondary} />
          <Text style={[styles.creditText, { color: isDark ? Colors.textSecondary : Colors.light.textSecondary }]}>
            {isEn ? `Cost: ${creditCost} credits` : `Coût: ${creditCost} crédits`}
            {creditsRemaining !== undefined && (
              <Text style={{ color: creditsRemaining < creditCost ? Colors.accentError : Colors.accentSuccess }}>
                {` (${creditsRemaining} ${isEn ? 'remaining' : 'restants'})`}
              </Text>
            )}
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={canSubmit ? Colors.gradientPrimary : [Colors.bgTertiary, Colors.bgTertiary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          >
            {isLoading ? (
              <Ionicons name="hourglass" size={20} color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={canSubmit ? '#fff' : Colors.textMuted} />
                <Text style={[styles.submitButtonText, !canSubmit && { color: Colors.textMuted }]}>
                  {isEn ? 'Analyze' : 'Analyser'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  modeTabActive: {
    backgroundColor: Colors.accentPrimary,
  },
  modeTabText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.sm,
  },
  languageSelector: {
    position: 'relative',
    zIndex: 10,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  languageDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    zIndex: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  languageOptionActive: {
    backgroundColor: Colors.accentPrimary + '20',
  },
  languageFlag: {
    fontSize: 18,
  },
  languageText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
  textMetaContainer: {
    gap: Spacing.sm,
  },
  textMetaInput: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputIcon: {
    marginTop: Spacing.sm,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.base,
    paddingVertical: Spacing.sm,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  clearButton: {
    padding: Spacing.sm,
  },
  validationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.xs,
    gap: Spacing.xs,
  },
  validationText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
  selectorSection: {
    gap: Spacing.sm,
  },
  selectorLabel: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.xs,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    gap: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
  },
  chipText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.xs,
  },
  modeChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
    minWidth: 120,
  },
  modeChipTitle: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.sm,
    marginBottom: 2,
  },
  modeChipDescription: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
  deepResearchContainer: {
    marginTop: Spacing.xs,
  },
  deepResearchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  deepResearchText: {
    flex: 1,
  },
  deepResearchLabel: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.sm,
  },
  deepResearchDesc: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
  proBadge: {
    backgroundColor: Colors.accentSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: 10,
  },
  creditPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  creditText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.base,
    color: '#fff',
  },
});

// Memoize the component to prevent unnecessary re-renders
export const SmartInputBar = memo(SmartInputBarComponent);

export default SmartInputBar;
