import React, { useState, useRef } from "react";
import { Search, X, Clock } from "lucide-react";
import { useRecentQueries } from "./useRecentQueries";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: (q: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export const SearchInput: React.FC<Props> = ({
  value,
  onChange,
  onSubmit,
  autoFocus = true,
  placeholder = "Rechercher dans tes analyses…",
}) => {
  const [focused, setFocused] = useState(false);
  const { queries: recent } = useRecentQueries();
  const inputRef = useRef<HTMLInputElement>(null);

  const showSuggestions =
    focused && value.trim().length === 0 && recent.length > 0;

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45 pointer-events-none"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) onSubmit(value);
          }}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full pl-12 pr-12 py-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl text-white placeholder-white/35 outline-none focus:border-indigo-500/40 focus:bg-white/[0.07] transition-colors"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {showSuggestions && (
        <ul
          role="listbox"
          aria-label="Recherches récentes"
          className="absolute z-30 left-0 right-0 mt-2 rounded-xl bg-[#12121a] border border-white/10 shadow-2xl overflow-hidden"
        >
          {recent.map((q) => (
            <li key={q}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(q);
                  onSubmit?.(q);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
              >
                <Clock className="w-4 h-4 text-white/40" aria-hidden />
                <span className="truncate">{q}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
