/**
 * 📊 Analytics Service — PostHog Integration (RGPD-compliant)
 *
 * Respecte le consentement cookies :
 * - N'initialise PostHog que si l'utilisateur a accepté les analytics
 * - Écoute l'event cookie-consent-updated pour s'activer/désactiver dynamiquement
 * - Aucun tracking avant consentement explicite
 *
 * Usage :
 *   import { analytics } from '@/services/analytics';
 *   analytics.capture('video_analyzed', { duration: '5:23' });
 *   analytics.identify(userId, { plan: 'pro', email });
 */

import posthog from "posthog-js";
import { hasAnalyticsConsent } from "../components/CookieBanner";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES — Core Web Vitals payload
// ═══════════════════════════════════════════════════════════════════════════════

/** Nom court W3C d'une Core Web Vital. */
export type WebVitalName = "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB";

/** Classification W3C de la valeur d'une Web Vital. */
export type WebVitalRating = "good" | "needs-improvement" | "poor";

/** Type de navigation tel que reporté par la lib `web-vitals`. */
export type WebVitalNavigationType =
  | "navigate"
  | "reload"
  | "back-forward"
  | "back-forward-cache"
  | "prerender"
  | "restore";

/**
 * Payload standard W3C pour une Core Web Vital.
 * Compatible avec les `Metric` objects retournés par la librairie `web-vitals`.
 */
export interface WebVitalPayload {
  /** Nom de la metric (LCP, FID, CLS, INP, TTFB, FCP) */
  name: WebVitalName;
  /** Valeur numérique (ms ou score selon la metric) */
  value: number;
  /** Classification W3C : good | needs-improvement | poor */
  rating: WebVitalRating;
  /** Delta depuis la dernière émission (utile pour CLS qui s'accumule) */
  delta: number;
  /** Identifiant unique du metric pour cette session */
  id: string;
  /**
   * Type de navigation associé (navigate, reload, back-forward,
   * back-forward-cache, prerender, restore).
   */
  navigationType?: WebVitalNavigationType;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "";
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let isInitialized = false;

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 INIT
// ═══════════════════════════════════════════════════════════════════════════════

function initPostHog(): void {
  if (isInitialized || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // RGPD : pas de persistence avant consentement
    persistence: "localStorage",
    // Désactiver l'autocapture pour économiser les events
    autocapture: false,
    // Capturer les pageviews manuellement pour SPA
    capture_pageview: false,
    capture_pageleave: true,
    // Privacy
    disable_session_recording: true,
    respect_dnt: true,
    // Performance
    loaded: (ph) => {
      // En dev, désactiver complètement
      if (import.meta.env.DEV) {
        ph.opt_out_capturing();
      }
    },
  });

  isInitialized = true;
}

function shutdownPostHog(): void {
  if (!isInitialized) return;
  posthog.opt_out_capturing();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ANALYTICS API
// ═══════════════════════════════════════════════════════════════════════════════

export const analytics = {
  /**
   * Initialise PostHog si consentement donné.
   * Appelé au mount de l'app.
   */
  init(): void {
    if (hasAnalyticsConsent()) {
      initPostHog();
      posthog.opt_in_capturing();
    }

    // Écouter les changements de consentement en temps réel
    window.addEventListener("cookie-consent-updated", ((event: CustomEvent) => {
      const prefs = event.detail;
      if (prefs?.analytics) {
        initPostHog();
        posthog.opt_in_capturing();
      } else {
        shutdownPostHog();
      }
    }) as EventListener);
  },

  /**
   * Identifier un utilisateur (post-login)
   */
  identify(
    userId: string | number,
    properties?: Record<string, unknown>,
  ): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.identify(String(userId), properties);
  },

  /**
   * Réinitialiser l'identité (post-logout)
   */
  reset(): void {
    if (!isInitialized) return;
    posthog.reset();
  },

  /**
   * Tracker un événement custom
   */
  capture(event: string, properties?: Record<string, unknown>): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.capture(event, properties);
  },

  /**
   * Tracker un pageview (SPA)
   */
  pageview(path?: string): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.capture("$pageview", {
      $current_url: path || window.location.href,
    });
  },

  /**
   * Tracker une Core Web Vital (LCP, FID, CLS, INP, TTFB, FCP).
   *
   * Émet un événement PostHog `web_vital` avec les propriétés W3C standard
   * (name, value, rating, delta, id, navigationType) plus le path courant.
   * Auto-gated sur le consentement RGPD via `hasAnalyticsConsent()`.
   */
  captureWebVital(metric: WebVitalPayload): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.capture("web_vital", {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: metric.rating,
      metric_delta: metric.delta,
      metric_id: metric.id,
      navigation_type: metric.navigationType,
      $current_url: window.location.href,
      pathname: window.location.pathname,
    });
  },

  /**
   * Ajouter des propriétés persistantes à tous les events
   */
  setUserProperties(properties: Record<string, unknown>): void {
    if (!isInitialized || !hasAnalyticsConsent()) return;
    posthog.people.set(properties);
  },

  /**
   * Feature flags PostHog
   */
  isFeatureEnabled(flag: string): boolean {
    if (!isInitialized) return false;
    return posthog.isFeatureEnabled(flag) ?? false;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 EVENTS PRÉDÉFINIS (type-safe)
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

  // Export
  EXPORT_CREATED: "export_created",

  // Billing
  UPGRADE_STARTED: "upgrade_started",
  UPGRADE_COMPLETED: "upgrade_completed",
  PLAN_CHANGED: "plan_changed",

  // Engagement
  STUDY_TOOL_USED: "study_tool_used",
  FACTCHECK_VIEWED: "factcheck_viewed",
  PLAYLIST_ANALYZED: "playlist_analyzed",

  // Errors
  ERROR_OCCURRED: "error_occurred",
  API_ERROR: "api_error",
} as const;

export type AnalyticsEvent =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
