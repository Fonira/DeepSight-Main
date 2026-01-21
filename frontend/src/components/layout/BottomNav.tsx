/**
 * 📱 BottomNav Component v1.0
 * 
 * Barre de navigation fixe en bas de l'écran pour mobile.
 * Style app native avec icônes et indicateur de page active.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Search, 
  FolderOpen, 
  Clock, 
  User,
  Sparkles
} from 'lucide-react';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: <Home className="w-5 h-5" />, label: 'Accueil' },
  { path: '/history', icon: <Clock className="w-5 h-5" />, label: 'Historique' },
  { path: '/playlists', icon: <FolderOpen className="w-5 h-5" />, label: 'Playlists' },
  { path: '/upgrade', icon: <Sparkles className="w-5 h-5" />, label: 'Pro' },
  { path: '/settings', icon: <User className="w-5 h-5" />, label: 'Profil' },
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Ne pas afficher sur les pages publiques
  const publicPaths = ['/', '/login', '/auth/callback', '/legal'];
  if (publicPaths.includes(location.pathname)) {
    return null;
  }

  return (
    <nav 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-elevated/95 backdrop-blur-xl border-t border-border-subtle pb-safe"
      style={{ 
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' 
      }}
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[60px] py-2 px-3 rounded-xl
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-elevated
                active:scale-95
                ${isActive 
                  ? 'text-accent-primary' 
                  : 'text-text-tertiary hover:text-text-secondary'
                }
              `}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Indicateur actif */}
              {isActive && (
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-accent-primary"
                  aria-hidden="true"
                />
              )}
              
              {/* Icône */}
              <div className={`
                relative p-1 rounded-lg
                ${isActive ? 'bg-accent-primary-muted' : ''}
              `}>
                {item.icon}
                
                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center"
                    aria-label={`${item.badge} notifications`}
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              
              {/* Label */}
              <span className={`
                text-[10px] mt-1 font-medium
                ${isActive ? 'text-accent-primary' : ''}
              `}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
