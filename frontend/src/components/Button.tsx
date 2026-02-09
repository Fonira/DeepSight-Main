/**
 * DEEP SIGHT v8.0 — Premium Button Component
 * With press effects, glow hover, loading spinner, Framer Motion
 */

import React from "react";
import { motion } from 'framer-motion';

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  ariaLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      children,
      className = "",
      disabled,
      icon,
      iconRight,
      fullWidth,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none relative select-none";

    const variants: Record<string, string> = {
      primary:
        "bg-accent-primary text-white shadow-sm hover:bg-accent-primary-hover hover:shadow-glow-sm active:scale-[0.98] active:shadow-none",
      secondary:
        "bg-bg-tertiary text-text-primary border border-border-default hover:bg-bg-hover hover:border-border-strong active:scale-[0.98]",
      ghost:
        "text-text-secondary hover:text-text-primary hover:bg-bg-hover active:bg-bg-active",
      accent:
        "bg-gradient-to-br from-accent-primary to-accent-violet text-white shadow-sm hover:shadow-glow hover:brightness-110 active:scale-[0.98]",
      danger:
        "bg-error text-white hover:bg-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-[0.98]",
    };

    const sizes: Record<string, string> = {
      xs: "px-2 py-1 text-xs gap-1",
      sm: "px-3 py-1.5 text-[0.8125rem] gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-5 py-2.5 text-[0.9375rem] gap-2",
      xl: "px-6 py-3 text-base gap-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        aria-label={ariaLabel}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              aria-hidden="true"
            />
            <span className="sr-only">Loading...</span>
            {children}
          </span>
        ) : (
          <>
            {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
            {children && <span>{children}</span>}
            {iconRight && <span className="flex-shrink-0" aria-hidden="true">{iconRight}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

/** Premium CTA button with animated gradient glow */
export const AnalyzeButton: React.FC<ButtonProps> = ({
  children,
  className = '',
  loading,
  disabled,
  ariaLabel,
  ...props
}) => {
  return (
    <motion.button
      className={`
        relative group px-8 py-3.5 rounded-lg font-semibold text-base
        bg-gradient-to-r from-accent-primary via-accent-violet to-accent-primary
        text-white
        shadow-lg shadow-accent-primary/25
        overflow-hidden
        disabled:opacity-40 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
        ${className}
      `}
      style={{ backgroundSize: '200% 100%' }}
      whileHover={{
        scale: 1.02,
        backgroundPosition: '100% 0',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      aria-label={ariaLabel || "Analyze video"}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      disabled={disabled || loading}
      {...(props as Record<string, unknown>)}
    >
      {/* Glow effect behind button */}
      <span
        className="absolute inset-0 -z-10 rounded-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 blur-xl bg-gradient-to-r from-accent-primary to-accent-violet"
        aria-hidden="true"
      />

      {/* Shimmer on hover */}
      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" aria-hidden="true">
        <span
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
            animation: 'shimmer 2s infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </span>

      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <motion.span
              className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              aria-hidden="true"
            />
            <span className="sr-only">Analyzing...</span>
          </>
        ) : null}
        {children}
      </span>
    </motion.button>
  );
};
