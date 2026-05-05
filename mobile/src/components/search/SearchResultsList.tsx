/**
 * SearchResultsList — FlashList virtualisée des résultats de recherche.
 *
 * États :
 *   - isLoading=true → spinner + texte "Recherche en cours..."
 *   - error !== null → ErrorState avec icône cloud-offline
 *   - results.length === 0 && query !== "" → "Aucun résultat" + suggestion
 *   - results.length > 0 → FlashList
 */

import React, { useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { sp } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { SearchResultCard } from "./SearchResultCard";
import type { GlobalSearchResultItem } from "@/services/api";

interface SearchResultsListProps {
  results: GlobalSearchResultItem[];
  isLoading: boolean;
  error: Error | null;
  bottomPadding: number;
  query: string;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  isLoading,
  error,
  bottomPadding,
  query,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = useCallback(
    (item: GlobalSearchResultItem) => {
      const summaryId = item.summary_id ?? item.source_id;
      const tab = item.source_metadata.tab ?? "synthesis";

      // Flashcards/quiz vivent dans l'onglet Étude, pas dans l'écran d'analyse
      // (TAB_LABELS = Résumé/Sources/Chat). Route vers le bon écran sans passer
      // par l'analyse plein écran qui n'a pas de tab adapté.
      if (tab === "flashcards" || tab === "quiz") {
        router.push({
          pathname: "/(tabs)/study",
          params: { summaryId: String(summaryId) },
        } as never);
        return;
      }

      // synthesis/digest/transcript → tab Résumé (index 0)
      // chat → tab Chat (index 2)
      const initialTab = tab === "chat" ? "2" : "0";

      router.push({
        pathname: "/(tabs)/analysis/[id]",
        params: {
          id: String(summaryId),
          q: query,
          highlight: String(item.source_id),
          initialTab,
          backTo: "search",
        },
      } as never);
    },
    [router, query],
  );

  const renderItem = useCallback(
    ({ item }: { item: GlobalSearchResultItem }) => (
      <SearchResultCard
        item={item}
        onPress={() => handlePress(item)}
        query={query}
      />
    ),
    [handlePress, query],
  );

  const keyExtractor = useCallback(
    (item: GlobalSearchResultItem) => `${item.source_type}-${item.source_id}`,
    [],
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.gold} size="large" />
        <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
          Recherche en cours…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="cloud-offline-outline"
          size={42}
          color={colors.textTertiary}
        />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Recherche indisponible — vérifie ta connexion
        </Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="search-outline" size={42} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Aucun résultat pour « {query} »
        </Text>
        <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
          Essaie d'autres mots-clés ou élargis tes filtres
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={results}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={{
        paddingHorizontal: sp.lg,
        paddingTop: sp.md,
        paddingBottom: bottomPadding,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: sp.xl,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: sp.md,
  },
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    textAlign: "center",
    marginTop: sp.md,
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    textAlign: "center",
    marginTop: sp.md,
  },
  emptyHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: sp.xs,
  },
});
