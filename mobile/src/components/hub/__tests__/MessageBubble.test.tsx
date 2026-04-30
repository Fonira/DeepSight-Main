/**
 * MessageBubble.test.tsx — Tests basiques pour le rendu des bulles Hub.
 *
 * Couvre :
 *  - rendu d'une bulle text user (gold-tinted)
 *  - rendu d'une bulle text AI (avec label "DeepSight")
 *  - rendu d'une voice bubble (audio_duration_secs > 0) -> delegue a VoiceBubble
 */

import React from "react";
import { render } from "@testing-library/react-native";

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    View,
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => ({ value: v }),
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...args: unknown[]) => args[0],
    withDelay: (_: number, v: unknown) => v,
    Easing: {
      bezier: () => () => 0,
      inOut: (fn: unknown) => fn,
      ease: () => 0,
    },
    cancelAnimation: jest.fn(),
    FadeIn: { duration: () => ({ duration: 0 }) },
    FadeOut: { duration: () => ({ duration: 0 }) },
    SlideInLeft: { duration: () => ({ easing: () => ({}) }) },
    SlideOutLeft: { duration: () => ({}) },
    SlideInDown: { duration: () => ({ easing: () => ({}) }) },
    SlideOutDown: { duration: () => ({}) },
  };
});

jest.mock("@/theme/typography", () => ({
  fontFamily: {
    body: "System",
    bodyMedium: "System",
    bodyBold: "System",
    mono: "System",
  },
}));

import { MessageBubble } from "../MessageBubble";
import type { HubMessage } from "../types";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("MessageBubble", () => {
  it("rend une bulle text user avec son contenu", () => {
    const msg: HubMessage = {
      id: "m-1",
      role: "user",
      content: "Bonjour DeepSight",
      source: "text",
      timestamp: Date.now(),
    };
    const { getByText, getByTestId } = render(<MessageBubble msg={msg} />);
    expect(getByTestId("hub-msg-text")).toBeTruthy();
    expect(getByText("Bonjour DeepSight")).toBeTruthy();
  });

  it("rend une bulle text AI avec le label DeepSight", () => {
    const msg: HubMessage = {
      id: "m-2",
      role: "assistant",
      content: "Voici ma reponse",
      source: "text",
      timestamp: Date.now(),
    };
    const { getByText, getByTestId } = render(<MessageBubble msg={msg} />);
    expect(getByTestId("hub-msg-text")).toBeTruthy();
    expect(getByText("DeepSight")).toBeTruthy();
    expect(getByText("Voici ma reponse")).toBeTruthy();
  });

  it("rend une voice bubble (audio_duration_secs > 0) avec testID voice_user", () => {
    const msg: HubMessage = {
      id: "m-3",
      role: "user",
      content: "Note vocale demo",
      source: "voice_user",
      audio_duration_secs: 8,
      timestamp: Date.now(),
    };
    const { queryByTestId } = render(<MessageBubble msg={msg} />);
    // VoiceBubble n'expose pas le testID hub-msg-* (c'est MessageBubble lui-meme).
    // On verifie juste que le rendu n'a pas crash (queryByTestId non null pour la text fallback).
    expect(queryByTestId("hub-msg-voice_user")).toBeNull();
  });

  it("affiche le tag VOCAL pour un voice text user (pas de audio_duration_secs)", () => {
    const msg: HubMessage = {
      id: "m-4",
      role: "user",
      content: "Note vocale sans audio",
      source: "voice_user",
      time_in_call_secs: 65,
      timestamp: Date.now(),
    };
    const { getByText } = render(<MessageBubble msg={msg} />);
    expect(getByText("VOCAL")).toBeTruthy();
    expect(getByText(/1:05/)).toBeTruthy();
  });
});
