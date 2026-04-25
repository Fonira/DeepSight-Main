/**
 * VoiceCallProvider — Wrapper React Context unifié pour le voice chat.
 *
 * Encapsule tout le boilerplate dupliqué entre DashboardPage, History et
 * DebatePage :
 *
 *  - useVoiceChat (cycle session ElevenLabs)
 *  - useMicLevel (RMS micro pour waveform live)
 *  - useVoiceEnabled (gating premium + admin)
 *  - état isVoiceModalOpen
 *  - rendu d'un unique <VoiceModal />
 *
 * Usage :
 *
 * ```tsx
 * <VoiceCallProvider summaryId={42} videoTitle="…" agentType="explorer">
 *   <ResultsView />
 *   <VoiceCallButton variant="hero" />
 * </VoiceCallProvider>
 * ```
 *
 * Spec ElevenLabs ecosystem #2 §a.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { VoiceModal } from "./VoiceModal";
import { useVoiceChat } from "./useVoiceChat";
import { useMicLevel } from "./hooks/useMicLevel";
import { useVoiceEnabled } from "./hooks/useVoiceEnabled";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type AgentType =
  | "explorer"
  | "tutor"
  | "debate_moderator"
  | "quiz_coach"
  | "onboarding"
  | "companion";

interface VoiceChatMessage {
  text: string;
  source: "user" | "ai";
}

export interface VoiceCallProviderProps {
  /** ID de l'analyse (Summary). XOR avec debateId. */
  summaryId?: number;
  /** ID du débat IA. XOR avec summaryId. */
  debateId?: number;
  /** Type d'agent vocal. Défaut : "explorer" si summaryId, "debate_moderator" si debateId. */
  agentType?: AgentType;
  /** Titre vidéo affiché dans le header de la modal. */
  videoTitle: string;
  /** Nom de la chaîne / sous-titre dans la modal. */
  channelName?: string;
  /** URL de la miniature vidéo (modal hero + AnalysisVoiceHero). */
  thumbnailUrl?: string | null;
  /** ID vidéo plateforme (YouTube/TikTok) — fallback thumbnail HD. */
  videoId?: string | null;
  /** Plateforme source — fallback thumbnail HD. */
  platform?: string | null;
  /** Langue conversation (FR par défaut). */
  language?: "fr" | "en";
  /** Mode overlay flottant 380×600 pour Chat IA (vs full screen). */
  compact?: boolean;
  /** Avatar dynamique de l'agent (URL) — débats. */
  avatarUrl?: string | null;
  /** Statut de génération de l'avatar. */
  avatarStatus?: "ready" | "generating" | "unavailable";
  /** Initiales fallback si avatar absent. */
  avatarFallback?: string;
  /** Callback déclenché à chaque nouveau message (pour analytics / persistance). */
  onVoiceMessage?: (msg: VoiceChatMessage) => void;
  /** Callback d'erreur — propagé au hook useVoiceChat. */
  onError?: (error: string) => void;
  children: ReactNode;
}

