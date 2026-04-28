import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Keyboard,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SimpleBottomSheetRef } from "@/components/ui/SimpleBottomSheet";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/contexts/AuthContext";
import { historyApi, videoApi } from "@/services/api";
import { OfflineCache, CachePriority } from "@/services/OfflineCache";
import { useIsOffline } from "@/hooks/useNetworkStatus";
import { Avatar } from "@/components/ui/Avatar";
import { YouTubeSearch } from "@/components/home/YouTubeSearch";
import { URLInput } from "@/components/home/URLInput";
import { CreditBar } from "@/components/home/CreditBar";
import { RecentCarousel } from "@/components/home/RecentCarousel";
import { OptionsSheet } from "@/components/home/OptionsSheet";
import type { AnalysisSummary } from "@/types";
import { textStyles, fontFamily, fontSize } from "@/theme/typography";
import { sp, borderRadius } from "@/theme/spacing";
import { palette } from "@/theme/colors";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import { TournesolRecommendations } from "@/components/tournesol/TournesolRecommendations";
import { DeepSightSpinner } from "@/components/ui/DeepSightSpinner";
// Quick Voice Call mobile V3
import { useClipboardURLDetector } from "@/hooks/useClipboardURLDetector";
import { useDeepLinkURL } from "@/hooks/useDeepLinkURL";
import { validateVideoURL } from "@/utils/validateVideoURL";
import { useVoiceChat } from "@/components/voice/useVoiceChat";
import { useStreamingVideoContext } from "@/components/voice/useStreamingVideoContext";
import { VoiceScreen } from "@/components/voice/VoiceScreen";
import { PostCallScreen } from "@/components/voice/PostCallScreen";

// Platform logos HD
const YOUTUBE_ICON = require("@/assets/platforms/youtube-icon-red.png");
const TIKTOK_NOTE = require("@/assets/platforms/tiktok-note-white.png");
const MISTRAL_LOGO = require("@/assets/platforms/mistral-logo-white.png");
const TOURNESOL_LOGO = require("@/assets/platforms/tournesol-logo.png");

type InputMode = "search" | "url";

