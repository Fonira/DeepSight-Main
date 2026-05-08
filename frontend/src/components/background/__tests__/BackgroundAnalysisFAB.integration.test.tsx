/**
 * Integration test : mount le vrai Provider + le vrai FAB + un bouton qui
 * appelle startVideoAnalysis. Vérifie que le FAB transitionne hidden → visible
 * comme attendu. Permet de détecter les bugs de connexion Provider/FAB sans
 * passer par le browser.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  BackgroundAnalysisProvider,
  useBackgroundAnalysis,
} from "../../../contexts/BackgroundAnalysisContext";
import { BackgroundAnalysisFAB } from "../BackgroundAnalysisFAB";

vi.mock("../../../services/api", () => ({
  videoApi: {
    analyze: vi.fn().mockResolvedValue({
      task_id: "backend-task-int-1",
      status: "pending",
    }),
    getTaskStatus: vi.fn().mockResolvedValue({
      task_id: "backend-task-int-1",
      status: "processing",
      progress: 25,
    }),
  },
  playlistApi: {
    analyze: vi.fn(),
    analyzeCorpus: vi.fn(),
    getStatus: vi.fn(),
  },
  authApi: {
    quota: vi.fn().mockResolvedValue({
      credits: 25,
      credits_monthly: 30,
      credits_used: 5,
      plan: "pro",
    }),
  },
}));

vi.mock("../../../hooks/useWebNotification", () => ({
  useWebNotification: () => ({
    sendNotification: vi.fn(),
    ensurePermission: vi.fn(),
  }),
}));

const TriggerButton: React.FC = () => {
  const { startVideoAnalysis } = useBackgroundAnalysis();
  return (
    <button
      type="button"
      data-testid="trigger"
      onClick={() => {
        void startVideoAnalysis({
          videoUrl: "https://youtube.com/watch?v=test",
          mode: "auto",
          category: "standard",
        });
      }}
    >
      start
    </button>
  );
};

describe("BackgroundAnalysisFAB — integration with real Provider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("FAB hidden by default, visible after startVideoAnalysis", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BackgroundAnalysisProvider>
          <MemoryRouter>
            <TriggerButton />
            <BackgroundAnalysisFAB />
          </MemoryRouter>
        </BackgroundAnalysisProvider>
      </QueryClientProvider>,
    );

    // Initial : FAB hidden, aucun bouton aria-label "analyse en cours".
    expect(screen.queryByLabelText(/analyse en cours/i)).toBeNull();

    // Trigger startVideoAnalysis via le bouton.
    await act(async () => {
      screen.getByTestId("trigger").click();
    });

    // FAB devient visible avec activeTasksCount=1.
    await waitFor(
      () => {
        expect(screen.getByLabelText(/1 analyse en cours/i)).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
