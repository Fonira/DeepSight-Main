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
import { exportApi } from '../../services/api';

type ExportFormat = 'pdf' | 'markdown' | 'text';

interface ExportOption {
  format: ExportFormat;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  extension: string;
  mimeType: string;
}

const exportOptions: ExportOption[] = [
  { format: 'pdf', label: 'Document PDF', icon: 'document-text', extension: 'pdf', mimeType: 'application/pdf' },
  { format: 'markdown', label: 'Markdown', icon: 'logo-markdown', extension: 'md', mimeType: 'text/markdown' },
  { format: 'text', label: 'Texte brut', icon: 'document-outline', extension: 'txt', mimeType: 'text/plain' },
];

interface ExportOptionsProps {
  visible: boolean;
  onClose: () => void;
  summaryId: string;
  title?: string;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  visible,
  onClose,
  summaryId,
  title = 'summary',
}) => {
  const { colors } = useTheme();
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (option: ExportOption) => {
    setLoadingFormat(option.format);

    try {
      // Get the blob from API
      const blob = await exportApi.exportSummary(summaryId, option.format);

      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();

      // Create file name
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const fileName = `${sanitizedTitle}.${option.extension}`;

      // Create file in document directory
      const file = new File(Paths.document, fileName);

      // Write the file
      await file.write(new Uint8Array(arrayBuffer));

      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: option.mimeType,
          dialogTitle: `Export ${option.label}`,
        });
      } else {
        Alert.alert(
          'Fichier sauvegardé',
          `Fichier sauvegardé: ${file.uri}`,
          [{ text: 'OK' }]
        );
      }

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Échec de l\'export',
        error instanceof Error ? error.message : 'Impossible d\'exporter le fichier',
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
            <Text style={styles.title}>Exporter le résumé</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsList}>
            {exportOptions.map((option) => {
              const isLoading = loadingFormat === option.format;
              const isDisabled = loadingFormat !== null;

              return (
                <TouchableOpacity
                  key={option.format}
                  style={[styles.optionCard, isDisabled && styles.optionCardDisabled]}
                  onPress={() => handleExport(option)}
                  disabled={isDisabled}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={colors.accentPrimary}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionSubtext}>
                      Fichier .{option.extension}
                    </Text>
                  </View>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.accentPrimary} />
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
