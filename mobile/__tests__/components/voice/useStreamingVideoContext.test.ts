import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useStreamingVideoContext } from "../../../src/components/voice/useStreamingVideoContext";

let mockListeners: Record<string, ((e: { data: string }) => void)[]> = {};
const mockClose = jest.fn();
const mockRemoveAll = jest.fn();
const mockEventSourceCtor = jest.fn();

jest.mock("react-native-sse", () => {
  return jest.fn().mockImplementation((url: string, opts?: unknown) => {
    mockEventSourceCtor(url, opts);
    return {
      addEventListener: (
        event: string,
        cb: (e: { data: string }) => void,
      ) => {
        mockListeners[event] = mockListeners[event] || [];
        mockListeners[event].push(cb);
      },
      removeAllEventListeners: mockRemoveAll,
      close: mockClose,
    };
  });
});

jest.mock("../../../src/services/api", () => ({
  __esModule: true,
  API_BASE_URL: "http://test",
  getAuthHeaders: jest
    .fn()
    .mockResolvedValue({ Authorization: "Bearer test" }),
}));

const fakeConversation = {
  sendUserMessage: jest.fn(),
};

describe("useStreamingVideoContext", () => {
  beforeEach(() => {
    mockListeners = {};
    fakeConversation.sendUserMessage.mockClear();
    mockClose.mockClear();
    mockRemoveAll.mockClear();
    mockEventSourceCtor.mockClear();
  });

  test("does nothing when sessionId is null", () => {
    renderHook(() =>
      useStreamingVideoContext(null, fakeConversation as unknown as never),
    );
    expect(mockListeners).toEqual({});
    expect(mockEventSourceCtor).not.toHaveBeenCalled();
  });

  test("dispatches transcript_chunk to sendUserMessage with [CTX UPDATE] prefix", async () => {
    const { result } = renderHook(() =>
      useStreamingVideoContext(
        "sess_1",
        fakeConversation as unknown as never,
      ),
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

  test("ctx_complete sets contextComplete=true and progress=100", async () => {
    const { result } = renderHook(() =>
      useStreamingVideoContext(
        "sess_2",
        fakeConversation as unknown as never,
      ),
    );
    await waitFor(() => expect(mockListeners.ctx_complete).toBeDefined());

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
      useStreamingVideoContext(
        "sess_3",
        fakeConversation as unknown as never,
      ),
    );
    await waitFor(() =>
      expect(mockListeners.transcript_chunk).toBeDefined(),
    );
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });
});
