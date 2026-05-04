/**
 * mobile/app/(tabs)/hub.tsx
 *
 * Tab Hub unifié — chat + voice dans une seule UI.
 *   - Pas de summaryId param → HubEmptyState (URL paste + pick conv)
 *   - summaryId param → ConversationContent embedded
 *   - Auto-resolve : si pas de summaryId mais history non-vide → push la 1ère conv
 *   - Drawer multi-conv avec setParams + key remount
 *
 * Source of truth = params Expo Router (deep-link friendly).
 *
 * Spec : `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md` §4.4
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ConversationContent } from "@/components/conversation";
import { ConversationsDrawer } from "@/components/hub/ConversationsDrawer";
import { HubEmptyState } from "@/components/hub/HubEmptyState";
import { historyApi, videoApi } from "@/services/api";
import type { HubConversation } from "@/components/hub/types";
import type { AnalysisSummary } from "@/types";

/**
 * Map AnalysisSummary (retour historyApi.getHistory) → HubConversation
 * (type attendu par ConversationsDrawer). Le drawer n'utilise pas tous les
 * champs ; on remplit ce qui peut l'être.
 */
const toHubConversation = (s: AnalysisSummary): HubConversation => {
  const numericId = Number(s.id);
  // video_source est limité à youtube|tiktok côté drawer (pas "text")
  const source: "youtube" | "tiktok" | undefined =
    s.platform === "youtube" || s.platform === "tiktok"
      ? s.platform
      : undefined;
  return {
    id: numericId,
    summary_id: numericId,
    title: s.title || "Sans titre",
    video_source: source,
    video_thumbnail_url: s.thumbnail ?? null,
    last_snippet: undefined,
    updated_at: s.updatedAt ?? s.createdAt ?? new Date().toISOString(),
  };
};

export default function HubScreen() {
  const params = useLocalSearchParams<{
    summaryId?: string;
    videoUrl?: string;
    initialMode?: "chat" | "call";
    prefillQuery?: string;
  }>();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Quand l'user clique "Nouvelle", on désactive l'auto-resolve pour
  // laisser HubEmptyState s'afficher (sinon le useEffect re-pousse la 1ère conv).
  const [intentNewConv, setIntentNewConv] = useState(false);

  const summaryId = params.summaryId ?? null;
  const initialMode = params.initialMode ?? "chat";
  // prefillQuery : injecté par PassageActionSheet ("Demander à l'IA") ou
  // tout autre deep-link. Capturé une seule fois au mount via useState pour
  // éviter qu'un re-render le re-déclenche après que l'input ait été modifié
  // par l'user. Le param URL est ensuite cleared via setParams.
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(
    params.prefillQuery ?? null,
  );
  useEffect(() => {
    if (params.prefillQuery && pendingPrefill !== params.prefillQuery) {
      setPendingPrefill(params.prefillQuery);
    }
    // Clear le param URL une fois lu pour éviter re-trigger après navigation.
    if (params.prefillQuery) {
      router.setParams({ prefillQuery: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.prefillQuery]);

  // Charger l'historique pour le drawer ET pour fallback last-conv
  const { data: historyData } = useQuery({
    queryKey: ["history", "hub-drawer"],
    queryFn: () => historyApi.getHistory(1, 50),
  });

  const conversations: AnalysisSummary[] = historyData?.items ?? [];
  const drawerConvs: HubConversation[] = useMemo(
    () => conversations.map(toHubConversation),
    [conversations],
  );

  const activeConv = useMemo(
    () => conversations.find((c) => String(c.id) === summaryId) ?? null,
    [conversations, summaryId],
  );

  // Auto-resolve : si pas de summaryId mais history non vide → push le 1er.
  // Désactivé tant que l'user a explicitement demandé une nouvelle conv.
  useEffect(() => {
    if (!summaryId && !intentNewConv && conversations.length > 0) {
      router.setParams({
        summaryId: String(conversations[0].id),
        initialMode: "chat",
      });
    }
  }, [summaryId, intentNewConv, conversations, router]);

  const handleSelectConv = useCallback(
    (id: string | number) => {
      setIntentNewConv(false);
      router.setParams({ summaryId: String(id), initialMode: "chat" });
      setDrawerOpen(false);
    },
    [router],
  );

  const handleNewConv = useCallback(() => {
    setIntentNewConv(true);
    // setParams(undefined) clear la query (Expo Router)
    router.setParams({ summaryId: undefined, initialMode: undefined });
    setDrawerOpen(false);
  }, [router]);

  const handlePasteUrl = useCallback(
    async (url: string) => {
      try {
        const result = await videoApi.quickChat(url);
        setIntentNewConv(false);
        router.setParams({
          summaryId: String(result.summary_id),
          initialMode: "chat",
        });
      } catch (err: unknown) {
        const e = err as { message?: string; detail?: string };
        const msg =
          e?.message || e?.detail || "Impossible de démarrer la conversation.";
        Alert.alert("Erreur", msg);
      }
    },
    [router],
  );

  // Active conv platform pour ConversationContent header
  const headerPlatform: "youtube" | "tiktok" =
    activeConv?.platform === "tiktok" ? "tiktok" : "youtube";

  return (
    <View style={styles.root}>
      {summaryId ? (
        <ConversationContent
          key={summaryId}
          summaryId={summaryId}
          initialMode={initialMode}
          videoTitle={activeConv?.title ?? "Conversation"}
          channelName={activeConv?.channel}
          platform={headerPlatform}
          initialFavorite={activeConv?.isFavorite ?? false}
          onMenuPress={() => setDrawerOpen(true)}
          prefillQuery={pendingPrefill}
          onPrefillConsumed={() => setPendingPrefill(null)}
        />
      ) : (
        <HubEmptyState
          onPickConv={() => setDrawerOpen(true)}
          onPasteUrl={handlePasteUrl}
        />
      )}

      <ConversationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={drawerConvs}
        activeConvId={summaryId ? Number(summaryId) : null}
        onSelect={handleSelectConv}
        onNewConv={handleNewConv}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
});
