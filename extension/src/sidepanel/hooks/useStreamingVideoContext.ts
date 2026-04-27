// extension/src/sidepanel/hooks/useStreamingVideoContext.ts
//
// Hook qui consomme le SSE `/voice/context/stream?session_id=…` côté side
// panel pendant un appel voix. Chaque event (`transcript_chunk`,
// `analysis_partial`, `ctx_complete`) est forwardé au SDK ElevenLabs via
// `conversation.sendUserMessage()` avec un préfixe `[CTX UPDATE: …]` pour
// que l'agent comprenne qu'il s'agit d'un message de contexte (pas user).
//
// Stratégie progressive : l'utilisateur peut commencer à parler dès la
// première seconde — l'agent enrichit son contexte au fil du streaming et
// finit par recevoir le digest complet via `[CTX COMPLETE]`.
//
// Si le SSE échoue (réseau / 404), on swallow silencieusement : l'agent
// fallback sur web_search côté ElevenLabs tools.

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../utils/config";

interface ConversationLike {
  sendUserMessage: (message: string) => void;
}

interface StreamingContextResult {
  /** 0–100, % de transcript chunks reçus. */
  contextProgress: number;
  /** True quand `ctx_complete` a été reçu. */
  contextComplete: boolean;
}

export function useStreamingVideoContext(
  sessionId: string | null,
  conversation: ConversationLike | null,
): StreamingContextResult {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    if (!sessionId || !conversation) return;

    // API_BASE_URL inclut déjà `/api`, donc URL finale = `/api/voice/context/stream`
    const url = `${API_BASE_URL}/voice/context/stream?session_id=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("transcript_chunk", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          chunk_index: number;
          total_chunks: number;
          text: string;
        };
        conversation.sendUserMessage(
          `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
        );
        setContextProgress(
          ((data.chunk_index + 1) / data.total_chunks) * 100,
        );
      } catch {
        /* malformed event — drop */
      }
    });

    es.addEventListener("analysis_partial", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          section: string;
          content: string;
        };
        conversation.sendUserMessage(
          `[CTX UPDATE: analysis ${data.section}]\n${data.content}`,
        );
      } catch {
        /* malformed event — drop */
      }
    });

    es.addEventListener("ctx_complete", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          final_digest_summary: string;
        };
        conversation.sendUserMessage(
          `[CTX COMPLETE]\n${data.final_digest_summary}`,
        );
      } catch {
        conversation.sendUserMessage("[CTX COMPLETE]");
      }
      setContextComplete(true);
      setContextProgress(100);
    });

    es.addEventListener("error", () => {
      // SSE error — keep call going; ElevenLabs agent fallback to web_search.
    });

    return () => es.close();
  }, [sessionId, conversation]);

  return { contextProgress, contextComplete };
}
