/**
 * VisualizationsTabs — Tabs minimal pour les 4 visuels analytiques du débat IA v2.
 *
 * Implementation locale (pas de @radix-ui/react-tabs disponible dans les deps).
 * Pattern simple, dark mode glassmorphism, accessible (role=tablist/tab/tabpanel).
 */

import React from "react";
import { motion } from "framer-motion";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface VisualizationsTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

/**
 * Container Tabs avec liste de boutons + content panels.
 * Le caller passe les tabs en `tabs` et les TabPanel en `children`.
 */
export const VisualizationsTabs: React.FC<VisualizationsTabsProps> = ({
  tabs,
  active,
  onChange,
  children,
}) => {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
      <div
        role="tablist"
        aria-label="Visualisations du débat"
        className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-black/20"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`viz-panel-${tab.value}`}
              id={`viz-tab-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="viz-tab-active-bg"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-white/10"
                  transition={{ type: "spring", duration: 0.4 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
};

interface TabPanelProps {
  value: string;
  active: string;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  value,
  active,
  children,
}) => {
  if (value !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`viz-panel-${value}`}
      aria-labelledby={`viz-tab-${value}`}
    >
      {children}
    </div>
  );
};

export default VisualizationsTabs;
