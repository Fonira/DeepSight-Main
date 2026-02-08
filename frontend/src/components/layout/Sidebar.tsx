/**
 * DEEP SIGHT v5.2 — Sidebar
 * Navigation latérale sobre et fonctionnelle
 * ✅ Utilise le système i18n centralisé
 */

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  History,
  ListVideo,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Shield,
  Scale,
  BarChart3,
  User
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";

// === Logo cliquable vers la page principale ===
const Logo: React.FC<{ collapsed?: boolean; onClick?: () => void }> = ({ collapsed, onClick }) => {
  const [imageError, setImageError] = React.useState(false);
  const { t } = useTranslation();
  
  // New compass/star logo SVG fallback (simplified version of the cosmic logo)
  const LogoSVG = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="25%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#FF00FF" />
          <stop offset="75%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="cosmicBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="100%" stopColor="#0a0a0b" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Background */}
      <circle cx="50" cy="50" r="48" fill="url(#cosmicBg)" />
      {/* Outer ring */}
      <circle cx="50" cy="50" r="42" fill="none" stroke="url(#logoGradient)" strokeWidth="1.5" opacity="0.6" />
      {/* Inner rings */}
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#logoGradient)" strokeWidth="1" opacity="0.5" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="url(#logoGradient)" strokeWidth="1" opacity="0.4" />
      {/* 8-pointed star */}
      <path
        d="M50 8 L54 38 L84 42 L58 50 L84 58 L54 62 L50 92 L46 62 L16 58 L42 50 L16 42 L46 38 Z"
        fill="url(#logoGradient)"
        filter="url(#glow)"
        opacity="0.9"
      />
      {/* Center point */}
      <circle cx="50" cy="50" r="4" fill="#0a0a0b" />
    </svg>
  );
  
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 group cursor-pointer hover:opacity-90 transition-all"
      title={t.nav.dashboard}
    >
      <div className="relative w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        {!imageError ? (
          <img
            src="/deep-sight-logo.png"
            alt="Deep Sight"
            className="w-full h-full object-contain relative z-10"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.5))' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full relative z-10">
            <LogoSVG />
          </div>
        )}
      </div>
      {!collapsed && (
        <span className="font-display text-lg font-semibold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          Deep Sight
        </span>
      )}
    </button>
  );
};

