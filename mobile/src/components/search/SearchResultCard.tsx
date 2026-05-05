/**
 * SearchResultCard — Carte d'un résultat de recherche sémantique globale.
 *
 * Layout (mirror web SearchResultCard) :
 *   [thumb] | [badge + score] [chevron]
 *           | [title]
 *           | [channel]
 *           | [text_preview avec mark sur la query]
 *
 * Le `text_preview` est volontairement tronqué côté backend (~200 chars),
 * il ne contient JAMAIS le transcript complet — juste le passage matché.
 */

import React, { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
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

function formatTimestamp(seconds: number | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  item,
  onPress,
  query,
}) => {
  const { colors } = useTheme();
  const meta = TYPE_META[item.source_type];
  const md = item.source_metadata;

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

  const title = md.summary_title ?? "Analyse sans titre";
  const channel = md.channel ?? null;
  const thumb = md.summary_thumbnail ?? null;
  const tsLabel =
    item.source_type === "transcript" ? formatTimestamp(md.start_ts) : null;

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
      accessibilityLabel={`Résultat de recherche : ${meta.label} — ${title}`}
      accessibilityRole="button"
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbPlaceholder,
            { backgroundColor: colors.glassBg },
          ]}
        >
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
      )}

      <View style={styles.body}>
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
            <Ionicons name={meta.icon} size={11} color={meta.color} />
            <Text style={[styles.badgeText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
          {tsLabel && (
            <Text
              style={[styles.timestamp, { color: colors.textTertiary }]}
              accessibilityLabel={`À ${tsLabel}`}
            >
              {tsLabel}
            </Text>
          )}
          <Text style={[styles.score, { color: colors.textTertiary }]}>
            {Math.round(item.score * 100)}%
          </Text>
        </View>

        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {channel && (
          <Text
            style={[styles.channel, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {channel}
          </Text>
        )}

        <Text
          style={[styles.preview, { color: colors.textSecondary }]}
          numberOfLines={2}
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
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textTertiary}
        style={styles.chevron}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: sp.md,
    marginBottom: sp.md,
  },
  thumb: {
    width: 96,
    height: 64,
    borderRadius: borderRadius.sm,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.xs,
    flexWrap: "wrap",
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
  timestamp: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize["2xs"],
  },
  score: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize["2xs"],
    marginLeft: "auto",
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  channel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.xs,
  },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  chevron: {
    alignSelf: "center",
  },
});
