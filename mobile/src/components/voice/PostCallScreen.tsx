/**
 * PostCallScreen — Quick Voice Call mobile V3
 *
 * Modal post-hangup affichant :
 *   - Titre vidéo + durée + chaîne
 *   - Banner upgrade si quota épuisé (rouge)
 *   - Transcript de la conversation (FlashList)
 *   - 2 CTA : "Voir l'analyse complète →" (primaire, gold) + "Appeler une autre vidéo" (secondaire)
 */

import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette } from "../../theme/colors";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { shadows } from "../../theme/shadows";

interface VoiceMessage {
  text: string;
  source: "user" | "ai";
}

interface PostCallScreenProps {
  visible: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  summaryId?: number;
  durationSeconds: number;
  messages: VoiceMessage[];
  /** Minutes restantes — 0 → bandeau upgrade visible. */
  quotaRemaining: number;
  onViewAnalysis: (summaryId: number) => void;
  onCallAnother: () => void;
}

const formatTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
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
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    presentationStyle="formSheet"
    onRequestClose={onClose}
  >
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={28} color={palette.textPrimary} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerLabel}>✓ Appel terminé</Text>
        <Text style={styles.title}>{videoTitle}</Text>
        <Text style={styles.subtitle}>
          {channelName ? `${channelName} · ` : ""}
          {formatTime(durationSeconds)}
        </Text>
      </View>

      {quotaRemaining === 0 && (
        <View style={styles.upgradeBanner}>
          <Text style={styles.upgradeText}>
            ⚠ Quota voice épuisé · Passe en Pro pour continuer
          </Text>
        </View>
      )}

      <View style={styles.transcriptSection}>
        <Text style={styles.sectionLabel}>TRANSCRIPT</Text>
        <FlashList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.source === "user" ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text style={styles.bubbleAuthor}>
                {item.source === "user" ? "Toi" : "Agent"}
              </Text>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          )}
        />
      </View>

      <View style={styles.ctaSection}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryCta,
            pressed && { opacity: 0.85 },
            !summaryId && styles.ctaDisabled,
          ]}
          onPress={() => summaryId && onViewAnalysis(summaryId)}
          disabled={!summaryId}
        >
          <LinearGradient
            colors={[palette.gold, "#d97706"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.primaryCtaText}>Voir l&apos;analyse complète →</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryCta,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onCallAnother}
        >
          <Text style={styles.secondaryCtaText}>Appeler une autre vidéo</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
    padding: sp.lg,
    paddingTop: Platform.OS === "ios" ? sp["3xl"] : sp.lg,
  },
  closeBtn: {
    alignSelf: "flex-end",
    padding: sp.sm,
  },
  header: {
    marginTop: sp.lg,
    marginBottom: sp["2xl"],
  },
  headerLabel: {
    fontSize: fontSize.sm,
    color: palette.gold,
    fontFamily: fontFamily.bodySemiBold,
    marginBottom: sp.sm,
  },
  title: {
    fontSize: fontSize.xl,
    color: palette.textPrimary,
    fontFamily: fontFamily.bodyBold,
    marginBottom: sp.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
  },
  upgradeBanner: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    padding: sp.md,
    borderRadius: borderRadius.md,
    marginBottom: sp.lg,
  },
  upgradeText: {
    color: "#fca5a5",
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  transcriptSection: {
    flex: 1,
    marginBottom: sp.lg,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontFamily: fontFamily.bodySemiBold,
    letterSpacing: 1,
    marginBottom: sp.sm,
  },
  bubble: {
    padding: sp.md,
    borderRadius: borderRadius.md,
    marginBottom: sp.sm,
  },
  userBubble: {
    backgroundColor: "rgba(99,102,241,0.12)",
    alignSelf: "flex-end",
    maxWidth: "85%",
  },
  aiBubble: {
    backgroundColor: "rgba(255,255,255,0.04)",
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  bubbleAuthor: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: sp.xs,
  },
  bubbleText: {
    fontSize: fontSize.base,
    color: palette.textPrimary,
    lineHeight: 22,
  },
  ctaSection: {
    gap: sp.md,
  },
  primaryCta: {
    paddingVertical: sp.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.glow(palette.gold),
  },
  primaryCtaText: {
    color: palette.white,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bodyBold,
  },
  secondaryCta: {
    paddingVertical: sp.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  secondaryCtaText: {
    color: palette.textPrimary,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bodyMedium,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
});
