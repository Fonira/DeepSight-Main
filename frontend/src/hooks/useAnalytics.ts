/**
 * 📊 useAnalytics — Hook pour tracker les events critiques
 *
 * S'utilise dans les composants pour tracker des actions utilisateur.
 * Respecte automatiquement le consentement RGPD via le service analytics.
 *
 * Sprint Launch J0 (2026-05-15) — enrichi avec UTM auto-capture pour
 * breakdown signups/payments par canal d'acquisition (PH, Twitter, etc.).
 */

import { useCallback } from "react";
import { analytics, AnalyticsEvents } from "../services/analytics";
import { getCapturedUtm } from "../services/utmCapture";

export function useAnalytics() {
  /**
   * Tracker `user_signup` côté client (best-effort — le serveur fire
   * `signup_completed` via `verify_email` pour la fiabilité).
   * Enrichi UTM pour breakdown par canal.
   */
  const trackSignup = useCallback((method: "email" | "google") => {
    const utm = getCapturedUtm();
    analytics.capture(AnalyticsEvents.SIGNUP, { method, ...utm });
  }, []);

  /**
   * Identify + capture `user_login`. Enrichit le profil PostHog avec les UTM
   * persistés pour permettre le filtrage par cohort `Launch J0 signups`.
   */
  const trackLogin = useCallback(
    (userId: string | number, plan: string, method: "email" | "google") => {
      const utm = getCapturedUtm();
      analytics.identify(userId, {
        plan,
        signup_source: utm.utm_source,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
      });
      analytics.capture(AnalyticsEvents.LOGIN, { method, plan, ...utm });
    },
    [],
  );

  const trackLogout = useCallback(() => {
    analytics.capture(AnalyticsEvents.LOGOUT);
    analytics.reset();
  }, []);

  const trackAnalysis = useCallback(
    (props: {
      videoId?: string;
      duration?: string;
      mode?: string;
      model?: string;
    }) => {
      analytics.capture(AnalyticsEvents.VIDEO_ANALYZED, props);
    },
    [],
  );

  const trackAnalysisStarted = useCallback(
    (props: { url?: string; mode?: string; model?: string }) => {
      analytics.capture(AnalyticsEvents.VIDEO_ANALYSIS_STARTED, props);
    },
    [],
  );

  /**
   * 🚀 Launch J0 — `signup_started` au clic CTA landing (avant register).
   * Permet de mesurer le drop-off CTA→form→submit.
   */
  const trackSignupStarted = useCallback(
    (props?: { cta_location?: string }) => {
      const utm = getCapturedUtm();
      analytics.capture(AnalyticsEvents.SIGNUP_STARTED, {
        ...utm,
        referrer: document.referrer || "direct",
        ...props,
      });
    },
    [],
  );

  /**
   * 🚀 Launch J0 — `analysis_started` enrichi avec metadata launch.
   * Distinct de `trackAnalysisStarted` (qui reste pour `video_analysis_started`
   * legacy) car launch funnel A utilise un event séparé pour breakdown propre.
   */
  const trackLaunchAnalysisStarted = useCallback(
    (props: {
      video_platform?: "youtube" | "tiktok";
      video_duration_min?: number;
      analysis_mode?: string;
      is_first_analysis?: boolean;
    }) => {
      analytics.capture(AnalyticsEvents.ANALYSIS_STARTED, {
        ...props,
        ...getCapturedUtm(),
      });
    },
    [],
  );

  /**
   * 🚀 Launch J0 — `payment_initiated` au clic CTA Subscribe avant redirect
   * Stripe Checkout. Permet le funnel C (5+ analyses → upgrade 7d).
   */
  const trackPaymentInitiated = useCallback(
    (props: {
      plan: "pro" | "expert";
      cycle: "monthly" | "yearly";
      current_plan?: string;
      time_since_signup_days?: number;
    }) => {
      analytics.capture(AnalyticsEvents.PAYMENT_INITIATED, {
        ...props,
        ...getCapturedUtm(),
      });
    },
    [],
  );

  const trackExport = useCallback((format: string) => {
    analytics.capture(AnalyticsEvents.EXPORT_CREATED, { format });
  }, []);

  const trackUpgrade = useCallback((fromPlan: string, toPlan: string) => {
    analytics.capture(AnalyticsEvents.UPGRADE_STARTED, {
      from: fromPlan,
      to: toPlan,
    });
  }, []);

  const trackChat = useCallback(() => {
    analytics.capture(AnalyticsEvents.CHAT_MESSAGE_SENT);
  }, []);

  const trackError = useCallback((error: string, context?: string) => {
    analytics.capture(AnalyticsEvents.ERROR_OCCURRED, { error, context });
  }, []);

  return {
    trackSignup,
    trackLogin,
    trackLogout,
    trackAnalysis,
    trackAnalysisStarted,
    trackSignupStarted,
    trackLaunchAnalysisStarted,
    trackPaymentInitiated,
    trackExport,
    trackUpgrade,
    trackChat,
    trackError,
    // Accès direct pour events custom
    capture: analytics.capture.bind(analytics),
  };
}
