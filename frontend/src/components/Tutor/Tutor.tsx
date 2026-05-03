import React from "react";
import { AnimatePresence } from "framer-motion";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import { useTutor } from "./useTutor";
import { TutorIdle } from "./TutorIdle";
import { TutorPrompting } from "./TutorPrompting";
import { TutorMiniChat } from "./TutorMiniChat";
import { TutorDeepSession } from "./TutorDeepSession";
import type { TutorMode } from "../../types/tutor";

export const Tutor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tutor = useTutor();

  if (!isAuthenticated || !currentWord) return null;

  const handleMode = (mode: TutorMode) => {
    tutor.startSession({
      concept_term: currentWord.term,
      concept_def: currentWord.definition,
      summary_id: currentWord.summaryId,
      source_video_title: currentWord.videoTitle,
      mode,
      lang: language === "fr" ? "fr" : "en",
    });
  };

  return (
    <AnimatePresence mode="wait">
      {tutor.phase === "idle" && (
        <TutorIdle key="idle" onClick={tutor.openPrompting} />
      )}
      {tutor.phase === "prompting" && (
        <TutorPrompting
          key="prompting"
          onMode={handleMode}
          onCancel={tutor.cancelPrompting}
        />
      )}
      {tutor.phase === "mini-chat" && tutor.conceptTerm && (
        <TutorMiniChat
          key="mini-chat"
          conceptTerm={tutor.conceptTerm}
          messages={tutor.messages}
          loading={tutor.loading}
          onSubmit={tutor.submitTextTurn}
          onDeepen={tutor.deepen}
          onClose={tutor.endSession}
        />
      )}
      {tutor.phase === "deep-session" && tutor.conceptTerm && (
        <TutorDeepSession
          key="deep-session"
          conceptTerm={tutor.conceptTerm}
          messages={tutor.messages}
          loading={tutor.loading}
          mode={tutor.mode}
          onSubmit={tutor.submitTextTurn}
          onSwitchToText={() => {
            /* géré localement dans TutorDeepSession */
          }}
          onClose={tutor.endSession}
        />
      )}
    </AnimatePresence>
  );
};

export default Tutor;
