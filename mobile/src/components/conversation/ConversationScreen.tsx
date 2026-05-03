/**
 * ConversationScreen — Composant racine pour le mode conversation unifié
 * (Quick Chat + Quick Call). Remplace `QuickChatScreen` + `VoiceScreen` +
 * `PostCallScreen`.
 *
 * Layout two-pane :
 *   - Header
 *   - ContextProgressBanner (si streaming)
 *   - ConversationFeed (FlatList inverted)
 *   - VoiceControls (zone bas, hauteur fixe)
 *   - EndedToast (sur hangup, 3s)
 *   - MiniActionBar (sticky)
 *   - ConversationInput
 *
 * Spec : `docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md` §4
 */

import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Modal,
  StatusBar,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useTheme } from "../../contexts/ThemeContext";
import { useConversation } from "../../hooks/useConversation";
import { sp } from "../../theme/spacing";
import { duration } from "../../theme/animations";
import { historyApi, videoApi } from "../../services/api";
import { useAnalysisStore } from "../../stores/analysisStore";
import { VoiceSettings } from "../voice/VoiceSettings";
import VoiceAddonModal from "../voice/VoiceAddonModal";
import { ConversationHeader } from "./ConversationHeader";
import { ConversationFeed } from "./ConversationFeed";
import { ConversationInput } from "./ConversationInput";
import { ContextProgressBanner } from "./ContextProgressBanner";
import { VoiceControls } from "./VoiceControls";
import { EndedToast } from "./EndedToast";
import { MiniActionBar } from "./MiniActionBar";

