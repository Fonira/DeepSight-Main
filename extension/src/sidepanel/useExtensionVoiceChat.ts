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

/**
 * Quick Voice Call (Task 16) — paramètres pour `startSession()`.
 * `agentType=explorer_streaming` active le mode streaming context côté backend
 * (l'agent reçoit le transcript progressivement via SSE/sendUserMessage).
 */
export interface StartSessionOpts {
  videoId: string;
  videoTitle?: string;
  agentType: "companion" | "explorer" | "explorer_streaming";
  isStreaming?: boolean;
}

/**
 * Réponse du backend pour POST /api/voice/session — exposée à VoiceView
 * pour qu'il puisse afficher la durée max et flag essai.
 */
export interface VoiceSessionResponse {
  session_id: string;
  signed_url?: string;
  conversation_token?: string;
  max_minutes?: number;
  is_trial?: boolean;
}

/** Erreur 402 du backend — VoiceView mappe `detail.reason` → UpgradeCTA. */
export class VoiceQuotaError extends Error {
  status: number;
  detail: { reason?: string; cta?: string };
  constructor(
    message: string,
    status: number,
    detail: Record<string, unknown>,
  ) {
    super(message);
    this.name = "VoiceQuotaError";
    this.status = status;
    this.detail = detail as { reason?: string; cta?: string };
  }
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
  // ── Quick Voice Call API (Task 16) ──
  /** POST /api/voice/session — throws VoiceQuotaError on 402. */
  startSession: (opts: StartSessionOpts) => Promise<VoiceSessionResponse>;
  /** Ferme la session ElevenLabs + reset internal state. */
  endSession: () => Promise<void>;
  /** Toggle micro côté navigateur (mute/unmute). */
  toggleMute: () => void;
  /** Vrai si la dernière session était l'essai gratuit free user. */
  lastSessionWasTrial: boolean;
  /** Instance du SDK ElevenLabs (pour `sendUserMessage` côté streaming hook). */
  conversation: { sendUserMessage: (msg: string) => void } | null;
}

interface UseExtensionVoiceChatOptions {
  context?: VoicePanelContext | null;
  /** Permet d'injecter un transport mock côté tests. */
  sendMessage?: <T>(message: unknown) => Promise<BackgroundResponse<T>>;
}

const defaultSend = <T>(message: unknown): Promise<BackgroundResponse<T>> =>
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

  // ── Quick Voice Call (Task 16) — startSession / endSession / toggleMute ──
  // POST /api/voice/session via le SW. Retourne la response, throws
  // VoiceQuotaError pour les 402 quota.
  const [lastSessionWasTrial, setLastSessionWasTrial] = useState(false);
  const [conversation, setConversation] = useState<{
    sendUserMessage: (msg: string) => void;
  } | null>(null);
  const isMutedRef = useRef(false);

  const startSession = useCallback(
    async (opts: StartSessionOpts): Promise<VoiceSessionResponse> => {
      setError(null);
      setStatus("requesting");
      const payload: Record<string, unknown> = {
        agent_type: opts.agentType,
        video_id: opts.videoId,
      };
      if (opts.videoTitle) payload.video_title = opts.videoTitle;
      if (opts.isStreaming) payload.is_streaming = true;

      const response = await sendMessage<VoiceSessionResponse>({
        action: "VOICE_CREATE_SESSION",
        data: payload,
      });

      if (cancelled.current) {
        // Component unmounted before response arrived — abort.
        throw new Error("aborted");
      }
      if (!response.success || !response.result) {
        // Backend renvoie {success:false, error:"…", status?:402, detail?:{}}
        const status = (response as unknown as { status?: number }).status;
        const detail =
          (response as unknown as { detail?: Record<string, unknown> })
            .detail ?? {};
        if (status === 402) {
          setStatus("error");
          throw new VoiceQuotaError(
            response.error || "Quota voice atteint",
            402,
            detail,
          );
        }
        setStatus("error");
        setError(response.error || "Impossible de créer la session vocale.");
        throw new Error(response.error || "Voice session error");
      }

      const session = response.result;
      setSessionId(session.session_id);
      setLastSessionWasTrial(Boolean(session.is_trial));
      sessionStartedAt.current = Date.now();
      setStatus("connecting");

      try {
        const sdk = await loadElevenLabsSdk();
        if (cancelled.current) throw new Error("aborted");
        if (sdk && session.signed_url) {
          await sdk.connect({
            signedUrl: session.signed_url,
            onMessage: (msg: { source: TranscriptSpeaker; text: string }) => {
              void appendTranscript(msg.source, msg.text);
            },
          });
          // Expose un objet conversation-like pour le hook SSE streaming.
          setConversation({
            sendUserMessage: (txt: string) => {
              if (sdk.sendUserMessage) sdk.sendUserMessage(txt);
            },
          });
        }
        if (!cancelled.current) setStatus("listening");
      } catch (e) {
        if (cancelled.current) throw new Error("aborted");
        setStatus("error");
        setError((e as Error).message || "ElevenLabs connection failed");
        throw e;
      }
      return session;
    },
    [appendTranscript, sendMessage],
  );

  const endSession = useCallback(async (): Promise<void> => {
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
    setConversation(null);
    isMutedRef.current = false;
  }, []);

  const toggleMute = useCallback((): void => {
    isMutedRef.current = !isMutedRef.current;
    // Toggle de toutes les pistes audio MediaStream actives.
    // ElevenLabs SDK expose pas directement le micro track — on tente via
    // navigator.mediaDevices si présent (best-effort, no-op en jsdom).
    const md = (
      navigator as unknown as {
        mediaDevices?: { getUserMedia?: () => Promise<MediaStream> };
      }
    ).mediaDevices;
    if (!md?.getUserMedia) return;
    md.getUserMedia()
      .then((stream) => {
        for (const track of stream.getAudioTracks()) {
          track.enabled = !isMutedRef.current;
        }
      })
      .catch(() => {
        /* swallow — best-effort */
      });
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
    startSession,
    endSession,
    toggleMute,
    lastSessionWasTrial,
    conversation,
  };
}

