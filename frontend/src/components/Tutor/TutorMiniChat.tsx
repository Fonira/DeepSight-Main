import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import type { TutorTurn } from "../../types/tutor";

interface TutorMiniChatProps {
  conceptTerm: string;
  messages: TutorTurn[];
  loading: boolean;
  onSubmit: (input: string) => void;
  onClose: () => void;
}

export const TutorMiniChat: React.FC<TutorMiniChatProps> = ({
  conceptTerm,
  messages,
  loading,
  onSubmit,
  onClose,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tt = t.tutor;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="z-40 w-[280px] h-[400px] rounded-2xl border border-accent-primary/30 bg-bg-secondary/98 backdrop-blur-xl shadow-2xl shadow-black/50 flex flex-col"
      role="dialog"
      aria-label={tt.title}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="font-display text-sm font-semibold text-text-primary leading-tight truncate">
          {conceptTerm}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-red-400 p-1 transition-colors"
            aria-label={tt.mini_chat.close}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
              msg.role === "assistant"
                ? "bg-accent-primary/10 text-text-secondary self-start max-w-[85%]"
                : "bg-indigo-500/15 text-text-primary self-end max-w-[85%] ml-auto"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="px-3 py-2 rounded-lg bg-accent-primary/5 text-text-tertiary text-xs italic max-w-[85%]">
            …
          </div>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 p-2 border-t border-white/5"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tt.mini_chat.input_placeholder}
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-1.5 rounded-md bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-accent-primary/30"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </motion.div>
  );
};
