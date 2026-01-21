import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { videoApi } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface EnrichmentResult {
  title: string;
  content: string;
  sources?: Array<{
    title: string;
    url: string;
  }>;
}

interface WebEnrichmentProps {
  summaryId: string;
  conceptName?: string;
  disabled?: boolean;
  compact?: boolean;
}

const parseEnrichmentResult = (result: string, conceptName?: string): EnrichmentResult => {
  // Parse the enrichment result into structured data
  const lines = result.split('\n').filter(line => line.trim());

  let title = conceptName || 'Enrichissement web';
  let content = '';
  const sources: Array<{ title: string; url: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect URLs
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const urlTitle = trimmed.replace(urlMatch[0], '').replace(/^[-•*]\s*/, '').trim();
      sources.push({
        title: urlTitle || urlMatch[0],
        url: urlMatch[0],
      });
    } else if (!trimmed.startsWith('#')) {
      content += (content ? '\n' : '') + trimmed;
    }
  }

  return { title, content: content || result, sources };
};

export const WebEnrichment: React.FC<WebEnrichmentProps> = ({
  summaryId,
  conceptName,
  disabled = false,
  compact = false,
}) => {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnrich = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await videoApi.webEnrich(summaryId);
      const parsed = parseEnrichmentResult(response.result, conceptName);
      setResult(parsed);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || 'Impossible d\'enrichir le contenu');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  if (compact) {
    return (
      <>
        <TouchableOpacity
          style={[styles.compactButton, { backgroundColor: `${colors.accentInfo}20` }]}
          onPress={handleEnrich}
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accentInfo} />
          ) : (
            <Ionicons name="globe-outline" size={16} color={colors.accentInfo} />
          )}
          <Text style={[styles.compactButtonText, { color: colors.accentInfo }]}>
            Enrichir
          </Text>
        </TouchableOpacity>

        <EnrichmentModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          result={result}
          error={error}
          onOpenUrl={handleOpenUrl}
          colors={colors}
        />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: colors.bgElevated },
          disabled && styles.buttonDisabled,
        ]}
        onPress={handleEnrich}
        disabled={disabled || isLoading}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${colors.accentInfo}20` }]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accentInfo} />
          ) : (
            <Ionicons name="globe-outline" size={24} color={colors.accentInfo} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Enrichissement web
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Informations complémentaires du web
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <EnrichmentModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        result={result}
        error={error}
        onOpenUrl={handleOpenUrl}
        colors={colors}
      />
    </>
  );
};

// Separate modal component for reuse
const EnrichmentModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  result: EnrichmentResult | null;
  error: string | null;
  onOpenUrl: (url: string) => void;
  colors: any;
}> = ({ visible, onClose, result, error, onOpenUrl, colors }) => (
  <Modal
    visible={visible}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}
  >
    <View style={[styles.modalContainer, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
          {result?.title || 'Enrichissement web'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
        ) : result ? (
          <>
            <Text style={[styles.contentText, { color: colors.textPrimary }]}>
              {result.content}
            </Text>

            {result.sources && result.sources.length > 0 && (
              <View style={styles.sourcesSection}>
                <Text style={[styles.sourcesTitle, { color: colors.textSecondary }]}>
                  Sources
                </Text>
                {result.sources.map((source, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.sourceCard, { backgroundColor: colors.bgSecondary }]}
                    onPress={() => onOpenUrl(source.url)}
                  >
                    <Ionicons name="link-outline" size={16} color={colors.accentPrimary} />
                    <Text
                      style={[styles.sourceText, { color: colors.accentPrimary }]}
                      numberOfLines={2}
                    >
                      {source.title}
                    </Text>
                    <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
              Ces informations proviennent de sources externes et peuvent nécessiter une vérification.
            </Text>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Chargement...
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  </Modal>
);

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
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  compactButtonText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
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
    flex: 1,
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
  contentText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.base * 1.6,
  },
  sourcesSection: {
    marginTop: Spacing.xl,
  },
  sourcesTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sourceText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  disclaimer: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    fontStyle: 'italic',
    marginTop: Spacing.xl,
    textAlign: 'center',
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

export default WebEnrichment;
