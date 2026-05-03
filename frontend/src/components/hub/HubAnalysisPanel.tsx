// frontend/src/components/hub/HubAnalysisPanel.tsx
//
// Wrapper inline du composant AnalysisHub pour l'embed dans /hub, juste sous
// le SummaryCollapsible et au-dessus de la Timeline. Remplace l'ancien
// HubToolbox léger (3 boutons) par le panneau complet à 5 onglets : Synthèse
// (avec mots-clés), Quiz, Flashcards, Fiabilité, GEO.
//
// Style : container `rounded-2xl border-white/10 bg-white/[0.02]`, largeur
// `max-w-3xl mx-auto` pour s'aligner sur la Timeline et SummaryCollapsible.
// Les onglets sont contrôlés par AnalysisHub lui-même (state local).
//
// Props : `selectedSummary` (Summary complet) + `concepts` + `reliability` +
// `reliabilityLoading` injectés depuis HubPage (qui les hydrate dans le
// hubStore via les API videoApi/reliabilityApi).
//
// Callbacks v1 :
//   - onTimecodeClick : no-op (l'utilisateur clique sur les timecodes du
//     SummaryCollapsible qui sont déjà câblés). V2 : wire au PiP player.
//   - onOpenChat : no-op (l'InputBar du Hub est déjà visible en bas — on
//     pourrait scroll-to-input + autofocus en V2).

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnalysisHub } from "../AnalysisHub";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
  User,
} from "../../services/api";

interface HubAnalysisPanelProps {
  /** Summary complet (hydraté via videoApi.getSummary). */
  selectedSummary: Summary | null;
  /** Concepts enrichis (hydratés via videoApi.getEnrichedConcepts). */
  concepts: EnrichedConcept[];
  /** Reliability data (hydraté via reliabilityApi.getReliability). */
  reliability: ReliabilityResult | null;
  /** True pendant le fetch reliability. */
  reliabilityLoading: boolean;
  /** Utilisateur courant — utilisé par AnalysisHub pour les gates plan/credits. */
  user: User | null;
  /** Langue UI. */
  language: "fr" | "en";
}

/**
 * Renders nothing if there's nothing to show. We require AT LEAST a
 * `selectedSummary` to render — without it, AnalysisHub has no synthesis to
 * display. We then show the panel as soon as there is content (concepts) or a
 * reliability result, OR if the user is authenticated (so empty states like
 * "Generate quiz" remain accessible). For a guest viewing a fresh analysis
 * with no concepts/reliability cached yet, we still render so the synthesis
 * tab shows the markdown content.
 */
export const HubAnalysisPanel: React.FC<HubAnalysisPanelProps> = ({
  selectedSummary,
  concepts,
  reliability,
  reliabilityLoading,
  user,
  language,
}) => {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  // v1 no-ops : timecodes du Hub passent déjà via SummaryCollapsible, et
  // l'InputBar est toujours présente en bas du Hub.
  const handleTimecodeClick = useCallback((_seconds: number) => {
    /* no-op */
  }, []);
  const handleOpenChat = useCallback((_msg?: string) => {
    /* no-op */
  }, []);

  if (!selectedSummary) return null;

  // Adapter `User | null` au shape attendu par AnalysisHubProps : `{ plan?, credits? }`.
  const analysisUser = {
    plan: user?.plan,
    credits: user?.credits,
  };

  return (
    <div className="px-4 mb-3 w-full">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div>
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
            ]}
            showKeywords
            showStudyTools={false}
            showVoice={false}
          />
        </div>
      </div>
    </div>
  );
};
