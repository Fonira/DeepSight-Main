// ── Hook adapter — useVoiceChat extension-side ──
//
// Pourquoi un adapter dédié ?
// Le hook `useVoiceChat` mobile/web fait des `fetch` directs vers l'API.
// Côté MV3, on doit passer par `chrome.runtime.sendMessage` parce que :
//  1. Le service worker porte les tokens d'auth (pas le side panel).
//  2. La CSP `extension_pages` n'autorise pas les requêtes vers
//     n'importe quel host depuis la page sidepanel.
//  3. Le SW peut être tué — il faut idempotent message passing.
//
// Ce hook expose une mini-API : `start()`, `stop()`, `appendTranscript()`,
// expose les transcripts + le status, et délègue tout I/O au background.

import { useCallback, useEffect, useRef, useState } from "react";
import Browser from "../utils/browser-polyfill";
import {
  pickAgentType,
  type VoicePanelContext,
  type VoiceSessionStatus,
  type VoiceTranscript,
  type TranscriptSpeaker,
} from "./types";

interface CreateSessionResponse {
  voice_session_id: string;
  signed_url?: string;
  agent_type?: string;
}

interface BackgroundResponse<T = unknown> {
  success?: boolean;
  error?: string;
  result?: T;
}

interface UseExtensionVoiceChatResult {
  status: VoiceSessionStatus;
  error: string | null;
  transcripts: VoiceTranscript[];
  sessionId: string | null;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /**
   * Append un message transcript localement + le forward au backend.
   * Exposé pour les tests + éventuels TTS clients custom.
   */
  appendTranscript: (
    speaker: TranscriptSpeaker,
    content: string,
  ) => Promise<void>;
}

interface UseExtensionVoiceChatOptions {
  context: VoicePanelContext | null;
  /** Permet d'injecter un transport mock côté tests. */
  sendMessage?: <T>(message: unknown) => Promise<BackgroundResponse<T>>;
}

const defaultSend = <T>(
  message: unknown,
): Promise<BackgroundResponse<T>> =>
  Browser.runtime.sendMessage<unknown, BackgroundResponse<T>>(message);

export function useExtensionVoiceChat(
  options: UseExtensionVoiceChatOptions,
): UseExtensionVoiceChatResult {
  const { context, sendMessage = defaultSend } = options;
  const [status, setStatus] = useState<VoiceSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionStartedAt = useRef<number>(0);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const appendTranscript = useCallback(
    async (speaker: TranscriptSpeaker, content: string): Promise<void> => {
      const trimmed = content?.trim();
      if (!trimmed) return;
      const now = Date.now();
      setTranscripts((prev) => [
        ...prev,
        { speaker, content: trimmed, ts: now },
      ]);
      if (!sessionId) return;
      const time_in_call_secs = sessionStartedAt.current
        ? (now - sessionStartedAt.current) / 1000
        : 0;
      try {
        await sendMessage({
          action: "VOICE_APPEND_TRANSCRIPT",
          data: {
            voice_session_id: sessionId,
            speaker,
            content: trimmed,
            time_in_call_secs,
          },
        });
      } catch {
        // Best-effort : ne pas bloquer l'UI si le backend transcript fail.
      }
    },
    [sendMessage, sessionId],
  );

  const start = useCallback(async (): Promise<void> => {
    if (status === "connecting" || status === "listening") return;
    setError(null);
    setStatus("requesting");

    const agent_type = pickAgentType(context);
    const payload: Record<string, unknown> = { agent_type };
    if (context?.summaryId) {
      payload.summary_id = context.summaryId;
    }
    if (context?.videoId) payload.video_id = context.videoId;
    if (context?.videoTitle) payload.video_title = context.videoTitle;

    let response: BackgroundResponse<CreateSessionResponse>;
    try {
      response = await sendMessage<CreateSessionResponse>({
        action: "VOICE_CREATE_SESSION",
        data: payload,
      });
    } catch (e) {
      if (cancelled.current) return;
      setStatus("error");
      setError((e as Error).message || "Voice session error");
      return;
    }

    if (cancelled.current) return;
    if (!response.success || !response.result?.voice_session_id) {
      setStatus("error");
      setError(response.error || "Impossible de créer la session vocale.");
      return;
    }

    setSessionId(response.result.voice_session_id);
    sessionStartedAt.current = Date.now();
    setStatus("connecting");

    // ── ElevenLabs SDK bootstrap (lazy import) ──
    // Le SDK ouvre une WebSocket vers `wss://api.elevenlabs.io`.
    // On le lazy-import pour éviter d'embarquer le SDK dans le bundle
    // si l'utilisateur n'ouvre jamais le panel — gain runtime + bundle.
    try {
      const sdk = await loadElevenLabsSdk();
      if (cancelled.current) return;
      if (sdk && response.result.signed_url) {
        await sdk.connect({
          signedUrl: response.result.signed_url,
          onMessage: (msg: { source: TranscriptSpeaker; text: string }) => {
            void appendTranscript(msg.source, msg.text);
          },
        });
      }
      if (!cancelled.current) setStatus("listening");
    } catch (e) {
      if (cancelled.current) return;
      setStatus("error");
      setError((e as Error).message || "ElevenLabs connection failed");
    }
  }, [appendTranscript, context, sendMessage, status]);

  const stop = useCallback(async (): Promise<void> => {
    setStatus("ending");
    try {
      const sdk = await loadElevenLabsSdk();
      await sdk?.disconnect?.();
    } catch {
      /* swallow */
    }
    setStatus("ended");
    setSessionId(null);
    sessionStartedAt.current = 0;
  }, []);

  return {
    status,
    error,
    transcripts,
    sessionId,
    isActive: status === "listening" || status === "connecting",
    start,
    stop,
    appendTranscript,
  };
}

// ── ElevenLabs SDK loader (lazy + safe) ──

interface ElevenLabsSdk {
  connect: (opts: {
    signedUrl: string;
    onMessage: (msg: { source: TranscriptSpeaker; text: string }) => void;
  }) => Promise<void>;
  disconnect?: () => Promise<void>;
}

let cachedSdk: ElevenLabsSdk | null = null;
let sdkLoading: Promise<ElevenLabsSdk | null> | null = null;

async function loadElevenLabsSdk(): Promise<ElevenLabsSdk | null> {
  if (cachedSdk) return cachedSdk;
  if (sdkLoading) return sdkLoading;
  sdkLoading = (async () => {
    try {
      // Dynamic import — webpack code-splits ce chunk pour qu'il ne soit
      // chargé que quand l'utilisateur ouvre le sidepanel et démarre.
      // Si le SDK n'est pas installé (V1 stub), on log et on retourne null
      // pour que l'UI reste utilisable côté UI/UX.
      const mod: { default?: ElevenLabsSdk; sdk?: ElevenLabsSdk } | null =
        await import(
          /* webpackChunkName: "elevenlabs-sdk" */ /* webpackIgnore: true */ "elevenlabs-extension-sdk"
        ).catch(() => null);
      if (!mod) return null;
      cachedSdk = mod.default ?? mod.sdk ?? null;
      return cachedSdk;
    } catch {
      return null;
    } finally {
      sdkLoading = null;
    }
  })();
  return sdkLoading;
}

// Test-only escape hatch — permet d'injecter un SDK mock dans Jest sans
// avoir à mocker l'`import()` dynamique de webpack.
export function __setElevenLabsSdkForTests(sdk: ElevenLabsSdk | null): void {
  cachedSdk = sdk;
}
