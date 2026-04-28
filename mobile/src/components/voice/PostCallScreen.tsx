/**
 * PostCallScreen — Modal post-hangup pour Quick Voice Call mobile V3.
 *
 * Affiché quand `voiceStatus === "idle"` ET `messages.length > 0`. Contient :
 * - Transcript de l'appel (FlatList scrollable, bulles user/agent)
 * - CTA primaire "Voir l'analyse complète" → push /analysis/[summaryId]
 * - CTA secondaire "Appeler une autre vidéo" → reset state + retour Home
 * - Banner upgrade gradient rouge si quotaRemaining === 0
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";

interface VoiceMessage {
  text: string;
  source: "user" | "ai";
}

interface PostCallScreenProps {
  visible: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  /** ID du Summary (placeholder créé en mode V3 par le backend). */
  summaryId?: number | null;
  durationSeconds: number;
  messages: VoiceMessage[];
  /** Minutes restantes du quota voice. Si 0, affiche le banner upgrade. */
  quotaRemaining: number;
  onViewAnalysis: (summaryId: number) => void;
  onCallAnother: () => void;
}

const formatDuration = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const PostCallScreen: React.FC<PostCallScreenProps> = ({
  visible,
  onClose,
  videoTitle,
  channelName,
  summaryId,
  durationSeconds,
  messages,
  quotaRemaining,
  onViewAnalysis,
  onCallAnother,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleViewAnalysis = useCallback(() => {
    if (summaryId) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onViewAnalysis(summaryId);
    }
  }, [summaryId, onViewAnalysis]);

  const handleCallAnother = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onCallAnother();
  }, [onCallAnother]);

  const renderMessage = useCallback(
    ({ item }: { item: VoiceMessage }) => (
      <View
        style={[
          styles.bubble,
          item.source === "user"
            ? [
                styles.userBubble,
                { backgroundColor: "rgba(200,144,58,0.12)" },
              ]
            : [
                styles.aiBubble,
                { backgroundColor: colors.bgTertiary },
              ],
        ]}
      >
        <Text
          style={[styles.bubbleAuthor, { color: colors.textTertiary }]}
        >
          {item.source === "user" ? "Toi" : "Agent"}
        </Text>
        <Text style={[styles.bubbleText, { color: colors.textPrimary }]}>
          {item.text}
        </Text>
      </View>
    ),
    [colors],
  );

  const keyExtractor = useCallback(
    (_: VoiceMessage, i: number) => String(i),
    [],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bgPrimary,
            paddingTop: insets.top + sp.md,
            paddingBottom: insets.bottom + sp.md,
          },
        ]}
      >
        {/* Close button */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: colors.bgTertiary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Header info */}
        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: palette.gold }]}>
            ✓ Appel terminé
          </Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {videoTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            {channelName ? `${channelName} · ` : ""}
            {formatDuration(durationSeconds)}
          </Text>
        </View>

        {/* Upgrade banner si quota épuisé */}
        {quotaRemaining === 0 ? (
          <View style={styles.upgradeBanner}>
            <Text style={styles.upgradeText}>
              ⚠ Quota voice épuisé · Passe en Pro pour continuer
            </Text>
          </View>
        ) : null}

        {/* Transcript */}
        <View style={styles.transcriptSection}>
          <Text
            style={[styles.sectionLabel, { color: colors.textTertiary }]}
          >
            TRANSCRIPT
          </Text>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* CTAs */}
        <View style={styles.ctaSection}>
          <Pressable
            onPress={handleViewAnalysis}
            disabled={!summaryId}
            style={({ pressed }) => [
              styles.primaryCta,
              {
                backgroundColor: palette.gold,
                opacity: !summaryId ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Voir l'analyse complète"
          >
            <Text style={[styles.primaryCtaText, { color: palette.white }]}>
              Voir l'analyse complète →
            </Text>
          </Pressable>
          <Pressable
            onPress={handleCallAnother}
            style={({ pressed }) => [
              styles.secondaryCta,
              {
                backgroundColor: colors.bgTertiary,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Appeler une autre vidéo"
          >
            <Text
              style={[styles.secondaryCtaText, { color: colors.textPrimary }]}
            >
              Appeler une autre vidéo
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: sp.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    marginTop: sp.md,
    marginBottom: sp.lg,
  },
  headerLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    marginBottom: sp.sm,
  },
  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xl,
    marginBottom: sp.xs,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  upgradeBanner: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.30)",
    borderWidth: 1,
    padding: sp.md,
    borderRadius: borderRadius.md,
    marginBottom: sp.md,
  },
  upgradeText: {
    color: "#fca5a5",
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  transcriptSection: {
    flex: 1,
    marginBottom: sp.md,
  },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    marginBottom: sp.sm,
  },
  bubble: {
    padding: sp.md,
    borderRadius: borderRadius.md,
    marginBottom: sp.sm,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
  },
  aiBubble: {
    alignSelf: "flex-start",
  },
  bubbleAuthor: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.xs,
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  ctaSection: {
    gap: sp.sm,
  },
  primaryCta: {
    paddingVertical: sp.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  secondaryCta: {
    paddingVertical: sp.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryCtaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
});
