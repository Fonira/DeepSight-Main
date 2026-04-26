/**
 * VoiceOverlay — Floating non-blocking voice chat overlay (Spec #5).
 *
 * 380×600 fixed bottom-right overlay that wraps a voice conversation
 * (ElevenLabs SDK) without obscuring the underlying ChatPage. Allows the
 * user to keep typing in the text chat while the voice call is active.
 *
 * Responsibilities:
 *  - Render a compact floating panel with video context, status, transcript,
 *    quota badge, and end-call control.
 *  - Forward voice transcript events (onMessage) up to the parent so the
 *    ChatPage timeline can be merged in chronological order.
 *  - Persist each transcript turn to /api/voice/transcripts/append with a
 *    graceful fallback if the endpoint is not yet live (Spec #1 dependency).
 *
 * Design: dark-mode-first, glassmorphism, slide-in animation from right.
 * Position: position:fixed; bottom:24px; right:24px; z-index:1000.
 *
 * Decision ouverte #4 (spec) — DEFAULT bottom-right (statu quo simple),
 * pas de drag pour V1.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  PhoneOff,
  X,
  AlertCircle,
  Loader2,
  Volume2,
  Settings,
} from "lucide-react";
import { useVoiceChat } from "./useVoiceChat";
import { VoiceQuotaBadge } from "./VoiceQuotaBadge";
import { VoiceLiveSettings } from "./VoiceLiveSettings";
import { voiceApi } from "../../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface VoiceOverlayMessage {
  text: string;
  source: "user" | "ai";
  /** Seconds elapsed since the call started (relative to sessionStartedAt). */
  timeInCallSecs: number;
  /** Voice session id at time of capture (matches backend voice_sessions.id). */
  voiceSessionId: string | null;
}

export interface VoiceOverlayProps {
  /** Whether the overlay is visible. Parent owns the open/close state. */
  isOpen: boolean;
  /** Close callback — also stops the voice session. */
  onClose: () => void;
  /** Title displayed in the overlay header (e.g. video title). */
  title?: string | null;
  /** Sub-title displayed under title (e.g. channel). */
  subtitle?: string | null;
  /** Summary id for the agent (omit for companion mode). */
  summaryId?: number | null;
  /** Agent type — defaults to "explorer" if summaryId, "companion" otherwise. */
  agentType?:
    | "explorer"
    | "companion"
    | "tutor"
    | "debate_moderator"
    | "quiz_coach";
  /** Language used by the agent. */
  language?: "fr" | "en";
  /**
   * Called every time a transcript turn is captured (user or agent).
   * The parent merges this into the ChatPage timeline.
   */
  onVoiceMessage?: (msg: VoiceOverlayMessage) => void;
  /**
   * Imperative ref exposing sendUserMessage for the ChatPage's input.
   * The ref is filled when the call is active, null otherwise.
   */
  controllerRef?: React.MutableRefObject<VoiceOverlayController | null>;
  /**
   * Auto-start the call when the overlay opens. Default: true.
   * Pass false to require an explicit user click first.
   */
  autoStart?: boolean;
}

