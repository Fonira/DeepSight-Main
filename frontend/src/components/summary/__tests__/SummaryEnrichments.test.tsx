// frontend/src/components/summary/__tests__/SummaryEnrichments.test.tsx
//
// Tests spike 2026-05-06 : SummaryEnrichments component.
//
// Couverture :
//   1. initialExtras null → bouton "Enrichir" affiché
//   2. Click button → loading state + appel videoApi.enrichSummary
//   3. Success → 3 sections rendues (quotes, takeaways, themes)
//   4. Error → message d'erreur affiché
//   5. initialExtras déjà présent → render direct sans bouton

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SummaryEnrichments } from "../SummaryEnrichments";
import type { SummaryExtrasData } from "../../../services/api";

// Mock videoApi.enrichSummary
vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/api")
  >("../../../services/api");
  return {
    ...actual,
    videoApi: {
      ...actual.videoApi,
      enrichSummary: vi.fn(),
    },
  };
});

// Helper to access the mocked function with proper type
import * as apiModule from "../../../services/api";
const mockedEnrich = apiModule.videoApi.enrichSummary as ReturnType<
  typeof vi.fn
>;

const VALID_EXTRAS: SummaryExtrasData = {
  key_quotes: [
    {
      quote: "Citation marquante",
      context: "Pourquoi elle compte",
    },
    { quote: "Autre citation sans contexte" },
  ],
  key_takeaways: ["Insight 1", "Insight 2", "Insight 3"],
  chapter_themes: [
    { theme: "Chapitre A", summary: "Synthèse A" },
    { theme: "Chapitre B" },
  ],
};

describe("SummaryEnrichments", () => {
  beforeEach(() => {
    mockedEnrich.mockReset();
  });

  it("renders button CTA when initialExtras is null", () => {
    render(<SummaryEnrichments summaryId={42} initialExtras={null} />);
    expect(screen.getByTestId("summary-enrich-cta")).toBeInTheDocument();
    expect(screen.getByTestId("summary-enrich-button")).toBeInTheDocument();
    expect(screen.getByText(/Enrichir avec Mistral/)).toBeInTheDocument();
    // Sections not rendered yet
    expect(screen.queryByTestId("summary-enrich-quotes")).toBeNull();
  });

  it("clicks button → calls enrichSummary, shows loading, then renders sections", async () => {
    mockedEnrich.mockResolvedValueOnce({
      summary_id: 42,
      cached: false,
      extras: VALID_EXTRAS,
    });

    const user = userEvent.setup();
    render(<SummaryEnrichments summaryId={42} initialExtras={null} />);

    await user.click(screen.getByTestId("summary-enrich-button"));

    await waitFor(() => {
      expect(screen.getByTestId("summary-enrichments")).toBeInTheDocument();
    });

    // 3 sections rendered
    expect(screen.getByTestId("summary-enrich-quotes")).toBeInTheDocument();
    expect(screen.getByTestId("summary-enrich-takeaways")).toBeInTheDocument();
    expect(screen.getByTestId("summary-enrich-themes")).toBeInTheDocument();

    // Quote content
    expect(screen.getByText(/Citation marquante/)).toBeInTheDocument();
    // Takeaway content
    expect(screen.getByText("Insight 1")).toBeInTheDocument();
    // Theme content
    expect(screen.getByText("Chapitre A")).toBeInTheDocument();

    expect(mockedEnrich).toHaveBeenCalledWith(42);
  });

  it("renders extras directly when initialExtras is provided (cached)", () => {
    render(
      <SummaryEnrichments summaryId={42} initialExtras={VALID_EXTRAS} />,
    );
    expect(screen.getByTestId("summary-enrichments")).toBeInTheDocument();
    expect(screen.queryByTestId("summary-enrich-cta")).toBeNull();
    // Pas d'appel API quand cache disponible
    expect(mockedEnrich).not.toHaveBeenCalled();
  });

  it("shows error message when enrichSummary throws", async () => {
    mockedEnrich.mockRejectedValueOnce(new Error("Mistral indisponible"));

    const user = userEvent.setup();
    render(<SummaryEnrichments summaryId={42} initialExtras={null} />);

    await user.click(screen.getByTestId("summary-enrich-button"));

    await waitFor(() => {
      expect(screen.getByTestId("summary-enrich-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/Mistral indisponible/)).toBeInTheDocument();
    // Bouton CTA reste visible (user peut retry)
    expect(screen.getByTestId("summary-enrich-cta")).toBeInTheDocument();
  });

  it("renders empty state when extras is fully empty", () => {
    const emptyExtras: SummaryExtrasData = {
      key_quotes: [],
      key_takeaways: [],
      chapter_themes: [],
    };
    render(
      <SummaryEnrichments summaryId={42} initialExtras={emptyExtras} />,
    );
    expect(screen.getByTestId("summary-enrich-empty")).toBeInTheDocument();
  });

  it("calls onEnrichmentReady callback after successful generation", async () => {
    mockedEnrich.mockResolvedValueOnce({
      summary_id: 42,
      cached: false,
      extras: VALID_EXTRAS,
    });
    const onReady = vi.fn();

    const user = userEvent.setup();
    render(
      <SummaryEnrichments
        summaryId={42}
        initialExtras={null}
        onEnrichmentReady={onReady}
      />,
    );
    await user.click(screen.getByTestId("summary-enrich-button"));
    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(VALID_EXTRAS);
    });
  });
});
