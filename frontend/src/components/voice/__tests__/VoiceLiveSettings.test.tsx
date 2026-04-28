/**
 * VoiceLiveSettings.test.tsx — Tests for the in-call collapsible settings
 * panel embedded inside VoiceOverlay.
 *
 * Behaviour covered:
 *  - Renders all 5 fields (volume, playback rate, input mode, PTT key, language)
 *  - stage() called when user changes a stage-routed field
 *  - voicePrefsBus.emitVoicePrefsEvent fires for live-applicable changes
 *    (playback_rate)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const stageMock = vi.fn();
vi.mock("../staging/VoicePrefsStagingProvider", () => ({
  useVoicePrefsStaging: () => ({
    applied: {
      voice_id: "v1",
      voice_name: "Sophie",
      speed: 1,
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
      tts_model: "eleven_multilingual_v2",
      voice_chat_model: "eleven_flash_v2_5",
      language: "fr",
      gender: "female",
      input_mode: "ptt",
      ptt_key: " ",
      interruptions_enabled: true,
      turn_eagerness: 0.5,
      voice_chat_speed_preset: "1x",
      turn_timeout: 15,
      soft_timeout_seconds: 300,
    },
    catalog: null,
    staged: {},
    hasChanges: false,
    hasRestartRequired: false,
    callActive: false,
    applying: false,
    applyError: null,
    stage: stageMock,
    cancel: vi.fn(),
    apply: vi.fn(),
  }),
  VoicePrefsStagingProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const emitVoicePrefsEventMock = vi.fn();
vi.mock("../voicePrefsBus", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("../voicePrefsBus");
  return {
    ...actual,
    emitVoicePrefsEvent: (...args: unknown[]) =>
      emitVoicePrefsEventMock(...args),
  };
});

import { VoiceLiveSettings } from "../VoiceLiveSettings";

beforeEach(() => {
  stageMock.mockReset();
  emitVoicePrefsEventMock.mockReset();
});

describe("VoiceLiveSettings (in-call collapsible panel)", () => {
  it("renders the 5 expected sections from staging context", async () => {
    render(<VoiceLiveSettings language="fr" />);
    await waitFor(() => {
      // Volume slider
      expect(screen.getByLabelText(/volume/i)).toBeDefined();
      // Playback rate buttons
      expect(screen.getByTestId("voice-live-rate-1x")).toBeDefined();
      // Input mode toggle (PTT / VAD)
      expect(screen.getByTestId("voice-live-mode-ptt")).toBeDefined();
      expect(screen.getByTestId("voice-live-mode-vad")).toBeDefined();
      // PTT key input
      expect(screen.getByTestId("voice-live-ptt-key")).toBeDefined();
      // Language selector (FR / EN)
      expect(screen.getByTestId("voice-live-lang-fr")).toBeDefined();
      expect(screen.getByTestId("voice-live-lang-en")).toBeDefined();
    });
  });

  it("emits playback_rate_changed on bus and stages voice_chat_speed_preset when user picks a new rate", async () => {
    render(<VoiceLiveSettings language="fr" />);
    const rate15 = await screen.findByTestId("voice-live-rate-1.5x");
    fireEvent.click(rate15);
    await waitFor(() =>
      expect(emitVoicePrefsEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "playback_rate_changed",
          value: 1.5,
        }),
      ),
    );
    expect(stageMock).toHaveBeenCalledWith({
      voice_chat_speed_preset: "1.5x",
    });
  });

  it("calls stage() when input_mode changes", async () => {
    render(<VoiceLiveSettings language="fr" />);
    const vad = await screen.findByTestId("voice-live-mode-vad");
    fireEvent.click(vad);
    await waitFor(() =>
      expect(stageMock).toHaveBeenCalledWith({ input_mode: "vad" }),
    );
  });

  it("calls stage() when language changes", async () => {
    render(<VoiceLiveSettings language="fr" />);
    const en = await screen.findByTestId("voice-live-lang-en");
    fireEvent.click(en);
    await waitFor(() =>
      expect(stageMock).toHaveBeenCalledWith({ language: "en" }),
    );
  });
});
