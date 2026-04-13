/**
 * Voice Chat Analytics — Tracking events pour mobile
 *
 * Utilise le service analytics mobile (batch upload vers backend)
 * pour tracker les interactions voice chat : sessions, quotas, upgrades, erreurs.
 *
 * Usage :
 *   import { VoiceAnalytics } from './voiceAnalytics';
 *   VoiceAnalytics.trackStarted({ plan: 'pro', platform: 'mobile', summaryId: 42, language: 'fr' });
 */

import { analytics } from "../../services/analytics";

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
    analytics.track("voice_chat_started" as any, {
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
    analytics.track("voice_chat_ended" as any, {
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
    analytics.track("voice_chat_quota_warning" as any, {
      percent_used: data.percentUsed,
      plan: data.plan,
      remaining_seconds: data.remainingSeconds,
    });
  },

  /** Quota atteint — session bloquee */
  trackQuotaReached(data: { plan: string; totalSecondsUsed: number }) {
    analytics.track("voice_chat_quota_reached" as any, {
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
    analytics.track("voice_chat_addon_purchased" as any, {
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
    analytics.track("voice_chat_upgrade_clicked" as any, {
      current_plan: data.currentPlan,
      target_plan: data.targetPlan ?? null,
      trigger: data.trigger,
    });
  },

  /** Erreur technique (micro, WebSocket, STT, etc.) */
  trackError(data: { errorType: string; plan: string; platform: string }) {
    analytics.track("voice_chat_error" as any, {
      error_type: data.errorType,
      plan: data.plan,
      platform: data.platform,
    });
  },
};
