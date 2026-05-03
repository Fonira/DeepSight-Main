import React from "react";
import { RecentsList, RecentAnalysis } from "../components/RecentsList";
import { VideoDetectedCard } from "../components/VideoDetectedCard";
import { UrlInputCard } from "../components/UrlInputCard";
import { PlanBadge } from "../components/PlanBadge";
import { QuickSearch } from "../components/QuickSearch";
import { CurrentTabInfo } from "../hooks/useCurrentTab";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
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

  // Phase 4 — extension light tier : on ouvre l'analyse directement dans
  // l'app web (pas d'AnalysisView autonome côté extension). Cohérent avec
  // le footer "Voir tous sur deepsightsynthesis.com" et avec le pattern
  // existant des recents (`v3-recent-item` ouvre /summary/{id} dans nouvel
  // onglet web — cf. spec § 6.2 + plan task 7).
  const handleSelectSearchResult = (result: SearchResult) => {
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
