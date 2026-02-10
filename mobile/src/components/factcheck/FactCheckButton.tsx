import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { videoApi } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface FactCheckResult {
  claim: string;
  status: 'verified' | 'disputed' | 'unverified' | 'partially_true';
  explanation: string;
  sources?: string[];
}

interface FactCheckButtonProps {
  summaryId: string;
  disabled?: boolean;
}

const mapRiskToStatus = (riskLevel: string): FactCheckResult['status'] => {
  switch (riskLevel) {
    case 'high': return 'disputed';
    case 'medium': return 'partially_true';
    case 'low': return 'verified';
    default: return 'unverified';
  }
};

export const FactCheckButton: React.FC<FactCheckButtonProps> = ({
  summaryId,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState<FactCheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFactCheck = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await videoApi.factCheck(summaryId);
      const factCheck = response.fact_check_lite;
      if (!factCheck) {
        setResults([{
          claim: 'Analyse de fiabilité',
          status: 'unverified',
          explanation: response.freshness?.description || 'Données non disponibles',
        }]);
        setShowModal(true);
        return;
      }
      const claims: FactCheckResult[] = [
        ...factCheck.high_risk_claims.map(c => ({
          claim: c.claim,
          status: mapRiskToStatus(c.risk_level),
          explanation: c.verification_hint || '',
          sources: c.suggested_search ? [c.suggested_search] : undefined,
        })),
        ...factCheck.medium_risk_claims.map(c => ({
          claim: c.claim,
          status: mapRiskToStatus(c.risk_level),
          explanation: c.verification_hint || '',
        })),
      ];
      if (claims.length === 0) {
        claims.push({
          claim: factCheck.risk_summary || 'Analyse de fiabilité',
          status: factCheck.overall_confidence > 70 ? 'verified' : 'unverified',
          explanation: `Confiance globale: ${factCheck.overall_confidence}%`,
        });
      }
      setResults(claims);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || 'Impossible de vérifier les faits');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: FactCheckResult['status']) => {
    switch (status) {
      case 'verified':
        return { name: 'checkmark-circle' as const, color: colors.accentSuccess };
      case 'disputed':
        return { name: 'close-circle' as const, color: colors.accentError };
      case 'partially_true':
        return { name: 'alert-circle' as const, color: colors.accentWarning };
      default:
        return { name: 'help-circle' as const, color: colors.textTertiary };
    }
  };

  const getStatusLabel = (status: FactCheckResult['status']) => {
    switch (status) {
      case 'verified': return 'Vérifié';
      case 'disputed': return 'Contesté';
      case 'partially_true': return 'Partiellement vrai';
      default: return 'Non vérifié';
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: colors.bgElevated },
          disabled && styles.buttonDisabled,
        ]}
        onPress={handleFactCheck}
        disabled={disabled || isLoading}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${colors.accentWarning}20` }]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accentWarning} />
          ) : (
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.accentWarning} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Vérifier les faits
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Analyse de fiabilité des informations
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.bgPrimary }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Vérification des faits
            </Text>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
          >
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color={colors.accentError} />
                <Text style={[styles.errorText, { color: colors.textPrimary }]}>
                  {error}
                </Text>
              </View>
            ) : results.length > 0 ? (
              <>
                <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
                  Cette vérification est générée par IA et peut contenir des erreurs.
                  Vérifiez toujours les informations auprès de sources fiables.
                </Text>

                {results.map((result, index) => {
                  const statusInfo = getStatusIcon(result.status);
                  return (
                    <View
                      key={index}
                      style={[styles.resultCard, { backgroundColor: colors.bgSecondary }]}
                    >
                      <View style={styles.resultHeader}>
                        <Ionicons
                          name={statusInfo.name}
                          size={24}
                          color={statusInfo.color}
                        />
                        <View style={styles.resultHeaderText}>
                          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
                            {getStatusLabel(result.status)}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.claimText, { color: colors.textPrimary }]}>
                        {result.claim}
                      </Text>

                      {result.explanation && (
                        <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                          {result.explanation}
                        </Text>
                      )}

                      {result.sources && result.sources.length > 0 && (
                        <View style={styles.sourcesContainer}>
                          <Text style={[styles.sourcesTitle, { color: colors.textTertiary }]}>
                            Sources:
                          </Text>
                          {result.sources.map((source, sIndex) => (
                            <Text
                              key={sIndex}
                              style={[styles.sourceText, { color: colors.accentPrimary }]}
                            >
                              • {source}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Analyse en cours...
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  subtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  disclaimer: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    fontStyle: 'italic',
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  resultCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  resultHeaderText: {
    flex: 1,
  },
  statusLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
  },
  claimText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.sm,
  },
  explanationText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  sourcesContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  sourcesTitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  sourceText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  errorText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
});

export default FactCheckButton;
