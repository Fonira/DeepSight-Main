/**
 * PassageActionSheet.test.tsx — Phase 3 Mobile, Task 11
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { PassageActionSheet } from "../PassageActionSheet";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { WithinMatchItem } from "@/services/api";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const baseMatch: WithinMatchItem = {
  source_type: "summary",
  source_id: 1,
  summary_id: 42,
  text: "passage texte",
  text_html: "<mark>passage</mark> texte",
  tab: "synthesis",
  score: 0.9,
  passage_id: "p-1",
  metadata: {},
};

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("PassageActionSheet", () => {
  it("retourne null si match=null", () => {
    const { queryByText } = renderWithTheme(
      <PassageActionSheet
        match={null}
        query="x"
        isOpen
        onClose={jest.fn()}
        summaryId={42}
      />,
    );
    expect(queryByText(/demander à l'ia/i)).toBeNull();
  });

  it("affiche les 2 actions principales (sans timecode) quand match.metadata vide", () => {
    const { getByText, queryByText } = renderWithTheme(
      <PassageActionSheet
        match={baseMatch}
        query="x"
        isOpen
        onClose={jest.fn()}
        summaryId={42}
      />,
    );
    expect(getByText(/demander à l'ia/i)).toBeTruthy();
    expect(getByText(/voir dans/i)).toBeTruthy();
    expect(queryByText(/sauter au timecode/i)).toBeNull();
  });

  it("affiche 'Sauter timecode' si start_ts présent", () => {
    const m: WithinMatchItem = {
      ...baseMatch,
      metadata: { start_ts: 222 },
    };
    const { getByText } = renderWithTheme(
      <PassageActionSheet
        match={m}
        query="x"
        isOpen
        onClose={jest.fn()}
        summaryId={42}
      />,
    );
    expect(getByText(/sauter au timecode/i)).toBeTruthy();
  });
});
