import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';

interface ReliabilityFactor {
  name: string;
  score: number; // 0-100
  description: string;
}

interface ReliabilityScoreProps {
  overallScore: number; // 0-100
  confidence?: number; // 0-100
  factors?: ReliabilityFactor[];
  recommendations?: string[];
  compact?: boolean;
  onAnalyze?: () => void;
  isLoading?: boolean;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return Colors.accentSuccess;
  if (score >= 60) return '#84CC16'; // lime
  if (score >= 40) return Colors.accentWarning;
  return Colors.accentError;
};

const getScoreLabel = (score: number, isEn: boolean): string => {
  if (score >= 80) return isEn ? 'High' : 'Élevée';
  if (score >= 60) return isEn ? 'Good' : 'Bonne';
  if (score >= 40) return isEn ? 'Moderate' : 'Modérée';
  return isEn ? 'Low' : 'Faible';
};

export const ReliabilityScore: React.FC<ReliabilityScoreProps> = ({
  overallScore,
  confidence,
  factors = [],
  recommendations = [],
  compact = false,
  onAnalyze,
  isLoading = false,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [showDetails, setShowDetails] = useState(false);

  const scoreColor = getScoreColor(overallScore);
  const scoreLabel = getScoreLabel(overallScore, isEn);

  if (compact) {
    return (
      <TouchableOpacity
        onPress={() => setShowDetails(true)}
        style={[styles.compactContainer, { backgroundColor: scoreColor + '20' }]}
      >
        <Ionicons name="shield-checkmark" size={12} color={scoreColor} />
        <Text style={[styles.compactScore, { color: scoreColor }]}>{overallScore}%</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.bgSecondary },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="shield-checkmark" size={18} color={scoreColor} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isEn ? 'Reliability Score' : 'Score de fiabilité'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowDetails(true)}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Score Display */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreCircle}>
            <LinearGradient
              colors={[scoreColor + '40', scoreColor + '10']}
              style={styles.scoreGradient}
            >
              <Text style={[styles.scoreValue, { color: scoreColor }]}>{overallScore}</Text>
              <Text style={[styles.scoreMax, { color: colors.textMuted }]}>
                /100
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.scoreInfo}>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '20' }]}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{scoreLabel}</Text>
            </View>
            {confidence !== undefined && (
              <Text style={[styles.confidenceText, { color: colors.textMuted }]}>
                {isEn ? `Confidence: ${confidence}%` : `Confiance: ${confidence}%`}
              </Text>
            )}
          </View>
        </View>

        {/* Quick Factors Preview */}
        {factors.length > 0 && (
          <View style={styles.factorsPreview}>
            {factors.slice(0, 3).map((factor, index) => (
              <View key={index} style={styles.factorRow}>
                <Text
                  style={[styles.factorName, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {factor.name}
                </Text>
                <View style={styles.factorBarContainer}>
                  <View
                    style={[
                      styles.factorBar,
                      {
                        width: `${factor.score}%`,
                        backgroundColor: getScoreColor(factor.score),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.factorScore, { color: getScoreColor(factor.score) }]}>
                  {factor.score}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Analyze Button */}
        {onAnalyze && (
          <TouchableOpacity
            onPress={onAnalyze}
            disabled={isLoading}
            style={[styles.analyzeButton, { borderColor: scoreColor }]}
          >
            <Ionicons
              name={isLoading ? 'hourglass' : 'analytics'}
              size={16}
              color={scoreColor}
            />
            <Text style={[styles.analyzeButtonText, { color: scoreColor }]}>
              {isLoading
                ? isEn
                  ? 'Analyzing...'
                  : 'Analyse en cours...'
                : isEn
                ? 'Detailed Analysis'
                : 'Analyse détaillée'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Details Modal */}
      <Modal visible={showDetails} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.bgPrimary },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {isEn ? 'Reliability Details' : 'Détails de fiabilité'}
              </Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Overall Score */}
              <View style={styles.modalSection}>
                <View style={styles.modalScoreDisplay}>
                  <Text style={[styles.modalScoreValue, { color: scoreColor }]}>{overallScore}%</Text>
                  <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '20' }]}>
                    <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{scoreLabel}</Text>
                  </View>
                </View>
              </View>

              {/* All Factors */}
              {factors.length > 0 && (
                <View style={styles.modalSection}>
                  <Text
                    style={[styles.sectionTitle, { color: colors.textPrimary }]}
                  >
                    {isEn ? 'Analysis Factors' : "Facteurs d'analyse"}
                  </Text>
                  {factors.map((factor, index) => (
                    <View key={index} style={styles.factorCard}>
                      <View style={styles.factorHeader}>
                        <Text
                          style={[
                            styles.factorCardName,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {factor.name}
                        </Text>
                        <Text style={[styles.factorCardScore, { color: getScoreColor(factor.score) }]}>
                          {factor.score}%
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.factorFullBar,
                          { backgroundColor: colors.bgSecondary },
                        ]}
                      >
                        <View
                          style={[
                            styles.factorFullBarFill,
                            {
                              width: `${factor.score}%`,
                              backgroundColor: getScoreColor(factor.score),
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.factorDescription,
                          { color: colors.textMuted },
                        ]}
                      >
                        {factor.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <View style={styles.modalSection}>
                  <Text
                    style={[styles.sectionTitle, { color: colors.textPrimary }]}
                  >
                    {isEn ? 'Recommendations' : 'Recommandations'}
                  </Text>
                  {recommendations.map((rec, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.accentInfo} />
                      <Text
                        style={[
                          styles.recommendationText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {rec}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Disclaimer */}
              <View
                style={[
                  styles.disclaimer,
                  { backgroundColor: colors.bgSecondary },
                ]}
              >
                <Ionicons name="information-circle" size={14} color={colors.accentInfo} />
                <Text
                  style={[styles.disclaimerText, { color: colors.textMuted }]}
                >
                  {isEn
                    ? 'This analysis is AI-generated and should be used as a guide, not as definitive fact-checking.'
                    : "Cette analyse est générée par IA et doit être utilisée comme guide, pas comme vérification définitive."}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  compactScore: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.base,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
  },
  scoreGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize['2xl'],
  },
  scoreMax: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
  scoreInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  scoreBadgeText: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.xs,
  },
  confidenceText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
  factorsPreview: {
    gap: Spacing.sm,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  factorName: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
    width: 80,
  },
  factorBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.bgPrimary + '40',
    borderRadius: 2,
  },
  factorBar: {
    height: '100%',
    borderRadius: 2,
  },
  factorScore: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.xs,
    width: 40,
    textAlign: 'right',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  analyzeButtonText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.lg,
  },
  modalScroll: {
    flex: 1,
  },
  modalSection: {
    marginBottom: Spacing.xl,
  },
  modalScoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  modalScoreValue: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize['4xl'],
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing.md,
  },
  factorCard: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  factorCardName: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.sm,
  },
  factorCardScore: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.sm,
  },
  factorFullBar: {
    height: 6,
    borderRadius: 3,
  },
  factorFullBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  factorDescription: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recommendationText: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
    lineHeight: 16,
  },
});

export default ReliabilityScore;
