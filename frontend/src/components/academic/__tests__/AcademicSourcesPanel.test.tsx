/**
 * Tests AcademicSourcesPanel — toggle deep_search (Scholar) + badges
 * Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md §13.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../__tests__/test-utils";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/api")
  >("../../../services/api");
  return {
    ...actual,
    academicApi: {
      enrich: vi.fn(),
      getPapers: vi.fn(),
      exportBibliography: vi.fn(),
    },
  };
});

import { AcademicSourcesPanel } from "../AcademicSourcesPanel";
import { academicApi } from "../../../services/api";

const enrichMock = academicApi.enrich as ReturnType<typeof vi.fn>;

const baseResponse = {
  papers: [],
  total_found: 0,
  query_keywords: ["test"],
  sources_queried: ["semantic_scholar", "openalex", "arxiv"],
  cached: false,
  tier_limit_reached: false,
  tier_limit: null,
};

describe("AcademicSourcesPanel — deep_search toggle (Scholar)", () => {
  beforeEach(() => {
    enrichMock.mockReset();
    enrichMock.mockResolvedValue(baseResponse);
  });

  it("affiche le toggle 'Deep search' pour un user Pro", () => {
    renderWithProviders(
      <AcademicSourcesPanel summaryId="42" userPlan="pro" language="fr" />,
    );
    expect(screen.getByTestId("deep-search-toggle")).toBeInTheDocument();
    expect(
      screen.queryByTestId("deep-search-upgrade-cta"),
    ).not.toBeInTheDocument();
  });

  it("affiche le toggle 'Deep search' pour un user Expert", () => {
    renderWithProviders(
      <AcademicSourcesPanel summaryId="42" userPlan="expert" language="fr" />,
    );
    expect(screen.getByTestId("deep-search-toggle")).toBeInTheDocument();
  });

  it("affiche la CTA upgrade pour un user Free (pas de toggle visible)", () => {
    const onUpgrade = vi.fn();
    renderWithProviders(
      <AcademicSourcesPanel
        summaryId="42"
        userPlan="free"
        language="fr"
        onUpgrade={onUpgrade}
      />,
    );
    expect(screen.queryByTestId("deep-search-toggle")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("deep-search-upgrade-cta"),
    ).toBeInTheDocument();
  });

  it("passe deep_search=false par défaut au handleSearch (Pro)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderWithProviders(
      <AcademicSourcesPanel summaryId="42" userPlan="pro" language="fr" />,
    );

    const searchButton = screen.getByRole("button", {
      name: /Rechercher des sources/i,
    });
    await user.click(searchButton);

    await waitFor(() => {
      expect(enrichMock).toHaveBeenCalledTimes(1);
    });
    expect(enrichMock).toHaveBeenCalledWith("42", { deep_search: false });
  });

  it("passe deep_search=true au handleSearch quand le toggle est coché (Pro)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderWithProviders(
      <AcademicSourcesPanel summaryId="42" userPlan="pro" language="fr" />,
    );

    const toggle = screen
      .getByTestId("deep-search-toggle")
      .querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    await user.click(toggle);

    const searchButton = screen.getByRole("button", {
      name: /Rechercher des sources/i,
    });
    await user.click(searchButton);

    await waitFor(() => {
      expect(enrichMock).toHaveBeenCalledTimes(1);
    });
    expect(enrichMock).toHaveBeenCalledWith("42", { deep_search: true });
  });

  it("appelle onUpgrade quand le user free clique sur la CTA Deep search", async () => {
    const onUpgrade = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    renderWithProviders(
      <AcademicSourcesPanel
        summaryId="42"
        userPlan="free"
        language="fr"
        onUpgrade={onUpgrade}
      />,
    );

    await user.click(screen.getByTestId("deep-search-upgrade-cta"));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("affiche le toggle en anglais quand language=en", () => {
    renderWithProviders(
      <AcademicSourcesPanel summaryId="42" userPlan="pro" language="en" />,
    );
    expect(screen.getByText("Deep search (Scholar)")).toBeInTheDocument();
  });
});
