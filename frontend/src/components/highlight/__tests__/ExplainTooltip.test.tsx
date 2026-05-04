import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ExplainTooltip } from "../ExplainTooltip";
import { searchApi } from "../../../services/api";
import type { WithinMatch } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  searchApi: { explainPassage: vi.fn() },
}));

// Auth mock — we'll override per-test
const useAuthMock = vi.fn();
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));

afterEach(cleanup);

const mockMatch: WithinMatch = {
  source_type: "summary",
  source_id: 1,
  text: "transition énergétique",
  text_html: "transition énergétique",
  start_offset: 0,
  end_offset: 22,
  tab: "synthesis",
  score: 0.91,
  passage_id: "p1",
};

function renderTooltip(
  props: Partial<React.ComponentProps<typeof ExplainTooltip>> = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ExplainTooltip
          open
          match={mockMatch}
          query="transition"
          summaryId={42}
          anchorRect={null}
          onClose={() => {}}
          onCiteInChat={() => {}}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExplainTooltip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls explainPassage and renders explanation for Pro", async () => {
    useAuthMock.mockReturnValue({ user: { plan: "pro" } });
    (
      searchApi.explainPassage as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      explanation: "Mentionne directement la transition énergétique.",
      cached: false,
      model_used: "mistral-small-latest",
    });
    renderTooltip();
    await waitFor(() =>
      expect(screen.getByText(/mentionne directement/i)).toBeInTheDocument(),
    );
    expect(searchApi.explainPassage).toHaveBeenCalledWith(
      42,
      "transition énergétique",
      "transition",
      "summary",
    );
  });

  it("does NOT call explainPassage and shows upsell for free", async () => {
    useAuthMock.mockReturnValue({ user: { plan: "free" } });
    (
      searchApi.explainPassage as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      explanation: "should-not-render",
      cached: false,
      model_used: "x",
    });
    renderTooltip();
    await waitFor(() =>
      expect(
        screen.getByText(/Comprendre ce passage avec l'IA/i),
      ).toBeInTheDocument(),
    );
    expect(searchApi.explainPassage).not.toHaveBeenCalled();
  });

  it("close button triggers onClose", async () => {
    useAuthMock.mockReturnValue({ user: { plan: "pro" } });
    (
      searchApi.explainPassage as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      explanation: "x",
      cached: true,
      model_used: "mistral-small-latest",
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderTooltip({ onClose });
    await waitFor(() => screen.getByText("x"));
    await user.click(screen.getByLabelText(/fermer/i));
    expect(onClose).toHaveBeenCalled();
  });
});
