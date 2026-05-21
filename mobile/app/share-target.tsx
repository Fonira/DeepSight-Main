/**
 * 🎯 Share Target — choice screen reached after a YouTube/TikTok share.
 *
 * Two CTAs:
 *  - Quick Chat (free, ~3s) → /(tabs)/hub in chat mode
 *  - Full analysis (1 credit) → /(tabs)/analysis/[task_id]
 *
 * The URL is passed as a query param by useDeepSightShareIntent.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { videoApi, ApiError } from "@/services/api";
import { useAnalysisStore } from "@/stores/analysisStore";
import {
  validateYouTubeUrl,
  getYouTubeThumbnail,
} from "@/utils/formatters";
import { palette } from "@/theme/colors";

type Loading = null | "chat" | "analysis";

export default function ShareTargetScreen() {
  const router = useRouter();
  const { url: rawUrl } = useLocalSearchParams<{ url?: string }>();
  const url = typeof rawUrl === "string" ? rawUrl : "";

  const validation = useMemo(() => validateYouTubeUrl(url), [url]);
  const isTikTok = validation.platform === "tiktok";
  const platformLabel = isTikTok ? "TikTok" : "YouTube";
  const platformColor = isTikTok ? "#06b6d4" : "#FF0000";
  const thumbnailUri =
    !isTikTok && validation.videoId
      ? getYouTubeThumbnail(validation.videoId, "high")
      : null;

  const [loading, setLoading] = useState<Loading>(null);

  // Bounce home if we somehow landed here with an invalid URL.
  useEffect(() => {
    if (!validation.isValid) {
      router.replace("/(tabs)");
    }
  }, [validation.isValid, router]);

  const handleError = useCallback((err: unknown) => {
    const status =
      err instanceof ApiError ? err.status : (err as { status?: number })?.status;
    if (status === 402 || status === 403) {
      Alert.alert(
        "Quota dépassé",
        "Passez à un plan supérieur pour analyser plus de vidéos.",
      );
    } else if (status === 401) {
      Alert.alert("Connexion expirée", "Reconnectez-vous pour analyser.");
    } else {
      const message =
        err instanceof Error ? err.message : "Une erreur est survenue.";
      Alert.alert("Erreur", message);
    }
  }, []);

  const onQuickChat = useCallback(async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading("chat");
    try {
      const result = await videoApi.quickChat(url, "fr");
      if (!result?.summary_id) throw new Error("Pas de summary_id retourné.");
      router.replace({
        pathname: "/(tabs)/hub",
        params: {
          summaryId: String(result.summary_id),
          initialMode: "chat",
        },
      } as never);
    } catch (err) {
      handleError(err);
      setLoading(null);
    }
  }, [loading, url, router, handleError]);

  const options = useAnalysisStore((s) => s.options);
  const startAnalysisAction = useAnalysisStore((s) => s.startAnalysis);

  const onFullAnalysis = useCallback(async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setLoading("analysis");
    try {
      const response = await videoApi.analyze({
        url,
        mode: options.mode,
        language: options.language,
        model: "mistral",
        category: "auto",
      });
      const taskId = response.task_id;
      if (!taskId) throw new Error("Pas de task_id retourné.");
      startAnalysisAction(taskId);
      router.replace({
        pathname: "/(tabs)/analysis/[id]",
        params: { id: taskId },
      });
    } catch (err) {
      handleError(err);
      setLoading(null);
    }
  }, [loading, url, options, startAnalysisAction, router, handleError]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={22} color="#ffffff" />
        </Pressable>
        <Text style={styles.title}>Vidéo partagée</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.preview}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback]}>
            <Ionicons
              name={isTikTok ? "musical-notes" : "logo-youtube"}
              size={36}
              color={platformColor}
            />
          </View>
        )}
        <View
          style={[
            styles.platformBadge,
            { backgroundColor: `${platformColor}26` },
          ]}
        >
          <Text style={[styles.platformBadgeText, { color: platformColor }]}>
            {isTikTok ? "🎵" : "▶"} {platformLabel}
          </Text>
        </View>
        <Text style={styles.url} numberOfLines={2}>
          {url}
        </Text>
      </View>

      <Text style={styles.question}>Que veux-tu faire avec cette vidéo ?</Text>

      <Pressable
        onPress={onQuickChat}
        disabled={!!loading}
        style={({ pressed }) => [
          styles.cta,
          styles.ctaSecondary,
          pressed && styles.ctaPressed,
          loading === "analysis" && styles.ctaDisabled,
        ]}
        accessibilityLabel="Discuter avec la vidéo (gratuit)"
      >
        <View style={styles.ctaContent}>
          <View style={styles.ctaIconWrap}>
            <Ionicons name="chatbubbles" size={22} color="#ffffff" />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Discuter</Text>
            <Text style={styles.ctaSub}>Gratuit · réponse en ~3 s</Text>
          </View>
          {loading === "chat" ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={onFullAnalysis}
        disabled={!!loading}
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.ctaPressed,
          loading === "chat" && styles.ctaDisabled,
        ]}
        accessibilityLabel="Lancer une analyse complète (1 crédit)"
      >
        <LinearGradient
          colors={[palette.indigo, palette.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaGradient}
        >
          <View style={styles.ctaContent}>
            <View style={[styles.ctaIconWrap, styles.ctaIconWrapPrimary]}>
              <Ionicons name="sparkles" size={22} color="#ffffff" />
            </View>
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Analyse complète</Text>
              <Text style={styles.ctaSub}>
                1 crédit · résumé + flashcards + quiz
              </Text>
            </View>
            {loading === "analysis" ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#ffffff" />
            )}
          </View>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        disabled={!!loading}
        style={styles.cancel}
        accessibilityLabel="Annuler"
      >
        <Text style={styles.cancelText}>Annuler</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0b",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  preview: {
    marginTop: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 12,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: "#1c1c1f",
  },
  thumbnailFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  platformBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "center",
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  url: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "center",
  },
  question: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 28,
    marginBottom: 16,
    textAlign: "center",
  },
  cta: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  ctaSecondary: {
    backgroundColor: "#1c1c1f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  ctaGradient: {
    flex: 1,
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ctaIconWrapPrimary: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  ctaText: {
    flex: 1,
  },
  ctaTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  ctaSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 4,
  },
  cancelText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
});
