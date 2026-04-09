/**
 * AudioSummaryButton — "Écouter la synthèse" button with loading state
 * v1.0 — Triggers audio summary generation, opens floating player
 *
 * Usage:
 *   <AudioSummaryButton
 *     summaryId={123}
 *     videoTitle="Titre de la vidéo"
 *   />
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AudioSummaryPlayer } from './AudioSummaryPlayer';
import api from '../services/api';

interface AudioSummaryButtonProps {
  summaryId: number;
  videoTitle?: string;
  language?: 'fr' | 'en';
  className?: string;
  compact?: boolean;
}

export const AudioSummaryButton: React.FC<AudioSummaryButtonProps> = ({
  summaryId,
  videoTitle,
  language = 'fr',
  className = '',
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [audioData, setAudioData] = useState<{
    audio_url: string;
    duration_estimate: number;
  } | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (audioData) {
      // Already generated — just show player
      setShowPlayer(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.generateAudioSummary(summaryId, { language });
      setAudioData({
        audio_url: response.audio_url,
        duration_estimate: response.duration_estimate,
      });
      setShowPlayer(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la génération';
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, [summaryId, language, audioData]);

  return (
    <>
      {/* Button */}
      <motion.button
        data-audio-summary-btn
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGenerate}
        disabled={isLoading}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-xl
          bg-gradient-to-r from-indigo-500/20 to-violet-500/20
          border border-indigo-500/30 hover:border-indigo-400/50
          text-indigo-300 hover:text-indigo-200
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${className}
        `}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" />
            {!compact && <span className="text-sm">Génération...</span>}
          </>
        ) : audioData ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
              <polygon points="5,3 19,12 5,21" fill="currentColor" />
            </svg>
            {!compact && <span className="text-sm">Réécouter</span>}
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            {!compact && <span className="text-sm">Écouter la synthèse</span>}
          </>
        )}
      </motion.button>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 mt-1">{error}</div>
      )}

      {/* Floating Player */}
      {showPlayer && audioData && (
        <AudioSummaryPlayer
          audioUrl={audioData.audio_url}
          title={videoTitle}
          durationEstimate={audioData.duration_estimate}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </>
  );
};

export default AudioSummaryButton;
