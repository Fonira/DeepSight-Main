// mobile/app/(tabs)/hub.tsx
//
// Hub conversationnel mobile - mirror de frontend/src/pages/HubPage.tsx.
// Donnees mock pour l'instant (sampleData.ts). Wire-up backend (videoApi.getHistory + chatApi.getHistory)
// dans une PR ulterieure.
//
// Architecture :
//   <SafeAreaView>
//     <DoodleBackground />               background ambient sparse
//     <HubHeader />                      sticky top : burger / logo / titre / pip slot
//     <SummaryCollapsible />              card collapsible
//     <Timeline messages={} />            FlashList
//     <InputBar />                        bottom : + / input / send|phone+mic
//     <SourcesShelf />                    pill mono bottom
//   <ConversationsDrawer />              modal slide-in gauche
//   <CallModeFullBleed />                modal slide-up plein ecran
//   <VideoPiPPlayer expanded />           overlay quand expanded=true

import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import {
  CallModeFullBleed,
  ConversationsDrawer,
  HubHeader,
  InputBar,
  type HubConversation,
  type HubMessage,
  SAMPLE_CONVERSATIONS,
  SAMPLE_MESSAGES,
  SAMPLE_SUMMARY_CONTEXT,
  SourcesShelf,
  SummaryCollapsible,
  Timeline,
  VideoPiPPlayer,
} from "@/components/hub";

const newId = () =>
  typeof crypto !== "undefined" && (crypto as Crypto).randomUUID
    ? (crypto as Crypto).randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function HubScreen() {
  // ── Local mock state - sera remplace par useHubStore (Zustand) en V2 ──
  const [conversations] = useState<HubConversation[]>(SAMPLE_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<number | null>(1);
  const [messages, setMessages] = useState<HubMessage[]>(SAMPLE_MESSAGES);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [pipExpanded, setPipExpanded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const handleSend = useCallback((text: string) => {
    const userMsg: HubMessage = {
      id: newId(),
      role: "user",
      content: text,
      source: "text",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Simulate AI thinking response (mock for visual proto)
    setIsThinking(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content:
            "Reponse simulee (mock). Le wire-up backend (chatApi.send) sera fait dans une PR ulterieure.",
          source: "text",
          timestamp: Date.now(),
        },
      ]);
      setIsThinking(false);
    }, 900);
  }, []);

  const handlePttHoldComplete = useCallback((_durationSecs: number) => {
    setVoiceCallOpen(true);
  }, []);

  const handleSelectConv = useCallback((id: number) => {
    setActiveConvId(id);
    // En V2 : trigger fetch chatApi.getHistory(id)
  }, []);

  const handleNewConv = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="light" />
      <View style={styles.bgWrap} pointerEvents="none">
        <DoodleBackground variant="default" density="low" />
      </View>

      <HubHeader
        onMenuClick={() => setDrawerOpen(true)}
        title={activeConv?.title ?? "Hub"}
        subtitle={
          activeConv
            ? `${activeConv.video_source?.toUpperCase() ?? "YOUTUBE"} · ${SAMPLE_SUMMARY_CONTEXT.video_duration_secs ? "18:32" : ""} · analysee il y a 12 min`
            : undefined
        }
        videoSource={activeConv?.video_source ?? null}
        pipSlot={
          activeConv?.summary_id ? (
            <VideoPiPPlayer
              thumbnailUrl={activeConv.video_thumbnail_url ?? null}
              title={activeConv.title}
              durationSecs={SAMPLE_SUMMARY_CONTEXT.video_duration_secs}
              expanded={false}
              onExpand={() => setPipExpanded(true)}
              onShrink={() => setPipExpanded(false)}
            />
          ) : null
        }
      />

      <View style={styles.body}>
        {activeConvId !== null ? (
          <SummaryCollapsible context={SAMPLE_SUMMARY_CONTEXT} />
        ) : null}
        <Timeline messages={messages} isThinking={isThinking} />
        <InputBar
          onSend={handleSend}
          onCallToggle={() => setVoiceCallOpen(!voiceCallOpen)}
          onPttHoldComplete={handlePttHoldComplete}
          disabled={activeConvId === null}
        />
        <View style={styles.shelfWrap}>
          <SourcesShelf compact />
        </View>
      </View>

      {pipExpanded && activeConv?.summary_id ? (
        <VideoPiPPlayer
          thumbnailUrl={activeConv.video_thumbnail_url ?? null}
          title={activeConv.title}
          durationSecs={SAMPLE_SUMMARY_CONTEXT.video_duration_secs}
          expanded
          onExpand={() => setPipExpanded(true)}
          onShrink={() => setPipExpanded(false)}
        />
      ) : null}

      <ConversationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={handleSelectConv}
        onNewConv={handleNewConv}
      />

      <CallModeFullBleed
        open={voiceCallOpen}
        onClose={() => setVoiceCallOpen(false)}
        summaryId={activeConv?.summary_id ?? null}
        title={activeConv?.title ?? null}
        subtitle={null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    flex: 1,
    flexDirection: "column",
  },
  shelfWrap: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: "center",
  },
});
