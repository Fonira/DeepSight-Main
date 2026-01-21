import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-500 hover:scale-110"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(10, 26, 31, 0.9), rgba(13, 59, 68, 0.8))'
          : 'linear-gradient(135deg, rgba(255, 248, 230, 0.9), rgba(212, 175, 55, 0.2))',
        border: isDark
          ? '2px solid rgba(0, 212, 170, 0.4)'
          : '2px solid rgba(212, 175, 55, 0.6)',
        boxShadow: isDark
          ? '0 0 20px rgba(0, 212, 170, 0.2), inset 0 0 15px rgba(0, 212, 170, 0.1)'
          : '0 0 20px rgba(212, 175, 55, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.5)',
      }}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      <div
        className="relative transition-transform duration-500"
        style={{
          transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)',
        }}
      >
        {isDark ? (
          <Moon
            className="w-5 h-5 text-cyan-400 transition-all duration-300"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(0, 212, 170, 0.6))',
            }}
          />
        ) : (
          <Sun
            className="w-5 h-5 text-gold-primary transition-all duration-300"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))',
            }}
          />
        )}
      </div>

      <div
        className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: isDark
            ? 'radial-gradient(circle at 30% 30%, rgba(0, 212, 170, 0.3), transparent 70%)'
            : 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.5), transparent 70%)',
        }}
      />
    </button>
  );
};
