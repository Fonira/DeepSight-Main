import { describe, it, expect } from "vitest";
import {
  RESTART_REQUIRED_FIELDS,
  isRestartRequired,
} from "../restartRequiredFields";
import type { VoiceChatSpeedPreset } from "../../../../services/api";

const PRESETS: VoiceChatSpeedPreset[] = [
  { id: "1x", label_fr: "Normal", label_en: "Normal", api_speed: 1, playback_rate: 1, concise: false },
  { id: "1.5x", label_fr: "Rapide", label_en: "Fast", api_speed: 1, playback_rate: 1.5, concise: false },
  { id: "3x", label_fr: "Concis", label_en: "Concise", api_speed: 1, playback_rate: 1, concise: true },
];

describe("RESTART_REQUIRED_FIELDS", () => {
  it("includes voice_id, voice_name, models, voice tuning, language, gender", () => {
    for (const key of [
      "voice_id",
      "voice_name",
      "tts_model",
      "voice_chat_model",
      "stability",
      "similarity_boost",
      "style",
      "use_speaker_boost",
      "language",
      "gender",
    ] as const) {
      expect(RESTART_REQUIRED_FIELDS.has(key)).toBe(true);
    }
  });

  it("does not include soft fields", () => {
    for (const key of [
      "ptt_key",
      "input_mode",
      "turn_timeout",
      "soft_timeout_seconds",
      "speed",
      "voice_chat_speed_preset",
    ] as const) {
      expect(RESTART_REQUIRED_FIELDS.has(key)).toBe(false);
    }
  });
});

describe("isRestartRequired", () => {
  it("returns false for empty staged", () => {
    expect(isRestartRequired({}, PRESETS)).toBe(false);
  });

  it("returns true when a hard field is staged", () => {
    expect(isRestartRequired({ voice_id: "abc" }, PRESETS)).toBe(true);
  });

  it("returns false when only soft fields are staged", () => {
    expect(
      isRestartRequired(
        { ptt_key: "Space", input_mode: "vad", turn_timeout: 12 },
        PRESETS,
      ),
    ).toBe(false);
  });

  it("returns true when staged voice_chat_speed_preset is a concise variant", () => {
    expect(
      isRestartRequired({ voice_chat_speed_preset: "3x" }, PRESETS),
    ).toBe(true);
  });

  it("returns false when staged voice_chat_speed_preset is a non-concise variant", () => {
    expect(
      isRestartRequired({ voice_chat_speed_preset: "1.5x" }, PRESETS),
    ).toBe(false);
  });

  it("returns false if catalog is empty (presets unknown → assume non-restart)", () => {
    expect(isRestartRequired({ voice_chat_speed_preset: "3x" }, [])).toBe(false);
  });
});
