/**
 * DEEP SIGHT — BadgeCard
 * Carte de badge individuel (earned ou locked).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { BadgeItem } from '../../types/gamification';
import { RARITY_COLORS } from '../../types/gamification';

interface BadgeCardProps {
  badge: BadgeItem;
  isEarned?: boolean;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({ badge, isEarned }) => {
  const earned = isEarned ?? badge.earned;
  const rarity = badge.rarity;
  const colors = RARITY_COLORS[rarity];
  const rarityColor = colors?.text ?? '#6366f1';

  return (
    <motion.div
      className="relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-white/5 backdrop-blur-xl transition-all duration-200"
      style={{
        borderColor: earned ? colors?.border ?? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
        opacity: earned ? 1 : 0.5,
      }}
      whileHover={{ y: -3, opacity: 1 }}
      role="article"
      aria-label={`Badge : ${badge.name}${earned ? ' (débloqué)' : ' (verrouillé)'}`}
    >
      {/* Legendary sparkle */}
      {rarity === 'legendary' && (
        <Sparkles
          className="absolute top-2 right-2 w-3.5 h-3.5"
          style={{ color: rarityColor }}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <span className="text-2xl" role="img" aria-hidden="true">
        {badge.icon}
      </span>

      {/* Name */}
      <span
        className="text-xs font-semibold text-center leading-tight"
        style={{ color: earned ? rarityColor : 'rgba(255,255,255,0.5)' }}
      >
        {badge.name}
      </span>

      {/* Description */}
      <span className="text-[10px] text-white/40 text-center leading-snug line-clamp-2">
        {badge.description}
      </span>

      {/* Earned date or progress */}
      {earned && badge.earned_at ? (
        <span className="text-[10px] text-white/30">
          {new Date(badge.earned_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      ) : (
        !earned && badge.progress != null && badge.progress > 0 && (
          <div className="w-full mt-1">
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/20 transition-all duration-300"
                style={{ width: `${Math.min(badge.progress * 100, 100)}%` }}
              />
            </div>
          </div>
        )
      )}
    </motion.div>
  );
};
