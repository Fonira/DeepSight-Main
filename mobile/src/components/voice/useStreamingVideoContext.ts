import { useState, useEffect } from "react";
import EventSource from "react-native-sse";
import { API_BASE_URL } from "../../constants/config";
import { tokenStorage } from "../../utils/storage";

interface ConversationLike {
  sendUserMessage?: (text: string) => void;
}

export interface UseStreamingVideoContextReturn {
  contextProgress: number;
  contextComplete: boolean;
}

type CtxEvent =
  | "transcript_chunk"
  | "analysis_partial"
  | "ctx_complete"
  | "error";

/**
 * Subscribe to backend SSE `/api/voice/context/stream?session_id=X` and forward
 * incoming `transcript_chunk` / `analysis_partial` / `ctx_complete` events into
 * the live ElevenLabs conversation via `sendUserMessage("[CTX UPDATE: ...]")`.
 *
 * Quick Voice Call mobile V3 — paste URL → instant call → context streams in
 * progressively while the user talks to the agent.
 */
export function useStreamingVideoContext(
  sessionId: string | null,
  conversation: ConversationLike,
): UseStreamingVideoContextReturn {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let es: EventSource<CtxEvent> | null = null;

    (async () => {
      const token = await tokenStorage.getAccessToken();
      if (cancelled || !token) return;

      const url = `${API_BASE_URL}/api/voice/context/stream?session_id=${encodeURIComponent(sessionId)}`;
      es = new EventSource<CtxEvent>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const handleTranscript = (e: { data?: string | null }) => {
        if (!e.data) return;
        try {
          const data = JSON.parse(e.data);
          conversation.sendUserMessage?.(
            `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
          );
          setContextProgress((data.chunk_index / data.total_chunks) * 80);
        } catch {
          /* ignore malformed event */
        }
      };
      const handleAnalysis = (e: { data?: string | null }) => {
        if (!e.data) return;
        try {
          const data = JSON.parse(e.data);
          conversation.sendUserMessage?.(
            `[CTX UPDATE: analysis - ${data.section}]\n${data.content}`,
          );
          setContextProgress((p) => Math.min(p + 5, 95));
        } catch {
          /* ignore */
        }
      };
      const handleComplete = (e: { data?: string | null }) => {
        try {
          const data = e.data ? JSON.parse(e.data) : {};
          conversation.sendUserMessage?.(
            `[CTX COMPLETE]\nFinal digest: ${data.final_digest_summary ?? ""}`,
          );
        } catch {
          conversation.sendUserMessage?.("[CTX COMPLETE]");
        }
        setContextProgress(100);
        setContextComplete(true);
      };

      // rn-sse types are strict — cast handlers to satisfy EventSourceListener.
      const addListener = es.addEventListener.bind(
        es,
      ) as unknown as (
        event: string,
        cb: (e: { data?: string | null }) => void,
      ) => void;
      addListener("transcript_chunk", handleTranscript);
      addListener("analysis_partial", handleAnalysis);
      addListener("ctx_complete", handleComplete);
      addListener("error", () => {
        /* tolerate transient errors — agent has web_search fallback */
      });
    })();

    return () => {
      cancelled = true;
      try {
        es?.close();
      } catch {
        /* ignore */
      }
    };
  }, [sessionId, conversation]);

  return { contextProgress, contextComplete };
}
