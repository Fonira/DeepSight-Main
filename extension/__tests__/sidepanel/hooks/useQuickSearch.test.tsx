/** @jest-environment jsdom */
//
// Tests — useQuickSearch hook (debounce 400ms + chrome.runtime.sendMessage + AbortController)
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

  it("ignores stale results when a new query supersedes the old one (abort)", async () => {
    // Simule un sendMessage lent qui résout APRÈS qu'un nouveau call ait
    // déjà eu lieu. Avant le fix #4, le premier résultat lent overwriterait
    // les résultats du second call (race condition).
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    let resolveFirst: ((value: unknown) => void) | null = null;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    sendMessage.mockImplementationOnce(() => firstPromise);
    sendMessage.mockResolvedValueOnce({
      success: true,
      searchResults: {
        query: "second",
        total_results: 1,
        results: [
          {
            source_type: "summary",
            source_id: 222,
            summary_id: 222,
            score: 0.9,
            text_preview: "second result",
            source_metadata: {},
          },
        ],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    const { rerender } = render(<Harness query="first" />);

    // Trigger first request via debounce.
    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    // User types a different query AVANT que la première réponse n'arrive.
    rerender(<Harness query="second" />);
    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);

    // Maintenant on résout la PREMIÈRE requête (la stale) avec un résultat
    // différent — le hook doit l'ignorer puisqu'elle a été abort.
    await act(async () => {
      resolveFirst?.({
        success: true,
        searchResults: {
          query: "first",
          total_results: 1,
          results: [
            {
              source_type: "summary",
              source_id: 111,
              summary_id: 111,
              score: 0.9,
              text_preview: "stale first",
              source_metadata: {},
            },
          ],
          searched_at: "2026-05-03T00:00:00Z",
        },
      });
    });

    await waitFor(() => {
      // L'UI doit refléter UNIQUEMENT le second résultat, pas le stale.
      expect(screen.getByTestId("result-0")).toHaveTextContent("summary:222");
    });
    // Et pas de result-1 (count=1).
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("aborts the in-flight request on unmount (no state update after unmount)", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    let resolveCall: ((value: unknown) => void) | null = null;
    sendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
    );

    const { unmount } = render(<Harness query="test" />);
    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    // Unmount avant que la requête réponde.
    unmount();

    // Résoudre la requête maintenant — le hook ne doit pas warn React
    // (set state on unmounted component) car signal.aborted est true.
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    await act(async () => {
      resolveCall?.({
        success: true,
        searchResults: {
          query: "test",
          total_results: 0,
          results: [],
          searched_at: "",
        },
      });
    });

    // Pas de warning React "Can't perform a React state update on an unmounted component".
    const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((args) =>
      String(args[0] ?? "").includes("unmounted component"),
    );
    expect(stateUpdateWarnings).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
});
