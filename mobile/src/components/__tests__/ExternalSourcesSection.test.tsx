/**
 * Tests ExternalSourcesSection mobile — pages externes citées (spec PR4 mobile)
 * Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9 (Mobile)
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      background: "#0a0a0f",
      surface: "#15151f",
      surfaceSecondary: "#12121a",
      border: "rgba(255,255,255,0.06)",
      borderLight: "rgba(255,255,255,0.12)",
      textPrimary: "#ffffff",
      textSecondary: "#f1f5f9",
      textTertiary: "#cbd5e1",
      textMuted: "#94a3b8",
      accentSecondary: "#9B6B4A",
      amber: "#f59e0b",
    },
    isDark: true,
  }),
}));

const mockPlan = { value: "pro" as "free" | "pro" | "expert" };
jest.mock("../../hooks/usePlan", () => ({
  usePlan: () => ({ plan: mockPlan.value }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

const mockOpenURL = jest.fn((_url: string) => Promise.resolve());
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: { View },
    FadeIn: {
      duration: () => ({ delay: () => ({}) }),
      delay: () => ({}),
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: () => ({ value: 0 }),
    withRepeat: () => 0,
    withTiming: () => 0,
  };
});

import { ExternalSourcesSection } from "../ExternalSourcesSection";
import type {
  ExternalPagesData,
  ExternalPageCitation,
  ExternalPageStatus,
} from "../../types";

const okPage = (
  url: string,
  title: string,
  summary: string,
): ExternalPageCitation => ({
  url,
  final_url: url,
  title,
  summary,
  key_claims: ["Claim 1", "Claim 2", "Claim 3"],
  status: "ok",
  fetched_via_proxy: false,
  bytes_fetched: 12345,
});

const statusPage = (
  status: ExternalPageStatus,
  url = "https://example.com/x",
): ExternalPageCitation => ({
  url,
  final_url: url,
  title: "Example",
  summary: "",
  key_claims: [],
  status,
  fetched_via_proxy: false,
  bytes_fetched: 0,
});

const baseData: ExternalPagesData = {
  extracted_at: "2026-05-17T12:00:00Z",
  schema_version: 1,
  stats: {
    candidates_found: 3,
    after_dedup: 3,
    after_blacklist: 3,
    after_cap: 3,
    successful: 2,
    paywalled: 1,
    errored: 0,
  },
  pages: [
    okPage(
      "https://nature.com/article",
      "Article scientifique",
      "Étude récente sur le sujet X qui démontre Y.",
    ),
    okPage(
      "https://www.lemonde.fr/article",
      "Analyse économique",
      "Décryptage des marchés et de leur évolution.",
    ),
    statusPage("paywall", "https://nytimes.com/article"),
  ],
};

describe("ExternalSourcesSection (mobile)", () => {
  beforeEach(() => {
    mockPlan.value = "pro";
    mockPush.mockClear();
    mockOpenURL.mockClear();
  });

  it("affiche une CTA upgrade pour les users free", () => {
    mockPlan.value = "free";
    const { getByTestId, queryByTestId } = render(
      <ExternalSourcesSection data={baseData} language="fr" />,
    );
    expect(getByTestId("external-sources-upgrade-cta-mobile")).toBeTruthy();
    expect(queryByTestId("external-sources-section-mobile")).toBeNull();
  });

  it("ne rend rien quand data est null côté Pro", () => {
    const { toJSON } = render(
      <ExternalSourcesSection data={null} language="fr" />,
    );
    expect(toJSON()).toBeNull();
  });

  it("ne rend rien quand pages est vide côté Pro", () => {
    const emptyData: ExternalPagesData = { ...baseData, pages: [] };
    const { toJSON } = render(
      <ExternalSourcesSection data={emptyData} language="fr" />,
    );
    expect(toJSON()).toBeNull();
  });

  it("affiche la section pour Pro avec data valide", () => {
    const { getByTestId, getByText } = render(
      <ExternalSourcesSection data={baseData} language="fr" />,
    );
    expect(getByTestId("external-sources-section-mobile")).toBeTruthy();
    expect(getByText("Sources externes citées")).toBeTruthy();
    expect(getByText("2/3 pages traitées")).toBeTruthy();
  });

  it("rend une card par page", () => {
    const { queryAllByTestId } = render(
      <ExternalSourcesSection data={baseData} language="fr" />,
    );
    expect(queryAllByTestId("external-source-card-mobile")).toHaveLength(3);
  });

  it("affiche la notice paywall pour une page status=paywall", () => {
    const data: ExternalPagesData = {
      ...baseData,
      pages: [statusPage("paywall")],
    };
    const { getByText } = render(
      <ExternalSourcesSection data={data} language="fr" />,
    );
    expect(getByText("Article payant non accessible")).toBeTruthy();
  });

  it("affiche la notice page introuvable pour http_error et non_html", () => {
    const data1: ExternalPagesData = {
      ...baseData,
      pages: [statusPage("http_error")],
    };
    const { getByText, rerender } = render(
      <ExternalSourcesSection data={data1} language="fr" />,
    );
    expect(getByText("Page introuvable")).toBeTruthy();

    const data2: ExternalPagesData = {
      ...baseData,
      pages: [statusPage("non_html")],
    };
    rerender(<ExternalSourcesSection data={data2} language="fr" />);
    expect(getByText("Page introuvable")).toBeTruthy();
  });

  it("affiche la notice contenu non extractible pour timeout/error/empty", () => {
    const data: ExternalPagesData = {
      ...baseData,
      pages: [statusPage("timeout"), statusPage("error"), statusPage("empty")],
    };
    const { getAllByText } = render(
      <ExternalSourcesSection data={data} language="fr" />,
    );
    expect(getAllByText("Contenu non extractible")).toHaveLength(3);
  });

  it("affiche les labels EN quand language=en", () => {
    const { getByText } = render(
      <ExternalSourcesSection data={baseData} language="en" />,
    );
    expect(getByText("External sources cited")).toBeTruthy();
    expect(getByText("2/3 pages processed")).toBeTruthy();
  });

  it("appelle onUpgradeClick quand free user tap la CTA", () => {
    mockPlan.value = "free";
    const onUpgradeClick = jest.fn();
    const { getByTestId } = render(
      <ExternalSourcesSection
        data={baseData}
        language="fr"
        onUpgradeClick={onUpgradeClick}
      />,
    );
    fireEvent.press(getByTestId("external-sources-upgrade-cta-mobile"));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigue vers /(tabs)/subscription par défaut quand free user tap la CTA", () => {
    mockPlan.value = "free";
    const { getByTestId } = render(
      <ExternalSourcesSection data={baseData} language="fr" />,
    );
    fireEvent.press(getByTestId("external-sources-upgrade-cta-mobile"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/subscription");
  });
});
