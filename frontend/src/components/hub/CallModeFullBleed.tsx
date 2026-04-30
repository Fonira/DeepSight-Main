import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  VoiceOverlay,
  type VoiceOverlayController,
  type VoiceOverlayMessage,
} from "../voice/VoiceOverlay";

interface Props {
  open: boolean;
  onClose: () => void;
  summaryId: number | null;
  title: string | null;
  subtitle: string | null;
  onVoiceMessage: (msg: VoiceOverlayMessage) => void;
  controllerRef?: React.MutableRefObject<VoiceOverlayController | null>;
  language?: "fr" | "en";
}

export const CallModeFullBleed: React.FC<Props> = ({
  open,
  onClose,
  summaryId,
  title,
  subtitle,
  onVoiceMessage,
  controllerRef,
  language = "fr",
}) => {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        className="absolute inset-0 z-[60] overflow-hidden"
      >
        <VoiceOverlay
          isOpen={true}
          onClose={onClose}
          title={title}
          subtitle={subtitle}
          summaryId={summaryId}
          agentType={summaryId ? "explorer" : "companion"}
          language={language}
          onVoiceMessage={onVoiceMessage}
          controllerRef={controllerRef}
          presentationMode="fullbleed"
        />
      </motion.div>
    </AnimatePresence>
  );
};
