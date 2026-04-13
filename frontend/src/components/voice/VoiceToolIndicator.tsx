import React from "react";
import { Globe, Search, ShieldCheck, FileSearch, Loader } from "lucide-react";

interface VoiceToolIndicatorProps {
  toolName: string | null;
  isActive: boolean;
}

const TOOL_CONFIG: Record<string, { icon: React.ElementType; label: string }> =
  {
    web_search: { icon: Globe, label: "Recherche web..." },
    deep_research: { icon: Search, label: "Recherche approfondie..." },
    check_fact: { icon: ShieldCheck, label: "Vérification..." },
    search_in_transcript: {
      icon: FileSearch,
      label: "Recherche dans le transcript...",
    },
    get_analysis_section: {
      icon: FileSearch,
      label: "Récupération de l'analyse...",
    },
    get_sources: { icon: ShieldCheck, label: "Récupération des sources..." },
    get_flashcards: { icon: Loader, label: "Chargement des flashcards..." },
  };

const DEFAULT_CONFIG = { icon: Loader, label: "Traitement..." };

export function VoiceToolIndicator({
  toolName,
  isActive,
}: VoiceToolIndicatorProps) {
  if (!isActive || !toolName) return null;

  const config = TOOL_CONFIG[toolName] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div className="mb-3 animate-fade-in">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
        <Icon className="w-3.5 h-3.5 text-indigo-300 flex-shrink-0" />
        <span className="text-xs text-white/70 animate-pulse">
          {config.label}
        </span>
      </div>
    </div>
  );
}
