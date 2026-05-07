/**
 * 🧪 Tests — MakePublicToggle
 *
 * Vérifie :
 *   1. Toggle off → on : appel API + permalink affiché + auto-copy
 *   2. Toggle on → off : retour à privé + permalink masqué
 *   3. Erreur API : message affiché
 *   4. Mode compact : seul le switch est rendu
 *
 * Phase 3 sprint Export to AI + GEO.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "../../../__tests__/test-utils";
import { MakePublicToggle } from "../MakePublicToggle";

vi.mock("../../../services/api", () => ({
  publicAnalysisApi: {
    setVisibility: vi.fn(),
    buildPermalink: (slug: string) =>
      `https://deepsightsynthesis.com/a/${slug}`,
  },
}));

import { publicAnalysisApi } from "../../../services/api";
const mockSetVis = publicAnalysisApi.setVisibility as ReturnType<typeof vi.fn>;

// Mock clipboard API
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
  });
});

describe("MakePublicToggle", () => {
  it("renders private state by default", () => {
    renderWithProviders(
      <MakePublicToggle summaryId={169} initialIsPublic={false} />,
    );
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("calls API and displays permalink when toggling ON", async () => {
    mockSetVis.mockResolvedValue({
      summary_id: 169,
      is_public: true,
      slug: "aa9",
      permalink: "https://deepsightsynthesis.com/a/aa9",
    });

    const onChange = vi.fn();
    renderWithProviders(
      <MakePublicToggle
        summaryId={169}
        initialIsPublic={false}
        onChange={onChange}
      />,
    );

    const sw = screen.getByRole("switch");
    await userEvent.click(sw);

    await waitFor(() => {
      expect(mockSetVis).toHaveBeenCalledWith(169, true);
    });
    await waitFor(() => {
      expect(
        screen.getByText("https://deepsightsynthesis.com/a/aa9"),
      ).toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith({
      isPublic: true,
      slug: "aa9",
      permalink: "https://deepsightsynthesis.com/a/aa9",
    });
    // Auto-copy effectué
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://deepsightsynthesis.com/a/aa9",
    );
  });

  it("toggles back to private and hides permalink", async () => {
    mockSetVis.mockResolvedValue({
      summary_id: 169,
      is_public: false,
      slug: "aa9",
      permalink: "https://deepsightsynthesis.com/a/aa9",
    });

    renderWithProviders(
      <MakePublicToggle
        summaryId={169}
        initialIsPublic={true}
        initialSlug="aa9"
      />,
    );

    // Permalink visible au départ (isPublic=true)
    expect(
      screen.getByText("https://deepsightsynthesis.com/a/aa9"),
    ).toBeInTheDocument();

    const sw = screen.getByRole("switch");
    await userEvent.click(sw);

    await waitFor(() => {
      expect(mockSetVis).toHaveBeenCalledWith(169, false);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("https://deepsightsynthesis.com/a/aa9"),
      ).not.toBeInTheDocument();
    });
  });

  it("displays error message on API failure", async () => {
    mockSetVis.mockRejectedValue(new Error("Network error"));

    renderWithProviders(
      <MakePublicToggle summaryId={169} initialIsPublic={false} />,
    );

    const sw = screen.getByRole("switch");
    await userEvent.click(sw);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network error/i);
    });
  });

  it("renders compact mode without explanation block", () => {
    renderWithProviders(
      <MakePublicToggle
        summaryId={169}
        initialIsPublic={false}
        compact={true}
      />,
    );
    // Le titre n'est pas affiché en compact
    expect(
      screen.queryByRole("heading", { name: /rendre publique/i }),
    ).not.toBeInTheDocument();
    // Mais le switch est là
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});
