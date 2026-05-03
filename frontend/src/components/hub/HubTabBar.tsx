import React from "react";
import {
  BookOpen,
  Brain,
  BookMarked,
  Shield,
  Target,
  MessageCircle,
} from "lucide-react";
import type { TabId } from "./types";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Nombre de messages dans la conversation, badge sur l'onglet Chat. */
  chatMessageCount: number;
  /** Nombre de claims fact-check P0, badge rouge sur Fiabilité. */
  factCheckCount: number;
}

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof BookOpen;
  activeColor: string;
  activeBorder: string;
}

const TABS: TabConfig[] = [
  {
    id: "synthesis",
    label: "Synthèse",
    icon: BookOpen,
    activeColor: "text-blue-400",
    activeBorder: "border-blue-500",
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: Brain,
    activeColor: "text-amber-400",
    activeBorder: "border-amber-500",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: BookMarked,
    activeColor: "text-emerald-400",
    activeBorder: "border-emerald-500",
  },
  {
    id: "reliability",
    label: "Fiabilité",
    icon: Shield,
    activeColor: "text-violet-400",
    activeBorder: "border-violet-500",
  },
  {
    id: "geo",
    label: "GEO",
    icon: Target,
    activeColor: "text-teal-400",
    activeBorder: "border-teal-500",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageCircle,
    activeColor: "text-indigo-400",
    activeBorder: "border-indigo-500",
  },
];

export const HubTabBar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  chatMessageCount,
  factCheckCount,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Sections du Hub"
      className="sticky top-[56px] z-10 flex border-b border-white/10 overflow-x-auto scrollbar-hide bg-[#0c0c14]/95 backdrop-blur-xl"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const badge =
          tab.id === "chat" && chatMessageCount > 0
            ? String(chatMessageCount)
            : tab.id === "reliability" && factCheckCount > 0
              ? String(factCheckCount)
              : null;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            data-testid={`hub-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0 " +
              (isActive
                ? `${tab.activeBorder} ${tab.activeColor}`
                : "border-transparent text-white/55 hover:text-white/85 hover:border-white/10")
            }
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{tab.label}</span>
            {badge && (
              <span
                className={
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center " +
                  (tab.id === "reliability"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-white/10 text-white/85")
                }
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
