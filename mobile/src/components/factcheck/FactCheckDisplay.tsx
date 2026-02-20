/**
 * FactCheckDisplay - Affichage complet des résultats de fact-checking
 * Avec claims, verdicts, et sources
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { videoApi } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

type VerdictType = 'verified' | 'disputed' | 'unverified' | 'mixed' | 'misleading';

interface Claim {
  text: string;
  verdict: VerdictType;
  confidence: number;
  sources?: Array<{ url: string; title: string }>;
  explanation?: string;
}

interface FactCheckDisplayProps {
  summaryId: string;
  initialData?: {
    claims: Claim[];
    overall_score: number;
  };
  compact?: boolean;
  onRequestCheck?: () => void;
}

const VERDICT_CONFIG: Record<VerdictType, {
  icon: keyof typeof Ionicons.glyphMap;
  labelFr: string;
  labelEn: string;
  color: string;
  bgColor: string;
}> = {
  verified: {
    icon: 'checkmark-circle',
    labelFr: 'Vérifié',
    labelEn: 'Verified',
    color: '#22C55E',
    bgColor: '#22C55E20',
  },
  disputed: {
    icon: 'warning',
    labelFr: 'Contesté',
    labelEn: 'Disputed',
    color: '#EF4444',
    bgColor: '#EF444420',
  },
  unverified: {
    icon: 'help-circle',
    labelFr: 'Non vérifié',
    labelEn: 'Unverified',
    color: '#9CA3AF',
    bgColor: '#9CA3AF20',
  },
  mixed: {
    icon: 'remove-circle',
    labelFr: 'Partiellement vrai',
    labelEn: 'Partially true',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
  },
  misleading: {
    icon: 'close-circle',
    labelFr: 'Trompeur',
    labelEn: 'Misleading',
    color: '#DC2626',
    bgColor: '#DC262620',
  },
};

export const FactCheckDisplay: React.FC<FactCheckDisplayProps> = ({
  summaryId,
  initialData,
  compact = false,
  onRequestCheck,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{ claims: Claim[]; overall_score: number } | null>(initialData || null);
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleRequestCheck = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await videoApi.factCheck(summaryId);
      const factCheck = result.fact_check_lite;
      if (!factCheck) {
        setData({ claims: [], overall_score: 0 });
        onRequestCheck?.();
        return;
      }

      const riskToVerdict = (risk: string): VerdictType => {
        switch (risk) {
          case 'high': return 'disputed';
          case 'medium': return 'mixed';
          case 'low': return 'verified';
          default: return 'unverified';
        }
      };

      const claims: Claim[] = [
        ...factCheck.high_risk_claims.map(c => ({
          text: c.claim,
          verdict: riskToVerdict(c.risk_level),
          confidence: c.confidence / 100,
          explanation: c.verification_hint,
          sources: c.suggested_search ? [{ url: '', title: c.suggested_search }] : undefined,
        })),
        ...factCheck.medium_risk_claims.map(c => ({
          text: c.claim,
          verdict: riskToVerdict(c.risk_level),
          confidence: c.confidence / 100,
          explanation: c.verification_hint,
        })),
      ];

      setData({
        claims,
        overall_score: factCheck.overall_confidence,
      });
      onRequestCheck?.();
    } catch (err: any) {
      setError(err.message || (language === 'fr' ? 'Erreur lors de la vérification' : 'Error during verification'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleClaimExpanded = (index: number) => {
    Haptics.selectionAsync();
    setExpandedClaims(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const openSource = (url: string) => {
    Linking.openURL(url);
  };

  // Render loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgElevated }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'Vérification des faits en cours...' : 'Fact-checking in progress...'}
          </Text>
        </View>
      </View>
    );
  }

  // Render empty state with request button
  if (!data) {
    return (
      <TouchableOpacity
        style={[styles.requestButton, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        onPress={handleRequestCheck}
      >
        <View style={[styles.requestIconContainer, { backgroundColor: `${colors.accentInfo}20` }]}>
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.accentInfo} />
        </View>
        <View style={styles.requestTextContainer}>
          <Text style={[styles.requestTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Vérification des faits' : 'Fact Check'}
          </Text>
          <Text style={[styles.requestDescription, { color: colors.textSecondary }]}>
            {language === 'fr'
              ? 'Analyser les affirmations de la vidéo'
              : 'Analyze claims from the video'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: `${colors.accentError}10` }]}>
        <Ionicons name="alert-circle" size={24} color={colors.accentError} />
        <Text style={[styles.errorText, { color: colors.accentError }]}>{error}</Text>
        <TouchableOpacity onPress={handleRequestCheck}>
          <Text style={[styles.retryText, { color: colors.accentPrimary }]}>
            {language === 'fr' ? 'Réessayer' : 'Retry'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Compact view
  if (compact) {
    const verifiedCount = data.claims.filter(c => c.verdict === 'verified').length;
    const disputedCount = data.claims.filter(c => c.verdict === 'disputed' || c.verdict === 'misleading').length;

    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.bgElevated }]}>
        <Ionicons name="shield-checkmark" size={16} color={colors.accentInfo} />
        <Text style={[styles.compactText, { color: colors.textSecondary }]}>
          {verifiedCount} {language === 'fr' ? 'vérifié(s)' : 'verified'} • {disputedCount} {language === 'fr' ? 'contesté(s)' : 'disputed'}
        </Text>
      </View>
    );
  }

  // Full view
  return (
    <View style={[styles.container, { backgroundColor: colors.bgElevated }]}>
      {/* Header with overall score */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="shield-checkmark" size={24} color={colors.accentInfo} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Vérification des faits' : 'Fact Check'}
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(data.overall_score) + '20' }]}>
          <Text style={[styles.scoreText, { color: getScoreColor(data.overall_score) }]}>
            {Math.round(data.overall_score)}%
          </Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.bgTertiary }]}>
        <View
          style={[
            styles.scoreBarFill,
            {
              backgroundColor: getScoreColor(data.overall_score),
              width: `${data.overall_score}%`,
            },
          ]}
        />
      </View>

      {/* Claims list */}
      <View style={styles.claimsList}>
        {data.claims.map((claim, index) => {
          const config = VERDICT_CONFIG[claim.verdict];
          const isExpanded = expandedClaims.has(index);

          return (
            <TouchableOpacity
              key={index}
              style={[styles.claimCard, { backgroundColor: config.bgColor }]}
              onPress={() => toggleClaimExpanded(index)}
              activeOpacity={0.8}
            >
              <View style={styles.claimHeader}>
                <Ionicons name={config.icon} size={20} color={config.color} />
                <Text style={[styles.claimText, { color: colors.textPrimary }]} numberOfLines={isExpanded ? undefined : 2}>
                  {claim.text}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textTertiary}
                />
              </View>

              {/* Verdict badge */}
              <View style={styles.verdictRow}>
                <View style={[styles.verdictBadge, { borderColor: config.color }]}>
                  <Text style={[styles.verdictText, { color: config.color }]}>
                    {language === 'fr' ? config.labelFr : config.labelEn}
                  </Text>
                </View>
                <Text style={[styles.confidenceText, { color: colors.textTertiary }]}>
                  {Math.round(claim.confidence * 100)}% {language === 'fr' ? 'confiance' : 'confidence'}
                </Text>
              </View>

              {/* Expanded content */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {claim.explanation && (
                    <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                      {claim.explanation}
                    </Text>
                  )}

                  {claim.sources && claim.sources.length > 0 && (
                    <View style={styles.sourcesContainer}>
                      <Text style={[styles.sourcesTitle, { color: colors.textTertiary }]}>
                        {language === 'fr' ? 'Sources:' : 'Sources:'}
                      </Text>
                      {claim.sources.map((source, si) => (
                        <TouchableOpacity
                          key={si}
                          style={styles.sourceLink}
                          onPress={() => openSource(source.url)}
                        >
                          <Ionicons name="link" size={12} color={colors.accentPrimary} />
                          <Text style={[styles.sourceLinkText, { color: colors.accentPrimary }]} numberOfLines={1}>
                            {source.title || source.url}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Refresh button */}
      <TouchableOpacity
        style={[styles.refreshButton, { borderColor: colors.border }]}
        onPress={handleRequestCheck}
      >
        <Ionicons name="refresh" size={16} color={colors.textSecondary} />
        <Text style={[styles.refreshText, { color: colors.textSecondary }]}>
          {language === 'fr' ? 'Actualiser' : 'Refresh'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Helper to get score color
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  requestIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestTextContainer: {
    flex: 1,
  },
  requestTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  requestDescription: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  retryText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  compactText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  scoreText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  scoreBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  claimsList: {
    gap: Spacing.sm,
  },
  claimCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  claimHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  claimText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.4,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingLeft: 28,
  },
  verdictBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  verdictText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  confidenceText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingLeft: 28,
  },
  explanationText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
    marginBottom: Spacing.sm,
  },
  sourcesContainer: {
    marginTop: Spacing.sm,
  },
  sourcesTitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.xs,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  sourceLinkText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  refreshText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default FactCheckDisplay;
