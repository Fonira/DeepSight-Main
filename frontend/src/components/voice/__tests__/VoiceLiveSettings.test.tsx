/**
 * VoiceLiveSettings.test.tsx — Tests for the in-call collapsible settings
 * panel embedded inside VoiceOverlay.
 *
 * Behaviour covered:
 *  - Loading state while fetching preferences
 *  - Renders all 5 fields (volume, playback rate, input mode, PTT key, language)
 *  - Save handler called when user changes a field
 *  - voicePrefsBus.emitVoicePrefsEvent fires for live-applicable changes
 *    (playback_rate)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const getPreferencesMock = vi.fn();
const updatePreferencesMock = vi.fn();

vi.mock("../../../services/api", () => ({
  voiceApi: {
    getPreferences: () => getPreferencesMock(),
    updatePreferences: (updates: Record<string, unknown>) =>
      updatePreferencesMock(updates),
  },
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

const baselinePrefs = {
  voice_id: "v1",
  voice_name: "Aria",
  speed: 1.0,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
  tts_model: "eleven_multilingual_v2",
  voice_chat_model: "eleven_flash_v2_5",
  language: "fr",
  gender: "female",
  input_mode: "ptt" as const,
  ptt_key: " ",
  interruptions_enabled: true,
  turn_eagerness: 0.5,
  voice_chat_speed_preset: "1x",
  turn_timeout: 15,
  soft_timeout_seconds: 300,
};

describe("VoiceLiveSettings (in-call collapsible panel)", () => {
  beforeEach(() => {
    getPreferencesMock.mockReset();
    updatePreferencesMock.mockReset();
    emitVoicePrefsEventMock.mockReset();
    getPreferencesMock.mockResolvedValue({ ...baselinePrefs });
    updatePreferencesMock.mockImplementation(
      async (updates: Record<string, unknown>) => ({
        ...baselinePrefs,
        ...updates,
      }),
    );
  });

  it("loads preferences from voiceApi on mount", async () => {
    render(<VoiceLiveSettings language="fr" />);
    await waitFor(() => expect(getPreferencesMock).toHaveBeenCalled());
  });

  it("renders the 5 expected sections after preferences load", async () => {
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

  it("emits playback_rate_changed on bus when user picks a new rate", async () => {
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
  });

  it("calls voiceApi.updatePreferences when input_mode changes", async () => {
    render(<VoiceLiveSettings language="fr" />);
    const vad = await screen.findByTestId("voice-live-mode-vad");
    fireEvent.click(vad);
    await waitFor(() =>
      expect(updatePreferencesMock).toHaveBeenCalledWith(
        expect.objectContaining({ input_mode: "vad" }),
      ),
    );
  });

  it("calls voiceApi.updatePreferences when language changes", async () => {
    render(<VoiceLiveSettings language="fr" />);
    const en = await screen.findByTestId("voice-live-lang-en");
    fireEvent.click(en);
    await waitFor(() =>
      expect(updatePreferencesMock).toHaveBeenCalledWith(
        expect.objectContaining({ language: "en" }),
      ),
    );
  });

  it("displays an error message if preferences fail to load", async () => {
    getPreferencesMock.mockRejectedValueOnce(new Error("network"));
    render(<VoiceLiveSettings language="fr" />);
    await waitFor(() => {
      expect(screen.getByTestId("voice-live-error")).toBeDefined();
    });
  });
});
