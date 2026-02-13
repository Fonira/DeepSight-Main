import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header, Card, DeepSightSpinner } from '../components';
import { videoApi, exportApi, ApiError } from '../services/api';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, AnalysisSummary } from '../types';

type ExportFormat = 'pdf' | 'markdown';

interface FormatOption {
  id: ExportFormat;
  labelKey: 'pdf' | 'markdown';
  icon: keyof typeof Ionicons.glyphMap;
  extension: string;
  mimeType: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'pdf',
    labelKey: 'pdf',
    icon: 'document-text',
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
  {
    id: 'markdown',
    labelKey: 'markdown',
    icon: 'code-slash',
    extension: '.md',
    mimeType: 'text/markdown',
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Export'>;

export const ExportScreen: React.FC<Props> = ({ route, navigation }) => {
  const { summaryId, title } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('analysis');

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await videoApi.getSummary(summaryId);
      setSummary(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.export.failed;
      setLoadError(message);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [summaryId, t]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 60);
  };

  const handleExport = async () => {
    if (!summary) return;

    setIsExporting(true);
    try {
      const blob = await exportApi.exportSummary(summaryId, selectedFormat === 'pdf' ? 'pdf' : 'markdown');
      const filename = sanitizeFilename(title);
      const format = FORMAT_OPTIONS.find(f => f.id === selectedFormat);
      const ext = format?.extension ?? '.txt';
      const mimeType = format?.mimeType ?? 'text/plain';

      // Create file using new expo-file-system API
      const file = new ExpoFile(Paths.cache, `${filename}${ext}`);

      // Convert blob to base64 and write
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          if (base64) {
            resolve(base64);
          } else {
            reject(new Error('Failed to convert blob'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      file.write(base64Data, { encoding: 'base64' });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType,
          dialogTitle: t.export.exportSummary,
        });
      } else {
        Alert.alert(t.export.success, t.export.fileSaved);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.export.failed;
      Alert.alert(t.export.failed, message);
    } finally {
      setIsExporting(false);
    }
  };

  const contentPreview = summary?.content
    ? summary.content.substring(0, 300) + (summary.content.length > 300 ? '...' : '')
    : '';

  if (isLoadingSummary) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={t.export.title} showBack />
        <View style={styles.centerContainer}>
          <DeepSightSpinner size="lg" showGlow />
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={t.export.title} showBack />
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.accentPrimary }]}
            onPress={() => {
              setIsLoadingSummary(true);
              loadSummary();
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
      <Header title={t.export.title} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Video info */}
        <Card variant="elevated" style={styles.videoCard}>
          <Text style={[styles.videoTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
          {summary?.channel && (
            <Text style={[styles.videoChannel, { color: colors.textTertiary }]}>
              {summary.channel}
            </Text>
          )}
        </Card>

        {/* Format selection */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t.export.selectFormat}
        </Text>
        <View style={styles.formatGrid}>
          {FORMAT_OPTIONS.map((format) => {
            const isSelected = selectedFormat === format.id;
            return (
              <TouchableOpacity
                key={format.id}
                style={[
                  styles.formatCard,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: isSelected ? colors.accentPrimary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedFormat(format.id)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t.export.labels[format.labelKey]}
              >
                <View
                  style={[
                    styles.formatIconContainer,
                    {
                      backgroundColor: isSelected
                        ? colors.accentPrimary + '20'
                        : colors.bgTertiary,
                    },
                  ]}
                >
                  <Ionicons
                    name={format.icon}
                    size={28}
                    color={isSelected ? colors.accentPrimary : colors.textTertiary}
                  />
                </View>
                <Text
                  style={[
                    styles.formatLabel,
                    {
                      color: isSelected ? colors.accentPrimary : colors.textPrimary,
                      fontFamily: isSelected
                        ? Typography.fontFamily.bodySemiBold
                        : Typography.fontFamily.body,
                    },
                  ]}
                >
                  {t.export.labels[format.labelKey]}
                </Text>
                <Text style={[styles.formatExt, { color: colors.textTertiary }]}>
                  {format.extension}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview */}
        {contentPreview ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t.videoDiscovery?.preview ?? 'Preview'}
            </Text>
            <Card variant="elevated" style={styles.previewCard}>
              <Text
                style={[styles.previewText, { color: colors.textSecondary }]}
                numberOfLines={8}
              >
                {contentPreview}
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>

      {/* Export button - fixed at bottom */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.bgPrimary,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.exportButton,
            {
              backgroundColor: isExporting ? colors.bgTertiary : colors.accentPrimary,
            },
          ]}
          onPress={handleExport}
          disabled={isExporting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t.export.exportSummary}
        >
          {isExporting ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#fff" />
          )}
          <Text style={styles.exportButtonText}>
            {isExporting ? t.export.downloading : t.export.exportSummary}
          </Text>
        </TouchableOpacity>
      </View>
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
  videoCard: {
    marginBottom: Spacing.lg,
  },
  videoTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  videoChannel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
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
  formatGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  formatCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  formatIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  formatLabel: {
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
  formatExt: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  previewCard: {
    marginBottom: Spacing.lg,
  },
  previewText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default ExportScreen;
