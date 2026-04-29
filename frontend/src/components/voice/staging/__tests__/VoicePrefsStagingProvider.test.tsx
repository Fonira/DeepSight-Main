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
  const actual = await vi.importActual<
    typeof import("../../../../services/api")
  >("../../../../services/api");
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
  {
    id: "1x",
    label_fr: "Normal",
    label_en: "Normal",
    api_speed: 1,
    playback_rate: 1,
    concise: false,
  },
  {
    id: "3x",
    label_fr: "Concis",
    label_en: "Concise",
    api_speed: 1,
    playback_rate: 1,
    concise: true,
  },
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

  it("apply() sends a single batched updatePreferences call and resets staged", async () => {
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue({
      ...APPLIED,
      voice_id: "v2",
      language: "en",
    });
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2", language: "en" }));
    await act(async () => {
      await result.current.apply();
    });
    expect(voiceApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(voiceApi.updatePreferences).toHaveBeenCalledWith({
      voice_id: "v2",
      language: "en",
    });
    expect(result.current.staged).toEqual({});
    expect(result.current.applied?.voice_id).toBe("v2");
  });

  it("apply() emits apply_with_restart when callActive and hard field staged", async () => {
    const { emitVoicePrefsEvent: emit, subscribeVoicePrefsEvents: sub } =
      await import("../../voicePrefsBus");
    const listener = vi.fn();
    const unsub = sub(listener);
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue(APPLIED);
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => emit({ type: "call_status_changed", active: true }));
    await waitFor(() => expect(result.current.callActive).toBe(true));
    act(() => result.current.stage({ voice_id: "v2" }));
    await act(async () => {
      await result.current.apply();
    });
    expect(listener).toHaveBeenCalledWith({ type: "apply_with_restart" });
    unsub();
  });

  it("apply() does NOT emit apply_with_restart when callActive but only soft fields staged", async () => {
    const { subscribeVoicePrefsEvents: sub } =
      await import("../../voicePrefsBus");
    const listener = vi.fn();
    const unsub = sub(listener);
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue(APPLIED);
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    const { emitVoicePrefsEvent: emit } = await import("../../voicePrefsBus");
    act(() => emit({ type: "call_status_changed", active: true }));
    await waitFor(() => expect(result.current.callActive).toBe(true));
    act(() => result.current.stage({ ptt_key: "Shift" }));
    await act(async () => {
      await result.current.apply();
    });
    const apply = listener.mock.calls.find(
      ([e]) => e.type === "apply_with_restart",
    );
    expect(apply).toBeUndefined();
    unsub();
  });

  it("apply() preserves staged on error and sets applyError", async () => {
    vi.mocked(voiceApi.updatePreferences).mockRejectedValue(
      new Error("network down"),
    );
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    act(() => result.current.stage({ voice_id: "v2" }));
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.staged).toEqual({ voice_id: "v2" });
    expect(result.current.applyError).toBe("network down");
  });

  it("apply() is a no-op when staged is empty", async () => {
    vi.mocked(voiceApi.updatePreferences).mockResolvedValue(APPLIED);
    const { result } = renderHook(() => useVoicePrefsStaging(), { wrapper });
    await waitFor(() => expect(result.current.applied).toEqual(APPLIED));
    await act(async () => {
      await result.current.apply();
    });
    expect(voiceApi.updatePreferences).not.toHaveBeenCalled();
  });
});
