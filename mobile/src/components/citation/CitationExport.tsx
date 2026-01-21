import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

type CitationStyle = 'apa' | 'mla' | 'chicago' | 'harvard';

interface CitationExportProps {
  visible: boolean;
  onClose: () => void;
  videoInfo: {
    title: string;
    channel: string;
    publishedAt?: string;
    videoId: string;
  };
  accessDate?: Date;
}

const formatDate = (date: Date, style: CitationStyle): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthsFr = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  switch (style) {
    case 'apa':
      return `${year}, ${months[month]} ${day}`;
    case 'mla':
      return `${day} ${months[month].substring(0, 3)}. ${year}`;
    case 'chicago':
      return `${months[month]} ${day}, ${year}`;
    case 'harvard':
      return `${day} ${monthsFr[month]} ${year}`;
    default:
      return `${day}/${month + 1}/${year}`;
  }
};

const generateCitation = (
  style: CitationStyle,
  videoInfo: { title: string; channel: string; publishedAt?: string; videoId: string },
  accessDate: Date
): string => {
  const url = `https://www.youtube.com/watch?v=${videoInfo.videoId}`;
  const publishDate = videoInfo.publishedAt ? new Date(videoInfo.publishedAt) : new Date();

  switch (style) {
    case 'apa':
      // APA 7th edition format
      return `${videoInfo.channel}. (${formatDate(publishDate, 'apa')}). ${videoInfo.title} [Video]. YouTube. ${url}`;

    case 'mla':
      // MLA 9th edition format
      return `"${videoInfo.title}." YouTube, uploaded by ${videoInfo.channel}, ${formatDate(publishDate, 'mla')}, ${url}.`;

    case 'chicago':
      // Chicago 17th edition format
      return `${videoInfo.channel}. "${videoInfo.title}." YouTube video, ${formatDate(publishDate, 'chicago')}. ${url}.`;

    case 'harvard':
      // Harvard format
      return `${videoInfo.channel} (${publishDate.getFullYear()}) ${videoInfo.title}. [Vidéo en ligne]. Disponible sur: ${url} (Consulté le ${formatDate(accessDate, 'harvard')}).`;

    default:
      return url;
  }
};

export const CitationExport: React.FC<CitationExportProps> = ({
  visible,
  onClose,
  videoInfo,
  accessDate = new Date(),
}) => {
  const { colors } = useTheme();
  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>('apa');

  const citationStyles: { id: CitationStyle; name: string; description: string }[] = [
    { id: 'apa', name: 'APA', description: '7e édition - Sciences sociales' },
    { id: 'mla', name: 'MLA', description: '9e édition - Humanités' },
    { id: 'chicago', name: 'Chicago', description: '17e édition - Histoire' },
    { id: 'harvard', name: 'Harvard', description: 'Sciences et business' },
  ];

  const currentCitation = generateCitation(selectedStyle, videoInfo, accessDate);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(currentCitation);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copié', 'La citation a été copiée dans le presse-papiers');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Citation
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Style Selection */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Format de citation
          </Text>

          <View style={styles.stylesGrid}>
            {citationStyles.map((style) => (
              <TouchableOpacity
                key={style.id}
                style={[
                  styles.styleCard,
                  { backgroundColor: colors.bgSecondary },
                  selectedStyle === style.id && {
                    borderColor: colors.accentPrimary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedStyle(style.id);
                }}
              >
                <Text style={[styles.styleName, { color: colors.textPrimary }]}>
                  {style.name}
                </Text>
                <Text style={[styles.styleDescription, { color: colors.textSecondary }]}>
                  {style.description}
                </Text>
                {selectedStyle === style.id && (
                  <View style={[styles.checkmark, { backgroundColor: colors.accentPrimary }]}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Citation Preview */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Aperçu
          </Text>

          <View style={[styles.previewCard, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.previewText, { color: colors.textPrimary }]}>
              {currentCitation}
            </Text>
          </View>

          {/* Copy Button */}
          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: colors.accentPrimary }]}
            onPress={handleCopy}
          >
            <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            <Text style={styles.copyButtonText}>Copier la citation</Text>
          </TouchableOpacity>

          {/* Info */}
          <Text style={[styles.infoText, { color: colors.textTertiary }]}>
            La citation inclut automatiquement la date d'accès pour les formats qui le requièrent.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  stylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  styleCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: 2,
  },
  styleDescription: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  checkmark: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  previewText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.mono,
    lineHeight: Typography.fontSize.sm * 1.6,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  infoText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontStyle: 'italic',
  },
});

export default CitationExport;
