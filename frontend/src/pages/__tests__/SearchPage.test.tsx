import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchPage from "../SearchPage";
import { searchApi, ApiError } from "../../services/api";

vi.mock("../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/api")>(
      "../../services/api",
    );
  return {
    ...actual,
    searchApi: {
      searchGlobal: vi.fn(),
      getRecentQueries: vi.fn().mockResolvedValue({ queries: [] }),
      clearRecentQueries: vi.fn(),
    },
  };
});
vi.mock("../../components/layout/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../../components/DoodleBackground", () => ({ default: () => null }));
vi.mock("../../components/SEO", () => ({ SEO: () => null }));
vi.mock("../../services/analytics", () => ({
  analytics: { capture: vi.fn() },
}));

afterEach(cleanup);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/search"]}>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SearchPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the no-query empty state initially", () => {
    renderPage();
    expect(screen.getByText(/cherche dans toutes/i)).toBeInTheDocument();
  });

  it("calls searchGlobal when typing >= 2 chars", async () => {
    (
      searchApi.searchGlobal as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      query: "ai",
      total_results: 0,
      results: [],
      searched_at: "2026-05-03T12:00:00Z",
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByRole("searchbox"), "ai");
    await waitFor(() => expect(searchApi.searchGlobal).toHaveBeenCalled(), {
      timeout: 2000,
    });
  });
});
