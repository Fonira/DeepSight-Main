/**
 * useStreamingVideoContext — Quick Voice Call mobile V3
 *
 * Consomme le SSE backend `/api/voice/context/stream?session_id=...`, qui pousse :
 *   - `transcript_chunk` (chunks de transcript progressifs, 3000 chars)
 *   - `analysis_partial` (sections d'analyse au fur et à mesure)
 *   - `ctx_complete` (digest final)
 *
 * À chaque event, injecte un message `[CTX UPDATE: ...]` dans la conversation
 * ElevenLabs en cours (via `conversation.sendUserMessage(...)`), pour que
 * l'agent puisse répondre avec le contexte le plus récent.
 *
 * Le composant Home appelle ce hook avec `(sessionId, conversation)` issus
 * de `useVoiceChat`. Le hook s'auto-active dès qu'un `sessionId` non-null
 * apparaît, et se ferme proprement à l'unmount ou au stop.
 */

import { useEffect, useState } from "react";
import EventSource from "react-native-sse";
import { API_BASE_URL, getAuthHeaders } from "../../services/api";

interface ConversationLike {
  sendUserMessage?: (text: string) => void;
}

export interface UseStreamingVideoContextReturn {
  /** 0–100, progression du contexte vidéo (chunks + analyses partielles). */
  contextProgress: number;
  /** True quand `ctx_complete` reçu — passe la barre à 100% + label "complet". */
  contextComplete: boolean;
}

export function useStreamingVideoContext(
  sessionId: string | null,
  conversation: ConversationLike,
): UseStreamingVideoContextReturn {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let es: ReturnType<typeof EventSource> | null = null;

    (async () => {
      const headers = await getAuthHeaders();
      if (cancelled) return;

      const url = `${API_BASE_URL}/api/voice/context/stream?session_id=${encodeURIComponent(
        sessionId,
      )}`;
      es = new EventSource(url, { headers });

      es.addEventListener("transcript_chunk", (e: { data: string }) => {
        try {
          const data = JSON.parse(e.data);
          conversation.sendUserMessage?.(
            `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
          );
          setContextProgress((data.chunk_index / data.total_chunks) * 80);
        } catch {
          /* ignore malformed payload */
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
        // Tolérant : le backend reconnecte / l'agent fallback gère le silence.
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
