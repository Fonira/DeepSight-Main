/**
 * ConceptsGlossary - Glossaire des concepts enrichis avec définitions AI
 * Support d'expansion, recherche web, et liens entre concepts
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { videoApi } from '../../services/api';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface Concept {
  name: string;
  definition: string;
  importance?: number;
  category?: string;
  relatedConcepts?: string[];
  sources?: Array<{ url: string; title: string }>;
}

interface ConceptsGlossaryProps {
  concepts: Concept[];
  summaryId?: string;
  onConceptPress?: (concept: Concept) => void;
  isLoading?: boolean;
  showSearch?: boolean;
  maxVisible?: number;
}

export const ConceptsGlossary: React.FC<ConceptsGlossaryProps> = ({
  concepts,
  summaryId,
  onConceptPress,
  isLoading = false,
  showSearch = true,
  maxVisible,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [enrichingConcept, setEnrichingConcept] = useState<string | null>(null);
  const [enrichedData, setEnrichedData] = useState<Record<string, {
    sources?: Array<{ url: string; title: string }>;
    relatedConcepts?: string[];
    extendedDefinition?: string;
  }>>({});
  const [showAll, setShowAll] = useState(false);

  // Filter concepts based on search
  const filteredConcepts = concepts.filter(concept =>
    concept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    concept.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Limit visible concepts
  const visibleConcepts = maxVisible && !showAll
    ? filteredConcepts.slice(0, maxVisible)
    : filteredConcepts;

  const toggleConceptExpanded = useCallback((conceptName: string) => {
    Haptics.selectionAsync();
    setExpandedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(conceptName)) {
        next.delete(conceptName);
      } else {
        next.add(conceptName);
      }
      return next;
    });
  }, []);

  const enrichConcept = useCallback(async (concept: Concept) => {
    if (!summaryId || enrichingConcept) return;

    setEnrichingConcept(concept.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await videoApi.webEnrich(summaryId);
      // Parse the enrichment result
      setEnrichedData(prev => ({
        ...prev,
        [concept.name]: {
          extendedDefinition: result.result,
          sources: [], // Would come from API
          relatedConcepts: [],
        },
      }));
    } catch (err) {
      console.error('Failed to enrich concept:', err);
    } finally {
      setEnrichingConcept(null);
    }
  }, [summaryId, enrichingConcept]);

  const handleRelatedConceptPress = useCallback((conceptName: string) => {
    const concept = concepts.find(c => c.name.toLowerCase() === conceptName.toLowerCase());
    if (concept) {
      toggleConceptExpanded(concept.name);
      onConceptPress?.(concept);
    }
  }, [concepts, toggleConceptExpanded, onConceptPress]);

  const openSource = (url: string) => {
    Linking.openURL(url);
  };

  // Open Wikipedia search for a concept
  const openWikipedia = (conceptName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const searchTerm = encodeURIComponent(conceptName);
    const wikiLang = language === 'fr' ? 'fr' : 'en';
    Linking.openURL(`https://${wikiLang}.wikipedia.org/wiki/Special:Search?search=${searchTerm}`);
  };

  // Get importance color
  const getImportanceColor = (importance?: number): string => {
    if (!importance) return colors.textTertiary;
    if (importance >= 0.8) return colors.accentPrimary;
    if (importance >= 0.5) return colors.accentInfo;
    return colors.textSecondary;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgElevated }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {language === 'fr' ? 'Chargement des concepts...' : 'Loading concepts...'}
        </Text>
      </View>
    );
  }

  if (concepts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bgElevated }]}>
        <Ionicons name="bulb-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {language === 'fr' ? 'Aucun concept extrait' : 'No concepts extracted'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bulb" size={20} color={colors.accentPrimary} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Concepts clés' : 'Key Concepts'}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: `${colors.accentPrimary}20` }]}>
            <Text style={[styles.countText, { color: colors.accentPrimary }]}>
              {concepts.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && concepts.length > 5 && (
        <View style={[styles.searchContainer, { backgroundColor: colors.bgSecondary }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={language === 'fr' ? 'Rechercher un concept...' : 'Search concepts...'}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Concepts list */}
      <View style={styles.conceptsList}>
        {visibleConcepts.map((concept, index) => {
          const isExpanded = expandedConcepts.has(concept.name);
          const enriched = enrichedData[concept.name];
          const isEnriching = enrichingConcept === concept.name;

          return (
            <TouchableOpacity
              key={concept.name + index}
              style={[styles.conceptCard, { backgroundColor: colors.bgElevated }]}
              onPress={() => toggleConceptExpanded(concept.name)}
              activeOpacity={0.8}
            >
              {/* Concept header */}
              <View style={styles.conceptHeader}>
                <View style={styles.conceptTitleRow}>
                  {concept.importance && (
                    <View
                      style={[
                        styles.importanceDot,
                        { backgroundColor: getImportanceColor(concept.importance) },
                      ]}
                    />
                  )}
                  <Text style={[styles.conceptName, { color: colors.accentPrimary }]}>
                    {concept.name}
                  </Text>
                </View>
                <View style={styles.conceptActions}>
                  {concept.category && (
                    <View style={[styles.categoryBadge, { backgroundColor: colors.bgTertiary }]}>
                      <Text style={[styles.categoryText, { color: colors.textTertiary }]}>
                        {concept.category}
                      </Text>
                    </View>
                  )}
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textTertiary}
                  />
                </View>
              </View>

              {/* Definition */}
              <Text
                style={[styles.definition, { color: colors.textSecondary }]}
                numberOfLines={isExpanded ? undefined : 2}
              >
                {enriched?.extendedDefinition || concept.definition}
              </Text>

              {/* Expanded content */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {/* Action buttons row */}
                  <View style={styles.actionButtonsRow}>
                    {/* Wikipedia button */}
                    <TouchableOpacity
                      style={[styles.enrichButton, { backgroundColor: `${colors.textSecondary}15`, flex: 1 }]}
                      onPress={() => openWikipedia(concept.name)}
                    >
                      <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.enrichButtonText, { color: colors.textSecondary }]}>
                        Wikipedia
                      </Text>
                    </TouchableOpacity>

                    {/* Web enrichment button */}
                    {summaryId && !enriched && (
                      <TouchableOpacity
                        style={[styles.enrichButton, { backgroundColor: `${colors.accentInfo}15`, flex: 1 }]}
                        onPress={() => enrichConcept(concept)}
                        disabled={isEnriching}
                      >
                        {isEnriching ? (
                          <ActivityIndicator size="small" color={colors.accentInfo} />
                        ) : (
                          <>
                            <Ionicons name="globe-outline" size={16} color={colors.accentInfo} />
                            <Text style={[styles.enrichButtonText, { color: colors.accentInfo }]}>
                              {language === 'fr' ? 'Enrichir' : 'Enrich'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Related concepts */}
                  {((concept.relatedConcepts || enriched?.relatedConcepts)?.length ?? 0) > 0 && (
                    <View style={styles.relatedSection}>
                      <Text style={[styles.relatedTitle, { color: colors.textTertiary }]}>
                        {language === 'fr' ? 'Concepts liés:' : 'Related concepts:'}
                      </Text>
                      <View style={styles.relatedTags}>
                        {(concept.relatedConcepts || enriched?.relatedConcepts || []).map((related, ri) => (
                          <TouchableOpacity
                            key={ri}
                            style={[styles.relatedTag, { backgroundColor: `${colors.accentPrimary}15` }]}
                            onPress={() => handleRelatedConceptPress(related)}
                          >
                            <Text style={[styles.relatedTagText, { color: colors.accentPrimary }]}>
                              {related}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Sources */}
                  {((concept.sources || enriched?.sources)?.length ?? 0) > 0 && (
                    <View style={styles.sourcesSection}>
                      <Text style={[styles.sourcesTitle, { color: colors.textTertiary }]}>
                        {language === 'fr' ? 'Sources:' : 'Sources:'}
                      </Text>
                      {(concept.sources || enriched?.sources || []).slice(0, 3).map((source, si) => (
                        <TouchableOpacity
                          key={si}
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
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Show more button */}
      {maxVisible && filteredConcepts.length > maxVisible && !showAll && (
        <TouchableOpacity
          style={[styles.showMoreButton, { borderColor: colors.border }]}
          onPress={() => setShowAll(true)}
        >
          <Text style={[styles.showMoreText, { color: colors.accentPrimary }]}>
            {language === 'fr'
              ? `Voir ${filteredConcepts.length - maxVisible} concepts de plus`
              : `Show ${filteredConcepts.length - maxVisible} more concepts`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.accentPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  countText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    padding: 0,
  },
  conceptsList: {
    gap: Spacing.sm,
  },
  conceptCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  conceptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  conceptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  importanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  conceptName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    flex: 1,
  },
  conceptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  definition: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  enrichButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  enrichButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  relatedSection: {
    marginBottom: Spacing.md,
  },
  relatedTitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.xs,
  },
  relatedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  relatedTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  relatedTagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  sourcesSection: {
    marginTop: Spacing.sm,
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
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  showMoreText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default ConceptsGlossary;
