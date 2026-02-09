/**
 * DEEP SIGHT v8.0 — Premium Card Components
 * Glassmorphism, hover glow, mouse-tracking gradient, Framer Motion
 */

import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddings: Record<string, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = 'default',
  padding = 'md',
  hover = true,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const variants: Record<string, string> = {
    default: 'bg-bg-secondary border border-border-subtle',
    glass: 'bg-bg-surface backdrop-blur-xl border border-border-subtle',
    elevated: 'bg-bg-elevated border border-border-default shadow-md',
    interactive: 'bg-bg-secondary border border-border-subtle cursor-pointer',
  };

  const hoverClass = hover
    ? variant === 'interactive'
      ? 'hover:border-border-accent hover:shadow-glow-sm hover:-translate-y-0.5'
      : 'hover:border-border-default hover:shadow-md hover:-translate-y-px'
    : '';

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`
        rounded-lg transition-all duration-200 ease-out relative group overflow-hidden
        ${variants[variant]}
        ${hoverClass}
        ${paddings[padding]}
        ${className}
      `}
      whileHover={hover ? { scale: 1.005 } : undefined}
      whileTap={variant === 'interactive' ? { scale: 0.995 } : undefined}
      {...(props as Record<string, unknown>)}
    >
      {/* Mouse-tracking gradient overlay */}
      {hover && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-lg"
          style={{
            background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, var(--accent-primary-muted) 0%, transparent 60%)`
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`pb-4 mb-4 border-b border-border-subtle ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`pt-4 mt-4 border-t border-border-subtle flex items-center gap-3 ${className}`} {...props}>
    {children}
  </div>
);
