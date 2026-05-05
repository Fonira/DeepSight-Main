/** @jest-environment jsdom */
//
// Tests — QuickSearch (input + collapse/expand + cache push + feature flag probe)
// Source : src/sidepanel/components/QuickSearch.tsx

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { QuickSearch } from "../../../src/sidepanel/components/QuickSearch";

// Helper : configure le mock chrome.runtime.sendMessage pour répondre
// différemment selon l'action (probe GET_RECENT_QUERIES vs SEARCH_GLOBAL).
function mockSendMessage(handlers: {
  recentQueries?: string[];
  recentQueriesSuccess?: boolean;
  recentQueriesError?: string;
  searchResults?: {
    success: boolean;
    searchResults?: {
      query: string;
      total_results: number;
      results: unknown[];
      searched_at: string;
    };
    error?: string;
  };
}) {
  const sendMessage = chrome.runtime.sendMessage as jest.Mock;
  sendMessage.mockImplementation((msg: { action: string }) => {
    if (msg?.action === "GET_RECENT_QUERIES") {
      if (handlers.recentQueriesSuccess === false) {
        return Promise.resolve({
          success: false,
          error: handlers.recentQueriesError ?? "feature_disabled",
        });
      }
      return Promise.resolve({
        success: true,
        recentQueries: handlers.recentQueries ?? [],
      });
    }
    if (msg?.action === "SEARCH_GLOBAL") {
      return Promise.resolve(handlers.searchResults ?? { success: true });
    }
    return Promise.resolve({});
  });
  return sendMessage;
}

describe("QuickSearch", () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the collapsed input with the placeholder", async () => {
    mockSendMessage({});
    render(<QuickSearch onSelectResult={() => {}} />);
    // Wait for the probe to settle so the component is rendered (not null).
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/rechercher mes analyses/i),
      ).toBeInTheDocument();
    });
  });

  it("does not show results panel until user types 2+ chars", async () => {
    mockSendMessage({});
    render(<QuickSearch onSelectResult={() => {}} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/rechercher mes analyses/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("expands and shows loading after typing 2+ chars", async () => {
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "ai",
          total_results: 0,
          results: [],
          searched_at: "2026-05-03T00:00:00Z",
        },
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "ai" } });

    // Loading visible immédiatement (debounce starts mais loading=true).
    expect(screen.getByText(/recherche/i)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
    });
  });

  it("does not call SEARCH_GLOBAL for queries shorter than 2 chars", async () => {
    const sendMessage = mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "",
          total_results: 0,
          results: [],
          searched_at: "",
        },
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "SEARCH_GLOBAL" }),
    );
  });

  it("collapses (clears results) when input is emptied", async () => {
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "ai",
          total_results: 0,
          results: [],
          searched_at: "",
        },
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "ai" } });
    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    await waitFor(() => {
      expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText(/aucun résultat/i)).toBeNull();
  });

  it("calls onSelectResult when a result item is clicked", async () => {
    const fakeResult = {
      source_type: "summary" as const,
      source_id: 5,
      summary_id: 5,
      score: 0.9,
      text_preview: "test preview",
      source_metadata: { summary_title: "Test" },
    };
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "test",
          total_results: 1,
          results: [fakeResult],
          searched_at: "",
        },
      },
    });

    const onSelect = jest.fn();
    render(<QuickSearch onSelectResult={onSelect} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "test" } });
    await act(async () => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test"));
    expect(onSelect).toHaveBeenCalledWith(fakeResult);
  });

  it("persists the query into chrome.storage.local cache after a successful search WITH results", async () => {
    const fakeResult = {
      source_type: "summary" as const,
      source_id: 5,
      summary_id: 5,
      score: 0.9,
      text_preview: "preview",
      source_metadata: { summary_title: "Energie title" },
    };
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "energie",
          total_results: 1,
          results: [fakeResult],
          searched_at: "",
        },
      },
    });
    const setSpy = chrome.storage.local.set as jest.Mock;

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "energie" } });
    await act(async () => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recent_queries: expect.arrayContaining(["energie"]),
        }),
      );
    });
  });

  it("does NOT cache the query when search returns zero results (bonus fix)", async () => {
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "nomatch",
          total_results: 0,
          results: [],
          searched_at: "",
        },
      },
    });
    const setSpy = chrome.storage.local.set as jest.Mock;

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "nomatch" } });
    await act(async () => {
      jest.advanceTimersByTime(401);
    });
    await waitFor(() => {
      expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
    });

    expect(setSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        recent_queries: expect.anything(),
      }),
    );
  });

  it("hides the component entirely when feature flag is disabled (probe returns feature_disabled)", async () => {
    mockSendMessage({
      recentQueriesSuccess: false,
      recentQueriesError: "feature_disabled",
    });

    const { container } = render(<QuickSearch onSelectResult={() => {}} />);
    // Wait for the probe to resolve (microtask).
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("hides the component when probe error mentions 503 / 404", async () => {
    mockSendMessage({
      recentQueriesSuccess: false,
      recentQueriesError: "Service Unavailable: 503",
    });

    const { container } = render(<QuickSearch onSelectResult={() => {}} />);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("displays recent queries as suggestions when input is focused and empty", async () => {
    mockSendMessage({
      recentQueries: ["énergie", "europe", "ia"],
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    // Wait for probe to settle and recentQueries to populate.
    await waitFor(() => {
      // No suggestions yet because input is not focused.
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByText("énergie")).toBeInTheDocument();
      expect(screen.getByText("europe")).toBeInTheDocument();
      expect(screen.getByText("ia")).toBeInTheDocument();
    });
  });

  it("hides suggestions when query is non-empty", async () => {
    mockSendMessage({
      recentQueries: ["énergie"],
      searchResults: {
        success: true,
        searchResults: {
          query: "ai",
          total_results: 0,
          results: [],
          searched_at: "",
        },
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = await screen.findByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.focus(input);
    await waitFor(() => {
      expect(screen.getByText("énergie")).toBeInTheDocument();
    });

    // Type something — suggestions should disappear.
    fireEvent.change(input, { target: { value: "ai" } });
    expect(screen.queryByText(/recherches récentes/i)).toBeNull();
  });

  it("clicking a suggestion sets the query and triggers a search", async () => {
    mockSendMessage({
      recentQueries: ["transition"],
      searchResults: {
        success: true,
        searchResults: {
          query: "transition",
          total_results: 0,
          results: [],
          searched_at: "",
        },
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = (await screen.findByPlaceholderText(
      /rechercher mes analyses/i,
    )) as HTMLInputElement;

    fireEvent.focus(input);
    await waitFor(() => {
      expect(screen.getByText("transition")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText("transition"));

    await waitFor(() => {
      expect(input.value).toBe("transition");
    });

    await act(async () => {
      jest.advanceTimersByTime(401);
    });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SEARCH_GLOBAL",
          data: { query: "transition", limit: 10 },
        }),
      );
    });
  });
});
