/**
 * DEEP SIGHT — AnalysisHub / SynthesisTab
 * Onglet Synthèse : toolbar (copy/cite/export) + contenu enrichi
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen, Copy, Check, GraduationCap, Brain, Tags, Mic,
  Download, ChevronDown, FileText, FileDown, Share2, Loader2, Headphones
} from 'lucide-react';
import { DeepSightSpinnerMicro } from '../ui';
import { AudioPlayerButton } from '../AudioPlayerButton';
import { AudioSummaryButton } from '../AudioSummaryButton';
import { EnrichedMarkdown } from '../EnrichedMarkdown';
import { DeepResearchSources } from '../SummaryReader';
import { ConceptsGlossary } from '../ConceptsGlossary';
import { AcademicSourcesPanel } from '../academic';
import { AnalysisValueDisplay } from '../AnalysisValueDisplay';
import { CitationExport } from '../CitationExport';
import { StudyToolsModal } from '../StudyToolsModal';
import { KeywordsModal } from '../KeywordsModal';
import { videoApi, shareApi } from '../../services/api';
import { sanitizeTitle } from '../../utils/sanitize';
import type { Summary, EnrichedConcept } from '../../services/api';
import type { TimecodeInfo } from '../TimecodeRenderer';

interface SynthesisTabProps {
  selectedSummary: Summary;
  user: { plan?: string };
  language: 'fr' | 'en';
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
  const [keywordsConcepts, setKeywordsConcepts] = useState<EnrichedConcept[]>([]);
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
        exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node) &&
        exportBtnRef.current && !exportBtnRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    const handleScrollOrResize = () => setShowExportMenu(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showExportMenu, updateMenuPos]);


  const handleCopy = async () => {
    if (!selectedSummary?.summary_content) return;
    try {
      await navigator.clipboard.writeText(selectedSummary.summary_content);
    } catch { /* clipboard API unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!selectedSummary?.video_id || sharing) return;
    setSharing(true);
    try {
      const { share_url } = await shareApi.createShareLink(selectedSummary.video_id);
      if (navigator.share) {
        await navigator.share({
          title: selectedSummary.video_title ? `DeepSight — ${selectedSummary.video_title}` : 'DeepSight Analysis',
          url: share_url,
        });
      } else {
        await navigator.clipboard.writeText(share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      // Fallback clipboard
      try {
        const { share_url } = await shareApi.createShareLink(selectedSummary.video_id);
        await navigator.clipboard.writeText(share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch { console.error('Share failed'); }
    } finally {
      setSharing(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'md' | 'txt') => {
    if (!selectedSummary?.id) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const blob = await videoApi.exportSummary(selectedSummary.id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'md' ? 'md' : format;
      a.download = `${selectedSummary.video_title || 'analyse'}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // Keywords handler (loads enriched concepts on demand)
  const handleOpenKeywords = useCallback(() => {
    setShowKeywordsModal(true);
    if (selectedSummary?.id && keywordsConcepts.length === 0) {
      setKeywordsLoading(true);
      videoApi.getEnrichedConcepts(selectedSummary.id)
        .then((data: any) => setKeywordsConcepts(data.concepts || []))
        .catch(() => setKeywordsConcepts([]))
        .finally(() => setKeywordsLoading(false));
    }
  }, [selectedSummary?.id, keywordsConcepts.length]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 border-b border-border-subtle">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent-primary" />
          {language === 'fr' ? 'Synthèse' : 'Summary'}
          {selectedSummary?.summary_content && (
            <AudioPlayerButton text={selectedSummary.summary_content.slice(0, 5000)} size="sm" />
          )}
        </h3>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap pb-2 sm:pb-0">
          {/* Copy */}
          <button
            onClick={handleCopy}
            className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
          >
            {copied ? <Check className="w-4 h-4 text-accent-success" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}</span>
          </button>

          {/* Citation */}
          <button
            onClick={() => setShowCitationModal(true)}
            className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
            title={language === 'fr' ? 'Générer une citation académique' : 'Generate academic citation'}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'fr' ? 'Citer' : 'Cite'}</span>
          </button>

          {/* Audio Summary — Podcast Mode */}
          <AudioSummaryButton
            summaryId={selectedSummary.id}
            videoTitle={sanitizeTitle(selectedSummary.video_title || '')}
            language={language}
            compact
          />

          {/* Study Tools (optional — History context) */}
          {showStudyTools && (
            <button
              onClick={() => setShowStudyToolsModal(true)}
              className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
              title={language === 'fr' ? 'Fiches de révision et arbre pédagogique' : 'Study cards and concept map'}
            >
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Réviser' : 'Study'}</span>
            </button>
          )}

          {/* Keywords (optional — History context) */}
          {showKeywords && (
            <button
              onClick={handleOpenKeywords}
              className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
              title={language === 'fr' ? 'Voir les mots-clés extraits' : 'View extracted keywords'}
            >
              <Tags className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Mots-clés' : 'Keywords'}</span>
            </button>
          )}

          {/* Voice Chat (optional — History context) */}
          {showVoice && voiceEnabled && onOpenVoice && (
            <button
              onClick={onOpenVoice}
              className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Vocal' : 'Voice'}</span>
            </button>
          )}

          {/* Export */}
          <div className="flex-shrink-0">
            <button
              ref={exportBtnRef}
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn btn-ghost text-xs min-h-[36px] sm:min-h-[32px]"
              disabled={exporting}
            >
              {exporting ? <DeepSightSpinnerMicro /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showExportMenu && createPortal(
              <div
                ref={exportMenuRef}
                className="fixed w-44 bg-bg-elevated border border-border-default rounded-lg shadow-xl py-1 animate-fadeIn"
                style={{ top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
              >
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2 transition-colors"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button
                  onClick={() => handleExport('md')}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2 transition-colors"
                >
                  <FileDown className="w-4 h-4" /> Markdown
                </button>
                <div className="border-t border-border-subtle my-1" />
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    const audioBtn = document.querySelector('[data-audio-summary-btn]') as HTMLButtonElement;
                    if (audioBtn) audioBtn.click();
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2 transition-colors"
                >
                  <Headphones className="w-4 h-4" /> Audio (podcast)
                </button>
              </div>,
              document.body
            )}
          </div>

          {/* Share */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
            title={shareCopied ? (language === 'fr' ? 'Lien copié !' : 'Link copied!') : (language === 'fr' ? 'Partager l\'analyse' : 'Share analysis')}
          >
            {sharing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : shareCopied ? (
              <Check className="w-4 h-4 text-accent-success" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {shareCopied ? (language === 'fr' ? 'Copié !' : 'Copied!') : (language === 'fr' ? 'Partager' : 'Share')}
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 prose max-w-none">
        <EnrichedMarkdown
          language={language}
          onTimecodeClick={onTimecodeClick}
          className="text-text-primary"
        >
          {selectedSummary.summary_content || ''}
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
            userPlan={user?.plan || 'free'}
            onUpgrade={() => onNavigate('/pricing')}
            language={language}
          />
        </div>

        {/* Sources croisées — Deep Research */}
        {selectedSummary.deep_research && selectedSummary.enrichment_sources && (
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
            keyPointsCount={selectedSummary.summary_content?.split('##').length - 1 || 0}
            conceptsCount={concepts.length}
            showUpgradeCTA={user?.plan === 'free' || user?.plan === 'student'}
            compact={false}
          />
        </div>
      </div>

      {/* Citation Modal */}
      <CitationExport
        isOpen={showCitationModal}
        onClose={() => setShowCitationModal(false)}
        video={{
          title: sanitizeTitle(selectedSummary.video_title || 'Vidéo sans titre'),
          channel: sanitizeTitle(selectedSummary.video_channel || 'Chaîne inconnue'),
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
          videoTitle={sanitizeTitle(selectedSummary.video_title || 'Vidéo')}
          language={language}
        />
      )}

      {/* Keywords Modal (optional — History context) */}
      {showKeywords && (
        <KeywordsModal
          isOpen={showKeywordsModal}
          onClose={() => setShowKeywordsModal(false)}
          videoTitle={sanitizeTitle(selectedSummary.video_title || 'Vidéo')}
          concepts={keywordsConcepts}
          loading={keywordsLoading}
        />
      )}
    </div>
  );
};
