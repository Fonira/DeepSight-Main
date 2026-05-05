/**
 * useHighlightNav.test.tsx — Phase 3 Mobile, Task 12
 */

import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHighlightNav } from "../useHighlightNav";
import { SemanticHighlighterProvider } from "../SemanticHighlighter";

jest.mock("@/services/api", () => ({
  searchApi: {
    withinSearch: jest.fn().mockResolvedValue({
      summary_id: 1,
      query: "test",
      matches: [],
    }),
  },
}));

const wrapWithProviders = (children: React.ReactNode) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <SemanticHighlighterProvider summaryId={1}>
        {children}
      </SemanticHighlighterProvider>
    </QueryClientProvider>
  );
};

describe("useHighlightNav", () => {
  it("retourne total=0 sans matches", () => {
    const { result } = renderHook(() => useHighlightNav(), {
      wrapper: ({ children }) => wrapWithProviders(children),
    });
    expect(result.current.total).toBe(0);
    expect(result.current.matchesEmpty).toBe(true);
  });

  it("next/prev sont des no-op sans matches (currentMatchIndex reste 0)", () => {
    const { result } = renderHook(() => useHighlightNav(), {
      wrapper: ({ children }) => wrapWithProviders(children),
    });
    // Avec provider mais sans matches, current = ctx.currentMatchIndex + 1 = 1
    expect(result.current.current).toBe(1);
    expect(result.current.matchesEmpty).toBe(true);
    act(() => result.current.next());
    expect(result.current.current).toBe(1); // pas changé
    act(() => result.current.prev());
    expect(result.current.current).toBe(1); // pas changé
  });

  it("close est sécurisé même sans matches", () => {
    const { result } = renderHook(() => useHighlightNav(), {
      wrapper: ({ children }) => wrapWithProviders(children),
    });
    expect(() => act(() => result.current.close())).not.toThrow();
  });

  it("retourne current=0 sans provider monté", () => {
    const { result } = renderHook(() => useHighlightNav());
    expect(result.current.current).toBe(0);
    expect(result.current.matchesEmpty).toBe(true);
  });
});
