/**
 * Voice Chat Analytics — Tracking events pour mobile
 *
 * Utilise le service analytics mobile (batch upload vers backend)
 * pour tracker les interactions voice chat : sessions, quotas, upgrades, erreurs.
 *
 * ⚠️ Les noms voice_chat_* ne figurent pas (encore) dans la liste autorisée de
 * POST /api/analytics/events (backend/src/analytics/router.py). Un nom inconnu fait
 * rejeter tout le lot en 422 : ces événements ne partent donc que lorsqu'ils sont
 * ajoutés au backend ET à ANALYTICS_EVENT_NAMES (services/analytics.ts).
 *
 * Usage :
 *   import { VoiceAnalytics } from './voiceAnalytics';
 *   VoiceAnalytics.trackStarted({ plan: 'pro', platform: 'mobile', summaryId: 42, language: 'fr' });
 */

import {
  analytics,
  isAllowedAnalyticsEvent,
} from "../../services/analytics";

// ═══════════════════════════════════════════════════════════════════════════════
// Event names (type-safe constants)
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceAnalyticsEvents = {
  STARTED: "voice_chat_started",
  ENDED: "voice_chat_ended",
  QUOTA_WARNING: "voice_chat_quota_warning",
  QUOTA_REACHED: "voice_chat_quota_reached",
  ADDON_PURCHASED: "voice_chat_addon_purchased",
  UPGRADE_CLICKED: "voice_chat_upgrade_clicked",
  ERROR: "voice_chat_error",
} as const;

export type VoiceAnalyticsEventName =
  (typeof VoiceAnalyticsEvents)[keyof typeof VoiceAnalyticsEvents];

type EventProperties = Record<string, string | number | boolean | null>;

/** Envoie l'événement seulement si le backend l'accepte. Renvoie true s'il est suivi. */
export function trackVoiceEvent(
  name: VoiceAnalyticsEventName,
  properties: EventProperties,
): boolean {
  const eventName: string = name;
  if (!isAllowedAnalyticsEvent(eventName)) return false;
  analytics.track(eventName, properties);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Typed event helpers
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceAnalytics = {
  /** Debut de session voice */
  trackStarted(data: {
    plan: string;
    platform: string;
    summaryId: number;
    language: string;
  }) {
    trackVoiceEvent(VoiceAnalyticsEvents.STARTED, {
      plan: data.plan,
      platform: data.platform,
      summary_id: data.summaryId,
      language: data.language,
    });
  },

  /** Fin de session voice */
  trackEnded(data: {
    durationSeconds: number;
    plan: string;
    platform: string;
    summaryId: number;
  }) {
    trackVoiceEvent(VoiceAnalyticsEvents.ENDED, {
      duration_seconds: data.durationSeconds,
      plan: data.plan,
      platform: data.platform,
      summary_id: data.summaryId,
    });
  },

  /** Alerte quota (80%, 90%, etc.) */
  trackQuotaWarning(data: {
    percentUsed: number;
    plan: string;
    remainingSeconds: number;
  }) {
    trackVoiceEvent(VoiceAnalyticsEvents.QUOTA_WARNING, {
      percent_used: data.percentUsed,
      plan: data.plan,
      remaining_seconds: data.remainingSeconds,
    });
  },

  /** Quota atteint — session bloquee */
  trackQuotaReached(data: { plan: string; totalSecondsUsed: number }) {
    trackVoiceEvent(VoiceAnalyticsEvents.QUOTA_REACHED, {
      plan: data.plan,
      total_seconds_used: data.totalSecondsUsed,
    });
  },

  /** Add-on minutes achete */
  trackAddonPurchased(data: {
    packMinutes: number;
    priceCents: number;
    plan: string;
  }) {
    trackVoiceEvent(VoiceAnalyticsEvents.ADDON_PURCHASED, {
      pack_minutes: data.packMinutes,
      price_cents: data.priceCents,
      plan: data.plan,
    });
  },

  /** CTA upgrade clique depuis voice chat */
  trackUpgradeClicked(data: {
    currentPlan: string;
    targetPlan?: string;
    trigger: string;
  }) {
    trackVoiceEvent(VoiceAnalyticsEvents.UPGRADE_CLICKED, {
      current_plan: data.currentPlan,
      target_plan: data.targetPlan ?? null,
      trigger: data.trigger,
    });
  },

  /** Erreur technique (micro, WebSocket, STT, etc.) */
  trackError(data: { errorType: string; plan: string; platform: string }) {
    trackVoiceEvent(VoiceAnalyticsEvents.ERROR, {
      error_type: data.errorType,
      plan: data.plan,
      platform: data.platform,
    });
  },
};
