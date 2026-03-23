/**
 * DebateVideoCard — Carte vidéo pour un côté du débat (A ou B)
 * Affiche thumbnail, titre, chaîne, thèse et arguments avec badges de force
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, AlertTriangle } from 'lucide-react';
import type { DebateArgument } from '../../types/debate';

interface DebateVideoCardProps {
  side: 'a' | 'b';
  title: string;
  channel: string;
  thumbnail: string;
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

export const DebateVideoCard: React.FC<DebateVideoCardProps> = ({
  side,
  title,
  channel,
  thumbnail,
  thesis,
  arguments: args,
}) => {
  const accent = SIDE_ACCENT[side];

  return (
    <div
      className={`rounded-xl bg-white/5 border ${accent.border} backdrop-blur-xl shadow-lg ${accent.glow} overflow-hidden`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${accent.gradient}`} />
        <span
          className={`absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-md border ${accent.badge}`}
        >
          {accent.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-white/50 mt-1">{channel}</p>
        </div>

        {/* Thèse */}
        <div className={`rounded-lg bg-white/[0.03] border border-white/5 p-3`}>
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1">
            Thèse
          </p>
          <p className="text-sm text-white/80 leading-relaxed">{thesis}</p>
        </div>

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
