/**
 * HighlightedText.test.tsx — Phase 3 Mobile, Task 9
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HighlightedText } from "../HighlightedText";
import { SemanticHighlighterProvider } from "../SemanticHighlighter";
import { ThemeProvider } from "@/contexts/ThemeContext";

jest.mock("@/services/api", () => ({
  searchApi: {
    withinSearch: jest.fn().mockResolvedValue({
      summary_id: 1,
      query: "test",
      matches: [],
    }),
  },
}));

const wrap = (child: React.ReactNode) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <SemanticHighlighterProvider summaryId={1}>
          {child}
        </SemanticHighlighterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe("HighlightedText", () => {
  it("rend le texte tel quel quand pas de matches", () => {
    const { getByText } = render(
      wrap(<HighlightedText tab="synthesis">Hello world</HighlightedText>),
    );
    expect(getByText("Hello world")).toBeTruthy();
  });

  it("rend du texte sans crasher quand provider absent", () => {
    const { getByText } = render(
      <ThemeProvider>
        <HighlightedText tab="synthesis">Texte de test</HighlightedText>
      </ThemeProvider>,
    );
    expect(getByText(/texte/i)).toBeTruthy();
  });
});
