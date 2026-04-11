/**
 * DEEP SIGHT v8.0 — Premium Sidebar
 * Collapsible with tooltip, active indicator, glassmorphism
 */

import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  History,
  Swords,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Shield,
  Info,
  Scale,
  BarChart3,
  User,
  MessageSquare,
  GraduationCap,
  Brain,
  Menu
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../hooks/useTranslation";
import { SidebarInsight } from "../SidebarInsight";
import { PlanBadge } from "../PlanBadge";
import { normalizePlanId, getMinPlanForFeature, PLANS_INFO, PLAN_HIERARCHY } from "../../config/planPrivileges";
import type { PlanId } from "../../config/planPrivileges";

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
  badgeClassName?: string;
  external?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, collapsed, badge, badgeClassName, external }) => {
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
            ? 'bg-accent-primary-muted text-accent-primary-hover shadow-[0_0_12px_rgba(99,102,241,0.12)]'
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
                  <span className={`px-1.5 py-0.5 rounded-full text-[0.625rem] font-medium ${badgeClassName || 'bg-accent-secondary-muted text-accent-secondary'}`}>
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

// === Section Label ===
const SectionLabel: React.FC<{ label: string; icon?: React.ElementType; collapsed?: boolean }> = ({ label, icon: Icon, collapsed }) => {
  if (collapsed) {
    return <div className="h-px bg-border-subtle my-3 mx-1" />;
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 pt-4 pb-1.5">
      {Icon && <Icon className="w-3 h-3 text-text-muted" />}
      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  );
};

// === User Card ===
const UserCard: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  if (!user) return null;

  // Aligné sur planPrivileges.ts (free/pro)
  const planLabels: Record<string, string> = {
    free: language === 'fr' ? 'Gratuit' : 'Free',
    pro: 'Pro',
  };

  const planColors: Record<string, string> = {
    free: 'text-text-tertiary',
    pro: 'text-indigo-400',
  };

  const planBgColors: Record<string, string> = {
    free: 'bg-bg-tertiary',
    pro: 'bg-indigo-500/10',
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
                    currentPlan === 'pro' ? 'bg-indigo-500' :
                    'bg-text-muted'
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
  mobileOpen: mobileOpenProp,
  onMobileClose: onMobileCloseProp
}) => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Internal mobile state — works standalone or combined with parent control
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOpen = mobileOpenProp || internalMobileOpen;
  const closeMobile = () => {
    setInternalMobileOpen(false);
    onMobileCloseProp?.();
  };

  const userPlan = normalizePlanId(user?.plan);

  // Badges dynamiques — getMinPlanForFeature comme source unique de vérité
  const planBadgeStyles: Record<PlanId, string> = {
    free: 'bg-gray-500/15 text-gray-400',
    pro: 'bg-indigo-500/15 text-indigo-400',
  };
  const minPlanPlaylists = getMinPlanForFeature('playlistsEnabled');
  const minPlanStudy = getMinPlanForFeature('flashcardsEnabled');
  const minPlanChat: PlanId = 'pro'; // Chat page bloque les free users
  const getBadge = (minPlan: PlanId) => {
    const userIdx = PLAN_HIERARCHY.indexOf(userPlan);
    const minIdx = PLAN_HIERARCHY.indexOf(minPlan);
    if (userIdx >= minIdx) return {};
    return { badge: PLANS_INFO[minPlan].name, badgeClassName: planBadgeStyles[minPlan] };
  };
  const ADMIN_EMAIL = "maximeleparc3@gmail.com";
  const isUserAdmin = user?.is_admin || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const handleLogoClick = () => {
    navigate('/dashboard');
    closeMobile();
  };

  const handleNavClick = () => {
    closeMobile();
  };

  return (
    <>
      {/* Mobile hamburger button — always visible on mobile */}
      {!mobileOpen && (
        <button
          onClick={() => setInternalMobileOpen(true)}
          className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-bg-elevated border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Open menu"
          aria-expanded={false}
        >
          <Menu className="w-4.5 h-4.5" />
        </button>
      )}

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeMobile}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 h-screen bg-bg-secondary border-r border-border-subtle flex flex-col z-40 transition-all duration-200 ease-out
          ${collapsed ? 'w-[60px]' : 'w-[240px]'}
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`h-14 flex items-center justify-between border-b border-border-subtle ${collapsed ? 'px-3 justify-center' : 'px-3.5'}`}>
          <Logo collapsed={collapsed} onClick={handleLogoClick} />
          <div className="flex items-center gap-1">
            <button
              onClick={closeMobile}
              className="lg:hidden w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Close menu"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
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
          {/* ── Analyse ── */}
          <NavItem to="/dashboard" icon={LayoutDashboard} label={t.nav.analysis} collapsed={collapsed} />
          <NavItem to="/history" icon={History} label={t.nav.history} collapsed={collapsed} />
          <NavItem to="/debate" icon={Swords} label={language === 'fr' ? 'Débat IA' : 'AI Debate'} collapsed={collapsed} />

          {/* ── Révision & IA ── */}
          <SectionLabel label={t.nav.studySection} icon={Brain} collapsed={collapsed} />
          <NavItem to="/chat" icon={MessageSquare} label={t.nav.chat} collapsed={collapsed} {...getBadge(minPlanChat)} />
          <NavItem to="/study" icon={GraduationCap} label={t.nav.study} collapsed={collapsed} {...getBadge(minPlanStudy)} />

          {/* ── Compte ── */}
          <SectionLabel label={language === 'fr' ? 'Compte' : 'Account'} collapsed={collapsed} />
          <NavItem to="/settings" icon={Settings} label={t.nav.settings} collapsed={collapsed} />
          <NavItem to="/account" icon={User} label={t.nav.myAccount} collapsed={collapsed} />
          <NavItem to="/upgrade" icon={CreditCard} label={t.nav.subscription} collapsed={collapsed} />
          <NavItem to="/usage" icon={BarChart3} label={t.nav.usage || (language === 'fr' ? 'Utilisation' : 'Usage')} collapsed={collapsed} />

          {isUserAdmin ? (
            <>
              <SectionLabel label="Admin" collapsed={collapsed} />
              <NavItem to="/admin" icon={Shield} label={t.nav.admin} collapsed={collapsed} />
            </>
          ) : (
            <>
              <SectionLabel label={language === 'fr' ? 'Infos' : 'Info'} collapsed={collapsed} />
              <NavItem to="/about" icon={Info} label={language === 'fr' ? 'À propos' : 'About'} collapsed={collapsed} />
            </>
          )}

          <div className="h-px bg-border-subtle my-3 mx-1" />
          <NavItem to="/legal" icon={Scale} label={t.nav.legal} collapsed={collapsed} />
        </nav>

        {/* 💡 Le Saviez-Vous — Sidebar Pulse */}
        <div className="border-t border-border-subtle">
          <SidebarInsight collapsed={collapsed} />
        </div>

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
