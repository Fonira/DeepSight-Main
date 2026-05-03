/**
 * 🎓 Le Tuteur — Composant racine.
 *
 * Compose les 4 sous-composants selon `useTutor().phase` :
 *   idle        → TutorIdle        (card 200×140 top-right)
 *   prompting   → TutorPrompting   (card 220×180 mode selector)
 *   mini-chat   → TutorMiniChat    (panel 280×400 thread)
 *   deep-session→ TutorDeepSession (modal fullscreen)
 *
 * Affiché uniquement pour les utilisateurs authentifiés ET quand un
 * `currentWord` est dispo (sinon le Tuteur n'a aucun concept à proposer).
 *
 * Source de vérité : docs/superpowers/specs/2026-05-03-le-tuteur-companion-design.md
 */

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
import type { TutorSessionMode } from "../../types/tutor";

export const Tutor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tutor = useTutor();

  if (!isAuthenticated || !currentWord) return null;

  const handleMode = (mode: TutorSessionMode) => {
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
            // V1.0 : géré localement par TutorDeepSession (toggle visuel input).
            // Le `mode` au niveau state reste tel quel — c'est V1.1 qui gérera
            // une vraie transition voice → text avec stop STT/TTS.
          }}
          onClose={tutor.endSession}
        />
      )}
    </AnimatePresence>
  );
};

export default Tutor;
