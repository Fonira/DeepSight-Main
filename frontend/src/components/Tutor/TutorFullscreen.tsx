// frontend/src/components/Tutor/TutorFullscreen.tsx
//
// Vue plein écran de la conv Tuteur, rendue depuis HubPage quand l'URL
// porte `?fsChat=tutor` (V2 — mai 2026). Lit le state depuis le store
// Zustand `useTutorStore` pour partager la session avec la popup
// flottante.

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Send, X } from "lucide-react";
import { useTutorStore } from "../../store/tutorStore";
import { useLanguage } from "../../contexts/LanguageContext";

const stopPropagation = (e: React.PointerEvent | React.MouseEvent) => {
  e.stopPropagation();
};

export const TutorFullscreen: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const phase = useTutorStore((s) => s.phase);
  const messages = useTutorStore((s) => s.messages);
  const conceptTerm = useTutorStore((s) => s.conceptTerm);
  const loading = useTutorStore((s) => s.loading);
  const submitTextTurn = useTutorStore((s) => s.submitTextTurn);
  const endSession = useTutorStore((s) => s.endSession);
  const setFullscreen = useTutorStore((s) => s.setFullscreen);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const titleLabel = conceptTerm ?? (language === "fr" ? "Le Tuteur" : "Tutor");
  const backLabel =
    language === "fr" ? "Retour à la popup" : "Back to popup";
  const closeLabel = language === "fr" ? "Terminer" : "End";
  const placeholder =
    language === "fr" ? "Tapez votre réponse..." : "Type your answer...";
  const emptyHint =
    language === "fr"
      ? "Démarrez une session depuis la popup pour discuter ici."
      : "Start a session from the popup to chat here.";

  const handleBack = () => {
    setFullscreen(false);
    navigate("/hub");
  };

  const handleEnd = async () => {
    await endSession();
    setFullscreen(false);
    navigate("/hub");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      void submitTextTurn(input.trim());
      setInput("");
    }
  };

  return (
    <div
      role="dialog"
      aria-label={titleLabel}
      className="min-h-screen flex flex-col bg-[#0a0a0f] text-text-primary"
      data-testid="tutor-fullscreen"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label={backLabel}
            title={backLabel}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
            data-testid="tutor-fullscreen-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-base font-semibold text-text-primary truncate leading-tight">
              {titleLabel}
            </p>
            <p className="text-xs text-text-muted">
              {language === "fr" ? "Le Tuteur" : "The Tutor"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          aria-label={closeLabel}
          title={closeLabel}
          className="p-1.5 rounded-lg hover:bg-red-500/15 text-text-muted hover:text-red-300 transition-colors"
          data-testid="tutor-fullscreen-end"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full"
      >
        {phase !== "mini-chat" || messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <p className="text-sm text-text-tertiary leading-relaxed max-w-md">
              {emptyHint}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg, idx) => (
              <li
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "assistant"
                      ? "bg-accent-primary/10 text-text-secondary border border-accent-primary/20"
                      : "bg-indigo-500/15 text-text-primary border border-indigo-500/25"
                  }`}
                >
                  {msg.content}
                </div>
              </li>
            ))}
            {loading && (
              <li className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-accent-primary/5 text-text-tertiary text-sm italic">
                  …
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Footer */}
      <form
        onSubmit={handleSubmit}
        onPointerDown={stopPropagation}
        className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0a0a0f]/80 max-w-3xl mx-auto w-full"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={loading || phase !== "mini-chat"}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || phase !== "mini-chat"}
          className="p-2 rounded-lg bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-accent-primary/30"
          aria-label={language === "fr" ? "Envoyer" : "Send"}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default TutorFullscreen;
