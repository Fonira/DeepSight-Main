import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import {
  BackgroundAnalysisProvider,
  useBackgroundAnalysis,
  MaxConcurrentReachedError,
  MAX_CONCURRENT_ANALYSES,
} from "../BackgroundAnalysisContext";

vi.mock("../../services/api", () => ({
  videoApi: {
    analyze: vi.fn(),
    getTaskStatus: vi.fn(),
  },
  playlistApi: {
    analyze: vi.fn(),
    analyzeCorpus: vi.fn(),
    getStatus: vi.fn(),
  },
}));

import { videoApi } from "../../services/api";

const mockAnalyze = videoApi.analyze as unknown as ReturnType<typeof vi.fn>;
const mockGetTaskStatus = videoApi.getTaskStatus as unknown as ReturnType<
  typeof vi.fn
>;

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BackgroundAnalysisProvider>{children}</BackgroundAnalysisProvider>
);

describe("BackgroundAnalysisContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default: getTaskStatus returns "processing" so polling stays harmless.
    mockGetTaskStatus.mockResolvedValue({
      task_id: "t-x",
      status: "processing",
      progress: 10,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with activeTasksCount = 0 and empty tasks", () => {
    const { result } = renderHook(() => useBackgroundAnalysis(), { wrapper });
    expect(result.current.activeTasksCount).toBe(0);
    expect(result.current.tasks).toEqual([]);
  });

  it("startVideoAnalysis returns StartAnalysisResult with localId + taskId", async () => {
    mockAnalyze.mockResolvedValue({ task_id: "backend-1", status: "pending" });

    const { result } = renderHook(() => useBackgroundAnalysis(), { wrapper });

    let started: Awaited<
      ReturnType<typeof result.current.startVideoAnalysis>
    > | null = null;
    await act(async () => {
      started = await result.current.startVideoAnalysis({
        videoUrl: "https://youtube.com/watch?v=a",
        mode: "auto",
        category: "standard",
      });
    });

    expect(started).not.toBeNull();
    expect(started!.taskId).toBe("backend-1");
    expect(started!.localId).toMatch(/^video-/);
    expect(started!.summaryId).toBeUndefined();
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.activeTasksCount).toBe(1);
  });

  it("returns summaryId when backend response has cache hit", async () => {
    mockAnalyze.mockResolvedValue({
      task_id: "backend-cache",
      status: "completed",
      result: { summary_id: 777 },
    });

    const { result } = renderHook(() => useBackgroundAnalysis(), { wrapper });

    let started: Awaited<
      ReturnType<typeof result.current.startVideoAnalysis>
    > | null = null;
    await act(async () => {
      started = await result.current.startVideoAnalysis({
        videoUrl: "https://youtube.com/watch?v=cached",
        mode: "auto",
        category: "standard",
      });
    });

    expect(started!.summaryId).toBe(777);
    // Task completed status, not actively polling.
    await waitFor(() => {
      expect(result.current.tasks[0].status).toBe("completed");
    });
    expect(result.current.activeTasksCount).toBe(0);
    expect(result.current.hasNewCompletedTask).toBe(true);
  });

  it("throws MaxConcurrentReachedError when cap reached", async () => {
    mockAnalyze.mockResolvedValue({
      task_id: "backend-x",
      status: "pending",
    });

    const { result } = renderHook(() => useBackgroundAnalysis(), { wrapper });

    // Fill cap with MAX_CONCURRENT tasks (2).
    for (let i = 0; i < MAX_CONCURRENT_ANALYSES; i++) {
      await act(async () => {
        await result.current.startVideoAnalysis({
          videoUrl: `https://youtube.com/watch?v=v${i}`,
          mode: "auto",
          category: "standard",
        });
      });
    }
    expect(result.current.activeTasksCount).toBe(MAX_CONCURRENT_ANALYSES);

    // Next call should throw.
    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.startVideoAnalysis({
          videoUrl: "https://youtube.com/watch?v=overflow",
          mode: "auto",
          category: "standard",
        });
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeInstanceOf(MaxConcurrentReachedError);
    // No side effect: task count unchanged.
    expect(result.current.activeTasksCount).toBe(MAX_CONCURRENT_ANALYSES);
    // mockAnalyze called exactly MAX_CONCURRENT times (not on the rejected one).
    expect(mockAnalyze).toHaveBeenCalledTimes(MAX_CONCURRENT_ANALYSES);
  });

  it("retryTask refuses non-failed tasks", async () => {
    mockAnalyze.mockResolvedValue({ task_id: "t-pending", status: "pending" });

    const { result } = renderHook(() => useBackgroundAnalysis(), { wrapper });

    let localId = "";
    await act(async () => {
      const r = await result.current.startVideoAnalysis({
        videoUrl: "https://youtube.com/watch?v=a",
        mode: "auto",
        category: "standard",
      });
      localId = r.localId;
    });

    await expect(result.current.retryTask(localId)).rejects.toThrow(
      /échec/i,
    );
  });

  it("retryTask re-launches a failed task with stored mode + category", async () => {
    // First analyze: throws to mark task as failed.
    mockAnalyze.mockRejectedValueOnce(new Error("transcription failed"));

    const { result } = renderHook(() => useBackgroundAnalysis(), { wrapper });

    let firstLocalId = "";
    await act(async () => {
      try {
        const r = await result.current.startVideoAnalysis({
          videoUrl: "https://youtube.com/watch?v=retry",
          mode: "deep",
          category: "tech",
        });
        firstLocalId = r.localId;
      } catch (e) {
        // Failed analyze captures the error in the task itself; we read it back.
      }
    });

    // The failed task should be in the tasks list (status: failed).
    await waitFor(() => {
      const failedTask = result.current.tasks.find(
        (t) => t.status === "failed",
      );
      expect(failedTask).toBeTruthy();
      firstLocalId = failedTask!.id;
    });

    // Re-call now succeeds.
    mockAnalyze.mockResolvedValueOnce({
      task_id: "retry-backend-id",
      status: "pending",
    });

    let retryResult: Awaited<
      ReturnType<typeof result.current.retryTask>
    > | null = null;
    await act(async () => {
      retryResult = await result.current.retryTask(firstLocalId);
    });

    expect(retryResult!.taskId).toBe("retry-backend-id");
    // Initial failed task removed, new task created.
    expect(
      result.current.tasks.some((t) => t.id === firstLocalId),
    ).toBe(false);
    expect(result.current.activeTasksCount).toBe(1);

    // mockAnalyze called twice with the same URL.
    expect(mockAnalyze).toHaveBeenCalledTimes(2);
    expect(mockAnalyze).toHaveBeenLastCalledWith(
      "https://youtube.com/watch?v=retry",
      "deep", // mode → 2nd param
      "tech", // category (auto → undefined sinon)
    );
  });
});
