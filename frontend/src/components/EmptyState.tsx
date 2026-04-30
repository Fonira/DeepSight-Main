import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface SuggestedVideo {
  title: string;
  thumbnailUrl: string;
  href: string;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  suggestedVideo?: SuggestedVideo;
  className?: string;
}

/**
 * Composant générique d'état vide réutilisable.
 *
 * Usage minimal :
 *   <EmptyState icon={History} title="..." description="..." />
 *
 * Avec CTA navigation :
 *   <EmptyState ... ctaLabel="..." ctaHref="/dashboard" />
 *
 * Avec CTA action :
 *   <EmptyState ... ctaLabel="..." onCta={() => doSomething()} />
 *
 * Avec suggestion vidéo (optionnel) :
 *   <EmptyState ... suggestedVideo={{ title, thumbnailUrl, href }} />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
  suggestedVideo,
  className = "",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <div className="w-14 h-14 mb-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl flex items-center justify-center">
        <Icon className="w-7 h-7 text-cyan-400/40" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-text-secondary mb-2">
        {title}
      </h3>
      <p className="text-sm text-text-tertiary max-w-sm mb-6">{description}</p>

      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors"
        >
          {ctaLabel}
        </a>
      )}
      {ctaLabel && !ctaHref && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-gray-900 text-sm font-medium hover:bg-accent-primary-hover transition-colors"
        >
          {ctaLabel}
        </button>
      )}

      {suggestedVideo && (
        <a
          href={suggestedVideo.href}
          className="mt-8 flex items-center gap-3 max-w-xs p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.06] transition-colors"
        >
          <img
            src={suggestedVideo.thumbnailUrl}
            alt={suggestedVideo.title}
            className="w-16 h-9 rounded-md object-cover flex-shrink-0"
          />
          <span className="text-sm text-text-secondary text-left line-clamp-2">
            {suggestedVideo.title}
          </span>
        </a>
      )}
    </motion.div>
  );
};

export default EmptyState;