interface VoiceCallContextValue {
  /** Modal ouverte ? */
  isOpen: boolean;
  /** Ouvre la modal. No-op si voiceEnabled=false. */
  openModal: () => void;
  /** Ferme la modal et stoppe la session active. */
  closeModal: () => void;
  /** Précharge le SDK ElevenLabs (idéalement appelé au mount du Hero). */
  prewarm: () => void;
  /** Plan/admin gate — true si l'utilisateur a accès au voice. */
  voiceEnabled: boolean;
  /** Métadonnées exposées aux consumers (boutons) sans re-prop drilling. */
  videoTitle: string;
  thumbnailUrl: string | null | undefined;
  videoId: string | null | undefined;
  platform: string | null | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════════════

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

/**
 * Hook consumer — accès au state voice depuis n'importe quel descendant du
 * `<VoiceCallProvider>`. Throw si utilisé hors d'un provider, pour
 * détecter les erreurs de wiring le plus tôt possible.
 */
export function useVoiceCall(): VoiceCallContextValue {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) {
    throw new Error(
      "useVoiceCall() doit être utilisé à l'intérieur d'un <VoiceCallProvider>.",
    );
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceCallProvider: React.FC<VoiceCallProviderProps> = ({
  summaryId,
  debateId,
  agentType,
  videoTitle,
  channelName,
  thumbnailUrl,
  videoId,
  platform,
  language = "fr",
  compact = false,
  avatarUrl,
  avatarStatus,
  avatarFallback,
  onVoiceMessage,
  onError,
  children,
}) => {
  const voiceEnabled = useVoiceEnabled();
  const [isOpen, setIsOpen] = useState(false);

  const voiceChat = useVoiceChat({
    summaryId: debateId == null ? (summaryId ?? 0) : undefined,
    debateId,
    agentType,
    language,
    onError,
  });

  const micLevel = useMicLevel(voiceChat.micStream, voiceChat.isTalking);

  // Forward de chaque nouveau message au consumer (e.g. pour merger dans le
  // chat texte — le ChatPage en aura besoin pour la voix dans le chat IA).
  // We diff on messages.length to fire exactly once per new message.
  const messagesLenRef = React.useRef(0);
  React.useEffect(() => {
    if (!onVoiceMessage) {
      messagesLenRef.current = voiceChat.messages.length;
      return;
    }
    const prev = messagesLenRef.current;
    if (voiceChat.messages.length > prev) {
      for (let i = prev; i < voiceChat.messages.length; i++) {
        onVoiceMessage(voiceChat.messages[i]);
      }
    }
    messagesLenRef.current = voiceChat.messages.length;
  }, [voiceChat.messages, onVoiceMessage]);

  const openModal = useCallback(() => {
    if (!voiceEnabled) return;
    setIsOpen(true);
  }, [voiceEnabled]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Stop active session — ignore promise rejection (handled in hook).
    Promise.resolve(voiceChat.stop()).catch(() => {});
  }, [voiceChat]);

  const value = useMemo<VoiceCallContextValue>(
    () => ({
      isOpen,
      openModal,
      closeModal,
      prewarm: voiceChat.prewarm,
      voiceEnabled,
      videoTitle,
      thumbnailUrl,
      videoId,
      platform,
    }),
    [
      isOpen,
      openModal,
      closeModal,
      voiceChat.prewarm,
      voiceEnabled,
      videoTitle,
      thumbnailUrl,
      videoId,
      platform,
    ],
  );

  // Effective summaryId for VoiceModal thumbnail fetch — null in debate mode
  // so the modal doesn't try /voice/session/0/thumbnail.
  const effectiveSummaryId = debateId == null ? summaryId : null;

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      <VoiceModal
        isOpen={isOpen}
        onClose={closeModal}
        videoTitle={videoTitle}
        channelName={channelName}
        summaryId={effectiveSummaryId}
        videoThumbnailUrl={thumbnailUrl}
        voiceStatus={voiceChat.status}
        isSpeaking={voiceChat.isSpeaking}
        messages={voiceChat.messages}
        elapsedSeconds={voiceChat.elapsedSeconds}
        remainingMinutes={voiceChat.remainingMinutes}
        onStart={voiceChat.start}
        onStop={voiceChat.stop}
        onMuteToggle={voiceChat.toggleMute}
        isMuted={voiceChat.isMuted}
        inputMode={voiceChat.inputMode}
        pttKey={voiceChat.pttKey}
        isTalking={voiceChat.isTalking}
        onStartTalking={voiceChat.startTalking}
        onStopTalking={voiceChat.stopTalking}
        activeTool={voiceChat.activeTool}
        error={voiceChat.error ?? undefined}
        playbackRate={voiceChat.playbackRate}
        avatarUrl={avatarUrl}
        avatarStatus={avatarStatus}
        avatarFallback={avatarFallback}
        micLevel={micLevel}
        onRestart={voiceChat.restart}
        compact={compact}
      />
    </VoiceCallContext.Provider>
  );
};

export default VoiceCallProvider;
