/**
 * DEEP SIGHT v9.0 — Premium Badge Component
 * Pill-shaped status indicators with semantic coloring.
 */

import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'violet' | 'cyan' | 'premium';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  default: 'bg-bg-tertiary text-text-secondary border-border-subtle',
  primary: 'bg-accent-primary-muted text-accent-primary-hover border-transparent',
  success: 'bg-accent-success-muted text-accent-success border-transparent',
  warning: 'bg-accent-secondary-muted text-accent-secondary border-transparent',
  error: 'bg-error-muted text-error border-transparent',
  violet: 'bg-accent-violet-muted text-accent-violet border-transparent',
  cyan: 'bg-accent-cyan-muted text-accent-cyan border-transparent',
  premium: 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 border-amber-500/20',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-[0.625rem] gap-1',
  md: 'px-2 py-0.5 text-[0.6875rem] gap-1.5',
  lg: 'px-2.5 py-1 text-xs gap-1.5',
};

const dotColors: Record<string, string> = {
  default: 'bg-text-muted',
  primary: 'bg-accent-primary',
  success: 'bg-accent-success',
  warning: 'bg-accent-secondary',
  error: 'bg-error',
  violet: 'bg-accent-violet',
  cyan: 'bg-accent-cyan',
  premium: 'bg-amber-400',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot,
  icon,
  children,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        whitespace-nowrap select-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
};
