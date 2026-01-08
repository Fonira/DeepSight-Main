import React from 'react';
import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface Props {
  to: string;
  icon: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
}

export const SidebarNavItem: React.FC<Props> = ({ to, icon: Icon, children, onClick }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-4 px-5 py-4 rounded-lg
         text-sm font-bold uppercase tracking-wider
         transition-all duration-300 overflow-hidden
         ${isActive
          ? 'bg-gradient-to-r from-gold-highlight via-gold-primary to-gold-secondary text-abyss shadow-[0_0_20px_rgba(212,165,116,0.5)]'
          : 'border-2 border-gold-primary/30 text-cream/80 hover:border-gold-primary hover:bg-gold-primary/5 hover:translate-x-2'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {!isActive && (
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <span
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.15), transparent)',
                  animation: 'wave 2s ease-in-out infinite'
                }}
              />
            </span>
          )}
          <Icon className={`
            w-5 h-5 relative z-10 transition-all duration-300
            ${!isActive && 'group-hover:scale-110 group-hover:rotate-12'}
            ${isActive && 'drop-shadow-[0_0_8px_rgba(10,26,31,0.5)]'}
          `} />
          <span className="relative z-10">{children}</span>
          {isActive && (
            <span
              className="absolute right-4 w-2.5 h-2.5 rounded-full bg-cyan-glow animate-pulse"
              style={{
                boxShadow: '0 0 12px #00D4AA, 0 0 24px #00D4AA',
                animation: 'pulse-glow 2s ease-in-out infinite'
              }}
            />
          )}
          {!isActive && (
            <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-cyan-glow to-gold-primary group-hover:w-full transition-all duration-500" />
          )}
        </>
      )}
    </NavLink>
  );
};
