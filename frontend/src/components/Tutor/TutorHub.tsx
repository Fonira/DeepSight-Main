/**
 * TutorHub — Unified text/voice tutor hub (refactor 2026-05-11 #2).
 *
 * One full-height right-side panel that hosts the WHOLE conversation —
 * text and voice messages are interleaved in a single transcript. The
 * "Texte/Vocal" toggle only switches the INPUT zone at the bottom; the
 * timeline above is shared and never wiped on mode change.
 *
 * Key changes from PR #450:
 *   1. No more `<VoiceOverlay presentationMode="fullbleed">` (caused
 *      overflow / clipping bugs). We mount `useVoiceChat` directly and
 *      render a slim mic-controls strip in the input zone instead.
 *   2. Voice transcripts (user spoken + agent spoken) are merged into the
 *      same timeline as text turns, with a small mic icon to distinguish
 *      modality.
 *   3. Read Zustand actions via stable selectors (no full-object
 *      destructuring inside hook deps) — fixes the React #300/#310
 *      crashes that came from re-render storms when `tutor` was rebuilt.
 *
 * Entry points (unchanged):
 *   - Sidebar item "Tuteur" → opens with `defaultMode="text"`, no primer.
 *   - Teaser `TutorIdle` (concept du jour) → opens with `defaultMode="text"`,
 *     `initialContext = { conceptTerm, conceptDef?, summaryId? }`.
 *
 * Mode switch UX:
 *   - Voice → text: just stops the call. Transcript stays in the timeline.
 *   - Text → voice with messages in flight: confirm prompt (ending the
 *     text session is destructive — Redis TTL kicks in). On accept, a
 *     [CONTEXT] primer is injected after the call connects.
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { LanguageContext } from "../../contexts/LanguageContext";
import { useTutorStore } from "../../store/tutorStore";
import type { TutorTurn } from "../../types/tutor";
import { useVoiceChat } from "../voice/useVoiceChat";

export interface TutorHubInitialContext {
  conceptTerm: string;
  conceptDef?: string | null;
  summaryId?: number | null;
}

export interface TutorHubProps {
  /** Whether the hub is visible. Parent owns the open/close state. */
  isOpen: boolean;
  /** Close callback — also ends any active session (text or voice). */
  onClose: () => void;
  /** UI language. Defaults to "fr". */
  language?: "fr" | "en";
  /**
   * Optional concept context used as an amorce. When provided AND mode is
   * "text", the hub starts a text session immediately with this concept.
   * In voice mode, the primer is injected via `[CONTEXT]` after onConnect.
   */
  initialContext?: TutorHubInitialContext | null;
  /** Default mode on open. Defaults to "text". */
  defaultMode?: "text" | "voice";
}

type HubMode = "text" | "voice";

interface TimelineItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  modality: "text" | "voice";
  timestamp_ms: number;
}

const I18N = {
  fr: {
    title: "Tuteur",
    subtitleText: "Révisez vos analyses par écrit",
    subtitleVoice: "Révisez vos analyses à voix haute",
    close: "Fermer",
    modeText: "Texte",
    modeVoice: "Vocal",
    inputPlaceholder: "Tapez votre réponse...",
    send: "Envoyer",
    emptyHint:
      "Bonjour. Je suis le Tuteur — sur quoi voulez-vous revenir aujourd'hui ?",
    loading: "…",
    switchConfirm:
      "Changer de mode redémarrera la conversation texte. Continuer ?",
    voiceConnecting: "Connexion vocale…",
    voiceListening: "À votre écoute",
    voiceThinking: "Réflexion…",
    voiceSpeaking: "Le tuteur parle",
    voiceMuteOn: "Couper le micro",
    voiceMuteOff: "Réactiver le micro",
    voiceHangup: "Raccrocher",
    voiceStart: "Démarrer l'appel",
    voiceQuotaExceeded: "Quota vocal épuisé.",
    voiceError: "Erreur de connexion vocale.",
  },
  en: {
    title: "Tutor",
    subtitleText: "Review your analyses in writing",
    subtitleVoice: "Review your analyses out loud",
    close: "Close",
    modeText: "Text",
    modeVoice: "Voice",
    inputPlaceholder: "Type your answer...",
    send: "Send",
    emptyHint:
      "Hello. I'm the Tutor — what would you like to revisit today?",
    loading: "…",
    switchConfirm:
      "Switching modes will restart the text conversation. Continue?",
    voiceConnecting: "Connecting voice…",
    voiceListening: "Listening",
    voiceThinking: "Thinking…",
    voiceSpeaking: "Tutor is speaking",
    voiceMuteOn: "Mute mic",
    voiceMuteOff: "Unmute mic",
    voiceHangup: "Hang up",
    voiceStart: "Start call",
    voiceQuotaExceeded: "Voice quota exceeded.",
    voiceError: "Voice connection error.",
  },
} as const;

