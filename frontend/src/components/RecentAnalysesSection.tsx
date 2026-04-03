/**
 * DEEP SIGHT — RecentAnalysesSection
 * Affiche les 3 dernières analyses récentes avec thumbnail sur la page d'accueil.
 * Caché si l'utilisateur n'a aucune analyse.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Play, ChevronRight } from 'lucide-react';
import { videoApi } from '../services/api';
import type { Summary } from '../services/api';
import { ThumbnailImage } from './ThumbnailImage';

interface RecentAnalysesSectionProps {
  language: 'fr' | 'en';
  onVideoSelect: (videoId: string) => void;
  /** If the user just analyzed a video, skip showing recent */
  hidden?: boolean;
}

/** Format relative time (e.g. "il y a 2h", "hier") */
function formatRelativeTime(dateStr: string, lang: 'fr' | 'en'): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (lang === 'fr') {
    if (diffMin < 1) return 'à l\'instant';
    if (diffMin < 60) return `il y a ${diffMin}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/** Format duration in mm:ss */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const RecentAnalysesSection: React.FC<RecentAnalysesSectionProps> = ({
  language,
  onVideoSelect,
  hidden = false,
}) => {
  const [recent, setRecent] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      try {
        const { items } = await videoApi.getHistory({ limit: 3, page: 1 });
        if (!cancelled) setRecent(items || []);
      } catch {
        // Silently fail — section just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRecent();
    return () => { cancelled = true; };
  }, []);

  // Don't render if hidden, loading, or no recent analyses
  if (hidden || loading || recent.length === 0) return null;

  return (
    <div className="mb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent-primary" />
          {language === 'fr' ? 'Reprendre où vous en étiez' : 'Pick up where you left off'}
        </h2>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {recent.map((item) => (
          <button
            key={item.id}
            onClick={() => onVideoSelect(item.video_id)}
            className="group card overflow-hidden text-left hover:border-accent-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-accent-primary/5 hover:scale-[1.01]"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-bg-tertiary">
              <ThumbnailImage
                thumbnailUrl={item.thumbnail_url}
                videoId={item.video_id}
                title={item.video_title}
                category={item.category}
                className="w-full h-full object-cover"
              />
              {/* Play overlay on hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="w-4 h-4 text-bg-primary ml-0.5" />
                </div>
              </div>
              {/* Duration badge */}
              {item.video_duration && (
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                  {formatDuration(item.video_duration)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="text-sm font-medium text-text-primary line-clamp-2 leading-snug mb-1 group-hover:text-accent-primary transition-colors">
                {item.video_title}
              </h3>
              <div className="flex items-center justify-between text-xs text-text-tertiary">
                <span className="truncate max-w-[60%]">{item.video_channel}</span>
                <span className="flex-shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(item.created_at, language)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
