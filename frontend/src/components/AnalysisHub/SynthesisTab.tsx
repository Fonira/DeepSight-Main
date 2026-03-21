/**
 * DEEP SIGHT — AnalysisHub / SynthesisTab
 * Onglet Synthèse : toolbar (copy/cite/export) + contenu enrichi
 */

import React, { useState } from 'react';
import {
  BookOpen, Copy, Check, GraduationCap,
  Download, ChevronDown, FileText, FileDown
} from 'lucide-react';
import { DeepSightSpinnerMicro } from '../ui';
import { AudioPlayerButton } from '../AudioPlayerButton';
import { EnrichedMarkdown } from '../EnrichedMarkdown';
import { DeepResearchSources } from '../SummaryReader';
import { ConceptsGlossary } from '../ConceptsGlossary';
import { AcademicSourcesPanel } from '../academic';
import { AnalysisValueDisplay } from '../AnalysisValueDisplay';
import { CitationExport } from '../CitationExport';
import { videoApi } from '../../services/api';
import type { Summary, EnrichedConcept } from '../../services/api';
import type { TimecodeInfo } from '../TimecodeRenderer';

interface SynthesisTabProps {
  selectedSummary: Summary;
  user: { plan?: string };
  language: 'fr' | 'en';
  concepts: EnrichedConcept[];
  onTimecodeClick: (seconds: number, info?: TimecodeInfo) => void;
  onNavigate: (path: string) => void;
}

export const SynthesisTab: React.FC<SynthesisTabProps> = ({
  selectedSummary,
  user,
  language,
  concepts,
  onTimecodeClick,
  onNavigate,
}) => {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);

  const handleCopy = async () => {
    if (!selectedSummary?.summary_content) return;
    try {
      await navigator.clipboard.writeText(selectedSummary.summary_content);
    } catch { /* clipboard API unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: 'pdf' | 'md' | 'txt') => {
    if (!selectedSummary?.id) return;
    setExporting(true);
    setShowExportMenu(false);
    const formatMap: Record<string, 'pdf' | 'markdown' | 'text'> = { pdf: 'pdf', md: 'markdown', txt: 'text' };
    try {
      const blob = await videoApi.exportSummary(selectedSummary.id, formatMap[format]);
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
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
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

          {/* Export */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn btn-ghost text-xs min-h-[36px] sm:min-h-[32px]"
              disabled={exporting}
            >
              {exporting ? <DeepSightSpinnerMicro /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-bg-elevated border border-border-default rounded-lg shadow-lg z-10 py-1">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button
                  onClick={() => handleExport('md')}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" /> Markdown
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Texte
                </button>
              </div>
            )}
          </div>
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
          title: selectedSummary.video_title || 'Vidéo sans titre',
          channel: selectedSummary.video_channel || 'Chaîne inconnue',
          videoId: selectedSummary.video_id,
          publishedDate: selectedSummary.created_at,
          duration: selectedSummary.video_duration,
        }}
        language={language}
      />
    </div>
  );
};
