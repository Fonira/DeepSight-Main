/**
 * AcademicSourcesPanel Component
 * Main panel for displaying and searching academic sources related to an analysis.
 */

import React, { useState, useCallback } from 'react';
import {
  GraduationCap,
  Search,
  AlertCircle,
  FileText,
  RefreshCw,
  Download,
  Lock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { DeepSightSpinner } from '../ui';
import { academicApi, AcademicPaper } from '../../services/api';
import { hasFeature, getLimit, normalizePlanId } from '../../config/planPrivileges';
import { PaperCard } from './PaperCard';
import { BibliographyModal } from './BibliographyModal';

interface AcademicSourcesPanelProps {
  summaryId: string;
  userPlan?: string;
  onUpgrade?: () => void;
  language?: 'fr' | 'en';
}

export const AcademicSourcesPanel: React.FC<AcademicSourcesPanelProps> = ({
  summaryId,
  userPlan = 'free',
  onUpgrade,
  language = 'en',
}) => {
  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierLimitReached, setTierLimitReached] = useState(false);
  const [tierLimit, setTierLimit] = useState<number | null>(null);
  const [totalFound, setTotalFound] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  const plan = normalizePlanId(userPlan);
  const canSearch = hasFeature(plan, 'academicSearch');
  const canExport = hasFeature(plan, 'bibliographyExport');
  // Note: paperLimit is available via getLimit(plan, 'academicPapersPerAnalysis') if needed

  const t = (fr: string, en: string) => language === 'fr' ? fr : en;

  const handleSearch = useCallback(async () => {
    if (!canSearch) {
      onUpgrade?.();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await academicApi.enrich(summaryId);
      setPapers(response.papers);
      setTotalFound(response.total_found);
      setTierLimitReached(response.tier_limit_reached);
      setTierLimit(response.tier_limit || null);
      setSearched(true);
    } catch (err: any) {
      console.error('Academic search error:', err);
      setError(err.message || t('Erreur lors de la recherche', 'Search failed'));
    } finally {
      setLoading(false);
    }
  }, [summaryId, canSearch, onUpgrade, t]);

  const handleSelectPaper = (paper: AcademicPaper) => {
    setSelectedPapers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(paper.id)) {
        newSet.delete(paper.id);
      } else {
        newSet.add(paper.id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPapers.size === papers.length) {
      setSelectedPapers(new Set());
    } else {
      setSelectedPapers(new Set(papers.map((p) => p.id)));
    }
  };

  const handleExport = () => {
    if (!canExport) {
      onUpgrade?.();
      return;
    }

    if (selectedPapers.size === 0) {
      return;
    }

    setShowExportModal(true);
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className="panel-header cursor-pointer"
        onClick={() => searched && setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-accent-primary" />
          <h3 className="font-semibold text-text-primary">
            {t('Sources Académiques', 'Academic Sources')}
          </h3>
          {searched && papers.length > 0 && (
            <span className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
              {papers.length} / {totalFound}
            </span>
          )}
        </div>
        {searched && (
          <button className="p-1 hover:bg-bg-hover rounded transition-colors">
            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            ) : (
              <ChevronUp className="w-4 h-4 text-text-tertiary" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {/* Initial state - Search button */}
          {!searched && !loading && (
            <div className="text-center py-6">
              <p className="text-text-secondary text-sm mb-4 max-w-md mx-auto">
                {t(
                  'Trouvez des articles scientifiques liés à cette analyse via Semantic Scholar, OpenAlex et arXiv.',
                  'Find scientific papers related to this analysis from Semantic Scholar, OpenAlex, and arXiv.'
                )}
              </p>
              <button
                onClick={handleSearch}
                className="btn btn-primary"
              >
                <Search className="w-4 h-4" />
                {t('Rechercher des sources', 'Find Sources')}
              </button>
              {plan === 'free' && (
                <p className="text-xs text-text-tertiary mt-2">
                  {t('3 résultats max en plan gratuit', 'Max 3 results on free plan')}
                </p>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <DeepSightSpinner size="md" label={t('Recherche en cours...', 'Searching...')} showLabel />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-error" />
              </div>
              <p className="text-text-secondary text-sm mb-4">{error}</p>
              <button
                onClick={handleSearch}
                className="btn btn-secondary"
              >
                <RefreshCw className="w-4 h-4" />
                {t('Réessayer', 'Retry')}
              </button>
            </div>
          )}

          {/* Results */}
          {searched && !loading && !error && (
            <>
              {papers.length === 0 ? (
                /* Empty state */
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-text-muted" />
                  </div>
                  <p className="text-text-secondary text-sm">
                    {t(
                      'Aucune source académique trouvée pour ce contenu.',
                      'No academic sources found for this content.'
                    )}
                  </p>
                </div>
              ) : (
                <>
                  {/* Actions bar */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-subtle">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center gap-2 text-sm text-accent-primary hover:underline"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedPapers.size === papers.length
                          ? 'bg-accent-primary border-accent-primary'
                          : 'border-border-default'
                      }`}>
                        {selectedPapers.size === papers.length && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      {selectedPapers.size === papers.length
                        ? t('Tout désélectionner', 'Deselect all')
                        : t('Tout sélectionner', 'Select all')}
                    </button>

                    <button
                      onClick={handleExport}
                      disabled={selectedPapers.size === 0}
                      className="btn btn-secondary text-xs"
                    >
                      {canExport ? (
                        <Download className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      {t('Exporter', 'Export')} ({selectedPapers.size})
                    </button>
                  </div>

                  {/* Paper list */}
                  <div className="space-y-3">
                    {papers.map((paper) => (
                      <PaperCard
                        key={paper.id}
                        paper={paper}
                        onSelect={handleSelectPaper}
                        isSelected={selectedPapers.has(paper.id)}
                      />
                    ))}
                  </div>

                  {/* Tier limit warning */}
                  {tierLimitReached && (
                    <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {t(
                              `${totalFound - (tierLimit || 0)} résultats supplémentaires disponibles`,
                              `${totalFound - (tierLimit || 0)} more results available`
                            )}
                          </p>
                          <p className="text-xs text-text-secondary mt-1">
                            {t(
                              'Passez à un forfait supérieur pour voir plus de sources.',
                              'Upgrade to see more sources.'
                            )}
                          </p>
                        </div>
                        <button
                          onClick={onUpgrade}
                          className="btn btn-primary btn-sm"
                        >
                          {t('Mettre à niveau', 'Upgrade')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Export modal */}
      <BibliographyModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        paperIds={Array.from(selectedPapers)}
        summaryId={summaryId}
        userPlan={userPlan}
        onUpgrade={onUpgrade}
      />
    </div>
  );
};

export default AcademicSourcesPanel;
