/**
 * DEEP SIGHT v9.0 — Premium Toggle Switch
 * Smooth spring animation, accessible, with label support.
 */

import React, { useId } from 'react';
import { motion } from 'framer-motion';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  color?: 'primary' | 'success' | 'violet';
}

const sizes = {
  sm: { track: 'w-8 h-[18px]', thumb: 'w-3.5 h-3.5', translate: 14 },
  md: { track: 'w-10 h-[22px]', thumb: 'w-4.5 h-4.5', translate: 18 },
  lg: { track: 'w-12 h-[26px]', thumb: 'w-5 h-5', translate: 22 },
};

const colorClasses = {
  primary: 'bg-accent-primary',
  success: 'bg-accent-success',
  violet: 'bg-accent-violet',
};

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  size = 'md',
  disabled = false,
  color = 'primary',
}) => {
  const id = useId();
  const s = sizes[size];

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-3 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex items-center rounded-full
          transition-colors duration-200 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
          ${s.track}
          ${checked ? colorClasses[color] : 'bg-bg-active'}
        `}
      >
        <motion.span
          className={`
            ${s.thumb} rounded-full bg-white shadow-sm
            absolute left-[3px]
          `}
          animate={{ x: checked ? s.translate : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>

      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-text-primary leading-tight">{label}</span>
          )}
          {description && (
            <span className="text-xs text-text-tertiary leading-tight mt-0.5">{description}</span>
          )}
        </div>
      )}
    </label>
  );
};
