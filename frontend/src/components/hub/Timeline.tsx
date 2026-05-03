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
  /**
   * True si la Timeline est dans l'onglet Chat actif (F3). L'empty state
   * "Posez votre première question" est rendu UNIQUEMENT dans ce cas.
   * Sinon, retourne null (le HubPage n'affiche pas la Timeline quand
   * activeTab !== "chat", mais on garde la guard pour défense en
   * profondeur en cas de réutilisation future).
   *
   * Default: true (rétrocompat avec usages legacy hors HubPage).
   */
  isActiveTab?: boolean;
}

export const Timeline: React.FC<Props> = ({
  messages,
  isThinking,
  onQuestionClick,
  isActiveTab = true,
}) => {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const lastBubbleRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // F14 — scroll vers le NOUVEAU bubble user/assistant (pas vers endRef du
  // conteneur, qui causait des sauts au milieu de la synthèse dans l'ancien
  // layout single-scroll).
  useEffect(() => {
    const newest = sorted[sorted.length - 1];
    if (!newest) return;
    if (newest.id === lastIdRef.current) return;
    lastIdRef.current = newest.id;
    if (typeof lastBubbleRef.current?.scrollIntoView === "function") {
      lastBubbleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [sorted]);

  if (sorted.length === 0 && !isThinking) {
    if (!isActiveTab) {
      return null;
    }
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-sm text-center">
          <Sparkles className="w-10 h-10 text-white/40 mx-auto mb-3" />
          <p className="text-base text-white/95 font-medium mb-1.5">
            Posez votre première question
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            L'agent connaît le contexte de la vidéo. Tapez votre question,
            maintenez le micro pour une note vocale, ou cliquez sur 📞 pour
            passer en appel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {sorted.map((msg, i) => (
          <div
            key={msg.id}
            ref={i === sorted.length - 1 ? lastBubbleRef : undefined}
          >
            <MessageBubble msg={msg} onQuestionClick={onQuestionClick} />
          </div>
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
      </div>
    </div>
  );
};
