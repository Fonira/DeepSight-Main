import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SocialProofCounter from "../SocialProofCounter";
import { landingApi } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  landingApi: {
    getStats: vi.fn(),
  },
}));

const mockedGetStats = landingApi.getStats as unknown as ReturnType<
  typeof vi.fn
>;

describe("SocialProofCounter", () => {
  beforeEach(() => {
    mockedGetStats.mockReset();
  });

  it("shows skeleton placeholders before fetch resolves", () => {
    mockedGetStats.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<SocialProofCounter language="fr" />);
    const skeletons = screen.getAllByTestId("social-proof-skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("renders 3 counters once stats are fetched (FR)", async () => {
    mockedGetStats.mockResolvedValue({
      total_videos_analyzed: 12345,
      total_words_synthesized: 6789012,
      active_users_30d: 432,
    });
    render(<SocialProofCounter language="fr" />);
    await waitFor(() => {
      expect(screen.getByTestId("counter-videos")).toBeInTheDocument();
      expect(screen.getByTestId("counter-words")).toBeInTheDocument();
      expect(screen.getByTestId("counter-users")).toBeInTheDocument();
    });
    // Final value visible (count-up may animate, but final number must appear)
    await waitFor(
      () => {
        expect(screen.getByTestId("counter-videos")).toHaveTextContent(
          /12[\s  ]?345/,
        );
      },
      { timeout: 3000 },
    );
  });

  it("renders nothing visible (no error UI, no counters) on fetch failure", async () => {
    mockedGetStats.mockRejectedValue(new Error("Network error"));
    const { container } = render(<SocialProofCounter language="fr" />);
    await waitFor(() => {
      expect(
        screen.queryByTestId("social-proof-skeleton"),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("counter-videos")).not.toBeInTheDocument();
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders English labels when language='en'", async () => {
    mockedGetStats.mockResolvedValue({
      total_videos_analyzed: 1,
      total_words_synthesized: 2,
      active_users_30d: 3,
    });
    render(<SocialProofCounter language="en" />);
    await waitFor(() => {
      expect(screen.getByText(/videos analyzed/i)).toBeInTheDocument();
      expect(screen.getByText(/words synthesized/i)).toBeInTheDocument();
      expect(screen.getByText(/active users/i)).toBeInTheDocument();
    });
  });
});
