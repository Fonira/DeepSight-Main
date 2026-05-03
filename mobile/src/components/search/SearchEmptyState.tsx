/**
 * SearchEmptyState — Vue affichée quand le tab Search est ouvert mais sans
 * query. Propose les recherches récentes (chips cliquables).
 */

import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { useRecentQueries } from "./useRecentQueries";

interface SearchEmptyStateProps {
  onSelectQuery: (q: string) => void;
}

export const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({
  onSelectQuery,
}) => {
  const { colors } = useTheme();
  const { queries, clear } = useRecentQueries();

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Ionicons name="sparkles-outline" size={42} color={palette.gold} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Cherche ce que tu veux dans tes analyses
      </Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Synthèses, flashcards, quiz, chats, transcripts — tout est indexé
      </Text>

      {queries.length > 0 && (
        <>
          <View style={styles.headerRow}>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              Recherches récentes
            </Text>
            <Pressable
              onPress={clear}
              hitSlop={8}
              accessibilityLabel="Effacer l'historique des recherches"
              accessibilityRole="button"
            >
              <Text style={[styles.clearText, { color: colors.textTertiary }]}>
                Effacer
              </Text>
            </Pressable>
          </View>
          <View style={styles.chipsRow}>
            {queries.map((q) => (
              <Pressable
                key={q}
                onPress={() => onSelectQuery(q)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.glassBg,
                    borderColor: colors.glassBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Relancer la recherche : ${q}`}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.textTertiary}
                />
                <Text
                  style={[styles.chipText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: sp.xl, alignItems: "center" },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    textAlign: "center",
    marginTop: sp.md,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: sp.xs,
    maxWidth: 320,
  },
  headerRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: sp["3xl"],
  },
  section: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  clearText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp.sm,
    marginTop: sp.md,
    width: "100%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: "48%",
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});
