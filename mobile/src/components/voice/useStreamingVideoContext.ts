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
    let es: EventSource | null = null;

    (async () => {
      const token = await tokenStorage.getAccessToken();
      if (cancelled || !token) return;

      const url = `${API_BASE_URL}/api/voice/context/stream?session_id=${encodeURIComponent(sessionId)}`;
      es = new EventSource(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      es.addEventListener("transcript_chunk", (e: { data: string }) => {
        try {
          const data = JSON.parse(e.data);
          conversation.sendUserMessage?.(
            `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
          );
          setContextProgress(
            (data.chunk_index / data.total_chunks) * 80,
          );
        } catch {
          /* ignore malformed event */
        }
      });

      es.addEventListener("analysis_partial", (e: { data: string }) => {
        try {
          const data = JSON.parse(e.data);
          conversation.sendUserMessage?.(
            `[CTX UPDATE: analysis - ${data.section}]\n${data.content}`,
          );
          setContextProgress((p) => Math.min(p + 5, 95));
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("ctx_complete", (e: { data: string }) => {
        try {
          const data = JSON.parse(e.data);
          conversation.sendUserMessage?.(
            `[CTX COMPLETE]\nFinal digest: ${data.final_digest_summary}`,
          );
        } catch {
          conversation.sendUserMessage?.("[CTX COMPLETE]");
        }
        setContextProgress(100);
        setContextComplete(true);
      });

      es.addEventListener("error", () => {
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
