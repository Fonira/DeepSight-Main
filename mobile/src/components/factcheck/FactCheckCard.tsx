/**
 * FactCheckCard - Carte individuelle pour afficher un claim fact-checké
 * Utilisable dans AnalysisScreen ou dans une liste de résultats
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
export type VerdictType = 'verified' | 'disputed' | 'unverified' | 'mixed' | 'misleading' | 'partially_true';

export interface FactCheckClaim {
  text: string;
  verdict: VerdictType;
  confidence: number;
  sources?: Array<{ url: string; title: string }>;
  explanation?: string;
}

interface FactCheckCardProps {
  claim: FactCheckClaim;
  index?: number;
  compact?: boolean;
}

const VERDICT_CONFIG: Record<VerdictType, {
  icon: keyof typeof Ionicons.glyphMap;
  labelFr: string;
  labelEn: string;
  colorKey: string;
}> = {
  verified: {
    icon: 'checkmark-circle',
    labelFr: 'Vérifié',
    labelEn: 'Verified',
    colorKey: '#22C55E',
  },
  disputed: {
    icon: 'warning',
    labelFr: 'Contesté',
    labelEn: 'Disputed',
    colorKey: '#EF4444',
  },
  unverified: {
    icon: 'help-circle',
    labelFr: 'Non vérifié',
    labelEn: 'Unverified',
    colorKey: '#6B7280',
  },
  mixed: {
    icon: 'remove-circle',
    labelFr: 'Partiellement vrai',
    labelEn: 'Partially true',
    colorKey: '#F59E0B',
  },
  misleading: {
    icon: 'close-circle',
    labelFr: 'Trompeur',
    labelEn: 'Misleading',
    colorKey: '#DC2626',
  },
  partially_true: {
    icon: 'remove-circle',
    labelFr: 'Partiellement vrai',
    labelEn: 'Partially true',
    colorKey: '#F59E0B',
  },
};

export const FactCheckCard: React.FC<FactCheckCardProps> = ({
  claim,
  index,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  const config = VERDICT_CONFIG[claim.verdict] || VERDICT_CONFIG.unverified;
  const verdictColor = config.colorKey;
  const verdictLabel = language === 'fr' ? config.labelFr : config.labelEn;

  const toggleExpand = useCallback(() => {
    Haptics.selectionAsync();
    setIsExpanded(prev => !prev);
  }, []);

  const openSource = useCallback((url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  }, []);

  if (compact) {
    return (
      <View style={[styles.compactCard, { backgroundColor: `${verdictColor}10` }]}>
        <Ionicons name={config.icon} size={16} color={verdictColor} />
        <Text
          style={[styles.compactText, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {claim.text}
        </Text>
        <View style={[styles.compactBadge, { backgroundColor: `${verdictColor}20` }]}>
          <Text style={[styles.compactBadgeText, { color: verdictColor }]}>
            {verdictLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: `${verdictColor}08` }]}
      onPress={toggleExpand}
      activeOpacity={0.8}
    >
      {/* Header: verdict icon + claim text */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${verdictColor}20` }]}>
          <Ionicons name={config.icon} size={20} color={verdictColor} />
        </View>
        <View style={styles.headerContent}>
          <Text
            style={[styles.claimText, { color: colors.textPrimary }]}
            numberOfLines={isExpanded ? undefined : 3}
          >
            {claim.text}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </View>

      {/* Verdict badge + confidence */}
      <View style={styles.metaRow}>
        <View style={[styles.verdictBadge, { borderColor: verdictColor }]}>
          <Text style={[styles.verdictText, { color: verdictColor }]}>
            {verdictLabel}
          </Text>
        </View>
        <Text style={[styles.confidenceText, { color: colors.textTertiary }]}>
          {Math.round(claim.confidence * 100)}% {language === 'fr' ? 'confiance' : 'confidence'}
        </Text>
      </View>

      {/* Expanded: explanation + sources */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          {claim.explanation ? (
            <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
              {claim.explanation}
            </Text>
          ) : null}

          {claim.sources && claim.sources.length > 0 ? (
            <View style={[styles.sourcesContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.sourcesTitle, { color: colors.textTertiary }]}>
                {language === 'fr' ? 'Sources :' : 'Sources:'}
              </Text>
              {claim.sources.map((source, sIndex) => (
                <TouchableOpacity
                  key={sIndex}
                  style={styles.sourceLink}
                  onPress={() => openSource(source.url)}
                >
                  <Ionicons name="link" size={12} color={colors.accentPrimary} />
                  <Text
                    style={[styles.sourceLinkText, { color: colors.accentPrimary }]}
                    numberOfLines={1}
                  >
                    {source.title || source.url}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  claimText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingLeft: 40, // Align with text after icon
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
    textTransform: 'uppercase',
  },
  confidenceText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  expandedSection: {
    marginTop: Spacing.md,
    paddingLeft: 40,
  },
  explanationText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
    marginBottom: Spacing.sm,
  },
  sourcesContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  // Compact styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  compactText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  compactBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  compactBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodyMedium,
    textTransform: 'uppercase',
  },
});

export default FactCheckCard;
