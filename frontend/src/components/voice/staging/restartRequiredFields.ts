import type {
  VoicePreferences,
  VoiceChatSpeedPreset,
} from "../../../services/api";

/**
 * Fields that, when changed, require a fresh ElevenLabs session
 * (start/stop) for the change to take effect — they are baked into the
 * agent at startSession() time.
 *
 * Soft fields (input_mode, ptt_key, turn_timeout, soft_timeout_seconds,
 * speed, voice_chat_speed_preset non-concise) are persisted but do not
 * require a session restart.
 *
 * Live fields (volume, playback_rate) are not staged at all — they apply
 * directly to the DOM <audio> elements.
 */
export const RESTART_REQUIRED_FIELDS: ReadonlySet<keyof VoicePreferences> =
  new Set<keyof VoicePreferences>([
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
  ]);

/**
 * Decide whether the staged diff requires an ElevenLabs session restart
 * to take effect. Handles the special case of voice_chat_speed_preset:
 * only concise variants need a restart (because they inject a system
 * prompt server-side at agent creation).
 */
export function isRestartRequired(
  staged: Partial<VoicePreferences>,
  speedPresets: VoiceChatSpeedPreset[],
): boolean {
  for (const key of Object.keys(staged) as (keyof VoicePreferences)[]) {
    if (RESTART_REQUIRED_FIELDS.has(key)) return true;
    if (key === "voice_chat_speed_preset") {
      const presetId = staged.voice_chat_speed_preset;
      const preset = speedPresets.find((p) => p.id === presetId);
      if (preset?.concise) return true;
    }
  }
  return false;
}
