/**
 * 📚 StudyScreen — Flashcards & Quiz Mobile Interface
 * Écran d'étude interactif avec modes flashcards et quiz
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Linking } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { studyApi, videoApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { FlashcardsComponent } from '../components/study/FlashcardsComponent';
import { QuizComponent, QuizQuestion } from '../components/study/QuizComponent';
import { Header } from '../components/Header';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { usePlan } from '../hooks/usePlan';
import type { RootStackParamList } from '../types';

type StudyScreenRouteProp = RouteProp<RootStackParamList, 'StudyTools'>;
type StudyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StudyTools'>;

type StudyMode = 'flashcards' | 'quiz' | null;
type StudyState = 'selecting' | 'loading' | 'studying' | 'completed' | 'error';

interface Flashcard {
  front: string;
  back: string;
  category?: string;
}

export const StudyScreen: React.FC = () => {
  const route = useRoute<StudyScreenRouteProp>();
  const navigation = useNavigation<StudyScreenNavigationProp>();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('academic');
  const { flashcardsEnabled } = usePlan();

  const { summaryId } = route.params;

  // State
  const [mode, setMode] = useState<StudyMode>(null);
  const [state, setState] = useState<StudyState>('selecting');
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');

  // Data
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);

  // Load summary info
  useEffect(() => {
    const loadSummary = async () => {
      try {
        const summary = await videoApi.getSummary(summaryId);
        setTitle(summary.title || 'Étude');
      } catch (err) {
        if (__DEV__) { console.error('Failed to load summary:', err); }
      }
    };

    loadSummary();
  }, [summaryId]);

  // Generate content when mode is selected
  const generateContent = useCallback(async (selectedMode: StudyMode) => {
    if (!selectedMode) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('loading');
    setError(null);
    setMode(selectedMode);

    try {
      if (selectedMode === 'flashcards') {
        const response = await studyApi.generateFlashcards(summaryId);
        setFlashcards(response.flashcards.map(f => ({
          front: f.front,
          back: f.back,
          category: f.category,
        })));
      } else {
        const response = await studyApi.generateQuiz(summaryId);
        // Convert API response to QuizQuestion format
        setQuiz(response.quiz.map(q => ({
          question: q.question,
          options: q.options,
          correct: q.correct_index,
          explanation: q.explanation || '',
        })));
      }

      setState('studying');
      refreshUser(); // Refresh credits
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      if (__DEV__) { console.error('Failed to generate content:', err); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (err.status === 402) {
        setError(language === 'fr' 
          ? 'Crédits insuffisants. Veuillez recharger votre compte.'
          : 'Insufficient credits. Please upgrade your account.'
        );
      } else {
        setError(err.message || (language === 'fr' 
          ? 'Erreur lors de la génération du contenu'
          : 'Error generating content'
        ));
      }
      setState('error');
    }
  }, [summaryId, language, refreshUser]);

  // Handle quiz completion
  const handleQuizComplete = useCallback((score: number, total: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState('completed');
  }, []);

  // Handle flashcard completion
  const handleFlashcardsComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState('completed');
  }, []);

  // Retry
  const handleRetry = useCallback(() => {
    setError(null);
    setState('selecting');
    setMode(null);
  }, []);

  // Render mode selection
  const renderModeSelection = () => (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.selectionContainer}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(300)}>
        <Text style={[styles.selectionTitle, { color: colors.textPrimary }]}>
          {language === 'fr' ? "Mode d'étude" : 'Study Mode'}
        </Text>
        <Text style={[styles.selectionSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
          {title}
        </Text>
      </Animated.View>

      {/* Flashcards Option */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <TouchableOpacity
          style={[styles.modeCard, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
          onPress={() => generateContent('flashcards')}
          activeOpacity={0.7}
        >
          <View style={[styles.modeIcon, { backgroundColor: `${colors.accentPrimary}20` }]}>
            <Ionicons name="albums" size={32} color={colors.accentPrimary} />
          </View>
          <View style={styles.modeContent}>
            <Text style={[styles.modeTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Flashcards' : 'Flashcards'}
            </Text>
            <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
              {language === 'fr' 
                ? 'Révisez avec des cartes à retourner. Swipez pour trier.'
                : 'Review with flip cards. Swipe to sort.'
              }
            </Text>
            <View style={styles.modeInfo}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.modeInfoText, { color: colors.textTertiary }]}>~5 min</Text>
              <Text style={[styles.modeInfoText, { color: colors.accentPrimary }]}>• 1 crédit</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Quiz Option */}
      <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <TouchableOpacity
          style={[styles.modeCard, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
          onPress={() => generateContent('quiz')}
          activeOpacity={0.7}
        >
          <View style={[styles.modeIcon, { backgroundColor: `${colors.accentSecondary}20` }]}>
            <Ionicons name="school" size={32} color={colors.accentSecondary} />
          </View>
          <View style={styles.modeContent}>
            <Text style={[styles.modeTitle, { color: colors.textPrimary }]}>
              Quiz
            </Text>
            <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
              {language === 'fr' 
                ? 'Testez votre compréhension avec des QCM.'
                : 'Test your understanding with multiple choice questions.'
              }
            </Text>
            <View style={styles.modeInfo}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.modeInfoText, { color: colors.textTertiary }]}>~10 min</Text>
              <Text style={[styles.modeInfoText, { color: colors.accentSecondary }]}>• 1 crédit</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Credits Info */}
      {user && (
        <Animated.View entering={FadeInDown.delay(300).duration(300)} style={styles.creditsInfo}>
          <Ionicons name="wallet-outline" size={16} color={colors.textTertiary} />
          <Text style={[styles.creditsText, { color: colors.textTertiary }]}>
            {language === 'fr' ? 'Crédits disponibles:' : 'Available credits:'}{' '}
            <Text style={{ color: colors.accentPrimary, fontFamily: Typography.fontFamily.bodySemiBold }}>
              {user.credits}
            </Text>
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );

  // Render loading
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.loadingContent}>
        <View style={[styles.loadingIcon, { backgroundColor: `${colors.accentPrimary}20` }]}>
          <Ionicons 
            name={mode === 'flashcards' ? 'albums' : 'school'} 
            size={40} 
            color={colors.accentPrimary} 
          />
        </View>
        <ActivityIndicator size="large" color={colors.accentPrimary} style={styles.spinner} />
        <Text style={[styles.loadingTitle, { color: colors.textPrimary }]}>
          {language === 'fr' ? 'Génération en cours...' : 'Generating...'}
        </Text>
        <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
          {mode === 'flashcards'
            ? (language === 'fr' ? 'Création des flashcards' : 'Creating flashcards')
            : (language === 'fr' ? 'Préparation du quiz' : 'Preparing quiz')
          }
        </Text>
      </Animated.View>
    </View>
  );

  // Render error
  const renderError = () => (
    <View style={styles.centerContainer}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.errorContent}>
        <View style={[styles.errorIcon, { backgroundColor: `${colors.accentError}20` }]}>
          <Ionicons name="alert-circle" size={48} color={colors.accentError} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          {language === 'fr' ? 'Une erreur est survenue' : 'An error occurred'}
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          {error}
        </Text>
        <View style={styles.errorActions}>
          <Button
            title={language === 'fr' ? 'Réessayer' : 'Retry'}
            onPress={handleRetry}
            variant="secondary"
            icon={<Ionicons name="refresh" size={18} color={colors.textPrimary} />}
          />
          <Button
            title={language === 'fr' ? 'Retour' : 'Back'}
            onPress={() => navigation.goBack()}
          />
        </View>
      </Animated.View>
    </View>
  );

  // Render study content
  const renderStudyContent = () => {
    if (mode === 'flashcards') {
      return (
        <FlashcardsComponent
          flashcards={flashcards}
          onComplete={handleFlashcardsComplete}
        />
      );
    }

    if (mode === 'quiz') {
      return (
        <QuizComponent
          questions={quiz}
          onComplete={handleQuizComplete}
          onRetry={handleRetry}
        />
      );
    }

    return null;
  };

  // Main render
  const renderContent = () => {
    switch (state) {
      case 'selecting':
        return renderModeSelection();
      case 'loading':
        return renderLoading();
      case 'studying':
      case 'completed':
        return renderStudyContent();
      case 'error':
        return renderError();
      default:
        return null;
    }
  };

  // Lock screen if flashcards not enabled for this plan
  if (!flashcardsEnabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header
          title={language === 'fr' ? 'Mode Étude' : 'Study Mode'}
          showBack
        />
        <View style={styles.lockContainer}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.lockContent}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={[styles.lockTitle, { color: colors.textPrimary }]}>
              {language === 'fr'
                ? 'Fonctionnalité réservée'
                : 'Premium feature'}
            </Text>
            <Text style={[styles.lockDescription, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Les flashcards et quiz sont disponibles dès le plan Étudiant (2,99€/mois).'
                : 'Flashcards and quizzes are available from the Student plan (€2.99/mo).'}
            </Text>
            <Button
              title={language === 'fr' ? 'Découvrir les plans' : 'View plans'}
              onPress={() => Linking.openURL('https://www.deepsightsynthesis.com/upgrade')}
              style={styles.lockButton}
            />
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title={language === 'fr' ? 'Mode Étude' : 'Study Mode'}
        showBack
      />
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  selectionContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  selectionTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.display,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  selectionSubtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  modeIcon: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  modeDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.sm,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modeInfoText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  creditsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  creditsText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  spinner: {
    marginBottom: Spacing.md,
  },
  loadingTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  loadingSubtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  lockContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  lockIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  lockTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  lockDescription: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  lockButton: {
    minWidth: 200,
  },
});

export default StudyScreen;
