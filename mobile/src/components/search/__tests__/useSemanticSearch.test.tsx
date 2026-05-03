/**
 * useSemanticSearch.test.tsx — Phase 3 Mobile, Task 7
 *
 * Tests du hook React Query :
 *   - skip si query trim < 2 caractères
 *   - debounce 400ms avant appel API
 *   - transmission des filtres
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSemanticSearch } from "../useSemanticSearch";
import { searchApi } from "@/services/api";

jest.mock("@/services/api", () => ({
  searchApi: { globalSearch: jest.fn() },
}));

const mocked = searchApi.globalSearch as jest.MockedFunction<
  typeof searchApi.globalSearch
>;

const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe("useSemanticSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ne fetch pas si query trim < 2 caractères", () => {
    renderHook(() => useSemanticSearch(" a ", {}), {
      wrapper: createWrapper(),
    });
    jest.advanceTimersByTime(500);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("debounce 400ms avant l'appel API", async () => {
    mocked.mockResolvedValue({
      query: "test",
      total_results: 0,
      results: [],
      searched_at: "2026-05-03T10:00:00Z",
    });

    renderHook(() => useSemanticSearch("transition", {}), {
      wrapper: createWrapper(),
    });

    jest.advanceTimersByTime(300);
    expect(mocked).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150);
    jest.useRealTimers();
    await waitFor(() => expect(mocked).toHaveBeenCalledTimes(1));
  });

  it("transmet les filtres à l'API", async () => {
    mocked.mockResolvedValue({
      query: "x",
      total_results: 0,
      results: [],
      searched_at: "",
    });

    renderHook(
      () =>
        useSemanticSearch("query", {
          source_types: ["summary"],
          favorites_only: true,
        }),
      { wrapper: createWrapper() },
    );

    jest.advanceTimersByTime(500);
    jest.useRealTimers();
    await waitFor(() =>
      expect(mocked).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "query",
          source_types: ["summary"],
          favorites_only: true,
        }),
      ),
    );
  });
});
