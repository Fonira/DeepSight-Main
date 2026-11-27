/**
 * Point d'accès unique au SDK @elevenlabs/react-native.
 *
 * Le SDK importe @livekit/react-native → @livekit/react-native-webrtc, qui lève
 * « WebRTC native module not found » dès l'import quand le module natif est absent.
 * C'est le cas dans Expo Go : importé par app/_layout.tsx, il faisait planter l'app
 * au démarrage. On ne charge donc le SDK que hors Expo Go ; sinon la voix est
 * « indisponible » (provider transparent + hook inerte) et le reste de l'app marche.
 * Les builds EAS (development, preview, production) ne changent pas.
 */
import React from "react";
import type * as ElevenLabsSdk from "@elevenlabs/react-native";
import { isExpoGo } from "../../utils/runtime";

type Sdk = typeof ElevenLabsSdk;
export type VoiceConversation = ElevenLabsSdk.Conversation;
type UseConversation = Sdk["useConversation"];

function loadSdk(): Sdk | null {
  if (isExpoGo) return null;
  try {
    return require("@elevenlabs/react-native") as Sdk;
  } catch (error) {
    if (__DEV__) console.warn("[voice] ElevenLabs SDK unavailable:", error);
    return null;
  }
}

const sdk = loadSdk();

/** false dans Expo Go (ou si le module natif manque) : la voix est indisponible. */
export const VOICE_SDK_AVAILABLE = sdk !== null;

const INERT_CONVERSATION: VoiceConversation = {
  startSession: async () => {
    throw new Error("Voice SDK unavailable in this build");
  },
  endSession: async () => undefined,
  status: "disconnected",
  isSpeaking: false,
  canSendFeedback: false,
  getId: () => "",
  sendFeedback: () => undefined,
  sendContextualUpdate: () => undefined,
  sendUserMessage: () => undefined,
  sendUserActivity: () => undefined,
  sendMultimodalMessage: () => undefined,
  setMicMuted: () => undefined,
};

const useInertConversation: UseConversation = () => INERT_CONVERSATION;

/** Hook ElevenLabs, ou version inerte sans SDK natif (choisi une fois au chargement). */
export const useConversation: UseConversation = sdk
  ? sdk.useConversation
  : useInertConversation;

/** ElevenLabsProvider, ou simple passe-plat sans SDK natif. */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  if (!sdk) return <>{children}</>;
  const { ElevenLabsProvider } = sdk;
  return <ElevenLabsProvider>{children}</ElevenLabsProvider>;
}
