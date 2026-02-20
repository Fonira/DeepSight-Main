/**
 * Study Hub Screen - Tab dédié aux révisions
 * Flashcards + Quiz, statistiques, progression par vidéo
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStudyStore } from '@/stores/studyStore';
import { historyApi } from '@/services/api';
import { StatsCard } from '@/components/study/StatsCard';
import { VideoStudyCard } from '@/components/study/VideoStudyCard';
import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { QuizGame } from '@/components/study/QuizGame';
import { sp } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { DoodleBackground } from '@/components/ui/DoodleBackground';
import type { AnalysisSummary } from '@/types';

export default function StudyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { progress, stats } = useStudyStore();

  const [summaries, setSummaries] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFlashcards, setShowFlashcards] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState<string | null>(null);

  const isFree = user?.plan === 'free';

  // Load summaries from history
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await historyApi.getHistory(1, 50);
        if (mounted) setSummaries(response.items);
      } catch {
        // Silently fail — empty state will show
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Find last incomplete session
  const lastIncomplete = summaries.find((s) => {
    const p = progress[s.id];
    return p && p.flashcardsTotal > 0 && p.flashcardsCompleted < p.flashcardsTotal;
  });

  const handleLockedPress = useCallback(() => {
    router.push('/(tabs)/profile');
  }, [router]);

  // Fullscreen modes
  if (showFlashcards) {
    return (
      <FlashcardDeck
        summaryId={showFlashcards}
        onClose={() => setShowFlashcards(null)}
      />
    );
  }

  if (showQuiz) {
    return (
      <QuizGame
        summaryId={showQuiz}
        onClose={() => setShowQuiz(null)}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgPrimary,
          paddingBottom: 60 + Math.max(insets.bottom, sp.sm),
        },
      ]}
    >
      <DoodleBackground variant="academic" density="low" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + sp.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Réviser
        </Text>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <StatsCard stats={stats} />
        </Animated.View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accentPrimary} />
          </View>
        )}

        {/* Resume section */}
        {lastIncomplete && (
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Reprendre
            </Text>
            <Pressable
              style={[styles.resumeCard, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
              onPress={() => setShowFlashcards(lastIncomplete.id)}
              accessibilityLabel="Reprendre les flashcards"
            >
              <Ionicons name="play-circle" size={24} color={colors.accentPrimary} />
              <View style={styles.resumeInfo}>
                <Text style={[styles.resumeTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {lastIncomplete.title}
                </Text>
                <Text style={[styles.resumeSubtitle, { color: colors.textTertiary }]}>
                  {progress[lastIncomplete.id]?.flashcardsCompleted}/{progress[lastIncomplete.id]?.flashcardsTotal} flashcards
                </Text>
              </View>
              <Text style={[styles.resumeBtn, { color: colors.accentPrimary }]}>
                Continuer
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Empty state */}
        {!loading && summaries.length === 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.emptyState}>
            <Ionicons name="school-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              Aucune vidéo analysée
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              Analyse une vidéo pour commencer à réviser
            </Text>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: colors.accentPrimary }]}
              onPress={() => router.push('/(tabs)/')}
            >
              <Text style={styles.emptyBtnText}>Aller à l'accueil</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Videos grid */}
        {summaries.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Toutes les vidéos
            </Text>
            <View style={styles.grid}>
              {summaries.map((summary) => (
                <View key={summary.id} style={styles.gridItem}>
                  <VideoStudyCard
                    summary={summary}
                    progress={progress[summary.id]}
                    onFlashcards={() => setShowFlashcards(summary.id)}
                    onQuiz={() => setShowQuiz(summary.id)}
                    locked={isFree}
                    onLockedPress={handleLockedPress}
                  />
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp['3xl'],
  },
  title: {
    ...textStyles.displaySm,
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginTop: sp['2xl'],
    marginBottom: sp.md,
  },
  loadingBox: {
    paddingVertical: sp['3xl'],
    alignItems: 'center',
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: sp.md,
  },
  resumeInfo: {
    flex: 1,
  },
  resumeTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  resumeSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  resumeBtn: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.md,
  },
  gridItem: {
    width: '48%',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: sp['4xl'],
    gap: sp.md,
  },
  emptyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },
  emptySubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingVertical: sp.md,
    paddingHorizontal: sp['2xl'],
    borderRadius: 12,
    marginTop: sp.md,
  },
  emptyBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: '#ffffff',
  },
});
