/**
 * DEEP SIGHT — AnalysisHub / ReliabilityTab
 * Onglet Fiabilité : fraîcheur + fact-check + deep research sources
 */

import React from 'react';
import { Shield } from 'lucide-react';
import { FreshnessIndicator } from '../FreshnessIndicator';
import { FactCheckLite } from '../FactCheckLite';
import { DeepResearchSources } from '../SummaryReader';
import type { Summary, ReliabilityResult } from '../../services/api';

interface ReliabilityTabProps {
  selectedSummary: Summary;
  reliabilityData: ReliabilityResult | null;
  reliabilityLoading: boolean;
  language: 'fr' | 'en';
  onOpenChat: (prefillMessage?: string) => void;
  onNavigate: (path: string) => void;
}

export const ReliabilityTab: React.FC<ReliabilityTabProps> = ({
  selectedSummary,
  reliabilityData,
  reliabilityLoading,
  language,
  onOpenChat,
  onNavigate,
}) => {
  // Loading state
  if (reliabilityLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="animate-pulse bg-bg-tertiary rounded-xl h-32" />
        <div className="animate-pulse bg-bg-tertiary rounded-xl h-48" />
      </div>
    );
  }

  // No data
  if (!reliabilityData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-5">
          <Shield className="w-8 h-8 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {language === 'fr' ? 'Données de fiabilité' : 'Reliability Data'}
        </h3>
        <p className="text-text-secondary text-sm text-center max-w-md">
          {language === 'fr'
            ? 'Les données de fiabilité ne sont pas encore disponibles pour cette analyse.'
            : 'Reliability data is not yet available for this analysis.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Indicateur de fraîcheur */}
      {reliabilityData?.freshness?.warning_level !== 'none' && (
        <FreshnessIndicator
          summaryId={selectedSummary.id}
          videoTitle={selectedSummary.video_title}
          freshnessData={reliabilityData?.freshness}
          onRequestVerification={() => {
            onOpenChat(
              language === 'fr'
                ? 'Peux-tu vérifier si les informations de cette vidéo sont toujours à jour ?'
                : 'Can you verify if the information in this video is still up to date?'
            );
          }}
        />
      )}

      {/* Fact-Check LITE */}
      {reliabilityData?.fact_check_lite && (
        <FactCheckLite
          summaryId={selectedSummary.id}
          reliabilityData={reliabilityData}
          onUpgrade={() => onNavigate('/pricing')}
        />
      )}

      {/* Sources croisées — Deep Research */}
      {selectedSummary.deep_research && selectedSummary.enrichment_sources && (
        <DeepResearchSources
          enrichmentSources={selectedSummary.enrichment_sources}
          language={language}
        />
      )}

      {/* Empty reliability sections */}
      {!reliabilityData?.freshness?.warning_level || reliabilityData?.freshness?.warning_level === 'none' ? (
        !reliabilityData?.fact_check_lite && (
          <div className="text-center py-8">
            <p className="text-text-tertiary text-sm">
              {language === 'fr'
                ? 'Aucun problème de fiabilité détecté pour cette vidéo.'
                : 'No reliability issues detected for this video.'}
            </p>
          </div>
        )
      ) : null}
    </div>
  );
};
