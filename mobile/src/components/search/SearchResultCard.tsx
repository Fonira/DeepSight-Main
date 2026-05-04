/**
 * SearchResultCard — Carte individuelle d'un résultat de recherche.
 *
 * Affiche : badge type (SYNTHESE/FLASHCARD/QUIZ/CHAT/TRANSCRIPT), titre du
 * summary parent, score (%), et un text_preview avec mise en évidence
 * substring du `query`. Tap → onPress (le parent gère la navigation).
 */

import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { GlobalSearchResultItem } from "@/services/api";

const TYPE_META: Record<
  GlobalSearchResultItem["source_type"],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  summary: {
    label: "SYNTHESE",
    color: palette.indigo,
    icon: "document-text-outline",
  },
  flashcard: {
    label: "FLASHCARD",
    color: palette.green,
    icon: "albums-outline",
  },
  quiz: {
    label: "QUIZ",
    color: palette.violet,
    icon: "help-circle-outline",
  },
  chat: {
    label: "CHAT",
    color: palette.cyan,
    icon: "chatbubble-outline",
  },
  transcript: {
    label: "TRANSCRIPT",
    color: palette.amber,
    icon: "mic-outline",
  },
};

interface SearchResultCardProps {
  item: GlobalSearchResultItem;
  onPress: () => void;
  query: string;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  item,
  onPress,
  query,
}) => {
  const { colors } = useTheme();
  const meta = TYPE_META[item.source_type];

  const previewParts = useMemo(() => {
    const q = query.trim();
    if (!q) return [{ text: item.text_preview, match: false }];
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "ig");
    return item.text_preview.split(regex).map((part) => ({
      text: part,
      match: part.toLowerCase() === q.toLowerCase(),
    }));
  }, [item.text_preview, query]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityLabel={`Résultat de recherche : ${meta.label} — ${
        item.source_metadata.summary_title ?? "Sans titre"
      }`}
      accessibilityRole="button"
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: meta.color + "20",
              borderColor: meta.color,
            },
          ]}
        >
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>
            {meta.label}
          </Text>
        </View>
        <Text style={[styles.score, { color: colors.textTertiary }]}>
          {Math.round(item.score * 100)}%
        </Text>
      </View>

      {item.source_metadata.summary_title && (
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.source_metadata.summary_title}
        </Text>
      )}

      <Text
        style={[styles.preview, { color: colors.textSecondary }]}
        numberOfLines={3}
      >
        {previewParts.map((p, i) => (
          <Text
            key={i}
            style={
              p.match
                ? {
                    backgroundColor: palette.gold + "40",
                    color: colors.textPrimary,
                  }
                : undefined
            }
          >
            {p.text}
          </Text>
        ))}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: sp.md,
    marginBottom: sp.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: sp.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xs"],
    letterSpacing: 0.4,
  },
  score: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    marginBottom: sp.xs,
  },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