export interface VoiceOverlayController {
  sendUserMessage: (text: string) => void;
  voiceSessionId: string | null;
  sessionStartedAt: number | null;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const formatTimer = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const I18N = {
  fr: {
    callTitle: "Appel vocal",
    companion: "Compagnon de réflexion",
    end: "Raccrocher",
    close: "Fermer",
    starting: "Connexion…",
    listening: "À l'écoute",
    thinking: "Réflexion…",
    speaking: "L'assistant parle",
    quotaExceeded: "Quota épuisé",
    error: "Erreur de connexion",
    transcriptEmpty: "La conversation s'affichera ici en temps réel.",
    minutesLeft: "min restantes",
    micMuted: "Micro coupé",
    settings: "Réglages",
  },
  en: {
    callTitle: "Voice call",
    companion: "Reflection Companion",
    end: "End call",
    close: "Close",
    starting: "Connecting…",
    listening: "Listening",
    thinking: "Thinking…",
    speaking: "Assistant speaking",
    quotaExceeded: "Quota exceeded",
    error: "Connection error",
    transcriptEmpty: "The conversation will appear here in real time.",
    minutesLeft: "min left",
    micMuted: "Mic muted",
    settings: "Settings",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  summaryId,
  agentType,
  language = "fr",
  onVoiceMessage,
  controllerRef,
  autoStart = true,
}) => {
  const t = I18N[language];
  const resolvedAgent: VoiceOverlayProps["agentType"] =
    agentType ?? (summaryId ? "explorer" : "companion");

  // ── Settings panel collapsible state ──
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Voice chat hook ──
  const voice = useVoiceChat({
    summaryId: summaryId ?? undefined,
    agentType: resolvedAgent,
    language,
  });

  // ── Track which messages have already been forwarded/persisted (avoid double) ──
  const lastForwardedIndexRef = useRef(0);

  // ── Forward new transcripts to parent + persist to backend ──
  useEffect(() => {
    if (
      !voice.messages ||
      voice.messages.length <= lastForwardedIndexRef.current
    ) {
      return;
    }
    const startedAt = voice.sessionStartedAt;
    const sessionId = voice.voiceSessionId;
    const newSlice = voice.messages.slice(lastForwardedIndexRef.current);
    lastForwardedIndexRef.current = voice.messages.length;

    newSlice.forEach((msg) => {
      const timeInCallSecs = startedAt
        ? Math.max(0, (Date.now() - startedAt) / 1000)
        : 0;

      // Forward to parent for timeline merge
      onVoiceMessage?.({
        text: msg.text,
        source: msg.source,
        timeInCallSecs,
        voiceSessionId: sessionId,
      });

      // Persist to backend (Spec #1 dependency — graceful fallback if 404/405)
      if (sessionId) {
        voiceApi
          .appendTranscript({
            voice_session_id: sessionId,
            speaker: msg.source === "user" ? "user" : "agent",
            content: msg.text,
            time_in_call_secs: timeInCallSecs,
          })
          .catch((err: unknown) => {
            // Spec #1 (B1) may not be live yet — log + skip. Webhook
            // reconciliation will finalize the canonical transcript.
            const message = err instanceof Error ? err.message : String(err);
            console.warn(
              "[VoiceOverlay] appendTranscript failed (skip persist):",
              message,
            );
          });
      }
    });
  }, [
    voice.messages,
    voice.sessionStartedAt,
    voice.voiceSessionId,
    onVoiceMessage,
  ]);

  // ── Reset the forwarded index when a new session starts ──
  useEffect(() => {
    if (voice.status === "idle") {
      lastForwardedIndexRef.current = 0;
    }
  }, [voice.status]);

  // ── Expose controller ref for parent imperative calls ──
  const isActive =
    voice.status === "listening" ||
    voice.status === "speaking" ||
    voice.status === "thinking";

  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      sendUserMessage: voice.sendUserMessage,
      voiceSessionId: voice.voiceSessionId,
      sessionStartedAt: voice.sessionStartedAt,
      isActive,
    };
    return () => {
      if (controllerRef.current) {
        controllerRef.current = null;
      }
    };
  }, [
    controllerRef,
    voice.sendUserMessage,
    voice.voiceSessionId,
    voice.sessionStartedAt,
    isActive,
  ]);

  // ── Auto-start when overlay opens ──
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasStartedRef.current = false;
      return;
    }
    if (autoStart && !hasStartedRef.current && voice.status === "idle") {
      hasStartedRef.current = true;
      voice.start().catch((err) => {
        console.warn("[VoiceOverlay] start failed:", err);
      });
    }
  }, [isOpen, autoStart, voice.status, voice]);

  // ── Stop the call when the overlay closes ──
  const handleClose = useCallback(async () => {
    try {
      await voice.stop();
    } catch {
      // ignore — onClose still fires
    }
    onClose();
  }, [voice, onClose]);

  // ── Status display ──
  const statusLabel = useMemo(() => {
    switch (voice.status) {
      case "connecting":
        return t.starting;
      case "listening":
        return t.listening;
      case "thinking":
        return t.thinking;
      case "speaking":
        return t.speaking;
      case "quota_exceeded":
        return t.quotaExceeded;
      case "error":
        return voice.error || t.error;
      default:
        return null;
    }
  }, [voice.status, voice.error, t]);

  // Don't render anything if not open
  if (!isOpen) return null;

  // Quota badge math — uses elapsedSeconds against remainingMinutes baseline
  const minutesUsed = voice.elapsedSeconds / 60;
  const minutesTotal = Math.max(
    minutesUsed,
    minutesUsed + voice.remainingMinutes,
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // Render via portal for z-index isolation
  // ═══════════════════════════════════════════════════════════════════════════════

  const node = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="voice-overlay"
          role="dialog"
          aria-modal="false"
          aria-label={t.callTitle}
          initial={{ opacity: 0, x: 32, y: 32 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 32, y: 32 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          data-testid="voice-overlay"
          className="fixed bottom-6 right-6 w-[380px] max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-48px)] flex flex-col rounded-2xl shadow-2xl bg-[#0c0c14]/95 backdrop-blur-xl border border-white/10 overflow-hidden"
          style={{ zIndex: 1000 }}
        >
          {/* ── Header ── */}
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                <Mic className="w-4 h-4 text-violet-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/85 truncate leading-tight">
                  {title || t.callTitle}
                </p>
                <p className="text-[11px] text-white/40 truncate">
                  {subtitle ||
                    (resolvedAgent === "companion" ? t.companion : null)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label={t.settings}
                aria-expanded={settingsOpen}
                aria-controls="voice-overlay-settings-panel"
                data-testid="voice-overlay-settings-toggle"
                className={`p-1.5 rounded-lg transition-colors ${
                  settingsOpen
                    ? "bg-violet-500/20 text-violet-200"
                    : "hover:bg-white/[0.06] text-white/40 hover:text-white/70"
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label={t.close}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ── Live settings panel (collapsible) ── */}
          <AnimatePresence initial={false}>
            {settingsOpen && (
              <motion.div
                key="voice-overlay-settings"
                id="voice-overlay-settings-panel"
                data-testid="voice-overlay-settings-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-shrink-0 overflow-hidden"
              >
                <VoiceLiveSettings language={language} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Status + quota row ── */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/[0.04] flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {voice.status === "connecting" && (
                <Loader2 className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
              )}
              {voice.status === "speaking" && (
                <Volume2 className="w-3.5 h-3.5 text-violet-300 animate-pulse" />
              )}
              {voice.status === "error" && (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              <span
                className={`text-[11px] font-medium truncate ${
                  voice.status === "error" ? "text-red-300" : "text-white/55"
                }`}
                data-testid="voice-status-label"
              >
                {statusLabel || formatTimer(voice.elapsedSeconds)}
              </span>
            </div>
            <VoiceQuotaBadge
              minutesUsed={minutesUsed}
              minutesTotal={minutesTotal || 1}
            />
          </div>

          {/* ── Transcript area ── */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            data-testid="voice-overlay-transcript"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.05) transparent",
            }}
          >
            {voice.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-xs text-white/30 leading-relaxed max-w-[260px]">
                  {t.transcriptEmpty}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {voice.messages.map((msg, idx) => (
                  <li
                    key={`${idx}-${msg.source}`}
                    className={`flex ${msg.source === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-snug ${
                        msg.source === "user"
                          ? "bg-blue-600/70 text-white rounded-br-sm"
                          : "bg-white/[0.05] text-white/75 rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Controls ── */}
          <footer className="flex items-center justify-between gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0a0a0f]/80 flex-shrink-0">
            <button
              type="button"
              onClick={voice.toggleMute}
              disabled={!isActive}
              aria-label={voice.isMuted ? t.micMuted : "Mute microphone"}
              className={`p-2 rounded-lg border transition-colors ${
                voice.isMuted
                  ? "bg-red-500/15 border-red-500/30 text-red-300"
                  : "bg-white/[0.04] border-white/[0.08] text-white/55 hover:text-white/85"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              data-testid="voice-overlay-mute"
            >
              {voice.isMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              aria-label={t.end}
              data-testid="voice-overlay-end"
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 text-xs font-semibold transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              {t.end}
            </button>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render via portal for z-index/escape isolation. Falls back to inline render
  // in non-DOM test environments (jsdom does provide document.body).
  if (typeof document === "undefined" || !document.body) {
    return node;
  }
  return createPortal(node, document.body);
};

export default VoiceOverlay;
