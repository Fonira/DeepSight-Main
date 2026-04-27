// extension/src/utils/analytics.ts
//
// Wrapper analytics minimal pour la VoiceView (Quick Voice Call Task 19).
//
// Stratégie : PostHog n'est pas (encore) bundlé dans l'extension. Ce module
// expose un `track(event, props)` qui, à terme, appellera `posthog.capture()`
// quand on installera `posthog-js`. En attendant, c'est un no-op observable
// (les tests peuvent intercepter l'export `__lastTrackedEvent`).
//
// Le contrat d'événements est défini dans la spec :
//   `docs/superpowers/specs/2026-04-26-quick-voice-call-design.md`
//
//   - voice_call_started               { videoId, plan, agent_type }
//   - voice_call_duration_seconds      { videoId, durationSec }
//   - voice_call_context_complete_at_ms{ videoId, ms }
//   - voice_call_ended_reason          { videoId, reason: "user_hangup" | "trial_used" | "error" }
//   - voice_call_upgrade_cta_shown     { reason }
//   - voice_call_upgrade_cta_clicked   { reason }

export type VoiceAnalyticsEvent =
  | "voice_call_started"
  | "voice_call_duration_seconds"
  | "voice_call_context_complete_at_ms"
  | "voice_call_ended_reason"
  | "voice_call_upgrade_cta_shown"
  | "voice_call_upgrade_cta_clicked";

export interface TrackedEvent {
  event: VoiceAnalyticsEvent;
  props: Record<string, unknown>;
  ts: number;
}

// Buffer in-memory exposé pour les tests + futurs forwards manuels.
const buffer: TrackedEvent[] = [];
const MAX_BUFFER = 100;

export function track(
  event: VoiceAnalyticsEvent,
  props: Record<string, unknown> = {},
): void {
  const tracked: TrackedEvent = { event, props, ts: Date.now() };
  buffer.push(tracked);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  // Bridge vers PostHog si dispo (window.posthog est défini par posthog-js
  // une fois installé). Best-effort, no-op sinon.
  type PostHogShape = {
    capture?: (event: string, props: Record<string, unknown>) => void;
  };
  const ph = (globalThis as unknown as { posthog?: PostHogShape }).posthog;
  if (ph?.capture) {
    try {
      ph.capture(event, props);
    } catch {
      /* swallow — analytics ne doit jamais casser l'UX */
    }
  }
}

/** Test helper — retourne les events trackés depuis le dernier reset. */
export function getTrackedEvents(): readonly TrackedEvent[] {
  return [...buffer];
}

/** Test helper — vide le buffer entre tests. */
export function resetTrackedEvents(): void {
  buffer.length = 0;
}