const TABS: { key: InputMode; label: string; icon: string }[] = [
  { key: "search", label: "Recherche", icon: "search-outline" },
  { key: "url", label: "Coller un lien", icon: "link-outline" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const isOffline = useIsOffline();
  const optionsRef = useRef<SimpleBottomSheetRef>(null);

  const [mode, setMode] = useState<InputMode>("search");
  const [recents, setRecents] = useState<AnalysisSummary[]>([]);
  const [favorites, setFavorites] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournesolRefreshKey, setTournesolRefreshKey] = useState(0);
  const [quickChatUrl, setQuickChatUrl] = useState("");
  const [quickChatLoading, setQuickChatLoading] = useState(false);

  // ─── Quick Voice Call mobile V3 ────────────────────────────────────────────
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [postCallOpen, setPostCallOpen] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const { clipboardURL, dismiss: dismissClipboard } = useClipboardURLDetector();
  const voice = useVoiceChat({});
  const ctx = useStreamingVideoContext(voice.sessionId, voice.conversation);

  const handleVoiceCall = useCallback(
    async (videoUrl: string) => {
      if (!validateVideoURL(videoUrl)) {
        Alert.alert(
          "Source non supportée",
          "Le Voice Call accepte uniquement YouTube et TikTok.",
        );
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      Keyboard.dismiss();
      setActiveVideoUrl(videoUrl);
      setVoiceOpen(true);
      dismissClipboard();
      try {
        await voice.start({ videoUrl });
      } catch {
        // useVoiceChat reporte déjà l'erreur via `voice.error`.
      }
    },
    [voice, dismissClipboard],
  );

  // Deep link `deepsight://voice-call?url=...&autostart=true` → autostart
  useDeepLinkURL(
    useCallback(
      (deepUrl: string, autostart: boolean) => {
        setQuickChatUrl(deepUrl);
        if (autostart) {
          handleVoiceCall(deepUrl);
        }
      },
      [handleVoiceCall],
    ),
  );

  // Auto-show PostCallScreen quand voice idle après une session active
  useEffect(() => {
    if (voice.status === "idle" && voice.messages.length > 0 && voiceOpen) {
      setVoiceOpen(false);
      setPostCallOpen(true);
    }
  }, [voice.status, voice.messages.length, voiceOpen]);

  // Quick Chat handler
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
          backTo: "home",
          initialTab: "1",
          quickChat: "true",
        },
      } as any);
    } catch (err: any) {
      Alert.alert(
        "Erreur Quick Chat",
        err?.message || "Impossible de préparer le chat.",
      );
    } finally {
      setQuickChatLoading(false);
    }
  }, [quickChatUrl]);

  // Animated tab indicator
  const indicatorX = useSharedValue(0);
  const [tabWidths, setTabWidths] = useState<number[]>([0, 0]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidths[mode === "search" ? 0 : 1] || 100,
  }));

  const handleTabPress = useCallback(
    (tab: InputMode, index: number) => {
      setMode(tab);
      const offset = tabWidths.slice(0, index).reduce((a, b) => a + b, 0);
      indicatorX.value = withSpring(offset, { damping: 20, stiffness: 200 });
    },
    [tabWidths, indicatorX],
  );

  const loadData = useCallback(async () => {
    // Offline: serve cached items (silent fail on cache miss)
    if (isOffline) {
      try {
        const [cachedRecents, cachedFavorites] = await Promise.all([
          OfflineCache.get<AnalysisSummary[]>("home_recents"),
          OfflineCache.get<AnalysisSummary[]>("home_favorites"),
        ]);
        if (cachedRecents) setRecents(cachedRecents);
        if (cachedFavorites) setFavorites(cachedFavorites);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
      return;
    }

    try {
      const [historyRes, favRes] = await Promise.all([
        historyApi.getHistory(1, 10),
        historyApi.getHistory(1, 10, { favoritesOnly: true }),
      ]);
      setRecents(historyRes.items);
      setFavorites(favRes.items);
      // Persist for offline (7-day TTL, HIGH priority)
      await Promise.all([
        OfflineCache.set("home_recents", historyRes.items, {
          priority: CachePriority.HIGH,
          ttlMinutes: 7 * 24 * 60,
          tags: ["home"],
        }),
        OfflineCache.set("home_favorites", favRes.items, {
          priority: CachePriority.HIGH,
          ttlMinutes: 7 * 24 * 60,
          tags: ["home"],
        }),
      ]);
    } catch {
      // Fetch failed — fallback to cache if available
      const [cachedRecents, cachedFavorites] = await Promise.all([
        OfflineCache.get<AnalysisSummary[]>("home_recents"),
        OfflineCache.get<AnalysisSummary[]>("home_favorites"),
      ]);
      if (cachedRecents) setRecents(cachedRecents);
      if (cachedFavorites) setFavorites(cachedFavorites);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isOffline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    // Incrémenter la clé pour forcer un re-fetch des suggestions Tournesol
    setTournesolRefreshKey((prev) => prev + 1);
  }, [loadData]);

  const handleOptionsPress = useCallback(() => {
    optionsRef.current?.snapToIndex(0);
  }, []);

  const handleOptionsClose = useCallback(() => {
    optionsRef.current?.close();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="default" density="low" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + sp.md,
            paddingBottom: 80 + Math.max(insets.bottom, sp.md),
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textTertiary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[textStyles.displaySm, { color: colors.textPrimary }]}>
            DeepSight
          </Text>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              Alert.alert(
                "Se déconnecter",
                "Es-tu sûr de vouloir te déconnecter ?",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Déconnexion",
                    style: "destructive",
                    onPress: async () => {
                      await logout();
                      router.replace("/(auth)");
                    },
                  },
                ],
              );
            }}
            accessibilityLabel="Se déconnecter"
            hitSlop={8}
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color={colors.accentError}
            />
          </Pressable>
        </View>

        {/* Platform Logos Banner */}
        <View style={styles.platformBanner}>
          <Text
            style={[styles.platformSubtitle, { color: colors.textTertiary }]}
          >
            Analysez vos vidéos
          </Text>
          <View style={styles.platformLogos}>
            <View style={styles.platformLogoItem}>
              <Image
                source={YOUTUBE_ICON}
                style={styles.platformLogoYt}
                contentFit="contain"
              />
              <Text
                style={[
                  styles.platformLogoLabel,
                  { color: colors.textSecondary },
                ]}
              >
                YouTube
              </Text>
            </View>
            <View
              style={[
                styles.platformDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.platformLogoItem}>
              <Image
                source={TIKTOK_NOTE}
                style={styles.platformLogoTt}
                contentFit="contain"
              />
              <Text
                style={[
                  styles.platformLogoLabel,
                  { color: colors.textSecondary },
                ]}
              >
                TikTok
              </Text>
            </View>
          </View>
          {/* Powered by Mistral + Tournesol */}
          <View style={styles.poweredRow}>
            <Text style={[styles.poweredText, { color: colors.textMuted }]}>
              Propulsé par
            </Text>
            <Image
              source={MISTRAL_LOGO}
              style={[styles.mistralLogo, !isDark && { tintColor: "#1a1a2e" }]}
              contentFit="contain"
            />
            <View
              style={[styles.poweredSep, { backgroundColor: colors.border }]}
            />
            <Image
              source={TOURNESOL_LOGO}
              style={styles.tournesolLogo}
              contentFit="contain"
            />
          </View>
        </View>

        {/* Mode Tabs */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.bgSecondary, borderColor: colors.border },
          ]}
        >
          <Animated.View
            style={[
              styles.tabIndicator,
              { backgroundColor: palette.indigo + "20" },
              indicatorStyle,
            ]}
          />
          {TABS.map((tab, index) => {
            const isActive = mode === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key, index)}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  setTabWidths((prev) => {
                    const next = [...prev];
                    next[index] = w;
                    return next;
                  });
                }}
                style={styles.tab}
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={tab.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={isActive ? palette.indigo : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? palette.indigo : colors.textMuted,
                      fontFamily: isActive
                        ? fontFamily.bodySemiBold
                        : fontFamily.body,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Input zone based on mode */}
        {mode === "search" ? (
          <YouTubeSearch onOptionsPress={handleOptionsPress} />
        ) : (
          <URLInput onOptionsPress={handleOptionsPress} />
        )}

        {/* Credit Bar */}
        <CreditBar />

        {/* Clipboard Banner (Quick Voice Call mobile V3) */}
        {clipboardURL && (
          <Pressable
            onPress={() => handleVoiceCall(clipboardURL)}
            style={styles.clipboardBanner}
            accessibilityLabel="Lien détecté dans le presse-papier — appuie pour appeler"
            accessibilityRole="button"
          >
            <Text style={styles.clipboardLabel}>
              📋 LIEN DÉTECTÉ DANS LE PRESSE-PAPIER
            </Text>
            <Text
              style={[styles.clipboardURL, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {clipboardURL.replace(/^https?:\/\//, "")}
            </Text>
            <Text style={styles.clipboardHint}>Tape pour appeler →</Text>
          </Pressable>
        )}

        {/* Quick Chat Block */}
        <View
          style={[
            styles.quickChatBox,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.quickChatHeader}>
            <Ionicons name="flash" size={16} color={palette.amber} />
            <Text
              style={[styles.quickChatTitle, { color: colors.textPrimary }]}
            >
              Quick Chat
            </Text>
            <View
              style={[
                styles.quickChatBadge,
                { backgroundColor: palette.green + "20" },
              ]}
            >
              <Text
                style={[styles.quickChatBadgeText, { color: palette.green }]}
              >
                0 crédit
              </Text>
            </View>
          </View>
          <Text style={[styles.quickChatDesc, { color: colors.textTertiary }]}>
            Chatte directement avec une vidéo YouTube ou TikTok — sans analyse
            complète
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
              placeholder="https://youtube.com/... ou tiktok.com/..."
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
            {/* Voice Call CTA — Quick Voice Call mobile V3 */}
            <Pressable
              style={[
                styles.quickChatBtn,
                {
                  backgroundColor: validateVideoURL(quickChatUrl.trim())
                    ? palette.gold
                    : colors.bgSecondary,
                  marginLeft: sp.xs,
                },
              ]}
              onPress={() => handleVoiceCall(quickChatUrl.trim())}
              disabled={!validateVideoURL(quickChatUrl.trim())}
              accessibilityLabel="Appeler la vidéo en vocal"
              accessibilityRole="button"
            >
              <Ionicons
                name="mic"
                size={18}
                color={
                  validateVideoURL(quickChatUrl.trim())
                    ? "#fff"
                    : colors.textMuted
                }
              />
            </Pressable>
          </View>
        </View>

        {/* Recents */}
        <View style={styles.sectionSpacing}>
          <RecentCarousel
            title="Récents"
            items={recents}
            isLoading={isLoading}
            showEmpty
          />
        </View>

        {/* Favorites */}
        {(favorites.length > 0 || isLoading) && (
          <RecentCarousel
            title="Favoris"
            items={favorites}
            isLoading={isLoading}
          />
        )}

        {/* Tournesol Recommendations */}
        <TournesolRecommendations
          language="fr"
          limit={10}
          refreshTrigger={tournesolRefreshKey}
        />
      </ScrollView>

      {/* Options Bottom Sheet */}
      <OptionsSheet ref={optionsRef} onClose={handleOptionsClose} />

      {/* Quick Voice Call mobile V3 — VoiceScreen streaming */}
      <VoiceScreen
        visible={voiceOpen}
        onClose={() => {
          voice.stop();
          setVoiceOpen(false);
        }}
        videoTitle={activeVideoUrl ?? ""}
        voiceStatus={voice.status}
        isSpeaking={voice.isSpeaking}
        messages={voice.messages}
        elapsedSeconds={voice.elapsedSeconds}
        remainingMinutes={voice.remainingMinutes}
        onStart={() => {
          if (activeVideoUrl) voice.start({ videoUrl: activeVideoUrl });
        }}
        onStop={() => {
          voice.stop();
        }}
        onMuteToggle={voice.toggleMute}
        isMuted={voice.isMuted}
        error={voice.error ?? undefined}
        streaming={true}
        contextProgress={ctx.contextProgress}
        contextComplete={ctx.contextComplete}
      />

      {/* Quick Voice Call mobile V3 — PostCallScreen */}
      <PostCallScreen
        visible={postCallOpen}
        onClose={() => setPostCallOpen(false)}
        videoTitle={activeVideoUrl ?? ""}
        summaryId={voice.summaryId ?? undefined}
        durationSeconds={voice.elapsedSeconds}
        messages={voice.messages}
        quotaRemaining={voice.remainingMinutes}
        onViewAnalysis={(id) => {
          setPostCallOpen(false);
          router.push({
            pathname: "/(tabs)/analysis/[id]",
            params: { id: String(id), backTo: "home" },
          } as never);
        }}
        onCallAnother={() => {
          setPostCallOpen(false);
          setQuickChatUrl("");
          setActiveVideoUrl(null);
        }}
      />
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: sp.lg,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 3,
    marginBottom: sp.lg,
    position: "relative",
    overflow: "hidden",
  },
  tabIndicator: {
    position: "absolute",
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: borderRadius.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp.sm + 2,
    gap: sp.xs,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: fontSize.sm,
  },
  sectionSpacing: {
    marginTop: sp.xl,
  },
  platformBanner: {
    alignItems: "center",
    marginBottom: sp.lg,
    gap: sp.sm,
  },
  platformSubtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  platformLogos: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.lg,
  },
  platformLogoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  platformLogoYt: {
    width: 28,
    height: 20,
  },
  platformLogoTt: {
    width: 18,
    height: 20,
  },
  platformLogoLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  platformDivider: {
    width: 1,
    height: 20,
    opacity: 0.3,
  },
  poweredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: sp.sm,
    opacity: 0.5,
  },
  poweredText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mistralLogo: {
    height: 16,
    width: 65,
  },
  poweredSep: {
    width: 1,
    height: 12,
    opacity: 0.3,
    marginHorizontal: 2,
  },
  tournesolLogo: {
    width: 16,
    height: 16,
  },
  // ── Quick Chat ──
  quickChatBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: sp.md,
    marginTop: sp.lg,
  },
  // Quick Voice Call mobile V3 — clipboard banner
  clipboardBanner: {
    backgroundColor: "rgba(200, 144, 58, 0.08)",
    borderColor: "rgba(200, 144, 58, 0.4)",
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: sp.md,
    marginTop: sp.lg,
  },
  clipboardLabel: {
    fontSize: 10,
    color: palette.gold,
    fontFamily: fontFamily.bodyBold,
    letterSpacing: 1,
  },
  clipboardURL: {
    fontSize: fontSize.base,
    marginTop: sp.xs,
  },
  clipboardHint: {
    fontSize: fontSize.xs,
    color: palette.gold,
    marginTop: sp.sm,
  },
  quickChatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  quickChatTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    flex: 1,
  },
  quickChatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  quickChatBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
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
});