/**
 * Build a [CONTEXT] block summarizing the previous text conversation so the
 * voice agent can seamlessly pick up from where the text mode left off.
 */
function buildSwitchContextBlock(
  language: "fr" | "en",
  conceptTerm: string | null,
  lastMessages: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const trimmed = lastMessages.slice(-2);
  if (language === "fr") {
    const lines: string[] = [
      `[CONTEXT] L'utilisateur revient d'une session texte`,
    ];
    if (conceptTerm) {
      lines.push(`Concept en cours : « ${conceptTerm} »`);
    }
    if (trimmed.length > 0) {
      lines.push("Derniers échanges :");
      for (const m of trimmed) {
        const who = m.role === "user" ? "Utilisateur" : "Tuteur";
        lines.push(`- ${who} : ${m.content}`);
      }
    }
    lines.push("Reprends la conversation à voix haute sans tout résumer.");
    return lines.join("\n");
  }
  const lines: string[] = [
    `[CONTEXT] The user is returning from a text session`,
  ];
  if (conceptTerm) {
    lines.push(`Current concept: "${conceptTerm}"`);
  }
  if (trimmed.length > 0) {
    lines.push("Recent exchanges:");
    for (const m of trimmed) {
      const who = m.role === "user" ? "User" : "Tutor";
      lines.push(`- ${who}: ${m.content}`);
    }
  }
  lines.push("Resume the conversation aloud without re-summarizing.");
  return lines.join("\n");
}

