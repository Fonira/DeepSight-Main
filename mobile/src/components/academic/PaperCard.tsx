import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, Badge } from '../ui';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import type { AcademicPaper } from '../../services/api';

interface PaperCardProps {
  paper: AcademicPaper;
  onSelect?: (paper: AcademicPaper) => void;
  isSelected?: boolean;
  compact?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  semantic_scholar: '#1857B6',
  openalex: '#C93C20',
  arxiv: '#B31B1B',
};

const SOURCE_NAMES: Record<string, string> = {
  semantic_scholar: 'Semantic Scholar',
  openalex: 'OpenAlex',
  arxiv: 'arXiv',
};

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onSelect,
  isSelected = false,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { t, tr } = useLanguage();
  const [showAbstract, setShowAbstract] = useState(false);

  const formatAuthors = (authors: Array<{ name: string }>) => {
    if (!authors.length) return tr('Auteur inconnu', 'Unknown author');
    if (authors.length === 1) return authors[0].name;
    if (authors.length === 2) return `${authors[0].name} & ${authors[1].name}`;
    return `${authors[0].name} et al.`;
  };

  const formatCitations = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  const handleOpenUrl = async () => {
    if (paper.url) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(paper.url);
    }
  };

  const handleOpenPdf = async () => {
    if (paper.pdf_url) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(paper.pdf_url);
    }
  };

  const handleCopyCitation = async () => {
    const authors = formatAuthors(paper.authors);
    const year = paper.year || 'n.d.';
    const citation = `${authors} (${year}). ${paper.title}. ${paper.venue || ''}`.trim();

    await Clipboard.setStringAsync(citation);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      tr('Citation copiée', 'Citation copied'),
      tr('La citation a été copiée dans le presse-papiers', 'Citation copied to clipboard')
    );
  };

  const handleSelect = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect?.(paper);
  };

  return (
    <Card
      variant="elevated"
      style={[
        styles.card,
        isSelected && { borderColor: colors.accentPrimary, borderWidth: 2 },
      ]}
    >
      <TouchableOpacity
        onPress={onSelect ? handleSelect : handleOpenUrl}
        activeOpacity={0.7}
      >
        {/* Header: Source badge and citations */}
        <View style={styles.header}>
          <Badge
            label={SOURCE_NAMES[paper.source] || paper.source}
            variant="default"
            style={{ backgroundColor: SOURCE_COLORS[paper.source] || colors.surfaceSecondary }}
            textStyle={{ color: '#FFFFFF', fontSize: 10 }}
          />
          <View style={styles.citationBadge}>
            <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.citationCount, { color: colors.textSecondary }]}>
              {formatCitations(paper.citation_count)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={compact ? 2 : 3}
        >
          {paper.title}
        </Text>

        {/* Authors and year */}
        <Text style={[styles.authors, { color: colors.textSecondary }]} numberOfLines={1}>
          {formatAuthors(paper.authors)} {paper.year ? `(${paper.year})` : ''}
        </Text>

        {/* Venue */}
        {paper.venue && !compact && (
          <Text style={[styles.venue, { color: colors.textTertiary }]} numberOfLines={1}>
            {paper.venue}
          </Text>
        )}

        {/* Abstract (expandable) */}
        {paper.abstract && !compact && (
          <TouchableOpacity onPress={() => setShowAbstract(!showAbstract)}>
            <Text
              style={[styles.abstract, { color: colors.textSecondary }]}
              numberOfLines={showAbstract ? undefined : 2}
            >
              {paper.abstract}
            </Text>
            <Text style={[styles.toggleAbstract, { color: colors.accentPrimary }]}>
              {showAbstract ? tr('Voir moins', 'Show less') : tr('Voir plus', 'Show more')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {paper.is_open_access && (
            <Badge
              label={tr('Accès libre', 'Open Access')}
              variant="success"
              style={styles.oaBadge}
            />
          )}

          <View style={styles.actionButtons}>
            {paper.pdf_url && (
              <TouchableOpacity onPress={handleOpenPdf} style={styles.actionButton}>
                <Ionicons name="document-outline" size={18} color={colors.accentPrimary} />
                <Text style={[styles.actionText, { color: colors.accentPrimary }]}>PDF</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleCopyCitation} style={styles.actionButton}>
              <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                {tr('Citer', 'Cite')}
              </Text>
            </TouchableOpacity>

            {onSelect && (
              <TouchableOpacity onPress={handleSelect} style={styles.actionButton}>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                  size={18}
                  color={isSelected ? colors.success : colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  citationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  citationCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  title: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  authors: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: 2,
  },
  venue: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    fontStyle: 'italic',
    marginBottom: Spacing.xs,
  },
  abstract: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  toggleAbstract: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  oaBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.xs,
  },
  actionText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default PaperCard;
