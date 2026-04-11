/**
 * Voice Chat Analytics — PostHog tracking events
 *
 * Utilise le service analytics centralisé (PostHog) pour tracker
 * les interactions voice chat : sessions, quotas, upgrades, erreurs.
 *
 * Usage :
 *   import { VoiceAnalytics } from './voiceAnalytics';
 *   VoiceAnalytics.trackStarted({ plan: 'pro', platform: 'web', summaryId: 42, language: 'fr' });
 */

import { analytics } from '../../services/analytics';

// ═══════════════════════════════════════════════════════════════════════════════
// Event names (type-safe constants)
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceAnalyticsEvents = {
  STARTED: 'voice_chat_started',
  ENDED: 'voice_chat_ended',
  QUOTA_WARNING: 'voice_chat_quota_warning',
  QUOTA_REACHED: 'voice_chat_quota_reached',
  ADDON_PURCHASED: 'voice_chat_addon_purchased',
  UPGRADE_CLICKED: 'voice_chat_upgrade_clicked',
  ERROR: 'voice_chat_error',
  SPEED_CHANGED: 'voice_chat_speed_changed',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Typed event helpers
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceAnalytics = {
  /** Debut de session voice */
  trackStarted(data: { plan: string; platform: string; summaryId: number; language: string }) {
    analytics.capture(VoiceAnalyticsEvents.STARTED, {
      plan: data.plan,
      platform: data.platform,
      summary_id: data.summaryId,
      language: data.language,
    });
  },

  /** Fin de session voice */
  trackEnded(data: { durationSeconds: number; plan: string; platform: string; summaryId: number }) {
    analytics.capture(VoiceAnalyticsEvents.ENDED, {
      duration_seconds: data.durationSeconds,
      plan: data.plan,
      platform: data.platform,
      summary_id: data.summaryId,
    });
  },

  /** Alerte quota (80%, 90%, etc.) */
  trackQuotaWarning(data: { percentUsed: number; plan: string; remainingSeconds: number }) {
    analytics.capture(VoiceAnalyticsEvents.QUOTA_WARNING, {
      percent_used: data.percentUsed,
      plan: data.plan,
      remaining_seconds: data.remainingSeconds,
    });
  },

  /** Quota atteint — session bloquee */
  trackQuotaReached(data: { plan: string; totalSecondsUsed: number }) {
    analytics.capture(VoiceAnalyticsEvents.QUOTA_REACHED, {
      plan: data.plan,
      total_seconds_used: data.totalSecondsUsed,
    });
  },

  /** Add-on minutes achete */
  trackAddonPurchased(data: { packMinutes: number; priceCents: number; plan: string }) {
    analytics.capture(VoiceAnalyticsEvents.ADDON_PURCHASED, {
      pack_minutes: data.packMinutes,
      price_cents: data.priceCents,
      plan: data.plan,
    });
  },

  /** CTA upgrade clique depuis voice chat */
  trackUpgradeClicked(data: { currentPlan: string; targetPlan?: string; trigger: string }) {
    analytics.capture(VoiceAnalyticsEvents.UPGRADE_CLICKED, {
      current_plan: data.currentPlan,
      target_plan: data.targetPlan ?? null,
      trigger: data.trigger,
    });
  },

  /** Erreur technique (micro, WebSocket, STT, etc.) */
  trackError(data: { errorType: string; plan: string; platform: string }) {
    analytics.capture(VoiceAnalyticsEvents.ERROR, {
      error_type: data.errorType,
      plan: data.plan,
      platform: data.platform,
    });
  },

  /** Changement de preset de vitesse du chat vocal */
  trackSpeedChanged(data: { presetId: string; playbackRate: number; concise: boolean }) {
    analytics.capture(VoiceAnalyticsEvents.SPEED_CHANGED, {
      preset_id: data.presetId,
      playback_rate: data.playbackRate,
      concise: data.concise,
    });
  },
};
