import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Type } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import type { TutorTurn } from "../../types/tutor";

interface TutorDeepSessionProps {
  conceptTerm: string;
  messages: TutorTurn[];
  loading: boolean;
  mode: "text" | "voice";
  audioUrl?: string | null;
  onSubmit: (input: string) => void;
  onSwitchToText: () => void;
  onClose: () => void;
}

export const TutorDeepSession: React.FC<TutorDeepSessionProps> = ({
  conceptTerm,
  messages,
  loading,
  mode,
  audioUrl,
  onSubmit,
  onSwitchToText,
  onClose,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [textInputVisible, setTextInputVisible] = useState(mode === "text");
  const [elapsedSec, setElapsedSec] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tt = t.tutor;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (textInputVisible) inputRef.current?.focus();
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
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
          className="relative w-full max-w-2xl h-[80vh] rounded-3xl border border-accent-primary/25 bg-bg-secondary/98 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
        >
          {audioUrl && (
            <audio
              key={audioUrl}
              src={audioUrl}
              autoPlay
              style={{ display: "none" }}
            />
          )}

          <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-accent-primary font-semibold">
                {mode === "voice" ? "Session vocale" : "Session texte"}
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
                aria-label={tt.deep_session.end}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {mode === "voice" && !textInputVisible && (
            <div className="flex-1 flex items-center justify-center relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.4, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-32 h-32 rounded-full bg-gradient-radial from-accent-primary/40 to-transparent flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-accent-primary/80" />
              </motion.div>
              <p className="absolute bottom-32 text-text-tertiary text-sm italic">
                Mode voix V1.1 — utilise le bouton "
                {tt.deep_session.switch_to_text}" en attendant.
              </p>
            </div>
          )}

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
                placeholder={tt.mini_chat.input_placeholder}
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-accent-primary/30"
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
                {tt.deep_session.switch_to_text}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors border border-red-500/20"
            >
              {tt.deep_session.end}
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
