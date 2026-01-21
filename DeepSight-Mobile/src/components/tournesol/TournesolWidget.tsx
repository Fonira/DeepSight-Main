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

// Simulated Tournesol API (replace with real API when available)
const fetchTournesolScore = async (videoId: string): Promise<TournesolScore | null> => {
  // In production, this would call the real Tournesol API
  // For now, we return null to indicate no score available
  // const response = await fetch(`https://tournesol.app/api/v2/poll/videos/entities/yt:${videoId}`);

  // Return null for videos not in Tournesol database
  return null;
};

export const TournesolWidget: React.FC<TournesolWidgetProps> = ({
  videoId,
  compact = false,
}) => {
  const { colors } = useTheme();
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
            Pas encore évalué sur Tournesol
          </Text>
        </View>
        <Text style={[styles.helpText, { color: colors.textMuted }]}>
          Contribuez à la plateforme de recommandation éthique
        </Text>
        <View style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.accentPrimary }]}>
            Évaluer cette vidéo
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
    { label: 'Fiabilité', value: score.reliability, icon: 'shield-checkmark-outline' },
    { label: 'Importance', value: score.importance, icon: 'star-outline' },
    { label: 'Pédagogie', value: score.pedagogy, icon: 'school-outline' },
    { label: 'Accessibilité', value: score.layman_friendly, icon: 'people-outline' },
    { label: 'Diversité', value: score.diversity_inclusion, icon: 'globe-outline' },
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
          Score Tournesol
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
          Tournesol - Recommandation éthique collaborative
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
