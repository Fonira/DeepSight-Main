/**
 * PostHog Service — Mobile (Expo) Integration
 *
 * Mirror du service web `frontend/src/services/analytics.ts` mais via
 * `posthog-react-native`. Cohabite avec le service custom existant
 * `mobile/src/services/analytics.ts` (queue + batch backend) qui reste
 * la source pour `/api/analytics/events`. PostHog en plus = analytics
 * cloud direct (RGPD eu.i.posthog.com).
 *
 * RGPD :
 * - Initialisé seulement si consentement donné (`hasAnalyticsConsent()`)
 * - Désactivé en DEV (`__DEV__ === true`)
 * - Pas d'autocapture (économie d'events)
 * - host EU : eu.i.posthog.com
 *
 * Usage :
 *   import { posthogAnalytics, AnalyticsEvents } from '@/services/posthog';
 *   posthogAnalytics.capture(AnalyticsEvents.VIDEO_ANALYZED, { duration_s: 323 });
 *   posthogAnalytics.identify(userId, { plan: 'pro', email });
 *
 * Provider (root layout) :
 *   <PostHogProvider client={getPostHogClient()} autocapture={false}>
 *     {children}
 *   </PostHogProvider>
 */

import PostHog from "posthog-react-native";

/**
 * Type de propriétés acceptées par PostHog (JSON sérialisable).
 * On expose `Record<string, unknown>` aux call-sites pour ergonomie ; cast
 * vers `any` à l'intérieur du wrapper (PostHogEventProperties = JsonType
 * récursif, trop strict pour usage applicatif).
 */
type Properties = Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;
let isInitialized = false;
let consentGranted = true; // TODO: brancher sur un futur ConsentContext mobile

/**
 * Returns true if the user has granted analytics consent.
 *
 * Mobile n'a pas (encore) de bannière cookies équivalente au web. Pour le
 * launch J0 on assume opt-in implicite via les CGU + opt-out depuis le profil
 * (existe déjà via `analytics.optOut()` dans `analytics.ts`). Si un
 * `ConsentContext` mobile est ajouté plus tard, brancher ici.
 */
export function hasAnalyticsConsent(): boolean {
  return consentGranted;
}

/**
 * Setter exposé pour relier un futur ConsentContext (TODO).
 */
export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  if (!granted) {
    client?.optOut();
  } else {
    client?.optIn();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the singleton PostHog client. Lazily instantiated to avoid
 * tracking in Jest tests and on first launch before consent.
 *
 * Returns `null` if no API key is configured (dev / build sans secret).
 */
export function getPostHogClient(): PostHog | null {
  if (client) return client;
  if (!POSTHOG_KEY) {
    if (__DEV__) {
      console.warn(
        "[posthog] EXPO_PUBLIC_POSTHOG_KEY is not set — PostHog disabled.",
      );
    }
    return null;
  }

  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Capture lifecycle (app foreground/background) automatically.
    captureAppLifecycleEvents: true,
    // Privacy
    enableSessionReplay: false,
    // Performance — flush batch toutes les 30s
    flushInterval: 30,
    flushAt: 20,
  });

  // Désactiver en DEV
  if (__DEV__) {
    client.optOut();
  } else if (!consentGranted) {
    client.optOut();
  }

  isInitialized = true;
  return client;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS API (mirror du web)
// ═══════════════════════════════════════════════════════════════════════════════

export const posthogAnalytics = {
  /**
   * Initialise le client PostHog (idempotent).
   * Appelé au mount via `<PostHogProvider>` ou manuellement.
   */
  init(): PostHog | null {
    return getPostHogClient();
  },

  /**
   * Identifier un utilisateur (post-login)
   */
  identify(userId: string | number, properties?: Properties): void {
    if (__DEV__ || !consentGranted) return;
    const ph = getPostHogClient();
    // Cast : PostHogEventProperties = JsonType strict, trop contraignant.
    ph?.identify(String(userId), properties as never);
  },

  /**
   * Réinitialiser l'identité (post-logout)
   */
  reset(): void {
    const ph = getPostHogClient();
    ph?.reset();
  },

  /**
   * Tracker un événement custom
   */
  capture(event: string, properties?: Properties): void {
    if (__DEV__ || !consentGranted) return;
    const ph = getPostHogClient();
    ph?.capture(event, properties as never);
  },

  /**
   * Tracker un screen (mobile equivalent du pageview web)
   */
  screen(name: string, properties?: Properties): void {
    if (__DEV__ || !consentGranted) return;
    const ph = getPostHogClient();
    ph?.screen(name, properties as never);
  },

  /**
   * Ajouter des propriétés persistantes à tous les events
   */
  setUserProperties(properties: Properties): void {
    if (__DEV__ || !consentGranted) return;
    const ph = getPostHogClient();
    ph?.identify(undefined, properties as never);
  },

  /**
   * Feature flags PostHog
   */
  isFeatureEnabled(flag: string): boolean {
    if (__DEV__ || !consentGranted) return false;
    const ph = getPostHogClient();
    return ph?.isFeatureEnabled(flag) ?? false;
  },

  /**
   * Force flush — utile pour les tests / app close.
   */
  async flush(): Promise<void> {
    const ph = getPostHogClient();
    await ph?.flush();
  },

  /**
   * Indique si le client est prêt.
   */
  isReady(): boolean {
    return isInitialized && consentGranted && !__DEV__;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS PRÉDÉFINIS (mirror du web — type-safe)
//
// On reprend les noms du web pour avoir un funnel cross-platform unifié dans
// PostHog. Si un event n'existe que côté mobile, le préfixer `mobile_*`.
// ═══════════════════════════════════════════════════════════════════════════════

export const AnalyticsEvents = {
  // Auth
  SIGNUP: "user_signup",
  LOGIN: "user_login",
  LOGOUT: "user_logout",

  // Core feature
  VIDEO_ANALYZED: "video_analyzed",
  VIDEO_ANALYSIS_STARTED: "video_analysis_started",
  VIDEO_ANALYSIS_FAILED: "video_analysis_failed",

  // Chat
  CHAT_MESSAGE_SENT: "chat_message_sent",
  CHAT_SESSION_STARTED: "chat_session_started",

  // Voice (Quick Voice Call — mobile killer feature)
  VOICE_CHAT_STARTED: "voice_chat_started",
  QUICK_VOICE_CALL_STARTED: "quick_voice_call_started",
  VOICE_CHAT_ENDED: "voice_chat_ended",

  // Export
  EXPORT_CREATED: "export_created",

  // Billing
  UPGRADE_STARTED: "upgrade_started",
  UPGRADE_COMPLETED: "upgrade_completed",
  PLAN_UPGRADED: "plan_upgraded",
  PLAN_CHANGED: "plan_changed",

  // Engagement
  STUDY_TOOL_USED: "study_tool_used",
  FACTCHECK_VIEWED: "factcheck_viewed",
  PLAYLIST_ANALYZED: "playlist_analyzed",

  // Errors
  ERROR_OCCURRED: "error_occurred",
  API_ERROR: "api_error",

  // Mobile-specific
  MOBILE_SHARE_INTENT_RECEIVED: "mobile_share_intent_received",
  MOBILE_TAB_SWITCHED: "mobile_tab_switched",
} as const;

export type AnalyticsEvent =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
