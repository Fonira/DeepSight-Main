import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header, Card, Badge } from '../components';
import { usageApi } from '../services/api';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface DailyUsage {
  date: string;
  credits: number;
}

interface DetailedUsage {
  by_model: Record<string, number>;
  by_category: Record<string, number>;
  by_date: DailyUsage[];
}

export const UsageScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isEn = language === 'en';

  const [detailedUsage, setDetailedUsage] = useState<DetailedUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const creditsUsed = (user?.credits_monthly || 20) - (user?.credits || 0);
  const creditsTotal = user?.credits_monthly || 20;
  const usagePercent = Math.min((creditsUsed / creditsTotal) * 100, 100);

  const loadDetailedUsage = useCallback(async () => {
    try {
      const data = await usageApi.getDetailedUsage('month');
      setDetailedUsage(data);
    } catch (error) {
      console.error('Failed to load detailed usage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDetailedUsage();
  }, [loadDetailedUsage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDetailedUsage();
    setRefreshing(false);
  }, [loadDetailedUsage]);

  const getPlanLabel = () => {
    const labels: Record<string, string> = {
      free: 'Gratuit',
      student: 'Étudiant',
      starter: 'Starter',
      pro: 'Pro',
      expert: 'Expert',
    };
    return labels[user?.plan || 'free'] || 'Gratuit';
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={t.settings.usage} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPrimary}
          />
        }
      >
        {/* Current Period */}
        <Card variant="elevated" style={styles.usageCard}>
          <View style={styles.usageHeader}>
            <Text style={[styles.usageTitle, { color: colors.textPrimary }]}>
              {t.common.thisMonth}
            </Text>
            <Badge label={getPlanLabel()} variant="primary" />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                {t.upgrade.creditsUsed}
              </Text>
              <Text style={[styles.progressValue, { color: colors.textPrimary }]}>
                {creditsUsed} / {creditsTotal}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${usagePercent}%`,
                    backgroundColor: usagePercent > 80 ? colors.accentError : colors.accentPrimary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressHint, { color: colors.textTertiary }]}>
              {user?.credits || 0} {t.dashboard.creditsRemaining}
            </Text>
          </View>

          {/* Reset Date */}
          <View style={[styles.resetInfo, { borderTopColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
            <Text style={[styles.resetText, { color: colors.textSecondary }]}>
              {t.upgrade.renewalDate}
            </Text>
          </View>
        </Card>

        {/* Statistics */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t.admin.statistics}
        </Text>
        <View style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="videocam" size={28} color={colors.accentPrimary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {user?.total_videos || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t.admin.videosAnalyzed}
            </Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="document-text" size={28} color={colors.accentSecondary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {user?.total_words ? `${Math.round(user.total_words / 1000)}k` : '0'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t.admin.wordsGenerated}
            </Text>
          </Card>
        </View>
        <View style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="folder" size={28} color={colors.accentWarning} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {user?.total_playlists || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t.playlists.title}
            </Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="time" size={28} color={colors.accentSuccess} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              -
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              {t.admin.wordsGenerated}
            </Text>
          </Card>
        </View>

        {/* Daily Usage Chart */}
        {detailedUsage && detailedUsage.by_date && detailedUsage.by_date.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {isEn ? 'Daily Usage' : 'Utilisation quotidienne'}
            </Text>
            <Card variant="elevated" style={styles.chartCard}>
              <View style={styles.chartContainer}>
                {detailedUsage.by_date.slice(-7).map((day, index) => {
                  const maxCredits = Math.max(...detailedUsage.by_date.map(d => d.credits), 1);
                  const barHeight = Math.max((day.credits / maxCredits) * 80, 4);
                  const dayLabel = new Date(day.date).toLocaleDateString(isEn ? 'en' : 'fr', { weekday: 'short' });
                  return (
                    <View key={day.date} style={styles.chartBar}>
                      <Text style={[styles.barValue, { color: colors.textSecondary }]}>
                        {day.credits}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: index === detailedUsage.by_date.slice(-7).length - 1
                              ? colors.accentPrimary
                              : colors.accentPrimary + '60',
                          },
                        ]}
                      />
                      <Text style={[styles.barLabel, { color: colors.textTertiary }]}>
                        {dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}

        {/* Usage by Category */}
        {detailedUsage && detailedUsage.by_category && Object.keys(detailedUsage.by_category).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {isEn ? 'By Category' : 'Par catégorie'}
            </Text>
            <Card variant="elevated" style={styles.breakdownCard}>
              {Object.entries(detailedUsage.by_category).map(([category, count], index) => {
                const totalByCategory = Object.values(detailedUsage.by_category).reduce((a, b) => a + b, 0);
                const percent = totalByCategory > 0 ? (count / totalByCategory) * 100 : 0;
                return (
                  <View key={category} style={[styles.breakdownItem, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={styles.breakdownLeft}>
                      <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>
                        {category}
                      </Text>
                      <View style={[styles.breakdownBarBg, { backgroundColor: colors.bgTertiary }]}>
                        <View style={[styles.breakdownBarFill, { width: `${percent}%`, backgroundColor: colors.accentSecondary }]} />
                      </View>
                    </View>
                    <Text style={[styles.breakdownValue, { color: colors.textSecondary }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Usage by Model */}
        {detailedUsage && detailedUsage.by_model && Object.keys(detailedUsage.by_model).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {isEn ? 'By AI Model' : 'Par modèle IA'}
            </Text>
            <Card variant="elevated" style={styles.breakdownCard}>
              {Object.entries(detailedUsage.by_model).map(([model, count], index) => {
                const totalByModel = Object.values(detailedUsage.by_model).reduce((a, b) => a + b, 0);
                const percent = totalByModel > 0 ? (count / totalByModel) * 100 : 0;
                return (
                  <View key={model} style={[styles.breakdownItem, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={styles.breakdownLeft}>
                      <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>
                        {model}
                      </Text>
                      <View style={[styles.breakdownBarBg, { backgroundColor: colors.bgTertiary }]}>
                        <View style={[styles.breakdownBarFill, { width: `${percent}%`, backgroundColor: colors.accentPrimary }]} />
                      </View>
                    </View>
                    <Text style={[styles.breakdownValue, { color: colors.textSecondary }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accentPrimary} />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  usageCard: {
    marginBottom: Spacing.xl,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  usageTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  progressSection: {
    marginBottom: Spacing.lg,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  progressValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
  },
  resetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resetText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  historyCard: {
    padding: 0,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  historyDate: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  historyCredits: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  // Chart styles
  chartCard: {
    marginBottom: Spacing.lg,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingHorizontal: Spacing.sm,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  bar: {
    width: '80%',
    borderRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.body,
    marginTop: 4,
  },
  // Breakdown styles
  breakdownCard: {
    marginBottom: Spacing.lg,
    padding: 0,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  breakdownLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  breakdownLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.xs,
    textTransform: 'capitalize',
  },
  breakdownBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    minWidth: 30,
    textAlign: 'right',
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
});

export default UsageScreen;
