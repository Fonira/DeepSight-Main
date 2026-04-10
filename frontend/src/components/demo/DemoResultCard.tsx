/**
 * DemoResultCard — Carte de resultat demo ultra-court pour la landing page.
 * Affiche thumbnail, metadata, points cles animes, conclusion et keywords.
 */

import { motion } from 'framer-motion';
import type { DemoAnalyzeResult } from '../../services/api';

interface DemoResultCardProps {
  result: DemoAnalyzeResult;
}

export default function DemoResultCard({ result }: DemoResultCardProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="relative backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        {/* Gradient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />

        {/* Video header */}
        <div className="relative flex gap-4 p-5 border-b border-white/5">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-white/5">
            {result.thumbnail_url ? (
              <img
                src={result.thumbnail_url}
                alt={result.video_title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>

          {/* Video info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2">
              {result.video_title}
            </h3>
            <p className="text-white/50 text-xs mt-1">{result.video_channel}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/60">
                {formatDuration(result.video_duration)}
              </span>
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] text-indigo-300">
                {result.category}
              </span>
              <span className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-[10px] text-violet-300">
                {result.platform === 'tiktok' ? 'TikTok' : 'YouTube'}
              </span>
            </div>
          </div>
        </div>

        {/* Key points */}
        <div className="relative p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              Points cles
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/20 to-transparent" />
          </div>

          <ul className="space-y-2.5">
            {result.key_points.map((point, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.15, duration: 0.4 }}
                className="flex items-start gap-2.5"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-indigo-400 text-[10px] font-bold">{index + 1}</span>
                </span>
                <span className="text-white/80 text-sm leading-relaxed">{point}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Conclusion */}
        {result.conclusion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="px-5 pb-4"
          >
            <div className="p-3 rounded-lg bg-gradient-to-r from-violet-500/5 to-indigo-500/5 border border-white/5">
              <p className="text-white/70 text-sm italic leading-relaxed">
                {result.conclusion}
              </p>
            </div>
          </motion.div>
        )}

        {/* Keywords */}
        {result.keywords.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.4 }}
            className="px-5 pb-5"
          >
            <div className="flex flex-wrap gap-1.5">
              {result.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-full text-[11px] text-white/40"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* DeepSight badge */}
        <div className="px-5 pb-4 flex items-center justify-between">
          <span className="text-[10px] text-white/20">
            Analyse par DeepSight AI
          </span>
          <span className="text-[10px] text-white/20">
            Version demo
          </span>
        </div>
      </div>
    </motion.div>
  );
}
