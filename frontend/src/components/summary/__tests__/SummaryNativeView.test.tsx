// frontend/src/components/summary/__tests__/SummaryNativeView.test.tsx
//
// Tests refonte synthèse Option A 2026-05-06 — SummaryNativeView.
//
// Couverture :
//   1. extras complet avec synthesis + 4 sections → tout est rendu
//   2. extras null + summaryContent présent → fallback Markdown direct
//   3. extras null + summaryContent vide → null (rien rendu)
//   4. extras présent SANS synthesis → 3 sections (quotes/takeaways/themes), pas de section Synthèse
//   5. extras avec chapter_theme key_points + key_quote → sous-puces et citation rendues
//   6. extras shape complète mais sections vides → fallback Markdown si content présent
//   7. extras avec synthesis seul (pas d'autre section) → seule la synthèse est rendue
//   8. summaryId prop → propagé en data-summary-id
//
// EnrichedMarkdown est mocké pour rester rapide et déterministe.

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SummaryNativeView } from "../SummaryNativeView";
import type { SummaryExtrasData } from "../../../services/api";

// Mock EnrichedMarkdown — on veut juste vérifier que le contenu Markdown est passé.
vi.mock("../../EnrichedMarkdown", () => ({
  EnrichedMarkdown: ({ children }: { children: string }) => (
    <div data-testid="enriched-markdown-mock">{children}</div>
  ),
}));

// Helper : payload extras complet (Option A v2 shape).
const FULL_EXTRAS_V2: SummaryExtrasData = {
  synthesis:
    "Cette analyse couvre trois axes — contexte, méthodologie, conclusions. " +
    "L'auteur défend une thèse principale en s'appuyant sur des données empiriques.",
  key_quotes: [
    { quote: "Citation marquante 1", context: "Pourquoi elle compte" },
    { quote: "Citation 2 sans contexte" },
  ],
  key_takeaways: ["Insight A actionnable", "Insight B saillant", "Insight C"],
  chapter_themes: [
    {
      theme: "Premier thème",
      summary: "Description courte du premier thème.",
      key_points: [
        "Sous-point 1 du thème A",
        "Sous-point 2 du thème A",
      ],
      key_quote: {
        quote: "Citation marquante du thème A",
        context: "Mini-contexte du thème",
      },
    },
    { theme: "Second thème" },
  ],
};

// Payload v1 (sans synthesis ni key_points/key_quote sur les thèmes)
const V1_EXTRAS: SummaryExtrasData = {
  key_quotes: [{ quote: "Q1" }],
  key_takeaways: ["T1", "T2"],
  chapter_themes: [{ theme: "Theme1", summary: "Sum1" }],
};

