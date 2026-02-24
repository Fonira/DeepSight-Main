/**
 * DEEP SIGHT v8.0 — Premium Sidebar
 * Collapsible with tooltip, active indicator, glassmorphism
 */

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';
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
import { PlanBadge } from "../PlanBadge";

// === Logo ===
const Logo: React.FC<{ collapsed?: boolean; onClick?: () => void }> = ({ collapsed, onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 group cursor-pointer hover:opacity-90 transition-all"
      title={t.nav.dashboard}
    >
      <div className="relative w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src="/deepsight-logo-cosmic.png"
          alt="Deep Sight"
          className="w-full h-full object-contain"
        />
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="font-semibold text-sm tracking-tight text-gradient whitespace-nowrap overflow-hidden"
          >
            Deep Sight
          </motion.span>
        )}
      </AnimatePresence>
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
  const baseClasses = "flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all text-[0.8125rem] font-medium relative";

  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} text-text-secondary hover:text-text-primary hover:bg-bg-hover`}
        title={collapsed ? label : undefined}
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            <ExternalLink className="w-3 h-3 text-text-muted" />
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
            ? 'bg-accent-primary-muted text-accent-primary-hover'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar */}
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent-primary rounded-r-full"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center flex-1 min-w-0 gap-2"
              >
                <span className="flex-1 truncate">{label}</span>
                {badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[0.625rem] font-medium bg-accent-secondary-muted text-accent-secondary">
                    {badge}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );
};

// === User Card ===
const UserCard: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  if (!user) return null;

  // Aligné sur planPrivileges.ts (free/etudiant/starter/pro/equipe)
  const planLabels: Record<string, string> = {
    free: language === 'fr' ? 'Gratuit' : 'Free',
    etudiant: language === 'fr' ? 'Étudiant' : 'Student',
    student: language === 'fr' ? 'Étudiant' : 'Student',
    starter: 'Starter',
    pro: 'Pro',
    equipe: language === 'fr' ? 'Équipe' : 'Team',
    team: language === 'fr' ? 'Équipe' : 'Team',
    expert: language === 'fr' ? 'Équipe' : 'Team', // rétrocompat
    unlimited: 'Admin',
  };

  const planColors: Record<string, string> = {
    free: 'text-text-tertiary',
    etudiant: 'text-emerald-400',
    student: 'text-emerald-400',
    starter: 'text-blue-400',
    pro: 'text-violet-400',
    equipe: 'text-amber-400',
    team: 'text-amber-400',
    expert: 'text-amber-400',
    unlimited: 'text-yellow-400',
  };

  const planBgColors: Record<string, string> = {
    free: 'bg-bg-tertiary',
    etudiant: 'bg-emerald-500/10',
    student: 'bg-emerald-500/10',
    starter: 'bg-blue-500/10',
    pro: 'bg-violet-500/10',
    equipe: 'bg-amber-500/10',
    team: 'bg-amber-500/10',
    expert: 'bg-amber-500/10',
    unlimited: 'bg-yellow-500/10',
  };

  const currentPlan = user.plan || 'free';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (collapsed) {
    return (
      <div className="p-2 flex justify-center">
        <button
          onClick={handleLogout}
          className="w-8 h-8 rounded-md hover:bg-bg-hover transition-colors flex items-center justify-center"
          title={t.nav.logout}
        >
          <div className={`w-7 h-7 rounded-full ${planBgColors[currentPlan]} flex items-center justify-center ${planColors[currentPlan]} font-medium text-xs`}>
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="p-3 rounded-lg bg-bg-tertiary/50 border border-border-subtle">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className={`w-8 h-8 rounded-full ${planBgColors[currentPlan]} flex items-center justify-center ${planColors[currentPlan]} font-semibold text-xs`}>
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">
              {user.email?.split('@')[0] || 'User'}
            </p>
            <p className={`text-[0.625rem] font-semibold ${planColors[currentPlan]}`}>
              {planLabels[currentPlan]}
            </p>
          </div>
        </div>

        {user.credits !== undefined && (
          <div className="mb-2.5 p-2 rounded-md bg-bg-primary/50">
            <div className="flex items-center justify-between text-[0.625rem] mb-1">
              <span className="text-text-tertiary flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t.dashboard.credits}
              </span>
              <span className={`font-bold tabular-nums ${planColors[currentPlan]}`}>
                {user.credits.toLocaleString()}
              </span>
            </div>
            {user.credits_monthly && user.credits_monthly > 0 && (
              <div className="h-1 rounded-full bg-bg-hover overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    currentPlan === 'free' ? 'bg-text-muted' :
                    (currentPlan === 'etudiant' || currentPlan === 'student') ? 'bg-emerald-500' :
                    currentPlan === 'starter' ? 'bg-blue-500' :
                    currentPlan === 'pro' ? 'bg-violet-500' :
                    'bg-amber-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((user.credits / user.credits_monthly) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {currentPlan === 'free' && (
            <button
              onClick={() => navigate('/upgrade')}
              className="flex-1 px-2.5 py-1.5 rounded-md bg-accent-primary text-white text-[0.6875rem] font-medium hover:bg-accent-primary-hover transition-colors flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {t.nav.upgrade}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-2.5 py-1.5 rounded-md bg-bg-hover text-text-tertiary text-[0.6875rem] font-medium hover:text-text-primary transition-colors"
            title={t.nav.logout}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// === Sidebar ===
interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
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

  const isProUser = user?.plan === 'pro' || user?.plan === 'team' || user?.plan === 'equipe' || user?.plan === 'expert' || user?.plan === 'unlimited';
  const ADMIN_EMAIL = "maximeleparc3@gmail.com";
  const isUserAdmin = user?.is_admin || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const handleLogoClick = () => {
    navigate('/dashboard');
    onMobileClose?.();
  };

  const handleNavClick = () => {
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 h-screen bg-bg-secondary/95 backdrop-blur-xl border-r border-border-subtle flex flex-col z-40 transition-all duration-200 ease-out
          ${collapsed ? 'w-[60px]' : 'w-[240px]'}
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`h-14 flex items-center justify-between border-b border-border-subtle ${collapsed ? 'px-3 justify-center' : 'px-3.5'}`}>
          <Logo collapsed={collapsed} onClick={handleLogoClick} />
          <div className="flex items-center gap-1">
            {onMobileClose && (
              <button
                onClick={onMobileClose}
                className="lg:hidden w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                aria-label="Close menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {onToggle && (
              <button
                onClick={onToggle}
                className="hidden lg:flex w-6 h-6 rounded-md items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" onClick={handleNavClick}>
          <NavItem to="/dashboard" icon={LayoutDashboard} label={t.nav.analysis} collapsed={collapsed} />
          <NavItem to="/history" icon={History} label={t.nav.history} collapsed={collapsed} />
          <NavItem to="/playlists" icon={ListVideo} label={t.nav.playlists} collapsed={collapsed} badge={isProUser ? undefined : "Pro"} />

          <div className="h-px bg-border-subtle my-3 mx-1" />

          <NavItem to="/settings" icon={Settings} label={t.nav.settings} collapsed={collapsed} />
          <NavItem to="/account" icon={User} label={t.nav.myAccount} collapsed={collapsed} />
          <NavItem to="/upgrade" icon={CreditCard} label={t.nav.subscription} collapsed={collapsed} />
          <NavItem to="/usage" icon={BarChart3} label={t.nav.usage || (language === 'fr' ? 'Utilisation' : 'Usage')} collapsed={collapsed} />

          {isUserAdmin && (
            <>
              <div className="h-px bg-border-subtle my-3 mx-1" />
              <NavItem to="/admin" icon={Shield} label={t.nav.admin} collapsed={collapsed} />
            </>
          )}

          <div className="h-px bg-border-subtle my-3 mx-1" />
          <NavItem to="/legal" icon={Scale} label={t.nav.legal} collapsed={collapsed} />
        </nav>

        {/* Plan Badge */}
        <div className="border-t border-border-subtle">
          <PlanBadge collapsed={collapsed} />
        </div>

        {/* User */}
        <div className="border-t border-border-subtle">
          <UserCard collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
