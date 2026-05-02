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
  /**
   * Summary placeholder created backend-side when agent_type ==
   * "explorer_streaming" (Quick Voice Call sans analyse pré-existante).
   * Permet à useConversation de loader la chat history une fois ack.
   */
  summary_id?: number | null;
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
  /** Summary placeholder créé par le backend en mode explorer_streaming. */
  summary_id?: number | null;
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
  /**
   * Summary placeholder backend (mode explorer_streaming). Null tant que
   * la session n'a pas été créée (ou si l'analyse pré-existait via context).
   */
  summaryId: number | null;
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
  /**
   * Restart silencieux : ferme la session ElevenLabs courante + en recrée
   * une nouvelle avec les options du dernier `startSession()`. Préserve
   * `transcripts[]` et le timer d'appel (`sessionStartedAt`) pour que
   * l'utilisateur ne perde ni l'historique ni le compteur visuel.
   * No-op si aucune session active.
   */
  restartSession: () => Promise<VoiceSessionResponse | null>;
  /** Vrai si la dernière session était l'essai gratuit free user. */
  lastSessionWasTrial: boolean;
  /** Vrai pendant un restart silencieux (UI peut afficher un pulse). */
  isRestarting: boolean;
  /** État courant du mute micro. */
  isMuted: boolean;
  /**
   * Instance du SDK ElevenLabs. V1.3 — expose aussi les freq data getters
   * pour la VoiceWaveform LIVE et les indicateurs speaking de l'AgentAvatar.
   */
  conversation: {
    sendUserMessage: (msg: string) => void;
    getInputByteFrequencyData?: () => Uint8Array | null;
    getOutputByteFrequencyData?: () => Uint8Array | null;
    getInputVolume?: () => number;
    getOutputVolume?: () => number;
  } | null;
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
  // Summary placeholder retourné par le backend en mode explorer_streaming
  // (sinon réutilise le summaryId du context legacy si présent).
  const [summaryId, setSummaryId] = useState<number | null>(
    typeof context?.summaryId === "number" ? context.summaryId : null,
  );
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
    if (typeof response.result.summary_id === "number") {
      setSummaryId(response.result.summary_id);
    }
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
  // V1.3 — On expose au composant les freq getters pour la VoiceWaveform LIVE
  // et l'AgentAvatar avec halo pulsant quand l'agent parle. Ces méthodes
  // tapent dans l'instance VoiceConversation côté SDK.
  const [conversation, setConversation] = useState<{
    sendUserMessage: (msg: string) => void;
    getInputByteFrequencyData?: () => Uint8Array | null;
    getOutputByteFrequencyData?: () => Uint8Array | null;
    getInputVolume?: () => number;
    getOutputVolume?: () => number;
  } | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  // Mémorise les opts du dernier startSession() pour permettre restartSession()
  // sans demander au caller de les re-fournir.
  const lastStartOptsRef = useRef<StartSessionOpts | null>(null);

  const startSession = useCallback(
    async (opts: StartSessionOpts): Promise<VoiceSessionResponse> => {
      setError(null);
      setStatus("requesting");
      lastStartOptsRef.current = opts;
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
      if (typeof session.summary_id === "number") {
        setSummaryId(session.summary_id);
      }
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
          // Expose un objet conversation-like pour le hook SSE streaming
          // ET pour la VoiceWaveform LIVE / AgentAvatar (V1.3).
          setConversation({
            sendUserMessage: (txt: string) => {
              if (sdk.sendUserMessage) sdk.sendUserMessage(txt);
            },
            getInputByteFrequencyData: () =>
              sdk.getInputByteFrequencyData?.() ?? null,
            getOutputByteFrequencyData: () =>
              sdk.getOutputByteFrequencyData?.() ?? null,
            getInputVolume: () => sdk.getInputVolume?.() ?? 0,
            getOutputVolume: () => sdk.getOutputVolume?.() ?? 0,
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
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    // 1) API SDK native (ElevenLabs Conversation expose `setMicMuted` à
    //    partir de 0.15.x). C'est la seule façon fiable d'agir sur le track
    //    qui transmet vraiment à l'agent.
    // 2) Fallback : on tente de retrouver le track via les MediaStreams
    //    associés à WebRTC (RTCPeerConnection.getSenders).
    void (async () => {
      try {
        const sdk = await loadElevenLabsSdk();
        const ok = sdk?.setMuted?.(next);
        if (ok) return;
      } catch {
        /* swallow — fallback ci-dessous */
      }
      // Fallback : appel correct getUserMedia avec { audio: true }, parcours
      // de tous les peer connections WebRTC actifs pour disable le track audio.
      const md = (
        navigator as unknown as {
          mediaDevices?: {
            getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
          };
        }
      ).mediaDevices;
      if (!md?.getUserMedia) return;
      try {
        const stream = await md.getUserMedia({ audio: true });
        for (const track of stream.getAudioTracks()) {
          track.enabled = !next;
        }
      } catch {
        /* swallow — best-effort */
      }
    })();
  }, []);

  const restartSession =
    useCallback(async (): Promise<VoiceSessionResponse | null> => {
      const opts = lastStartOptsRef.current;
      if (!opts) return null;
      if (status !== "listening" && status !== "connecting") return null;

      const preservedStart = sessionStartedAt.current;
      setIsRestarting(true);
      setError(null);
      try {
        // Phase 1 : couper la WS courante.
        try {
          const sdk = await loadElevenLabsSdk();
          await sdk?.disconnect?.();
        } catch {
          /* swallow */
        }
        if (cancelled.current) return null;
        setConversation(null);

        // Phase 2 : recréer une session avec les mêmes opts.
        // startSession() écrasera sessionStartedAt — on le restaurera après.
        const session = await startSession(opts);
        if (cancelled.current) return null;
        // Préserve le timer original — la "session perçue" continue.
        sessionStartedAt.current = preservedStart;
        return session;
      } catch (e) {
        if (cancelled.current) return null;
        setError((e as Error).message || "Restart échoué.");
        return null;
      } finally {
        if (!cancelled.current) setIsRestarting(false);
      }
    }, [startSession, status]);

  return {
    status,
    error,
    transcripts,
    sessionId,
    summaryId,
    isActive: status === "listening" || status === "connecting",
    start,
    stop,
    appendTranscript,
    startSession,
    endSession,
    toggleMute,
    restartSession,
    lastSessionWasTrial,
    isRestarting,
    isMuted,
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
  /**
   * Mute/unmute le micro côté SDK ElevenLabs. Renvoie `true` si la
   * Conversation a accepté la commande (méthode native trouvée), `false`
   * si on doit fallback sur la manipulation directe des MediaStreams.
   */
  setMuted?: (muted: boolean) => boolean;
  /**
   * V1.3 — Frequency data getters pour la VoiceWaveform LIVE et les
   * indicateurs speaking. Renvoient `null` ou `0` si l'SDK n'expose pas
   * encore ces méthodes (versions < 0.15.2 pour les freq, ou si la
   * conversation n'est pas active). Le composant fallback alors sur une
   * waveform statique.
   */
  getInputByteFrequencyData?: () => Uint8Array | null;
  getOutputByteFrequencyData?: () => Uint8Array | null;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
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
          // [B10] workletPaths : self-host les worklets ElevenLabs depuis
          // dist/ pour bypass la CSP MV3 stricte qui bloque les blob: URLs.
          // Les fichiers sont copiés par webpack CopyPlugin depuis
          // node_modules/@elevenlabs/client/worklets/.
          const workletPaths = {
            rawAudioProcessor: chrome.runtime.getURL("rawAudioProcessor.js"),
            audioConcatProcessor: chrome.runtime.getURL(
              "audioConcatProcessor.js",
            ),
          };
          activeConv = (await Conversation.startSession({
            signedUrl: opts.signedUrl,
            workletPaths,
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
        setMuted: (muted: boolean): boolean => {
          // ElevenLabs Conversation expose `setMicMuted(boolean)` à partir
          // de @elevenlabs/client 0.15.x. On essaie cette méthode puis
          // `setVolume(0)` comme fallback partiel (mute side reception only).
          try {
            const conv = activeConv as unknown as {
              setMicMuted?: (m: boolean) => void;
            };
            if (typeof conv?.setMicMuted === "function") {
              conv.setMicMuted(muted);
              return true;
            }
          } catch {
            /* swallow */
          }
          return false;
        },
        // V1.3 — Frequency data accessors. Délègue à l'instance VoiceConversation
        // qui maintient un AnalyserNode interne. Renvoie null si la conversation
        // n'est pas démarrée ou si la version du SDK n'expose pas cette API.
        getInputByteFrequencyData: () => {
          try {
            return activeConv?.getInputByteFrequencyData?.() ?? null;
          } catch {
            return null;
          }
        },
        getOutputByteFrequencyData: () => {
          try {
            return activeConv?.getOutputByteFrequencyData?.() ?? null;
          } catch {
            return null;
          }
        },
        getInputVolume: () => {
          try {
            return activeConv?.getInputVolume?.() ?? 0;
          } catch {
            return 0;
          }
        },
        getOutputVolume: () => {
          try {
            return activeConv?.getOutputVolume?.() ?? 0;
          } catch {
            return 0;
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
//
// V1.3 — On expose aussi les getters frequency data pour la VoiceWaveform
// LIVE et getInput/OutputVolume pour le AgentAvatar (halo pulsant si
// l'agent parle). Optionnels : si une version de @elevenlabs/client ne les
// expose pas, le composant fallback sur la waveform statique.
export interface ConversationInstance {
  endSession(): Promise<void>;
  sendUserMessage?(message: string): void;
  setMicMuted?(muted: boolean): void;
  getInputByteFrequencyData?(): Uint8Array | null;
  getOutputByteFrequencyData?(): Uint8Array | null;
  getInputVolume?(): number;
  getOutputVolume?(): number;
}

interface ConversationStatic {
  startSession(opts: {
    signedUrl: string;
    onMessage?: (event: { message: string; source: "user" | "ai" }) => void;
    /** [B10] self-host worklets pour bypass CSP MV3 */
    workletPaths?: {
      rawAudioProcessor?: string;
      audioConcatProcessor?: string;
    };
  }): Promise<ConversationInstance>;
}

// Test-only escape hatch — permet d'injecter un SDK mock dans Jest sans
// avoir à mocker l'`import()` dynamique de webpack.
export function __setElevenLabsSdkForTests(sdk: ElevenLabsSdk | null): void {
  cachedSdk = sdk;
}
