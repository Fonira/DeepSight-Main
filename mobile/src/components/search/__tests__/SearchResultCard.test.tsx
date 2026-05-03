/**
 * SearchResultCard.test.tsx — Phase 3 Mobile, Task 5
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SearchResultCard } from "../SearchResultCard";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { GlobalSearchResultItem } from "@/services/api";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

const baseItem: GlobalSearchResultItem = {
  source_type: "summary",
  source_id: 1,
  summary_id: 42,
  score: 0.91,
  text_preview: "La transition énergétique impose...",
  source_metadata: { summary_title: "Crise énergétique EU", tab: "synthesis" },
};

describe("SearchResultCard", () => {
  it("affiche le badge SYNTHESE pour source_type summary", () => {
    const { getByText } = renderWithTheme(
      <SearchResultCard
        item={baseItem}
        onPress={jest.fn()}
        query="transition"
      />,
    );
    expect(getByText(/synthese/i)).toBeTruthy();
  });

  it("affiche le titre du summary", () => {
    const { getByText } = renderWithTheme(
      <SearchResultCard item={baseItem} onPress={jest.fn()} query="x" />,
    );
    expect(getByText(/crise énergétique/i)).toBeTruthy();
  });

  it("déclenche onPress au tap", () => {
    const onPress = jest.fn();
    const { getByLabelText } = renderWithTheme(
      <SearchResultCard item={baseItem} onPress={onPress} query="x" />,
    );
    fireEvent.press(getByLabelText(/résultat de recherche/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("affiche FLASHCARD pour source_type=flashcard", () => {
    const item = { ...baseItem, source_type: "flashcard" as const };
    const { getByText } = renderWithTheme(
      <SearchResultCard item={item} onPress={jest.fn()} query="x" />,
    );
    expect(getByText(/flashcard/i)).toBeTruthy();
  });

  it("affiche le score en pourcentage", () => {
    const { getByText } = renderWithTheme(
      <SearchResultCard item={baseItem} onPress={jest.fn()} query="x" />,
    );
    expect(getByText("91%")).toBeTruthy();
  });
});
