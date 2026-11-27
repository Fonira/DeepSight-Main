/**
 * Expo Go : le SDK @elevenlabs/react-native (→ LiveKit → WebRTC natif) ne doit pas être
 * chargé — son import lève « WebRTC native module not found » et faisait planter l'app
 * au démarrage. La voix est alors « indisponible », sans demande de micro.
 */
import React from "react";
import { Text } from "react-native";
import { act, render, renderHook } from "@testing-library/react-native";

// Environnement Expo Go
jest.mock("expo-constants", () => ({
  executionEnvironment: "storeClient",
  appOwnership: "expo",
  expoConfig: { extra: {} },
}));

// Le SDK lève à l'import, comme sans module WebRTC natif
const mockSdkLoaded = jest.fn();
jest.mock("@elevenlabs/react-native", () => {
  mockSdkLoaded();
  throw new Error("WebRTC native module not found.");
});

const mockRequestPermissions = jest.fn();
jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: () => mockRequestPermissions(),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
  InterruptionModeIOS: { DoNotMix: 1, MixWithOthers: 0, DuckOthers: 2 },
  InterruptionModeAndroid: { DoNotMix: 1, MixWithOthers: 0, DuckOthers: 2 },
}));

const mockCreateSession = jest.fn();
jest.mock("../../../services/api", () => ({
  voiceApi: {
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    appendTranscript: jest.fn(),
  },
}));

import { VOICE_SDK_AVAILABLE, VoiceProvider, useConversation } from "../elevenlabs";
import { useVoiceChat } from "../useVoiceChat";

describe("voix dans Expo Go", () => {
  it("ne charge jamais le SDK natif", () => {
    expect(VOICE_SDK_AVAILABLE).toBe(false);
    expect(mockSdkLoaded).not.toHaveBeenCalled();
  });

  it("VoiceProvider affiche simplement ses enfants", () => {
    const screen = render(
      <VoiceProvider>
        <Text>Accueil</Text>
      </VoiceProvider>,
    );
    expect(screen.getByText("Accueil")).toBeTruthy();
  });

  it("useConversation renvoie une conversation inerte", async () => {
    const { result } = renderHook(() => useConversation());
    expect(result.current.status).toBe("disconnected");
    await expect(result.current.startSession({ agentId: "x" })).rejects.toThrow();
  });

  it("useVoiceChat : voix indisponible, ni API ni micro", async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useVoiceChat({ summaryId: "42", onError }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("unavailable");
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(String), "SERVICE_UNAVAILABLE");
  });
});
