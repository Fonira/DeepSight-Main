/**
 * ConversationContent — Contenu unifié (chat + voice) du mode conversation,
 * sans wrapper Modal. Utilisable :
 *   - embedded en tab (Hub) — passer `onMenuPress` pour le burger
 *   - dans un Modal (via wrapper `ConversationScreen`) — passer `onClose`
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
 * Spec : `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md` §4.2
 */

import React, { useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
} from "react-native";
import * as Haptics from "expo-haptics";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useConversation } from "../../hooks/useConversation";
import { historyApi } from "../../services/api";
import { VoiceSettings } from "../voice/VoiceSettings";
import VoiceAddonModal from "../voice/VoiceAddonModal";
import { HubAnalysisSheet } from "../hub/HubAnalysisSheet";
import { ConversationHeader } from "./ConversationHeader";
import { ConversationFeed } from "./ConversationFeed";
import { ConversationInput } from "./ConversationInput";
import { ContextProgressBanner } from "./ContextProgressBanner";
import { VoiceControls } from "./VoiceControls";
import { EndedToast } from "./EndedToast";
import { MiniActionBar } from "./MiniActionBar";

export interface ConversationContentProps {
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
  /** Hub tab : burger ouvre ConversationsDrawer. Si null/absent : pas de burger. */
  onMenuPress?: () => void;
  /** Modal mode : close button. Si null/absent : pas de close. */
  onClose?: () => void;
}

export const ConversationContent: React.FC<ConversationContentProps> = ({
  summaryId,
  videoUrl,
  initialMode,
  videoTitle,
  channelName,
  platform = "youtube",
  initialFavorite = false,
  onMenuPress,
  onClose,
}) => {
  const settingsSheetRef = useRef<BottomSheet | null>(null);
  const summarySheetRef = useRef<BottomSheet | null>(null);
  const [addonVisible, setAddonVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isFavorite, setIsFavorite] = useState(initialFavorite);

  const conv = useConversation({
    summaryId,
    videoUrl,
    initialMode,
    onError: (msg) => {
      if (__DEV__) console.warn("[ConversationContent] error:", msg);
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

  const handleShowSummary = useCallback(() => {
    if (!conv.summaryId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    summarySheetRef.current?.expand();
  }, [conv.summaryId]);

  const handleCloseSummary = useCallback(() => {
    summarySheetRef.current?.close();
  }, []);

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
    <>
      <ConversationHeader
        videoTitle={videoTitle}
        channelName={channelName}
        platform={headerPlatform}
        remainingMinutes={conv.remainingMinutes}
        onOpenSettings={handleOpenSettings}
        onOpenAddon={handleOpenAddon}
        onMenuPress={onMenuPress}
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
          canShowSummary={Boolean(conv.summaryId)}
          onShowSummary={handleShowSummary}
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

      <VoiceSettings bottomSheetRef={settingsSheetRef} />

      <VoiceAddonModal
        visible={addonVisible}
        onClose={() => setAddonVisible(false)}
      />

      <HubAnalysisSheet
        ref={summarySheetRef}
        summaryId={conv.summaryId ?? null}
        onClose={handleCloseSummary}
      />
    </>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export default ConversationContent;
