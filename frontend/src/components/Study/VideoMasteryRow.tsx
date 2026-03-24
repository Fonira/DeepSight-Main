/**
 * DEEP SIGHT — VideoMasteryRow
 * Ligne de vidéo dans la liste des vidéos avec maîtrise.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';
import type { VideoMastery } from '../../types/gamification';
import { MasteryRing } from './MasteryRing';

interface VideoMasteryRowProps {
  video: VideoMastery;
  onStart: (summaryId: number) => void;
}

export const VideoMasteryRow: React.FC<VideoMasteryRowProps> = ({
  video,
  onStart,
}) => {
  const dueCards = video.due_cards ?? 0;
  const hasDue = dueCards > 0;
  const title = video.title ?? `Vidéo #${video.summary_id}`;
  const channel = video.channel ?? '';

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Jamais';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <motion.div
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-transparent bg-white/[0.02] transition-colors duration-200 hover:bg-white/5 hover:border-indigo-500/20"
      whileHover={{ x: 2 }}
      role="listitem"
    >
      {/* Thumbnail / emoji */}
      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 text-lg">
        🎬
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {channel && (
            <span className="text-[11px] text-white/40 truncate">{channel}</span>
          )}
          {channel && <span className="text-[10px] text-white/25">·</span>}
          <span className="text-[11px] text-white/30">
            {video.total_cards ?? 0} cartes
          </span>
          <span className="text-[10px] text-white/25">·</span>
          <span className="text-[11px] text-white/30">
            {formatDate(video.last_studied)}
          </span>
        </div>
      </div>

      {/* Mastery ring */}
      <div className="flex-shrink-0">
        <MasteryRing percent={Math.round(video.mastery_percent ?? 0)} size={40} strokeWidth={4} />
      </div>

      {/* Due badge */}
      {hasDue && (
        <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-indigo-500/15 text-[11px] font-medium text-indigo-300">
          {dueCards} dues
        </span>
      )}

      {/* Action button */}
      <button
        type="button"
        onClick={() => onStart(video.summary_id)}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
          hasDue
            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
            : 'border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
        }`}
        aria-label={hasDue ? `Réviser ${title}` : `Revoir ${title}`}
      >
        {hasDue ? (
          <>
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Réviser
          </>
        ) : (
          <>
            <Play className="w-3 h-3" aria-hidden="true" />
            Revoir
          </>
        )}
      </button>
    </motion.div>
  );
};
