/** @jest-environment jsdom */
//
// Tests — QuickSearchResultsList (état loading/error/empty + footer web)
// Source : src/sidepanel/components/QuickSearchResultsList.tsx

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { QuickSearchResultsList } from "../../../src/sidepanel/components/QuickSearchResultsList";
import type { SearchResult } from "../../../src/types/search";

describe("QuickSearchResultsList", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  const mockResults: SearchResult[] = [
    {
      source_type: "summary",
      source_id: 1,
      summary_id: 1,
      score: 0.92,
      text_preview: "Crise énergétique européenne",
      source_metadata: { summary_title: "Crise EU", video_id: "v1" },
    },
    {
      source_type: "flashcard",
      source_id: 2,
      summary_id: 1,
      score: 0.87,
      text_preview: "Q: Quels objectifs pour la transition…",
      source_metadata: { summary_title: "Crise EU", video_id: "v1" },
    },
  ];

  it("renders a loading state when loading is true", () => {
    render(
      <QuickSearchResultsList
        results={[]}
        loading={true}
        error={null}
        query="test"
        totalResults={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/recherche/i)).toBeInTheDocument();
  });

  it("renders an error state when error is set", () => {
    render(
      <QuickSearchResultsList
        results={[]}
        loading={false}
        error="Network down"
        query="test"
        totalResults={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
  });

  it("renders an empty state when no results", () => {
    render(
      <QuickSearchResultsList
        results={[]}
        loading={false}
        error={null}
        query="zzz"
        totalResults={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/aucun résultat/i)).toBeInTheDocument();
  });

  it("renders all results when populated", () => {
    render(
      <QuickSearchResultsList
        results={mockResults}
        loading={false}
        error={null}
        query="test"
        totalResults={2}
        onSelect={() => {}}
      />,
    );
    expect(screen.getAllByText("Crise EU")).toHaveLength(2);
  });

  it("forwards onSelect when a result item is clicked", () => {
    const onSelect = jest.fn();
    render(
      <QuickSearchResultsList
        results={mockResults}
        loading={false}
        error={null}
        query="test"
        totalResults={2}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getAllByText("Crise EU")[0]);
    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it("renders footer with total_results that opens web app on click", () => {
    const tabsCreate = chrome.tabs.create as jest.Mock;
    render(
      <QuickSearchResultsList
        results={mockResults}
        loading={false}
        error={null}
        query="énergie"
        totalResults={42}
        onSelect={() => {}}
      />,
    );
    const footer = screen.getByText(/voir tous les résultats/i);
    expect(footer).toBeInTheDocument();
    fireEvent.click(footer);
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/search?q="),
      }),
    );
  });
});
