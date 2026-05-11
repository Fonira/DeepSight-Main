/**
 * TutorHub — Unified text/voice tutor hub (2026-05-11).
 *
 * Single full-height right panel that hosts BOTH the text-mode mini-chat
 * (Magistral via `/api/tutor/session/*`) and the voice-mode call
 * (`VoiceOverlay` with `agentType="knowledge_tutor"`). Replaces the
 * previous split between `TutorMiniChat` (text popup) and
 * `VoiceTutorModal` (voice modal) — one container, one mode toggle.
 *
 * Entry points:
 *   - Sidebar item "Tuteur" → opens with `defaultMode="text"`, no primer.
 *   - Teaser `TutorIdle` (concept du jour) → opens with `defaultMode="text"`,
 *     `initialContext = { conceptTerm, conceptDef?, summaryId? }`.
 *
 * Mode switch:
 *   - No messages yet → switch direct.
 *   - Messages exist → `window.confirm` then restart (text session ends,
 *     voice gets a `[CONTEXT]` block summarizing the previous text conv).
 *
 * Spec: docs/superpowers/specs/2026-05-11-tuteur-unified-hub.md
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { MessageCircle, Mic, Send, X } from "lucide-react";
import { LanguageContext } from "../../contexts/LanguageContext";
import { useTutor } from "./useTutor";
import { VoiceOverlay } from "../voice/VoiceOverlay";
import type { VoiceOverlayController } from "../voice/VoiceOverlay";

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

const I18N = {
  fr: {
    title: "Tuteur",
    subtitleText: "Révisez vos analyses",
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
      "Changer de mode redémarrera la conversation. Continuer ?",
  },
  en: {
    title: "Tutor",
    subtitleText: "Review your analyses",
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
      "Switching modes will restart the conversation. Continue?",
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

  const tutor = useTutor();
  const [mode, setMode] = useState<HubMode>(defaultMode);

  // Pending primer to inject after voice connect (used by switch text → voice
  // when we want to carry the previous text exchanges into the voice agent).
  const pendingVoicePrimerRef = useRef<string | null>(null);
  const voiceControllerRef = useRef<VoiceOverlayController | null>(null);
  const voicePrimerSentRef = useRef(false);

  // Reset mode + primer when the hub opens fresh.
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      pendingVoicePrimerRef.current = null;
      voicePrimerSentRef.current = false;
    }
  }, [isOpen, defaultMode]);

  // Build the voice primer when an `initialContext` is supplied directly (i.e.
  // the hub is opened from the teaser with a concept du jour). The
  // VoiceTutorModal previously used this exact pattern.
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

  // Fire the pending voice primer once the call is active.
  useEffect(() => {
    if (!isOpen || mode !== "voice") return;
    const primer = pendingVoicePrimerRef.current;
    if (!primer || voicePrimerSentRef.current) return;
    const controller = voiceControllerRef.current;
    if (!controller || !controller.isActive) return;
    controller.sendUserMessage(primer);
    voicePrimerSentRef.current = true;
    pendingVoicePrimerRef.current = null;
  });

  // In text mode, auto-start a session when an initialContext is supplied
  // (concept du jour amorce). We only start once: if a session is already
  // active, we don't restart it.
  const initialContextStartedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      initialContextStartedRef.current = false;
      return;
    }
    if (mode !== "text") return;
    if (!initialContext) return;
    if (initialContextStartedRef.current) return;
    if (tutor.phase === "mini-chat") return;
    const term = initialContext.conceptTerm?.trim();
    if (!term) return;
    initialContextStartedRef.current = true;
    void tutor.startSession({
      concept_term: term,
      concept_def: initialContext.conceptDef ?? "",
      summary_id: initialContext.summaryId ?? undefined,
      mode: "text",
      lang: language,
    });
  }, [isOpen, mode, initialContext, tutor, language]);

  // Mode switch with confirm if a conversation is already in progress.
  const handleModeChange = useCallback(
    async (next: HubMode) => {
      if (next === mode) return;
      const hasMessages = tutor.messages.length > 0;
      if (hasMessages) {
        const ok =
          typeof window !== "undefined" && window.confirm
            ? window.confirm(t.switchConfirm)
            : true;
        if (!ok) return;
      }
      // Build a primer summarizing the text conv before tearing it down so
      // the voice agent can pick up where we left off.
      if (next === "voice" && hasMessages) {
        pendingVoicePrimerRef.current = buildSwitchContextBlock(
          language,
          tutor.conceptTerm,
          tutor.messages.map((m) => ({ role: m.role, content: m.content })),
        );
      } else if (next === "voice" && initialContext?.conceptTerm) {
        // No messages yet but we have an initialContext — keep primer alive.
        const term = initialContext.conceptTerm.trim();
        pendingVoicePrimerRef.current =
          language === "fr"
            ? `[CONTEXT] L'utilisateur souhaite revenir sur le concept: « ${term} ». Attaque directement avec une question ouverte.`
            : `[CONTEXT] The user wants to revisit the concept: "${term}". Open with a direct question.`;
      }
      voicePrimerSentRef.current = false;
      // Reset text session if active before switching to voice.
      if (tutor.phase === "mini-chat") {
        try {
          await tutor.endSession();
        } catch {
          /* ignore */
        }
      }
      setMode(next);
    },
    [mode, tutor, t.switchConfirm, language, initialContext],
  );

  const handleClose = useCallback(async () => {
    // End the text session if any. Voice session is stopped by VoiceOverlay.
    if (tutor.phase === "mini-chat") {
      try {
        await tutor.endSession();
      } catch {
        /* ignore */
      }
    }
    onClose();
  }, [tutor, onClose]);

  // ── Text mode local input state ──
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && mode === "text") {
      inputRef.current?.focus();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (mode !== "text") return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [tutor.messages, mode]);

  const handleSubmitText = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const value = input.trim();
      if (!value || tutor.loading) return;
      // If no session yet, start one. The user's message becomes the implicit
      // concept anchor — we use the input as a free-form concept term.
      if (tutor.phase !== "mini-chat") {
        await tutor.startSession({
          concept_term: value,
          concept_def: "",
          mode: "text",
          lang: language,
        });
        setInput("");
        return;
      }
      await tutor.submitTextTurn(value);
      setInput("");
    },
    [input, tutor, language],
  );

  if (!isOpen) return null;

  const subtitle = mode === "text" ? t.subtitleText : t.subtitleVoice;

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
                {mode === "voice" ? (
                  <Mic className="w-4 h-4 text-violet-300" />
                ) : (
                  <MessageCircle className="w-4 h-4 text-violet-300" />
                )}
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

          {/* ── Mode toggle ── */}
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

          {/* ── Body ── */}
          {mode === "text" ? (
            <>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
                data-testid="tutor-hub-text-transcript"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(255,255,255,0.05) transparent",
                }}
              >
                {tutor.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <p className="text-xs text-text-tertiary leading-relaxed max-w-[260px]">
                      {t.emptyHint}
                    </p>
                  </div>
                ) : (
                  tutor.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-snug ${
                          msg.role === "user"
                            ? "bg-blue-600/70 text-white rounded-br-sm"
                            : "bg-white/[0.05] text-white/75 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {tutor.loading && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-white/[0.04] text-text-tertiary text-[12px] italic">
                      {t.loading}
                    </div>
                  </div>
                )}
              </div>
              <form
                onSubmit={handleSubmitText}
                className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0a0a0f]/80 flex-shrink-0"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.inputPlaceholder}
                  disabled={tutor.loading}
                  data-testid="tutor-hub-text-input"
                  className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-violet-400/40 cursor-text"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || tutor.loading}
                  data-testid="tutor-hub-text-send"
                  aria-label={t.send}
                  className="p-2 rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-violet-500/30"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          ) : (
            // ── Voice mode: mount VoiceOverlay in fullbleed so it fills the
            //     hub container instead of floating bottom-right. ──
            <div
              className="flex-1 relative overflow-hidden"
              data-testid="tutor-hub-voice-pane"
            >
              <VoiceOverlay
                isOpen
                onClose={handleClose}
                title={t.title}
                subtitle={t.subtitleVoice}
                summaryId={null}
                agentType="knowledge_tutor"
                language={language}
                controllerRef={voiceControllerRef}
                autoStart
                presentationMode="fullbleed"
              />
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
