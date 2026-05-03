// frontend/src/components/hub/HubAnalysisPanel.tsx
//
// Wrapper de AnalysisHub pour l'embed dans /hub. Ne porte plus la tab bar
// interne (déléguée à HubTabBar globale). Plus de wrapper card — le panel
// remplit directement la zone TabPanel du HubPage.
//
// Reçoit `activeTab` du HubPage et le forward à AnalysisHub en mode controlled.

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnalysisHub } from "../AnalysisHub";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
  User,
} from "../../services/api";
import type { TabId } from "./types";

interface Props {
  selectedSummary: Summary | null;
  concepts: EnrichedConcept[];
  reliability: ReliabilityResult | null;
  reliabilityLoading: boolean;
  user: User | null;
  language: "fr" | "en";
  /** Onglet actif piloté par HubPage — exclut "chat" (rendu hors AnalysisHub). */
  activeTab: Exclude<TabId, "chat">;
  /** Callback pour switch d'onglet depuis liens internes synthesis-tab. */
  onTabChange: (tab: Exclude<TabId, "chat">) => void;
}

export const HubAnalysisPanel: React.FC<Props> = ({
  selectedSummary,
  concepts,
  reliability,
  reliabilityLoading,
  user,
  language,
  activeTab,
  onTabChange,
}) => {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const handleTimecodeClick = useCallback((_seconds: number) => {
    /* no-op v1 */
  }, []);
  const handleOpenChat = useCallback((_msg?: string) => {
    // L'onglet Chat est géré par le parent HubPage (hors AnalysisHub).
    // Ce callback est gardé pour compat AnalysisHub mais delegated au parent
    // via la prop onTabChange qui ne supporte que les tabs analyse.
  }, []);

  if (!selectedSummary) return null;

  const analysisUser = {
    plan: user?.plan,
    credits: user?.credits,
  };

  return (
    <div className="px-4 py-4 w-full">
      <AnalysisHub
        selectedSummary={selectedSummary}
        reliabilityData={reliability}
        reliabilityLoading={reliabilityLoading}
        user={analysisUser}
        language={language}
        concepts={concepts}
        onTimecodeClick={handleTimecodeClick}
        onOpenChat={handleOpenChat}
        onNavigate={handleNavigate}
        enabledTabs={["synthesis", "reliability", "quiz", "flashcards", "geo"]}
        showKeywords
        showStudyTools={false}
        showVoice={false}
        activeTabExternal={activeTab}
        onTabChange={onTabChange}
        hideInternalTabBar
      />
    </div>
  );
};
