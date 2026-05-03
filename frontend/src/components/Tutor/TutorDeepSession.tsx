/**
 * 🎓 TutorDeepSession — Modal fullscreen V1.0 (texte uniquement).
 *
 * Phase `deep-session` du composant Tutor. Fullscreen avec :
 *  - Header : mode + concept + chrono + close button.
 *  - Mode "voice" : orb pulsante visuelle (STT/TTS reportés à V1.1).
 *  - Transcript des messages.
 *  - Input texte (toujours actif en V1.0, même en mode voice).
 *  - Footer : "Passer au texte" (si voice) + "Fin".
 *
 * Esc → onClose() (déclenche endSession).
 *
 * Note V1.0 : l'orb pulsante est PUREMENT visuelle.
 * Le pipeline Voxtral STT + ElevenLabs TTS est V1.1 (cf. spec).
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Type } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import type { TutorMessage, TutorSessionMode } from "../../types/tutor";

interface TutorDeepSessionProps {
  conceptTerm: string;
  messages: TutorMessage[];
  loading: boolean;
  mode: TutorSessionMode;
  onSubmit: (input: string) => void;
  onSwitchToText: () => void;
  onClose: () => void;
}

const COPY = {
  fr: {
    voice_label: "Session vocale",
    text_label: "Session texte",
    end: "Fin",
    switch_to_text: "Passer au texte",
    input_placeholder: "Votre réponse…",
    voice_v1_hint:
      "Mode voix V1.1 — utilise le bouton ci-dessous pour répondre par texte en attendant.",
  },
  en: {
    voice_label: "Voice session",
    text_label: "Text session",
    end: "End",
    switch_to_text: "Switch to text",
    input_placeholder: "Your reply…",
    voice_v1_hint:
      "Voice mode V1.1 — use the button below to reply with text in the meantime.",
  },
};

export const TutorDeepSession: React.FC<TutorDeepSessionProps> = ({
  conceptTerm,
  messages,
  loading,
  mode,
  onSubmit,
  onSwitchToText,
  onClose,
}) => {
  const { language } = useLanguage();
  const tt = COPY[language === "fr" ? "fr" : "en"];

  const [input, setInput] = useState("");
  // V1.0 : input texte toujours visible (mode voice = orb visuelle, pas de STT live).
  const [textInputVisible, setTextInputVisible] = useState(mode === "text");
  const [elapsedSec, setElapsedSec] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chrono
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Esc → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-scroll + focus
  useEffect(() => {
    if (textInputVisible) inputRef.current?.focus();
    // jsdom (tests) ne définit pas scrollTo — guard nécessaire.
    if (scrollRef.current && typeof scrollRef.current.scrollTo === "function") {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [textInputVisible, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  const handleSwitchText = () => {
    setTextInputVisible(true);
    onSwitchToText();
  };

  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-2xl h-[80vh] rounded-3xl border border-accent-primary/25 bg-bg-secondary/95 backdrop-blur-xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
        >
          <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-accent-primary font-semibold">
                {mode === "voice" ? tt.voice_label : tt.text_label}
              </span>
              <span className="font-display text-xl font-semibold text-text-primary mt-0.5">
                {conceptTerm}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary tabular-nums">
                {formatElapsed(elapsedSec)}
              </span>
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-red-400 p-1.5 transition-colors"
                aria-label={tt.end}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {mode === "voice" && !textInputVisible && (
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.4, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-32 h-32 rounded-full bg-accent-primary/30 flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-accent-primary/80" />
              </motion.div>
              <p className="absolute bottom-8 px-6 text-center text-text-tertiary text-sm italic">
                {tt.voice_v1_hint}
              </p>
            </div>
          )}

          {(mode === "text" || textInputVisible) && (
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
            >
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[75%] ${
                    msg.role === "assistant"
                      ? "bg-accent-primary/10 text-text-secondary self-start"
                      : "bg-indigo-500/20 text-text-primary self-end ml-auto"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div className="px-4 py-3 rounded-2xl bg-accent-primary/5 text-text-tertiary text-sm italic max-w-[75%]">
                  …
                </div>
              )}
            </div>
          )}

          {textInputVisible && (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-6 py-4 border-t border-white/5"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tt.input_placeholder}
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-accent-primary/30"
                aria-label={tt.input_placeholder}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          <footer className="flex justify-center gap-2 px-6 py-3 border-t border-white/5 bg-bg-tertiary/50">
            {mode === "voice" && !textInputVisible && (
              <button
                onClick={handleSwitchText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-medium transition-colors border border-white/10"
              >
                <Type className="w-3.5 h-3.5" />
                {tt.switch_to_text}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors border border-red-500/20"
            >
              {tt.end}
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TutorDeepSession;