// === Nav Item ===
interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed?: boolean;
  badge?: string;
  external?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, collapsed, badge, external }) => {
  const baseClasses = "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium";
  
  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} text-text-secondary hover:text-text-primary hover:bg-bg-hover`}
        title={collapsed ? label : undefined}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{label}</span>
            <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
          </>
        )}
      </a>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseClasses} ${
          isActive
            ? 'bg-accent-primary-muted text-accent-primary'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-secondary-muted text-accent-secondary">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

// === User Card ===
interface UserCardProps {
  collapsed?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!user) return null;

  const planLabels: Record<string, string> = {
    free: `🆓 ${t.upgrade.plans.free.name}`,
    starter: `⚡ ${t.upgrade.plans.starter.name}`,
    pro: `⭐ ${t.upgrade.plans.pro.name}`,
    expert: `👑 ${t.upgrade.plans.expert.name}`,
    unlimited: '👑 Admin',
  };

  const planColors: Record<string, string> = {
    free: 'text-text-tertiary',
    starter: 'text-emerald-400',
    pro: 'text-amber-400',
    expert: 'text-purple-400',
    unlimited: 'text-yellow-400',
  };

  const planBgColors: Record<string, string> = {
    free: 'bg-gray-500/10',
    starter: 'bg-emerald-500/10',
    pro: 'bg-amber-500/10',
    expert: 'bg-purple-500/10',
    unlimited: 'bg-yellow-500/10',
  };

  const currentPlan = user.plan || 'free';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatCredits = (credits: number) => {
    return credits.toLocaleString();
  };

  if (collapsed) {
    return (
      <div className="p-2">
        <button
          onClick={handleLogout}
          className="w-full p-2 rounded-lg hover:bg-bg-hover transition-colors"
          title={t.nav.logout}
        >
          <div className={`w-8 h-8 rounded-full ${planBgColors[currentPlan]} flex items-center justify-center ${planColors[currentPlan]} font-medium text-sm`}>
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="p-3 rounded-xl bg-bg-tertiary border border-border-subtle">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full ${planBgColors[currentPlan]} flex items-center justify-center ${planColors[currentPlan]} font-semibold`}>
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {user.email?.split('@')[0] || 'User'}
            </p>
            <p className={`text-xs font-semibold ${planColors[currentPlan]}`}>
              {planLabels[currentPlan]}
            </p>
          </div>
        </div>

        {user.credits !== undefined && (
          <div className="mb-3 p-2 rounded-lg bg-bg-hover">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-tertiary flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t.dashboard.credits}
              </span>
              <span className={`font-bold ${planColors[currentPlan]}`}>
                {formatCredits(user.credits)}
              </span>
            </div>
            {user.credits_monthly && user.credits_monthly > 0 && (
              <div className="h-1.5 rounded-full bg-bg-primary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    currentPlan === 'free' ? 'bg-gray-500' :
                    currentPlan === 'starter' ? 'bg-emerald-500' :
                    currentPlan === 'pro' ? 'bg-amber-500' :
                    'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min((user.credits / user.credits_monthly) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {currentPlan === 'free' && (
            <button
              onClick={() => navigate('/upgrade')}
              className="flex-1 px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary-hover transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t.nav.upgrade}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-bg-hover text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
            title={t.nav.logout}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// === Sidebar principale ===
interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Mobile: is sidebar open (visible) */
  mobileOpen?: boolean;
  /** Mobile: callback to close sidebar */
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose
}) => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isProUser = user?.plan === 'pro' || user?.plan === 'team' || user?.plan === 'expert' || user?.plan === 'unlimited';

  const ADMIN_EMAIL = "maximeleparc3@gmail.com";
  const isUserAdmin = user?.is_admin || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const handleLogoClick = () => {
    navigate('/dashboard');
    // Close mobile menu after navigation
    onMobileClose?.();
  };

  const handleNavClick = () => {
    // Close mobile menu after navigation
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen bg-bg-secondary border-r border-border-subtle flex flex-col z-40 transition-all duration-300
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${/* Mobile: slide in/out */ ''}
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`h-16 flex items-center justify-between border-b border-border-subtle ${collapsed ? 'px-4' : 'px-4'}`}>
          <Logo collapsed={collapsed} onClick={handleLogoClick} />
          <div className="flex items-center gap-2">
            {/* Mobile close button */}
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                aria-label="Fermer le menu"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {/* Desktop collapse toggle */}
            {onToggle && (
              <button
                onClick={onToggle}
                className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" onClick={handleNavClick}>
          <NavItem
            to="/dashboard"
            icon={LayoutDashboard}
            label={t.nav.analysis}
            collapsed={collapsed}
          />
          <NavItem
            to="/history"
            icon={History}
            label={t.nav.history}
            collapsed={collapsed}
          />
          <NavItem
            to="/playlists"
            icon={ListVideo}
            label={t.nav.playlists}
            collapsed={collapsed}
            badge={isProUser ? undefined : "Pro"}
          />

          <div className="h-px bg-border-subtle my-4" />

          <NavItem
            to="/settings"
            icon={Settings}
            label={t.nav.settings}
            collapsed={collapsed}
          />
          <NavItem
            to="/account"
            icon={User}
            label={t.nav.myAccount}
            collapsed={collapsed}
          />
          <NavItem
            to="/upgrade"
            icon={CreditCard}
            label={t.nav.subscription}
            collapsed={collapsed}
          />
          <NavItem
            to="/usage"
            icon={BarChart3}
            label={t.nav.usage || (language === 'fr' ? 'Utilisation' : 'Usage')}
            collapsed={collapsed}
          />

          {isUserAdmin && (
            <>
              <div className="h-px bg-border-subtle my-4" />
              <NavItem
                to="/admin"
                icon={Shield}
                label={t.nav.admin}
                collapsed={collapsed}
                badge="🔐"
              />
            </>
          )}

          <div className="h-px bg-border-subtle my-4" />
          <NavItem
            to="/legal"
            icon={Scale}
            label={t.nav.legal}
            collapsed={collapsed}
          />
        </nav>

        {/* Footer avec User */}
        <div className="border-t border-border-subtle">
          <UserCard collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
