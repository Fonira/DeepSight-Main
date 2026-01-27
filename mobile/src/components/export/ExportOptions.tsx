import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { exportApi } from '../../services/api';
import { hasFeature, getMinPlanForFeature, getPlanInfo } from '../../config/planPrivileges';

type ExportFormat = 'pdf' | 'markdown' | 'text' | 'bibtex';

interface ExportOption {
  format: ExportFormat;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  extension: string;
  mimeType: string;
  featureKey?: 'exportPdf' | 'exportMarkdown' | 'exportTxt' | 'bibtexExport';
}

const getExportOptions = (t: any): ExportOption[] => [
  { format: 'pdf', label: t.export.labels.pdf, icon: 'document-text', extension: 'pdf', mimeType: 'application/pdf', featureKey: 'exportPdf' },
  { format: 'markdown', label: t.export.labels.markdown, icon: 'logo-markdown', extension: 'md', mimeType: 'text/markdown', featureKey: 'exportMarkdown' },
  { format: 'text', label: t.export.labels.text, icon: 'document-outline', extension: 'txt', mimeType: 'text/plain', featureKey: 'exportTxt' },
  { format: 'bibtex', label: 'BibTeX', icon: 'code-slash', extension: 'bib', mimeType: 'application/x-bibtex', featureKey: 'bibtexExport' },
];

interface ExportOptionsProps {
  visible: boolean;
  onClose: () => void;
  summaryId: string;
  title?: string;
  videoInfo?: {
    title: string;
    channel: string;
    publishedAt?: string;
    videoId: string;
  };
  onUpgradePress?: () => void;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  visible,
  onClose,
  summaryId,
  title = 'summary',
  videoInfo,
  onUpgradePress,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);

  const userPlan = user?.plan || 'free';
  const exportOptions = getExportOptions(t);

  // Check if a feature is available for the user's plan
  const isFeatureAvailable = (option: ExportOption): boolean => {
    if (!option.featureKey) return true;
    return hasFeature(userPlan, option.featureKey);
  };

  // Get the minimum plan required for a feature
  const getRequiredPlan = (option: ExportOption): string | null => {
    if (!option.featureKey || isFeatureAvailable(option)) return null;
    const minPlan = getMinPlanForFeature(option.featureKey);
    const planInfo = getPlanInfo(minPlan);
    return planInfo.name[language as 'fr' | 'en'] || planInfo.name.fr;
  };

  // Generate BibTeX content locally
  const generateBibtex = (): string => {
    if (!videoInfo) {
      return `@online{deepsight${Date.now()},
  title = {${title.replace(/[{}]/g, '')}},
  url = {https://deepsightsynthesis.com},
  urldate = {${new Date().toISOString().split('T')[0]}},
  note = {DeepSight Analysis}
}`;
    }

    const publishDate = videoInfo.publishedAt ? new Date(videoInfo.publishedAt) : new Date();
    const bibtexKey = videoInfo.channel.toLowerCase().replace(/[^a-z0-9]/g, '') + publishDate.getFullYear();
    const accessDate = new Date().toISOString().split('T')[0];

    return `@online{${bibtexKey},
  author = {${videoInfo.channel.replace(/[{}]/g, '')}},
  title = {${videoInfo.title.replace(/[{}]/g, '')}},
  year = {${publishDate.getFullYear()}},
  url = {https://www.youtube.com/watch?v=${videoInfo.videoId}},
  urldate = {${accessDate}},
  note = {YouTube video}
}`;
  };

  const handleExport = async (option: ExportOption) => {
    // Check if feature is available
    if (!isFeatureAvailable(option)) {
      const requiredPlan = getRequiredPlan(option);
      Alert.alert(
        language === 'fr' ? 'Fonctionnalité Premium' : 'Premium Feature',
        language === 'fr'
          ? `L'export ${option.label} nécessite le plan ${requiredPlan} ou supérieur.`
          : `${option.label} export requires the ${requiredPlan} plan or higher.`,
        [
          { text: language === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
          {
            text: language === 'fr' ? 'Voir les plans' : 'View Plans',
            onPress: () => {
              onClose();
              onUpgradePress?.();
            },
          },
        ]
      );
      return;
    }

    setLoadingFormat(option.format);

    try {
      let content: Uint8Array;
      let fileName: string;
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

      if (option.format === 'bibtex') {
        // Generate BibTeX locally
        const bibtexContent = generateBibtex();
        content = new TextEncoder().encode(bibtexContent);
        fileName = `${sanitizedTitle}.bib`;
      } else {
        // Get the blob from API for other formats
        const blob = await exportApi.exportSummary(summaryId, option.format as 'pdf' | 'markdown' | 'text');
        const arrayBuffer = await blob.arrayBuffer();
        content = new Uint8Array(arrayBuffer);
        fileName = `${sanitizedTitle}.${option.extension}`;
      }

      // Create file in document directory
      const file = new File(Paths.document, fileName);

      // Write the file
      await file.write(content);

      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: option.mimeType,
          dialogTitle: `${t.export.title} ${option.label}`,
        });
      } else {
        Alert.alert(
          t.export.fileSaved,
          `${t.export.fileSavedAt} ${file.uri}`,
          [{ text: 'OK' }]
        );
      }

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        t.export.failed,
        error instanceof Error ? error.message : t.export.exportFailed,
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingFormat(null);
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 8,
    },
    optionsList: {
      gap: 12,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionCardDisabled: {
      opacity: 0.6,
    },
    optionCardLocked: {
      opacity: 0.8,
    },
    upgradeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    upgradeBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accentPrimary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    optionContent: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    optionSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    optionArrow: {
      marginLeft: 8,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.export.exportSummary}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsList}>
            {exportOptions.map((option) => {
              const isLoading = loadingFormat === option.format;
              const isDisabled = loadingFormat !== null;
              const isLocked = !isFeatureAvailable(option);
              const requiredPlan = getRequiredPlan(option);

              return (
                <TouchableOpacity
                  key={option.format}
                  style={[
                    styles.optionCard,
                    isDisabled && styles.optionCardDisabled,
                    isLocked && styles.optionCardLocked,
                  ]}
                  onPress={() => handleExport(option)}
                  disabled={isDisabled}
                >
                  <View style={[
                    styles.optionIcon,
                    isLocked && { backgroundColor: colors.textTertiary + '20' }
                  ]}>
                    <Ionicons
                      name={isLocked ? 'lock-closed' : option.icon}
                      size={22}
                      color={isLocked ? colors.textTertiary : colors.accentPrimary}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionLabel,
                      isLocked && { color: colors.textTertiary }
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionSubtext}>
                      {isLocked && requiredPlan
                        ? `${language === 'fr' ? 'Plan' : 'Plan'} ${requiredPlan}+`
                        : `${t.export.fileExtension} .${option.extension}`
                      }
                    </Text>
                  </View>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
                  ) : isLocked ? (
                    <View style={[styles.upgradeBadge, { backgroundColor: colors.accentWarning + '20' }]}>
                      <Text style={[styles.upgradeBadgeText, { color: colors.accentWarning }]}>
                        {language === 'fr' ? 'Pro' : 'Pro'}
                      </Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="download-outline"
                      size={20}
                      color={colors.textSecondary}
                      style={styles.optionArrow}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
