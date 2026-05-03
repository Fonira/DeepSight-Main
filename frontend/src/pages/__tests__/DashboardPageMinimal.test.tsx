import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPageMinimal from "../DashboardPageMinimal";

const mockNavigate = vi.fn();
const mockAnalyze = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "u@example.com",
      username: "Maxime",
      plan: "pro",
      credits: 100,
      preferences: {},
    },
    loading: false,
  }),
}));

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "fr", t: {}, setLanguage: vi.fn() }),
}));

vi.mock("../../hooks/useAnalyzeAndOpenHub", () => ({
  useAnalyzeAndOpenHub: () => ({
    analyzing: false,
    progress: 0,
    message: "",
    error: null,
    analyze: mockAnalyze,
    resetError: vi.fn(),
  }),
}));

vi.mock("../../components/DoodleBackground", () => ({
  default: () => null,
}));

vi.mock("../../components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("../../components/layout/Sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar">sidebar</aside>,
  default: () => <aside data-testid="sidebar">sidebar</aside>,
}));

vi.mock("../../components/RecentAnalysesSection", () => ({
  RecentAnalysesSection: ({
    onOpenAnalysis,
  }: {
    onOpenAnalysis?: (summaryId: number, videoId: string) => void;
  }) => (
    <section data-testid="recent-section">
      <button
        type="button"
        onClick={() => onOpenAnalysis?.(42, "abc")}
        data-testid="recent-item"
      >
        Recent item
      </button>
    </section>
  ),
}));

vi.mock("../../components/TournesolTrendingSection", () => ({
  TournesolTrendingSection: ({
    onVideoSelect,
  }: {
    onVideoSelect?: (videoId: string) => void;
  }) => (
    <section data-testid="tournesol-section">
      <button
        type="button"
        onClick={() => onVideoSelect?.("xyz_video_id")}
        data-testid="tournesol-pick"
      >
        Pick Tournesol
      </button>
    </section>
  ),
}));

// SmartInputBar real but heavy — stub it for smoke test
vi.mock("../../components/SmartInputBar", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    onSubmit,
  }: {
    value: { mode: string; url?: string; searchQuery?: string };
    onChange: (v: { mode: string; url?: string; searchQuery?: string }) => void;
    onSubmit: () => void;
  }) => (
    <div data-testid="smart-input">
      <input
        data-testid="url-input"
        value={value.url || ""}
        onChange={(e) =>
          onChange({ ...value, mode: "url", url: e.target.value })
        }
      />
      <button type="button" data-testid="analyze-btn" onClick={onSubmit}>
        Analyser
      </button>
    </div>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardPageMinimal />
    </MemoryRouter>,
  );

describe("DashboardPageMinimal", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAnalyze.mockClear();
  });

  it("smoke renders header, smart input, recent and tournesol sections", () => {
    renderPage();
    expect(
      screen.getByText(/que souhaitez-vous comprendre/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("smart-input")).toBeInTheDocument();
    expect(screen.getByTestId("recent-section")).toBeInTheDocument();
    expect(screen.getByTestId("tournesol-section")).toBeInTheDocument();
  });

  it("calls analyze() when SmartInputBar submits a URL", async () => {
    renderPage();
    const input = screen.getByTestId("url-input");
    fireEvent.change(input, {
      target: { value: "https://www.youtube.com/watch?v=test1234567" },
    });
    fireEvent.click(screen.getByTestId("analyze-btn"));
    await waitFor(() =>
      expect(mockAnalyze).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=test1234567",
      ),
    );
  });

  it("navigates to /hub?conv=<id> when clicking a recent analysis item", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("recent-item"));
    expect(mockNavigate).toHaveBeenCalledWith("/hub?conv=42");
  });

  it("calls analyze() with YouTube URL when clicking a Tournesol pick", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("tournesol-pick"));
    expect(mockAnalyze).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=xyz_video_id",
    );
  });
});
