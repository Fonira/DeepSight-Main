/**
 * Suggested Questions Component for DeepSight Mobile
 *
 * Displays context-aware suggested questions for chat interactions.
 * Features:
 * - Plan-based feature gating
 * - Multiple question categories
 * - Animated interactions
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { hasFeature, getMinPlanForFeature, getPlanInfo } from '../../config/planPrivileges';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface SuggestedQuestionsProps {
  onQuestionSelect: (question: string) => void;
  variant?: 'chat' | 'analysis' | 'playlist';
  category?: string;
  videoTitle?: string;
  disabled?: boolean;
  compact?: boolean;
}

// Question templates by category and language
const QUESTION_TEMPLATES = {
  general: {
    fr: [
      'Quels sont les points clés de cette vidéo ?',
      'Peux-tu me faire un résumé en 3 phrases ?',
      'Quels sont les arguments principaux présentés ?',
      'Y a-t-il des contradictions dans le contenu ?',
      'Quelles sont les sources mentionnées ?',
    ],
    en: [
      'What are the key points of this video?',
      'Can you summarize this in 3 sentences?',
      'What are the main arguments presented?',
      'Are there any contradictions in the content?',
      'What sources are mentioned?',
    ],
  },
  education: {
    fr: [
      'Quels concepts devrais-je retenir pour un examen ?',
      'Peux-tu expliquer le concept principal autrement ?',
      'Quels sont les prérequis pour comprendre ce sujet ?',
      'Comment ce sujet se connecte-t-il à d\'autres domaines ?',
      'Quels exercices pourrais-je faire pour pratiquer ?',
    ],
    en: [
      'What concepts should I remember for an exam?',
      'Can you explain the main concept differently?',
      'What are the prerequisites to understand this topic?',
      'How does this topic connect to other fields?',
      'What exercises could I do to practice?',
    ],
  },
  tech: {
    fr: [
      'Quelles technologies sont mentionnées ?',
      'Quels sont les avantages et inconvénients présentés ?',
      'Comment implémenter cela en pratique ?',
      'Y a-t-il des alternatives à cette approche ?',
      'Quelles sont les bonnes pratiques recommandées ?',
    ],
    en: [
      'What technologies are mentioned?',
      'What are the pros and cons presented?',
      'How to implement this in practice?',
      'Are there alternatives to this approach?',
      'What best practices are recommended?',
    ],
  },
  science: {
    fr: [
      'Quelle est la méthodologie utilisée ?',
      'Quelles sont les limitations de cette étude ?',
      'Quelles sont les implications de ces résultats ?',
      'Comment vérifier ces affirmations ?',
      'Quelles recherches futures sont suggérées ?',
    ],
    en: [
      'What methodology was used?',
      'What are the limitations of this study?',
      'What are the implications of these results?',
      'How to verify these claims?',
      'What future research is suggested?',
    ],
  },
  playlist: {
    fr: [
      'Quels thèmes communs traversent toutes ces vidéos ?',
      'Quelle vidéo est la plus pertinente pour commencer ?',
      'Y a-t-il des contradictions entre les vidéos ?',
      'Peux-tu faire une synthèse globale du corpus ?',
      'Quels points de vue différents sont présentés ?',
    ],
    en: [
      'What common themes run through all these videos?',
      'Which video is most relevant to start with?',
      'Are there contradictions between the videos?',
      'Can you make an overall synthesis of the corpus?',
      'What different viewpoints are presented?',
    ],
  },
};

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  onQuestionSelect,
  variant = 'chat',
  category = 'general',
  videoTitle,
  disabled = false,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const userPlan = user?.plan || 'free';
  const hasAccess = hasFeature(userPlan, 'chatSuggestedQuestions');

  // Get questions based on category and language
  const questions = useMemo(() => {
    const lang = language === 'en' ? 'en' : 'fr';
    let categoryKey = category.toLowerCase();

    // Map to available categories
    if (variant === 'playlist') {
      categoryKey = 'playlist';
    } else if (!QUESTION_TEMPLATES[categoryKey as keyof typeof QUESTION_TEMPLATES]) {
      categoryKey = 'general';
    }

    const templates = QUESTION_TEMPLATES[categoryKey as keyof typeof QUESTION_TEMPLATES] || QUESTION_TEMPLATES.general;
    const langQuestions = templates[lang] || templates.fr;

    // Return fewer questions in compact mode
    return compact ? langQuestions.slice(0, 3) : langQuestions;
  }, [category, language, variant, compact]);

  const handleQuestionPress = (question: string) => {
    if (disabled || !hasAccess) return;
    Haptics.selectionAsync();
    onQuestionSelect(question);
  };

  // If no access, show upgrade prompt
  if (!hasAccess) {
    const minPlan = getMinPlanForFeature('chatSuggestedQuestions');
    const planInfo = getPlanInfo(minPlan);
    const planName = planInfo.name[language as 'fr' | 'en'] || planInfo.name.fr;

    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.lockedContainer, { backgroundColor: colors.bgSecondary }]}>
          <Ionicons name="lock-closed" size={20} color={colors.textTertiary} />
          <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
            {language === 'fr'
              ? `Questions suggérées disponibles avec le plan ${planName}+`
              : `Suggested questions available with ${planName}+ plan`
            }
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {!compact && (
        <View style={styles.header}>
          <Ionicons name="sparkles" size={16} color={colors.accentWarning} />
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'Questions suggérées' : 'Suggested questions'}
          </Text>
        </View>
      )}

      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.horizontalList : styles.verticalList}
      >
        {questions.map((question, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.questionButton,
              compact && styles.questionButtonCompact,
              {
                borderColor: colors.border,
                backgroundColor: colors.bgSecondary,
              },
              disabled && styles.questionButtonDisabled,
            ]}
            onPress={() => handleQuestionPress(question)}
            disabled={disabled}
          >
            <Ionicons
              name="arrow-forward-circle-outline"
              size={compact ? 14 : 16}
              color={colors.accentPrimary}
              style={styles.questionIcon}
            />
            <Text
              style={[
                styles.questionText,
                compact && styles.questionTextCompact,
                { color: colors.textPrimary },
              ]}
              numberOfLines={compact ? 1 : 2}
            >
              {question}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
  },
  containerCompact: {
    marginTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  headerText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  verticalList: {
    gap: Spacing.sm,
  },
  horizontalList: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  questionButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    minHeight: 44,
  },
  questionButtonCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    maxWidth: 200,
  },
  questionButtonDisabled: {
    opacity: 0.5,
  },
  questionIcon: {
    marginTop: 2,
  },
  questionText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.4,
  },
  questionTextCompact: {
    fontSize: Typography.fontSize.xs,
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  lockedText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
});

export default SuggestedQuestions;