export const TutorHub: React.FC<TutorHubProps> = ({
  isOpen,
  onClose,
  language: explicitLanguage,
  initialContext,
  defaultMode = "text",
}) => {
  // Read the language context without throwing when no provider is mounted
  // (the Sidebar test renders this component outside of `<LanguageProvider>`).
  const languageCtx = useContext(LanguageContext);
  const language: "fr" | "en" =
    explicitLanguage ??
    (languageCtx?.language === "fr" || languageCtx?.language === "en"
      ? languageCtx.language
      : "fr");
  const t = I18N[language];

  // ── Zustand selectors (stable refs — fixes React #300/#310) ──
  // Subscribing to each leaf individually means the component only re-renders
  // when that specific slice changes, and the action refs are guaranteed
  // stable across renders (Zustand never recreates them).
  const tutorPhase = useTutorStore((s) => s.phase);
  const tutorMessages = useTutorStore((s) => s.messages);
  const tutorConceptTerm = useTutorStore((s) => s.conceptTerm);
  const tutorLoading = useTutorStore((s) => s.loading);
  const startSession = useTutorStore((s) => s.startSession);
  const submitTextTurn = useTutorStore((s) => s.submitTextTurn);
  const endSession = useTutorStore((s) => s.endSession);

  const [mode, setMode] = useState<HubMode>(defaultMode);

  // ── Voice chat hook (always mounted; activated by `voice.start()`) ──
  const voice = useVoiceChat({
    agentType: "knowledge_tutor",
    language,
  });

  // Track timestamps for voice messages so we can merge them with text turns.
  // `voice.messages` is append-only, so a simple length watcher suffices.
  const voiceTimestampsRef = useRef<number[]>([]);
  useEffect(() => {
    const needed = voice.messages.length;
    while (voiceTimestampsRef.current.length < needed) {
      voiceTimestampsRef.current.push(Date.now());
    }
    if (voiceTimestampsRef.current.length > needed) {
      voiceTimestampsRef.current = voiceTimestampsRef.current.slice(0, needed);
    }
  }, [voice.messages.length]);

  // ── Merged timeline (text turns + voice transcripts) ──
  const timeline: TimelineItem[] = useMemo(() => {
    const textItems: TimelineItem[] = tutorMessages.map(
      (m: TutorTurn, idx: number): TimelineItem => ({
        id: `t:${idx}:${m.timestamp_ms}`,
        role: m.role,
        content: m.content,
        modality: "text",
        timestamp_ms: m.timestamp_ms,
      }),
    );
    const voiceItems: TimelineItem[] = voice.messages.map((m, idx) => ({
      id: `v:${idx}`,
      role: m.source === "user" ? "user" : "assistant",
      content: m.text,
      modality: "voice",
      timestamp_ms: voiceTimestampsRef.current[idx] ?? Date.now(),
    }));
    return [...textItems, ...voiceItems].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms,
    );
  }, [tutorMessages, voice.messages]);

  // ── Voice primer ([CONTEXT] block injected once the call connects) ──
  const pendingVoicePrimerRef = useRef<string | null>(null);
  const voicePrimerSentRef = useRef(false);

  // Build the primer from `initialContext` when entering voice mode.
  useEffect(() => {
    if (!isOpen || mode !== "voice" || !initialContext) return;
    const term = initialContext.conceptTerm?.trim();
    if (!term) return;
    if (pendingVoicePrimerRef.current || voicePrimerSentRef.current) return;
    const def = initialContext.conceptDef?.trim();
    const summaryRef =
      initialContext.summaryId != null
        ? language === "fr"
          ? `\nAnalyse associée: #${initialContext.summaryId}`
          : `\nLinked analysis: #${initialContext.summaryId}`
        : "";
    pendingVoicePrimerRef.current =
      language === "fr"
        ? `[CONTEXT] L'utilisateur souhaite revenir sur le concept: « ${term} »${
            def ? `\nDéfinition courte: ${def}` : ""
          }${summaryRef}\nAttaque directement avec une question ouverte sur ce concept.`
        : `[CONTEXT] The user wants to revisit the concept: "${term}"${
            def ? `\nShort definition: ${def}` : ""
          }${summaryRef}\nOpen with a direct question about this concept.`;
  }, [isOpen, mode, initialContext, language]);

  // Auto-start the voice call when entering voice mode (status check avoids
  // retriggering on every render).
  const startVoice = voice.start;
  const stopVoice = voice.stop;
  const voiceStatus = voice.status;
  useEffect(() => {
    if (!isOpen) return;
    if (mode !== "voice") return;
    if (voiceStatus !== "idle") return;
    void startVoice();
  }, [isOpen, mode, voiceStatus, startVoice]);

  // Stop the voice call when leaving voice mode or closing the hub.
  useEffect(() => {
    if (!isOpen && voiceStatus !== "idle") {
      void stopVoice();
      return;
    }
    if (isOpen && mode === "text" && voiceStatus !== "idle") {
      void stopVoice();
    }
  }, [isOpen, mode, voiceStatus, stopVoice]);

  // Fire the pending voice primer once the call is active.
  const sendUserMessage = voice.sendUserMessage;
  useEffect(() => {
    if (!isOpen || mode !== "voice") return;
    const primer = pendingVoicePrimerRef.current;
    if (!primer || voicePrimerSentRef.current) return;
    if (voiceStatus !== "listening" && voiceStatus !== "speaking") return;
    sendUserMessage(primer);
    voicePrimerSentRef.current = true;
    pendingVoicePrimerRef.current = null;
  }, [isOpen, mode, voiceStatus, sendUserMessage]);

  // Reset mode + primer flags when the hub is freshly opened.
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      pendingVoicePrimerRef.current = null;
      voicePrimerSentRef.current = false;
    }
  }, [isOpen, defaultMode]);

  // In text mode, auto-start a session when an initialContext is supplied
  // (concept du jour amorce). We only start once.
  const initialContextStartedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      initialContextStartedRef.current = false;
      return;
    }
    if (mode !== "text") return;
    if (!initialContext) return;
    if (initialContextStartedRef.current) return;
    if (tutorPhase === "mini-chat") return;
    const term = initialContext.conceptTerm?.trim();
    if (!term) return;
    initialContextStartedRef.current = true;
    void startSession({
      concept_term: term,
      concept_def: initialContext.conceptDef ?? "",
      summary_id: initialContext.summaryId ?? undefined,
      mode: "text",
      lang: language,
    });
  }, [isOpen, mode, initialContext, tutorPhase, startSession, language]);

  // Mode switch with confirm if a text conversation is already in progress.
  const handleModeChange = useCallback(
    async (next: HubMode) => {
      if (next === mode) return;
      // Voice → text: just stop the call. Transcript stays in the timeline.
      if (next === "text") {
        if (voiceStatus !== "idle") {
          try {
            await stopVoice();
          } catch {
            /* ignore */
          }
        }
        setMode("text");
        return;
      }
      // Text → voice: ending the text session is destructive (deletes the
      // Redis session). Confirm with the user before tearing it down.
      const hasTextMessages = tutorMessages.length > 0;
      if (hasTextMessages) {
        const ok =
          typeof window !== "undefined" && window.confirm
            ? window.confirm(t.switchConfirm)
            : true;
        if (!ok) return;
        pendingVoicePrimerRef.current = buildSwitchContextBlock(
          language,
          tutorConceptTerm,
          tutorMessages.map((m) => ({ role: m.role, content: m.content })),
        );
      } else if (initialContext?.conceptTerm) {
        const term = initialContext.conceptTerm.trim();
        pendingVoicePrimerRef.current =
          language === "fr"
            ? `[CONTEXT] L'utilisateur souhaite revenir sur le concept: « ${term} ». Attaque directement avec une question ouverte.`
            : `[CONTEXT] The user wants to revisit the concept: "${term}". Open with a direct question.`;
      }
      voicePrimerSentRef.current = false;
      if (tutorPhase === "mini-chat") {
        try {
          // Keep the local transcript so the user still sees what they
          // discussed in text mode. The backend Redis session is torn down
          // (concept may change for the voice agent), but the visible
          // timeline remains — that's the whole point of the unified hub.
          await endSession({ keepMessages: true });
        } catch {
          /* ignore */
        }
      }
      setMode("voice");
    },
    [
      mode,
      tutorMessages,
      tutorPhase,
      tutorConceptTerm,
      voiceStatus,
      stopVoice,
      endSession,
      t.switchConfirm,
      language,
      initialContext,
    ],
  );

  const handleClose = useCallback(async () => {
    if (voiceStatus !== "idle") {
      try {
        await stopVoice();
      } catch {
        /* ignore */
      }
    }
    if (tutorPhase === "mini-chat") {
      try {
        await endSession();
      } catch {
        /* ignore */
      }
    }
    onClose();
  }, [voiceStatus, stopVoice, tutorPhase, endSession, onClose]);

  // ── Text-mode input state ──
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && mode === "text") {
      inputRef.current?.focus();
    }
  }, [isOpen, mode]);

  // Scroll to bottom whenever the timeline grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [timeline.length]);

  const handleSubmitText = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const value = input.trim();
      if (!value || tutorLoading) return;
      if (tutorPhase !== "mini-chat") {
        await startSession({
          concept_term: value,
          concept_def: "",
          mode: "text",
          lang: language,
        });
        setInput("");
        return;
      }
      await submitTextTurn(value);
      setInput("");
    },
    [
      input,
      tutorLoading,
      tutorPhase,
      startSession,
      submitTextTurn,
      language,
    ],
  );

  // Status string for the voice mode strip.
  const voiceIsSpeaking = voice.isSpeaking;
  const voiceStatusLabel = useMemo(() => {
    switch (voiceStatus) {
      case "connecting":
        return t.voiceConnecting;
      case "listening":
        return voiceIsSpeaking ? t.voiceSpeaking : t.voiceListening;
      case "thinking":
        return t.voiceThinking;
      case "speaking":
        return t.voiceSpeaking;
      case "quota_exceeded":
        return t.voiceQuotaExceeded;
      case "error":
        return t.voiceError;
      case "idle":
      default:
        return t.voiceStart;
    }
  }, [voiceStatus, voiceIsSpeaking, t]);

  if (!isOpen) return null;

  const subtitle = mode === "text" ? t.subtitleText : t.subtitleVoice;
  const isCallActive =
    voiceStatus === "connecting" ||
    voiceStatus === "listening" ||
    voiceStatus === "thinking" ||
    voiceStatus === "speaking";

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  const node = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="tutor-hub"
          role="dialog"
          aria-label={t.title}
          data-testid="tutor-hub"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 32 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed top-0 right-0 h-screen w-full sm:w-[420px] max-w-[100vw] flex flex-col bg-[#0c0c14]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-hidden"
          style={{ zIndex: 1000 }}
        >
          {/* ── Header ── */}
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-violet-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate leading-tight">
                  {t.title}
                </p>
                <p className="text-[11px] text-text-muted truncate">
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t.close}
              data-testid="tutor-hub-close"
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* ── Mode toggle (controls the input zone only) ── */}
          <div
            className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04] flex-shrink-0"
            role="tablist"
            aria-label={t.title}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "text"}
              data-testid="tutor-hub-mode-text"
              onClick={() => {
                void handleModeChange("text");
              }}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === "text"
                  ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                  : "bg-white/[0.04] text-white/55 hover:text-white/85 border border-white/[0.08]"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {t.modeText}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "voice"}
              data-testid="tutor-hub-mode-voice"
              onClick={() => {
                void handleModeChange("voice");
              }}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === "voice"
                  ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                  : "bg-white/[0.04] text-white/55 hover:text-white/85 border border-white/[0.08]"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              {t.modeVoice}
            </button>
          </div>

          {/* ── Unified timeline (text + voice transcripts) ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0"
            data-testid="tutor-hub-text-transcript"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.05) transparent",
            }}
          >
            {timeline.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-xs text-text-tertiary leading-relaxed max-w-[260px]">
                  {t.emptyHint}
                </p>
              </div>
            ) : (
              timeline.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-snug ${
                      msg.role === "user"
                        ? "bg-blue-600/70 text-white rounded-br-sm"
                        : "bg-white/[0.05] text-white/75 rounded-bl-sm"
                    }`}
                  >
                    {msg.modality === "voice" && (
                      <Mic
                        className={`inline-block w-3 h-3 mr-1 align-text-bottom ${
                          msg.role === "user"
                            ? "text-white/80"
                            : "text-violet-300/80"
                        }`}
                        aria-label="voice"
                      />
                    )}
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {tutorLoading && mode === "text" && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl bg-white/[0.04] text-text-tertiary text-[12px] italic">
                  {t.loading}
                </div>
              </div>
            )}
          </div>

          {/* ── Input zone (switches between Text and Voice modes) ── */}
          {mode === "text" ? (
            <form
              onSubmit={handleSubmitText}
              className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0a0a0f]/80 flex-shrink-0"
              data-testid="tutor-hub-text-form"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.inputPlaceholder}
                disabled={tutorLoading}
                data-testid="tutor-hub-text-input"
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-violet-400/40 cursor-text"
              />
              <button
                type="submit"
                disabled={!input.trim() || tutorLoading}
                data-testid="tutor-hub-text-send"
                aria-label={t.send}
                className="p-2 rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-violet-500/30"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div
              className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0a0a0f]/80 flex-shrink-0"
              data-testid="tutor-hub-voice-pane"
            >
              {/* Status indicator */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isCallActive
                      ? voiceIsSpeaking
                        ? "bg-violet-400 animate-pulse"
                        : "bg-emerald-400 animate-pulse"
                      : voiceStatus === "error" ||
                          voiceStatus === "quota_exceeded"
                        ? "bg-red-400"
                        : "bg-white/30"
                  }`}
                  aria-hidden
                />
                <span
                  className="text-[11px] text-text-muted truncate"
                  data-testid="tutor-hub-voice-status"
                >
                  {voiceStatusLabel}
                </span>
              </div>

              {/* Mic mute toggle (only while call is active) */}
              {isCallActive && (
                <button
                  type="button"
                  onClick={voice.toggleMute}
                  aria-label={voice.isMuted ? t.voiceMuteOff : t.voiceMuteOn}
                  data-testid="tutor-hub-voice-mute"
                  className={`p-2 rounded-md transition-colors border ${
                    voice.isMuted
                      ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
                      : "bg-white/[0.04] text-white/70 border-white/[0.08] hover:bg-white/[0.08]"
                  }`}
                >
                  {voice.isMuted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {/* Start / Hang up button */}
              {isCallActive ? (
                <button
                  type="button"
                  onClick={() => {
                    void stopVoice();
                  }}
                  aria-label={t.voiceHangup}
                  data-testid="tutor-hub-voice-hangup"
                  className="p-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void startVoice();
                  }}
                  disabled={
                    voiceStatus === "quota_exceeded" ||
                    voiceStatus === "connecting"
                  }
                  aria-label={t.voiceStart}
                  data-testid="tutor-hub-voice-start"
                  className="p-2 rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-500/30 transition-colors"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined" || !document.body) {
    return node;
  }
  return createPortal(node, document.body);
};

export default TutorHub;
