// frontend/src/components/hub/Timeline.tsx
import React, { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { HubMessage } from "./types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: HubMessage[];
  /** When true, displays a "thinking" dots placeholder at the end. */
  isThinking?: boolean;
  /** Click handler for inline `[ask:...]` followups in assistant messages. */
  onQuestionClick?: (question: string) => void;
}

export const Timeline: React.FC<Props> = ({
  messages,
  isThinking,
  onQuestionClick,
}) => {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // jsdom (used by vitest) does not implement scrollIntoView — guard it.
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sorted.length, isThinking]);

  if (sorted.length === 0 && !isThinking) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="max-w-sm mx-auto">
          <Sparkles className="w-10 h-10 text-white/40 mx-auto mb-3" />
          <p className="text-base text-white/95 font-medium mb-1.5">
            Posez votre première question
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            Tapez votre question, maintenez le micro pour une note vocale, ou
            cliquez sur 📞 pour passer en appel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {sorted.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onQuestionClick={onQuestionClick}
          />
        ))}
        {isThinking && (
          <div className="flex justify-start" aria-live="polite">
            <div className="px-4 py-3 rounded-2xl border border-white/10 bg-white/5 inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
              <span className="text-xs text-white/65 ml-1">Réflexion…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};
