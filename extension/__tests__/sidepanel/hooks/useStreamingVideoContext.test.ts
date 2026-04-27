/** @jest-environment jsdom */
//
// Tests — `useStreamingVideoContext` (extension/src/sidepanel/hooks/useStreamingVideoContext.ts)
//
// Le hook ouvre une SSE connection vers `/voice/context/stream?session_id=…`
// et forward chaque event au `conversation.sendUserMessage()` du SDK ElevenLabs
// avec un préfixe `[CTX UPDATE: …]` ou `[CTX COMPLETE]`.
//
// Pour tester sans réseau, on monkey-patch `globalThis.EventSource`.
import { renderHook, waitFor } from "@testing-library/react";
import { useStreamingVideoContext } from "../../../src/sidepanel/hooks/useStreamingVideoContext";

class MockEventSource {
  static lastInstance: MockEventSource | null = null;
  private handlers: Record<string, ((e: MessageEvent) => void)[]> = {};
  closed = false;
  constructor(public url: string) {
    MockEventSource.lastInstance = this;
  }
  addEventListener(type: string, h: (e: MessageEvent) => void): void {
    (this.handlers[type] ??= []).push(h);
  }
  fire(type: string, data: unknown): void {
    (this.handlers[type] ?? []).forEach((h) =>
      h({ data: JSON.stringify(data) } as MessageEvent),
    );
  }
  close(): void {
    this.closed = true;
  }
}

beforeAll(() => {
  (globalThis as unknown as { EventSource: unknown }).EventSource =
    MockEventSource;
});

beforeEach(() => {
  MockEventSource.lastInstance = null;
});

describe("useStreamingVideoContext", () => {
  it("forwards transcript_chunk to conversation.sendUserMessage with [CTX UPDATE]", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    renderHook(() =>
      useStreamingVideoContext("sess1", conversation as unknown as { sendUserMessage: (m: string) => void }),
    );

    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
    MockEventSource.lastInstance!.fire("transcript_chunk", {
      chunk_index: 0,
      total_chunks: 3,
      text: "hello world",
    });

    await waitFor(() => {
      expect(conversation.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("[CTX UPDATE: transcript chunk 0/3]"),
      );
    });
  });

  it("updates contextProgress as chunks arrive", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    const { result } = renderHook(() =>
      useStreamingVideoContext("s2", conversation as unknown as { sendUserMessage: (m: string) => void }),
    );
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
    MockEventSource.lastInstance!.fire("transcript_chunk", {
      chunk_index: 2,
      total_chunks: 5,
      text: "x",
    });
    await waitFor(() =>
      expect(result.current.contextProgress).toBeCloseTo(60, 0),
    );
  });

  it("forwards analysis_partial events", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    renderHook(() =>
      useStreamingVideoContext("s_partial", conversation as unknown as { sendUserMessage: (m: string) => void }),
    );
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
    MockEventSource.lastInstance!.fire("analysis_partial", {
      section: "key_points",
      content: "Bullet 1",
    });
    await waitFor(() => {
      expect(conversation.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("[CTX UPDATE: analysis key_points]"),
      );
    });
  });

  it("sets contextComplete=true on ctx_complete event", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    const { result } = renderHook(() =>
      useStreamingVideoContext("s3", conversation as unknown as { sendUserMessage: (m: string) => void }),
    );
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
    MockEventSource.lastInstance!.fire("ctx_complete", {
      final_digest_summary: "done",
    });
    await waitFor(() => {
      expect(result.current.contextComplete).toBe(true);
      expect(result.current.contextProgress).toBe(100);
      expect(conversation.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("[CTX COMPLETE]"),
      );
    });
  });

  it("does nothing when sessionId or conversation is null", () => {
    renderHook(() => useStreamingVideoContext(null, null));
    expect(MockEventSource.lastInstance).toBeNull();
  });

  it("closes the SSE connection on unmount", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    const { unmount } = renderHook(() =>
      useStreamingVideoContext("s_close", conversation as unknown as { sendUserMessage: (m: string) => void }),
    );
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
    const es = MockEventSource.lastInstance!;
    unmount();
    expect(es.closed).toBe(true);
  });
});
