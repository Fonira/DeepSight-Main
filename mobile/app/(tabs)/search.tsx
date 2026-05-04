/**
 * mobile/app/(tabs)/search.tsx
 *
 * Tab Search — recherche sémantique globale dans tout le contenu personnel
 * du user (synthèses, flashcards, quiz, chat, transcripts).
 *
 * Spec : `docs/superpowers/specs/2026-05-03-semantic-search-design.md` §5
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useTabBarFootprint } from "@/hooks/useTabBarFootprint";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize, textStyles } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import {
  type SimpleBottomSheetRef,
} from "@/components/ui/SimpleBottomSheet";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResultsList } from "@/components/search/SearchResultsList";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { SearchFiltersSheet } from "@/components/search/SearchFiltersSheet";
import { useSemanticSearch } from "@/components/search/useSemanticSearch";
import { useRecentQueries } from "@/components/search/useRecentQueries";
import type { GlobalSearchRequest } from "@/services/api";

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarFootprint = useTabBarFootprint();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Partial<GlobalSearchRequest>>({});
  const { data, isLoading, error } = useSemanticSearch(query, filters);
  const recent = useRecentQueries();

  const filtersSheetRef = useRef<SimpleBottomSheetRef>(null);

  const handleQueryChange = useCallback((q: string) => setQuery(q), []);

  const handleOpenFilters = useCallback(() => {
    filtersSheetRef.current?.snapToIndex(0);
  }, []);

  // Persister la recherche aboutie dans recent queries
  useEffect(() => {
    if (!data) return;
    if (query.trim().length < 2) return;
    void recent.push(query);
    // On veut déclencher uniquement quand `data` change (résultat reçu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const filterCount = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== null && v !== false,
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="default" density="low" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Rechercher
          </Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            Dans tes analyses, flashcards, quiz et chats
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
          />
          <Pressable
            onPress={handleOpenFilters}
            style={[
              styles.filterButton,
              {
                backgroundColor: colors.glassBg,
                borderColor:
                  filterCount > 0 ? palette.gold : colors.glassBorder,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              filterCount > 0
                ? `Filtres actifs (${filterCount})`
                : "Ouvrir les filtres"
            }
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={filterCount > 0 ? palette.gold : colors.textTertiary}
            />
            <Text
              style={[
                styles.filterText,
                {
                  color: filterCount > 0 ? palette.gold : colors.textTertiary,
                },
              ]}
            >
              Filtres{filterCount > 0 ? ` (${filterCount})` : ""}
            </Text>
          </Pressable>
        </View>

        {!query.trim() ? (
          <SearchEmptyState onSelectQuery={handleQueryChange} />
        ) : (
          <SearchResultsList
            results={data?.results ?? []}
            isLoading={isLoading}
            error={error}
            bottomPadding={tabBarFootprint}
            query={query}
          />
        )}
      </KeyboardAvoidingView>

      <SearchFiltersSheet
        ref={filtersSheetRef}
        filters={filters}
        onChange={setFilters}
        onClose={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
  },
  title: { ...textStyles.headingLg },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  searchWrap: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
    flexDirection: "row",
    gap: sp.sm,
    alignItems: "center",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: sp.md,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  filterText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
});
