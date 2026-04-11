/**
 * TournesolPicks — Mini video recommendation cards from Tournesol community.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Play, Star } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { VideoCandidate } from '../../../services/api';

interface TournesolPicksProps {
  picks: VideoCandidate[];
  isLoading: boolean;
  onRefresh: () => void;
  onAnalyze: (videoId: string) => void;
}

export const TournesolPicks: React.FC<TournesolPicksProps> = ({
  picks,
  isLoading,
  onRefresh,
  onAnalyze,
}) => {
  const { language } = useLanguage();

  return (
    <div className="space-y-2">
      {/* Section title */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs font-semibold text-accent-primary uppercase tracking-wider flex items-center gap-1.5">
          <img src="/platforms/tournesol-icon.svg" alt="" className="w-3.5 h-3.5 opacity-80" />
          {language === 'fr' ? 'Picks Tournesol' : 'Tournesol Picks'}
        </h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 rounded-md text-text-tertiary hover:text-accent-primary hover:bg-white/5 transition-all disabled:opacity-40"
          title={language === 'fr' ? 'Rafraîchir' : 'Refresh'}
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Video cards */}
      <div className="space-y-1.5">
        {picks.length === 0 && !isLoading && (
          <p className="text-xs text-text-tertiary italic py-2">
            {language === 'fr' ? 'Aucune recommandation' : 'No recommendations'}
          </p>
        )}

        {isLoading && picks.length === 0 && (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-white/[0.02] border border-border-subtle p-2 animate-pulse">
                <div className="flex gap-2">
                  <div className="w-12 h-7 rounded bg-white/5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-2.5 bg-white/5 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {picks.map((video, index) => (
          <motion.div
            key={video.video_id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            className="group rounded-lg bg-white/[0.02] border border-border-subtle hover:border-accent-primary/20 hover:bg-white/[0.04] p-2 transition-all cursor-pointer"
            onClick={() => onAnalyze(video.video_id)}
          >
            <div className="flex gap-2">
              {/* Thumbnail */}
              <div className="w-12 h-7 rounded overflow-hidden flex-shrink-0 bg-white/5 relative">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-3 h-3 text-text-tertiary" />
                  </div>
                )}
                {/* Play overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play className="w-3 h-3 text-white fill-white" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-primary font-medium leading-tight line-clamp-2">
                  {video.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {video.tournesol_score != null && (
                    <span className="flex items-center gap-0.5 text-[10px] text-accent-primary font-medium">
                      <Star className="w-2.5 h-2.5 fill-accent-primary" />
                      {Math.round(video.tournesol_score)}
                    </span>
                  )}
                  {video.channel && (
                    <span className="text-[10px] text-text-tertiary truncate">
                      {video.channel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
