import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card, Button, Badge } from '../ui';
import { PaperCard } from './PaperCard';
import { BibliographyExportModal } from './BibliographyExport';
import { academicApi, AcademicPaper, AcademicSearchResponse } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import { hasFeature, getLimit, normalizePlanId } from '../../config/planPrivileges';

interface AcademicSourcesSectionProps {
  summaryId: string;
  userPlan?: string;
  onUpgrade?: () => void;
}

export const AcademicSourcesSection: React.FC<AcademicSourcesSectionProps> = ({
  summaryId,
  userPlan = 'free',
  onUpgrade,
}) => {
  const { colors } = useTheme();
  const { t, tr } = useLanguage();

  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierLimitReached, setTierLimitReached] = useState(false);
  const [tierLimit, setTierLimit] = useState<number | null>(null);
  const [totalFound, setTotalFound] = useState(0);

  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  const plan = normalizePlanId(userPlan);
  const canSearch = hasFeature(plan, 'academicSearch');
  const canExport = hasFeature(plan, 'bibliographyExport');
  const paperLimit = getLimit(plan, 'academicPapersPerAnalysis');

  const handleSearch = useCallback(async () => {
    if (!canSearch) {
      onUpgrade?.();
      return;
    }

    setLoading(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await academicApi.enrich(summaryId);
      setPapers(response.papers);
      setTotalFound(response.total_found);
      setTierLimitReached(response.tier_limit_reached);
      setTierLimit(response.tier_limit || null);
      setSearched(true);
    } catch (err: any) {
      console.error('Academic search error:', err);
      setError(err.message || tr('Erreur lors de la recherche', 'Search failed'));
    } finally {
      setLoading(false);
    }
  }, [summaryId, canSearch, onUpgrade, tr]);

  const handleSelectPaper = (paper: AcademicPaper) => {
    setSelectedPapers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(paper.id)) {
        newSet.delete(paper.id);
      } else {
        newSet.add(paper.id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPapers.size === papers.length) {
      setSelectedPapers(new Set());
    } else {
      setSelectedPapers(new Set(papers.map((p) => p.id)));
    }
  };

  const handleExport = () => {
    if (!canExport) {
      Alert.alert(
        tr('Fonctionnalité Premium', 'Premium Feature'),
        tr(
          'L\'export de bibliographie nécessite un abonnement Student ou supérieur.',
          'Bibliography export requires a Student subscription or higher.'
        ),
        [
          { text: tr('Annuler', 'Cancel'), style: 'cancel' },
          { text: tr('Mettre à niveau', 'Upgrade'), onPress: onUpgrade },
        ]
      );
      return;
    }

    if (selectedPapers.size === 0) {
      Alert.alert(
        tr('Aucune sélection', 'No Selection'),
        tr('Sélectionnez des articles à exporter.', 'Select papers to export.')
      );
      return;
    }

    setShowExportModal(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="school-outline" size={20} color={colors.accentPrimary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {tr('Sources Académiques', 'Academic Sources')}
          </Text>
        </View>

        {searched && papers.length > 0 && (
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {papers.length} / {totalFound} {tr('articles', 'papers')}
          </Text>
        )}
      </View>

      {/* Search button or results */}
      {!searched && !loading && (
        <Card variant="elevated" style={styles.searchCard}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {tr(
              'Trouvez des articles scientifiques liés à cette analyse via Semantic Scholar, OpenAlex et arXiv.',
              'Find scientific papers related to this analysis from Semantic Scholar, OpenAlex, and arXiv.'
            )}
          </Text>

          <Button
            title={tr('Rechercher des sources', 'Find Sources')}
            onPress={handleSearch}
            variant="primary"
            icon={<Ionicons name="search" size={18} color="#FFFFFF" />}
            style={styles.searchButton}
          />

          {!canSearch && (
            <Text style={[styles.upgradeHint, { color: colors.warning }]}>
              {tr(
                'Fonctionnalité gratuite - 3 résultats max',
                'Free feature - 3 results max'
              )}
            </Text>
          )}
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card variant="elevated" style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {tr('Recherche en cours...', 'Searching...')}
          </Text>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card variant="elevated" style={styles.errorCard}>
          <Ionicons name="alert-circle" size={24} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <Button
            title={tr('Réessayer', 'Retry')}
            onPress={handleSearch}
            variant="secondary"
            size="sm"
          />
        </Card>
      )}

      {/* Results */}
      {searched && !loading && !error && (
        <>
          {papers.length === 0 ? (
            <Card variant="elevated" style={styles.emptyCard}>
              <Ionicons name="document-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {tr(
                  'Aucune source académique trouvée pour ce contenu.',
                  'No academic sources found for this content.'
                )}
              </Text>
            </Card>
          ) : (
            <>
              {/* Actions bar */}
              <View style={styles.actionsBar}>
                <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllButton}>
                  <Ionicons
                    name={selectedPapers.size === papers.length ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={colors.accentPrimary}
                  />
                  <Text style={[styles.selectAllText, { color: colors.accentPrimary }]}>
                    {selectedPapers.size === papers.length
                      ? tr('Tout désélectionner', 'Deselect all')
                      : tr('Tout sélectionner', 'Select all')}
                  </Text>
                </TouchableOpacity>

                <Button
                  title={tr('Exporter', 'Export')}
                  onPress={handleExport}
                  variant="secondary"
                  size="sm"
                  icon={<Ionicons name="download-outline" size={16} color={colors.accentPrimary} />}
                  disabled={selectedPapers.size === 0}
                />
              </View>

              {/* Paper list */}
              {papers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  onSelect={handleSelectPaper}
                  isSelected={selectedPapers.has(paper.id)}
                />
              ))}

              {/* Tier limit warning */}
              {tierLimitReached && (
                <Card variant="elevated" style={styles.tierLimitCard}>
                  <View style={styles.tierLimitContent}>
                    <Ionicons name="lock-closed" size={20} color={colors.warning} />
                    <View style={styles.tierLimitText}>
                      <Text style={[styles.tierLimitTitle, { color: colors.textPrimary }]}>
                        {tr(
                          `${totalFound - (tierLimit || 0)} résultats supplémentaires disponibles`,
                          `${totalFound - (tierLimit || 0)} more results available`
                        )}
                      </Text>
                      <Text style={[styles.tierLimitDesc, { color: colors.textSecondary }]}>
                        {tr(
                          'Passez à un forfait supérieur pour voir plus de sources.',
                          'Upgrade to see more sources.'
                        )}
                      </Text>
                    </View>
                  </View>
                  <Button
                    title={tr('Mettre à niveau', 'Upgrade')}
                    onPress={onUpgrade}
                    variant="primary"
                    size="sm"
                    style={styles.upgradeButton}
                  />
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Export modal */}
      <BibliographyExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        paperIds={Array.from(selectedPapers)}
        summaryId={summaryId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  count: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  searchCard: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  description: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  searchButton: {
    minWidth: 200,
  },
  upgradeHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
  },
  loadingCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  errorCard: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.xs,
  },
  selectAllText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  tierLimitCard: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  tierLimitContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tierLimitText: {
    flex: 1,
  },
  tierLimitTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  tierLimitDesc: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  upgradeButton: {
    alignSelf: 'flex-end',
  },
});

export default AcademicSourcesSection;
