import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useStreamingVideoContext } from "../../../src/components/voice/useStreamingVideoContext";

const mockListeners: Record<string, ((e: { data: string }) => void)[]> = {};
const mockClose = jest.fn();

jest.mock("react-native-sse", () => {
  return jest.fn().mockImplementation(() => ({
    addEventListener: (event: string, cb: (e: { data: string }) => void) => {
      if (!mockListeners[event]) mockListeners[event] = [];
      mockListeners[event].push(cb);
    },
    removeAllEventListeners: jest.fn(),
    close: mockClose,
  }));
});

jest.mock("../../../src/utils/storage", () => ({
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue("test_token"),
  },
}));

jest.mock("../../../src/constants/config", () => ({
  API_BASE_URL: "http://test",
}));

const fakeConversation = {
  sendUserMessage: jest.fn(),
};

describe("useStreamingVideoContext", () => {
  beforeEach(() => {
    Object.keys(mockListeners).forEach((k) => delete mockListeners[k]);
    fakeConversation.sendUserMessage.mockClear();
    mockClose.mockClear();
  });

  test("does nothing when sessionId is null", () => {
    renderHook(() =>
      useStreamingVideoContext(null, fakeConversation as never),
    );
    expect(mockListeners).toEqual({});
  });

  test("dispatches transcript_chunk → sendUserMessage with [CTX UPDATE]", async () => {
    const { result } = renderHook(() =>
      useStreamingVideoContext("sess_1", fakeConversation as never),
    );
    await waitFor(() =>
      expect(mockListeners.transcript_chunk).toBeDefined(),
    );

    act(() => {
      mockListeners.transcript_chunk[0]({
        data: JSON.stringify({
          chunk_index: 1,
          total_chunks: 4,
          text: "Hello",
        }),
      });
    });

    expect(fakeConversation.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("[CTX UPDATE: transcript chunk 1/4]"),
    );
    expect(fakeConversation.sendUserMessage.mock.calls[0][0]).toContain(
      "Hello",
    );
    expect(result.current.contextProgress).toBeCloseTo((1 / 4) * 80, 1);
  });

  test("dispatches analysis_partial → sendUserMessage", async () => {
    renderHook(() =>
      useStreamingVideoContext("sess_2", fakeConversation as never),
    );
    await waitFor(() =>
      expect(mockListeners.analysis_partial).toBeDefined(),
    );

    act(() => {
      mockListeners.analysis_partial[0]({
        data: JSON.stringify({ section: "summary", content: "abc" }),
      });
    });

    expect(fakeConversation.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("[CTX UPDATE: analysis - summary]"),
    );
  });

  test("ctx_complete → contextComplete=true + progress=100", async () => {
    const { result } = renderHook(() =>
      useStreamingVideoContext("sess_3", fakeConversation as never),
    );
    await waitFor(() =>
      expect(mockListeners.ctx_complete).toBeDefined(),
    );

    act(() => {
      mockListeners.ctx_complete[0]({
        data: JSON.stringify({ final_digest_summary: "Final" }),
      });
    });

    expect(result.current.contextProgress).toBe(100);
    expect(result.current.contextComplete).toBe(true);
    expect(fakeConversation.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("[CTX COMPLETE]"),
    );
  });

  test("closes EventSource on unmount", async () => {
    const { unmount } = renderHook(() =>
      useStreamingVideoContext("sess_4", fakeConversation as never),
    );
    await waitFor(() =>
      expect(mockListeners.transcript_chunk).toBeDefined(),
    );
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });

  test("malformed event JSON does not crash", async () => {
    renderHook(() =>
      useStreamingVideoContext("sess_5", fakeConversation as never),
    );
    await waitFor(() =>
      expect(mockListeners.transcript_chunk).toBeDefined(),
    );

    expect(() => {
      act(() => {
        mockListeners.transcript_chunk[0]({ data: "not json" });
      });
    }).not.toThrow();
    expect(fakeConversation.sendUserMessage).not.toHaveBeenCalled();
  });
});
