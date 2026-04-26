/**
 * DEEP SIGHT — AnalysisHub / SynthesisTab
 * Onglet Synthèse : toolbar (copy/cite/export) + contenu enrichi
 */

import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { AudioPlayerButton } from "../AudioPlayerButton";
import { EnrichedMarkdown } from "../EnrichedMarkdown";
import { DeepResearchSources } from "../SummaryReader";
import { ConceptsGlossary } from "../ConceptsGlossary";
import { AcademicSourcesPanel } from "../academic";
import { AnalysisValueDisplay } from "../AnalysisValueDisplay";
import { CitationExport } from "../CitationExport";
import { StudyToolsModal } from "../StudyToolsModal";
import { KeywordsModal } from "../KeywordsModal";
import { AnalysisActionBar } from "../analysis/AnalysisActionBar";
import { sanitizeTitle } from "../../utils/sanitize";
import type { Summary, EnrichedConcept } from "../../services/api";
import type { TimecodeInfo } from "../TimecodeRenderer";

interface SynthesisTabProps {
  selectedSummary: Summary;
  user: { plan?: string };
  language: "fr" | "en";
  concepts: EnrichedConcept[];
  onTimecodeClick: (seconds: number, info?: TimecodeInfo) => void;
  onNavigate: (path: string) => void;
  /** Show Keywords button in toolbar (History context) */
  showKeywords?: boolean;
  /** Show Study Tools button in toolbar (History context) */
  showStudyTools?: boolean;
  /** Show Voice Chat button in toolbar (History context) */
  showVoice?: boolean;
  /** Voice chat enabled for user's plan */
  voiceEnabled?: boolean;
  /** Callback to open voice modal */
  onOpenVoice?: () => void;
}

export const SynthesisTab: React.FC<SynthesisTabProps> = ({
  selectedSummary,
  user,
  language,
  concepts,
  onTimecodeClick,
  onNavigate,
  showKeywords = false,
  showStudyTools = false,
  showVoice = false,
  voiceEnabled = false,
  onOpenVoice,
}) => {
  // Modal state — copy/share/export/keywords are handled by AnalysisActionBar
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [showStudyToolsModal, setShowStudyToolsModal] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const [keywordsConcepts] = useState<EnrichedConcept[]>([]);
  const [keywordsLoading] = useState(false);

  return (
    <div>
      {/* Toolbar v2 — Unified Action Bar */}
      <div className="p-4 sm:p-5 border-b border-border-subtle">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-accent-primary" />
          <h3 className="font-semibold text-text-primary">
            {language === "fr" ? "Synthèse" : "Summary"}
          </h3>
          {selectedSummary?.summary_content && (
            <AudioPlayerButton
              text={selectedSummary.summary_content.slice(0, 5000)}
              size="sm"
            />
          )}
        </div>
        <AnalysisActionBar
          summary={{
            id: selectedSummary.id,
            video_id: selectedSummary.video_id,
            video_title: selectedSummary.video_title,
            summary_content: selectedSummary.summary_content,
          }}
          language={language}
          onOpenVoice={showVoice && voiceEnabled ? onOpenVoice : undefined}
          onOpenStudyTools={
            showStudyTools ? () => setShowStudyToolsModal(true) : undefined
          }
          onOpenCitation={() => setShowCitationModal(true)}
          showStudyTools={showStudyTools}
          showCitation={true}
          sticky={false}
        />
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 prose max-w-none">
        <EnrichedMarkdown
          language={language}
          onTimecodeClick={onTimecodeClick}
          className="text-text-primary"
        >
          {selectedSummary.summary_content || ""}
        </EnrichedMarkdown>

        {/* Glossaire des concepts */}
        <div className="mt-6">
          <ConceptsGlossary
            summaryId={selectedSummary.id}
            language={language}
          />
        </div>

        {/* Sources académiques */}
        <div className="mt-6 not-prose">
          <AcademicSourcesPanel
            summaryId={selectedSummary.id.toString()}
            userPlan={user?.plan || "free"}
            onUpgrade={() => onNavigate("/pricing")}
            language={language}
          />
        </div>

        {/* Sources croisées — Deep Research */}
        {selectedSummary.deep_research &&
          selectedSummary.enrichment_sources && (
            <div className="mt-6 not-prose">
              <DeepResearchSources
                enrichmentSources={selectedSummary.enrichment_sources}
                language={language}
              />
            </div>
          )}

        {/* Temps économisé */}
        <div className="mt-6 not-prose">
          <AnalysisValueDisplay
            videoDuration={selectedSummary.video_duration || 0}
            keyPointsCount={
              selectedSummary.summary_content?.split("##").length - 1 || 0
            }
            conceptsCount={concepts.length}
            showUpgradeCTA={user?.plan === "free" || user?.plan === "student"}
            compact={false}
          />
        </div>
      </div>

      {/* Citation Modal */}
      <CitationExport
        isOpen={showCitationModal}
        onClose={() => setShowCitationModal(false)}
        video={{
          title: sanitizeTitle(
            selectedSummary.video_title || "Vidéo sans titre",
          ),
          channel: sanitizeTitle(
            selectedSummary.video_channel || "Chaîne inconnue",
          ),
          videoId: selectedSummary.video_id,
          publishedDate: selectedSummary.created_at,
          duration: selectedSummary.video_duration,
        }}
        language={language}
      />

      {/* Study Tools Modal (optional — History context) */}
      {showStudyTools && (
        <StudyToolsModal
          isOpen={showStudyToolsModal}
          onClose={() => setShowStudyToolsModal(false)}
          summaryId={selectedSummary.id}
          videoTitle={sanitizeTitle(selectedSummary.video_title || "Vidéo")}
          language={language}
        />
      )}

      {/* Keywords Modal (optional — History context) */}
      {showKeywords && (
        <KeywordsModal
          isOpen={showKeywordsModal}
          onClose={() => setShowKeywordsModal(false)}
          videoTitle={sanitizeTitle(selectedSummary.video_title || "Vidéo")}
          concepts={keywordsConcepts}
          loading={keywordsLoading}
        />
      )}
    </div>
  );
};
