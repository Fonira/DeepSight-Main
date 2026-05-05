/**
 * PassageActionSheet — BottomSheet d'actions sur un passage surligné mobile.
 *
 * 3 actions tap-friendly (pas de tooltip IA mobile, cf. spec §5.3) :
 *   1. Demander à l'IA → naviguer vers Hub avec prefillQuery
 *   2. Sauter timecode → si metadata.start_ts présent
 *   3. Voir dans <Tab> → naviguer vers le tab d'origine du match
 */

import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  SimpleBottomSheet,
  type SimpleBottomSheetRef,
} from "../ui/SimpleBottomSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { WithinMatchItem } from "@/services/api";

interface PassageActionSheetProps {
  match: WithinMatchItem | null;
  query: string;
  summaryId: number;
  isOpen: boolean;
  onClose: () => void;
}

const TAB_LABELS_FR: Record<WithinMatchItem["tab"], string> = {
  synthesis: "Synthèse",
  digest: "Synthèse",
  flashcards: "Flashcards",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcript",
};

export const PassageActionSheet: React.FC<PassageActionSheetProps> = ({
  match,
  summaryId,
  isOpen,
  onClose,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const sheetRef = useRef<SimpleBottomSheetRef>(null);

  useEffect(() => {
    if (isOpen && match) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen, match]);

  const handleAskAI = useCallback(() => {
    if (!match) return;
    router.push({
      pathname: "/(tabs)/hub",
      params: {
        summaryId: String(summaryId),
        prefillQuery: `Explique-moi ce passage : ${match.text}`,
        initialMode: "chat",
      },
    } as never);
    onClose();
  }, [match, router, summaryId, onClose]);

  const handleSeekTimecode = useCallback(() => {
    if (!match) return;
    const start = match.metadata.start_ts;
    if (typeof start !== "number") return;
    // V1 mobile : on déclenche via fermeture du sheet ; le seek est délégué
    // à l'AudioSummaryPlayer/VideoPlayer parent qui devra écouter
    // `activePassageId` (V1.1 — pour V1 le sheet se ferme simplement).
    onClose();
  }, [match, onClose]);

  const handleViewInTab = useCallback(() => {
    if (!match) return;
    if (match.tab === "chat") {
      router.push({
        pathname: "/(tabs)/hub",
        params: { summaryId: String(summaryId), initialMode: "chat" },
      } as never);
    } else if (match.tab === "flashcards" || match.tab === "quiz") {
      router.push({
        pathname: "/(tabs)/study",
        params: { summaryId: String(summaryId) },
      } as never);
    }
    // synthesis/digest/transcript = tab Résumé déjà actif → on ferme juste.
    onClose();
  }, [match, router, summaryId, onClose]);

  if (!match) return null;
  const startTs = match.metadata.start_ts;
  const hasTimecode = typeof startTs === "number";
  const tabLabel = TAB_LABELS_FR[match.tab];

  return (
    <SimpleBottomSheet
      ref={sheetRef}
      snapPoint="38%"
      backgroundStyle={{ backgroundColor: colors.bgPrimary }}
      handleIndicatorStyle={{ backgroundColor: colors.borderLight }}
      onClose={onClose}
    >
      <View style={[styles.content, { backgroundColor: colors.bgPrimary }]}>
        <Text
          style={[styles.preview, { color: colors.textTertiary }]}
          numberOfLines={3}
        >
          “{match.text}”
        </Text>

        <Pressable
          style={[
            styles.action,
            {
              backgroundColor: palette.gold + "15",
              borderColor: palette.gold,
            },
          ]}
          onPress={handleAskAI}
          accessibilityLabel="Demander à l'IA d'expliquer ce passage"
          accessibilityRole="button"
        >
          <Ionicons name="sparkles-outline" size={20} color={palette.gold} />
          <Text style={[styles.actionText, { color: palette.gold }]}>
            Demander à l'IA
          </Text>
        </Pressable>

        {hasTimecode && (
          <Pressable
            style={[
              styles.action,
              {
                backgroundColor: colors.glassBg,
                borderColor: colors.glassBorder,
              },
            ]}
            onPress={handleSeekTimecode}
            accessibilityLabel="Sauter au timecode"
            accessibilityRole="button"
          >
            <Ionicons
              name="play-circle-outline"
              size={20}
              color={colors.textPrimary}
            />
            <Text
              style={[styles.actionText, { color: colors.textPrimary }]}
            >
              Sauter au timecode {Math.floor((startTs as number) / 60)}:
              {String(
                Math.floor((startTs as number) % 60),
              ).padStart(2, "0")}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.action,
            {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
            },
          ]}
          onPress={handleViewInTab}
          accessibilityLabel={`Voir dans ${tabLabel}`}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-forward-circle-outline"
            size={20}
            color={colors.textPrimary}
          />
          <Text style={[styles.actionText, { color: colors.textPrimary }]}>
            Voir dans {tabLabel}
          </Text>
        </Pressable>
      </View>
    </SimpleBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: { padding: sp.lg, gap: sp.md },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    fontStyle: "italic",
    lineHeight: 20,
    marginBottom: sp.sm,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    flex: 1,
  },
});
