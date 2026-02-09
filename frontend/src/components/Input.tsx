/**
 * DEEP SIGHT v9.0 — Premium Input Component
 * Floating label, animated focus ring (blue→violet), validation states, accessible.
 */

import React, { useId, useState } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  helperText?: string;
  inputSize?: 'sm' | 'md' | 'lg';
  /** Enable animated floating label instead of static */
  floating?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      icon,
      iconRight,
      helperText,
      inputSize = 'md',
      floating = false,
      className = "",
      id: providedId,
      value,
      defaultValue,
      placeholder,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const hasError = !!error;
    const hasSuccess = !!success;
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value !== undefined ? String(value).length > 0 : !!defaultValue;
    const isFloating = floating && (isFocused || hasValue);

    const sizeClasses: Record<string, string> = {
      sm: 'py-1.5 px-3 text-sm',
      md: 'py-2.5 px-3.5 text-sm',
      lg: 'py-3 px-4 text-base',
    };

    const borderColor = hasError
      ? 'border-error focus:border-error focus:ring-error/20'
      : hasSuccess
        ? 'border-accent-success focus:border-accent-success focus:ring-accent-success/20'
        : 'border-border-default focus:border-accent-primary focus:ring-accent-primary-muted';

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="w-full">
        {/* Static label (when not floating) */}
        {label && !floating && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
            {props.required && (
              <span className="text-error ml-0.5" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative group">
          {/* Left icon */}
          {icon && (
            <div
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200
                ${isFocused ? 'text-accent-primary' : 'text-text-muted'}
                ${hasError ? 'text-error' : ''}
              `}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}

          {/* Floating label */}
          {label && floating && (
            <label
              htmlFor={inputId}
              className={`
                absolute z-10 transition-all duration-200 ease-out pointer-events-none
                ${icon ? 'left-10' : 'left-3.5'}
                ${isFloating
                  ? '-top-2.5 text-[0.6875rem] font-medium px-1 bg-bg-primary'
                  : 'top-1/2 -translate-y-1/2 text-sm'
                }
                ${isFocused
                  ? 'text-accent-primary'
                  : hasError
                    ? 'text-error'
                    : isFloating
                      ? 'text-text-secondary'
                      : 'text-text-muted'
                }
              `}
            >
              {label}
              {props.required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
            </label>
          )}

          <input
            ref={ref}
            id={inputId}
            value={value}
            defaultValue={defaultValue}
            placeholder={floating ? (isFocused ? placeholder : '') : placeholder}
            aria-invalid={hasError}
            aria-describedby={
              [
                hasError ? errorId : null,
                helperText ? helperId : null,
              ].filter(Boolean).join(' ') || undefined
            }
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`
              relative z-[1] w-full
              ${sizeClasses[inputSize]}
              ${icon ? "pl-10" : ""}
              ${iconRight ? "pr-10" : ""}
              bg-bg-tertiary
              border ${borderColor}
              rounded-md
              text-text-primary placeholder:text-text-muted
              transition-all duration-200 ease-out
              hover:border-border-strong
              focus:outline-none focus:ring-2
              focus:bg-bg-elevated
              disabled:opacity-40 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />

          {/* Right icon */}
          {iconRight && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-text-muted"
              aria-hidden="true"
            >
              {iconRight}
            </div>
          )}

          {/* Animated focus gradient line at bottom */}
          <div
            className={`
              absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full
              bg-gradient-to-r from-accent-primary to-accent-violet
              transition-all duration-300 ease-out
              ${isFocused ? 'w-full opacity-100' : 'w-0 opacity-0'}
            `}
            aria-hidden="true"
          />
        </div>

        {/* Helper text */}
        {helperText && !hasError && !hasSuccess && (
          <p id={helperId} className="mt-1.5 text-xs text-text-tertiary">
            {helperText}
          </p>
        )}

        {/* Error message */}
        {hasError && (
          <p
            id={errorId}
            className="mt-1.5 text-xs text-error flex items-center gap-1"
            role="alert"
            aria-live="polite"
          >
            <span className="w-1 h-1 rounded-full bg-error flex-shrink-0" />
            {error}
          </p>
        )}

        {/* Success message */}
        {hasSuccess && !hasError && (
          <p className="mt-1.5 text-xs text-accent-success flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-accent-success flex-shrink-0" />
            {success}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
