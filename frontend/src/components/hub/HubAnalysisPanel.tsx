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
import { HighlightedText } from "../highlight/HighlightedText";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
  User,
  WithinMatch,
} from "../../services/api";
import type { TabId } from "./types";

/**
 * Map HubTabBar tab id ("synthesis" | "reliability" | "quiz" | "flashcards" |
 * "geo") to the WithinMatch tab vocabulary expected by the highlight chain
 * ("synthesis" | "digest" | "flashcards" | "quiz" | "chat" | "transcript").
 *
 * Only "synthesis", "flashcards" and "quiz" overlap. Tabs without a backend
 * counterpart (reliability, geo) fall back to "synthesis" — the HighlightedText
 * filter then renders zero marks for them, which is the desired no-op.
 */
const toMatchTab = (
  tab: Exclude<TabId, "chat">,
): WithinMatch["tab"] => {
  switch (tab) {
    case "synthesis":
    case "flashcards":
    case "quiz":
      return tab;
    default:
      return "synthesis";
  }
};

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
      <HighlightedText
        tab={toMatchTab(activeTab)}
        onMarkClick={(_id, match) => {
          // Bubble up the click + bounding rect to HubPage so it can position
          // and open the ExplainTooltip. Using a CustomEvent keeps this
          // component decoupled from the highlight provider/tooltip wiring.
          const el = document.querySelector<HTMLElement>(
            `mark.ds-highlight[data-passage-id="${match.passage_id}"]`,
          );
          const rect = el?.getBoundingClientRect() ?? null;
          window.dispatchEvent(
            new CustomEvent("ds-highlight-click", {
              detail: { match, rect },
            }),
          );
        }}
      >
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
          enabledTabs={[
            "synthesis",
            "reliability",
            "quiz",
            "flashcards",
            "geo",
            "visual",
          ]}
          showKeywords
          showStudyTools={false}
          showVoice={false}
          activeTabExternal={activeTab}
          onTabChange={onTabChange}
          hideInternalTabBar
        />
      </HighlightedText>
    </div>
  );
};
