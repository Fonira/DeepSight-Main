// extension/src/utils/analytics.ts
//
// Wrapper analytics pour la VoiceView (Quick Voice Call Task 19) et tout autre
// event de l'extension.
//
// Stratégie depuis 2026-05-06 : PostHog est bundlé via `lib/posthog.ts` (init
// dans les entry points sidepanel + viewer uniquement). Ici on importe
// directement le client `posthog` exporté par ce module et on appelle
// `posthog.capture(...)`. Si `initPostHog()` n'a pas tourné (absence de clé
// au build, ou code exécuté côté service worker / content script qui n'init
// jamais posthog), `posthog.__loaded` est false et capture devient un no-op
// silencieux interne à posthog-js. Le buffer in-memory ci-dessous reste comme
// fallback observable (tests + futur forwarding manuel offline).
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

import { posthog } from "../lib/posthog";

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

  // Bridge vers PostHog. `posthog` vient de `lib/posthog.ts` ; si initPostHog()
  // n'a pas été appelé (service worker, content script, build sans clé), le
  // capture devient un no-op interne sans throw. On garde aussi le path
  // `globalThis.posthog` pour compat tests qui mockent globalement.
  try {
    if (typeof posthog?.capture === "function") {
      posthog.capture(event, props);
    } else {
      type PostHogShape = {
        capture?: (event: string, props: Record<string, unknown>) => void;
      };
      const ph = (globalThis as unknown as { posthog?: PostHogShape }).posthog;
      ph?.capture?.(event, props);
    }
  } catch {
    /* swallow — analytics ne doit jamais casser l'UX */
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

/**
 * [N1] Hash léger d'un videoId pour PostHog (spec L383). On utilise
 * Web Crypto SHA-256 si dispo, fallback djb2-32 sinon (jsdom test env
 * n'a pas crypto.subtle). On garde 8 chars hex en sortie pour grouper
 * les events par vidéo sans exposer l'ID YouTube en clair dans le
 * dashboard PostHog (privacy nice-to-have ; le videoId est techniquement
 * public mais on évite l'exposition direct dans nos logs analytics).
 */
export async function hashVideoId(videoId: string): Promise<string> {
  if (!videoId) return "";
  // Path 1 : Web Crypto (production navigateur Chrome MV3).
  const subtle = (
    globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }
  ).crypto?.subtle;
  if (subtle) {
    try {
      const data = new TextEncoder().encode(videoId);
      const hashBuffer = await subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex.slice(0, 8);
    } catch {
      /* fall through */
    }
  }
  // Path 2 : djb2-32 fallback (jsdom + tests sans crypto).
  let h = 5381;
  for (let i = 0; i < videoId.length; i++) {
    h = ((h << 5) + h + videoId.charCodeAt(i)) & 0xffffffff;
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}
