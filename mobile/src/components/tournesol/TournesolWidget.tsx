import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface TournesolScore {
  score: number;
  reliability: number;
  importance: number;
  engaging: number;
  pedagogy: number;
  layman_friendly: number;
  diversity_inclusion: number;
  backfire_risk: number;
  better_habits: number;
  entertaining_relaxing: number;
}

interface TournesolWidgetProps {
  videoId: string;
  compact?: boolean;
}

// Tournesol API integration
const fetchTournesolScore = async (videoId: string): Promise<TournesolScore | null> => {
  try {
    const response = await fetch(
      `https://tournesol.app/api/v2/polls/videos/entities/yt:${videoId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Video not found in Tournesol database (404) or other error
      return null;
    }

    const data = await response.json();

    // Extract scores from Tournesol API response
    // The API returns criteria_scores array with different criteria
    const criteriaScores = data.criteria_scores || [];

    const getScore = (name: string): number => {
      const criterion = criteriaScores.find((c: any) => c.criteria === name);
      // Tournesol scores are typically -100 to 100, normalize to 0-100
      return criterion ? Math.round((criterion.score + 100) / 2) : 50;
    };

    return {
      score: data.tournesol_score ? Math.round((data.tournesol_score + 100) / 2) : 50,
      reliability: getScore('reliability'),
      importance: getScore('importance'),
      engaging: getScore('engaging'),
      pedagogy: getScore('pedagogy'),
      layman_friendly: getScore('layman_friendly'),
      diversity_inclusion: getScore('diversity_inclusion'),
      backfire_risk: getScore('backfire_risk'),
      better_habits: getScore('better_habits'),
      entertaining_relaxing: getScore('entertaining_relaxing'),
    };
  } catch (error) {
    console.log('Tournesol API error:', error);
    return null;
  }
};

export const TournesolWidget: React.FC<TournesolWidgetProps> = ({
  videoId,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState<TournesolScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadScore = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchTournesolScore(videoId);
        setScore(data);
      } catch (err) {
        setError('Score non disponible');
      } finally {
        setIsLoading(false);
      }
    };

    loadScore();
  }, [videoId]);

  const handleOpenTournesol = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`https://tournesol.app/entities/yt:${videoId}`);
  };

  const getScoreColor = (value: number) => {
    if (value >= 70) return colors.accentSuccess;
    if (value >= 40) return colors.accentWarning;
    return colors.accentError;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  if (!score) {
    // Show a subtle "not rated" indicator or nothing in compact mode
    if (compact) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[styles.notRatedContainer, { backgroundColor: colors.bgSecondary }]}
        onPress={handleOpenTournesol}
      >
        <View style={styles.tournesolHeader}>
          <Text style={[styles.tournesolLogo, { color: colors.textTertiary }]}>🌻</Text>
          <Text style={[styles.notRatedText, { color: colors.textTertiary }]}>
            {t.tournesol.notRatedYet}
          </Text>
        </View>
        <Text style={[styles.helpText, { color: colors.textMuted }]}>
          {t.tournesol.contributeToEthical}
        </Text>
        <View style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.accentPrimary }]}>
            {t.tournesol.rateThisVideo}
          </Text>
          <Ionicons name="open-outline" size={14} color={colors.accentPrimary} />
        </View>
      </TouchableOpacity>
    );
  }

  // Display score
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactScore, { backgroundColor: `${getScoreColor(score.score)}20` }]}
        onPress={handleOpenTournesol}
      >
        <Text style={styles.sunflower}>🌻</Text>
        <Text style={[styles.compactScoreText, { color: getScoreColor(score.score) }]}>
          {Math.round(score.score)}
        </Text>
      </TouchableOpacity>
    );
  }

  const criteria = [
    { label: t.tournesol.criteria.reliability, value: score.reliability, icon: 'shield-checkmark-outline' },
    { label: t.tournesol.criteria.importance, value: score.importance, icon: 'star-outline' },
    { label: t.tournesol.criteria.pedagogy, value: score.pedagogy, icon: 'school-outline' },
    { label: t.tournesol.criteria.accessibility, value: score.layman_friendly, icon: 'people-outline' },
    { label: t.tournesol.criteria.diversity, value: score.diversity_inclusion, icon: 'globe-outline' },
  ];

  return (
    <TouchableOpacity
      style={[styles.fullContainer, { backgroundColor: colors.bgSecondary }]}
      onPress={handleOpenTournesol}
    >
      {/* Header */}
      <View style={styles.tournesolHeader}>
        <Text style={styles.tournesolLogo}>🌻</Text>
        <Text style={[styles.tournesolTitle, { color: colors.textPrimary }]}>
          {t.tournesol.score}
        </Text>
        <View style={[styles.mainScore, { backgroundColor: `${getScoreColor(score.score)}20` }]}>
          <Text style={[styles.mainScoreText, { color: getScoreColor(score.score) }]}>
            {Math.round(score.score)}
          </Text>
        </View>
      </View>

      {/* Criteria breakdown */}
      <View style={styles.criteriaGrid}>
        {criteria.map((criterion, index) => (
          <View key={index} style={styles.criterionItem}>
            <View style={styles.criterionHeader}>
              <Ionicons
                name={criterion.icon as any}
                size={14}
                color={colors.textTertiary}
              />
              <Text style={[styles.criterionLabel, { color: colors.textSecondary }]}>
                {criterion.label}
              </Text>
            </View>
            <View style={[styles.criterionBar, { backgroundColor: colors.bgTertiary }]}>
              <View
                style={[
                  styles.criterionFill,
                  {
                    width: `${Math.max(0, Math.min(100, criterion.value))}%`,
                    backgroundColor: getScoreColor(criterion.value),
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.tournesolFooter}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {t.tournesol.ethicalRecommendation}
        </Text>
        <Ionicons name="open-outline" size={12} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContainer: {
    padding: Spacing.sm,
  },
  notRatedContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  tournesolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tournesolLogo: {
    fontSize: 20,
  },
  tournesolTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    flex: 1,
  },
  notRatedText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  helpText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  linkText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  compactScore: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  sunflower: {
    fontSize: 14,
  },
  compactScoreText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  fullContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  mainScore: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  mainScoreText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  criteriaGrid: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  criterionItem: {
    gap: Spacing.xs,
  },
  criterionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  criterionLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  criterionBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  criterionFill: {
    height: '100%',
    borderRadius: 2,
  },
  tournesolFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
});

export default TournesolWidget;
