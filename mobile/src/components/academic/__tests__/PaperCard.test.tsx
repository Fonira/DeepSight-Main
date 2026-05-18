/**
 * Tests PaperCard mobile — badges sources (Scholar + Crossref ajoutés PR3b)
 * Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md §13.2
 */

import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      background: "#0a0a0f",
      surface: "#15151f",
      borderDefault: "rgba(255,255,255,0.06)",
      textPrimary: "#ffffff",
      textSecondary: "#f1f5f9",
      textTertiary: "#cbd5e1",
      accentPrimary: "#6366f1",
      success: "#22c55e",
    },
    isDark: true,
  }),
}));

jest.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    tr: (fr: string, _en: string) => fr,
  }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const RN = require("react-native");
    return <RN.Text>{`[icon:${name}]`}</RN.Text>;
  },
}));

import { PaperCard } from "../PaperCard";
import type { AcademicPaper } from "../../../services/api";

const basePaper: AcademicPaper = {
  id: "p-1",
  doi: "10.1000/test",
  title: "A test paper about epistemology",
  authors: [{ name: "Doe, J." }],
  year: 2024,
  venue: "Journal of Tests",
  abstract: "An abstract of the test paper.",
  citation_count: 42,
  url: "https://example.com/p-1",
  pdf_url: undefined,
  source: "semantic_scholar",
  relevance_score: 0.95,
  is_open_access: false,
  keywords: ["test"],
};

describe("PaperCard — source badges (mobile)", () => {
  it("affiche le badge 'Semantic Scholar' pour source=semantic_scholar", () => {
    const { getByText } = render(<PaperCard paper={basePaper} />);
    expect(getByText("Semantic Scholar")).toBeTruthy();
  });

  it("affiche le badge 'OpenAlex' pour source=openalex", () => {
    const { getByText } = render(
      <PaperCard paper={{ ...basePaper, source: "openalex" }} />,
    );
    expect(getByText("OpenAlex")).toBeTruthy();
  });

  it("affiche le badge 'arXiv' pour source=arxiv", () => {
    const { getByText } = render(
      <PaperCard paper={{ ...basePaper, source: "arxiv" }} />,
    );
    expect(getByText("arXiv")).toBeTruthy();
  });

  it("affiche le badge 'Crossref' pour source=crossref", () => {
    const { getByText } = render(
      <PaperCard paper={{ ...basePaper, source: "crossref" }} />,
    );
    expect(getByText("Crossref")).toBeTruthy();
  });

  it("affiche le badge 'via Scholar' pour source=scholar", () => {
    const { getByText } = render(
      <PaperCard paper={{ ...basePaper, source: "scholar" }} />,
    );
    expect(getByText("via Scholar")).toBeTruthy();
  });
});
