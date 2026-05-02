/**
 * Tests for useResolvedSummaryId helper.
 * Resolves summaryId from either direct prop, or voice-created summary id (V3 streaming).
 */
import { renderHook } from "@testing-library/react-native";
import { useResolvedSummaryId } from "../../src/hooks/useResolvedSummaryId";

describe("useResolvedSummaryId", () => {
  it("returns input.summaryId if provided", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({ summaryId: "42" }),
    );
    expect(result.current).toBe("42");
  });

  it("prefers input.summaryId over voiceSummaryId", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({ summaryId: "42", voiceSummaryId: 99 }),
    );
    expect(result.current).toBe("42");
  });

  it("returns null if videoUrl provided but no voiceSummaryId yet", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({
        videoUrl: "https://youtu.be/abc",
        voiceSummaryId: null,
      }),
    );
    expect(result.current).toBeNull();
  });

  it("converts voiceSummaryId number to string", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({
        videoUrl: "https://youtu.be/abc",
        voiceSummaryId: 42,
      }),
    );
    expect(result.current).toBe("42");
  });

  it("returns null if neither summaryId nor voiceSummaryId", () => {
    const { result } = renderHook(() => useResolvedSummaryId({}));
    expect(result.current).toBeNull();
  });
});
