import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useAnalyzeAndOpenHub } from "../useAnalyzeAndOpenHub";

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

vi.mock("../../contexts/BackgroundAnalysisContext", () => ({
  useBackgroundAnalysis: () => ({
    startVideoAnalysis: mockStartVideoAnalysis,
  }),
}));

vi.mock("../useTranslation", () => ({
  useTranslation: () => ({ language: "fr", t: {}, setLanguage: vi.fn() }),
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useAnalyzeAndOpenHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockStartVideoAnalysis.mockReset();
  });

  it("navigates to /hub?conv=<id> when the background context fires onComplete", async () => {
    // Simulate the context firing onComplete asynchronously (typical polling case)
    mockStartVideoAnalysis.mockImplementation(async (params) => {
      setTimeout(() => params.onComplete?.(99, "Test video"), 5);
      return "video-1";
    });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=abc12345");
    });

    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith("/hub?conv=99"),
      { timeout: 5000 },
    );
    expect(result.current.analyzing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("navigates immediately when the context fires onComplete synchronously (cache hit)", async () => {
    // Simulate cache-hit path : onComplete is fired before startVideoAnalysis resolves
    mockStartVideoAnalysis.mockImplementation(async (params) => {
      params.onComplete?.(7, "Cached video");
      return "video-2";
    });

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=cache123");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/hub?conv=7");
    expect(result.current.analyzing).toBe(false);
  });

  it("sets error state when startVideoAnalysis throws", async () => {
    mockStartVideoAnalysis.mockRejectedValue(new Error("Transcription failed"));

    const { result } = renderHook(() => useAnalyzeAndOpenHub(), { wrapper });

    await act(async () => {
      await result.current.analyze("https://www.youtube.com/watch?v=fail123");
    });

    expect(result.current.error).toBe("Transcription failed");
    expect(result.current.analyzing).toBe(false);
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
});
