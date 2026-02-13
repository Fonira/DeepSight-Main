import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, Button } from '../ui';
import { academicApi, BibliographyFormat } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface BibliographyExportModalProps {
  visible: boolean;
  onClose: () => void;
  paperIds: string[];
  summaryId?: string;
}

interface FormatOption {
  id: BibliographyFormat;
  name: string;
  description: string;
  icon: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'bibtex',
    name: 'BibTeX',
    description: 'Pour LaTeX et gestionnaires de références',
    icon: 'code-slash',
  },
  {
    id: 'ris',
    name: 'RIS',
    description: 'Compatible Zotero, Mendeley, EndNote',
    icon: 'document-text',
  },
  {
    id: 'apa',
    name: 'APA 7e édition',
    description: 'Style académique standard',
    icon: 'school',
  },
  {
    id: 'mla',
    name: 'MLA 9e édition',
    description: 'Humanités et littérature',
    icon: 'book',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    description: 'Sciences sociales et histoire',
    icon: 'library',
  },
  {
    id: 'harvard',
    name: 'Harvard',
    description: 'Style auteur-date',
    icon: 'reader',
  },
];

export const BibliographyExportModal: React.FC<BibliographyExportModalProps> = ({
  visible,
  onClose,
  paperIds,
  summaryId,
}) => {
  const { colors } = useTheme();
  const { tr } = useLanguage();

  const [selectedFormat, setSelectedFormat] = useState<BibliographyFormat>('bibtex');
  const [loading, setLoading] = useState(false);
  const [exportedContent, setExportedContent] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await academicApi.exportBibliography({
        paper_ids: paperIds,
        format: selectedFormat,
        summary_id: summaryId,
      });

      setExportedContent(response.content);
    } catch (err: any) {
      if (__DEV__) { console.error('Export error:', err); }
      Alert.alert(
        tr('Erreur', 'Error'),
        err.message || tr('Échec de l\'export', 'Export failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!exportedContent) return;

    await Clipboard.setStringAsync(exportedContent);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      tr('Copié !', 'Copied!'),
      tr('La bibliographie a été copiée dans le presse-papiers.', 'Bibliography copied to clipboard.')
    );
  };

  const handleShare = async () => {
    if (!exportedContent) return;

    try {
      await Share.share({
        message: exportedContent,
        title: tr('Bibliographie DeepSight', 'DeepSight Bibliography'),
      });
    } catch (err) {
      if (__DEV__) { console.error('Share error:', err); }
    }
  };

  const handleClose = () => {
    setExportedContent(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {tr('Exporter la bibliographie', 'Export Bibliography')}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <Text style={[styles.info, { color: colors.textSecondary }]}>
          {paperIds.length} {tr('articles sélectionnés', 'papers selected')}
        </Text>

        {!exportedContent ? (
          <>
            {/* Format selection */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {tr('Choisir le format', 'Choose format')}
            </Text>

            <View style={styles.formatGrid}>
              {FORMAT_OPTIONS.map((format) => (
                <TouchableOpacity
                  key={format.id}
                  onPress={() => setSelectedFormat(format.id)}
                  style={[
                    styles.formatCard,
                    { backgroundColor: colors.surfaceSecondary },
                    selectedFormat === format.id && {
                      borderColor: colors.accentPrimary,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Ionicons
                    name={format.icon as any}
                    size={24}
                    color={selectedFormat === format.id ? colors.accentPrimary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.formatName,
                      {
                        color: selectedFormat === format.id ? colors.accentPrimary : colors.textPrimary,
                      },
                    ]}
                  >
                    {format.name}
                  </Text>
                  <Text style={[styles.formatDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                    {format.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Export button */}
            <Button
              title={loading ? tr('Export en cours...', 'Exporting...') : tr('Générer', 'Generate')}
              onPress={handleExport}
              variant="primary"
              disabled={loading}
              style={styles.exportButton}
            />
          </>
        ) : (
          <>
            {/* Export result */}
            <Card variant="elevated" style={styles.resultCard}>
              <Text style={[styles.resultContent, { color: colors.textPrimary }]} selectable>
                {exportedContent.substring(0, 500)}
                {exportedContent.length > 500 && '...'}
              </Text>
            </Card>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title={tr('Copier', 'Copy')}
                onPress={handleCopy}
                variant="secondary"
                icon={<Ionicons name="copy-outline" size={18} color={colors.accentPrimary} />}
                style={styles.actionButton}
              />
              <Button
                title={tr('Partager', 'Share')}
                onPress={handleShare}
                variant="primary"
                icon={<Ionicons name="share-outline" size={18} color="#FFFFFF" />}
                style={styles.actionButton}
              />
            </View>

            <Button
              title={tr('Changer de format', 'Change format')}
              onPress={() => setExportedContent(null)}
              variant="ghost"
              style={styles.changeFormatButton}
            />
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  info: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  formatCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  formatName: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
  },
  formatDesc: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  exportButton: {
    marginTop: 'auto',
  },
  resultCard: {
    flex: 1,
    maxHeight: 300,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  resultContent: {
    fontSize: Typography.fontSize.xs,
    fontFamily: 'Courier',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  changeFormatButton: {
    marginTop: Spacing.sm,
  },
});

export default BibliographyExportModal;
