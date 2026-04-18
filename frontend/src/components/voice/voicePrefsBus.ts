/**
 * voicePrefsBus — Lightweight event bus to propagate live-applicable voice
 * preference changes between VoiceSettings and useVoiceChat/VoiceModal.
 *
 * Most ElevenLabs preferences (voice_id, stability, turn_config…) are baked
 * into the agent at session start and cannot be hot-reloaded. BUT some
 * client-side concerns (playback_rate on <audio> elements) can be patched
 * live. This bus lets VoiceChatSpeedSection notify the active session so it
 * re-patches audio elements without requiring a restart.
 *
 * For settings that DO require a restart, emit `restart_required` — the
 * settings panel will display a banner with a one-click restart button.
 */

export type VoicePrefsEvent =
  | { type: "playback_rate_changed"; value: number }
  | { type: "restart_required"; reason: string };

type Listener = (event: VoicePrefsEvent) => void;

const listeners = new Set<Listener>();

export function emitVoicePrefsEvent(event: VoicePrefsEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      // Don't let one listener break others
      console.error("[voicePrefsBus] listener error:", err);
    }
  });
}

export function subscribeVoicePrefsEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Map a chat-speed preset id to a client-side playback_rate multiplier.
 * Keep in sync with backend/src/voice/preferences.py VOICE_CHAT_SPEED_PRESETS.
 * Presets 3x/4x also include backend prompt injection for conciseness.
 */
export function presetToPlaybackRate(presetId: string): number {
  switch (presetId) {
    case "1x":
      return 1.0;
    case "1.5x":
      return 1.5;
    case "2x":
      return 2.0;
    case "3x":
      return 3.0;
    case "4x":
      return 4.0;
    default:
      return 1.0;
  }
}
