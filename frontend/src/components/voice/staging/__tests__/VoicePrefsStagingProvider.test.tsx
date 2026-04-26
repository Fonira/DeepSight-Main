import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  VoicePrefsStagingProvider,
  useVoicePrefsStaging,
} from "../VoicePrefsStagingProvider";
import type {
  VoicePreferences,
  VoiceCatalog,
  VoiceChatSpeedPreset,
} from "../../../../services/api";

vi.mock("../../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/api")>(
    "../../../../services/api",
  );
  return {
    ...actual,
    voiceApi: {
      getPreferences: vi.fn(),
      getCatalog: vi.fn(),
      updatePreferences: vi.fn(),
    },
  };
});

import { voiceApi } from "../../../../services/api";

const APPLIED: VoicePreferences = {
  voice_id: "v1",
  voice_name: "Sophie",
  speed: 1.0,
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
};

const PRESETS: VoiceChatSpeedPreset[] = [
  { id: "1x", label_fr: "Normal", label_en: "Normal", api_speed: 1, playback_rate: 1, concise: false },
  { id: "3x", label_fr: "Concis", label_en: "Concise", api_speed: 1, playback_rate: 1, concise: true },
];

const CATALOG: VoiceCatalog = {
  voices: [],
  speed_presets: [],
  voice_chat_speed_presets: PRESETS,
  models: [],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VoicePrefsStagingProvider>{children}</VoicePrefsStagingProvider>
);

beforeEach(() => {
  vi.mocked(voiceApi.getPreferences).mockResolvedValue(APPLIED);
  vi.mocked(voiceApi.getCatalog).mockResolvedValue(CATALOG);
  vi.mocked(voiceApi.updatePreferences).mockReset();
});

describe("VoicePrefsStagingProvider", () => {
  it("hydrates applied + catalog on mount", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    expect(voiceApi.getPreferences).toHaveBeenCalled();
    expect(voiceApi.getCatalog).toHaveBeenCalled();
  });

  it("stage() merges into staged", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2" }));
    expect(result.current.staged).toEqual({ voice_id: "v2" });
    expect(result.current.hasChanges).toBe(true);
  });

  it("stage() with applied value removes the key (no-op detect)", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2" }));
    act(() => result.current.stage({ voice_id: "v1" }));
    expect(result.current.staged).toEqual({});
    expect(result.current.hasChanges).toBe(false);
  });

  it("cancel() clears staged", async () => {
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2", language: "en" }));
    act(() => result.current.cancel());
    expect(result.current.staged).toEqual({});
  });
});
