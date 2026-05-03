import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useAnalyzeAndOpenHub } from "../useAnalyzeAndOpenHub";
import { videoApi } from "../../services/api";

const mockNavigate = vi.fn();

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

vi.mock("../../services/api", () => ({
  videoApi: {
    analyze: vi.fn(),
    getTaskStatus: vi.fn(),
  },
}));

vi.mock("../useTranslation", () => ({
  useTranslation: () => ({ language: "fr", t: {}, setLanguage: vi.fn() }),
}));

const mockAnalyze = videoApi.analyze as unknown as ReturnType<typeof vi.fn>;
const mockGetTaskStatus = videoApi.getTaskStatus as unknown as ReturnType<
  typeof vi.fn
>;

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useAnalyzeAndOpenHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it("navigates to /hub?conv=<id> on completed status with summary_id", async () => {
    mockAnalyze.mockResolvedValue({ task_id: "t-1", status: "pending" });
    mockGetTaskStatus
      .mockResolvedValueOnce({
        task_id: "t-1",
        status: "processing",
        progress: 50,
      })
      .mockResolvedValueOnce({
        task_id: "t-1",
        status: "completed",
        result: { summary_id: 99 },
      });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=abc12345");
    });

    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith("/hub?conv=99"),
      { timeout: 8000 },
    );
    expect(result.current.analyzing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("shortcuts navigation when analyze returns summary_id immediately (cache hit)", async () => {
    mockAnalyze.mockResolvedValue({
      task_id: "t-2",
      status: "completed",
      result: { summary_id: 7 },
    });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=cache123");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/hub?conv=7");
    expect(mockGetTaskStatus).not.toHaveBeenCalled();
    expect(result.current.analyzing).toBe(false);
  });

  it("sets error state when status returns failed", async () => {
    mockAnalyze.mockResolvedValue({ task_id: "t-3", status: "pending" });
    mockGetTaskStatus.mockResolvedValueOnce({
      task_id: "t-3",
      status: "failed",
      error: "Transcription failed",
    });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=fail123");
    });

    await waitFor(
      () => expect(result.current.error).toBe("Transcription failed"),
      { timeout: 5000 },
    );
    expect(result.current.analyzing).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("rejects empty URL with error", async () => {
    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("   ");
    });

    expect(result.current.error).toMatch(/URL invalide/i);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});
