/**
 * DEEP SIGHT v9.0 — Premium Skeleton Loading
 * Shimmer effect with gradient animation. No spinners.
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  /** Width as Tailwind class or inline style */
  width?: string;
  /** Height as Tailwind class or inline style */
  height?: string;
  /** Shape: default rectangle, circle, or pill */
  variant?: 'rect' | 'circle' | 'pill' | 'text';
  /** Number of text lines to render */
  lines?: number;
  /** Animate or static */
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'rect',
  lines,
  animate = true,
}) => {
  const baseClass = `
    bg-gradient-to-r from-bg-tertiary via-bg-hover to-bg-tertiary
    bg-[length:200%_100%]
    ${animate ? 'animate-shimmer' : ''}
  `;

  if (variant === 'text' || lines) {
    const count = lines || 3;
    return (
      <div className={`space-y-2.5 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`${baseClass} h-3.5 rounded-sm ${
              i === count - 1 ? 'w-3/5' : 'w-full'
            }`}
          />
        ))}
      </div>
    );
  }

  const shapeClass =
    variant === 'circle'
      ? 'rounded-full aspect-square'
      : variant === 'pill'
        ? 'rounded-full'
        : 'rounded-md';

  return (
    <div
      className={`${baseClass} ${shapeClass} ${className}`}
      style={{
        width: width || undefined,
        height: height || undefined,
      }}
    />
  );
};

/** Card-shaped skeleton for loading states */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-lg border border-border-subtle bg-bg-secondary p-5 space-y-4 ${className}`}>
    <div className="flex items-center gap-3">
      <Skeleton variant="circle" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <Skeleton variant="text" lines={3} />
    <div className="flex gap-2 pt-2">
      <Skeleton variant="pill" className="h-6 w-16" />
      <Skeleton variant="pill" className="h-6 w-20" />
    </div>
  </div>
);

/** Row skeleton for table/list loading */
export const SkeletonRow: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-4 py-3 ${className}`}>
    <Skeleton variant="rect" className="h-10 w-10 rounded-md" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
    <Skeleton variant="pill" className="h-6 w-16" />
  </div>
);
