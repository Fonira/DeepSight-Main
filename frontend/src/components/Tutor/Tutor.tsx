import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import { useTutor } from "./useTutor";
import { TutorIdle } from "./TutorIdle";
import { TutorMinimized } from "./TutorMinimized";
import { TutorHub } from "./TutorHub";
import type { TutorHubInitialContext } from "./TutorHub";
import { LS_TUTOR_HIDDEN, LS_TUTOR_MINIMIZED } from "./tutorConstants";

function readBoolLS(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeBoolLS(key: string, value: boolean) {
  try {
    if (value) {
      localStorage.setItem(key, "true");
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Tutor — Root component for the floating teaser + unified hub (2026-05-11).
 *
 * State machine simplified:
 *   - idle: TutorIdle teaser visible (concept du jour rotatif, draggable+snap).
 *   - minimized: TutorMinimized pastille (saved in localStorage).
 *   - hub-open: TutorHub panel open (driven by `hubOpen` flag).
 *
 * The hub can be opened either from the teaser (with `initialContext` = concept
 * du jour as amorce) or from the sidebar item "Tuteur" (no amorce — handled
 * separately by `Sidebar.tsx`, which renders its own `<TutorHub>` instance).
 */
export const Tutor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tutor = useTutor();

  // Hub state: open + the concept amorce passed in (null when opened without).
  const [hubOpen, setHubOpen] = useState(false);
  const [hubInitialContext, setHubInitialContext] =
    useState<TutorHubInitialContext | null>(null);

  // Persistance close (hidden) + minimize entre rechargements page.
  // hidden : reset uniquement quand un nouveau concept arrive (changement
  // de currentWord.term) OU via clic sur item sidebar de réveil.
  const [hidden, setHidden] = useState<boolean>(() =>
    readBoolLS(LS_TUTOR_HIDDEN),
  );
  const [minimized, setMinimized] = useState<boolean>(() =>
    readBoolLS(LS_TUTOR_MINIMIZED),
  );

  // Reset `hidden` quand un nouveau concept arrive (signal de réveil).
  // On track le précédent term pour ne pas reset à chaque render.
  const [lastSeenTerm, setLastSeenTerm] = useState<string | null>(
    () => currentWord?.term ?? null,
  );
  useEffect(() => {
    if (currentWord?.term && currentWord.term !== lastSeenTerm) {
      setLastSeenTerm(currentWord.term);
      if (hidden) {
        setHidden(false);
        writeBoolLS(LS_TUTOR_HIDDEN, false);
      }
    }
  }, [currentWord?.term, lastSeenTerm, hidden]);

  const handleClose = useCallback(() => {
    // If a session is still active, the hub itself calls endSession on close.
    if (tutor.phase === "mini-chat") {
      void tutor.endSession();
    }
    setHidden(true);
    writeBoolLS(LS_TUTOR_HIDDEN, true);
    setMinimized(false);
    writeBoolLS(LS_TUTOR_MINIMIZED, false);
    setHubOpen(false);
  }, [tutor]);

  const handleMinimize = useCallback(() => {
    setMinimized(true);
    writeBoolLS(LS_TUTOR_MINIMIZED, true);
  }, []);

  const handleRestore = useCallback(() => {
    setMinimized(false);
    writeBoolLS(LS_TUTOR_MINIMIZED, false);
  }, []);

  // Teaser click → open the hub with the current concept as an amorce.
  const handleOpenHub = useCallback(() => {
    if (!currentWord) return;
    setHubInitialContext({
      conceptTerm: currentWord.term,
      conceptDef: currentWord.definition ?? null,
      summaryId: currentWord.summaryId ?? null,
    });
    setHubOpen(true);
  }, [currentWord]);

  const handleHubClose = useCallback(() => {
    setHubOpen(false);
    setHubInitialContext(null);
  }, []);

  if (!isAuthenticated || !currentWord) return null;
  if (hidden) return null;

  // Hub renders as a full-screen right panel (portal) — keep the teaser/
  // pastille mounted underneath so the user can dismiss the hub and still
  // see the daily concept.
  const hubEl = (
    <TutorHub
      isOpen={hubOpen}
      onClose={handleHubClose}
      language={language === "fr" ? "fr" : "en"}
      initialContext={hubInitialContext}
      defaultMode="text"
    />
  );

  // Si minimisé, peu importe la phase : on rend la pastille.
  if (minimized) {
    return (
      <>
        <AnimatePresence mode="wait">
          <TutorMinimized
            key="minimized"
            onRestore={handleRestore}
            onClose={handleClose}
          />
        </AnimatePresence>
        {hubEl}
      </>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <TutorIdle
          key="idle"
          onClick={handleOpenHub}
          onMinimize={handleMinimize}
          onClose={handleClose}
        />
      </AnimatePresence>
      {hubEl}
    </>
  );
};

export default Tutor;
