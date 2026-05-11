import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import { useTutor } from "./useTutor";
import { TutorIdle } from "./TutorIdle";
import { TutorPrompting } from "./TutorPrompting";
import { TutorMiniChat } from "./TutorMiniChat";
import { TutorMinimized } from "./TutorMinimized";
import { LS_TUTOR_HIDDEN, LS_TUTOR_MINIMIZED } from "./tutorConstants";
import { useVoiceEnabled } from "../voice/hooks/useVoiceEnabled";
import { VoiceTutorModal } from "../voice/VoiceTutorModal";

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

export const Tutor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tutor = useTutor();
  const { voiceEnabled } = useVoiceEnabled();
  const navigate = useNavigate();

  // Voice Tutor modal — opened from the TutorMiniChat header button.
  // Carries the current concept as a primer so the agent can pick up
  // the topic immediately on connection.
  const [voiceTutorOpen, setVoiceTutorOpen] = useState(false);

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
    // Si on est en session active, on l'arrête proprement avant de cacher.
    if (tutor.phase === "mini-chat") {
      void tutor.endSession();
    } else if (tutor.phase === "prompting") {
      tutor.cancelPrompting();
    }
    setHidden(true);
    writeBoolLS(LS_TUTOR_HIDDEN, true);
    setMinimized(false);
    writeBoolLS(LS_TUTOR_MINIMIZED, false);
  }, [tutor]);

  const handleMinimize = useCallback(() => {
    setMinimized(true);
    writeBoolLS(LS_TUTOR_MINIMIZED, true);
  }, []);

  const handleRestore = useCallback(() => {
    setMinimized(false);
    writeBoolLS(LS_TUTOR_MINIMIZED, false);
  }, []);

  const handleStart = useCallback(() => {
    if (!currentWord) return;
    tutor.startSession({
      concept_term: currentWord.term,
      concept_def: currentWord.definition,
      summary_id: currentWord.summaryId,
      source_video_title: currentWord.videoTitle,
      mode: "text",
      lang: language === "fr" ? "fr" : "en",
    });
  }, [currentWord, language, tutor]);

  // V2 — Fullscreen: bascule la conv tuteur dans la vue plein écran du Hub
  // (`/hub?fsChat=tutor`). La popup reste montée en arrière-plan (masquée
  // par le HubPage qui early-return sur `fsChat`), mais la conv vit
  // désormais dans le store Zustand global → la vue Hub lit la même
  // session sans drop de messages.
  const handleFullscreen = useCallback(() => {
    tutor.setFullscreen(true);
    navigate("/hub?fsChat=tutor");
  }, [tutor, navigate]);

  if (!isAuthenticated || !currentWord) return null;
  if (hidden) return null;

  // V2 — back-to-chat callback : ne s'expose au modal vocal QUE si une
  // conv texte est déjà en cours. Sans conv (lancement sidebar sans
  // concept), pas de "retour au chat" possible → le bouton reste masqué.
  const voiceBackToChat =
    tutor.phase === "mini-chat"
      ? () => {
          setVoiceTutorOpen(false);
          /* La popup texte est déjà visible derrière, rien d'autre à faire. */
        }
      : undefined;

  // Voice Tutor modal element — rendered alongside the phase UI so it can
  // stay open even when the tutor mini-chat is closed/minimized. Renders
  // via portal inside VoiceOverlay so it does not interfere with layout.
  const voiceTutorEl = (
    <VoiceTutorModal
      isOpen={voiceTutorOpen}
      onClose={() => setVoiceTutorOpen(false)}
      language={language === "fr" ? "fr" : "en"}
      initialContext={
        tutor.conceptTerm
          ? {
              conceptTerm: tutor.conceptTerm,
              conceptDef: tutor.conceptDef,
              summaryId: tutor.summaryId,
            }
          : null
      }
      onBackToChat={voiceBackToChat}
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
        {voiceTutorEl}
      </>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {tutor.phase === "idle" && (
          <TutorIdle
            key="idle"
            onClick={tutor.openPrompting}
            onMinimize={handleMinimize}
            onClose={handleClose}
          />
        )}
        {tutor.phase === "prompting" && (
          <TutorPrompting
            key="prompting"
            onStart={handleStart}
            onCancel={tutor.cancelPrompting}
            onMinimize={handleMinimize}
            onClose={handleClose}
          />
        )}
        {tutor.phase === "mini-chat" && tutor.conceptTerm && (
          <TutorMiniChat
            key="mini-chat"
            conceptTerm={tutor.conceptTerm}
            messages={tutor.messages}
            loading={tutor.loading}
            onSubmit={tutor.submitTextTurn}
            onMinimize={handleMinimize}
            onClose={handleClose}
            voiceTutorEnabled={voiceEnabled}
            onOpenVoiceTutor={() => setVoiceTutorOpen(true)}
            onFullscreen={handleFullscreen}
          />
        )}
      </AnimatePresence>
      {voiceTutorEl}
    </>
  );
};

export default Tutor;
