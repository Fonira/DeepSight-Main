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
// Race condition résolue (I3) : entre `setSessionId` et `setConversation`
// dans useExtensionVoiceChat, il y a une fenêtre de quelques centaines de
// ms (le SDK ElevenLabs doit terminer son `connect()` WebSocket). Si on
// attendait `conversation !== null` pour ouvrir le SSE, on perdrait les
// premiers chunks (les plus utiles, début vidéo) car le backend pubsub
// Redis ne replay pas les events.
//
// Solution : on ouvre le SSE dès que `sessionId` est dispo, et on buffer
// les chunks dans un ref si `conversation` n'est pas encore set. Quand
// conversation devient dispo, on flush le buffer dans l'ordre. La somme
// est sub-100ms côté UX, mais elle évite que l'agent rate les premières
// secondes du transcript.
//
// Si le SSE échoue (réseau / 404), on swallow silencieusement : l'agent
// fallback sur web_search côté ElevenLabs tools.

import { useEffect, useRef, useState } from "react";
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

  // Buffer FIFO des messages en attente que conversation soit set (I3).
  // Ref pour éviter de re-créer l'EventSource à chaque push (le hook
  // ouvre l'ES UNE fois sur mount sessionId, indépendamment de conv).
  const pendingMessagesRef = useRef<string[]>([]);
  const conversationRef = useRef<ConversationLike | null>(null);

  // Garde la dernière conversation dispo dans une ref pour que les
  // listeners SSE (qui closurent une seule fois) puissent toujours
  // accéder à la version courante.
  useEffect(() => {
    conversationRef.current = conversation;
    if (conversation && pendingMessagesRef.current.length > 0) {
      // Flush buffer dans l'ordre d'arrivée (FIFO).
      const flushed = [...pendingMessagesRef.current];
      pendingMessagesRef.current = [];
      for (const msg of flushed) {
        try {
          conversation.sendUserMessage(msg);
        } catch {
          /* swallow */
        }
      }
    }
  }, [conversation]);

  // Helper qui pousse au SDK si dispo OU empile dans le buffer sinon.
  // Stable closure (pas de dépendance React) — utilisé par les listeners.
  const pushOrBuffer = (msg: string): void => {
    const conv = conversationRef.current;
    if (conv) {
      try {
        conv.sendUserMessage(msg);
      } catch {
        /* swallow — best-effort */
      }
    } else {
      pendingMessagesRef.current.push(msg);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

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
        pushOrBuffer(
          `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
        );
        setContextProgress(((data.chunk_index + 1) / data.total_chunks) * 100);
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
        pushOrBuffer(`[CTX UPDATE: analysis ${data.section}]\n${data.content}`);
      } catch {
        /* malformed event — drop */
      }
    });

    es.addEventListener("ctx_complete", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          final_digest_summary: string;
        };
        pushOrBuffer(`[CTX COMPLETE]\n${data.final_digest_summary}`);
      } catch {
        pushOrBuffer("[CTX COMPLETE]");
      }
      setContextComplete(true);
      setContextProgress(100);
    });

    es.addEventListener("error", () => {
      // SSE error — keep call going; ElevenLabs agent fallback to web_search.
    });

    return () => {
      es.close();
      pendingMessagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { contextProgress, contextComplete };
}
