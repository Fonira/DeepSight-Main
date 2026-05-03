import React from "react";
import { SlidersHorizontal } from "lucide-react";
import type { SearchSourceType, SearchFilters } from "../../services/api";

const ALL_TYPES: SearchSourceType[] = [
  "summary",
  "flashcard",
  "quiz",
  "chat",
  "transcript",
];
const TYPE_LABELS: Record<SearchSourceType, string> = {
  summary: "Synthèse",
  flashcard: "Flashcards",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcripts",
};

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  countsByType?: Partial<Record<SearchSourceType, number>>;
  totalCount?: number;
  onToggleAdvanced: () => void;
  advancedOpen: boolean;
}

export const SearchFiltersBar: React.FC<Props> = ({
  filters,
  onChange,
  countsByType = {},
  totalCount,
  onToggleAdvanced,
  advancedOpen,
}) => {
  const active = filters.source_types ?? [];
  const isAll = active.length === 0;

  const toggleAll = () => onChange({ ...filters, source_types: undefined });
  const toggleType = (t: SearchSourceType) => {
    const set = new Set(active);
    if (set.has(t)) {
      set.delete(t);
    } else {
      set.add(t);
    }
    onChange({
      ...filters,
      source_types: set.size === 0 ? undefined : Array.from(set),
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleAll}
        aria-pressed={isAll}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          isAll
            ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40"
            : "bg-white/5 text-white/65 border border-white/10 hover:bg-white/10"
        }`}
      >
        Tout {totalCount !== undefined ? `(${totalCount})` : ""}
      </button>
      {ALL_TYPES.map((t) => {
        const isActive = active.includes(t);
        const n = countsByType[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggleType(t)}
            aria-pressed={isActive}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/40"
                : "bg-white/5 text-white/65 border border-white/10 hover:bg-white/10"
            }`}
          >
            {TYPE_LABELS[t]}
            {typeof n === "number" ? ` ${n}` : ""}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onToggleAdvanced}
        aria-expanded={advancedOpen}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white hover:bg-white/10"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtres avancés
      </button>
    </div>
  );
};
