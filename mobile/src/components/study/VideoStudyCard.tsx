/**
 * VideoStudyCard - Carte vidéo pour le Study Hub
 * Thumbnail, titre, boutons Flashcards/Quiz, badge score
 */

import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ThumbnailImage } from "../ui/ThumbnailImage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { PlatformBadge, detectPlatformFromUrl } from "../ui/PlatformBadge";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import type { AnalysisSummary } from "../../types";
import type { StudyProgress } from "../../types/v2";

interface VideoStudyCardProps {
  summary: AnalysisSummary;
  progress?: StudyProgress;
  onFlashcards: () => void;
  onQuiz: () => void;
  onAnalysis?: () => void; // Ouvre l'analyse (onglet Résumé)
  onChatIA?: () => void; // Ouvre l'analyse (onglet Chat)
  locked?: boolean;
  onLockedPress?: () => void;
}

const getScoreBadge = (
  progress: StudyProgress,
): { label: string; variant: "success" | "warning" | "error" } => {
  const score =
    progress.quizTotal > 0
      ? Math.round((progress.quizScore / progress.quizTotal) * 100)
      : progress.flashcardsTotal > 0
        ? Math.round(
            (progress.flashcardsCompleted / progress.flashcardsTotal) * 100,
          )
        : 0;

  if (score >= 70) return { label: `${score}%`, variant: "success" };
  if (score >= 40) return { label: `${score}%`, variant: "warning" };
  return { label: `${score}%`, variant: "error" };
};

const VideoStudyCardComponent: React.FC<VideoStudyCardProps> = ({
  summary,
  progress,
  onFlashcards,
  onQuiz,
  onAnalysis,
  onChatIA,
  locked = false,
  onLockedPress,
}) => {
  const { colors } = useTheme();
  const hasProgress =
    progress && (progress.quizTotal > 0 || progress.flashcardsTotal > 0);

  const handlePress = useCallback(
    (action: () => void) => {
      if (locked) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onLockedPress?.();
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      action();
    },
    [locked, onLockedPress],
  );

  return (
    <Card variant="glass" padding="none" style={styles.card}>
      {/* Thumbnail — pressable → ouvre l'analyse */}
      <Pressable
        style={styles.thumbnailContainer}
        onPress={() => handlePress(onAnalysis ?? (() => {}))}
        accessibilityLabel={`Voir l'analyse de ${summary.title}`}
        accessibilityRole="button"
      >
        <ThumbnailImage
          uri={summary.thumbnail}
          videoId={summary.videoId}
          style={styles.thumbnail}
        />
        {/* Score badge */}
        <View style={styles.badgeContainer}>
          {hasProgress ? (
            <Badge {...getScoreBadge(progress)} size="sm" />
          ) : (
            <Badge label="Nouveau" variant="primary" size="sm" />
          )}
        </View>
        {/* Platform badge — icon only, overlay */}
        <View style={styles.platformBadgeContainer}>
          <PlatformBadge
            platform={
              summary.platform ||
              detectPlatformFromUrl(summary.video_url, summary.videoId)
            }
            size="xs"
            showLabel={false}
            overlay
          />
        </View>
        {/* Play overlay — indique que c'est cliquable */}
        {!locked && (
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="eye-outline" size={16} color="#fff" />
            </View>
          </View>
        )}
        {/* Lock overlay */}
        {locked && (
          <View
            style={[styles.lockOverlay, { backgroundColor: colors.overlay }]}
          >
            <Ionicons name="lock-closed" size={24} color={colors.textPrimary} />
          </View>
        )}
      </Pressable>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {summary.title}
        </Text>

        {/* Action buttons */}
        <Pressable
          style={[
            styles.actionBtn,
            { backgroundColor: `${colors.accentSecondary}15` },
          ]}
          onPress={() => handlePress(onFlashcards)}
          accessibilityLabel="Flashcards"
        >
          <Ionicons
            name="albums-outline"
            size={16}
            color={colors.accentSecondary}
          />
          <Text style={[styles.actionText, { color: colors.accentSecondary }]}>
            Flashcards
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.actionBtn,
            { backgroundColor: `${colors.accentPrimary}15` },
          ]}
          onPress={() => handlePress(onQuiz)}
          accessibilityLabel="Quiz"
        >
          <Ionicons
            name="help-circle-outline"
            size={16}
            color={colors.accentPrimary}
          />
          <Text style={[styles.actionText, { color: colors.accentPrimary }]}>
            Quiz
          </Text>
        </Pressable>

        {/* Chat IA — ouvre l'analyse sur l'onglet Chat */}
        <Pressable
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={() => handlePress(onChatIA ?? (() => {}))}
          accessibilityLabel="Chat IA"
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color="#8b5cf6"
          />
          <Text style={[styles.actionText, { color: "#8b5cf6" }]}>Chat IA</Text>
        </Pressable>
      </View>
    </Card>
  );
};

export const VideoStudyCard = React.memo(VideoStudyCardComponent);

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  thumbnailContainer: {
    position: "relative",
    aspectRatio: 16 / 9,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: "hidden",
  },
  playOverlay: {
    position: "absolute",
    top: sp.sm,
    left: sp.sm,
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  badgeContainer: {
    position: "absolute",
    top: sp.sm,
    right: sp.sm,
  },
  platformBadgeContainer: {
    position: "absolute",
    bottom: sp.sm,
    left: sp.sm,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: sp.sm,
    gap: sp.xs,
  },
  title: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.35,
    marginBottom: sp.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.xs,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.sm,
  },
  actionText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  chatBtn: {
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
});

export default VideoStudyCard;

