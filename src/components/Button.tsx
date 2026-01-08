import React from "react";
import { useMagneticEffect } from '../hooks/useMagneticEffect';

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  /** Description pour lecteurs d'écran (optionnel si children est du texte) */
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
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "font-bold transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-primary focus:ring-offset-2 focus:ring-offset-deep-bg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-visible";

    const variants = {
      primary:
        "brass-button text-[#1a1a1a] tracking-wider uppercase subtitle-font",
      secondary:
        "mechanical-frame text-gold-primary hover:text-gold-highlight hover:bg-black/50 bg-black/40 backdrop-blur-xl",
      ghost: "text-gold-primary hover:text-gold-highlight hover:glass-panel border border-transparent hover:border-white/10",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-10 py-4 text-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
        aria-label={ariaLabel}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span 
              className="inline-block w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin" 
              aria-hidden="true"
            />
            <span className="sr-only">Chargement...</span>
            {children}
          </span>
        ) : (
          <span>{children}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export const AnalyzeButton: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  loading,
  disabled,
  ariaLabel,
  ...props 
}) => {
  const magneticRef = useMagneticEffect(0.25);

  return (
    <button
      ref={magneticRef}
      className={`
        relative group px-8 py-4 rounded-lg font-bold text-lg uppercase tracking-widest
        bg-gradient-to-br from-[#F4D03F] via-[#D4A574] to-[#B8860B]
        border-3 border-gold-primary
        shadow-[0_0_30px_rgba(212,165,116,0.5),inset_0_2px_6px_rgba(255,255,255,0.4)]
        overflow-hidden
        hover:shadow-[0_0_50px_rgba(212,165,116,0.8),0_0_100px_rgba(244,208,63,0.4)]
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-gold-primary focus:ring-offset-2 focus:ring-offset-deep-bg
        ${className}
      `}
      style={{ transition: 'transform 0.15s ease-out' }}
      aria-label={ariaLabel || "Analyser la vidéo"}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      disabled={disabled || loading}
      {...props}
    >
      {/* Effets décoratifs - cachés pour les lecteurs d'écran */}
      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" aria-hidden="true">
        <span
          className="absolute inset-0 animate-shine"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
          }}
        />
      </span>

      <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-glow/20 to-gold-highlight/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" aria-hidden="true" />

      <span className="relative z-10 text-[#0A1A1F] drop-shadow-lg">
        {loading ? (
          <>
            <span className="inline-block w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true" />
            <span className="sr-only">Analyse en cours...</span>
          </>
        ) : null}
        {children}
      </span>
    </button>
  );
};
