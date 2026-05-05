import React from "react";
import {
  BookOpen,
  Brain,
  BookMarked,
  MessageCircle,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SearchSourceType } from "../../services/api";

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  bg: string;
  text: string;
}

const TYPE_CONFIG: Record<SearchSourceType, BadgeConfig> = {
  summary: {
    label: "Synthèse",
    icon: BookOpen,
    bg: "bg-blue-500/15",
    text: "text-blue-300",
  },
  flashcard: {
    label: "Flashcard",
    icon: BookMarked,
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  quiz: {
    label: "Quiz",
    icon: Brain,
    bg: "bg-amber-500/15",
    text: "text-amber-300",
  },
  chat: {
    label: "Chat",
    icon: MessageCircle,
    bg: "bg-indigo-500/15",
    text: "text-indigo-300",
  },
  transcript: {
    label: "Transcript",
    icon: FileText,
    bg: "bg-violet-500/15",
    text: "text-violet-300",
  },
};

export const SearchTypeBadge: React.FC<{ type: SearchSourceType }> = ({
  type,
}) => {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {cfg.label}
    </span>
  );
};
