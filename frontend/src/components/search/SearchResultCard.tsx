import React from "react";
import { ChevronRight } from "lucide-react";
import { SearchTypeBadge } from "./SearchTypeBadge";
import type { GlobalSearchResult } from "../../services/api";

interface Props {
  result: GlobalSearchResult;
  query: string;
  onOpen: (r: GlobalSearchResult) => void;
}

/** Bold the query terms inside the preview text. */
function highlight(preview: string, q: string): React.ReactNode {
  if (!q.trim()) return preview;
  const re = new RegExp(
    `(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "ig",
  );
  const parts = preview.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-amber-400/30 text-amber-100 rounded px-0.5">
        {p}
      </mark>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export const SearchResultCard: React.FC<Props> = ({
  result,
  query,
  onOpen,
}) => {
  const meta = result.source_metadata;
  const title = meta.summary_title ?? "Analyse sans titre";
  const channel = meta.channel ?? "";
  const thumb = meta.summary_thumbnail;
  const score = (result.score * 100).toFixed(0);

  return (
    <button
      type="button"
      onClick={() => onOpen(result)}
      data-testid="search-result-card"
      className="w-full text-left flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/5 hover:border-white/20 transition-colors group"
    >
      {thumb && (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="w-24 h-16 sm:w-32 sm:h-20 rounded-md object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <SearchTypeBadge type={result.source_type} />
          <span className="text-[11px] font-mono text-white/40">
            score {score}%
          </span>
        </div>
        <h3 className="text-sm font-medium text-white truncate">{title}</h3>
        {channel && <p className="text-xs text-white/45 truncate">{channel}</p>}
        <p className="text-sm text-white/70 mt-1 line-clamp-2">
          {highlight(result.text_preview, query)}
        </p>
      </div>
      <ChevronRight className="self-center w-4 h-4 text-white/25 group-hover:text-white/65 flex-shrink-0" />
    </button>
  );
};
