/**
 * DEEP SIGHT — AnalysisHub / SynthesisTab
 * Onglet Synthèse : toolbar (copy/cite/export) + contenu enrichi
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Copy,
  Check,
  GraduationCap,
  Brain,
  Tags,
  Mic,
  Download,
  ChevronDown,
  FileText,
  FileDown,
  Share2,
  Headphones,
} from "lucide-react";
import { DeepSightSpinnerMicro } from "../ui";
import { AudioPlayerButton } from "../AudioPlayerButton";
import { AudioSummaryButton } from "../AudioSummaryButton";
import { EnrichedMarkdown } from "../EnrichedMarkdown";
import { DeepResearchSources } from "../SummaryReader";
import { ConceptsGlossary } from "../ConceptsGlossary";
import { AcademicSourcesPanel } from "../academic";
import { AnalysisValueDisplay } from "../AnalysisValueDisplay";
import { CitationExport } from "../CitationExport";
import { StudyToolsModal } from "../StudyToolsModal";
import { KeywordsModal } from "../KeywordsModal";
import { AnalysisActionBar } from "../analysis/AnalysisActionBar";
import { videoApi, shareApi } from "../../services/api";
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
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // Optional toolbar features (used in History context)
  const [showStudyToolsModal, setShowStudyToolsModal] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const [keywordsConcepts, setKeywordsConcepts] = useState<EnrichedConcept[]>(
    [],
  );
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // Position the portal menu under the Export button
  const updateMenuPos = useCallback(() => {
    if (exportBtnRef.current) {
      const rect = exportBtnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - 176), // 176 = w-44 = 11rem
      });
    }
  }, []);

  // Close export menu on click outside + scroll/resize
  useEffect(() => {
    if (!showExportMenu) return;
    updateMenuPos();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node) &&
        exportBtnRef.current &&
        !exportBtnRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    const handleScrollOrResize = () => setShowExportMenu(false);
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [showExportMenu, updateMenuPos]);

  const handleCopy = async () => {
    if (!selectedSummary?.summary_content) return;
    try {
      await navigator.clipboard.writeText(selectedSummary.summary_content);
    } catch {
      /* clipboard API unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!selectedSummary?.video_id || sharing) return;
    setSharing(true);
    try {
      const { share_url } = await shareApi.createShareLink(
        selectedSummary.video_id,
      );
      if (navigator.share) {
        await navigator.share({
          title: selectedSummary.video_title
            ? `DeepSight — ${selectedSummary.video_title}`
            : "DeepSight Analysis",
          url: share_url,
        });
      } else {
        await navigator.clipboard.writeText(share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // Fallback clipboard
      try {
        const { share_url } = await shareApi.createShareLink(
          selectedSummary.video_id,
        );
        await navigator.clipboard.writeText(share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        console.error("Share failed");
      }
    } finally {
      setSharing(false);
    }
  };

  const handleExport = async (format: "pdf" | "md" | "txt") => {
    if (!selectedSummary?.id) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const blob = await videoApi.exportSummary(selectedSummary.id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "md" ? "md" : format;
      a.download = `${selectedSummary.video_title || "analyse"}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Keywords handler (loads enriched concepts on demand)
  const handleOpenKeywords = useCallback(() => {
    setShowKeywordsModal(true);
    if (selectedSummary?.id && keywordsConcepts.length === 0) {
      setKeywordsLoading(true);
      videoApi
        .getEnrichedConcepts(selectedSummary.id)
        .then((data: any) => setKeywordsConcepts(data.concepts || []))
        .catch(() => setKeywordsConcepts([]))
        .finally(() => setKeywordsLoading(false));
    }
  }, [selectedSummary?.id, keywordsConcepts.length]);

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

        {/* Temps économisé — F7 : guard durée > 0 (sinon affiche "~0 sec absurde"). */}
        {(selectedSummary.video_duration ?? 0) > 0 && (
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
        )}
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
