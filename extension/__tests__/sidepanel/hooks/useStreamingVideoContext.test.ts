/** @jest-environment jsdom */
//
// Tests — `useStreamingVideoContext` (extension/src/sidepanel/hooks/useStreamingVideoContext.ts)
//
// Le hook ouvre une SSE connection vers `/voice/context/stream?session_id=…`
// et forward chaque event au `conversation.sendUserMessage()` du SDK ElevenLabs
// avec un préfixe `[CTX UPDATE: …]` ou `[CTX COMPLETE]`.
//
// Pour tester sans réseau, on monkey-patch `globalThis.EventSource`.
//
// Note : `fire()` invoke les handlers SSE dans un `act()` synchrone pour
// que les setState (contextProgress, contextComplete) + les push dans
// pendingMessagesRef soient flushés sans warning React. Indispensable
// post-I3 (buffer SSE chunks).
import { renderHook, waitFor, act } from "@testing-library/react";
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
    act(() => {
      (this.handlers[type] ?? []).forEach((h) =>
        h({ data: JSON.stringify(data) } as MessageEvent),
      );
    });
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
      useStreamingVideoContext(
        "sess1",
        conversation as unknown as { sendUserMessage: (m: string) => void },
      ),
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
      useStreamingVideoContext(
        "s2",
        conversation as unknown as { sendUserMessage: (m: string) => void },
      ),
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
      useStreamingVideoContext(
        "s_partial",
        conversation as unknown as { sendUserMessage: (m: string) => void },
      ),
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
      useStreamingVideoContext(
        "s3",
        conversation as unknown as { sendUserMessage: (m: string) => void },
      ),
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

  it("does nothing when sessionId is null (even if conversation set)", () => {
    // [I3] : on ouvre SSE dès sessionId, mais sessionId=null → no-op.
    renderHook(() =>
      useStreamingVideoContext(null, {
        sendUserMessage: jest.fn(),
      } as unknown as { sendUserMessage: (m: string) => void }),
    );
    expect(MockEventSource.lastInstance).toBeNull();
  });

  it("closes the SSE connection on unmount", async () => {
    const conversation = { sendUserMessage: jest.fn() };
    const { unmount } = renderHook(() =>
      useStreamingVideoContext(
        "s_close",
        conversation as unknown as { sendUserMessage: (m: string) => void },
      ),
    );
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
    const es = MockEventSource.lastInstance!;
    unmount();
    expect(es.closed).toBe(true);
  });

  // ─── [I3] Race condition SSE × conversation ────────────────────────
  // Stratégie résolution : on ouvre le SSE dès que sessionId est dispo
  // (PAS d'attente sur conversation). Tant que conversation est null,
  // les chunks reçus sont bufferés dans pendingMessagesRef. Au moment où
  // conversation devient set, le buffer est flushé en ordre FIFO.
  // Bénéfice : les premiers chunks (les plus utiles, début vidéo) ne
  // sont pas perdus pendant la fenêtre 100-500ms du SDK ElevenLabs
  // connect().

  it("[I3] opens SSE as soon as sessionId is available (even with conversation=null)", async () => {
    renderHook(() => useStreamingVideoContext("s_race", null));
    // SSE doit s'ouvrir immédiatement, sans attendre conversation.
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());
  });

  it("[I3] buffers chunks arrived BEFORE conversation is set, flushes when ready", async () => {
    const { rerender } = renderHook(
      ({ conv }: { conv: { sendUserMessage: jest.Mock } | null }) =>
        useStreamingVideoContext(
          "s_buf1",
          conv as unknown as { sendUserMessage: (m: string) => void } | null,
        ),
      { initialProps: { conv: null } },
    );

    // SSE est ouvert (cf. test précédent).
    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());

    // Premier chunk arrive AVANT que conversation soit set → bufferisé.
    MockEventSource.lastInstance!.fire("transcript_chunk", {
      chunk_index: 0,
      total_chunks: 5,
      text: "early chunk content",
    });

    // Maintenant conversation arrive set → buffer doit être flushé.
    const conv = { sendUserMessage: jest.fn() };
    rerender({ conv });

    await waitFor(() => {
      expect(conv.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("[CTX UPDATE: transcript chunk 0/5]"),
      );
    });
  });

  it("[I3] flushes multiple buffered messages in FIFO order", async () => {
    const { rerender } = renderHook(
      ({ conv }: { conv: { sendUserMessage: jest.Mock } | null }) =>
        useStreamingVideoContext(
          "s_buf2",
          conv as unknown as { sendUserMessage: (m: string) => void } | null,
        ),
      { initialProps: { conv: null } },
    );

    await waitFor(() => expect(MockEventSource.lastInstance).toBeTruthy());

    // 3 chunks arrivent avant que conversation soit set.
    MockEventSource.lastInstance!.fire("transcript_chunk", {
      chunk_index: 0,
      total_chunks: 3,
      text: "first",
    });
    MockEventSource.lastInstance!.fire("transcript_chunk", {
      chunk_index: 1,
      total_chunks: 3,
      text: "second",
    });
    MockEventSource.lastInstance!.fire("analysis_partial", {
      section: "summary",
      content: "third",
    });

    // Conversation arrive → flush.
    const conv = { sendUserMessage: jest.fn() };
    rerender({ conv });

    await waitFor(() => {
      expect(conv.sendUserMessage).toHaveBeenCalledTimes(3);
    });
    // Ordre FIFO préservé.
    expect(conv.sendUserMessage).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("first"),
    );
    expect(conv.sendUserMessage).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("second"),
    );
    expect(conv.sendUserMessage).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("third"),
    );
  });
});
