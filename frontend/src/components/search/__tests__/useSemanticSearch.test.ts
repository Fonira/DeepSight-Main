import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSemanticSearch } from "../useSemanticSearch";
import { searchApi, ApiError } from "../../../services/api";

vi.mock("../../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../services/api")>(
      "../../../services/api",
    );
  return {
    ...actual,
    searchApi: { searchGlobal: vi.fn() },
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe("useSemanticSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not call API when query is empty", () => {
    const { result } = renderHook(
      () => useSemanticSearch({ query: "", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(searchApi.searchGlobal).not.toHaveBeenCalled();
  });

  it("does not call API when query has less than 2 chars", () => {
    renderHook(
      () => useSemanticSearch({ query: "a", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    expect(searchApi.searchGlobal).not.toHaveBeenCalled();
  });

  it("calls searchGlobal when query has >= 2 chars", async () => {
    (
      searchApi.searchGlobal as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      query: "ai",
      total_results: 0,
      results: [],
      searched_at: "2026-05-03T12:00:00Z",
    });
    renderHook(
      () => useSemanticSearch({ query: "ai", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    await waitFor(() =>
      expect(searchApi.searchGlobal).toHaveBeenCalledWith("ai", {}, 20),
    );
  });

  it("debounces input changes", async () => {
    (
      searchApi.searchGlobal as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      query: "f",
      total_results: 0,
      results: [],
      searched_at: "x",
    });
    const { rerender } = renderHook(
      ({ q }: { q: string }) =>
        useSemanticSearch({ query: q, filters: {}, debounceMs: 50 }),
      { wrapper, initialProps: { q: "" } },
    );
    rerender({ q: "ai" });
    rerender({ q: "ais" });
    rerender({ q: "aist" });
    await new Promise((r) => setTimeout(r, 150));
    await waitFor(() => {
      expect(searchApi.searchGlobal).toHaveBeenCalledTimes(1);
      expect(searchApi.searchGlobal).toHaveBeenLastCalledWith("aist", {}, 20);
    });
  });

  it("exposes featureDisabled=true when backend returns 404 (flag off)", async () => {
    (
      searchApi.searchGlobal as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new ApiError("Not Found", 404));
    const { result } = renderHook(
      () => useSemanticSearch({ query: "ai", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.featureDisabled).toBe(true));
    // Generic error must NOT be exposed when feature is disabled —
    // SearchPage relies on this distinction to render a dedicated empty state.
    expect(result.current.error).toBeNull();
  });

  it("exposes featureDisabled=true when backend returns 503", async () => {
    (
      searchApi.searchGlobal as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new ApiError("Service Unavailable", 503));
    const { result } = renderHook(
      () => useSemanticSearch({ query: "ai", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.featureDisabled).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it("keeps generic error for non-feature-disabled status (e.g. 500)", async () => {
    (
      searchApi.searchGlobal as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new ApiError("Server error", 500));
    const { result } = renderHook(
      () => useSemanticSearch({ query: "ai", filters: {}, debounceMs: 0 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.featureDisabled).toBe(false);
  });
});
