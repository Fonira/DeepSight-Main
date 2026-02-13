/**
 * 📊 useAnalytics — Hook pour tracker les events critiques
 *
 * S'utilise dans les composants pour tracker des actions utilisateur.
 * Respecte automatiquement le consentement RGPD via le service analytics.
 */

import { useCallback } from 'react';
import { analytics, AnalyticsEvents } from '../services/analytics';

export function useAnalytics() {
  const trackSignup = useCallback((method: 'email' | 'google') => {
    analytics.capture(AnalyticsEvents.SIGNUP, { method });
  }, []);

  const trackLogin = useCallback((userId: string | number, plan: string, method: 'email' | 'google') => {
    analytics.identify(userId, { plan });
    analytics.capture(AnalyticsEvents.LOGIN, { method, plan });
  }, []);

  const trackLogout = useCallback(() => {
    analytics.capture(AnalyticsEvents.LOGOUT);
    analytics.reset();
  }, []);

  const trackAnalysis = useCallback((props: {
    videoId?: string;
    duration?: string;
    mode?: string;
    model?: string;
  }) => {
    analytics.capture(AnalyticsEvents.VIDEO_ANALYZED, props);
  }, []);

  const trackAnalysisStarted = useCallback((props: {
    url?: string;
    mode?: string;
    model?: string;
  }) => {
    analytics.capture(AnalyticsEvents.VIDEO_ANALYSIS_STARTED, props);
  }, []);

  const trackExport = useCallback((format: string) => {
    analytics.capture(AnalyticsEvents.EXPORT_CREATED, { format });
  }, []);

  const trackUpgrade = useCallback((fromPlan: string, toPlan: string) => {
    analytics.capture(AnalyticsEvents.UPGRADE_STARTED, { from: fromPlan, to: toPlan });
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
    trackExport,
    trackUpgrade,
    trackChat,
    trackError,
    // Accès direct pour events custom
    capture: analytics.capture.bind(analytics),
  };
}
