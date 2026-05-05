import React from "react";
import { Search as SearchIcon, Inbox } from "lucide-react";

interface Props {
  variant: "no-query" | "no-results";
  query?: string;
  recentQueries?: string[];
  onPickQuery?: (q: string) => void;
}

export const SearchEmptyState: React.FC<Props> = ({
  variant,
  query,
  recentQueries = [],
  onPickQuery,
}) => {
  if (variant === "no-query") {
    return (
      <div className="text-center py-16">
        <SearchIcon
          className="w-10 h-10 text-white/25 mx-auto mb-3"
          aria-hidden
        />
        <p className="text-white/65 mb-1">
          Cherche dans toutes tes analyses, flashcards, quiz et chats.
        </p>
        {recentQueries.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-white/40 mb-2">Recherches récentes</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {recentQueries.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onPickQuery?.(q)}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <Inbox className="w-10 h-10 text-white/25 mx-auto mb-3" aria-hidden />
      <p className="text-white/85 mb-1">Aucun résultat pour « {query} »</p>
      <p className="text-sm text-white/45">
        Essaie une formulation différente ou retire un filtre.
      </p>
    </div>
  );
};
