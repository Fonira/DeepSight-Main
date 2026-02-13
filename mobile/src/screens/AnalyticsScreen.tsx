import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header, Card, DeepSightSpinner } from '../components';
import { usageApi } from '../services/api';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

type Period = 'week' | 'month' | 'all';

interface UsageStats {
  credits_used: number;
  credits_remaining: number;
  credits_total: number;
  analyses_count: number;
  chat_messages_count: number;
  exports_count: number;
  reset_date: string;
}

interface DetailedUsage {
  by_model: Record<string, number>;
  by_category: Record<string, number>;
  by_date: Array<{ date: string; credits: number }>;
}

export const AnalyticsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('analysis');
  const isEn = language === 'en';

  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [detailed, setDetailed] = useState<DetailedUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const apiPeriod = period === 'all' ? undefined : period === 'week' ? 'week' : 'month';
      const [statsData, detailedData] = await Promise.all([
        usageApi.getStats().catch(() => null),
        usageApi.getDetailedUsage(apiPeriod).catch(() => null),
      ]);
      if (statsData) setStats(statsData);
      if (detailedData) setDetailed(detailedData);
    } catch {
      setError(t.errors?.generic ?? 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const creditsUsed = stats?.credits_used ?? 0;
  const creditsTotal = stats?.credits_total ?? (user?.credits_monthly || 20);
  const creditsRemaining = stats?.credits_remaining ?? (user?.credits || 0);
  const usagePercent = creditsTotal > 0 ? Math.min((creditsUsed / creditsTotal) * 100, 100) : 0;

  const periodLabels: Record<Period, string> = {
    week: isEn ? 'This week' : 'Cette semaine',
    month: isEn ? 'This month' : 'Ce mois',
    all: isEn ? 'All time' : 'Tout',
  };

  // Filter chart data based on period
  const chartData = (() => {
    if (!detailed?.by_date) return [];
    const now = new Date();
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return detailed.by_date.filter(d => new Date(d.date) >= weekAgo);
    }
    if (period === 'month') {
      return detailed.by_date.slice(-30);
    }
    return detailed.by_date;
  })();

  // Show max 10 bars for readability
  const displayBars = chartData.length > 10 ? chartData.slice(-10) : chartData;
  const maxBarValue = displayBars.length > 0
    ? Math.max(...displayBars.map(d => d.credits), 1)
    : 1;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={isEn ? 'Analytics' : 'Analytiques'} showBack />
        <View style={styles.centerContainer}>
          <DeepSightSpinner size="lg" showGlow />
        </View>
      </View>
    );
  }

  if (error && !stats && !detailed) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={isEn ? 'Analytics' : 'Analytiques'} showBack />
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.accentPrimary }]}
            onPress={() => {
              setIsLoading(true);
              loadData();
            }}
          >
            <Text style={[styles.retryButtonText, { color: colors.accentPrimary }]}>
              {t.common.retry}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={isEn ? 'Analytics' : 'Analytiques'} showBack />

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
        {/* Period selector */}
        <View style={[styles.periodSelector, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          {(['week', 'month', 'all'] as Period[]).map((p) => {
            const isActive = period === p;
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodButton,
                  isActive && { backgroundColor: colors.accentPrimary },
                ]}
                onPress={() => setPeriod(p)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    { color: isActive ? '#fff' : colors.textSecondary },
                  ]}
                >
                  {periodLabels[p]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          <Card variant="elevated" style={styles.summaryCard}>
            <Ionicons name="videocam" size={24} color={colors.accentPrimary} />
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {stats?.analyses_count ?? user?.total_videos ?? 0}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
              {t.usage?.analysesUsed ?? (isEn ? 'Analyses' : 'Analyses')}
            </Text>
          </Card>
          <Card variant="elevated" style={styles.summaryCard}>
            <Ionicons name="flash" size={24} color={colors.accentSecondary} />
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {creditsRemaining}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
              {t.usage?.creditsRemaining ?? (isEn ? 'Credits left' : 'Credits restants')}
            </Text>
          </Card>
        </View>
        <View style={styles.summaryGrid}>
          <Card variant="elevated" style={styles.summaryCard}>
            <Ionicons name="chatbubbles" size={24} color={colors.accentSuccess} />
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {stats?.chat_messages_count ?? 0}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
              {t.usage?.chatQuestions ?? (isEn ? 'Chat messages' : 'Messages chat')}
            </Text>
          </Card>
          <Card variant="elevated" style={styles.summaryCard}>
            <Ionicons name="download" size={24} color={colors.accentWarning} />
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {stats?.exports_count ?? 0}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
              {t.usage?.exportsUsed ?? (isEn ? 'Exports' : 'Exports')}
            </Text>
          </Card>
        </View>

        {/* Credits progress */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t.usage?.monthlyUsage ?? (isEn ? 'Monthly usage' : 'Usage mensuel')}
        </Text>
        <Card variant="elevated" style={styles.creditsCard}>
          <View style={styles.creditsHeader}>
            <Text style={[styles.creditsTitle, { color: colors.textPrimary }]}>
              {isEn ? 'Credits' : 'Credits'}
            </Text>
            <Text style={[styles.creditsCount, { color: colors.textSecondary }]}>
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
          <Text style={[styles.creditsHint, { color: colors.textTertiary }]}>
            {creditsRemaining} {t.usage?.creditsRemaining ?? (isEn ? 'remaining' : 'restants')}
          </Text>
        </Card>

        {/* Usage chart */}
        {displayBars.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t.usage?.dailyUsage ?? (isEn ? 'Daily Usage' : 'Usage quotidien')}
            </Text>
            <Card variant="elevated" style={styles.chartCard}>
              <View style={styles.chartContainer}>
                {displayBars.map((item, index) => {
                  const barHeight = Math.max((item.credits / maxBarValue) * 80, 4);
                  const dayLabel = new Date(item.date).toLocaleDateString(
                    isEn ? 'en' : 'fr',
                    { weekday: 'short' }
                  );
                  const isLast = index === displayBars.length - 1;
                  return (
                    <View key={item.date} style={styles.barWrapper}>
                      <Text style={[styles.barValue, { color: colors.textSecondary }]}>
                        {item.credits}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: isLast
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

        {/* Category breakdown */}
        {detailed?.by_category && Object.keys(detailed.by_category).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t.usage?.byCategory ?? (isEn ? 'By Category' : 'Par catégorie')}
            </Text>
            <Card variant="elevated" style={styles.breakdownCard}>
              {Object.entries(detailed.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count], index) => {
                  const total = Object.values(detailed.by_category).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <View
                      key={category}
                      style={[
                        styles.breakdownItem,
                        index > 0 && {
                          borderTopColor: colors.border,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <View style={styles.breakdownLeft}>
                        <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>
                          {category}
                        </Text>
                        <View style={[styles.breakdownBarBg, { backgroundColor: colors.bgTertiary }]}>
                          <View
                            style={[
                              styles.breakdownBarFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: colors.accentSecondary,
                              },
                            ]}
                          />
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

        {/* Model breakdown */}
        {detailed?.by_model && Object.keys(detailed.by_model).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t.usage?.byModel ?? (isEn ? 'By AI Model' : 'Par modèle IA')}
            </Text>
            <Card variant="elevated" style={styles.breakdownCard}>
              {Object.entries(detailed.by_model)
                .sort(([, a], [, b]) => b - a)
                .map(([model, count], index) => {
                  const total = Object.values(detailed.by_model).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <View
                      key={model}
                      style={[
                        styles.breakdownItem,
                        index > 0 && {
                          borderTopColor: colors.border,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <View style={styles.breakdownLeft}>
                        <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>
                          {model}
                        </Text>
                        <View style={[styles.breakdownBarBg, { backgroundColor: colors.bgTertiary }]}>
                          <View
                            style={[
                              styles.breakdownBarFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: colors.accentPrimary,
                              },
                            ]}
                          />
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  retryButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  // Period selector
  periodSelector: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  // Summary cards
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  summaryValue: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  // Credits
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  creditsCard: {
    marginBottom: Spacing.lg,
  },
  creditsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  creditsTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  creditsCount: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
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
  creditsHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
  },
  // Chart
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
  barWrapper: {
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
  // Breakdown
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
});

export default AnalyticsScreen;
