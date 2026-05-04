import React from "react";
import { RecentsList, RecentAnalysis } from "../components/RecentsList";
import { VideoDetectedCard } from "../components/VideoDetectedCard";
import { UrlInputCard } from "../components/UrlInputCard";
import { PlanBadge } from "../components/PlanBadge";
import { QuickSearch } from "../components/QuickSearch";
import { CurrentTabInfo } from "../hooks/useCurrentTab";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { extractYouTubeVideoId } from "../../utils/video";
import type { SearchResult } from "../../types/search";

interface User {
  plan: "free" | "etudiant" | "starter" | "pro" | "equipe";
  creditsLeft: number;
}

export interface HomeViewProps {
  user: User;
  recents: RecentAnalysis[];
  currentTab: CurrentTabInfo;
  videoMeta?: { title: string; thumbnail: string };
  onAnalyze: (url: string) => void;
  onSelectRecent: (recent: RecentAnalysis) => void;
  onUpgrade: () => void;
}

export function HomeView({
  user,
  recents,
  currentTab,
  videoMeta,
  onAnalyze,
  onSelectRecent,
  onUpgrade,
}: HomeViewProps): JSX.Element {
  const isOnVideo =
    currentTab.platform !== null &&
    currentTab.url !== null &&
    videoMeta !== undefined;

  // Phase 4 — extension light tier : si l'utilisateur clique un résultat
  // dont le video_id correspond à la vidéo YouTube actuellement ouverte
  // dans l'onglet actif → on saute au timestamp directement plutôt que
  // d'ouvrir une page web. Sinon on garde le pattern existant : ouvrir
  // /summary/{id} dans un nouvel onglet web (cf. spec § 6.2 + plan task 7).
  //
  // Re-query l'onglet courant au moment du click (pas du mount) pour
  // éviter les stale tabIds après un changement d'onglet.
  const handleSelectSearchResult = async (
    result: SearchResult,
  ): Promise<void> => {
    const targetVideoId = result.source_metadata?.video_id;
    const startTs = result.source_metadata?.start_ts;

    if (targetVideoId) {
      try {
        const tabs = await Browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const activeTab = tabs[0];
        const activeTabId = activeTab?.id;
        const activeTabUrl = activeTab?.url ?? null;
        const activeVideoId = activeTabUrl
          ? extractYouTubeVideoId(activeTabUrl)
          : null;

        if (
          activeTabId !== undefined &&
          activeVideoId &&
          activeVideoId === targetVideoId
        ) {
          // Match — dispatch au content script du tab actif.
          await Browser.tabs.sendMessage(activeTabId, {
            action: "JUMP_TO_TIMESTAMP",
            ts: typeof startTs === "number" ? startTs : 0,
          });
          return;
        }
      } catch {
        // Best-effort : si la query/sendMessage échoue, on retombe sur
        // le comportement par défaut (ouvrir l'analyse en web).
      }
    }

    if (result.summary_id !== null && result.summary_id !== undefined) {
      Browser.tabs.create({
        url: `${WEBAPP_URL}/summary/${result.summary_id}`,
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PlanBadge
        plan={user.plan}
        creditsLeft={user.creditsLeft}
        onUpgrade={onUpgrade}
      />

      {isOnVideo && videoMeta && currentTab.url && currentTab.platform ? (
        <VideoDetectedCard
          title={videoMeta.title}
          thumbnail={videoMeta.thumbnail}
          platform={currentTab.platform}
          onAnalyze={() => onAnalyze(currentTab.url!)}
        />
      ) : (
        <UrlInputCard onSubmit={onAnalyze} />
      )}

      {/* Phase 4 Semantic Search V1 (light tier) — au-dessus de la liste Recents */}
      <QuickSearch onSelectResult={handleSelectSearchResult} />

      <div
        style={{
          padding: "8px 16px",
          fontSize: 11,
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Récent
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <RecentsList recents={recents} onSelect={onSelectRecent} />
      </div>
    </div>
  );
}
