import React from "react";
import { AnimatePresence } from "framer-motion";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import { useTutor } from "./useTutor";
import { TutorIdle } from "./TutorIdle";
import { TutorPrompting } from "./TutorPrompting";
import { TutorMiniChat } from "./TutorMiniChat";

export const Tutor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tutor = useTutor();

  if (!isAuthenticated || !currentWord) return null;

  const handleStart = () => {
    tutor.startSession({
      concept_term: currentWord.term,
      concept_def: currentWord.definition,
      summary_id: currentWord.summaryId,
      source_video_title: currentWord.videoTitle,
      mode: "text",
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
          onStart={handleStart}
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
          onClose={tutor.endSession}
        />
      )}
    </AnimatePresence>
  );
};

export default Tutor;
