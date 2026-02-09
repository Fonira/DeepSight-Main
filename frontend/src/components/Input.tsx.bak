import React, { useId } from "react";

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  /** Description additionnelle pour l'input */
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, helperText, className = "", id: providedId, ...props }, ref) => {
    // Générer un ID unique si non fourni
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    
    const hasError = !!error;
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-semibold brass-text mb-2 tracking-wide uppercase"
          >
            {label}
            {props.required && (
              <span className="text-red-400 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}
        <div className="relative group">
          {/* Effet de glow - caché pour accessibilité */}
          <div 
            className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-glow via-gold-primary to-cyan-glow opacity-0 group-focus-within:opacity-100 blur-sm transition-all duration-500" 
            aria-hidden="true"
          />
          {icon && (
            <div 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 z-20 transition-colors duration-300 group-focus-within:text-cyan-glow"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={
              [
                hasError ? errorId : null,
                helperText ? helperId : null
              ].filter(Boolean).join(' ') || undefined
            }
            className={`
              relative z-10 w-full px-4 py-3 ${icon ? "pl-10" : ""} rounded-lg
              bg-gradient-to-br from-teal-deep/80 to-abyss/90
              border-2 ${hasError ? 'border-red-400' : 'border-gold-primary/30'}
              text-cream placeholder:text-cream/40
              backdrop-blur-xl transition-all duration-300
              focus:border-cyan-glow focus:outline-none
              focus:ring-2 focus:ring-cyan-glow focus:ring-offset-2 focus:ring-offset-deep-bg
              focus:shadow-[0_0_30px_rgba(0,212,170,0.4),inset_0_0_20px_rgba(0,212,170,0.1)]
              focus:scale-[1.02]
              font-medium
              ${className}
            `}
            {...props}
          />
          {/* Ligne de focus - décorative */}
          <div 
            className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-glow to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" 
            aria-hidden="true"
          />
        </div>
        
        {/* Helper text */}
        {helperText && !hasError && (
          <p id={helperId} className="mt-1 text-sm text-cream/60">
            {helperText}
          </p>
        )}
        
        {/* Error message avec annonce pour lecteurs d'écran */}
        {hasError && (
          <p 
            id={errorId} 
            className="mt-1 text-sm text-red-400"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
