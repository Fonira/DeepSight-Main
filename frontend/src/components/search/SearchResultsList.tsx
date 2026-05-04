import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SearchResultCard } from "./SearchResultCard";
import type { GlobalSearchResult } from "../../services/api";

interface Props {
  results: GlobalSearchResult[];
  query: string;
  onOpen: (r: GlobalSearchResult) => void;
}

export const SearchResultsList: React.FC<Props> = ({
  results,
  query,
  onOpen,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 6,
  });

  return (
    <div
      ref={parentRef}
      className="w-full max-w-3xl mx-auto overflow-y-auto"
      style={{ maxHeight: "calc(100vh - 280px)" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const r = results[vi.index];
          return (
            <div
              key={`${r.source_type}-${r.source_id}`}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
                paddingBottom: 8,
              }}
            >
              <SearchResultCard result={r} query={query} onOpen={onOpen} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
