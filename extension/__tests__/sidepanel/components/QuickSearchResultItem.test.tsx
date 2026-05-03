/** @jest-environment jsdom */
//
// Tests — QuickSearchResultItem (1 ligne par résultat avec badge type)
// Source : src/sidepanel/components/QuickSearchResultItem.tsx

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickSearchResultItem } from "../../../src/sidepanel/components/QuickSearchResultItem";
import type { SearchResult } from "../../../src/types/search";

describe("QuickSearchResultItem", () => {
  const baseResult: SearchResult = {
    source_type: "summary",
    source_id: 12,
    summary_id: 12,
    score: 0.91,
    text_preview:
      "…la transition énergétique impose une refonte du mix électrique européen…",
    source_metadata: {
      summary_title: "Crise énergétique EU",
      summary_thumbnail: "https://example.com/thumb.jpg",
      video_id: "abc",
    },
  };

  it("renders the summary title", () => {
    render(<QuickSearchResultItem result={baseResult} onSelect={() => {}} />);
    expect(screen.getByText("Crise énergétique EU")).toBeInTheDocument();
  });

  it("renders the source type badge for summary", () => {
    render(<QuickSearchResultItem result={baseResult} onSelect={() => {}} />);
    expect(screen.getByText(/synth/i)).toBeInTheDocument();
  });

  it("renders different badge for flashcard", () => {
    const flashcardResult: SearchResult = {
      ...baseResult,
      source_type: "flashcard",
      source_metadata: { ...baseResult.source_metadata, summary_title: "Ex" },
    };
    render(
      <QuickSearchResultItem result={flashcardResult} onSelect={() => {}} />,
    );
    expect(screen.getByText(/flashcard/i)).toBeInTheDocument();
  });

  it("calls onSelect with the result when clicked", () => {
    const onSelect = jest.fn();
    render(<QuickSearchResultItem result={baseResult} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Crise énergétique EU"));
    expect(onSelect).toHaveBeenCalledWith(baseResult);
  });

  it("falls back to text_preview if no summary_title", () => {
    const noTitle: SearchResult = {
      ...baseResult,
      source_metadata: {},
    };
    render(<QuickSearchResultItem result={noTitle} onSelect={() => {}} />);
    expect(
      screen.getByText(/la transition énergétique impose/i),
    ).toBeInTheDocument();
  });
});
