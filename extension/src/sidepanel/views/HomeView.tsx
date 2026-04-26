import React from "react";
import { RecentsList, RecentAnalysis } from "../components/RecentsList";
import { VideoDetectedCard } from "../components/VideoDetectedCard";
import { UrlInputCard } from "../components/UrlInputCard";
import { PlanBadge } from "../components/PlanBadge";
import { CurrentTabInfo } from "../hooks/useCurrentTab";

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
