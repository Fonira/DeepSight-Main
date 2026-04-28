import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VoiceSettings from "../VoiceSettings";

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
    catalog: {
      voices: [
        {
          voice_id: "v2",
          name: "Mathieu",
          description_fr: "",
          description_en: "",
          gender: "male",
          accent: "fr",
          language: "fr",
          use_case: "tutor",
          recommended: false,
          preview_url: "https://example.com/v2.mp3",
        },
      ],
      speed_presets: [
        { id: "1.0", label_fr: "1x", label_en: "1x", value: 1, icon: "" },
      ],
      voice_chat_speed_presets: [
        {
          id: "1x",
          label_fr: "Normal",
          label_en: "Normal",
          api_speed: 1,
          playback_rate: 1,
          concise: false,
        },
      ],
      models: [
        {
          id: "eleven_flash_v2_5",
          name: "Flash",
          description_fr: "",
          description_en: "",
          latency: "lowest",
          recommended_for: "voice_chat",
        },
      ],
    },
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
}));

beforeEach(() => {
  stageMock.mockReset();
});

describe("VoiceSettings — staging", () => {
  it("clicking a different voice card calls stage()", async () => {
    render(<VoiceSettings />);
    fireEvent.click(screen.getByText("Sélection de voix"));
    await waitFor(() => screen.getByText("Mathieu"));
    fireEvent.click(screen.getByText("Mathieu"));
    expect(stageMock).toHaveBeenCalledWith({
      voice_id: "v2",
      voice_name: "Mathieu",
    });
  });
});
