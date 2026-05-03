/** @jest-environment jsdom */
//
// Tests — QuickSearch (input + collapse/expand + cache push)
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

describe("QuickSearch", () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the collapsed input with the placeholder", () => {
    render(<QuickSearch onSelectResult={() => {}} />);
    expect(
      screen.getByPlaceholderText(/rechercher mes analyses/i),
    ).toBeInTheDocument();
  });

  it("does not show results panel until user types 2+ chars", () => {
    render(<QuickSearch onSelectResult={() => {}} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("expands and shows loading after typing 2+ chars", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "ai",
        total_results: 0,
        results: [],
        searched_at: "2026-05-03T00:00:00Z",
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

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
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "",
        total_results: 0,
        results: [],
        searched_at: "",
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "SEARCH_GLOBAL" }),
    );
  });

  it("collapses (clears results) when input is emptied", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "ai",
        total_results: 0,
        results: [],
        searched_at: "",
      },
    });

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

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
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    const fakeResult = {
      source_type: "summary" as const,
      source_id: 5,
      summary_id: 5,
      score: 0.9,
      text_preview: "test preview",
      source_metadata: { summary_title: "Test" },
    };
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "test",
        total_results: 1,
        results: [fakeResult],
        searched_at: "",
      },
    });

    const onSelect = jest.fn();
    render(<QuickSearch onSelectResult={onSelect} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

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

  it("persists the query into chrome.storage.local cache after a successful search", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "energie",
        total_results: 0,
        results: [],
        searched_at: "",
      },
    });
    const setSpy = chrome.storage.local.set as jest.Mock;

    render(<QuickSearch onSelectResult={() => {}} />);
    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);

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
});