describe("SummaryNativeView", () => {
  it("rend les 4 sections quand extras v2 complet est fourni", () => {
    render(
      <SummaryNativeView
        summaryId={42}
        extras={FULL_EXTRAS_V2}
        summaryContent="Markdown legacy ignoré"
      />,
    );
    // Section 1 — Synthèse
    expect(screen.getByTestId("summary-native-synthesis")).toBeInTheDocument();
    expect(
      screen.getByText(/Cette analyse couvre trois axes/),
    ).toBeInTheDocument();
    // Section 2 — Citations
    expect(screen.getByTestId("summary-native-quotes")).toBeInTheDocument();
    expect(screen.getByTestId("summary-native-quote-0")).toHaveTextContent(
      "Citation marquante 1",
    );
    expect(screen.getByTestId("summary-native-quote-1")).toHaveTextContent(
      "Citation 2 sans contexte",
    );
    // Section 3 — À retenir
    expect(screen.getByTestId("summary-native-takeaways")).toBeInTheDocument();
    expect(screen.getByTestId("summary-native-takeaway-0")).toHaveTextContent(
      "Insight A actionnable",
    );
    // Section 4 — Chapitres
    expect(screen.getByTestId("summary-native-themes")).toBeInTheDocument();
    expect(screen.getByTestId("summary-native-theme-0")).toBeInTheDocument();
    expect(screen.getByTestId("summary-native-theme-1")).toBeInTheDocument();
    // Le fallback markdown ne doit PAS être rendu
    expect(
      screen.queryByTestId("enriched-markdown-mock"),
    ).not.toBeInTheDocument();
    // summaryId propagé sur le wrapper section
    expect(screen.getByTestId("summary-native-view")).toHaveAttribute(
      "data-summary-id",
      "42",
    );
  });

  it("fallback Markdown direct quand extras null + summaryContent présent (Summary legacy)", () => {
    render(
      <SummaryNativeView
        summaryId={1}
        extras={null}
        summaryContent="# Synthèse legacy en Markdown"
        language="fr"
      />,
    );
    expect(screen.getByTestId("summary-native-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("enriched-markdown-mock")).toHaveTextContent(
      "# Synthèse legacy en Markdown",
    );
    // Aucune section native ne doit être rendue
    expect(
      screen.queryByTestId("summary-native-view"),
    ).not.toBeInTheDocument();
  });

  it("retourne null quand extras absent ET summaryContent vide", () => {
    const { container } = render(
      <SummaryNativeView extras={null} summaryContent="" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("payload v1 (sans synthesis) — n'affiche QUE les 3 sections présentes", () => {
    render(
      <SummaryNativeView
        extras={V1_EXTRAS}
        summaryContent="ignoré car native rendue"
      />,
    );
    // Pas de section Synthèse
    expect(
      screen.queryByTestId("summary-native-synthesis"),
    ).not.toBeInTheDocument();
    // Mais les 3 autres sont là
    expect(screen.getByTestId("summary-native-quotes")).toBeInTheDocument();
    expect(screen.getByTestId("summary-native-takeaways")).toBeInTheDocument();
    expect(screen.getByTestId("summary-native-themes")).toBeInTheDocument();
    // Le thème v1 n'a pas de key_points ni key_quote
    expect(
      screen.queryByTestId("summary-native-theme-keypoints-0"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("summary-native-theme-quote-0"),
    ).not.toBeInTheDocument();
  });

  it("rend key_points et key_quote sur un thème quand présents (payload v2)", () => {
    render(
      <SummaryNativeView
        extras={FULL_EXTRAS_V2}
        summaryContent="ignoré"
      />,
    );
    // Sous-puces du thème 0
    const keypoints = screen.getByTestId("summary-native-theme-keypoints-0");
    expect(keypoints).toBeInTheDocument();
    expect(keypoints).toHaveTextContent("Sous-point 1 du thème A");
    expect(keypoints).toHaveTextContent("Sous-point 2 du thème A");
    // Citation marquante du thème 0
    const themeQuote = screen.getByTestId("summary-native-theme-quote-0");
    expect(themeQuote).toBeInTheDocument();
    expect(themeQuote).toHaveTextContent("Citation marquante du thème A");
    expect(themeQuote).toHaveTextContent("Mini-contexte du thème");
    // Le thème 1 (sans key_points/key_quote) n'a pas ces éléments
    expect(
      screen.queryByTestId("summary-native-theme-keypoints-1"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("summary-native-theme-quote-1"),
    ).not.toBeInTheDocument();
  });

  it("extras shape complète mais toutes sections vides → fallback Markdown si content présent", () => {
    const emptyExtras: SummaryExtrasData = {
      key_quotes: [],
      key_takeaways: [],
      chapter_themes: [],
    };
    render(
      <SummaryNativeView
        extras={emptyExtras}
        summaryContent="# Fallback puisque tout est vide"
      />,
    );
    expect(screen.getByTestId("summary-native-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("enriched-markdown-mock")).toHaveTextContent(
      "# Fallback puisque tout est vide",
    );
  });

  it("synthesis seul (sans autres sections) → seule la synthèse est rendue", () => {
    const synthesisOnly: SummaryExtrasData = {
      synthesis: "Vue d'ensemble seulement.",
      key_quotes: [],
      key_takeaways: [],
      chapter_themes: [],
    };
    render(
      <SummaryNativeView extras={synthesisOnly} summaryContent="ignoré" />,
    );
    expect(screen.getByTestId("summary-native-synthesis")).toBeInTheDocument();
    expect(
      screen.queryByTestId("summary-native-quotes"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("summary-native-takeaways"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("summary-native-themes"),
    ).not.toBeInTheDocument();
  });

  it("propage summaryId sur le wrapper en mode fallback", () => {
    render(
      <SummaryNativeView
        summaryId={777}
        extras={null}
        summaryContent="legacy markdown"
      />,
    );
    expect(screen.getByTestId("summary-native-fallback")).toHaveAttribute(
      "data-summary-id",
      "777",
    );
  });
});
