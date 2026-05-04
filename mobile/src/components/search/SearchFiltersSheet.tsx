/**
 * SearchFiltersSheet — BottomSheet de filtres avancés.
 *
 * V1 mobile (medium tier) : 3 sections seulement
 *   - Source types (pills multi-select)
 *   - Plateforme (youtube/tiktok/all)
 *   - Favoris uniquement (switch)
 *
 * V1.1 reporté : langue, catégorie, période, playlist.
 */

import React, { forwardRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  SimpleBottomSheet,
  type SimpleBottomSheetRef,
} from "../ui/SimpleBottomSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { GlobalSearchRequest, SearchSourceType } from "@/services/api";

const ALL_SOURCE_TYPES: SearchSourceType[] = [
  "summary",
  "flashcard",
  "quiz",
  "chat",
  "transcript",
];

const SOURCE_LABELS: Record<SearchSourceType, string> = {
  summary: "Synthèses",
  flashcard: "Flashcards",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcripts",
};

interface SearchFiltersSheetProps {
  filters: Partial<GlobalSearchRequest>;
  onChange: (next: Partial<GlobalSearchRequest>) => void;
  onClose: () => void;
}

export const SearchFiltersSheet = forwardRef<
  SimpleBottomSheetRef,
  SearchFiltersSheetProps
>(({ filters, onChange, onClose }, ref) => {
  const { colors } = useTheme();

  const toggleSourceType = useCallback(
    (t: SearchSourceType) => {
      const current = filters.source_types ?? ALL_SOURCE_TYPES;
      const next = current.includes(t)
        ? current.filter((x) => x !== t)
        : [...current, t];
      onChange({
        ...filters,
        source_types: next.length > 0 ? next : undefined,
      });
    },
    [filters, onChange],
  );

  const setPlatform = useCallback(
    (p: GlobalSearchRequest["platform"] | undefined) => {
      onChange({ ...filters, platform: p });
    },
    [filters, onChange],
  );

  const toggleFavorites = useCallback(
    (v: boolean) => onChange({ ...filters, favorites_only: v }),
    [filters, onChange],
  );

  const platformOptions: Array<{
    v: GlobalSearchRequest["platform"] | undefined;
    label: string;
  }> = [
    { v: undefined, label: "Toutes" },
    { v: "youtube", label: "YouTube" },
    { v: "tiktok", label: "TikTok" },
  ];

  return (
    <SimpleBottomSheet
      ref={ref}
      snapPoint="60%"
      backgroundStyle={{ backgroundColor: colors.bgPrimary }}
      handleIndicatorStyle={{ backgroundColor: colors.borderLight }}
      onClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Filtres
        </Text>

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Type de contenu
        </Text>
        <View style={styles.pillRow}>
          {ALL_SOURCE_TYPES.map((t) => {
            const active = (filters.source_types ?? ALL_SOURCE_TYPES).includes(
              t,
            );
            return (
              <Pressable
                key={t}
                onPress={() => toggleSourceType(t)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active
                      ? palette.gold + "20"
                      : colors.glassBg,
                    borderColor: active ? palette.gold : colors.glassBorder,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={SOURCE_LABELS[t]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: active ? palette.gold : colors.textTertiary },
                  ]}
                >
                  {SOURCE_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Plateforme
        </Text>
        <View style={styles.pillRow}>
          {platformOptions.map((opt) => {
            const active = filters.platform === opt.v;
            return (
              <Pressable
                key={opt.label}
                onPress={() => setPlatform(opt.v)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: active
                      ? palette.indigo + "20"
                      : colors.glassBg,
                    borderColor: active
                      ? palette.indigo
                      : colors.glassBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Plateforme ${opt.label}`}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: active ? palette.indigo : colors.textTertiary,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            Favoris uniquement
          </Text>
          <Switch
            value={filters.favorites_only ?? false}
            onValueChange={toggleFavorites}
            trackColor={{ false: colors.glassBg, true: palette.gold }}
          />
        </View>
      </ScrollView>
    </SimpleBottomSheet>
  );
});

SearchFiltersSheet.displayName = "SearchFiltersSheet";

const styles = StyleSheet.create({
  content: { padding: sp.lg, gap: sp.md },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.sm,
  },
  section: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginTop: sp.md,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: sp.sm },
  pill: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: sp.lg,
  },
  rowLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
});
