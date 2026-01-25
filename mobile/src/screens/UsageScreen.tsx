import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header, Card, Badge } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

export const UsageScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const creditsUsed = (user?.credits_monthly || 20) - (user?.credits || 0);
  const creditsTotal = user?.credits_monthly || 20;
  const usagePercent = Math.min((creditsUsed / creditsTotal) * 100, 100);

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

        {/* Usage History */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t.history.title}
        </Text>
        <Card variant="elevated" style={styles.historyCard}>
          <View style={[styles.historyItem, { borderBottomColor: colors.border }]}>
            <View style={styles.historyLeft}>
              <View style={[styles.historyDot, { backgroundColor: colors.accentPrimary }]} />
              <View>
                <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>
                  {t.analysis.title}
                </Text>
                <Text style={[styles.historyDate, { color: colors.textTertiary }]}>
                  {t.common.today}
                </Text>
              </View>
            </View>
            <Text style={[styles.historyCredits, { color: colors.textSecondary }]}>
              -1
            </Text>
          </View>
          <View style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <View style={[styles.historyDot, { backgroundColor: colors.accentSuccess }]} />
              <View>
                <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>
                  {t.upgrade.renewalDate}
                </Text>
                <Text style={[styles.historyDate, { color: colors.textTertiary }]}>
                  {t.common.thisMonth}
                </Text>
              </View>
            </View>
            <Text style={[styles.historyCredits, { color: colors.accentSuccess }]}>
              +{creditsTotal}
            </Text>
          </View>
        </Card>
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
});

export default UsageScreen;
