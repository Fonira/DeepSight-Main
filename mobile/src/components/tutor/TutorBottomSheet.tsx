// mobile/src/components/tutor/TutorBottomSheet.tsx
//
// Root du Tuteur V2 mobile lite : bottom-sheet avec mini-chat texte.
// Utilise SimpleBottomSheet (Expo Go compatible) — pas de @gorhom/bottom-sheet
// pour cohérence avec les autres bottom-sheets du projet (VoiceSettings, etc.).
//
// Props :
// - isOpen : ouvre/ferme le sheet (controlled).
// - onClose : callback fermeture (déclenche endSession + reset state).
// - conceptTerm / conceptDef : concept à approfondir (passés à startSession).
// - summaryId / sourceVideoTitle : contexte optionnel (analyse en cours).
//
// Workflow auto :
//   isOpen=false → idle, sheet hidden
//   isOpen=true  → snapToIndex(0), startSession() auto, render TutorMiniChat
//   onClose      → endSession() async (best effort) + reset state

import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import {
  SimpleBottomSheet,
  type SimpleBottomSheetRef,
} from "../ui/SimpleBottomSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { useTutor } from "./useTutor";
import { TutorMiniChat } from "./TutorMiniChat";

interface TutorBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  conceptTerm: string | null;
  conceptDef: string | null;
  summaryId?: number;
  sourceVideoTitle?: string;
}

export const TutorBottomSheet: React.FC<TutorBottomSheetProps> = ({
  isOpen,
  onClose,
  conceptTerm,
  conceptDef,
  summaryId,
  sourceVideoTitle,
}) => {
  const { colors } = useTheme();
  const sheetRef = useRef<SimpleBottomSheetRef>(null);
  const tutor = useTutor();
  const startedRef = useRef(false);

  useEffect(() => {
    if (isOpen && conceptTerm && conceptDef) {
      sheetRef.current?.snapToIndex(0);
      if (!startedRef.current && tutor.phase === "idle") {
        startedRef.current = true;
        void tutor.startSession({
          concept_term: conceptTerm,
          concept_def: conceptDef,
          summary_id: summaryId,
          source_video_title: sourceVideoTitle,
        });
      }
    }
    if (!isOpen) {
      sheetRef.current?.close();
    }
  }, [isOpen, conceptTerm, conceptDef, summaryId, sourceVideoTitle, tutor]);

  const handleClose = () => {
    if (tutor.sessionId) {
      void tutor.endSession();
    }
    startedRef.current = false;
    onClose();
  };

  if (!conceptTerm) return null;

  return (
    <SimpleBottomSheet
      ref={sheetRef}
      snapPoint="75%"
      backgroundStyle={{ backgroundColor: colors.bgPrimary }}
      handleIndicatorStyle={{ backgroundColor: colors.borderLight }}
      onClose={handleClose}
    >
      <View
        style={[styles.content, { backgroundColor: colors.bgPrimary }]}
        testID="tutor-bottom-sheet"
      >
        <TutorMiniChat
          conceptTerm={conceptTerm}
          messages={tutor.messages}
          loading={tutor.loading}
          error={tutor.error}
          onSubmit={tutor.submitTextTurn}
        />
      </View>
    </SimpleBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});

export default TutorBottomSheet;
