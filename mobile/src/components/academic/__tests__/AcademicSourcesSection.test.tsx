/**
 * Tests AcademicSourcesSection mobile — toggle Scholar deep_search (spec PR3b)
 * Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md §13.2
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

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
      warning: "#f59e0b",
      error: "#ef4444",
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
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const mockEnrich = jest.fn();
jest.mock("../../../services/api", () => ({
  academicApi: {
    enrich: (...args: unknown[]) => mockEnrich(...args),
    search: jest.fn(),
    getPapers: jest.fn(),
    exportBibliography: jest.fn(),
  },
}));

jest.mock("../../ui", () => {
  const RN = require("react-native");
  const Card = ({ children, style }: { children: React.ReactNode; style?: unknown }) => (
    <RN.View style={style}>{children}</RN.View>
  );
  const Button = ({
    title,
    onPress,
    testID,
  }: {
    title: string;
    onPress?: () => void;
    testID?: string;
  }) => (
    <RN.TouchableOpacity onPress={onPress} testID={testID ?? `btn-${title}`}>
      <RN.Text>{title}</RN.Text>
    </RN.TouchableOpacity>
  );
  const Badge = ({ children }: { children: React.ReactNode }) => (
    <RN.View>
      <RN.Text>{children}</RN.Text>
    </RN.View>
  );
  return { Card, Button, Badge };
});

jest.mock("../BibliographyExport", () => ({
  BibliographyExportModal: () => null,
}));

jest.mock("../PaperCard", () => ({
  PaperCard: () => null,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const RN = require("react-native");
    return <RN.Text>{`[icon:${name}]`}</RN.Text>;
  },
}));

import { AcademicSourcesSection } from "../AcademicSourcesSection";

const baseResponse = {
  papers: [],
  total_found: 0,
  query_keywords: ["test"],
  sources_queried: ["openalex"],
  cached: false,
  tier_limit_reached: false,
  tier_limit: undefined,
};

describe("AcademicSourcesSection — Scholar deep_search toggle (mobile)", () => {
  beforeEach(() => {
    mockEnrich.mockReset();
    mockEnrich.mockResolvedValue(baseResponse);
  });

  it("affiche le Switch deep_search pour un user Pro", () => {
    const { getByTestId, queryByTestId } = render(
      <AcademicSourcesSection summaryId="42" userPlan="pro" />,
    );
    expect(getByTestId("deep-search-switch")).toBeTruthy();
    expect(getByTestId("deep-search-row")).toBeTruthy();
    expect(queryByTestId("deep-search-upgrade-cta")).toBeNull();
  });

  it("affiche le Switch pour un user Expert", () => {
    const { getByTestId } = render(
      <AcademicSourcesSection summaryId="42" userPlan="expert" />,
    );
    expect(getByTestId("deep-search-switch")).toBeTruthy();
  });

  it("affiche la CTA upgrade pour un user Free (pas de Switch)", () => {
    const onUpgrade = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <AcademicSourcesSection
        summaryId="42"
        userPlan="free"
        onUpgrade={onUpgrade}
      />,
    );
    expect(queryByTestId("deep-search-switch")).toBeNull();
    expect(getByTestId("deep-search-upgrade-cta")).toBeTruthy();
  });

  it("appelle onUpgrade quand le user free clique sur la CTA", () => {
    const onUpgrade = jest.fn();
    const { getByTestId } = render(
      <AcademicSourcesSection
        summaryId="42"
        userPlan="free"
        onUpgrade={onUpgrade}
      />,
    );
    fireEvent.press(getByTestId("deep-search-upgrade-cta"));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("passe deep_search=false par défaut au call enrich (Pro)", async () => {
    const { getByTestId } = render(
      <AcademicSourcesSection summaryId="42" userPlan="pro" />,
    );
    fireEvent.press(getByTestId("btn-Rechercher des sources"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockEnrich).toHaveBeenCalledTimes(1);
    expect(mockEnrich).toHaveBeenCalledWith("42", { deep_search: false });
  });

  it("passe deep_search=true au call enrich quand le Switch est activé", async () => {
    const { getByTestId } = render(
      <AcademicSourcesSection summaryId="42" userPlan="pro" />,
    );
    fireEvent(getByTestId("deep-search-switch"), "valueChange", true);
    fireEvent.press(getByTestId("btn-Rechercher des sources"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockEnrich).toHaveBeenCalledWith("42", { deep_search: true });
  });
});
