/**
 * DebateVideoCard — Carte vidéo pour un côté du débat (A ou B)
 * Affiche player YouTube/TikTok intégré (ou thumbnail fallback), titre, chaîne, thèse et arguments
 * Supporte YouTube et TikTok avec détection automatique de la plateforme
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, AlertTriangle, Play } from 'lucide-react';
import type { DebateArgument } from '../../types/debate';
import type { VideoPlatform } from '../../types/debate';

interface DebateVideoCardProps {
  side: 'a' | 'b';
  title: string;
  channel: string;
  thumbnail: string;
  videoId: string;
  platform?: VideoPlatform;
  thesis: string;
  arguments: DebateArgument[];
}

const STRENGTH_CONFIG: Record<DebateArgument['strength'], {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  strong: {
    label: 'Fort',
    icon: Shield,
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
  moderate: {
    label: 'Modéré',
    icon: Zap,
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  },
  weak: {
    label: 'Faible',
    icon: AlertTriangle,
    className: 'bg-red-500/15 text-red-400 border-red-500/20',
  },
};

const SIDE_ACCENT = {
  a: {
    border: 'border-indigo-500/30',
    glow: 'shadow-indigo-500/5',
    badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    label: 'Vidéo A',
    gradient: 'from-indigo-500/10 to-transparent',
  },
  b: {
    border: 'border-violet-500/30',
    glow: 'shadow-violet-500/5',
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    label: 'Vidéo B',
    gradient: 'from-violet-500/10 to-transparent',
  },
};

/** Detect platform from video ID format if not explicitly provided */
function detectPlatform(videoId: string, platform?: VideoPlatform): VideoPlatform {
  if (platform && platform !== 'youtube' && platform !== 'tiktok') return 'youtube';
  if (platform) return platform;
  // TikTok IDs are long numeric strings (15-20 digits)
  if (/^\d{10,}$/.test(videoId)) return 'tiktok';
  return 'youtube';
}

export const DebateVideoCard: React.FC<DebateVideoCardProps> = ({
  side,
  title,
  channel,
  thumbnail,
  videoId,
  platform: platformProp,
  thesis,
  arguments: args,
}) => {
  const accent = SIDE_ACCENT[side];
  const [showPlayer, setShowPlayer] = useState(false);
  const platform = detectPlatform(videoId, platformProp);

  // Build thumbnail URL with fallback chain
  const getThumbnailUrl = (): string => {
    if (thumbnail) return thumbnail;
    if (platform === 'youtube' && videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return '';
  };

  const thumbnailUrl = getThumbnailUrl();
  const [imgError, setImgError] = useState(false);

  // YouTube fallback: maxresdefault → hqdefault → mqdefault
  const fallbackThumbnail = platform === 'youtube' && videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : '';

  return (
    <div
      className={`rounded-xl bg-white/5 border ${accent.border} backdrop-blur-xl shadow-lg ${accent.glow} overflow-hidden`}
    >
      {/* Video Player / Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-black/40">
        {showPlayer && videoId ? (
          platform === 'tiktok' ? (
            <iframe
              src={`https://www.tiktok.com/embed/v2/${videoId}`}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
              allowFullScreen
            />
          ) : (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        ) : (
          <>
            {thumbnailUrl && !imgError ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover"
                onError={() => {
                  if (!imgError) setImgError(true);
                }}
              />
            ) : imgError && fallbackThumbnail ? (
              <img
                src={fallbackThumbnail}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              /* Placeholder gradient when no thumbnail */
              <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                platform === 'tiktok'
                  ? 'from-pink-500/20 via-black/40 to-cyan-500/20'
                  : 'from-red-500/20 via-black/40 to-white/5'
              }`}>
                <div className="text-center">
                  <span className="text-3xl">{platform === 'tiktok' ? '🎵' : '▶️'}</span>
                  <p className="text-white/30 text-xs mt-2">
                    {platform === 'tiktok' ? 'TikTok' : 'YouTube'}
                  </p>
                </div>
              </div>
            )}
            <div className={`absolute inset-0 bg-gradient-to-t ${accent.gradient}`} />
            {/* Play button overlay */}
            {videoId && (
              <button
                onClick={() => setShowPlayer(true)}
                className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                aria-label={`Lire ${title}`}
              >
                <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all group-hover:bg-white/20 group-hover:scale-110">
                  <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
                </div>
              </button>
            )}
          </>
        )}
        {/* Badge Vidéo A/B + Platform badge */}
        <span
          className={`absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-md border ${accent.badge} z-10`}
        >
          {accent.label}
        </span>
        {platform === 'tiktok' && (
          <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-black/50 text-white/70 border border-white/10 z-10">
            TikTok
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {title}
          </h3>
          {channel && (
            <p className="text-xs text-white/50 mt-1">{channel}</p>
          )}
        </div>

        {/* Thèse */}
        {thesis && (
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1">
              Thèse
            </p>
            <p className="text-sm text-white/80 leading-relaxed">{thesis}</p>
          </div>
        )}

        {/* Arguments */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Arguments ({args.length})
          </p>
          {args.map((arg, i) => {
            const strength = STRENGTH_CONFIG[arg.strength];
            const Icon = strength.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: side === 'a' ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className="rounded-lg bg-white/[0.03] border border-white/5 p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${strength.className}`}
                  >
                    <Icon className="w-3 h-3" />
                    {strength.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-white/90 font-medium leading-snug">
                      {arg.claim}
                    </p>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                      {arg.evidence}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
