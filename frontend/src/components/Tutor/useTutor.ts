// frontend/src/components/Tutor/useTutor.ts
//
// Wrapper minimal autour de `useTutorStore` (Zustand) — Phase 2 V2 mai 2026.
//
// Préserve la signature historique du hook (`tutor.phase`, `tutor.messages`,
// `tutor.startSession(...)`, etc.) pour ne pas casser les composants
// `Tutor.tsx`, `TutorPrompting.tsx`, `TutorMiniChat.tsx`. La logique d'état
// est désormais portée par le store global afin que la conversation soit
// partagée entre la popup flottante et la vue plein écran dans le Hub.

import { useTutorStore, type StartSessionOpts } from "../../store/tutorStore";

export function useTutor() {
  const phase = useTutorStore((s) => s.phase);
  const sessionId = useTutorStore((s) => s.sessionId);
  const messages = useTutorStore((s) => s.messages);
  const conceptTerm = useTutorStore((s) => s.conceptTerm);
  const conceptDef = useTutorStore((s) => s.conceptDef);
  const summaryId = useTutorStore((s) => s.summaryId);
  const sourceVideoTitle = useTutorStore((s) => s.sourceVideoTitle);
  const lang = useTutorStore((s) => s.lang);
  const loading = useTutorStore((s) => s.loading);
  const error = useTutorStore((s) => s.error);
  const fullscreen = useTutorStore((s) => s.fullscreen);

  const openPrompting = useTutorStore((s) => s.openPrompting);
  const cancelPrompting = useTutorStore((s) => s.cancelPrompting);
  const startSession = useTutorStore((s) => s.startSession);
  const submitTextTurn = useTutorStore((s) => s.submitTextTurn);
  const endSession = useTutorStore((s) => s.endSession);
  const setFullscreen = useTutorStore((s) => s.setFullscreen);

  return {
    phase,
    sessionId,
    messages,
    conceptTerm,
    conceptDef,
    summaryId,
    sourceVideoTitle,
    lang,
    loading,
    error,
    fullscreen,
    openPrompting,
    cancelPrompting,
    startSession,
    submitTextTurn,
    endSession,
    setFullscreen,
  };
}

export type { StartSessionOpts };
