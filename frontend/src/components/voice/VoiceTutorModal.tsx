/**
 * VoiceTutorModal — Knowledge Tutor voice session entry point.
 *
 * Thin wrapper around `VoiceOverlay` specialized for the `knowledge_tutor`
 * agent. Used by:
 *   - Sidebar "Tuteur Vocal" item (no concept context)
 *   - TutorMiniChat header button "Tuteur Vocal" (concept context as primer)
 *
 * The agent does NOT require a summary (`requires_summary=False` in
 * backend/src/voice/agent_types.py KNOWLEDGE_TUTOR). When a concept is
 * provided, we inject it via `sendUserMessage` shortly after onConnect so the
 * agent can pick up the topic immediately. When no concept is provided, the
 * agent begins with its default first message and queries the user's history
 * via its tools (get_concept_keys, get_user_history).
 *
 * Floating presentation (380×600 bottom-right) is reused from VoiceOverlay
 * for consistency with COMPANION mode launched from the chat page.
 */

import React, { useEffect, useRef } from "react";
import {
  VoiceOverlay,
  type VoiceOverlayController,
} from "./VoiceOverlay";

export interface VoiceTutorModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Close callback — also stops the voice session. */
  onClose: () => void;
  /** Optional UI language. Defaults to "fr". */
  language?: "fr" | "en";
  /**
   * Optional concept context passed as a primer to the agent.
   * When provided, the modal injects a `[CONTEXT]` block via
   * `sendUserMessage` shortly after the call connects so the agent
   * immediately knows what concept the user is reviewing.
   */
  initialContext?: {
    conceptTerm: string;
    /** Optional Summary id — gives the agent a deeper hook. */
    summaryId?: number | null;
    /** Optional brief definition to inline. */
    conceptDef?: string | null;
  } | null;
}

const TITLE_FR = "Tuteur Vocal";
const TITLE_EN = "Voice Tutor";
const SUBTITLE_FR = "Révisez vos analyses à voix haute";
const SUBTITLE_EN = "Review your analyses out loud";

export const VoiceTutorModal: React.FC<VoiceTutorModalProps> = ({
  isOpen,
  onClose,
  language = "fr",
  initialContext,
}) => {
  const controllerRef = useRef<VoiceOverlayController | null>(null);
  const primerSentRef = useRef(false);

  // Reset the primer flag when the modal closes so it fires again on reopen.
  useEffect(() => {
    if (!isOpen) {
      primerSentRef.current = false;
    }
  }, [isOpen]);

  // When the call becomes active and a concept primer is configured, inject
  // a [CONTEXT] block exactly once. The agent's system prompt instructs it
  // to honor [CONTEXT] blocks as orienting hints.
  useEffect(() => {
    if (!isOpen || !initialContext || primerSentRef.current) return;
    const controller = controllerRef.current;
    if (!controller || !controller.isActive) return;

    const term = initialContext.conceptTerm.trim();
    if (!term) return;

    const def = initialContext.conceptDef?.trim();
    const summaryRef =
      initialContext.summaryId != null
        ? language === "fr"
          ? `\nAnalyse associée: #${initialContext.summaryId}`
          : `\nLinked analysis: #${initialContext.summaryId}`
        : "";

    const primer =
      language === "fr"
        ? `[CONTEXT] L'utilisateur souhaite revenir sur le concept: « ${term} »${
            def ? `\nDéfinition courte: ${def}` : ""
          }${summaryRef}\nAttaque directement avec une question ouverte sur ce concept.`
        : `[CONTEXT] The user wants to revisit the concept: "${term}"${
            def ? `\nShort definition: ${def}` : ""
          }${summaryRef}\nOpen with a direct question about this concept.`;

    controller.sendUserMessage(primer);
    primerSentRef.current = true;
  });

  return (
    <VoiceOverlay
      isOpen={isOpen}
      onClose={onClose}
      title={language === "fr" ? TITLE_FR : TITLE_EN}
      subtitle={language === "fr" ? SUBTITLE_FR : SUBTITLE_EN}
      summaryId={null}
      agentType="knowledge_tutor"
      language={language}
      controllerRef={controllerRef}
      autoStart
      presentationMode="floating"
    />
  );
};

export default VoiceTutorModal;
