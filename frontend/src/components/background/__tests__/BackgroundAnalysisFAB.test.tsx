import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { BackgroundAnalysisFAB } from "../BackgroundAnalysisFAB";
import type {
  AnalysisTask,
  VideoAnalysisTask,
} from "../../../contexts/BackgroundAnalysisContext";

const mockUseBackgroundAnalysis = vi.fn();

vi.mock("../../../contexts/BackgroundAnalysisContext", async () => {
  const actual = await vi.importActual<
    typeof import("../../../contexts/BackgroundAnalysisContext")
  >("../../../contexts/BackgroundAnalysisContext");
  return {
    ...actual,
    useBackgroundAnalysis: () => mockUseBackgroundAnalysis(),
  };
});

vi.mock("../../../hooks/useWebNotification", () => ({
  useWebNotification: () => ({
    sendNotification: vi.fn(),
    ensurePermission: vi.fn(),
  }),
}));

vi.mock("../../../services/api", () => ({
  authApi: {
    quota: vi.fn().mockResolvedValue({
      credits: 25,
      credits_monthly: 30,
      credits_used: 5,
      plan: "pro",
    }),
  },
}));

const baseTask = (overrides: Partial<VideoAnalysisTask>): AnalysisTask => ({
  id: "video-1",
  type: "video",
  taskId: "backend-1",
  videoUrl: "https://youtube.com/watch?v=a",
  status: "processing",
  progress: 30,
  message: "Analyse en cours...",
  startedAt: new Date(),
  ...overrides,
});

const renderFab = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BackgroundAnalysisFAB />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("BackgroundAnalysisFAB", () => {
  beforeEach(() => {
    mockUseBackgroundAnalysis.mockReset();
  });

  it("renders nothing when no tasks (hidden state)", () => {
    mockUseBackgroundAnalysis.mockReturnValue({
      tasks: [],
      activeTasksCount: 0,
      hasNewCompletedTask: false,
      acknowledgeCompleted: vi.fn(),
    });
    renderFab();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders processing state with aria-label when 1 task active", () => {
    mockUseBackgroundAnalysis.mockReturnValue({
      tasks: [baseTask({ status: "processing" })],
      activeTasksCount: 1,
      hasNewCompletedTask: false,
      acknowledgeCompleted: vi.fn(),
    });
    renderFab();
    expect(screen.getByLabelText("1 analyse en cours")).toBeTruthy();
  });

  it("shows badge count when 2 tasks active", () => {
    mockUseBackgroundAnalysis.mockReturnValue({
      tasks: [
        baseTask({ id: "video-1" }),
        baseTask({ id: "video-2", taskId: "backend-2" }),
      ],
      activeTasksCount: 2,
      hasNewCompletedTask: false,
      acknowledgeCompleted: vi.fn(),
    });
    renderFab();
    expect(screen.getByLabelText("2 analyses en cours")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders error state when a task is failed", () => {
    mockUseBackgroundAnalysis.mockReturnValue({
      tasks: [
        baseTask({
          status: "failed",
          error: "Échec",
        }),
      ],
      activeTasksCount: 0,
      hasNewCompletedTask: false,
      acknowledgeCompleted: vi.fn(),
    });
    renderFab();
    expect(screen.getByLabelText(/1 analyse.*échec/i)).toBeTruthy();
  });

  it("renders success state when hasNewCompletedTask = true", () => {
    mockUseBackgroundAnalysis.mockReturnValue({
      tasks: [
        baseTask({ status: "completed", progress: 100 }),
      ],
      activeTasksCount: 0,
      hasNewCompletedTask: true,
      acknowledgeCompleted: vi.fn(),
    });
    renderFab();
    expect(screen.getByLabelText("Analyse terminée")).toBeTruthy();
  });
});
