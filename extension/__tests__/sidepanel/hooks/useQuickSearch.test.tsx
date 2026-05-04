/** @jest-environment jsdom */
//
// Tests — useQuickSearch hook (debounce 400ms + chrome.runtime.sendMessage)
// Source : src/sidepanel/hooks/useQuickSearch.ts (Phase 4 Semantic Search V1)

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { useQuickSearch } from "../../../src/sidepanel/hooks/useQuickSearch";

// Test harness — minimal React component that exposes the hook state.
function Harness({ query }: { query: string }) {
  const { results, loading, error } = useQuickSearch(query);
  return (
    <div>
      <span data-testid="loading">{loading ? "true" : "false"}</span>
      <span data-testid="error">{error || ""}</span>
      <span data-testid="count">{results.length}</span>
      {results.map((r, i) => (
        <span key={i} data-testid={`result-${i}`}>
          {r.source_type}:{r.source_id}
        </span>
      ))}
    </div>
  );
}

describe("useQuickSearch", () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns empty results when query is shorter than 2 chars", () => {
    render(<Harness query="a" />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("debounces 400ms before sending the search request", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "test",
        total_results: 0,
        results: [],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    render(<Harness query="test" />);

    // Avant 400ms — aucun call envoyé.
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2);
    });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SEARCH_GLOBAL",
          data: { query: "test", limit: 10 },
        }),
      );
    });
  });

  it("populates results when sendMessage succeeds", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "ai",
        total_results: 1,
        results: [
          {
            source_type: "summary",
            source_id: 7,
            summary_id: 7,
            score: 0.9,
            text_preview: "…",
            source_metadata: {},
          },
        ],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    render(<Harness query="ai" />);
    await act(async () => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
      expect(screen.getByTestId("result-0")).toHaveTextContent("summary:7");
    });
  });

  it("surfaces error when sendMessage returns success:false", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: false,
      error: "Network error",
    });

    render(<Harness query="test" />);
    await act(async () => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Network error");
    });
  });
});
