import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useAnalyzeAndOpenHub } from "../useAnalyzeAndOpenHub";
import { MaxConcurrentReachedError } from "../../contexts/BackgroundAnalysisContext";

const mockNavigate = vi.fn();
const mockStartVideoAnalysis = vi.fn();

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

vi.mock("../../contexts/BackgroundAnalysisContext", async () => {
  const actual = await vi.importActual<
    typeof import("../../contexts/BackgroundAnalysisContext")
  >("../../contexts/BackgroundAnalysisContext");
  return {
    ...actual,
    useBackgroundAnalysis: () => ({
      tasks: [],
      activeTasksCount: 0,
      startVideoAnalysis: mockStartVideoAnalysis,
      startPlaylistAnalysis: vi.fn(),
      getTask: vi.fn(),
      removeTask: vi.fn(),
      clearCompleted: vi.fn(),
      retryTask: vi.fn(),
      hasNewCompletedTask: false,
      acknowledgeCompleted: vi.fn(),
    }),
  };
});

vi.mock("../useTranslation", () => ({
  useTranslation: () => ({ language: "fr", t: {}, setLanguage: vi.fn() }),
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useAnalyzeAndOpenHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to /hub?conv=<id> on cache hit (summaryId returned)", async () => {
    mockStartVideoAnalysis.mockResolvedValue({
      localId: "video-123",
      taskId: "t-7",
      summaryId: 42,
    });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=abc12345");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/hub?conv=42");
    expect(result.current.analyzing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.capReached).toBe(false);
  });

  it("navigates to /hub?analyzing=<taskId> when no cache hit", async () => {
    mockStartVideoAnalysis.mockResolvedValue({
      localId: "video-456",
      taskId: "backend-task-99",
    });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://youtu.be/xyz12345");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/hub?analyzing=backend-task-99");
    expect(result.current.error).toBeNull();
  });

  it("sets capReached + error message when MaxConcurrentReachedError thrown", async () => {
    mockStartVideoAnalysis.mockRejectedValue(new MaxConcurrentReachedError());

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=overflow");
    });

    expect(result.current.capReached).toBe(true);
    expect(result.current.error).toMatch(/2 analyses simultanées/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("rejects empty URL with error", async () => {
    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("   ");
    });

    expect(result.current.error).toMatch(/URL invalide/i);
    expect(mockStartVideoAnalysis).not.toHaveBeenCalled();
  });

  it("resetError clears error and capReached", async () => {
    mockStartVideoAnalysis.mockRejectedValue(new MaxConcurrentReachedError());

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=overflow");
    });

    expect(result.current.capReached).toBe(true);

    act(() => {
      result.current.resetError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.capReached).toBe(false);
  });
});
