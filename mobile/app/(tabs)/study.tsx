/**
 * Study Hub Screen - Tab dédié aux révisions ET chat IA
 * Sous-onglets: Chat IA (historique conversations) | Réviser (Flashcards + Quiz)
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  // ActivityIndicator remplacé par DeepSightSpinner
  Image,
  TextInput,
  Alert,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyStore } from "@/stores/studyStore";
import { historyApi, videoApi } from "@/services/api";
import { OfflineCache, CachePriority } from "@/services/OfflineCache";
import { useIsOffline } from "@/hooks/useNetworkStatus";
import { StatsCard } from "@/components/study/StatsCard";
import { VideoStudyCard } from "@/components/study/VideoStudyCard";
import { FlashcardDeck } from "@/components/study/FlashcardDeck";
import { MultiAnswerQuiz } from "@/components/study/MultiAnswerQuiz";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize, textStyles } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import { DeepSightSpinner } from "@/components/ui/DeepSightSpinner";
import type { AnalysisSummary } from "@/types";

type SubTab = "chat" | "reviser";

export default function StudyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { progress, stats } = useStudyStore();
  const isOffline = useIsOffline();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("chat");
  const [summaries, setSummaries] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFlashcards, setShowFlashcards] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState<string | null>(null);
  const [quickChatUrl, setQuickChatUrl] = useState("");
  const [quickChatLoading, setQuickChatLoading] = useState(false);

  const isFree = user?.plan === "free";

  // Quick Chat — coller un lien → chat direct sans analyse
  const handleQuickChat = useCallback(async () => {
    const url = quickChatUrl.trim();
    if (!url) return;
    const isValid =
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("tiktok.com");
    if (!isValid) {
      Alert.alert("Lien invalide", "Colle un lien YouTube ou TikTok valide.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setQuickChatLoading(true);
    try {
      const result = await videoApi.quickChat(url);
      setQuickChatUrl("");
      router.push({
        pathname: "/(tabs)/analysis/[id]",
        params: {
          id: String(result.summary_id),
          backTo: "study",
          initialTab: "1",
          quickChat: "true",
        },
      } as any);
    } catch (err: any) {
      Alert.alert(
        "Erreur",
        err?.message || "Impossible de préparer le Quick Chat.",
      );
    } finally {
      setQuickChatLoading(false);
    }
  }, [quickChatUrl, router]);

  // Load summaries from history (with offline cache)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const cacheKey = "study_summaries";

      // Offline: serve cache silently
      if (isOffline) {
        const cached = await OfflineCache.get<AnalysisSummary[]>(cacheKey);
        if (mounted) {
          if (cached) setSummaries(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await historyApi.getHistory(1, 50);
        if (mounted) setSummaries(response.items);
        // Cache for offline study (HIGH priority, 7-day TTL)
        await OfflineCache.set(cacheKey, response.items, {
          priority: CachePriority.HIGH,
          ttlMinutes: 7 * 24 * 60,
          tags: ["study"],
        });
      } catch {
        // Fetch failed — fallback to cache if available
        const cached = await OfflineCache.get<AnalysisSummary[]>(cacheKey);
        if (mounted && cached) setSummaries(cached);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isOffline]);

  // Find last incomplete session
  const lastIncomplete = summaries.find((s) => {
    const p = progress[s.id];
    return (
      p && p.flashcardsTotal > 0 && p.flashcardsCompleted < p.flashcardsTotal
    );
  });

  const handleLockedPress = useCallback(() => {
    router.push("/(tabs)/profile");
  }, [router]);

  // Fullscreen modes
  if (showFlashcards) {
    return (
      <FlashcardDeck
        summaryId={showFlashcards}
        onClose={() => setShowFlashcards(null)}
      />
    );
  }

  if (showQuiz) {
    return (
      <MultiAnswerQuiz summaryId={showQuiz} onClose={() => setShowQuiz(null)} />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgPrimary,
          paddingBottom: 60 + Math.max(insets.bottom, sp.sm),
        },
      ]}
    >
      <DoodleBackground variant="academic" density="low" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + sp.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Révisez & chattez
        </Text>

        {/* Sub-tab segmented control: Chat IA | Réviser */}
        <View
          style={[
            styles.segmentedControl,
            { backgroundColor: colors.bgSecondary, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.segmentBtn,
              activeSubTab === "chat" && [
                styles.segmentActive,
                { backgroundColor: palette.indigo + "20" },
              ],
            ]}
            onPress={() => {
              setActiveSubTab("chat");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={16}
              color={
                activeSubTab === "chat" ? palette.indigo : colors.textTertiary
              }
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeSubTab === "chat"
                      ? palette.indigo
                      : colors.textTertiary,
                },
                activeSubTab === "chat" && styles.segmentTextActive,
              ]}
            >
              Chat IA
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              activeSubTab === "reviser" && [
                styles.segmentActive,
                { backgroundColor: palette.indigo + "20" },
              ],
            ]}
            onPress={() => {
              setActiveSubTab("reviser");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons
              name="school-outline"
              size={16}
              color={
                activeSubTab === "reviser"
                  ? palette.indigo
                  : colors.textTertiary
              }
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeSubTab === "reviser"
                      ? palette.indigo
                      : colors.textTertiary,
                },
                activeSubTab === "reviser" && styles.segmentTextActive,
              ]}
            >
              Réviser
            </Text>
          </Pressable>
        </View>

        {/* ===== Chat IA sub-tab ===== */}
        {activeSubTab === "chat" && (
          <>
            {/* Quick Chat — coller un lien pour chatter directement */}
            <Animated.View entering={FadeInDown.delay(50).duration(250)}>
              <View
                style={[
                  styles.quickChatBox,
                  {
                    backgroundColor: colors.bgElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.quickChatHeader}>
                  <Ionicons name="flash" size={16} color={palette.amber} />
                  <Text
                    style={[
                      styles.quickChatLabel,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Quick Chat
                  </Text>
                  <Text
                    style={[
                      styles.quickChatBadge,
                      {
                        backgroundColor: palette.green + "20",
                        color: palette.green,
                      },
                    ]}
                  >
                    0 crédit
                  </Text>
                </View>
                <Text
                  style={[styles.quickChatDesc, { color: colors.textTertiary }]}
                >
                  Colle un lien YouTube ou TikTok pour chatter directement avec
                  la vidéo
                </Text>
                <View style={styles.quickChatRow}>
                  <TextInput
                    style={[
                      styles.quickChatInput,
                      {
                        backgroundColor: colors.bgSecondary,
                        color: colors.textPrimary,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="https://youtube.com/watch?v=..."
                    placeholderTextColor={colors.textMuted}
                    value={quickChatUrl}
                    onChangeText={setQuickChatUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={handleQuickChat}
                    editable={!quickChatLoading}
                  />
                  <Pressable
                    style={[
                      styles.quickChatBtn,
                      {
                        backgroundColor: quickChatUrl.trim()
                          ? palette.indigo
                          : colors.bgSecondary,
                      },
                    ]}
                    onPress={handleQuickChat}
                    disabled={quickChatLoading || !quickChatUrl.trim()}
                  >
                    {quickChatLoading ? (
                      <DeepSightSpinner size="xs" speed="fast" />
                    ) : (
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={18}
                        color={quickChatUrl.trim() ? "#fff" : colors.textMuted}
                      />
                    )}
                  </Pressable>
                </View>
              </View>
            </Animated.View>

            {/* Loading */}
            {loading && (
              <View style={styles.loadingBox}>
                <DeepSightSpinner
                  size="sm"
                  speed="normal"
                  label="Chargement..."
                />
              </View>
            )}

            {/* Empty state */}
            {!loading && summaries.length === 0 && (
              <Animated.View
                entering={FadeInDown.delay(100).duration(300)}
                style={styles.emptyState}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={64}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.emptyTitle, { color: colors.textSecondary }]}
                >
                  Aucune conversation
                </Text>
                <Text
                  style={[styles.emptySubtitle, { color: colors.textTertiary }]}
                >
                  Analyse une vidéo puis discute avec son contenu
                </Text>
                <Pressable
                  style={[
                    styles.emptyBtn,
                    { backgroundColor: colors.accentPrimary },
                  ]}
                  onPress={() => router.push("/(tabs)/")}
                >
                  <Text style={styles.emptyBtnText}>Analyser une vidéo</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Chat history — list of analyzed videos to chat with */}
            {summaries.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  Chatter avec une vidéo
                </Text>
                {summaries.map((summary) => {
                  const plat = summary.platform || "youtube";
                  // Fallback thumbnail: YouTube → img.youtube.com, TikTok → null (placeholder)
                  const rawThumb =
                    summary.thumbnail || summary.videoInfo?.thumbnail;
                  const thumbUrl =
                    rawThumb ||
                    (plat === "youtube" && summary.videoId
                      ? `https://img.youtube.com/vi/${summary.videoId}/mqdefault.jpg`
                      : null);
                  return (
                    <Pressable
                      key={summary.id}
                      style={[
                        styles.chatCard,
                        {
                          backgroundColor: colors.bgElevated,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({
                          pathname: "/(tabs)/analysis/[id]",
                          params: {
                            id: summary.id,
                            backTo: "study",
                            initialTab: "1",
                          },
                        } as any);
                      }}
                    >
                      {/* Miniature vidéo */}
                      <View style={styles.thumbWrapper}>
                        {thumbUrl ? (
                          <Image
                            source={{ uri: thumbUrl }}
                            style={styles.thumbImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.thumbPlaceholder,
                              {
                                backgroundColor:
                                  plat === "tiktok"
                                    ? "#111"
                                    : colors.bgSecondary,
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                plat === "tiktok"
                                  ? "musical-notes-outline"
                                  : "videocam-outline"
                              }
                              size={20}
                              color={
                                plat === "tiktok" ? "#fff" : colors.textMuted
                              }
                            />
                          </View>
                        )}
                        {/* Badge plateforme */}
                        <View
                          style={[
                            styles.platformBadge,
                            {
                              backgroundColor:
                                plat === "tiktok" ? "#000000" : "#FF0000",
                            },
                          ]}
                        >
                          <Text style={styles.platformBadgeText}>
                            {plat === "tiktok" ? "TikTok" : "YT"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.chatCardInfo}>
                        <Text
                          style={[
                            styles.chatCardTitle,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={2}
                        >
                          {summary.title}
                        </Text>
                        <Text
                          style={[
                            styles.chatCardMeta,
                            { color: colors.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {summary.videoInfo?.channel || "Vidéo"} ·{" "}
                          <Ionicons
                            name="chatbubble-outline"
                            size={10}
                            color={colors.textTertiary}
                          />{" "}
                          Chat IA
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </>
        )}

        {/* ===== Réviser sub-tab ===== */}
        {activeSubTab === "reviser" && (
          <>
            {/* Stats */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <StatsCard stats={stats} />
            </Animated.View>

            {/* Loading */}
            {loading && (
              <View style={styles.loadingBox}>
                <DeepSightSpinner
                  size="sm"
                  speed="normal"
                  label="Chargement..."
                />
              </View>
            )}

            {/* Resume section */}
            {lastIncomplete && (
              <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  Reprendre
                </Text>
                <Pressable
                  style={[
                    styles.resumeCard,
                    {
                      backgroundColor: colors.bgElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setShowFlashcards(lastIncomplete.id)}
                  accessibilityLabel="Reprendre les flashcards"
                >
                  <Ionicons
                    name="play-circle"
                    size={24}
                    color={colors.accentPrimary}
                  />
                  <View style={styles.resumeInfo}>
                    <Text
                      style={[
                        styles.resumeTitle,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {lastIncomplete.title}
                    </Text>
                    <Text
                      style={[
                        styles.resumeSubtitle,
                        { color: colors.textTertiary },
                      ]}
                    >
                      {progress[lastIncomplete.id]?.flashcardsCompleted}/
                      {progress[lastIncomplete.id]?.flashcardsTotal} flashcards
                    </Text>
                  </View>
                  <Text
                    style={[styles.resumeBtn, { color: colors.accentPrimary }]}
                  >
                    Continuer
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Empty state */}
            {!loading && summaries.length === 0 && (
              <Animated.View
                entering={FadeInDown.delay(200).duration(300)}
                style={styles.emptyState}
              >
                <Ionicons
                  name="school-outline"
                  size={64}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.emptyTitle, { color: colors.textSecondary }]}
                >
                  Aucune vidéo analysée
                </Text>
                <Text
                  style={[styles.emptySubtitle, { color: colors.textTertiary }]}
                >
                  Analyse une vidéo pour commencer à réviser
                </Text>
                <Pressable
                  style={[
                    styles.emptyBtn,
                    { backgroundColor: colors.accentPrimary },
                  ]}
                  onPress={() => router.push("/(tabs)/")}
                >
                  <Text style={styles.emptyBtnText}>Aller à l'accueil</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Videos grid */}
            {summaries.length > 0 && (
              <Animated.View entering={FadeInDown.delay(300).duration(300)}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textPrimary }]}
                >
                  Toutes les vidéos
                </Text>
                <View style={styles.grid}>
                  {summaries.map((summary) => (
                    <View key={summary.id} style={styles.gridItem}>
                      <VideoStudyCard
                        summary={summary}
                        progress={progress[summary.id]}
                        onFlashcards={() => setShowFlashcards(summary.id)}
                        onQuiz={() => setShowQuiz(summary.id)}
                        onAnalysis={() =>
                          router.push({
                            pathname: "/(tabs)/analysis/[id]",
                            params: {
                              id: summary.id,
                              backTo: "library",
                              initialTab: "0",
                            },
                          } as any)
                        }
                        onChatIA={() =>
                          router.push({
                            pathname: "/(tabs)/analysis/[id]",
                            params: {
                              id: summary.id,
                              backTo: "library",
                              initialTab: "1",
                            },
                          } as any)
                        }
                        locked={isFree}
                        onLockedPress={handleLockedPress}
                      />
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp["3xl"],
  },
  title: {
    ...textStyles.displaySm,
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginTop: sp["2xl"],
    marginBottom: sp.md,
  },
  loadingBox: {
    paddingVertical: sp["3xl"],
    alignItems: "center",
  },
  resumeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: sp.md,
  },
  resumeInfo: {
    flex: 1,
  },
  resumeTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  resumeSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  resumeBtn: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp.md,
  },
  gridItem: {
    width: "48%",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: sp["4xl"],
    gap: sp.md,
  },
  emptyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },
  emptySubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  emptyBtn: {
    paddingVertical: sp.md,
    paddingHorizontal: sp["2xl"],
    borderRadius: 12,
    marginTop: sp.md,
  },
  emptyBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: "#ffffff",
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 3,
    marginBottom: sp.lg,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp.sm + 2,
    gap: sp.xs,
    borderRadius: borderRadius.md,
  },
  segmentActive: {
    borderRadius: borderRadius.md,
  },
  segmentText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  segmentTextActive: {
    fontFamily: fontFamily.bodySemiBold,
  },
  // ── Quick Chat ──
  quickChatBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: sp.md,
    marginBottom: sp.lg,
  },
  quickChatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  quickChatLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    flex: 1,
  },
  quickChatBadge: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  quickChatDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.sm,
    lineHeight: fontSize.xs * 1.4,
  },
  quickChatRow: {
    flexDirection: "row",
    gap: sp.sm,
    alignItems: "center",
  },
  quickChatInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: sp.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  quickChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Chat Cards ──
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: sp.sm,
    gap: sp.md,
  },
  thumbWrapper: {
    width: 64,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  platformBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  platformBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontFamily: fontFamily.bodySemiBold,
    letterSpacing: 0.3,
  },
  chatCardInfo: {
    flex: 1,
  },
  chatCardTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  chatCardMeta: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