// ── ElevenLabs SDK loader (lazy + safe) ──

interface ElevenLabsSdk {
  connect: (opts: {
    signedUrl: string;
    onMessage: (msg: { source: TranscriptSpeaker; text: string }) => void;
  }) => Promise<void>;
  disconnect?: () => Promise<void>;
  /** Quick Voice Call (Task 16) — pousse un message user textuel à l'agent
   * (utilisé pour propager les events SSE `[CTX UPDATE: …]`). */
  sendUserMessage?: (message: string) => void;
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
      // On wrappe `@elevenlabs/client` (Conversation.startSession) dans
      // l'interface `ElevenLabsSdk` minimale utilisée par notre hook.
      const mod = await import(
        /* webpackChunkName: "elevenlabs-sdk" */ "@elevenlabs/client"
      ).catch(() => null);
      if (!mod) return null;
      const Conversation = (mod as { Conversation?: ConversationStatic })
        .Conversation;
      if (!Conversation) return null;
      let activeConv: ConversationInstance | null = null;
      cachedSdk = {
        connect: async (opts) => {
          activeConv = (await Conversation.startSession({
            signedUrl: opts.signedUrl,
            onMessage: ({ message, source }) => {
              const speaker: TranscriptSpeaker =
                source === "user" ? "user" : "agent";
              opts.onMessage({ source: speaker, text: message });
            },
          })) as ConversationInstance;
        },
        disconnect: async () => {
          try {
            await activeConv?.endSession();
          } catch {
            /* swallow */
          }
          activeConv = null;
        },
        sendUserMessage: (message: string): void => {
          try {
            activeConv?.sendUserMessage?.(message);
          } catch {
            /* swallow — best-effort si l'agent est déconnecté */
          }
        },
      };
      return cachedSdk;
    } catch {
      return null;
    } finally {
      sdkLoading = null;
    }
  })();
  return sdkLoading;
}

// ── Types narrow pour le SDK ElevenLabs ──
// On évite d'importer Conversation au top-level (lazy chunk Webpack) ;
// on déclare seulement les pièces utilisées.
interface ConversationInstance {
  endSession(): Promise<void>;
  sendUserMessage?(message: string): void;
}

interface ConversationStatic {
  startSession(opts: {
    signedUrl: string;
    onMessage?: (event: { message: string; source: "user" | "ai" }) => void;
  }): Promise<ConversationInstance>;
}

// Test-only escape hatch — permet d'injecter un SDK mock dans Jest sans
// avoir à mocker l'`import()` dynamique de webpack.
export function __setElevenLabsSdkForTests(sdk: ElevenLabsSdk | null): void {
  cachedSdk = sdk;
}
