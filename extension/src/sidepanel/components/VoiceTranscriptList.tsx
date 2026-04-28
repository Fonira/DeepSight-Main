// extension/src/sidepanel/components/VoiceTranscriptList.tsx
//
// Quick Voice Call (V1.1) — Liste chat-style des transcripts vocaux.
//
// Affiche en temps réel les bulles user (👤, alignées à droite) et agent
// (🤖, alignées à gauche) collectées par `useExtensionVoiceChat` via le
// callback `onMessage` du SDK ElevenLabs.
//
// Features :
//   - Zone scrollable verticale (max-height ~280px)
//   - Auto-scroll vers le bas à chaque nouveau message
//   - Empty state quand aucun transcript n'a encore été reçu
//   - A11y : role="log" + aria-live="polite" pour annonces lecteur d'écran
//
// Le composant est délibérément display-only — pas d'input texte (V1.2).
import React, { useEffect, useRef } from "react";
import type { VoiceTranscript } from "../types";

interface Props {
  transcripts: VoiceTranscript[];
}

export function VoiceTranscriptList({ transcripts }: Props): JSX.Element {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll vers le bas dès qu'un nouveau transcript arrive.
  // On déclenche sur la longueur (un nouveau push augmente toujours length).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcripts.length]);

  if (transcripts.length === 0) {
    return (
      <div
        className="ds-voice-transcript-list ds-voice-transcript-list--empty"
        role="log"
        aria-live="polite"
        aria-label="Transcription de l'appel"
      >
        <p className="ds-voice-transcript-empty">
          L'agent commence à écouter… Pose ta première question.
        </p>
      </div>
    );
  }

  return (
    <div
      className="ds-voice-transcript-list"
      role="log"
      aria-live="polite"
      aria-label="Transcription de l'appel"
    >
      {transcripts.map((msg, idx) => {
        const isUser = msg.speaker === "user";
        return (
          <div
            key={`${msg.ts}-${idx}`}
            className={`ds-voice-transcript-msg ds-voice-transcript-msg--${
              isUser ? "user" : "agent"
            }`}
            data-testid={`voice-transcript-${msg.speaker}`}
          >
            <span className="ds-voice-transcript-msg__icon" aria-hidden>
              {isUser ? "👤" : "🤖"}
            </span>
            <span className="ds-voice-transcript-msg__content">
              {msg.content}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} data-testid="voice-transcript-bottom" />
    </div>
  );
}