export interface ConversationScreenProps {
  /** Si false, le Modal n'est pas visible (parent contrôle). */
  visible: boolean;
  /** ID d'analyse existante (mode "Quick Chat sur analyse"). */
  summaryId?: string;
  /** URL vidéo fraîche (mode Quick Call V3 streaming). */
  videoUrl?: string;
  /** Mode initial : 'chat' (mic gris) ou 'call' (auto-start mic). */
  initialMode: "chat" | "call";
  /** Title affiché dans le header. */
  videoTitle: string;
  /** Channel name optionnel. */
  channelName?: string;
  /** Plateforme de la vidéo. 'live' = Quick Call streaming non encore résolu. */
  platform?: "youtube" | "tiktok" | "live";
  /** Initial favorite state (UI optimistic toggle). */
  initialFavorite?: boolean;
  /** Callback close. */
  onClose: () => void;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  visible,
  summaryId,
  videoUrl,
  initialMode,
  videoTitle,
  channelName,
  platform = "youtube",
  initialFavorite = false,
  onClose,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const settingsSheetRef = useRef<BottomSheet | null>(null);
  const [addonVisible, setAddonVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const store = useAnalysisStore();

  const conv = useConversation({
    summaryId,
    videoUrl,
    initialMode,
    onError: (msg) => {
      if (__DEV__) console.warn("[ConversationScreen] error:", msg);
    },
  });

  // ─── Send (chat OR voice depending on mode) ───
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || conv.isLoading) return;
    Haptics.selectionAsync().catch(() => {});
    setInputText("");
    conv.sendMessage(text);
  }, [inputText, conv]);

  const handleSuggestion = useCallback(
    (q: string) => {
      Haptics.selectionAsync().catch(() => {});
      conv.sendMessage(q);
    },
    [conv],
  );

  // ─── Mic tap (input button) — confirm si off, toggleMute si live ───
  const handleMicTap = useCallback(() => {
    if (conv.voiceMode === "live") {
      conv.toggleMute();
    } else if (conv.voiceMode === "off") {
      conv.requestStartCall();
    }
  }, [conv]);

  // ─── Mini action bar callbacks ───
  const handleToggleFavorite = useCallback(async () => {
    if (!conv.summaryId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await historyApi.toggleFavorite(conv.summaryId);
      setIsFavorite((p) => !p);
    } catch {
      /* silent fail */
    }
  }, [conv.summaryId]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${videoTitle} — Analysé avec DeepSight`,
        url: videoUrl || "",
      });
    } catch {
      /* silent fail */
    }
  }, [videoTitle, videoUrl]);

  const handleViewAnalysis = useCallback(async () => {
    if (!conv.summaryId) return;
    if (isUpgrading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsUpgrading(true);
    try {
      const result = await videoApi.upgradeQuickChat(
        Number(conv.summaryId),
        "standard",
      );
      if (result.status === "completed") {
        router.replace({
          pathname: "/(tabs)/analysis/[id]",
          params: { id: conv.summaryId, initialTab: "0" },
        } as never);
        onClose();
        return;
      }
      // Streaming overlay flow
      store.startAnalysis(result.task_id);
      router.replace({
        pathname: "/(tabs)/analysis/[id]",
        params: { id: result.task_id, initialTab: "0" },
      } as never);
      onClose();
    } catch (err: unknown) {
      setIsUpgrading(false);
      const e = err as { message?: string; detail?: string };
      const msg =
        e?.message || e?.detail || "Erreur lors du lancement de l'analyse";
      Alert.alert("Erreur", msg);
    }
  }, [conv.summaryId, isUpgrading, router, store, onClose]);

  // ─── Settings sheet ───
  const handleOpenSettings = useCallback(() => {
    settingsSheetRef.current?.expand();
  }, []);

  const handleOpenAddon = useCallback(() => {
    setAddonVisible(true);
  }, []);

  // ─── Quota label ───
  const userMessageCount = conv.messages.filter(
    (m) => m.role === "user",
  ).length;
  const quotaText =
    conv.voiceMode === "live"
      ? `${Math.max(0, Math.floor(conv.remainingMinutes))} min restantes`
      : `${userMessageCount}/15 questions`;

  // Detect platform pour header (Live si Quick Call sans summary résolu)
  const headerPlatform: "youtube" | "tiktok" | "live" =
    conv.streaming && !conv.summaryId ? "live" : platform;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/*
        Edge-to-edge: la Modal `statusBarTranslucent` couvre toute la hauteur
        écran, status bar et home indicator inclus. Le composant déclare son
        propre StatusBar pour conserver les icônes lisibles sur fond bgPrimary.
        Les paddings safe-area ne sont PLUS appliqués sur l'inner View — c'est
        au Header (top) et à l'Input (bottom) de gérer leur propre inset.
      */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View
        entering={FadeIn.duration(duration.slow)}
        style={[styles.root, { backgroundColor: colors.bgPrimary }]}
      >
        <Animated.View
          entering={SlideInDown.duration(duration.slower).springify()}
          style={styles.inner}
        >
          <ConversationHeader
            videoTitle={videoTitle}
            channelName={channelName}
            platform={headerPlatform}
            remainingMinutes={conv.remainingMinutes}
            onOpenSettings={handleOpenSettings}
            onOpenAddon={handleOpenAddon}
            onClose={onClose}
          />

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            {conv.streaming ? (
              <ContextProgressBanner
                progress={conv.contextProgress}
                complete={conv.contextComplete}
              />
            ) : null}

            <ConversationFeed
              messages={conv.messages}
              isLoading={conv.isLoading}
              onSuggestionPress={handleSuggestion}
            />

            <VoiceControls
              voiceMode={conv.voiceMode}
              isMuted={conv.isMuted}
              elapsedSeconds={conv.elapsedSeconds}
              remainingMinutes={conv.remainingMinutes}
              onToggleMute={conv.toggleMute}
              onEnd={conv.endCall}
            />

            {conv.endedToastVisible ? (
              <EndedToast durationSeconds={conv.elapsedSeconds} />
            ) : null}

            <MiniActionBar
              isFavorite={isFavorite}
              isUpgrading={isUpgrading}
              canViewAnalysis={Boolean(conv.summaryId)}
              onViewAnalysis={handleViewAnalysis}
              onToggleFavorite={handleToggleFavorite}
              onShare={handleShare}
            />

            <ConversationInput
              inputText={inputText}
              setInputText={setInputText}
              onSend={handleSend}
              onMicTap={handleMicTap}
              isLoading={conv.isLoading}
              voiceMode={conv.voiceMode}
              isMuted={conv.isMuted}
              quotaText={quotaText}
            />
          </KeyboardAvoidingView>
        </Animated.View>

        <VoiceSettings bottomSheetRef={settingsSheetRef} />
      </Animated.View>

      <VoiceAddonModal
        visible={addonVisible}
        onClose={() => setAddonVisible(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});

export default ConversationScreen;
