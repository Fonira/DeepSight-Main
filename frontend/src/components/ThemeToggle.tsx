/**
 * DEEP SIGHT v7.1 — Theme Toggle
 * 🌗 Bouton élégant pour basculer entre thème clair et sombre
 * 
 * Features:
 * - Animation fluide sun/moon
 * - Effet de rotation 3D
 * - Glow effect adaptatif
 * - Accessible (aria-label, keyboard support)
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'pill' | 'dropdown';
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'md',
  variant = 'icon',
  showLabel = false,
  className = '',
}) => {
  const { isDark, toggleTheme, theme, setTheme } = useTheme();

  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Simple icon toggle button
  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className={`
          group relative flex items-center justify-center 
          ${sizeClasses[size]} rounded-full
          transition-all duration-500 ease-out
          hover:scale-105 active:scale-95
          focus-visible:outline-none focus-visible:ring-2 
          focus-visible:ring-accent-primary focus-visible:ring-offset-2
          ${className}
        `}
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(24, 24, 27, 0.9), rgba(39, 39, 42, 0.8))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(244, 244, 245, 0.9))',
          border: isDark
            ? '1px solid rgba(99, 102, 241, 0.3)'
            : '1px solid rgba(79, 70, 229, 0.25)',
          boxShadow: isDark
            ? '0 4px 20px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        }}
        aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
        title={isDark ? 'Mode clair' : 'Mode sombre'}
      >
        {/* Background glow effect */}
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: isDark
              ? 'radial-gradient(circle at center, rgba(99, 102, 241, 0.2), transparent 70%)'
              : 'radial-gradient(circle at center, rgba(251, 191, 36, 0.25), transparent 70%)',
          }}
        />

        {/* Icon container with rotation animation */}
        <div
          className="relative z-10 transition-all duration-500 ease-out"
          style={{
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(180deg) scale(1)',
          }}
        >
          {isDark ? (
            <Moon
              className={`${iconSizes[size]} text-indigo-400 transition-all duration-300`}
              style={{
                filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.5))',
              }}
            />
          ) : (
            <Sun
              className={`${iconSizes[size]} text-amber-500 transition-all duration-300`}
              style={{
                filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))',
                transform: 'rotate(180deg)', // Counter-rotate to keep upright
              }}
            />
          )}
        </div>

        {/* Animated ring on hover */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100"
          style={{
            border: isDark
              ? '2px solid rgba(99, 102, 241, 0.4)'
              : '2px solid rgba(251, 191, 36, 0.4)',
            transform: 'scale(1.1)',
          }}
        />
      </button>
    );
  }

  // Pill toggle with label
  if (variant === 'pill') {
    return (
      <button
        onClick={toggleTheme}
        className={`
          group relative flex items-center gap-2.5 
          px-4 py-2.5 rounded-full
          transition-all duration-500 ease-out
          hover:scale-[1.02] active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 
          focus-visible:ring-accent-primary focus-visible:ring-offset-2
          ${className}
        `}
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(24, 24, 27, 0.95), rgba(39, 39, 42, 0.9))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(244, 244, 245, 0.95))',
          border: isDark
            ? '1px solid rgba(99, 102, 241, 0.25)'
            : '1px solid rgba(79, 70, 229, 0.2)',
          boxShadow: isDark
            ? '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        }}
        aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {/* Toggle track */}
        <div
          className="relative w-12 h-6 rounded-full transition-all duration-300"
          style={{
            background: isDark
              ? 'linear-gradient(90deg, #312e81, #4338ca)'
              : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
          }}
        >
          {/* Toggle thumb */}
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center"
            style={{
              left: isDark ? '2px' : 'calc(100% - 22px)',
              background: isDark ? '#0f0f12' : '#fffbeb',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
          >
            {isDark ? (
              <Moon className="w-3 h-3 text-indigo-400" />
            ) : (
              <Sun className="w-3 h-3 text-amber-600" />
            )}
          </div>
        </div>

        {/* Label */}
        <span
          className="text-sm font-medium transition-colors duration-300"
          style={{
            color: isDark ? 'var(--text-secondary)' : 'var(--text-secondary)',
          }}
        >
          {isDark ? 'Sombre' : 'Clair'}
        </span>
      </button>
    );
  }

  // Dropdown selector with system option
  if (variant === 'dropdown') {
    return (
      <div className={`relative inline-flex gap-1 p-1 rounded-xl ${className}`}
        style={{
          background: isDark
            ? 'rgba(24, 24, 27, 0.8)'
            : 'rgba(244, 244, 245, 0.8)',
          border: '1px solid var(--border-subtle)',
        }}
        role="radiogroup"
        aria-label="Sélection du thème"
      >
        {[
          { value: 'light' as const, icon: Sun, label: 'Clair' },
          { value: 'dark' as const, icon: Moon, label: 'Sombre' },
          { value: 'system' as const, icon: Monitor, label: 'Système' },
        ].map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`
              relative flex items-center justify-center gap-1.5 
              px-3 py-1.5 rounded-lg
              transition-all duration-300 ease-out
              focus-visible:outline-none focus-visible:ring-2 
              focus-visible:ring-accent-primary
              ${theme === value
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
              }
            `}
            style={{
              background: theme === value
                ? isDark
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'rgba(79, 70, 229, 0.1)'
                : 'transparent',
            }}
            role="radio"
            aria-checked={theme === value}
            aria-label={label}
          >
            <Icon className="w-4 h-4" />
            {showLabel && (
              <span className="text-xs font-medium">{label}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return null;
};

export default ThemeToggle;
