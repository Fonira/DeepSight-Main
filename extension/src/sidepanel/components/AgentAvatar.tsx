// extension/src/sidepanel/components/AgentAvatar.tsx
//
// Avatar circulaire de l'agent ElevenLabs affiché dans le header in-call.
// Montre :
//   - L'initiale du voice_name (ex: "C" pour Charlotte)
//   - Un halo pulsant violet quand l'agent parle (output volume > seuil)
//   - Un halo pulsant indigo quand l'utilisateur parle (input volume > seuil)
//   - Un état neutre sinon
//
// Détection speaking via `getInputVolume()` / `getOutputVolume()` du SDK
// 0.15+. Fallback gracieux si méthodes pas exposées (avatar statique).
import React, { useEffect, useRef, useState } from "react";

interface ConversationLike {
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}

interface Props {
  voiceName?: string;
  conversation: ConversationLike | null;
}

type SpeakingState = "idle" | "agent" | "user";

// Seuil empirique : la VoiceConversation expose un volume float [0, 1]
// (tonalité globale fenêtre courante). On considère "speaking" au-delà
// de 0.05 — assez bas pour réagir vite, assez haut pour ignorer le bruit
// de fond.
const SPEAKING_THRESHOLD = 0.05;

function getInitial(name: string | undefined): string {
  if (!name) return "🎙";
  const trimmed = name.trim();
  if (!trimmed) return "🎙";
  // Premier caractère imprimable (gère emojis multi-byte via Array.from).
  const first = Array.from(trimmed)[0];
  return first?.toUpperCase() ?? "🎙";
}

export function AgentAvatar({ voiceName, conversation }: Props): JSX.Element {
  const [speaking, setSpeaking] = useState<SpeakingState>("idle");
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!conversation) {
      setSpeaking("idle");
      return;
    }
    const hasInput = typeof conversation.getInputVolume === "function";
    const hasOutput = typeof conversation.getOutputVolume === "function";
    if (!hasInput && !hasOutput) return;

    // Polling 15 fps suffit pour la pulsation d'un halo (transitions CSS
    // 200 ms compensent toute latence visuelle).
    const tick = (ts: number): void => {
      if (ts - lastFrameRef.current < 66) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameRef.current = ts;
      const inputVol = hasInput ? conversation.getInputVolume?.() ?? 0 : 0;
      const outputVol = hasOutput ? conversation.getOutputVolume?.() ?? 0 : 0;

      // L'agent prime sur l'utilisateur : si les deux parlent, c'est le plus
      // "fort" qui gagne (généralement l'output agent puisque le user parle
      // plus fort dans le micro mais ça dépend du gain).
      let next: SpeakingState = "idle";
      if (outputVol >= SPEAKING_THRESHOLD && outputVol >= inputVol) {
        next = "agent";
      } else if (inputVol >= SPEAKING_THRESHOLD) {
        next = "user";
      }
      setSpeaking((prev) => (prev === next ? prev : next));
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [conversation]);

  const initial = getInitial(voiceName);
  const stateClass = `is-${speaking}`;
  const ariaLabel =
    speaking === "agent"
      ? `Agent ${voiceName ?? "vocal"} parle`
      : speaking === "user"
        ? "Vous parlez"
        : `Agent ${voiceName ?? "vocal"} en écoute`;

  return (
    <div
      className={`ds-agent-avatar ${stateClass}`}
      role="img"
      aria-label={ariaLabel}
      data-testid="ds-agent-avatar"
      data-state={speaking}
    >
      <span className="ds-agent-avatar__halo" aria-hidden />
      <span className="ds-agent-avatar__circle">
        <span className="ds-agent-avatar__initial">{initial}</span>
      </span>
    </div>
  );
}
